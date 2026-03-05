/* ============================================================
   js/chat.js — Public Discussion Chat (UI v2)
   ============================================================
   UI CHANGES:
   - All oversized text classes removed (text-3xl→text-xl etc.)
   - Button sizes normalized to standard .btn height
   - Padding reduced on containers
   - No logic or functional changes

   MENTION SYSTEM FIXES (v3):
   ─────────────────────────────────────────────────────────────
   1. _resolveMentionedUids(): replaced broken non-greedy regex
      with NBSP-delimiter strategy. _insertMention() places a
      \u00A0 (NBSP) right after every inserted name; this file
      now uses that as the authoritative end-of-mention marker.
      Falls back to trimmed-whitespace matching for names typed
      manually without the dropdown.

   2. _renderTextWithMentions(): no longer tries to match names
      with a generic regex on HTML-escaped text. Instead builds
      an escaped-name lookup set and replaces each known @Name
      token individually, matching longest names first to avoid
      prefix collisions (e.g. "Ali" vs "Alice").

   3. _loadStudentRoster(): teacher shortcut now correctly reads
      window.Teacher._msgStudentCache via the getter exported
      in teacher.js, so the teacher never needs an extra fetch.

   NOTIFICATION FIXES (v4):
   ─────────────────────────────────────────────────────────────
   4. _updateChatBadge(): now checks both #chatOpenBtn (student
      view) and #tab-chat (teacher dashboard tab) so the badge
      appears correctly for both roles.

   5. openPublicChat(): removed the !isTeacher guard around the
      notification-clear block so the teacher's unread counter
      is also reset when they open chat.

   6. _ensureTeacherInRoster(): teacher is added as a
      mentionable entry so students can @mention Master Timothy.
      Placed first in the roster so "@M" immediately surfaces
      "Master Timothy" in the dropdown.
   ─────────────────────────────────────────────────────────────
   ============================================================ */

(function () {
  'use strict';

// ── Mention system state ──────────────────────────────────
let _studentRoster   = [];   // [{ id, name, cls }] — all students + teacher for @mention
let _mentionActive   = false;
let _mentionQuery    = '';
let _mentionStartIdx = -1;   // caret position where '@' was typed

/* ─────────────────────────────────────────────────────────────
   _loadStudentRoster
   Populates _studentRoster with all students plus the teacher
   entry. In teacher view reuses the already-loaded cache from
   teacher.js (exposed via getter) to avoid a second fetch.
   ───────────────────────────────────────────────────────────── */
function _loadStudentRoster() {
  // In teacher view, reuse the already-loaded student cache from teacher.js.
  // Only do this if AppState identifies the current user as the teacher,
  // because for students the cache is always empty (never populated).
  if (AppState.isTeacher &&
      window.Teacher &&
      Array.isArray(window.Teacher._msgStudentCache) &&
      window.Teacher._msgStudentCache.length > 0) {
    _studentRoster = window.Teacher._msgStudentCache.slice();
    _ensureTeacherInRoster();
    return Promise.resolve();
  }

  // If already loaded this session, reuse it.
  if (_studentRoster.length > 0) return Promise.resolve();

  return window.fbDb.collection('students').orderBy('name').get()
    .then(snap => {
      _studentRoster = [];
      snap.forEach(doc => {
        const d = doc.data();
        _studentRoster.push({ id: doc.id, name: d.name || '', cls: d.class || '' });
      });
      _ensureTeacherInRoster();
    })
    .catch(err => console.warn('[chat] Could not load student roster:', err));
}

/* ─────────────────────────────────────────────────────────────
   _ensureTeacherInRoster
   Adds the teacher as a mentionable entry at the front of the
   roster if not already present, so students can @mention
   Master Timothy and he receives a notification badge.
   ───────────────────────────────────────────────────────────── */
function _ensureTeacherInRoster() {
  const alreadyPresent = _studentRoster.some(s => s.id === AppConfig.TEACHER_UID);
  if (!alreadyPresent) {
    _studentRoster.unshift({
      id:   AppConfig.TEACHER_UID,
      name: 'Master Timothy',
      cls:  'Teacher',
    });
  }
}

function _getMentionSuggestions(query) {
  const q = query.toLowerCase();
  return _studentRoster
    .filter(s => s.id !== AppState.userId && s.name.toLowerCase().includes(q))
    .slice(0, 6);
}

function _buildMentionDropdown(suggestions, anchorEl) {
  // Only remove the existing dropdown element — do NOT call _destroyMentionDropdown()
  // because that resets _mentionActive and _mentionStartIdx which were just set
  // by the input handler before this function was called.
  const existing = document.getElementById('mentionDropdown');
  if (existing) existing.remove();

  if (suggestions.length === 0) return;

  const dropdown = document.createElement('div');
  dropdown.id = 'mentionDropdown';
  dropdown.style.cssText = [
    'position:absolute',
    'bottom:calc(100% + 6px)',
    'left:0',
    'right:0',
    'background:var(--surface,#fff)',
    'border:1.5px solid var(--brand-border,#bac8ff)',
    'border-radius:10px',
    'box-shadow:0 4px 20px rgba(0,0,0,.12)',
    'z-index:999',
    'overflow:hidden',
    'max-height:220px',
    'overflow-y:auto',
  ].join(';');

  suggestions.forEach((s, idx) => {
    const item = document.createElement('div');
    item.className = 'mention-item';
    item.dataset.uid  = s.id;
    item.dataset.name = s.name;
    item.dataset.idx  = idx;
    item.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:.625rem',
      'padding:.5rem .875rem',
      'cursor:pointer',
      'border-bottom:1px solid var(--border,#e5e7eb)',
      'transition:background .1s',
    ].join(';');
    item.innerHTML =
      `<div style="width:28px;height:28px;border-radius:50%;background:var(--brand-bg,#edf2ff);` +
      `border:1.5px solid var(--brand-border,#bac8ff);display:flex;align-items:center;` +
      `justify-content:center;flex-shrink:0;font-size:.6875rem;font-weight:700;` +
      `color:var(--brand-text,#3730a3);">${_esc(s.name.charAt(0).toUpperCase())}</div>` +
      `<div style="min-width:0;flex:1;">` +
      `<span style="font-size:.875rem;font-weight:600;color:var(--text-primary,#111827);">` +
      `${_esc(s.name)}</span>` +
      `<span style="font-size:.75rem;color:var(--text-tertiary,#6b7280);margin-left:.375rem;">` +
      `${_esc(s.cls)}</span></div>` +
      `<span style="font-size:.6875rem;color:var(--brand,#3b5bdb);font-weight:600;">@mention</span>`;

    item.addEventListener('mouseenter', () => {
      document.querySelectorAll('.mention-item').forEach(el => el.style.background = '');
      item.style.background = 'var(--brand-bg,#edf2ff)';
    });
    item.addEventListener('mouseleave', () => { item.style.background = ''; });
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      _insertMention(s.id, s.name);
    });

    dropdown.appendChild(item);
  });

  // Highlight first item
  const first = dropdown.querySelector('.mention-item');
  if (first) first.style.background = 'var(--brand-bg,#edf2ff)';

  // Append dropdown to #chatInputWrap (which has position:relative in its
  // inline style), so bottom/left/right coordinates are relative to that row.
  const wrap = document.getElementById('chatInputWrap');
  if (wrap) {
    wrap.appendChild(dropdown);
  } else if (anchorEl) {
    // Fallback: use the closest positioned ancestor
    const wrapper = anchorEl.closest('[style*="position"]') || anchorEl.parentElement;
    if (wrapper) {
      if (!wrapper.style.position) wrapper.style.position = 'relative';
      wrapper.appendChild(dropdown);
    }
  }
}

function _destroyMentionDropdown() {
  const el = document.getElementById('mentionDropdown');
  if (el) el.remove();
  _mentionActive   = false;
  _mentionQuery    = '';
  _mentionStartIdx = -1;
}

function _insertMention(uid, name) {
  const input = document.getElementById('chatInput');
  if (!input) return;

  const val    = input.value;
  const before = val.substring(0, _mentionStartIdx);  // text before '@'
  const after  = val.substring(input.selectionStart); // text after cursor

  // Insert the mention token: @Name followed by a NBSP (\u00A0).
  // The NBSP is the authoritative end-of-mention delimiter used by
  // _resolveMentionedUids() to extract names reliably, including
  // multi-word names like "John Smith".
  input.value = before + '@' + name + '\u00A0' + after;

  // Move caret to right after the inserted mention
  const newPos = before.length + name.length + 2; // '@' + name + NBSP
  input.setSelectionRange(newPos, newPos);

  _destroyMentionDropdown();
  input.focus();
}

function _handleMentionKeydown(e, suggestions) {
  if (!_mentionActive) return false;

  const dropdown = document.getElementById('mentionDropdown');
  if (!dropdown)  return false;
  const items     = [...dropdown.querySelectorAll('.mention-item')];
  const activeIdx = items.findIndex(el => el.style.background !== '');

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = (activeIdx + 1) % items.length;
    items.forEach(el => el.style.background = '');
    items[next].style.background = 'var(--brand-bg,#edf2ff)';
    return true;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = (activeIdx - 1 + items.length) % items.length;
    items.forEach(el => el.style.background = '');
    items[prev].style.background = 'var(--brand-bg,#edf2ff)';
    return true;
  }
  if (e.key === 'Enter' || e.key === 'Tab') {
    const highlighted = items.find(el => el.style.background !== '');
    if (highlighted) {
      e.preventDefault();
      _insertMention(highlighted.dataset.uid, highlighted.dataset.name);
      return true;
    }
  }
  if (e.key === 'Escape') {
    _destroyMentionDropdown();
    return true;
  }
  return false;
}

/* ─────────────────────────────────────────────────────────────
   _resolveMentionedUids
   ─────────────────────────────────────────────────────────────
   Extracts all @-mentioned UIDs (students + teacher) from a
   message string.

   Strategy:
   Primary path — NBSP delimiter (dropdown-inserted mentions):
     _insertMention() always appends \u00A0 after the name, so
     we split on "@" and take everything up to the first \u00A0
     as the name. This handles multi-word names perfectly.

   Fallback path — space delimiter (manually typed @name):
     After NBSP tokens are consumed, any remaining "@word"
     sequences are matched against the roster using a
     whitespace-boundary approach. Single-word-name manual
     mentions still work; multi-word manual entries are an
     unsupported edge case (users should use the dropdown).
   ───────────────────────────────────────────────────────────── */
function _resolveMentionedUids(text) {
  if (!text || _studentRoster.length === 0) return [];

  const mentioned = [];

  // ── Primary: NBSP-terminated mentions (inserted via dropdown) ──
  const nbspParts = text.split('@');
  for (let i = 1; i < nbspParts.length; i++) {
    const part    = nbspParts[i];
    const nbspIdx = part.indexOf('\u00A0');
    if (nbspIdx === -1) continue; // no NBSP — handled by fallback below
    const candidate = part.substring(0, nbspIdx).trim();
    if (!candidate) continue;
    const found = _studentRoster.find(
      s => s.name.toLowerCase() === candidate.toLowerCase()
    );
    if (found && found.id !== AppState.userId && !mentioned.includes(found.id)) {
      mentioned.push(found.id);
    }
  }

  // ── Fallback: space-delimited single-word mentions (manually typed) ──
  const normalized = text.replace(/\u00A0/g, ' ');
  const singleWordRegex = /@(\w+)(?=\s|$)/g;
  let match;
  while ((match = singleWordRegex.exec(normalized)) !== null) {
    const candidate = match[1].trim().toLowerCase();
    const found = _studentRoster.find(
      s => s.name.toLowerCase() === candidate && s.id !== AppState.userId
    );
    if (found && !mentioned.includes(found.id)) {
      mentioned.push(found.id);
    }
  }

  return mentioned;
}

/* ─────────────────────────────────────────────────────────────
   _renderTextWithMentions
   ─────────────────────────────────────────────────────────────
   Renders a stored message string as HTML, wrapping any
   @Name tokens that match known roster entries in a styled
   highlight span. Includes the teacher entry so @Master Timothy
   is highlighted in rendered messages.

   Strategy:
   - Escape the raw text first (security).
   - Build the list of known names sorted longest-first to
     avoid prefix collisions (e.g. "Ali" matching inside
     "Alice"). Escape each name for use inside a regex.
   - Replace "@EscapedName" (followed by whitespace, end of
     string, or the HTML-encoded NBSP &#160;/&nbsp;) with the
     styled span.
   ───────────────────────────────────────────────────────────── */
function _renderTextWithMentions(rawText) {
  if (!rawText) return '';

  // Step 1: HTML-escape the raw text (safe base)
  let escaped = _esc(rawText);

  // Step 2: Build sorted name list (longest first to avoid prefix collisions)
  const knownNames = _studentRoster
    .map(s => s.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (knownNames.length === 0) return escaped;

  // Step 3: Replace each @Name occurrence in the escaped string.
  for (const name of knownNames) {
    const escapedName   = _esc(name);
    const regexSafeName = escapedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const namePattern = new RegExp(
      '@(' + regexSafeName + ')(?=\\s|$|&nbsp;|&#160;|&#xA0;)',
      'gi'
    );

    escaped = escaped.replace(namePattern, (match, captured) => {
      return `<span style="display:inline-block;background:var(--brand-bg,#edf2ff);` +
        `color:var(--brand-text,#3730a3);font-weight:700;border-radius:4px;` +
        `padding:0 4px;font-size:.875em;border:1px solid var(--brand-border,#bac8ff);">` +
        `@${captured}</span>`;
    });
  }

  return escaped;
}

  async function openPublicChat() {
  const isTeacher = AppState.userId === AppConfig.TEACHER_UID;
  let chatLocked  = false;

  // Load student roster for @mentions — awaited so roster is ready before
  // the input listener fires. The chat lock fetch runs in parallel.
  const rosterPromise = _loadStudentRoster();

  // Clear unread notifications for both students AND teacher.
  try {
    await Db().collection('chatNotifications').doc(AppState.userId).set(
      { unread: 0 }, { merge: true }
    );
    AppState.chatUnread = 0;
    _updateChatBadge(0);
  } catch (err) {
    console.warn('[chat] Could not clear notifications:', err);
  }

  try {
    const [lockSnap] = await Promise.all([
      Db().collection('chatSettings').doc('lock').get(),
      rosterPromise,
    ]);
    chatLocked = lockSnap.exists && !!lockSnap.data().isLocked;
  } catch (err) {
    console.warn('[chat] Could not read lock state:', err);
    await rosterPromise.catch(() => {});
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
          <li>• Type <strong>@name</strong> to mention someone</li>
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

      <!-- Input row — position:relative so the dropdown can use bottom:100% -->
      <div style="position:relative;display:flex;gap:.5rem;" id="chatInputWrap">
        <input id="chatInput" type="text"
               placeholder="${canSend ? 'Type a message… use @ to mention someone' : 'Chat is locked'}"
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

    // ── Keydown: handle mention navigation + Enter to send ──
    input.addEventListener('keydown', e => {
      const suggestions = _mentionActive ? _getMentionSuggestions(_mentionQuery) : [];
      const handled = _handleMentionKeydown(e, suggestions);
      if (handled) return;
      if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
    });

    // ── Input: detect @ trigger and update mention dropdown ──
    input.addEventListener('input', () => {
      const val   = input.value;
      const caret = input.selectionStart;

      // Find the last '@' before the caret that isn't preceded by a word char
      let atIdx = -1;
      for (let i = caret - 1; i >= 0; i--) {
        if (val[i] === '@') {
          const before = i > 0 ? val[i - 1] : ' ';
          if (/\s/.test(before) || i === 0) { atIdx = i; break; }
        }
        // Stop scanning if we hit a space (no @ found in this word)
        if (/\s/.test(val[i])) break;
      }

      if (atIdx !== -1) {
        // Always set state BEFORE calling _buildMentionDropdown because
        // _destroyMentionDropdown (called inside) resets these to -1/false.
        _mentionActive   = true;
        _mentionStartIdx = atIdx;
        _mentionQuery    = val.substring(atIdx + 1, caret);
        const suggestions = _getMentionSuggestions(_mentionQuery);
        if (suggestions.length > 0) {
          _buildMentionDropdown(suggestions, input);
        } else {
          // Only remove the dropdown DOM element; preserve tracking state
          // so _mentionStartIdx stays valid for when the user types more.
          const el = document.getElementById('mentionDropdown');
          if (el) el.remove();
        }
      } else {
        _destroyMentionDropdown();
      }

      // Typing indicator
      if (val.trim()) {
        _setTyping(isTeacher);
        clearTimeout(input._typingTimer);
        input._typingTimer = setTimeout(() => _clearTyping(), 4000);
      }
    });

    // Close dropdown if user clicks outside
    document.addEventListener('mousedown', _onOutsideClick);
  }
}

function _onOutsideClick(e) {
  if (!e.target.closest('#mentionDropdown') && !e.target.closest('#chatInput')) {
    _destroyMentionDropdown();
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

  // "mentioned you" badge shown to any user (student or teacher) when their
  // UID appears in mentionedUids.
  const isMentionedMe =
    Array.isArray(msg.mentionedUids) &&
    msg.mentionedUids.includes(AppState.userId);

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

  const mentionBadge = isMentionedMe
    ? `<span style="font-size:.6875rem;font-weight:700;color:var(--brand-text,#3730a3);
                    background:var(--brand-bg,#edf2ff);border:1px solid var(--brand-border,#bac8ff);
                    border-radius:4px;padding:1px 6px;margin-left:.375rem;">mentioned you</span>`
    : '';

  const mentionBorder = isMentionedMe
    ? 'border-color:var(--brand,#3b5bdb);border-left:3px solid var(--brand,#3b5bdb);'
    : '';

  return `
    <div style="position:relative;padding:.625rem .875rem;border-radius:8px;margin-bottom:.375rem;
                background:${isMentionedMe
                  ? 'var(--brand-bg,#edf2ff)'
                  : isTeacherMsg
                    ? 'var(--c-warning-light,#fffbeb)'
                    : 'var(--c-surface,#fff)'};
                border:1px solid ${isTeacherMsg ? 'var(--c-warning,#d97706)' : 'var(--c-border,#e5e7eb)'};
                ${isTeacherMsg ? 'border-left:3px solid var(--c-warning,#d97706);' : ''}
                ${mentionBorder}">
      ${msg.pinned
        ? '<span style="font-size:.6875rem;font-weight:700;color:#d97706;background:#fef3c7;padding:1px 6px;border-radius:4px;display:inline-block;margin-bottom:4px;">PINNED</span><br>'
        : ''}
      ${adminDeleteBtn}
      ${pinBtn}
      <p style="font-size:.8125rem;font-weight:600;color:#111827;margin-bottom:2px;">
        ${_esc(msg.senderName)}
        ${msg.senderClass ? `<span style="font-weight:400;color:#6b7280;">(${_esc(msg.senderClass)})</span>` : ''}
        ${mentionBadge}
      </p>
      ${msg.replyTo
        ? `<p style="font-size:.75rem;color:#9ca3af;margin-bottom:3px;padding-left:8px;border-left:2px solid #e5e7eb;">↳ ${_esc(msg.replyTo.name)}: ${_esc(msg.replyTo.text)}</p>`
        : ''}
      <p style="font-size:.875rem;color:#1f2937;line-height:1.5;">${_renderTextWithMentions(msg.text)}</p>
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

  // Close any open mention dropdown
  _destroyMentionDropdown();

  const isTeacher  = AppState.userId === AppConfig.TEACHER_UID;
  const replyingTo = AppState.replyingTo || null;

  // Resolve @mentioned UIDs BEFORE stripping NBSP — the NBSP is the
  // delimiter used by _resolveMentionedUids() to find multi-word names.
  const mentionedUids = _resolveMentionedUids(text);

  // Clear input and reply state immediately for good UX
  if (input) input.value = '';
  cancelReply();
  _clearTyping();

  // Normalise NBSP → regular space for the stored message text so it
  // displays cleanly in all contexts.
  const storedText = text.replace(/\u00A0/g, ' ');

  try {
    // Step 1: Write the chat message
    await Db().collection('publicChat').add({
      text:          storedText,
      senderName:    isTeacher ? 'Master Timothy' : (AppState.studentData?.name || 'Student'),
      senderClass:   isTeacher ? '' : (AppState.studentData?.class || ''),
      senderId:      AppState.userId,
      timestamp:     firebase.firestore.FieldValue.serverTimestamp(),
      replyTo:       replyingTo,
      pinned:        false,
      mentionedUids: mentionedUids.length > 0 ? mentionedUids : null,
    });

    // Step 2: Send notifications — one write per recipient (reply + mentions combined)
    const notifyUids = new Set(mentionedUids);
    if (replyingTo && replyingTo.senderId && replyingTo.senderId !== AppState.userId) {
      notifyUids.add(replyingTo.senderId);
    }

    if (notifyUids.size > 0) {
      try {
        await Promise.all(
          [...notifyUids].map(uid =>
            Db().collection('chatNotifications').doc(uid).set(
              { unread: firebase.firestore.FieldValue.increment(1) },
              { merge: true }
            )
          )
        );
      } catch (notifErr) {
        console.warn('[chat] Could not write notification(s):', notifErr);
      }
    }

  } catch (err) {
    console.error('[chat] Send error:', err);
    UI.toast('Failed to send message.', 'error');
    // Restore input so user doesn't lose their message
    if (input) input.value = text;
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
        preview.style.display = 'flex';
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
  _destroyMentionDropdown();
  document.removeEventListener('mousedown', _onOutsideClick);
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
/* Works for both roles:
     Student view  → button id="chatOpenBtn"
     Teacher view  → button id="tab-chat"      */
function _updateChatBadge(count) {
  const btn = document.getElementById('chatOpenBtn') ||
              document.getElementById('tab-chat');
  if (!btn) return;

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
  _destroyMentionDropdown,
};

})();
