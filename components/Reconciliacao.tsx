"use client";

import { useCallback, useEffect, useState } from "react";
import { formatarBRL } from "@/lib/format";

interface Repasse {
  id: number;
  cliente_nome: string;
  valor_bruto: number;
  valor_taxa: number;
  valor_liquido: number;
  data_pagamento: string;
  data_repasse_prevista: string;
  status: string;
  lancamento_id: string | null;
  tentativas_cobranca: number | null;
  atualizado_em: string;
}

interface ResumoStatus {
  status: string;
  qtd: number;
  total: number;
}

interface AssinaturasResumo {
  ativas: number;
  past_due: number;
  canceladas: number;
  mrr: number;
}

const STATUS_COR: Record<string, string> = {
  previsto:   "bg-blue-100 text-blue-700",
  confirmado: "bg-green-100 text-green-700",
  em_risco:   "bg-red-100 text-red-700",
  cancelado:  "bg-gray-100 text-gray-500",
};

const STATUS_LABEL: Record<string, string> = {
  previsto:   "Previsto",
  confirmado: "Confirmado",
  em_risco:   "Em risco",
  cancelado:  "Cancelado",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COR[status] ?? "bg-gray-100 text-gray-500"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export default function Reconciliacao() {
  const [repasses,    setRepasses]    = useState<Repasse[]>([]);
  const [resumo,      setResumo]      = useState<ResumoStatus[]>([]);
  const [assinaturas, setAssinaturas] = useState<AssinaturasResumo | null>(null);
  const [carregando,  setCarregando]  = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [atualizando, setAtualizando] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch("/api/reconciliacao", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setRepasses(d.repasses ?? []);
        setResumo(d.resumo ?? []);
        setAssinaturas(d.assinaturas ?? null);
      }
    } catch { /* silencioso */ }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function alterarStatus(repasseId: number, novoStatus: string) {
    setAtualizando(repasseId);
    try {
      await fetch("/api/reconciliacao", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repasse_id: repasseId, status: novoStatus }),
      });
      setRepasses((prev) =>
        prev.map((r) => r.id === repasseId ? { ...r, status: novoStatus } : r)
      );
    } catch { /* silencioso */ }
    finally { setAtualizando(null); }
  }

  const repassesFiltrados = filtroStatus === "todos"
    ? repasses
    : repasses.filter((r) => r.status === filtroStatus);

  const totalPrevistoLiquid = repasses
    .filter((r) => r.status === "previsto")
    .reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0);

  const totalConfirmado = repasses
    .filter((r) => r.status === "confirmado")
    .reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0);

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-16 text-marca-texto-suave text-sm">
        Carregando dados Stripe…
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── KPIs de assinaturas ── */}
      {assinaturas && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "MRR",           valor: formatarBRL(Number(assinaturas.mrr)),   cor: "text-receita"  },
            { label: "Assinantes",    valor: String(assinaturas.ativas),              cor: "text-marca-texto" },
            { label: "Inadimplentes", valor: String(assinaturas.past_due),            cor: "text-despesa"  },
            { label: "Cancelados",    valor: String(assinaturas.canceladas),          cor: "text-gray-400" },
          ].map(({ label, valor, cor }) => (
            <div key={label} className="bg-white border border-marca-borda rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
              <p className={`mt-1 text-2xl font-black leading-none ${cor}`}>{valor}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Resumo por status ── */}
      <div className="bg-white border border-marca-borda rounded-2xl p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Repasses Stripe</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {["previsto", "confirmado", "em_risco", "cancelado"].map((s) => {
            const item = resumo.find((r) => r.status === s);
            return (
              <div key={s} className="space-y-0.5">
                <StatusBadge status={s} />
                <p className="text-sm font-bold text-marca-texto">{item ? formatarBRL(Number(item.total)) : "—"}</p>
                <p className="text-[11px] text-marca-texto-suave">{item ? `${item.qtd} repasse${item.qtd !== 1 ? "s" : ""}` : "0 repasses"}</p>
              </div>
            );
          })}
        </div>

        {/* Totalizadores extras */}
        <div className="mt-4 pt-4 border-t border-marca-borda flex flex-wrap gap-4 text-sm">
          <span>A receber (previsto): <strong className="text-receita">{formatarBRL(totalPrevistoLiquid)}</strong></span>
          <span>Confirmado: <strong className="text-receita">{formatarBRL(totalConfirmado)}</strong></span>
        </div>
      </div>

      {/* ── Filtro + tabela de repasses ── */}
      <div className="bg-white border border-marca-borda rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-marca-borda flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-semibold text-marca-texto">Histórico de repasses</p>
          <div className="flex gap-1.5 flex-wrap">
            {["todos", "previsto", "confirmado", "em_risco"].map((s) => (
              <button
                key={s}
                onClick={() => setFiltroStatus(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  filtroStatus === s
                    ? "bg-marca-preto text-white border-marca-preto"
                    : "bg-white text-marca-texto-suave border-marca-borda hover:bg-marca-fundo"
                }`}
              >
                {s === "todos" ? "Todos" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {repassesFiltrados.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-marca-texto-suave">
            Nenhum repasse encontrado.
            {repasses.length === 0 && (
              <p className="mt-1 text-xs">Sincronize os dados Stripe em Configurações.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-marca-borda text-marca-texto-suave text-left text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium text-right">Valor líquido</th>
                  <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Taxa</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Pagamento</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Repasse previsto</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-marca-borda">
                {repassesFiltrados.map((r) => (
                  <tr key={r.id} className="hover:bg-marca-fundo/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-marca-texto truncate max-w-[140px]">
                      {r.cliente_nome}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-receita">
                      {formatarBRL(Number(r.valor_liquido ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-marca-texto-suave hidden sm:table-cell">
                      {formatarBRL(Number(r.valor_taxa ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-marca-texto-suave hidden md:table-cell">
                      {r.data_pagamento ? String(r.data_pagamento).slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-3 text-marca-texto-suave hidden md:table-cell">
                      {r.data_repasse_prevista ? String(r.data_repasse_prevista).slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "previsto" && (
                        <button
                          onClick={() => alterarStatus(r.id, "confirmado")}
                          disabled={atualizando === r.id}
                          className="text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition disabled:opacity-50"
                        >
                          {atualizando === r.id ? "…" : "Confirmar"}
                        </button>
                      )}
                      {r.status === "em_risco" && (
                        <button
                          onClick={() => alterarStatus(r.id, "confirmado")}
                          disabled={atualizando === r.id}
                          className="text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition disabled:opacity-50"
                        >
                          {atualizando === r.id ? "…" : "Confirmar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
