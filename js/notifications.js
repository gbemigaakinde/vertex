/* ============================================================
   js/notifications.js — Web Push subscription manager
   ============================================================ */

(function () {
  'use strict';

  var VAPID_PUBLIC_KEY = 'BL43uSEQeh09fAtjR-H-GXoEAASmljn7vaszJDxtp8vPA1wFjhmqd9UrE35aPmsQEE-uBVpSr3uL1cB5oSBx0qs';
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

function _persistUidForSW(userId) {
  if (!('caches' in window) || !userId) return;
  try {
    caches.open('vtx-meta').then(function (cache) {
      cache.put('/__vtx_uid', new Response(userId));
    });
  } catch (e) {
    console.warn('[notifications] Could not persist uid for SW:', e);
  }
}

  // ── Central save helper ──
async function _saveSubscription(userId, subscription, studentClass, studentName) {
    try {
      var res = await fetch(WORKER_URL + '/api/save-subscription', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          userId:       userId,
          subscription: subscription,
          studentClass: studentClass || null,
          studentName:  studentName  || null,
        }),
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

  // ── Update ALL bell/toggle UI elements to match actual state ──
  // This is the single source of truth for visual state.
  // on = true  → notifications are active
  // on = false → notifications are off
  function _updateAllUI(on) {
    // 1. Header bell button (vtxEnableNotifBtn — rendered in exam.js dashboard)
    var btn = document.getElementById('vtxEnableNotifBtn');
    if (btn) {
      if (on) {
        btn.title           = 'Notifications on — click to disable';
        btn.style.background = 'var(--success)';
        btn.innerHTML        = '<i class="ph ph-bell-ringing" style="font-size:13px;"></i>';
      } else {
        btn.title           = 'Enable push notifications';
        btn.style.background = 'var(--accent)';
        btn.innerHTML        = '<i class="ph ph-bell" style="font-size:13px;"></i>';
      }
    }

    // 2. Settings row toggle (vtxPushToggle — rendered in renderSettingsRow)
    var toggle = document.getElementById('vtxPushToggle');
    if (toggle) {
      toggle.setAttribute('aria-checked', on ? 'true' : 'false');
      toggle.style.background = on ? 'var(--success)' : 'var(--bg-muted)';
      var knob = toggle.querySelector('.vtx-toggle-knob');
      if (knob) {
        knob.style.transform = on ? 'translateX(18px)' : 'translateX(0)';
      }
    }
  }

  // Keep the old name as an alias so existing call-sites in app.js still work
  function _updateBellUI(on) {
    _updateAllUI(on);
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

      var existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      var sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      var userId       = (window.AppState && window.AppState.userId) || 'anon';
      var studentClass = (window.AppState && window.AppState.studentData && window.AppState.studentData.class) || null;
      var studentName  = (window.AppState && window.AppState.studentData && window.AppState.studentData.name)  || null;
      var saved = await _saveSubscription(userId, sub.toJSON(), studentClass, studentName);

      if (!saved) {
        if (window.UI) UI.toast('Could not save notification subscription. Please try again.', 'error', 4000);
        return false;
      }

      localStorage.setItem(LS_KEY, '1');
      _persistUidForSW(userId);
      if (window.UI) UI.toast('Push notifications enabled!', 'success', 3000);
      _updateAllUI(true);
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
      _updateAllUI(false);
      return true;
    } catch (err) {
      console.error('[notifications] unsubscribe error:', err);
      return false;
    }
  }

  async function togglePushNotifications() {
    // Read actual browser state — not localStorage — so the toggle is always accurate
    var currentlySubscribed = await isSubscribed();
    if (currentlySubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  }

async function init(uid) {
    if (!_isSupported()) return;

    var userId       = uid || (window.AppState && window.AppState.userId) || 'anon';
    var studentClass = (window.AppState && window.AppState.studentData && window.AppState.studentData.class) || null;
    var studentName  = (window.AppState && window.AppState.studentData && window.AppState.studentData.name)  || null;

    var reg = await navigator.serviceWorker.ready.catch(function () { return null; });
    if (!reg) return;

    var existing = await reg.pushManager.getSubscription().catch(function () { return null; });

    if (Notification.permission === 'granted' && existing) {
      var saved = await _saveSubscription(userId, existing.toJSON(), studentClass, studentName);
      if (saved) {
        localStorage.setItem(LS_KEY, '1');
        _persistUidForSW(userId);
      }
      _updateAllUI(true);
      return;
    }

    if (Notification.permission === 'granted' && !existing) {
      try {
        var sub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        var saved2 = await _saveSubscription(userId, sub.toJSON(), studentClass, studentName);
        if (saved2) {
          localStorage.setItem(LS_KEY, '1');
          _persistUidForSW(userId);
          _updateAllUI(true);
        } else {
          _updateAllUI(false);
        }
      } catch (e) {
        console.warn('[notifications] Silent re-subscribe failed:', e);
        _updateAllUI(false);
      }
      return;
    }

    localStorage.removeItem(LS_KEY);
    _updateAllUI(false);
  }

  function renderSettingsRow(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var supported = _isSupported();
    var iosNote   = _isIOS() && !_isIOSPWA()
      ? '<p style="font-size:.75rem;color:var(--warning-text);margin-top:.25rem;line-height:1.5;">' +
        '⚠️ On iPhone, add this app to your Home Screen to enable notifications.</p>'
      : '';

    // Render toggle in the off state first; init() will correct it immediately after
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

    // Pass the actual userId so the subscription is never saved under 'anon'
    var uid = (window.AppState && window.AppState.userId) || null;
    // init() is async; it will call _updateAllUI(true/false) once it knows the real state,
    // which correctly animates the toggle knob into position.
    init(uid);
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
