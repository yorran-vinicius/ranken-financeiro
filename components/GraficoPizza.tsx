"use client";

import {
  Cell,
  Legend,
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
        <div className="h-48 flex items-center justify-center text-sm text-marca-texto-suave">
          Sem dados neste mês.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-marca-borda rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-marca-texto mb-2">{titulo}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dados}
              dataKey="value"
              nameKey="name"
              innerRadius={45}
              outerRadius={80}
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
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{ fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
