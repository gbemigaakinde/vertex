/**
 * Toast Notification Module
 *
 * Provides non-blocking user feedback to replace all alert() and confirm()
 * calls in the application. Toasts queue, animate in, and auto-dismiss.
 *
 * Usage:
 *   Toast.success('Exam submitted successfully.');
 *   Toast.error('Connection failed. Please try again.');
 *   Toast.info('Timer started.');
 *   Toast.warning('Less than 10 minutes remaining.');
 *
 *   For confirmations that previously used confirm():
 *   const confirmed = await Toast.confirm('Submit exam? This cannot be undone.');
 */

const Toast = (function () {
  'use strict';

  const DURATION = 4000; // ms before auto-dismiss

  // Create the container once and append to body.
  let container = null;

  function ensureContainer() {
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * Show a toast message.
   * @param {string} message
   * @param {'success'|'error'|'info'|'warning'} type
   */
  function show(message, type) {
    const c = ensureContainer();
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = message;
    c.appendChild(el);

    // Trigger reflow so the transition fires.
    void el.offsetWidth;
    el.classList.add('show');

    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 400);
    }, DURATION);
  }

  /**
   * Show a modal confirmation dialog that resolves to true/false.
   * This replaces the blocking window.confirm() call.
   * @param {string} message
   * @returns {Promise<boolean>}
   */
  function confirm(message) {
    return new Promise(function (resolve) {
      // Remove any existing confirm dialogs first.
      const existing = document.getElementById('toast-confirm-overlay');
      if (existing) existing.parentNode.removeChild(existing);

      const overlay = document.createElement('div');
      overlay.id = 'toast-confirm-overlay';
      overlay.style.cssText = [
        'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.65)',
        'display:flex', 'align-items:center', 'justify-content:center',
        'z-index:10000', 'padding:1.5rem'
      ].join(';');

      overlay.innerHTML = [
        '<div style="background:white;border-radius:1.5rem;padding:2.5rem;max-width:480px;',
        'width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center;',
        'animation:fadeIn 0.25s ease-out;">',
          '<p style="font-size:1.2rem;font-weight:600;margin:0 0 2rem;line-height:1.5;color:#1e293b;">',
            Utils.escapeHtml(message),
          '</p>',
          '<div style="display:flex;gap:1rem;justify-content:center;">',
            '<button id="toast-confirm-yes" class="btn" style="padding:0.75rem 2rem;font-size:1rem;">',
              'Yes, Confirm',
            '</button>',
            '<button id="toast-confirm-no" class="btn" ',
              'style="padding:0.75rem 2rem;font-size:1rem;background:linear-gradient(to right,#64748b,#94a3b8);">',
              'Cancel',
            '</button>',
          '</div>',
        '</div>'
      ].join('');

      document.body.appendChild(overlay);

      function cleanup(result) {
        overlay.parentNode.removeChild(overlay);
        resolve(result);
      }

      document.getElementById('toast-confirm-yes').addEventListener('click', function () {
        cleanup(true);
      });
      document.getElementById('toast-confirm-no').addEventListener('click', function () {
        cleanup(false);
      });
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) cleanup(false);
      });
    });
  }

  /**
   * Show a modal prompt that resolves to the entered string or null on cancel.
   * Replaces the blocking window.prompt() call.
   * @param {string} message
   * @param {string} [defaultValue]
   * @returns {Promise<string|null>}
   */
  function prompt(message, defaultValue) {
    return new Promise(function (resolve) {
      const existing = document.getElementById('toast-prompt-overlay');
      if (existing) existing.parentNode.removeChild(existing);

      const overlay = document.createElement('div');
      overlay.id = 'toast-prompt-overlay';
      overlay.style.cssText = [
        'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.65)',
        'display:flex', 'align-items:center', 'justify-content:center',
        'z-index:10000', 'padding:1.5rem'
      ].join(';');

      overlay.innerHTML = [
        '<div style="background:white;border-radius:1.5rem;padding:2.5rem;max-width:480px;',
        'width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);animation:fadeIn 0.25s ease-out;">',
          '<p style="font-size:1.1rem;font-weight:600;margin:0 0 1rem;color:#1e293b;">',
            Utils.escapeHtml(message),
          '</p>',
          '<input id="toast-prompt-input" type="text" ',
            'value="' + Utils.escapeHtml(defaultValue || '') + '" ',
            'style="width:100%;box-sizing:border-box;padding:0.875rem;border-radius:0.75rem;',
            'border:2px solid #e2e8f0;font-size:1rem;margin-bottom:1.5rem;outline:none;" />',
          '<div style="display:flex;gap:1rem;justify-content:flex-end;">',
            '<button id="toast-prompt-ok" class="btn" style="padding:0.75rem 2rem;font-size:1rem;">',
              'OK',
            '</button>',
            '<button id="toast-prompt-cancel" class="btn" ',
              'style="padding:0.75rem 2rem;font-size:1rem;background:linear-gradient(to right,#64748b,#94a3b8);">',
              'Cancel',
            '</button>',
          '</div>',
        '</div>'
      ].join('');

      document.body.appendChild(overlay);

      const input = document.getElementById('toast-prompt-input');
      input.focus();
      input.select();

      function cleanup(value) {
        overlay.parentNode.removeChild(overlay);
        resolve(value);
      }

      document.getElementById('toast-prompt-ok').addEventListener('click', function () {
        cleanup(input.value);
      });
      document.getElementById('toast-prompt-cancel').addEventListener('click', function () {
        cleanup(null);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') cleanup(input.value);
        if (e.key === 'Escape') cleanup(null);
      });
    });
  }

  return {
    success: function (msg) { show(msg, 'success'); },
    error:   function (msg) { show(msg, 'error'); },
    info:    function (msg) { show(msg, 'info'); },
    warning: function (msg) { show(msg, 'warning'); },
    confirm: confirm,
    prompt:  prompt
  };

})();