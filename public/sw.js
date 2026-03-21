const CACHE_NAME = 'medevac-v3.1.0';
const BACKUP_CACHE = 'medevac-patient-backups';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: precache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== BACKUP_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for static, network-first for data
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip external requests except Google Fonts
  if (url.origin !== self.location.origin &&
      !url.hostname.includes('fonts.googleapis.com') &&
      !url.hostname.includes('fonts.gstatic.com')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Listen for patient data backup messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'BACKUP_PATIENTS') {
    const { data, timestamp } = event.data;
    caches.open(BACKUP_CACHE).then((cache) => {
      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', 'X-Backup-Time': timestamp },
      });
      cache.put(`/backup/${timestamp}`, response);

      // Keep only last 3 backups
      cache.keys().then((keys) => {
        const sorted = keys.sort((a, b) => a.url.localeCompare(b.url));
        while (sorted.length > 3) {
          cache.delete(sorted.shift());
        }
      });
    });
  }

  if (event.data && event.data.type === 'GET_BACKUP') {
    caches.open(BACKUP_CACHE).then((cache) => {
      cache.keys().then((keys) => {
        if (keys.length === 0) {
          event.ports[0].postMessage(null);
          return;
        }
        const latest = keys.sort((a, b) => b.url.localeCompare(a.url))[0];
        cache.match(latest).then((resp) => resp.json()).then((data) => {
          event.ports[0].postMessage(data);
        });
      });
    });
  }
});
