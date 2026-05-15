import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { listarUsuarios, criarUsuario, garantirTabelas } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await getSession();
  if (sessao.perfil !== "master") {
    return NextResponse.json({ erro: "Acesso negado" }, { status: 403 });
  }
  await garantirTabelas();
  const usuarios = await listarUsuarios();
  return NextResponse.json(usuarios);
}

export async function POST(req: NextRequest) {
  const sessao = await getSession();
  if (sessao.perfil !== "master") {
    return NextResponse.json({ erro: "Acesso negado" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }

  const { login, nome, perfil, senha } = body as Record<string, string>;

  if (!login?.trim() || !nome?.trim() || !senha || !perfil) {
    return NextResponse.json({ erro: "login, nome, perfil e senha são obrigatórios" }, { status: 400 });
  }
  if (perfil !== "master" && perfil !== "editor") {
    return NextResponse.json({ erro: "Perfil inválido" }, { status: 400 });
  }
  if (senha.length < 6) {
    return NextResponse.json({ erro: "Senha deve ter ao menos 6 caracteres" }, { status: 400 });
  }

  const senhaHash = await hash(senha, 10);
  try {
    const usuario = await criarUsuario(
      login.trim().toLowerCase(),
      nome.trim(),
      perfil as "master" | "editor",
      senhaHash,
    );
    return NextResponse.json(usuario, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ erro: "Login já existe" }, { status: 409 });
    }
    throw e;
  }
}
