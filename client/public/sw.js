// Minimal service worker — clears all caches, never stores anything, forces network.
// Also shows push notifications (daily reminders).
const SW_VERSION = 'push-2';
self.addEventListener('install', () => self.skipWaiting());

// Debug: tell a page which version is running, and remember the last push we got.
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'version' && e.ports[0]) e.ports[0].postMessage(SW_VERSION);
});
const notePush = (info) =>
  caches.open('pcb-debug').then((c) => c.put('/last-push', new Response(JSON.stringify({ at: new Date().toISOString(), ...info }))));

self.addEventListener('activate', (e) => {
  // No reload message any more: an update to this file shouldn't refresh open tabs mid-game.
  e.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== 'pcb-debug').map((n) => caches.delete(n))))
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
      .then(() => notePush({ shown: true, title: d.title || '' }))
      .catch((err) => notePush({ shown: false, error: String(err) }))
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
