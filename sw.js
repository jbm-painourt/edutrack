// ─── SERVICE WORKER v2.1 ─────────────────────────────────────────────────────
const CACHE_NAME    = 'edutrack-v2.1';
const OFFLINE_URL   = 'index.html';

// files to cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/app.js',
  '/config.js',
  '/supabase.js',
  '/sync.js',
  '/principal.js',
  '/teacher.js',
  '/parent.js',
  'https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr/dist/jsQR.js'
];

// ─── INSTALL ─────────────────────────────────────────────────────────────────
self.addEventListener('install', function(event) {
  console.log('[SW] Installing v2.1');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function() {
      // force activate immediately without waiting for old SW to die
      return self.skipWaiting();
    }).catch(function(err) {
      console.warn('[SW] Precache failed (some files may be missing):', err);
      return self.skipWaiting();
    })
  );
});

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating v2.1');
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME;
        }).map(function(key) {
          console.log('[SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      );
    }).then(function() {
      // take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // ── SUPABASE API calls — NEVER cache, always network ──────────────────────
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(function() {
        // supabase offline — return empty JSON so app handles it gracefully
        return new Response(JSON.stringify([]), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // ── CDN requests — network first, cache fallback ───────────────────────────
  if (url.hostname.includes('jsdelivr.net') ||
      url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // ── App files — cache first, network fallback ──────────────────────────────
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        // serve from cache immediately
        // also fetch in background to update cache (stale-while-revalidate)
        const networkFetch = fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        }).catch(function() { /* offline — already serving from cache */ });

        return cached;
      }

      // not in cache — try network
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(function() {
        // network failed and not cached — serve index.html as fallback
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ─── MESSAGE HANDLER ─────────────────────────────────────────────────────────
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});