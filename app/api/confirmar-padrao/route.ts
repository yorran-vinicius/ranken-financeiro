import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { salvarPadrao } from '@/lib/padroes'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { descricao, categoria_id, tipo, cidade, valor, tipo_lancamento } = await req.json()

    if (!descricao || !categoria_id || !tipo || valor == null) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: descricao, categoria_id, tipo, valor' },
        { status: 400 },
      )
    }

    const tipoDb =
      tipo === 'entrada' ? 'receita'
      : tipo === 'saida' ? 'despesa'
      : tipo

    await salvarPadrao({
      descricao,
      categoria_id: String(categoria_id),
      tipo:         tipoDb,
      cidade:       cidade ?? null,
      valor:        Number(valor),
      tipo_lancamento: tipo_lancamento ?? 'avulso',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
