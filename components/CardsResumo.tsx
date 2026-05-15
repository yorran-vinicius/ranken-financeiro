import { formatarBRL } from "@/lib/format";

interface Props {
  totalReceitas: number;
  totalDespesas: number;
}

export default function CardsResumo({ totalReceitas, totalDespesas }: Props) {
  const saldo = totalReceitas - totalDespesas;
  const saldoPositivo = saldo >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white border border-marca-borda rounded-2xl p-5">
        <p className="text-xs uppercase tracking-wide text-marca-texto-suave font-medium">
          Receitas
        </p>
        <p className="mt-2 text-2xl md:text-3xl font-bold text-receita">
          {formatarBRL(totalReceitas)}
        </p>
      </div>

      <div className="bg-white border border-marca-borda rounded-2xl p-5">
        <p className="text-xs uppercase tracking-wide text-marca-texto-suave font-medium">
          Despesas
        </p>
        <p className="mt-2 text-2xl md:text-3xl font-bold text-despesa">
          {formatarBRL(totalDespesas)}
        </p>
      </div>

      <div className="bg-white border border-marca-borda rounded-2xl p-5">
        <p className="text-xs uppercase tracking-wide text-marca-texto-suave font-medium">
          Saldo do mês
        </p>
        <p
          className={`mt-2 text-2xl md:text-3xl font-bold ${
            saldoPositivo ? "text-receita" : "text-despesa"
          }`}
        >
          {formatarBRL(saldo)}
        </p>
      </div>
    </div>
  );
}
