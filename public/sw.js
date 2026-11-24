/* GN Care service worker: offline app shell. Bump VERSION when you change shell files. */
const VERSION = 'gn-care-v27';
try { importScripts('/remind.js'); } catch (e) { /* reminders are optional */ }
const SHELL = [
  '/', '/index.html', '/offline.html', '/styles.css?v=27', '/deals.css?v=27', '/app.js?v=27', '/config.js', '/consent.js', '/ads.js', '/label.js', '/products.js', '/catalog.json', '/deals.json', '/picks.js?v=27', '/deals.js', '/skin-knowledge.js', '/ondevice.js', '/facescan.js', '/remind.js',
  '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'
];
const NETWORK_FIRST = ['/config.js', '/ads.js', '/products.js', '/catalog.json', '/deals.json', '/consent.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'gn-remind').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req, fallbackUrl) {
  return fetch(req)
    .then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })
    .catch(() => caches.match(req).then((m) => m || (fallbackUrl ? caches.match(fallbackUrl) : Response.error())));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; /* never touch ad or font requests */

  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, '/offline.html')); return; }
  if (NETWORK_FIRST.includes(url.pathname)) { e.respondWith(networkFirst(req)); return; }

  e.respondWith(
    caches.match(req).then((cached) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});

function tellClients() {
  return clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => list.forEach((c) => c.postMessage({ type: 'gn-remind' })));
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  const tag = data.tag || e.notification.tag || '';
  /* Done / Snooze act in place, without opening the app. */
  if ((e.action === 'done' || e.action === 'snooze') && self.GNRemind) {
    e.waitUntil(self.GNRemind.onAction(e.action, tag).then(tellClients).catch(() => {}));
    return;
  }
  const url = data.url || '/#routine';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.includes(self.location.origin) && 'focus' in c) { c.navigate && c.navigate(url); return c.focus(); } }
    return clients.openWindow(url);
  }));
});

/* Chrome may wake an installed PWA a few times a day; we then show whatever reminder is due. */
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'gn-reminders' && self.GNRemind) e.waitUntil(self.GNRemind.periodic(self.registration));
});
