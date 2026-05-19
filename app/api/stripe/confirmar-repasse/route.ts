import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getSession } from '@/lib/auth'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

function db() {
  return neon(process.env.DATABASE_URL!)
}

/**
 * POST /api/stripe/confirmar-repasse
 * Marca um stripe_repasse como 'confirmado' e cria automaticamente
 * um lançamento de despesa "Taxas Stripe" pelo valor da taxa.
 */
export async function POST(req: NextRequest) {
  const sessao = await getSession()
  if (!sessao.userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const { repasse_id, lancamento_id } = body as Record<string, unknown>

  if (!repasse_id || typeof repasse_id !== 'number') {
    return NextResponse.json({ error: 'repasse_id obrigatório (number)' }, { status: 400 })
  }

  const sql = db()

  // Busca o repasse para pegar taxa e data
  const repasses = await sql`
    SELECT id, valor_taxa, valor_bruto, valor_liquido, data_pagamento, cliente_nome
    FROM stripe_repasses
    WHERE id = ${repasse_id}
    LIMIT 1
  `
  if (repasses.length === 0) {
    return NextResponse.json({ error: 'Repasse não encontrado' }, { status: 404 })
  }

  const repasse    = repasses[0]
  const valorTaxa  = Number(repasse.valor_taxa ?? 0)
  const dataPag    = String(repasse.data_pagamento ?? '').slice(0, 10)

  // Marca repasse como confirmado
  await sql`
    UPDATE stripe_repasses
    SET status        = 'confirmado',
        lancamento_id = ${typeof lancamento_id === 'string' ? lancamento_id : null},
        atualizado_em = NOW()
    WHERE id = ${repasse_id}
  `

  // Cria lançamento de despesa "Taxas Stripe" se houver taxa > 0
  let taxaLancamentoId: string | null = null
  if (valorTaxa > 0) {
    taxaLancamentoId = randomUUID()
    await sql`
      INSERT INTO lancamentos
        (id, descricao, valor, tipo, categoria, data, tipo_lancamento,
         criado_por_id, cancelado)
      VALUES
        (${taxaLancamentoId},
         ${'Taxa Stripe — ' + String(repasse.cliente_nome ?? 'repasse')},
         ${valorTaxa},
         'despesa',
         'Tecnologia',
         ${dataPag || new Date().toISOString().slice(0, 10)},
         'avulso',
         ${sessao.userId},
         FALSE)
    `
  }

  return NextResponse.json({
    ok: true,
    repasse_confirmado: repasse_id,
    taxa_lancamento_id: taxaLancamentoId,
    valor_taxa: valorTaxa,
  })
}
