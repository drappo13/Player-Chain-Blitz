// Minimal service worker — clears all caches, never stores anything, forces network.
// Also shows push notifications (daily reminders).
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  // No reload message any more: an update to this file shouldn't refresh open tabs mid-game.
  e.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Pass everything straight to network — never cache, never intercept
self.addEventListener('fetch', () => {});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(
    self.registration.showNotification(d.title || 'drapk.in', {
      body: d.body || "Today's set is ready",
      icon: '/icon-192.png',
      tag: d.tag || 'daily',
      data: { url: d.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
