"use client";

// O conteúdo do Relatório do Investidor foi migrado para Análise → sub-aba "Investidor".
// Esta página redireciona automaticamente para manter compatibilidade de links existentes.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RelatorioPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/analise");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <p className="text-sm text-marca-texto-suave">
        Redirecionando para Análise…
      </p>
    </div>
  );
}
