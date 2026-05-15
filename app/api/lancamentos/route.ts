import { NextRequest, NextResponse } from "next/server";
import {
  adicionarAvulso,
  adicionarRecorrente,
  adicionarParcelado,
  filtrarPorMes,
  filtrarPorTipo,
  lerLancamentos,
} from "@/lib/db";
import { validarCategoria, type TipoLancamento } from "@/lib/categorias";
import type { Frequencia } from "@/lib/recorrencia";

export const dynamic = "force-dynamic";

const FREQUENCIAS_VALIDAS: Frequencia[] = ["mensal", "semanal", "anual"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mes  = searchParams.get("mes");
  const tipo = (searchParams.get("tipo") ?? "todos") as TipoLancamento | "todos";

  let lancamentos = await lerLancamentos();
  if (mes)  lancamentos = filtrarPorMes(lancamentos, mes);
  lancamentos = filtrarPorTipo(lancamentos, tipo);

  return NextResponse.json(lancamentos);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ erro: "Corpo inválido" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const tipoLancamento = (b.tipoLancamento as string) ?? "avulso";

  // ── Campos comuns ──────────────────────────────────────────────────────────
  const { descricao, tipo, categoria } = b;

  if (typeof descricao !== "string" || descricao.trim().length === 0)
    return NextResponse.json({ erro: "Descrição obrigatória" }, { status: 400 });
  if (tipo !== "receita" && tipo !== "despesa")
    return NextResponse.json({ erro: "Tipo inválido" }, { status: 400 });
  if (typeof categoria !== "string" || !validarCategoria(tipo, categoria))
    return NextResponse.json({ erro: "Categoria inválida para o tipo" }, { status: 400 });

  // ── AVULSO ────────────────────────────────────────────────────────────────
  if (tipoLancamento === "avulso") {
    const valorNum = Number(b.valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0)
      return NextResponse.json({ erro: "Valor deve ser maior que zero" }, { status: 400 });
    if (typeof b.data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.data))
      return NextResponse.json({ erro: "Data inválida" }, { status: 400 });

    const novo = await adicionarAvulso({
      descricao: descricao.trim(),
      valor: Math.round(valorNum * 100) / 100,
      tipo,
      categoria,
      data: b.data,
    });
    return NextResponse.json(novo, { status: 201 });
  }

  // ── RECORRENTE ────────────────────────────────────────────────────────────
  if (tipoLancamento === "recorrente") {
    const valorNum = Number(b.valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0)
      return NextResponse.json({ erro: "Valor deve ser maior que zero" }, { status: 400 });
    if (!FREQUENCIAS_VALIDAS.includes(b.frequencia as Frequencia))
      return NextResponse.json({ erro: "Frequência inválida" }, { status: 400 });
    if (typeof b.dataInicio !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.dataInicio))
      return NextResponse.json({ erro: "Data de início inválida" }, { status: 400 });
    if (b.dataFim != null && (typeof b.dataFim !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.dataFim)))
      return NextResponse.json({ erro: "Data de término inválida" }, { status: 400 });

    const grupo = await adicionarRecorrente({
      descricao: descricao.trim(),
      valor: Math.round(valorNum * 100) / 100,
      tipo,
      categoria,
      frequencia: b.frequencia as Frequencia,
      dataInicio: b.dataInicio,
      dataFim: (b.dataFim as string) ?? null,
    });
    return NextResponse.json(grupo, { status: 201 });
  }

  // ── PARCELADO ─────────────────────────────────────────────────────────────
  if (tipoLancamento === "parcelado") {
    const totalParcelas = Number(b.totalParcelas);
    if (!Number.isFinite(totalParcelas) || totalParcelas < 2 || totalParcelas > 360)
      return NextResponse.json({ erro: "Número de parcelas inválido (2–360)" }, { status: 400 });

    let valorParcela: number;
    let valorTotal: number;

    if (b.valorParcela != null) {
      valorParcela = Number(b.valorParcela);
      valorTotal = Math.round(valorParcela * totalParcelas * 100) / 100;
    } else if (b.valorTotal != null) {
      valorTotal = Number(b.valorTotal);
      valorParcela = Math.round((valorTotal / totalParcelas) * 100) / 100;
    } else {
      return NextResponse.json({ erro: "Informe valorParcela ou valorTotal" }, { status: 400 });
    }

    if (!Number.isFinite(valorParcela) || valorParcela <= 0)
      return NextResponse.json({ erro: "Valor inválido" }, { status: 400 });
    if (typeof b.dataPrimeira !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.dataPrimeira))
      return NextResponse.json({ erro: "Data da primeira parcela inválida" }, { status: 400 });

    const grupo = await adicionarParcelado({
      descricao: descricao.trim(),
      valorParcela,
      valorTotal,
      tipo,
      categoria,
      totalParcelas,
      dataPrimeira: b.dataPrimeira,
    });
    return NextResponse.json(grupo, { status: 201 });
  }

  return NextResponse.json({ erro: "tipoLancamento inválido" }, { status: 400 });
}
