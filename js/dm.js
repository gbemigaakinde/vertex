/* ============================================================
   js/dm.js — Direct Messaging + Presence System (v2)
   ============================================================
*/

(function () {
  'use strict';

  /* ── Presence constants ── */
  const HEARTBEAT_INTERVAL_MS = 25_000;   // write lastSeen every 25 s
  const ONLINE_THRESHOLD_MS   = 60_000;   // seen within 60 s → Online

  /* ── Returns true if a Firestore timestamp is recent enough ── */
  function _isRecentlyActive(ts) {
    if (!ts) return false;
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return (Date.now() - date.getTime()) <= ONLINE_THRESHOLD_MS;
  }

  /* ────────────────────────────────────────────────────────────
     Icons
  ──────────────────────────────────────────────────────────── */
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
    return `<span class="dm-ticks dm-ticks--sent" title="Sent" aria-label="Sent">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1.5 5L4 7.5L8.5 2" stroke="rgba(255,255,255,0.6)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>`;
  }

  /* ────────────────────────────────────────────────────────────
     Styles
  ──────────────────────────────────────────────────────────── */
  function _injectStyles() {
    if (document.getElementById('_dmStyles')) return;
    const style = document.createElement('style');
    style.id = '_dmStyles';
    style.textContent = `
      .dm-ticks {
        display: inline-flex; align-items: center; margin-left: 4px;
        vertical-align: middle; flex-shrink: 0; line-height: 1;
      }
      .dm-msg-footer {
        display: flex; align-items: center; justify-content: flex-end;
        gap: 2px; margin-top: 3px;
      }
      .dm-msg-footer .dm-time { font-size: .625rem; opacity: 0.65; line-height: 1; }
      .dm-presence {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: .6875rem; line-height: 1; margin-top: 3px;
      }
      .dm-presence__dot {
        width: 7px; height: 7px; border-radius: 50%;
        flex-shrink: 0; transition: background .4s ease;
      }
      .dm-presence__dot--online {
        background: #22c45e; box-shadow: 0 0 0 2px rgba(34,196,94,.2);
      }
      .dm-presence__dot--offline { background: var(--text-4, #9ca3af); }
      .dm-presence__label { color: var(--text-tertiary, #6b7280); font-size: .6875rem; }
      .dm-presence__label--online { color: #22c45e !important; font-weight: 500; }
      .dm-date-sep {
        display: flex; align-items: center; gap: .625rem;
        margin: .875rem 0 .625rem; user-select: none;
      }
      .dm-date-sep__line { flex: 1; height: 1px; background: var(--border, #e5e7eb); }
      .dm-date-sep__label {
        font-size: .625rem; font-weight: 600; letter-spacing: .04em;
        color: var(--text-disabled, #9ca3af); white-space: nowrap;
        padding: 2px 8px; border-radius: 99px;
        background: var(--surface-subtle, #f3f4f6);
        border: 1px solid var(--border, #e5e7eb);
      }
      .dm-new-conv-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,.45);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999; animation: dmFadeIn .15s ease;
      }
      @keyframes dmFadeIn { from { opacity:0 } to { opacity:1 } }
      .dm-new-conv-modal {
        background: var(--surface, #fff); border-radius: 14px;
        width: min(480px, 94vw); padding: 1.25rem 1.5rem;
        box-shadow: 0 20px 60px rgba(0,0,0,.2);
      }
      .dm-bubble-name--mine {
        color: var(--accent-text, #2d49d6);
        font-size: .6875rem; font-weight: 700; margin-bottom: 3px;
      }
      .dm-bubble-name--theirs {
        color: var(--accent-text, #2d49d6);
        font-size: .6875rem; font-weight: 700; margin-bottom: 3px;
      }
      .dm-msg-wrap { position: relative; }
      .dm-msg-wrap .dm-action-btn {
        position: absolute; top: 4px;
        width: 24px; height: 24px; border-radius: 50%;
        border: 1px solid var(--border, #e5e7eb);
        background: var(--surface, #fff);
        color: var(--text-3, #6b7280);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; opacity: 0; transition: opacity .15s, background .15s;
        padding: 0; flex-shrink: 0;
        box-shadow: 0 1px 4px rgba(0,0,0,.10);
        z-index: 10;
      }
      .dm-msg-wrap .dm-action-btn--right { right: -30px; }
      .dm-msg-wrap .dm-action-btn--left  { left: -30px; }
      .dm-msg-wrap:hover .dm-action-btn,
      .dm-msg-wrap:focus-within .dm-action-btn,
      .dm-msg-wrap .dm-action-btn.dm-action-btn--open { opacity: 1; }
      .dm-msg-wrap .dm-action-btn:hover {
        background: var(--bg-subtle, #f3f4f6); color: var(--accent, #4f6ef7);
      }
      .dm-action-menu {
        position: absolute; z-index: 200;
        background: var(--surface, #fff);
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,.12);
        min-width: 148px; overflow: hidden;
        animation: dmFadeIn .1s ease;
      }
      .dm-action-menu-item {
        display: flex; align-items: center; gap: .5rem;
        padding: .5rem .75rem; font-size: .8125rem;
        color: var(--text-1, #0d0d0f); cursor: pointer;
        transition: background .1s; white-space: nowrap;
        border: none; background: none; width: 100%; text-align: left;
        font-family: var(--font);
      }
      .dm-action-menu-item:hover { background: var(--bg-subtle, #f3f4f6); }
      .dm-action-menu-item + .dm-action-menu-item {
        border-top: 1px solid var(--border, #e5e7eb);
      }
      .dm-edit-textarea {
        width: 100%; resize: none; overflow-y: hidden; line-height: 1.55;
        font-size: .875rem; font-family: var(--font); padding: .375rem .5rem;
        border: 1px solid var(--accent, #4f6ef7); border-radius: 6px;
        background: rgba(255,255,255,.15); color: inherit; outline: none;
        box-shadow: 0 0 0 3px var(--accent-subtle, rgba(79,110,247,.12));
        min-height: 2.4rem;
      }
      .dm-edit-actions {
        display: flex; gap: .375rem; margin-top: .375rem; justify-content: flex-end;
      }
      .dm-edit-btn {
        font-size: .6875rem; font-weight: 600; padding: 3px 11px;
        border-radius: 5px; border: none; cursor: pointer;
        font-family: var(--font); transition: opacity .1s;
      }
      .dm-edit-btn--save   { background: #fff; color: var(--accent, #4f6ef7); }
      .dm-edit-btn--cancel { background: rgba(255,255,255,.2); color: inherit; opacity: .75; }
      .dm-edit-btn--save-light   { background: var(--accent, #4f6ef7); color: #fff; }
      .dm-edit-btn--cancel-light {
        background: var(--bg-subtle, #f3f4f6); color: var(--text-2, #3a3a40);
        border: 1px solid var(--border, #e5e7eb);
      }
      .dm-edited-label {
        font-size: .5625rem; opacity: .6; font-style: italic;
        margin-left: 4px; line-height: 1; white-space: nowrap;
      }
      .dm-history-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,.5);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000; padding: 1rem; animation: dmFadeIn .15s ease;
      }
      .dm-history-modal {
        background: var(--surface, #fff); border-radius: 12px;
        width: min(460px, 96vw); max-height: 80vh;
        display: flex; flex-direction: column;
        box-shadow: 0 20px 60px rgba(0,0,0,.22);
        border: 1px solid var(--border, #e5e7eb);
      }
      .dm-history-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: .875rem 1.125rem;
        border-bottom: 1px solid var(--border, #e5e7eb);
        flex-shrink: 0;
      }
      .dm-history-body {
        overflow-y: auto; padding: .75rem 1rem; flex: 1;
        display: flex; flex-direction: column; gap: .625rem;
      }
      .dm-history-entry {
        padding: .625rem .875rem; border-radius: 8px;
        border: 1px solid var(--border, #e5e7eb);
        background: var(--bg-subtle, #f9fafb);
      }
      .dm-history-entry p {
        font-size: .875rem; line-height: 1.55; color: var(--text-1, #0d0d0f);
        white-space: pre-wrap; word-break: break-word; margin: 0;
      }
      .dm-history-entry time {
        display: block; font-size: .625rem;
        color: var(--text-4, #9ca3af); margin-top: .25rem;
      }
      .dm-history-current {
        background: var(--accent-subtle, rgba(79,110,247,.08));
        border-color: var(--accent-border, rgba(79,110,247,.25));
      }
      .dm-history-current p { font-weight: 500; }
    `;
    document.head.appendChild(style);
  }

  /* ────────────────────────────────────────────────────────────
     Date/time helpers
  ──────────────────────────────────────────────────────────── */
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
      return 'Last seen today at ' +
        date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Last seen yesterday at ' +
        date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return 'Last seen ' +
      date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
      ' at ' +
      date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  /* ────────────────────────────────────────────────────────────
     Presence HTML
     ──────────────────────────────────────────────────────────
     IMPORTANT: isOnline (the boolean flag) is now ONLY used as
     a fast hint. The definitive check is _isRecentlyActive(ts).
     A user is shown as Online only if their lastSeen timestamp
     is within ONLINE_THRESHOLD_MS of now.
  ──────────────────────────────────────────────────────────── */
  function _presenceHTML(isOnlineFlagHint, lastSeen) {
    // Trust the timestamp over the boolean flag.
    // If lastSeen is recent → Online; otherwise → Offline.
    const actuallyOnline = _isRecentlyActive(lastSeen);

    if (actuallyOnline) {
      return `<span class="dm-presence">
        <span class="dm-presence__dot dm-presence__dot--online"></span>
        <span class="dm-presence__label dm-presence__label--online">Online</span>
      </span>`;
    }
    return `<span class="dm-presence">
      <span class="dm-presence__dot dm-presence__dot--offline"></span>
      <span class="dm-presence__label">${_esc(_formatLastSeen(lastSeen))}</span>
    </span>`;
  }

  /* ────────────────────────────────────────────────────────────
     Module-level state
  ──────────────────────────────────────────────────────────── */
  let _studentOfflineCleanup      = null;
  let _teacherOfflineCleanup      = null;
  let _studentVisibilityHandler   = null;
  let _studentBeforeunloadHandler = null;
  let _teacherVisibilityHandler   = null;
  let _teacherBeforeunloadHandler = null;
  let _studentOfflineDone         = false;
  let _teacherOfflineDone         = false;
  let _teacherIsOnline            = false;

  // Heartbeat timer handles
  let _studentHeartbeatHandle = null;
  let _teacherHeartbeatHandle = null;

  /* ────────────────────────────────────────────────────────────
     Heartbeat — student
     Fires every HEARTBEAT_INTERVAL_MS to refresh lastSeen.
     This is what keeps the user appearing "Online" in the new
     threshold-based model. Writing online:true here is optional
     (legacy UI hint) — correctness comes from lastSeen alone.
  ──────────────────────────────────────────────────────────── */
  function _startStudentHeartbeat(uid) {
    _stopStudentHeartbeat();
    _studentHeartbeatHandle = setInterval(async () => {
      if (!firebase.auth().currentUser || _studentOfflineDone) {
        _stopStudentHeartbeat();
        return;
      }
      // Skip heartbeat when tab is hidden — saves writes and lets lastSeen
      // go stale naturally, so the presence indicator auto-flips to Offline.
      if (document.visibilityState === 'hidden') return;

      const ts = firebase.firestore.FieldValue.serverTimestamp();
      try {
        const b = Db().batch();
        b.set(_threadRef(uid), { studentLastSeen: ts, studentOnline: true }, { merge: true });
        b.update(Db().collection('students').doc(uid), { lastSeen: ts, isOnline: true });
        await b.commit();
      } catch (e) {
        console.warn('[dm] Student heartbeat write failed:', e);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  function _stopStudentHeartbeat() {
    if (_studentHeartbeatHandle) {
      clearInterval(_studentHeartbeatHandle);
      _studentHeartbeatHandle = null;
    }
  }

  /* ────────────────────────────────────────────────────────────
     Heartbeat — teacher
  ──────────────────────────────────────────────────────────── */
  function _startTeacherHeartbeat() {
    _stopTeacherHeartbeat();
    _teacherHeartbeatHandle = setInterval(async () => {
      if (!firebase.auth().currentUser || _teacherOfflineDone) {
        _stopTeacherHeartbeat();
        return;
      }
      if (document.visibilityState === 'hidden') return;

      try {
        await _broadcastTeacherPresence(true);
      } catch (e) {
        console.warn('[dm] Teacher heartbeat write failed:', e);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  function _stopTeacherHeartbeat() {
    if (_teacherHeartbeatHandle) {
      clearInterval(_teacherHeartbeatHandle);
      _teacherHeartbeatHandle = null;
    }
  }

  /* ────────────────────────────────────────────────────────────
     Student online presence setup
  ──────────────────────────────────────────────────────────── */
  async function _setStudentOnlineGlobal(uid) {
    _studentOfflineDone = false;

    // Initial "I'm here" write — sets both online flag and lastSeen.
    try {
      const ts    = firebase.firestore.FieldValue.serverTimestamp();
      const batch = Db().batch();
      batch.set(_threadRef(uid), { studentOnline: true, studentLastSeen: ts }, { merge: true });
      batch.update(Db().collection('students').doc(uid), { isOnline: true, lastSeen: ts });
      await batch.commit();
    } catch (e) {
      try {
        const ts = firebase.firestore.FieldValue.serverTimestamp();
        await _threadRef(uid).set({ studentOnline: true, studentLastSeen: ts }, { merge: true });
      } catch (e2) {
        console.warn('[dm] Could not set studentOnline=true:', e2);
        return;
      }
    }

    // Start heartbeat to keep lastSeen fresh.
    _startStudentHeartbeat(uid);

    /* goOffline — called at logout or tab-close.
       This is purely for fast UI feedback.
       Correctness no longer depends on this succeeding. */
    const goOffline = async () => {
      if (_studentOfflineDone) return;
      _studentOfflineDone = true;
      _stopStudentHeartbeat();
      try {
        const ts = firebase.auth().currentUser
          ? firebase.firestore.FieldValue.serverTimestamp()
          : new Date();
        const b = Db().batch();
        b.set(_threadRef(uid), { studentOnline: false, studentLastSeen: ts }, { merge: true });
        try { b.update(Db().collection('students').doc(uid), { isOnline: false, lastSeen: ts }); } catch (_) {}
        await b.commit();
      } catch (e) { console.warn('[dm] studentOffline write failed:', e); }
    };

    _studentOfflineCleanup = goOffline;

    // Tab hidden → stop heartbeat so lastSeen goes stale → auto-Offline after threshold.
    // Tab visible again → restart heartbeat immediately.
    _studentVisibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        _stopStudentHeartbeat();
        // Do NOT call goOffline here — let the threshold handle it naturally.
        // (Calling goOffline here caused the user to appear offline when just
        // switching tabs momentarily, even with the tab still open.)
      } else {
        if (firebase.auth().currentUser && !_studentOfflineDone) {
          // Immediately refresh lastSeen on tab-focus so the user snaps
          // back to Online without waiting a full heartbeat interval.
          (async () => {
            const ts = firebase.firestore.FieldValue.serverTimestamp();
            try {
              const b = Db().batch();
              b.set(_threadRef(uid), { studentOnline: true, studentLastSeen: ts }, { merge: true });
              b.update(Db().collection('students').doc(uid), { isOnline: true, lastSeen: ts });
              await b.commit();
            } catch (_) {}
          })();
          _startStudentHeartbeat(uid);
        }
      }
    };
    document.addEventListener('visibilitychange', _studentVisibilityHandler);

    // beforeunload — best-effort synchronous write.
    _studentBeforeunloadHandler = () => {
      if (_studentOfflineDone) return;
      _studentOfflineDone = true;
      _stopStudentHeartbeat();
      const now = new Date();
      try { _threadRef(uid).set({ studentOnline: false, studentLastSeen: now }, { merge: true }); } catch (_) {}
      try { Db().collection('students').doc(uid).update({ isOnline: false, lastSeen: now }); } catch (_) {}
    };
    window.addEventListener('beforeunload', _studentBeforeunloadHandler);
  }

  /* ────────────────────────────────────────────────────────────
     Teacher online presence setup
  ──────────────────────────────────────────────────────────── */
  async function _setTeacherOnlineGlobal() {
    _teacherOfflineDone = false;
    _teacherIsOnline    = true;

    try {
      await _broadcastTeacherPresence(true);
    } catch (e) {
      console.warn('[dm] Could not set teacherOnline=true globally:', e);
      return;
    }

    // Start heartbeat.
    _startTeacherHeartbeat();

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
          // Snap back to Online immediately on tab-focus.
          _broadcastTeacherPresence(true).catch(() => {});
          _startTeacherHeartbeat();
        }
      }
    };
    document.addEventListener('visibilitychange', _teacherVisibilityHandler);

    _teacherBeforeunloadHandler = () => {
      if (_teacherOfflineDone) return;
      _teacherOfflineDone = true;
      _teacherIsOnline    = false;
      _stopTeacherHeartbeat();
      const db = Db(); const now = new Date();
      try { db.collection('teacherPresence').doc('global').set({ online: false, lastSeen: now }, { merge: true }); } catch (_) {}
      try {
        db.collection('directMessages').get().then(snap => {
          if (snap.empty) return;
          const batch = db.batch();
          snap.forEach(doc => batch.set(doc.ref, { teacherOnline: false, teacherLastSeen: now }, { merge: true }));
          batch.commit();
        }).catch(() => {});
      } catch (_) {}
    };
    window.addEventListener('beforeunload', _teacherBeforeunloadHandler);
  }

  /* ────────────────────────────────────────────────────────────
     _broadcastTeacherPresence
     Now includes lastSeen on EVERY write (online or offline),
     so the threshold check always has a fresh timestamp.
  ──────────────────────────────────────────────────────────── */
  async function _broadcastTeacherPresence(isOnline) {
    const db = Db();
    const ts = firebase.auth().currentUser
      ? firebase.firestore.FieldValue.serverTimestamp()
      : new Date();

    // Always write lastSeen — even when going online — so the timestamp is fresh.
    await db.collection('teacherPresence').doc('global').set(
      { online: isOnline, lastSeen: ts },
      { merge: true }
    );

    const snap = await db.collection('directMessages').get();
    if (snap.empty) return;
    const refs = [];
    snap.forEach(doc => refs.push(doc.ref));
    for (let i = 0; i < refs.length; i += 400) {
      const batch = db.batch();
      refs.slice(i, i + 400).forEach(ref => batch.set(ref,
        { teacherOnline: isOnline, teacherLastSeen: ts },
        { merge: true }
      ));
      await batch.commit();
    }
  }

  /* ────────────────────────────────────────────────────────────
     _watchPresence
     Reads both the boolean flag AND the lastSeen timestamp from
     Firestore snapshots, then calls _presenceHTML which applies
     the threshold check. The boolean flag is passed as a hint
     only — the rendered result depends on _isRecentlyActive(ts).
  ──────────────────────────────────────────────────────────── */
  function _watchPresence(studentUid, watchRole, elementId, listenerKey) {
    AppState.cancelListener(listenerKey);

    if (watchRole === 'teacher') {
      const unsub = _threadRef(studentUid).onSnapshot(snap => {
        const el = document.getElementById(elementId);
        if (!el) { AppState.cancelListener(listenerKey); return; }
        const data = (snap.exists && snap.data()) || {};
        // Pass both the flag (hint) and the timestamp (source of truth).
        el.innerHTML = _presenceHTML(!!data.teacherOnline, data.teacherLastSeen || null);
      }, err => console.warn('[dm] Presence watch error:', err));
      AppState.registerListener(listenerKey, unsub);
      return;
    }

    const unsub = _threadRef(studentUid).onSnapshot(snap => {
      const el = document.getElementById(elementId);
      if (!el) { AppState.cancelListener(listenerKey); return; }
      if (snap.exists) {
        const data = snap.data() || {};
        el.innerHTML = _presenceHTML(!!data.studentOnline, data.studentLastSeen || null);
      } else {
        Db().collection('students').doc(studentUid).get().then(profileSnap => {
          const el2 = document.getElementById(elementId);
          if (!el2) return;
          const data = (profileSnap.exists && profileSnap.data()) || {};
          el2.innerHTML = _presenceHTML(!!data.isOnline, data.lastSeen || null);
        }).catch(() => {});
      }
    }, err => console.warn('[dm] Presence watch error:', err));
    AppState.registerListener(listenerKey, unsub);
  }

  /* ────────────────────────────────────────────────────────────
     Message delivery helpers (unchanged logic)
  ──────────────────────────────────────────────────────────── */
  async function _markDelivered(studentUid, recipientRole) {
    const senderRole = recipientRole === 'student' ? 'teacher' : 'student';
    try {
      const snap = await _threadRef(studentUid)
        .collection('messages')
        .where('status', '==', 'sent')
        .get();
      if (snap.empty) return;
      const toUpdate = [];
      snap.forEach(doc => {
        if (doc.data().role === senderRole) toUpdate.push(doc.ref);
      });
      if (!toUpdate.length) return;
      for (let i = 0; i < toUpdate.length; i += 400) {
        const b = Db().batch();
        toUpdate.slice(i, i + 400).forEach(ref => b.update(ref, { status: 'delivered' }));
        await b.commit();
      }
    } catch (e) { console.warn('[dm] _markDelivered error:', e); }
  }

  async function _markRead(studentUid, recipientRole) {
    const senderRole = recipientRole === 'student' ? 'teacher' : 'student';
    try {
      const snap = await _threadRef(studentUid)
        .collection('messages')
        .where('role', '==', senderRole)
        .get();
      if (snap.empty) return;
      const toUpdate = [];
      snap.forEach(doc => {
        const s = doc.data().status;
        if (s === 'sent' || s === 'delivered') toUpdate.push(doc.ref);
      });
      if (!toUpdate.length) return;
      for (let i = 0; i < toUpdate.length; i += 400) {
        const b = Db().batch();
        toUpdate.slice(i, i + 400).forEach(ref => b.update(ref, { status: 'read' }));
        await b.commit();
      }
    } catch (e) { console.warn('[dm] _markRead error:', e); }
  }

  /* ────────────────────────────────────────────────────────────
     Edit history helpers (unchanged)
  ──────────────────────────────────────────────────────────── */
  function _msgHistoryRef(studentUid, messageId) {
    return _threadRef(studentUid).collection('messages').doc(messageId).collection('editHistory');
  }

  async function _saveEdit(studentUid, messageId, oldText, newText) {
    const db         = Db();
    const historyRef = _msgHistoryRef(studentUid, messageId).doc();
    const msgRef     = _threadRef(studentUid).collection('messages').doc(messageId);
    const ts         = firebase.firestore.FieldValue.serverTimestamp();
    const batch      = db.batch();
    batch.set(historyRef, { text: oldText, editedAt: ts });
    batch.update(msgRef, { text: newText, editedAt: ts });
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

    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  /* ────────────────────────────────────────────────────────────
     Inline edit UI (unchanged)
  ──────────────────────────────────────────────────────────── */
  function _activateInlineEdit(studentUid, messageId, currentText, isDarkBubble, wrapperId) {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;

    const textEl   = wrapper.querySelector('.dm-bubble-text');
    const footerEl = wrapper.querySelector('.dm-msg-footer');
    const editedEl = wrapper.querySelector('.dm-edited-label-wrap');
    if (!textEl) return;

    const saveClass   = isDarkBubble ? 'dm-edit-btn dm-edit-btn--save'   : 'dm-edit-btn dm-edit-btn--save-light';
    const cancelClass = isDarkBubble ? 'dm-edit-btn dm-edit-btn--cancel' : 'dm-edit-btn dm-edit-btn--cancel-light';

    const editUI = document.createElement('div');
    editUI.id = `dmEditUI-${messageId}`;

    const ta = document.createElement('textarea');
    ta.className = 'dm-edit-textarea';
    ta.value     = currentText;
    ta.rows      = 1;

    const actions   = document.createElement('div');
    actions.className = 'dm-edit-actions';

    const cancelBtn       = document.createElement('button');
    cancelBtn.className   = cancelClass;
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick     = () => {
      editUI.remove();
      if (textEl)   textEl.style.display   = '';
      if (footerEl) footerEl.style.display = '';
      if (editedEl) editedEl.style.display = '';
    };

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
        await _saveEdit(studentUid, messageId, currentText, newText);
        if (textEl) textEl.textContent = newText;
        cancelBtn.onclick();
      } catch (err) {
        console.error('[dm] inline edit save error:', err);
        UI.toast('Could not save edit. Please try again.', 'error');
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Save';
      }
    };

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    editUI.appendChild(ta);
    editUI.appendChild(actions);

    if (textEl)   textEl.style.display   = 'none';
    if (footerEl) footerEl.style.display = 'none';
    if (editedEl) editedEl.style.display = 'none';

    const inner = wrapper.querySelector('.dm-bubble-inner');
    if (inner) inner.appendChild(editUI);

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
  }

  /* ────────────────────────────────────────────────────────────
     Action menu (unchanged)
  ──────────────────────────────────────────────────────────── */
  let _openMenuId = null;

  function _closeOpenMenu() {
    if (_openMenuId) {
      const m = document.getElementById(_openMenuId);
      if (m) m.remove();
      const btn = document.querySelector('.dm-action-btn--open');
      if (btn) btn.classList.remove('dm-action-btn--open');
      _openMenuId = null;
    }
  }

  function _toggleActionMenu(wrapperId, studentUid, messageId, currentText, canEdit, canHistory, isDarkBubble, alignRight) {
    const menuId = `dmMenu-${messageId}`;
    if (_openMenuId === menuId) { _closeOpenMenu(); return; }
    _closeOpenMenu();

    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;

    const triggerBtn = wrapper.querySelector('.dm-action-btn');
    if (triggerBtn) triggerBtn.classList.add('dm-action-btn--open');

    const menu    = document.createElement('div');
    menu.className = 'dm-action-menu';
    menu.id        = menuId;
    menu.style.cssText = alignRight
      ? 'right:0;top:calc(100% + 4px);'
      : 'left:0;top:calc(100% + 4px);';

    if (canEdit) {
      const editItem       = document.createElement('button');
      editItem.className   = 'dm-action-menu-item';
      editItem.innerHTML   = `${_iconPencil(13)} Edit message`;
      editItem.onclick     = () => {
        _closeOpenMenu();
        _activateInlineEdit(studentUid, messageId, currentText, isDarkBubble, wrapperId);
      };
      menu.appendChild(editItem);
    }

    if (canHistory) {
      const histItem       = document.createElement('button');
      histItem.className   = 'dm-action-menu-item';
      histItem.innerHTML   = `${_iconHistory(13)} Edit history`;
      histItem.onclick     = () => {
        _closeOpenMenu();
        _showEditHistory(studentUid, messageId, currentText);
      };
      menu.appendChild(histItem);
    }

    if (!menu.children.length) return;

    const bubbleInner = wrapper.querySelector('.dm-bubble-inner') || wrapper;
    bubbleInner.style.position = 'relative';
    bubbleInner.appendChild(menu);
    _openMenuId = menuId;

    setTimeout(() => {
      document.addEventListener('click', function _handler(e) {
        if (!menu.contains(e.target) && !wrapper.querySelector('.dm-action-btn')?.contains(e.target)) {
          _closeOpenMenu();
          document.removeEventListener('click', _handler);
        }
      });
    }, 0);
  }

  /* ────────────────────────────────────────────────────────────
     Bubble builders (unchanged)
  ──────────────────────────────────────────────────────────── */
  function _buildStudentBubble(msg, myUid) {
    const isMe    = msg.senderId === myUid;
    const msgId   = msg.id || '';
    const wrapId  = `dmWrap-${_esc(msgId)}`;
    const canEdit = isMe && !!msgId;

    const time = msg.timestamp
      ? new Date(msg.timestamp.toDate ? msg.timestamp.toDate() : msg.timestamp)
          .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    const bubbleStyle = isMe
      ? `background:var(--brand,#3b5bdb);color:#fff;border-radius:12px 12px 2px 12px;margin-left:auto;`
      : `background:var(--surface,#fff);color:var(--text-primary,#111827);
         border:1px solid var(--border,#e5e7eb);border-radius:12px 12px 12px 2px;margin-right:auto;`;

    const editedLabel = msg.editedAt
      ? `<span class="dm-edited-label-wrap"><span class="dm-edited-label">edited</span></span>`
      : '';

    const footer = isMe
      ? `<div class="dm-msg-footer">${editedLabel}<span class="dm-time">${time}</span>${_tickIcon(msg.status || 'sent')}</div>`
      : `<div class="dm-msg-footer" style="justify-content:flex-start;">${editedLabel}<span class="dm-time">${time}</span></div>`;

    const safeUid   = _esc(myUid);
    const safeMsgId = _esc(msgId);
    const actionBtn = canEdit
      ? `<button class="dm-action-btn dm-action-btn--${isMe ? 'right' : 'left'}"
                 title="Message options"
                 onclick="event.stopPropagation();DM._toggleActionMenu(
                   '${wrapId}','${safeUid}','${safeMsgId}',
                   document.getElementById('${wrapId}').querySelector('.dm-bubble-text').textContent,
                   true,false,${isMe},${isMe})">
           ${_iconPencil(11)}
         </button>`
      : '';

    return `
      <div id="${wrapId}" class="dm-msg-wrap"
           style="display:flex;flex-direction:column;max-width:80%;margin-bottom:.75rem;
                  ${isMe ? 'align-items:flex-end;margin-left:auto;' : 'align-items:flex-start;'}">
        <span class="dm-bubble-name--${isMe ? 'mine' : 'theirs'}">
          ${isMe ? 'You' : _esc(msg.senderName || 'Master Timothy')}
        </span>
        <div style="position:relative;max-width:100%;">
          ${actionBtn}
          <div class="dm-bubble-inner"
               style="position:relative;padding:.625rem .875rem .5rem;${bubbleStyle}word-break:break-word;">
            <p class="dm-bubble-text"
               style="font-size:.875rem;line-height:1.55;white-space:pre-wrap;margin:0;">${_esc(msg.text)}</p>
            ${footer}
          </div>
        </div>
      </div>`;
  }

  function _buildTeacherBubble(msg) {
    const isTeacher  = msg.role === 'teacher';
    const msgId      = msg.id || '';
    const wrapId     = `dmWrap-${_esc(msgId)}`;
    const studentUid = _activeStudentUid || '';
    const canEdit    = isTeacher && !!msgId;
    const canHistory = !!msgId;

    const time = msg.timestamp
      ? new Date(msg.timestamp.toDate ? msg.timestamp.toDate() : msg.timestamp)
          .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    const bubbleStyle = isTeacher
      ? `background:var(--brand,#3b5bdb);color:#fff;border-radius:12px 12px 2px 12px;margin-left:auto;`
      : `background:var(--surface,#fff);color:var(--text-primary,#111827);
         border:1px solid var(--border,#e5e7eb);border-radius:12px 12px 12px 2px;margin-right:auto;`;

    const editedLabel = msg.editedAt
      ? `<span class="dm-edited-label-wrap"><span class="dm-edited-label">edited</span></span>`
      : '';

    const footer = isTeacher
      ? `<div class="dm-msg-footer">${editedLabel}<span class="dm-time">${time}</span>${_tickIcon(msg.status || 'sent')}</div>`
      : `<div class="dm-msg-footer" style="justify-content:flex-start;">${editedLabel}<span class="dm-time">${time}</span></div>`;

    const safeStudentUid = _esc(studentUid);
    const safeMsgId      = _esc(msgId);
    const actionBtn = (canEdit || canHistory)
      ? `<button class="dm-action-btn dm-action-btn--${isTeacher ? 'right' : 'left'}"
                 title="Message options"
                 onclick="event.stopPropagation();DM._toggleActionMenu(
                   '${wrapId}','${safeStudentUid}','${safeMsgId}',
                   document.getElementById('${wrapId}').querySelector('.dm-bubble-text').textContent,
                   ${canEdit},${canHistory},${isTeacher},${isTeacher})">
           ${_iconPencil(11)}
         </button>`
      : '';

    return `
      <div id="${wrapId}" class="dm-msg-wrap"
           style="display:flex;flex-direction:column;max-width:80%;margin-bottom:.75rem;
                  ${isTeacher ? 'align-items:flex-end;margin-left:auto;' : 'align-items:flex-start;'}">
        <span class="dm-bubble-name--${isTeacher ? 'mine' : 'theirs'}">
          ${isTeacher ? 'Master Timothy' : _esc(msg.senderName || 'Student')}
        </span>
        <div style="position:relative;max-width:100%;">
          ${actionBtn}
          <div class="dm-bubble-inner"
               style="position:relative;padding:.625rem .875rem .5rem;${bubbleStyle}word-break:break-word;">
            <p class="dm-bubble-text"
               style="font-size:.875rem;line-height:1.55;white-space:pre-wrap;margin:0;">${_esc(msg.text)}</p>
            ${footer}
          </div>
        </div>
      </div>`;
  }

  /* ────────────────────────────────────────────────────────────
     Student inbox
  ──────────────────────────────────────────────────────────── */
  async function openStudentInbox() {
    _injectStyles();

    const uid         = AppState.userId;
    const studentData = AppState.studentData || {};
    const threadRef   = _threadRef(uid);

    try {
      await threadRef.set({ studentUnread: 0 }, { merge: true });
      AppState.dmStudentUnread = 0;
      _updateStudentBadge(0);
    } catch (e) { console.warn('[dm] Could not clear studentUnread:', e); }

    try {
      const threadSnap = await threadRef.get();
      if (!threadSnap.exists) {
        const sentinelSnap = await Db().collection('teacherPresence').doc('global').get();
        const tData = (sentinelSnap.exists && sentinelSnap.data()) || {};
        // Use threshold check for teacher online status — not raw boolean.
        const teacherOnline   = _isRecentlyActive(tData.lastSeen);
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
           style="padding:1.25rem 1.5rem;margin-top:1.25rem;margin-bottom:1.25rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;">
          <div>
            <h2 class="font-bold" style="font-size:1.125rem;line-height:1.3;">Message Master Timothy</h2>
            <div id="dmTeacherPresence" style="margin-top:2px;">${_presenceHTML(false, null)}</div>
          </div>
          <button onclick="DM.backFromStudentInbox()" class="btn bg-gray-500 hover:bg-gray-600"
                  style="font-size:.8125rem;">&#8592; Back</button>
        </div>

        <div style="margin-bottom:.75rem;padding:.5rem .875rem;
                    background:var(--surface-subtle,#f3f4f6);border:1px solid var(--border,#e5e7eb);
                    border-radius:8px;font-size:.75rem;color:var(--text-tertiary,#6b7280);
                    display:flex;align-items:center;gap:.5rem;line-height:1.5;">
          <span style="color:var(--text-tertiary,#6b7280);">${_iconLock(13)}</span>
          <span><strong style="color:var(--text-secondary,#374151);font-weight:600;">Private</strong>
          — these messages can only be seen by you and Master Timothy.</span>
        </div>

        <div style="margin-bottom:1rem;padding:.625rem .875rem;
                    background:var(--brand-bg,#edf2ff);border:1px solid var(--brand-border,#bac8ff);
                    border-radius:8px;font-size:.8125rem;color:var(--brand-text,#3730a3);line-height:1.6;
                    display:flex;align-items:flex-start;gap:.5rem;">
          <span style="margin-top:1px;">${_iconMail(14)}</span>
          <span>Send a question or concern directly to Master Timothy.
          He will reply here as soon as possible.</span>
        </div>

        <div id="dmMessages"
             style="min-height:260px;max-height:420px;overflow-y:auto;
                    border:1px solid var(--border,#e5e7eb);border-radius:10px;
                    padding:.75rem 1.75rem;margin-bottom:.75rem;background:var(--surface-subtle,#f9fafb);">
          <p style="text-align:center;font-size:.8125rem;color:var(--text-disabled,#9ca3af);padding:2rem 0;">
            Loading messages…
          </p>
        </div>

        <div style="display:flex;gap:.5rem;align-items:flex-end;">
          <textarea id="dmInput" placeholder="Type your message…" rows="1"
                    style="flex:1;resize:none;overflow-y:hidden;line-height:1.5;
                           padding:.5625rem .75rem;min-height:36px;max-height:120px;
                           border-radius:var(--r-md);font-family:var(--font);font-size:var(--text-base);"></textarea>
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
      });
    }

    await _markRead(uid, 'student');
    _watchPresence(uid, 'teacher', 'dmTeacherPresence', 'dmTeacherPresenceWatch');
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
        _markRead(uid, 'student').catch(() => {});
        container.innerHTML = _renderMessagesWithDateSeps(msgs, uid, 'student');
        container.scrollTop = container.scrollHeight;
      }, err => console.error('[dm] Student messages error:', err));
    AppState.registerListener('dmStudentMessages', unsub);
  }

  function _renderMessagesWithDateSeps(msgs, myUid, viewerRole) {
    let lastDayKey = null;
    const parts    = [];
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
        lastDayKey = dk;
      }
      parts.push(viewerRole === 'student'
        ? _buildStudentBubble(msg, myUid)
        : _buildTeacherBubble(msg));
    }
    return parts.join('');
  }

  /* ────────────────────────────────────────────────────────────
     sendStudentMessage
     Uses threshold check to decide delivered vs sent status.
  ──────────────────────────────────────────────────────────── */
  async function sendStudentMessage() {
    const input = document.getElementById('dmInput');
    const text  = (input?.value || '').trim();
    if (!text) return;

    const uid         = AppState.userId;
    const studentData = AppState.studentData || {};
    const name        = studentData.name  || 'Student';
    const cls         = studentData.class || '';
    const btn         = document.getElementById('dmSendBtn');

    UI.setLoading(btn, true);
    if (input) input.value = '';

    // Use the sentinel doc + threshold check for teacher online status.
    let teacherIsOnline = false;
    try {
      const sentinelSnap = await Db().collection('teacherPresence').doc('global').get();
      const tData = (sentinelSnap.exists && sentinelSnap.data()) || {};
      teacherIsOnline = _isRecentlyActive(tData.lastSeen);
    } catch (_) {}

    try {
      const batch  = Db().batch();
      const msgRef = _threadRef(uid).collection('messages').doc();
      batch.set(msgRef, {
        text, senderId: uid, senderName: name, role: 'student',
        status: teacherIsOnline ? 'delivered' : 'sent',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
      batch.set(_threadRef(uid), {
        studentName: name, studentClass: cls,
        lastMessage: text.length > 80 ? text.substring(0, 80) + '…' : text,
        lastAt: firebase.firestore.FieldValue.serverTimestamp(),
        teacherUnread: firebase.firestore.FieldValue.increment(1),
        studentUnread: 0, teacherOnline: teacherIsOnline,
      }, { merge: true });
      await batch.commit();
    } catch (err) {
      console.error('[dm] sendStudentMessage error:', err);
      UI.toast('Failed to send message. Please try again.', 'error');
      if (input) input.value = text;
    } finally {
      UI.setLoading(btn, false);
      if (input) { input.style.height = 'auto'; input.focus(); }
    }
  }

  function backFromStudentInbox() {
    AppState.cancelListener('dmStudentMessages');
    AppState.cancelListener('dmTeacherPresenceWatch');
    _closeOpenMenu();
    Exam.renderSubjectSelection();
  }

  /* ────────────────────────────────────────────────────────────
     Teacher inbox
  ──────────────────────────────────────────────────────────── */
  function openTeacherInbox() {
  _injectStyles();
  const panel = document.getElementById('teacher-dm');
  if (!panel) return;

  panel.innerHTML = `
    <div id="dmTeacherShell"
         style="border:1px solid var(--border,#e5e7eb);border-radius:12px;overflow:hidden;
                background:var(--surface,#fff);display:flex;flex-direction:column;
                height:600px;max-height:82vh;position:relative;">

      <!-- VIEW A: Thread list -->
      <div id="dmViewList" style="display:flex;flex-direction:column;height:100%;min-height:0;">

        <!-- List header -->
        <div style="padding:.75rem 1rem;border-bottom:1px solid var(--border,#e5e7eb);
                    background:var(--surface-subtle,#f9fafb);flex-shrink:0;
                    display:flex;align-items:center;justify-content:space-between;gap:.5rem;">
          <h3 style="font-size:.9375rem;font-weight:700;color:var(--text-primary,#111827);">
            Messages
          </h3>
          <button onclick="DM._openNewConversationModal()"
                  title="New message"
                  style="width:30px;height:30px;border-radius:50%;
                         border:1px solid var(--brand-border,#bac8ff);
                         background:var(--brand-bg,#edf2ff);cursor:pointer;
                         display:flex;align-items:center;justify-content:center;
                         color:var(--brand-text,#3730a3);transition:background .15s;">
            ${_iconPencil(14)}
          </button>
        </div>

        <!-- Scrollable thread list -->
        <div id="dmThreadList"
             style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;">
          <p style="font-size:.8125rem;color:var(--text-disabled,#9ca3af);
                    text-align:center;padding:2rem 1rem;">Loading…</p>
        </div>
      </div>

      <!-- VIEW B: Single conversation (hidden until a thread is opened) -->
      <div id="dmViewChat"
           style="display:none;flex-direction:column;height:100%;min-height:0;position:absolute;
                  inset:0;background:var(--surface,#fff);z-index:10;">
        <!-- Populated by _openConversation() -->
      </div>

    </div>`;

  _subscribeTeacherThreadList();
}

  /* ────────────────────────────────────────────────────────────
     Thread list
     Now uses _isRecentlyActive for the presence dot & label.
  ──────────────────────────────────────────────────────────── */
  function _subscribeTeacherThreadList() {
  AppState.cancelListener('dmTeacherThreads');

  // Inject thread-list item styles once
  if (!document.getElementById('_dmThreadStyles')) {
    const s = document.createElement('style');
    s.id = '_dmThreadStyles';
    s.textContent = `
      .dm-thread-item {
        display: flex;
        align-items: flex-start;
        gap: .625rem;
        padding: .75rem 1rem;
        cursor: pointer;
        border-bottom: 1px solid var(--border, #e5e7eb);
        background: transparent;
        transition: background .12s ease;
        box-sizing: border-box;
        width: 100%;
        overflow: hidden;
      }
      .dm-thread-item:hover {
        background: var(--bg-subtle, #f5f5f7);
      }
      .dm-thread-item.is-active {
        background: var(--accent-subtle, #edf2ff);
      }
      .dm-thread-avatar {
        flex-shrink: 0;
        position: relative;
        width: 42px;
        height: 42px;
      }
      .dm-thread-avatar-inner {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: var(--accent-subtle, #edf2ff);
        border: 1.5px solid var(--accent-border, #bac8ff);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: .875rem;
        font-weight: 700;
        color: var(--accent-text, #3730a3);
        transition: border-color .3s;
      }
      .dm-thread-avatar-inner.is-online {
        border-color: #22c45e;
      }
      .dm-thread-online-dot {
        position: absolute;
        bottom: 1px;
        right: 1px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #22c45e;
        border: 2px solid var(--bg-base, #fff);
      }
      .dm-thread-body {
        flex: 1;
        min-width: 0;
        overflow: hidden;
      }
      .dm-thread-row1 {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: .5rem;
        margin-bottom: 2px;
      }
      .dm-thread-name {
        font-size: .875rem;
        font-weight: 700;
        color: var(--text-1, #111827);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
        flex: 1;
      }
      .dm-thread-date {
        font-size: .6875rem;
        color: var(--text-4, #9ca3af);
        flex-shrink: 0;
        white-space: nowrap;
      }
      .dm-thread-presence {
        font-size: .6875rem;
        color: var(--text-3, #6b7280);
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dm-thread-presence.is-online {
        color: #22c45e;
        font-weight: 600;
      }
      .dm-thread-row2 {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: .5rem;
      }
      .dm-thread-preview {
        font-size: .8125rem;
        color: var(--text-3, #6b7280);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
        min-width: 0;
      }
      .dm-thread-unread {
        flex-shrink: 0;
        min-width: 20px;
        height: 20px;
        border-radius: 99px;
        background: var(--danger, #e03131);
        color: #fff;
        font-size: .625rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 5px;
        line-height: 1;
      }
      .dm-thread-class-badge {
        display: inline-block;
        font-size: .625rem;
        font-weight: 500;
        color: var(--accent-text, #3730a3);
        background: var(--accent-subtle, #edf2ff);
        border: 1px solid var(--accent-border, #bac8ff);
        border-radius: 4px;
        padding: 1px 6px;
        margin-top: 3px;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(s);
  }

  const unsub = Db()
    .collection('directMessages').orderBy('lastAt', 'desc')
    .onSnapshot(snap => {
      const list = document.getElementById('dmThreadList');
      if (!list) { AppState.cancelListener('dmTeacherThreads'); return; }

      if (snap.empty) {
        list.innerHTML = `
          <p style="font-size:.8125rem;color:var(--text-4,#9ca3af);
                    text-align:center;padding:2rem 1rem;">No messages yet.</p>`;
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

        const timeStr = item.lastAt
          ? new Date(item.lastAt.toDate ? item.lastAt.toDate() : item.lastAt)
              .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          : '';

        const presenceLabel = isOnline
          ? `<div class="dm-thread-presence is-online">&#x25cf; Online</div>`
          : (item.studentLastSeen
              ? `<div class="dm-thread-presence">${_esc(_formatLastSeen(item.studentLastSeen))}</div>`
              : `<div class="dm-thread-presence">Offline</div>`);

        return `
          <div class="dm-thread-item${isActive ? ' is-active' : ''}"
               data-uid="${_esc(item.id)}"
               data-name="${_esc(item.studentName || '')}"
               data-class="${_esc(item.studentClass || '')}"
               onclick="DM._openConversationFromEl(this)">

            <div class="dm-thread-avatar">
              <div class="dm-thread-avatar-inner${isOnline ? ' is-online' : ''}">
                ${_esc((item.studentName || '?').charAt(0).toUpperCase())}
              </div>
              ${isOnline ? `<span class="dm-thread-online-dot"></span>` : ''}
            </div>

            <div class="dm-thread-body">
              <div class="dm-thread-row1">
                <span class="dm-thread-name">${_esc(item.studentName || 'Unknown')}</span>
                <span class="dm-thread-date">${_esc(timeStr)}</span>
              </div>
              ${presenceLabel}
              <div class="dm-thread-row2">
                <span class="dm-thread-preview">
                  ${_esc(item.lastMessage || 'No messages yet')}
                </span>
                ${unread > 0
                  ? `<span class="dm-thread-unread">${unread > 9 ? '9+' : unread}</span>`
                  : ''}
              </div>
              <span class="dm-thread-class-badge">${_esc(item.studentClass || '—')}</span>
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

  // Highlight active thread in the list
  document.querySelectorAll('.dm-thread-item').forEach(el => {
    el.style.background = el.dataset.uid === studentUid
      ? 'var(--brand-bg,#edf2ff)' : 'transparent';
  });

  try {
    await _threadRef(studentUid).set({ teacherUnread: 0 }, { merge: true });
  } catch (e) { console.warn('[dm] Could not clear teacherUnread:', e); }

  await _markRead(studentUid, 'teacher');

  // Switch to chat view (full-panel takeover, WhatsApp-style)
  const viewList = document.getElementById('dmViewList');
  const viewChat = document.getElementById('dmViewChat');
  if (!viewList || !viewChat) return;

  viewList.style.display = 'none';
  viewChat.style.display = 'flex';
  viewChat.style.flexDirection = 'column';

  // Store student info on shell for send handler
  viewChat.dataset.studentUid   = studentUid;
  viewChat.dataset.studentName  = studentName;
  viewChat.dataset.studentClass = studentClass || '';

  viewChat.innerHTML = `

    <!-- Chat header with back button -->
    <div style="padding:.625rem 1rem;border-bottom:1px solid var(--border,#e5e7eb);
                background:var(--surface-subtle,#f9fafb);flex-shrink:0;
                display:flex;align-items:center;gap:.75rem;">

      <!-- Back button -->
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

      <!-- Avatar -->
      <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;
                  background:var(--brand-bg,#edf2ff);border:1.5px solid var(--brand-border,#bac8ff);
                  display:flex;align-items:center;justify-content:center;
                  font-size:.8125rem;font-weight:700;color:var(--brand-text,#3730a3);">
        ${_esc((studentName || '?').charAt(0).toUpperCase())}
      </div>

      <!-- Name + presence -->
      <div style="flex:1;min-width:0;">
        <p style="font-size:.875rem;font-weight:700;color:var(--text-primary,#111827);
                  line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${_esc(studentName)}
          <span style="font-size:.6875rem;font-weight:400;
                       color:var(--text-tertiary,#6b7280);margin-left:.25rem;">
            ${_esc(studentClass)}
          </span>
        </p>
        <div id="dmStudentPresence" style="margin-top:1px;">${_presenceHTML(false, null)}</div>
      </div>
    </div>

    <!-- Messages body -->
    <div id="dmTeacherMessages"
         style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;
                padding:.875rem 1rem;background:var(--surface-subtle,#f9fafb);
                display:flex;flex-direction:column;word-break:break-word;
                box-sizing:border-box;width:100%;">
      <p style="text-align:center;font-size:.8125rem;
                color:var(--text-disabled,#9ca3af);padding:2rem 0;">
        Loading messages…
      </p>
    </div>

    <!-- Input bar -->
    <div style="padding:.625rem .875rem;border-top:1px solid var(--border,#e5e7eb);flex-shrink:0;
                display:flex;gap:.5rem;align-items:flex-end;background:var(--surface,#fff);
                box-sizing:border-box;width:100%;">
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
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _sendTeacherReplyFromPanel();
      }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      input.style.overflowY = input.scrollHeight > 120 ? 'auto' : 'hidden';
    });
  }

  _watchPresence(studentUid, 'student', 'dmStudentPresence', 'dmStudentPresenceWatch');
  _subscribeTeacherMessages(studentUid);
}

   function _backToThreadList() {
  // Cancel active chat listeners
  AppState.cancelListener('dmTeacherMessages');
  AppState.cancelListener('dmStudentPresenceWatch');
  _activeStudentUid   = null;
  window._dmActiveUid = null;
  _closeOpenMenu();

  // Clear active highlight on thread list
  document.querySelectorAll('.dm-thread-item').forEach(el => {
    el.style.background = 'transparent';
  });

  // Switch back to list view
  const viewList = document.getElementById('dmViewList');
  const viewChat = document.getElementById('dmViewChat');
  if (viewList) viewList.style.display = 'flex';
  if (viewChat) { viewChat.style.display = 'none'; viewChat.innerHTML = ''; }
}
   
  function _sendTeacherReplyFromPanel() {
    const panel = document.getElementById('dmConversationPanel');
    if (!panel) return;
    const uid  = panel.dataset.studentUid;
    const name = panel.dataset.studentName;
    if (!uid) return;
    _sendTeacherReply(uid, name);
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
        _markRead(studentUid, 'teacher').catch(() => {});
        container.innerHTML = _renderMessagesWithDateSeps(msgs, AppConfig.TEACHER_UID, 'teacher');
        container.scrollTop = container.scrollHeight;
      }, err => console.error('[dm] Teacher messages error:', err));
    AppState.registerListener('dmTeacherMessages', unsub);
  }

  /* ────────────────────────────────────────────────────────────
     _sendTeacherReply
     Uses threshold check for student online status.
  ──────────────────────────────────────────────────────────── */
  async function _sendTeacherReply(studentUid, studentName) {
    const input = document.getElementById('dmTeacherInput');
    const text  = (input?.value || '').trim();
    if (!text) return;

    const btn = document.getElementById('dmTeacherSendBtn');
    UI.setLoading(btn, true);
    if (input) input.value = '';

    // Use threshold check — not the raw boolean.
    let studentIsOnline = false;
    try {
      const threadSnap = await _threadRef(studentUid).get();
      const tData = (threadSnap.exists && threadSnap.data()) || {};
      studentIsOnline = _isRecentlyActive(tData.studentLastSeen);
    } catch (_) {}

    let resolvedName  = studentName;
    let resolvedClass = '';
    try {
      const panel = document.getElementById('dmConversationPanel');
      if (panel) resolvedClass = panel.dataset.studentClass || '';
    } catch (_) {}

    try {
      const batch  = Db().batch();
      const msgRef = _threadRef(studentUid).collection('messages').doc();
      batch.set(msgRef, {
        text, senderId: AppConfig.TEACHER_UID, senderName: 'Master Timothy',
        role: 'teacher', status: studentIsOnline ? 'delivered' : 'sent',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
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
      UI.toast('Failed to send reply. Please try again.', 'error');
      if (input) input.value = text;
    } finally {
      UI.setLoading(btn, false);
      if (input) { input.style.height = 'auto'; input.focus(); }
    }
  }

  /* ────────────────────────────────────────────────────────────
     New conversation modal
     Presence dots use threshold check.
  ──────────────────────────────────────────────────────────── */
  async function _openNewConversationModal() {
    _injectStyles();

    const overlay = document.createElement('div');
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
                       color:var(--text-4,#9ca3af);pointer-events:none;">
            ${_iconSearch(14)}
          </span>
          <input id="dmStudentSearch" type="text" placeholder="Search by name or class…"
                 style="width:100%;box-sizing:border-box;padding:.5rem .75rem .5rem 2rem;
                        border:1px solid var(--border,#e5e7eb);border-radius:8px;
                        font-family:var(--font);font-size:var(--text-base);outline:none;" />
        </div>
        <div id="dmStudentPickerList"
             style="max-height:320px;overflow-y:auto;border:1px solid var(--border,#e5e7eb);
                    border-radius:8px;">
          <p style="font-size:.8125rem;color:var(--text-disabled,#9ca3af);
                    text-align:center;padding:2rem 1rem;">Loading students…</p>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => {
      if (e.target === overlay) _closeNewConversationModal();
    });

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
      if (list) list.innerHTML = `<p style="font-size:.8125rem;color:var(--danger,#e03131);
                                     text-align:center;padding:2rem 1rem;">Failed to load students.</p>`;
      return;
    }

    _renderStudentPickerList(allStudents, '');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        _renderStudentPickerList(allStudents, searchInput.value);
      });
    }
  }

  function _renderStudentPickerList(students, query) {
    const list = document.getElementById('dmStudentPickerList');
    if (!list) return;

    const q = query.toLowerCase().trim();
    const filtered = q
      ? students.filter(s =>
          (s.name  || '').toLowerCase().includes(q) ||
          (s.class || '').toLowerCase().includes(q))
      : students;

    if (!filtered.length) {
      list.innerHTML = `<p style="font-size:.8125rem;color:var(--text-disabled,#9ca3af);
                          text-align:center;padding:2rem 1rem;">No students found.</p>`;
      return;
    }

    list.innerHTML = filtered.map((s, idx) => {
      // Apply threshold check using student's lastSeen from the students collection.
      const isOnline    = _isRecentlyActive(s.lastSeen);
      const lastSeen    = s.lastSeen || null;
      const presenceTxt = isOnline
        ? `<span style="color:#22c45e;font-size:.6rem;font-weight:600;line-height:1;">&#x25cf; Online</span>`
        : (lastSeen
            ? `<span style="font-size:.6rem;color:var(--text-disabled,#9ca3af);line-height:1;">${_esc(_formatLastSeen(lastSeen))}</span>`
            : `<span style="font-size:.6rem;color:var(--text-disabled,#9ca3af);line-height:1;">Offline</span>`);

      return `
        <div style="display:flex;align-items:center;gap:.625rem;padding:.625rem .875rem;
                    cursor:pointer;transition:background .1s;
                    ${idx < filtered.length - 1 ? 'border-bottom:1px solid var(--border,#e5e7eb);' : ''}"
             onmouseenter="this.style.background='var(--surface-subtle,#f9fafb)'"
             onmouseleave="this.style.background='transparent'"
             onclick="DM._pickStudentForConversation('${_esc(s.uid)}','${_esc(s.name || '')}','${_esc(s.class || '')}')">
          <div style="position:relative;flex-shrink:0;">
            <div style="width:34px;height:34px;border-radius:50%;background:var(--brand-bg,#edf2ff);
                        border:1.5px solid ${isOnline ? '#22c45e' : 'var(--brand-border,#bac8ff)'};
                        display:flex;align-items:center;justify-content:center;
                        font-size:.75rem;font-weight:700;color:var(--brand-text,#3730a3);
                        transition:border-color .3s;">
              ${_esc((s.name || '?').charAt(0).toUpperCase())}
            </div>
            ${isOnline
              ? `<span style="position:absolute;bottom:0;right:0;width:9px;height:9px;
                              border-radius:50%;background:#22c45e;
                              border:2px solid var(--surface,#fff);"></span>`
              : ''}
          </div>
          <div style="flex:1;min-width:0;">
            <p style="font-size:.8125rem;font-weight:600;color:var(--text-primary,#111827);margin:0;">
              ${_esc(s.name || 'Unknown')}
            </p>
            <div style="display:flex;align-items:center;gap:.375rem;margin-top:1px;">
              <p style="font-size:.6875rem;color:var(--text-tertiary,#6b7280);margin:0;">
                ${_esc(s.class || '—')}
              </p>
              <span style="color:var(--text-disabled,#9ca3af);font-size:.6rem;">·</span>
              ${presenceTxt}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function _closeNewConversationModal() {
    const overlay = document.getElementById('dmNewConvOverlay');
    if (overlay) overlay.remove();
  }

  async function _pickStudentForConversation(uid, name, cls) {
    _closeNewConversationModal();
    try {
      await _threadRef(uid).set({
        studentName: name, studentClass: cls,
        studentUnread: 0, teacherUnread: 0, lastMessage: '',
      }, { merge: true });
    } catch (e) { console.warn('[dm] Could not seed thread doc for new conv:', e); }
    await _openConversation(uid, name, cls);
  }

  /* ────────────────────────────────────────────────────────────
     Badge helpers (unchanged)
  ──────────────────────────────────────────────────────────── */
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
        'position:absolute', 'top:-6px', 'right:-6px',
        'min-width:18px', 'height:18px',
        'background:var(--danger,#e03131)', 'color:#fff',
        'font-size:.625rem', 'font-weight:700', 'border-radius:99px',
        'display:flex', 'align-items:center', 'justify-content:center',
        'padding:0 4px', 'pointer-events:none',
        'border:2px solid var(--surface,#fff)', 'line-height:1',
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
        'position:absolute', 'top:-6px', 'right:-6px',
        'min-width:18px', 'height:18px',
        'background:var(--danger,#e03131)', 'color:#fff',
        'font-size:.625rem', 'font-weight:700', 'border-radius:99px',
        'display:flex', 'align-items:center', 'justify-content:center',
        'padding:0 4px', 'pointer-events:none',
        'border:2px solid var(--surface,#fff)', 'line-height:1',
      ].join(';');
      btn.style.position = 'relative';
      btn.appendChild(badge);
    }
  }

  /* ────────────────────────────────────────────────────────────
     initStudentDMListener
  ──────────────────────────────────────────────────────────── */
  async function initStudentDMListener(uid) {
    AppState.cancelListener('dmStudentUnread');
    const unsub = _threadRef(uid).onSnapshot(snap => {
      const count = (snap.exists && snap.data().studentUnread) || 0;
      AppState.dmStudentUnread = count;
      _updateStudentBadge(count);
    }, err => console.warn('[dm] Student unread listener error:', err));
    AppState.registerListener('dmStudentUnread', unsub);

    await _setStudentOnlineGlobal(uid);
    await _markDelivered(uid, 'student');
  }

  /* ────────────────────────────────────────────────────────────
     initTeacherDMListener
  ──────────────────────────────────────────────────────────── */
  async function initTeacherDMListener() {
    AppState.cancelListener('dmTeacherUnread');
    await _setTeacherOnlineGlobal();

    try {
      const allThreads = await Db().collection('directMessages').get();
      const deliveryPromises = [];
      allThreads.forEach(doc => {
        deliveryPromises.push(_markDelivered(doc.id, 'teacher').catch(() => {}));
      });
      await Promise.all(deliveryPromises);
    } catch (e) { console.warn('[dm] initTeacherDMListener delivery sweep error:', e); }

    const unsub = Db().collection('directMessages').onSnapshot(snap => {
      let total = 0;
      snap.forEach(doc => { total += (doc.data().teacherUnread || 0); });
      _updateTeacherBadge(total);
    }, err => console.warn('[dm] Teacher unread listener error:', err));
    AppState.registerListener('dmTeacherUnread', unsub);
  }

  /* ────────────────────────────────────────────────────────────
     cancelListeners
     Stops heartbeats before calling the offline cleanup writes.
  ──────────────────────────────────────────────────────────── */
  async function cancelListeners() {
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

    // Stop heartbeats first so they don't race with the cleanup writes.
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

    // Best-effort offline writes — for fast UI feedback only.
    // Correctness is guaranteed by the heartbeat going stale.
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

  /* ────────────────────────────────────────────────────────────
     Misc helpers
  ──────────────────────────────────────────────────────────── */
  function _addTeacherGridResponsiveStyle() {
    if (document.getElementById('_dmGridStyle')) return;
    const style = document.createElement('style');
    style.id = '_dmGridStyle';
    style.textContent = `
      @media (max-width:640px) {
        #dmTeacherGrid { grid-template-columns: 1fr !important; }
      }`;
    document.head.appendChild(style);
  }

  function _threadRef(uid) { return Db().collection('directMessages').doc(uid); }
  function Db()            { return window.fbDb; }
  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ────────────────────────────────────────────────────────────
     Public API
  ──────────────────────────────────────────────────────────── */
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
  _backToThreadList,         
  initStudentDMListener,
  initTeacherDMListener,
  cancelListeners,
  _updateStudentBadge,
  _updateTeacherBadge,
};

})();
