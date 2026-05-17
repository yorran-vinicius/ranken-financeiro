"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { Usuario, CategoriaDB } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

type Aba = "usuarios" | "categorias" | "geral";

const inputCls =
  "mt-1 w-full px-3 py-2 rounded-lg border border-marca-borda bg-white focus:outline-none focus:ring-2 focus:ring-marca-preto text-sm";
const labelCls = "text-xs font-medium text-marca-texto-suave";

// ─── Aba Usuários ─────────────────────────────────────────────────────────────

function AbaUsuarios() {
  const [usuarios, setUsuarios]         = useState<Usuario[]>([]);
  const [carregando, setCarregando]     = useState(true);
  const [sucesso, setSucesso]           = useState<string | null>(null);
  const [erro, setErro]                 = useState<string | null>(null);

  const [novoAberto, setNovoAberto]     = useState(false);
  const [novo, setNovo]                 = useState({ login: "", nome: "", perfil: "editor" as "master" | "editor", senha: "" });
  const [enviandoNovo, setEnviandoNovo] = useState(false);

  const [editando, setEditando]         = useState<Usuario | null>(null);
  const [editForm, setEditForm]         = useState({ login: "", nome: "", perfil: "editor" as "master" | "editor" });
  const [enviandoEdit, setEnviandoEdit] = useState(false);

  const [senhaForm, setSenhaForm]       = useState<{ id: string; nova: string } | null>(null);
  const [enviandoSenha, setEnviandoSenha] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const resp = await fetch("/api/usuarios");
    const dados = await resp.json();
    setUsuarios(Array.isArray(dados) ? dados : []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function flash(msg: string) {
    setSucesso(msg);
    setTimeout(() => setSucesso(null), 3500);
  }

  async function toggleAtivo(u: Usuario) {
    const resp = await fetch(`/api/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !u.ativo }),
    });
    if (resp.ok) { flash(u.ativo ? `${u.nome} desativado.` : `${u.nome} ativado.`); carregar(); }
  }

  async function criarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setEnviandoNovo(true); setErro(null);
    const resp = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novo),
    });
    const dados = await resp.json();
    setEnviandoNovo(false);
    if (!resp.ok) { setErro(dados.erro ?? "Erro ao criar"); return; }
    setNovoAberto(false);
    setNovo({ login: "", nome: "", perfil: "editor", senha: "" });
    flash(`Usuário ${dados.nome} criado.`);
    carregar();
  }

  function abrirEditar(u: Usuario) {
    setEditando(u);
    setEditForm({ login: u.login, nome: u.nome, perfil: u.perfil });
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setEnviandoEdit(true); setErro(null);
    const resp = await fetch(`/api/usuarios/${editando.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const dados = await resp.json();
    setEnviandoEdit(false);
    if (!resp.ok) { setErro(dados.erro ?? "Erro ao salvar"); return; }
    setEditando(null);
    flash("Usuário atualizado.");
    carregar();
  }

  async function redefinirSenha(e: React.FormEvent) {
    e.preventDefault();
    if (!senhaForm) return;
    setEnviandoSenha(true); setErro(null);
    const resp = await fetch(`/api/usuarios/${senhaForm.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ novaSenha: senhaForm.nova }),
    });
    const dados = await resp.json();
    setEnviandoSenha(false);
    if (!resp.ok) { setErro(dados.erro ?? "Erro ao redefinir"); return; }
    setSenhaForm(null);
    flash("Senha redefinida. O usuário deverá trocá-la no próximo acesso.");
    carregar();
  }

  return (
    <div className="space-y-4">
      {sucesso && <div className="bg-receita-soft border border-receita/20 rounded-lg px-4 py-2.5 text-sm text-receita">{sucesso}</div>}
      {erro    && <div className="bg-despesa-soft border border-despesa/20 rounded-lg px-4 py-2.5 text-sm text-despesa">{erro}</div>}

      <div className="flex justify-end">
        <button onClick={() => setNovoAberto(true)}
          className="px-4 py-2 rounded-lg bg-marca-preto text-white text-sm font-medium hover:opacity-90 transition">
          + Novo usuário
        </button>
      </div>

      {/* Modal: novo usuário */}
      {novoAberto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNovoAberto(false)} />
          <form onSubmit={criarUsuario}
            className="relative bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-marca-texto">Novo usuário</h2>
            <label className="block">
              <span className={labelCls}>Nome completo</span>
              <input type="text" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                className={inputCls} placeholder="Ex: Ana Lima" required />
            </label>
            <label className="block">
              <span className={labelCls}>Login</span>
              <input type="text" value={novo.login}
                onChange={(e) => setNovo({ ...novo, login: e.target.value.toLowerCase().replace(/\s/g, "") })}
                className={inputCls} placeholder="ana.lima" required />
            </label>
            <label className="block">
              <span className={labelCls}>Perfil</span>
              <select value={novo.perfil} onChange={(e) => setNovo({ ...novo, perfil: e.target.value as "master" | "editor" })}
                className={inputCls}>
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
            <div className="flex gap-3">
              <button type="button" onClick={() => setNovoAberto(false)}
                className="flex-1 py-2 rounded-lg border border-marca-borda text-sm text-marca-texto-suave hover:bg-marca-fundo transition">Cancelar</button>
              <button type="submit" disabled={enviandoNovo}
                className="flex-1 py-2 rounded-lg bg-marca-preto text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
                {enviandoNovo ? "Criando..." : "Criar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: editar usuário */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditando(null)} />
          <form onSubmit={salvarEdicao}
            className="relative bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-marca-texto">Editar usuário</h2>
            <label className="block">
              <span className={labelCls}>Nome completo</span>
              <input type="text" value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                className={inputCls} required />
            </label>
            <label className="block">
              <span className={labelCls}>Login</span>
              <input type="text" value={editForm.login}
                onChange={(e) => setEditForm({ ...editForm, login: e.target.value.toLowerCase().replace(/\s/g, "") })}
                className={inputCls} required />
            </label>
            <label className="block">
              <span className={labelCls}>Perfil</span>
              <select value={editForm.perfil} onChange={(e) => setEditForm({ ...editForm, perfil: e.target.value as "master" | "editor" })}
                className={inputCls}>
                <option value="editor">Editor</option>
                <option value="master">Master</option>
              </select>
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditando(null)}
                className="flex-1 py-2 rounded-lg border border-marca-borda text-sm text-marca-texto-suave hover:bg-marca-fundo transition">Cancelar</button>
              <button type="submit" disabled={enviandoEdit}
                className="flex-1 py-2 rounded-lg bg-marca-preto text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
                {enviandoEdit ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: redefinir senha */}
      {senhaForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSenhaForm(null)} />
          <form onSubmit={redefinirSenha}
            className="relative bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-marca-texto">Redefinir senha</h2>
            <label className="block">
              <span className={labelCls}>Nova senha (mín. 6 caracteres)</span>
              <input type="password" value={senhaForm.nova}
                onChange={(e) => setSenhaForm({ ...senhaForm, nova: e.target.value })}
                className={inputCls} placeholder="••••••" required minLength={6} />
            </label>
            <p className="text-[11px] text-marca-texto-suave">O usuário deverá trocar a senha no próximo acesso.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setSenhaForm(null)}
                className="flex-1 py-2 rounded-lg border border-marca-borda text-sm text-marca-texto-suave hover:bg-marca-fundo transition">Cancelar</button>
              <button type="submit" disabled={enviandoSenha}
                className="flex-1 py-2 rounded-lg bg-marca-preto text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
                {enviandoSenha ? "Salvando..." : "Redefinir"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      {carregando ? (
        <div className="bg-white border border-marca-borda rounded-2xl p-8 text-center text-marca-texto-suave text-sm">Carregando...</div>
      ) : (
        <div className="bg-white border border-marca-borda rounded-2xl overflow-hidden">
          <div className="hidden md:grid md:grid-cols-[1fr_130px_90px_110px_auto] gap-3 px-5 py-3 bg-marca-fundo text-xs font-medium uppercase tracking-wide text-marca-texto-suave">
            <span>Nome / Login</span><span>Perfil</span><span>Status</span><span>Cadastro</span><span />
          </div>
          <ul className="divide-y divide-marca-borda">
            {usuarios.map((u) => (
              <li key={u.id} className={`px-5 py-4 flex flex-col md:grid md:grid-cols-[1fr_130px_90px_110px_auto] gap-3 md:items-center ${!u.ativo ? "opacity-50" : ""}`}>
                <div>
                  <p className="text-sm font-medium text-marca-texto">{u.nome}</p>
                  <p className="text-xs text-marca-texto-suave mt-0.5">{u.login}</p>
                </div>
                <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  u.perfil === "master" ? "bg-neutral-900 text-white border-neutral-900" : "bg-neutral-100 text-neutral-600 border-neutral-200"
                }`}>{u.perfil === "master" ? "Master" : "Editor"}</span>
                <span className={`text-xs font-medium ${u.ativo ? "text-receita" : "text-marca-texto-suave"}`}>
                  {u.ativo ? "Ativo" : "Inativo"}
                </span>
                <span className="text-xs text-marca-texto-suave">{new Date(u.criadoEm).toLocaleDateString("pt-BR")}</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-start md:justify-end">
                  <button onClick={() => abrirEditar(u)}
                    className="px-2.5 py-1.5 rounded-lg border border-marca-borda text-xs text-marca-texto-suave hover:bg-marca-fundo transition">
                    Editar
                  </button>
                  <button onClick={() => setSenhaForm({ id: u.id, nova: "" })}
                    className="px-2.5 py-1.5 rounded-lg border border-marca-borda text-xs text-marca-texto-suave hover:bg-marca-fundo transition">
                    Redefinir senha
                  </button>
                  <button onClick={() => toggleAtivo(u)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                      u.ativo ? "border border-despesa/30 text-despesa hover:bg-despesa-soft" : "border border-receita/30 text-receita hover:bg-receita-soft"
                    }`}>
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

// ─── Aba Categorias ───────────────────────────────────────────────────────────

function AbaCategorias() {
  const [categorias, setCategorias]     = useState<CategoriaDB[]>([]);
  const [carregando, setCarregando]     = useState(true);
  const [filtroTipo, setFiltroTipo]     = useState<"receita" | "despesa">("receita");
  const [sucesso, setSucesso]           = useState<string | null>(null);
  const [erro, setErro]                 = useState<string | null>(null);

  const [novaAberta, setNovaAberta]     = useState(false);
  const [novaNome, setNovaNome]         = useState("");
  const [enviandoNova, setEnviandoNova] = useState(false);

  const [renomeando, setRenomeando]     = useState<CategoriaDB | null>(null);
  const [novoNome, setNovoNome]         = useState("");
  const [enviandoRen, setEnviandoRen]   = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const resp = await fetch("/api/configuracoes/categorias");
    const dados = await resp.json();
    setCategorias(Array.isArray(dados) ? dados : []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const visiveis = categorias.filter((c) => c.tipo === filtroTipo).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));

  function flash(msg: string) {
    setSucesso(msg);
    setTimeout(() => setSucesso(null), 3000);
  }

  async function toggleAtivo(c: CategoriaDB) {
    const resp = await fetch(`/api/configuracoes/categorias/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !c.ativo }),
    });
    if (resp.ok) { flash(c.ativo ? `"${c.nome}" desativada.` : `"${c.nome}" ativada.`); carregar(); }
  }

  async function adicionarCategoria(e: React.FormEvent) {
    e.preventDefault();
    setEnviandoNova(true); setErro(null);
    const resp = await fetch("/api/configuracoes/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: filtroTipo, nome: novaNome }),
    });
    const dados = await resp.json();
    setEnviandoNova(false);
    if (!resp.ok) { setErro(dados.erro ?? "Erro ao criar"); return; }
    setNovaAberta(false); setNovaNome("");
    flash(`Categoria "${dados.nome}" criada.`);
    carregar();
  }

  async function renomear(e: React.FormEvent) {
    e.preventDefault();
    if (!renomeando) return;
    setEnviandoRen(true); setErro(null);
    const resp = await fetch(`/api/configuracoes/categorias/${renomeando.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novoNome }),
    });
    const dados = await resp.json();
    setEnviandoRen(false);
    if (!resp.ok) { setErro(dados.erro ?? "Erro ao renomear"); return; }
    setRenomeando(null); setNovoNome("");
    flash("Categoria renomeada.");
    carregar();
  }

  return (
    <div className="space-y-4">
      {sucesso && <div className="bg-receita-soft border border-receita/20 rounded-lg px-4 py-2.5 text-sm text-receita">{sucesso}</div>}
      {erro    && <div className="bg-despesa-soft border border-despesa/20 rounded-lg px-4 py-2.5 text-sm text-despesa">{erro}</div>}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {(["receita", "despesa"] as const).map((t) => (
            <button key={t} onClick={() => setFiltroTipo(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                filtroTipo === t ? "bg-marca-preto text-white border-marca-preto" : "bg-white text-marca-texto-suave border-marca-borda hover:bg-marca-fundo"
              }`}>
              {t === "receita" ? "Receitas" : "Despesas"}
            </button>
          ))}
        </div>
        <button onClick={() => setNovaAberta(true)}
          className="px-4 py-2 rounded-lg bg-marca-preto text-white text-sm font-medium hover:opacity-90 transition">
          + Nova categoria
        </button>
      </div>

      {/* Modal: nova categoria */}
      {novaAberta && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNovaAberta(false)} />
          <form onSubmit={adicionarCategoria}
            className="relative bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-marca-texto">
              Nova categoria de {filtroTipo === "receita" ? "receita" : "despesa"}
            </h2>
            <label className="block">
              <span className={labelCls}>Nome</span>
              <input type="text" value={novaNome} onChange={(e) => setNovaNome(e.target.value)}
                className={inputCls} placeholder="Ex: Premiações" required />
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setNovaAberta(false)}
                className="flex-1 py-2 rounded-lg border border-marca-borda text-sm text-marca-texto-suave hover:bg-marca-fundo transition">Cancelar</button>
              <button type="submit" disabled={enviandoNova}
                className="flex-1 py-2 rounded-lg bg-marca-preto text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
                {enviandoNova ? "Criando..." : "Criar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: renomear */}
      {renomeando && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRenomeando(null)} />
          <form onSubmit={renomear}
            className="relative bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-marca-texto">Renomear categoria</h2>
            <label className="block">
              <span className={labelCls}>Novo nome</span>
              <input type="text" value={novoNome} onChange={(e) => setNovoNome(e.target.value)}
                className={inputCls} placeholder={renomeando.nome} required />
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setRenomeando(null)}
                className="flex-1 py-2 rounded-lg border border-marca-borda text-sm text-marca-texto-suave hover:bg-marca-fundo transition">Cancelar</button>
              <button type="submit" disabled={enviandoRen}
                className="flex-1 py-2 rounded-lg bg-marca-preto text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
                {enviandoRen ? "Salvando..." : "Renomear"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      {carregando ? (
        <div className="bg-white border border-marca-borda rounded-2xl p-8 text-center text-marca-texto-suave text-sm">Carregando...</div>
      ) : (
        <div className="bg-white border border-marca-borda rounded-2xl overflow-hidden">
          <ul className="divide-y divide-marca-borda">
            {visiveis.length === 0 && (
              <li className="px-5 py-8 text-center text-marca-texto-suave text-sm">Nenhuma categoria.</li>
            )}
            {visiveis.map((c) => (
              <li key={c.id} className={`px-5 py-3.5 flex items-center justify-between gap-3 ${!c.ativo ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-2.5">
                  <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${c.tipo === "receita" ? "bg-receita" : "bg-despesa"}`} />
                  <span className="text-sm text-marca-texto">{c.nome}</span>
                  {!c.ativo && <span className="text-[10px] font-semibold text-marca-texto-suave bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded">Inativa</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => { setRenomeando(c); setNovoNome(c.nome); }}
                    className="px-2.5 py-1.5 rounded-lg border border-marca-borda text-xs text-marca-texto-suave hover:bg-marca-fundo transition">
                    Renomear
                  </button>
                  <button onClick={() => toggleAtivo(c)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                      c.ativo ? "border border-despesa/30 text-despesa hover:bg-despesa-soft" : "border border-receita/30 text-receita hover:bg-receita-soft"
                    }`}>
                    {c.ativo ? "Desativar" : "Ativar"}
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

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? "bg-marca-preto" : "bg-neutral-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function FeatureCard({
  label, desc, checked, onChange, children,
}: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <div className={`border rounded-xl transition-colors ${checked ? "border-marca-borda" : "border-dashed border-neutral-200"}`}>
      <div className="flex items-center justify-between px-4 py-3.5 gap-4">
        <div>
          <p className="text-sm font-semibold text-marca-texto">{label}</p>
          <p className="text-xs text-marca-texto-suave mt-0.5">{desc}</p>
        </div>
        <Toggle checked={checked} onChange={onChange} />
      </div>
      {checked && children && (
        <div className="px-4 pb-4 border-t border-marca-borda/50 pt-3 space-y-3">{children}</div>
      )}
    </div>
  );
}

// ─── Aba Geral ────────────────────────────────────────────────────────────────

function AbaGeral() {
  // Config básica
  const [nomeApp, setNomeApp]           = useState("RANKEN Financeiro");
  const [moeda, setMoeda]               = useState("R$");
  const [formatoData, setFormatoData]   = useState("dd/mm/aaaa");
  // Funcionalidades
  const [funcMetas, setFuncMetas]             = useState(false);
  const [metaAnual, setMetaAnual]             = useState("300000");
  const [funcEquilibrio, setFuncEquilibrio]   = useState(false);
  const [custoFixo, setCustoFixo]             = useState("20000");
  const [funcCidade, setFuncCidade]           = useState(false);
  const [cidades, setCidades]                 = useState("Maringá,Londrina,Curitiba,Geral");
  const [funcPdf, setFuncPdf]                 = useState(false);
  const [funcAlertas, setFuncAlertas]         = useState(false);
  const [alertasLimites, setAlertasLimites]   = useState<Record<string, string>>({});
  const [catsDespesa, setCatsDespesa]         = useState<CategoriaDB[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando]     = useState(false);
  const [sucesso, setSucesso]       = useState<string | null>(null);
  const [erro, setErro]             = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/configuracoes/geral").then((r) => r.json()),
      fetch("/api/configuracoes/categorias?tipo=despesa").then((r) => r.json()),
    ]).then(([dados, cats]) => {
      setNomeApp(dados.nome_app     ?? "RANKEN Financeiro");
      setMoeda(dados.moeda          ?? "R$");
      setFormatoData(dados.formato_data ?? "dd/mm/aaaa");
      setFuncMetas(dados.func_metas === "true");
      setMetaAnual(dados.meta_anual ?? "300000");
      setFuncEquilibrio(dados.func_equilibrio === "true");
      setCustoFixo(dados.custo_fixo_mensal ?? "20000");
      setFuncCidade(dados.func_cidade === "true");
      setCidades(dados.cidades ?? "Maringá,Londrina,Curitiba,Geral");
      setFuncPdf(dados.func_pdf === "true");
      setFuncAlertas(dados.func_alertas === "true");
      try {
        const lim = JSON.parse(dados.alertas_limites ?? "{}");
        const str: Record<string, string> = {};
        for (const [k, v] of Object.entries(lim)) str[k] = String(v);
        setAlertasLimites(str);
      } catch { setAlertasLimites({}); }
      setCatsDespesa(Array.isArray(cats) ? cats.filter((c: CategoriaDB) => c.ativo) : []);
      setCarregando(false);
    });
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true); setErro(null);

    const alertasJSON: Record<string, number> = {};
    for (const [cat, val] of Object.entries(alertasLimites)) {
      const n = Number(String(val).replace(",", "."));
      if (Number.isFinite(n) && n > 0) alertasJSON[cat] = n;
    }

    const body = {
      nome_app: nomeApp, moeda, formato_data: formatoData,
      func_metas:         String(funcMetas),
      meta_anual:         metaAnual,
      func_equilibrio:    String(funcEquilibrio),
      custo_fixo_mensal:  custoFixo,
      func_cidade:        String(funcCidade),
      cidades,
      func_pdf:           String(funcPdf),
      func_alertas:       String(funcAlertas),
      alertas_limites:    JSON.stringify(alertasJSON),
    };

    const resp = await fetch("/api/configuracoes/geral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const dados = await resp.json();
    setEnviando(false);
    if (!resp.ok) { setErro(dados.erro ?? "Erro ao salvar"); return; }
    setSucesso("Configurações salvas com sucesso.");
    setTimeout(() => setSucesso(null), 3500);
  }

  if (carregando) {
    return <div className="bg-white border border-marca-borda rounded-2xl p-8 text-center text-marca-texto-suave text-sm">Carregando...</div>;
  }

  return (
    <form onSubmit={salvar} className="space-y-6 max-w-lg">
      {sucesso && <div className="bg-receita-soft border border-receita/20 rounded-lg px-4 py-2.5 text-sm text-receita">{sucesso}</div>}
      {erro    && <div className="bg-despesa-soft border border-despesa/20 rounded-lg px-4 py-2.5 text-sm text-despesa">{erro}</div>}

      {/* Config básica */}
      <div className="bg-white border border-marca-borda rounded-2xl p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-marca-texto-suave">Preferências gerais</p>

        <label className="block">
          <span className={labelCls}>Nome do app</span>
          <input type="text" value={nomeApp} onChange={(e) => setNomeApp(e.target.value)} className={inputCls} required />
        </label>

        <label className="block">
          <span className={labelCls}>Moeda</span>
          <select value={moeda} onChange={(e) => setMoeda(e.target.value)} className={inputCls}>
            <option value="R$">R$ — Real Brasileiro</option>
            <option value="US$">US$ — Dólar Americano</option>
            <option value="€">€ — Euro</option>
          </select>
        </label>

        <label className="block">
          <span className={labelCls}>Formato de data</span>
          <select value={formatoData} onChange={(e) => setFormatoData(e.target.value)} className={inputCls}>
            <option value="dd/mm/aaaa">dd/mm/aaaa (padrão pt-BR)</option>
            <option value="mm/dd/aaaa">mm/dd/aaaa (EUA)</option>
            <option value="aaaa-mm-dd">aaaa-mm-dd (ISO 8601)</option>
          </select>
        </label>
      </div>

      {/* Funcionalidades */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-marca-texto-suave px-1">Funcionalidades</p>

        {/* 1. Painel de Metas */}
        <FeatureCard
          label="Painel de Metas"
          desc="Acompanhe o progresso da meta de receita anual com barra de progresso e projeção."
          checked={funcMetas}
          onChange={setFuncMetas}
        >
          <label className="block">
            <span className={labelCls}>Meta anual (R$)</span>
            <input type="number" min="0" step="1000" value={metaAnual}
              onChange={(e) => setMetaAnual(e.target.value)} className={inputCls} />
          </label>
        </FeatureCard>

        {/* 2. Ponto de Equilíbrio */}
        <FeatureCard
          label="Ponto de Equilíbrio"
          desc="Mostra se a receita do mês cobre o custo fixo mensal configurado."
          checked={funcEquilibrio}
          onChange={setFuncEquilibrio}
        >
          <label className="block">
            <span className={labelCls}>Custo fixo mensal (R$)</span>
            <input type="number" min="0" step="100" value={custoFixo}
              onChange={(e) => setCustoFixo(e.target.value)} className={inputCls} />
          </label>
        </FeatureCard>

        {/* 3. Filtro por Cidade */}
        <FeatureCard
          label="Filtro por Cidade"
          desc="Adiciona campo cidade nos lançamentos e filtro no dashboard."
          checked={funcCidade}
          onChange={setFuncCidade}
        >
          <label className="block">
            <span className={labelCls}>Cidades disponíveis (separadas por vírgula)</span>
            <input type="text" value={cidades} onChange={(e) => setCidades(e.target.value)}
              placeholder="Maringá,Londrina,Curitiba,Geral" className={inputCls} />
          </label>
          <p className="text-[11px] text-marca-texto-suave">Exemplo: Maringá,Londrina,Curitiba,Geral</p>
        </FeatureCard>

        {/* 4. Exportar PDF */}
        <FeatureCard
          label="Exportar Relatório PDF"
          desc="Exibe botão no dashboard para exportar relatório mensal em PDF para reuniões."
          checked={funcPdf}
          onChange={setFuncPdf}
        />

        {/* 5. Alertas Automáticos */}
        <FeatureCard
          label="Alertas Automáticos"
          desc="Alerta visual quando os gastos de uma categoria ultrapassarem o limite configurado."
          checked={funcAlertas}
          onChange={setFuncAlertas}
        >
          <p className="text-xs text-marca-texto-suave">Limite mensal por categoria de despesa (deixe em branco para sem limite):</p>
          {catsDespesa.length === 0 ? (
            <p className="text-xs text-marca-texto-suave italic">Nenhuma categoria de despesa ativa.</p>
          ) : (
            <div className="space-y-2">
              {catsDespesa.map((cat) => (
                <div key={cat.id} className="flex items-center gap-3">
                  <span className="text-sm text-marca-texto flex-1">{cat.nome}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-marca-texto-suave">R$</span>
                    <input
                      type="number" min="0" step="100"
                      value={alertasLimites[cat.nome] ?? ""}
                      onChange={(e) =>
                        setAlertasLimites((prev) => ({
                          ...prev,
                          [cat.nome]: e.target.value,
                        }))
                      }
                      placeholder="Sem limite"
                      className="w-32 px-2.5 py-1.5 rounded-lg border border-marca-borda text-sm focus:outline-none focus:ring-2 focus:ring-marca-preto"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </FeatureCard>
      </div>

      <button type="submit" disabled={enviando}
        className="w-full py-2.5 rounded-lg bg-marca-preto text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
        {enviando ? "Salvando..." : "Salvar configurações"}
      </button>
    </form>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "usuarios",   rotulo: "Usuários"   },
  { id: "categorias", rotulo: "Categorias" },
  { id: "geral",      rotulo: "Geral"      },
];

export default function ConfiguracoesPage() {
  const router  = useRouter();
  const usuario = useAuth();
  const [aba, setAba] = useState<Aba>("usuarios");

  useEffect(() => {
    if (usuario !== null && usuario?.perfil !== "master") {
      router.push("/");
    }
  }, [usuario, router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-marca-texto">Configurações</h1>
        <p className="text-sm text-marca-texto-suave">Gerencie usuários, categorias e preferências do app.</p>
      </div>

      {/* Abas */}
      <div className="flex border-b border-marca-borda">
        {ABAS.map((a) => (
          <button key={a.id} type="button" onClick={() => setAba(a.id)}
            className={`py-3 mr-5 text-sm font-medium border-b-2 transition ${
              aba === a.id ? "border-marca-preto text-marca-preto" : "border-transparent text-marca-texto-suave hover:text-marca-preto"
            }`}>
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === "usuarios"   && <AbaUsuarios />}
      {aba === "categorias" && <AbaCategorias />}
      {aba === "geral"      && <AbaGeral />}
    </div>
  );
}
