import { NextRequest, NextResponse } from "next/server";
import { removerLancamento } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ok = await removerLancamento(params.id);
  if (!ok) {
    return NextResponse.json({ erro: "Lançamento não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
