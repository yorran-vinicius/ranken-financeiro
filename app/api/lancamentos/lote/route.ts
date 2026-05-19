import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const sessao = await getSession();
  if (!sessao.userId) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }

  const b = body as Record<string, unknown>;
  const ids    = b.ids;
  const campos = b.campos as Record<string, string> | undefined;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ erro: "ids obrigatório (array não vazio)" }, { status: 400 });
  }
  if (!campos || typeof campos !== "object" || Object.keys(campos).length === 0) {
    return NextResponse.json({ erro: "campos obrigatório" }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const { categoria, tipo_lancamento } = campos;

  let atualizados = 0;

  if (typeof categoria === "string" && categoria.trim()) {
    const result = await sql`
      UPDATE lancamentos
      SET categoria = ${categoria.trim()}
      WHERE id = ANY(${ids}::TEXT[])
        AND cancelado = FALSE
      RETURNING id
    `;
    atualizados = Math.max(atualizados, result.length);
  }

  if (
    typeof tipo_lancamento === "string" &&
    ["avulso", "recorrente", "parcelado"].includes(tipo_lancamento)
  ) {
    const result = await sql`
      UPDATE lancamentos
      SET tipo_lancamento = ${tipo_lancamento}
      WHERE id = ANY(${ids}::TEXT[])
        AND cancelado = FALSE
      RETURNING id
    `;
    atualizados = Math.max(atualizados, result.length);
  }

  return NextResponse.json({ atualizados });
}
