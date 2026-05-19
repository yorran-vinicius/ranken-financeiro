import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { import_id } = body as Record<string, unknown>;

    if (!import_id || typeof import_id !== "string") {
      return NextResponse.json({ erro: "import_id obrigatório" }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`
      DELETE FROM lancamentos
      WHERE import_id = ${import_id}::UUID
      RETURNING id
    `;

    return NextResponse.json({ deletados: result.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro ao desfazer importação:", msg);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
