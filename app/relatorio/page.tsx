"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FiltroMes from "@/components/FiltroMes";
import type { Lancamento } from "@/lib/db";
import { exportarPDF } from "@/lib/exportarPDF";
import { formatarBRL, mesAtualISO, rotuloMesAno } from "@/lib/format";

// ── Ícone PDF ─────────────────────────────────────────────────────────────────
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

// ── Barra horizontal de progresso ─────────────────────────────────────────────
function BarraValor({ valor, max, cor = "bg-marca-preto" }: { valor: number; max: number; cor?: string }) {
  const pct = max > 0 ? Math.min((valor / max) * 100, 100) : 0;
  return (
    <div className="flex-1 bg-marca-fundo rounded-full h-2 overflow-hidden">
      <div className={`h-2 rounded-full ${cor} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Card de KPI ───────────────────────────────────────────────────────────────
function KpiCard({
  label, valor, cor = "text-marca-texto", sub,
}: {
  label: string; valor: string; cor?: string; sub?: string;
}) {
  return (
    <div className="bg-white border border-marca-borda rounded-2xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-black leading-none ${cor}`}>{valor}</p>
      {sub && <p className="text-xs text-marca-texto-suave mt-1">{sub}</p>}
    </div>
  );
}

// ── Linha de categoria (barra + valor) ────────────────────────────────────────
function LinhaCat({
  nome, valor, max, cor,
}: {
  nome: string; valor: number; max: number; cor?: string;
}) {
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

// ─────────────────────────────────────────────────────────────────────────────

export default function RelatorioPage() {
  const [mes, setMes]                           = useState(mesAtualISO());
  const [lancamentos, setLancamentos]           = useState<Lancamento[]>([]);
  const [todosLancamentos, setTodosLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando]             = useState(true);
  const [config, setConfig]                     = useState<Record<string, string>>({});

  // ── Carregar dados ────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [rMes, rTodos, rCfg] = await Promise.all([
        fetch(`/api/lancamentos?mes=${mes}`, { cache: "no-store" }),
        fetch(`/api/lancamentos`,            { cache: "no-store" }),
        fetch(`/api/configuracoes/geral`,    { cache: "no-store" }),
      ]);
      const [dMes, dTodos, dCfg] = await Promise.all([
        rMes.json(), rTodos.json(), rCfg.json(),
      ]);
      setLancamentos(Array.isArray(dMes)    ? dMes   : []);
      setTodosLancamentos(Array.isArray(dTodos) ? dTodos : []);
      setConfig(dCfg && typeof dCfg === "object" ? dCfg : {});
    } catch { /* silencioso */ }
    finally { setCarregando(false); }
  }, [mes]);

  useEffect(() => { carregar(); }, [carregar]);

  const metaAnual = parseFloat(config.meta_anual ?? "300000") || 300000;
  const nomeApp   = config.nome_app ?? "RANKEN Financeiro";

  // ── Cálculos do mês ───────────────────────────────────────────────────────
  const {
    receitasOp, totalAportes, totalDespesas,
    receitasPorCat, despesasPorCat,
  } = useMemo(() => {
    let rOp = 0, aportes = 0, d = 0;
    const rByCat: Record<string, number> = {};
    const dByCat: Record<string, number> = {};
    for (const l of lancamentos) {
      if (l.tipo === "receita") {
        if (l.categoria === "Aporte") {
          aportes += l.valor;
        } else {
          rOp += l.valor;
          rByCat[l.categoria] = (rByCat[l.categoria] ?? 0) + l.valor;
        }
      } else {
        d += l.valor;
        dByCat[l.categoria] = (dByCat[l.categoria] ?? 0) + l.valor;
      }
    }
    return { receitasOp: rOp, totalAportes: aportes, totalDespesas: d, receitasPorCat: rByCat, despesasPorCat: dByCat };
  }, [lancamentos]);

  const resultadoOp     = receitasOp - totalDespesas;
  const saldoDisponivel = receitasOp + totalAportes - totalDespesas;

  // ── Meta anual (só receita operacional, sem aportes) ─────────────────────
  const anoAtual = new Date().getFullYear();
  const mesAtualNum = new Date().getMonth() + 1;

  const { totalAnoOp, mesesComDados } = useMemo(() => {
    let total = 0;
    const meses = new Set<string>();
    for (const l of todosLancamentos) {
      if (
        l.tipo === "receita" &&
        l.categoria !== "Aporte" &&
        l.data.startsWith(String(anoAtual))
      ) {
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

  // ── Dados para as listas de categorias ───────────────────────────────────
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

  function handleExportar() {
    exportarPDF(lancamentos, mes, nomeApp);
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 max-w-4xl">

      {/* ── Cabeçalho ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-marca-preto text-white font-black text-base shrink-0">
              R
            </span>
            <span className="text-sm font-semibold text-marca-texto-suave uppercase tracking-widest">
              {nomeApp}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-marca-texto">
            Relatório do Investidor
          </h1>
          <p className="text-sm text-marca-texto-suave mt-0.5">
            {rotuloMesAno(mes)} · visão separada por receita operacional e aportes
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={handleExportar}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-marca-borda text-sm text-marca-texto-suave hover:bg-marca-fundo hover:text-marca-texto transition"
          >
            <IconePDF /> Exportar PDF
          </button>
          <FiltroMes valor={mes} onChange={setMes} />
        </div>
      </div>

      {carregando && (
        <p className="text-xs text-marca-texto-suave">Carregando...</p>
      )}

      {/* ══════════════════════════════════════════════
          SEÇÃO 1 — Resumo executivo
         ══════════════════════════════════════════════ */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-marca-texto-suave mb-3">
          Resumo executivo
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <KpiCard
            label="Receita operacional"
            valor={formatarBRL(receitasOp)}
            cor="text-receita"
            sub="excl. aportes"
          />
          <KpiCard
            label="Total de despesas"
            valor={formatarBRL(totalDespesas)}
            cor="text-despesa"
          />
          <KpiCard
            label="Resultado operacional"
            valor={formatarBRL(resultadoOp)}
            cor={resultadoOp >= 0 ? "text-receita" : "text-despesa"}
            sub="receita op. − despesas"
          />
          <KpiCard
            label="Aportes recebidos"
            valor={formatarBRL(totalAportes)}
            cor="text-marca-texto"
            sub="capital dos sócios/investidores"
          />
          <KpiCard
            label="Saldo disponível estimado"
            valor={formatarBRL(saldoDisponivel)}
            cor={saldoDisponivel >= 0 ? "text-receita" : "text-despesa"}
            sub="rec. op. + aportes − despesas"
          />
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SEÇÃO 2 — Receitas por origem
         ══════════════════════════════════════════════ */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-marca-texto-suave mb-3">
          Receitas por origem
        </p>

        <div className="bg-white border border-marca-borda rounded-2xl p-5 space-y-3">
          {receitasCatSorted.length === 0 ? (
            <p className="text-sm text-marca-texto-suave">Nenhuma receita operacional neste mês.</p>
          ) : (
            receitasCatSorted.map(([cat, val]) => (
              <LinhaCat key={cat} nome={cat} valor={val} max={maxReceita} cor="bg-receita" />
            ))
          )}

          {/* Separador + total */}
          {receitasCatSorted.length > 0 && (
            <div className="pt-3 border-t border-marca-borda flex items-center justify-between">
              <span className="text-sm font-semibold text-marca-texto">Total operacional</span>
              <span className="text-sm font-bold text-receita tabular-nums">{formatarBRL(receitasOp)}</span>
            </div>
          )}

          {/* Linha de aporte separada */}
          {totalAportes > 0 && (
            <div className="flex items-center justify-between bg-marca-fundo rounded-xl px-4 py-2.5 mt-2">
              <div>
                <span className="text-sm font-medium text-marca-texto">Aportes</span>
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded">
                  Separado
                </span>
              </div>
              <span className="text-sm font-bold text-marca-texto tabular-nums">{formatarBRL(totalAportes)}</span>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SEÇÃO 3 — Despesas por categoria
         ══════════════════════════════════════════════ */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-marca-texto-suave mb-3">
          Despesas por categoria
        </p>

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
              <span className="text-sm font-bold text-despesa tabular-nums">{formatarBRL(totalDespesas)}</span>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SEÇÃO 4 — Meta anual
         ══════════════════════════════════════════════ */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-marca-texto-suave mb-3">
          Meta anual {anoAtual} — receita operacional
        </p>

        <div className="bg-white border border-marca-borda rounded-2xl p-5">
          {/* Cabeçalho da meta */}
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <span className="text-2xl font-black text-marca-texto">{formatarBRL(totalAnoOp)}</span>
              <span className="text-sm text-marca-texto-suave ml-2">de {formatarBRL(metaAnual)}</span>
            </div>
            <span className={`text-2xl font-black ${
              metaAtingida ? "text-receita" : Number(pct) >= 70 ? "text-yellow-500" : "text-marca-texto"
            }`}>
              {pct}%
            </span>
          </div>

          {/* Barra */}
          <div className="w-full bg-marca-fundo rounded-full h-3 mb-5 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-700 ${
                metaAtingida ? "bg-receita" : Number(pct) >= 70 ? "bg-yellow-400" : "bg-marca-preto"
              }`}
              style={{ width: `${progresso * 100}%` }}
            />
          </div>

          {/* Grid de métricas */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-marca-fundo rounded-xl p-3">
              <p className="text-[10px] text-marca-texto-suave uppercase tracking-wide">Média/mês</p>
              <p className="text-sm font-bold text-marca-texto mt-1">{formatarBRL(mediaMensal)}</p>
            </div>
            <div className="bg-marca-fundo rounded-xl p-3">
              <p className="text-[10px] text-marca-texto-suave uppercase tracking-wide">Projeção anual</p>
              <p className={`text-sm font-bold mt-1 ${vaiAtingir ? "text-receita" : "text-despesa"}`}>
                {formatarBRL(projecaoAnual)}
              </p>
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

          {/* Falta para meta */}
          {!metaAtingida && mediaMensal > 0 && (
            <p className="mt-4 text-[12px] text-marca-texto-suave">
              Faltam{" "}
              <strong className="text-marca-texto">{formatarBRL(metaAnual - totalAnoOp)}</strong>
              {" "}com {mesesRestantes} {mesesRestantes === 1 ? "mês restante" : "meses restantes"} no ano.
              {" "}Meta não inclui aportes.
            </p>
          )}
        </div>
      </section>

    </div>
  );
}
