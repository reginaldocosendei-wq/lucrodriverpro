/* Lucro Driver Service Worker — v1.1 */

const CACHE_VERSION = 'lucro-driver-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const PRECACHE_URLS = [
  './',
  './manifest.json',
  './icon.svg',
  './images/icon-192.png',
  './images/icon-512.png',
];

/* ── INSTALL: precache shell ─────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {})
    )
  );
  self.skipWaiting();
});

/* ── ACTIVATE: clean old caches ─────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('lucro-driver-') && k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ── FETCH: smart caching strategy ──────────────────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* Skip: non-GET, cross-origin external, browser-extension, Replit WS/HMR */
  if (
    request.method !== 'GET' ||
    !url.protocol.startsWith('http') ||
    url.pathname.startsWith('/@') ||
    url.pathname.includes('__vite') ||
    url.pathname.includes('node_modules')
  ) {
    return;
  }

  /* API calls → always network, no cache */
  if (url.pathname.includes('/api/')) {
    return;
  }

  /* Navigation requests (HTML pages) → network-first, fallback to shell */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => res)
        .catch(() => caches.match('./').then((r) => r || fetch(request)))
    );
    return;
  }

  /* Static assets: JS, CSS, images, fonts → stale-while-revalidate */
  const isStaticAsset =
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2?|ttf|ico|webp)(\?.*)?$/) !== null;

  if (isStaticAsset) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => cached);

          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  /* Everything else → network with runtime cache fallback */
  event.respondWith(
    caches.open(RUNTIME_CACHE).then((cache) =>
      fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cache.match(request))
    )
  );
});

/* ── MESSAGE: handle SKIP_WAITING from main thread ──────── */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
