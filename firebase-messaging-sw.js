/* ============================================================
   firebase-messaging-sw.js
   FCM background message handler for Vertex Tutorial CBT PWA.

   IMPORTANT: This file MUST be named exactly
   "firebase-messaging-sw.js" and placed in the ROOT of
   your project (same folder as index.html and sw.js).
   Firebase Cloud Messaging requires this exact location.

   This service worker runs in the background and displays
   push notifications when the app tab is not open or focused.
   ============================================================ */

'use strict';

/* ── Firebase SDK versions must match what index.html loads ── */
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

/* ── Initialize Firebase inside this SW ── */
firebase.initializeApp({
  apiKey:            "AIzaSyCQk1Q5GyCVo3cKNcHaYHVzAnVeWlqkzns",
  authDomain:        "excellencecbt.firebaseapp.com",
  projectId:         "excellencecbt",
  storageBucket:     "excellencecbt.firebasestorage.app",
  messagingSenderId: "24170253162",
  appId:             "1:24170253162:web:6e6cb86c5ffc84aebaf313"
});

const messaging = firebase.messaging();

/* ============================================================
   Background message handler
   This fires when a push arrives and the app tab is closed
   or in the background (not focused).

   The notification object you send from the teacher side
   (or via Firestore trigger) should include:
     notification.title  — headline shown in the OS tray
     notification.body   — message body
     data.url            — optional URL to open on click
   ============================================================ */
messaging.onBackgroundMessage(function (payload) {
  console.log('[firebase-messaging-sw] Background message received:', payload);

  const notificationTitle = (payload.notification && payload.notification.title)
    || 'Vertex Tutorial';

  const notificationOptions = {
    body: (payload.notification && payload.notification.body)
      || 'You have a new message from Master Timothy.',
    icon: '/vertex.jpeg',
    badge: '/vertex.jpeg',
    data: {
      url: (payload.data && payload.data.url) || '/',
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

/* ============================================================
   Notification click handler
   Opens (or focuses) the app when the user taps a notification.
   ============================================================ */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  var targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      /* If the app is already open, focus it */
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
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
