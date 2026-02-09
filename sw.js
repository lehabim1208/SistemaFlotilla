
const CACHE_NAME = 'driveflow-v5-permanent';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/metadata.json',
  '/index.tsx',
  '/App.tsx',
  '/types.ts',
  '/constants.tsx',
  '/components/UI.tsx',
  '/components/Badge.tsx',
  '/pages/Dashboard.tsx',
  '/pages/DriverManagement.tsx',
  '/pages/RoleGenerator.tsx',
  '/pages/Superadmin.tsx',
  '/pages/History.tsx',
  '/pages/Settings.tsx',
  '/pages/Scanner.tsx',
  '/pages/Download.tsx'
];

// Instalación: Cacheamos TODO el código fuente
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Creando búnker de archivos...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activación
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

// Intercepción Inteligente
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // No cachear llamadas directas a la base de datos Supabase
  if (url.hostname.includes('supabase.co')) return;

  // Manejo de navegación (Recargas de página)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Estrategia: Cache First con Network Update
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Devolvemos el cache pero intentamos actualizarlo en segundo plano para la próxima vez
        fetch(event.request).then(response => {
          if (response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
          }
        }).catch(() => {}); 
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // Guardar dinámicamente cualquier script o asset nuevo (como librerías de esm.sh)
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        // Fallback para imágenes si no hay red ni cache
        if (event.request.destination === 'image') {
          return new Response('<svg>...</svg>', { headers: { 'Content-Type': 'image/svg+xml' } });
        }
      });
    })
  );
});
