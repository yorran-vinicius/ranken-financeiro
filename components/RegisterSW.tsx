"use client";

import { useEffect } from "react";

/** Registra o Service Worker uma vez após a montagem. Renderiza null. */
export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("[SW] Falha ao registrar:", err));
    }
  }, []);
  return null;
}
