import { neon } from '@neondatabase/serverless'

function db() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL não configurado')
  return neon(url)
}

export interface ResultadoConciliacao {
  encontrado: boolean
  repasse_id?: number
  repasse?: Record<string, unknown>
  agregado?: boolean
  ids?: number[]
}

/**
 * Tenta casar um valor que caiu no banco com um repasse previsto do Stripe.
 * Aceita diferença de ±3% no valor e janela de ±5 dias na data prevista.
 */
export async function conciliarRepasseStripe(
  valor: number,
  data: string,  // YYYY-MM-DD
  _descricao: string,
): Promise<ResultadoConciliacao> {
  const sql = db()

  const dataObj = new Date(data + 'T12:00:00')
  const inicio = new Date(dataObj)
  inicio.setDate(inicio.getDate() - 5)
  const fim = new Date(dataObj)
  fim.setDate(fim.getDate() + 5)

  const inicioStr = inicio.toISOString().slice(0, 10)
  const fimStr    = fim.toISOString().slice(0, 10)

  // Tenta casar individualmente primeiro
  const repasses = await sql`
    SELECT id, cliente_nome, valor_liquido, valor_bruto, valor_taxa, data_repasse_prevista
    FROM stripe_repasses
    WHERE status IN ('previsto', 'em_risco')
      AND data_repasse_prevista BETWEEN ${inicioStr}::date AND ${fimStr}::date
      AND ABS(valor_liquido - ${valor}::numeric) / GREATEST(valor_liquido, 1) <= 0.03
    ORDER BY ABS(valor_liquido - ${valor}::numeric) ASC
    LIMIT 1
  `

  if (repasses.length > 0) {
    return {
      encontrado: true,
      repasse_id: repasses[0].id as number,
      repasse:    repasses[0] as Record<string, unknown>,
    }
  }

  // Tenta casar valor agregado (Stripe às vezes repassa vários juntos)
  const agregado = await sql`
    SELECT
      COALESCE(SUM(valor_liquido), 0) as total,
      COUNT(*)::int                   as qtd,
      ARRAY_AGG(id)                   as ids
    FROM stripe_repasses
    WHERE status IN ('previsto', 'em_risco')
      AND data_repasse_prevista BETWEEN ${inicioStr}::date AND ${fimStr}::date
  `

  const total = Number(agregado[0]?.total ?? 0)
  if (total > 0 && Math.abs(total - valor) / valor <= 0.03) {
    return {
      encontrado: true,
      agregado:   true,
      ids:        agregado[0].ids as number[],
    }
  }

  return { encontrado: false }
}
