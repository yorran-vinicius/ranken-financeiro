"use client";

import { formatarBRL } from "@/lib/format";
import type { Lancamento } from "@/lib/db";

interface Props {
  totalReceitas: number;
  totalDespesas: number;
  custoFixo: number;
  receitasAnt: number;
  despesasAnt: number;
  labelMesAnt: string;
  lancamentosHoje: Lancamento[];
  /** false = oculta a "Linha Hoje". Default: true */
  mostrarHoje?: boolean;
  /** Meta anual de receita operacional (para calcular saúde) */
  metaAnual?: number;
  /** Receita operacional acumulada no ano (para calcular saúde) */
  receitaAcumuladaAno?: number;
}

// ── Saúde financeira ponderada ────────────────────────────────────────────────

interface Saude {
  label: string;
  circulo: string; // classe Tailwind
}

function calcularSaude(
  receita: number,
  despesa: number,
  metaAnual: number,
  receitaAcumulada: number,
): Saude {
  const saldo = receita - despesa;
  const mesAtual = new Date().getMonth() + 1; // 1–12
  const percentualMeta         = metaAnual > 0 ? (receitaAcumulada / metaAnual) * 100 : 100;
  const percentualEsperadoMeta = (mesAtual / 12) * 100;
  const desvioMeta             = percentualMeta - percentualEsperadoMeta;

  // 🔴 Negativo + muito atrás da meta
  if (saldo < 0 && desvioMeta < -20)
    return { label: "Atenção necessária", circulo: "bg-despesa" };

  // 🟡 Saldo negativo mas meta razoável
  if (saldo < 0)
    return { label: "Resultado negativo", circulo: "bg-yellow-400" };

  // 🟡 Positivo mas meta atrasada
  if (saldo > 0 && desvioMeta < -15)
    return { label: "Crescendo", circulo: "bg-yellow-400" };

  // 🟢 Positivo e meta em dia
  if (saldo > 0 && desvioMeta >= -5)
    return { label: "Excelente", circulo: "bg-receita" };

  // 🟢 Estável
  return { label: "Estável", circulo: "bg-receita" };
}

// ── Helpers de data ───────────────────────────────────────────────────────────

function formatarDataExtenso(dataISO: string): string {
  const MESES = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-");
  return `${Number(dia)} de ${MESES[Number(mes) - 1]} de ${ano}`;
}

function hojeISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function InsightsDashboard({
  totalReceitas,
  totalDespesas,
  custoFixo,
  receitasAnt,
  despesasAnt,
  labelMesAnt,
  lancamentosHoje,
  mostrarHoje = true,
  metaAnual = 0,
  receitaAcumuladaAno = 0,
}: Props) {
  // ── Saúde financeira ──────────────────────────────────────────────────────
  // Se metaAnual não foi fornecida, fallback para lógica legada baseada no custoFixo
  const saude: Saude = metaAnual > 0
    ? calcularSaude(totalReceitas, totalDespesas, metaAnual, receitaAcumuladaAno)
    : (() => {
        if (totalReceitas >= custoFixo * 1.2) return { label: "Excelente",  circulo: "bg-receita"    };
        if (totalReceitas >= custoFixo)        return { label: "Atenção",    circulo: "bg-yellow-400" };
        return                                        { label: "Crítica",    circulo: "bg-despesa"    };
      })();

  // ── Frase interpretativa ──────────────────────────────────────────────────
  const diffReceitas = totalReceitas - receitasAnt;
  let fraseReceita: React.ReactNode = null;

  if (diffReceitas > 0) {
    fraseReceita = (
      <span className="text-receita">
        Receitas +{formatarBRL(diffReceitas)} em relação a {labelMesAnt}
      </span>
    );
  } else if (diffReceitas < 0) {
    fraseReceita = (
      <span className="text-despesa">
        Receitas {formatarBRL(Math.abs(diffReceitas))} abaixo de {labelMesAnt}
      </span>
    );
  }

  const faltaCusto =
    custoFixo > 0 && totalReceitas < custoFixo ? (
      <span className="text-despesa">
        {" · "}Faltam {formatarBRL(custoFixo - totalReceitas)} para cobrir o custo fixo
      </span>
    ) : null;

  // ── Hoje ──────────────────────────────────────────────────────────────────
  const hoje = hojeISO();
  const entradasHoje = lancamentosHoje
    .filter((l) => l.tipo === "receita")
    .reduce((s, l) => s + l.valor, 0);
  const saidasHoje = lancamentosHoje
    .filter((l) => l.tipo === "despesa")
    .reduce((s, l) => s + l.valor, 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Indicador de saúde financeira */}
      <div className="bg-white border border-marca-borda rounded-2xl px-5 py-4 flex items-start gap-2">
        <span className={`w-3 h-3 rounded-full shrink-0 mt-[3px] ${saude.circulo}`} />
        <div className="flex-1 min-w-0 text-sm">
          <span className="font-semibold text-marca-texto">
            Saúde financeira: {saude.label}
          </span>
          {(fraseReceita || faltaCusto) && (
            <p className="text-marca-texto-suave mt-0.5 leading-snug">
              {fraseReceita}
              {faltaCusto}
            </p>
          )}
        </div>
      </div>

      {/* Linha Hoje */}
      {mostrarHoje && lancamentosHoje.length > 0 && (
        <div className="bg-white border border-marca-borda rounded-xl px-5 py-3 flex flex-wrap items-center gap-4 text-sm">
          <span className="font-medium text-marca-texto">
            Hoje, {formatarDataExtenso(hoje)}
          </span>
          <span className="text-marca-texto-suave hidden sm:inline">|</span>
          <span>
            Entradas:{" "}
            <span className="font-semibold text-receita">{formatarBRL(entradasHoje)}</span>
          </span>
          <span className="text-marca-texto-suave hidden sm:inline">|</span>
          <span>
            Saídas:{" "}
            <span className="font-semibold text-despesa">{formatarBRL(saidasHoje)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
