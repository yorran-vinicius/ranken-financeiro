import { NextRequest, NextResponse } from "next/server";
import {
  lerGrupo,
  lerLancamentosGrupo,
  encerrarGrupo,
  cancelarTodosGrupo,
  reajustarGrupo,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const grupo = await lerGrupo(params.id);
  if (!grupo) return NextResponse.json({ erro: "Grupo não encontrado" }, { status: 404 });
  const lancamentos = await lerLancamentosGrupo(params.id);
  return NextResponse.json({ grupo, lancamentos });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }

  const b = body as Record<string, unknown>;
  const acao = b.acao as string;

  if (acao === "encerrar") {
    if (typeof b.dataCorte !== "string")
      return NextResponse.json({ erro: "dataCorte obrigatório" }, { status: 400 });
    await encerrarGrupo(params.id, b.dataCorte);
    return NextResponse.json({ ok: true });
  }

  if (acao === "cancelar_tudo") {
    await cancelarTodosGrupo(params.id);
    return NextResponse.json({ ok: true });
  }

  if (acao === "reajustar") {
    if (typeof b.dataCorte !== "string")
      return NextResponse.json({ erro: "dataCorte obrigatório" }, { status: 400 });
    const novoValor = Number(b.novoValor);
    if (!Number.isFinite(novoValor) || novoValor <= 0)
      return NextResponse.json({ erro: "novoValor inválido" }, { status: 400 });
    await reajustarGrupo(params.id, b.dataCorte, novoValor);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erro: "acao inválida" }, { status: 400 });
}
