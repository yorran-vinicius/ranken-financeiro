import { NextRequest, NextResponse } from "next/server";
import {
  adicionarLancamento,
  filtrarPorMes,
  filtrarPorTipo,
  lerLancamentos,
} from "@/lib/db";
import { validarCategoria, type TipoLancamento } from "@/lib/categorias";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mes = searchParams.get("mes");
  const tipo = (searchParams.get("tipo") ?? "todos") as TipoLancamento | "todos";

  let lancamentos = await lerLancamentos();

  if (mes) {
    lancamentos = filtrarPorMes(lancamentos, mes);
  }

  lancamentos = filtrarPorTipo(lancamentos, tipo);

  lancamentos.sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm));

  return NextResponse.json(lancamentos);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ erro: "Corpo inválido" }, { status: 400 });
  }

  const { descricao, valor, tipo, categoria, data } = body as Record<string, unknown>;

  if (typeof descricao !== "string" || descricao.trim().length === 0) {
    return NextResponse.json({ erro: "Descrição obrigatória" }, { status: 400 });
  }

  const valorNum = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(valorNum) || valorNum <= 0) {
    return NextResponse.json({ erro: "Valor deve ser maior que zero" }, { status: 400 });
  }

  if (tipo !== "receita" && tipo !== "despesa") {
    return NextResponse.json({ erro: "Tipo inválido" }, { status: 400 });
  }

  if (typeof categoria !== "string" || !validarCategoria(tipo, categoria)) {
    return NextResponse.json({ erro: "Categoria inválida para o tipo" }, { status: 400 });
  }

  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ erro: "Data inválida (use AAAA-MM-DD)" }, { status: 400 });
  }

  const novo = await adicionarLancamento({
    descricao: descricao.trim(),
    valor: Math.round(valorNum * 100) / 100,
    tipo,
    categoria,
    data,
  });

  return NextResponse.json(novo, { status: 201 });
}
