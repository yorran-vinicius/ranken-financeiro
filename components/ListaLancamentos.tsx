"use client";

import type { Lancamento } from "@/lib/db";
import { formatarBRL, formatarData } from "@/lib/format";

interface Props {
  lancamentos: Lancamento[];
  onRemover: (id: string) => void;
  onGerenciar?: (grupoId: string) => void;
  carregando?: boolean;
}

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

export default function ListaLancamentos({ lancamentos, onRemover, onGerenciar, carregando }: Props) {
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

  return (
    <div className="bg-white border border-marca-borda rounded-2xl overflow-hidden">
      <div className="hidden md:grid md:grid-cols-[110px_1fr_160px_140px_88px] gap-3 px-5 py-3 bg-marca-fundo text-xs font-medium uppercase tracking-wide text-marca-texto-suave">
        <span>Data</span>
        <span>Descrição</span>
        <span>Categoria</span>
        <span className="text-right">Valor</span>
        <span />
      </div>

      <ul className="divide-y divide-marca-borda">
        {lancamentos.map((l) => {
          const isReceita = l.tipo === "receita";
          const isGrupo = l.tipoLancamento !== "avulso";

          return (
            <li
              key={l.id}
              className="px-5 py-4 grid grid-cols-[1fr_auto] md:grid-cols-[110px_1fr_160px_140px_88px] gap-3 items-center"
            >
              <div className="md:contents">
                {/* Data */}
                <span className="text-sm text-marca-texto-suave whitespace-nowrap">
                  {formatarData(l.data)}
                </span>

                {/* Descrição + badges mobile */}
                <div className="text-sm text-marca-texto font-medium md:font-normal">
                  <span>{l.descricao}</span>
                  <span className="ml-2">
                    <BadgeTipo l={l} />
                  </span>
                  <span
                    className={`md:hidden ml-1 inline-block text-[10px] uppercase font-semibold tracking-wide px-1.5 py-0.5 rounded ${
                      isReceita ? "bg-receita-soft text-receita" : "bg-despesa-soft text-despesa"
                    }`}
                  >
                    {isReceita ? "Receita" : "Despesa"}
                  </span>
                  <span className="block md:hidden text-xs text-marca-texto-suave mt-0.5">
                    {l.categoria}
                  </span>
                </div>

                {/* Categoria desktop */}
                <span className="hidden md:inline text-sm text-marca-texto-suave">
                  <span className={`mr-2 inline-block w-2 h-2 rounded-full ${isReceita ? "bg-receita" : "bg-despesa"}`} />
                  {l.categoria}
                </span>

                {/* Valor */}
                <span className={`text-sm font-semibold text-right ${isReceita ? "text-receita" : "text-despesa"}`}>
                  {isReceita ? "+" : "−"} {formatarBRL(l.valor)}
                </span>
              </div>

              {/* Ações */}
              <div className="flex items-center gap-1 justify-end">
                {isGrupo ? (
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
                  <button
                    type="button"
                    onClick={() => onRemover(l.id)}
                    aria-label="Remover lançamento"
                    title="Remover"
                    className="text-marca-texto-suave hover:text-despesa transition p-1 rounded"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className="w-4 h-4">
                      <path d="M3 6h18"/>
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <line x1="10" y1="11" x2="10" y2="17"/>
                      <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
