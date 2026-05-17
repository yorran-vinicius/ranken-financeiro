"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import ModalLancamento from "./ModalLancamento";

/* Ícones SVG inline */
function IconHome() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-5 h-5">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconList() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-5 h-5">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className="w-6 h-6">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export default function ClientLayout() {
  const pathname = usePathname();
  const [modalAberto, setModalAberto] = useState(false);
  const [toast, setToast] = useState(false);

  /* Não renderiza em rotas de auth */
  const rotasOcultas = ["/login", "/trocar-senha"];
  if (rotasOcultas.some((r) => pathname.startsWith(r))) return null;

  function abrirModal() { setModalAberto(true); }
  function fecharModal() { setModalAberto(false); }

  function aoSalvar() {
    setModalAberto(false);
    setToast(true);
    window.dispatchEvent(new CustomEvent("ranken:lancamento-adicionado"));
    setTimeout(() => setToast(false), 3000);
  }

  const navLinks = [
    { href: "/",             label: "Dashboard",   icon: <IconHome /> },
    { href: "/lancamentos",  label: "Lançamentos",  icon: <IconList /> },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* ── Botão flutuante "+" — desktop (escondido em mobile, pois tem a nav bar) ── */}
      <button
        onClick={abrirModal}
        aria-label="Novo lançamento"
        className="hidden sm:flex fixed bottom-6 right-6 z-40 items-center justify-center w-14 h-14 rounded-full bg-marca-preto text-white shadow-lg hover:opacity-90 transition-opacity"
      >
        <IconPlus />
      </button>

      {/* ── Barra de navegação inferior — mobile ── */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-marca-borda flex items-center justify-around h-16 px-4">
        {/* Dashboard */}
        <Link
          href={navLinks[0].href}
          className={`flex flex-col items-center gap-0.5 text-xs font-medium transition-colors ${
            isActive(navLinks[0].href) ? "text-marca-preto" : "text-marca-texto-suave"
          }`}
        >
          {navLinks[0].icon}
          <span>{navLinks[0].label}</span>
        </Link>

        {/* Botão "+" central */}
        <button
          onClick={abrirModal}
          aria-label="Novo lançamento"
          className="flex items-center justify-center w-14 h-14 rounded-full bg-marca-preto text-white shadow-md hover:opacity-90 transition-opacity -mt-5"
        >
          <IconPlus />
        </button>

        {/* Lançamentos */}
        <Link
          href={navLinks[1].href}
          className={`flex flex-col items-center gap-0.5 text-xs font-medium transition-colors ${
            isActive(navLinks[1].href) ? "text-marca-preto" : "text-marca-texto-suave"
          }`}
        >
          {navLinks[1].icon}
          <span>{navLinks[1].label}</span>
        </Link>
      </nav>

      {/* ── Modal de novo lançamento ── */}
      {modalAberto && (
        <ModalLancamento
          onFechar={fecharModal}
          onSalvo={aoSalvar}
        />
      )}

      {/* ── Toast de confirmação ── */}
      {toast && (
        <div className="fixed bottom-24 sm:bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-receita text-white px-5 py-3 rounded-full shadow-lg text-sm font-medium animate-fade-in-up pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="w-4 h-4">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Lançamento adicionado!
        </div>
      )}
    </>
  );
}
