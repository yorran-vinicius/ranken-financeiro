import Stripe from 'stripe'

/**
 * Retorna uma instância do Stripe inicializada de forma lazy.
 * Lança erro claro se STRIPE_SECRET_KEY não estiver configurada
 * (apenas em runtime, nunca durante o build).
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY não configurada')
  }
  return new Stripe(key, { apiVersion: '2026-04-22.dahlia' })
}
