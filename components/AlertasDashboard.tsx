"use client";

import { useMemo, useState } from "react";
import type { Lancamento } from "@/lib/db";
import { formatarBRL } from "@/lib/format";

interface Props {
  /** Receita operacional do mês (sem Aporte) */
  totalReceitas: number;
  totalDespesas: number;
  metaAnual: number;
  todosLancamentos: Lancamento[];
}

// ── Helper: 5 dias úteis atrás ────────────────────────────────────────────────
function cincoUteisAtras(): string {
  const d = new Date();
  let contados = 0;
  while (contados < 5) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay(); // 0 = Dom, 6 = Sáb
    if (dow !== 0 && dow !== 6) contados++;
  }
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// ── Ícone de alerta ───────────────────────────────────────────────────────────
function IconeAlerta({ cor }: { cor: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4 mt-0.5 shrink-0">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9"  x2="12"    y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
type TipoAlerta = "negativo" | "alto" | "risco" | "inativo";

interface Alerta {
  id: TipoAlerta;
  titulo: string;
  descricao: string;
}

const ESTILOS: Record<TipoAlerta, {
  wrap: string; titulo: string; desc: string; icone: string;
}> = {
  negativo: {
    wrap:   "bg-despesa-soft border-despesa/20",
    titulo: "text-despesa",
    desc:   "text-despesa/80",
    icone:  "#dc2626",
  },
  alto: {
    wrap:   "bg-[#FFF3E0] border-[#FB8C00]/25",
    titulo: "text-[#7B4F00]",
    desc:   "text-[#7B4F00]/80",
    icone:  "#F57F17",
  },
  risco: {
    wrap:   "bg-[#FFF8E1] border-[#F9A825]/30",
    titulo: "text-[#6D4C00]",
    desc:   "text-[#6D4C00]/80",
    icone:  "#F9A825",
  },
  inativo: {
    wrap:   "bg-marca-fundo border-marca-borda",
    titulo: "text-marca-texto",
    desc:   "text-marca-texto-suave",
    icone:  "#9E9E9E",
  },
};

// ─────────────────────────────────────────────────────────────────────────────

export default function AlertasDashboard({
  totalReceitas,
  totalDespesas,
  metaAnual,
  todosLancamentos,
}: Props) {
  const [fechados, setFechados] = useState<Set<string>>(new Set());

  const alertas = useMemo<Alerta[]>(() => {
    const lista: Alerta[] = [];

    // 1. Resultado negativo (despesas superam receitas operacionais)
    if (totalReceitas > 0 && totalDespesas > totalReceitas) {
      lista.push({
        id: "negativo",
        titulo: "Resultado negativo",
        descricao: `As despesas (${formatarBRL(totalDespesas)}) superam as receitas operacionais (${formatarBRL(totalReceitas)}) em ${formatarBRL(totalDespesas - totalReceitas)}.`,
      });
    }

    // 2. Despesas > 80% das receitas (ainda não negativo)
    if (
      totalReceitas > 0 &&
      totalDespesas <= totalReceitas &&
      totalDespesas / totalReceitas > 0.8
    ) {
      const pct = ((totalDespesas / totalReceitas) * 100).toFixed(0);
      lista.push({
        id: "alto",
        titulo: `Despesas em ${pct}% da receita`,
        descricao: `As despesas já consumiram ${pct}% das receitas operacionais do mês. Monitore os gastos para não entrar em déficit.`,
      });
    }

    // 3. Meta anual em risco
    if (metaAnual > 0) {
      const anoAtual = new Date().getFullYear();
      const mesAtual = new Date().getMonth() + 1; // 1–12
      const receitaAno = todosLancamentos
        .filter(
          (l) =>
            l.tipo === "receita" &&
            l.categoria !== "Aporte" &&
            !l.cancelado &&
            l.data.startsWith(String(anoAtual)),
        )
        .reduce((s, l) => s + l.valor, 0);
      // Ritmo esperado proporcional ao mês corrente
      const ritmoEsperado = (mesAtual / 12) * metaAnual;
      if (receitaAno < ritmoEsperado * 0.85) {
        const projetado = (receitaAno / mesAtual) * 12;
        lista.push({
          id: "risco",
          titulo: "Meta anual em risco",
          descricao: `Projeção de ${formatarBRL(projetado)} no ritmo atual, abaixo da meta de ${formatarBRL(metaAnual)}.`,
        });
      }
    }

    // 4. Sem lançamentos nos últimos 5 dias úteis
    if (todosLancamentos.length > 0) {
      const limite = cincoUteisAtras();
      const temRecente = todosLancamentos.some(
        (l) => !l.cancelado && l.data >= limite,
      );
      if (!temRecente) {
        lista.push({
          id: "inativo",
          titulo: "Nenhum lançamento nos últimos 5 dias úteis",
          descricao: "Verifique se há lançamentos pendentes de registro.",
        });
      }
    }

    return lista;
  }, [totalReceitas, totalDespesas, metaAnual, todosLancamentos]);

  const visiveis = alertas.filter((a) => !fechados.has(a.id));
  if (visiveis.length === 0) return null;

  function fechar(id: string) {
    setFechados((prev) => new Set([...prev, id]));
  }

  return (
    <div className="space-y-2">
      {visiveis.map((a) => {
        const s = ESTILOS[a.id];
        return (
          <div
            key={a.id}
            className={`flex items-start gap-3 border rounded-xl px-4 py-3 ${s.wrap}`}
          >
            <IconeAlerta cor={s.icone} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${s.titulo}`}>{a.titulo}</p>
              <p className={`text-xs mt-0.5 ${s.desc}`}>{a.descricao}</p>
            </div>
            <button
              type="button"
              onClick={() => fechar(a.id)}
              aria-label="Fechar alerta"
              className="shrink-0 text-marca-texto-suave/60 hover:text-marca-texto transition ml-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className="w-3.5 h-3.5">
                <line x1="18" y1="6"  x2="6"  y2="18"/>
                <line x1="6"  y1="6"  x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
