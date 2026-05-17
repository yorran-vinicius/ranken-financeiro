"use client";

import { useEffect, useMemo, useState } from "react";
import type { TipoLancamento } from "@/lib/categorias";
import { hojeISO } from "@/lib/format";
import type { TipoLancamentoExtendido, Frequencia, CategoriaDB } from "@/lib/db";

interface Props {
  onAdicionado?: () => void;
  cidades?: string[]; // se não-vazio, exibe o campo cidade
}

const TIPOS_LANCAMENTO: { valor: TipoLancamentoExtendido; rotulo: string }[] = [
  { valor: "avulso",     rotulo: "Avulso"     },
  { valor: "recorrente", rotulo: "Recorrente" },
  { valor: "parcelado",  rotulo: "Parcelado"  },
];

const FREQUENCIAS: { valor: Frequencia; rotulo: string }[] = [
  { valor: "mensal",  rotulo: "Mensal"  },
  { valor: "semanal", rotulo: "Semanal" },
  { valor: "anual",   rotulo: "Anual"   },
];

export default function NovoLancamento({ onAdicionado, cidades = [] }: Props) {
  const [tipoLancamento, setTipoLancamento] = useState<TipoLancamentoExtendido>("avulso");
  const [tipo, setTipo] = useState<TipoLancamento>("receita");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<string>("");
  const [todasCategorias, setTodasCategorias] = useState<CategoriaDB[]>([]);

  useEffect(() => {
    fetch("/api/configuracoes/categorias")
      .then((r) => r.json())
      .then((data: CategoriaDB[]) => {
        setTodasCategorias(data);
        const primeiro = data.find((c) => c.tipo === "receita" && c.ativo);
        if (primeiro) setCategoria(primeiro.nome);
      })
      .catch(() => {});
  }, []);

  // Avulso
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());

  // Recorrente
  const [frequencia, setFrequencia] = useState<Frequencia>("mensal");
  const [dataInicio, setDataInicio] = useState(hojeISO());
  const [dataFim, setDataFim] = useState("");

  // Parcelado
  const [totalParcelas, setTotalParcelas] = useState("12");
  const [modoParcela, setModoParcela] = useState<"por_parcela" | "total">("por_parcela");
  const [valorParcela, setValorParcela] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [dataPrimeira, setDataPrimeira] = useState(hojeISO());

  const [cidade, setCidade] = useState<string>("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const categorias = useMemo(
    () => todasCategorias.filter((c) => c.tipo === tipo && c.ativo).map((c) => c.nome),
    [todasCategorias, tipo]
  );

  function trocarTipo(novo: TipoLancamento) {
    setTipo(novo);
    const primeiro = todasCategorias.find((c) => c.tipo === novo && c.ativo);
    setCategoria(primeiro?.nome ?? "");
  }

  function trocarTipoLancamento(novo: TipoLancamentoExtendido) {
    setTipoLancamento(novo);
    setErro(null);
  }

  // Cálculo automático de valores no parcelado
  const parcelasNum = Math.max(2, Number(totalParcelas) || 2);
  const valorParcelaNum = modoParcela === "por_parcela"
    ? Number(valorParcela.replace(/\./g, "").replace(",", "."))
    : Number(valorTotal.replace(/\./g, "").replace(",", ".")) / parcelasNum;
  const valorTotalNum = modoParcela === "por_parcela"
    ? valorParcelaNum * parcelasNum
    : Number(valorTotal.replace(/\./g, "").replace(",", "."));
  const parcelaDisplay = Number.isFinite(valorParcelaNum) && valorParcelaNum > 0
    ? valorParcelaNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : null;
  const totalDisplay = Number.isFinite(valorTotalNum) && valorTotalNum > 0
    ? valorTotalNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    let bodyObj: Record<string, unknown> = {
      tipoLancamento,
      descricao: descricao.trim(),
      tipo,
      categoria,
      ...(cidades.length > 0 && cidade ? { cidade } : {}),
    };

    if (tipoLancamento === "avulso") {
      const v = Number(valor.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) { setErro("Valor deve ser maior que zero."); return; }
      if (!data) { setErro("Data obrigatória."); return; }
      bodyObj = { ...bodyObj, valor: Math.round(v * 100) / 100, data };
    }

    if (tipoLancamento === "recorrente") {
      const v = Number(valor.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) { setErro("Valor deve ser maior que zero."); return; }
      if (!dataInicio) { setErro("Data de início obrigatória."); return; }
      if (dataFim && dataFim <= dataInicio) { setErro("Data de término deve ser após a data de início."); return; }
      bodyObj = {
        ...bodyObj,
        valor: Math.round(v * 100) / 100,
        frequencia,
        dataInicio,
        dataFim: dataFim || null,
      };
    }

    if (tipoLancamento === "parcelado") {
      if (parcelasNum < 2) { setErro("Mínimo 2 parcelas."); return; }
      if (!Number.isFinite(valorParcelaNum) || valorParcelaNum <= 0) {
        setErro("Valor inválido."); return;
      }
      if (!dataPrimeira) { setErro("Data da primeira parcela obrigatória."); return; }
      bodyObj = {
        ...bodyObj,
        totalParcelas: parcelasNum,
        valorParcela: Math.round(valorParcelaNum * 100) / 100,
        valorTotal: Math.round(valorTotalNum * 100) / 100,
        dataPrimeira,
      };
    }

    setEnviando(true);
    try {
      const resp = await fetch("/api/lancamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.erro ?? "Falha ao salvar");
      }
      // Reset
      setDescricao(""); setValor(""); setValorParcela(""); setValorTotal(""); setCidade("");
      setData(hojeISO()); setDataInicio(hojeISO()); setDataFim(""); setDataPrimeira(hojeISO());
      setTotalParcelas("12");
      onAdicionado?.();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setEnviando(false);
    }
  }

  const inputCls = "mt-1 w-full px-3 py-2 rounded-lg border border-marca-borda bg-white focus:outline-none focus:ring-2 focus:ring-marca-preto text-sm";
  const labelCls = "text-xs font-medium text-marca-texto-suave";

  return (
    <form onSubmit={enviar} className="bg-white border border-marca-borda rounded-2xl p-5 space-y-4">
      <h2 className="text-lg font-bold text-marca-texto">Novo lançamento</h2>

      {/* Tipo de lançamento */}
      <div>
        <span className={labelCls}>Tipo de lançamento</span>
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          {TIPOS_LANCAMENTO.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => trocarTipoLancamento(t.valor)}
              className={`py-1.5 rounded-lg text-xs font-semibold border transition ${
                tipoLancamento === t.valor
                  ? "bg-marca-preto text-white border-marca-preto"
                  : "bg-white text-marca-texto-suave border-marca-borda hover:bg-marca-fundo"
              }`}
            >
              {t.rotulo}
            </button>
          ))}
        </div>
      </div>

      {/* Receita / Despesa */}
      <div className="grid grid-cols-2 gap-2">
        {(["receita", "despesa"] as TipoLancamento[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => trocarTipo(t)}
            className={`py-2 rounded-lg text-sm font-medium border transition capitalize ${
              tipo === t
                ? t === "receita"
                  ? "bg-receita text-white border-receita hover:opacity-90"
                  : "bg-despesa text-white border-despesa hover:opacity-90"
                : "bg-white text-marca-texto-suave border-marca-borda hover:bg-marca-fundo"
            }`}
          >
            {t === "receita" ? "Receita" : "Despesa"}
          </button>
        ))}
      </div>

      {/* Campos comuns */}
      <div className="space-y-3">
        <label className="block">
          <span className={labelCls}>Descrição</span>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={tipoLancamento === "parcelado" ? "Ex: Notebook Dell" : "Ex: Mensalidade de Maio"}
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Categoria</span>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className={inputCls}
          >
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        {cidades.length > 0 && (
          <label className="block">
            <span className={labelCls}>Cidade</span>
            <select value={cidade} onChange={(e) => setCidade(e.target.value)} className={inputCls}>
              <option value="">— Selecionar —</option>
              {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
      </div>

      {/* ── AVULSO ── */}
      {tipoLancamento === "avulso" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Valor (R$)</span>
            <input type="text" inputMode="decimal" value={valor}
              onChange={(e) => setValor(e.target.value)} placeholder="0,00" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Data</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} />
          </label>
        </div>
      )}

      {/* ── RECORRENTE ── */}
      {tipoLancamento === "recorrente" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Valor (R$)</span>
              <input type="text" inputMode="decimal" value={valor}
                onChange={(e) => setValor(e.target.value)} placeholder="0,00" className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Frequência</span>
              <select value={frequencia} onChange={(e) => setFrequencia(e.target.value as Frequencia)} className={inputCls}>
                {FREQUENCIAS.map((f) => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Data de início</span>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Data de término <span className="font-normal">(opcional)</span></span>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className={inputCls} />
            </label>
          </div>
          <p className="text-[11px] text-marca-texto-suave">
            {dataFim
              ? `Serão geradas ocorrências de ${dataInicio} até ${dataFim}.`
              : "Sem data de término: gera ocorrências pelos próximos 36 meses."}
          </p>
        </div>
      )}

      {/* ── PARCELADO ── */}
      {tipoLancamento === "parcelado" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(["por_parcela", "total"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setModoParcela(m)}
                className={`py-1.5 rounded-lg text-xs font-semibold border transition ${
                  modoParcela === m
                    ? "bg-marca-preto text-white border-marca-preto"
                    : "bg-white text-marca-texto-suave border-marca-borda hover:bg-marca-fundo"
                }`}>
                {m === "por_parcela" ? "Valor da parcela" : "Valor total"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>
                {modoParcela === "por_parcela" ? "Valor da parcela (R$)" : "Valor total (R$)"}
              </span>
              <input type="text" inputMode="decimal"
                value={modoParcela === "por_parcela" ? valorParcela : valorTotal}
                onChange={(e) => modoParcela === "por_parcela"
                  ? setValorParcela(e.target.value)
                  : setValorTotal(e.target.value)}
                placeholder="0,00" className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Nº de parcelas</span>
              <input type="number" min={2} max={360} value={totalParcelas}
                onChange={(e) => setTotalParcelas(e.target.value)} className={inputCls} />
            </label>
          </div>

          {parcelaDisplay && totalDisplay && (
            <div className="bg-marca-fundo border border-marca-borda rounded-lg px-3 py-2 text-xs text-marca-texto-suave flex justify-between">
              <span>{parcelasNum}x de <strong className="text-marca-texto">{parcelaDisplay}</strong></span>
              <span>Total: <strong className="text-marca-texto">{totalDisplay}</strong></span>
            </div>
          )}

          <label className="block">
            <span className={labelCls}>Data da 1ª parcela</span>
            <input type="date" value={dataPrimeira} onChange={(e) => setDataPrimeira(e.target.value)} className={inputCls} />
          </label>
        </div>
      )}

      {erro && <p className="text-sm text-despesa" role="alert">{erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="w-full bg-marca-preto text-white font-medium py-2.5 rounded-lg transition hover:opacity-90 disabled:opacity-50"
      >
        {enviando ? "Salvando..." : "Adicionar lançamento"}
      </button>
    </form>
  );
}
