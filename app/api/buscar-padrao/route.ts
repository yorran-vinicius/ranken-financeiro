import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { buscarPadraoExistente } from '@/lib/padroes'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { descricao, tipo } = await req.json()

    if (!descricao || !tipo) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios: descricao, tipo' }, { status: 400 })
    }

    // Normaliza tipo para o padrão do banco
    const tipoDb =
      tipo === 'entrada' ? 'receita'
      : tipo === 'saida' ? 'despesa'
      : tipo

    const resultado = await buscarPadraoExistente(descricao, tipoDb)

    if (!resultado) {
      return NextResponse.json({ encontrado: false })
    }

    return NextResponse.json({
      encontrado:      true,
      categoria_id:    resultado.regra.categoria_id,
      categoria_nome:  resultado.regra.categoria_nome,
      tipo_lancamento: resultado.regra.tipo_lancamento,
      similaridade:    resultado.similaridade,
      descricao_original: resultado.regra.descricao_original,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
