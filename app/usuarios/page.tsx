"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { Usuario } from "@/lib/db";

type NovoForm = { login: string; nome: string; perfil: "master" | "editor"; senha: string };
type SenhaForm = { id: string; nova: string };

export default function UsuariosPage() {
  const router  = useRouter();
  const usuario = useAuth();

  const [usuarios, setUsuarios]       = useState<Usuario[]>([]);
  const [carregando, setCarregando]   = useState(true);
  const [erro, setErro]               = useState<string | null>(null);
  const [sucesso, setSucesso]         = useState<string | null>(null);

  // Formulário novo usuário
  const [novoAberto, setNovoAberto]   = useState(false);
  const [novo, setNovo]               = useState<NovoForm>({ login: "", nome: "", perfil: "editor", senha: "" });
  const [enviandoNovo, setEnviandoNovo] = useState(false);

  // Reset de senha
  const [senhaForm, setSenhaForm]     = useState<SenhaForm | null>(null);
  const [enviandoSenha, setEnviandoSenha] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const resp = await fetch("/api/usuarios");
    if (resp.status === 403) { router.push("/"); return; }
    const dados = await resp.json();
    setUsuarios(Array.isArray(dados) ? dados : []);
    setCarregando(false);
  }, [router]);

  useEffect(() => {
    if (usuario !== null && usuario?.perfil !== "master") {
      router.push("/");
    }
  }, [usuario, router]);

  useEffect(() => { carregar(); }, [carregar]);

  function flash(msg: string) {
    setSucesso(msg);
    setTimeout(() => setSucesso(null), 3000);
  }

  async function toggleAtivo(u: Usuario) {
    const resp = await fetch(`/api/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !u.ativo }),
    });
    if (resp.ok) {
      flash(u.ativo ? `${u.nome} desativado.` : `${u.nome} ativado.`);
      carregar();
    }
  }

  async function criarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setEnviandoNovo(true);
    setErro(null);
    const resp = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novo),
    });
    const dados = await resp.json();
    setEnviandoNovo(false);
    if (!resp.ok) { setErro(dados.erro ?? "Erro ao criar usuário"); return; }
    setNovoAberto(false);
    setNovo({ login: "", nome: "", perfil: "editor", senha: "" });
    flash(`Usuário ${dados.nome} criado. Ele deve trocar a senha no primeiro acesso.`);
    carregar();
  }

  async function redefinirSenha(e: React.FormEvent) {
    e.preventDefault();
    if (!senhaForm) return;
    setEnviandoSenha(true);
    setErro(null);
    const resp = await fetch(`/api/usuarios/${senhaForm.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ novaSenha: senhaForm.nova }),
    });
    const dados = await resp.json();
    setEnviandoSenha(false);
    if (!resp.ok) { setErro(dados.erro ?? "Erro ao redefinir"); return; }
    setSenhaForm(null);
    flash("Senha redefinida. O usuário deve trocá-la no próximo acesso.");
    carregar();
  }

  const inputCls = "mt-1 w-full px-3 py-2 rounded-lg border border-marca-borda bg-white focus:outline-none focus:ring-2 focus:ring-marca-preto text-sm";
  const labelCls = "text-xs font-medium text-marca-texto-suave";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-marca-texto">Usuários</h1>
          <p className="text-sm text-marca-texto-suave">Gerencie o acesso à plataforma.</p>
        </div>
        <button
          type="button"
          onClick={() => setNovoAberto(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-marca-preto text-white text-sm font-medium hover:opacity-90 transition"
        >
          + Novo usuário
        </button>
      </div>

      {sucesso && (
        <div className="bg-receita-soft border border-receita/20 rounded-lg px-4 py-2.5 text-sm text-receita">
          {sucesso}
        </div>
      )}
      {erro && (
        <div className="bg-despesa-soft border border-despesa/20 rounded-lg px-4 py-2.5 text-sm text-despesa">
          {erro}
        </div>
      )}

      {/* Modal: novo usuário */}
      {novoAberto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNovoAberto(false)} />
          <form
            onSubmit={criarUsuario}
            className="relative bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl"
          >
            <h2 className="text-base font-bold text-marca-texto">Novo usuário</h2>
            <label className="block">
              <span className={labelCls}>Nome completo</span>
              <input type="text" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                className={inputCls} placeholder="Ex: Ana Lima" required />
            </label>
            <label className="block">
              <span className={labelCls}>Login (sem espaços)</span>
              <input type="text" value={novo.login} onChange={(e) => setNovo({ ...novo, login: e.target.value.toLowerCase().replace(/\s/g, "") })}
                className={inputCls} placeholder="ana.lima" required />
            </label>
            <label className="block">
              <span className={labelCls}>Perfil</span>
              <select value={novo.perfil} onChange={(e) => setNovo({ ...novo, perfil: e.target.value as "master" | "editor" })} className={inputCls}>
                <option value="editor">Editor</option>
                <option value="master">Master</option>
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Senha inicial (mín. 6 caracteres)</span>
              <input type="password" value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })}
                className={inputCls} placeholder="••••••" required minLength={6} />
            </label>
            <p className="text-[11px] text-marca-texto-suave">O usuário será solicitado a trocar a senha no primeiro acesso.</p>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setNovoAberto(false)}
                className="flex-1 py-2 rounded-lg border border-marca-borda text-sm text-marca-texto-suave hover:bg-marca-fundo transition">
                Cancelar
              </button>
              <button type="submit" disabled={enviandoNovo}
                className="flex-1 py-2 rounded-lg bg-marca-preto text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
                {enviandoNovo ? "Criando..." : "Criar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: redefinir senha */}
      {senhaForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSenhaForm(null)} />
          <form
            onSubmit={redefinirSenha}
            className="relative bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl"
          >
            <h2 className="text-base font-bold text-marca-texto">Redefinir senha</h2>
            <label className="block">
              <span className={labelCls}>Nova senha (mín. 6 caracteres)</span>
              <input type="password" value={senhaForm.nova} onChange={(e) => setSenhaForm({ ...senhaForm, nova: e.target.value })}
                className={inputCls} placeholder="••••••" required minLength={6} />
            </label>
            <p className="text-[11px] text-marca-texto-suave">O usuário deverá trocar a senha no próximo acesso.</p>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setSenhaForm(null)}
                className="flex-1 py-2 rounded-lg border border-marca-borda text-sm text-marca-texto-suave hover:bg-marca-fundo transition">
                Cancelar
              </button>
              <button type="submit" disabled={enviandoSenha}
                className="flex-1 py-2 rounded-lg bg-marca-preto text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
                {enviandoSenha ? "Salvando..." : "Redefinir"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela de usuários */}
      {carregando ? (
        <div className="bg-white border border-marca-borda rounded-2xl p-8 text-center text-marca-texto-suave text-sm">
          Carregando...
        </div>
      ) : (
        <div className="bg-white border border-marca-borda rounded-2xl overflow-hidden">
          <div className="hidden md:grid md:grid-cols-[1fr_140px_100px_120px_auto] gap-3 px-5 py-3 bg-marca-fundo text-xs font-medium uppercase tracking-wide text-marca-texto-suave">
            <span>Nome / Login</span>
            <span>Perfil</span>
            <span>Status</span>
            <span>Cadastro</span>
            <span />
          </div>
          <ul className="divide-y divide-marca-borda">
            {usuarios.map((u) => (
              <li key={u.id} className={`px-5 py-4 flex flex-col md:grid md:grid-cols-[1fr_140px_100px_120px_auto] gap-3 md:items-center ${!u.ativo ? "opacity-50" : ""}`}>
                <div>
                  <p className="text-sm font-medium text-marca-texto">{u.nome}</p>
                  <p className="text-xs text-marca-texto-suave mt-0.5">{u.login}</p>
                </div>
                <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  u.perfil === "master"
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "bg-neutral-100 text-neutral-600 border-neutral-200"
                }`}>
                  {u.perfil === "master" ? "Master" : "Editor"}
                </span>
                <span className={`text-xs font-medium ${u.ativo ? "text-receita" : "text-marca-texto-suave"}`}>
                  {u.ativo ? "Ativo" : "Inativo"}
                </span>
                <span className="text-xs text-marca-texto-suave">
                  {new Date(u.criadoEm).toLocaleDateString("pt-BR")}
                </span>
                <div className="flex items-center gap-1.5 justify-start md:justify-end">
                  <button
                    type="button"
                    onClick={() => setSenhaForm({ id: u.id, nova: "" })}
                    className="px-2.5 py-1.5 rounded-lg border border-marca-borda text-xs text-marca-texto-suave hover:bg-marca-fundo transition"
                  >
                    Redefinir senha
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAtivo(u)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                      u.ativo
                        ? "border border-despesa/30 text-despesa hover:bg-despesa-soft"
                        : "border border-receita/30 text-receita hover:bg-receita-soft"
                    }`}
                  >
                    {u.ativo ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
