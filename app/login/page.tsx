"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin]   = useState("");
  const [senha, setSenha]   = useState("");
  const [erro, setErro]     = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login.trim(), senha }),
      });
      const dados = await resp.json();
      if (!resp.ok) {
        setErro(dados.erro ?? "Falha ao entrar");
        return;
      }
      if (dados.deveAtualizarSenha) {
        router.push("/trocar-senha");
      } else {
        router.push("/");
      }
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
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-marca-preto text-white font-black text-lg tracking-tight">
            R
          </span>
          <span className="font-bold tracking-tight text-marca-texto text-xl">
            RANKEN <span className="text-marca-texto-suave font-normal">Financeiro</span>
          </span>
        </div>

        <form
          onSubmit={entrar}
          className="bg-white border border-marca-borda rounded-2xl p-6 space-y-4"
        >
          <h1 className="text-lg font-bold text-marca-texto">Entrar</h1>

          <label className="block">
            <span className="text-xs font-medium text-marca-texto-suave">Login</span>
            <input
              type="text"
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className={inputCls}
              placeholder="seu login"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-marca-texto-suave">Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={inputCls}
              placeholder="••••••"
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
            {enviando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
