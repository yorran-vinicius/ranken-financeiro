"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Lancamento } from "@/lib/db";
import { formatarBRL, formatarData } from "@/lib/format";

// ── Ícone lupa ────────────────────────────────────────────────────────────────
function IconeLupa({ className = "" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`w-4 h-4 ${className}`}>
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function BuscaGlobal() {
  const router = useRouter();
  const [aberto, setAberto]           = useState(false);
  const [query, setQuery]             = useState("");
  const [resultados, setResultados]   = useState<Lancamento[]>([]);
  const [carregando, setCarregando]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Atalho Cmd+K / Ctrl+K + ESC ──────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setAberto(true);
      }
      if (e.key === "Escape") setAberto(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Foco automático ao abrir ──────────────────────────────────────────────
  useEffect(() => {
    if (aberto) {
      // pequeno delay para garantir que o elemento está montado
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    } else {
      setQuery("");
      setResultados([]);
    }
  }, [aberto]);

  // ── Busca com debounce de 300 ms ──────────────────────────────────────────
  useEffect(() => {
    if (!query || query.length < 2) {
      setResultados([]);
      return;
    }
    setCarregando(true);
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/busca?q=${encodeURIComponent(query)}&limite=20`,
          { cache: "no-store" },
        );
        const data = await r.json();
        setResultados(Array.isArray(data) ? data : []);
      } catch {
        setResultados([]);
      } finally {
        setCarregando(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      setCarregando(false);
    };
  }, [query]);

  // ── Navegar ao clicar em um resultado ────────────────────────────────────
  function irPara(l: Lancamento) {
    const mes = l.data.slice(0, 7); // YYYY-MM
    router.push(`/lancamentos?mes=${mes}`);
    setAberto(false);
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Botão de gatilho na NavBar ── */}
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Buscar lançamentos (⌘K)"
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-white/70 hover:text-white hover:bg-white/10 transition"
      >
        <IconeLupa />
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-white/10 border border-white/20 rounded text-white/50">
          ⌘K
        </kbd>
      </button>

      {/* ── Modal de busca ── */}
      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Busca global"
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
        >
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setAberto(false)}
          />

          {/* Painel */}
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-marca-borda">
              <IconeLupa className="text-marca-texto-suave" />
              <input
                ref={inputRef}
                type="search"
                placeholder="Buscar lançamentos por descrição ou categoria…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-marca-texto placeholder-marca-texto-suave/60 outline-none text-sm"
              />
              {carregando && (
                <span className="text-xs text-marca-texto-suave shrink-0">Buscando…</span>
              )}
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="shrink-0 text-marca-texto-suave hover:text-marca-texto transition"
              >
                <kbd className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-marca-fundo border border-marca-borda rounded text-marca-texto-suave">
                  ESC
                </kbd>
              </button>
            </div>

            {/* Resultados */}
            {resultados.length > 0 && (
              <ul className="max-h-80 overflow-y-auto divide-y divide-marca-borda">
                {resultados.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => irPara(l)}
                      className="w-full text-left px-4 py-3 hover:bg-marca-fundo transition flex items-start gap-3"
                    >
                      {/* Ponto colorido por tipo */}
                      <span
                        className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                          l.tipo === "receita" ? "bg-receita" : "bg-despesa"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-marca-texto truncate">
                          {l.descricao}
                        </p>
                        <p className="text-xs text-marca-texto-suave mt-0.5">
                          {formatarData(l.data)} · {l.categoria}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold shrink-0 ${
                          l.tipo === "receita" ? "text-receita" : "text-despesa"
                        }`}
                      >
                        {l.tipo === "receita" ? "+" : "−"}{formatarBRL(l.valor)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Sem resultados */}
            {query.length >= 2 && !carregando && resultados.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-marca-texto-suave">
                Nenhum resultado para &ldquo;{query}&rdquo;
              </p>
            )}

            {/* Dica inicial */}
            {query.length < 2 && (
              <p className="px-4 py-6 text-center text-xs text-marca-texto-suave/70">
                Digite pelo menos 2 caracteres para buscar
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
