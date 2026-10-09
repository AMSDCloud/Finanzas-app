/*******************************************************
 * SERVICE WORKER - Mis Finanzas PWA
 *******************************************************/

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = 'finanzas-' + CACHE_VERSION;

// Archivos del shell de la app (se cachean al instalar)
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Dominio de la API (nunca se cachea)
const API_HOST = 'script.google.com';

/********************* INSTALL *********************/

self.addEventListener('install', (event) => {
  console.log('[SW] Instalando', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
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

  // Nunca cachear la API
  if (url.hostname === API_HOST) {
    return; // dejar pasar el request sin interceptar
  }

  // Solo manejar GET
  if (event.request.method !== 'GET') return;

  // Estrategia: network-first para HTML/JS/CSS (siempre lo más nuevo),
  // cache fallback si está offline
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Guardar copia en cache
        if (response && response.status === 200 && url.origin === location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(r => r || caches.match('./index.html')))
  );
});

/********************* MENSAJES *********************/

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});