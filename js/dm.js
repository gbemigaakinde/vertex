/* ============================================================
   js/dm.js — Direct Messaging + Presence System (v3)
   ============================================================ */

(function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────────────── */
  const HEARTBEAT_INTERVAL_MS  = 20_000;   // write online every 20 s
  const ONLINE_THRESHOLD_MS    = 55_000;   // grace: 2 missed beats + margin
  const PRESENCE_REFRESH_MS    = 15_000;   // re-evaluate dots locally

  /* ── Module-level presence refresh timer ───────────────────── */
  let _presenceRefreshTimer = null;

  function _startPresenceRefreshTimer() {
    if (_presenceRefreshTimer) return;
    _presenceRefreshTimer = setInterval(_refreshAllPresenceElements, PRESENCE_REFRESH_MS);
  }

  function _stopPresenceRefreshTimer() {
    if (_presenceRefreshTimer) { clearInterval(_presenceRefreshTimer); _presenceRefreshTimer = null; }
  }

  /**
   * Re-renders every [data-presence-ts] element already in the DOM
   * using only the cached timestamp — zero extra Firestore reads.
   */
  function _refreshAllPresenceElements() {
  document.querySelectorAll('[data-presence-ts]').forEach(el => {
    const raw  = el.dataset.presenceTs;
    if (raw === undefined) return;
    const tsMs = raw === 'null' ? null : parseInt(raw, 10);
    const ts   = tsMs ? new Date(tsMs) : null;

    // Thread-list presence span (has class dm-thread-presence)
    if (el.classList.contains('dm-thread-presence')) {
      const online = tsMs !== null && (Date.now() - tsMs) <= ONLINE_THRESHOLD_MS;

      // Update the text content
      if (online) {
        el.textContent = '● Online';
        el.classList.add('online');
      } else {
        el.textContent = ts ? _formatLastSeen(ts) : 'Offline';
        el.classList.remove('online');
      }

      // Also update the avatar circle border and dot indicator in the same thread row
      const threadItem = el.closest('.dm-thread-item');
      if (threadItem) {
        const circle = threadItem.querySelector('.dm-thread-av-circle');
        const dot    = threadItem.querySelector('.dm-thread-av-dot');
        if (circle) {
          if (online) circle.classList.add('online');
          else        circle.classList.remove('online');
        }
        if (online && !dot) {
          const av = threadItem.querySelector('.dm-thread-av');
          if (av) {
            const newDot = document.createElement('span');
            newDot.className = 'dm-thread-av-dot';
            av.appendChild(newDot);
          }
        } else if (!online && dot) {
          dot.remove();
        }
      }
      return;
    }

    // Standard dm-presence widget (used in chat headers)
    el.innerHTML = _presenceHTML(ts);
  });
}

  /* ── Offline-persistence bootstrap ────────────────────────── */
  (function _enableOfflinePersistence() {
    try {
      const db = window.fbDb;
      if (!db || db._persistenceEnabled) return;
      db.enablePersistence({ synchronizeTabs: true })
        .then(() => { db._persistenceEnabled = true; })
        .catch(err => {
          if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
            console.warn('[dm] Firestore persistence error:', err);
          }
          db._persistenceEnabled = true;
        });
    } catch (e) {
      console.warn('[dm] Could not enable Firestore persistence:', e);
    }
  }());

  /* ── Presence helpers ──────────────────────────────────────── */
  function _isRecentlyActive(ts) {
    if (!ts) return false;
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return (Date.now() - date.getTime()) <= ONLINE_THRESHOLD_MS;
  }

  /** Returns the millisecond epoch for a Firestore or JS timestamp, or null. */
  function _tsToMs(ts) {
    if (!ts) return null;
    if (ts.toDate) return ts.toDate().getTime();
    if (ts instanceof Date) return ts.getTime();
    return parseInt(ts, 10) || null;
  }

  function _presenceHTML(ts) {
    const tsMs = _tsToMs(ts);
    const online = tsMs !== null && (Date.now() - tsMs) <= ONLINE_THRESHOLD_MS;
    const attr   = `data-presence-ts="${tsMs ?? 'null'}"`;

    if (online) {
      return `<span class="dm-presence" ${attr}>
        <span class="dm-presence__dot dm-presence__dot--online"></span>
        <span class="dm-presence__label dm-presence__label--online">Online</span>
      </span>`;
    }
    return `<span class="dm-presence" ${attr}>
      <span class="dm-presence__dot dm-presence__dot--offline"></span>
      <span class="dm-presence__label">${_esc(_formatLastSeen(ts))}</span>
    </span>`;
  }

  /* ── SVG icon helpers ──────────────────────────────────────── */
  function _iconLock(size) {
    size = size || 14;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="flex-shrink:0;">
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="1.75"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    </svg>`;
  }

  function _iconMail(size) {
    size = size || 14;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="flex-shrink:0;">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" stroke-width="1.75"/>
      <path d="M2 7l10 7 10-7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    </svg>`;
  }

  function _iconPencil(size) {
    size = size || 14;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
            stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
            stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  function _iconClose(size) {
    size = size || 16;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    </svg>`;
  }

  function _iconSearch(size) {
    size = size || 14;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.75"/>
      <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    </svg>`;
  }

  function _iconHistory(size) {
    size = size || 14;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
            stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3 3v5h5" stroke="currentColor" stroke-width="1.75"
            stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 7v5l4 2" stroke="currentColor" stroke-width="1.75"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  function _tickIcon(status) {
    if (status === 'read') {
      return `<span class="dm-ticks dm-ticks--read" title="Read" aria-label="Read">
        <svg width="16" height="10" viewBox="0 0 16 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 5L4.5 8.5L10.5 2" stroke="#53c8f5" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M5.5 5L9 8.5L15 2" stroke="#53c8f5" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>`;
    }
    if (status === 'delivered') {
      return `<span class="dm-ticks dm-ticks--delivered" title="Delivered" aria-label="Delivered">
        <svg width="16" height="10" viewBox="0 0 16 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 5L4.5 8.5L10.5 2" stroke="rgba(255,255,255,0.6)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M5.5 5L9 8.5L15 2" stroke="rgba(255,255,255,0.6)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>`;
    }
    if (status === 'pending') {
      return `<span class="dm-ticks dm-ticks--pending" title="Pending — will send when online" aria-label="Pending">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.5)" stroke-width="1.75"/>
          <path d="M12 7v5l3 3" stroke="rgba(255,255,255,0.5)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>`;
    }
    return `<span class="dm-ticks dm-ticks--sent" title="Sent" aria-label="Sent">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1.5 5L4 7.5L8.5 2" stroke="rgba(255,255,255,0.6)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>`;
  }

  /* ── CSS injection ─────────────────────────────────────────── */
  function _injectStyles() {
  if (document.getElementById('_dmStyles')) return;
  const style = document.createElement('style');
  style.id = '_dmStyles';
  style.textContent = `
    .dm-ticks { display:inline-flex;align-items:center;margin-left:2px;vertical-align:middle;flex-shrink:0;line-height:1; }

    .dm-bubble-inner:hover .dm-edit-trigger-btn,
    .dm-bubble-inner:focus-within .dm-edit-trigger-btn,
    .dm-bubble-inner.menu-open .dm-edit-trigger-btn { opacity:1 !important; }
    @media (hover: none) {
      .dm-edit-trigger-btn { opacity:0.45 !important; }
    }

    .dm-presence { display:inline-flex;align-items:center;gap:5px;font-size:.6875rem;line-height:1;margin-top:3px; }
    .dm-presence__dot { width:7px;height:7px;border-radius:50%;flex-shrink:0;transition:background .4s; }
    .dm-presence__dot--online { background:#22c45e;box-shadow:0 0 0 2px rgba(34,196,94,.2); }
    .dm-presence__dot--offline { background:var(--text-4,#9ca3af); }
    .dm-presence__label { color:var(--text-3,#6b7280);font-size:.6875rem; }
    .dm-presence__label--online { color:#22c45e !important;font-weight:500; }

    .dm-date-sep { display:flex;align-items:center;gap:.625rem;margin:.875rem 0 .625rem;user-select:none; }
    .dm-date-sep__line { flex:1;height:1px;background:var(--border,#e5e7eb); }
    .dm-date-sep__label {
      font-size:.625rem;font-weight:600;letter-spacing:.04em;color:var(--text-4,#9ca3af);
      white-space:nowrap;padding:2px 8px;border-radius:99px;
      background:var(--bg-subtle,#f3f4f6);border:1px solid var(--border,#e5e7eb);
    }

    #dmTeacherShell {
      position:relative;width:100%;max-width:100%;min-width:0;
      box-sizing:border-box;overflow:hidden;
    }

    #teacher-dm {
      width:100%;max-width:100%;min-width:0;box-sizing:border-box;overflow:hidden;
    }

    .dm-thread-list-wrap {
      width:100%;max-width:100%;min-width:0;
      overflow-x:hidden;overflow-y:auto;box-sizing:border-box;
    }

    .dm-thread-item {
      display:flex;align-items:flex-start;gap:.75rem;padding:.75rem 1rem;cursor:pointer;
      border-bottom:1px solid var(--border,#e5e7eb);background:transparent;
      transition:background .12s ease;box-sizing:border-box;
      width:100%;max-width:100%;min-width:0;overflow:hidden;
    }
    .dm-thread-item:last-child { border-bottom:none; }
    .dm-thread-item:hover { background:var(--bg-subtle,#f5f5f7); }
    .dm-thread-item.is-active { background:var(--accent-subtle,rgba(79,110,247,.07)); }

    .dm-thread-av { flex-shrink:0;position:relative;width:42px;height:42px;min-width:42px; }
    .dm-thread-av-circle {
      width:42px;height:42px;border-radius:50%;
      background:var(--accent-subtle,rgba(79,110,247,.08));
      border:1.5px solid var(--accent-border,rgba(79,110,247,.25));
      display:flex;align-items:center;justify-content:center;
      font-size:.9375rem;font-weight:700;color:var(--accent-text,#2d49d6);flex-shrink:0;
    }
    .dm-thread-av-circle.online { border-color:#22c45e; }
    .dm-thread-av-dot {
      position:absolute;bottom:1px;right:1px;
      width:11px;height:11px;border-radius:50%;
      background:#22c45e;border:2px solid var(--bg-base,#fff);
    }

    .dm-thread-bd { flex:1 1 0%;min-width:0;max-width:100%;overflow:hidden; }
    .dm-thread-r1 {
      display:flex;align-items:baseline;justify-content:space-between;
      gap:.375rem;margin-bottom:1px;min-width:0;overflow:hidden;
    }
    .dm-thread-name {
      font-size:.875rem;font-weight:700;color:var(--text-1,#0d0d0f);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1 1 0%;min-width:0;
    }
    .dm-thread-date { font-size:.6875rem;color:var(--text-4,#9ca3af);flex-shrink:0;white-space:nowrap; }
    .dm-thread-presence {
      font-size:.6875rem;color:var(--text-3,#6b7280);margin-bottom:1px;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:block;
    }
    .dm-thread-presence.online { color:#22c45e;font-weight:600; }

    .dm-thread-r2 {
      display:flex;align-items:center;justify-content:space-between;
      gap:.375rem;min-width:0;overflow:hidden;
    }
    .dm-thread-preview {
      font-size:.8125rem;color:var(--text-3,#6b7280);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1 1 0%;min-width:0;
    }
    .dm-thread-badge {
      flex-shrink:0;min-width:20px;height:20px;border-radius:99px;
      background:var(--danger,#e03b3b);color:#fff;
      font-size:.625rem;font-weight:700;
      display:flex;align-items:center;justify-content:center;padding:0 5px;line-height:1;
    }
    .dm-thread-class {
      display:block;font-size:.625rem;font-weight:500;
      color:var(--accent-text,#2d49d6);background:var(--accent-subtle,rgba(79,110,247,.08));
      border:1px solid var(--accent-border,rgba(79,110,247,.25));
      border-radius:4px;padding:1px 6px;margin-top:3px;white-space:nowrap;
      max-width:100%;overflow:hidden;text-overflow:ellipsis;width:fit-content;
    }

    .dm-new-conv-overlay {
      position:fixed;inset:0;background:rgba(0,0,0,.45);
      display:flex;align-items:center;justify-content:center;
      z-index:9999;animation:dmFadeIn .15s ease;
    }
    @keyframes dmFadeIn { from{opacity:0} to{opacity:1} }
    .dm-new-conv-modal {
      background:var(--bg-base,#fff);border-radius:14px;
      width:min(480px,94vw);padding:1.25rem 1.5rem;
      box-shadow:0 20px 60px rgba(0,0,0,.2);
      border:1px solid var(--border,#e5e7eb);box-sizing:border-box;
    }
    .dm-action-menu {
      position:fixed;z-index:9999;background:var(--bg-base,#fff);
      border:1px solid var(--border,#e5e7eb);border-radius:8px;
      box-shadow:0 6px 20px rgba(0,0,0,.12);min-width:148px;overflow:hidden;animation:dmFadeIn .1s ease;
    }
    .dm-action-menu-item {
      display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;
      font-size:.8125rem;color:var(--text-1,#0d0d0f);cursor:pointer;
      transition:background .1s;white-space:nowrap;
      border:none;background:none;width:100%;text-align:left;font-family:var(--font);
    }
    .dm-action-menu-item:hover { background:var(--bg-subtle,#f3f4f6); }
    .dm-action-menu-item + .dm-action-menu-item { border-top:1px solid var(--border,#e5e7eb); }

    .dm-edit-textarea {
      width:100%;resize:none;overflow-y:hidden;line-height:1.55;
      font-size:.875rem;font-family:var(--font);padding:.375rem .5rem;
      border-radius:6px;outline:none;
      min-height:2.4rem;box-sizing:border-box;
    }
    .dm-edit-actions { display:flex;gap:.375rem;margin-top:.375rem;justify-content:flex-end; }
    .dm-edit-btn { font-size:.6875rem;font-weight:600;padding:3px 11px;border-radius:5px;border:none;cursor:pointer;font-family:var(--font); }
    .dm-edit-btn--save { background:#fff;color:var(--accent,#4f6ef7); }
    .dm-edit-btn--cancel { background:rgba(255,255,255,.2);color:inherit;opacity:.75; }
    .dm-edit-btn--save-light { background:var(--accent,#4f6ef7);color:#fff; }
    .dm-edit-btn--cancel-light { background:var(--bg-subtle,#f3f4f6);color:var(--text-2,#3a3a40);border:1px solid var(--border,#e5e7eb); }
    .dm-edited-label { font-size:.5625rem;opacity:.6;font-style:italic;margin-left:4px;line-height:1;white-space:nowrap; }

    .dm-history-overlay {
      position:fixed;inset:0;background:rgba(0,0,0,.5);
      display:flex;align-items:center;justify-content:center;
      z-index:10000;padding:1rem;animation:dmFadeIn .15s ease;box-sizing:border-box;
    }
    .dm-history-modal {
      background:var(--bg-base,#fff);border-radius:12px;
      width:min(460px,96vw);max-height:80vh;display:flex;flex-direction:column;
      box-shadow:0 20px 60px rgba(0,0,0,.22);border:1px solid var(--border,#e5e7eb);box-sizing:border-box;
    }
    .dm-history-header {
      display:flex;align-items:center;justify-content:space-between;
      padding:.875rem 1.125rem;border-bottom:1px solid var(--border,#e5e7eb);flex-shrink:0;
    }
    .dm-history-body { overflow-y:auto;padding:.75rem 1rem;flex:1;display:flex;flex-direction:column;gap:.625rem; }
    .dm-history-entry {
      padding:.625rem .875rem;border-radius:8px;
      border:1px solid var(--border,#e5e7eb);background:var(--bg-subtle,#f9fafb);
    }
    .dm-history-entry p { font-size:.875rem;line-height:1.55;color:var(--text-1,#0d0d0f);white-space:pre-wrap;word-break:break-word;margin:0; }
    .dm-history-entry time { display:block;font-size:.625rem;color:var(--text-4,#9ca3af);margin-top:.25rem; }
    .dm-history-current { background:var(--accent-subtle,rgba(79,110,247,.08));border-color:var(--accent-border,rgba(79,110,247,.25)); }
    .dm-history-current p { font-weight:500; }

    .dm-msg-out {
      display:flex;flex-direction:column;align-items:flex-end;
      margin-bottom:.75rem;padding-left:20%;box-sizing:border-box;width:100%;max-width:100%;min-width:0;
    }
    .dm-msg-in {
      display:flex;flex-direction:column;align-items:flex-start;
      margin-bottom:.75rem;padding-right:20%;box-sizing:border-box;width:100%;max-width:100%;min-width:0;
    }
    .dm-bubble-wrap { display:inline-flex;flex-direction:column;max-width:100%;min-width:0; }
    .dm-bubble-inner {
      word-break:break-word;overflow-wrap:break-word;display:block;
      max-width:100%;box-sizing:border-box;position:relative;
    }
    .dm-bubble-text { font-size:.9375rem;line-height:1.5;white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;margin:0; }
    .dm-bubble-footer { display:flex;align-items:center;gap:3px;margin-top:2px; }
    .dm-bubble-footer--end   { justify-content:flex-end; }
    .dm-bubble-footer--start { justify-content:flex-start; }
    .dm-bubble-time { font-size:.625rem;opacity:.7;line-height:1;white-space:nowrap;flex-shrink:0; }
    .dm-bubble-time--dim { opacity:.55; }

    .dm-messages-area { overflow-y:auto;overflow-x:hidden;box-sizing:border-box;width:100%;max-width:100%;min-width:0; }

    .dm-picker-row { min-width:0;overflow:hidden; }

    #teacher-dm { overflow:hidden !important;min-width:0;box-sizing:border-box; }

    .dm-reply-bar {
      display:none;align-items:center;gap:.5rem;
      padding:.375rem .625rem;margin:.375rem 0 0;
      background:var(--accent-subtle,rgba(79,110,247,.07));
      border-left:3px solid var(--accent,#4f6ef7);border-radius:0 6px 6px 0;
      font-size:.75rem;color:var(--text-2,#3a3a40);
      box-sizing:border-box;width:100%;overflow:hidden;animation:dmFadeIn .12s ease;
    }
    .dm-reply-bar.visible { display:flex; }
    .dm-reply-bar__name { font-weight:700;color:var(--accent-text,#2d49d6);white-space:nowrap;flex-shrink:0; }
    .dm-reply-bar__text { white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;opacity:.8; }
    .dm-reply-bar__close { flex-shrink:0;background:none;border:none;cursor:pointer;padding:0;line-height:1;color:var(--text-4,#9ca3af);display:flex;align-items:center; }
    .dm-reply-bar__close:hover { color:var(--text-2,#3a3a40); }

    .dm-reply-card {
      margin-bottom:.375rem;padding:.3rem .5rem;
      border-left:3px solid rgba(255,255,255,.5);border-radius:0 5px 5px 0;
      background:rgba(0,0,0,.12);cursor:pointer;font-size:.75rem;line-height:1.4;overflow:hidden;
    }
    .dm-msg-in .dm-reply-card { border-left-color:var(--accent,#4f6ef7);background:var(--accent-subtle,rgba(79,110,247,.08)); }
    .dm-reply-card__name { font-weight:700;display:block;margin-bottom:1px; }
    .dm-msg-out .dm-reply-card__name { color:rgba(255,255,255,.9); }
    .dm-msg-in  .dm-reply-card__name { color:var(--accent-text,#2d49d6); }
    .dm-reply-card__text { display:block;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%; }

    .dm-swipe-wrap {
      position:relative;overflow:visible;
      width:100%;max-width:100%;min-width:0;box-sizing:border-box;touch-action:pan-y;
    }
    .dm-swipe-wrap .dm-swipe-inner { transition:transform .2s ease;will-change:transform; }
    .dm-swipe-hint {
      position:absolute;top:50%;transform:translateY(-50%);
      display:flex;align-items:center;justify-content:center;
      width:32px;height:32px;border-radius:50%;
      background:var(--accent-subtle,rgba(79,110,247,.15));color:var(--accent,#4f6ef7);
      opacity:0;pointer-events:none;transition:opacity .15s;
    }
    .dm-msg-out .dm-swipe-hint { right:calc(100% + 8px); }
    .dm-msg-in  .dm-swipe-hint { left:calc(100% + 8px); }
  `;
  document.head.appendChild(style);
}

  /* ── Date/time helpers ─────────────────────────────────────── */
  function _dateLabelFor(date) {
    const now       = new Date();
    const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const msgDay    = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (msgDay.getTime() === today.getTime())     return 'Today';
    if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
    const sameYear = date.getFullYear() === now.getFullYear();
    return date.toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
  }

  function _dayKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function _formatLastSeen(ts) {
    if (!ts) return 'Last seen: unknown';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const now  = new Date();
    const diffMins = Math.floor((now - date) / 60000);
    if (diffMins < 1)  return 'Last seen: just now';
    if (diffMins < 60) return `Last seen: ${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return 'Last seen today at ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Last seen yesterday at ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return 'Last seen ' +
      date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
      ' at ' +
      date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  /* ══════════════════════════════════════════════════════════════
     PRESENCE — STUDENT
     Writes to BOTH directMessages/{uid} AND students/{uid} so that
     watchers on either document always see a fresh lastSeen.
  ══════════════════════════════════════════════════════════════ */

  let _studentOfflineCleanup      = null;
  let _teacherOfflineCleanup      = null;
  let _studentVisibilityHandler   = null;
  let _teacherVisibilityHandler   = null;
  let _studentBeforeunloadHandler = null;
  let _teacherBeforeunloadHandler = null;
  let _studentOfflineDone         = false;
  let _teacherOfflineDone         = false;
  let _teacherIsOnline            = false;

  let _studentHeartbeatHandle = null;
  let _teacherHeartbeatHandle = null;

  /** Write a single student heartbeat to both docs. */
  async function _writeStudentOnline(uid) {
    const ts    = firebase.firestore.FieldValue.serverTimestamp();
    const batch = Db().batch();
    batch.set(_threadRef(uid),
      { studentLastSeen: ts, studentOnline: true },
      { merge: true });
    batch.set(Db().collection('students').doc(uid),
      { lastSeen: ts, isOnline: true },
      { merge: true });
    await batch.commit();
  }

  /** Write student offline (stale timestamp) to both docs. */
  async function _writeStudentOffline(uid) {
    const ts    = new Date(Date.now() - (ONLINE_THRESHOLD_MS + 2000));
    const batch = Db().batch();
    batch.set(_threadRef(uid),
      { studentOnline: false, studentLastSeen: ts },
      { merge: true });
    batch.set(Db().collection('students').doc(uid),
      { isOnline: false, lastSeen: ts },
      { merge: true });
    await batch.commit();
  }

  function _startStudentHeartbeat(uid) {
    _stopStudentHeartbeat();
    _studentHeartbeatHandle = setInterval(async () => {
      if (!firebase.auth().currentUser || _studentOfflineDone) {
        _stopStudentHeartbeat();
        return;
      }
      if (document.visibilityState === 'hidden') return;
      try {
        await _writeStudentOnline(uid);
      } catch (e) {
        console.warn('[dm] Student heartbeat write failed:', e);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  function _stopStudentHeartbeat() {
    if (_studentHeartbeatHandle) { clearInterval(_studentHeartbeatHandle); _studentHeartbeatHandle = null; }
  }

  function _startTeacherHeartbeat() {
    _stopTeacherHeartbeat();
    _teacherHeartbeatHandle = setInterval(async () => {
      if (!firebase.auth().currentUser || _teacherOfflineDone) {
        _stopTeacherHeartbeat();
        return;
      }
      if (document.visibilityState === 'hidden') return;
      try {
        const ts = firebase.firestore.FieldValue.serverTimestamp();
        await Db().collection('teacherPresence').doc('global').set(
          { online: true, lastSeen: ts }, { merge: true });
      } catch (e) {
        console.warn('[dm] Teacher heartbeat write failed:', e);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  function _stopTeacherHeartbeat() {
    if (_teacherHeartbeatHandle) { clearInterval(_teacherHeartbeatHandle); _teacherHeartbeatHandle = null; }
  }

  async function _setStudentOnlineGlobal(uid) {
    _studentOfflineDone = false;
    try {
      await _writeStudentOnline(uid);
    } catch (e) {
      console.warn('[dm] Could not set studentOnline=true:', e);
      return;
    }
    _startStudentHeartbeat(uid);
    _startPresenceRefreshTimer();

    const goOffline = async () => {
      if (_studentOfflineDone) return;
      _studentOfflineDone = true;
      _stopStudentHeartbeat();
      try { await _writeStudentOffline(uid); } catch (e) { console.warn('[dm] studentOffline write failed:', e); }
    };
    _studentOfflineCleanup = goOffline;

    _studentVisibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        _stopStudentHeartbeat();
      } else {
        if (firebase.auth().currentUser && !_studentOfflineDone) {
          _writeStudentOnline(uid).catch(() => {});
          _markDelivered(uid, 'student').catch(() => {});
          _startStudentHeartbeat(uid);
        }
      }
    };
    document.addEventListener('visibilitychange', _studentVisibilityHandler);

    _studentBeforeunloadHandler = () => {
      if (_studentOfflineDone) return;
      _studentOfflineDone = true;
      _stopStudentHeartbeat();
      const ts = new Date(Date.now() - (ONLINE_THRESHOLD_MS + 2000));
      try { _threadRef(uid).set({ studentOnline: false, studentLastSeen: ts }, { merge: true }); } catch (_) {}
      try { Db().collection('students').doc(uid).set({ isOnline: false, lastSeen: ts }, { merge: true }); } catch (_) {}
    };
    window.addEventListener('beforeunload', _studentBeforeunloadHandler);
  }

  async function _setTeacherOnlineGlobal() {
    _teacherOfflineDone = false;
    _teacherIsOnline    = true;
    try {
      await _broadcastTeacherPresence(true);
    } catch (e) {
      console.warn('[dm] Could not set teacherOnline=true globally:', e);
      return;
    }
    _startTeacherHeartbeat();
    _startPresenceRefreshTimer();

    const goOffline = async () => {
      if (_teacherOfflineDone) return;
      _teacherOfflineDone = true;
      _teacherIsOnline    = false;
      _stopTeacherHeartbeat();
      try { await _broadcastTeacherPresence(false); } catch (e) {
        console.warn('[dm] teacherOffline broadcast failed:', e);
      }
    };
    _teacherOfflineCleanup = goOffline;

    _teacherVisibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        _stopTeacherHeartbeat();
      } else {
        if (firebase.auth().currentUser && !_teacherOfflineDone) {
          const ts = firebase.firestore.FieldValue.serverTimestamp();
          Db().collection('teacherPresence').doc('global')
            .set({ online: true, lastSeen: ts }, { merge: true })
            .catch(() => {});
          _startTeacherHeartbeat();
          // Delivery sweep: upgrade sent → delivered for messages the teacher
          // receives across all threads now that they're back.
          (async () => {
            try {
              const allThreads = await Db().collection('directMessages').get();
              const promises = [];
              allThreads.forEach(doc => {
                promises.push(_markDelivered(doc.id, 'teacher').catch(() => {}));
              });
              await Promise.all(promises);
            } catch (e) { console.warn('[dm] Teacher tab-restore delivery sweep failed:', e); }
          })();
        }
      }
    };
    document.addEventListener('visibilitychange', _teacherVisibilityHandler);

    _teacherBeforeunloadHandler = () => {
      if (_teacherOfflineDone) return;
      _teacherOfflineDone = true;
      _teacherIsOnline    = false;
      _stopTeacherHeartbeat();
      const db = Db();
      const ts = new Date(Date.now() - (ONLINE_THRESHOLD_MS + 2000));
      try { db.collection('teacherPresence').doc('global').set({ online: false, lastSeen: ts }, { merge: true }); } catch (_) {}
      try {
        db.collection('directMessages').get().then(snap => {
          if (snap.empty) return;
          const batch = db.batch();
          snap.forEach(doc => batch.set(doc.ref, { teacherOnline: false, teacherLastSeen: ts }, { merge: true }));
          batch.commit();
        }).catch(() => {});
      } catch (_) {}
    };
    window.addEventListener('beforeunload', _teacherBeforeunloadHandler);
  }

  async function _broadcastTeacherPresence(isOnline) {
    const db = Db();
    const ts = firebase.auth().currentUser
      ? firebase.firestore.FieldValue.serverTimestamp()
      : new Date();
    const presenceTs = isOnline ? ts : new Date(Date.now() - (ONLINE_THRESHOLD_MS + 2000));

    await db.collection('teacherPresence').doc('global').set(
      { online: isOnline, lastSeen: presenceTs }, { merge: true });

    const snap = await db.collection('directMessages').get();
    if (snap.empty) return;
    const refs = [];
    snap.forEach(doc => refs.push(doc.ref));
    for (let i = 0; i < refs.length; i += 400) {
      const batch = db.batch();
      refs.slice(i, i + 400).forEach(ref =>
        batch.set(ref, { teacherOnline: isOnline, teacherLastSeen: presenceTs }, { merge: true }));
      await batch.commit();
    }
  }

  /* ── Presence watchers ─────────────────────────────────────── */
  function _watchPresence(studentUid, watchRole, elementId, listenerKey) {
    AppState.cancelListener(listenerKey);

    if (watchRole === 'teacher') {
      const unsub = Db().collection('teacherPresence').doc('global').onSnapshot(snap => {
        const el = document.getElementById(elementId);
        if (!el) { AppState.cancelListener(listenerKey); return; }
        const data = (snap.exists && snap.data()) || {};
        el.innerHTML = _presenceHTML(data.lastSeen || null);
      }, err => console.warn('[dm] Teacher presence watch error:', err));
      AppState.registerListener(listenerKey, unsub);
      return;
    }

    // Student presence: watch thread doc (has studentLastSeen from heartbeat)
    const unsub = _threadRef(studentUid).onSnapshot(snap => {
      const el = document.getElementById(elementId);
      if (!el) { AppState.cancelListener(listenerKey); return; }
      if (snap.exists) {
        const data = snap.data() || {};
        el.innerHTML = _presenceHTML(data.studentLastSeen || null);
      } else {
        // Thread doc doesn't exist yet — fall back to the students profile doc
        Db().collection('students').doc(studentUid).get().then(profileSnap => {
          const el2 = document.getElementById(elementId);
          if (!el2) return;
          const data = (profileSnap.exists && profileSnap.data()) || {};
          el2.innerHTML = _presenceHTML(data.lastSeen || null);
        }).catch(() => {});
      }
    }, err => console.warn('[dm] Student presence watch error:', err));
    AppState.registerListener(listenerKey, unsub);
  }

  /* ══════════════════════════════════════════════════════════════
     MESSAGE STATUS — delivered / read
     ─────────────────────────────────────────────────────────────
     Rules:
       sent      → the sender's device wrote it to Firestore
       delivered → the recipient's app received it (tab is open)
       read      → the recipient has the specific thread open

     _markDelivered(uid, recipientRole)
       Upgrades sent → delivered for all messages FROM the other party
       in this thread.  Called when the recipient's tab becomes active
       or opens the app.

     _markRead(uid, recipientRole)
       Upgrades sent+delivered → read.  Called ONLY when the recipient
       actually opens the specific thread UI on screen.

     _readMarkMap — tracks which threads we've already called _markRead
       for in the current session to avoid redundant batch writes.
  ══════════════════════════════════════════════════════════════ */

  const _readMarkMap = new Set(); // keys: "{uid}:{role}"

  async function _markDelivered(studentUid, recipientRole) {
    const senderRole = recipientRole === 'student' ? 'teacher' : 'student';
    try {
      const snap = await _threadRef(studentUid)
        .collection('messages')
        .where('role', '==', senderRole)
        .where('status', '==', 'sent')
        .get();
      if (snap.empty) return;
      const refs = [];
      snap.forEach(doc => refs.push(doc.ref));
      for (let i = 0; i < refs.length; i += 400) {
        const b = Db().batch();
        refs.slice(i, i + 400).forEach(ref => b.update(ref, { status: 'delivered' }));
        await b.commit();
      }
    } catch (e) { console.warn('[dm] _markDelivered error:', e); }
  }

  async function _markRead(studentUid, recipientRole) {
    const key        = `${studentUid}:${recipientRole}`;
    const senderRole = recipientRole === 'student' ? 'teacher' : 'student';
    const msgCol     = _threadRef(studentUid).collection('messages');

    try {
      const [sentSnap, deliveredSnap] = await Promise.all([
        msgCol.where('role', '==', senderRole).where('status', '==', 'sent').get(),
        msgCol.where('role', '==', senderRole).where('status', '==', 'delivered').get(),
      ]);

      const refs = [];
      sentSnap.forEach(doc      => refs.push(doc.ref));
      deliveredSnap.forEach(doc => refs.push(doc.ref));

      if (!refs.length) {
        _readMarkMap.add(key);
        return;
      }

      for (let i = 0; i < refs.length; i += 400) {
        const b = Db().batch();
        refs.slice(i, i + 400).forEach(ref => b.update(ref, { status: 'read' }));
        await b.commit();
      }
      _readMarkMap.add(key);
    } catch (e) { console.warn('[dm] _markRead error:', e); }
  }

  /**
   * Called inside each messages onSnapshot for the ACTIVE thread viewer.
   * Upgrades any newly arrived "sent" messages to "delivered" without
   * doing a full read — only processes docs from the current snapshot.
   */
  async function _markDeliveredFromSnapshot(snap, studentUid, recipientRole) {
    const senderRole = recipientRole === 'student' ? 'teacher' : 'student';
    const refs       = [];
    snap.forEach(doc => {
      if (doc.data().role === senderRole && doc.data().status === 'sent') {
        refs.push(doc.ref);
      }
    });
    if (!refs.length) return;
    try {
      for (let i = 0; i < refs.length; i += 400) {
        const b = Db().batch();
        refs.slice(i, i + 400).forEach(ref => b.update(ref, { status: 'delivered' }));
        await b.commit();
      }
    } catch (e) { console.warn('[dm] _markDeliveredFromSnapshot error:', e); }
  }

  /* ── Edit history helpers ──────────────────────────────────── */
  function _msgHistoryRef(studentUid, messageId) {
    return _threadRef(studentUid).collection('messages').doc(messageId).collection('editHistory');
  }

  async function _saveEdit(studentUid, messageId, oldText, newText, isTeacher) {
  const db         = Db();
  const historyCol = _msgHistoryRef(studentUid, messageId);
  const msgRef     = _threadRef(studentUid).collection('messages').doc(messageId);
  const ts         = firebase.firestore.FieldValue.serverTimestamp();

  if (!isTeacher) {
    const countSnap = await historyCol.get();
    if (countSnap.size >= 2) throw new Error('EDIT_LIMIT_REACHED');
  }

  // Check if this message is the last one in the thread
  const lastMsgSnap = await _threadRef(studentUid)
    .collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();

  const isLastMessage = !lastMsgSnap.empty && lastMsgSnap.docs[0].id === messageId;

  const batch = db.batch();
  batch.set(historyCol.doc(), { text: oldText, editedAt: ts });
  batch.update(msgRef, { text: newText, editedAt: ts });

  // Keep the thread preview in sync if this was the last message
  if (isLastMessage) {
    const preview = newText.length > 80 ? newText.substring(0, 80) + '…' : newText;
    batch.set(_threadRef(studentUid), { lastMessage: preview }, { merge: true });
  }

  await batch.commit();
}

  async function _showEditHistory(studentUid, messageId, currentText) {
    let entries = [];
    try {
      const snap = await _msgHistoryRef(studentUid, messageId)
        .orderBy('editedAt', 'asc').get();
      snap.forEach(doc => entries.push({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.error('[dm] _showEditHistory error:', e);
      UI.toast('Could not load edit history.', 'error');
      return;
    }

    const existing = document.getElementById('dmHistoryOverlay');
    if (existing) existing.remove();

    const fmt = ts => {
      if (!ts) return '—';
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    };

    const historyRows = entries.length === 0
      ? `<p style="font-size:.8125rem;color:var(--text-4,#9ca3af);text-align:center;padding:1.5rem 0;">
           No prior edits recorded for this message.
         </p>`
      : entries.map((e, i) => `
          <div class="dm-history-entry">
            <p>${_esc(e.text)}</p>
            <time>Version ${i + 1} &mdash; ${_esc(fmt(e.editedAt))}</time>
          </div>`).join('');

    const overlay = document.createElement('div');
    overlay.className = 'dm-history-overlay';
    overlay.id        = 'dmHistoryOverlay';
    overlay.innerHTML = `
      <div class="dm-history-modal">
        <div class="dm-history-header">
          <div style="display:flex;align-items:center;gap:.5rem;">
            <span style="color:var(--accent,#4f6ef7);">${_iconHistory(16)}</span>
            <span style="font-size:.9375rem;font-weight:700;color:var(--text-1,#0d0d0f);">Edit History</span>
          </div>
          <button onclick="document.getElementById('dmHistoryOverlay').remove()"
                  style="background:none;border:none;cursor:pointer;color:var(--text-3,#6b7280);
                         display:flex;align-items:center;padding:4px;border-radius:4px;">
            ${_iconClose(16)}
          </button>
        </div>
        <div class="dm-history-body">
          <div class="dm-history-entry dm-history-current">
            <p>${_esc(currentText)}</p>
            <time>Current version</time>
          </div>
          ${historyRows}
        </div>
      </div>`;

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  /* ── Typing indicator ──────────────────────────────────────── */
  let _typingDebounceTimer = null;
  let _typingCurrentUid    = null;
  let _typingCurrentRole   = null;
  let _typingActive        = false;

  async function _startTyping(threadUid, role) {
    _typingCurrentUid  = threadUid;
    _typingCurrentRole = role;

    if (_typingDebounceTimer) clearTimeout(_typingDebounceTimer);
    _typingDebounceTimer = setTimeout(() => _stopTyping(threadUid, role), 4000);

    if (_typingActive) return;
    _typingActive = true;

    const field = role === 'student' ? 'studentTyping' : 'teacherTyping';
    try {
      await _threadRef(threadUid).set({ [field]: true }, { merge: true });
    } catch (e) { console.warn('[dm] _startTyping write failed:', e); }
  }

  async function _stopTyping(threadUid, role) {
    if (_typingDebounceTimer) { clearTimeout(_typingDebounceTimer); _typingDebounceTimer = null; }
    _typingActive = false;

    const field = role === 'student' ? 'studentTyping' : 'teacherTyping';
    try {
      await _threadRef(threadUid).set({ [field]: false }, { merge: true });
    } catch (e) { console.warn('[dm] _stopTyping write failed:', e); }
  }

  function _watchTypingIndicator(threadUid, watchField, elementId) {
    const listenerKey = 'dmTypingWatch_' + threadUid + '_' + watchField;
    AppState.cancelListener(listenerKey);

    const unsub = _threadRef(threadUid).onSnapshot(snap => {
      const bar = document.getElementById(elementId);
      if (!bar) { AppState.cancelListener(listenerKey); return; }
      const isTyping = !!(snap.exists && snap.data() && snap.data()[watchField]);
      bar.style.display = isTyping ? 'flex' : 'none';
      bar.style.height  = isTyping ? '22px' : '0';
    }, err => console.warn('[dm] _watchTypingIndicator error:', err));

    AppState.registerListener(listenerKey, unsub);
  }

  function _cancelTypingListeners(threadUid) {
    if (!threadUid) return;
    AppState.cancelListener('dmTypingWatch_' + threadUid + '_studentTyping');
    AppState.cancelListener('dmTypingWatch_' + threadUid + '_teacherTyping');
    if (_typingActive && _typingCurrentUid === threadUid) {
      _stopTyping(threadUid, _typingCurrentRole).catch(() => {});
    }
  }

  /* ══════════════════════════════════════════════════════════════
     SWIPE-TO-REPLY
  ══════════════════════════════════════════════════════════════ */
  let _studentReplyTo = null;
  let _teacherReplyTo = null;

  function _buildReplyBar(barId, closeCall) {
    return `
      <div id="${barId}" class="dm-reply-bar" role="status" aria-live="polite">
        <div style="flex:1;min-width:0;overflow:hidden;">
          <span class="dm-reply-bar__name" id="${barId}-name"></span>
          <span class="dm-reply-bar__text" id="${barId}-text"></span>
        </div>
        <button class="dm-reply-bar__close" onclick="${closeCall}" title="Cancel reply" aria-label="Cancel reply">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>`;
  }

  function _showStudentReplyBar(replyTo) {
    _studentReplyTo = replyTo;
    const bar  = document.getElementById('dmStudentReplyBar');
    const name = document.getElementById('dmStudentReplyBar-name');
    const text = document.getElementById('dmStudentReplyBar-text');
    if (!bar || !name || !text) return;
    name.textContent = replyTo.senderName + ':  ';
    text.textContent = replyTo.text;
    bar.classList.add('visible');
    const input = document.getElementById('dmInput');
    if (input) input.focus();
  }

  function _clearStudentReply() {
    _studentReplyTo = null;
    const bar = document.getElementById('dmStudentReplyBar');
    if (bar) bar.classList.remove('visible');
  }

  function _showTeacherReplyBar(replyTo) {
    _teacherReplyTo = replyTo;
    const bar  = document.getElementById('dmTeacherReplyBar');
    const name = document.getElementById('dmTeacherReplyBar-name');
    const text = document.getElementById('dmTeacherReplyBar-text');
    if (!bar || !name || !text) return;
    name.textContent = replyTo.senderName + ':  ';
    text.textContent = replyTo.text;
    bar.classList.add('visible');
    const input = document.getElementById('dmTeacherInput');
    if (input) input.focus();
  }

  function _clearTeacherReply() {
    _teacherReplyTo = null;
    const bar = document.getElementById('dmTeacherReplyBar');
    if (bar) bar.classList.remove('visible');
  }

  function _scrollToMsg(msgId) {
    const el = document.getElementById('dmWrap-' + msgId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const inner = el.querySelector('.dm-bubble-inner');
    if (!inner) return;
    const prev = inner.style.outline;
    inner.style.transition = 'outline .1s';
    inner.style.outline = '2px solid var(--accent,#4f6ef7)';
    setTimeout(() => { inner.style.outline = prev || 'none'; }, 900);
  }

  function _attachSwipeListeners(containerId, role) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const SWIPE_THRESHOLD  = 60;
    const SWIPE_MAX_REVEAL = 72;

    let touchStartX    = 0;
    let touchStartY    = 0;
    let activeSwiping  = null;
    let swipeTriggered = false;

    function _getWrap(el)       { return el.closest('.dm-swipe-wrap'); }
    function _getReplyData(wrap) {
      return { id: wrap.dataset.replyId || '', text: wrap.dataset.replyText || '', senderName: wrap.dataset.replySender || '' };
    }
    function _triggerReply(wrap) {
      const data = _getReplyData(wrap);
      if (!data.id) return;
      if (role === 'student') _showStudentReplyBar(data);
      else _showTeacherReplyBar(data);
    }
    function _resetWrap(wrap) {
      const inner = wrap.querySelector('.dm-swipe-inner');
      const hint  = wrap.querySelector('.dm-swipe-hint');
      if (inner) inner.style.transform = '';
      if (hint)  hint.style.opacity = '0';
    }

    container.addEventListener('touchstart', function (e) {
      const wrap = _getWrap(e.target);
      if (!wrap || !wrap.dataset.replyId) return;
      touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
      activeSwiping = wrap; swipeTriggered = false;
    }, { passive: true });

    container.addEventListener('touchmove', function (e) {
      if (!activeSwiping) return;
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      if (Math.abs(dy) > Math.abs(dx) + 8) { activeSwiping = null; return; }
      if (dx <= 0) return;
      e.preventDefault();
      const travel = Math.min(dx, SWIPE_MAX_REVEAL);
      const inner  = activeSwiping.querySelector('.dm-swipe-inner');
      const hint   = activeSwiping.querySelector('.dm-swipe-hint');
      if (inner) { inner.style.transition = 'none'; inner.style.transform = `translateX(${travel}px)`; }
      if (hint)  hint.style.opacity = String(Math.min(travel / SWIPE_THRESHOLD, 1));
      if (dx >= SWIPE_THRESHOLD && !swipeTriggered) {
        swipeTriggered = true;
        if (navigator.vibrate) navigator.vibrate(30);
        _triggerReply(activeSwiping);
      }
    }, { passive: false });

    container.addEventListener('touchend',   function () { if (activeSwiping) { _resetWrap(activeSwiping); activeSwiping = null; swipeTriggered = false; } });
    container.addEventListener('touchcancel',function () { if (activeSwiping) { _resetWrap(activeSwiping); activeSwiping = null; swipeTriggered = false; } });

    container.addEventListener('mouseover', function (e) {
      const wrap = _getWrap(e.target);
      if (!wrap || !wrap.dataset.replyId) return;
      const hint = wrap.querySelector('.dm-swipe-hint');
      if (hint) { hint.style.opacity = '1'; hint.style.pointerEvents = 'auto'; }
    });
    container.addEventListener('mouseout', function (e) {
      const wrap = _getWrap(e.target);
      if (!wrap) return;
      if (wrap.contains(e.relatedTarget)) return;
      const hint = wrap.querySelector('.dm-swipe-hint');
      if (hint) { hint.style.opacity = '0'; hint.style.pointerEvents = 'none'; }
    });
    container.addEventListener('click', function (e) {
      const hint = e.target.closest('.dm-swipe-hint');
      if (!hint) return;
      const wrap = hint.closest('.dm-swipe-wrap');
      if (wrap && wrap.dataset.replyId) _triggerReply(wrap);
    });
  }

  /* ── Inline edit UI ────────────────────────────────────────── */
  function _activateInlineEdit(studentUid, messageId, currentText, isDarkBubble, wrapperId, isTeacher) {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;
  const textEl   = wrapper.querySelector('.dm-bubble-text');
  const footerEl = wrapper.querySelector('.dm-bubble-footer');
  const editedEl = wrapper.querySelector('.dm-edited-label-wrap');
  if (!textEl) return;
  const inner = wrapper.querySelector('.dm-bubble-inner');
  if (!inner) return;
  if (inner.querySelector(`[id^="dmEditUI-"]`)) return;

  const saveClass    = isDarkBubble ? 'dm-edit-btn dm-edit-btn--save'   : 'dm-edit-btn dm-edit-btn--save-light';
  const cancelClass  = isDarkBubble ? 'dm-edit-btn dm-edit-btn--cancel' : 'dm-edit-btn dm-edit-btn--cancel-light';
  const taBackground = isDarkBubble ? 'rgba(255,255,255,0.15)' : 'var(--bg-base,#fff)';
  const taColor      = isDarkBubble ? '#fff'                   : 'var(--text-1,#0d0d0f)';
  const taBorder     = isDarkBubble ? '1px solid rgba(255,255,255,0.3)' : '1px solid var(--accent,#4f6ef7)';
  const taBoxShadow  = isDarkBubble ? '0 0 0 3px rgba(255,255,255,0.1)' : '0 0 0 3px var(--accent-subtle,rgba(79,110,247,.12))';

  const editUI = document.createElement('div');
  editUI.id    = `dmEditUI-${messageId}`;

  const cancelBtn       = document.createElement('button');
  cancelBtn.className   = cancelClass;
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick     = () => {
    editUI.remove();
    if (textEl)   textEl.style.display   = '';
    if (footerEl) footerEl.style.display = '';
    if (editedEl) editedEl.style.display = '';
  };

  if (textEl)   textEl.style.display   = 'none';
  if (footerEl) footerEl.style.display = 'none';
  if (editedEl) editedEl.style.display = 'none';

  const placeholder         = document.createElement('p');
  placeholder.style.cssText = 'font-size:.75rem;opacity:.5;padding:.25rem 0;margin:0;';
  placeholder.textContent   = 'Loading…';
  editUI.appendChild(placeholder);
  inner.appendChild(editUI);

  const _buildEditor = () => {
    editUI.innerHTML = '';

    const ta            = document.createElement('textarea');
    ta.className        = 'dm-edit-textarea';
    ta.value            = currentText;
    ta.rows             = 1;
    ta.style.background = taBackground;
    ta.style.color      = taColor;
    ta.style.border     = taBorder;
    ta.style.boxShadow  = taBoxShadow;

    const actions     = document.createElement('div');
    actions.className = 'dm-edit-actions';

    const saveBtn       = document.createElement('button');
    saveBtn.className   = saveClass;
    saveBtn.textContent = 'Save';
    saveBtn.onclick     = async () => {
      const newText = ta.value.trim();
      if (!newText) { UI.toast('Message cannot be empty.', 'warning'); return; }
      if (newText === currentText) { cancelBtn.onclick(); return; }
      saveBtn.disabled    = true;
      saveBtn.textContent = 'Saving…';
      try {
        await _saveEdit(studentUid, messageId, currentText, newText, isTeacher);

        // Update the bubble text in the chat view
        if (textEl) textEl.textContent = newText;

        // Optimistically update the thread list preview in the DOM (teacher side)
        // so it reflects the edit instantly without waiting for the snapshot round-trip
        const threadPreviewEl = document.querySelector(
          `.dm-thread-item[data-uid="${CSS.escape(studentUid)}"] .dm-thread-preview`
        );
        if (threadPreviewEl) {
          const oldPreview = currentText.length > 80 ? currentText.substring(0, 80) + '…' : currentText;
          const currentPreview = threadPreviewEl.textContent.trim();
          if (currentPreview === oldPreview || currentPreview === currentText) {
            const newPreview = newText.length > 80 ? newText.substring(0, 80) + '…' : newText;
            threadPreviewEl.textContent = newPreview;
          }
        }

        cancelBtn.onclick();
      } catch (err) {
        if (err.message === 'EDIT_LIMIT_REACHED') {
          _buildLimitNotice();
        } else {
          console.error('[dm] inline edit save error:', err);
          UI.toast('Could not save edit. Please try again.', 'error');
          saveBtn.disabled    = false;
          saveBtn.textContent = 'Save';
        }
      }
    };

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    editUI.appendChild(ta);
    editUI.appendChild(actions);

    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveBtn.onclick(); }
      if (e.key === 'Escape') cancelBtn.onclick();
    });
  };

  const _buildLimitNotice = () => {
    editUI.innerHTML = '';
    const msg         = document.createElement('p');
    msg.style.cssText = `font-size:.75rem;line-height:1.5;margin:0 0 .375rem;opacity:.85;
                          color:${isDarkBubble ? 'rgba(255,255,255,.9)' : 'var(--danger,#e03b3b)'};`;
    msg.textContent   = 'Messages can only be edited twice.';
    const actions     = document.createElement('div');
    actions.className = 'dm-edit-actions';
    actions.appendChild(cancelBtn);
    editUI.appendChild(msg);
    editUI.appendChild(actions);
  };

  if (isTeacher) {
    _buildEditor();
  } else {
    _msgHistoryRef(studentUid, messageId).get()
      .then(snap => { if (snap.size >= 2) _buildLimitNotice(); else _buildEditor(); })
      .catch(() => _buildEditor());
  }
}

  let _openMenuId = null;

  function _closeOpenMenu() {
  if (_openMenuId) {
    const m = document.getElementById(_openMenuId);
    if (m) m.remove();
    document.querySelectorAll('.dm-bubble-inner.menu-open').forEach(el => {
      el.classList.remove('menu-open');
    });
    _openMenuId = null;
  }
}

  function _toggleActionMenu(wrapperId, studentUid, messageId, currentText, canEdit, canHistory, isDarkBubble, alignRight, isTeacher) {
  const menuId = `dmMenu-${messageId}`;
  if (_openMenuId === menuId) { _closeOpenMenu(); return; }
  _closeOpenMenu();

  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;
  const bubbleInner = wrapper.querySelector('.dm-bubble-inner');
  if (!bubbleInner) return;

  // Always re-read text from the DOM — the inline onclick passes textContent
  // which can sometimes be stale or undefined if the element was mutated.
  const textEl      = bubbleInner.querySelector('.dm-bubble-text');
  const resolvedText = (currentText && String(currentText).trim())
    ? String(currentText).trim()
    : (textEl ? textEl.textContent.trim() : '');

  const menu     = document.createElement('div');
  menu.className = 'dm-action-menu';
  menu.id        = menuId;

  if (canEdit) {
    const editItem     = document.createElement('button');
    editItem.className = 'dm-action-menu-item';
    editItem.innerHTML = `${_iconPencil(13)} Edit message`;
    editItem.onclick   = () => {
      _closeOpenMenu();
      _activateInlineEdit(studentUid, messageId, resolvedText, isDarkBubble, wrapperId, isTeacher);
    };
    menu.appendChild(editItem);
  }

  if (canHistory) {
    const histItem     = document.createElement('button');
    histItem.className = 'dm-action-menu-item';
    histItem.innerHTML = `${_iconHistory(13)} Edit history`;
    histItem.onclick   = () => {
      _closeOpenMenu();
      _showEditHistory(studentUid, messageId, resolvedText);
    };
    menu.appendChild(histItem);
  }

  if (!menu.children.length) return;

  // Attach to body with fixed positioning so it escapes any overflow:hidden ancestor
  menu.style.position = 'fixed';
  menu.style.zIndex   = '9999';
  menu.style.top      = '-9999px'; // hide off-screen until measured
  menu.style.left     = '-9999px';
  document.body.appendChild(menu);
  _openMenuId = menuId;

  // Mark bubble so the pencil icon stays visible while menu is open
  bubbleInner.classList.add('menu-open');

  // Measure and position after paint
  requestAnimationFrame(() => {
    const rect     = bubbleInner.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    // Prefer opening above the bubble; fall back to below if not enough room
    const spaceAbove = rect.top;
    if (spaceAbove >= menuRect.height + 8) {
      menu.style.top = `${rect.top - menuRect.height - 6}px`;
    } else {
      menu.style.top = `${rect.bottom + 6}px`;
    }

    // Align to the right or left edge of the bubble, clamped inside the viewport
    if (alignRight) {
      menu.style.left = `${Math.max(4, rect.right - menuRect.width)}px`;
    } else {
      menu.style.left = `${Math.min(rect.left, window.innerWidth - menuRect.width - 4)}px`;
    }
  });

  // Close when clicking anywhere outside the menu
  setTimeout(() => {
    document.addEventListener('click', function _handler(e) {
      if (!menu.contains(e.target)) {
        _closeOpenMenu();
        document.removeEventListener('click', _handler);
      }
    });
  }, 0);
}

  /* ── Bubble builders ───────────────────────────────────────── */
  function _buildStudentBubble(msg, myUid, showLabel) {
    const isMe    = msg.senderId === myUid;
    const msgId   = msg.id || '';
    const wrapId  = `dmWrap-${_escAttr(msgId)}`;
    const canEdit = isMe && !!msgId;

    const time = msg.timestamp
      ? new Date(msg.timestamp.toDate ? msg.timestamp.toDate() : msg.timestamp)
          .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    const editedLabel = msg.editedAt
      ? `<span style="font-size:.5625rem;opacity:.6;font-style:italic;margin-right:3px;line-height:1;white-space:nowrap;">edited</span>`
      : '';

    const safeUid   = _escAttr(myUid);
    const safeMsgId = _escAttr(msgId);

    let replyCard = '';
    if (msg.replyTo && msg.replyTo.id) {
      const rName = _esc(msg.replyTo.senderName || 'Unknown');
      const rText = _esc((msg.replyTo.text || '').substring(0, 80));
      const rId   = _escAttr(msg.replyTo.id);
      replyCard = `
        <div class="dm-reply-card"
             onclick="event.stopPropagation();DM._scrollToMsg('${rId}')"
             title="Jump to original message">
          <span class="dm-reply-card__name">${rName}</span>
          <span class="dm-reply-card__text">${rText}</span>
        </div>`;
    }

    const editBtn = canEdit
      ? `<button title="Edit"
                 onclick="event.stopPropagation();DM._toggleActionMenu('${wrapId}','${safeUid}','${safeMsgId}',document.getElementById('${wrapId}').querySelector('.dm-bubble-text').textContent,true,false,${isMe},${isMe},false)"
                 style="background:none;border:none;cursor:pointer;padding:0 0 0 4px;
                        display:inline-flex;align-items:center;opacity:0;transition:opacity .15s;
                        color:${isMe ? 'rgba(255,255,255,.7)' : 'var(--text-4,#9ca3af)'};
                        flex-shrink:0;line-height:1;vertical-align:middle;"
                 class="dm-edit-trigger-btn">
           ${_iconPencil(10)}
         </button>`
      : '';

    const replyBtnData = msgId
      ? `data-reply-id="${safeMsgId}"
         data-reply-text="${_escAttr((msg.text || '').substring(0, 80))}"
         data-reply-sender="${_escAttr(isMe ? 'You' : (msg.senderName || 'Master Timothy'))}"`
      : '';

    if (isMe) {
      return `
        <div class="dm-swipe-wrap dm-msg-out" id="${wrapId}"
             style="margin-bottom:${showLabel ? '.75rem' : '.25rem'}"
             ${replyBtnData}>
          <div class="dm-swipe-inner">
            <div class="dm-swipe-hint" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 17L4 12m0 0l5-5M4 12h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            ${showLabel ? `<span style="font-size:.6875rem;font-weight:600;color:var(--text-3,#6b7280);
                         margin-bottom:2px;padding-right:2px;display:block;text-align:right;">You</span>` : ''}
            <div class="dm-bubble-wrap">
              <div class="dm-bubble-inner"
                   style="background:var(--accent,#4f6ef7);color:#fff;
                          border-radius:14px 14px 3px 14px;padding:.5rem .75rem .375rem;">
                ${replyCard}
                <p class="dm-bubble-text">${_esc(msg.text)}</p>
                <div class="dm-bubble-footer dm-bubble-footer--end">
                  ${editedLabel}${editBtn}
                  <span class="dm-bubble-time">${time}</span>
                  ${_tickIcon(msg.status || 'sent')}
                </div>
              </div>
            </div>
          </div>
        </div>`;
    } else {
      return `
        <div class="dm-swipe-wrap dm-msg-in" id="${wrapId}"
             style="margin-bottom:${showLabel ? '.75rem' : '.25rem'}"
             ${replyBtnData}>
          <div class="dm-swipe-inner">
            <div class="dm-swipe-hint" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M15 7l5 5m0 0l-5 5m5-5H4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            ${showLabel ? `<span style="font-size:.6875rem;font-weight:600;color:var(--accent-text,#2d49d6);
                         margin-bottom:2px;padding-left:2px;display:block;">
              ${_esc(msg.senderName || 'Master Timothy')}
            </span>` : ''}
            <div class="dm-bubble-wrap">
              <div class="dm-bubble-inner"
                   style="background:var(--bg-base,#fff);color:var(--text-1,#0d0d0f);
                          border:1px solid var(--border,#e5e7eb);
                          border-radius:14px 14px 14px 3px;padding:.5rem .75rem .375rem;">
                ${replyCard}
                <p class="dm-bubble-text">${_esc(msg.text)}</p>
                <div class="dm-bubble-footer dm-bubble-footer--start">
                  <span class="dm-bubble-time dm-bubble-time--dim">${time}</span>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }
  }

  function _buildTeacherBubble(msg, showLabel) {
    const isTeacher  = msg.role === 'teacher';
    const msgId      = msg.id || '';
    const wrapId     = `dmWrap-${_escAttr(msgId)}`;
    const studentUid = _activeStudentUid || '';
    const canEdit    = isTeacher && !!msgId;
    const canHistory = !!msgId;

    const time = msg.timestamp
      ? new Date(msg.timestamp.toDate ? msg.timestamp.toDate() : msg.timestamp)
          .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    const editedLabel = msg.editedAt
      ? `<span class="dm-edited-label-wrap"><span class="dm-edited-label" style="font-size:.5625rem;opacity:.6;font-style:italic;margin-right:3px;line-height:1;white-space:nowrap;">edited</span></span>`
      : '';

    const safeStudentUid = _escAttr(studentUid);
    const safeMsgId      = _escAttr(msgId);

    let replyCard = '';
    if (msg.replyTo && msg.replyTo.id) {
      const rName = _esc(msg.replyTo.senderName || 'Unknown');
      const rText = _esc((msg.replyTo.text || '').substring(0, 80));
      const rId   = _escAttr(msg.replyTo.id);
      replyCard = `
        <div class="dm-reply-card"
             onclick="event.stopPropagation();DM._scrollToMsg('${rId}')"
             title="Jump to original message">
          <span class="dm-reply-card__name">${rName}</span>
          <span class="dm-reply-card__text">${rText}</span>
        </div>`;
    }

    const editBtn = (canEdit || canHistory)
      ? `<button title="Options"
                 onclick="event.stopPropagation();DM._toggleActionMenu('${wrapId}','${safeStudentUid}','${safeMsgId}',document.getElementById('${wrapId}').querySelector('.dm-bubble-text').textContent,${canEdit},${canHistory},${isTeacher},${isTeacher},true)"
                 style="background:none;border:none;cursor:pointer;padding:0 0 0 4px;
                        display:inline-flex;align-items:center;opacity:0;transition:opacity .15s;
                        color:${isTeacher ? 'rgba(255,255,255,.7)' : 'var(--text-4,#9ca3af)'};
                        flex-shrink:0;line-height:1;vertical-align:middle;"
                 class="dm-edit-trigger-btn">
           ${_iconPencil(10)}
         </button>`
      : '';

    const replyBtnData = msgId
      ? `data-reply-id="${safeMsgId}"
         data-reply-text="${_escAttr((msg.text || '').substring(0, 80))}"
         data-reply-sender="${_escAttr(isTeacher ? 'Master Timothy' : (msg.senderName || 'Student'))}"`
      : '';

    if (isTeacher) {
      return `
        <div class="dm-swipe-wrap dm-msg-out" id="${wrapId}"
             style="margin-bottom:${showLabel ? '.75rem' : '.25rem'}"
             ${replyBtnData}>
          <div class="dm-swipe-inner">
            <div class="dm-swipe-hint" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 17L4 12m0 0l5-5M4 12h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            ${showLabel ? `<span style="font-size:.6875rem;font-weight:600;color:var(--text-3,#6b7280);
                         margin-bottom:2px;padding-right:2px;display:block;text-align:right;">You</span>` : ''}
            <div class="dm-bubble-wrap">
              <div class="dm-bubble-inner"
                   style="background:var(--accent,#4f6ef7);color:#fff;
                          border-radius:14px 14px 3px 14px;padding:.5rem .75rem .375rem;">
                ${replyCard}
                <p class="dm-bubble-text">${_esc(msg.text)}</p>
                <div class="dm-bubble-footer dm-bubble-footer--end">
                  ${editedLabel}${editBtn}
                  <span class="dm-bubble-time">${time}</span>
                  ${_tickIcon(msg.status || 'sent')}
                </div>
              </div>
            </div>
          </div>
        </div>`;
    } else {
      return `
        <div class="dm-swipe-wrap dm-msg-in" id="${wrapId}"
             style="margin-bottom:${showLabel ? '.75rem' : '.25rem'}"
             ${replyBtnData}>
          <div class="dm-swipe-inner">
            <div class="dm-swipe-hint" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M15 7l5 5m0 0l-5 5m5-5H4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            ${showLabel ? `<span style="font-size:.6875rem;font-weight:600;color:var(--accent-text,#2d49d6);
                         margin-bottom:2px;padding-left:2px;display:block;">
              ${_esc(msg.senderName || 'Student')}
            </span>` : ''}
            <div class="dm-bubble-wrap">
              <div class="dm-bubble-inner"
                   style="background:var(--bg-base,#fff);color:var(--text-1,#0d0d0f);
                          border:1px solid var(--border,#e5e7eb);
                          border-radius:14px 14px 14px 3px;padding:.5rem .75rem .375rem;">
                ${replyCard}
                <p class="dm-bubble-text">${_esc(msg.text)}</p>
                <div class="dm-bubble-footer dm-bubble-footer--start">
                  ${editedLabel}
                  <span class="dm-bubble-time dm-bubble-time--dim">${time}</span>
                  ${editBtn}
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }
  }

  /* ══════════════════════════════════════════════════════════════
     STUDENT INBOX
  ══════════════════════════════════════════════════════════════ */
  async function openStudentInbox() {
    _injectStyles();

    const uid         = AppState.userId;
    const studentData = AppState.studentData || {};
    const threadRef   = _threadRef(uid);

    // Clear the unread count since the student is now looking at the thread
    try {
      await threadRef.set({ studentUnread: 0 }, { merge: true });
      AppState.dmStudentUnread = 0;
      _updateStudentBadge(0);
    } catch (e) { console.warn('[dm] Could not clear studentUnread:', e); }

    // Seed thread doc if it doesn't exist yet
    try {
      const threadSnap = await threadRef.get();
      if (!threadSnap.exists) {
        const sentinelSnap = await Db().collection('teacherPresence').doc('global').get();
        const tData = (sentinelSnap.exists && sentinelSnap.data()) || {};
        const teacherOnline   = !!(tData.online) && _isRecentlyActive(tData.lastSeen);
        const teacherLastSeen = tData.lastSeen || null;
        const seedData = {
          studentName: studentData.name || '', studentClass: studentData.class || '',
          studentUnread: 0, teacherUnread: 0, teacherOnline,
        };
        if (teacherLastSeen) seedData.teacherLastSeen = teacherLastSeen;
        await threadRef.set(seedData, { merge: true });
      }
    } catch (e) { console.warn('[dm] Could not seed thread doc:', e); }

    UI.mount(`
      <div class="max-w-2xl mx-auto glass animate-fadeIn"
           style="padding:1.25rem 1.5rem;margin-top:1.25rem;margin-bottom:1.25rem;
                  box-sizing:border-box;width:100%;max-width:100%;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;min-width:0;">
          <div style="min-width:0;flex:1;margin-right:.75rem;">
            <h2 class="font-bold" style="font-size:1.125rem;line-height:1.3;">Message Master Timothy</h2>
            <div id="dmTeacherPresence" style="margin-top:2px;">${_presenceHTML(null)}</div>
          </div>
          <button onclick="DM.backFromStudentInbox()" class="btn bg-gray-500 hover:bg-gray-600"
                  style="font-size:.8125rem;flex-shrink:0;">&#8592; Back</button>
        </div>

        <div style="margin-bottom:.5rem;padding:.375rem .625rem;
         background:var(--surface-subtle,#f3f4f6);border:1px solid var(--border,#e5e7eb);
         border-radius:8px;font-size:.7rem;color:var(--text-tertiary,#6b7280);
         display:flex;align-items:center;gap:.375rem;line-height:1.3;box-sizing:border-box;">
          <span style="color:var(--text-tertiary,#6b7280);flex-shrink:0;">${_iconLock(12)}</span>
          <span><strong style="color:var(--text-secondary,#374151);font-weight:600;">Private</strong>
           — these messages can only be seen by you and Master Timothy.</span>
        </div>

        <div style="margin-bottom:.625rem;padding:.5rem .625rem;
           background:var(--brand-bg,#edf2ff);border:1px solid var(--brand-border,#bac8ff);
           border-radius:8px;font-size:.75rem;color:var(--brand-text,#3730a3);line-height:1.4;
           display:flex;align-items:flex-start;gap:.375rem;box-sizing:border-box;">
          <span style="margin-top:1px;flex-shrink:0;">${_iconMail(12)}</span>
          <span>Send a question or concern directly to Master Timothy.
                He will reply here as soon as possible.</span>
        </div>

        <div id="dmMessages"
             class="dm-messages-area"
             style="min-height:260px;max-height:420px;
                    border:1px solid var(--border,#e5e7eb);border-radius:10px;
                    padding:.75rem 1rem;margin-bottom:0;
                    background:var(--surface-subtle,#f9fafb);">
          <p style="text-align:center;font-size:.8125rem;color:var(--text-disabled,#9ca3af);padding:2rem 0;">
            Loading messages…
          </p>
        </div>

        <div id="dmStudentTypingBar"
             style="height:0;padding:0 .25rem;display:none;align-items:center;">
          <span class="dm-typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>
          <span style="font-size:.6875rem;color:var(--text-3,#6b7280);margin-left:.375rem;font-style:italic;">
            Master Timothy is typing…
          </span>
        </div>

        ${_buildReplyBar('dmStudentReplyBar', 'DM._clearStudentReply()')}
        <div style="display:flex;gap:.5rem;align-items:flex-end;box-sizing:border-box;width:100%;overflow:hidden;margin-top:.5rem;">
          <textarea id="dmInput" placeholder="Type your message…" rows="1"
                    style="flex:1;min-width:0;resize:none;overflow-y:hidden;
                           min-height:36px;max-height:120px;box-sizing:border-box;"></textarea>
          <button id="dmSendBtn" onclick="DM.sendStudentMessage()"
                  class="btn bg-green-600 hover:bg-green-700"
                  style="flex-shrink:0;align-self:flex-end;">Send</button>
        </div>
      </div>`);

    const input = document.getElementById('dmInput');
    if (input) {
      input.focus();
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendStudentMessage(); }
      });
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        input.style.overflowY = input.scrollHeight > 120 ? 'auto' : 'hidden';
        _startTyping(uid, 'student');
      });
      input.addEventListener('blur', () => _stopTyping(uid, 'student').catch(() => {}));
    }

    // Mark read NOW — the student is looking at the thread
    await _markRead(uid, 'student');

    _watchPresence(uid, 'teacher', 'dmTeacherPresence', 'dmTeacherPresenceWatch');
    _watchTypingIndicator(uid, 'teacherTyping', 'dmStudentTypingBar');
    _attachSwipeListeners('dmMessages', 'student');
    _subscribeStudentMessages(uid);
  }

  function _subscribeStudentMessages(uid) {
  AppState.cancelListener('dmStudentMessages');

  const unsub = _threadRef(uid)
    .collection('messages').orderBy('timestamp', 'asc')
    .onSnapshot(snap => {
      const container = document.getElementById('dmMessages');
      if (!container) { AppState.cancelListener('dmStudentMessages'); return; }

      if (snap.empty) {
        container.innerHTML = `
          <p style="text-align:center;font-size:.8125rem;
                    color:var(--text-disabled,#9ca3af);padding:2rem 0;">
            No messages yet. Say hello to Master Timothy!
          </p>`;
        return;
      }

      const msgs = [];
      snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));

      // Student has the inbox open → upgrade any newly arrived teacher messages
      // from "sent" to "delivered" (snapshot-scoped, no full collection scan).
      // NOTE: We do NOT call _markRead here. _markRead was already called once
      // in openStudentInbox() when the inbox mounted. Calling it again on every
      // snapshot tick caused a write→snapshot→write feedback loop.
      _markDeliveredFromSnapshot(snap, uid, 'student').catch(() => {});

      container.innerHTML = _renderMessagesWithDateSeps(msgs, uid, 'student');
      container.scrollTop = container.scrollHeight;
    }, err => console.error('[dm] Student messages error:', err));

  AppState.registerListener('dmStudentMessages', unsub);
}

  function _renderMessagesWithDateSeps(msgs, myUid, viewerRole) {
    let lastDayKey    = null;
    let lastSenderId  = null;
    const parts       = [];

    for (const msg of msgs) {
      const ts   = msg.timestamp;
      const date = ts ? (ts.toDate ? ts.toDate() : new Date(ts)) : null;
      const dk   = date ? _dayKey(date) : null;

      if (dk && dk !== lastDayKey) {
        parts.push(`
          <div class="dm-date-sep">
            <div class="dm-date-sep__line"></div>
            <span class="dm-date-sep__label">${_esc(_dateLabelFor(date))}</span>
            <div class="dm-date-sep__line"></div>
          </div>`);
        lastDayKey   = dk;
        lastSenderId = null;
      }

      const senderId  = msg.senderId || msg.role || null;
      const showLabel = senderId !== lastSenderId;
      lastSenderId    = senderId;

      parts.push(viewerRole === 'student'
        ? _buildStudentBubble(msg, myUid, showLabel)
        : _buildTeacherBubble(msg, showLabel));
    }
    return parts.join('');
  }

  async function sendStudentMessage() {
    const input = document.getElementById('dmInput');
    const text  = (input?.value || '').trim();
    if (!text) return;

    const uid         = AppState.userId;
    const studentData = AppState.studentData || {};
    const name        = studentData.name  || 'Student';
    const cls         = studentData.class || '';
    const btn         = document.getElementById('dmSendBtn');

    _stopTyping(uid, 'student').catch(() => {});

    if (input) { input.value = ''; input.style.height = 'auto'; input.style.height = '36px'; }
    UI.setLoading(btn, true);

    // Check teacher presence from the single global doc
    let teacherIsOnline = false;
    try {
      const sentinelSnap = await Db().collection('teacherPresence').doc('global').get();
      const tData = (sentinelSnap.exists && sentinelSnap.data()) || {};
      teacherIsOnline = !!(tData.online) && _isRecentlyActive(tData.lastSeen);
    } catch (_) {}

    const replyPayload = (_studentReplyTo && _studentReplyTo.id)
      ? { id: _studentReplyTo.id, text: _studentReplyTo.text, senderName: _studentReplyTo.senderName }
      : null;
    _clearStudentReply();

    try {
      const batch  = Db().batch();
      const msgRef = _threadRef(uid).collection('messages').doc();

      const studentMsgData = {
        text, senderId: uid, senderName: name, role: 'student',
        // sent = message left this device; delivered only once teacher opens
        status: 'sent',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (replyPayload) studentMsgData.replyTo = replyPayload;

      batch.set(msgRef, studentMsgData);
      batch.set(_threadRef(uid), {
        studentName: name, studentClass: cls,
        lastMessage: text.length > 80 ? text.substring(0, 80) + '…' : text,
        lastAt: firebase.firestore.FieldValue.serverTimestamp(),
        teacherUnread: firebase.firestore.FieldValue.increment(1),
        studentUnread: 0,
      }, { merge: true });

      await batch.commit();
    } catch (err) {
      console.error('[dm] sendStudentMessage error:', err);
      UI.toast('Could not send message. Please try again.', 'error');
      if (input) input.value = text;
    } finally {
      UI.setLoading(btn, false);
      if (input) input.focus();
    }
  }

  function backFromStudentInbox() {
    _cancelTypingListeners(AppState.userId);
    _clearStudentReply();
    AppState.cancelListener('dmStudentMessages');
    AppState.cancelListener('dmTeacherPresenceWatch');
    _closeOpenMenu();
    Exam.renderSubjectSelection();
  }

  /* ══════════════════════════════════════════════════════════════
     TEACHER INBOX
  ══════════════════════════════════════════════════════════════ */
  function openTeacherInbox() {
    _injectStyles();
    const panel = document.getElementById('teacher-dm');
    if (!panel) return;

    panel.innerHTML = `
      <div id="dmTeacherShell"
           style="border:1px solid var(--border,#e5e7eb);border-radius:12px;
                  background:var(--surface,#fff);
                  width:100%;max-width:100%;box-sizing:border-box;overflow:hidden;">

        <div id="dmViewList" style="display:flex;flex-direction:column;width:100%;box-sizing:border-box;">
          <div style="padding:.75rem 1rem;border-bottom:1px solid var(--border,#e5e7eb);
                      background:var(--surface-subtle,#f9fafb);flex-shrink:0;
                      display:flex;align-items:center;justify-content:space-between;gap:.5rem;
                      box-sizing:border-box;width:100%;">
            <h3 style="font-size:.9375rem;font-weight:700;color:var(--text-primary,#111827);
                       white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;">
              Messages
            </h3>
            <button onclick="DM._openNewConversationModal()"
                    title="New message"
                    style="width:30px;height:30px;border-radius:50%;flex-shrink:0;
                           border:1px solid var(--brand-border,#bac8ff);
                           background:var(--brand-bg,#edf2ff);cursor:pointer;
                           display:flex;align-items:center;justify-content:center;
                           color:var(--brand-text,#3730a3);transition:background .15s;">
              ${_iconPencil(14)}
            </button>
          </div>
          <div id="dmThreadList"
               class="dm-thread-list-wrap"
               style="overflow-y:auto;overflow-x:hidden;width:100%;box-sizing:border-box;max-height:65vh;">
            <p style="font-size:.8125rem;color:var(--text-disabled,#9ca3af);
                      text-align:center;padding:2rem 1rem;">Loading…</p>
          </div>
        </div>

        <div id="dmViewChat"
             style="display:none;flex-direction:column;width:100%;box-sizing:border-box;background:var(--surface,#fff);">
        </div>
      </div>`;

    _subscribeTeacherThreadList();
  }

  function _subscribeTeacherThreadList() {
  AppState.cancelListener('dmTeacherThreads');

  const unsub = Db()
    .collection('directMessages').orderBy('lastAt', 'desc')
    .onSnapshot(snap => {
      const list = document.getElementById('dmThreadList');
      if (!list) { AppState.cancelListener('dmTeacherThreads'); return; }

      if (snap.empty) {
        list.innerHTML = `<p style="font-size:.8125rem;color:var(--text-4,#9ca3af);text-align:center;padding:2rem 1rem;">No messages yet.</p>`;
        return;
      }

      let totalUnread = 0;
      const items = [];
      snap.forEach(doc => {
        totalUnread += (doc.data().teacherUnread || 0);
        items.push({ id: doc.id, ...doc.data() });
      });
      _updateTeacherBadge(totalUnread);

      list.innerHTML = items.map(item => {
        const unread   = item.teacherUnread || 0;
        const isActive = _activeStudentUid === item.id;
        const isOnline = _isRecentlyActive(item.studentLastSeen);
        const tsMs     = _tsToMs(item.studentLastSeen);
        const timeStr  = item.lastAt
          ? new Date(item.lastAt.toDate ? item.lastAt.toDate() : item.lastAt)
              .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          : '';

        // Presence text for the thread row — carries data-presence-ts so the
        // 15-second local refresh timer can re-evaluate it without extra Firestore reads.
        const presenceSpan = isOnline
          ? `<span class="dm-thread-presence online"
                  data-presence-ts="${tsMs ?? 'null'}">&#x25cf; Online</span>`
          : `<span class="dm-thread-presence"
                  data-presence-ts="${tsMs ?? 'null'}">
               ${item.studentLastSeen ? _esc(_formatLastSeen(item.studentLastSeen)) : 'Offline'}
             </span>`;

        return `
          <div class="dm-thread-item${isActive ? ' is-active' : ''}"
               data-uid="${_escAttr(item.id)}"
               data-name="${_escAttr(item.studentName || '')}"
               data-class="${_escAttr(item.studentClass || '')}"
               onclick="DM._openConversationFromEl(this)">
            <div class="dm-thread-av">
              <div class="dm-thread-av-circle${isOnline ? ' online' : ''}">
                ${_esc((item.studentName || '?').charAt(0).toUpperCase())}
              </div>
              ${isOnline ? `<span class="dm-thread-av-dot"></span>` : ''}
            </div>
            <div class="dm-thread-bd">
              <div class="dm-thread-r1">
                <span class="dm-thread-name">${_esc(item.studentName || 'Unknown')}</span>
                <span class="dm-thread-date">${_esc(timeStr)}</span>
              </div>
              ${presenceSpan}
              <div class="dm-thread-r2">
                <span class="dm-thread-preview">${_esc(item.lastMessage || 'No messages yet')}</span>
                ${unread > 0 ? `<span class="dm-thread-badge">${unread > 9 ? '9+' : unread}</span>` : ''}
              </div>
              <span class="dm-thread-class">${_esc(item.studentClass || '—')}</span>
            </div>
          </div>`;
      }).join('');

    }, err => console.error('[dm] Teacher thread list error:', err));

  AppState.registerListener('dmTeacherThreads', unsub);
}

  let _activeStudentUid  = null;
  window._dmActiveUid    = null;

  function _openConversationFromEl(el) {
    const uid  = el.dataset.uid;
    const name = el.dataset.name;
    const cls  = el.dataset.class;
    if (!uid) return;
    _openConversation(uid, name, cls);
  }

  async function _openConversation(studentUid, studentName, studentClass) {
    _activeStudentUid   = studentUid;
    window._dmActiveUid = studentUid;

    document.querySelectorAll('.dm-thread-item').forEach(el => {
      el.classList.toggle('is-active', el.dataset.uid === studentUid);
    });

    // Clear unread count for this thread
    try {
      await _threadRef(studentUid).set({ teacherUnread: 0 }, { merge: true });
    } catch (e) { console.warn('[dm] Could not clear teacherUnread:', e); }

    // Mark as read — teacher just opened this specific thread
    await _markRead(studentUid, 'teacher');

    const viewList = document.getElementById('dmViewList');
    const viewChat = document.getElementById('dmViewChat');
    if (!viewList || !viewChat) return;

    viewList.style.display = 'none';
    viewChat.style.display = 'flex';
    viewChat.style.flexDirection = 'column';
    viewChat.dataset.studentUid   = studentUid;
    viewChat.dataset.studentName  = studentName;
    viewChat.dataset.studentClass = studentClass || '';

    viewChat.innerHTML = `
      <div style="padding:.625rem 1rem;border-bottom:1px solid var(--border,#e5e7eb);
                  background:var(--surface-subtle,#f9fafb);flex-shrink:0;
                  display:flex;align-items:center;gap:.75rem;
                  box-sizing:border-box;width:100%;">

        <button onclick="DM._backToThreadList()"
                title="Back to conversations"
                style="flex-shrink:0;width:32px;height:32px;border-radius:50%;
                       border:1px solid var(--border,#e5e7eb);background:var(--surface,#fff);
                       cursor:pointer;display:flex;align-items:center;justify-content:center;
                       color:var(--text-2,#3a3a40);transition:background .15s;"
                onmouseenter="this.style.background='var(--bg-subtle,#f0f0f2)'"
                onmouseleave="this.style.background='var(--surface,#fff)'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;
                    background:var(--brand-bg,#edf2ff);border:1.5px solid var(--brand-border,#bac8ff);
                    display:flex;align-items:center;justify-content:center;
                    font-size:.8125rem;font-weight:700;color:var(--brand-text,#3730a3);">
          ${_esc((studentName || '?').charAt(0).toUpperCase())}
        </div>

        <div style="flex:1;min-width:0;">
          <p style="font-size:.875rem;font-weight:700;color:var(--text-primary,#111827);
                    line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0;">
            ${_esc(studentName)}
            <span style="font-size:.6875rem;font-weight:400;color:var(--text-tertiary,#6b7280);margin-left:.25rem;">
              ${_esc(studentClass)}
            </span>
          </p>
          <div id="dmStudentPresence" style="margin-top:1px;">${_presenceHTML(null)}</div>
        </div>
      </div>

      <div id="dmTeacherMessages"
           class="dm-messages-area"
           style="overflow-y:auto;max-height:55vh;min-height:200px;
                  padding:.875rem 1rem;background:var(--surface-subtle,#f9fafb);">
        <p style="text-align:center;font-size:.8125rem;
                  color:var(--text-disabled,#9ca3af);padding:2rem 0;">
          Loading messages…
        </p>
      </div>

      <div id="dmTeacherTypingBar"
           style="height:0;padding:0 .875rem;display:none;align-items:center;background:var(--surface,#fff);">
        <span class="dm-typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>
        <span style="font-size:.6875rem;color:var(--text-3,#6b7280);margin-left:.375rem;font-style:italic;">
          ${_esc(studentName)} is typing…
        </span>
      </div>

      ${_buildReplyBar('dmTeacherReplyBar', 'DM._clearTeacherReply()')}
      <div style="padding:.625rem .875rem;border-top:1px solid var(--border,#e5e7eb);flex-shrink:0;
                  display:flex;gap:.5rem;align-items:flex-end;background:var(--surface,#fff);
                  box-sizing:border-box;width:100%;margin-top:.5rem;">
        <textarea id="dmTeacherInput"
                  placeholder="Reply to ${_esc(studentName)}…"
                  rows="1"
                  style="flex:1;min-width:0;resize:none;overflow-y:hidden;line-height:1.5;
                         padding:.5625rem .75rem;min-height:36px;max-height:120px;
                         border-radius:var(--r-md);font-family:var(--font);
                         font-size:var(--text-base);box-sizing:border-box;"></textarea>
        <button id="dmTeacherSendBtn"
                onclick="DM._sendTeacherReplyFromPanel()"
                class="btn bg-green-600 hover:bg-green-700"
                style="flex-shrink:0;align-self:flex-end;">Send</button>
      </div>`;

    const input = document.getElementById('dmTeacherInput');
    if (input) {
      input.focus();
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _sendTeacherReplyFromPanel(); }
      });
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        input.style.overflowY = input.scrollHeight > 120 ? 'auto' : 'hidden';
        _startTyping(studentUid, 'teacher');
      });
      input.addEventListener('blur', () => _stopTyping(studentUid, 'teacher').catch(() => {}));
    }

    _watchPresence(studentUid, 'student', 'dmStudentPresence', 'dmStudentPresenceWatch');
    _watchTypingIndicator(studentUid, 'studentTyping', 'dmTeacherTypingBar');
    _attachSwipeListeners('dmTeacherMessages', 'teacher');
    _subscribeTeacherMessages(studentUid);
  }

  function _backToThreadList() {
    _cancelTypingListeners(_activeStudentUid);
    _clearTeacherReply();
    AppState.cancelListener('dmTeacherMessages');
    AppState.cancelListener('dmStudentPresenceWatch');
    _activeStudentUid   = null;
    window._dmActiveUid = null;
    _closeOpenMenu();

    document.querySelectorAll('.dm-thread-item').forEach(el => el.classList.remove('is-active'));

    const viewList = document.getElementById('dmViewList');
    const viewChat = document.getElementById('dmViewChat');
    if (viewList) viewList.style.display = 'flex';
    if (viewChat) { viewChat.style.display = 'none'; viewChat.innerHTML = ''; }
  }

  function _sendTeacherReplyFromPanel() {
    const viewChat = document.getElementById('dmViewChat');
    if (!viewChat) return;
    const uid  = viewChat.dataset.studentUid;
    const name = viewChat.dataset.studentName;
    const cls  = viewChat.dataset.studentClass || '';
    if (!uid) return;
    _sendTeacherReply(uid, name, cls);
  }

  function _subscribeTeacherMessages(studentUid) {
  AppState.cancelListener('dmTeacherMessages');

  const unsub = _threadRef(studentUid)
    .collection('messages').orderBy('timestamp', 'asc')
    .onSnapshot(snap => {
      const container = document.getElementById('dmTeacherMessages');
      if (!container) { AppState.cancelListener('dmTeacherMessages'); return; }

      if (snap.empty) {
        container.innerHTML = `
          <p style="text-align:center;font-size:.8125rem;
                    color:var(--text-disabled,#9ca3af);padding:2rem 0;">
            No messages in this thread yet.
          </p>`;
        return;
      }

      const msgs = [];
      snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));

      // Teacher has this thread open → upgrade any newly arrived student messages
      // from "sent" to "delivered" via the snapshot (no full collection scan).
      _markDeliveredFromSnapshot(snap, studentUid, 'teacher').catch(() => {});

      // If a genuinely NEW student message just arrived while this thread is open,
      // mark it read immediately (teacher is looking at it right now).
      // We check docChanges to avoid calling _markRead on every status-update snapshot.
      const hasNewIncoming = snap.docChanges().some(change =>
        change.type === 'added' && change.doc.data().role === 'student'
      );
      if (hasNewIncoming) {
        _markRead(studentUid, 'teacher').catch(() => {});
      }

      container.innerHTML = _renderMessagesWithDateSeps(msgs, AppConfig.TEACHER_UID, 'teacher');
      container.scrollTop = container.scrollHeight;
    }, err => console.error('[dm] Teacher messages error:', err));

  AppState.registerListener('dmTeacherMessages', unsub);
}

  async function _sendTeacherReply(studentUid, studentName, studentClass) {
    const input = document.getElementById('dmTeacherInput');
    const text  = (input?.value || '').trim();
    if (!text) return;

    const btn = document.getElementById('dmTeacherSendBtn');
    _stopTyping(studentUid, 'teacher').catch(() => {});

    if (input) { input.value = ''; input.style.height = 'auto'; input.style.height = '36px'; }
    UI.setLoading(btn, true);

    // Check student presence from the thread doc (updated by student heartbeat)
    let studentIsOnline = false;
    try {
      const threadSnap = await _threadRef(studentUid).get();
      const tData = (threadSnap.exists && threadSnap.data()) || {};
      studentIsOnline = _isRecentlyActive(tData.studentLastSeen);
    } catch (_) {}

    const resolvedName  = studentName  || '';
    const resolvedClass = studentClass || '';

    const replyPayload = (_teacherReplyTo && _teacherReplyTo.id)
      ? { id: _teacherReplyTo.id, text: _teacherReplyTo.text, senderName: _teacherReplyTo.senderName }
      : null;
    _clearTeacherReply();

    try {
      const batch  = Db().batch();
      const msgRef = _threadRef(studentUid).collection('messages').doc();

      const teacherMsgData = {
        text, senderId: AppConfig.TEACHER_UID, senderName: 'Master Timothy',
        role: 'teacher',
        // Always start as "sent"; student's open snapshot will upgrade to delivered/read
        status: 'sent',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (replyPayload) teacherMsgData.replyTo = replyPayload;

      batch.set(msgRef, teacherMsgData);
      batch.set(_threadRef(studentUid), {
        studentName: resolvedName, studentClass: resolvedClass,
        lastMessage: text.length > 80 ? text.substring(0, 80) + '…' : text,
        lastAt: firebase.firestore.FieldValue.serverTimestamp(),
        studentUnread: firebase.firestore.FieldValue.increment(1),
        teacherUnread: 0,
      }, { merge: true });

      await batch.commit();
    } catch (err) {
      console.error('[dm] _sendTeacherReply error:', err);
      UI.toast('Could not send reply. Please try again.', 'error');
      if (input) input.value = text;
    } finally {
      UI.setLoading(btn, false);
      if (input) input.focus();
    }
  }

  /* ══════════════════════════════════════════════════════════════
     NEW CONVERSATION MODAL
  ══════════════════════════════════════════════════════════════ */
  async function _openNewConversationModal() {
    _injectStyles();
    const overlay     = document.createElement('div');
    overlay.className = 'dm-new-conv-overlay';
    overlay.id        = 'dmNewConvOverlay';
    overlay.innerHTML = `
      <div class="dm-new-conv-modal">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <h3 style="font-size:.9375rem;font-weight:700;color:var(--text-primary,#111827);">
            Message a Student
          </h3>
          <button onclick="DM._closeNewConversationModal()"
                  style="background:none;border:none;cursor:pointer;color:var(--text-tertiary,#6b7280);
                         display:flex;align-items:center;padding:4px;border-radius:4px;">
            ${_iconClose(16)}
          </button>
        </div>
        <div style="position:relative;margin-bottom:.75rem;">
          <span style="position:absolute;left:.625rem;top:50%;transform:translateY(-50%);
                       color:var(--text-4,#9ca3af);pointer-events:none;z-index:1;
                       display:flex;align-items:center;">
            ${_iconSearch(14)}
          </span>
          <input id="dmStudentSearch" type="text" placeholder="Search by name or class…"
                 style="width:100%;box-sizing:border-box;padding:.5rem .75rem .5rem 2.125rem !important;
                        border:1px solid var(--border,#e5e7eb);border-radius:8px;
                        font-family:var(--font);font-size:var(--text-base);outline:none;" />
        </div>
        <div id="dmStudentPickerList"
             style="max-height:320px;overflow-y:auto;border:1px solid var(--border,#e5e7eb);
                    border-radius:8px;overflow-x:hidden;">
          <p style="font-size:.8125rem;color:var(--text-disabled,#9ca3af);
                    text-align:center;padding:2rem 1rem;">Loading students…</p>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) _closeNewConversationModal(); });

    const searchInput = document.getElementById('dmStudentSearch');
    if (searchInput) searchInput.focus();

    let allStudents = [];
    try {
      const snap = await Db().collection('students').get();
      snap.forEach(doc => allStudents.push({ uid: doc.id, ...doc.data() }));
      allStudents.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } catch (e) {
      console.error('[dm] _openNewConversationModal fetch error:', e);
      const list = document.getElementById('dmStudentPickerList');
      if (list) list.innerHTML = `<p style="font-size:.8125rem;color:var(--danger,#e03131);text-align:center;padding:2rem 1rem;">Failed to load students.</p>`;
      return;
    }

    _renderStudentPickerList(allStudents, '');
    if (searchInput) {
      searchInput.addEventListener('input', () => _renderStudentPickerList(allStudents, searchInput.value));
    }
  }

  function _renderStudentPickerList(students, query) {
    const list = document.getElementById('dmStudentPickerList');
    if (!list) return;

    const q        = query.toLowerCase().trim();
    const filtered = q
      ? students.filter(s =>
          (s.name || '').toLowerCase().includes(q) ||
          (s.class || '').toLowerCase().includes(q))
      : students;

    if (!filtered.length) {
      list.innerHTML = `<p style="font-size:.8125rem;color:var(--text-disabled,#9ca3af);text-align:center;padding:2rem 1rem;">No students found.</p>`;
      return;
    }

    list.innerHTML = filtered.map((s, idx) => {
      const isOnline  = _isRecentlyActive(s.lastSeen);
      const lastSeen  = s.lastSeen || null;
      const presenceTxt = isOnline
        ? `<span style="color:#22c45e;font-size:.6rem;font-weight:600;line-height:1;">&#x25cf; Online</span>`
        : (lastSeen
            ? `<span style="font-size:.6rem;color:var(--text-disabled,#9ca3af);line-height:1;">${_esc(_formatLastSeen(lastSeen))}</span>`
            : `<span style="font-size:.6rem;color:var(--text-disabled,#9ca3af);line-height:1;">Offline</span>`);

      return `
        <div class="dm-picker-row"
             data-uid="${_escAttr(s.uid)}"
             data-name="${_escAttr(s.name || '')}"
             data-class="${_escAttr(s.class || '')}"
             style="display:flex;align-items:center;gap:.625rem;padding:.625rem .875rem;
                    cursor:pointer;transition:background .1s;box-sizing:border-box;width:100%;
                    ${idx < filtered.length - 1 ? 'border-bottom:1px solid var(--border,#e5e7eb);' : ''}">
          <div style="position:relative;flex-shrink:0;">
            <div style="width:34px;height:34px;border-radius:50%;background:var(--brand-bg,#edf2ff);
                        border:1.5px solid ${isOnline ? '#22c45e' : 'var(--brand-border,#bac8ff)'};
                        display:flex;align-items:center;justify-content:center;
                        font-size:.75rem;font-weight:700;color:var(--brand-text,#3730a3);">
              ${_esc((s.name || '?').charAt(0).toUpperCase())}
            </div>
            ${isOnline
              ? `<span style="position:absolute;bottom:0;right:0;width:9px;height:9px;
                              border-radius:50%;background:#22c45e;border:2px solid var(--surface,#fff);"></span>`
              : ''}
          </div>
          <div style="flex:1;min-width:0;">
            <p style="font-size:.8125rem;font-weight:600;color:var(--text-primary,#111827);margin:0;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${_esc(s.name || 'Unknown')}
            </p>
            <div style="display:flex;align-items:center;gap:.375rem;margin-top:1px;">
              <p style="font-size:.6875rem;color:var(--text-tertiary,#6b7280);margin:0;
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:8rem;">
                ${_esc(s.class || '—')}
              </p>
              <span style="color:var(--border-strong);">·</span>
              ${presenceTxt}
            </div>
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.dm-picker-row').forEach(row => {
      row.addEventListener('mouseenter', () => { row.style.background = 'var(--surface-subtle,#f9fafb)'; });
      row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
      row.addEventListener('click', () => {
        _pickStudentForConversation(row.dataset.uid, row.dataset.name, row.dataset.class);
      });
    });
  }

  function _closeNewConversationModal() {
    const overlay = document.getElementById('dmNewConvOverlay');
    if (overlay) overlay.remove();
  }

  async function _pickStudentForConversation(uid, name, cls) {
    _closeNewConversationModal();
    try {
      const threadSnap = await _threadRef(uid).get();
      if (!threadSnap.exists) {
        await _threadRef(uid).set({
          studentName: name, studentClass: cls,
          studentUnread: 0, teacherUnread: 0, lastMessage: '',
        }, { merge: true });
      }
    } catch (e) { console.warn('[dm] Could not seed thread doc for new conv:', e); }
    await _openConversation(uid, name, cls);
  }

  /* ── Badge helpers ─────────────────────────────────────────── */
  function _updateStudentBadge(count) {
    const btn = document.getElementById('dmOpenBtn');
    if (!btn) return;
    const existing = btn.querySelector('.dm-notif-badge');
    if (existing) existing.remove();
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className   = 'dm-notif-badge';
      badge.textContent = count > 9 ? '9+' : String(count);
      badge.style.cssText = [
        'position:absolute','top:-6px','right:-6px','min-width:18px','height:18px',
        'background:var(--danger,#e03131)','color:#fff','font-size:.625rem','font-weight:700',
        'border-radius:99px','display:flex','align-items:center','justify-content:center',
        'padding:0 4px','pointer-events:none','border:2px solid var(--surface,#fff)','line-height:1',
      ].join(';');
      btn.style.position = 'relative';
      btn.appendChild(badge);
    }
  }

  function _updateTeacherBadge(count) {
    const btn = document.getElementById('tab-dm');
    if (!btn) return;
    const existing = btn.querySelector('.dm-notif-badge');
    if (existing) existing.remove();
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className   = 'dm-notif-badge';
      badge.textContent = count > 9 ? '9+' : String(count);
      badge.style.cssText = [
        'position:absolute','top:-6px','right:-6px','min-width:18px','height:18px',
        'background:var(--danger,#e03131)','color:#fff','font-size:.625rem','font-weight:700',
        'border-radius:99px','display:flex','align-items:center','justify-content:center',
        'padding:0 4px','pointer-events:none','border:2px solid var(--surface,#fff)','line-height:1',
      ].join(';');
      btn.style.position = 'relative';
      btn.appendChild(badge);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     INIT LISTENERS (called from app.js on login)
  ══════════════════════════════════════════════════════════════ */
  async function initStudentDMListener(uid) {
  AppState.cancelListener('dmStudentUnread');

  // Mark student as online and start heartbeat
  await _setStudentOnlineGlobal(uid);

  // Sweep: upgrade any teacher messages that arrived while student was away → delivered
  // (student is now in the app — message is considered delivered even if not yet read)
  await _markDelivered(uid, 'student').catch(e => console.warn('[dm] initStudentDMListener delivery sweep error:', e));

  const unsub = _threadRef(uid).onSnapshot(snap => {
    const data  = (snap.exists && snap.data()) || {};
    const count = data.studentUnread || 0;
    AppState.dmStudentUnread = count;
    _updateStudentBadge(count);

    // If there are unread teacher messages and the student is in the app,
    // upgrade sent→delivered (NOT read — read only happens when inbox is open).
    if (count > 0) {
      _markDelivered(uid, 'student').catch(() => {});
    }
    // NOTE: _markRead is intentionally NOT called here.
    // It is only called from openStudentInbox() when the student actually opens the thread.
  }, err => console.warn('[dm] Student unread listener error:', err));

  AppState.registerListener('dmStudentUnread', unsub);
}

  async function initTeacherDMListener() {
  AppState.cancelListener('dmTeacherUnread');
  await _setTeacherOnlineGlobal();

  // One-time sweep on login: upgrade all student→sent messages to delivered
  // across every thread, since teacher is now active in the app.
  try {
    const allThreads = await Db().collection('directMessages').get();
    const deliveryPromises = [];
    allThreads.forEach(doc => {
      deliveryPromises.push(_markDelivered(doc.id, 'teacher').catch(() => {}));
    });
    await Promise.all(deliveryPromises);
  } catch (e) {
    console.warn('[dm] initTeacherDMListener delivery sweep error:', e);
  }

  const unsub = Db().collection('directMessages').onSnapshot(snap => {
    let total = 0;
    snap.forEach(doc => { total += (doc.data().teacherUnread || 0); });
    _updateTeacherBadge(total);

  }, err => console.warn('[dm] Teacher unread listener error:', err));

  AppState.registerListener('dmTeacherUnread', unsub);
}

  /* ── Cleanup ───────────────────────────────────────────────── */
  async function cancelListeners() {
    _stopPresenceRefreshTimer();

    if (_typingActive && _typingCurrentUid && _typingCurrentRole) {
      _stopTyping(_typingCurrentUid, _typingCurrentRole).catch(() => {});
    }
    if (_typingDebounceTimer) { clearTimeout(_typingDebounceTimer); _typingDebounceTimer = null; }
    _typingActive = false;

    _studentReplyTo = null;
    _teacherReplyTo = null;
    _readMarkMap.clear();

    AppState.cancelListener('dmStudentMessages');
    AppState.cancelListener('dmTeacherThreads');
    AppState.cancelListener('dmTeacherMessages');
    AppState.cancelListener('dmStudentUnread');
    AppState.cancelListener('dmTeacherUnread');
    AppState.cancelListener('dmTeacherPresenceWatch');
    AppState.cancelListener('dmStudentPresenceWatch');
    _activeStudentUid   = null;
    window._dmActiveUid = null;
    _closeOpenMenu();

    _stopStudentHeartbeat();
    _stopTeacherHeartbeat();

    if (_studentVisibilityHandler) {
      document.removeEventListener('visibilitychange', _studentVisibilityHandler);
      _studentVisibilityHandler = null;
    }
    if (_studentBeforeunloadHandler) {
      window.removeEventListener('beforeunload', _studentBeforeunloadHandler);
      _studentBeforeunloadHandler = null;
    }
    if (_teacherVisibilityHandler) {
      document.removeEventListener('visibilitychange', _teacherVisibilityHandler);
      _teacherVisibilityHandler = null;
    }
    if (_teacherBeforeunloadHandler) {
      window.removeEventListener('beforeunload', _teacherBeforeunloadHandler);
      _teacherBeforeunloadHandler = null;
    }

    if (_teacherOfflineCleanup) {
      await _teacherOfflineCleanup().catch(() => {});
      _teacherOfflineCleanup = null;
    }
    if (_studentOfflineCleanup) {
      await _studentOfflineCleanup().catch(() => {});
      _studentOfflineCleanup = null;
    }

    _teacherIsOnline = false;
  }

  /* ── Firestore shorthand ───────────────────────────────────── */
  function _threadRef(uid) { return Db().collection('directMessages').doc(uid); }
  function Db()            { return window.fbDb; }

  /* ── Escaping ──────────────────────────────────────────────── */
  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _escAttr(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  }

  /* ── Public API ────────────────────────────────────────────── */
  window.DM = {
    openStudentInbox,
    sendStudentMessage,
    backFromStudentInbox,
    openTeacherInbox,
    _openConversation,
    _openConversationFromEl,
    _sendTeacherReply,
    _sendTeacherReplyFromPanel,
    _openNewConversationModal,
    _closeNewConversationModal,
    _pickStudentForConversation,
    _toggleActionMenu,
    _showEditHistory,
    _backToThreadList,
    initStudentDMListener,
    initTeacherDMListener,
    cancelListeners,
    _updateStudentBadge,
    _updateTeacherBadge,
    _scrollToMsg,
    _clearStudentReply,
    _clearTeacherReply,
  };

}());