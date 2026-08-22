// NOTE: /version.json is deliberately NOT precached — it is the freshness
// probe the update self-check reads, and must always come from the network.
//
// CACHE embeds APP_VERSION on purpose. This worker is cache-first (see the
// fetch handler below), so a browser only re-installs it when sw.js's own
// bytes change — a deploy that leaves this literal untouched serves the old
// precache forever, no matter what else shipped. Bump it every release
// alongside APP_VERSION (checklist in docs/VERSIONING.md; enforced by the
// "sw.js CACHE" test in tests/versionCompat.test.js).
const CACHE = 'homerun-practice-v1.5';
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
