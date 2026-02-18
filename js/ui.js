/* ============================================================
   js/ui.js — UI helpers: toasts, loading states, modals
   ============================================================
   CHANGES FROM ORIGINAL:
   1. confirmAction() replaced with a DOM-based modal.
      window.confirm() is suppressed on Chrome Android in
      standalone PWA mode (display: standalone / fullscreen),
      causing exam submission to silently fail. The DOM modal
      works correctly in all display modes.
   2. showUpdateToast() added for PWA update notifications.
   ============================================================ */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────── */
  /* Toast notifications                                     */
  /* ─────────────────────────────────────────────────────── */

  /**
   * Show a non-blocking toast notification.
   * @param {string} message
   * @param {'success'|'error'|'info'|'warning'} type
   * @param {number} duration  milliseconds before auto-dismiss (0 = never)
   */
  function toast(message, type, duration) {
    type     = type     || 'info';
    duration = duration !== undefined ? duration : 4000;

    var container = document.getElementById('toastContainer');
    if (!container) return;

    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.setAttribute('role', 'alert');
    el.innerHTML =
      '<span style="flex:1">' + message + '</span>' +
      '<button onclick="this.parentElement.remove()" ' +
        'style="background:none;border:none;color:inherit;cursor:pointer;' +
        'font-size:1.1rem;line-height:1;padding:0;opacity:0.8" ' +
        'aria-label="Dismiss notification">&times;</button>';

    container.appendChild(el);

    if (duration > 0) {
      setTimeout(function () {
        el.classList.add('dismissing');
        el.addEventListener('animationend', function () { el.remove(); }, { once: true });
      }, duration);
    }
  }

  /* ─────────────────────────────────────────────────────── */
  /* Button loading state                                    */
  /* ─────────────────────────────────────────────────────── */

  function setLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
      btn.disabled = true;
      btn.classList.add('btn-loading');
      btn._originalText = btn.textContent;
    } else {
      btn.disabled = false;
      btn.classList.remove('btn-loading');
    }
  }

  /* ─────────────────────────────────────────────────────── */
  /* Mount main content                                      */
  /* ─────────────────────────────────────────────────────── */

  function mount(html) {
    var app = document.getElementById('app');
    if (app) app.innerHTML = html;
  }

  /* ─────────────────────────────────────────────────────── */
  /* Confirm dialog — DOM-based, PWA-safe                    */
  /* ─────────────────────────────────────────────────────── */

  /*
   * window.confirm() is silently suppressed on Chrome Android
   * when the PWA is installed in standalone or fullscreen mode.
   * It returns undefined (falsy) without displaying any UI,
   * meaning actions gated behind it (like exam submission) would
   * silently fail without any feedback to the user.
   *
   * This implementation renders a modal directly into the DOM
   * and resolves a Promise when the user interacts with it.
   * It works identically in browser, standalone, and fullscreen.
   */

  /**
   * Show a confirmation dialog.
   * @param   {string}  message   — Question to display to the user.
   * @returns {Promise<boolean>}  — Resolves true (confirm) or false (cancel).
   */
  function confirmAction(message) {
    return new Promise(function (resolve) {
      /* Remove any existing confirm modal to prevent stacking */
      var existing = document.getElementById('uiConfirmModal');
      if (existing) existing.remove();

      var overlay = document.createElement('div');
      overlay.id        = 'uiConfirmModal';
      overlay.className = 'modal-overlay';
      overlay.setAttribute('role',            'dialog');
      overlay.setAttribute('aria-modal',      'true');
      overlay.setAttribute('aria-labelledby', 'uiConfirmTitle');

      overlay.innerHTML =
        '<div class="modal-box" style="max-width:28rem;text-align:center">' +
          '<p id="uiConfirmTitle" class="text-xl font-semibold mb-8" style="line-height:1.5">' +
            _escHtml(message) +
          '</p>' +
          '<div style="display:flex;gap:1rem;justify-content:center">' +
            '<button id="uiConfirmCancel" ' +
              'class="btn bg-gray-500 hover:bg-gray-600 text-lg px-10 py-4" ' +
              'style="background:linear-gradient(to right,#64748b,#94a3b8)">' +
              'Cancel' +
            '</button>' +
            '<button id="uiConfirmOk" ' +
              'class="btn bg-red-600 hover:bg-red-700 text-lg px-10 py-4" ' +
              'style="background:linear-gradient(to right,#dc2626,#ef4444)">' +
              'Confirm' +
            '</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(overlay);

      /* Trap focus within the modal while it is open */
      var okBtn     = document.getElementById('uiConfirmOk');
      var cancelBtn = document.getElementById('uiConfirmCancel');

      function _cleanup() {
        overlay.remove();
      }

      okBtn.addEventListener('click', function () {
        _cleanup();
        resolve(true);
      });

      cancelBtn.addEventListener('click', function () {
        _cleanup();
        resolve(false);
      });

      /*
       * Pressing Escape is equivalent to pressing Cancel.
       * The listener is added to the overlay so it is automatically
       * removed from the DOM when the overlay is removed.
       */
      overlay.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          _cleanup();
          resolve(false);
        }
      });

      /*
       * Clicking the backdrop (overlay itself, not the modal box)
       * is equivalent to Cancel.
       */
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
          _cleanup();
          resolve(false);
        }
      });

      /* Focus the Cancel button by default — safer for destructive actions */
      setTimeout(function () { cancelBtn.focus(); }, 0);
    });
  }

  /* ─────────────────────────────────────────────────────── */
  /* PWA update notification                                 */
  /* ─────────────────────────────────────────────────────── */

  /**
   * Show a persistent update-available toast with an action button.
   * Called from the inline SW registration script in index.html.
   * @param {Function} onConfirm — Called when the user clicks "Update".
   */
  function showUpdateToast(onConfirm) {
    var container = document.getElementById('toastContainer');
    if (!container) return;

    /* Avoid showing duplicate update toasts */
    if (document.getElementById('swUpdateToast')) return;

    var el = document.createElement('div');
    el.id        = 'swUpdateToast';
    el.className = 'toast toast-info';
    el.style.cssText = 'max-width:360px;pointer-events:auto';
    el.setAttribute('role', 'alert');
    el.innerHTML =
      '<span style="flex:1;font-size:0.9rem">A new version is available.</span>' +
      '<button id="swUpdateBtn" ' +
        'style="background:white;color:#6b46c1;border:none;cursor:pointer;' +
        'font-weight:700;font-size:0.85rem;padding:0.3rem 0.75rem;' +
        'border-radius:0.5rem;margin-left:0.5rem;white-space:nowrap">' +
        'Update now' +
      '</button>';

    container.appendChild(el);

    document.getElementById('swUpdateBtn').addEventListener('click', function () {
      el.remove();
      if (typeof onConfirm === 'function') onConfirm();
    });
  }

  /* ─────────────────────────────────────────────────────── */
  /* Private helpers                                         */
  /* ─────────────────────────────────────────────────────── */

  function _escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ─────────────────────────────────────────────────────── */
  /* Expose                                                  */
  /* ─────────────────────────────────────────────────────── */

  window.UI = {
    toast,
    setLoading,
    mount,
    confirmAction,
    showUpdateToast,
  };

})();