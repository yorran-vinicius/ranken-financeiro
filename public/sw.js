// RANKEN Financeiro — Service Worker
const CACHE = 'ranken-v1';
const URLS  = ['/', '/lancamentos', '/analise', '/relatorio', '/importar'];

// ── Install: pré-cache das rotas principais ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(URLS)),
  );
  // Ativa imediatamente sem esperar as abas antigas fecharem
  self.skipWaiting();
});

// ── Activate: remove caches de versões anteriores ────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
      ),
    ),
  );
  // Controla imediatamente os clientes abertos
  self.clients.claim();
});

// ── Fetch: network-first com fallback para cache ─────────────────────────────
self.addEventListener('fetch', (event) => {
  // Ignora requisições não-GET (POST, PUT, DELETE…)
  if (event.request.method !== 'GET') return;

  // Ignora extensões do browser e requisições cruzadas
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Ignora rotas de API (não faz sentido servir do cache)
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Atualiza o cache com a resposta fresca
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        // Offline: serve do cache
        caches.match(event.request),
      ),
  );
});
