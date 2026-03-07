/* ============================================================
   js/notifications.js — Firebase Cloud Messaging (FCM)
   ============================================================
   How this works:
   1. After the student logs in, we wait for them to reach
      the subject selection screen.
   2. We show our OWN friendly banner explaining why we want
      to send notifications. This gives the student context
      before the browser's official Allow/Block popup appears.
   3. Only if they tap "Enable" do we call the browser API
      that shows the official permission popup.
   4. If they allow, we save their FCM token to Firestore so
      the teacher can send push notifications to them.

   WHY THIS MATTERS:
   If we ask for permission immediately on login with no
   explanation, most students will tap Block out of confusion.
   Once they tap Block, the browser never asks again for this
   site. Showing our own banner first gives context and
   dramatically increases how many students tap Allow.
   ============================================================ */

(function () {
  'use strict';

  /*
   * Your VAPID public key.
   * Found in Firebase Console → Project Settings →
   * Cloud Messaging → Web configuration → Key pair.
   */
  var VAPID_KEY =
    'BM3F4Aw4HykHcg3nl6oLzKvNZeGYQnil6fONXMWEGD6C' +
    '0Ypk8npaNP1-hAhVfPdiGFbxERVFDgARCX8DGGFkTrM';

  var _messaging  = null;
  var _userId     = null;

  /* ============================================================
     init(userId)
     ──────────────────────────────────────────────────────────
     Called from app.js after the student logs in.
     Stores the userId for later use and decides whether to
     show the notification prompt banner.

     We do NOT ask for permission here directly. Instead we
     show our own banner first (see _showPromptBanner below).
     ============================================================ */
  function init(userId) {
    if (!userId) return Promise.resolve();
    _userId = userId;

    /* FCM requires HTTPS or localhost */
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.warn('[notifications] FCM requires HTTPS. Skipping.');
      return Promise.resolve();
    }

    /* Check browser support */
    if (!('Notification' in window)) {
      console.warn('[notifications] Notifications not supported in this browser.');
      return Promise.resolve();
    }

    if (typeof firebase === 'undefined' || !firebase.messaging) {
      console.warn('[notifications] Firebase Messaging SDK not loaded.');
      return Promise.resolve();
    }

    /* If already granted, just silently refresh the token.
       No need to show the banner again. */
    if (Notification.permission === 'granted') {
      return _requestTokenAndSave();
    }

    /* If already denied, we cannot ask again — browser blocks it.
       Do nothing. */
    if (Notification.permission === 'denied') {
      console.log('[notifications] Permission was previously denied. Cannot ask again.');
      return Promise.resolve();
    }

    /* Permission is 'default' (never asked before).
       Show our friendly banner after a short delay so the
       student has time to see the subject selection screen first. */
    setTimeout(_showPromptBanner, 3000);

    return Promise.resolve();
  }

  /* ============================================================
     _showPromptBanner()
     ──────────────────────────────────────────────────────────
     Creates and injects a friendly banner at the bottom of
     the screen explaining why notifications are useful.
     The student sees this BEFORE the browser's own popup.
     ============================================================ */
  function _showPromptBanner() {
    /* Don't show if one is already on screen */
    if (document.getElementById('notifPromptBanner')) return;

    /* Don't show if the student is in the middle of an exam */
    if (window.AppState && window.AppState.exam) return;

    var banner = document.createElement('div');
    banner.id  = 'notifPromptBanner';

    banner.style.cssText = [
      'position:fixed',
      'bottom:0',
      'left:0',
      'right:0',
      'z-index:8000',
      'background:#1e1b4b',
      'color:#fff',
      'padding:1rem 1.25rem',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:1rem',
      'flex-wrap:wrap',
      'box-shadow:0 -4px 20px rgba(0,0,0,0.25)',
      'font-family:Outfit,system-ui,sans-serif',
      'animation:slideUpBanner 0.3s ease-out',
    ].join(';');

    banner.innerHTML =
      /* Left side — icon + text */
      '<div style="display:flex;align-items:center;gap:0.75rem;flex:1;min-width:0;">' +
        '<span style="font-size:1.5rem;flex-shrink:0;">🔔</span>' +
        '<div>' +
          '<p style="font-size:0.875rem;font-weight:700;margin:0 0 2px;">' +
            'Get exam reminders from Master Timothy' +
          '</p>' +
          '<p style="font-size:0.75rem;opacity:0.75;margin:0;line-height:1.4;">' +
            'Enable notifications so you never miss a session or message.' +
          '</p>' +
        '</div>' +
      '</div>' +
      /* Right side — buttons */
      '<div style="display:flex;gap:0.5rem;flex-shrink:0;">' +
        '<button id="notifPromptDismiss"' +
          ' style="background:transparent;color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.3);' +
          'padding:0.4375rem 0.875rem;border-radius:6px;font-size:0.8125rem;font-weight:600;cursor:pointer;' +
          'font-family:Outfit,system-ui,sans-serif;">' +
          'Not now' +
        '</button>' +
        '<button id="notifPromptAllow"' +
          ' style="background:#4f46e5;color:#fff;border:none;' +
          'padding:0.4375rem 0.875rem;border-radius:6px;font-size:0.8125rem;font-weight:700;cursor:pointer;' +
          'font-family:Outfit,system-ui,sans-serif;">' +
          'Enable' +
        '</button>' +
      '</div>';

    /* Inject slide-up animation if not already in the page */
    if (!document.getElementById('_notifBannerStyle')) {
      var style = document.createElement('style');
      style.id  = '_notifBannerStyle';
      style.textContent =
        '@keyframes slideUpBanner {' +
          'from { transform:translateY(100%); opacity:0; }' +
          'to   { transform:translateY(0);    opacity:1; }' +
        '}';
      document.head.appendChild(style);
    }

    document.body.appendChild(banner);

    /* "Not now" — dismiss the banner quietly */
    document.getElementById('notifPromptDismiss').addEventListener('click', function () {
      _removeBanner();
    });

    /* "Enable" — NOW trigger the real browser permission popup */
    document.getElementById('notifPromptAllow').addEventListener('click', function () {
      _removeBanner();
      _requestTokenAndSave();
    });
  }

  /* ============================================================
     _removeBanner()
     ============================================================ */
  function _removeBanner() {
    var banner = document.getElementById('notifPromptBanner');
    if (banner) banner.remove();
  }

  /* ============================================================
     _requestTokenAndSave()
     ──────────────────────────────────────────────────────────
     This is what actually triggers the browser's official
     "Allow / Block" popup (via getToken).
     Then saves the resulting token to Firestore.
     ============================================================ */
  async function _requestTokenAndSave() {
    try {
      _messaging = firebase.messaging();

      /*
       * getToken() does two things:
       *  1. Shows the browser's native Allow/Block popup
       *     (only if permission is still 'default').
       *  2. Returns a unique token string for this device.
       */
      var token = await _messaging.getToken({ vapidKey: VAPID_KEY });

      if (token) {
        console.log('[notifications] Token obtained successfully.');
        await _saveToken(token);
        _listenForForegroundMessages();
      } else {
        console.warn('[notifications] No token returned — user may have blocked.');
      }
    } catch (err) {
      /* Non-fatal. Happens if user clicks Block, or on iOS Safari. */
      console.warn('[notifications] Could not get token (non-fatal):', err.message || err);
    }
  }

  /* ============================================================
     _saveToken(token)
     ──────────────────────────────────────────────────────────
     Saves the FCM token to Firestore at fcmTokens/{userId}
     so the teacher can look it up when sending a push.
     ============================================================ */
  async function _saveToken(token) {
    if (!_userId || !window.fbDb) return;
    try {
      await window.fbDb.collection('fcmTokens').doc(_userId).set({
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
     When the app is OPEN and the student is looking at it,
     the service worker does NOT show a system notification.
     This handler catches those messages and shows them
     as toasts using your existing UI.toast() system instead.
     ============================================================ */
  function _listenForForegroundMessages() {
    if (!_messaging) return;
    _messaging.onMessage(function (payload) {
      console.log('[notifications] Foreground message received:', payload);
      var title   = (payload.notification && payload.notification.title) || 'Vertex Tutorial';
      var body    = (payload.notification && payload.notification.body)  || '';
      var message = body ? title + ': ' + body : title;
      if (window.UI && typeof window.UI.toast === 'function') {
        UI.toast(message, 'info', 8000);
      }
    });
  }

  /* ============================================================
     _detectPlatform()
     Returns a short label saved alongside the token in
     Firestore so you can see what devices your students use.
     ============================================================ */
  function _detectPlatform() {
    var ua = navigator.userAgent || '';
    if (/android/i.test(ua))            return 'Android';
    if (/iPad|iPhone|iPod/.test(ua))    return 'iOS';
    if (/Win/.test(navigator.platform)) return 'Windows';
    if (/Mac/.test(navigator.platform)) return 'Mac';
    return 'Unknown';
  }

  /* ── Expose ── */
  window.Notifications = {
    init: init,
  };

}());