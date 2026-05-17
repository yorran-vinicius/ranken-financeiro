"use client";

import { useCallback, useEffect, useState } from "react";
import AnaliseCategoria from "@/components/AnaliseCategoria";
import FiltroMes from "@/components/FiltroMes";
import GerenciarGrupo from "@/components/GerenciarGrupo";
import ListaLancamentos from "@/components/ListaLancamentos";
import ModalLancamento from "@/components/ModalLancamento";
import { useAuth } from "@/components/AuthProvider";
import type { Lancamento } from "@/lib/db";
import { mesAtualISO, rotuloMesAno } from "@/lib/format";
import type { TipoLancamento } from "@/lib/categorias";

type FiltroTipo = TipoLancamento | "todos";

export default function LancamentosPage() {
  const usuario = useAuth();
  const isMaster = usuario?.perfil === "master";

  const [mes, setMes]             = useState(mesAtualISO());
  const [tipo, setTipo]           = useState<FiltroTipo>("todos");
  const [busca, setBusca]         = useState("");
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando]   = useState(true);
  const [versao, setVersao]       = useState(0);
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null);

  // Estado do modal de edição / modelo
  const [modalEditar, setModalEditar] = useState<{
    editandoId?: string;
    lancamento?: Partial<Lancamento>;
  } | null>(null);

  // ── Carregar lançamentos ────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const url  = `/api/lancamentos?mes=${mes}&tipo=${tipo}`;
      const resp = await fetch(url, { cache: "no-store" });
      const dados = await resp.json();
      setLancamentos(Array.isArray(dados) ? dados : []);
    } finally {
      setCarregando(false);
    }
  }, [mes, tipo]);

  useEffect(() => { carregar(); }, [carregar]);

  // Escuta o evento do botão flutuante (ClientLayout)
  useEffect(() => {
    const handler = () => carregar();
    window.addEventListener("ranken:lancamento-adicionado", handler);
    return () => window.removeEventListener("ranken:lancamento-adicionado", handler);
  }, [carregar]);

  const aposMudanca = useCallback(() => {
    setVersao((v) => v + 1);
  }, []);

  // ── Ações ────────────────────────────────────────────────────────────────────
  async function remover(id: string) {
    const resp = await fetch(`/api/lancamentos/${id}`, { method: "DELETE" });
    if (resp.ok) {
      setLancamentos((prev) => prev.filter((l) => l.id !== id));
      aposMudanca();
    }
  }

  async function toggleFavorito(id: string, favorito: boolean) {
    const resp = await fetch(`/api/lancamentos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorito }),
    });
    if (resp.ok) {
      const atualizado: Lancamento = await resp.json();
      setLancamentos((prev) =>
        prev.map((l) => (l.id === id ? atualizado : l))
      );
    }
  }

  function abrirEditar(l: Lancamento) {
    setModalEditar({ editandoId: l.id, lancamento: l });
  }

  function usarComoModelo(l: Lancamento) {
    // Abre modal sem id (cria novo), mas pré-preenchido
    setModalEditar({
      lancamento: {
        tipo:      l.tipo,
        categoria: l.categoria,
        descricao: l.descricao,
        valor:     l.valor,
        cidade:    l.cidade,
        notas:     l.notas,
      },
    });
  }

  function exportar() {
    window.location.href = `/api/exportar?mes=${mes}`;
  }

  // ── Filtro de busca local ───────────────────────────────────────────────────
  const lancamentosFiltrados = lancamentos.filter((l) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (
      l.descricao.toLowerCase().includes(q) ||
      (l.categoria ?? "").toLowerCase().includes(q) ||
      (l.notas ?? "").toLowerCase().includes(q)
    );
  });

  // ── Filtros de tipo ─────────────────────────────────────────────────────────
  const filtros: { valor: FiltroTipo; rotulo: string }[] = [
    { valor: "todos",   rotulo: "Todos"    },
    { valor: "receita", rotulo: "Receitas" },
    { valor: "despesa", rotulo: "Despesas" },
  ];

  return (
    <div className="space-y-6">
      {/* Modal de gerenciar grupo */}
      {grupoAberto && (
        <GerenciarGrupo
          grupoId={grupoAberto}
          onFechar={() => setGrupoAberto(null)}
          onAlterado={() => { carregar(); aposMudanca(); }}
        />
      )}

      {/* Modal de editar / usar como modelo */}
      {modalEditar && (
        <ModalLancamento
          editandoId={modalEditar.editandoId}
          lancamento={modalEditar.lancamento}
          onFechar={() => setModalEditar(null)}
          onSalvo={() => {
            setModalEditar(null);
            carregar();
            aposMudanca();
          }}
        />
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-marca-texto">Lançamentos</h1>
          <p className="text-sm text-marca-texto-suave">{rotuloMesAno(mes)}</p>
        </div>
        <div className="flex items-center gap-3">
          <FiltroMes valor={mes} onChange={setMes} />
          <button
            type="button"
            onClick={exportar}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-marca-borda bg-white text-sm text-marca-texto hover:bg-marca-fundo transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="w-4 h-4">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtros de tipo + busca */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex flex-wrap gap-2">
          {filtros.map((f) => {
            const ativo = tipo === f.valor;
            return (
              <button
                key={f.valor}
                type="button"
                onClick={() => setTipo(f.valor)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  ativo
                    ? "bg-marca-preto text-white border-marca-preto hover:opacity-90"
                    : "bg-white text-marca-texto-suave border-marca-borda hover:bg-marca-fundo"
                }`}
              >
                {f.rotulo}
              </button>
            );
          })}
        </div>

        {/* Campo de busca */}
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-marca-texto-suave pointer-events-none">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por descrição, categoria..."
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-full border border-marca-borda bg-white focus:outline-none focus:ring-2 focus:ring-marca-preto"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-marca-texto-suave hover:text-marca-preto"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className="w-3.5 h-3.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <ListaLancamentos
        lancamentos={lancamentosFiltrados}
        onRemover={remover}
        onEditar={abrirEditar}
        onToggleFavorito={toggleFavorito}
        onUsarComoModelo={usarComoModelo}
        onGerenciar={(gid) => setGrupoAberto(gid)}
        carregando={carregando}
        mostrarCriador={isMaster}
      />

      <AnaliseCategoria refreshKey={versao} />
    </div>
  );
}
