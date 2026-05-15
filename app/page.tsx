"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CardsResumo from "@/components/CardsResumo";
import FiltroMes from "@/components/FiltroMes";
import GraficoBarras from "@/components/GraficoBarras";
import GraficoPizza from "@/components/GraficoPizza";
import NovoLancamento from "@/components/NovoLancamento";
import type { Lancamento } from "@/lib/db";
import { formatarBRL, mesAtualISO, rotuloMesAno } from "@/lib/format";

function proxMes(mesAno: string): string {
  const [a, m] = mesAno.split("-").map(Number);
  return m === 12
    ? `${a + 1}-01`
    : `${a}-${String(m + 1).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const [mes, setMes] = useState(mesAtualISO());
  const [lancamentosMes, setLancamentosMes] = useState<Lancamento[]>([]);
  const [todosLancamentos, setTodosLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [respMes, respTodos] = await Promise.all([
        fetch(`/api/lancamentos?mes=${mes}`, { cache: "no-store" }),
        fetch(`/api/lancamentos`, { cache: "no-store" }),
      ]);
      const [dadosMes, dadosTodos] = await Promise.all([respMes.json(), respTodos.json()]);
      setLancamentosMes(Array.isArray(dadosMes) ? dadosMes : []);
      setTodosLancamentos(Array.isArray(dadosTodos) ? dadosTodos : []);
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  useEffect(() => { carregar(); }, [carregar]);

  const { totalReceitas, totalDespesas, receitasFixas, despesasFixas, receitasAvulsas, despesasAvulsas } = useMemo(() => {
    let r = 0, d = 0, rf = 0, df = 0, ra = 0, da = 0;
    for (const l of lancamentosMes) {
      const fixo = l.tipoLancamento === "recorrente";
      if (l.tipo === "receita") { r += l.valor; fixo ? rf += l.valor : ra += l.valor; }
      else { d += l.valor; fixo ? df += l.valor : da += l.valor; }
    }
    return { totalReceitas: r, totalDespesas: d, receitasFixas: rf, despesasFixas: df, receitasAvulsas: ra, despesasAvulsas: da };
  }, [lancamentosMes]);

  // Alerta: parcelas finalizando no mês seguinte
  const mesProximo = proxMes(mes);
  const alertaParcelas = useMemo(() => {
    return todosLancamentos.filter(
      (l) =>
        l.tipoLancamento === "parcelado" &&
        l.parcelaNum != null &&
        l.parcelaTotal != null &&
        l.parcelaNum === l.parcelaTotal &&
        l.data.startsWith(mesProximo)
    );
  }, [todosLancamentos, mesProximo]);

  const temBreakdown = (receitasFixas > 0 || despesasFixas > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-marca-texto">Dashboard</h1>
          <p className="text-sm text-marca-texto-suave">Visão geral de {rotuloMesAno(mes)}.</p>
        </div>
        <FiltroMes valor={mes} onChange={setMes} />
      </div>

      {/* Alerta de parcelas finalizando */}
      {alertaParcelas.length > 0 && (
        <div className="flex items-start gap-3 bg-[#FFF8E1] border border-[#F9A825]/30 rounded-xl px-4 py-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="#F57F17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="w-4 h-4 mt-0.5 shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <p className="text-sm font-medium text-[#7B4F00]">
              {alertaParcelas.length === 1
                ? "1 parcelamento finaliza no próximo mês"
                : `${alertaParcelas.length} parcelamentos finalizam no próximo mês`}
            </p>
            <ul className="mt-1 text-xs text-[#7B4F00]/80 space-y-0.5">
              {alertaParcelas.map((l) => (
                <li key={l.id}>· {l.descricao.replace(/ \(\d+\/\d+\)$/, "")} — última parcela em {rotuloMesAno(mesProximo)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <CardsResumo totalReceitas={totalReceitas} totalDespesas={totalDespesas} />

      {/* Breakdown fixo vs avulso */}
      {temBreakdown && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-marca-borda rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-marca-texto-suave font-medium mb-2">Receitas — composição</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-marca-texto-suave flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className="w-3 h-3">
                    <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                    <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                  </svg>
                  Recorrente
                </span>
                <span className="font-semibold text-receita">{formatarBRL(receitasFixas)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-marca-texto-suave">Avulso</span>
                <span className="font-semibold text-receita">{formatarBRL(receitasAvulsas)}</span>
              </div>
            </div>
          </div>
          <div className="bg-white border border-marca-borda rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-marca-texto-suave font-medium mb-2">Despesas — composição</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-marca-texto-suave flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className="w-3 h-3">
                    <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                    <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                  </svg>
                  Recorrente
                </span>
                <span className="font-semibold text-despesa">{formatarBRL(despesasFixas)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-marca-texto-suave">Avulso / Parcelado</span>
                <span className="font-semibold text-despesa">{formatarBRL(despesasAvulsas)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <NovoLancamento onAdicionado={carregar} />
        </div>
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <GraficoPizza lancamentos={lancamentosMes} tipo="receita" />
          <GraficoPizza lancamentos={lancamentosMes} tipo="despesa" />
        </div>
      </div>

      <GraficoBarras lancamentos={todosLancamentos} meses={6} />

      {carregando && (
        <p className="text-xs text-marca-texto-suave text-center">Atualizando...</p>
      )}
    </div>
  );
}
