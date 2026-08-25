/* ============================================================
   js/notifications.js — Web Push subscription manager
   ============================================================ */

(function () {
  'use strict';

  var VAPID_PUBLIC_KEY = 'BCjYlOnZftKfqqez37mKt9sLy_XAO3BylbLyOUGfkO4ABeM_YYY9xEZuxplaSvrrYGEcwcBkFTGt5Rjbitz1QTA';

  var WORKER_URL = 'https://vertex-worker.gbemigaakinde.workers.dev';
  var LS_KEY     = 'vtx_push_enabled';

  function _urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw     = window.atob(base64);
    var arr     = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function _isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function _isIOSPWA() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) &&
           (window.navigator.standalone === true ||
            (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches));
  }

  function _isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  // ── Central save helper — used everywhere so error handling is consistent ──
  async function _saveSubscription(userId, subscription) {
    try {
      var res = await fetch(WORKER_URL + '/api/save-subscription', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: userId, subscription: subscription }),
      });
      if (!res.ok) {
        console.warn('[notifications] save-subscription HTTP error:', res.status);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[notifications] save-subscription fetch failed:', e);
      return false;
    }
  }

  async function isSubscribed() {
    if (!_isSupported()) return false;
    try {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch (e) {
      return false;
    }
  }

  async function subscribe() {
    if (!_isSupported()) {
      if (_isIOS() && !_isIOSPWA()) {
        if (window.UI) UI.toast('To enable notifications on iPhone, add this app to your Home Screen first.', 'info', 8000);
        return false;
      }
      if (window.UI) UI.toast('Push notifications are not supported in your browser.', 'warning', 5000);
      return false;
    }

    var permission = Notification.permission;
    if (permission === 'denied') {
      if (window.UI) UI.toast('Notifications are blocked. Please allow them in your browser settings.', 'warning', 6000);
      return false;
    }
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      if (window.UI) UI.toast('Notification permission not granted.', 'info', 3000);
      return false;
    }

    try {
      var reg = await navigator.serviceWorker.ready;

      // Cancel any old subscription first to avoid stale endpoint errors
      var existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      var sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      var userId = (window.AppState && window.AppState.userId) || 'anon';
      var saved  = await _saveSubscription(userId, sub.toJSON());

      if (!saved) {
        if (window.UI) UI.toast('Could not save notification subscription. Please try again.', 'error', 4000);
        return false;
      }

      localStorage.setItem(LS_KEY, '1');
      if (window.UI) UI.toast('Push notifications enabled!', 'success', 3000);
      _updateToggleUI(true);
      return true;
    } catch (err) {
      console.error('[notifications] subscribe error:', err);
      if (window.UI) UI.toast('Could not enable notifications. Please try again.', 'error', 4000);
      return false;
    }
  }

  async function unsubscribe() {
    try {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();

      var userId = (window.AppState && window.AppState.userId) || 'anon';
      await fetch(WORKER_URL + '/api/unsubscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: userId }),
      });

      localStorage.removeItem(LS_KEY);
      if (window.UI) UI.toast('Push notifications disabled.', 'info', 3000);
      _updateToggleUI(false);
      return true;
    } catch (err) {
      console.error('[notifications] unsubscribe error:', err);
      return false;
    }
  }

  async function togglePushNotifications() {
    var enabled = await isSubscribed();
    if (enabled) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  }

  function _updateToggleUI(on) {
    var toggleEl = document.getElementById('vtxPushToggle');
    if (!toggleEl) return;
    toggleEl.setAttribute('aria-checked', on ? 'true' : 'false');
    toggleEl.style.background = on ? 'var(--accent)' : 'var(--bg-muted)';
    var knob = toggleEl.querySelector('.vtx-toggle-knob');
    if (knob) knob.style.transform = on ? 'translateX(18px)' : 'translateX(0)';
    var label = document.getElementById('vtxPushToggleLabel');
    if (label) label.textContent = on ? 'On' : 'Off';
  }

async function init(uid) {
  if (!_isSupported()) return;

  var userId = uid || (window.AppState && window.AppState.userId) || 'anon';

  if (Notification.permission === 'granted') {
    try {
      var reg = await navigator.serviceWorker.ready;

      // Always unsubscribe first to clear any stale/legacy FCM endpoint
      var existing = await reg.pushManager.getSubscription();
      if (existing) {
        var ep = existing.endpoint || '';
        // If endpoint is the old FCM legacy format, force a fresh subscription
        var isLegacy = ep.includes('fcm.googleapis.com/fcm/send/') &&
                       !ep.includes('/v1/');
        if (isLegacy) {
          console.warn('[notifications] Legacy FCM endpoint detected — forcing re-subscribe.');
          await existing.unsubscribe();
          existing = null;
        }
      }

      var sub;
      if (!existing) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      } else {
        sub = existing;
      }

      var saved = await _saveSubscription(userId, sub.toJSON());
      if (saved) {
        localStorage.setItem(LS_KEY, '1');
        _updateToggleUI(true);
      } else {
        if (window.UI) UI.toast('Could not register for notifications. Tap the bell to retry.', 'warning', 4000);
      }
    } catch (e) {
      console.warn('[notifications] init subscription error:', e);
    }
    return;
  }

  // Permission not yet asked — prompt automatically (skip on plain iOS Safari)
  if (Notification.permission === 'default' && !_isIOS()) {
    try {
      var granted = await Notification.requestPermission();
      if (granted === 'granted') {
        var reg2 = await navigator.serviceWorker.ready;
        var sub2 = await reg2.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        var saved2 = await _saveSubscription(userId, sub2.toJSON());
        if (saved2) {
          localStorage.setItem(LS_KEY, '1');
          _updateToggleUI(true);
          if (window.UI) UI.toast('Notifications enabled!', 'success', 3000);
        } else {
          if (window.UI) UI.toast('Notification save failed. Tap the bell button to retry.', 'warning', 5000);
        }
        return;
      }
    } catch (e) {
      console.warn('[notifications] Auto-prompt failed:', e);
      if (window.UI) UI.toast('Could not enable notifications: ' + e.message, 'warning', 5000);
    }
  }

  // Permission denied or iOS — just update toggle UI
  var on = await isSubscribed();
  _updateToggleUI(on);
  if (!on) localStorage.removeItem(LS_KEY);
}

  function renderSettingsRow(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var supported = _isSupported();
    var iosNote   = _isIOS() && !_isIOSPWA()
      ? '<p style="font-size:.75rem;color:var(--warning-text);margin-top:.25rem;line-height:1.5;">' +
        '⚠️ On iPhone, add this app to your Home Screen to enable notifications.</p>'
      : '';

    el.innerHTML = (
      '<div style="display:flex;align-items:center;justify-content:space-between;' +
        'gap:1rem;padding:.875rem 1rem;border:1px solid var(--border);' +
        'border-radius:var(--r-lg);background:var(--bg-base);">' +
        '<div>' +
          '<p style="font-size:.875rem;font-weight:600;color:var(--text-1);">Push Notifications</p>' +
          '<p style="font-size:.75rem;color:var(--text-3);margin-top:2px;line-height:1.5;">' +
            'Get exam reminders and messages from Master Timothy.' +
          '</p>' +
          iosNote +
        '</div>' +
        (supported
          ? '<button id="vtxPushToggle" role="switch" aria-checked="false" ' +
              'onclick="Notifications.toggle()" ' +
              'style="position:relative;width:44px;height:26px;border-radius:99px;' +
                'background:var(--bg-muted);border:none;cursor:pointer;' +
                'transition:background .2s;flex-shrink:0;padding:0;">' +
              '<span class="vtx-toggle-knob" style="position:absolute;top:3px;left:3px;' +
                'width:20px;height:20px;border-radius:50%;background:#fff;' +
                'box-shadow:0 1px 4px rgba(0,0,0,.2);transition:transform .2s;' +
                'display:block;"></span>' +
            '</button>'
          : '<span style="font-size:.75rem;color:var(--text-4);font-style:italic;">Not supported</span>') +
      '</div>'
    );

    init();
  }

  window.Notifications = {
    subscribe:         subscribe,
    unsubscribe:       unsubscribe,
    toggle:            togglePushNotifications,
    isSubscribed:      isSubscribed,
    renderSettingsRow: renderSettingsRow,
    init:              init,
  };

}());
