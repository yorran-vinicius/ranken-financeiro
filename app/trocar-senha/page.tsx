"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TrocarSenhaPage() {
  const router = useRouter();
  const [novaSenha, setNovaSenha]       = useState("");
  const [confirmar, setConfirmar]       = useState("");
  const [erro, setErro]                 = useState<string | null>(null);
  const [enviando, setEnviando]         = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (novaSenha.length < 6) { setErro("Senha deve ter ao menos 6 caracteres."); return; }
    if (novaSenha !== confirmar) { setErro("As senhas não coincidem."); return; }
    setEnviando(true);
    try {
      const resp = await fetch("/api/auth/trocar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaSenha }),
      });
      const dados = await resp.json();
      if (!resp.ok) { setErro(dados.erro ?? "Erro ao salvar"); return; }
      router.push("/");
    } catch {
      setErro("Erro de conexão");
    } finally {
      setEnviando(false);
    }
  }

  const inputCls =
    "mt-1 w-full px-3 py-2.5 rounded-lg border border-marca-borda bg-white focus:outline-none focus:ring-2 focus:ring-marca-preto text-sm";

  return (
    <div className="min-h-screen bg-marca-fundo flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-marca-preto text-white font-black text-lg">
            R
          </span>
          <span className="font-bold tracking-tight text-marca-texto text-xl">
            RANKEN <span className="text-marca-texto-suave font-normal">Financeiro</span>
          </span>
        </div>

        <form
          onSubmit={salvar}
          className="bg-white border border-marca-borda rounded-2xl p-6 space-y-4"
        >
          <div>
            <h1 className="text-lg font-bold text-marca-texto">Defina sua senha</h1>
            <p className="text-sm text-marca-texto-suave mt-0.5">
              Este é seu primeiro acesso. Escolha uma senha pessoal.
            </p>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-marca-texto-suave">Nova senha</span>
            <input
              type="password"
              autoComplete="new-password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className={inputCls}
              placeholder="mínimo 6 caracteres"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-marca-texto-suave">Confirmar senha</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              className={inputCls}
              placeholder="repita a senha"
            />
          </label>

          {erro && (
            <p className="text-sm text-despesa" role="alert">{erro}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-marca-preto text-white font-medium py-2.5 rounded-lg transition hover:opacity-90 disabled:opacity-50"
          >
            {enviando ? "Salvando..." : "Salvar senha e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
