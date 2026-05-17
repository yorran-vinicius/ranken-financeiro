"use client";

import { useMemo } from "react";
import type { Lancamento } from "@/lib/db";
import { formatarBRL } from "@/lib/format";

interface Props {
  lancamentos: Lancamento[];
  metaAnual: number;
}

export default function PainelMetas({ lancamentos, metaAnual }: Props) {
  const anoAtual = new Date().getFullYear();
  const mesAtualNum = new Date().getMonth() + 1; // 1-indexed

  const { totalAno, mesesComDados } = useMemo(() => {
    let total = 0;
    const meses = new Set<string>();
    for (const l of lancamentos) {
      if (l.tipo === "receita" && l.data.startsWith(String(anoAtual))) {
        total += l.valor;
        meses.add(l.data.slice(0, 7));
      }
    }
    return { totalAno: total, mesesComDados: meses.size };
  }, [lancamentos, anoAtual]);

  const progresso = metaAnual > 0 ? Math.min(totalAno / metaAnual, 1) : 0;
  const pct = (progresso * 100).toFixed(1);

  // Meses restantes no ano (incluindo o atual)
  const mesesRestantes = 12 - mesAtualNum + 1;
  const mediaMensal = mesesComDados > 0 ? totalAno / mesesComDados : 0;
  const projecaoAnual = mediaMensal * 12;
  const vaiAtingir = projecaoAnual >= metaAnual;

  // Data estimada para bater a meta
  let dataEstimada: string | null = null;
  if (mediaMensal > 0 && totalAno < metaAnual) {
    const falta = metaAnual - totalAno;
    const mesesNecessarios = Math.ceil(falta / mediaMensal);
    const mesDestino = mesAtualNum + mesesNecessarios - 1;
    const anoDestino = anoAtual + Math.floor(mesDestino / 12);
    const mesFormatado = new Date(anoDestino, mesDestino % 12).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    dataEstimada = mesFormatado;
  }

  const metaAtingida = totalAno >= metaAnual;

  return (
    <div className="bg-white border border-marca-borda rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wide text-marca-texto-suave font-medium mb-1">
        Meta Anual {anoAtual}
      </p>

      <div className="flex items-baseline justify-between mt-1 mb-3">
        <div>
          <span className="text-2xl font-black text-marca-texto">{formatarBRL(totalAno)}</span>
          <span className="text-sm text-marca-texto-suave ml-2">de {formatarBRL(metaAnual)}</span>
        </div>
        <span
          className={`text-2xl font-black ${
            metaAtingida ? "text-receita" : Number(pct) >= 70 ? "text-yellow-500" : "text-marca-texto"
          }`}
        >
          {pct}%
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="w-full bg-marca-fundo rounded-full h-2.5 mb-4 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-700 ${
            metaAtingida
              ? "bg-receita"
              : Number(pct) >= 70
              ? "bg-yellow-400"
              : "bg-marca-preto"
          }`}
          style={{ width: `${progresso * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-marca-fundo rounded-xl p-2.5">
          <p className="text-[10px] text-marca-texto-suave uppercase tracking-wide">Média/mês</p>
          <p className="text-sm font-bold text-marca-texto mt-0.5">{formatarBRL(mediaMensal)}</p>
        </div>
        <div className="bg-marca-fundo rounded-xl p-2.5">
          <p className="text-[10px] text-marca-texto-suave uppercase tracking-wide">Projeção</p>
          <p className={`text-sm font-bold mt-0.5 ${vaiAtingir ? "text-receita" : "text-despesa"}`}>
            {formatarBRL(projecaoAnual)}
          </p>
          <p className="text-[9px] text-marca-texto-suave">{vaiAtingir ? "✓ atingível" : "✗ abaixo"}</p>
        </div>
        <div className="bg-marca-fundo rounded-xl p-2.5">
          <p className="text-[10px] text-marca-texto-suave uppercase tracking-wide">
            {metaAtingida ? "Conquistada!" : "Previsão"}
          </p>
          {metaAtingida ? (
            <p className="text-sm font-bold text-receita mt-0.5">🎉</p>
          ) : dataEstimada ? (
            <p className="text-[11px] font-semibold text-marca-texto mt-0.5 leading-tight">
              {dataEstimada}
            </p>
          ) : (
            <p className="text-sm font-bold text-marca-texto-suave mt-0.5">—</p>
          )}
        </div>
      </div>

      {!metaAtingida && mesesRestantes > 0 && mediaMensal > 0 && (
        <p className="mt-3 text-[11px] text-marca-texto-suave">
          Faltam{" "}
          <strong className="text-marca-texto">{formatarBRL(metaAnual - totalAno)}</strong> com{" "}
          {mesesRestantes} {mesesRestantes === 1 ? "mês restante" : "meses restantes"} no ano.
        </p>
      )}
    </div>
  );
}
