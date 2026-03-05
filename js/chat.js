/* ============================================================
   js/chat.js — Public Discussion Chat (UI v2)
   ============================================================
   UI CHANGES:
   - All oversized text classes removed (text-3xl→text-xl etc.)
   - Button sizes normalized to standard .btn height
   - Padding reduced on containers
   - No logic or functional changes
   ============================================================ */

(function () {
  'use strict';

  async function openPublicChat() {
  const isTeacher = AppState.userId === AppConfig.TEACHER_UID;
  let chatLocked  = false;

  // Clear this user's unread reply notifications when they open chat
  if (!isTeacher) {
    try {
      await Db().collection('chatNotifications').doc(AppState.userId).set(
        { unread: 0 },
        { merge: true }
      );
      AppState.chatUnread = 0;
      // Remove the badge from the chat button immediately
      _updateChatBadge(0);
    } catch (err) {
      console.warn('[chat] Could not clear notifications:', err);
    }
  }

  try {
    const lockSnap = await Db().collection('chatSettings').doc('lock').get();
    chatLocked = lockSnap.exists && !!lockSnap.data().isLocked;
  } catch (err) {
    console.warn('[chat] Could not read lock state:', err);
  }

  const canSend = isTeacher || !chatLocked;

  UI.mount(`
    <div class="max-w-4xl mx-auto glass animate-fadeIn" style="padding:1.25rem 1.5rem;margin-top:1.25rem;margin-bottom:1.25rem;">

      <!-- Header -->
      <div class="flex justify-between items-center mb-4">
        <h2 class="font-bold" style="font-size:1.1875rem;">Public Discussion Chat</h2>
        <button onclick="Chat.backFromChat()" class="btn bg-gray-500 hover:bg-gray-600" style="font-size:0.8125rem;">
          ← Back
        </button>
      </div>

      <!-- Subtitle -->
      <div class="glass-dark text-center mb-4" style="padding:.625rem 1rem;font-size:.8125rem;color:#4338ca;font-weight:500;">
        For all students — ask questions, discuss, help each other
      </div>

      <!-- Chat rules -->
      <div class="mb-4 border-l-4 border-purple-600 bg-purple-50 rounded-r-lg" style="padding:.75rem 1rem;">
        <h3 class="font-semibold mb-2" style="font-size:.8125rem;">Chat Rules</h3>
        <ul style="font-size:.8125rem;color:#374151;line-height:1.7;">
          <li>• Be respectful and kind</li>
          <li>• No abusive or offensive language</li>
          <li>• Academic questions only</li>
          <li>• Master Timothy may lock chat if needed</li>
        </ul>
      </div>

      ${chatLocked && !isTeacher ? `
        <div class="mb-4 rounded-lg text-center" style="padding:.75rem 1rem;border:1px solid #fca5a5;background:#fef2f2;">
          <p style="font-size:.875rem;font-weight:700;color:#dc2626;">Chat is currently locked</p>
          <p style="font-size:.8125rem;color:#6b7280;margin-top:2px;">You can read messages but not send new ones.</p>
        </div>` : ''}

      ${isTeacher ? `
        <div class="text-center mb-4">
          <button id="lockBtn" onclick="Chat.toggleLock()"
                  class="btn ${chatLocked ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}">
            ${chatLocked ? 'Unlock Chat' : 'Lock Chat'}
          </button>
        </div>` : ''}

      <!-- Messages -->
      <div class="glass-dark mb-3" style="padding:.75rem;border-radius:10px;border:1px solid #e5e7eb;">
        <div id="chatMessages"></div>
      </div>

      <!-- Typing indicator -->
      <div id="typingIndicator" class="text-center mb-2" style="min-height:1rem;font-size:.75rem;color:#9ca3af;font-style:italic;"></div>

      <!-- Reply preview -->
      <div id="replyPreview" class="hidden flex justify-between items-center gap-3 mb-3"
           style="border-radius:8px;">
        <div class="flex-1 min-w-0">
          <strong style="font-size:.8125rem;">Replying to <span id="replyName"></span>:</strong>
          <span id="replyText" class="block truncate" style="font-size:.75rem;color:#6b7280;margin-top:2px;"></span>
        </div>
        <button onclick="Chat.cancelReply()" style="color:#dc2626;font-size:1.25rem;background:none;border:none;cursor:pointer;flex-shrink:0;line-height:1;">×</button>
      </div>

      <!-- Input row -->
      <div class="flex gap-2">
        <input id="chatInput" type="text"
               placeholder="${canSend ? 'Type your message...' : 'Chat is locked'}"
               autocomplete="off"
               style="flex:1;"
               ${canSend ? '' : 'disabled'} />
        <button id="sendBtn" onclick="Chat.sendMessage()"
                class="btn bg-green-600 hover:bg-green-700"
                ${canSend ? '' : 'disabled'}>Send</button>
      </div>
    </div>`);

  _subscribeMessages(isTeacher);
  _subscribeTyping();

  const input = document.getElementById('chatInput');
  if (input && canSend) {
    input.focus();
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
    });

    let typingTimer;
    input.addEventListener('input', () => {
      if (!input.value.trim()) return;
      _setTyping(isTeacher);
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => _clearTyping(), 4000);
    });
  }
}

  /* ── Subscribe to messages ── */
  function _subscribeMessages(isTeacher) {
    AppState.cancelListener('chatMessages');

    const unsub = Db()
      .collection('publicChat')
      .orderBy('timestamp', 'asc')
      .limit(200)
      .onSnapshot(snap => {
        const container = document.getElementById('chatMessages');
        if (!container) {
          AppState.cancelListener('chatMessages');
          return;
        }

        const msgs = [];
        snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
        msgs.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

        container.innerHTML = msgs.length === 0
          ? '<p style="text-align:center;font-size:.8125rem;color:#9ca3af;padding:1rem 0;">No messages yet. Be the first!</p>'
          : msgs.map(msg => _buildMessageHtml(msg, isTeacher)).join('');

        container.scrollTop = container.scrollHeight;
      }, err => console.error('[chat] Messages error:', err));

    AppState.registerListener('chatMessages', unsub);
  }

  function _buildMessageHtml(msg, isTeacher) {
    const isTeacherMsg = msg.senderName === 'Master Timothy';
    const time = msg.timestamp
      ? new Date(msg.timestamp.toDate ? msg.timestamp.toDate() : msg.timestamp).toLocaleString()
      : 'Just now';

    const adminDeleteBtn = isTeacher
      ? `<button class="chat-delete-btn"
                 data-id="${_esc(msg.id)}"
                 style="position:absolute;top:.5rem;right:.5rem;background:none;border:none;
                        color:#f87171;cursor:pointer;font-size:1rem;line-height:1;padding:2px 4px;"
                 title="Delete">×</button>`
      : '';

    const pinBtn = isTeacher
      ? `<button class="chat-pin-btn"
                 data-id="${_esc(msg.id)}"
                 style="position:absolute;top:.5rem;right:1.75rem;background:none;border:none;
                        color:#f59e0b;cursor:pointer;font-size:.75rem;padding:2px 4px;"
                 title="Pin">📌</button>`
      : '';

    const replyBtn = `
      <button class="chat-reply-btn"
              data-id="${_esc(msg.id)}"
              style="font-size:.75rem;color:var(--c-brand,#4f46e5);background:none;border:none;
                     cursor:pointer;text-decoration:underline;">Reply</button>`;

    return `
      <div style="position:relative;padding:.625rem .875rem;border-radius:8px;margin-bottom:.375rem;
                  background:${isTeacherMsg ? 'var(--c-warning-light,#fffbeb)' : 'var(--c-surface,#fff)'};
                  border:1px solid ${isTeacherMsg ? 'var(--c-warning,#d97706)' : 'var(--c-border,#e5e7eb)'};
                  ${isTeacherMsg ? 'border-left:3px solid var(--c-warning,#d97706);' : ''}">
        ${msg.pinned
          ? '<span style="font-size:.6875rem;font-weight:700;color:#d97706;background:#fef3c7;padding:1px 6px;border-radius:4px;display:inline-block;margin-bottom:4px;">PINNED</span><br>'
          : ''}
        ${adminDeleteBtn}
        ${pinBtn}
        <p style="font-size:.8125rem;font-weight:600;color:#111827;margin-bottom:2px;">
          ${_esc(msg.senderName)}
          ${msg.senderClass ? `<span style="font-weight:400;color:#6b7280;">(${_esc(msg.senderClass)})</span>` : ''}
        </p>
        ${msg.replyTo
          ? `<p style="font-size:.75rem;color:#9ca3af;margin-bottom:3px;padding-left:8px;border-left:2px solid #e5e7eb;">↳ ${_esc(msg.replyTo.name)}: ${_esc(msg.replyTo.text)}</p>`
          : ''}
        <p style="font-size:.875rem;color:#1f2937;line-height:1.5;">${_esc(msg.text)}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;">
          <span style="font-size:.6875rem;color:#9ca3af;">${time}</span>
          ${replyBtn}
        </div>
      </div>`;
  }

  /* ── Event delegation ── */
  document.addEventListener('click', e => {
    const deleteBtn = e.target.closest('.chat-delete-btn');
    if (deleteBtn) { deleteMessage(deleteBtn.dataset.id); return; }

    const pinBtn = e.target.closest('.chat-pin-btn');
    if (pinBtn) { togglePin(pinBtn.dataset.id); return; }

    const replyBtn = e.target.closest('.chat-reply-btn');
    if (replyBtn) { setReplyTo(replyBtn.dataset.id); return; }
  });

  /* ── Typing indicators ── */
  let _typingCleanupInterval = null;

  function _subscribeTyping() {
    AppState.cancelListener('chatTyping');
    if (_typingCleanupInterval) {
      clearInterval(_typingCleanupInterval);
      _typingCleanupInterval = null;
    }

    const typingBoardRef = Db().collection('chatSettings').doc('typing');

    const unsub = typingBoardRef.onSnapshot(snap => {
      const el = document.getElementById('typingIndicator');
      if (!el) { AppState.cancelListener('chatTyping'); return; }

      if (!snap.exists) { el.textContent = ''; return; }

      const data  = snap.data() || {};
      const now   = Date.now();
      const names = [];

      Object.entries(data).forEach(([uid, entry]) => {
        if (uid === AppState.userId) return;
        const ts = entry && entry.ts ? entry.ts : 0;
        if (now - ts < 5000 && entry && entry.name) names.push(entry.name);
      });

      el.textContent = names.length > 0
        ? `${names.join(', ')} ${names.length > 1 ? 'are' : 'is'} typing...`
        : '';
    }, err => {
      console.warn('[chat] Typing indicator unavailable:', err.code);
      const el = document.getElementById('typingIndicator');
      if (el) el.textContent = '';
    });

    AppState.registerListener('chatTyping', unsub);
  }

  function _setTyping(isTeacher) {
    const typingBoardRef = Db().collection('chatSettings').doc('typing');
    return typingBoardRef.update({
      [`${AppState.userId}`]: {
        name: isTeacher ? 'Master Timothy' : (AppState.studentData?.name || 'Student'),
        ts:   Date.now()
      }
    }).catch(() => {
      typingBoardRef.set({
        [`${AppState.userId}`]: {
          name: isTeacher ? 'Master Timothy' : (AppState.studentData?.name || 'Student'),
          ts:   Date.now()
        }
      }, { merge: true }).catch(() => {});
    });
  }

  function _clearTyping() {
    Db().collection('chatSettings').doc('typing').update({
      [`${AppState.userId}`]: firebase.firestore.FieldValue.delete()
    }).catch(() => {});
  }

  /* ── Send message ── */
  async function sendMessage() {
  const input = document.getElementById('chatInput');
  const text  = (input?.value || '').trim();
  if (!text) return;

  const isTeacher = AppState.userId === AppConfig.TEACHER_UID;
  const replyingTo = AppState.replyingTo || null;

  // Clear input and reply state immediately for good UX
  if (input) input.value = '';
  cancelReply();
  _clearTyping();

  try {
    // Step 1: Write the chat message
    await Db().collection('publicChat').add({
      text,
      senderName:  isTeacher ? 'Master Timothy' : (AppState.studentData?.name || 'Student'),
      senderClass: isTeacher ? '' : (AppState.studentData?.class || ''),
      senderId:    AppState.userId,
      timestamp:   firebase.firestore.FieldValue.serverTimestamp(),
      replyTo:     replyingTo,
      pinned:      false,
    });

    // Step 2: Notify the person being replied to (separate try/catch
    // so a notification failure never blocks the message from sending)
    if (
      replyingTo &&
      replyingTo.senderId &&
      replyingTo.senderId !== AppState.userId
    ) {
      try {
        const notifRef = Db().collection('chatNotifications').doc(replyingTo.senderId);
        await notifRef.set(
          { unread: firebase.firestore.FieldValue.increment(1) },
          { merge: true }
        );
      } catch (notifErr) {
        // Non-fatal — message already sent; just log the warning
        console.warn('[chat] Could not write notification:', notifErr);
      }
    }

  } catch (err) {
    console.error('[chat] Send error:', err);
    UI.toast('Failed to send message.', 'error');
    // Restore the text so the user doesn't lose it
    if (input) input.value = text;
    // Restore reply state if there was one
    if (replyingTo) {
      AppState.replyingTo = replyingTo;
      const preview = document.getElementById('replyPreview');
      const nameEl  = document.getElementById('replyName');
      const textEl  = document.getElementById('replyText');
      if (preview && nameEl && textEl) {
        nameEl.textContent = replyingTo.name;
        textEl.textContent = replyingTo.text.length > 80
          ? replyingTo.text.substring(0, 80) + '...'
          : replyingTo.text;
        preview.classList.remove('hidden');
      }
    }
  }
}

  /* ── Reply ── */
  async function setReplyTo(msgId) {
  try {
    const snap = await Db().collection('publicChat').doc(msgId).get();
    if (!snap.exists) return;
    const data = snap.data();

    AppState.replyingTo = {
      name:     data.senderName,
      text:     data.text,
      senderId: data.senderId || null,
    };

    const preview = document.getElementById('replyPreview');
    const nameEl  = document.getElementById('replyName');
    const textEl  = document.getElementById('replyText');

    if (preview && nameEl && textEl) {
      nameEl.textContent = data.senderName;
      textEl.textContent = data.text.length > 80
        ? data.text.substring(0, 80) + '...'
        : data.text;

      // Force visible — remove hidden class AND ensure display is set
      preview.classList.remove('hidden');
      preview.style.display = 'flex';
    }

    // Focus the input so the user can type immediately
    const input = document.getElementById('chatInput');
    if (input) input.focus();

  } catch (err) {
    console.error('[chat] setReplyTo error:', err);
  }
}

  function cancelReply() {
  AppState.replyingTo = null;
  const preview = document.getElementById('replyPreview');
  if (preview) {
    preview.classList.add('hidden');
    preview.style.display = '';  // Clear the inline style set by setReplyTo
  }
}

  /* ── Admin actions ── */
  async function deleteMessage(id) {
    if (!id) return;
    const ok = await UI.confirmAction('Delete this message?');
    if (!ok) return;
    try {
      await Db().collection('publicChat').doc(id).delete();
    } catch (err) {
      console.error('[chat] Delete error:', err);
      UI.toast('Failed to delete message.', 'error');
    }
  }

  async function togglePin(id) {
    if (!id) return;
    try {
      const snap = await Db().collection('publicChat').doc(id).get();
      if (!snap.exists) return;
      await snap.ref.update({ pinned: !snap.data().pinned });
    } catch (err) {
      console.error('[chat] togglePin error:', err);
    }
  }

  async function toggleLock() {
    try {
      const ref  = Db().collection('chatSettings').doc('lock');
      const snap = await ref.get();
      if (snap.exists) { await ref.delete(); } else { await ref.set({ isLocked: true }); }
      openPublicChat();
    } catch (err) {
      console.error('[chat] toggleLock error:', err);
      UI.toast('Failed to toggle lock.', 'error');
    }
  }

  /* ── Back from chat ── */
  function backFromChat() {
    _clearTyping();
    AppState.cancelListener('chatMessages');
    AppState.cancelListener('chatTyping');
    AppState.replyingTo = null;

    if (AppState.isTeacher) {
      Teacher.renderTeacherDashboard();
    } else if (AppState.exam && AppState.exam.step === 'exam') {
      Exam.renderExam();
    } else {
      Exam.renderSubjectSelection();
    }
  }

  /* ── Private helpers ── */
  function Db() { return window.fbDb; }

  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

/* ── Chat badge helper ── */
function _updateChatBadge(count) {
  const btn = document.getElementById('chatOpenBtn');
  if (!btn) return;
  // Remove any existing badge
  const existing = btn.querySelector('.chat-notif-badge');
  if (existing) existing.remove();

  if (count > 0) {
    const badge = document.createElement('span');
    badge.className = 'chat-notif-badge';
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.style.cssText = [
      'position:absolute',
      'top:-6px',
      'right:-6px',
      'min-width:18px',
      'height:18px',
      'background:var(--danger,#e03131)',
      'color:#fff',
      'font-size:0.625rem',
      'font-weight:700',
      'border-radius:99px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:0 4px',
      'pointer-events:none',
      'border:2px solid var(--surface,#fff)',
      'line-height:1',
    ].join(';');
    btn.style.position = 'relative';
    btn.appendChild(badge);
  }
}

  /* ── Expose ── */
  window.Chat = {
  openPublicChat,
  open: openPublicChat,
  sendMessage,
  setReplyTo,
  cancelReply,
  deleteMessage,
  togglePin,
  toggleLock,
  backFromChat,
  _updateChatBadge,
};

})();