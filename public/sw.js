/* GN Care service worker: offline app shell. Bump VERSION when you change shell files. */
const VERSION = 'gn-care-v13';
const SHELL = [
  '/', '/index.html', '/offline.html', '/styles.css', '/app.js', '/config.js', '/consent.js', '/ads.js', '/label.js', '/products.js', '/catalog.json', '/picks.js', '/skin-knowledge.js', '/ondevice.js', '/facescan.js', '/remind.js',
  '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'
];
const NETWORK_FIRST = ['/config.js', '/ads.js', '/products.js', '/catalog.json', '/consent.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
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

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/#routine';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.includes(self.location.origin) && 'focus' in c) { c.navigate && c.navigate(url); return c.focus(); } }
    return clients.openWindow(url);
  }));
});

self.addEventListener('periodicsync', (e) => {
  if (e.tag !== 'gn-reminders') return;
  /* The page stores the schedule; the next app open also checks due reminders. */
  e.waitUntil(Promise.resolve());
});
