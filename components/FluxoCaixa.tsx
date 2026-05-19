"use client";

import { formatarBRL, formatarData } from "@/lib/format";
import type { Lancamento } from "@/lib/db";

interface Props {
  lancamentos: Lancamento[];
  saldoAtual: number;
}

interface DiaFluxo {
  data: string;        // YYYY-MM-DD
  itens: Lancamento[];
  saldoDia: number;    // running balance at end of day
}

function agruparPorDia(lancamentos: Lancamento[], saldoAtual: number): DiaFluxo[] {
  // Sort chronologically
  const sorted = [...lancamentos].sort((a, b) => a.data.localeCompare(b.data));

  // Group by date
  const mapa = new Map<string, Lancamento[]>();
  for (const l of sorted) {
    const key = l.data.slice(0, 10);
    if (!mapa.has(key)) mapa.set(key, []);
    mapa.get(key)!.push(l);
  }

  // Build running balance
  let saldoCorrente = saldoAtual;
  const dias: DiaFluxo[] = [];

  for (const [data, itens] of mapa.entries()) {
    for (const item of itens) {
      if (item.tipo === "receita") {
        saldoCorrente += item.valor;
      } else {
        saldoCorrente -= item.valor;
      }
    }
    dias.push({ data, itens, saldoDia: saldoCorrente });
  }

  return dias;
}

function formatarDiaDDMM(iso: string): string {
  const [, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}`;
}

export default function FluxoCaixa({ lancamentos, saldoAtual }: Props) {
  const dias = agruparPorDia(lancamentos, saldoAtual);
  const saldoProjetado = dias.length > 0 ? dias[dias.length - 1].saldoDia : saldoAtual;
  const saldoProjetadoPositivo = saldoProjetado >= 0;

  // Entradas futuras manuais = receitas não-recorrentes nos próximos 30 dias
  const entradasFuturasManuais = lancamentos.filter(
    (l) => l.tipo === "receita" && l.tipoLancamento !== "recorrente",
  ).length;

  return (
    <div className="bg-white border border-marca-borda rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-marca-borda">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-marca-texto-suave">
          Fluxo de Caixa — Próximos 30 dias
        </h2>
        <span
          className={`text-sm font-bold px-3 py-1 rounded-full ${
            saldoProjetadoPositivo
              ? "bg-green-50 text-receita"
              : "bg-red-50 text-despesa"
          }`}
        >
          Projetado: {formatarBRL(saldoProjetado)}
        </span>
      </div>

      {/* Empty state */}
      {lancamentos.length === 0 && (
        <div className="px-5 py-10 text-center text-sm text-marca-texto-suave">
          Nenhum lançamento recorrente previsto.
        </div>
      )}

      {/* Day rows */}
      {dias.length > 0 && (
        <ul className="divide-y divide-marca-borda">
          {dias.map((dia) => {
            const negativo = dia.saldoDia < 0;
            const rowBg = negativo
              ? "bg-red-50 border-l-4 border-l-red-300"
              : "bg-green-50 border-l-4 border-l-green-200";

            return (
              <li key={dia.data} className={`px-5 py-3 ${rowBg}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  {/* Date + items */}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-marca-texto-suave tabular-nums">
                      {formatarDiaDDMM(dia.data)}
                    </span>
                    <ul className="mt-1 space-y-0.5">
                      {dia.itens.map((item) => (
                        <li key={item.id} className="flex items-center gap-2 text-sm">
                          <span
                            className={`font-medium ${
                              item.tipo === "receita" ? "text-receita" : "text-despesa"
                            }`}
                          >
                            {item.tipo === "receita" ? "+" : "−"}
                            {formatarBRL(item.valor)}
                          </span>
                          <span className="text-marca-texto truncate">{item.descricao}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Running balance */}
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs text-marca-texto-suave block">saldo</span>
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        negativo ? "text-despesa" : "text-receita"
                      }`}
                    >
                      {formatarBRL(dia.saldoDia)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Nota: só custos fixos, sem entradas manuais */}
      {lancamentos.length > 0 && entradasFuturasManuais === 0 && (
        <p className="px-5 py-2 text-xs text-marca-texto-suave italic border-t border-marca-borda">
          Projeção baseada nos custos fixos recorrentes. Adicione receitas previstas para melhorar a precisão.
        </p>
      )}

      {/* Final projected balance row */}
      {dias.length > 0 && (
        <div className="px-5 py-4 border-t border-marca-borda flex items-center justify-between">
          <span className="text-sm font-medium text-marca-texto-suave">
            Saldo projetado em 30 dias
          </span>
          <span
            className={`text-xl font-bold tabular-nums ${
              saldoProjetadoPositivo ? "text-receita" : "text-despesa"
            }`}
          >
            {formatarBRL(saldoProjetado)}
          </span>
        </div>
      )}
    </div>
  );
}
