import { NextRequest, NextResponse } from "next/server";
import { listarCategorias, adicionarCategoria } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo") as "receita" | "despesa" | null;
  const categorias = await listarCategorias(tipo ?? undefined);
  return NextResponse.json(categorias);
}

export async function POST(req: NextRequest) {
  const sessao = await getSession();
  if (sessao.perfil !== "master") {
    return NextResponse.json({ erro: "Acesso negado" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }

  const { tipo, nome } = body as Record<string, string>;
  if (tipo !== "receita" && tipo !== "despesa") {
    return NextResponse.json({ erro: "tipo deve ser receita ou despesa" }, { status: 400 });
  }
  if (!nome?.trim()) {
    return NextResponse.json({ erro: "nome obrigatório" }, { status: 400 });
  }

  try {
    const cat = await adicionarCategoria(tipo, nome);
    return NextResponse.json(cat, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ erro: "Categoria já existe" }, { status: 409 });
    }
    throw e;
  }
}
