"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { Lancamento } from "@/lib/db";
import { formatarBRL } from "@/lib/format";

interface Props {
  lancamentos: Lancamento[];
  tipo: "receita" | "despesa";
}

const PALETA_RECEITA = ["#3B6D11", "#5A8E1F", "#7FB04A", "#A6C879", "#CCDEAB"];
const PALETA_DESPESA = ["#A32D2D", "#C04949", "#D87575", "#E9A1A1", "#F2C7C7"];

export default function GraficoPizza({ lancamentos, tipo }: Props) {
  const filtrados = lancamentos.filter((l) => l.tipo === tipo);
  const porCategoria = new Map<string, number>();
  for (const l of filtrados) {
    porCategoria.set(l.categoria, (porCategoria.get(l.categoria) ?? 0) + l.valor);
  }
  const dados = Array.from(porCategoria.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const paleta = tipo === "receita" ? PALETA_RECEITA : PALETA_DESPESA;
  const titulo = tipo === "receita" ? "Receitas por categoria" : "Despesas por categoria";

  if (dados.length === 0) {
    return (
      <div className="bg-white border border-marca-borda rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-marca-texto mb-2">{titulo}</h3>
        <div className="h-[180px] md:h-[280px] flex items-center justify-center text-sm text-marca-texto-suave">
          Sem dados neste mês.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-marca-borda rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-marca-texto mb-2">{titulo}</h3>

      {/* Gráfico — altura responsiva */}
      <div className="h-[180px] md:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dados}
              dataKey="value"
              nameKey="name"
              innerRadius={35}
              outerRadius={70}
              paddingAngle={2}
            >
              {dados.map((_, i) => (
                <Cell key={i} fill={paleta[i % paleta.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatarBRL(value)}
              contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda abaixo do gráfico */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 justify-center">
        {dados.map((item, i) => (
          <div key={item.name} className="flex items-center gap-1.5 text-xs text-marca-texto min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: paleta[i % paleta.length] }}
            />
            <span className="truncate max-w-[120px]">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
