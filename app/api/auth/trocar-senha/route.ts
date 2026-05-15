import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { atualizarUsuario } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sessao = await getSession();
  if (!sessao.userId) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }

  const { novaSenha } = body as Record<string, string>;
  if (!novaSenha || novaSenha.length < 6) {
    return NextResponse.json({ erro: "Senha deve ter ao menos 6 caracteres" }, { status: 400 });
  }

  const senhaHash = await hash(novaSenha, 10);
  await atualizarUsuario(sessao.userId, { senhaHash, deveAtualizarSenha: false });

  sessao.deveAtualizarSenha = false;
  await sessao.save();

  return NextResponse.json({ ok: true });
}
