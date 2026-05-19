"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FiltroMes from "@/components/FiltroMes";
import FluxoCaixa from "@/components/FluxoCaixa";
import GraficoPizza from "@/components/GraficoPizza";
import type { Lancamento } from "@/lib/db";
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

// ─────────────────────────────────────────────────────────────────────────────

export default function AnalisePage() {
  const [mes, setMes]                                 = useState(mesAtualISO());
  const [lancamentosMes, setLancamentosMes]           = useState<Lancamento[]>([]);
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
      const [rMes, rCfg, rProx] = await Promise.all([
        fetch(`/api/lancamentos?mes=${mes}`,                             { cache: "no-store" }),
        fetch(`/api/configuracoes/geral`,                                { cache: "no-store" }),
        fetch(`/api/lancamentos?dataInicio=${hoje}&dataFim=${daqui30}`,  { cache: "no-store" }),
      ]);
      const [dMes, dCfg, dProx] = await Promise.all([
        rMes.json(), rCfg.json(), rProx.json(),
      ]);
      setLancamentosMes(Array.isArray(dMes)   ? dMes   : []);
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
  // totalReceitas = receita operacional (sem Aporte); totalAportes separado
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

  // ── Label mês anterior ────────────────────────────────────────────────────
  const mesPrevISO = useMemo(() => mesAnteriorISO(mes), [mes]);
  const labelMesAnt = useMemo(() => {
    const [, m] = mesPrevISO.split("-");
    return nomeMes(Number(m)).toLowerCase();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesPrevISO]);

  void labelMesAnt; // usado apenas para evitar unused-var

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
        <FiltroMes valor={mes} onChange={setMes} />
      </div>

      {/* ── Linha Hoje ── */}
      {lancamentosHoje.length > 0 && (
        <div className="bg-white border border-marca-borda rounded-xl px-5 py-3 flex flex-wrap items-center gap-4 text-sm">
          <span className="font-medium text-marca-texto">
            Hoje, {formatarDataExtenso(hoje)}
          </span>
          <span className="text-marca-texto-suave hidden sm:inline">|</span>
          <span>
            Entradas:{" "}
            <span className="font-semibold text-receita">{formatarBRL(entradasHoje)}</span>
          </span>
          <span className="text-marca-texto-suave hidden sm:inline">|</span>
          <span>
            Saídas:{" "}
            <span className="font-semibold text-despesa">{formatarBRL(saidasHoje)}</span>
          </span>
        </div>
      )}

      {/* ── Filtro por cidade ── */}
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

      {/* ── Composição receitas / despesas ── */}
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

      {/* ── Gráficos de pizza por categoria ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GraficoPizza lancamentos={lancamentosVisiveis} tipo="receita" />
        <GraficoPizza lancamentos={lancamentosVisiveis} tipo="despesa" />
      </div>

      {/* ── Resumo por cidade ── */}
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

      {/* ── Fluxo de Caixa — Próximos 30 dias ── */}
      <FluxoCaixa
        lancamentos={lancamentosProximos}
        saldoAtual={totalReceitas - totalDespesas}
      />

      {carregando && (
        <p className="text-xs text-marca-texto-suave text-center">Atualizando...</p>
      )}
    </div>
  );
}
