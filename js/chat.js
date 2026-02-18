/* ============================================================
   js/chat.js — Public Discussion Chat
   Fixes: unsubscribes old listeners, typing cleanup, lock toggle
   ============================================================ */

(function () {
  'use strict';

  const S  = () => AppState;
  const Db = () => fbDb;

  /* ── Open chat ── */
  async function openPublicChat() {
    const isTeacher = S().userId === AppConfig.TEACHER_UID;
    let chatLocked  = false;

    try {
      const lockSnap = await Db().collection('chatSettings').doc('lock').get();
      chatLocked = lockSnap.exists && lockSnap.data().isLocked;
    } catch (err) {
      console.warn('[Chat] Could not read lock state:', err);
    }

    const canSend = isTeacher || !chatLocked;

    UI.mount(`
      <div class="max-w-4xl mx-auto glass p-8 mt-8 rounded-3xl animate-fadeIn">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-3xl font-bold">Public Discussion Chat</h2>
          <button onclick="Chat.backFromChat()" class="btn bg-gray-500 hover:bg-gray-600 text-lg px-6 py-3">← Back</button>
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
            <button id="lockBtn" onclick="Chat.toggleLock()" class="btn ${chatLocked ? 'bg-green-600' : 'bg-red-600'} text-lg px-8 py-3">
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

      let typingTimer;
      const typingRef = Db().collection('typing').doc(S().userId);
      input.addEventListener('input', () => {
        if (!input.value.trim()) return;
        typingRef.set({
          typing: true,
          name:   isTeacher ? 'Master Timothy' : S().studentData.name
        }).catch(() => {});
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => typingRef.delete().catch(() => {}), 3000);
      });
    }
  }

  /* ── Subscribe to messages ── */
  function _subscribeMessages(canAdmin) {
    const unsub = Db().collection('publicChat')
      .orderBy('timestamp', 'asc')
      .limit(200)
      .onSnapshot(snap => {
        const container = document.getElementById('chatMessages');
        if (!container) { unsub(); return; }

        const msgs = [];
        snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));

        // Pinned messages float to top
        msgs.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

        container.innerHTML = msgs.length === 0
          ? '<p class="text-center opacity-60 py-4">No messages yet. Be the first!</p>'
          : msgs.map(msg => _buildMessageHtml(msg, canAdmin)).join('');

        container.scrollTop = container.scrollHeight;
      }, err => console.error('[Chat] messages error:', err));

    AppState.registerListener('chatMessages', unsub);
  }

  function _buildMessageHtml(msg, canAdmin) {
    const isTeacherMsg = msg.senderName === 'Master Timothy';
    const time = msg.timestamp
      ? new Date(msg.timestamp.toDate ? msg.timestamp.toDate() : msg.timestamp).toLocaleString()
      : 'Just now';

    return `
      <div class="glass-dark p-4 rounded-xl relative ${isTeacherMsg ? 'border-2 border-yellow-400 bg-yellow-50' : ''}">
        ${msg.pinned ? '<span class="absolute top-2 right-10 text-xs font-bold text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">📌 PINNED</span>' : ''}
        ${canAdmin ? `<button onclick="Chat.deleteMessage('${msg.id}')" class="absolute top-2 right-2 text-red-400 hover:text-red-600 text-xl leading-none" title="Delete">×</button>` : ''}
        ${S().userId === AppConfig.TEACHER_UID ? `<button onclick="Chat.togglePin('${msg.id}')" class="absolute top-2 right-8 text-yellow-400 hover:text-yellow-600 text-lg leading-none" title="Pin">📌</button>` : ''}

        <p class="font-bold text-sm">
          ${_esc(msg.senderName)}
          ${msg.senderClass ? `<span class="font-normal opacity-60">(${_esc(msg.senderClass)})</span>` : ''}
        </p>
        ${msg.replyTo ? `<p class="text-xs opacity-60 ml-3 mt-1">↳ Replying to ${_esc(msg.replyTo.name)}: ${_esc(msg.replyTo.text)}</p>` : ''}
        <p class="mt-1">${_esc(msg.text)}</p>
        <div class="flex justify-between items-center mt-2">
          <p class="text-xs opacity-50">${time}</p>
          <button onclick="Chat.setReplyTo('${msg.id}')" class="text-xs text-purple-600 underline hover:text-purple-800">Reply</button>
        </div>
      </div>`;
  }

  /* ── Subscribe to typing indicators ── */
  function _subscribeTyping() {
    const unsub = Db().collection('typing').onSnapshot(snap => {
      const el = document.getElementById('typingIndicator');
      if (!el) { unsub(); return; }
      const names = [];
      snap.forEach(doc => {
        if (doc.id !== S().userId && doc.data().typing) names.push(doc.data().name);
      });
      el.textContent = names.length > 0
        ? `${names.join(', ')} ${names.length > 1 ? 'are' : 'is'} typing...`
        : '';
    }, err => console.error('[Chat] typing error:', err));

    AppState.registerListener('chatTyping', unsub);
  }

  /* ── Send message ── */
  async function sendMessage() {
    const input = document.getElementById('chatInput');
    const text  = (input?.value || '').trim();
    if (!text) return;

    const isTeacher = S().userId === AppConfig.TEACHER_UID;
    try {
      await Db().collection('publicChat').add({
        text,
        senderName:  isTeacher ? 'Master Timothy' : S().studentData.name,
        senderClass: isTeacher ? '' : (S().studentData.class || ''),
        timestamp:   firebase.firestore.FieldValue.serverTimestamp(),
        replyTo:     S().replyingTo || null,
        pinned:      false
      });
      if (input) input.value = '';
      cancelReply();
      // Clear typing indicator
      Db().collection('typing').doc(S().userId).delete().catch(() => {});
    } catch (err) {
      console.error('[Chat] send error:', err);
      UI.toast('Failed to send message.', 'error');
    }
  }

  /* ── Reply ── */
  async function setReplyTo(msgId) {
    try {
      const snap = await Db().collection('publicChat').doc(msgId).get();
      if (!snap.exists) return;
      const data = snap.data();
      S().replyingTo = { name: data.senderName, text: data.text };

      const preview  = document.getElementById('replyPreview');
      const nameEl   = document.getElementById('replyName');
      const textEl   = document.getElementById('replyText');
      if (preview && nameEl && textEl) {
        nameEl.textContent = data.senderName;
        textEl.textContent = data.text.substring(0, 80) + (data.text.length > 80 ? '...' : '');
        preview.classList.remove('hidden');
      }
    } catch (err) {
      console.error('[Chat] setReplyTo error:', err);
    }
  }

  function cancelReply() {
    S().replyingTo = null;
    const preview = document.getElementById('replyPreview');
    if (preview) preview.classList.add('hidden');
  }

  /* ── Admin actions ── */
  async function deleteMessage(id) {
    const ok = await UI.confirmAction('Delete this message?');
    if (!ok) return;
    await Db().collection('publicChat').doc(id).delete().catch(err => {
      console.error('[Chat] delete error:', err);
      UI.toast('Failed to delete message.', 'error');
    });
  }

  async function togglePin(id) {
    try {
      const snap = await Db().collection('publicChat').doc(id).get();
      if (!snap.exists) return;
      await snap.ref.update({ pinned: !snap.data().pinned });
    } catch (err) {
      console.error('[Chat] togglePin error:', err);
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
      openPublicChat();
    } catch (err) {
      console.error('[Chat] toggleLock error:', err);
      UI.toast('Failed to toggle lock.', 'error');
    }
  }

  /* ── Back from chat ── */
  function backFromChat() {
    // Clear typing
    Db().collection('typing').doc(S().userId).delete().catch(() => {});
    AppState.cancelListener('chatMessages');
    AppState.cancelListener('chatTyping');
    S().replyingTo = null;

    if (S().isTeacher) {
      Teacher.render();
    } else if (S().exam?.step === 'exam') {
      Exam.renderExam();
    } else {
      Exam.renderSubjectSelection();
    }
  }

  /* ── HTML escape ── */
  function _esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Expose ── */
  window.Chat = {
    openPublicChat,
    sendMessage,
    setReplyTo,
    cancelReply,
    deleteMessage,
    togglePin,
    toggleLock,
    backFromChat
  };

})();