/*
 * Service worker voor offline spelen.
 * De precache-lijst en het versienummer hieronder worden tijdens de build
 * ingevuld met de echte bestandsnamen, inclusief hun hash.
 * Zie de plugin in vite.config.ts.
 */

const VERSION = '523be94a92c7';
const CACHE = `rekenrace-${VERSION}`;
const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "assets/index-Dh2Kgkad.css",
  "assets/index-DJ8FJhvW.js"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // Meteen actief worden; de app heeft geen state die een oude worker nodig heeft.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/*
 * ignoreVary staat overal aan. De server stuurt `Vary: Origin` mee, en een module-
 * script of stylesheet vraagt met een Origin-header terwijl de precache-fetch dat
 * niet deed. Zonder ignoreVary mist de cache precies die bestanden en start de app
 * offline zonder CSS en JS.
 */
const MATCH = { ignoreVary: true };

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigaties krijgen altijd de gecachete startpagina: de app start zo ook offline.
  // De scope-URL en index.html zijn aparte cache-keys, dus we proberen ze allebei.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches
        .match('./', MATCH)
        .then((cached) => cached ?? caches.match('index.html', MATCH))
        .then((cached) => cached ?? fetch(request))
        .catch(() => caches.match('index.html', MATCH)),
    );
    return;
  }

  // Alle assets hebben een hash in hun naam, dus cache-first is veilig.
  event.respondWith(
    caches.match(request, MATCH).then((cached) => {
      if (cached !== undefined) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
