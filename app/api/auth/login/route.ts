import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { buscarUsuarioPorLogin, garantirTabelas } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }

  const { login, senha } = body as Record<string, string>;
  if (!login || !senha) {
    return NextResponse.json({ erro: "Login e senha obrigatórios" }, { status: 400 });
  }

  await garantirTabelas();
  const usuario = await buscarUsuarioPorLogin(login.trim().toLowerCase());
  if (!usuario) {
    return NextResponse.json({ erro: "Credenciais inválidas" }, { status: 401 });
  }

  const ok = await compare(senha, usuario.senhaHash);
  if (!ok) {
    return NextResponse.json({ erro: "Credenciais inválidas" }, { status: 401 });
  }

  const sessao = await getSession();
  sessao.userId = usuario.id;
  sessao.login  = usuario.login;
  sessao.nome   = usuario.nome;
  sessao.perfil = usuario.perfil;
  sessao.deveAtualizarSenha = usuario.deveAtualizarSenha;
  await sessao.save();

  return NextResponse.json({
    id:                usuario.id,
    login:             usuario.login,
    nome:              usuario.nome,
    perfil:            usuario.perfil,
    deveAtualizarSenha: usuario.deveAtualizarSenha,
  });
}
