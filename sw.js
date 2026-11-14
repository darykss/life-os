// Service worker : rend l'app utilisable hors ligne.
// Stratégie « réseau d'abord » : on prend toujours la dernière version en ligne,
// et on retombe sur le cache quand il n'y a pas de connexion.
const VERSION = 'v5';
// Un cache par app : plusieurs versions peuvent cohabiter sur le même domaine sans se gêner.
const SCOPE = new URL('./', self.location.href).pathname;
const CACHE = 'shell-' + VERSION + '-' + SCOPE;
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'quotes.js', 'targets.js', 'extra.js', 'shell.js', 'app.js', 'seances.html', 'quote-bg.jpg', 'agenda-script.txt', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && (k.endsWith('-' + SCOPE) || (k.startsWith('lifeos-shell') && SCOPE.includes('life-os')))).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Les appels à Google (agenda) et à GitHub (actualités) ne passent pas par le cache.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
