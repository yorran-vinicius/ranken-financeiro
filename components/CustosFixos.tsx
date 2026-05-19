"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatarBRL } from "@/lib/format";

interface CustoFixo {
  descricao_padrao: string;
  descricao_original: string;
  valor_referencia: number | null;
  categoria_id: string | null;
  categoria_nome: string | null;
  confirmado_mes?: boolean;
}

interface ProjecaoData {
  custosFixos: CustoFixo[];
  confirmados: Record<string, Record<string, boolean>>;
  meses: { label: string; anoMes: string }[];
}

function formatarMoedaCompacto(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return formatarBRL(v).replace("R$ ", "").replace("R$ ", "");
}

function StatusBadge({ confirmado, isFuturo }: { confirmado: boolean; isFuturo: boolean }) {
  if (confirmado) {
    return (
      <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-green-100 text-green-700">
        ✓
      </span>
    );
  }
  if (isFuturo) {
    return (
      <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-400">
        —
      </span>
    );
  }
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-yellow-100 text-yellow-600">
      ?
    </span>
  );
}

export default function CustosFixos() {
  const [custosReferencia, setCustosReferencia] = useState<CustoFixo[]>([]);
  const [projecao, setProjecao] = useState<ProjecaoData | null>(null);
  const [totalMesAtual, setTotalMesAtual] = useState(0);
  const [carregando, setCarregando] = useState(true);

  const mesAtual = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [rCustos, rProjecao] = await Promise.all([
        fetch(`/api/custos-fixos?mes=${mesAtual}`, { cache: "no-store" }),
        fetch(`/api/custos-fixos/projecao`, { cache: "no-store" }),
      ]);
      const [dCustos, dProjecao] = await Promise.all([rCustos.json(), rProjecao.json()]);

      if (dCustos.custosFixos) {
        setCustosReferencia(dCustos.custosFixos);
        setTotalMesAtual(dCustos.totalMesAtual ?? 0);
      }
      if (dProjecao.custosFixos) {
        setProjecao(dProjecao);
      }
    } catch { /* silencioso */ }
    finally { setCarregando(false); }
  }, [mesAtual]);

  useEffect(() => { carregar(); }, [carregar]);

  // Custos não confirmados no mês atual
  const naoConfirmados = custosReferencia.filter((c) => !c.confirmado_mes);
  const confirmados = custosReferencia.filter((c) => c.confirmado_mes);

  const totalProjetado = projecao?.custosFixos.reduce(
    (s, c) => s + (c.valor_referencia ?? 0), 0
  ) ?? 0;

  if (carregando) {
    return (
      <div className="py-10 text-center text-sm text-marca-texto-suave">
        Carregando custos fixos…
      </div>
    );
  }

  if (!projecao || projecao.custosFixos.length === 0) {
    return (
      <div className="bg-white border border-marca-borda rounded-2xl p-8 text-center">
        <p className="text-marca-texto font-medium mb-1">Nenhum custo fixo cadastrado</p>
        <p className="text-sm text-marca-texto-suave">
          Importe extratos bancários com lançamentos recorrentes para que o sistema aprenda
          automaticamente os seus custos fixos.
        </p>
      </div>
    );
  }

  const { meses, confirmados: confirmadosProjecao, custosFixos } = projecao;
  const mesAtualStr = mesAtual;

  return (
    <div className="space-y-6">

      {/* ── Resumo do mês ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-marca-borda rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Total fixos este mês
          </p>
          <p className="mt-1.5 text-2xl font-black text-despesa">
            {formatarBRL(totalMesAtual)}
          </p>
          <p className="text-xs text-marca-texto-suave mt-1">lançamentos recorrentes confirmados</p>
        </div>
        <div className="bg-white border border-marca-borda rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Confirmados
          </p>
          <p className="mt-1.5 text-2xl font-black text-receita">{confirmados.length}</p>
          <p className="text-xs text-marca-texto-suave mt-1">de {custosReferencia.length} padrões ativos</p>
        </div>
        <div className="bg-white border border-marca-borda rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Custo fixo mensal projetado
          </p>
          <p className="mt-1.5 text-2xl font-black text-marca-texto">
            {formatarBRL(totalProjetado)}
          </p>
          <p className="text-xs text-marca-texto-suave mt-1">base para ponto de equilíbrio</p>
        </div>
      </div>

      {/* ── Alerta: custos não confirmados ── */}
      {naoConfirmados.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
          <p className="text-yellow-700 font-medium text-sm mb-2">
            ⏳ {naoConfirmados.length} custo{naoConfirmados.length > 1 ? "s" : ""} fixo{naoConfirmados.length > 1 ? "s" : ""} ainda não apareceu{naoConfirmados.length > 1 ? "ram" : ""} este mês:
          </p>
          <ul className="space-y-0.5">
            {naoConfirmados.map((c) => (
              <li key={c.descricao_padrao} className="text-xs text-yellow-600">
                • {c.descricao_original}
                {c.valor_referencia != null && (
                  <span className="ml-1 font-medium">{formatarBRL(c.valor_referencia)}</span>
                )}
                {c.categoria_nome && (
                  <span className="ml-1 text-yellow-500">({c.categoria_nome})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Projeção 12 meses ── */}
      <div className="bg-white border border-marca-borda rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-marca-borda">
          <h3 className="text-sm font-semibold text-marca-texto">
            Projeção 12 meses
          </h3>
          <p className="text-xs text-marca-texto-suave mt-0.5">
            Verde = confirmado no banco · Cinza = projetado · Amarelo = esperado mas não encontrado
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-marca-borda bg-marca-fundo">
                <th className="text-left py-3 px-4 font-medium text-marca-texto-suave sticky left-0 bg-marca-fundo min-w-[160px] text-xs uppercase tracking-wide">
                  Custo fixo
                </th>
                {meses.map((m) => (
                  <th
                    key={m.anoMes}
                    className={`text-center py-3 px-2 font-medium text-xs min-w-[64px] ${
                      m.anoMes === mesAtualStr
                        ? "text-marca-preto bg-white"
                        : "text-marca-texto-suave"
                    }`}
                  >
                    {m.label}
                  </th>
                ))}
                <th className="text-right py-3 px-4 font-medium text-xs text-marca-texto-suave uppercase tracking-wide">
                  Anual
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-marca-borda">
              {custosFixos.map((custo) => {
                const padrao = custo.descricao_padrao;
                return (
                  <tr key={padrao} className="hover:bg-marca-fundo/50 transition-colors">
                    <td className="py-3 px-4 sticky left-0 bg-white">
                      <p className="font-medium text-marca-texto truncate max-w-[150px] text-sm">
                        {custo.descricao_original}
                      </p>
                      {custo.categoria_nome && (
                        <p className="text-[11px] text-marca-texto-suave mt-0.5">
                          {custo.categoria_nome}
                        </p>
                      )}
                    </td>
                    {meses.map((m) => {
                      const isConfirmado = confirmadosProjecao[padrao]?.[m.anoMes] ?? false;
                      const isFuturo = m.anoMes > mesAtualStr;
                      return (
                        <td key={m.anoMes} className="text-center py-3 px-1">
                          <span
                            className={`
                              inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-medium
                              ${isConfirmado
                                ? "bg-green-100 text-green-700"
                                : isFuturo
                                ? "bg-gray-100 text-gray-400"
                                : "bg-yellow-100 text-yellow-600"}
                            `}
                          >
                            {custo.valor_referencia != null
                              ? formatarMoedaCompacto(custo.valor_referencia)
                              : "—"}
                          </span>
                        </td>
                      );
                    })}
                    <td className="text-right py-3 px-4 font-semibold text-marca-texto text-sm">
                      {custo.valor_referencia != null
                        ? formatarBRL(custo.valor_referencia * 12)
                        : "—"}
                    </td>
                  </tr>
                );
              })}

              {/* Linha de total */}
              <tr className="border-t-2 border-marca-borda bg-marca-fundo font-bold">
                <td className="py-3 px-4 sticky left-0 bg-marca-fundo text-marca-texto text-sm">
                  Total mensal
                </td>
                {meses.map((m) => (
                  <td key={m.anoMes} className="text-center py-3 px-1">
                    <span className="text-xs text-marca-texto font-semibold tabular-nums">
                      {formatarMoedaCompacto(totalProjetado)}
                    </span>
                  </td>
                ))}
                <td className="text-right py-3 px-4 text-marca-texto text-sm">
                  {formatarBRL(totalProjetado * 12)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Lista de padrões ativos ── */}
      <div className="bg-white border border-marca-borda rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-marca-borda">
          <h3 className="text-sm font-semibold text-marca-texto">Padrões aprendidos</h3>
          <p className="text-xs text-marca-texto-suave mt-0.5">
            Baseado nos lançamentos recorrentes importados
          </p>
        </div>
        <ul className="divide-y divide-marca-borda">
          {custosReferencia.map((c) => (
            <li
              key={c.descricao_padrao}
              className="flex items-center justify-between px-5 py-3 hover:bg-marca-fundo/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-marca-texto truncate">
                  {c.descricao_original}
                </p>
                <p className="text-xs text-marca-texto-suave mt-0.5">
                  {c.categoria_nome ?? "Sem categoria"}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                {c.confirmado_mes !== undefined && (
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      c.confirmado_mes
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-600"
                    }`}
                  >
                    {c.confirmado_mes ? "Confirmado" : "Aguardando"}
                  </span>
                )}
                <span className="text-sm font-semibold text-despesa tabular-nums">
                  {c.valor_referencia != null ? formatarBRL(c.valor_referencia) : "—"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
