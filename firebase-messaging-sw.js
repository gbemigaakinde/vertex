/* ============================================================
   firebase-messaging-sw.js — STUB ONLY
   ============================================================
   sw.js handles all FCM background messages and notification
   clicks directly. Firebase Cloud Messaging is pointed at
   sw.js via serviceWorkerRegistration in notifications.js.

   This file exists only to prevent the FCM compat SDK from
   throwing a 404 when it looks for the default SW file name
   on some browsers, which would log a non-fatal error in the
   console. It intentionally does nothing else.

   DO NOT add firebase.initializeApp() or onBackgroundMessage()
   here — that would create a second competing SW that fights
   with sw.js for push events and crashes with a duplicate
   Firebase app error.
   ============================================================ */

'use strict';

/* Deliberately empty. All FCM logic lives in sw.js. */
