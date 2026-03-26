/* ============================================================
   js/dm.js — Direct Messaging: Student ↔ Teacher
   ============================================================
   Each student has exactly one conversation thread with the
   teacher, stored at:

     directMessages/{studentUid}               ← thread doc
     directMessages/{studentUid}/messages/{id} ← individual messages

   Thread doc fields:
     studentName      : string
     studentClass     : string
     lastMessage      : string      (preview text)
     lastAt           : Timestamp
     studentUnread    : number      (unread count for the student)
     teacherUnread    : number      (unread count for the teacher)
     studentOnline    : boolean     (true while student's app is open)
     studentLastSeen  : Timestamp   (when student last went offline)
     teacherOnline    : boolean     (true while teacher's app is open)
     teacherLastSeen  : Timestamp   (when teacher last went offline)

   Message doc fields:
     text      : string
     senderId  : string  (uid)
     senderName: string
     role      : 'student' | 'teacher'
     timestamp : Timestamp
     status    : 'sent' | 'delivered' | 'read'

   Delivery/Read receipt logic (WhatsApp-style):
     ✓  (one grey tick)  = 'sent'     — message saved to Firestore
     ✓✓ (two grey ticks) = 'delivered'— recipient has been online since send
     ✓✓ (two blue ticks) = 'read'     — recipient opened the conversation

   Online/Last seen:
     - Student: online from the moment they log in to the app
       (not just when DM is open). Goes offline on tab close OR
       on explicit logout via DM.cancelListeners().
     - Teacher: online from the moment they log in to the app
       (not just when DM tab or any thread is open). Goes offline
       on tab close OR on explicit logout via DM.cancelListeners().
     - Status updates in real time via Firestore listener.
     - Opening or closing a DM conversation thread does NOT
       affect either party's online status.

   Student badge lives on #dmOpenBtn (subject selection screen).
   Teacher badge lives on #tab-dm   (teacher dashboard tab).

   ── Presence reliability ──────────────────────────────────
   `beforeunload` does NOT await promises, so an async Firestore
   write inside it will be abandoned before it completes. We use
   two complementary mechanisms instead:

   1. `visibilitychange` (hidden) — fires when the tab is hidden,
      backgrounded, or the window is minimised. The browser does
      NOT kill the page immediately, so a synchronous Firestore
      write has enough time to go out. This covers the vast
      majority of "user left" cases.

   2. `beforeunload` with `navigator.sendBeacon` — sends a tiny
      keepalive HTTP request that the browser guarantees to deliver
      even as the page unloads. We point it at a lightweight
      Cloud Function endpoint (`/offlineBeacon`) that writes the
      offline status server-side. This covers hard tab closes and
      browser-quit scenarios that visibilitychange might miss.
      If the beacon endpoint is unavailable the worst case is a
      stale "Online" label that self-corrects the next time the
      user logs in.

   3. Explicit logout — `cancelListeners()` is called by app.js
      before AppState.reset(). It writes offline synchronously
      (awaited) and removes both event listeners.
   ============================================================ */

(function () {
  'use strict';

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
    // 'sent' — one grey tick
    return `<span class="dm-ticks dm-ticks--sent" title="Sent" aria-label="Sent">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1.5 5L4 7.5L8.5 2" stroke="rgba(255,255,255,0.6)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>`;
  }

  /* ══════════════════════════════════════════════════════════
     CSS injection — ticks + presence styles
     ══════════════════════════════════════════════════════════ */
  function _injectStyles() {
    if (document.getElementById('_dmStyles')) return;
    const style = document.createElement('style');
    style.id = '_dmStyles';
    style.textContent = `
      .dm-ticks {
        display: inline-flex;
        align-items: center;
        margin-left: 4px;
        vertical-align: middle;
        flex-shrink: 0;
        line-height: 1;
      }
      .dm-msg-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 2px;
        margin-top: 3px;
      }
      .dm-msg-footer .dm-time {
        font-size: .625rem;
        opacity: 0.65;
        line-height: 1;
      }
      .dm-presence {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: .6875rem;
        line-height: 1;
        margin-top: 3px;
      }
      .dm-presence__dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
        transition: background .4s ease;
      }
      .dm-presence__dot--online  {
        background: #22c45e;
        box-shadow: 0 0 0 2px rgba(34,196,94,.2);
      }
      .dm-presence__dot--offline { background: var(--text-4, #9ca3af); }
      .dm-presence__label        { color: var(--text-tertiary, #6b7280); font-size: .6875rem; }
      .dm-presence__label--online { color: #22c45e !important; font-weight: 500; }
    `;
    document.head.appendChild(style);
  }

  /* ══════════════════════════════════════════════════════════
     Presence formatting helpers
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
     Presence management
     ══════════════════════════════════════════════════════════

     The core problem with async writes in beforeunload:
       window.addEventListener('beforeunload', async () => {
         await db.doc(...).set({online: false}); // NEVER COMPLETES
       });
     The browser tears down the page before the promise resolves.

     Our solution uses THREE layers:

     Layer 1 — visibilitychange:
       Fires synchronously when tab is hidden/minimised. The page
       is still alive so the Firestore write has time to go out.
       Covers ~95% of real-world "user left" cases.

     Layer 2 — beforeunload + sendBeacon:
       sendBeacon() is a fire-and-forget HTTP POST the browser
       guarantees to deliver even during page unload. We send the
       user's UID to a lightweight backend endpoint that writes
       offline status server-side. This covers hard tab closes.
       Gracefully degrades: if the endpoint is missing the status
       self-corrects at next login.

     Layer 3 — explicit cancelListeners():
       Called by app.js on in-app logout. Does a proper awaited
       Firestore write. Removes both event listeners.

     ══════════════════════════════════════════════════════════ */

  // ── Beacon endpoint ──────────────────────────────────────
  // Point this at your Cloud Function that writes online:false.
  // If you don't have one yet, leave it as '' and Layer 1 + 3
  // will still keep status correct in the vast majority of cases.
  const OFFLINE_BEACON_URL = '';   // e.g. 'https://us-central1-YOUR_PROJECT.cloudfunctions.net/offlineBeacon'

  // Cleanup functions stored so cancelListeners() can call them
  // synchronously on an in-app logout.
  let _studentOfflineCleanup = null;
  let _teacherOfflineCleanup = null;

  // Bound event listener references so we can removeEventListener
  // exactly (anonymous functions cannot be removed).
  let _studentVisibilityHandler  = null;
  let _studentBeforeunloadHandler = null;
  let _teacherVisibilityHandler  = null;
  let _teacherBeforeunloadHandler = null;

  /* ── helpers ── */

  function _sendBeacon(uid, role) {
    if (!OFFLINE_BEACON_URL) return;
    try {
      const body = JSON.stringify({ uid, role });
      navigator.sendBeacon(OFFLINE_BEACON_URL, new Blob([body], { type: 'application/json' }));
    } catch (_) {}
  }

  /* ── Student presence ─────────────────────────────────── */

  /**
   * Called once at student login.
   * Sets studentOnline:true and registers the two unload guards.
   */
  async function _setStudentOnlineGlobal(uid) {
    try {
      await _threadRef(uid).set({ studentOnline: true }, { merge: true });
    } catch (e) {
      console.warn('[dm] Could not set studentOnline=true:', e);
      return;
    }

    const goOffline = async () => {
      try {
        await _threadRef(uid).set({
          studentOnline:   false,
          studentLastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (_) {}
    };

    _studentOfflineCleanup = goOffline;

    // Layer 1: visibilitychange — synchronous trigger, async write has time to complete.
    _studentVisibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        goOffline().catch(() => {});
      } else {
        // Tab became visible again — restore online status.
        _threadRef(uid).set({ studentOnline: true }, { merge: true }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', _studentVisibilityHandler);

    // Layer 2: beforeunload + sendBeacon for hard tab closes.
    _studentBeforeunloadHandler = () => {
      _sendBeacon(uid, 'student');
      // Attempt a synchronous-style Firestore write as a best-effort
      // fallback (will only succeed if the network stack hasn't been
      // torn down yet — not guaranteed, but costs nothing).
      try {
        _threadRef(uid).set({
          studentOnline:   false,
          studentLastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (_) {}
    };
    window.addEventListener('beforeunload', _studentBeforeunloadHandler);
  }

  /* ── Teacher presence ─────────────────────────────────── */

  /**
   * Called once at teacher login.
   * Broadcasts teacherOnline:true to all thread docs and registers
   * the two unload guards.
   */
  async function _setTeacherOnlineGlobal() {
    try {
      await _broadcastTeacherPresence(true);
    } catch (e) {
      console.warn('[dm] Could not set teacherOnline=true globally:', e);
      return;
    }

    const goOffline = async () => {
      try {
        await _broadcastTeacherPresence(false);
      } catch (_) {}
    };

    _teacherOfflineCleanup = goOffline;

    // Layer 1: visibilitychange.
    _teacherVisibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        goOffline().catch(() => {});
      } else {
        _broadcastTeacherPresence(true).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', _teacherVisibilityHandler);

    // Layer 2: beforeunload + sendBeacon.
    _teacherBeforeunloadHandler = () => {
      _sendBeacon(AppConfig.TEACHER_UID, 'teacher');
      try { _broadcastTeacherPresence(false); } catch (_) {}
    };
    window.addEventListener('beforeunload', _teacherBeforeunloadHandler);
  }

  /**
   * Writes teacherOnline (and teacherLastSeen when going offline)
   * to every existing thread doc in batches of 400, and to the
   * sentinel doc teacherPresence/global.
   */
  async function _broadcastTeacherPresence(isOnline) {
    const db = Db();
    const timestamp = firebase.firestore.FieldValue.serverTimestamp();

    // Sentinel doc — students read this on first open and on send.
    const sentinelData = isOnline
      ? { online: true }
      : { online: false, lastSeen: timestamp };
    await db.collection('teacherPresence').doc('global').set(sentinelData, { merge: true });

    // All existing thread docs.
    const snap = await db.collection('directMessages').get();
    if (snap.empty) return;

    const refs = [];
    snap.forEach(doc => refs.push(doc.ref));

    for (let i = 0; i < refs.length; i += 400) {
      const batch = db.batch();
      refs.slice(i, i + 400).forEach(ref => {
        const data = isOnline
          ? { teacherOnline: true }
          : { teacherOnline: false, teacherLastSeen: timestamp };
        batch.set(ref, data, { merge: true });
      });
      await batch.commit();
    }
  }

  /* ══════════════════════════════════════════════════════════
     Live presence watcher
     ══════════════════════════════════════════════════════════ */

  function _watchPresence(studentUid, watchRole, elementId, listenerKey) {
    AppState.cancelListener(listenerKey);

    const onlineField   = watchRole === 'teacher' ? 'teacherOnline'   : 'studentOnline';
    const lastSeenField = watchRole === 'teacher' ? 'teacherLastSeen' : 'studentLastSeen';

    const unsub = _threadRef(studentUid).onSnapshot(snap => {
      const el = document.getElementById(elementId);
      if (!el) { AppState.cancelListener(listenerKey); return; }
      const data     = (snap.exists && snap.data()) || {};
      const isOnline = !!data[onlineField];
      const lastSeen = data[lastSeenField] || null;
      el.innerHTML   = _presenceHTML(isOnline, lastSeen);
    }, err => console.warn('[dm] Presence watch error:', err));

    AppState.registerListener(listenerKey, unsub);
  }

  /* ══════════════════════════════════════════════════════════
     Delivery helpers (WhatsApp tick logic)

     NOTE on Firestore SDK v8 and the `!=` operator:
     The v8 compat API does not support the `!=` WHERE operator
     in compound queries. Instead we use two separate `.get()`
     calls — one for each role — and merge the results. This
     avoids composite-index requirements and SDK version issues.

     _markDelivered: upgrades 'sent' messages sent BY the other
                     party to 'delivered'. Called once at login
                     (not inside onSnapshot) to avoid instantly
                     upgrading a message the sender just wrote.

     _markRead:      upgrades 'sent'/'delivered' messages sent BY
                     the other party to 'read'. Called when the
                     user opens the specific conversation thread.
     ══════════════════════════════════════════════════════════ */

  /**
   * @param {string} studentUid
   * @param {'student'|'teacher'} recipientRole  — the role of the person
   *   who is NOW online / opening the conversation. We want to mark
   *   messages sent BY THE OTHER role.
   */
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

    // Seed thread doc for brand-new students so _watchPresence() has
    // accurate teacher status from the very first open.
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
      console.warn('[dm] Could not seed thread doc for new student:', e);
    }

    UI.mount(`
      <div class="max-w-2xl mx-auto glass animate-fadeIn"
           style="padding:1.25rem 1.5rem;margin-top:1.25rem;margin-bottom:1.25rem;">

        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <div>
            <h2 class="font-bold" style="font-size:1.125rem;line-height:1.3;">Message Master Timothy</h2>
            <!-- Live teacher presence — updated by Firestore listener below -->
            <div id="dmTeacherPresence" style="margin-top:2px;">
              ${_presenceHTML(false, null)}
            </div>
          </div>
          <button onclick="DM.backFromStudentInbox()" class="btn bg-gray-500 hover:bg-gray-600"
                  style="font-size:.8125rem;">← Back</button>
        </div>

        <!-- Info banner -->
        <div style="margin-bottom:1rem;padding:.625rem .875rem;
                    background:var(--brand-bg,#edf2ff);border:1px solid var(--brand-border,#bac8ff);
                    border-radius:8px;font-size:.8125rem;color:var(--brand-text,#3730a3);line-height:1.6;">
          📩 Send a question or concern directly to Master Timothy.
          He will reply here as soon as possible.
        </div>

        <!-- Messages area -->
        <div id="dmMessages"
             style="min-height:260px;max-height:420px;overflow-y:auto;
                    border:1px solid var(--border,#e5e7eb);border-radius:10px;
                    padding:.75rem;margin-bottom:.75rem;background:var(--surface-subtle,#f9fafb);">
          <p style="text-align:center;font-size:.8125rem;color:var(--text-disabled,#9ca3af);padding:2rem 0;">
            Loading messages…
          </p>
        </div>

        <!-- Input row -->
        <div style="display:flex;gap:.5rem;align-items:flex-end;">
          <textarea id="dmInput"
                    placeholder="Type your message…"
                    rows="1"
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

    // Student opens DM: mark teacher's messages as delivered then read.
    // Student is already marked online from login — no presence write here.
    await _markDelivered(uid, 'student');
    await _markRead(uid, 'student');

    // Watch teacher online/lastSeen in real time.
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
            <p style="text-align:center;font-size:.8125rem;color:var(--text-disabled,#9ca3af);padding:2rem 0;">
              No messages yet. Say hello to Master Timothy! 👋
            </p>`;
          return;
        }

        const msgs = [];
        snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
        container.innerHTML = msgs.map(m => _buildStudentBubble(m, uid)).join('');
        container.scrollTop = container.scrollHeight;
      }, err => console.error('[dm] Student messages error:', err));

    AppState.registerListener('dmStudentMessages', unsub);
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

    const nameStyle = isMe ? `color:rgba(255,255,255,.75);` : `color:var(--brand-text,#3730a3);`;

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
        <span style="font-size:.6875rem;font-weight:700;margin-bottom:3px;${nameStyle}">
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

    const btn = document.getElementById('dmSendBtn');
    UI.setLoading(btn, true);
    if (input) input.value = '';

    // Check teacher online status via the lightweight sentinel doc.
    let teacherIsOnline = false;
    try {
      const sentinelSnap = await Db().collection('teacherPresence').doc('global').get();
      teacherIsOnline = !!(sentinelSnap.exists && sentinelSnap.data().online);
    } catch (_) {}

    const initialStatus = teacherIsOnline ? 'delivered' : 'sent';

    try {
      const batch = Db().batch();
      const msgRef = _threadRef(uid).collection('messages').doc();
      batch.set(msgRef, {
        text,
        senderId:   uid,
        senderName: name,
        role:       'student',
        status:     initialStatus,
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
    // Student remains online — only goes offline on tab hide or logout.
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

        <!-- Left: thread list -->
        <div style="border:1px solid var(--border,#e5e7eb);border-radius:10px;overflow:hidden;
                    display:flex;flex-direction:column;background:var(--surface,#fff);">
          <div style="padding:.75rem 1rem;border-bottom:1px solid var(--border,#e5e7eb);
                      background:var(--surface-subtle,#f9fafb);">
            <h3 style="font-size:.875rem;font-weight:700;color:var(--text-primary,#111827);">
              Student Conversations
            </h3>
          </div>
          <div id="dmThreadList" style="flex:1;overflow-y:auto;padding:.375rem 0;">
            <p style="font-size:.8125rem;color:var(--text-disabled,#9ca3af);
                      text-align:center;padding:2rem 1rem;">Loading…</p>
          </div>
        </div>

        <!-- Right: active conversation -->
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
          const timeStr  = item.lastAt
            ? new Date(item.lastAt.toDate ? item.lastAt.toDate() : item.lastAt)
                .toLocaleDateString('en-GB', { day:'numeric', month:'short' })
            : '';

          const isOnline = !!item.studentOnline;

          const presenceTxt = isOnline
            ? `<span style="color:#22c45e;font-size:.6rem;font-weight:600;line-height:1;">● Online</span>`
            : (item.studentLastSeen
                ? `<span style="font-size:.6rem;color:var(--text-disabled,#9ca3af);line-height:1;">
                     ${_esc(_formatLastSeen(item.studentLastSeen))}
                   </span>`
                : '');

          // Use data attributes for the click target to avoid inline
          // string escaping issues with special characters in names.
          return `
            <div class="dm-thread-item"
                 data-uid="${_esc(item.id)}"
                 data-name="${_esc(item.studentName || '')}"
                 data-class="${_esc(item.studentClass || '')}"
                 style="display:flex;align-items:flex-start;gap:.625rem;
                        padding:.625rem .875rem;cursor:pointer;
                        border-bottom:1px solid var(--border,#e5e7eb);
                        transition:background .1s;
                        background:${isActive ? 'var(--brand-bg,#edf2ff)' : 'transparent'};"
                 onmouseenter="if(this.dataset.uid!==window._dmActiveUid)this.style.background='var(--surface-subtle,#f9fafb)'"
                 onmouseleave="if(this.dataset.uid!==window._dmActiveUid)this.style.background='transparent'"
                 onclick="DM._openConversationFromEl(this)">

              <!-- Avatar with green online ring when student is active -->
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
                  ? `<span style="position:absolute;bottom:0;right:0;
                                  width:9px;height:9px;border-radius:50%;
                                  background:#22c45e;
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

  /**
   * Called from the thread-list item's onclick. Reads uid/name/class
   * from data attributes so special characters in names cannot break
   * the call.
   */
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

    // Teacher opens conversation: mark messages delivered then read.
    // Teacher's own online status is untouched — already set at login.
    await _markDelivered(studentUid, 'teacher');
    await _markRead(studentUid, 'teacher');

    const panel = document.getElementById('dmConversationPanel');
    if (!panel) return;

    // Store uid/name/class on the panel element so the send-reply
    // handler can read them without relying on inline string escaping.
    panel.dataset.studentUid  = studentUid;
    panel.dataset.studentName = studentName;

    panel.innerHTML = `
      <!-- Conversation header with live student presence -->
      <div style="padding:.75rem 1rem;border-bottom:1px solid var(--border,#e5e7eb);
                  background:var(--surface-subtle,#f9fafb);display:flex;
                  align-items:center;gap:.625rem;">
        <div id="dmConvAvatar"
             style="width:36px;height:36px;border-radius:50%;flex-shrink:0;
                    background:var(--brand-bg,#edf2ff);border:1.5px solid var(--brand-border,#bac8ff);
                    display:flex;align-items:center;justify-content:center;
                    font-size:.8125rem;font-weight:700;color:var(--brand-text,#3730a3);">
          ${_esc((studentName || '?').charAt(0).toUpperCase())}
        </div>
        <div>
          <p style="font-size:.875rem;font-weight:700;color:var(--text-primary,#111827);line-height:1.3;">
            ${_esc(studentName)}
            <span style="font-size:.6875rem;font-weight:400;
                         color:var(--text-tertiary,#6b7280);margin-left:.25rem;">
              ${_esc(studentClass)}
            </span>
          </p>
          <!-- Live student presence line -->
          <div id="dmStudentPresence" style="margin-top:1px;">
            ${_presenceHTML(false, null)}
          </div>
        </div>
      </div>

      <!-- Messages -->
      <div id="dmTeacherMessages"
           style="flex:1;overflow-y:auto;padding:.875rem;
                  background:var(--surface-subtle,#f9fafb);min-height:300px;max-height:380px;">
        <p style="text-align:center;font-size:.8125rem;color:var(--text-disabled,#9ca3af);padding:2rem 0;">
          Loading messages…
        </p>
      </div>

      <!-- Input row -->
      <div style="padding:.75rem;border-top:1px solid var(--border,#e5e7eb);
                  display:flex;gap:.5rem;align-items:flex-end;background:var(--surface,#fff);">
        <textarea id="dmTeacherInput"
                  placeholder="Reply to ${_esc(studentName)}…"
                  rows="1"
                  style="flex:1;resize:none;overflow-y:hidden;line-height:1.5;
                         padding:.5625rem .75rem;min-height:36px;max-height:100px;
                         border-radius:var(--r-md);font-family:var(--font);font-size:var(--text-base);"></textarea>
        <button id="dmTeacherSendBtn"
                onclick="DM._sendTeacherReplyFromPanel()"
                class="btn bg-green-600 hover:bg-green-700"
                style="flex-shrink:0;align-self:flex-end;">Reply</button>
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
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        input.style.overflowY = input.scrollHeight > 100 ? 'auto' : 'hidden';
      });
    }

    _watchPresence(studentUid, 'student', 'dmStudentPresence', 'dmStudentPresenceWatch');
    _subscribeTeacherMessages(studentUid);
  }

  /**
   * Reads the active student uid/name from the conversation panel's
   * data attributes, avoiding any inline string escaping in onclick.
   */
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
        container.innerHTML = msgs.map(m => _buildTeacherBubble(m)).join('');
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

    const nameStyle = isTeacher ? `color:rgba(255,255,255,.75);` : `color:var(--brand-text,#3730a3);`;

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
        <span style="font-size:.6875rem;font-weight:700;margin-bottom:3px;${nameStyle}">
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

    // Check student online status from thread doc.
    let studentIsOnline = false;
    try {
      const threadSnap = await _threadRef(studentUid).get();
      studentIsOnline = !!(threadSnap.exists && threadSnap.data().studentOnline);
    } catch (_) {}

    const initialStatus = studentIsOnline ? 'delivered' : 'sent';

    try {
      const batch = Db().batch();
      const msgRef = _threadRef(studentUid).collection('messages').doc();
      batch.set(msgRef, {
        text,
        senderId:   AppConfig.TEACHER_UID,
        senderName: 'Master Timothy',
        role:       'teacher',
        status:     initialStatus,
        timestamp:  firebase.firestore.FieldValue.serverTimestamp(),
      });
      batch.set(_threadRef(studentUid), {
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
        'position:absolute','top:-6px','right:-6px',
        'min-width:18px','height:18px',
        'background:var(--danger,#e03131)','color:#fff',
        'font-size:.625rem','font-weight:700',
        'border-radius:99px','display:flex','align-items:center',
        'justify-content:center','padding:0 4px',
        'pointer-events:none',
        'border:2px solid var(--surface,#fff)','line-height:1',
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
        'position:absolute','top:-6px','right:-6px',
        'min-width:18px','height:18px',
        'background:var(--danger,#e03131)','color:#fff',
        'font-size:.625rem','font-weight:700',
        'border-radius:99px','display:flex','align-items:center',
        'justify-content:center','padding:0 4px',
        'pointer-events:none',
        'border:2px solid var(--surface,#fff)','line-height:1',
      ].join(';');
      btn.style.position = 'relative';
      btn.appendChild(badge);
    }
  }

  /* ══════════════════════════════════════════════════════════
     initStudentDMListener — called once after student login
     ══════════════════════════════════════════════════════════ */
  async function initStudentDMListener(uid) {
    AppState.cancelListener('dmStudentUnread');

    const unsub = _threadRef(uid).onSnapshot(snap => {
      const count = (snap.exists && snap.data().studentUnread) || 0;
      AppState.dmStudentUnread = count;
      _updateStudentBadge(count);
    }, err => console.warn('[dm] Student unread listener error:', err));

    AppState.registerListener('dmStudentUnread', unsub);

    // Mark student online for the whole session and register unload guards.
    await _setStudentOnlineGlobal(uid);

    // Upgrade any existing 'sent' teacher messages to 'delivered'
    // now that the student is online.
    await _markDelivered(uid, 'student');
  }

  /* ══════════════════════════════════════════════════════════
     initTeacherDMListener — called once after teacher login
     ══════════════════════════════════════════════════════════ */
  async function initTeacherDMListener() {
    AppState.cancelListener('dmTeacherUnread');

    // Set teacher online globally and register unload guards.
    await _setTeacherOnlineGlobal();

    // One-shot delivery sweep at login only (NOT inside onSnapshot,
    // to avoid instantly upgrading a message the student just sent).
    try {
      const allThreads = await Db().collection('directMessages').get();
      allThreads.forEach(doc => {
        _markDelivered(doc.id, 'teacher').catch(() => {});
      });
    } catch (e) {
      console.warn('[dm] initTeacherDMListener delivery sweep error:', e);
    }

    // Live badge listener.
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
     cancelListeners — called by app.js on logout
     ══════════════════════════════════════════════════════════ */
  async function cancelListeners() {
    // Cancel Firestore listeners first.
    AppState.cancelListener('dmStudentMessages');
    AppState.cancelListener('dmTeacherThreads');
    AppState.cancelListener('dmTeacherMessages');
    AppState.cancelListener('dmStudentUnread');
    AppState.cancelListener('dmTeacherUnread');
    AppState.cancelListener('dmTeacherPresenceWatch');
    AppState.cancelListener('dmStudentPresenceWatch');
    _activeStudentUid   = null;
    window._dmActiveUid = null;

    // Remove event listeners BEFORE awaiting writes so they don't
    // fire again if something triggers visibility/unload mid-logout.
    if (_teacherVisibilityHandler) {
      document.removeEventListener('visibilitychange', _teacherVisibilityHandler);
      _teacherVisibilityHandler = null;
    }
    if (_teacherBeforeunloadHandler) {
      window.removeEventListener('beforeunload', _teacherBeforeunloadHandler);
      _teacherBeforeunloadHandler = null;
    }
    if (_studentVisibilityHandler) {
      document.removeEventListener('visibilitychange', _studentVisibilityHandler);
      _studentVisibilityHandler = null;
    }
    if (_studentBeforeunloadHandler) {
      window.removeEventListener('beforeunload', _studentBeforeunloadHandler);
      _studentBeforeunloadHandler = null;
    }

    // Write offline status synchronously (awaited) — safe here because
    // this is an in-app logout, not a tab close, so the page is alive.
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
     Responsive style for teacher grid
     ══════════════════════════════════════════════════════════ */
  function _addTeacherGridResponsiveStyle() {
    if (document.getElementById('_dmGridStyle')) return;
    const style = document.createElement('style');
    style.id = '_dmGridStyle';
    style.textContent = `
      @media (max-width:640px) {
        #dmTeacherGrid { grid-template-columns: 1fr !important; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ══════════════════════════════════════════════════════════
     Private helpers
     ══════════════════════════════════════════════════════════ */
  function _threadRef(studentUid) {
    return Db().collection('directMessages').doc(studentUid);
  }

  function Db() { return window.fbDb; }

  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
    initStudentDMListener,
    initTeacherDMListener,
    cancelListeners,
    _updateStudentBadge,
    _updateTeacherBadge,
  };

})();
