import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { neon } from '@neondatabase/serverless'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function nomeMesPT(num: number) {
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return MESES[num - 1] ?? ''
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes') // YYYY-MM

  if (!mes) {
    return NextResponse.json({ error: 'Parâmetro mes obrigatório' }, { status: 400 })
  }

  const sql = neon(process.env.DATABASE_URL!)

  try {
    // Busca dados completos do mês
    const lancamentos = await sql`
      SELECT descricao, valor, tipo, categoria, data, tipo_lancamento
      FROM lancamentos
      WHERE cancelado = FALSE AND data LIKE ${mes + '%'}
      ORDER BY data ASC
    `

    const receitaOp = lancamentos
      .filter(l => l.tipo === 'receita' && l.categoria !== 'Aporte')
      .reduce((s, l) => s + Number(l.valor), 0)
    const aportes = lancamentos
      .filter(l => l.tipo === 'receita' && l.categoria === 'Aporte')
      .reduce((s, l) => s + Number(l.valor), 0)
    const despesas = lancamentos
      .filter(l => l.tipo === 'despesa')
      .reduce((s, l) => s + Number(l.valor), 0)
    const saldo = receitaOp - despesas

    // Agrupamento por categoria
    const porCat: Record<string, { receita: number; despesa: number }> = {}
    for (const l of lancamentos) {
      if (!porCat[l.categoria as string]) porCat[l.categoria as string] = { receita: 0, despesa: 0 }
      if (l.tipo === 'receita') porCat[l.categoria as string].receita += Number(l.valor)
      else porCat[l.categoria as string].despesa += Number(l.valor)
    }

    // Meta anual
    const cfgRows = await sql`SELECT chave, valor FROM configuracoes WHERE chave IN ('meta_anual', 'nome_app')`
    const cfg: Record<string, string> = {}
    for (const r of cfgRows) cfg[r.chave as string] = r.valor as string
    const metaAnual = parseFloat(cfg.meta_anual ?? '300000')
    const nomeApp = cfg.nome_app ?? 'RANKEN Financeiro'

    // Acumulado do ano
    const ano = mes.slice(0, 4)
    const acRows = await sql`
      SELECT COALESCE(SUM(valor), 0) as total FROM lancamentos
      WHERE tipo = 'receita' AND cancelado = FALSE AND data LIKE ${ano + '%'}
        AND categoria != 'Aporte'
    `
    const acumulado = Number(acRows[0]?.total ?? 0)

    // Mês anterior para comparação
    const [anoN, mesN] = mes.split('-').map(Number)
    const mesAntNum = mesN === 1 ? 12 : mesN - 1
    const anoAnt = mesN === 1 ? anoN - 1 : anoN
    const mesAntISO = `${anoAnt}-${String(mesAntNum).padStart(2, '0')}`

    const lancAnt = await sql`
      SELECT tipo, valor FROM lancamentos WHERE cancelado = FALSE AND data LIKE ${mesAntISO + '%'}
    `
    const recAnt = lancAnt.filter(l => l.tipo === 'receita' && l.categoria !== 'Aporte')
      .reduce((s, l) => s + Number(l.valor), 0)
    const despAnt = lancAnt.filter(l => l.tipo === 'despesa')
      .reduce((s, l) => s + Number(l.valor), 0)

    const mesNome = nomeMesPT(mesN)
    const mesAntNome = nomeMesPT(mesAntNum)
    const proximoMes = nomeMesPT(mesN === 12 ? 1 : mesN + 1)

    const dadosCompletos = {
      mes: mesNome, ano,
      receita_operacional: brl(receitaOp),
      aportes: brl(aportes),
      despesas: brl(despesas),
      saldo: brl(saldo),
      acumulado_ano: brl(acumulado),
      meta_anual: brl(metaAnual),
      pct_meta: metaAnual > 0 ? ((acumulado / metaAnual) * 100).toFixed(1) + '%' : 'N/A',
      comparativo: {
        mes_anterior: mesAntNome,
        receita_ant: brl(recAnt),
        despesa_ant: brl(despAnt),
        var_receita: recAnt > 0 ? (((receitaOp - recAnt) / recAnt) * 100).toFixed(1) + '%' : 'N/A',
        var_despesa: despAnt > 0 ? (((despesas - despAnt) / despAnt) * 100).toFixed(1) + '%' : 'N/A',
      },
      por_categoria: porCat,
      total_lancamentos: lancamentos.length,
    }

    // Timeout de 10s para a IA
    const client = new Anthropic()
    const iaPromise = client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Você é o CFO do ${nomeApp}, comunidade de esportes de raquete.
Analise os dados financeiros de ${mesNome}/${ano} e escreva um relatório executivo profissional em português.

DADOS:
${JSON.stringify(dadosCompletos, null, 2)}

Escreva em 4 seções com os seguintes títulos exatos:
**RESUMO EXECUTIVO**
[2-3 parágrafos interpretando o mês]

**PONTOS POSITIVOS**
[3 bullets com o que foi bem]

**PONTOS DE ATENÇÃO**
[3 bullets com riscos ou problemas]

**RECOMENDAÇÕES PARA ${proximoMes.toUpperCase()}**
[3 ações concretas e específicas]

Tom: profissional mas direto. Use os números reais. Seja específico.`,
      }],
    })

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000))

    const response = await Promise.race([iaPromise, timeoutPromise])

    let analiseIA = ''
    if (response && 'content' in response) {
      const bloco = response.content.find((b) => b.type === 'text')
      if (bloco && bloco.type === 'text') analiseIA = bloco.text
    }

    return NextResponse.json({
      mes: mesNome,
      ano,
      analiseIA,
      dados: dadosCompletos,
      geradoEm: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[exportar-pdf-ia]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
