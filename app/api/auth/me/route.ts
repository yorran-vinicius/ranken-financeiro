import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await getSession();
  if (!sessao.userId) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }
  return NextResponse.json({
    id:                sessao.userId,
    login:             sessao.login,
    nome:              sessao.nome,
    perfil:            sessao.perfil,
    deveAtualizarSenha: sessao.deveAtualizarSenha,
  });
}
