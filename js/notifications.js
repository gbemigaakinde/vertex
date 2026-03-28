/* ============================================================
   js/notifications.js — Firebase Cloud Messaging (FCM)
   ============================================================
   How this works:
   1. After the student logs in, we wait for them to reach
      the subject selection screen.
   2. We show our OWN friendly banner explaining why we want
      to send notifications before the browser's official
      Allow/Block popup appears.
   3. Only if they tap "Enable" do we call the browser API
      that shows the official permission popup.
   4. If they allow, we save their FCM token to Firestore so
      the teacher can send push notifications to them.

   FIX v3:
   - _requestTokenAndSave() uses navigator.serviceWorker.ready
     instead of navigator.serviceWorker.getRegistration('/').

   FIX v4 — FCM TOKEN BUG FIX (complete rewrite of internals):

   BUG 1 — Duplicate Firebase app / duplicate messaging instance.
   The original code called firebase.messaging() freely inside
   _requestTokenAndSave(). If a student logged out and back in,
   or if init() was called twice (which app.js can do on rapid
   auth state changes), firebase.messaging() threw:
     "Firebase: Firebase App named '[DEFAULT]' already exists"
   or silently returned a stale instance tied to the wrong userId.
   Fix: create the messaging instance ONCE at module load time,
   stored in _messaging. Subsequent calls reuse it safely.

   BUG 2 — www.gstatic.com was in CDN_ORIGINS in sw.js.
   The FCM SDK makes internal token-registration XHRs to
   https://www.gstatic.com/iid/... to obtain the push token.
   When sw.js intercepted those requests with stale-while-
   revalidate, FCM received a stale or error response, and
   getToken() returned null or threw silently — so nothing was
   ever saved to Firestore. This has been fixed in sw.js by
   moving www.gstatic.com from CDN_ORIGINS into BYPASS_ORIGINS.
   This file documents that fix but cannot apply it itself.

   BUG 3 — _listenForForegroundMessages() was called on every
   _requestTokenAndSave() invocation, attaching duplicate event
   listeners on re-login. Fix: guard with _foregroundListenerAttached.

   BUG 4 — init() could be called with a different userId on
   re-login without resetting the module state. Fix: reset
   relevant state at the top of init() when userId changes.
   ============================================================ */

(function () {
  'use strict';

  /*
   * Your VAPID public key — pasted as ONE unbroken string.
   * Found in Firebase Console → Project Settings →
   * Cloud Messaging → Web configuration → Key pair.
   */
  var VAPID_KEY = 'BM3F4Aw4HykHcg3nl6oLzKvNZeGYQnil6fONXMWEGD6C0Ypk8npaNP1-hAhVfPdiGFbxERVFDgARCX8DGGFkTrM';

  /*
   * Create the messaging instance exactly once at module load.
   * Calling firebase.messaging() more than once per page load
   * throws "duplicate app" errors or returns stale instances.
   * We guard with a try/catch in case the SDK isn't loaded yet
   * (which would be a script order bug in index.html, but we
   * handle it gracefully rather than crashing silently).
   */
  var _messaging = null;
  try {
    if (typeof firebase !== 'undefined' && firebase.messaging) {
      _messaging = firebase.messaging();
    }
  } catch (e) {
    console.warn('[notifications] Could not create messaging instance at load time:', e.message);
  }

  var _userId                    = null;
  var _foregroundListenerAttached = false;

  /* ============================================================
     init(userId)
     ──────────────────────────────────────────────────────────
     Called from app.js after the student logs in.
     ============================================================ */
  function init(userId) {
    if (!userId) return Promise.resolve();

    /* Reset per-user state when a different user logs in */
    if (_userId !== userId) {
      _userId = userId;
      /*
       * Do NOT reset _foregroundListenerAttached here.
       * The foreground message handler on _messaging is
       * global — it doesn't know about userId. One handler
       * is enough for the lifetime of the page; re-attaching
       * it would fire the callback multiple times per message.
       */
    }

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

    /* Ensure the messaging instance was created successfully */
    if (!_messaging) {
      console.warn('[notifications] Firebase Messaging SDK not available.');
      return Promise.resolve();
    }

    /* If already granted, silently refresh the token. */
    if (Notification.permission === 'granted') {
      return _requestTokenAndSave();
    }

    /* If already denied, do nothing. */
    if (Notification.permission === 'denied') {
      console.log('[notifications] Permission was previously denied. Cannot ask again.');
      return Promise.resolve();
    }

    /* Permission is 'default' — show our friendly banner first. */
    setTimeout(_showPromptBanner, 3000);

    return Promise.resolve();
  }

  /* ============================================================
     _showPromptBanner()
     ============================================================ */
  function _showPromptBanner() {
    if (document.getElementById('notifPromptBanner')) return;
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

    if (!document.getElementById('_notifBannerStyle')) {
      var style       = document.createElement('style');
      style.id        = '_notifBannerStyle';
      style.textContent =
        '@keyframes slideUpBanner {' +
          'from { transform:translateY(100%); opacity:0; }' +
          'to   { transform:translateY(0);    opacity:1; }' +
        '}';
      document.head.appendChild(style);
    }

    document.body.appendChild(banner);

    document.getElementById('notifPromptDismiss').addEventListener('click', function () {
      _removeBanner();
    });

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
     Triggers the browser's official Allow/Block popup (via
     getToken), then saves the resulting token to Firestore.

     Uses navigator.serviceWorker.ready to guarantee a fully
     active SW is passed to getToken() — never undefined or
     an inactive registration.

     NOTE: For this to work, www.gstatic.com must be in
     BYPASS_ORIGINS in sw.js (not CDN_ORIGINS). If sw.js
     intercepts FCM's internal token-registration XHRs to
     www.gstatic.com/iid/..., getToken() returns null and
     nothing is saved. See sw.js UPDATE v4 comment.
     ============================================================ */
  async function _requestTokenAndSave() {
    if (!_messaging) {
      console.warn('[notifications] Messaging instance not available, cannot get token.');
      return;
    }

    try {
      /*
       * Wait for the SW to be fully active before asking FCM
       * for a token. .ready only resolves once a SW is active
       * and controlling the page.
       */
      var swReg = await navigator.serviceWorker.ready;

      var token = await _messaging.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swReg,
      });

      if (token) {
        console.log('[notifications] Token obtained successfully.');
        await _saveToken(token);
        _listenForForegroundMessages();
      } else {
        console.warn('[notifications] No token returned — user may have blocked, or www.gstatic.com is being intercepted by the SW. Check sw.js BYPASS_ORIGINS.');
      }
    } catch (err) {
      console.warn('[notifications] Could not get token (non-fatal):', err.message || err);
    }
  }

  /* ============================================================
     _saveToken(token)
     ============================================================ */
  async function _saveToken(token) {
    if (!_userId || !window.fbDb) return;
    try {
      await window.fbDb.collection('fcmTokens').doc(_userId).set({
        token:     token,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        platform:  _detectPlatform(),
      }, { merge: true });
      console.log('[notifications] Token saved to Firestore for user:', _userId);
    } catch (err) {
      console.warn('[notifications] Failed to save token:', err.message || err);
    }
  }

  /* ============================================================
     _listenForForegroundMessages()
     ──────────────────────────────────────────────────────────
     Attach the foreground message listener at most once per
     page load. Calling onMessage() multiple times attaches
     multiple callbacks and fires the handler N times per
     message after N re-logins.
     ============================================================ */
  function _listenForForegroundMessages() {
    if (_foregroundListenerAttached) return;
    if (!_messaging) return;

    _foregroundListenerAttached = true;

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
