"use client";

import { useMemo } from "react";
import type { Lancamento } from "@/lib/db";
import { formatarBRL } from "@/lib/format";

interface Props {
  lancamentos: Lancamento[];
  custoFixo: number;
}

export default function PontoEquilibrio({ lancamentos, custoFixo }: Props) {
  const { receita, despesa } = useMemo(() => {
    let r = 0;
    let d = 0;
    for (const l of lancamentos) {
      if (l.tipo === "receita") r += l.valor;
      else d += l.valor;
    }
    return { receita: r, despesa: d };
  }, [lancamentos]);

  const positivo = receita >= custoFixo;
  const pct = custoFixo > 0 ? Math.min((receita / custoFixo) * 100, 100) : 100;
  const falta = Math.max(0, custoFixo - receita);
  const excesso = Math.max(0, receita - custoFixo);

  return (
    <div className="bg-white border border-marca-borda rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-wide text-marca-texto-suave font-medium">
          Ponto de Equilíbrio
        </p>
        <span
          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
            positivo
              ? "bg-receita-soft text-receita"
              : "bg-despesa-soft text-despesa"
          }`}
        >
          {positivo ? "✓ Positivo" : "✗ Negativo"}
        </span>
      </div>

      <div className="space-y-2 text-sm mb-3">
        <div className="flex justify-between items-center">
          <span className="text-marca-texto-suave">Receita do mês</span>
          <span className="font-bold text-receita">{formatarBRL(receita)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-marca-texto-suave">Custo fixo</span>
          <span className="font-semibold text-marca-texto">{formatarBRL(custoFixo)}</span>
        </div>
        {despesa > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-marca-texto-suave">Despesas totais</span>
            <span className="font-semibold text-despesa">{formatarBRL(despesa)}</span>
          </div>
        )}
      </div>

      {/* Barra */}
      <div className="w-full bg-marca-fundo rounded-full h-2 mb-1.5 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${
            positivo ? "bg-receita" : "bg-despesa"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-marca-texto-suave mb-3">
        {pct.toFixed(0)}% do custo fixo coberto pela receita
      </p>

      <div
        className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
          positivo ? "bg-receita-soft text-receita" : "bg-despesa-soft text-despesa"
        }`}
      >
        {positivo ? (
          <>Excedente de <strong>{formatarBRL(excesso)}</strong> acima do custo fixo</>
        ) : (
          <>Faltam <strong>{formatarBRL(falta)}</strong> para cobrir os custos</>
        )}
      </div>
    </div>
  );
}
