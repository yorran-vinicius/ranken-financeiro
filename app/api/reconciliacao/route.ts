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

  const [repasses, resumo, assinaturas] = await Promise.all([
    // Todos os repasses — ordenados por data prevista desc
    sql`
      SELECT
        id, cliente_nome, valor_bruto, valor_taxa, valor_liquido,
        data_pagamento, data_repasse_prevista, status,
        lancamento_id, tentativas_cobranca, atualizado_em
      FROM stripe_repasses
      ORDER BY data_repasse_prevista DESC
      LIMIT 200
    `,
    // Totais por status
    sql`
      SELECT
        status,
        COUNT(*)::int              as qtd,
        COALESCE(SUM(valor_liquido), 0) as total
      FROM stripe_repasses
      GROUP BY status
    `,
    // MRR resumo
    sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')::int       as ativas,
        COUNT(*) FILTER (WHERE status = 'past_due')::int     as past_due,
        COUNT(*) FILTER (WHERE status = 'canceled')::int     as canceladas,
        COALESCE(SUM(valor_mensal) FILTER (WHERE status = 'active'), 0) as mrr
      FROM stripe_assinaturas
    `,
  ])

  return NextResponse.json({
    repasses,
    resumo,
    assinaturas: assinaturas[0] ?? {},
  })
}

export async function PATCH(req: Request) {
  const sessao = await getSession()
  if (!sessao.userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const { repasse_id, status } = body as Record<string, unknown>

  if (!repasse_id || !status) {
    return NextResponse.json({ error: 'repasse_id e status obrigatórios' }, { status: 400 })
  }

  const statusValidos = ['previsto', 'confirmado', 'em_risco', 'cancelado']
  if (!statusValidos.includes(String(status))) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }

  const sql = db()
  await sql`
    UPDATE stripe_repasses
    SET status = ${String(status)}, atualizado_em = NOW()
    WHERE id = ${Number(repasse_id)}
  `

  return NextResponse.json({ ok: true })
}
