"use client";

import { useState } from "react";
import type { Lancamento } from "@/lib/db";
import { formatarBRL, formatarData } from "@/lib/format";

interface Props {
  lancamentos: Lancamento[];
  onRemover: (id: string) => void;
  onEditar?: (l: Lancamento) => void;
  onToggleFavorito?: (id: string, favorito: boolean) => void;
  onUsarComoModelo?: (l: Lancamento) => void;
  onGerenciar?: (grupoId: string) => void;
  carregando?: boolean;
  mostrarCriador?: boolean;
}

/* ── Ícones ────────────────────────────────────────────────────────────────── */
function IconeEstrela({ preenchida }: { preenchida: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill={preenchida ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}

function IconeEditar() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function IconeLixeira() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4">
      <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
    </svg>
  );
}

/* ── Badge de tipo de lançamento ───────────────────────────────────────────── */
function BadgeTipo({ l }: { l: Lancamento }) {
  if (l.tipoLancamento === "recorrente") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className="w-2.5 h-2.5">
          <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
          <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
        </svg>
        Recorrente
      </span>
    );
  }
  if (l.tipoLancamento === "parcelado" && l.parcelaNum != null && l.parcelaTotal != null) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200 tabular-nums">
        {l.parcelaNum}/{l.parcelaTotal}
      </span>
    );
  }
  return null;
}

/* ── Componente principal ──────────────────────────────────────────────────── */
export default function ListaLancamentos({
  lancamentos,
  onRemover,
  onEditar,
  onToggleFavorito,
  onUsarComoModelo,
  onGerenciar,
  carregando,
  mostrarCriador,
}: Props) {
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  if (carregando) {
    return (
      <div className="bg-white border border-marca-borda rounded-2xl p-8 text-center text-marca-texto-suave">
        Carregando lançamentos...
      </div>
    );
  }

  if (lancamentos.length === 0) {
    return (
      <div className="bg-white border border-marca-borda rounded-2xl p-8 text-center text-marca-texto-suave">
        Nenhum lançamento neste filtro.
      </div>
    );
  }

  // Favoritos aparecem primeiro
  const sorted = [...lancamentos].sort((a, b) => {
    if (a.favorito && !b.favorito) return -1;
    if (!a.favorito && b.favorito) return 1;
    return 0;
  });

  const colsDesktop = mostrarCriador
    ? "md:grid-cols-[110px_1fr_140px_110px_110px_auto]"
    : "md:grid-cols-[110px_1fr_160px_110px_auto]";

  return (
    <div className="bg-white border border-marca-borda rounded-2xl overflow-hidden">
      {/* Cabeçalho desktop */}
      <div className={`hidden md:grid gap-3 px-5 py-3 bg-marca-fundo text-xs font-medium uppercase tracking-wide text-marca-texto-suave ${colsDesktop}`}>
        <span>Data</span>
        <span>Descrição</span>
        <span>Categoria</span>
        {mostrarCriador && <span>Por</span>}
        <span className="text-right">Valor</span>
        <span />
      </div>

      <ul className="divide-y divide-marca-borda">
        {sorted.map((l) => {
          const isReceita  = l.tipo === "receita";
          const isAvulso   = l.tipoLancamento === "avulso";
          const isGrupo    = !isAvulso;
          const isFavorito = Boolean(l.favorito);
          const confirmando = confirmandoId === l.id;

          return (
            <li
              key={l.id}
              className={`px-5 py-4 grid grid-cols-[1fr_auto] gap-3 items-start ${colsDesktop} md:grid md:items-center ${
                isFavorito ? "bg-[#FFFDF0]" : ""
              }`}
            >
              <div className="md:contents">
                {/* Data */}
                <span className="text-sm text-marca-texto-suave whitespace-nowrap">
                  {formatarData(l.data)}
                </span>

                {/* Descrição + badges mobile */}
                <div className="text-sm text-marca-texto font-medium md:font-normal">
                  <div className="flex items-center flex-wrap gap-1.5">
                    <span>{l.descricao}</span>
                    <BadgeTipo l={l} />
                    {isFavorito && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                        ★ Favorito
                      </span>
                    )}
                    <span
                      className={`md:hidden inline-block text-[10px] uppercase font-semibold tracking-wide px-1.5 py-0.5 rounded ${
                        isReceita ? "bg-receita-soft text-receita" : "bg-despesa-soft text-despesa"
                      }`}
                    >
                      {isReceita ? "Receita" : "Despesa"}
                    </span>
                  </div>
                  <span className="block md:hidden text-xs text-marca-texto-suave mt-0.5">
                    {l.categoria || "—"}
                    {mostrarCriador && l.criadoPorNome && ` · ${l.criadoPorNome}`}
                  </span>
                  {l.notas && (
                    <span className="block text-xs text-marca-texto-suave italic mt-0.5 md:mt-0">
                      {l.notas}
                    </span>
                  )}
                  {/* "Usar como modelo" abaixo da descrição (só para favoritos) */}
                  {isFavorito && onUsarComoModelo && (
                    <button
                      type="button"
                      onClick={() => onUsarComoModelo(l)}
                      className="mt-1 text-[11px] text-marca-texto-suave hover:text-marca-preto underline underline-offset-2 transition"
                    >
                      Usar como modelo
                    </button>
                  )}
                </div>

                {/* Categoria desktop */}
                <span className="hidden md:inline text-sm text-marca-texto-suave">
                  <span className={`mr-2 inline-block w-2 h-2 rounded-full ${isReceita ? "bg-receita" : "bg-despesa"}`} />
                  {l.categoria || "—"}
                </span>

                {/* Criador (master only) */}
                {mostrarCriador && (
                  <span className="hidden md:inline text-sm text-marca-texto-suave">
                    {l.criadoPorNome ?? "—"}
                  </span>
                )}

                {/* Valor */}
                <span className={`text-sm font-semibold text-right ${isReceita ? "text-receita" : "text-despesa"}`}>
                  {isReceita ? "+" : "−"} {formatarBRL(l.valor)}
                </span>
              </div>

              {/* ── Área de ações ── */}
              <div className="flex flex-col items-end gap-1">
                {confirmando ? (
                  /* Confirmação de exclusão inline */
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-marca-texto-suave whitespace-nowrap">
                      Tem certeza que deseja remover este lançamento?
                    </span>
                    <button
                      type="button"
                      onClick={() => { onRemover(l.id); setConfirmandoId(null); }}
                      className="px-2 py-1 rounded bg-despesa text-white font-semibold hover:opacity-90 transition whitespace-nowrap"
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoId(null)}
                      className="px-2 py-1 rounded border border-marca-borda text-marca-texto hover:bg-marca-fundo transition"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-0.5">
                    {/* Estrela / favorito — todos os tipos */}
                    {onToggleFavorito && (
                      <button
                        type="button"
                        onClick={() => onToggleFavorito(l.id, !isFavorito)}
                        aria-label={isFavorito ? "Desfavoritar" : "Favoritar"}
                        title={isFavorito ? "Desfavoritar" : "Favoritar"}
                        className={`p-1 rounded transition ${
                          isFavorito
                            ? "text-amber-400 hover:text-amber-600"
                            : "text-marca-texto-suave hover:text-amber-400"
                        }`}
                      >
                        <IconeEstrela preenchida={isFavorito} />
                      </button>
                    )}

                    {isGrupo ? (
                      /* Gerenciar grupo */
                      <button
                        type="button"
                        onClick={() => l.grupoId && onGerenciar?.(l.grupoId)}
                        aria-label="Gerenciar recorrência"
                        title="Gerenciar"
                        className="text-marca-texto-suave hover:text-marca-preto transition p-1 rounded"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className="w-4 h-4">
                          <circle cx="12" cy="12" r="3"/>
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                          <path d="M4.93 4.93a10 10 0 0 0 0 14.14"/>
                        </svg>
                      </button>
                    ) : (
                      <>
                        {/* Editar — apenas avulso */}
                        {onEditar && (
                          <button
                            type="button"
                            onClick={() => onEditar(l)}
                            aria-label="Editar lançamento"
                            title="Editar"
                            className="text-marca-texto-suave hover:text-marca-preto transition p-1 rounded"
                          >
                            <IconeEditar />
                          </button>
                        )}

                        {/* Remover */}
                        <button
                          type="button"
                          onClick={() => setConfirmandoId(l.id)}
                          aria-label="Remover lançamento"
                          title="Remover"
                          className="text-marca-texto-suave hover:text-despesa transition p-1 rounded"
                        >
                          <IconeLixeira />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
