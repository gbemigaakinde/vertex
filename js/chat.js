/* ============================================================
   js/chat.js — Public Discussion Chat
   ============================================================ */

(function () {
  'use strict';

  /* -------------------------------------------------- */
  /* Open chat                                          */
  /* Can be called from:                                */
  /*   - Student dashboard (replaces app content)       */
  /*   - Teacher dashboard (replaces app content)       */
  /* In both cases UI.mount replaces #app; the Back     */
  /* button re-renders the correct dashboard.           */
  /* -------------------------------------------------- */

  async function openPublicChat() {
    const isTeacher = AppState.userId === AppConfig.TEACHER_UID;
    let chatLocked  = false;

    try {
      const lockSnap = await Db().collection('chatSettings').doc('lock').get();
      chatLocked = lockSnap.exists && !!lockSnap.data().isLocked;
    } catch (err) {
      console.warn('[chat] Could not read lock state:', err);
    }

    const canSend = isTeacher || !chatLocked;

    UI.mount(`
      <div class="max-w-4xl mx-auto glass p-8 mt-8 rounded-3xl animate-fadeIn">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-3xl font-bold">Public Discussion Chat</h2>
          <button onclick="Chat.backFromChat()" class="btn bg-gray-500 hover:bg-gray-600 text-lg px-6 py-3">Back</button>
        </div>

        <div class="glass-dark p-5 rounded-2xl mb-6 text-center">
          <p class="text-lg font-semibold text-purple-700">For all students — ask questions, discuss, help each other</p>
        </div>

        <div class="glass p-5 rounded-2xl mb-6 border-l-4 border-purple-600 bg-purple-50">
          <h3 class="font-bold mb-3">Chat Rules</h3>
          <ul class="space-y-2 text-sm opacity-90">
            <li>• Be respectful and kind</li>
            <li>• No abusive or offensive language</li>
            <li>• Academic questions only</li>
            <li>• Master Timothy may lock chat if needed</li>
          </ul>
        </div>

        ${chatLocked && !isTeacher ? `
          <div class="glass-dark p-5 rounded-2xl mb-6 text-center border border-red-400 bg-red-50">
            <p class="text-xl text-red-600 font-bold">Chat is currently LOCKED</p>
            <p class="text-sm mt-1">You can read messages but not send new ones.</p>
          </div>` : ''}

        ${isTeacher ? `
          <div class="text-center mb-6">
            <button id="lockBtn" onclick="Chat.toggleLock()"
                    class="btn ${chatLocked ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-lg px-8 py-3">
              ${chatLocked ? 'Unlock Chat' : 'Lock Chat'}
            </button>
          </div>` : ''}

        <!-- Messages -->
        <div class="glass-dark p-5 rounded-2xl mb-4 border-2 border-purple-200">
          <div id="chatMessages" class="space-y-3"></div>
        </div>

        <!-- Typing indicator -->
        <div id="typingIndicator" class="text-sm text-center opacity-60 mb-3 min-h-5"></div>

        <!-- Reply preview -->
        <div id="replyPreview" class="hidden glass-dark p-4 rounded-xl mb-3 flex justify-between items-center gap-4">
          <div class="flex-1 min-w-0">
            <strong>Replying to <span id="replyName"></span>:</strong>
            <span id="replyText" class="block truncate text-sm opacity-70 mt-1"></span>
          </div>
          <button onclick="Chat.cancelReply()" class="text-red-500 text-2xl flex-shrink-0">×</button>
        </div>

        <!-- Input -->
        <div class="flex gap-3">
          <input id="chatInput" type="text"
                 placeholder="${canSend ? 'Type your message...' : 'Chat is locked'}"
                 class="flex-1"
                 autocomplete="off"
                 ${canSend ? '' : 'disabled'} />
          <button id="sendBtn" onclick="Chat.sendMessage()"
                  class="btn bg-green-600 hover:bg-green-700 text-lg px-6"
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

      const typingRef = Db().collection('typing').doc(AppState.userId);
      let typingTimer;

      input.addEventListener('input', () => {
        if (!input.value.trim()) return;
        typingRef.set({
          typing: true,
          name:   isTeacher ? 'Master Timothy' : (AppState.studentData?.name || 'Student')
        }).catch(() => {});
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => typingRef.delete().catch(() => {}), 3000);
      });
    }
  }

  /* -------------------------------------------------- */
  /* Subscribe to messages                              */
  /* -------------------------------------------------- */

  function _subscribeMessages(isTeacher) {
    // Cancel previous listener before re-subscribing
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

        // Pinned messages float to top, otherwise timestamp order is preserved
        msgs.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

        container.innerHTML = msgs.length === 0
          ? '<p class="text-center opacity-60 py-4">No messages yet. Be the first!</p>'
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

    // Admin buttons use data attributes to avoid JS-string-in-HTML escaping issues
    const adminDeleteBtn = isTeacher
      ? `<button class="chat-delete-btn absolute top-2 right-2 text-red-400 hover:text-red-600 text-xl leading-none"
                 data-id="${_esc(msg.id)}" title="Delete">×</button>`
      : '';

    const pinBtn = isTeacher
      ? `<button class="chat-pin-btn absolute top-2 right-8 text-yellow-400 hover:text-yellow-600 text-lg leading-none"
                 data-id="${_esc(msg.id)}" title="Pin">P</button>`
      : '';

    const replyBtn = `
      <button class="chat-reply-btn text-xs text-purple-600 underline hover:text-purple-800"
              data-id="${_esc(msg.id)}">Reply</button>`;

    return `
      <div class="glass-dark p-4 rounded-xl relative ${isTeacherMsg ? 'border-2 border-yellow-400 bg-yellow-50' : ''}">
        ${msg.pinned ? '<span class="absolute top-2 left-3 text-xs font-bold text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">PINNED</span>' : ''}
        ${adminDeleteBtn}
        ${pinBtn}
        <p class="font-bold text-sm ${msg.pinned ? 'mt-5' : ''}">
          ${_esc(msg.senderName)}
          ${msg.senderClass ? `<span class="font-normal opacity-60">(${_esc(msg.senderClass)})</span>` : ''}
        </p>
        ${msg.replyTo ? `<p class="text-xs opacity-60 ml-3 mt-1">Replying to ${_esc(msg.replyTo.name)}: ${_esc(msg.replyTo.text)}</p>` : ''}
        <p class="mt-1">${_esc(msg.text)}</p>
        <div class="flex justify-between items-center mt-2">
          <p class="text-xs opacity-50">${time}</p>
          ${replyBtn}
        </div>
      </div>`;
  }

  /* ── Event delegation for chat message actions ── */
  // Attached once on the container rather than inline on every message button
  document.addEventListener('click', e => {
    const deleteBtn = e.target.closest('.chat-delete-btn');
    if (deleteBtn) { deleteMessage(deleteBtn.dataset.id); return; }

    const pinBtn = e.target.closest('.chat-pin-btn');
    if (pinBtn) { togglePin(pinBtn.dataset.id); return; }

    const replyBtn = e.target.closest('.chat-reply-btn');
    if (replyBtn) { setReplyTo(replyBtn.dataset.id); return; }
  });

  /* -------------------------------------------------- */
  /* Subscribe to typing indicators                     */
  /* -------------------------------------------------- */

  function _subscribeTyping() {
    AppState.cancelListener('chatTyping');

    const unsub = Db().collection('typing').onSnapshot(snap => {
      const el = document.getElementById('typingIndicator');
      if (!el) {
        AppState.cancelListener('chatTyping');
        return;
      }
      const names = [];
      snap.forEach(doc => {
        if (doc.id !== AppState.userId && doc.data().typing) {
          names.push(doc.data().name);
        }
      });
      el.textContent = names.length > 0
        ? `${names.join(', ')} ${names.length > 1 ? 'are' : 'is'} typing...`
        : '';
    }, err => console.error('[chat] Typing error:', err));

    AppState.registerListener('chatTyping', unsub);
  }

  /* -------------------------------------------------- */
  /* Send message                                       */
  /* -------------------------------------------------- */

  async function sendMessage() {
    const input     = document.getElementById('chatInput');
    const text      = (input?.value || '').trim();
    if (!text) return;

    const isTeacher = AppState.userId === AppConfig.TEACHER_UID;

    try {
      await Db().collection('publicChat').add({
        text,
        senderName:  isTeacher ? 'Master Timothy' : (AppState.studentData?.name || 'Student'),
        senderClass: isTeacher ? '' : (AppState.studentData?.class || ''),
        timestamp:   firebase.firestore.FieldValue.serverTimestamp(),
        replyTo:     AppState.replyingTo || null,
        pinned:      false
      });

      if (input) input.value = '';
      cancelReply();
      Db().collection('typing').doc(AppState.userId).delete().catch(() => {});
    } catch (err) {
      console.error('[chat] Send error:', err);
      UI.toast('Failed to send message.', 'error');
    }
  }

  /* -------------------------------------------------- */
  /* Reply                                              */
  /* -------------------------------------------------- */

  async function setReplyTo(msgId) {
    try {
      const snap = await Db().collection('publicChat').doc(msgId).get();
      if (!snap.exists) return;
      const data = snap.data();
      AppState.replyingTo = { name: data.senderName, text: data.text };

      const preview = document.getElementById('replyPreview');
      const nameEl  = document.getElementById('replyName');
      const textEl  = document.getElementById('replyText');
      if (preview && nameEl && textEl) {
        nameEl.textContent = data.senderName;
        textEl.textContent = data.text.length > 80 ? data.text.substring(0, 80) + '...' : data.text;
        preview.classList.remove('hidden');
      }
    } catch (err) {
      console.error('[chat] setReplyTo error:', err);
    }
  }

  function cancelReply() {
    AppState.replyingTo = null;
    const preview = document.getElementById('replyPreview');
    if (preview) preview.classList.add('hidden');
  }

  /* -------------------------------------------------- */
  /* Admin actions                                      */
  /* -------------------------------------------------- */

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
      if (snap.exists) {
        await ref.delete();
      } else {
        await ref.set({ isLocked: true });
      }
      // Re-render chat to update lock UI
      openPublicChat();
    } catch (err) {
      console.error('[chat] toggleLock error:', err);
      UI.toast('Failed to toggle lock.', 'error');
    }
  }

  /* -------------------------------------------------- */
  /* Back from chat                                     */
  /* -------------------------------------------------- */

  function backFromChat() {
    // Clear typing indicator for this user
    Db().collection('typing').doc(AppState.userId).delete().catch(() => {});

    // Cancel chat-specific listeners
    AppState.cancelListener('chatMessages');
    AppState.cancelListener('chatTyping');
    AppState.replyingTo = null;

    // Route back to the correct dashboard
    if (AppState.isTeacher) {
      Teacher.renderTeacherDashboard();
    } else if (AppState.exam && AppState.exam.step === 'exam') {
      Exam.renderExam();
    } else {
      Exam.renderSubjectSelection();
    }
  }

  /* -------------------------------------------------- */
  /* Private helpers                                    */
  /* -------------------------------------------------- */

  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* -------------------------------------------------- */
  /* Expose                                             */
  /* open() is an alias for openPublicChat() so that    */
  /* any remaining legacy callers do not hard-error.    */
  /* -------------------------------------------------- */

  window.Chat = {
    openPublicChat,
    open: openPublicChat,    // alias — keeps old call sites working
    sendMessage,
    setReplyTo,
    cancelReply,
    deleteMessage,
    togglePin,
    toggleLock,
    backFromChat,
  };

})();