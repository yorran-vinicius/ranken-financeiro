import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { neon } from '@neondatabase/serverless'
import { enviarEmail } from '@/lib/email'

// Webhook do Stripe precisa do raw body — não usar bodyParser
export const dynamic = 'force-dynamic'

function db() {
  return neon(process.env.DATABASE_URL!)
}

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
  }

  const sql = db()

  try {
    switch (event.type) {

      // ── Pagamento bem-sucedido → criar repasse previsto (D+30) ───────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const valorBruto = (invoice.amount_paid ?? 0) / 100

        const dataPagamento = new Date((invoice.created ?? 0) * 1000)
        const dataRepasse   = new Date(dataPagamento)
        dataRepasse.setDate(dataRepasse.getDate() + 30)

        // Busca taxa via balance_transaction
        let valorTaxa = valorBruto * 0.025 // fallback 2.5%
        const invoiceAny = invoice as unknown as Record<string, unknown>
        const chargeId = typeof invoiceAny.charge === 'string' ? invoiceAny.charge : null
        if (chargeId) {
          try {
            const charge = await stripe.charges.retrieve(chargeId, {
              expand: ['balance_transaction'],
            })
            const bt = charge.balance_transaction as Stripe.BalanceTransaction | null
            if (bt && typeof bt === 'object' && 'fee' in bt) {
              valorTaxa = (bt.fee as number) / 100
            }
          } catch { /* mantém fallback */ }
        }

        const customerId = typeof invoice.customer === 'string' ? invoice.customer : ''
        let clienteNome  = 'Cliente Stripe'
        if (customerId) {
          try {
            const customer = await stripe.customers.retrieve(customerId)
            if (!('deleted' in customer)) {
              clienteNome = customer.name ?? customer.email ?? clienteNome
            }
          } catch { /* mantém fallback */ }
        }

        const subId = typeof invoiceAny.subscription === 'string' ? invoiceAny.subscription : null

        await sql`
          INSERT INTO stripe_repasses
            (stripe_invoice_id, stripe_charge_id, stripe_subscription_id, cliente_nome,
             valor_bruto, valor_taxa, valor_liquido, data_pagamento, data_repasse_prevista, status)
          VALUES
            (${invoice.id}, ${chargeId}, ${subId}, ${clienteNome},
             ${valorBruto}, ${valorTaxa}, ${valorBruto - valorTaxa},
             ${dataPagamento.toISOString().slice(0, 10)},
             ${dataRepasse.toISOString().slice(0, 10)}, 'previsto')
          ON CONFLICT (stripe_invoice_id) DO NOTHING
        `
        break
      }

      // ── Pagamento falhou → marcar em risco + alertar ──────────────────────────
      case 'invoice.payment_failed': {
        const invoice    = event.data.object as Stripe.Invoice
        const tentativas = invoice.attempt_count ?? 1
        const valor      = (invoice.amount_due ?? 0) / 100

        const customerId = typeof invoice.customer === 'string' ? invoice.customer : ''
        let clienteNome  = 'Cliente'
        if (customerId) {
          try {
            const customer = await stripe.customers.retrieve(customerId)
            if (!('deleted' in customer)) clienteNome = customer.name ?? customer.email ?? clienteNome
          } catch { /* mantém fallback */ }
        }

        await sql`
          UPDATE stripe_repasses
          SET status = 'em_risco',
              tentativas_cobranca = ${tentativas},
              atualizado_em = NOW()
          WHERE stripe_invoice_id = ${invoice.id}
        `

        await enviarEmail({
          assunto: `⚠️ Cobrança falhou — ${clienteNome}`,
          titulo:  'Cobrança não foi aprovada',
          corpo:   `A cobrança de <strong>${brl(valor)}</strong> do atleta <strong>${clienteNome}</strong> falhou. Tentativa ${tentativas} de 3. O Stripe vai tentar novamente automaticamente.`,
          tipo:    'alerta',
        })
        break
      }

      // ── Nova assinatura ───────────────────────────────────────────────────────
      case 'customer.subscription.created': {
        const sub        = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : ''
        let clienteNome  = 'Novo atleta'
        let clienteEmail = ''
        if (customerId) {
          try {
            const customer = await stripe.customers.retrieve(customerId)
            if (!('deleted' in customer)) {
              clienteNome  = customer.name ?? customer.email ?? clienteNome
              clienteEmail = customer.email ?? ''
            }
          } catch { /* mantém fallback */ }
        }

        const valorMensal = (sub.items.data[0]?.price.unit_amount ?? 0) / 100

        await sql`
          INSERT INTO stripe_assinaturas
            (stripe_subscription_id, stripe_customer_id, cliente_nome, cliente_email,
             valor_mensal, status, data_inicio, data_proxima_cobranca)
          VALUES
            (${sub.id}, ${customerId}, ${clienteNome}, ${clienteEmail},
             ${valorMensal}, ${sub.status},
             ${new Date(sub.created * 1000).toISOString().slice(0, 10)},
             ${new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString().slice(0, 10)})
          ON CONFLICT (stripe_subscription_id) DO UPDATE SET status = ${sub.status}
        `

        await enviarEmail({
          assunto: `🎉 Novo atleta — ${clienteNome}`,
          titulo:  'Nova assinatura no RANKEN',
          corpo:   `<strong>${clienteNome}</strong> acabou de assinar! Receita recorrente nova: <strong>${brl(valorMensal)}/mês</strong>. MRR aumentou.`,
          tipo:    'sucesso',
        })
        break
      }

      // ── Cancelamento → churn ─────────────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription

        const assinaturas = await sql`
          SELECT cliente_nome, valor_mensal FROM stripe_assinaturas
          WHERE stripe_subscription_id = ${sub.id}
        `
        const nome  = (assinaturas[0]?.cliente_nome as string) ?? 'Atleta'
        const valor = Number(assinaturas[0]?.valor_mensal ?? 0)

        await sql`
          UPDATE stripe_assinaturas
          SET status = 'canceled', data_cancelamento = NOW()::date, atualizado_em = NOW()
          WHERE stripe_subscription_id = ${sub.id}
        `

        // Remove repasses futuros não confirmados
        await sql`
          DELETE FROM stripe_repasses
          WHERE stripe_subscription_id = ${sub.id} AND status = 'previsto'
        `

        await enviarEmail({
          assunto: `🔴 Cancelamento — ${nome}`,
          titulo:  'Atleta cancelou a assinatura',
          corpo:   `<strong>${nome}</strong> cancelou. MRR caiu <strong>${brl(valor)}</strong>. Considere uma ação de retenção.`,
          tipo:    'alerta',
        })
        break
      }

      // ── Atualização de assinatura ─────────────────────────────────────────────
      case 'customer.subscription.updated': {
        const sub         = event.data.object as Stripe.Subscription
        const valorMensal = (sub.items.data[0]?.price.unit_amount ?? 0) / 100
        const periodEnd   = (sub as unknown as { current_period_end: number }).current_period_end

        await sql`
          UPDATE stripe_assinaturas
          SET valor_mensal = ${valorMensal},
              status       = ${sub.status},
              data_proxima_cobranca = ${new Date(periodEnd * 1000).toISOString().slice(0, 10)}::date,
              atualizado_em = NOW()
          WHERE stripe_subscription_id = ${sub.id}
        `
        break
      }
    }
  } catch (err) {
    console.error('[stripe-webhook] Erro ao processar evento:', event.type, err)
    // Retorna 200 mesmo com erro interno para o Stripe não reenviar
  }

  return NextResponse.json({ received: true })
}
