/* ============================================================
   js/ui.js — UI helpers: toasts, loading states, modals, ripple
   v3 — icon toasts + ripple effect
   ============================================================ */

(function () {
  'use strict';

  /* ── Toast icons ── */
  var TOAST_ICONS = {
    success: '<svg class="cbt-toast-icon" viewBox="0 0 16 16" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 8 6 12 14 4"/></svg>',
    error:   '<svg class="cbt-toast-icon" viewBox="0 0 16 16" fill="none" stroke="var(--danger)"  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>',
    warning: '<svg class="cbt-toast-icon" viewBox="0 0 16 16" fill="none" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2L14 13H2L8 2z"/><line x1="8" y1="7" x2="8" y2="10"/><circle cx="8" cy="12" r="0.5" fill="var(--warning)"/></svg>',
    info:    '<svg class="cbt-toast-icon" viewBox="0 0 16 16" fill="none" stroke="var(--accent)"  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><line x1="8" y1="7" x2="8" y2="11"/><circle cx="8" cy="5" r="0.5" fill="var(--accent)"/></svg>',
  };

  function toast(message, type, duration) {
    type     = type     || 'info';
    duration = duration !== undefined ? duration : 4000;

    var container = document.getElementById('toastContainer');
    if (!container) return;

    var el = document.createElement('div');
    el.className = 'cbt-toast cbt-toast--' + type + ' toast toast-' + type;
    el.setAttribute('role', 'alert');
    el.innerHTML =
      (TOAST_ICONS[type] || TOAST_ICONS.info) +
      '<span style="flex:1;font-size:0.8125rem">' + message + '</span>' +
      '<button class="cbt-toast__dismiss" aria-label="Dismiss">&#x2715;</button>';

    el.querySelector('.cbt-toast__dismiss').addEventListener('click', function () {
      _dismiss(el);
    });

    container.appendChild(el);

    if (duration > 0) {
      setTimeout(function () { _dismiss(el); }, duration);
    }
  }

  function _dismiss(el) {
    if (!el || !el.parentNode) return;
    el.classList.add('is-dismissing', 'dismissing');
    el.addEventListener('animationend', function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, { once: true });
    // Fallback if animation doesn't fire
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
  }

  /* ── Button loading state ── */
  function setLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.classList.add('btn-loading');
    } else {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.classList.remove('btn-loading');
    }
  }

  /* ── Mount main content ── */
  function mount(html) {
    var app = document.getElementById('app');
    if (app) app.innerHTML = html;
  }

  /* ── Confirm dialog ── */
  function confirmAction(message) {
    return new Promise(function (resolve) {
      var existing = document.getElementById('uiConfirmModal');
      if (existing) existing.remove();

      var overlay = document.createElement('div');
      overlay.id        = 'uiConfirmModal';
      overlay.className = 'cbt-overlay modal-overlay';
      overlay.setAttribute('role',            'dialog');
      overlay.setAttribute('aria-modal',      'true');
      overlay.setAttribute('aria-labelledby', 'uiConfirmTitle');

      overlay.innerHTML =
        '<div class="cbt-modal modal-box" style="max-width:26rem;text-align:center;">' +
          '<p id="uiConfirmTitle" style="font-size:1rem;font-weight:600;' +
             'color:var(--text-1);line-height:1.6;margin-bottom:1.5rem;">' +
            _escHtml(message) +
          '</p>' +
          '<div style="display:flex;gap:0.75rem;justify-content:center;">' +
            '<button id="uiConfirmCancel" class="btn bg-gray-500">Cancel</button>' +
            '<button id="uiConfirmOk"     class="btn bg-red-600">Confirm</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(overlay);

      var okBtn     = document.getElementById('uiConfirmOk');
      var cancelBtn = document.getElementById('uiConfirmCancel');

      function _cleanup() { overlay.remove(); }

      okBtn.addEventListener('click',     function () { _cleanup(); resolve(true); });
      cancelBtn.addEventListener('click', function () { _cleanup(); resolve(false); });
      overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { _cleanup(); resolve(false); } });
      overlay.addEventListener('click',   function (e) { if (e.target === overlay) { _cleanup(); resolve(false); } });

      setTimeout(function () { cancelBtn.focus(); }, 0);
    });
  }

  /* ── PWA update toast ── */
  function showUpdateToast(onConfirm) {
    var container = document.getElementById('toastContainer');
    if (!container) return;
    if (document.getElementById('swUpdateToast')) return;

    var el = document.createElement('div');
    el.id        = 'swUpdateToast';
    el.className = 'cbt-toast cbt-toast--info toast toast-info';
    el.style.cssText = 'max-width:300px;pointer-events:auto';
    el.setAttribute('role', 'alert');

    el.innerHTML =
      TOAST_ICONS.info +
      '<span style="flex:1;font-size:0.8125rem;">A new version is available.</span>' +
      '<button id="swUpdateBtn"' +
        ' style="background:var(--brand,#3b5bdb);color:#fff;border:none;cursor:pointer;' +
        'font-weight:600;font-size:0.75rem;padding:0.25rem 0.625rem;' +
        'border-radius:4px;margin-left:0.5rem;white-space:nowrap;font-family:inherit;">' +
        'Update' +
      '</button>';

    container.appendChild(el);

    document.getElementById('swUpdateBtn').addEventListener('click', function () {
      el.remove();
      if (typeof onConfirm === 'function') onConfirm();
    });
  }

  /* ── Ripple effect — attach to all .btn elements (delegated) ── */
  function _initRipple() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.btn');
      if (!btn || btn.disabled) return;

      var rect   = btn.getBoundingClientRect();
      var x      = e.clientX - rect.left;
      var y      = e.clientY - rect.top;
      var size   = Math.max(rect.width, rect.height) * 1.5;

      var ripple = document.createElement('span');
      ripple.className  = 'btn-ripple';
      ripple.style.cssText =
        'width:' + size + 'px;' +
        'height:' + size + 'px;' +
        'left:' + (x - size / 2) + 'px;' +
        'top:' + (y - size / 2) + 'px;';

      btn.appendChild(ripple);

      ripple.addEventListener('animationend', function () {
        if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
      }, { once: true });
    }, { passive: true });
  }

  /* ── Private helpers ── */
  function _escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', function () {
    _initRipple();
  });

  window.UI = {
    toast,
    setLoading,
    mount,
    confirmAction,
    showUpdateToast,
  };

}());
