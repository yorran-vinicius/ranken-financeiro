"use client";

import { useEffect, useState } from "react";
import type { GrupoLancamento, Lancamento } from "@/lib/db";
import { formatarBRL, formatarData, hojeISO } from "@/lib/format";
import { LABEL_FREQUENCIA } from "@/lib/recorrencia";

interface Props {
  grupoId: string | null;
  onFechar: () => void;
  onAlterado: () => void;
}

interface DadosGrupo {
  grupo: GrupoLancamento;
  lancamentos: Lancamento[];
}

type Aba = "visao_geral" | "reajustar";

export default function GerenciarGrupo({ grupoId, onFechar, onAlterado }: Props) {
  const [dados, setDados] = useState<DadosGrupo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aba, setAba] = useState<Aba>("visao_geral");

  // Campos de ação
  const [dataCorte, setDataCorte] = useState(hojeISO());
  const [novoValor, setNovoValor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    if (!grupoId) return;
    setCarregando(true);
    setDados(null);
    setErro(null);
    setSucesso(null);
    setAba("visao_geral");
    fetch(`/api/grupos/${grupoId}`)
      .then((r) => r.json())
      .then(setDados)
      .finally(() => setCarregando(false));
  }, [grupoId]);

  if (!grupoId) return null;

  async function executarAcao(body: Record<string, unknown>) {
    setEnviando(true);
    setErro(null);
    setSucesso(null);
    try {
      const resp = await fetch(`/api/grupos/${grupoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.erro ?? "Erro ao executar ação");
      }
      setSucesso("Operação realizada com sucesso.");
      onAlterado();
      // Recarrega dados do grupo
      const r = await fetch(`/api/grupos/${grupoId}`);
      setDados(await r.json());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setEnviando(false);
    }
  }

  const hoje = hojeISO();
  const g = dados?.grupo;
  const lancamentos = dados?.lancamentos ?? [];
  const futuras = lancamentos.filter((l) => l.data >= hoje && !l.cancelado);
  const passadas = lancamentos.filter((l) => l.data < hoje && !l.cancelado);
  const canceladas = lancamentos.filter((l) => l.cancelado);

  const isRecorrente = g?.tipo === "recorrente";
  const isParcelado  = g?.tipo === "parcelado";

  const inputCls = "mt-1 w-full px-3 py-2 rounded-lg border border-marca-borda bg-white focus:outline-none focus:ring-2 focus:ring-marca-preto text-sm";
  const labelCls = "text-xs font-medium text-marca-texto-suave";

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onFechar} />

      <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-marca-borda">
          <div>
            <div className="flex items-center gap-2">
              {isRecorrente && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className="w-2.5 h-2.5">
                    <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                    <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                  </svg>
                  Recorrente
                </span>
              )}
              {isParcelado && (
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
                  Parcelado em {g?.totalParcelas}x
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-marca-texto mt-1">
              {carregando ? "Carregando..." : g?.descricao ?? "—"}
            </h2>
            {g && (
              <p className="text-xs text-marca-texto-suave mt-0.5">
                {isRecorrente && `${LABEL_FREQUENCIA[g.frequencia!]} · ${formatarBRL(g.valorBase)}/ocorrência`}
                {isParcelado && `${formatarBRL(g.valorBase)}/parcela · Total ${formatarBRL(g.valorTotal ?? 0)}`}
              </p>
            )}
          </div>
          <button onClick={onFechar} className="p-1 text-marca-texto-suave hover:text-marca-preto transition rounded">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Abas (só para recorrente) */}
        {isRecorrente && !carregando && (
          <div className="flex border-b border-marca-borda px-5">
            {(["visao_geral", "reajustar"] as Aba[]).map((a) => (
              <button key={a} type="button" onClick={() => setAba(a)}
                className={`py-3 mr-4 text-sm font-medium border-b-2 transition ${
                  aba === a
                    ? "border-marca-preto text-marca-preto"
                    : "border-transparent text-marca-texto-suave hover:text-marca-preto"
                }`}>
                {a === "visao_geral" ? "Visão geral" : "Reajustar valor"}
              </button>
            ))}
          </div>
        )}

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {carregando && <p className="text-sm text-marca-texto-suave">Carregando...</p>}

          {sucesso && (
            <div className="bg-receita-soft border border-receita/20 rounded-lg px-3 py-2 text-sm text-receita">
              {sucesso}
            </div>
          )}
          {erro && (
            <div className="bg-despesa-soft border border-despesa/20 rounded-lg px-3 py-2 text-sm text-despesa">
              {erro}
            </div>
          )}

          {/* ── PARCELADO: lista de parcelas ── */}
          {isParcelado && !carregando && (
            <>
              <div className="border border-marca-borda rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-marca-fundo text-marca-texto-suave">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium">Vencimento</th>
                      <th className="px-3 py-2 text-right text-xs font-medium">Valor</th>
                      <th className="px-3 py-2 text-center text-xs font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-marca-borda">
                    {lancamentos.map((l) => {
                      const isPast    = l.data < hoje;
                      const isFuture  = l.data >= hoje;
                      const isCanceld = l.cancelado;
                      return (
                        <tr key={l.id} className={isCanceld ? "opacity-40" : ""}>
                          <td className="px-3 py-2 font-semibold text-marca-texto-suave">
                            {l.parcelaNum}/{l.parcelaTotal}
                          </td>
                          <td className="px-3 py-2 text-marca-texto">{formatarData(l.data)}</td>
                          <td className="px-3 py-2 text-right text-marca-texto">{formatarBRL(l.valor)}</td>
                          <td className="px-3 py-2 text-center">
                            {isCanceld
                              ? <span className="text-[10px] font-semibold text-despesa">Cancelada</span>
                              : isPast
                                ? <span className="text-[10px] font-semibold text-receita">Paga</span>
                                : <span className="text-[10px] font-semibold text-marca-texto-suave">Pendente</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {futuras.length > 0 && (
                <div className="border border-despesa/30 rounded-lg p-4">
                  <p className="text-sm font-medium text-marca-texto mb-1">
                    Cancelar parcelas restantes
                  </p>
                  <p className="text-xs text-marca-texto-suave mb-3">
                    {futuras.length} parcela{futuras.length > 1 ? "s" : ""} pendente{futuras.length > 1 ? "s" : ""} ·
                    Total: {formatarBRL(futuras.reduce((s, l) => s + l.valor, 0))}
                  </p>
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={() => executarAcao({ acao: "cancelar_tudo" })}
                    className="w-full py-2 rounded-lg bg-despesa text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
                  >
                    {enviando ? "Processando..." : "Cancelar parcelas restantes"}
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── RECORRENTE: aba visão geral ── */}
          {isRecorrente && aba === "visao_geral" && !carregando && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-marca-fundo border border-marca-borda rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wide text-marca-texto-suave font-medium">Realizadas</p>
                  <p className="mt-1 text-lg font-bold text-marca-texto">{passadas.length}</p>
                </div>
                <div className="bg-marca-fundo border border-marca-borda rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wide text-marca-texto-suave font-medium">Futuras</p>
                  <p className="mt-1 text-lg font-bold text-marca-texto">{futuras.length}</p>
                </div>
                <div className="bg-marca-fundo border border-marca-borda rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wide text-marca-texto-suave font-medium">Canceladas</p>
                  <p className="mt-1 text-lg font-bold text-marca-texto">{canceladas.length}</p>
                </div>
              </div>

              {g?.dataInicio && (
                <p className="text-xs text-marca-texto-suave">
                  Período: <strong>{formatarData(g.dataInicio)}</strong>
                  {g.dataFim ? <> até <strong>{formatarData(g.dataFim)}</strong></> : " · sem data de término"}
                </p>
              )}

              {/* Encerrar a partir de */}
              {futuras.length > 0 && (
                <div className="space-y-3 border border-marca-borda rounded-lg p-4">
                  <p className="text-sm font-medium text-marca-texto">Encerrar recorrência a partir de</p>
                  <label className="block">
                    <span className={labelCls}>Data de corte</span>
                    <input type="date" value={dataCorte} min={hoje}
                      onChange={(e) => setDataCorte(e.target.value)} className={inputCls} />
                  </label>
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={() => executarAcao({ acao: "encerrar", dataCorte })}
                    className="w-full py-2 rounded-lg bg-marca-preto text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
                  >
                    {enviando ? "Processando..." : "Encerrar recorrência"}
                  </button>
                </div>
              )}

              {/* Cancelar todas */}
              {futuras.length > 0 && (
                <div className="border border-despesa/30 rounded-lg p-4">
                  <p className="text-sm font-medium text-marca-texto mb-1">Cancelar todas as futuras</p>
                  <p className="text-xs text-marca-texto-suave mb-3">
                    Remove as próximas {futuras.length} ocorrências sem apagar o histórico.
                  </p>
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={() => executarAcao({ acao: "cancelar_tudo" })}
                    className="w-full py-2 rounded-lg bg-despesa text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
                  >
                    {enviando ? "Processando..." : "Cancelar todas as ocorrências futuras"}
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── RECORRENTE: aba reajustar ── */}
          {isRecorrente && aba === "reajustar" && !carregando && (
            <div className="space-y-3 border border-marca-borda rounded-lg p-4">
              <p className="text-sm font-medium text-marca-texto">Alterar valor a partir de uma data</p>
              <p className="text-xs text-marca-texto-suave">
                O histórico anterior é mantido. Apenas as ocorrências a partir da data escolhida serão atualizadas.
              </p>
              <label className="block">
                <span className={labelCls}>A partir de</span>
                <input type="date" value={dataCorte} min={hoje}
                  onChange={(e) => setDataCorte(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Novo valor (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                  placeholder={g ? formatarBRL(g.valorBase) : "0,00"}
                  className={inputCls}
                />
              </label>
              <button
                type="button"
                disabled={enviando}
                onClick={() => {
                  const v = Number(novoValor.replace(/\./g, "").replace(",", "."));
                  if (!Number.isFinite(v) || v <= 0) { setErro("Valor inválido."); return; }
                  executarAcao({ acao: "reajustar", dataCorte, novoValor: v });
                }}
                className="w-full py-2 rounded-lg bg-marca-preto text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {enviando ? "Aplicando..." : "Aplicar reajuste"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
