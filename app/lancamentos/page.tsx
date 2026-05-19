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

  const [categoriaSel, setCategoriaSel] = useState("");
  const [periodoTipo, setPeriodoTipo]   = useState<"mes" | "personalizado">("mes");
  const [dataIni, setDataIni]           = useState("");
  const [dataFim, setDataFim]           = useState("");
  const [usuarioSel, setUsuarioSel]     = useState("");
  const [categorias, setCategorias]     = useState<string[]>([]);
  const [usuarios, setUsuarios]         = useState<{ id: string; nome: string }[]>([]);

  // ── Seleção em lote ────────────────────────────────────────────────────────
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set());
  const [batchCategoria,   setBatchCategoria]   = useState("");
  const [batchTipoLanc,    setBatchTipoLanc]    = useState("");
  const [aplicandoLote,    setAplicandoLote]    = useState(false);

  // Estado do modal de edição / modelo
  const [modalEditar, setModalEditar] = useState<{
    editandoId?: string;
    lancamento?: Partial<Lancamento>;
  } | null>(null);

  // ── Carregar categorias e usuários ─────────────────────────────────────────
  useEffect(() => {
    fetch("/api/configuracoes/categorias")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data))
          setCategorias(data.filter((c: any) => c.ativo).map((c: any) => c.nome));
      })
      .catch(() => {});
    if (isMaster) {
      fetch("/api/usuarios")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data))
            setUsuarios(data.map((u: any) => ({ id: u.id, nome: u.nome })));
        })
        .catch(() => {});
    }
  }, [isMaster]);

  // ── Carregar lançamentos ────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (periodoTipo === "mes") {
        params.set("mes", mes);
      } else {
        if (dataIni) params.set("dataInicio", dataIni);
        if (dataFim)  params.set("dataFim",   dataFim);
      }
      params.set("tipo", tipo);
      if (usuarioSel)   params.set("usuario",   usuarioSel);
      if (categoriaSel) params.set("categoria", categoriaSel);

      const resp = await fetch(`/api/lancamentos?${params.toString()}`, { cache: "no-store" });
      const dados = await resp.json();
      setLancamentos(Array.isArray(dados) ? dados : []);
    } finally {
      setCarregando(false);
    }
  }, [mes, tipo, periodoTipo, dataIni, dataFim, usuarioSel, categoriaSel]);

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

  // ── Seleção e lote ─────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function aplicarLote() {
    if (selectedIds.size === 0) return;
    if (!batchCategoria && !batchTipoLanc) return;
    setAplicandoLote(true);
    try {
      const campos: Record<string, string> = {};
      if (batchCategoria) campos.categoria         = batchCategoria;
      if (batchTipoLanc)  campos.tipo_lancamento   = batchTipoLanc;
      const resp = await fetch("/api/lancamentos/lote", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds], campos }),
      });
      if (resp.ok) {
        setSelectedIds(new Set());
        setBatchCategoria("");
        setBatchTipoLanc("");
        carregar();
      }
    } finally {
      setAplicandoLote(false);
    }
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
          <p className="text-sm text-marca-texto-suave">
            {periodoTipo === "mes" ? rotuloMesAno(mes) : (dataIni && dataFim ? `${dataIni} a ${dataFim}` : "Período personalizado")}
          </p>
        </div>
        <div className="flex items-center gap-3">
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

      {/* Filtros — linha 1: período */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Toggle Por mês / Personalizado */}
          <div className="flex rounded-full border border-marca-borda overflow-hidden">
            <button
              type="button"
              onClick={() => setPeriodoTipo("mes")}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                periodoTipo === "mes"
                  ? "bg-marca-preto text-white"
                  : "bg-white text-marca-texto-suave hover:bg-marca-fundo"
              }`}
            >
              Por mês
            </button>
            <button
              type="button"
              onClick={() => setPeriodoTipo("personalizado")}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                periodoTipo === "personalizado"
                  ? "bg-marca-preto text-white"
                  : "bg-white text-marca-texto-suave hover:bg-marca-fundo"
              }`}
            >
              Personalizado
            </button>
          </div>

          {/* Seletor de período */}
          {periodoTipo === "mes" ? (
            <FiltroMes valor={mes} onChange={setMes} />
          ) : (
            <div className="flex items-center gap-2">
              <label className="text-xs text-marca-texto-suave whitespace-nowrap">De:</label>
              <input
                type="date"
                value={dataIni}
                onChange={(e) => setDataIni(e.target.value)}
                className="px-2 py-1.5 text-sm rounded-lg border border-marca-borda bg-white focus:outline-none focus:ring-2 focus:ring-marca-preto"
              />
              <label className="text-xs text-marca-texto-suave whitespace-nowrap">Até:</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="px-2 py-1.5 text-sm rounded-lg border border-marca-borda bg-white focus:outline-none focus:ring-2 focus:ring-marca-preto"
              />
            </div>
          )}
        </div>

        {/* Filtros — linha 2: tipo pills + busca */}
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

        {/* Filtros — linha 3: categoria + usuário (se disponíveis) */}
        {(categorias.length > 0 || (isMaster && usuarios.length > 0)) && (
          <div className="flex flex-wrap gap-3 items-center">
            {categorias.length > 0 && (
              <select
                value={categoriaSel}
                onChange={(e) => setCategoriaSel(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border border-marca-borda bg-white text-marca-texto focus:outline-none focus:ring-2 focus:ring-marca-preto"
              >
                <option value="">Todas categorias</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            {isMaster && usuarios.length > 0 && (
              <select
                value={usuarioSel}
                onChange={(e) => setUsuarioSel(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border border-marca-borda bg-white text-marca-texto focus:outline-none focus:ring-2 focus:ring-marca-preto"
              >
                <option value="">Todos usuários</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* ── Barra de ação em lote ── */}
      {selectedIds.size >= 2 && (
        <div className="sticky top-0 z-30 bg-white border border-marca-borda rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
          <span className="text-sm font-semibold text-marca-texto">
            {selectedIds.size} selecionados
          </span>
          <span className="text-marca-borda hidden sm:inline">|</span>

          {/* Categoria */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-marca-texto-suave whitespace-nowrap">Categoria:</label>
            <select
              value={batchCategoria}
              onChange={(e) => setBatchCategoria(e.target.value)}
              className="px-2 py-1.5 text-xs rounded-lg border border-marca-borda bg-white focus:outline-none focus:ring-2 focus:ring-marca-preto"
            >
              <option value="">— manter —</option>
              {categorias.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Tipo de lançamento */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-marca-texto-suave whitespace-nowrap">Tipo:</label>
            <select
              value={batchTipoLanc}
              onChange={(e) => setBatchTipoLanc(e.target.value)}
              className="px-2 py-1.5 text-xs rounded-lg border border-marca-borda bg-white focus:outline-none focus:ring-2 focus:ring-marca-preto"
            >
              <option value="">— manter —</option>
              <option value="avulso">Avulso</option>
              <option value="recorrente">Recorrente</option>
              <option value="parcelado">Parcelado</option>
            </select>
          </div>

          <button
            type="button"
            onClick={aplicarLote}
            disabled={aplicandoLote || (!batchCategoria && !batchTipoLanc)}
            className="px-3 py-1.5 rounded-lg bg-marca-preto text-white text-xs font-medium hover:opacity-90 disabled:opacity-40 transition"
          >
            {aplicandoLote ? "Aplicando..." : "Aplicar"}
          </button>

          <button
            type="button"
            onClick={() => { setSelectedIds(new Set()); setBatchCategoria(""); setBatchTipoLanc(""); }}
            className="ml-auto text-xs text-marca-texto-suave hover:text-marca-preto transition"
          >
            Cancelar
          </button>
        </div>
      )}

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
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
      />

      <AnaliseCategoria refreshKey={versao} />
    </div>
  );
}
