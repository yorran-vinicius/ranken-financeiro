"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const ITENS = [
  { href: "/",            rotulo: "Dashboard"    },
  { href: "/analise",     rotulo: "Análise"      },
  { href: "/lancamentos", rotulo: "Lançamentos"  },
  { href: "/importar",    rotulo: "Importar PDF" },
  { href: "/relatorio",   rotulo: "Relatório"    },
];

export default function NavBar() {
  const pathname = usePathname();
  const router   = useRouter();
  const usuario  = useAuth();

  if (pathname === "/login" || pathname === "/trocar-senha") return null;

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="hidden md:block bg-marca-preto text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white text-marca-preto font-black tracking-tight">
            R
          </span>
          <span className="font-bold tracking-tight">
            RANKEN <span className="text-white/60 font-normal">Financeiro</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {ITENS.map((item) => {
            const ativo = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm transition ${
                  ativo
                    ? "bg-white text-marca-preto"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                {item.rotulo}
              </Link>
            );
          })}
          {usuario?.perfil === "master" && (
            <Link
              href="/configuracoes"
              className={`px-3 py-1.5 rounded-md text-sm transition ${
                pathname === "/configuracoes"
                  ? "bg-white text-marca-preto"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              Configurações
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {usuario && (
            <span className="hidden sm:block text-sm text-white/70">
              {usuario.nome}
              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-white/60 uppercase tracking-wide">
                {usuario.perfil}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={sair}
            className="px-3 py-1.5 rounded-md text-sm text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
