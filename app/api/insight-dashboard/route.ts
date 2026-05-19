import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { neon } from '@neondatabase/serverless'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

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
    // Busca dados financeiros do mês
    const dadosMes = await sql`
      SELECT
        COALESCE(SUM(CASE
          WHEN tipo = 'receita' AND categoria NOT IN (
            SELECT nome FROM categorias WHERE nome = 'Aporte'
          ) THEN valor ELSE 0
        END), 0) as receita_operacional,
        COALESCE(SUM(CASE
          WHEN tipo = 'receita' AND categoria IN (
            SELECT nome FROM categorias WHERE nome = 'Aporte'
          ) THEN valor ELSE 0
        END), 0) as aportes,
        COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END), 0) as despesas,
        COUNT(CASE WHEN tipo = 'despesa' AND tipo_lancamento = 'recorrente' THEN 1 END) as qtd_fixos
      FROM lancamentos
      WHERE cancelado = FALSE
        AND data LIKE ${mes + '%'}
    `

    const d = dadosMes[0]
    const receitaOp = Number(d?.receita_operacional ?? 0)
    const aportes = Number(d?.aportes ?? 0)
    const despesas = Number(d?.despesas ?? 0)
    const saldo = receitaOp - despesas
    const qtdFixos = Number(d?.qtd_fixos ?? 0)

    // Busca meta anual
    const configRows = await sql`SELECT valor FROM configuracoes WHERE chave = 'meta_anual'`
    const metaAnual = parseFloat(configRows[0]?.valor as string ?? '300000')

    // Busca acumulado do ano
    const ano = mes.substring(0, 4)
    const acumuladoRows = await sql`
      SELECT COALESCE(SUM(valor), 0) as total
      FROM lancamentos
      WHERE tipo = 'receita'
        AND cancelado = FALSE
        AND data LIKE ${ano + '%'}
        AND categoria NOT IN (SELECT nome FROM categorias WHERE nome = 'Aporte')
    `
    const acumulado = Number(acumuladoRows[0]?.total ?? 0)

    const mesNum = parseInt(mes.slice(5, 7), 10)
    const paceEsperado = metaAnual > 0 ? (mesNum / 12) * 100 : 0
    const progressoAtual = metaAnual > 0 ? (acumulado / metaAnual) * 100 : 0

    const client = new Anthropic()

    const prompt = `Você é o assistente financeiro do RANKEN, uma comunidade de esportes de raquete (tênis, beach tennis, padel). Analise os dados abaixo e gere UMA frase curta e direta de insight para o dashboard (máximo 2 linhas, tom humano e direto, sem ser corporativo).

Dados de ${mes}:
- Receita operacional: R$ ${receitaOp.toFixed(2)}
- Aportes dos sócios: R$ ${aportes.toFixed(2)}
- Despesas totais: R$ ${despesas.toFixed(2)}
- Saldo do mês: R$ ${saldo.toFixed(2)}
- Acumulado no ano: R$ ${acumulado.toFixed(2)}
- Meta anual: R$ ${metaAnual.toFixed(2)} (${progressoAtual.toFixed(1)}% alcançado, ritmo esperado ${paceEsperado.toFixed(1)}%)
- Custos fixos recorrentes: ${qtdFixos}

Gere apenas a frase de insight, sem explicações adicionais. Seja específico com os números quando relevante. Se o resultado for negativo, seja honesto mas construtivo. Fale como alguém do time, não como sistema.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })

    const insight =
      response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    return NextResponse.json({ insight, geradoEm: new Date().toISOString() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[insight-dashboard]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
