/* ============================================================
   sw.js — Service Worker for Vertex Tutorial CBT PWA
   ============================================================ */

'use strict';

const CACHE_VERSION = 'v1.23.1';
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
  'vertex-worker.gbemigaakinde.workers.dev',
];

const CDN_ORIGINS = [
  'cdn.tailwindcss.com',
  'cdn.jsdelivr.net',
];

/* ─────────────────────────────────────────────────────────── */
/* INSTALL                                                    */
/* ─────────────────────────────────────────────────────────── */
const CORE_ASSETS = [
  '/', '/index.html', '/offline.html', '/manifest.json',
  '/css/main.css', '/css/tailwind.css', '/css/voice-ui.css', '/css/studyroom.css',
  '/news-ticker.css', '/news-ticker.js',
  '/data/questions.js',
  '/js/config.js', '/js/state.js', '/js/svg-diagram.js', '/js/question-loader.js',
  '/js/ui.js', '/js/auth.js', '/js/chat.js', '/js/receipts.js', '/js/dm.js', '/js/groupchat.js', '/js/tasks.js',
  '/js/studyroom-md.js', '/js/studyroom.js',
  '/js/threedclass.js', '/js/threedclass-periodic.js', '/js/threedclass-biology.js',
  '/js/threedclass-physics.js', '/js/threedclass-live.js',
  '/js/student-sync.js', '/js/teacher-push.js', '/js/storage.js', '/viewer.js',
  '/js/filemanager.js', '/js/question-manager.js', '/js/teacher.js', '/js/speech.js',
  '/js/activitylog.js', '/js/exam.js', '/js/proctor.js', '/js/notifications.js', '/js/avatar.js',
  '/js/reactions.js', '/js/settings.js', '/js/session-reminders.js', '/js/msgnotif.js',
  '/js/game.js', '/js/landing.js', '/js/app.js', '/js/voice-notes.js', '/js/vendor/lame.min.js', '/js/vendor/mp3-worker.js', '/js/installPrompt.js',
];

const OPTIONAL_ASSETS = ['/vertex.jpeg', '/IMG_4512.png'];

// Third-party files the page cannot start without. Their URLs carry a version number, so a
// stored copy can never go stale. Without these, a weak connection leaves the app blank.
const CDN_ASSETS = [
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.4/howler.min.js',
  'https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js',
];
const VERSIONED_CDN = [
  { host: 'www.gstatic.com',       prefix: '/firebasejs/' },
  { host: 'cdnjs.cloudflare.com',  prefix: '/' },
  { host: 'unpkg.com',             prefix: '/' },
  { host: 'cdn.jsdelivr.net',      prefix: '/' },
];

// 'reload' skips the browser's own HTTP cache, so a new version is never built from stale files.
async function _addFresh(cache, url, retries) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(new Request(url, { cache: 'reload' }));
      if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status));
      await cache.put(url, res);
      return;
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 600 * (i + 1))); }
  }
  throw lastErr;
}

self.addEventListener('install', event => {
  _isFirstInstall = (self.registration.active === null);

  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // The app files are all-or-nothing: if any is missing the install fails, the old
    // version keeps running, and we try again later. A half-installed version never goes live.
    await Promise.all(CORE_ASSETS.map(u => _addFresh(cache, u, 2)));
    await Promise.all(OPTIONAL_ASSETS.map(u =>
      _addFresh(cache, u, 0).catch(err => console.warn('[SW] Optional asset not cached: ' + u, err && err.message))));
    // Third-party files are best effort (no-cors keeps this working for any host).
    const cdn = await caches.open(CDN_CACHE);
    await Promise.all(CDN_ASSETS.map(async u => {
      try {
        if (await cdn.match(u)) return;
        const res = await fetch(new Request(u, { mode: 'no-cors' }));
        await cdn.put(u, res);
      } catch (e) { console.warn('[SW] CDN asset not cached: ' + u); }
    }));
  })());
});

/* ─────────────────────────────────────────────────────────── */
/* ACTIVATE                                                   */
/* ─────────────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  const validCaches = [STATIC_CACHE, CDN_CACHE, 'vtx-meta', 'avatar-v3'];

  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            // 'vb-models-*' is VECTOR: BLACKLINE's downloaded 3D models (kept by the game
            // itself, see vector/assetstore.js). Never delete them here, or every Vertex
            // update would make players download all the models again.
            .filter(key => !validCaches.includes(key) && !key.startsWith('vb-models-'))
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
  if (url.pathname.startsWith('/dl/')) return; // signed file links: always straight to the network
  if (url.pathname.startsWith('/vendor/mediapipe/')) return; // large face-detection files: browser HTTP cache only

  // KNOWLEDGE SURFER 3D: its 3D models (.glb) are large, so like VECTOR they are
  // loaded straight from the network/browser cache instead of being copied into
  // the Vertex cache (this also means new models show up immediately).
  // VECTOR: BLACKLINE is a separate game with its own page. Let the browser
  // handle its files directly: no app-shell fallback, no cache-first staleness,
  // and no copying of large 3D model files into the Vertex cache.
  // '/vector' (no trailing slash) must be included, otherwise the navigation
  // falls through to _navigationHandler and the Vertex app shell is served.
  if (
    url.pathname === '/vector' ||
    url.pathname.startsWith('/vector/') ||
    url.pathname.startsWith('/vector-3dassets/') ||
    url.pathname === '/css/vector-blackline.css' ||   // the game's own stylesheet: never cache-first, or UI fixes arrive late
    url.pathname.startsWith('/surfer/')
  ) return;

  if (
    url.pathname === '/english.html' ||
    url.pathname === '/physics.html'
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // PROFILE PHOTOS: served by the Worker. The small "which version is current" check is never
  // cached; the pictures themselves are cached on-device by their ?v= stamp (see _avatarHandler).
  if (url.hostname.includes('vertex-worker.gbemigaakinde.workers.dev') && url.pathname.startsWith('/avatar/')) {
    if (url.pathname === '/avatar/versions') return;
    event.respondWith(_avatarHandler(request));
    return;
  }

  // Versioned library files (Firebase SDK etc.): cached copy first, so a weak signal cannot break startup.
  if (VERSIONED_CDN.some(c => url.hostname === c.host && url.pathname.startsWith(c.prefix)) &&
      /\.(js|css)$/.test(url.pathname) && /@\d|\/\d+\.\d+|\/9\.22\.2\//.test(url.pathname)) {
    event.respondWith(_cdnCacheFirst(request));
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

  // Same chat → newer alert replaces the older one instead of piling up
  if (data.tag) {
    options.tag      = data.tag;
    options.renotify = true;
  }

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
    caches.open('vtx-meta')
      .then(function (cache) { return cache.match('/__vtx_uid'); })
      .then(function (res) { return res ? res.text() : null; })
      .catch(function () { return null; })
      .then(function (storedUid) {
        return self.registration.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: 'BL43uSEQeh09fAtjR-H-GXoEAASmljn7vaszJDxtp8vPA1wFjhmqd9UrE35aPmsQEE-uBVpSr3uL1cB5oSBx0qs',
        })
        .then(function (newSub) {
          var userId = storedUid ||
            (event.oldSubscription
              ? new URL(event.oldSubscription.endpoint).pathname.split('/').pop()
              : 'unknown');

          return fetch('https://vertex-worker.gbemigaakinde.workers.dev/api/save-subscription', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId:       userId,
              subscription: newSub.toJSON(),
            }),
          });
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

// Looks ONLY in this version's cache, so the page and its scripts always come from the same release.
async function _cacheFirst(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    try { return await fetch(request); }
    catch (err) { return new Response('', { status: 503, statusText: 'Offline' }); }
  }

  const cache  = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    console.warn(`[SW] Cache-first network failure: ${request.url}`);
    // A proper error response, never made-up content: the page detects this and recovers.
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function _cdnCacheFirst(request) {
  const cache  = await caches.open(CDN_CACHE);
  const cached = await cache.match(request.url);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && (res.ok || res.type === 'opaque')) cache.put(request.url, res.clone());
    return res;
  } catch (err) {
    return Response.error();
  }
}

async function _staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then(networkResponse => {
    if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);

  return cached || (await networkFetch) || Response.error();
}

async function _navigationHandler(request) {
  const url = new URL(request.url);

  if (url.pathname === '/english.html' || url.pathname === '/physics.html') {
    return fetch(request);
  }

  // The app shell comes from this version's cache, so it always matches its scripts.
  const cache = await caches.open(STATIC_CACHE);
  const cachedShell = await cache.match('/index.html');
  if (cachedShell) return cachedShell;

  try {
    return await fetch(request);
  } catch (err) {
    const offlinePage = await cache.match('/offline.html') || await caches.match('/offline.html');
    if (offlinePage) return offlinePage;
    return new Response(
      '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title></head>' +
      '<body style="font-family:sans-serif;text-align:center;padding:3rem 1rem"><h1>You are offline.</h1>' +
      '<p>Please check your connection, then tap the button.</p><button onclick="location.reload()" style="padding:.75rem 1.5rem;font-size:1rem">Try again</button></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  }
}


/* Profile photo cache. A photo URL with ?v=<stamp> belongs to exactly one picture, so once it is
   stored it can never be stale: serve it with no network at all (this is what saves reads).
   A URL without a stamp (old photos only) goes to the network first and falls back to the copy
   we kept when offline. Only 200 images are stored. */
async function _avatarHandler(request) {
  const cache = await caches.open('avatar-v3');
  const stamped = new URL(request.url).searchParams.has('v');
  const hit = await cache.match(request);
  if (stamped && hit) return hit;
  const net = await fetch(request).then(r => { if (r && r.status === 200 && /^image\//.test(r.headers.get('Content-Type') || '')) cache.put(request, r.clone()); return r; }).catch(() => null);
  return net || hit || Response.error();
}
