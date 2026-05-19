import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes') // YYYY-MM (mês atual para verificar confirmados)

  const sql = neon(process.env.DATABASE_URL!)
  const mesAtual = mes ?? new Date().toISOString().slice(0, 7)

  try {
    // Busca todos os padrões recorrentes únicos (mais confirmados de cada padrão)
    const custosFixos = await sql`
      SELECT DISTINCT ON (rc.descricao_padrao)
        rc.id,
        rc.descricao_padrao,
        rc.descricao_original,
        rc.valor_referencia,
        rc.categoria_id,
        c.nome as categoria_nome,
        rc.tipo,
        rc.atualizado_em as ultima_atualizacao,
        rc.vezes_confirmado
      FROM regras_categorizacao rc
      LEFT JOIN categorias c ON rc.categoria_id = c.id
      WHERE rc.ativo = true
        AND rc.tipo_lancamento = 'recorrente'
        AND rc.tipo = 'despesa'
      ORDER BY rc.descricao_padrao, rc.vezes_confirmado DESC
    `

    // Adiciona também lançamentos recorrentes de despesa do mês atual como fixos
    const lancamentosRecorrentes = await sql`
      SELECT DISTINCT
        descricao,
        valor,
        categoria,
        tipo_lancamento
      FROM lancamentos
      WHERE tipo = 'despesa'
        AND tipo_lancamento = 'recorrente'
        AND cancelado = FALSE
        AND data LIKE ${mesAtual + '%'}
    `

    // Para cada custo fixo, verifica se já apareceu no mês atual
    const resultado = await Promise.all(
      custosFixos.map(async (custo) => {
        const confirmado = await sql`
          SELECT EXISTS (
            SELECT 1 FROM lancamentos
            WHERE tipo = 'despesa'
              AND tipo_lancamento = 'recorrente'
              AND cancelado = FALSE
              AND data LIKE ${mesAtual + '%'}
              AND ABS(valor::numeric - ${custo.valor_referencia}::numeric) / GREATEST(valor::numeric, 1) <= 0.1
          ) as confirmado
        `

        return {
          ...custo,
          confirmado_mes: Boolean(confirmado[0]?.confirmado),
        }
      }),
    )

    // Total mensal de custos fixos reais do banco
    const totalMesAtual = await sql`
      SELECT COALESCE(SUM(valor), 0) as total
      FROM lancamentos
      WHERE tipo = 'despesa'
        AND tipo_lancamento = 'recorrente'
        AND cancelado = FALSE
        AND data LIKE ${mesAtual + '%'}
    `

    return NextResponse.json({
      custosFixos: resultado,
      lancamentosRecorrentes,
      totalMesAtual: Number(totalMesAtual[0]?.total ?? 0),
      mesReferencia: mesAtual,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
