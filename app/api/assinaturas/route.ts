import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function db() {
  return neon(process.env.DATABASE_URL!)
}

export async function GET() {
  const sessao = await getSession()
  if (!sessao.userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const sql = db()

  const [assinaturas, historico, churnMensal, mrrHistorico] = await Promise.all([
    // Lista todas as assinaturas ativas
    sql`
      SELECT
        stripe_subscription_id, stripe_customer_id,
        cliente_nome, cliente_email,
        valor_mensal, status,
        data_inicio, data_proxima_cobranca, data_cancelamento,
        atualizado_em
      FROM stripe_assinaturas
      ORDER BY
        CASE status WHEN 'active' THEN 0 WHEN 'past_due' THEN 1 WHEN 'unpaid' THEN 2 ELSE 3 END,
        valor_mensal DESC
      LIMIT 300
    `,
    // Resumo global
    sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')::int        as ativas,
        COUNT(*) FILTER (WHERE status = 'past_due')::int      as past_due,
        COUNT(*) FILTER (WHERE status = 'canceled')::int      as canceladas,
        COUNT(*) FILTER (WHERE status = 'unpaid')::int        as inadimplentes,
        COALESCE(SUM(valor_mensal) FILTER (WHERE status = 'active'), 0)   as mrr,
        COALESCE(AVG(valor_mensal) FILTER (WHERE status = 'active'), 0)   as ticket_medio
      FROM stripe_assinaturas
    `,
    // Churn dos últimos 6 meses (por mês de cancelamento)
    sql`
      SELECT
        TO_CHAR(data_cancelamento, 'YYYY-MM') as mes,
        COUNT(*)::int                          as cancelamentos,
        COALESCE(SUM(valor_mensal), 0)         as mrr_perdido
      FROM stripe_assinaturas
      WHERE data_cancelamento IS NOT NULL
        AND data_cancelamento >= (CURRENT_DATE - INTERVAL '6 months')
      GROUP BY TO_CHAR(data_cancelamento, 'YYYY-MM')
      ORDER BY mes
    `,
    // Novas assinaturas dos últimos 6 meses (por mês de início)
    sql`
      SELECT
        TO_CHAR(data_inicio, 'YYYY-MM') as mes,
        COUNT(*)::int                   as novas,
        COALESCE(SUM(valor_mensal), 0)  as mrr_novo
      FROM stripe_assinaturas
      WHERE data_inicio >= (CURRENT_DATE - INTERVAL '6 months')
      GROUP BY TO_CHAR(data_inicio, 'YYYY-MM')
      ORDER BY mes
    `,
  ])

  return NextResponse.json({
    assinaturas,
    resumo:       historico[0] ?? {},
    churnMensal,
    mrrHistorico,
  })
}
