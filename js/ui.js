/* ============================================================
   js/ui.js — UI helpers: toasts, loading states, modals
   ============================================================
   CHANGES FROM v2:
   1. Toast uses design-system class names (cbt-toast-*)
      instead of legacy .toast classes.
   2. Confirm modal uses design-system classes; no inline
      gradient styles that conflict with the design system.
   3. setLoading uses cbt-btn is-loading / btn btn-loading
      for backward compatibility.
   4. showUpdateToast updated to cbt-toast classes.
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
   * @param {number} duration  ms before auto-dismiss (0 = never)
   */
  function toast(message, type, duration) {
    type     = type     || 'info';
    duration = duration !== undefined ? duration : 4000;

    var container = document.getElementById('toastContainer');
    if (!container) return;

    var el = document.createElement('div');
    // Support both legacy class names and new design system names
    el.className = 'cbt-toast cbt-toast--' + type + ' toast toast-' + type;
    el.setAttribute('role', 'alert');
    el.innerHTML =
      '<span style="flex:1;font-size:0.8125rem">' + message + '</span>' +
      '<button class="cbt-toast__dismiss" aria-label="Dismiss notification">&#x2715;</button>';

    el.querySelector('.cbt-toast__dismiss').addEventListener('click', function () {
      el.remove();
    });

    container.appendChild(el);

    if (duration > 0) {
      setTimeout(function () {
        el.classList.add('is-dismissing', 'dismissing');
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

  /**
   * Show a confirmation dialog.
   * @param   {string}  message
   * @returns {Promise<boolean>}
   */
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
             'color:var(--text-primary,#111827);line-height:1.6;margin-bottom:1.5rem;">' +
            _escHtml(message) +
          '</p>' +
          '<div style="display:flex;gap:0.75rem;justify-content:center;">' +
            '<button id="uiConfirmCancel" class="btn bg-gray-500">' +
              'Cancel' +
            '</button>' +
            '<button id="uiConfirmOk" class="btn bg-red-600">' +
              'Confirm' +
            '</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(overlay);

      var okBtn     = document.getElementById('uiConfirmOk');
      var cancelBtn = document.getElementById('uiConfirmCancel');

      function _cleanup() { overlay.remove(); }

      okBtn.addEventListener('click', function () {
        _cleanup();
        resolve(true);
      });

      cancelBtn.addEventListener('click', function () {
        _cleanup();
        resolve(false);
      });

      overlay.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { _cleanup(); resolve(false); }
      });

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) { _cleanup(); resolve(false); }
      });

      setTimeout(function () { cancelBtn.focus(); }, 0);
    });
  }

  /* ─────────────────────────────────────────────────────── */
  /* PWA update notification                                 */
  /* ─────────────────────────────────────────────────────── */

  /**
   * @param {Function} onConfirm — Called when the user clicks "Update".
   */
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
