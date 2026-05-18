import { NextResponse } from "next/server";
import { listarCustosFixos } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/grupos?custoFixo=true — lista grupos recorrentes marcados como custo fixo */
export async function GET() {
  await getSession(); // requer autenticação
  const grupos = await listarCustosFixos();
  return NextResponse.json(grupos);
}
