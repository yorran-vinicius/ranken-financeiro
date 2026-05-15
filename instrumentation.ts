export async function register() {
  // Roda apenas no runtime Node.js (não no edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { garantirTabelas } = await import("./lib/db");
      await garantirTabelas();
      console.log("[RANKEN] Banco de dados inicializado.");
    } catch (err) {
      console.error("[RANKEN] Erro ao inicializar banco:", err);
    }
  }
}
