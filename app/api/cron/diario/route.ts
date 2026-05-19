import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { enviarEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function db() {
  return neon(process.env.DATABASE_URL!)
}

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export async function GET(req: NextRequest) {
  // Validar que é o cron do Vercel
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const sql = db()
  const hoje = new Date()

  try {
    // ── 1. Caixa projetado nos próximos 7 dias ────────────────────────────────
    const hojeStr  = hoje.toISOString().slice(0, 10)
    const em7Str   = new Date(hoje.getTime() + 7 * 86400000).toISOString().slice(0, 10)

    const entradas = await sql`
      SELECT COALESCE(SUM(valor), 0) as total FROM lancamentos
      WHERE tipo = 'receita' AND cancelado = FALSE
        AND data >= ${hojeStr} AND data <= ${em7Str}
    `
    const saidas = await sql`
      SELECT COALESCE(SUM(valor), 0) as total FROM lancamentos
      WHERE tipo = 'despesa' AND cancelado = FALSE
        AND data >= ${hojeStr} AND data <= ${em7Str}
    `
    const repassesPrevistos = await sql`
      SELECT COALESCE(SUM(valor_liquido), 0) as total FROM stripe_repasses
      WHERE status IN ('previsto', 'em_risco')
        AND data_repasse_prevista BETWEEN ${hojeStr}::date AND ${em7Str}::date
    `

    const saldoProjetado = Number(entradas[0]?.total ?? 0)
      - Number(saidas[0]?.total ?? 0)
      + Number(repassesPrevistos[0]?.total ?? 0)

    if (saldoProjetado < 0) {
      await enviarEmail({
        assunto: '🔴 Caixa projetado negativo',
        titulo:  'Atenção: caixa pode ficar negativo',
        corpo:   `Nos próximos 7 dias, a projeção de caixa é <strong>${brl(saldoProjetado)}</strong>. Revise as despesas ou antecipe receitas.`,
        tipo:    'alerta',
      })
    }

    // ── 2. Repasses Stripe atrasados (+2 dias sem confirmar) ──────────────────
    const doisDiasAtras = new Date(hoje.getTime() - 2 * 86400000).toISOString().slice(0, 10)

    const atrasados = await sql`
      SELECT cliente_nome, valor_liquido, data_repasse_prevista
      FROM stripe_repasses
      WHERE status = 'previsto'
        AND data_repasse_prevista < ${doisDiasAtras}::date
      ORDER BY data_repasse_prevista ASC
    `

    if (atrasados.length > 0) {
      const total = atrasados.reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0)
      const lista = atrasados
        .map(r => `• ${r.cliente_nome} — ${brl(Number(r.valor_liquido ?? 0))} (previsto ${r.data_repasse_prevista})`)
        .join('<br/>')

      await enviarEmail({
        assunto: `⏳ ${atrasados.length} repasse${atrasados.length > 1 ? 's' : ''} Stripe atrasado${atrasados.length > 1 ? 's' : ''}`,
        titulo:  'Repasses do Stripe não confirmados',
        corpo:   `${atrasados.length} repasse${atrasados.length > 1 ? 's' : ''} previsto${atrasados.length > 1 ? 's' : ''} (total <strong>${brl(total)}</strong>) deveriam ter caído mas não foram confirmados na conciliação. Verifique o extrato bancário.<br/><br/>${lista}`,
        tipo:    'alerta',
      })
    }

    // ── 3. Assinaturas past_due há +5 dias ────────────────────────────────────
    const cincoAtras = new Date(hoje.getTime() - 5 * 86400000).toISOString().slice(0, 10)

    const emRisco = await sql`
      SELECT cliente_nome, valor_mensal, data_proxima_cobranca
      FROM stripe_assinaturas
      WHERE status IN ('past_due', 'unpaid')
        AND data_proxima_cobranca < ${cincoAtras}::date
      ORDER BY valor_mensal DESC
    `

    if (emRisco.length > 0) {
      const totalRisco = emRisco.reduce((s, a) => s + Number(a.valor_mensal ?? 0), 0)
      await enviarEmail({
        assunto: `⚠️ ${emRisco.length} assinatura${emRisco.length > 1 ? 's' : ''} em risco`,
        titulo:  'Assinaturas com pagamento em atraso',
        corpo:   `${emRisco.length} assinante${emRisco.length > 1 ? 's' : ''} com pagamento em atraso há mais de 5 dias (total: <strong>${brl(totalRisco)}/mês</strong>). Pode ser necessária intervenção manual.`,
        tipo:    'alerta',
      })
    }

    return NextResponse.json({
      ok: true,
      saldoProjetado,
      repassesAtrasados: atrasados.length,
      assinaturasEmRisco: emRisco.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron-diario]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
