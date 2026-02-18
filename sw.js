/* ============================================================
   sw.js — Service Worker for Excellence Tutorial CBT PWA
   Strategy:
     - Static shell   : Cache-first (precached at install)
     - CDN assets     : Stale-while-revalidate (separate cache)
     - Firebase/Auth  : Bypass entirely — never intercepted
     - Navigation     : Cache-first with offline fallback
   ============================================================ */

'use strict';

/* ── Version — increment this on every deployment ── */
const CACHE_VERSION    = 'v1.0.0';
const STATIC_CACHE     = `static-${CACHE_VERSION}`;
const CDN_CACHE        = `cdn-${CACHE_VERSION}`;

/* ── Static assets to precache at install ── */
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
  '/data/questions.js',
  '/news-ticker.css',
  '/news-ticker.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/IMG_4512.png',
];

/* ── Domains that must NEVER be intercepted ── */
const BYPASS_ORIGINS = [
  'firestore.googleapis.com',
  'firebaseapp.com',
  'googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebase.googleapis.com',
  'cloudfunctions.net',
];

/* ── CDN origins to cache with stale-while-revalidate ── */
const CDN_ORIGINS = [
  'cdn.tailwindcss.com',
  'www.gstatic.com',
];

/* ─────────────────────────────────────────────────────────── */
/* INSTALL — Precache static shell                            */
/* ─────────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      /*
       * addAll() is atomic — if any asset fails, the install fails.
       * We use individual add() calls with error swallowing for
       * optional assets (icons that may not exist yet), and addAll()
       * only for guaranteed assets.
       */
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
        '/data/questions.js',
        '/news-ticker.css',
        '/news-ticker.js',
      ];

      const optionalAssets = [
        '/icons/icon-72x72.png',
        '/icons/icon-96x96.png',
        '/icons/icon-128x128.png',
        '/icons/icon-144x144.png',
        '/icons/icon-152x152.png',
        '/icons/icon-192x192.png',
        '/icons/icon-384x384.png',
        '/icons/icon-512x512.png',
        '/icons/icon-512x512-maskable.png',
        '/IMG_4512.png',
      ];

      const corePromise = cache.addAll(coreAssets);

      const optionalPromises = optionalAssets.map(url =>
        cache.add(url).catch(err => {
          console.warn(`[SW] Optional asset not cached: ${url}`, err.message);
        })
      );

      return Promise.all([corePromise, ...optionalPromises]);
    }).then(() => {
      /*
       * skipWaiting() causes the new SW to activate immediately
       * instead of waiting for all tabs to close.
       * The app.js update handler triggers a page reload after
       * this activates, ensuring users always get a fresh page.
       */
      return self.skipWaiting();
    })
  );
});

/* ─────────────────────────────────────────────────────────── */
/* ACTIVATE — Delete outdated caches                          */
/* ─────────────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  const validCaches = [STATIC_CACHE, CDN_CACHE];

  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => !validCaches.includes(key))
          .map(key => {
            console.log(`[SW] Deleting outdated cache: ${key}`);
            return caches.delete(key);
          })
      )
    ).then(() => {
      /*
       * clients.claim() lets the activated SW take control of
       * all open pages immediately without requiring a reload.
       * Combined with skipWaiting() in install, this ensures
       * the SW is always active and in sync.
       */
      return self.clients.claim();
    })
  );
});

/* ─────────────────────────────────────────────────────────── */
/* FETCH — Route requests                                     */
/* ─────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* ── 1. Bypass non-GET requests entirely ── */
  if (request.method !== 'GET') {
    return;
  }

  /* ── 2. Bypass Firebase / Firestore / Auth endpoints ── */
  if (BYPASS_ORIGINS.some(origin => url.hostname.includes(origin))) {
    return;
  }

  /* ── 3. Bypass chrome-extension and non-http(s) schemes ── */
  if (!url.protocol.startsWith('http')) {
    return;
  }

  /* ── 4. CDN assets — stale-while-revalidate ── */
  if (CDN_ORIGINS.some(origin => url.hostname.includes(origin))) {
    event.respondWith(_stalWhileRevalidate(request, CDN_CACHE));
    return;
  }

  /* ── 5. Navigation requests — cache-first with offline fallback ── */
  if (request.mode === 'navigate') {
    event.respondWith(_navigationHandler(request));
    return;
  }

  /* ── 6. Static assets — cache-first ── */
  event.respondWith(_cacheFirst(request));
});

/* ─────────────────────────────────────────────────────────── */
/* MESSAGE — Handle commands from app.js                      */
/* ─────────────────────────────────────────────────────────── */
self.addEventListener('message', event => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    /*
     * Called from app.js when the user acknowledges an update toast.
     * This causes the waiting SW to activate immediately.
     */
    self.skipWaiting();
  }

  if (event.data.type === 'GET_VERSION') {
    event.source.postMessage({ type: 'VERSION', version: CACHE_VERSION });
  }
});

/* ─────────────────────────────────────────────────────────── */
/* Strategy implementations                                   */
/* ─────────────────────────────────────────────────────────── */

/**
 * Cache-first: serve from cache, fall back to network.
 * On network success, update the cache entry.
 * On total failure, return a minimal error response.
 */
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
    console.warn(`[SW] Cache-first network failure for: ${request.url}`);
    return new Response('Asset unavailable offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * Stale-while-revalidate: serve from cache immediately (if available),
 * then fetch from network in the background to update the cache.
 * If nothing is cached, wait for the network.
 */
async function _stalWhileRevalidate(request, cacheName) {
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

/**
 * Navigation handler: serve index.html from cache for all navigation
 * requests (SPA pattern). Fall back to offline.html if not cached.
 *
 * We always serve /index.html for navigation because the app is a
 * single-page application — all routing is handled in JS.
 */
async function _navigationHandler(request) {
  try {
    /* Try the cache first — serve app shell immediately */
    const cachedShell = await caches.match('/index.html');
    if (cachedShell) return cachedShell;

    /* Not in cache — try the network */
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (err) {
    /* Network failed and not cached — serve offline fallback */
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;

    /* Absolute last resort */
    return new Response(
      '<!DOCTYPE html><html><head><title>Offline</title></head><body>' +
      '<h1>You are offline.</h1><p>Please check your connection and reload.</p>' +
      '</body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  }
}