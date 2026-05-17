"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CardsResumo from "@/components/CardsResumo";
import FiltroMes from "@/components/FiltroMes";
import GraficoBarras from "@/components/GraficoBarras";
import GraficoPizza from "@/components/GraficoPizza";
import PainelMetas from "@/components/PainelMetas";
import PontoEquilibrio from "@/components/PontoEquilibrio";
import type { Lancamento } from "@/lib/db";
import { exportarPDF } from "@/lib/exportarPDF";
import { formatarBRL, mesAtualISO, rotuloMesAno } from "@/lib/format";

function proxMes(mesAno: string): string {
  const [a, m] = mesAno.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

// ── Ícone de Alerta ───────────────────────────────────────────────────────────
function IconeAlerta({ cor = "#F57F17" }: { cor?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4 mt-0.5 shrink-0">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

// ── Ícone de PDF ──────────────────────────────────────────────────────────────
function IconePDF() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

export default function DashboardPage() {
  const [mes, setMes]                           = useState(mesAtualISO());
  const [lancamentosMes, setLancamentosMes]     = useState<Lancamento[]>([]);
  const [todosLancamentos, setTodosLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando]             = useState(true);
  const [config, setConfig]                     = useState<Record<string, string>>({});
  const [cidadeSelecionada, setCidadeSelecionada] = useState<string>("todas");

  // ── Carregar dados ────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [respMes, respTodos, respConfig] = await Promise.all([
        fetch(`/api/lancamentos?mes=${mes}`, { cache: "no-store" }),
        fetch(`/api/lancamentos`, { cache: "no-store" }),
        fetch(`/api/configuracoes/geral`, { cache: "no-store" }),
      ]);
      const [dadosMes, dadosTodos, dadosConfig] = await Promise.all([
        respMes.json(), respTodos.json(), respConfig.json(),
      ]);
      setLancamentosMes(Array.isArray(dadosMes) ? dadosMes : []);
      setTodosLancamentos(Array.isArray(dadosTodos) ? dadosTodos : []);
      setConfig(dadosConfig && typeof dadosConfig === "object" ? dadosConfig : {});
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  useEffect(() => { carregar(); }, [carregar]);

  // Escuta o evento do botão flutuante (ClientLayout)
  useEffect(() => {
    const handler = () => carregar();
    window.addEventListener("ranken:lancamento-adicionado", handler);
    return () => window.removeEventListener("ranken:lancamento-adicionado", handler);
  }, [carregar]);

  // ── Feature flags ─────────────────────────────────────────────────────────
  const funcMetas      = config.func_metas      === "true";
  const funcEquilibrio = config.func_equilibrio === "true";
  const funcCidade     = config.func_cidade     === "true";
  const funcPdf        = config.func_pdf        === "true";
  const funcAlertas    = config.func_alertas    === "true";

  const metaAnual      = parseFloat(config.meta_anual      ?? "300000") || 300000;
  const custoFixo      = parseFloat(config.custo_fixo_mensal ?? "20000") || 20000;
  const nomeApp        = config.nome_app ?? "RANKEN Financeiro";

  const cidadesDisp = useMemo(() => {
    if (!funcCidade) return [];
    return (config.cidades ?? "Maringá,Londrina,Curitiba,Geral")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
  }, [funcCidade, config.cidades]);

  // Reseta filtro cidade se feature for desabilitada
  useEffect(() => {
    if (!funcCidade) setCidadeSelecionada("todas");
  }, [funcCidade]);

  // ── Filtro por cidade ─────────────────────────────────────────────────────
  const lancamentosVisiveis = useMemo(() => {
    if (!funcCidade || cidadeSelecionada === "todas") return lancamentosMes;
    return lancamentosMes.filter(
      (l) => (l.cidade ?? "Geral") === cidadeSelecionada,
    );
  }, [funcCidade, cidadeSelecionada, lancamentosMes]);

  // ── Totais do mês (visíveis) ──────────────────────────────────────────────
  const {
    totalReceitas, totalDespesas,
    receitasFixas, despesasFixas,
    receitasAvulsas, despesasAvulsas,
  } = useMemo(() => {
    let r = 0, d = 0, rf = 0, df = 0, ra = 0, da = 0;
    for (const l of lancamentosVisiveis) {
      const fixo = l.tipoLancamento === "recorrente";
      if (l.tipo === "receita") { r += l.valor; fixo ? rf += l.valor : ra += l.valor; }
      else { d += l.valor; fixo ? df += l.valor : da += l.valor; }
    }
    return { totalReceitas: r, totalDespesas: d, receitasFixas: rf, despesasFixas: df, receitasAvulsas: ra, despesasAvulsas: da };
  }, [lancamentosVisiveis]);

  // ── Alertas automáticos ───────────────────────────────────────────────────
  const alertasAtivos = useMemo(() => {
    if (!funcAlertas) return [];
    let limites: Record<string, number> = {};
    try { limites = JSON.parse(config.alertas_limites ?? "{}"); } catch { return []; }

    const despesasPorCat: Record<string, number> = {};
    for (const l of lancamentosVisiveis) {
      if (l.tipo === "despesa")
        despesasPorCat[l.categoria] = (despesasPorCat[l.categoria] ?? 0) + l.valor;
    }

    return Object.entries(limites)
      .filter(([cat, lim]) => Number(lim) > 0 && (despesasPorCat[cat] ?? 0) > Number(lim))
      .map(([cat, lim]) => ({
        categoria: cat,
        gasto: despesasPorCat[cat] ?? 0,
        limite: Number(lim),
      }));
  }, [funcAlertas, config.alertas_limites, lancamentosVisiveis]);

  const saldoNegativo = funcAlertas && (totalReceitas - totalDespesas) < 0;

  // ── Alerta parcelas finalizando ───────────────────────────────────────────
  const mesProximo = proxMes(mes);
  const alertaParcelas = useMemo(() => {
    return todosLancamentos.filter(
      (l) =>
        l.tipoLancamento === "parcelado" &&
        l.parcelaNum != null &&
        l.parcelaTotal != null &&
        l.parcelaNum === l.parcelaTotal &&
        l.data.startsWith(mesProximo),
    );
  }, [todosLancamentos, mesProximo]);

  const temBreakdown = receitasFixas > 0 || despesasFixas > 0;

  // ── PDF ───────────────────────────────────────────────────────────────────
  function handleExportarPDF() {
    exportarPDF(lancamentosVisiveis, mes, nomeApp);
  }

  // ── Breakdown por cidade ──────────────────────────────────────────────────
  const breakdownCidade = useMemo(() => {
    if (!funcCidade || cidadeSelecionada !== "todas" || cidadesDisp.length === 0) return [];
    return cidadesDisp.map((cid) => {
      const lacs = lancamentosMes.filter((l) => (l.cidade ?? "Geral") === cid);
      const r = lacs.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
      const d = lacs.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);
      return { cid, r, d, n: lacs.length };
    }).filter((x) => x.n > 0);
  }, [funcCidade, cidadeSelecionada, cidadesDisp, lancamentosMes]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-marca-texto">Dashboard</h1>
          <p className="text-sm text-marca-texto-suave">
            Visão geral de {rotuloMesAno(mes)}
            {funcCidade && cidadeSelecionada !== "todas" && (
              <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-marca-preto text-white">
                {cidadeSelecionada}
              </span>
            )}
            .
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {funcPdf && (
            <button
              onClick={handleExportarPDF}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-marca-borda text-sm text-marca-texto-suave hover:bg-marca-fundo hover:text-marca-texto transition"
            >
              <IconePDF /> Exportar PDF
            </button>
          )}
          <FiltroMes valor={mes} onChange={setMes} />
        </div>
      </div>

      {/* Filtro por cidade */}
      {funcCidade && cidadesDisp.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setCidadeSelecionada("todas")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              cidadeSelecionada === "todas"
                ? "bg-marca-preto text-white border-marca-preto"
                : "bg-white text-marca-texto-suave border-marca-borda hover:bg-marca-fundo"
            }`}
          >
            Todas
          </button>
          {cidadesDisp.map((cid) => (
            <button
              key={cid}
              onClick={() => setCidadeSelecionada(cid)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                cidadeSelecionada === cid
                  ? "bg-marca-preto text-white border-marca-preto"
                  : "bg-white text-marca-texto-suave border-marca-borda hover:bg-marca-fundo"
              }`}
            >
              {cid}
            </button>
          ))}
        </div>
      )}

      {/* Alertas automáticos: saldo negativo */}
      {saldoNegativo && (
        <div className="flex items-start gap-3 bg-despesa-soft border border-despesa/20 rounded-xl px-4 py-3">
          <IconeAlerta cor="#dc2626" />
          <div>
            <p className="text-sm font-medium text-despesa">Saldo negativo no mês</p>
            <p className="text-xs text-despesa/80 mt-0.5">
              As despesas ({formatarBRL(totalDespesas)}) superam as receitas ({formatarBRL(totalReceitas)}).
              Saldo: {formatarBRL(totalReceitas - totalDespesas)}.
            </p>
          </div>
        </div>
      )}

      {/* Alertas automáticos: categorias acima do limite */}
      {alertasAtivos.length > 0 && (
        <div className="flex items-start gap-3 bg-[#FFF3E0] border border-[#FB8C00]/25 rounded-xl px-4 py-3">
          <IconeAlerta />
          <div>
            <p className="text-sm font-medium text-[#7B4F00]">
              {alertasAtivos.length === 1
                ? "1 categoria ultrapassou o limite de gastos"
                : `${alertasAtivos.length} categorias ultrapassaram o limite de gastos`}
            </p>
            <ul className="mt-1 text-xs text-[#7B4F00]/80 space-y-0.5">
              {alertasAtivos.map((a) => (
                <li key={a.categoria}>
                  · {a.categoria}: {formatarBRL(a.gasto)} (limite: {formatarBRL(a.limite)})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Alerta de parcelas finalizando */}
      {alertaParcelas.length > 0 && (
        <div className="flex items-start gap-3 bg-[#FFF8E1] border border-[#F9A825]/30 rounded-xl px-4 py-3">
          <IconeAlerta />
          <div>
            <p className="text-sm font-medium text-[#7B4F00]">
              {alertaParcelas.length === 1
                ? "1 parcelamento finaliza no próximo mês"
                : `${alertaParcelas.length} parcelamentos finalizam no próximo mês`}
            </p>
            <ul className="mt-1 text-xs text-[#7B4F00]/80 space-y-0.5">
              {alertaParcelas.map((l) => (
                <li key={l.id}>
                  · {l.descricao.replace(/ \(\d+\/\d+\)$/, "")} — última parcela em {rotuloMesAno(mesProximo)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Painel de Metas */}
      {funcMetas && (
        <PainelMetas lancamentos={todosLancamentos} metaAnual={metaAnual} />
      )}

      {/* Cards resumo + Ponto de Equilíbrio */}
      {funcEquilibrio ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <CardsResumo totalReceitas={totalReceitas} totalDespesas={totalDespesas} />
          </div>
          <div className="lg:col-span-2">
            <PontoEquilibrio lancamentos={lancamentosVisiveis} custoFixo={custoFixo} />
          </div>
        </div>
      ) : (
        <CardsResumo totalReceitas={totalReceitas} totalDespesas={totalDespesas} />
      )}

      {/* Breakdown por cidade */}
      {breakdownCidade.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-marca-texto-suave mb-2">
            Resumo por cidade
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {breakdownCidade.map(({ cid, r, d }) => (
              <button
                key={cid}
                type="button"
                onClick={() => setCidadeSelecionada(cid)}
                className="bg-white border border-marca-borda rounded-xl p-3.5 text-left hover:border-marca-preto transition"
              >
                <p className="text-xs font-semibold text-marca-texto">{cid}</p>
                <p className="text-sm font-bold text-receita mt-1">{formatarBRL(r)}</p>
                <p className="text-xs text-despesa">{formatarBRL(d)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown fixo vs avulso */}
      {temBreakdown && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-marca-borda rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-marca-texto-suave font-medium mb-2">
              Receitas — composição
            </p>
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
            <p className="text-xs uppercase tracking-wide text-marca-texto-suave font-medium mb-2">
              Despesas — composição
            </p>
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

      {/* Gráficos de pizza — full width */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GraficoPizza lancamentos={lancamentosVisiveis} tipo="receita" />
        <GraficoPizza lancamentos={lancamentosVisiveis} tipo="despesa" />
      </div>

      {/* Gráfico de barras histórico */}
      <GraficoBarras lancamentos={todosLancamentos} meses={6} />

      {carregando && (
        <p className="text-xs text-marca-texto-suave text-center">Atualizando...</p>
      )}
    </div>
  );
}
