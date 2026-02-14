/* Service Worker - WifiHackX */
'use strict';

const CACHE_VERSION = 'wifihackx-v2.0.0';
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;
const CACHE_IMAGES = `${CACHE_VERSION}-images`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/fonts/inter-400.woff2',
  '/fonts/inter-600.woff2',
  '/fonts/russo-one-400.woff2',
  '/assets/icon-72.png',
  '/assets/icon-96.png',
  '/assets/icon-128.png',
  '/assets/icon-144.png',
  '/assets/icon-152.png',
  '/assets/icon-192.png',
  '/assets/icon-384.png',
  '/assets/icon-512.png',
  '/assets/apple-touch-icon.png',
  '/assets/favicon-32x32.png',
  '/assets/favicon-16x16.png',
  '/assets/og-preview.jpg',
  '/favicon.ico',
  '/manifest.webmanifest',
];

self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches
      .open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(
              name =>
                name.startsWith('wifihackx-') &&
                name !== CACHE_STATIC &&
                name !== CACHE_DYNAMIC &&
                name !== CACHE_IMAGES
            )
            .map(name => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (!event.data || typeof event.data !== 'object') return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames =>
        Promise.all(cacheNames.map(name => caches.delete(name)))
      )
    );
  }
});

self.addEventListener('fetch', event => {
  const { request } = event;

  if (!request || request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (
    url.origin !== location.origin ||
    url.origin.includes('firebase') ||
    url.origin.includes('googleapis')
  ) {
    return;
  }

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_DYNAMIC).then(cache => cache.put(request, responseClone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then(response => {
        if (response) return response;
        return fetch(request).then(fetchResponse =>
          caches.open(CACHE_STATIC).then(cache => {
            cache.put(request, fetchResponse.clone());
            return fetchResponse;
          })
        );
      })
    );
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(
      caches
        .match(request)
        .then(response => {
          if (response) return response;
          return fetch(request).then(fetchResponse => {
            if (fetchResponse.ok) {
              return caches.open(CACHE_IMAGES).then(cache => {
                cache.put(request, fetchResponse.clone());
                return fetchResponse;
              });
            }
            return fetchResponse;
          });
        })
        .catch(
          () =>
            new Response(
              '<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999">Image Offline</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            )
        )
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_DYNAMIC).then(cache => cache.put(request, responseClone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
