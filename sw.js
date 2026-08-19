// NOTE: /version.json is deliberately NOT precached — it is the freshness
// probe the update self-check reads, and must always come from the network.
const CACHE = 'homerun-practice-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/changelog.html',
  '/version.js',
  '/versionCompat.js',
  '/changelog.js',
  '/uiModal.js',
  '/feedback.js',
  '/appUpdates.js',
  '/shell.js',
  '/practice.js',
  '/src/drills-data.js',
  '/styles.css',
  '/brand/crest.png',
  '/brand/icon-180.png',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
