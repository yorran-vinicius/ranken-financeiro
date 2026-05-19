import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { neon } from '@neondatabase/serverless'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function db() {
  return neon(process.env.DATABASE_URL!)
}

export async function POST(_req: NextRequest) {
  const session = await getSession()
  if (!session.userId || session.perfil !== 'master') {
    return NextResponse.json({ error: 'Acesso restrito a masters' }, { status: 403 })
  }

  const sql = db()
  let totalAssinaturas = 0
  let totalRepasses    = 0

  try {
    // ── 1. Sincronizar todas as assinaturas (paginado) ────────────────────────
    let temMais = true
    let startingAfter: string | undefined

    while (temMais) {
      const subs = await stripe.subscriptions.list({
        limit:          100,
        status:         'all',
        starting_after: startingAfter,
        expand:         ['data.customer'],
      })

      for (const sub of subs.data) {
        const customer    = sub.customer as import('stripe').Stripe.Customer
        const clienteNome  = customer.name ?? customer.email ?? 'Desconhecido'
        const clienteEmail = customer.email ?? ''
        const valorMensal  = (sub.items.data[0]?.price.unit_amount ?? 0) / 100
        const periodEnd    = (sub as unknown as { current_period_end: number }).current_period_end

        await sql`
          INSERT INTO stripe_assinaturas
            (stripe_subscription_id, stripe_customer_id, cliente_nome, cliente_email,
             valor_mensal, status, data_inicio, data_proxima_cobranca, data_cancelamento)
          VALUES
            (${sub.id}, ${customer.id}, ${clienteNome}, ${clienteEmail},
             ${valorMensal}, ${sub.status},
             ${new Date(sub.created * 1000).toISOString().slice(0, 10)}::date,
             ${new Date(periodEnd * 1000).toISOString().slice(0, 10)}::date,
             ${sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString().slice(0, 10) : null})
          ON CONFLICT (stripe_subscription_id) DO UPDATE SET
            status                = EXCLUDED.status,
            valor_mensal          = EXCLUDED.valor_mensal,
            data_proxima_cobranca = EXCLUDED.data_proxima_cobranca,
            data_cancelamento     = EXCLUDED.data_cancelamento,
            atualizado_em         = NOW()
        `
        totalAssinaturas++
      }

      temMais = subs.has_more
      if (subs.data.length > 0) {
        startingAfter = subs.data[subs.data.length - 1].id
      }
    }

    // ── 2. Sincronizar invoices pagas dos últimos 3 meses ─────────────────────
    const tresM = new Date()
    tresM.setMonth(tresM.getMonth() - 3)

    let temMaisInv = true
    let startingAfterInv: string | undefined

    while (temMaisInv) {
      const invoices = await stripe.invoices.list({
        limit:          100,
        status:         'paid',
        created:        { gte: Math.floor(tresM.getTime() / 1000) },
        starting_after: startingAfterInv,
        expand:         ['data.customer'],
      })

      for (const inv of invoices.data) {
        const customer   = inv.customer as import('stripe').Stripe.Customer
        const clienteNome = customer?.name ?? customer?.email ?? 'Cliente Stripe'
        const valorBruto  = (inv.amount_paid ?? 0) / 100
        const valorTaxa   = valorBruto * 0.025 // estimativa se não conseguir balance_transaction

        const dataPagamento = new Date((inv.created ?? 0) * 1000)
        const dataRepasse   = new Date(dataPagamento)
        dataRepasse.setDate(dataRepasse.getDate() + 30)

        // Verifica se data de repasse já passou → status 'previsto' ou 'confirmado'
        const jaPassou = dataRepasse < new Date()
        const status   = jaPassou ? 'previsto' : 'previsto' // sempre previsto na sync inicial

        const invAny   = inv as unknown as Record<string, unknown>
        const chargeId = typeof invAny.charge === 'string' ? invAny.charge : null
        const subId    = typeof invAny.subscription === 'string' ? invAny.subscription : null

        await sql`
          INSERT INTO stripe_repasses
            (stripe_invoice_id, stripe_charge_id, stripe_subscription_id, cliente_nome,
             valor_bruto, valor_taxa, valor_liquido,
             data_pagamento, data_repasse_prevista, status)
          VALUES
            (${inv.id}, ${chargeId}, ${subId}, ${clienteNome},
             ${valorBruto}, ${valorTaxa}, ${valorBruto - valorTaxa},
             ${dataPagamento.toISOString().slice(0, 10)}::date,
             ${dataRepasse.toISOString().slice(0, 10)}::date,
             ${status})
          ON CONFLICT (stripe_invoice_id) DO NOTHING
        `
        totalRepasses++
      }

      temMaisInv = invoices.has_more
      if (invoices.data.length > 0) {
        startingAfterInv = invoices.data[invoices.data.length - 1].id
      }
    }

    return NextResponse.json({
      ok: true,
      assinaturas: totalAssinaturas,
      repasses:    totalRepasses,
      mensagem:    `${totalAssinaturas} assinaturas e ${totalRepasses} repasses importados`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stripe-sincronizar]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
