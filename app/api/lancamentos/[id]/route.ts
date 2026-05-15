import { NextRequest, NextResponse } from "next/server";
import { removerLancamento, lerCriadorLancamento } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessao = await getSession();

  // Editors can only delete their own lancamentos
  if (sessao.perfil !== "master") {
    const criadorId = await lerCriadorLancamento(params.id);
    if (criadorId !== sessao.userId) {
      return NextResponse.json({ erro: "Sem permissão para remover este lançamento" }, { status: 403 });
    }
  }

  const ok = await removerLancamento(params.id);
  if (!ok) {
    return NextResponse.json({ erro: "Lançamento não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
