/*******************************************************
 * SERVICE WORKER - Mis Finanzas PWA (tolerante)
 *******************************************************/

const CACHE_VERSION = 'v1.0.1';
const CACHE_NAME = 'finanzas-' + CACHE_VERSION;

const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
  // Los iconos se cachean on-demand cuando se piden
];

const API_HOST = 'script.google.com';

/********************* INSTALL *********************/

self.addEventListener('install', (event) => {
  console.log('[SW] Instalando', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cachear uno por uno, sin romper si alguno falla
      for (const url of SHELL) {
        try {
          await cache.add(url);
          console.log('[SW] ✓ Cacheado:', url);
        } catch (e) {
          console.warn('[SW] ✗ No se pudo cachear:', url, e.message);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

/********************* ACTIVATE *********************/

self.addEventListener('activate', (event) => {
  console.log('[SW] Activando', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k.startsWith('finanzas-') && k !== CACHE_NAME)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/********************* FETCH *********************/

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca interceptar la API
  if (url.hostname === API_HOST) return;

  // Solo GET
  if (event.request.method !== 'GET') return;

  // No cachear chrome-extension://, etc.
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cachear respuesta válida del mismo origen
        if (response && response.status === 200 &&
            response.type === 'basic' && url.origin === location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => 
        caches.match(event.request).then(r => 
          r || (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined)
        )
      )
  );
});

/********************* MENSAJES *********************/

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
