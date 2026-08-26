/* ============================================================
   sw.js — Service Worker for Vertex Tutorial CBT PWA
   ============================================================ */

'use strict';

const CACHE_VERSION = 'v1.20.43';
const STATIC_CACHE  = `static-${CACHE_VERSION}`;
const CDN_CACHE     = `cdn-${CACHE_VERSION}`;

let _isFirstInstall = false;

const BYPASS_ORIGINS = [
  'firestore.googleapis.com',
  'firebaseapp.com',
  'googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebase.googleapis.com',
  'cloudfunctions.net',
  'fcm.googleapis.com',
  'fcmregistrations.googleapis.com',
  'www.gstatic.com',
  'fonts.gstatic.com',
];

const CDN_ORIGINS = [
  'cdn.tailwindcss.com',
  'cdn.jsdelivr.net',
];

/* ─────────────────────────────────────────────────────────── */
/* INSTALL                                                    */
/* ─────────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  _isFirstInstall = (self.registration.active === null);

  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      const coreAssets = [
        '/',
        '/index.html',
        '/offline.html',
        '/manifest.json',
        '/css/main.css',
        '/css/studyroom.css',
        '/js/config.js',
        '/js/state.js',
        '/js/ui.js',
        '/js/auth.js',
        '/js/chat.js',
        '/js/dm.js',
        '/js/tasks.js',
        '/js/teacher.js',
        '/js/exam.js',
        '/js/studyroom.js',
        '/js/threedclass.js',
        '/js/threedclass-periodic.js',
        '/js/threedclass-biology.js',
        '/js/threedclass-physics.js',
        '/js/game.js',
        '/js/landing.js',
        '/js/app.js',
        '/js/notifications.js',
        '/js/installPrompt.js',
        '/data/questions.js',
        '/news-ticker.css',
        '/news-ticker.js',
      ];

      const optionalAssets = [
        '/IMG_4512.png',
        '/vertex.jpeg',
      ];

      const corePromise = cache.addAll(coreAssets);
      const optionalPromises = optionalAssets.map(url =>
        cache.add(url).catch(err => {
          console.warn(`[SW] Optional asset not cached: ${url}`, err.message);
        })
      );

      return Promise.all([corePromise, ...optionalPromises]);
    })
  );
});

/* ─────────────────────────────────────────────────────────── */
/* ACTIVATE                                                   */
/* ─────────────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  const validCaches = [STATIC_CACHE, CDN_CACHE];

  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => !validCaches.includes(key))
            .map(key => {
              console.log(`[SW] Deleting outdated cache: ${key}`);
              return caches.delete(key);
            })
        )
      )
      .then(() => {
        if (_isFirstInstall) {
          console.log('[SW] First install — claiming clients.');
          return self.clients.claim();
        }
        console.log('[SW] Update activated — not claiming existing clients.');
      })
  );
});

/* ─────────────────────────────────────────────────────────── */
/* FETCH                                                      */
/* ─────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.pathname === '/sw.js') return;

  if (
    url.pathname === '/english.html' ||
    url.pathname === '/physics.html'
  ) {
    event.respondWith(fetch(request));
    return;
  }

  if (BYPASS_ORIGINS.some(origin => url.hostname.includes(origin))) return;

  if (!url.protocol.startsWith('http')) return;

  if (CDN_ORIGINS.some(origin => url.hostname.includes(origin))) {
    event.respondWith(_staleWhileRevalidate(request, CDN_CACHE));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(_navigationHandler(request));
    return;
  }

  event.respondWith(_cacheFirst(request));
});

/* ─────────────────────────────────────────────────────────── */
/* MESSAGE                                                    */
/* ─────────────────────────────────────────────────────────── */
self.addEventListener('message', event => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'GET_VERSION') {
    event.source.postMessage({ type: 'VERSION', version: CACHE_VERSION });
  }
});

/* ─────────────────────────────────────────────────────────── */
/* PUSH NOTIFICATIONS                                         */
/* ─────────────────────────────────────────────────────────── */
self.addEventListener('push', function (event) {
  var data = {};
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    data = { title: 'Vertex Tutorial', body: event.data ? event.data.text() : '' };
  }

  var title   = data.title   || 'Vertex Tutorial';
  var options = {
    body:               data.body    || 'You have a new message.',
    icon:               '/vertex.jpeg',
    badge:              '/vertex.jpeg',
    requireInteraction: true,
    actions: [
      { action: 'open',    title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss'  },
    ],
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  var targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('pushsubscriptionchange', function (event) {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: 'BL43uSEQeh09fAtjR-H-GXoEAASmljn7vaszJDxtp8vPA1wFjhmqd9UrE35aPmsQEE-uBVpSr3uL1cB5oSBx0qs',
    })
    .then(function (newSub) {
      return fetch('https://vertex-worker.gbemigaakinde.workers.dev/api/save-subscription', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId:       event.oldSubscription
            ? new URL(event.oldSubscription.endpoint).pathname.split('/').pop()
            : 'unknown',
          subscription: newSub.toJSON(),
        }),
      });
    })
    .catch(function (err) {
      console.warn('[SW] pushsubscriptionchange re-subscribe failed:', err);
    })
  );
});

/* ─────────────────────────────────────────────────────────── */
/* Strategies                                                 */
/* ─────────────────────────────────────────────────────────── */

async function _cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: false });
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    console.warn(`[SW] Cache-first network failure: ${request.url}`);
    return new Response('Asset unavailable offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function _staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then(networkResponse => {
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);

  return cached || networkFetch;
}

async function _navigationHandler(request) {
  const url = new URL(request.url);

  if (
    url.pathname === '/english.html' ||
    url.pathname === '/physics.html'
  ) {
    return fetch(request);
  }

  try {
    const cachedShell = await caches.match('/index.html');
    if (cachedShell) return cachedShell;

    return await fetch(request);
  } catch (err) {
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;

    return new Response(
      '<!DOCTYPE html><html><head><title>Offline</title></head><body>' +
      '<h1>You are offline.</h1><p>Please check your connection and reload.</p>' +
      '</body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
