"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CATEGORIAS_DESPESA,
  CATEGORIAS_RECEITA,
  type TipoLancamento,
} from "@/lib/categorias";
import type { Lancamento } from "@/lib/db";
import { formatarBRL, formatarData, nomeMes } from "@/lib/format";

const PERIODOS = [
  { valor: 1, rotulo: "Último mês" },
  { valor: 3, rotulo: "Últimos 3 meses" },
  { valor: 6, rotulo: "Últimos 6 meses" },
  { valor: 12, rotulo: "Últimos 12 meses" },
] as const;

interface PontoMes {
  chave: string;
  rotulo: string;
  valor: number;
}

function ultimosNMeses(n: number): PontoMes[] {
  const hoje = new Date();
  const pontos: PontoMes[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const chave = `${d.getFullYear()}-${mes}`;
    const sufixo = n > 6 ? `/${String(d.getFullYear()).slice(-2)}` : "";
    const rotulo = `${nomeMes(d.getMonth() + 1).slice(0, 3)}${sufixo}`;
    pontos.push({ chave, rotulo, valor: 0 });
  }
  return pontos;
}

interface Props {
  refreshKey?: number;
}

export default function AnaliseCategoria({ refreshKey = 0 }: Props) {
  const [tipo, setTipo] = useState<TipoLancamento>("despesa");
  const categorias = useMemo(
    () => (tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA),
    [tipo]
  );
  const [categoria, setCategoria] = useState<string>(categorias[0]);
  const [meses, setMeses] = useState<number>(6);
  const [todos, setTodos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    fetch(`/api/lancamentos`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelado) setTodos(Array.isArray(data) ? data : []);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [refreshKey]);

  function trocarTipo(novo: TipoLancamento) {
    setTipo(novo);
    const lista = novo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
    setCategoria(lista[0]);
  }

  const { pontos, lancamentosFiltrados, total, media, maior, menor } = useMemo(() => {
    const pontosBase = ultimosNMeses(meses);
    const chavesPeriodo = new Set(pontosBase.map((p) => p.chave));

    const lancFiltrados = todos
      .filter((l) => l.tipo === tipo && l.categoria === categoria)
      .filter((l) => chavesPeriodo.has(l.data.slice(0, 7)))
      .sort(
        (a, b) =>
          b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)
      );

    const mapa = new Map<string, number>();
    for (const p of pontosBase) mapa.set(p.chave, 0);
    for (const l of lancFiltrados) {
      const chave = l.data.slice(0, 7);
      mapa.set(chave, (mapa.get(chave) ?? 0) + l.valor);
    }
    const pontosFinal = pontosBase.map((p) => ({
      ...p,
      valor: mapa.get(p.chave) ?? 0,
    }));

    const totalCalc = pontosFinal.reduce((acc, p) => acc + p.valor, 0);
    const mediaCalc = totalCalc / meses;

    let maiorCalc: PontoMes | null = null;
    let menorCalc: PontoMes | null = null;
    for (const p of pontosFinal) {
      if (p.valor > 0) {
        if (!maiorCalc || p.valor > maiorCalc.valor) maiorCalc = p;
        if (!menorCalc || p.valor < menorCalc.valor) menorCalc = p;
      }
    }

    return {
      pontos: pontosFinal,
      lancamentosFiltrados: lancFiltrados,
      total: totalCalc,
      media: mediaCalc,
      maior: maiorCalc,
      menor: menorCalc,
    };
  }, [todos, tipo, categoria, meses]);

  const corBarra = tipo === "receita" ? "#3B6D11" : "#A32D2D";
  const corTexto = tipo === "receita" ? "text-receita" : "text-despesa";
  const algumValor = pontos.some((p) => p.valor > 0);

  return (
    <section className="bg-white border border-marca-borda rounded-2xl p-5 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-marca-texto">
          Análise por categoria
        </h2>
        <p className="text-xs text-marca-texto-suave">
          Acompanhe como uma categoria evoluiu ao longo do tempo.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-marca-texto-suave">Tipo</span>
          <select
            value={tipo}
            onChange={(e) => trocarTipo(e.target.value as TipoLancamento)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-marca-borda bg-white focus:outline-none focus:ring-2 focus:ring-marca-preto"
          >
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-marca-texto-suave">Categoria</span>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-marca-borda bg-white focus:outline-none focus:ring-2 focus:ring-marca-preto"
          >
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-marca-texto-suave">Período</span>
          <select
            value={meses}
            onChange={(e) => setMeses(Number(e.target.value))}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-marca-borda bg-white focus:outline-none focus:ring-2 focus:ring-marca-preto"
          >
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CardResumo
          titulo="Total no período"
          valor={formatarBRL(total)}
          realce={corTexto}
        />
        <CardResumo titulo="Média mensal" valor={formatarBRL(media)} />
        <CardResumo
          titulo="Maior mês"
          valor={maior ? formatarBRL(maior.valor) : "—"}
          sub={maior?.rotulo}
        />
        <CardResumo
          titulo="Menor mês"
          valor={menor ? formatarBRL(menor.valor) : "—"}
          sub={menor?.rotulo}
        />
      </div>

      <div>
        <div className="h-72">
          {algumValor ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pontos}
                margin={{ top: 28, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                <XAxis
                  dataKey="rotulo"
                  tick={{ fontSize: 12 }}
                  stroke="#737373"
                />
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
                <Bar
                  dataKey="valor"
                  name={categoria}
                  fill={corBarra}
                  radius={[4, 4, 0, 0]}
                >
                  <LabelList
                    dataKey="valor"
                    position="top"
                    formatter={(v: number) => (v > 0 ? formatarBRL(v) : "")}
                    style={{ fontSize: 11, fill: "#525252", fontWeight: 500 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-marca-texto-suave border border-dashed border-marca-borda rounded-lg">
              {carregando
                ? "Carregando..."
                : "Sem lançamentos nessa categoria no período."}
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-marca-texto mb-2">
          Lançamentos detalhados
        </h3>
        <div className="overflow-x-auto border border-marca-borda rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-marca-fundo text-marca-texto-suave">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide w-32">
                  Data
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide">
                  Descrição
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide w-40">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-marca-borda">
              {lancamentosFiltrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-6 text-center text-marca-texto-suave"
                  >
                    Nenhum lançamento.
                  </td>
                </tr>
              ) : (
                lancamentosFiltrados.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 text-marca-texto-suave whitespace-nowrap">
                      {formatarData(l.data)}
                    </td>
                    <td className="px-3 py-2 text-marca-texto">{l.descricao}</td>
                    <td
                      className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${corTexto}`}
                    >
                      {formatarBRL(l.valor)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {lancamentosFiltrados.length > 0 && (
              <tfoot className="bg-marca-fundo">
                <tr>
                  <td
                    colSpan={2}
                    className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-marca-texto-suave"
                  >
                    Total
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-bold whitespace-nowrap ${corTexto}`}
                  >
                    {formatarBRL(total)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </section>
  );
}

interface CardProps {
  titulo: string;
  valor: string;
  sub?: string;
  realce?: string;
}

function CardResumo({ titulo, valor, sub, realce }: CardProps) {
  return (
    <div className="bg-marca-fundo border border-marca-borda rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wide text-marca-texto-suave font-medium">
        {titulo}
      </p>
      <p
        className={`mt-1 text-base md:text-lg font-bold ${
          realce ?? "text-marca-texto"
        }`}
      >
        {valor}
      </p>
      {sub && <p className="text-[11px] text-marca-texto-suave mt-0.5">{sub}</p>}
    </div>
  );
}
