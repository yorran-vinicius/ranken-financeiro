import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { atualizarUsuario } from "@/lib/db";
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
  const dados: Parameters<typeof atualizarUsuario>[1] = {};

  if (typeof b.login === "string" && b.login.trim()) dados.login = b.login.trim().toLowerCase();
  if (typeof b.nome === "string")   dados.nome = b.nome.trim();
  if (typeof b.perfil === "string" && (b.perfil === "master" || b.perfil === "editor"))
    dados.perfil = b.perfil;
  if (typeof b.ativo === "boolean") dados.ativo = b.ativo;

  if (typeof b.novaSenha === "string") {
    if (b.novaSenha.length < 6) {
      return NextResponse.json({ erro: "Senha deve ter ao menos 6 caracteres" }, { status: 400 });
    }
    dados.senhaHash = await hash(b.novaSenha, 10);
    dados.deveAtualizarSenha = true;
  }

  try {
    const atualizado = await atualizarUsuario(params.id, dados);
    if (!atualizado) {
      return NextResponse.json({ erro: "Usuário não encontrado" }, { status: 404 });
    }
    return NextResponse.json(atualizado);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ erro: "Login já está em uso" }, { status: 409 });
    }
    throw e;
  }
}
