/* ============================================================
   sw.js — Service Worker for Vertex Tutorial CBT PWA
   Strategy:
     - Static shell   : Cache-first (precached at install)
     - CDN assets     : Stale-while-revalidate (separate cache)
     - Firebase/Auth  : Bypass entirely — never intercepted
     - Navigation     : Cache-first with offline fallback

   UPDATE v2:
   - Added FCM background message handler and notificationclick
     handler directly in this file. This is required because
     notifications.js now passes THIS sw.js registration to
     getToken() via serviceWorkerRegistration, so FCM uses
     this SW for background messages instead of auto-registering
     firebase-messaging-sw.js as a competing SW on the same
     scope. firebase-messaging-sw.js is now redundant and can
     be kept as a fallback or removed.
   ============================================================ */

'use strict';

/* ── FCM SDK must be imported before firebase.initializeApp() ── */
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

/* ── Initialize Firebase inside this SW (required for FCM) ── */
firebase.initializeApp({
  apiKey:            'AIzaSyCQk1Q5GyCVo3cKNcHaYHVzAnVeWlqkzns',
  authDomain:        'excellencecbt.firebaseapp.com',
  projectId:         'excellencecbt',
  storageBucket:     'excellencecbt.firebasestorage.app',
  messagingSenderId: '24170253162',
  appId:             '1:24170253162:web:6e6cb86c5ffc84aebaf313',
});

const _fcmMessaging = firebase.messaging();

const CACHE_VERSION = 'v1.1.7';
const STATIC_CACHE  = `static-${CACHE_VERSION}`;
const CDN_CACHE     = `cdn-${CACHE_VERSION}`;

/*
 * Track whether this is a first-time install (no previous SW controller).
 * Used in activate to decide whether clients.claim() is safe to call.
 * claim() on a first install is safe — the page has no Firestore state yet.
 * claim() on an update would take over mid-session pages and corrupt
 * Firestore's IndexedDB lock, causing all db reads/writes to hang.
 */
let _isFirstInstall = false;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/config.js',
  '/js/state.js',
  '/js/ui.js',
  '/js/auth.js',
  '/js/chat.js',
  '/js/tasks.js',
  '/js/teacher.js',
  '/js/exam.js',
  '/js/app.js',
  '/js/notifications.js',
  '/data/questions.js',
  '/news-ticker.css',
  '/news-ticker.js',
];

/*
 * These origins are never intercepted by this service worker.
 * Firebase, Google APIs, and FCM endpoints are all bypassed
 * so they always go straight to the network.
 */
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
];

const CDN_ORIGINS = [
  'cdn.tailwindcss.com',
  'www.gstatic.com',
];

/* ─────────────────────────────────────────────────────────── */
/* INSTALL                                                    */
/* ─────────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  /*
   * Reliable first-install detection:
   * If no SW is currently controlling any clients, this is a first install.
   * self.registration.active is null on first install and non-null on updates.
   */
  _isFirstInstall = (self.registration.active === null);

  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      const coreAssets = [
        '/',
        '/index.html',
        '/offline.html',
        '/manifest.json',
        '/css/styles.css',
        '/js/config.js',
        '/js/state.js',
        '/js/ui.js',
        '/js/auth.js',
        '/js/chat.js',
        '/js/tasks.js',
        '/js/teacher.js',
        '/js/exam.js',
        '/js/app.js',
        '/js/notifications.js',
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
        /*
         * clients.claim() is only safe on first install.
         *
         * On first install there are no open pages with Firestore state,
         * so claiming them is safe and ensures the SW controls the page
         * that triggered the install without requiring a reload.
         *
         * On updates, the new SW is already serving new navigations
         * (because skipWaiting was called only after user confirmation).
         * Claiming existing clients here would interrupt active exam
         * sessions and corrupt Firestore's IndexedDB lock on those pages.
         */
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
    /*
     * User confirmed the update toast. Activate now.
     * The controllerchange event in index.html will reload the page,
     * giving the user a clean session under the new SW.
     */
    self.skipWaiting();
  }

  if (event.data.type === 'GET_VERSION') {
    event.source.postMessage({ type: 'VERSION', version: CACHE_VERSION });
  }
});

/* ─────────────────────────────────────────────────────────── */
/* FCM BACKGROUND MESSAGES                                    */
/* ─────────────────────────────────────────────────────────── */

/*
 * Fires when a push notification arrives and the app tab is
 * closed or in the background (not focused).
 * The notification payload should include:
 *   notification.title — headline shown in the OS tray
 *   notification.body  — message text
 *   data.url           — optional URL to open on tap
 */
_fcmMessaging.onBackgroundMessage(function (payload) {
  console.log('[SW] Background message received:', payload);

  const title = (payload.notification && payload.notification.title)
    || 'Vertex Tutorial';

  const options = {
    body:  (payload.notification && payload.notification.body)
           || 'You have a new message from Master Timothy.',
    icon:  '/vertex.jpeg',
    badge: '/vertex.jpeg',
    data:  { url: (payload.data && payload.data.url) || '/' },
  };

  self.registration.showNotification(title, options);
});

/*
 * Opens (or focuses) the app when the user taps a notification.
 */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      /* If the app is already open, focus it */
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      /* Otherwise open a new window */
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
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
