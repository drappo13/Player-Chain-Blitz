// Minimal service worker — clears all caches, never stores anything, forces network
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((c) => c.postMessage({ type: 'SW_ACTIVATED' })))
  );
});

// Pass everything straight to network — never cache, never intercept
self.addEventListener('fetch', () => {});
