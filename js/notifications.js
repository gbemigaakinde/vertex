/* ============================================================
   js/notifications.js — Firebase Cloud Messaging (FCM)
   ============================================================
   What this file does:
   1. Asks the user for notification permission (once).
   2. Gets a unique FCM token for this browser/device.
   3. Saves that token to Firestore under:
        fcmTokens/{userId}/tokens/{tokenHash}
      so the teacher can query all tokens when sending a push.
   4. Exposes Notifications.init(userId) — call this after
      login succeeds in app.js.

   No backend server is required. Teachers trigger pushes
   by writing to Firestore (see teacher.js sendPushNotification).
   ============================================================ */

(function () {
  'use strict';

  /*
   * Your VAPID public key.
   * Found in Firebase Console → Project Settings →
   * Cloud Messaging → Web configuration → Key pair.
   * This is the key shown in your screenshot.
   */
  var VAPID_KEY =
    'BM3F4Aw4HykHcg3nl6oLzKvNZeGYQnil6fONXMWEGD6C' +
    '0Ypk8npaNP1-hAhVfPdiGFbxERVFDgARCX8DGGFkTrM';

  var _messaging = null;

  /* ============================================================
     init(userId)
     ──────────────────────────────────────────────────────────
     Call this once after a student logs in successfully.
     It is safe to call multiple times — it checks permission
     before doing anything.
     ============================================================ */
  async function init(userId) {
    if (!userId) return;

    /* FCM requires HTTPS or localhost */
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.warn('[notifications] FCM requires HTTPS. Skipping init.');
      return;
    }

    /* Check if the browser supports notifications */
    if (!('Notification' in window)) {
      console.warn('[notifications] This browser does not support notifications.');
      return;
    }

    /* Check if Firebase Messaging is available */
    if (typeof firebase === 'undefined' || !firebase.messaging) {
      console.warn('[notifications] Firebase Messaging SDK not loaded.');
      return;
    }

    /* Don't ask again if already denied */
    if (Notification.permission === 'denied') {
      console.log('[notifications] Notification permission was denied by user.');
      return;
    }

    try {
      _messaging = firebase.messaging();

      /*
       * getToken() will:
       * 1. Ask for notification permission if not yet granted.
       * 2. Register the firebase-messaging-sw.js service worker.
       * 3. Return a unique token for this browser.
       */
      var token = await _messaging.getToken({ vapidKey: VAPID_KEY });

      if (token) {
        console.log('[notifications] FCM token obtained.');
        await _saveToken(userId, token);
        _listenForForegroundMessages();
      } else {
        console.warn('[notifications] No token received. Permission may not be granted.');
      }
    } catch (err) {
      /* Non-fatal — the app works fine without push notifications */
      console.warn('[notifications] FCM init failed (non-fatal):', err.message || err);
    }
  }

  /* ============================================================
     _saveToken(userId, token)
     ──────────────────────────────────────────────────────────
     Saves the FCM token to Firestore at:
       fcmTokens/{userId}
     We use set() with merge so repeated calls are safe and
     don't create duplicate documents.
     ============================================================ */
  async function _saveToken(userId, token) {
    try {
      await window.fbDb.collection('fcmTokens').doc(userId).set({
        token:     token,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        platform:  _detectPlatform(),
      }, { merge: true });
      console.log('[notifications] Token saved to Firestore.');
    } catch (err) {
      console.warn('[notifications] Failed to save token:', err.message || err);
    }
  }

  /* ============================================================
     _listenForForegroundMessages()
     ──────────────────────────────────────────────────────────
     When the app IS open and focused, the service worker does
     NOT show the notification automatically. This handler
     catches foreground messages and shows them as toasts.
     ============================================================ */
  function _listenForForegroundMessages() {
    if (!_messaging) return;

    _messaging.onMessage(function (payload) {
      console.log('[notifications] Foreground message received:', payload);

      var title   = (payload.notification && payload.notification.title) || 'Vertex Tutorial';
      var body    = (payload.notification && payload.notification.body)  || '';
      var message = body ? title + ': ' + body : title;

      /* Use the existing UI.toast system so it fits the app's style */
      if (window.UI && typeof window.UI.toast === 'function') {
        UI.toast(message, 'info', 8000);
      }
    });
  }

  /* ============================================================
     _detectPlatform()
     Returns a short string describing the browser/OS for
     debugging purposes in the Firestore console.
     ============================================================ */
  function _detectPlatform() {
    var ua = navigator.userAgent || '';
    if (/android/i.test(ua))              return 'Android';
    if (/iPad|iPhone|iPod/.test(ua))      return 'iOS';
    if (/Win/.test(navigator.platform))   return 'Windows';
    if (/Mac/.test(navigator.platform))   return 'Mac';
    return 'Unknown';
  }

  /* ── Expose ── */
  window.Notifications = {
    init: init,
  };

}());
