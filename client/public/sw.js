// Cache-busting service worker — forces fresh fetches for HTML
const CACHE_VERSION = 'v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((name) => caches.delete(name)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // For navigation requests (HTML pages), always fetch from network
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' }).catch(() => caches.match(e.request))
    );
    return;
  }

  // For everything else, network-first with fallback
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
