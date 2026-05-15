"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { SessionData } from "@/lib/auth";

type UsuarioAtual = Omit<SessionData, never> | null;

const AuthCtx = createContext<UsuarioAtual>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioAtual>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setUsuario)
      .catch(() => setUsuario(null));
  }, []);

  return <AuthCtx.Provider value={usuario}>{children}</AuthCtx.Provider>;
}

export function useAuth(): UsuarioAtual {
  return useContext(AuthCtx);
}
