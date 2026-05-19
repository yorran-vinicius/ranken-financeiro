"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FiltroMes from "@/components/FiltroMes";
import FluxoCaixa from "@/components/FluxoCaixa";
import GraficoPizza from "@/components/GraficoPizza";
import CustosFixos from "@/components/CustosFixos";
import Reconciliacao from "@/components/Reconciliacao";
import type { Lancamento } from "@/lib/db";
import { exportarPDF } from "@/lib/exportarPDF";
import { formatarBRL, hojeISO, mesAtualISO, nomeMes, rotuloMesAno } from "@/lib/format";

// ── Helpers ───────────────────────────────────────────────────────────────────
function mesAnteriorISO(mesAno: string): string {
  const [a, m] = mesAno.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}

function adicionarDias(iso: string, dias: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + dias);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function formatarDataExtenso(dataISO: string): string {
  const MESES = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-");
  return `${Number(dia)} de ${MESES[Number(mes) - 1]} de ${ano}`;
}

// ── Sub-componentes da aba Investidor ────────────────────────────────────────

function BarraValor({ valor, max, cor = "bg-marca-preto" }: { valor: number; max: number; cor?: string }) {
  const pct = max > 0 ? Math.min((valor / max) * 100, 100) : 0;
  return (
    <div className="flex-1 bg-marca-fundo rounded-full h-2 overflow-hidden">
      <div className={`h-2 rounded-full ${cor} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function KpiCard({ label, valor, cor = "text-marca-texto", sub }: { label: string; valor: string; cor?: string; sub?: string }) {
  return (
    <div className="bg-white border border-marca-borda rounded-2xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-black leading-none ${cor}`}>{valor}</p>
      {sub && <p className="text-xs text-marca-texto-suave mt-1">{sub}</p>}
    </div>
  );
}

function LinhaCat({ nome, valor, max, cor }: { nome: string; valor: number; max: number; cor?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-sm text-marca-texto-suave truncate shrink-0">{nome}</span>
      <BarraValor valor={valor} max={max} cor={cor} />
      <span className="w-28 text-sm font-semibold text-right tabular-nums text-marca-texto shrink-0">
        {formatarBRL(valor)}
      </span>
    </div>
  );
}

function IconePDF() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type SubAba = "operacional" | "custos" | "investidor" | "reconciliacao";

export default function AnalisePage() {
  const [mes, setMes]                                 = useState(mesAtualISO());
  const [aba, setAba]                                 = useState<SubAba>("operacional");
  const [lancamentosMes, setLancamentosMes]           = useState<Lancamento[]>([]);
  const [todosLancamentos, setTodosLancamentos]       = useState<Lancamento[]>([]);
  const [lancamentosProximos, setLancamentosProximos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando]                   = useState(true);
  const [config, setConfig]                           = useState<Record<string, string>>({});
  const [cidadeSelecionada, setCidadeSelecionada]     = useState<string>("todas");

  // ── Carregar dados ────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setCarregando(true);
    const hoje    = hojeISO();
    const daqui30 = adicionarDias(hoje, 30);
    try {
      const [rMes, rTodos, rCfg, rProx] = await Promise.all([
        fetch(`/api/lancamentos?mes=${mes}`,                             { cache: "no-store" }),
        fetch(`/api/lancamentos`,                                        { cache: "no-store" }),
        fetch(`/api/configuracoes/geral`,                                { cache: "no-store" }),
        fetch(`/api/lancamentos?dataInicio=${hoje}&dataFim=${daqui30}`,  { cache: "no-store" }),
      ]);
      const [dMes, dTodos, dCfg, dProx] = await Promise.all([
        rMes.json(), rTodos.json(), rCfg.json(), rProx.json(),
      ]);
      setLancamentosMes(Array.isArray(dMes)    ? dMes   : []);
      setTodosLancamentos(Array.isArray(dTodos) ? dTodos : []);
      setConfig(dCfg && typeof dCfg === "object" ? dCfg : {});
      setLancamentosProximos(Array.isArray(dProx) ? dProx : []);
    } catch { /* silencioso */ }
    finally { setCarregando(false); }
  }, [mes]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const handler = () => carregar();
    window.addEventListener("ranken:lancamento-adicionado", handler);
    return () => window.removeEventListener("ranken:lancamento-adicionado", handler);
  }, [carregar]);

  // ── Feature flags ─────────────────────────────────────────────────────────
  const funcCidade = config.func_cidade === "true";
  const nomeApp    = config.nome_app ?? "RANKEN Financeiro";

  const cidadesDisp = useMemo(() => {
    if (!funcCidade) return [];
    return (config.cidades ?? "Maringá,Londrina,Curitiba,Geral")
      .split(",").map((c) => c.trim()).filter(Boolean);
  }, [funcCidade, config.cidades]);

  useEffect(() => {
    if (!funcCidade) setCidadeSelecionada("todas");
  }, [funcCidade]);

  // ── Filtro por cidade ─────────────────────────────────────────────────────
  const lancamentosVisiveis = useMemo(() => {
    if (!funcCidade || cidadeSelecionada === "todas") return lancamentosMes;
    return lancamentosMes.filter((l) => (l.cidade ?? "Geral") === cidadeSelecionada);
  }, [funcCidade, cidadeSelecionada, lancamentosMes]);

  // ── Totais ────────────────────────────────────────────────────────────────
  const { totalReceitas, totalAportes, totalDespesas, receitasFixas, despesasFixas, receitasAvulsas, despesasAvulsas } =
    useMemo(() => {
      let r = 0, aportes = 0, d = 0, rf = 0, df = 0, ra = 0, da = 0;
      for (const l of lancamentosVisiveis) {
        const fixo = l.tipoLancamento === "recorrente";
        if (l.tipo === "receita") {
          if (l.categoria === "Aporte") {
            aportes += l.valor;
          } else {
            r += l.valor;
            fixo ? rf += l.valor : ra += l.valor;
          }
        } else {
          d += l.valor;
          fixo ? df += l.valor : da += l.valor;
        }
      }
      return { totalReceitas: r, totalAportes: aportes, totalDespesas: d, receitasFixas: rf, despesasFixas: df, receitasAvulsas: ra, despesasAvulsas: da };
    }, [lancamentosVisiveis]);

  // ── Hoje ──────────────────────────────────────────────────────────────────
  const hoje = hojeISO();
  const lancamentosHoje = useMemo(
    () => lancamentosMes.filter((l) => l.data === hoje),
    [lancamentosMes, hoje],
  );
  const entradasHoje = useMemo(
    () => lancamentosHoje.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0),
    [lancamentosHoje],
  );
  const saidasHoje = useMemo(
    () => lancamentosHoje.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0),
    [lancamentosHoje],
  );

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

  const temBreakdown = receitasFixas > 0 || despesasFixas > 0;

  // ── Dados Investidor ─────────────────────────────────────────────────────
  const metaAnual = parseFloat(config.meta_anual ?? "300000") || 300000;
  const anoAtual = new Date().getFullYear();
  const mesAtualNum = new Date().getMonth() + 1;

  const { receitasOp, totalAportesInv, totalDespesasInv, receitasPorCat, despesasPorCat } =
    useMemo(() => {
      let rOp = 0, aportes = 0, d = 0;
      const rByCat: Record<string, number> = {};
      const dByCat: Record<string, number> = {};
      for (const l of lancamentosVisiveis) {
        if (l.tipo === "receita") {
          if (l.categoria === "Aporte") { aportes += l.valor; }
          else { rOp += l.valor; rByCat[l.categoria] = (rByCat[l.categoria] ?? 0) + l.valor; }
        } else {
          d += l.valor;
          dByCat[l.categoria] = (dByCat[l.categoria] ?? 0) + l.valor;
        }
      }
      return { receitasOp: rOp, totalAportesInv: aportes, totalDespesasInv: d, receitasPorCat: rByCat, despesasPorCat: dByCat };
    }, [lancamentosVisiveis]);

  const resultadoOp = receitasOp - totalDespesasInv;
  const saldoDisponivel = receitasOp + totalAportesInv - totalDespesasInv;

  const { totalAnoOp, mesesComDados } = useMemo(() => {
    let total = 0;
    const meses = new Set<string>();
    for (const l of todosLancamentos) {
      if (l.tipo === "receita" && l.categoria !== "Aporte" && l.data.startsWith(String(anoAtual))) {
        total += l.valor;
        meses.add(l.data.slice(0, 7));
      }
    }
    return { totalAnoOp: total, mesesComDados: meses.size };
  }, [todosLancamentos, anoAtual]);

  const progresso     = metaAnual > 0 ? Math.min(totalAnoOp / metaAnual, 1) : 0;
  const pct           = (progresso * 100).toFixed(1);
  const metaAtingida  = totalAnoOp >= metaAnual;
  const mediaMensal   = mesesComDados > 0 ? totalAnoOp / mesesComDados : 0;
  const projecaoAnual = mediaMensal * 12;
  const vaiAtingir    = projecaoAnual >= metaAnual;
  const mesesRestantes = 12 - mesAtualNum + 1;

  const receitasCatSorted = useMemo(
    () => Object.entries(receitasPorCat).sort(([, a], [, b]) => b - a),
    [receitasPorCat],
  );
  const despesasCatSorted = useMemo(
    () => Object.entries(despesasPorCat).sort(([, a], [, b]) => b - a),
    [despesasPorCat],
  );
  const maxReceita = receitasCatSorted[0]?.[1] ?? 1;
  const maxDespesa = despesasCatSorted[0]?.[1] ?? 1;

  // ── Label mês anterior ────────────────────────────────────────────────────
  const mesPrevISO = useMemo(() => mesAnteriorISO(mes), [mes]);
  void mesPrevISO; // evita unused-var

  function handleExportarPDF() { exportarPDF(lancamentosVisiveis, mes, nomeApp); }

  const SUB_ABAS: { id: SubAba; label: string }[] = [
    { id: "operacional",   label: "Operacional"   },
    { id: "custos",        label: "Custos Fixos"  },
    { id: "investidor",    label: "Investidor"    },
    { id: "reconciliacao", label: "Stripe"        },
  ];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── Cabeçalho ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-marca-texto">Análise</h1>
          <p className="text-sm text-marca-texto-suave">
            Composição e fluxo de {rotuloMesAno(mes)}
            {funcCidade && cidadeSelecionada !== "todas" && (
              <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-marca-preto text-white">
                {cidadeSelecionada}
              </span>
            )}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {aba === "investidor" && (
            <button onClick={handleExportarPDF}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-marca-borda text-sm text-marca-texto-suave hover:bg-marca-fundo hover:text-marca-texto transition">
              <IconePDF /> Exportar PDF
            </button>
          )}
          <FiltroMes valor={mes} onChange={setMes} />
        </div>
      </div>

      {/* ── Sub-abas ── */}
      <div className="flex gap-1 border-b border-marca-borda">
        {SUB_ABAS.map((sa) => (
          <button
            key={sa.id}
            onClick={() => setAba(sa.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              aba === sa.id
                ? "border-marca-preto text-marca-texto"
                : "border-transparent text-marca-texto-suave hover:text-marca-texto"
            }`}
          >
            {sa.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════
          SUB-ABA: OPERACIONAL
         ══════════════════════════════ */}
      {aba === "operacional" && (
        <>
          {/* Linha Hoje */}
          {lancamentosHoje.length > 0 && (
            <div className="bg-white border border-marca-borda rounded-xl px-5 py-3 flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium text-marca-texto">
                Hoje, {formatarDataExtenso(hoje)}
              </span>
              <span className="text-marca-texto-suave hidden sm:inline">|</span>
              <span>
                Entradas: <span className="font-semibold text-receita">{formatarBRL(entradasHoje)}</span>
              </span>
              <span className="text-marca-texto-suave hidden sm:inline">|</span>
              <span>
                Saídas: <span className="font-semibold text-despesa">{formatarBRL(saidasHoje)}</span>
              </span>
            </div>
          )}

          {/* Filtro por cidade */}
          {funcCidade && cidadesDisp.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {["todas", ...cidadesDisp].map((cid) => (
                <button key={cid} onClick={() => setCidadeSelecionada(cid)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    cidadeSelecionada === cid
                      ? "bg-marca-preto text-white border-marca-preto"
                      : "bg-white text-marca-texto-suave border-marca-borda hover:bg-marca-fundo"
                  }`}>
                  {cid === "todas" ? "Todas" : cid}
                </button>
              ))}
            </div>
          )}

          {/* Composição receitas / despesas */}
          {temBreakdown && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "Receitas", fixo: receitasFixas, avulso: receitasAvulsas, cor: "text-receita", avulsoLabel: "Operacional", mostrarAportes: true },
                { label: "Despesas", fixo: despesasFixas, avulso: despesasAvulsas, cor: "text-despesa", avulsoLabel: "Avulso / Parcelado", mostrarAportes: false },
              ].map(({ label, fixo, avulso, cor, avulsoLabel, mostrarAportes }) => (
                <div key={label} className="bg-white border border-marca-borda rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-wide text-marca-texto-suave font-medium mb-2">{label} — composição</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-marca-texto-suave">Recorrente</span>
                      <span className={`font-semibold ${cor}`}>{formatarBRL(fixo)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-marca-texto-suave">{avulsoLabel}</span>
                      <span className={`font-semibold ${cor}`}>{formatarBRL(avulso)}</span>
                    </div>
                    {mostrarAportes && totalAportes > 0 && (
                      <div className="flex justify-between text-sm border-t border-marca-borda pt-1.5 mt-0.5">
                        <span className="text-marca-texto-suave">Aportes</span>
                        <span className="font-semibold text-marca-texto">{formatarBRL(totalAportes)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Gráficos de pizza */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GraficoPizza lancamentos={lancamentosVisiveis} tipo="receita" />
            <GraficoPizza lancamentos={lancamentosVisiveis} tipo="despesa" />
          </div>

          {/* Resumo por cidade */}
          {breakdownCidade.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-marca-texto-suave mb-2">Resumo por cidade</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {breakdownCidade.map(({ cid, r, d }) => (
                  <button key={cid} type="button" onClick={() => setCidadeSelecionada(cid)}
                    className="bg-white border border-marca-borda rounded-xl p-3.5 text-left hover:border-marca-preto transition">
                    <p className="text-xs font-semibold text-marca-texto mb-2">{cid}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wide text-marca-texto-suave">Receitas</span>
                      <span className="text-sm font-semibold text-receita">{formatarBRL(r)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] uppercase tracking-wide text-marca-texto-suave">Despesas</span>
                      <span className="text-xs font-semibold text-despesa">{formatarBRL(d)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fluxo de Caixa */}
          <FluxoCaixa
            lancamentos={lancamentosProximos}
            saldoAtual={totalReceitas - totalDespesas}
          />
        </>
      )}

      {/* ══════════════════════════════
          SUB-ABA: CUSTOS FIXOS
         ══════════════════════════════ */}
      {aba === "custos" && <CustosFixos />}

      {/* ══════════════════════════════
          SUB-ABA: INVESTIDOR
         ══════════════════════════════ */}
      {aba === "investidor" && (
        <>
          {/* Resumo executivo */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-marca-texto-suave mb-3">
              Resumo executivo
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <KpiCard label="Receita operacional" valor={formatarBRL(receitasOp)} cor="text-receita" sub="excl. aportes" />
              <KpiCard label="Total de despesas" valor={formatarBRL(totalDespesasInv)} cor="text-despesa" />
              <KpiCard label="Resultado operacional" valor={formatarBRL(resultadoOp)} cor={resultadoOp >= 0 ? "text-receita" : "text-despesa"} sub="receita op. − despesas" />
              <KpiCard label="Aportes recebidos" valor={formatarBRL(totalAportesInv)} cor="text-marca-texto" sub="capital dos sócios/investidores" />
              <KpiCard label="Saldo disponível estimado" valor={formatarBRL(saldoDisponivel)} cor={saldoDisponivel >= 0 ? "text-receita" : "text-despesa"} sub="rec. op. + aportes − despesas" />
            </div>
          </section>

          {/* Receitas por origem */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-marca-texto-suave mb-3">Receitas por origem</p>
            <div className="bg-white border border-marca-borda rounded-2xl p-5 space-y-3">
              {receitasCatSorted.length === 0 ? (
                <p className="text-sm text-marca-texto-suave">Nenhuma receita operacional neste mês.</p>
              ) : (
                receitasCatSorted.map(([cat, val]) => (
                  <LinhaCat key={cat} nome={cat} valor={val} max={maxReceita} cor="bg-receita" />
                ))
              )}
              {receitasCatSorted.length > 0 && (
                <div className="pt-3 border-t border-marca-borda flex items-center justify-between">
                  <span className="text-sm font-semibold text-marca-texto">Total operacional</span>
                  <span className="text-sm font-bold text-receita tabular-nums">{formatarBRL(receitasOp)}</span>
                </div>
              )}
              {totalAportesInv > 0 && (
                <div className="flex items-center justify-between bg-marca-fundo rounded-xl px-4 py-2.5 mt-2">
                  <div>
                    <span className="text-sm font-medium text-marca-texto">Aportes</span>
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded">Separado</span>
                  </div>
                  <span className="text-sm font-bold text-marca-texto tabular-nums">{formatarBRL(totalAportesInv)}</span>
                </div>
              )}
            </div>
          </section>

          {/* Despesas por categoria */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-marca-texto-suave mb-3">Despesas por categoria</p>
            <div className="bg-white border border-marca-borda rounded-2xl p-5 space-y-3">
              {despesasCatSorted.length === 0 ? (
                <p className="text-sm text-marca-texto-suave">Nenhuma despesa neste mês.</p>
              ) : (
                despesasCatSorted.map(([cat, val]) => (
                  <LinhaCat key={cat} nome={cat} valor={val} max={maxDespesa} cor="bg-despesa" />
                ))
              )}
              {despesasCatSorted.length > 0 && (
                <div className="pt-3 border-t border-marca-borda flex items-center justify-between">
                  <span className="text-sm font-semibold text-marca-texto">Total</span>
                  <span className="text-sm font-bold text-despesa tabular-nums">{formatarBRL(totalDespesasInv)}</span>
                </div>
              )}
            </div>
          </section>

          {/* Meta anual */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-marca-texto-suave mb-3">
              Meta anual {anoAtual} — receita operacional
            </p>
            <div className="bg-white border border-marca-borda rounded-2xl p-5">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <span className="text-2xl font-black text-marca-texto">{formatarBRL(totalAnoOp)}</span>
                  <span className="text-sm text-marca-texto-suave ml-2">de {formatarBRL(metaAnual)}</span>
                </div>
                <span className={`text-2xl font-black ${metaAtingida ? "text-receita" : Number(pct) >= 70 ? "text-yellow-500" : "text-marca-texto"}`}>
                  {pct}%
                </span>
              </div>
              <div className="w-full bg-marca-fundo rounded-full h-3 mb-5 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-700 ${metaAtingida ? "bg-receita" : Number(pct) >= 70 ? "bg-yellow-400" : "bg-marca-preto"}`}
                  style={{ width: `${progresso * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-marca-fundo rounded-xl p-3">
                  <p className="text-[10px] text-marca-texto-suave uppercase tracking-wide">Média/mês</p>
                  <p className="text-sm font-bold text-marca-texto mt-1">{formatarBRL(mediaMensal)}</p>
                </div>
                <div className="bg-marca-fundo rounded-xl p-3">
                  <p className="text-[10px] text-marca-texto-suave uppercase tracking-wide">Projeção anual</p>
                  <p className={`text-sm font-bold mt-1 ${vaiAtingir ? "text-receita" : "text-despesa"}`}>{formatarBRL(projecaoAnual)}</p>
                  <p className="text-[10px] text-marca-texto-suave mt-0.5">{vaiAtingir ? "✓ atingível" : "✗ abaixo"}</p>
                </div>
                <div className="bg-marca-fundo rounded-xl p-3">
                  <p className="text-[10px] text-marca-texto-suave uppercase tracking-wide">
                    {metaAtingida ? "Conquistada!" : "Meses restantes"}
                  </p>
                  {metaAtingida ? (
                    <p className="text-sm font-bold text-receita mt-1">🎉</p>
                  ) : (
                    <p className="text-sm font-bold text-marca-texto mt-1">{mesesRestantes}</p>
                  )}
                </div>
              </div>
              {!metaAtingida && mediaMensal > 0 && (
                <p className="mt-4 text-[12px] text-marca-texto-suave">
                  Faltam <strong className="text-marca-texto">{formatarBRL(metaAnual - totalAnoOp)}</strong>
                  {" "}com {mesesRestantes} {mesesRestantes === 1 ? "mês restante" : "meses restantes"} no ano.
                  {" "}Meta não inclui aportes.
                </p>
              )}
            </div>
          </section>
        </>
      )}

      {/* ══════════════════════════════
          SUB-ABA: STRIPE / RECONCILIAÇÃO
         ══════════════════════════════ */}
      {aba === "reconciliacao" && <Reconciliacao />}

      {carregando && (
        <p className="text-xs text-marca-texto-suave text-center">Atualizando...</p>
      )}
    </div>
  );
}
