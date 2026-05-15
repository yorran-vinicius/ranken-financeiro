import { NextRequest, NextResponse } from "next/server";
import { filtrarPorMes, lerLancamentos } from "@/lib/db";

export const dynamic = "force-dynamic";

function csvEscape(valor: string): string {
  if (/[",\n;]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mes = searchParams.get("mes");

  let lancamentos = await lerLancamentos();
  if (mes) {
    lancamentos = filtrarPorMes(lancamentos, mes);
  }

  lancamentos.sort((a, b) => a.data.localeCompare(b.data));

  const cabecalho = ["Data", "Tipo", "Categoria", "Descrição", "Valor (R$)"];
  const linhas = lancamentos.map((l) => {
    const [ano, m, dia] = l.data.split("-");
    const valor = l.valor.toFixed(2).replace(".", ",");
    return [
      `${dia}/${m}/${ano}`,
      l.tipo === "receita" ? "Receita" : "Despesa",
      l.categoria,
      l.descricao,
      valor,
    ].map(csvEscape).join(";");
  });

  const conteudo = "﻿" + [cabecalho.join(";"), ...linhas].join("\n");
  const nomeArquivo = `ranken-financeiro-${mes ?? "todos"}.csv`;

  return new NextResponse(conteudo, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
