const CACHE_NAME = 'scripture-helper-v8';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './standard_works.txt'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(response => response || fetch(e.request)));
});
