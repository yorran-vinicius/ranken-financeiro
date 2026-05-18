"use client";

import { useCallback, useRef, useState } from "react";
import { hojeISO } from "@/lib/format";
import type { LancamentoSugerido } from "@/app/api/importar/route";

// ── Categorias por tipo ──────────────────────────────────────────────────────
const CATS_RECEITA = ["Mensalidades", "Patrocínios", "Loja", "Confraternização", "Outros"];
const CATS_DESPESA = ["Time", "Marketing", "Tecnologia", "Operacional", "Confraternização", "Outros"];

// ── Item de resultado (estende sugerido com campo editável) ──────────────────
interface ItemResultado extends LancamentoSugerido {
  _id: number;
  categoria: string; // valor editável (cópia de categoria_sugerida)
  dataEditada: string; // cópia editável de data
  selecionado: boolean;
}

// ── Ícone de documento ────────────────────────────────────────────────────────
function IconDoc({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

// ── Converte File para base64 ─────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Formata valor em BRL ──────────────────────────────────────────────────────
function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ImportarPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo]     = useState<File | null>(null);
  const [dragging, setDragging]   = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const [itens, setItens]         = useState<ItemResultado[]>([]);
  const [importando, setImportando] = useState(false);
  const [resumo, setResumo]       = useState<{ ok: number; erro: number } | null>(null);

  // ── Validação do arquivo ───────────────────────────────────────────────────
  function validar(file: File): string | null {
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf"))
      return "Apenas arquivos PDF são aceitos.";
    if (file.size > 10 * 1024 * 1024)
      return "O arquivo não pode ultrapassar 10 MB.";
    return null;
  }

  function selecionarArquivo(file: File) {
    const erro = validar(file);
    if (erro) { setErroUpload(erro); setArquivo(null); return; }
    setErroUpload(null);
    setArquivo(file);
    setItens([]);
    setResumo(null);
  }

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) selecionarArquivo(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Analisar PDF ───────────────────────────────────────────────────────────
  async function analisar() {
    if (!arquivo) return;
    setAnalisando(true);
    setErroUpload(null);
    try {
      const base64 = await fileToBase64(arquivo);
      const resp   = await fetch("/api/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf: base64, nome: arquivo.name }),
      });
      const dados = await resp.json();
      if (!resp.ok) {
        setErroUpload(dados.erro ?? "Erro ao analisar o PDF.");
        return;
      }
      const lista: LancamentoSugerido[] = Array.isArray(dados) ? dados : [];
      if (lista.length === 0) {
        setErroUpload("Nenhum lançamento encontrado no documento.");
        return;
      }
      setItens(
        lista.map((l, i) => ({
          ...l,
          _id: i,
          categoria: l.categoria_sugerida,
          dataEditada: l.data ?? hojeISO(),
          selecionado: true,
        })),
      );
    } catch {
      setErroUpload("Falha de comunicação com o servidor.");
    } finally {
      setAnalisando(false);
    }
  }

  // ── Edição inline dos itens ────────────────────────────────────────────────
  function atualizar<K extends keyof ItemResultado>(id: number, campo: K, valor: ItemResultado[K]) {
    setItens((prev) => prev.map((it) => (it._id === id ? { ...it, [campo]: valor } : it)));
  }

  function toggleTodos(sel: boolean) {
    setItens((prev) => prev.map((it) => ({ ...it, selecionado: sel })));
  }

  // ── Importar selecionados ──────────────────────────────────────────────────
  async function importarSelecionados() {
    const selecionados = itens.filter((it) => it.selecionado);
    if (selecionados.length === 0) return;
    setImportando(true);
    let ok = 0;
    let erros = 0;
    for (const it of selecionados) {
      try {
        const resp = await fetch("/api/lancamentos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            descricao:       it.descricao,
            valor:           it.valor,
            tipo:            it.tipo === "entrada" ? "receita" : "despesa",
            categoria:       it.categoria,
            data:            it.dataEditada || hojeISO(),
            tipoLancamento:  "avulso",
          }),
        });
        if (resp.ok) ok++; else erros++;
      } catch { erros++; }
    }
    setImportando(false);
    setResumo({ ok, erro: erros });
    // Remove os importados com sucesso
    const idsSel = new Set(selecionados.map((it) => it._id));
    setItens((prev) => prev.filter((it) => !idsSel.has(it._id)));
    window.dispatchEvent(new CustomEvent("ranken:lancamento-adicionado"));
  }

  const totalSelecionados = itens.filter((it) => it.selecionado).length;
  const todosChecked      = itens.length > 0 && totalSelecionados === itens.length;

  const sel = "px-2.5 py-1.5 rounded-lg border border-marca-borda bg-white text-xs text-marca-texto focus:outline-none focus:ring-2 focus:ring-marca-preto";

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Cabeçalho ── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-marca-texto">Importar PDF</h1>
        <p className="text-sm text-marca-texto-suave mt-1">
          Envie uma fatura ou extrato e a IA identifica os lançamentos automaticamente.
        </p>
      </div>

      {/* ── Área de upload ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl px-8 py-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors select-none ${
          dragging
            ? "border-marca-preto bg-marca-fundo"
            : arquivo
            ? "border-receita/40 bg-receita-soft"
            : "border-marca-borda hover:border-marca-preto/40 hover:bg-marca-fundo"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) selecionarArquivo(f); }}
        />

        <IconDoc className={`w-10 h-10 ${arquivo ? "text-receita" : "text-marca-texto-suave"}`} />

        {arquivo ? (
          <>
            <p className="text-sm font-semibold text-marca-texto text-center">{arquivo.name}</p>
            <p className="text-xs text-marca-texto-suave">
              {(arquivo.size / 1024).toFixed(0)} KB · clique para trocar
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-marca-texto">Arraste o PDF aqui</p>
            <p className="text-xs text-marca-texto-suave">ou clique para selecionar · máx. 10 MB</p>
          </>
        )}
      </div>

      {/* ── Erro de upload ── */}
      {erroUpload && (
        <div className="bg-despesa-soft border border-despesa/20 rounded-xl px-4 py-3 text-sm text-despesa">
          {erroUpload}
        </div>
      )}

      {/* ── Botão Analisar ── */}
      {arquivo && itens.length === 0 && (
        <button
          onClick={analisar}
          disabled={analisando}
          className="w-full py-3 rounded-xl bg-marca-preto text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          {analisando ? (
            <>
              <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
              </svg>
              Analisando com IA... (pode levar alguns segundos)
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="w-4 h-4">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Analisar PDF
            </>
          )}
        </button>
      )}

      {/* ── Resumo de importação ── */}
      {resumo && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
          resumo.erro === 0 ? "bg-receita-soft text-receita" : "bg-despesa-soft text-despesa"
        }`}>
          {resumo.ok > 0 && <span>✓ {resumo.ok} lançamento{resumo.ok !== 1 ? "s" : ""} importado{resumo.ok !== 1 ? "s" : ""}.</span>}
          {resumo.erro > 0 && <span>✗ {resumo.erro} falhou. Verifique os dados e tente novamente.</span>}
        </div>
      )}

      {/* ── Resultados ── */}
      {itens.length > 0 && (
        <div className="space-y-4">
          {/* Cabeçalho da lista */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-marca-texto">
              {itens.length} lançamento{itens.length !== 1 ? "s" : ""} identificado{itens.length !== 1 ? "s" : ""}
            </p>
            <button
              type="button"
              onClick={() => toggleTodos(!todosChecked)}
              className="text-xs text-marca-texto-suave hover:text-marca-preto transition underline underline-offset-2"
            >
              {todosChecked ? "Desmarcar todos" : "Selecionar todos"}
            </button>
          </div>

          {/* Lista */}
          <div className="bg-white border border-marca-borda rounded-2xl overflow-hidden divide-y divide-marca-borda">
            {itens.map((it) => {
              const isReceita = it.tipo === "entrada";
              const cats = isReceita ? CATS_RECEITA : CATS_DESPESA;
              return (
                <div
                  key={it._id}
                  className={`px-4 py-3.5 flex gap-3 items-start transition-colors ${
                    it.selecionado ? "" : "opacity-50"
                  }`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={it.selecionado}
                    onChange={(e) => atualizar(it._id, "selecionado", e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-marca-borda accent-marca-preto shrink-0 cursor-pointer"
                  />

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Descrição + Valor */}
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-marca-texto leading-snug flex-1 min-w-0">
                        {it.descricao}
                      </p>
                      <span className={`text-sm font-bold tabular-nums shrink-0 ${
                        isReceita ? "text-receita" : "text-despesa"
                      }`}>
                        {isReceita ? "+" : "−"} {fmtBRL(it.valor)}
                      </span>
                    </div>

                    {/* Controles editáveis */}
                    <div className="flex flex-wrap gap-2">
                      {/* Tipo badge (só leitura) */}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        isReceita ? "bg-receita-soft text-receita" : "bg-despesa-soft text-despesa"
                      }`}>
                        {isReceita ? "Receita" : "Despesa"}
                      </span>

                      {/* Categoria */}
                      <select
                        value={it.categoria}
                        onChange={(e) => atualizar(it._id, "categoria", e.target.value)}
                        className={sel}
                      >
                        {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>

                      {/* Data */}
                      <input
                        type="date"
                        value={it.dataEditada}
                        onChange={(e) => atualizar(it._id, "dataEditada", e.target.value)}
                        className={sel}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botão importar */}
          <button
            onClick={importarSelecionados}
            disabled={importando || totalSelecionados === 0}
            className="w-full py-3 rounded-xl bg-marca-preto text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {importando ? (
              <>
                <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                </svg>
                Importando...
              </>
            ) : (
              `Importar ${totalSelecionados} selecionado${totalSelecionados !== 1 ? "s" : ""}`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
