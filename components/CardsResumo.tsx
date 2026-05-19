import { formatarBRL } from "@/lib/format";

interface Props {
  /** Receita operacional — exclui aportes */
  totalReceitas: number;
  /** Aportes recebidos no mês (opcional) */
  totalAportes?: number;
  totalDespesas: number;
  receitasAnt?: number;
  despesasAnt?: number;
  labelMesAnt?: string;
}

function calcVariacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

interface BadgeProps {
  atual: number;
  anterior: number | undefined;
  label: string | undefined;
  /** true = higher is better (receitas, saldo); false = lower is better (despesas) */
  higherIsBetter: boolean;
}

function VariacaoBadge({ atual, anterior, label, higherIsBetter }: BadgeProps) {
  if (anterior === undefined || label === undefined) return null;

  const pct = calcVariacao(atual, anterior);
  if (pct === null) return null;

  const isUp = pct >= 0;
  const isGood = higherIsBetter ? isUp : !isUp;
  const colorClass = isGood ? "text-receita" : "text-despesa";
  const arrow = isUp ? "▲" : "▼";
  const absPct = Math.abs(pct).toFixed(1);

  return (
    <span className={`text-xs font-medium ${colorClass}`}>
      {arrow} {absPct}% vs {label}
    </span>
  );
}

export default function CardsResumo({
  totalReceitas,
  totalAportes = 0,
  totalDespesas,
  receitasAnt,
  despesasAnt,
  labelMesAnt,
}: Props) {
  // Saldo operacional = receita operacional − despesas (aportes não entram)
  const saldo         = totalReceitas - totalDespesas;
  const saldoPositivo = saldo >= 0;
  // Caixa total inclui aportes — usado apenas para a nota explicativa
  const caixaComAportes = saldo + totalAportes;
  const saldoAnt =
    receitasAnt !== undefined && despesasAnt !== undefined
      ? receitasAnt - despesasAnt
      : undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4">
      {/* ── Receita Operacional ── */}
      <div className="bg-white border border-marca-borda rounded-2xl p-3">
        <p className="text-xs font-semibold tracking-widest text-gray-500">
          Receitas
        </p>
        <p className="mt-1 text-xl font-bold text-receita">
          {formatarBRL(totalReceitas)}
        </p>
        {totalAportes > 0 && (
          <p className="text-xs text-marca-texto-suave mt-0.5">
            + {formatarBRL(totalAportes)} de aportes
          </p>
        )}
        <div className="mt-1">
          <VariacaoBadge
            atual={totalReceitas}
            anterior={receitasAnt}
            label={labelMesAnt}
            higherIsBetter={true}
          />
        </div>
      </div>

      {/* ── Despesas ── */}
      <div className="bg-white border border-marca-borda rounded-2xl p-3">
        <p className="text-xs font-semibold tracking-widest text-gray-500">
          Despesas
        </p>
        <p className="mt-1 text-xl font-bold text-despesa">
          {formatarBRL(totalDespesas)}
        </p>
        <div className="mt-1">
          <VariacaoBadge
            atual={totalDespesas}
            anterior={despesasAnt}
            label={labelMesAnt}
            higherIsBetter={false}
          />
        </div>
      </div>

      {/* ── Saldo do mês ── */}
      <div className="bg-white border border-marca-borda rounded-2xl p-3">
        <p className="text-xs font-semibold tracking-widest text-gray-500">
          Saldo do mês
        </p>
        <p
          className={`mt-1 text-xl font-bold ${
            saldoPositivo ? "text-receita" : "text-despesa"
          }`}
        >
          {formatarBRL(saldo)}
        </p>
        {/* Nota: saldo negativo mas caixa positivo com aportes */}
        {!saldoPositivo && totalAportes > 0 && caixaComAportes > 0 && (
          <p className="text-xs text-gray-500 mt-1 leading-snug">
            💡 Caixa disponível positivo com aportes dos sócios (+{formatarBRL(totalAportes)})
          </p>
        )}
        <div className="mt-1">
          <VariacaoBadge
            atual={saldo}
            anterior={saldoAnt}
            label={labelMesAnt}
            higherIsBetter={true}
          />
        </div>
      </div>
    </div>
  );
}
