/* ============================================================
   js/dm.js — Direct Messaging: Student ↔ Teacher
   ============================================================ */

 (function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     SVG icon helpers (no emojis)
     ══════════════════════════════════════════════════════════ */

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
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="1.75"
            stroke-linecap="round"/>
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

  function _iconInfo(size) {
    size = size || 14;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="flex-shrink:0;">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.75"/>
      <path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="1.75"
            stroke-linecap="round"/>
    </svg>`;
  }

  /* ══════════════════════════════════════════════════════════
     SVG tick helpers
     ══════════════════════════════════════════════════════════ */

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

  /* ══════════════════════════════════════════════════════════
     CSS injection
     ══════════════════════════════════════════════════════════ */
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
      .dm-date-sep__line {
        flex: 1; height: 1px; background: var(--border, #e5e7eb);
      }
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
    `;
    document.head.appendChild(style);
  }

  /* ══════════════════════════════════════════════════════════
     Date separator helpers
     ══════════════════════════════════════════════════════════ */

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

  /* ══════════════════════════════════════════════════════════
     Presence formatting
     ══════════════════════════════════════════════════════════ */

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

  function _presenceHTML(isOnline, lastSeen) {
    if (isOnline) {
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

  /* ══════════════════════════════════════════════════════════
     Presence state
     ══════════════════════════════════════════════════════════ */

  let _studentOfflineCleanup      = null;
  let _teacherOfflineCleanup      = null;
  let _studentVisibilityHandler   = null;
  let _studentBeforeunloadHandler = null;
  let _teacherVisibilityHandler   = null;
  let _teacherBeforeunloadHandler = null;

  let _studentOfflineDone = false;
  let _teacherOfflineDone = false;

  /* ══════════════════════════════════════════════════════════
     Student presence
     Writes online status to BOTH the thread doc and the
     student profile doc so the teacher can read presence for
     any student, even those with no prior conversation.
     ══════════════════════════════════════════════════════════ */

  async function _setStudentOnlineGlobal(uid) {
    _studentOfflineDone = false;
    try {
      const batch = Db().batch();
      batch.set(_threadRef(uid), { studentOnline: true }, { merge: true });
      batch.update(Db().collection('students').doc(uid), { isOnline: true });
      await batch.commit();
    } catch (e) {
      try {
        await _threadRef(uid).set({ studentOnline: true }, { merge: true });
      } catch (e2) {
        console.warn('[dm] Could not set studentOnline=true:', e2);
        return;
      }
    }

    const goOffline = async () => {
      if (_studentOfflineDone) return;
      _studentOfflineDone = true;
      try {
        const ts = firebase.auth().currentUser
          ? firebase.firestore.FieldValue.serverTimestamp()
          : new Date();
        const threadBatch = Db().batch();
        threadBatch.set(
          _threadRef(uid),
          { studentOnline: false, studentLastSeen: ts },
          { merge: true }
        );
        try {
          threadBatch.update(
            Db().collection('students').doc(uid),
            { isOnline: false, lastSeen: ts }
          );
        } catch (_) {}
        await threadBatch.commit();
      } catch (e) {
        console.warn('[dm] studentOffline write failed:', e);
      }
    };

    _studentOfflineCleanup = goOffline;

    _studentVisibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        goOffline().catch(() => {});
      } else {
        if (firebase.auth().currentUser) {
          _studentOfflineDone = false;
          const batch = Db().batch();
          batch.set(_threadRef(uid), { studentOnline: true }, { merge: true });
          try { batch.update(Db().collection('students').doc(uid), { isOnline: true }); } catch (_) {}
          batch.commit().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', _studentVisibilityHandler);

    _studentBeforeunloadHandler = () => {
      if (_studentOfflineDone) return;
      _studentOfflineDone = true;
      const now = new Date();
      try {
        _threadRef(uid).set(
          { studentOnline: false, studentLastSeen: now },
          { merge: true }
        );
      } catch (_) {}
      try {
        Db().collection('students').doc(uid).update({ isOnline: false, lastSeen: now });
      } catch (_) {}
    };
    window.addEventListener('beforeunload', _studentBeforeunloadHandler);
  }

  /* ══════════════════════════════════════════════════════════
     Teacher presence
     ══════════════════════════════════════════════════════════ */

  async function _setTeacherOnlineGlobal() {
    _teacherOfflineDone = false;
    try {
      await _broadcastTeacherPresence(true);
    } catch (e) {
      console.warn('[dm] Could not set teacherOnline=true globally:', e);
      return;
    }

    const goOffline = async () => {
      if (_teacherOfflineDone) return;
      _teacherOfflineDone = true;
      try {
        await _broadcastTeacherPresence(false);
      } catch (e) {
        console.warn('[dm] teacherOffline broadcast failed:', e);
      }
    };

    _teacherOfflineCleanup = goOffline;

    _teacherVisibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        goOffline().catch(() => {});
      } else {
        if (firebase.auth().currentUser) {
          _teacherOfflineDone = false;
          _broadcastTeacherPresence(true).catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', _teacherVisibilityHandler);

    _teacherBeforeunloadHandler = () => {
      if (_teacherOfflineDone) return;
      _teacherOfflineDone = true;
      const db  = Db();
      const now = new Date();
      try {
        db.collection('teacherPresence').doc('global').set(
          { online: false, lastSeen: now }, { merge: true }
        );
      } catch (_) {}
      try {
        db.collection('directMessages').get().then(snap => {
          if (snap.empty) return;
          const batch = db.batch();
          snap.forEach(doc => batch.set(
            doc.ref,
            { teacherOnline: false, teacherLastSeen: now },
            { merge: true }
          ));
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

    const sentinelData = isOnline
      ? { online: true }
      : { online: false, lastSeen: ts };
    await db.collection('teacherPresence').doc('global').set(sentinelData, { merge: true });

    const snap = await db.collection('directMessages').get();
    if (snap.empty) return;

    const refs = [];
    snap.forEach(doc => refs.push(doc.ref));

    for (let i = 0; i < refs.length; i += 400) {
      const batch = db.batch();
      refs.slice(i, i + 400).forEach(ref => {
        const data = isOnline
          ? { teacherOnline: true }
          : { teacherOnline: false, teacherLastSeen: ts };
        batch.set(ref, data, { merge: true });
      });
      await batch.commit();
    }
  }

  /* ══════════════════════════════════════════════════════════
     Live presence watcher
     For the teacher watching a student: prefers the thread doc
     but falls back to students/{uid} for students with no
     prior conversation thread.
     ══════════════════════════════════════════════════════════ */

  function _watchPresence(studentUid, watchRole, elementId, listenerKey) {
    AppState.cancelListener(listenerKey);

    if (watchRole === 'teacher') {
      const onlineField   = 'teacherOnline';
      const lastSeenField = 'teacherLastSeen';
      const unsub = _threadRef(studentUid).onSnapshot(snap => {
        const el = document.getElementById(elementId);
        if (!el) { AppState.cancelListener(listenerKey); return; }
        const data     = (snap.exists && snap.data()) || {};
        const isOnline = !!data[onlineField];
        const lastSeen = data[lastSeenField] || null;
        el.innerHTML   = _presenceHTML(isOnline, lastSeen);
      }, err => console.warn('[dm] Presence watch error:', err));
      AppState.registerListener(listenerKey, unsub);
      return;
    }

    // watchRole === 'student': watch the thread doc first; if it doesn't
    // exist yet, fall back to the students/{uid} profile doc.
    const unsub = _threadRef(studentUid).onSnapshot(snap => {
      const el = document.getElementById(elementId);
      if (!el) { AppState.cancelListener(listenerKey); return; }

      if (snap.exists) {
        const data     = snap.data() || {};
        const isOnline = !!data.studentOnline;
        const lastSeen = data.studentLastSeen || null;
        el.innerHTML   = _presenceHTML(isOnline, lastSeen);
      } else {
        // No thread doc yet — read from the student profile.
        Db().collection('students').doc(studentUid).get().then(profileSnap => {
          const el2 = document.getElementById(elementId);
          if (!el2) return;
          const data     = (profileSnap.exists && profileSnap.data()) || {};
          const isOnline = !!data.isOnline;
          const lastSeen = data.lastSeen || null;
          el2.innerHTML  = _presenceHTML(isOnline, lastSeen);
        }).catch(() => {});
      }
    }, err => console.warn('[dm] Presence watch error:', err));
    AppState.registerListener(listenerKey, unsub);
  }

  /* ══════════════════════════════════════════════════════════
     Delivery / read receipt helpers
     ══════════════════════════════════════════════════════════ */

  async function _markDelivered(studentUid, recipientRole) {
    const senderRole = recipientRole === 'student' ? 'teacher' : 'student';
    try {
      const snap = await _threadRef(studentUid)
        .collection('messages')
        .where('role', '==', senderRole)
        .where('status', '==', 'sent')
        .get();
      if (snap.empty) return;
      const batch = Db().batch();
      snap.forEach(doc => batch.update(doc.ref, { status: 'delivered' }));
      await batch.commit();
    } catch (e) {
      console.warn('[dm] _markDelivered error:', e);
    }
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
    } catch (e) {
      console.warn('[dm] _markRead error:', e);
    }
  }

  /* ══════════════════════════════════════════════════════════
     STUDENT SIDE
     ══════════════════════════════════════════════════════════ */

  async function openStudentInbox() {
    _injectStyles();

    const uid         = AppState.userId;
    const studentData = AppState.studentData || {};
    const threadRef   = _threadRef(uid);

    try {
      await threadRef.set({ studentUnread: 0 }, { merge: true });
      AppState.dmStudentUnread = 0;
      _updateStudentBadge(0);
    } catch (e) {
      console.warn('[dm] Could not clear studentUnread:', e);
    }

    try {
      const threadSnap = await threadRef.get();
      if (!threadSnap.exists) {
        const sentinelSnap = await Db()
          .collection('teacherPresence')
          .doc('global')
          .get();
        const teacherOnline   = !!(sentinelSnap.exists && sentinelSnap.data().online);
        const teacherLastSeen = (sentinelSnap.exists && sentinelSnap.data().lastSeen) || null;

        const seedData = {
          studentName:   studentData.name  || '',
          studentClass:  studentData.class || '',
          studentUnread: 0,
          teacherUnread: 0,
          teacherOnline,
        };
        if (teacherLastSeen) seedData.teacherLastSeen = teacherLastSeen;
        await threadRef.set(seedData, { merge: true });
      }
    } catch (e) {
      console.warn('[dm] Could not seed thread doc:', e);
    }

    UI.mount(`
      <div class="max-w-2xl mx-auto glass animate-fadeIn"
           style="padding:1.25rem 1.5rem;margin-top:1.25rem;margin-bottom:1.25rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;">
          <div>
            <h2 class="font-bold" style="font-size:1.125rem;line-height:1.3;">Message Master Timothy</h2>
            <div id="dmTeacherPresence" style="margin-top:2px;">
              ${_presenceHTML(false, null)}
            </div>
          </div>
          <button onclick="DM.backFromStudentInbox()" class="btn bg-gray-500 hover:bg-gray-600"
                  style="font-size:.8125rem;">&#8592; Back</button>
        </div>

        <div style="margin-bottom:.75rem;padding:.5rem .875rem;
                    background:var(--surface-subtle,#f3f4f6);
                    border:1px solid var(--border,#e5e7eb);
                    border-radius:8px;font-size:.75rem;
                    color:var(--text-tertiary,#6b7280);
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
                    padding:.75rem;margin-bottom:.75rem;background:var(--surface-subtle,#f9fafb);">
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

    await _markDelivered(uid, 'student');
    await _markRead(uid, 'student');
    _watchPresence(uid, 'teacher', 'dmTeacherPresence', 'dmTeacherPresenceWatch');
    _subscribeStudentMessages(uid);
  }

  function _subscribeStudentMessages(uid) {
    AppState.cancelListener('dmStudentMessages');
    const unsub = _threadRef(uid)
      .collection('messages')
      .orderBy('timestamp', 'asc')
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

        _markDelivered(uid, 'student').catch(() => {});
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

      if (viewerRole === 'student') {
        parts.push(_buildStudentBubble(msg, myUid));
      } else {
        parts.push(_buildTeacherBubble(msg));
      }
    }

    return parts.join('');
  }

  function _buildStudentBubble(msg, myUid) {
    const isMe = msg.senderId === myUid;
    const time = msg.timestamp
      ? new Date(msg.timestamp.toDate ? msg.timestamp.toDate() : msg.timestamp)
          .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    const bubbleStyle = isMe
      ? `background:var(--brand,#3b5bdb);color:#fff;border-radius:12px 12px 2px 12px;margin-left:auto;`
      : `background:var(--surface,#fff);color:var(--text-primary,#111827);
         border:1px solid var(--border,#e5e7eb);border-radius:12px 12px 12px 2px;margin-right:auto;`;

    const footer = isMe
      ? `<div class="dm-msg-footer">
           <span class="dm-time">${time}</span>
           ${_tickIcon(msg.status || 'sent')}
         </div>`
      : `<div class="dm-msg-footer" style="justify-content:flex-start;">
           <span class="dm-time">${time}</span>
         </div>`;

    return `
      <div style="display:flex;flex-direction:column;max-width:80%;margin-bottom:.75rem;
                  ${isMe ? 'align-items:flex-end;margin-left:auto;' : 'align-items:flex-start;'}">
        <span class="dm-bubble-name--${isMe ? 'mine' : 'theirs'}">
          ${isMe ? 'You' : _esc(msg.senderName || 'Master Timothy')}
        </span>
        <div style="padding:.625rem .875rem .5rem;${bubbleStyle}max-width:100%;word-break:break-word;">
          <p style="font-size:.875rem;line-height:1.55;white-space:pre-wrap;">${_esc(msg.text)}</p>
          ${footer}
        </div>
      </div>`;
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

    UI.setLoading(btn, true);
    if (input) input.value = '';

    let teacherIsOnline = false;
    try {
      const sentinelSnap = await Db().collection('teacherPresence').doc('global').get();
      teacherIsOnline = !!(sentinelSnap.exists && sentinelSnap.data().online);
    } catch (_) {}

    try {
      const batch  = Db().batch();
      const msgRef = _threadRef(uid).collection('messages').doc();
      batch.set(msgRef, {
        text,
        senderId:   uid,
        senderName: name,
        role:       'student',
        status:     teacherIsOnline ? 'delivered' : 'sent',
        timestamp:  firebase.firestore.FieldValue.serverTimestamp(),
      });
      batch.set(_threadRef(uid), {
        studentName:   name,
        studentClass:  cls,
        lastMessage:   text.length > 80 ? text.substring(0, 80) + '…' : text,
        lastAt:        firebase.firestore.FieldValue.serverTimestamp(),
        teacherUnread: firebase.firestore.FieldValue.increment(1),
        studentUnread: 0,
        teacherOnline: teacherIsOnline,
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
    Exam.renderSubjectSelection();
  }

  /* ══════════════════════════════════════════════════════════
     TEACHER SIDE
     ══════════════════════════════════════════════════════════ */

  function openTeacherInbox() {
    _injectStyles();
    const panel = document.getElementById('teacher-dm');
    if (!panel) return;

    panel.innerHTML = `
      <div style="display:grid;grid-template-columns:260px 1fr;gap:1.25rem;min-height:520px;"
           id="dmTeacherGrid">
        <div style="border:1px solid var(--border,#e5e7eb);border-radius:10px;overflow:hidden;
                    display:flex;flex-direction:column;background:var(--surface,#fff);">
          <div style="padding:.75rem 1rem;border-bottom:1px solid var(--border,#e5e7eb);
                      background:var(--surface-subtle,#f9fafb);
                      display:flex;align-items:center;justify-content:space-between;gap:.5rem;">
            <h3 style="font-size:.875rem;font-weight:700;color:var(--text-primary,#111827);">
              Conversations
            </h3>
            <button onclick="DM._openNewConversationModal()"
                    title="Message a student"
                    style="flex-shrink:0;width:28px;height:28px;border-radius:50%;
                           border:1px solid var(--brand-border,#bac8ff);
                           background:var(--brand-bg,#edf2ff);cursor:pointer;
                           display:flex;align-items:center;justify-content:center;
                           color:var(--brand-text,#3730a3);
                           transition:background .15s;">
              ${_iconPencil(13)}
            </button>
          </div>
          <div id="dmThreadList" style="flex:1;overflow-y:auto;padding:.375rem 0;">
            <p style="font-size:.8125rem;color:var(--text-disabled,#9ca3af);
                      text-align:center;padding:2rem 1rem;">Loading…</p>
          </div>
        </div>
        <div style="border:1px solid var(--border,#e5e7eb);border-radius:10px;overflow:hidden;
                    display:flex;flex-direction:column;background:var(--surface,#fff);"
             id="dmConversationPanel">
          <div style="flex:1;display:flex;align-items:center;justify-content:center;
                      padding:2rem;color:var(--text-disabled,#9ca3af);font-size:.875rem;">
            Select a conversation to view messages
          </div>
        </div>
      </div>`;

    _addTeacherGridResponsiveStyle();
    _subscribeTeacherThreadList();
  }

  function _subscribeTeacherThreadList() {
    AppState.cancelListener('dmTeacherThreads');
    const unsub = Db()
      .collection('directMessages')
      .orderBy('lastAt', 'desc')
      .onSnapshot(snap => {
        const list = document.getElementById('dmThreadList');
        if (!list) { AppState.cancelListener('dmTeacherThreads'); return; }

        if (snap.empty) {
          list.innerHTML = `<p style="font-size:.8125rem;color:var(--text-disabled,#9ca3af);
                              text-align:center;padding:2rem 1rem;">No messages yet.</p>`;
          return;
        }

        let totalUnread = 0;
        const items = [];
        snap.forEach(doc => {
          const d = doc.data();
          totalUnread += (d.teacherUnread || 0);
          items.push({ id: doc.id, ...d });
        });

        _updateTeacherBadge(totalUnread);

        list.innerHTML = items.map(item => {
          const unread   = item.teacherUnread || 0;
          const isActive = _activeStudentUid === item.id;
          const isOnline = !!item.studentOnline;
          const timeStr  = item.lastAt
            ? new Date(item.lastAt.toDate ? item.lastAt.toDate() : item.lastAt)
                .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            : '';
          const presenceTxt = isOnline
            ? `<span style="color:#22c45e;font-size:.6rem;font-weight:600;line-height:1;">&#x25cf; Online</span>`
            : (item.studentLastSeen
                ? `<span style="font-size:.6rem;color:var(--text-disabled,#9ca3af);line-height:1;">
                     ${_esc(_formatLastSeen(item.studentLastSeen))}
                   </span>`
                : '');

          return `
            <div class="dm-thread-item"
                 data-uid="${_esc(item.id)}"
                 data-name="${_esc(item.studentName || '')}"
                 data-class="${_esc(item.studentClass || '')}"
                 style="display:flex;align-items:flex-start;gap:.625rem;
                        padding:.625rem .875rem;cursor:pointer;
                        border-bottom:1px solid var(--border,#e5e7eb);transition:background .1s;
                        background:${isActive ? 'var(--brand-bg,#edf2ff)' : 'transparent'};"
                 onmouseenter="if(this.dataset.uid!==window._dmActiveUid)this.style.background='var(--surface-subtle,#f9fafb)'"
                 onmouseleave="if(this.dataset.uid!==window._dmActiveUid)this.style.background='transparent'"
                 onclick="DM._openConversationFromEl(this)">
              <div style="position:relative;flex-shrink:0;">
                <div style="width:34px;height:34px;border-radius:50%;
                            background:var(--brand-bg,#edf2ff);
                            border:1.5px solid ${isOnline ? '#22c45e' : 'var(--brand-border,#bac8ff)'};
                            display:flex;align-items:center;justify-content:center;
                            font-size:.75rem;font-weight:700;color:var(--brand-text,#3730a3);
                            transition:border-color .3s;">
                  ${_esc((item.studentName || '?').charAt(0).toUpperCase())}
                </div>
                ${isOnline
                  ? `<span style="position:absolute;bottom:0;right:0;width:9px;height:9px;
                                  border-radius:50%;background:#22c45e;
                                  border:2px solid var(--surface,#fff);"></span>`
                  : ''}
              </div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:baseline;justify-content:space-between;gap:.25rem;">
                  <span style="font-size:.8125rem;font-weight:700;color:var(--text-primary,#111827);
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${_esc(item.studentName || 'Unknown')}
                  </span>
                  <span style="font-size:.625rem;color:var(--text-disabled,#9ca3af);flex-shrink:0;">${timeStr}</span>
                </div>
                <div style="margin-top:1px;min-height:.85rem;">${presenceTxt}</div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:.25rem;margin-top:2px;">
                  <span style="font-size:.6875rem;color:var(--text-tertiary,#6b7280);
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${_esc(item.lastMessage || 'No messages yet')}
                  </span>
                  ${unread > 0
                    ? `<span style="min-width:18px;height:18px;border-radius:99px;
                                    background:var(--danger,#e03131);color:#fff;
                                    font-size:.625rem;font-weight:700;display:flex;
                                    align-items:center;justify-content:center;
                                    padding:0 4px;flex-shrink:0;line-height:1;">
                         ${unread > 9 ? '9+' : unread}
                       </span>`
                    : ''}
                </div>
                <span style="font-size:.625rem;color:var(--brand-text,#3730a3);
                              background:var(--brand-bg,#edf2ff);border:1px solid var(--brand-border,#bac8ff);
                              border-radius:4px;padding:1px 5px;display:inline-block;margin-top:2px;">
                  ${_esc(item.studentClass || '—')}
                </span>
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
      el.style.background = el.dataset.uid === studentUid
        ? 'var(--brand-bg,#edf2ff)' : 'transparent';
    });

    try {
      await _threadRef(studentUid).set({ teacherUnread: 0 }, { merge: true });
    } catch (e) {
      console.warn('[dm] Could not clear teacherUnread:', e);
    }

    await _markDelivered(studentUid, 'teacher');
    await _markRead(studentUid, 'teacher');

    const panel = document.getElementById('dmConversationPanel');
    if (!panel) return;

    panel.dataset.studentUid   = studentUid;
    panel.dataset.studentName  = studentName;
    panel.dataset.studentClass = studentClass || '';

    panel.innerHTML = `
      <div style="padding:.75rem 1rem;border-bottom:1px solid var(--border,#e5e7eb);
                  background:var(--surface-subtle,#f9fafb);display:flex;align-items:center;gap:.625rem;">
        <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;
                    background:var(--brand-bg,#edf2ff);border:1.5px solid var(--brand-border,#bac8ff);
                    display:flex;align-items:center;justify-content:center;
                    font-size:.8125rem;font-weight:700;color:var(--brand-text,#3730a3);">
          ${_esc((studentName || '?').charAt(0).toUpperCase())}
        </div>
        <div>
          <p style="font-size:.875rem;font-weight:700;color:var(--text-primary,#111827);line-height:1.3;">
            ${_esc(studentName)}
            <span style="font-size:.6875rem;font-weight:400;color:var(--text-tertiary,#6b7280);margin-left:.25rem;">
              ${_esc(studentClass)}
            </span>
          </p>
          <div id="dmStudentPresence" style="margin-top:1px;">
            ${_presenceHTML(false, null)}
          </div>
        </div>
      </div>

      <div id="dmTeacherMessages"
           style="flex:1;overflow-y:auto;padding:.875rem;
                  background:var(--surface-subtle,#f9fafb);min-height:300px;max-height:380px;">
        <p style="text-align:center;font-size:.8125rem;color:var(--text-disabled,#9ca3af);padding:2rem 0;">
          Loading messages…
        </p>
      </div>

      <div style="padding:.75rem;border-top:1px solid var(--border,#e5e7eb);
                  display:flex;gap:.5rem;align-items:flex-end;background:var(--surface,#fff);">
        <textarea id="dmTeacherInput" placeholder="Reply to ${_esc(studentName)}…" rows="1"
                  style="flex:1;resize:none;overflow-y:hidden;line-height:1.5;
                         padding:.5625rem .75rem;min-height:36px;max-height:100px;
                         border-radius:var(--r-md);font-family:var(--font);font-size:var(--text-base);"></textarea>
        <button id="dmTeacherSendBtn" onclick="DM._sendTeacherReplyFromPanel()"
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
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        input.style.overflowY = input.scrollHeight > 100 ? 'auto' : 'hidden';
      });
    }

    _watchPresence(studentUid, 'student', 'dmStudentPresence', 'dmStudentPresenceWatch');
    _subscribeTeacherMessages(studentUid);
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
      .collection('messages')
      .orderBy('timestamp', 'asc')
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

        _markDelivered(studentUid, 'teacher').catch(() => {});
        _markRead(studentUid, 'teacher').catch(() => {});

        container.innerHTML = _renderMessagesWithDateSeps(msgs, AppConfig.TEACHER_UID, 'teacher');
        container.scrollTop = container.scrollHeight;
      }, err => console.error('[dm] Teacher messages error:', err));
    AppState.registerListener('dmTeacherMessages', unsub);
  }

  function _buildTeacherBubble(msg) {
    const isTeacher = msg.role === 'teacher';
    const time = msg.timestamp
      ? new Date(msg.timestamp.toDate ? msg.timestamp.toDate() : msg.timestamp)
          .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    const bubbleStyle = isTeacher
      ? `background:var(--brand,#3b5bdb);color:#fff;border-radius:12px 12px 2px 12px;margin-left:auto;`
      : `background:var(--surface,#fff);color:var(--text-primary,#111827);
         border:1px solid var(--border,#e5e7eb);border-radius:12px 12px 12px 2px;margin-right:auto;`;

    const footer = isTeacher
      ? `<div class="dm-msg-footer">
           <span class="dm-time">${time}</span>
           ${_tickIcon(msg.status || 'sent')}
         </div>`
      : `<div class="dm-msg-footer" style="justify-content:flex-start;">
           <span class="dm-time">${time}</span>
         </div>`;

    return `
      <div style="display:flex;flex-direction:column;max-width:80%;margin-bottom:.75rem;
                  ${isTeacher ? 'align-items:flex-end;margin-left:auto;' : 'align-items:flex-start;'}">
        <span class="dm-bubble-name--${isTeacher ? 'mine' : 'theirs'}">
          ${isTeacher ? 'Master Timothy' : _esc(msg.senderName || 'Student')}
        </span>
        <div style="padding:.625rem .875rem .5rem;${bubbleStyle}max-width:100%;word-break:break-word;">
          <p style="font-size:.875rem;line-height:1.55;white-space:pre-wrap;">${_esc(msg.text)}</p>
          ${footer}
        </div>
      </div>`;
  }

  async function _sendTeacherReply(studentUid, studentName) {
    const input = document.getElementById('dmTeacherInput');
    const text  = (input?.value || '').trim();
    if (!text) return;

    const btn = document.getElementById('dmTeacherSendBtn');
    UI.setLoading(btn, true);
    if (input) input.value = '';

    let studentIsOnline = false;
    try {
      const threadSnap = await _threadRef(studentUid).get();
      studentIsOnline = !!(threadSnap.exists && threadSnap.data().studentOnline);
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
        text,
        senderId:   AppConfig.TEACHER_UID,
        senderName: 'Master Timothy',
        role:       'teacher',
        status:     studentIsOnline ? 'delivered' : 'sent',
        timestamp:  firebase.firestore.FieldValue.serverTimestamp(),
      });
      batch.set(_threadRef(studentUid), {
        studentName:   resolvedName,
        studentClass:  resolvedClass,
        lastMessage:   text.length > 80 ? text.substring(0, 80) + '…' : text,
        lastAt:        firebase.firestore.FieldValue.serverTimestamp(),
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

  /* ══════════════════════════════════════════════════════════
     Teacher — New Conversation
     The student picker now reads presence from students/{uid}
     so the teacher can see online status for any student,
     including those with no prior conversation thread.
     ══════════════════════════════════════════════════════════ */

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
                  style="background:none;border:none;cursor:pointer;
                         color:var(--text-tertiary,#6b7280);line-height:1;padding:4px;
                         display:flex;align-items:center;justify-content:center;
                         border-radius:4px;">
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
                                     text-align:center;padding:2rem 1rem;">
                                     Failed to load students.</p>`;
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
      const isOnline = !!s.isOnline;
      const lastSeen = s.lastSeen || null;
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
            <div style="width:34px;height:34px;border-radius:50%;
                        background:var(--brand-bg,#edf2ff);
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
        studentName:   name,
        studentClass:  cls,
        studentUnread: 0,
        teacherUnread: 0,
        lastMessage:   '',
      }, { merge: true });
    } catch (e) {
      console.warn('[dm] Could not seed thread doc for new conv:', e);
    }

    await _openConversation(uid, name, cls);
  }

  /* ══════════════════════════════════════════════════════════
     Badge helpers
     ══════════════════════════════════════════════════════════ */

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

  /* ══════════════════════════════════════════════════════════
     initStudentDMListener
     ══════════════════════════════════════════════════════════ */
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

  /* ══════════════════════════════════════════════════════════
     initTeacherDMListener
     ══════════════════════════════════════════════════════════ */
  async function initTeacherDMListener() {
    AppState.cancelListener('dmTeacherUnread');

    await _setTeacherOnlineGlobal();

    try {
      const allThreads = await Db().collection('directMessages').get();
      allThreads.forEach(doc => {
        _markDelivered(doc.id, 'teacher').catch(() => {});
      });
    } catch (e) {
      console.warn('[dm] initTeacherDMListener delivery sweep error:', e);
    }

    const unsub = Db()
      .collection('directMessages')
      .onSnapshot(snap => {
        let total = 0;
        snap.forEach(doc => { total += (doc.data().teacherUnread || 0); });
        _updateTeacherBadge(total);
      }, err => console.warn('[dm] Teacher unread listener error:', err));
    AppState.registerListener('dmTeacherUnread', unsub);
  }

  /* ══════════════════════════════════════════════════════════
     cancelListeners
     ══════════════════════════════════════════════════════════ */
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
  }

  /* ══════════════════════════════════════════════════════════
     Responsive style
     ══════════════════════════════════════════════════════════ */
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

  /* ══════════════════════════════════════════════════════════
     Private helpers
     ══════════════════════════════════════════════════════════ */
  function _threadRef(uid) { return Db().collection('directMessages').doc(uid); }
  function Db()            { return window.fbDb; }
  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ══════════════════════════════════════════════════════════
     Expose
     ══════════════════════════════════════════════════════════ */
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
    initStudentDMListener,
    initTeacherDMListener,
    cancelListeners,
    _updateStudentBadge,
    _updateTeacherBadge,
  };

})();
