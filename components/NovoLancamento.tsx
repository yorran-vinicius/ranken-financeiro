"use client";

import { useMemo, useState } from "react";
import {
  CATEGORIAS_DESPESA,
  CATEGORIAS_RECEITA,
  type TipoLancamento,
} from "@/lib/categorias";
import { hojeISO } from "@/lib/format";

interface Props {
  onAdicionado?: () => void;
}

export default function NovoLancamento({ onAdicionado }: Props) {
  const [tipo, setTipo] = useState<TipoLancamento>("receita");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());
  const categoriasDisponiveis = useMemo(
    () => (tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA),
    [tipo]
  );
  const [categoria, setCategoria] = useState<string>(categoriasDisponiveis[0]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function trocarTipo(novo: TipoLancamento) {
    setTipo(novo);
    const lista = novo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
    setCategoria(lista[0]);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const valorLimpo = valor.replace(/\./g, "").replace(",", ".");
    const valorNum = Number(valorLimpo);

    if (!descricao.trim()) {
      setErro("Informe uma descrição.");
      return;
    }
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      setErro("Valor deve ser maior que zero.");
      return;
    }

    setEnviando(true);
    try {
      const resp = await fetch("/api/lancamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao: descricao.trim(),
          valor: valorNum,
          tipo,
          categoria,
          data,
        }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.erro ?? "Falha ao salvar");
      }
      setDescricao("");
      setValor("");
      setData(hojeISO());
      onAdicionado?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      className="bg-white border border-marca-borda rounded-2xl p-5"
    >
      <h2 className="text-lg font-bold text-marca-texto mb-4">Novo lançamento</h2>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => trocarTipo("receita")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
            tipo === "receita"
              ? "bg-receita text-white border-receita hover:opacity-90"
              : "bg-white text-marca-texto-suave border-marca-borda hover:bg-marca-fundo"
          }`}
        >
          Receita
        </button>
        <button
          type="button"
          onClick={() => trocarTipo("despesa")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
            tipo === "despesa"
              ? "bg-despesa text-white border-despesa hover:opacity-90"
              : "bg-white text-marca-texto-suave border-marca-borda hover:bg-marca-fundo"
          }`}
        >
          Despesa
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-marca-texto-suave">Descrição</span>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Mensalidade de Maio"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-marca-borda focus:outline-none focus:ring-2 focus:ring-marca-preto"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-marca-texto-suave">Valor (R$)</span>
          <input
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-marca-borda focus:outline-none focus:ring-2 focus:ring-marca-preto"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-marca-texto-suave">Data</span>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-marca-borda focus:outline-none focus:ring-2 focus:ring-marca-preto"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-marca-texto-suave">Categoria</span>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-marca-borda bg-white focus:outline-none focus:ring-2 focus:ring-marca-preto"
          >
            {categoriasDisponiveis.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {erro && (
        <p className="mt-3 text-sm text-despesa" role="alert">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-4 w-full bg-marca-preto text-white font-medium py-2.5 rounded-lg transition hover:opacity-90 disabled:opacity-50"
      >
        {enviando ? "Salvando..." : "Adicionar lançamento"}
      </button>
    </form>
  );
}
