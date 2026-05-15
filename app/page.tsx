"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CardsResumo from "@/components/CardsResumo";
import FiltroMes from "@/components/FiltroMes";
import GraficoBarras from "@/components/GraficoBarras";
import GraficoPizza from "@/components/GraficoPizza";
import NovoLancamento from "@/components/NovoLancamento";
import type { Lancamento } from "@/lib/db";
import { mesAtualISO, rotuloMesAno } from "@/lib/format";

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

  useEffect(() => {
    carregar();
  }, [carregar]);

  const { totalReceitas, totalDespesas } = useMemo(() => {
    let r = 0;
    let d = 0;
    for (const l of lancamentosMes) {
      if (l.tipo === "receita") r += l.valor;
      else d += l.valor;
    }
    return { totalReceitas: r, totalDespesas: d };
  }, [lancamentosMes]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-marca-texto">Dashboard</h1>
          <p className="text-sm text-marca-texto-suave">
            Visão geral de {rotuloMesAno(mes)}.
          </p>
        </div>
        <FiltroMes valor={mes} onChange={setMes} />
      </div>

      <CardsResumo totalReceitas={totalReceitas} totalDespesas={totalDespesas} />

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
