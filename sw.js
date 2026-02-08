
const CACHE_NAME = 'driveflow-v4-core';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/metadata.json'
];

// Instalación: Cacheamos el núcleo de la App
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activación: Limpieza de versiones antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
  self.clients.claim();
});

// Intercepción de peticiones: Soporte Offline Total
self.addEventListener('fetch', (event) => {
  // No cachear peticiones a Supabase para evitar datos fantasmas
  if (event.request.url.includes('supabase.co')) return;

  // Manejo de navegación (Recargas de página)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Estrategia: Cache First para assets y librerías externas
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((response) => {
        // Cachear dinámicamente librerías de esm.sh y fuentes
        if (response.status === 200 && (event.request.url.includes('esm.sh') || event.request.url.includes('fonts.googleapis.com'))) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        // Fallback silencioso si no hay red ni cache
      });
    })
  );
});
