import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getSession } from '@/lib/auth'
import { registrarAuditoria } from '@/lib/auditoria'

export const dynamic = 'force-dynamic'

function db() {
  return neon(process.env.DATABASE_URL!)
}

/**
 * GET /api/fechar-mes
 * Lista meses fechados.
 */
export async function GET() {
  const sessao = await getSession()
  if (!sessao.userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const sql = db()
  const meses = await sql`
    SELECT mes, fechado_por_nome, fechado_em,
           saldo_receitas, saldo_despesas, saldo_resultado
    FROM meses_fechados
    ORDER BY mes DESC
    LIMIT 24
  `
  return NextResponse.json(meses)
}

/**
 * POST /api/fechar-mes
 * Fecha um mês (master only). Calcula saldo e grava em meses_fechados.
 * Body: { mes: "YYYY-MM" }
 */
export async function POST(req: NextRequest) {
  const sessao = await getSession()
  if (!sessao.userId || sessao.perfil !== 'master') {
    return NextResponse.json({ error: 'Somente masters podem fechar meses' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const { mes } = body as Record<string, unknown>
  if (typeof mes !== 'string' || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ error: 'mes obrigatório no formato YYYY-MM' }, { status: 400 })
  }

  const sql = db()

  // Verifica se já está fechado
  const jaFechado = await sql`
    SELECT 1 FROM meses_fechados WHERE mes = ${mes} LIMIT 1
  `
  if (jaFechado.length > 0) {
    return NextResponse.json({ error: `Mês ${mes} já está fechado` }, { status: 409 })
  }

  // Calcula saldo do mês
  const [receitas, despesas] = await Promise.all([
    sql`
      SELECT COALESCE(SUM(valor), 0) as total FROM lancamentos
      WHERE tipo = 'receita' AND cancelado = FALSE AND data LIKE ${mes + '-%'}
    `,
    sql`
      SELECT COALESCE(SUM(valor), 0) as total FROM lancamentos
      WHERE tipo = 'despesa' AND cancelado = FALSE AND data LIKE ${mes + '-%'}
    `,
  ])

  const saldoReceitas  = Number(receitas[0]?.total  ?? 0)
  const saldoDespesas  = Number(despesas[0]?.total  ?? 0)
  const saldoResultado = saldoReceitas - saldoDespesas

  await sql`
    INSERT INTO meses_fechados
      (mes, fechado_por_id, fechado_por_nome, saldo_receitas, saldo_despesas, saldo_resultado)
    VALUES
      (${mes}, ${sessao.userId}, ${sessao.nome}, ${saldoReceitas}, ${saldoDespesas}, ${saldoResultado})
    ON CONFLICT (mes) DO NOTHING
  `

  void registrarAuditoria({
    usuario_id:   sessao.userId,
    usuario_nome: sessao.nome,
    acao:         'fechar_mes',
    entidade:     'mes',
    entidade_id:  mes,
    detalhes:     { saldoReceitas, saldoDespesas, saldoResultado },
  })

  return NextResponse.json({
    ok: true,
    mes,
    saldo_receitas:  saldoReceitas,
    saldo_despesas:  saldoDespesas,
    saldo_resultado: saldoResultado,
  })
}

/**
 * DELETE /api/fechar-mes
 * Reabre um mês fechado (master only).
 * Body: { mes: "YYYY-MM" }
 */
export async function DELETE(req: NextRequest) {
  const sessao = await getSession()
  if (!sessao.userId || sessao.perfil !== 'master') {
    return NextResponse.json({ error: 'Somente masters podem reabrir meses' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const { mes } = body as Record<string, unknown>
  if (typeof mes !== 'string') {
    return NextResponse.json({ error: 'mes obrigatório' }, { status: 400 })
  }

  const sql = db()
  await sql`DELETE FROM meses_fechados WHERE mes = ${mes}`

  void registrarAuditoria({
    usuario_id:   sessao.userId,
    usuario_nome: sessao.nome,
    acao:         'reabrir_mes',
    entidade:     'mes',
    entidade_id:  mes,
  })

  return NextResponse.json({ ok: true, mes })
}
