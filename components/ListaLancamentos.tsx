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
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconeEditar() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconeLixeira() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4">
      <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function IconeGerenciar() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
    </svg>
  );
}

/* ── Badge tipo de lançamento ──────────────────────────────────────────────── */
function BadgeTipo({ l }: { l: Lancamento }) {
  if (l.tipoLancamento === "recorrente") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200 whitespace-nowrap">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className="w-2.5 h-2.5 shrink-0">
          <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        Recorrente
      </span>
    );
  }
  if (l.tipoLancamento === "parcelado" && l.parcelaNum != null && l.parcelaTotal != null) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200 tabular-nums whitespace-nowrap">
        {l.parcelaNum}/{l.parcelaTotal}
      </span>
    );
  }
  return null;
}

/* ── Botões de ação reutilizáveis ──────────────────────────────────────────── */
function BotoesAcao({
  l, isFavorito, isAvulso, isGrupo,
  onToggleFavorito, onEditar, onGerenciar,
  onConfirmar,
}: {
  l: Lancamento;
  isFavorito: boolean;
  isAvulso: boolean;
  isGrupo: boolean;
  onToggleFavorito?: Props["onToggleFavorito"];
  onEditar?: Props["onEditar"];
  onGerenciar?: Props["onGerenciar"];
  onConfirmar: () => void;
}) {
  return (
    <>
      {/* Estrela */}
      {onToggleFavorito && (
        <button
          type="button"
          onClick={() => onToggleFavorito(l.id, !isFavorito)}
          aria-label={isFavorito ? "Desfavoritar" : "Favoritar"}
          title={isFavorito ? "Desfavoritar" : "Favoritar"}
          className={`p-1.5 rounded transition-colors ${
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
          className="p-1.5 rounded text-marca-texto-suave hover:text-marca-preto transition-colors"
        >
          <IconeGerenciar />
        </button>
      ) : (
        <>
          {/* Editar — apenas avulso */}
          {onEditar && (
            <button
              type="button"
              onClick={() => onEditar(l)}
              aria-label="Editar"
              title="Editar"
              className="p-1.5 rounded text-marca-texto-suave hover:text-marca-preto transition-colors"
            >
              <IconeEditar />
            </button>
          )}
          {/* Remover */}
          <button
            type="button"
            onClick={onConfirmar}
            aria-label="Remover"
            title="Remover"
            className="p-1.5 rounded text-marca-texto-suave hover:text-despesa transition-colors"
          >
            <IconeLixeira />
          </button>
        </>
      )}
    </>
  );
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
      <div className="bg-white border border-marca-borda rounded-2xl p-8 text-center text-sm text-marca-texto-suave">
        Carregando lançamentos...
      </div>
    );
  }

  if (lancamentos.length === 0) {
    return (
      <div className="bg-white border border-marca-borda rounded-2xl p-8 text-center text-sm text-marca-texto-suave">
        Nenhum lançamento neste filtro.
      </div>
    );
  }

  // Favoritos primeiro
  const sorted = [...lancamentos].sort((a, b) => {
    if (a.favorito && !b.favorito) return -1;
    if (!a.favorito && b.favorito) return 1;
    return 0;
  });

  /*
   * Colunas desktop — valores fixos para que tudo fique na mesma linha:
   *   Data | Descrição (flex) | Categoria | [Por] | Valor | Ações
   *   Os px de Valor e Ações são suficientes para "− R$ 99.999,99" e 3 ícones.
   */
  const colsDesktop = mostrarCriador
    ? "grid-cols-[100px_1fr_130px_100px_128px_96px]"
    : "grid-cols-[100px_1fr_150px_128px_96px]";

  return (
    <div className="bg-white border border-marca-borda rounded-2xl overflow-hidden">

      {/* ── Cabeçalho (desktop) ── */}
      <div className={`hidden md:grid ${colsDesktop} gap-4 px-5 py-3 bg-marca-fundo text-[11px] font-semibold uppercase tracking-wider text-marca-texto-suave`}>
        <span>Data</span>
        <span>Descrição</span>
        <span>Categoria</span>
        {mostrarCriador && <span>Por</span>}
        <span className="text-right">Valor</span>
        <span className="text-right">Ações</span>
      </div>

      {/* ── Linhas ── */}
      <ul className="divide-y divide-marca-borda">
        {sorted.map((l) => {
          const isReceita  = l.tipo === "receita";
          const isAvulso   = l.tipoLancamento === "avulso";
          const isGrupo    = !isAvulso;
          const isFavorito = Boolean(l.favorito);
          const confirmando = confirmandoId === l.id;
          const corValor   = isReceita ? "text-receita" : "text-despesa";
          const valorFmt   = `${isReceita ? "+" : "−"} ${formatarBRL(l.valor)}`;

          const rowBg = isFavorito ? "bg-amber-50/60" : "";

          return (
            <li key={l.id} className={rowBg}>

              {/* ════════════════════════════════════════
                  DESKTOP — grid de N colunas, tudo em linha
                 ════════════════════════════════════════ */}
              <div className={`hidden md:grid ${colsDesktop} gap-4 px-5 py-3.5 items-center`}>

                {/* Col 1 — Data */}
                <span className="text-sm text-marca-texto-suave whitespace-nowrap tabular-nums">
                  {formatarData(l.data)}
                </span>

                {/* Col 2 — Descrição */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm text-marca-texto">{l.descricao}</span>
                    <BadgeTipo l={l} />
                    {isFavorito && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                        ★ Favorito
                      </span>
                    )}
                  </div>
                  {l.notas && (
                    <p className="text-xs text-marca-texto-suave italic mt-0.5 truncate">{l.notas}</p>
                  )}
                  {isFavorito && onUsarComoModelo && (
                    <button
                      type="button"
                      onClick={() => onUsarComoModelo(l)}
                      className="mt-0.5 text-[11px] text-marca-texto-suave hover:text-marca-preto underline underline-offset-2 transition-colors"
                    >
                      Usar como modelo
                    </button>
                  )}
                </div>

                {/* Col 3 — Categoria */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isReceita ? "bg-receita" : "bg-despesa"}`} />
                  <span className="text-sm text-marca-texto-suave truncate">{l.categoria || "—"}</span>
                </div>

                {/* Col 4 — Por (master only) */}
                {mostrarCriador && (
                  <span className="text-sm text-marca-texto-suave truncate">
                    {l.criadoPorNome ?? "—"}
                  </span>
                )}

                {/* Col N-1 — Valor (alinhado à direita, mesma linha) */}
                <span className={`text-sm font-semibold tabular-nums whitespace-nowrap text-right ${corValor}`}>
                  {valorFmt}
                </span>

                {/* Col N — Ações (alinhadas à direita, sem quebra de linha) */}
                <div className="flex items-center justify-end gap-0 whitespace-nowrap">
                  {confirmando ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-marca-texto-suave whitespace-nowrap">Remover?</span>
                      <button
                        type="button"
                        onClick={() => { onRemover(l.id); setConfirmandoId(null); }}
                        className="px-2 py-1 text-xs rounded bg-despesa text-white font-semibold hover:opacity-90 transition whitespace-nowrap"
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmandoId(null)}
                        className="px-2 py-1 text-xs rounded border border-marca-borda text-marca-texto hover:bg-marca-fundo transition"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <BotoesAcao
                      l={l} isFavorito={isFavorito} isAvulso={isAvulso} isGrupo={isGrupo}
                      onToggleFavorito={onToggleFavorito}
                      onEditar={onEditar}
                      onGerenciar={onGerenciar}
                      onConfirmar={() => setConfirmandoId(l.id)}
                    />
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════
                  MOBILE — layout 2 colunas: conteúdo | valor+ações
                 ════════════════════════════════════════ */}
              <div className="md:hidden flex items-start gap-3 px-4 py-3.5">

                {/* Coluna esquerda — conteúdo */}
                <div className="flex-1 min-w-0">
                  {/* Linha meta: data · categoria */}
                  <p className="text-xs text-marca-texto-suave mb-1 flex items-center gap-1 flex-wrap">
                    <span className="tabular-nums">{formatarData(l.data)}</span>
                    <span>·</span>
                    <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${isReceita ? "bg-receita" : "bg-despesa"}`} />
                    <span className="truncate">{l.categoria || "—"}</span>
                  </p>

                  {/* Descrição + badges */}
                  <div className="flex items-center flex-wrap gap-1.5">
                    <span className="text-sm font-medium text-marca-texto">{l.descricao}</span>
                    <BadgeTipo l={l} />
                    {isFavorito && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                        ★ Favorito
                      </span>
                    )}
                  </div>

                  {/* Notas */}
                  {l.notas && (
                    <p className="text-xs text-marca-texto-suave italic mt-0.5">{l.notas}</p>
                  )}

                  {/* Usar como modelo */}
                  {isFavorito && onUsarComoModelo && (
                    <button
                      type="button"
                      onClick={() => onUsarComoModelo(l)}
                      className="mt-1 text-[11px] text-marca-texto-suave hover:text-marca-preto underline underline-offset-2 transition-colors"
                    >
                      Usar como modelo
                    </button>
                  )}
                </div>

                {/* Coluna direita — valor + ações */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {/* Valor */}
                  <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${corValor}`}>
                    {valorFmt}
                  </span>

                  {/* Botões ou confirmação */}
                  {confirmando ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[11px] text-marca-texto-suave text-right whitespace-nowrap">
                        Tem certeza que deseja<br />remover este lançamento?
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { onRemover(l.id); setConfirmandoId(null); }}
                          className="px-2.5 py-1 text-xs rounded bg-despesa text-white font-semibold hover:opacity-90 transition"
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmandoId(null)}
                          className="px-2.5 py-1 text-xs rounded border border-marca-borda text-marca-texto hover:bg-marca-fundo transition"
                        >
                          Não
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0">
                      <BotoesAcao
                        l={l} isFavorito={isFavorito} isAvulso={isAvulso} isGrupo={isGrupo}
                        onToggleFavorito={onToggleFavorito}
                        onEditar={onEditar}
                        onGerenciar={onGerenciar}
                        onConfirmar={() => setConfirmandoId(l.id)}
                      />
                    </div>
                  )}
                </div>
              </div>

            </li>
          );
        })}
      </ul>
    </div>
  );
}
