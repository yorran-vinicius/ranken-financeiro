"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import ModalLancamento from "./ModalLancamento";
import { useAuth } from "./AuthProvider";

/* ── Ícones SVG ─────────────────────────────────────────────────────────────── */
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

function IconChart() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-5 h-5">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4"  />
      <line x1="6"  y1="20" x2="6"  y2="14" />
      <line x1="2"  y1="20" x2="22" y2="20" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-5 h-5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className="w-6 h-6">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5"  y1="12" x2="19" y2="12" />
    </svg>
  );
}

/* ── Link de navegação inferior ─────────────────────────────────────────────── */
function NavLink({
  href, label, icon, ativo,
}: {
  href: string; label: string; icon: React.ReactNode; ativo: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors min-h-[48px] flex-1 ${
        ativo ? "text-marca-preto" : "text-marca-texto-suave"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

/* ── Componente principal ───────────────────────────────────────────────────── */
export default function ClientLayout() {
  const pathname = usePathname();
  const usuario  = useAuth();
  const [modalAberto, setModalAberto] = useState(false);
  const [toast, setToast]             = useState(false);

  // Não renderiza em rotas de auth
  const rotasOcultas = ["/login", "/trocar-senha"];
  if (rotasOcultas.some((r) => pathname.startsWith(r))) return null;

  function abrirModal()  { setModalAberto(true);  }
  function fecharModal() { setModalAberto(false); }

  function aoSalvar() {
    setModalAberto(false);
    setToast(true);
    window.dispatchEvent(new CustomEvent("ranken:lancamento-adicionado"));
    setTimeout(() => setToast(false), 3000);
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const isMaster = usuario?.perfil === "master";

  return (
    <>
      {/* ── Botão flutuante "+" — desktop (oculto em mobile) ── */}
      <button
        onClick={abrirModal}
        aria-label="Novo lançamento"
        className="hidden sm:flex fixed bottom-6 right-6 z-40 items-center justify-center w-14 h-14 rounded-full bg-marca-preto text-white shadow-lg hover:opacity-90 transition-opacity"
      >
        <IconPlus />
      </button>

      {/* ── Barra de navegação inferior — mobile ── */}
      <nav
        aria-label="Navegação principal"
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-marca-borda flex items-stretch h-16"
      >
        {/* Dashboard */}
        <NavLink
          href="/"
          label="Dashboard"
          icon={<IconHome />}
          ativo={isActive("/")}
        />

        {/* Lançamentos */}
        <NavLink
          href="/lancamentos"
          label="Lançamentos"
          icon={<IconList />}
          ativo={isActive("/lancamentos")}
        />

        {/* Botão "+" central destacado */}
        <div className="flex items-center justify-center flex-1">
          <button
            onClick={abrirModal}
            aria-label="Novo lançamento"
            className="flex items-center justify-center w-13 h-13 rounded-full bg-marca-preto text-white shadow-md hover:opacity-90 transition-opacity -mt-5"
            style={{ width: 52, height: 52 }}
          >
            <IconPlus />
          </button>
        </div>

        {/* Análise */}
        <NavLink
          href="/lancamentos"
          label="Análise"
          icon={<IconChart />}
          ativo={false}
        />

        {/* Configurações */}
        <NavLink
          href="/configuracoes"
          label={isMaster ? "Config." : "Config."}
          icon={<IconSettings />}
          ativo={isActive("/configuracoes")}
        />
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
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 sm:bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-receita text-white px-5 py-3 rounded-full shadow-lg text-sm font-medium animate-fade-in-up pointer-events-none whitespace-nowrap"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="w-4 h-4 shrink-0">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Lançamento adicionado!
        </div>
      )}
    </>
  );
}
