/* ============================================================
   js/ui.js — UI helpers: toasts, loading states, DOM utilities
   ============================================================ */

(function () {
  'use strict';

  /* ── Toast notifications ── */

  /**
   * Show a non-blocking toast notification.
   * @param {string} message
   * @param {'success'|'error'|'info'|'warning'} type
   * @param {number} duration  milliseconds before auto-dismiss (0 = never)
   */
  function toast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span style="flex:1">${message}</span>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;font-size:1.1rem;line-height:1;padding:0;opacity:0.8">×</button>`;
    container.appendChild(el);

    if (duration > 0) {
      setTimeout(() => {
        el.classList.add('dismissing');
        el.addEventListener('animationend', () => el.remove(), { once: true });
      }, duration);
    }
  }

  /* ── Button loading state ── */

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

  /* ── Mount main content ── */

  function mount(html) {
    const app = document.getElementById('app');
    if (app) app.innerHTML = html;
  }

  /* ── Confirm dialog (Promise-based, non-blocking visually) ── */
  // We still use native confirm() here for reliability, but wrap it
  function confirmAction(message) {
    return Promise.resolve(window.confirm(message));
  }

  /* ── Expose ── */
  window.UI = { toast, setLoading, mount, confirmAction };

})();