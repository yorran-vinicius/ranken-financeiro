import { formatarBRL } from "@/lib/format";

interface Props {
  totalReceitas: number;
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
  totalDespesas,
  receitasAnt,
  despesasAnt,
  labelMesAnt,
}: Props) {
  const saldo = totalReceitas - totalDespesas;
  const saldoPositivo = saldo >= 0;
  const saldoAnt =
    receitasAnt !== undefined && despesasAnt !== undefined
      ? receitasAnt - despesasAnt
      : undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4">
      <div className="bg-white border border-marca-borda rounded-2xl p-3 md:p-5">
        <p className="text-xs font-semibold tracking-wider uppercase text-marca-texto-suave">
          Receitas
        </p>
        <p className="mt-1.5 md:mt-2 text-2xl md:text-3xl font-bold text-receita">
          {formatarBRL(totalReceitas)}
        </p>
        <div className="mt-1">
          <VariacaoBadge
            atual={totalReceitas}
            anterior={receitasAnt}
            label={labelMesAnt}
            higherIsBetter={true}
          />
        </div>
      </div>

      <div className="bg-white border border-marca-borda rounded-2xl p-3 md:p-5">
        <p className="text-xs font-semibold tracking-wider uppercase text-marca-texto-suave">
          Despesas
        </p>
        <p className="mt-1.5 md:mt-2 text-2xl md:text-3xl font-bold text-despesa">
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

      <div className="bg-white border border-marca-borda rounded-2xl p-3 md:p-5">
        <p className="text-xs font-semibold tracking-wider uppercase text-marca-texto-suave">
          Saldo do mês
        </p>
        <p
          className={`mt-1.5 md:mt-2 text-2xl md:text-3xl font-bold ${
            saldoPositivo ? "text-receita" : "text-despesa"
          }`}
        >
          {formatarBRL(saldo)}
        </p>
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
