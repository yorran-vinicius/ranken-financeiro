"use client";

import type { Lancamento } from "@/lib/db";
import { formatarBRL, formatarData } from "@/lib/format";

interface Props {
  lancamentos: Lancamento[];
  onRemover: (id: string) => void;
  carregando?: boolean;
}

export default function ListaLancamentos({ lancamentos, onRemover, carregando }: Props) {
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
      <div className="hidden md:grid md:grid-cols-[120px_1fr_180px_140px_60px] gap-3 px-5 py-3 bg-marca-fundo text-xs font-medium uppercase tracking-wide text-marca-texto-suave">
        <span>Data</span>
        <span>Descrição</span>
        <span>Categoria</span>
        <span className="text-right">Valor</span>
        <span />
      </div>

      <ul className="divide-y divide-marca-borda">
        {lancamentos.map((l) => {
          const isReceita = l.tipo === "receita";
          return (
            <li
              key={l.id}
              className="px-5 py-4 grid grid-cols-[1fr_auto] md:grid-cols-[120px_1fr_180px_140px_60px] gap-3 items-center"
            >
              <div className="md:contents">
                <span className="text-sm text-marca-texto-suave">{formatarData(l.data)}</span>
                <div className="text-sm text-marca-texto font-medium md:font-normal">
                  {l.descricao}
                  <span
                    className={`md:hidden ml-2 inline-block text-[10px] uppercase font-semibold tracking-wide px-1.5 py-0.5 rounded ${
                      isReceita
                        ? "bg-receita-soft text-receita"
                        : "bg-despesa-soft text-despesa"
                    }`}
                  >
                    {isReceita ? "Receita" : "Despesa"}
                  </span>
                  <span className="block md:hidden text-xs text-marca-texto-suave mt-0.5">
                    {l.categoria}
                  </span>
                </div>
                <span className="hidden md:inline text-sm text-marca-texto-suave">
                  <span
                    className={`mr-2 inline-block w-2 h-2 rounded-full ${
                      isReceita ? "bg-receita" : "bg-despesa"
                    }`}
                  />
                  {l.categoria}
                </span>
                <span
                  className={`text-sm font-semibold text-right ${
                    isReceita ? "text-receita" : "text-despesa"
                  }`}
                >
                  {isReceita ? "+" : "−"} {formatarBRL(l.valor)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRemover(l.id)}
                aria-label="Remover lançamento"
                className="text-marca-texto-suave hover:text-despesa transition p-1 rounded justify-self-end"
                title="Remover"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
