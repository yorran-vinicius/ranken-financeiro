import { type NextRequest, NextResponse } from "next/server";
import { buscarLancamentos } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const q      = searchParams.get("q")?.trim() ?? "";
  const limite = Math.min(Number(searchParams.get("limite") ?? "20"), 50);

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const lancamentos = await buscarLancamentos(q, limite);
  return NextResponse.json(lancamentos);
}
