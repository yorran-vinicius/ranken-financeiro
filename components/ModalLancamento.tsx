"use client";

import { useEffect, useMemo, useState } from "react";
import type { CategoriaDB, Lancamento } from "@/lib/db";
import type { TipoLancamento } from "@/lib/categorias";
import { hojeISO } from "@/lib/format";

interface Props {
  /** Se fornecido, preenche o formulário com os dados (modo editar ou modelo). */
  lancamento?: Partial<Lancamento>;
  /** Se fornecido, faz PATCH nesse id em vez de POST. */
  editandoId?: string;
  onFechar: () => void;
  onSalvo: () => void;
}

export default function ModalLancamento({ lancamento, editandoId, onFechar, onSalvo }: Props) {
  const isEditar = !!editandoId;

  const [tipo, setTipo]         = useState<TipoLancamento>(lancamento?.tipo ?? "receita");
  const [categoria, setCategoria] = useState(lancamento?.categoria ?? "");
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? "");
  const [valor, setValor]       = useState(lancamento?.valor ? String(lancamento.valor).replace(".", ",") : "");
  const [data, setData]         = useState(lancamento?.data ?? hojeISO());
  const [notas, setNotas]       = useState(lancamento?.notas ?? "");
  const [cidade, setCidade]     = useState(lancamento?.cidade ?? "");

  const [todasCats, setTodasCats]   = useState<CategoriaDB[]>([]);
  const [cidadesDisp, setCidadesDisp] = useState<string[]>([]);
  const [enviando, setEnviando]     = useState(false);
  const [erro, setErro]             = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/configuracoes/categorias").then((r) => r.json()),
      fetch("/api/configuracoes/geral").then((r) => r.json()),
    ]).then(([cats, cfg]) => {
      const lista = Array.isArray(cats) ? cats as CategoriaDB[] : [];
      setTodasCats(lista);
      // Preenche categoria padrão só se ainda não está preenchida
      if (!lancamento?.categoria) {
        const primeira = lista.find((c) => c.tipo === tipo && c.ativo);
        if (primeira) setCategoria(primeira.nome);
      }
      if (cfg.func_cidade === "true") {
        const cids = (cfg.cidades ?? "").split(",").map((c: string) => c.trim()).filter(Boolean);
        setCidadesDisp(cids);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const catsFiltradas = useMemo(
    () => todasCats.filter((c) => c.tipo === tipo && c.ativo).map((c) => c.nome),
    [todasCats, tipo],
  );

  function trocarTipo(t: TipoLancamento) {
    setTipo(t);
    const primeira = todasCats.find((c) => c.tipo === t && c.ativo);
    setCategoria(primeira?.nome ?? "");
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const valorNum = Number(valor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      setErro("Valor deve ser maior que zero."); return;
    }

    const body: Record<string, unknown> = {
      descricao: descricao.trim(),
      tipo,
      categoria,
      valor: Math.round(valorNum * 100) / 100,
      data,
      notas: notas.trim() || null,
      cidade: cidade || null,
      tipoLancamento: "avulso",
    };

    setEnviando(true);
    try {
      const url    = isEditar ? `/api/lancamentos/${editandoId}` : "/api/lancamentos";
      const method = isEditar ? "PATCH" : "POST";
      const resp   = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error((j as Record<string, string>).erro ?? "Falha ao salvar");
      }
      onSalvo();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setEnviando(false);
    }
  }

  const inp  = "mt-1 w-full px-3 py-3 min-h-[48px] rounded-lg border border-marca-borda bg-white focus:outline-none focus:ring-2 focus:ring-marca-preto text-sm";
  const lbl  = "text-xs font-medium text-marca-texto-suave";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onFechar} />

      <form
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-marca-texto">
            {isEditar ? "Editar lançamento" : "Novo lançamento"}
          </h2>
          <button type="button" onClick={onFechar}
            className="p-1.5 rounded-lg text-marca-texto-suave hover:text-marca-texto hover:bg-marca-fundo transition">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tipo */}
        <div className="grid grid-cols-2 gap-2">
          {(["receita", "despesa"] as TipoLancamento[]).map((t) => (
            <button key={t} type="button" onClick={() => trocarTipo(t)}
              className={`py-3 min-h-[48px] rounded-lg text-sm font-medium border transition ${
                tipo === t
                  ? t === "receita"
                    ? "bg-receita text-white border-receita"
                    : "bg-despesa text-white border-despesa"
                  : "bg-white text-marca-texto-suave border-marca-borda hover:bg-marca-fundo"
              }`}>
              {t === "receita" ? "Receita" : "Despesa"}
            </button>
          ))}
        </div>

        {/* Categoria */}
        <label className="block">
          <span className={lbl}>Categoria</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inp}>
            {catsFiltradas.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        {/* Descrição */}
        <label className="block">
          <span className={lbl}>Descrição</span>
          <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Mensalidade de Maio" className={inp} required />
        </label>

        {/* Valor + Data */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={lbl}>Valor (R$)</span>
            <input type="text" inputMode="decimal" value={valor}
              onChange={(e) => setValor(e.target.value)} placeholder="0,00" className={inp} required />
          </label>
          <label className="block">
            <span className={lbl}>Data</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inp} />
          </label>
        </div>

        {/* Cidade */}
        {cidadesDisp.length > 0 && (
          <label className="block">
            <span className={lbl}>Cidade</span>
            <select value={cidade} onChange={(e) => setCidade(e.target.value)} className={inp}>
              <option value="">— Selecionar —</option>
              {cidadesDisp.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}

        {/* Notas */}
        <label className="block">
          <span className={lbl}>Notas <span className="font-normal">(opcional)</span></span>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)}
            placeholder="Observações adicionais..." rows={2}
            className={`${inp} resize-none`} />
        </label>

        {erro && <p className="text-sm text-despesa" role="alert">{erro}</p>}

        <button type="submit" disabled={enviando}
          className="w-full py-3 min-h-[48px] rounded-lg bg-marca-preto text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
          {enviando
            ? (isEditar ? "Salvando..." : "Adicionando...")
            : (isEditar ? "Salvar alterações" : "Adicionar lançamento")}
        </button>
      </form>
    </div>
  );
}
