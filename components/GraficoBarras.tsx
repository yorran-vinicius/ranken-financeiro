"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Lancamento } from "@/lib/db";
import { formatarBRL, nomeMes } from "@/lib/format";

interface Props {
  lancamentos: Lancamento[];
  meses?: number;
}

interface PontoMes {
  rotulo: string;
  chave: string;
  receitas: number;
  despesas: number;
}

function ultimosMeses(qtd: number): { chave: string; rotulo: string }[] {
  const hoje = new Date();
  const pontos: { chave: string; rotulo: string }[] = [];
  for (let i = qtd - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const chave = `${d.getFullYear()}-${mes}`;
    const rotulo = nomeMes(d.getMonth() + 1).slice(0, 3);
    pontos.push({ chave, rotulo });
  }
  return pontos;
}

export default function GraficoBarras({ lancamentos, meses = 6 }: Props) {
  const pontos = ultimosMeses(meses);
  const mapa = new Map<string, PontoMes>();
  for (const p of pontos) {
    mapa.set(p.chave, { rotulo: p.rotulo, chave: p.chave, receitas: 0, despesas: 0 });
  }

  for (const l of lancamentos) {
    const chave = l.data.slice(0, 7);
    const ponto = mapa.get(chave);
    if (!ponto) continue;
    if (l.tipo === "receita") ponto.receitas += l.valor;
    else ponto.despesas += l.valor;
  }

  const dados = pontos.map((p) => mapa.get(p.chave)!);

  // Filtra meses sem nenhum dado para não mostrar barras zeradas
  const dadosFiltrados = dados.filter((d) => d.receitas > 0 || d.despesas > 0);

  return (
    <div className="bg-white border border-marca-borda rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-marca-texto mb-2">
        Evolução mensal — últimos {meses} meses
      </h3>
      {dadosFiltrados.length < 2 ? (
        <div className="h-48 flex flex-col items-center justify-center gap-1.5 text-marca-texto-suave">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="w-8 h-8 opacity-40">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6"  y1="20" x2="6"  y2="14"/>
          </svg>
          <span className="text-sm">Dados insuficientes para o gráfico</span>
          <span className="text-xs opacity-70">Aparecerá após 2 meses de registros</span>
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dadosFiltrados} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
              <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} stroke="#737373" />
              <YAxis
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
                }
                tick={{ fontSize: 12 }}
                stroke="#737373"
              />
              <Tooltip
                formatter={(value: number) => formatarBRL(value)}
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="receitas" name="Receitas" fill="#3B6D11" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" name="Despesas" fill="#A32D2D" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
