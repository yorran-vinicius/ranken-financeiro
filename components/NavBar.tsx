"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", rotulo: "Dashboard" },
  { href: "/lancamentos", rotulo: "Lançamentos" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="bg-marca-preto text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
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
        </nav>
      </div>
    </header>
  );
}
