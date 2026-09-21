const CACHE = 'countryballs-shell-v3';
const BALLS = ['br', 'pt', 'ar', 'us', 'jp', 'de', 'fr', 'it'].map(country => `/arenas/ball-${country}.png`);
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/arenas/orbital.webp', '/arenas/island.webp', '/arenas/street.webp', ...BALLS];
self.addEventListener('install', event => { self.skipWaiting(); event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))); });
self.addEventListener('activate', event => event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()])));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); void caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(cached => cached ?? caches.match('/'))));
});
