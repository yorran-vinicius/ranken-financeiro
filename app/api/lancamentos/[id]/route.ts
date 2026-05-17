import { NextRequest, NextResponse } from "next/server";
import {
  removerLancamento,
  atualizarLancamento,
  toggleFavorito,
  lerCriadorLancamento,
} from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sessao = await getSession();

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }

  const b = body as Record<string, unknown>;

  // Toggle favorito — qualquer usuário pode favoritar
  if ("favorito" in b && Object.keys(b).length === 1) {
    const atualizado = await toggleFavorito(params.id, Boolean(b.favorito));
    if (!atualizado) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
    return NextResponse.json(atualizado);
  }

  // Editar campos — verifica permissão de ownership
  if (sessao.perfil !== "master") {
    const criadorId = await lerCriadorLancamento(params.id);
    if (criadorId !== sessao.userId)
      return NextResponse.json({ erro: "Sem permissão para editar este lançamento" }, { status: 403 });
  }

  const valorNum = Number(b.valor);
  if (!Number.isFinite(valorNum) || valorNum <= 0)
    return NextResponse.json({ erro: "Valor inválido" }, { status: 400 });
  if (b.tipo !== "receita" && b.tipo !== "despesa")
    return NextResponse.json({ erro: "Tipo inválido" }, { status: 400 });
  if (typeof b.descricao !== "string" || !b.descricao.trim())
    return NextResponse.json({ erro: "Descrição obrigatória" }, { status: 400 });
  if (typeof b.data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.data))
    return NextResponse.json({ erro: "Data inválida" }, { status: 400 });

  const atualizado = await atualizarLancamento(params.id, {
    descricao: (b.descricao as string).trim(),
    valor:     Math.round(valorNum * 100) / 100,
    tipo:      b.tipo as string,
    categoria: (b.categoria as string) ?? "",
    data:      b.data as string,
    notas:     typeof b.notas === "string" ? (b.notas.trim() || null) : null,
    cidade:    typeof b.cidade === "string" && b.cidade.trim() ? b.cidade.trim() : null,
  });

  if (!atualizado) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  return NextResponse.json(atualizado);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessao = await getSession();

  if (sessao.perfil !== "master") {
    const criadorId = await lerCriadorLancamento(params.id);
    if (criadorId !== sessao.userId)
      return NextResponse.json({ erro: "Sem permissão para remover este lançamento" }, { status: 403 });
  }

  const ok = await removerLancamento(params.id);
  if (!ok) return NextResponse.json({ erro: "Lançamento não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
