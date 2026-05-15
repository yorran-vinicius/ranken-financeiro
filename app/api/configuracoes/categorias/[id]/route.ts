import { NextRequest, NextResponse } from "next/server";
import { atualizarCategoria } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sessao = await getSession();
  if (sessao.perfil !== "master") {
    return NextResponse.json({ erro: "Acesso negado" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }

  const b = body as Record<string, unknown>;
  const dados: Parameters<typeof atualizarCategoria>[1] = {};

  if (typeof b.nome === "string" && b.nome.trim()) dados.nome = b.nome.trim();
  if (typeof b.ativo === "boolean") dados.ativo = b.ativo;

  const atualizada = await atualizarCategoria(params.id, dados);
  if (!atualizada) {
    return NextResponse.json({ erro: "Categoria não encontrada" }, { status: 404 });
  }
  return NextResponse.json(atualizada);
}
