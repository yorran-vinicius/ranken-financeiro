import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { verificarDuplicata } from '@/lib/antiDuplicacao'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { descricao, valor, tipo, data } = await req.json()

    if (!descricao || !valor || !tipo || !data) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios: descricao, valor, tipo, data' }, { status: 400 })
    }

    // Normaliza tipo para o padrão do banco ('receita' | 'despesa')
    const tipoDb =
      tipo === 'entrada' ? 'receita'
      : tipo === 'saida' ? 'despesa'
      : tipo

    const resultado = await verificarDuplicata(descricao, Number(valor), tipoDb, data)
    return NextResponse.json(resultado)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
