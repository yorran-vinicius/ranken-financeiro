import { NextRequest, NextResponse } from "next/server";
import { listarConfiguracoes, salvarConfiguracao } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await listarConfiguracoes();
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  const sessao = await getSession();
  if (sessao.perfil !== "master") {
    return NextResponse.json({ erro: "Acesso negado" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }

  const b = body as Record<string, string>;
  const CHAVES_PERMITIDAS = [
    "nome_app", "moeda", "formato_data",
    "func_metas", "meta_anual",
    "func_equilibrio", "custo_fixo_mensal",
    "func_cidade", "cidades",
    "func_pdf",
    "func_alertas", "alertas_limites",
  ];

  await Promise.all(
    CHAVES_PERMITIDAS
      .filter((k) => typeof b[k] === "string" && b[k].trim())
      .map((k) => salvarConfiguracao(k, b[k].trim()))
  );

  return NextResponse.json({ ok: true });
}
