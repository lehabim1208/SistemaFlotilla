
const CACHE_NAME = 'driveflow-v2-cache';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/types.ts',
  '/constants.tsx',
  '/metadata.json'
];

// Instalación: Cacheamos los recursos estáticos y los módulos críticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando recursos principales y librerías');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activación: Limpiamos cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Intercepción de peticiones (Network Proxy)
self.addEventListener('fetch', (event) => {
  // No cachear llamadas a la API de Supabase o Google GenAI (estas se manejan por la cola de sincronización en App.tsx)
  if (event.request.url.includes('supabase.co') || event.request.url.includes('googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Si está en caché, lo devolvemos inmediatamente (Velocidad instantánea)
      if (cachedResponse) {
        return cachedResponse;
      }

      // Si no está en caché (ej: una librería nueva de esm.sh), la buscamos en red y la guardamos
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic' && !event.request.url.includes('esm.sh')) {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Si falla la red y no hay caché (Offline total sin recursos), podrías devolver una página de error amigable aquí
      });
    })
  );
});
