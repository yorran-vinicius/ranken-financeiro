"use client";

import { useCallback, useEffect, useState } from "react";
import { formatarBRL } from "@/lib/format";

interface Assinatura {
  stripe_subscription_id: string;
  cliente_nome: string;
  cliente_email: string;
  valor_mensal: number;
  status: string;
  data_inicio: string;
  data_proxima_cobranca: string;
  data_cancelamento: string | null;
}

interface Resumo {
  ativas: number;
  past_due: number;
  canceladas: number;
  inadimplentes: number;
  mrr: number;
  ticket_medio: number;
}

interface ChurnMes {
  mes: string;
  cancelamentos: number;
  mrr_perdido: number;
}

interface MrrNovo {
  mes: string;
  novas: number;
  mrr_novo: number;
}

const STATUS_COR: Record<string, string> = {
  active:   "bg-green-100 text-green-700",
  past_due: "bg-yellow-100 text-yellow-700",
  unpaid:   "bg-red-100 text-red-700",
  canceled: "bg-gray-100 text-gray-400",
};

const STATUS_LABEL: Record<string, string> = {
  active:   "Ativa",
  past_due: "Inadimplente",
  unpaid:   "Não paga",
  canceled: "Cancelada",
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COR[status] ?? "bg-gray-100 text-gray-500"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function KpiCard({ label, valor, sub, cor = "text-marca-texto" }: {
  label: string; valor: string; sub?: string; cor?: string;
}) {
  return (
    <div className="bg-white border border-marca-borda rounded-2xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-black leading-none ${cor}`}>{valor}</p>
      {sub && <p className="text-xs text-marca-texto-suave mt-1">{sub}</p>}
    </div>
  );
}

export default function AssinaturasPage() {
  const [assinaturas,   setAssinaturas]   = useState<Assinatura[]>([]);
  const [resumo,        setResumo]        = useState<Resumo | null>(null);
  const [churnMensal,   setChurnMensal]   = useState<ChurnMes[]>([]);
  const [mrrHistorico,  setMrrHistorico]  = useState<MrrNovo[]>([]);
  const [carregando,    setCarregando]    = useState(true);
  const [filtroStatus,  setFiltroStatus]  = useState("todos");
  const [busca,         setBusca]         = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch("/api/assinaturas", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setAssinaturas(d.assinaturas ?? []);
        setResumo(d.resumo ?? null);
        setChurnMensal(d.churnMensal ?? []);
        setMrrHistorico(d.mrrHistorico ?? []);
      }
    } catch { /* silencioso */ }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = assinaturas.filter((a) => {
    const passaStatus = filtroStatus === "todos" || a.status === filtroStatus;
    const passaBusca  = busca === "" ||
      a.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
      a.cliente_email.toLowerCase().includes(busca.toLowerCase());
    return passaStatus && passaBusca;
  });

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-marca-texto">Assinaturas</h1>
        <p className="text-sm text-marca-texto-suave">MRR e gestão de assinantes via Stripe.</p>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-20 text-marca-texto-suave text-sm">
          Carregando dados Stripe…
        </div>
      ) : (
        <>
          {/* KPIs */}
          {resumo && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard label="MRR"           valor={formatarBRL(Number(resumo.mrr))}      cor="text-receita" />
              <KpiCard label="Ticket médio"  valor={formatarBRL(Number(resumo.ticket_medio))} />
              <KpiCard label="Ativas"        valor={String(resumo.ativas)}               cor="text-receita" />
              <KpiCard label="Inadimplentes" valor={String(resumo.past_due)}             cor="text-despesa" />
              <KpiCard label="Não pagas"     valor={String(resumo.inadimplentes)}        cor="text-despesa" />
              <KpiCard label="Canceladas"    valor={String(resumo.canceladas)}           cor="text-gray-400" />
            </div>
          )}

          {/* Histórico mês a mês */}
          {(churnMensal.length > 0 || mrrHistorico.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Novas assinaturas */}
              <div className="bg-white border border-marca-borda rounded-2xl p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Novas (últimos 6 meses)</p>
                <div className="space-y-2">
                  {mrrHistorico.length === 0 ? (
                    <p className="text-sm text-marca-texto-suave">Sem dados.</p>
                  ) : mrrHistorico.map((m) => (
                    <div key={m.mes} className="flex items-center justify-between text-sm">
                      <span className="text-marca-texto-suave">{m.mes}</span>
                      <span>
                        <span className="font-semibold text-receita">+{m.novas}</span>
                        <span className="text-marca-texto-suave ml-2 text-xs">({formatarBRL(Number(m.mrr_novo))}/mês)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Churn */}
              <div className="bg-white border border-marca-borda rounded-2xl p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Cancelamentos (últimos 6 meses)</p>
                <div className="space-y-2">
                  {churnMensal.length === 0 ? (
                    <p className="text-sm text-marca-texto-suave">Nenhum cancelamento.</p>
                  ) : churnMensal.map((m) => (
                    <div key={m.mes} className="flex items-center justify-between text-sm">
                      <span className="text-marca-texto-suave">{m.mes}</span>
                      <span>
                        <span className="font-semibold text-despesa">-{m.cancelamentos}</span>
                        <span className="text-marca-texto-suave ml-2 text-xs">(-{formatarBRL(Number(m.mrr_perdido))}/mês)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-marca-borda text-sm bg-white text-marca-texto placeholder:text-marca-texto-suave focus:outline-none focus:ring-2 focus:ring-marca-preto/20"
            />
            <div className="flex gap-1.5 flex-wrap">
              {["todos", "active", "past_due", "unpaid", "canceled"].map((s) => (
                <button
                  key={s}
                  onClick={() => setFiltroStatus(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    filtroStatus === s
                      ? "bg-marca-preto text-white border-marca-preto"
                      : "bg-white text-marca-texto-suave border-marca-borda hover:bg-marca-fundo"
                  }`}
                >
                  {s === "todos" ? "Todos" : STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white border border-marca-borda rounded-2xl overflow-hidden">
            {filtradas.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-marca-texto-suave">
                {assinaturas.length === 0
                  ? "Nenhuma assinatura sincronizada. Acesse Configurações → Sincronizar Stripe."
                  : "Nenhuma assinatura com esses filtros."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-marca-borda text-marca-texto-suave text-left text-xs uppercase tracking-wide">
                      <th className="px-5 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium text-right">Mensalidade</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium hidden md:table-cell">Início</th>
                      <th className="px-4 py-3 font-medium hidden md:table-cell">Próx. cobrança</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-marca-borda">
                    {filtradas.map((a) => (
                      <tr key={a.stripe_subscription_id} className="hover:bg-marca-fundo/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium text-marca-texto">{a.cliente_nome}</p>
                          <p className="text-xs text-marca-texto-suave">{a.cliente_email}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-marca-texto">
                          {formatarBRL(Number(a.valor_mensal ?? 0))}
                        </td>
                        <td className="px-4 py-3"><Badge status={a.status} /></td>
                        <td className="px-4 py-3 text-marca-texto-suave hidden md:table-cell">
                          {a.data_inicio ? String(a.data_inicio).slice(0, 10) : "—"}
                        </td>
                        <td className="px-4 py-3 text-marca-texto-suave hidden md:table-cell">
                          {a.status === "canceled"
                            ? <span className="text-despesa text-xs">Cancelada em {String(a.data_cancelamento ?? "").slice(0, 10)}</span>
                            : (a.data_proxima_cobranca ? String(a.data_proxima_cobranca).slice(0, 10) : "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
