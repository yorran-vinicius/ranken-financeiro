"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "ranken:install-banner-v1";

type Plataforma = "ios" | "android";

// Evento beforeinstallprompt (não está nos tipos padrão do TS)
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function BannerInstalar() {
  const [visivel,       setVisivel]       = useState(false);
  const [plataforma,    setPlataforma]    = useState<Plataforma | null>(null);
  const [promptEvento,  setPromptEvento]  = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Já dispensou o banner antes → não mostrar
    if (localStorage.getItem(STORAGE_KEY)) return;

    const ua    = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua);

    if (isIOS) {
      // Não mostrar se já está instalado em modo standalone
      if ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone) return;
      setPlataforma("ios");
      setVisivel(true);
      return;
    }

    // Android / desktop Chrome: aguarda beforeinstallprompt
    function onPrompt(e: Event) {
      e.preventDefault();
      setPromptEvento(e as BeforeInstallPromptEvent);
      setPlataforma("android");
      setVisivel(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function fechar() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisivel(false);
  }

  async function instalar() {
    if (!promptEvento) { fechar(); return; }
    await promptEvento.prompt();
    const { outcome } = await promptEvento.userChoice;
    if (outcome === "accepted") fechar();
  }

  if (!visivel) return null;

  return (
    <div
      role="banner"
      className="fixed top-0 inset-x-0 z-[60] flex items-center gap-3 bg-marca-preto text-white px-4 py-3 shadow-lg"
    >
      {/* Mini-logo */}
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white text-marca-preto font-black text-sm shrink-0 select-none">
        R
      </span>

      {/* Texto (muda por plataforma) */}
      <p className="flex-1 min-w-0 text-sm text-white/90 leading-snug">
        {plataforma === "ios" ? (
          <>
            Instale o app: toque em{" "}
            <span className="font-semibold">Compartilhar</span>{" "}
            <span aria-hidden="true">⎋</span>{" "}
            e depois em{" "}
            <span className="font-semibold">Adicionar à Tela de Início</span>
          </>
        ) : (
          <>
            <span className="font-semibold">RANKEN Financeiro</span>
            {" "}— instale na tela inicial para acesso rápido
          </>
        )}
      </p>

      {/* Botão Instalar (só Android — iOS instrui via texto) */}
      {plataforma === "android" && promptEvento && (
        <button
          type="button"
          onClick={instalar}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-white text-marca-preto text-xs font-semibold hover:opacity-90 active:scale-95 transition"
        >
          Instalar
        </button>
      )}

      {/* Fechar */}
      <button
        type="button"
        onClick={fechar}
        aria-label="Fechar aviso de instalação"
        className="shrink-0 p-1 text-white/50 hover:text-white transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className="w-4 h-4">
          <line x1="18" y1="6"  x2="6"  y2="18"/>
          <line x1="6"  y1="6"  x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}
