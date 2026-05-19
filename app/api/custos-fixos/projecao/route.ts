import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session.userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const sql = neon(process.env.DATABASE_URL!)

  try {
    // Busca todos os padrões de custo fixo recorrente
    const custosFixos = await sql`
      SELECT DISTINCT ON (rc.descricao_padrao)
        rc.descricao_padrao,
        rc.descricao_original,
        rc.valor_referencia,
        rc.categoria_id,
        c.nome as categoria_nome
      FROM regras_categorizacao rc
      LEFT JOIN categorias c ON rc.categoria_id = c.id
      WHERE rc.ativo = true
        AND rc.tipo_lancamento = 'recorrente'
        AND rc.tipo = 'despesa'
      ORDER BY rc.descricao_padrao, rc.vezes_confirmado DESC
    `

    if (custosFixos.length === 0) {
      return NextResponse.json({ custosFixos: [], confirmados: {}, meses: [] })
    }

    // Gera os próximos 12 meses
    const hoje = new Date()
    const meses: { label: string; anoMes: string }[] = []
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1)
      const mes = String(d.getMonth() + 1).padStart(2, '0')
      const anoMes = `${d.getFullYear()}-${mes}`
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      meses.push({ label, anoMes })
    }

    // Para cada custo fixo + mês, verifica se existe lançamento confirmado
    const confirmados: Record<string, Record<string, boolean>> = {}

    for (const custo of custosFixos) {
      const padrao = custo.descricao_padrao as string
      confirmados[padrao] = {}

      for (const { anoMes } of meses) {
        const rows = await sql`
          SELECT EXISTS (
            SELECT 1 FROM lancamentos
            WHERE tipo = 'despesa'
              AND tipo_lancamento = 'recorrente'
              AND cancelado = FALSE
              AND data LIKE ${anoMes + '%'}
              AND ABS(valor::numeric - ${custo.valor_referencia}::numeric) / GREATEST(valor::numeric, 1) <= 0.1
          ) as confirmado
        `
        confirmados[padrao][anoMes] = Boolean(rows[0]?.confirmado)
      }
    }

    return NextResponse.json({ custosFixos, confirmados, meses })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
