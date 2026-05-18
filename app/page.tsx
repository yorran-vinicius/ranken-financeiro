"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CardsResumo from "@/components/CardsResumo";
import FiltroMes from "@/components/FiltroMes";
import GraficoBarras from "@/components/GraficoBarras";
import InsightsDashboard from "@/components/InsightsDashboard";
import PainelMetas from "@/components/PainelMetas";
import PontoEquilibrio from "@/components/PontoEquilibrio";
import type { Lancamento } from "@/lib/db";
import { exportarPDF } from "@/lib/exportarPDF";
import { formatarBRL, mesAtualISO, nomeMes, rotuloMesAno } from "@/lib/format";

// ── Helpers de data ───────────────────────────────────────────────────────────
function proxMes(mesAno: string): string {
  const [a, m] = mesAno.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

function mesAnteriorISO(mesAno: string): string {
  const [a, m] = mesAno.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
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

// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [mes, setMes]                           = useState(mesAtualISO());
  const [lancamentosMes, setLancamentosMes]     = useState<Lancamento[]>([]);
  const [todosLancamentos, setTodosLancamentos] = useState<Lancamento[]>([]);
  const [lancamentosAnt, setLancamentosAnt]     = useState<Lancamento[]>([]);
  const [carregando, setCarregando]             = useState(true);
  const [erro, setErro]                         = useState<string | null>(null);
  const [config, setConfig]                     = useState<Record<string, string>>({});

  // ── Carregar dados ────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const mesPrev  = mesAnteriorISO(mes);

    try {
      const [rMes, rTodos, rCfg, rAnt] = await Promise.all([
        fetch(`/api/lancamentos?mes=${mes}`,     { cache: "no-store" }),
        fetch(`/api/lancamentos`,                { cache: "no-store" }),
        fetch(`/api/configuracoes/geral`,        { cache: "no-store" }),
        fetch(`/api/lancamentos?mes=${mesPrev}`, { cache: "no-store" }),
      ]);
      const [dMes, dTodos, dCfg, dAnt] = await Promise.all([
        rMes.json(), rTodos.json(), rCfg.json(), rAnt.json(),
      ]);
      setLancamentosMes(Array.isArray(dMes)    ? dMes    : []);
      setTodosLancamentos(Array.isArray(dTodos) ? dTodos  : []);
      setConfig(dCfg && typeof dCfg === "object" ? dCfg   : {});
      setLancamentosAnt(Array.isArray(dAnt)    ? dAnt    : []);
    } catch {
      setErro("Erro ao carregar dados. Tente recarregar a página.");
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
  const funcPdf        = config.func_pdf        === "true";
  const funcAlertas    = config.func_alertas    === "true";

  const metaAnual  = parseFloat(config.meta_anual ?? "300000") || 300000;
  const nomeApp    = config.nome_app ?? "RANKEN Financeiro";

  const lancamentosVisiveis = lancamentosMes;

  // Custo fixo real: soma lançamentos recorrentes marcados como custo fixo;
  // se nenhum cadastrado, usa o valor legacy de configuracoes (retrocompat.)
  const custoFixo = useMemo(() => {
    const doCadastro = lancamentosVisiveis
      .filter((l) => l.custoFixo && l.tipo === "despesa")
      .reduce((s, l) => s + l.valor, 0);
    return doCadastro > 0
      ? doCadastro
      : parseFloat(config.custo_fixo_mensal ?? "0") || 0;
  }, [lancamentosVisiveis, config.custo_fixo_mensal]);

  // ── Totais do mês ─────────────────────────────────────────────────────────
  const { totalReceitas, totalDespesas } = useMemo(() => {
    let r = 0, d = 0;
    for (const l of lancamentosVisiveis) {
      if (l.tipo === "receita") r += l.valor;
      else d += l.valor;
    }
    return { totalReceitas: r, totalDespesas: d };
  }, [lancamentosVisiveis]);

  // ── Dados do mês anterior ─────────────────────────────────────────────────
  const mesPrevISO = useMemo(() => mesAnteriorISO(mes), [mes]);
  const labelMesAnt = useMemo(() => {
    const [, m] = mesPrevISO.split("-");
    return nomeMes(Number(m)).toLowerCase();
  }, [mesPrevISO]);

  const receitasAnt = useMemo(
    () => lancamentosAnt.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0),
    [lancamentosAnt],
  );
  const despesasAnt = useMemo(
    () => lancamentosAnt.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0),
    [lancamentosAnt],
  );

  // ── Alertas automáticos ───────────────────────────────────────────────────
  const alertasAtivos = useMemo(() => {
    if (!funcAlertas) return [];
    let limites: Record<string, number> = {};
    try { limites = JSON.parse(config.alertas_limites ?? "{}"); } catch { return []; }
    const despPorCat: Record<string, number> = {};
    for (const l of lancamentosVisiveis) {
      if (l.tipo === "despesa")
        despPorCat[l.categoria] = (despPorCat[l.categoria] ?? 0) + l.valor;
    }
    return Object.entries(limites)
      .filter(([cat, lim]) => Number(lim) > 0 && (despPorCat[cat] ?? 0) > Number(lim))
      .map(([cat, lim]) => ({ categoria: cat, gasto: despPorCat[cat] ?? 0, limite: Number(lim) }));
  }, [funcAlertas, config.alertas_limites, lancamentosVisiveis]);

  const saldoNegativo = funcAlertas && (totalReceitas - totalDespesas) < 0;

  // ── Alerta parcelas finalizando ───────────────────────────────────────────
  const mesProximo = proxMes(mes);
  const alertaParcelas = useMemo(() => todosLancamentos.filter(
    (l) => l.tipoLancamento === "parcelado" &&
           l.parcelaNum != null && l.parcelaTotal != null &&
           l.parcelaNum === l.parcelaTotal &&
           l.data.startsWith(mesProximo),
  ), [todosLancamentos, mesProximo]);

  // ── PDF ───────────────────────────────────────────────────────────────────
  function handleExportarPDF() { exportarPDF(lancamentosVisiveis, mes, nomeApp); }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Banner de erro ── */}
      {erro && (
        <div role="alert" className="flex items-center gap-3 bg-despesa-soft border border-despesa/30 rounded-xl px-4 py-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="w-4 h-4 text-despesa shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-sm text-despesa font-medium">{erro}</p>
          <button
            type="button"
            onClick={() => carregar()}
            className="ml-auto text-xs text-despesa underline underline-offset-2 hover:opacity-80 transition whitespace-nowrap"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-marca-texto">Dashboard</h1>
          <p className="text-sm text-marca-texto-suave">
            Visão geral de {rotuloMesAno(mes)}.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {funcPdf && (
            <button onClick={handleExportarPDF}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-marca-borda text-sm text-marca-texto-suave hover:bg-marca-fundo hover:text-marca-texto transition">
              <IconePDF /> Exportar PDF
            </button>
          )}
          <FiltroMes valor={mes} onChange={setMes} />
        </div>
      </div>

      {/* ── Indicador de saúde ── */}
      <InsightsDashboard
        totalReceitas={totalReceitas}
        totalDespesas={totalDespesas}
        custoFixo={custoFixo}
        receitasAnt={receitasAnt}
        despesasAnt={despesasAnt}
        labelMesAnt={labelMesAnt}
        lancamentosHoje={[]}
        mostrarHoje={false}
      />

      {/* ── Alertas ── */}
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
                <li key={a.categoria}>· {a.categoria}: {formatarBRL(a.gasto)} (limite: {formatarBRL(a.limite)})</li>
              ))}
            </ul>
          </div>
        </div>
      )}

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
                <li key={l.id}>· {l.descricao.replace(/ \(\d+\/\d+\)$/, "")} — última parcela em {rotuloMesAno(mesProximo)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── Painel de Metas ── */}
      {funcMetas && (
        <PainelMetas lancamentos={todosLancamentos} metaAnual={metaAnual} />
      )}

      {/* ── Cards resumo (com variação %) + Ponto de Equilíbrio ── */}
      {funcEquilibrio ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <CardsResumo
              totalReceitas={totalReceitas}
              totalDespesas={totalDespesas}
              receitasAnt={receitasAnt}
              despesasAnt={despesasAnt}
              labelMesAnt={labelMesAnt}
            />
          </div>
          <div className="lg:col-span-2">
            <PontoEquilibrio lancamentos={lancamentosVisiveis} />
          </div>
        </div>
      ) : (
        <CardsResumo
          totalReceitas={totalReceitas}
          totalDespesas={totalDespesas}
          receitasAnt={receitasAnt}
          despesasAnt={despesasAnt}
          labelMesAnt={labelMesAnt}
        />
      )}

      {/* ── Gráfico de barras histórico ── */}
      <GraficoBarras lancamentos={todosLancamentos} meses={6} />

      {carregando && (
        <p className="text-xs text-marca-texto-suave text-center">Atualizando...</p>
      )}
    </div>
  );
}
