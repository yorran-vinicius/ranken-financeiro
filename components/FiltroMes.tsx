"use client";

import { useMemo } from "react";
import { rotuloMesAno } from "@/lib/format";

interface Props {
  valor: string;
  onChange: (v: string) => void;
  mesInicial?: string;
}

function gerarOpcoes(mesInicial: string): string[] {
  const [aIni, mIni] = mesInicial.split("-").map(Number);
  const inicio = new Date(aIni, mIni - 1, 1);
  const hoje = new Date();
  let cursor = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const opcoes: string[] = [];
  while (cursor >= inicio) {
    const mes = String(cursor.getMonth() + 1).padStart(2, "0");
    opcoes.push(`${cursor.getFullYear()}-${mes}`);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
  }
  return opcoes;
}

export default function FiltroMes({ valor, onChange, mesInicial = "2026-01" }: Props) {
  const opcoes = useMemo(() => gerarOpcoes(mesInicial), [mesInicial]);
  const opcoesFinais = opcoes.includes(valor) ? opcoes : [valor, ...opcoes];

  return (
    <label className="inline-flex items-center gap-2">
      <span className="text-xs font-medium text-marca-texto-suave">Mês</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1.5 rounded-lg border border-marca-borda bg-white text-sm focus:outline-none focus:ring-2 focus:ring-marca-preto"
      >
        {opcoesFinais.map((m) => (
          <option key={m} value={m}>
            {rotuloMesAno(m)}
          </option>
        ))}
      </select>
    </label>
  );
}
