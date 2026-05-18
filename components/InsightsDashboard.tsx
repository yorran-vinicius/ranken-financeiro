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
}

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

export default function InsightsDashboard({
  totalReceitas,
  totalDespesas,
  custoFixo,
  receitasAnt,
  despesasAnt,
  labelMesAnt,
  lancamentosHoje,
}: Props) {
  // ── Saúde financeira ──────────────────────────────────────────────────────
  let saudeCirculo: string;
  let saudeTexto: string;

  if (totalReceitas >= custoFixo * 1.2) {
    saudeCirculo = "bg-receita";
    saudeTexto = "Saúde financeira: Excelente";
  } else if (totalReceitas >= custoFixo) {
    saudeCirculo = "bg-yellow-400";
    saudeTexto = "Saúde financeira: Atenção";
  } else {
    saudeCirculo = "bg-despesa";
    saudeTexto = "Saúde financeira: Crítica";
  }

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
    totalReceitas < custoFixo ? (
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
      <div className="bg-white border border-marca-borda rounded-2xl px-5 py-4 flex items-center gap-4">
        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${saudeCirculo}`} />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-semibold text-marca-texto">{saudeTexto}</span>
          {(fraseReceita || faltaCusto) && (
            <span className="text-marca-texto-suave">
              {fraseReceita}
              {faltaCusto}
            </span>
          )}
        </div>
      </div>

      {/* Linha Hoje */}
      {lancamentosHoje.length > 0 && (
        <div className="bg-white border border-marca-borda rounded-xl px-5 py-3 flex flex-wrap items-center gap-4 text-sm">
          <span className="font-medium text-marca-texto">
            Hoje, {formatarDataExtenso(hoje)}
          </span>
          <span className="text-marca-texto-suave hidden sm:inline">|</span>
          <span>
            Entradas:{" "}
            <span className="font-semibold text-receita">
              {formatarBRL(entradasHoje)}
            </span>
          </span>
          <span className="text-marca-texto-suave hidden sm:inline">|</span>
          <span>
            Saídas:{" "}
            <span className="font-semibold text-despesa">
              {formatarBRL(saidasHoje)}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
