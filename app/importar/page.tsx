"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hojeISO } from "@/lib/format";
import type { LancamentoSugerido } from "@/app/api/importar/route";

// ── Categorias ────────────────────────────────────────────────────────────────
const CATS_RECEITA = ["Mensalidades", "Patrocínios", "Loja", "Confraternização", "Aporte", "Outros"];
const CATS_DESPESA = ["Time", "Marketing", "Tecnologia", "Operacional", "Confraternização", "Outros"];

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Aba = "pdf" | "sicoob";

interface ItemResultado extends LancamentoSugerido {
  _id: number;
  categoria: string;
  dataEditada: string;
  selecionado: boolean;
}

// ── Helpers de conversão ──────────────────────────────────────────────────────
function converter(lancamentos: LancamentoSugerido[]): ItemResultado[] {
  return lancamentos.map((l, i) => ({
    ...l,
    _id: i,
    categoria: l.categoria_sugerida,
    dataEditada: l.data ?? hojeISO(),
    selecionado: !l.duplicata,
  }));
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Ícones ────────────────────────────────────────────────────────────────────
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

function IconTabela({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <line x1="3"  y1="9"  x2="21" y2="9"/>
      <line x1="3"  y1="15" x2="21" y2="15"/>
      <line x1="9"  y1="3"  x2="9"  y2="21"/>
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg"
      fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ImportarPage() {
  // ── Abas ──────────────────────────────────────────────────────────────────
  const [aba, setAba] = useState<Aba>("pdf");

  // ── Refs para inputs de arquivo ───────────────────────────────────────────
  const inputPDFRef    = useRef<HTMLInputElement>(null);
  const inputSicoobRef = useRef<HTMLInputElement>(null);

  // ── Estado de upload (por aba) ────────────────────────────────────────────
  const [arquivoPDF,    setArquivoPDF]    = useState<File | null>(null);
  const [arquivoSicoob, setArquivoSicoob] = useState<File | null>(null);
  const [dragging,  setDragging]  = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  // ── Estado compartilhado (resultados) ────────────────────────────────────
  const [itens,      setItens]      = useState<ItemResultado[]>([]);
  const [importando, setImportando] = useState(false);
  const [resumo,     setResumo]     = useState<{ ok: number; erro: number } | null>(null);
  const [desfazerId, setDesfazerId] = useState<string | null>(null);

  // ── Limpa tudo ao trocar de aba ────────────────────────────────────────────
  function mudarAba(nova: Aba) {
    setAba(nova);
    setArquivoPDF(null);
    setArquivoSicoob(null);
    setErro("");
    setItens([]);
    setResumo(null);
    setDesfazerId(null);
  }

  // ── Limpa o botão desfazer após 10 min ────────────────────────────────────
  useEffect(() => {
    if (!desfazerId) return;
    const t = setTimeout(() => setDesfazerId(null), 10 * 60 * 1000);
    return () => clearTimeout(t);
  }, [desfazerId]);

  // ── Validações ────────────────────────────────────────────────────────────
  function validarPDF(f: File): string | null {
    if (f.type !== "application/pdf" && !f.name.endsWith(".pdf"))
      return "Apenas arquivos PDF são aceitos.";
    if (f.size > 10 * 1024 * 1024)
      return "O arquivo não pode ultrapassar 10 MB.";
    return null;
  }

  function validarSicoob(f: File): string | null {
    const nome = f.name.toLowerCase();
    if (!nome.endsWith(".xls") && !nome.endsWith(".xlsx") && !nome.endsWith(".ofx"))
      return "Aceitos: .xls, .xlsx ou .ofx";
    if (f.size > 10 * 1024 * 1024)
      return "O arquivo não pode ultrapassar 10 MB.";
    return null;
  }

  function selecionarArquivoPDF(f: File) {
    const e = validarPDF(f);
    if (e) { setErro(e); setArquivoPDF(null); return; }
    setErro(""); setArquivoPDF(f); setItens([]); setResumo(null);
  }

  function selecionarArquivoSicoob(f: File) {
    const e = validarSicoob(f);
    if (e) { setErro(e); setArquivoSicoob(null); return; }
    setErro(""); setArquivoSicoob(f); setItens([]); setResumo(null);
  }

  // ── Drag & drop (roteado pela aba ativa) ──────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (aba === "pdf") selecionarArquivoPDF(f);
    else selecionarArquivoSicoob(f);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  // ── Analisar PDF ───────────────────────────────────────────────────────────
  const handleAnalisarPDF = async () => {
    if (!arquivoPDF) return;
    setCarregando(true);
    setErro("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(arquivoPDF);
      });

      const res  = await fetch("/api/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: base64 }),
      });
      const dados = await res.json();
      if (!res.ok) { setErro(dados.error || "Erro ao analisar PDF"); return; }
      setItens(converter(dados.lancamentos || []));
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setCarregando(false);
    }
  };

  // ── Analisar XLS/OFX Sicoob ───────────────────────────────────────────────
  const handleAnalisarSicoob = async () => {
    if (!arquivoSicoob) return;
    setCarregando(true);
    setErro("");
    try {
      const form = new FormData();
      form.append("arquivo", arquivoSicoob);

      const res  = await fetch("/api/importar/sicoob", { method: "POST", body: form });
      const dados = await res.json();
      if (!res.ok) { setErro(dados.error || "Erro ao analisar arquivo"); return; }
      setItens(converter(dados.lancamentos || []));
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setCarregando(false);
    }
  };

  // ── Edição inline ──────────────────────────────────────────────────────────
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

    const batchId = crypto.randomUUID();

    let categorias: Array<{ id: number; nome: string; tipo: string; ativo: boolean }> = [];
    try {
      const r = await fetch("/api/configuracoes/categorias");
      if (r.ok) categorias = await r.json();
    } catch { /* segue sem categorias */ }

    const promises = selecionados.map(async (it): Promise<number> => {
      const tipoAPI       = it.tipo === "entrada" ? "receita" : "despesa";
      const catsDoTipo    = categorias.filter((c) => c.tipo === tipoAPI && c.ativo);
      const catMatch      = catsDoTipo.find((c) => c.nome === it.categoria) ?? catsDoTipo[0];
      const nomeCategoria = catMatch?.nome ?? it.categoria;

      const resp = await fetch("/api/lancamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao:      it.descricao,
          valor:          it.valor,
          tipo:           tipoAPI,
          categoria:      nomeCategoria,
          data:           it.dataEditada || hojeISO(),
          cidade:         "Geral",
          tipoLancamento: "avulso",
          import_id:      batchId,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return it._id;
    });

    const results   = await Promise.allSettled(promises);
    let ok = 0, erros = 0;
    const importados = new Set<number>();

    results.forEach((r, i) => {
      if (r.status === "fulfilled") { ok++; importados.add(r.value); }
      else { erros++; if (erros === 1) console.error("Falha ao importar:", selecionados[i], r.reason); }
    });

    setImportando(false);
    setResumo({ ok, erro: erros });
    setItens((prev) => prev.filter((it) => !importados.has(it._id)));
    if (ok > 0) {
      setDesfazerId(batchId);
      window.dispatchEvent(new CustomEvent("ranken:lancamento-adicionado"));
    }
  }

  // ── Desfazer importação ────────────────────────────────────────────────────
  async function desfazer() {
    if (!desfazerId) return;
    try {
      const resp = await fetch("/api/importar/desfazer", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ import_id: desfazerId }),
      });
      if (resp.ok) {
        const { deletados } = await resp.json();
        setDesfazerId(null);
        setResumo(null);
        if (deletados > 0) window.dispatchEvent(new CustomEvent("ranken:lancamento-adicionado"));
      }
    } catch { /* silencioso */ }
  }

  // ── Derivados ──────────────────────────────────────────────────────────────
  const totalSelecionados = itens.filter((it) => it.selecionado).length;
  const todosChecked      = itens.length > 0 && totalSelecionados === itens.length;
  const arquivoAtual      = aba === "pdf" ? arquivoPDF : arquivoSicoob;
  const selectCls = "px-2.5 py-1.5 rounded-lg border border-marca-borda bg-white text-xs text-marca-texto focus:outline-none focus:ring-2 focus:ring-marca-preto";

  // ── Área de upload (compartilhada entre abas, muda conteúdo) ──────────────
  const uploadArea = (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => aba === "pdf"
        ? inputPDFRef.current?.click()
        : inputSicoobRef.current?.click()
      }
      className={`relative border-2 border-dashed rounded-2xl px-8 py-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors select-none ${
        dragging
          ? "border-marca-preto bg-marca-fundo"
          : arquivoAtual
          ? "border-receita/40 bg-receita-soft"
          : "border-marca-borda hover:border-marca-preto/40 hover:bg-marca-fundo"
      }`}
    >
      {/* Input oculto — PDF */}
      <input ref={inputPDFRef} type="file" accept=".pdf,application/pdf"
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) selecionarArquivoPDF(f); }}
      />
      {/* Input oculto — XLS/OFX */}
      <input ref={inputSicoobRef} type="file" accept=".xls,.xlsx,.ofx"
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) selecionarArquivoSicoob(f); }}
      />

      {aba === "pdf" ? (
        <IconDoc className={`w-10 h-10 ${arquivoAtual ? "text-receita" : "text-marca-texto-suave"}`} />
      ) : (
        <IconTabela className={`w-10 h-10 ${arquivoAtual ? "text-receita" : "text-marca-texto-suave"}`} />
      )}

      {arquivoAtual ? (
        <>
          <p className="text-sm font-semibold text-marca-texto text-center">{arquivoAtual.name}</p>
          <p className="text-xs text-marca-texto-suave">
            {(arquivoAtual.size / 1024).toFixed(0)} KB · clique para trocar
          </p>
        </>
      ) : aba === "pdf" ? (
        <>
          <p className="text-sm font-semibold text-marca-texto">Arraste o PDF aqui</p>
          <p className="text-xs text-marca-texto-suave">ou clique para selecionar · máx. 10 MB</p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-marca-texto">Arraste o extrato aqui</p>
          <p className="text-xs text-marca-texto-suave">.xls · .xlsx · .ofx · máx. 10 MB</p>
        </>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Cabeçalho ── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-marca-texto">Importar extrato</h1>
        <p className="text-sm text-marca-texto-suave mt-1">
          A IA identifica os lançamentos e sugere categorias automaticamente.
        </p>
      </div>

      {/* ── Abas ── */}
      <div className="flex gap-1 p-1 bg-marca-fundo border border-marca-borda rounded-xl w-fit">
        {(["pdf", "sicoob"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => mudarAba(a)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              aba === a
                ? "bg-marca-preto text-white shadow-sm"
                : "text-marca-texto-suave hover:text-marca-texto"
            }`}
          >
            {a === "pdf" ? "PDF" : "XLS / OFX — Sicoob"}
          </button>
        ))}
      </div>

      {/* ── Área de upload ── */}
      {uploadArea}

      {/* ── Erro ── */}
      {erro && (
        <div className="bg-despesa-soft border border-despesa/20 rounded-xl px-4 py-3 text-sm text-despesa">
          {erro}
        </div>
      )}

      {/* ── Botão Analisar ── */}
      {arquivoAtual && itens.length === 0 && (
        <button
          onClick={aba === "pdf" ? handleAnalisarPDF : handleAnalisarSicoob}
          disabled={carregando}
          className="w-full py-3 rounded-xl bg-marca-preto text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          {carregando ? (
            <><Spinner /> Analisando com IA… pode levar alguns segundos</>
          ) : aba === "pdf" ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="w-4 h-4">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Analisar PDF
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="w-4 h-4">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              Analisar extrato
            </>
          )}
        </button>
      )}

      {/* ── Resumo de importação ── */}
      {resumo && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center flex-wrap gap-2 ${
          resumo.erro === 0 ? "bg-receita-soft text-receita" : "bg-despesa-soft text-despesa"
        }`}>
          {resumo.ok > 0 && (
            <span>✓ {resumo.ok} lançamento{resumo.ok !== 1 ? "s" : ""} importado{resumo.ok !== 1 ? "s" : ""}.</span>
          )}
          {resumo.erro > 0 && (
            <span>✗ {resumo.erro} falhou. Verifique os dados e tente novamente.</span>
          )}
          {resumo.ok > 0 && desfazerId && (
            <button type="button" onClick={desfazer}
              className="ml-auto text-xs underline underline-offset-2 hover:opacity-70 transition whitespace-nowrap">
              Desfazer importação
            </button>
          )}
        </div>
      )}

      {/* ── Lista de lançamentos ── */}
      {itens.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-marca-texto">
              {itens.length} lançamento{itens.length !== 1 ? "s" : ""} identificado{itens.length !== 1 ? "s" : ""}
            </p>
            <button type="button" onClick={() => toggleTodos(!todosChecked)}
              className="text-xs text-marca-texto-suave hover:text-marca-preto transition underline underline-offset-2">
              {todosChecked ? "Desmarcar todos" : "Selecionar todos"}
            </button>
          </div>

          <div className="bg-white border border-marca-borda rounded-2xl overflow-hidden divide-y divide-marca-borda">
            {itens.map((it) => {
              const isReceita = it.tipo === "entrada";
              const cats      = isReceita ? CATS_RECEITA : CATS_DESPESA;
              return (
                <div key={it._id}
                  className={`px-4 py-3.5 flex gap-3 items-start transition-colors ${it.selecionado ? "" : "opacity-50"}`}>
                  <input type="checkbox" checked={it.selecionado}
                    onChange={(e) => atualizar(it._id, "selecionado", e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-marca-borda accent-marca-preto shrink-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-marca-texto leading-snug flex-1 min-w-0">
                        {it.descricao}
                      </p>
                      <span className={`text-sm font-bold tabular-nums shrink-0 ${isReceita ? "text-receita" : "text-despesa"}`}>
                        {isReceita ? "+" : "−"} {fmtBRL(it.valor)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        isReceita ? "bg-receita-soft text-receita" : "bg-despesa-soft text-despesa"
                      }`}>
                        {isReceita ? "Receita" : "Despesa"}
                      </span>
                      {it.duplicata && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200 whitespace-nowrap">
                          Já importado
                        </span>
                      )}
                      <select value={it.categoria}
                        onChange={(e) => atualizar(it._id, "categoria", e.target.value)}
                        className={selectCls}>
                        {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input type="date" value={it.dataEditada}
                        onChange={(e) => atualizar(it._id, "dataEditada", e.target.value)}
                        className={selectCls}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={importarSelecionados}
            disabled={importando || totalSelecionados === 0}
            className="w-full py-3 rounded-xl bg-marca-preto text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2">
            {importando ? (
              <><Spinner /> Importando…</>
            ) : (
              `Importar ${totalSelecionados} selecionado${totalSelecionados !== 1 ? "s" : ""}`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
