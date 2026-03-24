/* ============================================================
   js/dm.js — Direct Messaging: Student ↔ Teacher
   ============================================================
   Each student has exactly one conversation thread with the
   teacher, stored at:

     directMessages/{studentUid}               ← thread doc
     directMessages/{studentUid}/messages/{id} ← individual messages

   Thread doc fields:
     studentName  : string
     studentClass : string
     lastMessage  : string   (preview text)
     lastAt       : Timestamp
     studentUnread: number   (unread count for the student)
     teacherUnread: number   (unread count for the teacher)

   Message doc fields:
     text      : string
     senderId  : string  (uid)
     senderName: string
     role      : 'student' | 'teacher'
     timestamp : Timestamp

   Student badge lives on #dmOpenBtn (subject selection screen).
   Teacher badge lives on #tab-dm   (teacher dashboard tab).
   ============================================================ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     Public API surface (attached to window.DM at the bottom)
     ══════════════════════════════════════════════════════════ */

  /* ─────────────────────────────────────────────────────────
     openStudentInbox
     Opens the student's private conversation with the teacher.
     Called from the subject-selection screen button.
  ───────────────────────────────────────────────────────────── */
  async function openStudentInbox() {
    const uid         = AppState.userId;
    const studentData = AppState.studentData || {};
    const threadRef   = _threadRef(uid);

    /* Clear the student's unread counter */
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
            <h2 class="font-bold" style="font-size:1.125rem;">Message Master Timothy</h2>
            <p style="font-size:.75rem;color:var(--text-tertiary,#6b7280);margin-top:2px;">
              Private — only you and Master Timothy can see this
            </p>
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

    /* Wire up textarea auto-grow + Enter key */
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

    /* Subscribe to live messages */
    _subscribeStudentMessages(uid, studentData);
  }

  /* ─────────────────────────────────────────────────────────
     _subscribeStudentMessages
  ───────────────────────────────────────────────────────────── */
  function _subscribeStudentMessages(uid, studentData) {
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

  /* ─────────────────────────────────────────────────────────
     _buildStudentBubble
  ───────────────────────────────────────────────────────────── */
  function _buildStudentBubble(msg, myUid) {
    const isMe = msg.senderId === myUid;
    const time = msg.timestamp
      ? new Date(msg.timestamp.toDate ? msg.timestamp.toDate() : msg.timestamp)
          .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) +
        ' · ' +
        new Date(msg.timestamp.toDate ? msg.timestamp.toDate() : msg.timestamp)
          .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      : 'Just now';

    const bubbleStyle = isMe
      ? `background:var(--brand,#3b5bdb);color:#fff;border-radius:12px 12px 2px 12px;
         margin-left:auto;`
      : `background:var(--surface,#fff);color:var(--text-primary,#111827);
         border:1px solid var(--border,#e5e7eb);border-radius:12px 12px 12px 2px;
         margin-right:auto;`;

    const nameStyle = isMe
      ? `color:rgba(255,255,255,.75);`
      : `color:var(--brand-text,#3730a3);`;

    return `
      <div style="display:flex;flex-direction:column;max-width:80%;margin-bottom:.75rem;
                  ${isMe ? 'align-items:flex-end;margin-left:auto;' : 'align-items:flex-start;'}">
        <span style="font-size:.6875rem;font-weight:700;margin-bottom:3px;${nameStyle}">
          ${isMe ? 'You' : _esc(msg.senderName || 'Master Timothy')}
        </span>
        <div style="padding:.625rem .875rem;${bubbleStyle}max-width:100%;word-break:break-word;">
          <p style="font-size:.875rem;line-height:1.55;white-space:pre-wrap;">${_esc(msg.text)}</p>
        </div>
        <span style="font-size:.625rem;color:var(--text-disabled,#9ca3af);margin-top:3px;">${time}</span>
      </div>`;
  }

  /* ─────────────────────────────────────────────────────────
     sendStudentMessage
  ───────────────────────────────────────────────────────────── */
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

    try {
      const batch = Db().batch();

      /* Write the message */
      const msgRef = _threadRef(uid).collection('messages').doc();
      batch.set(msgRef, {
        text,
        senderId:   uid,
        senderName: name,
        role:       'student',
        timestamp:  firebase.firestore.FieldValue.serverTimestamp(),
      });

      /* Update / create thread doc — increment teacher's unread */
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
      if (input) input.value = text; // restore
    } finally {
      UI.setLoading(btn, false);
      if (input) { input.style.height = 'auto'; input.focus(); }
    }
  }

  /* ─────────────────────────────────────────────────────────
     backFromStudentInbox
  ───────────────────────────────────────────────────────────── */
  function backFromStudentInbox() {
    AppState.cancelListener('dmStudentMessages');
    Exam.renderSubjectSelection();
  }

  /* ══════════════════════════════════════════════════════════
     TEACHER SIDE — rendered inside teacher.js tab panel
     ══════════════════════════════════════════════════════════ */

  /* ─────────────────────────────────────────────────────────
     openTeacherInbox
     Renders the full DM inbox into #teacher-dm panel.
     Called by teacher.js showTab('dm').
  ───────────────────────────────────────────────────────────── */
  function openTeacherInbox() {
    const panel = document.getElementById('teacher-dm');
    if (!panel) return;

    /* Clear teacher unread on their own thread doc isn't needed here
       because teacherUnread is per-student-thread, cleared when the
       teacher opens that specific conversation. */

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
          <div id="dmThreadList"
               style="flex:1;overflow-y:auto;padding:.375rem 0;">
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

  /* ─────────────────────────────────────────────────────────
     _subscribeTeacherThreadList
  ───────────────────────────────────────────────────────────── */
  function _subscribeTeacherThreadList() {
    AppState.cancelListener('dmTeacherThreads');

    const unsub = Db()
      .collection('directMessages')
      .orderBy('lastAt', 'desc')
      .onSnapshot(snap => {
        const list = document.getElementById('dmThreadList');
        if (!list) { AppState.cancelListener('dmTeacherThreads'); return; }

        if (snap.empty) {
          list.innerHTML = `
            <p style="font-size:.8125rem;color:var(--text-disabled,#9ca3af);
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

        /* Update tab badge */
        _updateTeacherBadge(totalUnread);

        list.innerHTML = items.map(item => {
          const unread   = item.teacherUnread || 0;
          const isActive = _activeStudentUid === item.id;
          const timeStr  = item.lastAt
            ? new Date(item.lastAt.toDate ? item.lastAt.toDate() : item.lastAt)
                .toLocaleDateString('en-GB', { day:'numeric', month:'short' })
            : '';

          return `
            <div class="dm-thread-item"
                 data-uid="${_esc(item.id)}"
                 onclick="DM._openConversation('${_esc(item.id)}', '${_esc(item.studentName || '')}', '${_esc(item.studentClass || '')}')"
                 style="display:flex;align-items:flex-start;gap:.625rem;
                        padding:.625rem .875rem;cursor:pointer;border-bottom:1px solid var(--border,#e5e7eb);
                        transition:background .1s;
                        background:${isActive ? 'var(--brand-bg,#edf2ff)' : 'transparent'};"
                 onmouseenter="if('${_esc(item.id)}'!==window._dmActiveUid)this.style.background='var(--surface-subtle,#f9fafb)'"
                 onmouseleave="if('${_esc(item.id)}'!==window._dmActiveUid)this.style.background='transparent'">
              <!-- Avatar -->
              <div style="width:34px;height:34px;border-radius:50%;flex-shrink:0;
                          background:var(--brand-bg,#edf2ff);border:1.5px solid var(--brand-border,#bac8ff);
                          display:flex;align-items:center;justify-content:center;
                          font-size:.75rem;font-weight:700;color:var(--brand-text,#3730a3);">
                ${_esc((item.studentName || '?').charAt(0).toUpperCase())}
              </div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:baseline;justify-content:space-between;gap:.25rem;">
                  <span style="font-size:.8125rem;font-weight:700;color:var(--text-primary,#111827);
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${_esc(item.studentName || 'Unknown')}
                  </span>
                  <span style="font-size:.625rem;color:var(--text-disabled,#9ca3af);flex-shrink:0;">${timeStr}</span>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:.25rem;margin-top:1px;">
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

  /* Keep track of which conversation is open */
  let _activeStudentUid  = null;
  window._dmActiveUid    = null; // used by inline onmouseenter

  /* ─────────────────────────────────────────────────────────
     _openConversation (teacher opens a student thread)
  ───────────────────────────────────────────────────────────── */
  async function _openConversation(studentUid, studentName, studentClass) {
    _activeStudentUid   = studentUid;
    window._dmActiveUid = studentUid;

    /* Highlight active thread */
    document.querySelectorAll('.dm-thread-item').forEach(el => {
      el.style.background = el.dataset.uid === studentUid
        ? 'var(--brand-bg,#edf2ff)' : 'transparent';
    });

    /* Clear teacher's unread for this thread */
    try {
      await _threadRef(studentUid).set({ teacherUnread: 0 }, { merge: true });
    } catch (e) {
      console.warn('[dm] Could not clear teacherUnread:', e);
    }

    const panel = document.getElementById('dmConversationPanel');
    if (!panel) return;

    panel.innerHTML = `
      <!-- Conversation header -->
      <div style="padding:.75rem 1rem;border-bottom:1px solid var(--border,#e5e7eb);
                  background:var(--surface-subtle,#f9fafb);display:flex;
                  align-items:center;justify-content:space-between;">
        <div>
          <p style="font-size:.875rem;font-weight:700;color:var(--text-primary,#111827);">
            ${_esc(studentName)}
          </p>
          <p style="font-size:.75rem;color:var(--text-tertiary,#6b7280);margin-top:1px;">
            ${_esc(studentClass)}
          </p>
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

    /* Wire textarea */
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

    _subscribeTeacherMessages(studentUid);
  }

  /* ─────────────────────────────────────────────────────────
     _subscribeTeacherMessages
  ───────────────────────────────────────────────────────────── */
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

  /* ─────────────────────────────────────────────────────────
     _buildTeacherBubble
  ───────────────────────────────────────────────────────────── */
  function _buildTeacherBubble(msg) {
    const isTeacher = msg.role === 'teacher';
    const time = msg.timestamp
      ? new Date(msg.timestamp.toDate ? msg.timestamp.toDate() : msg.timestamp)
          .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) +
        ' · ' +
        new Date(msg.timestamp.toDate ? msg.timestamp.toDate() : msg.timestamp)
          .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      : 'Just now';

    const bubbleStyle = isTeacher
      ? `background:var(--brand,#3b5bdb);color:#fff;border-radius:12px 12px 2px 12px;margin-left:auto;`
      : `background:var(--surface,#fff);color:var(--text-primary,#111827);
         border:1px solid var(--border,#e5e7eb);border-radius:12px 12px 12px 2px;margin-right:auto;`;

    const nameStyle = isTeacher
      ? `color:rgba(255,255,255,.75);`
      : `color:var(--brand-text,#3730a3);`;

    return `
      <div style="display:flex;flex-direction:column;max-width:80%;margin-bottom:.75rem;
                  ${isTeacher ? 'align-items:flex-end;margin-left:auto;' : 'align-items:flex-start;'}">
        <span style="font-size:.6875rem;font-weight:700;margin-bottom:3px;${nameStyle}">
          ${isTeacher ? 'Master Timothy' : _esc(msg.senderName || 'Student')}
        </span>
        <div style="padding:.625rem .875rem;${bubbleStyle}max-width:100%;word-break:break-word;">
          <p style="font-size:.875rem;line-height:1.55;white-space:pre-wrap;">${_esc(msg.text)}</p>
        </div>
        <span style="font-size:.625rem;color:var(--text-disabled,#9ca3af);margin-top:3px;">${time}</span>
      </div>`;
  }

  /* ─────────────────────────────────────────────────────────
     _sendTeacherReply
  ───────────────────────────────────────────────────────────── */
  async function _sendTeacherReply(studentUid, studentName) {
    const input = document.getElementById('dmTeacherInput');
    const text  = (input?.value || '').trim();
    if (!text) return;

    const btn = document.getElementById('dmTeacherSendBtn');
    UI.setLoading(btn, true);
    if (input) input.value = '';

    try {
      const batch = Db().batch();

      /* Write the message */
      const msgRef = _threadRef(studentUid).collection('messages').doc();
      batch.set(msgRef, {
        text,
        senderId:   AppConfig.TEACHER_UID,
        senderName: 'Master Timothy',
        role:       'teacher',
        timestamp:  firebase.firestore.FieldValue.serverTimestamp(),
      });

      /* Update thread doc — increment student's unread */
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

  /* Student badge on #dmOpenBtn */
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
        'font-size:.625rem', 'font-weight:700',
        'border-radius:99px', 'display:flex', 'align-items:center',
        'justify-content:center', 'padding:0 4px',
        'pointer-events:none',
        'border:2px solid var(--surface,#fff)', 'line-height:1',
      ].join(';');
      btn.style.position = 'relative';
      btn.appendChild(badge);
    }
  }

  /* Teacher badge on #tab-dm */
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
        'font-size:.625rem', 'font-weight:700',
        'border-radius:99px', 'display:flex', 'align-items:center',
        'justify-content:center', 'padding:0 4px',
        'pointer-events:none',
        'border:2px solid var(--surface,#fff)', 'line-height:1',
      ].join(';');
      btn.style.position = 'relative';
      btn.appendChild(badge);
    }
  }

  /* ══════════════════════════════════════════════════════════
     initStudentDMListener
     ──────────────────────────────────────────────────────────
     Called once after login (from app.js _onLogin student path)
     to keep the student's unread badge live.
     ══════════════════════════════════════════════════════════ */
  function initStudentDMListener(uid) {
    AppState.cancelListener('dmStudentUnread');

    const unsub = _threadRef(uid).onSnapshot(snap => {
      const count = (snap.exists && snap.data().studentUnread) || 0;
      AppState.dmStudentUnread = count;
      _updateStudentBadge(count);
    }, err => console.warn('[dm] Student unread listener error:', err));

    AppState.registerListener('dmStudentUnread', unsub);
  }

  /* ══════════════════════════════════════════════════════════
     initTeacherDMListener
     ──────────────────────────────────────────────────────────
     Called once after teacher login (from app.js _onLogin
     teacher path) to keep the teacher badge live across tabs.
     ══════════════════════════════════════════════════════════ */
  function initTeacherDMListener() {
    AppState.cancelListener('dmTeacherUnread');

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
     cancelListeners — called on logout / navigation
     ══════════════════════════════════════════════════════════ */
  function cancelListeners() {
    AppState.cancelListener('dmStudentMessages');
    AppState.cancelListener('dmTeacherThreads');
    AppState.cancelListener('dmTeacherMessages');
    AppState.cancelListener('dmStudentUnread');
    AppState.cancelListener('dmTeacherUnread');
    _activeStudentUid   = null;
    window._dmActiveUid = null;
  }

  /* ══════════════════════════════════════════════════════════
     Responsive style for the teacher 2-column grid
     ══════════════════════════════════════════════════════════ */
  function _addTeacherGridResponsiveStyle() {
    if (document.getElementById('_dmGridStyle')) return;
    const style = document.createElement('style');
    style.id = '_dmGridStyle';
    style.textContent = `
      @media (max-width:640px) {
        #dmTeacherGrid {
          grid-template-columns: 1fr !important;
        }
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
