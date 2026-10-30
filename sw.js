/* Service worker: funzionamento offline + promemoria in background (dove supportato) */
const CACHE = 'scadenzario-v1.0.1';
const FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rete prima per le pagine (così gli aggiornamenti arrivano subito), cache prima per il resto
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow(e.notification.data?.url || './');
    })
  );
});

/* Promemoria in background (Chrome/Edge con app installata) */
function leggiAperte() {
  return new Promise((resolve) => {
    const req = indexedDB.open('scadenzario', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onerror = () => resolve([]);
    req.onsuccess = () => {
      const db = req.result;
      const g = db.transaction('kv').objectStore('kv').get('aperte');
      g.onsuccess = () => { resolve(g.result || []); db.close(); };
      g.onerror = () => { resolve([]); db.close(); };
    };
  });
}
function diffGiorni(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - oggi) / 86400000);
}
self.addEventListener('periodicsync', (e) => {
  if (e.tag !== 'controllo-scadenze') return;
  e.waitUntil(leggiAperte().then((arr) => {
    const urgenti = arr.filter((s) => diffGiorni(s.data) <= (Number(s.preavviso) || 0));
    if (!urgenti.length) return;
    const scadute = urgenti.filter((s) => diffGiorni(s.data) < 0).length;
    return self.registration.showNotification(
      urgenti.length === 1 ? urgenti[0].titolo : `${urgenti.length} scadenze da gestire`,
      {
        body: (scadute ? `${scadute} scadute · ` : '') + urgenti.slice(0, 3).map((s) => s.titolo).join(', '),
        tag: 'riepilogo', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './#dashboard' }
      }
    );
  }));
});
