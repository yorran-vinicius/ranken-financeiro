import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { neon } from '@neondatabase/serverless'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function db() {
  return neon(process.env.DATABASE_URL!)
}

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export async function GET() {
  const sessao = await getSession()
  if (!sessao.userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const sql = db()
  const anoAtual = new Date().getFullYear()

  const [mensalOp, stripeResumo, custos] = await Promise.all([
    // Receitas operacionais por mês (ano atual)
    sql`
      SELECT
        data_slice,
        SUM(receita) as receita,
        SUM(despesa) as despesa
      FROM (
        SELECT
          SUBSTRING(data, 1, 7)          as data_slice,
          CASE WHEN tipo = 'receita' AND categoria != 'Aporte' THEN valor ELSE 0 END as receita,
          CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END                           as despesa
        FROM lancamentos
        WHERE cancelado = FALSE
          AND data LIKE ${anoAtual + '-%'}
      ) sub
      GROUP BY data_slice
      ORDER BY data_slice
    `,
    // MRR Stripe
    sql`
      SELECT
        COALESCE(SUM(valor_mensal) FILTER (WHERE status = 'active'), 0) as mrr,
        COUNT(*) FILTER (WHERE status = 'active')::int                  as ativas,
        COUNT(*) FILTER (WHERE status IN ('past_due','unpaid'))::int    as em_risco
      FROM stripe_assinaturas
    `,
    // Custos fixos médio (recorrentes dos últimos 3 meses)
    sql`
      SELECT COALESCE(AVG(total), 0) as media_custo_fixo
      FROM (
        SELECT SUBSTRING(data, 1, 7) as mes, SUM(valor) as total
        FROM lancamentos
        WHERE tipo = 'despesa'
          AND tipo_lancamento = 'recorrente'
          AND cancelado = FALSE
          AND data >= ${new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)}
        GROUP BY SUBSTRING(data, 1, 7)
      ) sub
    `,
  ])

  const mrr = Number(stripeResumo[0]?.mrr ?? 0)
  const ativas = Number(stripeResumo[0]?.ativas ?? 0)
  const emRisco = Number(stripeResumo[0]?.em_risco ?? 0)
  const mediaCustoFixo = Number(custos[0]?.media_custo_fixo ?? 0)

  const totalReceita = mensalOp.reduce((s, m) => s + Number(m.receita ?? 0), 0)
  const totalDespesa = mensalOp.reduce((s, m) => s + Number(m.despesa ?? 0), 0)
  const mediaMensalReceita = mensalOp.length > 0 ? totalReceita / mensalOp.length : 0
  const mediaMensalDespesa = mensalOp.length > 0 ? totalDespesa / mensalOp.length : 0

  const dados = {
    ano: anoAtual,
    meses_com_dados: mensalOp.length,
    receita_total_ytd: brl(totalReceita),
    despesa_total_ytd: brl(totalDespesa),
    resultado_ytd: brl(totalReceita - totalDespesa),
    media_mensal_receita: brl(mediaMensalReceita),
    media_mensal_despesa: brl(mediaMensalDespesa),
    mrr_stripe: brl(mrr),
    assinantes_ativos: ativas,
    assinantes_em_risco: emRisco,
    media_custo_fixo_mensal: brl(mediaCustoFixo),
    projecao_receita_anual: brl(mediaMensalReceita * 12),
    projecao_resultado_anual: brl((mediaMensalReceita - mediaMensalDespesa) * 12),
  }

  let previsao = ''
  let tendencia: 'positiva' | 'neutra' | 'negativa' = 'neutra'

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model:      'claude-sonnet-4-5-20250929',
      max_tokens: 400,
      messages: [{
        role:    'user',
        content: `Você é o CFO virtual do RANKEN, comunidade de esportes de raquete.
Com base nos dados financeiros abaixo, escreva uma previsão de faturamento para os próximos 3 meses em 3-5 frases diretas. Inclua: tendência atual, riscos (assinantes em risco), oportunidades e uma recomendação de ação. Seja direto e use linguagem executiva.

Dados: ${JSON.stringify(dados)}`,
      }],
    })
    const bloco = response.content.find((b) => b.type === 'text')
    if (bloco?.type === 'text') previsao = bloco.text

    // Determina tendência
    const resultado = mediaMensalReceita - mediaMensalDespesa
    if (resultado > 0 && emRisco < ativas * 0.1) tendencia = 'positiva'
    else if (resultado < 0 || emRisco > ativas * 0.2) tendencia = 'negativa'
  } catch (err) {
    console.error('[ia-previsao] Erro ao gerar previsão:', err)
    previsao = 'Não foi possível gerar a previsão. Verifique a integração com a IA.'
  }

  return NextResponse.json({
    dados,
    previsao,
    tendencia,
    geradoEm: new Date().toISOString(),
  })
}
