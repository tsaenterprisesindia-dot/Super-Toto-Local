const CACHE = 'super-toto-v2';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isCacheable = (request, url) =>
  request.method === 'GET' &&
  url.origin === self.location.origin &&
  !url.pathname.startsWith('/api') &&
  !url.pathname.startsWith('/socket.io');

const cachePut = (request, response) =>
  caches.open(CACHE).then((cache) => cache.put(request, response.clone()));

const networkFirst = (request) =>
  fetch(request)
    .then((response) => {
      if (response && response.ok) cachePut(request, response);
      return response;
    })
    .catch(() =>
      caches.match(request).then((cached) => cached || caches.match('/index.html'))
    );

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (!isCacheable(request, url)) return;

  const isNavigate = request.mode === 'navigate' || request.destination === 'document';

  if (isNavigate) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request)
        .then((response) => {
          if (response && response.ok) cachePut(request, response);
          return response;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});