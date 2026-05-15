"use client";

import { useCallback, useEffect, useState } from "react";
import AnaliseCategoria from "@/components/AnaliseCategoria";
import FiltroMes from "@/components/FiltroMes";
import GerenciarGrupo from "@/components/GerenciarGrupo";
import ListaLancamentos from "@/components/ListaLancamentos";
import NovoLancamento from "@/components/NovoLancamento";
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
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando]   = useState(true);
  const [versao, setVersao]       = useState(0);
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null);

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

  const aposMudanca = useCallback(() => {
    setVersao((v) => v + 1);
  }, []);

  async function remover(id: string) {
    const ok = window.confirm("Remover este lançamento?");
    if (!ok) return;
    const resp = await fetch(`/api/lancamentos/${id}`, { method: "DELETE" });
    if (resp.ok) {
      setLancamentos((prev) => prev.filter((l) => l.id !== id));
      aposMudanca();
    }
  }

  function exportar() {
    window.location.href = `/api/exportar?mes=${mes}`;
  }

  const filtros: { valor: FiltroTipo; rotulo: string }[] = [
    { valor: "todos",   rotulo: "Todos"    },
    { valor: "receita", rotulo: "Receitas" },
    { valor: "despesa", rotulo: "Despesas" },
  ];

  return (
    <div className="space-y-6">
      {grupoAberto && (
        <GerenciarGrupo
          grupoId={grupoAberto}
          onFechar={() => setGrupoAberto(null)}
          onAlterado={() => { carregar(); aposMudanca(); }}
        />
      )}

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <NovoLancamento
            onAdicionado={() => { carregar(); aposMudanca(); }}
          />
        </div>

        <div className="lg:col-span-2 space-y-3">
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

          <ListaLancamentos
            lancamentos={lancamentos}
            onRemover={remover}
            onGerenciar={(gid) => setGrupoAberto(gid)}
            carregando={carregando}
            mostrarCriador={isMaster}
          />
        </div>
      </div>

      <AnaliseCategoria refreshKey={versao} />
    </div>
  );
}
