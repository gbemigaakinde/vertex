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
     teacherOnline    : boolean     (true while teacher has DM tab open)
     teacherLastSeen  : Timestamp   (when teacher last closed conversation)

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
     - Teacher: online only while the DM conversation panel is
       open for a specific student thread. Goes offline when they
       switch threads, close the tab, or log out.
     - Status updates in real time via Firestore listener.

   Student badge lives on #dmOpenBtn (subject selection screen).
   Teacher badge lives on #tab-dm   (teacher dashboard tab).
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

     STUDENT presence:
       - Set online once at login via _setStudentOnlineGlobal().
       - Goes offline on: (a) tab close — beforeunload listener,
         (b) explicit logout — DM.cancelListeners() called by app.js.
       - Opening the DM screen does NOT write presence again.

     TEACHER presence:
       - Set online only while a specific conversation is open
         via _setTeacherPresence(studentUid).
       - Goes offline when: (a) they open a different thread
         (old cleanup runs first), (b) tab close — beforeunload,
         (c) explicit logout — DM.cancelListeners().

     ══════════════════════════════════════════════════════════ */

  // Holds the cleanup fn for the teacher's currently open conversation.
  let _teacherPresenceCleanup = null;

  // Holds the student's offline fn so cancelListeners() can call it on logout.
  let _studentOfflineCleanup = null;

  /**
   * Sets teacherOnline: true on the given student's thread doc.
   * Cleans up any previous thread's teacher-presence first.
   * Registers a beforeunload so the teacher goes offline on tab close.
   */
  async function _setTeacherPresence(studentUid) {
    if (_teacherPresenceCleanup) {
      _teacherPresenceCleanup();
      _teacherPresenceCleanup = null;
    }

    const ref = _threadRef(studentUid);

    try {
      await ref.set({ teacherOnline: true }, { merge: true });
    } catch (e) {
      console.warn('[dm] Could not set teacher presence:', e);
    }

    const goOffline = async () => {
      try {
        await ref.set({
          teacherOnline:   false,
          teacherLastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (_) {}
    };

    window.addEventListener('beforeunload', goOffline);
    _teacherPresenceCleanup = () => {
      window.removeEventListener('beforeunload', goOffline);
      goOffline();
    };
  }

  /**
   * Called once at student login. Sets studentOnline: true.
   * Registers a beforeunload for tab-close, and stores the cleanup
   * function so cancelListeners() can write offline immediately on logout.
   */
  async function _setStudentOnlineGlobal(uid) {
    try {
      await _threadRef(uid).set({ studentOnline: true }, { merge: true });

      const goOffline = async () => {
        try {
          await _threadRef(uid).set({
            studentOnline:   false,
            studentLastSeen: firebase.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        } catch (_) {}
      };

      _studentOfflineCleanup = goOffline;
      window.addEventListener('beforeunload', goOffline);
    } catch (e) {
      console.warn('[dm] Could not set studentOnline globally:', e);
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

     sent      → message written to Firestore
     delivered → recipient's app is open (they've been online)
     read      → recipient has opened this specific conversation

     _markDelivered: upgrades 'sent' messages from the OTHER party
                     to 'delivered'. Called ONCE when a user comes
                     online — NOT inside any repeating onSnapshot
                     callback — so the single grey tick stays visible
                     until the recipient actually comes online.

     _markRead:      upgrades 'sent'/'delivered' messages from the
                     OTHER party to 'read'. Called when the user
                     opens the conversation.
     ══════════════════════════════════════════════════════════ */

  async function _markDelivered(studentUid, recipientRole) {
    try {
      const snap = await _threadRef(studentUid)
        .collection('messages')
        .where('status', '==', 'sent')
        .where('role', '!=', recipientRole)
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
    try {
      const snap = await _threadRef(studentUid)
        .collection('messages')
        .where('role', '!=', recipientRole)
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

    const uid       = AppState.userId;
    const threadRef = _threadRef(uid);

    try {
      await threadRef.set({ studentUnread: 0 }, { merge: true });
      AppState.dmStudentUnread = 0;
      _updateStudentBadge(0);
    } catch (e) {
      console.warn('[dm] Could not clear studentUnread:', e);
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

    // Student opens DM: mark teacher's messages read (delivered first, then read).
    // Student is already marked online from login — no presence write here.
    await _markDelivered(uid, 'student');
    await _markRead(uid, 'student');

    // Watch teacher's online/lastSeen and update the header in real time
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

    // If teacher currently has this conversation open, skip to 'delivered'.
    // Otherwise start at 'sent' — single grey tick — correct WhatsApp behaviour.
    let teacherIsOnline = false;
    try {
      const threadSnap = await _threadRef(uid).get();
      teacherIsOnline = !!(threadSnap.exists && threadSnap.data().teacherOnline);
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
    // Student remains online — only go offline on tab close or logout.
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

          return `
            <div class="dm-thread-item"
                 data-uid="${_esc(item.id)}"
                 onclick="DM._openConversation('${_esc(item.id)}', '${_esc(item.studentName || '')}', '${_esc(item.studentClass || '')}')"
                 style="display:flex;align-items:flex-start;gap:.625rem;
                        padding:.625rem .875rem;cursor:pointer;
                        border-bottom:1px solid var(--border,#e5e7eb);
                        transition:background .1s;
                        background:${isActive ? 'var(--brand-bg,#edf2ff)' : 'transparent'};"
                 onmouseenter="if('${_esc(item.id)}'!==window._dmActiveUid)this.style.background='var(--surface-subtle,#f9fafb)'"
                 onmouseleave="if('${_esc(item.id)}'!==window._dmActiveUid)this.style.background='transparent'">

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

                <!-- Presence line under name -->
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

    // Teacher opens conversation:
    //   1. Mark teacher online for this thread.
    //   2. Upgrade any still-'sent' student messages to 'delivered'
    //      (covers the case where teacher comes online here first).
    //   3. Upgrade everything to 'read' — blue double tick.
    await _setTeacherPresence(studentUid);
    await _markDelivered(studentUid, 'teacher');
    await _markRead(studentUid, 'teacher');

    const panel = document.getElementById('dmConversationPanel');
    if (!panel) return;

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
          <!-- Live student presence line — updated by Firestore listener -->
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
                onclick="DM._sendTeacherReply('${_esc(studentUid)}', '${_esc(studentName)}')"
                class="btn bg-green-600 hover:bg-green-700"
                style="flex-shrink:0;align-self:flex-end;">Reply</button>
      </div>`;

    const input = document.getElementById('dmTeacherInput');
    if (input) {
      input.focus();
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          _sendTeacherReply(studentUid, studentName);
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

    // If student is online right now, skip to 'delivered'.
    // Otherwise start at 'sent' — single grey tick.
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

    // Mark student online for the whole session.
    await _setStudentOnlineGlobal(uid);

    // Upgrade any existing 'sent' teacher messages to 'delivered'
    // now that the student is online.
    await _markDelivered(uid, 'student');
  }

  /* ══════════════════════════════════════════════════════════
     initTeacherDMListener — called once after teacher login
     ══════════════════════════════════════════════════════════

     The delivery sweep (_markDelivered) runs ONCE via a one-shot
     .get() at login time. It is intentionally NOT inside the
     onSnapshot callback, because onSnapshot fires every time any
     thread doc changes (including when lastAt is updated by a new
     message). Putting _markDelivered inside onSnapshot would
     instantly upgrade a freshly-written 'sent' message to
     'delivered', making the single grey tick invisible to the
     sender. The one-shot approach means: messages sent BEFORE the
     teacher logged in get promoted to 'delivered' at login, and
     messages sent AFTER will remain 'sent' until the teacher opens
     that specific conversation (_openConversation runs the sweep
     then too).
     ══════════════════════════════════════════════════════════ */
  async function initTeacherDMListener() {
    AppState.cancelListener('dmTeacherUnread');

    // One-shot delivery sweep at login only
    try {
      const allThreads = await Db().collection('directMessages').get();
      allThreads.forEach(doc => {
        _markDelivered(doc.id, 'teacher').catch(() => {});
      });
    } catch (e) {
      console.warn('[dm] initTeacherDMListener delivery sweep error:', e);
    }

    // Live badge listener — no delivery sweeps inside here
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
  function cancelListeners() {
    AppState.cancelListener('dmStudentMessages');
    AppState.cancelListener('dmTeacherThreads');
    AppState.cancelListener('dmTeacherMessages');
    AppState.cancelListener('dmStudentUnread');
    AppState.cancelListener('dmTeacherUnread');
    AppState.cancelListener('dmTeacherPresenceWatch');
    AppState.cancelListener('dmStudentPresenceWatch');
    _activeStudentUid   = null;
    window._dmActiveUid = null;

    // Go offline for teacher's currently open conversation
    if (_teacherPresenceCleanup) {
      _teacherPresenceCleanup();
      _teacherPresenceCleanup = null;
    }

    // Go offline for student immediately on logout
    // (beforeunload won't fire for a normal in-app logout)
    if (_studentOfflineCleanup) {
      window.removeEventListener('beforeunload', _studentOfflineCleanup);
      _studentOfflineCleanup().catch(() => {});
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
    _sendTeacherReply,
    initStudentDMListener,
    initTeacherDMListener,
    cancelListeners,
    _updateStudentBadge,
    _updateTeacherBadge,
  };

})();
