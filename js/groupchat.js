/* ============================================================
   js/groupchat.js — Group Chat System
   ============================================================
 */

(function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────────── */
  const TEACHER_UID = () => window.AppConfig && AppConfig.TEACHER_UID;
  const Db          = () => window.fbDb;

  /* ── Module state ──────────────────────────────────────── */
  let _activeGroupId      = null;
  let _activeGroupData    = null;
  let _replyTo            = null;
  let _stylesInjected     = false;
  
  /* ── Presence (group members) ──────────────────────────────── */
  const PRESENCE_HEARTBEAT_MS        = 20000;
  const PRESENCE_ONLINE_THRESHOLD_MS = 55000;

  let _presenceHeartbeatHandle     = null;
  let _presenceVisibilityHandler   = null;
  let _presenceBeforeunloadHandler = null;
  let _presenceOfflineDone         = false;
  let _myPresenceUid               = null;

  let _memberPresenceUnsubs  = {}; // { uid: unsubFn } — for the currently open group's members
  let _memberPresenceCache   = {}; // { uid: {lastSeen, isOnline} } — latest snapshot per member

  /* ── Typing indicator state ────────────────────────────── */
  let _typingDebounce     = null;
  let _typingActive       = false;
  let _typingGroupId      = null;

  /* ── Listeners ─────────────────────────────────────────── */
  const _listeners = {};

  function _reg(key, unsub) {
    if (typeof _listeners[key] === 'function') _listeners[key]();
    _listeners[key] = unsub;
  }

  function _cancel(key) {
    if (typeof _listeners[key] === 'function') {
      _listeners[key]();
      delete _listeners[key];
    }
  }

  /* ── Escape helpers ────────────────────────────────────── */
  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _escAttr(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /* ── Date helpers ──────────────────────────────────────── */
  function _dayKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }

  function _dateLabelFor(date) {
    const now       = new Date();
    const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const msgDay    = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (msgDay.getTime() === today.getTime())     return 'Today';
    if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
    return date.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
  }

  function _timeStr(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
  }

  /* ── Word filter ───────────────────────────────────────── */
  function _isBannedWord(text, bannedWords) {
    if (!bannedWords || bannedWords.length === 0) return false;
    const lower = text.toLowerCase();
    return bannedWords.some(w => {
      if (!w || !w.trim()) return false;
      const escaped = w.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp('\\b' + escaped + '\\b').test(lower);
    });
  }

  function _findBannedWord(text, bannedWords) {
    if (!bannedWords || bannedWords.length === 0) return null;
    const lower = text.toLowerCase();
    for (const w of bannedWords) {
      if (!w || !w.trim()) continue;
      const escaped = w.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp('\\b' + escaped + '\\b').test(lower)) return w.trim();
    }
    return null;
  }

  /* ── CSS injection ─────────────────────────────────────── */
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const s = document.createElement('style');
    s.id = '_gcStyles';
    s.textContent = `
      .gc-group-item {
        display:flex;align-items:flex-start;gap:.75rem;padding:.75rem 1rem;
        cursor:pointer;border-bottom:1px solid var(--border);
        background:transparent;transition:background .12s;
        box-sizing:border-box;width:100%;
      }
      .gc-group-item:hover { background:var(--bg-subtle); }
      .gc-group-item.is-active { background:var(--accent-subtle); }
      .gc-group-item:last-child { border-bottom:none; }

      .gc-group-av {
        flex-shrink:0;width:42px;height:42px;border-radius:50%;
        background:var(--accent-subtle);border:1.5px solid var(--accent-border);
        display:flex;align-items:center;justify-content:center;
        font-size:.9375rem;font-weight:700;color:var(--accent-text);
      }
      .gc-group-name {
        font-size:.875rem;font-weight:700;color:var(--text-1);
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;
      }
      .gc-group-preview {
        font-size:.8125rem;color:var(--text-3);
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;
      }
      .gc-group-date {
        font-size:.6875rem;color:var(--text-4);flex-shrink:0;white-space:nowrap;
      }
      .gc-badge {
        flex-shrink:0;min-width:20px;height:20px;border-radius:99px;
        background:var(--danger);color:#fff;font-size:.625rem;font-weight:700;
        display:flex;align-items:center;justify-content:center;padding:0 5px;line-height:1;
      }
      .gc-msg-wrap { width:100%;box-sizing:border-box; }
      .gc-msg-out  { width:100%;box-sizing:border-box; }
      .gc-msg-in   { width:100%;box-sizing:border-box; }

      .gc-bubble-row { display:flex;width:100%;box-sizing:border-box; }
      .gc-msg-out .gc-bubble-row { justify-content:flex-end;padding-left:20%; }
      .gc-msg-in  .gc-bubble-row { justify-content:flex-start;padding-right:20%; }

      .gc-bubble {
        position:relative;box-sizing:border-box;
        word-break:break-word;overflow-wrap:break-word;max-width:100%;min-width:0;
      }
      .gc-bubble-text {
        font-size:.9375rem;line-height:1.5;
        white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;margin:0;
      }
      .gc-bubble-footer {
        display:flex;align-items:center;gap:3px;margin-top:2px;
      }
      .gc-bubble-footer--end   { justify-content:flex-end; }
      .gc-bubble-footer--start { justify-content:flex-start; }
      .gc-bubble-time { font-size:.625rem;opacity:.7;line-height:1;white-space:nowrap;flex-shrink:0; }

      .gc-date-sep {
        display:flex;align-items:center;gap:.625rem;margin:.875rem 0 .625rem;user-select:none;
      }
      .gc-date-sep__line { flex:1;height:1px;background:var(--border); }
      .gc-date-sep__label {
        font-size:.625rem;font-weight:600;letter-spacing:.04em;color:var(--text-4);
        white-space:nowrap;padding:2px 8px;border-radius:99px;
        background:var(--bg-subtle);border:1px solid var(--border);
      }

      .gc-swipe-wrap {
        position:relative;width:100%;max-width:100%;min-width:0;
        box-sizing:border-box;touch-action:pan-y;
      }
      .gc-swipe-inner {
        width:100%;box-sizing:border-box;
        transition:transform .2s ease;will-change:transform;
      }

      .gc-reply-card {
        display:block;margin-bottom:.375rem;padding:.3rem .5rem;
        border-left:3px solid rgba(255,255,255,.5);border-radius:0 5px 5px 0;
        background:rgba(0,0,0,.12);cursor:pointer;
        font-size:.75rem;line-height:1.4;width:100%;box-sizing:border-box;overflow:hidden;
      }
      .gc-msg-in .gc-reply-card {
        border-left-color:var(--accent);
        background:var(--accent-subtle);
      }
      .gc-reply-card__name {
        font-weight:700;display:block;margin-bottom:1px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      }
      .gc-msg-out .gc-reply-card__name { color:rgba(255,255,255,.9); }
      .gc-msg-in  .gc-reply-card__name { color:var(--accent-text); }
      .gc-reply-card__text {
        display:block;opacity:.8;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      }

      .gc-reply-bar {
        display:none;align-items:center;gap:.5rem;
        padding:.375rem .625rem;margin:.375rem 0 0;
        background:var(--accent-subtle);
        border-left:3px solid var(--accent);border-radius:0 6px 6px 0;
        font-size:.75rem;color:var(--text-2);
        box-sizing:border-box;width:100%;overflow:hidden;
      }
      .gc-reply-bar.visible { display:flex; }
      .gc-reply-bar__name { font-weight:700;color:var(--accent-text);white-space:nowrap;flex-shrink:0; }
      .gc-reply-bar__text { white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;opacity:.8; }
      .gc-reply-bar__close {
        flex-shrink:0;background:none;border:none;cursor:pointer;
        padding:0;line-height:1;color:var(--text-4);display:flex;align-items:center;
      }
      .gc-reply-bar__close:hover { color:var(--text-2); }

      .gc-event-row {
        text-align:center;padding:.375rem 1rem;
        font-size:.6875rem;color:var(--text-4);font-style:italic;user-select:none;
      }

      .gc-muted-banner {
        background:var(--warning-subtle);border:1px solid var(--warning-border);
        border-radius:var(--r-md);padding:.5rem .75rem;
        font-size:.8125rem;color:var(--warning-text);text-align:center;
        font-weight:500;margin-top:.5rem;
      }

      .gc-modal-overlay {
        position:fixed;inset:0;background:rgba(0,0,0,.48);
        display:flex;align-items:center;justify-content:center;
        z-index:10000;padding:1rem;
        animation:gcFadeIn .15s ease both;box-sizing:border-box;
      }
      .gc-modal {
        background:var(--bg-base);border:1px solid var(--border);
        border-radius:14px;width:min(480px,95vw);
        box-shadow:0 20px 60px rgba(0,0,0,.2);box-sizing:border-box;
        max-height:90vh;display:flex;flex-direction:column;overflow:hidden;
      }
      .gc-modal-header {
        display:flex;align-items:center;justify-content:space-between;
        padding:.875rem 1.25rem;border-bottom:1px solid var(--border);flex-shrink:0;
      }
      .gc-modal-body {
        overflow-y:auto;padding:1rem 1.25rem;flex:1;
        display:flex;flex-direction:column;gap:.75rem;
      }
      .gc-modal-footer {
        padding:.875rem 1.25rem;border-top:1px solid var(--border);
        display:flex;gap:.5rem;flex-shrink:0;
      }

      @keyframes gcFadeIn { from{opacity:0} to{opacity:1} }

      .gc-member-row {
        display:flex;align-items:center;gap:.625rem;padding:.5rem .75rem;
        border:1px solid var(--border);border-radius:8px;background:var(--bg-base);
      }
      .gc-member-av {
        width:30px;height:30px;border-radius:50%;flex-shrink:0;
        background:var(--accent-subtle);border:1.5px solid var(--accent-border);
        display:flex;align-items:center;justify-content:center;
        font-size:.75rem;font-weight:700;color:var(--accent-text);
      }
      .gc-member-name {
        font-size:.875rem;font-weight:600;color:var(--text-1);flex:1;min-width:0;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      }
      .gc-member-cls {
        font-size:.6875rem;color:var(--text-3);flex-shrink:0;
      }
      .gc-member-muted-badge {
        font-size:.5625rem;font-weight:700;padding:1px 6px;border-radius:99px;
        background:var(--warning-subtle);color:var(--warning-text);
        border:1px solid var(--warning-border);flex-shrink:0;
      }

      .gc-messages-area {
        overflow-y:auto;overflow-x:hidden;box-sizing:border-box;width:100%;
      }
      .gc-typing-bar {
        display:none;align-items:center;height:0;
        padding:0 .875rem;background:var(--bg-base);transition:height .15s;
      }

      .gc-action-menu {
        position:fixed;z-index:9999;background:var(--bg-base);
        border:1px solid var(--border);border-radius:8px;
        box-shadow:0 6px 20px rgba(0,0,0,.12);min-width:148px;overflow:hidden;
        animation:gcFadeIn .1s ease;
      }
      .gc-action-menu-item {
        display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;
        font-size:.8125rem;color:var(--text-1);cursor:pointer;
        transition:background .1s;white-space:nowrap;
        border:none;background:none;width:100%;text-align:left;font-family:var(--font);
      }
      .gc-action-menu-item:hover { background:var(--bg-subtle); }
      .gc-action-menu-item + .gc-action-menu-item { border-top:1px solid var(--border); }
      .gc-action-menu-item.danger { color:var(--danger); }

      /* ── Edit UI ── */
      .gc-edit-trigger-btn {
        background:none;border:none;cursor:pointer;padding:0 0 0 4px;
        display:inline-flex;align-items:center;opacity:0;transition:opacity .15s;
        flex-shrink:0;line-height:1;vertical-align:middle;
      }
      .gc-bubble:hover .gc-edit-trigger-btn,
      .gc-bubble.menu-open .gc-edit-trigger-btn { opacity:1 !important; }
      @media (hover:none) { .gc-edit-trigger-btn { opacity:.45 !important; } }

      .gc-edited-label {
        font-size:.5625rem;opacity:.6;font-style:italic;margin-right:3px;
        line-height:1;white-space:nowrap;
      }

      .gc-edit-textarea {
        width:100%;resize:none;overflow-y:hidden;line-height:1.55;
        font-size:.875rem;font-family:var(--font);padding:.375rem .5rem;
        border-radius:6px;outline:none;
        min-height:2.4rem;box-sizing:border-box;
      }
      .gc-edit-actions { display:flex;gap:.375rem;margin-top:.375rem;justify-content:flex-end; }
      .gc-edit-btn {
        font-size:.6875rem;font-weight:600;padding:3px 11px;border-radius:5px;
        border:none;cursor:pointer;font-family:var(--font);
      }
      .gc-edit-btn--save-dark   { background:#fff;color:var(--accent); }
      .gc-edit-btn--cancel-dark { background:rgba(255,255,255,.2);color:inherit;opacity:.75; }
      .gc-edit-btn--save-light  { background:var(--accent);color:#fff; }
      .gc-edit-btn--cancel-light { background:var(--bg-subtle);color:var(--text-2);border:1px solid var(--border); }

      .gc-history-overlay {
        position:fixed;inset:0;background:rgba(0,0,0,.5);
        display:flex;align-items:center;justify-content:center;
        z-index:10001;padding:1rem;animation:gcFadeIn .15s ease;box-sizing:border-box;
      }
      .gc-history-modal {
        background:var(--bg-base);border-radius:12px;
        width:min(460px,96vw);max-height:80vh;display:flex;flex-direction:column;
        box-shadow:0 20px 60px rgba(0,0,0,.22);border:1px solid var(--border);box-sizing:border-box;
      }
      .gc-history-header {
        display:flex;align-items:center;justify-content:space-between;
        padding:.875rem 1.125rem;border-bottom:1px solid var(--border);flex-shrink:0;
      }
      .gc-history-body {
        overflow-y:auto;padding:.75rem 1rem;flex:1;display:flex;flex-direction:column;gap:.625rem;
      }
      .gc-history-entry {
        padding:.625rem .875rem;border-radius:8px;
        border:1px solid var(--border);background:var(--bg-subtle);
      }
      .gc-history-entry p {
        font-size:.875rem;line-height:1.55;color:var(--text-1);
        white-space:pre-wrap;word-break:break-word;margin:0;
      }
      .gc-history-entry time {
        display:block;font-size:.625rem;color:var(--text-4);margin-top:.25rem;
      }
      .gc-history-current {
        background:var(--accent-subtle);border-color:var(--accent-border);
      }
      .gc-history-current p { font-weight:500; }

      [data-theme="dark"] .gc-modal { background:var(--bg-subtle); }
      [data-theme="dark"] .gc-history-modal { background:var(--bg-subtle); }
    `;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════
     STUDENT ENTRY POINT — open group list for a student
  ══════════════════════════════════════════════════════ */
  async function openForStudent() {
    _injectStyles();
    const uid = AppState.userId;

    UI.mount(`
      <div class="max-w-2xl mx-auto glass animate-fadeIn"
           style="padding:1.25rem 1.5rem;margin-top:1.25rem;margin-bottom:1.25rem;
                  box-sizing:border-box;width:100%;max-width:100%;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <h2 class="font-bold" style="font-size:1.125rem;">Group Chats</h2>
          <button onclick="GroupChat._backFromStudent()" class="btn bg-gray-500" style="font-size:.8125rem;">
            ← Back
          </button>
        </div>
        <div id="gcStudentGroupList" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;">
          <p style="text-align:center;padding:2rem;font-size:.8125rem;color:var(--text-4);">
            Loading groups…
          </p>
        </div>
      </div>`);

    _subscribeStudentGroupList(uid);
  }

  function _backFromStudent() {
    _cancel('gcStudentGroups');
    _cancelActiveChat();
    AppState.replyingTo = null;
    _replyTo = null;
    if (AppState.exam && AppState.exam.step === 'exam') {
      Exam.renderExam();
    } else {
      Exam.renderSubjectSelection();
    }
  }

  function _subscribeStudentGroupList(uid) {
    _cancel('gcStudentGroups');

    const unsub = Db()
      .collection('groupChats')
      .where('memberUids', 'array-contains', uid)
      .orderBy('lastAt', 'desc')
      .onSnapshot(snap => {
        const list = document.getElementById('gcStudentGroupList');
        if (!list) { _cancel('gcStudentGroups'); return; }

        if (snap.empty) {
          list.innerHTML = `
            <div style="text-align:center;padding:2.5rem 1.5rem;">
              <div style="font-size:2rem;margin-bottom:.75rem;">💬</div>
              <p style="font-size:.9375rem;font-weight:600;color:var(--text-1);margin-bottom:.375rem;">
                No group chats for you yet
              </p>
              <p style="font-size:.8125rem;color:var(--text-3);line-height:1.6;">
                You haven't been added to any group chats yet.<br>
                Contact Master Timothy to create a group chat for you and your friends.
              </p>
            </div>`;
          return;
        }

        let html = '';
        snap.forEach(doc => {
          const g    = doc.data();
          const gid  = doc.id;
          const unrd = (g.unread && g.unread[uid]) || 0;
          const ts   = g.lastAt
            ? new Date(g.lastAt.toDate ? g.lastAt.toDate() : g.lastAt)
                .toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
            : '';
          const letter = (g.name || '?').charAt(0).toUpperCase();
          html += `
            <div class="gc-group-item" onclick="GroupChat._openStudentChat('${_escAttr(gid)}')">
              <div class="gc-group-av">${_esc(letter)}</div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:.375rem;margin-bottom:1px;">
                  <span class="gc-group-name">${_esc(g.name || 'Unnamed Group')}</span>
                  <span class="gc-group-date">${_esc(ts)}</span>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:.375rem;">
                  <span class="gc-group-preview">
                    ${g.lastMessageSenderName ? `<strong>${_esc(g.lastMessageSenderName)}:</strong> ` : ''}
                    ${_esc(g.lastMessage || 'No messages yet')}
                  </span>
                  ${unrd > 0 ? `<span class="gc-badge">${unrd > 9 ? '9+' : unrd}</span>` : ''}
                </div>
                <div style="font-size:.6875rem;color:var(--text-4);margin-top:2px;">
                  ${g.members ? g.members.length + ' member' + (g.members.length !== 1 ? 's' : '') : ''}
                </div>
              </div>
            </div>`;
        });
        list.innerHTML = html;

      }, err => {
        console.error('[gc] Student group list error:', err);
        const list = document.getElementById('gcStudentGroupList');
        if (!list) return;

        if (err.code === 'failed-precondition' || (err.message && err.message.toLowerCase().includes('index'))) {
          list.innerHTML = `
            <div style="text-align:center;padding:2rem 1.5rem;">
              <p style="font-size:.8125rem;color:var(--text-3);">
                Group chats are being set up. Please contact Master Timothy or check back later.
              </p>
            </div>`;
        } else {
          list.innerHTML = `
            <div style="text-align:center;padding:2.5rem 1.5rem;">
              <div style="font-size:2rem;margin-bottom:.75rem;">💬</div>
              <p style="font-size:.9375rem;font-weight:600;color:var(--text-1);margin-bottom:.375rem;">
                No group chats yet
              </p>
              <p style="font-size:.8125rem;color:var(--text-3);line-height:1.6;">
                You haven't been added to any group chats yet.<br>
                Your teacher will add you when a group is created.
              </p>
            </div>`;
        }
      });

    _reg('gcStudentGroups', unsub);
  }

  /* ══════════════════════════════════════════════════════
     OPEN STUDENT CHAT VIEW
  ══════════════════════════════════════════════════════ */
  /* ══════════════════════════════════════════════════════
     OPEN STUDENT CHAT VIEW
  ══════════════════════════════════════════════════════ */
  async function _openStudentChat(groupId) {
    _cancelActiveChat();
    _activeGroupId = groupId;

    const snap = await Db().collection('groupChats').doc(groupId).get().catch(() => null);
    if (!snap || !snap.exists) { UI.toast('Group not found.', 'error'); return; }
    _activeGroupData = snap.data();
    const g   = _activeGroupData;
    const uid = AppState.userId;

    const isMuted = Array.isArray(g.mutedUids) && g.mutedUids.includes(uid);

    const container = document.getElementById('gcStudentGroupList')?.closest('.max-w-2xl');

    const shell = document.getElementById('gcStudentGroupList');
    if (!shell) return;
    const parent = shell.closest('.max-w-2xl');
    if (!parent) return;

    parent.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;">

        <div style="display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;
                    border-bottom:1px solid var(--border);flex-shrink:0;">
          <button onclick="GroupChat._backToStudentList()"
                  style="width:30px;height:30px;border-radius:50%;flex-shrink:0;
                         border:1px solid var(--border);background:var(--bg-subtle);
                         cursor:pointer;display:flex;align-items:center;justify-content:center;
                         color:var(--text-2);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <div class="gc-group-av" style="width:36px;height:36px;font-size:.875rem;">
            ${_esc((g.name || '?').charAt(0).toUpperCase())}
          </div>
          <div style="flex:1;min-width:0;">
            <p style="font-size:.9375rem;font-weight:700;color:var(--text-1);
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0;">${_esc(g.name)}</p>
            <p style="font-size:.6875rem;color:var(--text-3);margin:0;">
              ${g.members ? g.members.length : 0} member${(g.members||[]).length!==1?'s':''}
              ${g.settings && g.settings.description ? ' · ' + _esc(g.settings.description) : ''}
              <span id="gcOnlineCount" style="color:#22c45e;font-weight:600;margin-left:.25rem;"></span>
            </p>
          </div>
          <button onclick="GroupChat._showGroupInfo('${_escAttr(groupId)}')"
                  style="width:30px;height:30px;border-radius:50%;flex-shrink:0;
                         border:1px solid var(--border);background:var(--bg-subtle);
                         cursor:pointer;display:flex;align-items:center;justify-content:center;
                         color:var(--text-3);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </button>
        </div>

        <div id="gcChatMessages"
             class="gc-messages-area"
             style="flex:1;min-height:240px;max-height:420px;padding:.75rem 1rem;
                    background:var(--bg-subtle);box-sizing:border-box;width:100%;">
          <p style="text-align:center;font-size:.8125rem;color:var(--text-4);padding:2rem 0;">
            Loading messages…
          </p>
        </div>

        <div id="gcTypingBar" class="gc-typing-bar">
          <span class="dm-typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>
          <span style="font-size:.6875rem;color:var(--text-3);margin-left:.375rem;font-style:italic;"
                id="gcTypingLabel"></span>
        </div>

        ${isMuted
          ? `<div class="gc-muted-banner">
               You have been muted by the teacher. You cannot send messages in this group.
             </div>`
          : `<div id="gcReplyBar" class="gc-reply-bar">
               <div style="flex:1;min-width:0;overflow:hidden;">
                 <span class="gc-reply-bar__name" id="gcReplyName"></span>
                 <span class="gc-reply-bar__text" id="gcReplyText"></span>
               </div>
               <button class="gc-reply-bar__close" onclick="GroupChat._clearReply()">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                   <path d="M18 6 6 18M6 6l12 12"/>
                 </svg>
               </button>
             </div>
             <div style="display:flex;gap:.5rem;align-items:flex-end;padding:.625rem .875rem;
                         border-top:1px solid var(--border);background:var(--bg-base);
                         box-sizing:border-box;width:100%;">
               <textarea id="gcInput" placeholder="Type a message…" rows="1"
                         style="flex:1;min-width:0;resize:none;overflow-y:hidden;
                                min-height:36px;max-height:120px;box-sizing:border-box;
                                font-family:var(--font);font-size:var(--text-base);"></textarea>
               <button id="gcSendBtn" onclick="GroupChat._sendStudentMessage()"
                       class="btn bg-green-600 hover:bg-green-700"
                       style="flex-shrink:0;align-self:flex-end;">Send</button>
             </div>`}
      </div>`;

    _setupStudentInput(groupId, isMuted);
      if (window.VoiceNotes && !isMuted) VoiceNotes.injectRecorderButton('gcInput', _sendStudentVoiceNote);
    _clearGroupUnread(groupId, uid);
    _subscribeGroupMessages(groupId, uid, false);
    _subscribeGroupTyping(groupId, uid);
    _subscribeGroupUpdatesForStudent(groupId, uid);

    _memberPresenceCache = {};
    _subscribeMemberPresence(g.members || []);

    _cancel('gcStudentGroups');
  }

  function _backToStudentList() {
    _cancelActiveChat();
    _activeGroupId   = null;
    _activeGroupData = null;
    _replyTo         = null;

    const parent = document.querySelector('#app .max-w-2xl');
    if (!parent) { openForStudent(); return; }
    parent.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <h2 class="font-bold" style="font-size:1.125rem;">Group Chats</h2>
        <button onclick="GroupChat._backFromStudent()" class="btn bg-gray-500" style="font-size:.8125rem;">
          ← Back
        </button>
      </div>
      <div id="gcStudentGroupList" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;">
        <p style="text-align:center;padding:2rem;font-size:.8125rem;color:var(--text-4);">Loading…</p>
      </div>`;
    _subscribeStudentGroupList(AppState.userId);
  }

  function _setupStudentInput(groupId, isMuted) {
    if (isMuted) return;
    const input = document.getElementById('gcInput');
    if (!input) return;
    input.focus();
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _sendStudentMessage(); }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      input.style.overflowY = input.scrollHeight > 120 ? 'auto' : 'hidden';
      _startTyping(groupId, AppState.userId, AppState.studentData?.name || 'Student');
    });
    input.addEventListener('blur', () => _stopTyping(groupId, AppState.userId));
  }

  /* ── Subscribe to group updates so mute/kick takes effect live ── */
  function _subscribeGroupUpdatesForStudent(groupId, uid) {
    _reg('gcGroupDoc_' + groupId, Db().collection('groupChats').doc(groupId).onSnapshot(snap => {
      if (!snap.exists) {
        UI.toast('This group no longer exists.', 'warning', 4000);
        _backFromStudent();
        return;
      }
      _activeGroupData = snap.data();
      const g = _activeGroupData;

      if (!Array.isArray(g.memberUids) || !g.memberUids.includes(uid)) {
        UI.toast('You have been removed from this group.', 'warning', 5000);
        _backToStudentList();
        return;
      }

      const isMuted   = Array.isArray(g.mutedUids) && g.mutedUids.includes(uid);
      const inputArea = document.getElementById('gcInput');
      const sendBtn   = document.getElementById('gcSendBtn');
      const mutedBanr = document.querySelector('.gc-muted-banner');

      if (isMuted && inputArea) {
        inputArea.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
        if (!mutedBanr) {
          const bar = document.createElement('div');
          bar.className = 'gc-muted-banner';
          bar.textContent = 'You have been muted by the teacher. You cannot send messages in this group.';
          inputArea.closest('div').before(bar);
        }
      } else if (!isMuted && inputArea) {
        inputArea.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        if (mutedBanr) mutedBanr.remove();
      }
    }, err => console.warn('[gc] Group doc watch error:', err)));
  }

  /* ══════════════════════════════════════════════════════
     MESSAGES — subscribe and render (student & teacher share this)
  ══════════════════════════════════════════════════════ */
  function _subscribeGroupMessages(groupId, viewerUid, isTeacherViewer) {
    const containerId = isTeacherViewer ? 'gcTeacherMessages' : 'gcChatMessages';
    _cancel('gcMessages_' + groupId);

    const unsub = Db()
      .collection('groupChats').doc(groupId)
      .collection('messages').orderBy('timestamp', 'asc')
      .onSnapshot(snap => {
        const container = document.getElementById(containerId);
        if (!container) { _cancel('gcMessages_' + groupId); return; }

        if (snap.empty) {
          container.innerHTML = `<p style="text-align:center;font-size:.8125rem;color:var(--text-4);padding:2rem 0;">
            No messages yet. Say something!</p>`;
          return;
        }

        const msgs = [];
        snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));

        container.innerHTML = _renderMessages(msgs, viewerUid, groupId, isTeacherViewer);
        container.scrollTop = container.scrollHeight;
        _attachSwipeListeners(containerId, isTeacherViewer);

      }, err => console.error('[gc] Messages error:', err));

    _reg('gcMessages_' + groupId, unsub);
  }
  
  let _openGcMenuId = null;

  function _closeOpenGcMenu() {
    if (_openGcMenuId) {
      const m = document.getElementById(_openGcMenuId);
      if (m) m.remove();
      document.querySelectorAll('.gc-bubble.menu-open').forEach(el => el.classList.remove('menu-open'));
      _openGcMenuId = null;
    }
  }

  function _toggleActionMenu(wrapperId, groupId, messageId, currentText, canEdit, canHistory, isDarkBubble, alignRight, isTeacherViewer) {
    const menuId = `gcMenu-${messageId}`;
    if (_openGcMenuId === menuId) { _closeOpenGcMenu(); return; }
    _closeOpenGcMenu();

    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;
    const bubbleEl = wrapper.querySelector('.gc-bubble');
    if (!bubbleEl) return;

    const textEl      = bubbleEl.querySelector('.gc-bubble-text');
    const resolvedText = (currentText && String(currentText).trim())
      ? String(currentText).trim()
      : (textEl ? textEl.textContent.trim() : '');

    const menu = document.createElement('div');
    menu.className = 'gc-action-menu';
    menu.id = menuId;
    menu.style.position = 'fixed';
    menu.style.zIndex   = '9999';
    menu.style.top      = '-9999px';
    menu.style.left     = '-9999px';
    document.body.appendChild(menu);
    _openGcMenuId = menuId;
    bubbleEl.classList.add('menu-open');

    if (canEdit) {
      const editItem = document.createElement('button');
      editItem.className = 'gc-action-menu-item';
      editItem.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit message`;
      editItem.onclick = () => {
        _closeOpenGcMenu();
        _activateInlineEdit(groupId, messageId, resolvedText, isDarkBubble, wrapperId, isTeacherViewer);
      };
      menu.appendChild(editItem);
    }

    if (canHistory) {
      const histItem = document.createElement('button');
      histItem.className = 'gc-action-menu-item';
      histItem.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg> Edit history`;
      histItem.onclick = () => {
        _closeOpenGcMenu();
        _showEditHistory(groupId, messageId, resolvedText);
      };
      menu.appendChild(histItem);
    }

    if (!menu.children.length) { menu.remove(); _openGcMenuId = null; return; }

    requestAnimationFrame(() => {
      const rect     = bubbleEl.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const spaceAbove = rect.top;
      if (spaceAbove >= menuRect.height + 8) {
        menu.style.top = `${rect.top - menuRect.height - 6}px`;
      } else {
        menu.style.top = `${rect.bottom + 6}px`;
      }
      if (alignRight) {
        menu.style.left = `${Math.max(4, rect.right - menuRect.width)}px`;
      } else {
        menu.style.left = `${Math.min(rect.left, window.innerWidth - menuRect.width - 4)}px`;
      }
    });

    setTimeout(() => {
      document.addEventListener('click', function _handler(e) {
        if (!menu.contains(e.target)) {
          _closeOpenGcMenu();
          document.removeEventListener('click', _handler);
        }
      });
    }, 0);
  }
  
  function _activateInlineEdit(groupId, messageId, currentText, isDarkBubble, wrapperId, isTeacherViewer) {
    const wrapper   = document.getElementById(wrapperId);
    if (!wrapper) return;
    const bubbleEl  = wrapper.querySelector('.gc-bubble');
    const textEl    = bubbleEl && bubbleEl.querySelector('.gc-bubble-text');
    const footerEl  = bubbleEl && bubbleEl.querySelector('.gc-bubble-footer');
    const editedEl  = bubbleEl && bubbleEl.querySelector('.gc-edited-label');
    if (!bubbleEl || !textEl) return;
    if (bubbleEl.querySelector('[id^="gcEditUI-"]')) return;

    const saveClass   = isDarkBubble ? 'gc-edit-btn gc-edit-btn--save-dark'   : 'gc-edit-btn gc-edit-btn--save-light';
    const cancelClass = isDarkBubble ? 'gc-edit-btn gc-edit-btn--cancel-dark' : 'gc-edit-btn gc-edit-btn--cancel-light';
    const taBg        = isDarkBubble ? 'rgba(255,255,255,0.15)' : 'var(--bg-base)';
    const taColor     = isDarkBubble ? '#fff'                   : 'var(--text-1)';
    const taBorder    = isDarkBubble ? '1px solid rgba(255,255,255,0.3)' : '1px solid var(--accent)';
    const taBoxShadow = isDarkBubble ? '0 0 0 3px rgba(255,255,255,0.1)' : '0 0 0 3px var(--accent-subtle)';

    if (textEl)   textEl.style.display   = 'none';
    if (footerEl) footerEl.style.display = 'none';
    if (editedEl) editedEl.style.display = 'none';

    const editUI = document.createElement('div');
    editUI.id    = `gcEditUI-${messageId}`;

    const cancelBtn = document.createElement('button');
    cancelBtn.className   = cancelClass;
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick     = () => {
      editUI.remove();
      if (textEl)   textEl.style.display   = '';
      if (footerEl) footerEl.style.display = '';
      if (editedEl) editedEl.style.display = '';
    };

    const placeholder = document.createElement('p');
    placeholder.style.cssText = 'font-size:.75rem;opacity:.5;padding:.25rem 0;margin:0;';
    placeholder.textContent   = 'Loading…';
    editUI.appendChild(placeholder);
    bubbleEl.appendChild(editUI);

    const _buildEditor = () => {
      editUI.innerHTML = '';

      const ta = document.createElement('textarea');
      ta.className        = 'gc-edit-textarea';
      ta.value            = currentText;
      ta.rows             = 1;
      ta.style.background = taBg;
      ta.style.color      = taColor;
      ta.style.border     = taBorder;
      ta.style.boxShadow  = taBoxShadow;

      const actions     = document.createElement('div');
      actions.className = 'gc-edit-actions';

      const saveBtn = document.createElement('button');
      saveBtn.className   = saveClass;
      saveBtn.textContent = 'Save';
      saveBtn.onclick     = async () => {
        const newText = ta.value.trim();
        if (!newText) { UI.toast('Message cannot be empty.', 'warning'); return; }
        if (newText === currentText) { cancelBtn.onclick(); return; }
        saveBtn.disabled    = true;
        saveBtn.textContent = 'Saving…';
        try {
          await _saveEdit(groupId, messageId, currentText, newText, isTeacherViewer);
          if (textEl) textEl.textContent = newText;
          cancelBtn.onclick();
        } catch (err) {
          if (err.message === 'EDIT_LIMIT_REACHED') {
            _buildLimitNotice();
          } else {
            console.error('[gc] inline edit save error:', err);
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
                            color:${isDarkBubble ? 'rgba(255,255,255,.9)' : 'var(--danger)'};`;
      msg.textContent   = 'Messages can only be edited twice.';
      const actions     = document.createElement('div');
      actions.className = 'gc-edit-actions';
      actions.appendChild(cancelBtn);
      editUI.appendChild(msg);
      editUI.appendChild(actions);
    };

    if (isTeacherViewer) {
      _buildEditor();
    } else {
      _msgHistoryRef(groupId, messageId).get()
        .then(snap => { if (snap.size >= 2) _buildLimitNotice(); else _buildEditor(); })
        .catch(() => _buildEditor());
    }
  }
  
  function _msgHistoryRef(groupId, messageId) {
    return Db()
      .collection('groupChats').doc(groupId)
      .collection('messages').doc(messageId)
      .collection('editHistory');
  }

  async function _saveEdit(groupId, messageId, oldText, newText, isTeacherViewer) {
    const historyCol = _msgHistoryRef(groupId, messageId);
    const msgRef     = Db()
      .collection('groupChats').doc(groupId)
      .collection('messages').doc(messageId);
    const ts         = firebase.firestore.FieldValue.serverTimestamp();

    if (!isTeacherViewer) {
      const countSnap = await historyCol.get();
      if (countSnap.size >= 2) throw new Error('EDIT_LIMIT_REACHED');
    }

    const batch = Db().batch();
    batch.set(historyCol.doc(), { text: oldText, editedAt: ts });
    batch.update(msgRef, { text: newText, editedAt: ts });
    await batch.commit();
  }
  
  async function _showEditHistory(groupId, messageId, currentText) {
    let entries = [];
    try {
      const snap = await _msgHistoryRef(groupId, messageId)
        .orderBy('editedAt', 'asc').get();
      snap.forEach(doc => entries.push({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.error('[gc] _showEditHistory error:', e);
      UI.toast('Could not load edit history.', 'error');
      return;
    }

    const existing = document.getElementById('gcHistoryOverlay');
    if (existing) existing.remove();

    const fmt = ts => {
      if (!ts) return '—';
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString('en-GB', {
        day:'numeric', month:'short', year:'numeric',
        hour:'2-digit', minute:'2-digit',
      });
    };

    const historyRows = entries.length === 0
      ? `<p style="font-size:.8125rem;color:var(--text-4);text-align:center;padding:1.5rem 0;">
           No prior edits recorded for this message.
         </p>`
      : entries.map((e, i) => `
          <div class="gc-history-entry">
            <p>${_esc(e.text)}</p>
            <time>Version ${i + 1} — ${_esc(fmt(e.editedAt))}</time>
          </div>`).join('');

    const overlay = document.createElement('div');
    overlay.className = 'gc-history-overlay';
    overlay.id        = 'gcHistoryOverlay';
    overlay.innerHTML = `
      <div class="gc-history-modal">
        <div class="gc-history-header">
          <div style="display:flex;align-items:center;gap:.5rem;">
            <span style="color:var(--accent);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>
              </svg>
            </span>
            <span style="font-size:.9375rem;font-weight:700;color:var(--text-1);">Edit History</span>
          </div>
          <button onclick="document.getElementById('gcHistoryOverlay').remove()"
                  style="background:none;border:none;cursor:pointer;color:var(--text-3);
                         display:flex;align-items:center;padding:4px;border-radius:4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="gc-history-body">
          <div class="gc-history-entry gc-history-current">
            <p>${_esc(currentText)}</p>
            <time>Current version</time>
          </div>
          ${historyRows}
        </div>
      </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  function _renderMessages(msgs, viewerUid, groupId, isTeacherViewer) {
    let lastDayKey   = null;
    let lastSenderId = null;
    const parts      = [];

    for (const msg of msgs) {
      if (msg.deletedForAll) {
        parts.push(`<div class="gc-event-row">
          <em style="color:var(--text-4);">This message was deleted.</em>
        </div>`);
        lastSenderId = null;
        continue;
      }
      if (msg.type === 'event') {
        parts.push(`<div class="gc-event-row">${_esc(msg.text)}</div>`);
        lastSenderId = null;
        continue;
      }

      const ts   = msg.timestamp;
      const date = ts ? (ts.toDate ? ts.toDate() : new Date(ts)) : null;
      const dk   = date ? _dayKey(date) : null;

      if (dk && dk !== lastDayKey) {
        parts.push(`<div class="gc-date-sep">
          <div class="gc-date-sep__line"></div>
          <span class="gc-date-sep__label">${_esc(_dateLabelFor(date))}</span>
          <div class="gc-date-sep__line"></div>
        </div>`);
        lastDayKey   = dk;
        lastSenderId = null;
      }

      const isMe      = msg.senderId === viewerUid;
      const showLabel = msg.senderId !== lastSenderId;
      lastSenderId    = msg.senderId;
      parts.push(_buildBubble(msg, isMe, showLabel, viewerUid, groupId, isTeacherViewer));
    }
    return parts.join('');
  }

  function _buildBubble(msg, isMe, showLabel, viewerUid, groupId, isTeacherViewer) {
    const msgId  = msg.id || '';
    const wrapId = `gcWrap-${_escAttr(msgId)}`;
    const time   = _timeStr(msg.timestamp);

    // Who can edit this message:
    // - the original sender (student: up to 2 edits; teacher: unlimited)
    // - teacher viewer can always edit any message
    const canEdit    = !!msgId && (isMe || isTeacherViewer) && !msg.voiceNote;
    const canHistory = !!msgId && (isMe || isTeacherViewer);

    let replyCard = '';
    if (msg.replyTo && msg.replyTo.id) {
      const rName = _esc(msg.replyTo.senderName || 'Unknown');
      const rText = _esc((msg.replyTo.text || '').substring(0, 80));
      const rId   = _escAttr(msg.replyTo.id);
      replyCard = `<div class="gc-reply-card"
           onclick="event.stopPropagation();GroupChat._scrollToMsg('${rId}')"
           title="Jump to original">
        <span class="gc-reply-card__name">${rName}</span>
        <span class="gc-reply-card__text">${rText}</span>
      </div>`;
    }

    const replyData = msgId
      ? `data-reply-id="${_escAttr(msgId)}"
         data-reply-text="${_escAttr((msg.text||'').substring(0,80))}"
         data-reply-sender="${_escAttr(msg.senderName||'Unknown')}"`
      : '';

    const editedLabel = msg.editedAt
      ? `<span class="gc-edited-label">edited</span>`
      : '';

    const safeGid    = _escAttr(groupId || _activeGroupId || '');
    const safeMsgId  = _escAttr(msgId);
    const safeVUid   = _escAttr(viewerUid || '');

    const editBtn = (canEdit || canHistory)
      ? `<button title="Options"
                 onclick="event.stopPropagation();GroupChat._toggleActionMenu('${wrapId}','${safeGid}','${safeMsgId}',document.getElementById('${wrapId}').querySelector('.gc-bubble-text').textContent,${canEdit},${canHistory},${isMe},${isMe},${!!isTeacherViewer})"
                 style="color:${isMe ? 'rgba(255,255,255,.7)' : 'var(--text-4)'}"
                 class="gc-edit-trigger-btn">
           <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
             <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
           </svg>
         </button>`
      : '';

    if (isMe) {
      return `
        <div class="gc-swipe-wrap gc-msg-out" id="${wrapId}"
             style="margin-bottom:${showLabel?'.75rem':'.25rem'};"
             ${replyData}>
          <div class="gc-swipe-inner">
            ${showLabel ? `<span style="font-size:.6875rem;font-weight:600;color:var(--text-3);
                           margin-bottom:2px;display:block;text-align:right;">You</span>` : ''}
            <div class="gc-bubble-row">
              <div class="gc-bubble"
                   style="background:var(--accent);color:#fff;
                          border-radius:14px 14px 3px 14px;padding:.5rem .75rem .375rem;">
                ${replyCard}
                ${msg.voiceNote ? VoiceNotes.renderPlayer(msg.voiceNote) : `<p class="gc-bubble-text">${_esc(msg.text)}</p>`}
                <div class="gc-bubble-footer gc-bubble-footer--end">
                  ${editedLabel}
                  ${editBtn}
                  <span class="gc-bubble-time">${time}</span>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    } else {
      const isTeacherMsg = msg.senderId === TEACHER_UID();
      const nameBg       = isTeacherMsg ? 'var(--warning-text)' : 'var(--accent-text)';
      return `
        <div class="gc-swipe-wrap gc-msg-in" id="${wrapId}"
             style="margin-bottom:${showLabel?'.75rem':'.25rem'};"
             ${replyData}>
          <div class="gc-swipe-inner">
            ${showLabel ? `<span style="font-size:.6875rem;font-weight:600;color:${nameBg};
                           margin-bottom:2px;display:block;">
                           ${_esc(msg.senderName||'Unknown')}
                           ${isTeacherMsg ? '<span style="font-size:.5625rem;font-weight:400;color:var(--warning);margin-left:4px;">(Teacher)</span>' : ''}
                           </span>` : ''}
            <div class="gc-bubble-row">
              <div class="gc-bubble"
                   style="background:var(--bg-base);color:var(--text-1);
                          border:1px solid var(--border);
                          border-radius:14px 14px 14px 3px;padding:.5rem .75rem .375rem;">
                ${replyCard}
                ${msg.voiceNote ? VoiceNotes.renderPlayer(msg.voiceNote) : `<p class="gc-bubble-text">${_esc(msg.text)}</p>`}
                <div class="gc-bubble-footer gc-bubble-footer--start">
                  ${editedLabel}
                  <span class="gc-bubble-time" style="opacity:.55;">${time}</span>
                  <span style="flex:1;"></span>
                  ${editBtn}
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }
  }

  function _scrollToMsg(msgId) {
    const el = document.getElementById('gcWrap-' + msgId);
    if (!el) return;
    el.scrollIntoView({ behavior:'smooth', block:'center' });
    const b = el.querySelector('.gc-bubble');
    if (!b) return;
    const prev = b.style.outline;
    b.style.transition = 'outline .1s';
    b.style.outline = '2px solid var(--accent)';
    setTimeout(() => { b.style.outline = prev || 'none'; }, 900);
  }

  /* ── Swipe to reply ────────────────────────────────── */
  function _attachSwipeListeners(containerId, isTeacher) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const SWIPE_THRESHOLD  = 60;
    const SWIPE_MAX_REVEAL = 72;
    let touchStartX = 0, touchStartY = 0, activeSwiping = null, swipeTriggered = false;

    function _getWrap(el) { return el.closest('.gc-swipe-wrap'); }
    function _isOutgoing(wrap) { return wrap.classList.contains('gc-msg-out'); }
    function _resetWrap(wrap) {
      const inner = wrap.querySelector('.gc-swipe-inner');
      if (inner) { inner.style.transition = ''; inner.style.transform = ''; }
    }
    function _triggerReply(wrap) {
      const data = { id: wrap.dataset.replyId, text: wrap.dataset.replyText, senderName: wrap.dataset.replySender };
      if (!data.id) return;
      if (isTeacher) _showTeacherReply(data);
      else _showStudentReply(data);
    }

    container.addEventListener('touchstart', e => {
      const wrap = _getWrap(e.target);
      if (!wrap || !wrap.dataset.replyId) return;
      touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
      activeSwiping = wrap; swipeTriggered = false;
    }, { passive: true });

    container.addEventListener('touchmove', e => {
      if (!activeSwiping) return;
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      const dir = _isOutgoing(activeSwiping) ? -1 : 1;
      if (Math.abs(dy) > Math.abs(dx) + 8) { activeSwiping = null; return; }
      if (dx * dir <= 0) return;
      e.preventDefault();
      const travel = Math.min(Math.abs(dx), SWIPE_MAX_REVEAL);
      const inner  = activeSwiping.querySelector('.gc-swipe-inner');
      if (inner) { inner.style.transition = 'none'; inner.style.transform = `translateX(${dir * travel}px)`; }
      if (Math.abs(dx) >= SWIPE_THRESHOLD && !swipeTriggered) {
        swipeTriggered = true;
        if (navigator.vibrate) navigator.vibrate(30);
        _triggerReply(activeSwiping);
      }
    }, { passive: false });

    container.addEventListener('touchend', () => {
      if (activeSwiping) { _resetWrap(activeSwiping); activeSwiping = null; swipeTriggered = false; }
    });
    container.addEventListener('touchcancel', () => {
      if (activeSwiping) { _resetWrap(activeSwiping); activeSwiping = null; swipeTriggered = false; }
    });
  }

  /* ── Reply helpers ─────────────────────────────────── */
  function _showStudentReply(data) {
    _replyTo = data;
    const bar  = document.getElementById('gcReplyBar');
    const name = document.getElementById('gcReplyName');
    const text = document.getElementById('gcReplyText');
    if (!bar || !name || !text) return;
    name.textContent = data.senderName + ':  ';
    text.textContent = data.text;
    bar.classList.add('visible');
    document.getElementById('gcInput')?.focus();
  }

  function _clearReply() {
    _replyTo = null;
    const bar = document.getElementById('gcReplyBar') || document.getElementById('gcTeacherReplyBar');
    if (bar) bar.classList.remove('visible');
  }

  function _showTeacherReply(data) {
    _replyTo = data;
    const bar  = document.getElementById('gcTeacherReplyBar');
    const name = document.getElementById('gcTeacherReplyBarName');
    const text = document.getElementById('gcTeacherReplyBarText');
    if (!bar || !name || !text) return;
    name.textContent = data.senderName + ':  ';
    text.textContent = data.text;
    bar.classList.add('visible');
    document.getElementById('gcTeacherInput')?.focus();
  }

  /* ── Typing indicators ─────────────────────────────── */
  async function _startTyping(groupId, uid, name) {
    if (_typingDebounce) clearTimeout(_typingDebounce);
    _typingDebounce = setTimeout(() => _stopTyping(groupId, uid), 4000);
    if (_typingActive && _typingGroupId === groupId) return;
    _typingActive  = true;
    _typingGroupId = groupId;
    try {
      await Db().collection('groupChats').doc(groupId)
        .set({ typing: { [uid]: { name, ts: Date.now() } } }, { merge: true });
    } catch (e) { console.warn('[gc] _startTyping error:', e); }
  }

  async function _stopTyping(groupId, uid) {
    if (_typingDebounce) { clearTimeout(_typingDebounce); _typingDebounce = null; }
    _typingActive  = false;
    _typingGroupId = null;
    try {
      await Db().collection('groupChats').doc(groupId)
        .set({ typing: { [uid]: firebase.firestore.FieldValue.delete() } }, { merge: true });
    } catch (e) { console.warn('[gc] _stopTyping error:', e); }
  }

  function _subscribeGroupTyping(groupId, viewerUid) {
    _cancel('gcTyping_' + groupId);
    const unsub = Db().collection('groupChats').doc(groupId).onSnapshot(snap => {
      const bar   = document.getElementById('gcTypingBar') || document.getElementById('gcTeacherTypingBar');
      const label = document.getElementById('gcTypingLabel') || document.getElementById('gcTeacherTypingLabel');
      if (!bar || !label) return;

      const data   = (snap.exists && snap.data().typing) || {};
      const now    = Date.now();
      const names  = Object.entries(data)
        .filter(([uid, entry]) => uid !== viewerUid && entry && (now - (entry.ts || 0)) < 5000)
        .map(([, entry]) => entry.name);

      if (names.length > 0) {
        label.textContent = names.join(', ') + (names.length > 1 ? ' are typing…' : ' is typing…');
        bar.style.display = 'flex';
        bar.style.height  = '22px';
      } else {
        bar.style.display = 'none';
        bar.style.height  = '0';
      }
    }, err => console.warn('[gc] Typing watch error:', err));
    _reg('gcTyping_' + groupId, unsub);
  }

  /* ── Clear unread ──────────────────────────────────── */
  async function _clearGroupUnread(groupId, uid) {
    try {
      await Db().collection('groupChats').doc(groupId).set(
        { unread: { [uid]: 0 } }, { merge: true }
      );
      _updateGroupBadge(uid);
    } catch (e) { console.warn('[gc] _clearGroupUnread error:', e); }
  }

  /* ── Cancel active chat listeners ──────────────────── */
  function _cancelActiveChat() {
    if (_typingActive && _typingGroupId && AppState.userId) {
      _stopTyping(_typingGroupId, AppState.userId).catch(() => {});
    }
    Object.keys(_listeners).filter(k => k.startsWith('gcMessages_') || k.startsWith('gcTyping_') || k.startsWith('gcGroupDoc_'))
      .forEach(k => _cancel(k));
    _unsubscribeMemberPresence();
    _memberPresenceCache = {};
  }
  
  function _presenceRef(uid) { return Db().collection('presence').doc(uid); }

  async function _writePresenceOnline(uid) {
    const ts = firebase.firestore.FieldValue.serverTimestamp();
    await _presenceRef(uid).set({ lastSeen: ts, isOnline: true }, { merge: true });
  }

  async function _writePresenceOffline(uid) {
    const ts = new Date(Date.now() - (PRESENCE_ONLINE_THRESHOLD_MS + 2000));
    await _presenceRef(uid).set({ lastSeen: ts, isOnline: false }, { merge: true });
  }

  function _startPresenceHeartbeat(uid) {
    _stopPresenceHeartbeat();
    _presenceHeartbeatHandle = setInterval(async () => {
      if (!firebase.auth().currentUser || _presenceOfflineDone) { _stopPresenceHeartbeat(); return; }
      if (document.visibilityState === 'hidden') return;
      try { await _writePresenceOnline(uid); } catch (e) { console.warn('[gc] presence heartbeat failed:', e); }
    }, PRESENCE_HEARTBEAT_MS);
  }

  function _stopPresenceHeartbeat() {
    if (_presenceHeartbeatHandle) { clearInterval(_presenceHeartbeatHandle); _presenceHeartbeatHandle = null; }
  }

  /* ── Public: start writing my own presence (call once on login) ── */
  async function initPresence(uid) {
    if (!uid || !Db()) return;
    _myPresenceUid        = uid;
    _presenceOfflineDone  = false;

    try {
      await _writePresenceOnline(uid);
    } catch (e) {
      console.warn('[gc] Could not set presence online:', e);
      return;
    }
    _startPresenceHeartbeat(uid);

    _presenceVisibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        _stopPresenceHeartbeat();
      } else if (firebase.auth().currentUser && !_presenceOfflineDone) {
        _writePresenceOnline(uid).catch(() => {});
        _startPresenceHeartbeat(uid);
      }
    };
    document.addEventListener('visibilitychange', _presenceVisibilityHandler);

    _presenceBeforeunloadHandler = () => {
      if (_presenceOfflineDone) return;
      _presenceOfflineDone = true;
      _stopPresenceHeartbeat();
      const ts = new Date(Date.now() - (PRESENCE_ONLINE_THRESHOLD_MS + 2000));
      try { _presenceRef(uid).set({ lastSeen: ts, isOnline: false }, { merge: true }); } catch (_) {}
    };
    window.addEventListener('beforeunload', _presenceBeforeunloadHandler);
  }

  /* ── Public: stop writing my own presence (call on logout) ── */
  async function stopPresence() {
    _stopPresenceHeartbeat();
    if (_presenceVisibilityHandler) {
      document.removeEventListener('visibilitychange', _presenceVisibilityHandler);
      _presenceVisibilityHandler = null;
    }
    if (_presenceBeforeunloadHandler) {
      window.removeEventListener('beforeunload', _presenceBeforeunloadHandler);
      _presenceBeforeunloadHandler = null;
    }
    if (_myPresenceUid && !_presenceOfflineDone) {
      _presenceOfflineDone = true;
      try { await _writePresenceOffline(_myPresenceUid); } catch (e) { console.warn('[gc] presence offline write failed:', e); }
    }
    _myPresenceUid = null;
  }

  function _isPresenceOnline(data) {
    if (!data || !data.isOnline) return false;
    const ts = data.lastSeen;
    if (!ts) return false;
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return (Date.now() - date.getTime()) <= PRESENCE_ONLINE_THRESHOLD_MS;
  }

  function _formatMemberLastSeen(ts) {
    if (!ts) return 'Offline';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const now  = new Date();
    const diffMins = Math.floor((now - date) / 60000);
    if (diffMins < 1)  return 'Last seen just now';
    if (diffMins < 60) return `Last seen ${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return 'Last seen today at ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Last seen yesterday at ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return 'Last seen ' + date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
      ' at ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function _recalcOnlineHeaderCount() {
    const online = Object.values(_memberPresenceCache).filter(_isPresenceOnline).length;
    const label  = online > 0 ? `${online} online` : '';

    const studentEl = document.getElementById('gcOnlineCount');
    if (studentEl) studentEl.textContent = label;

    const teacherEl = document.getElementById('gcTeacherOnlineCount');
    if (teacherEl) teacherEl.textContent = label;
  }

  function _updateMemberPresenceDOM(uid, data) {
    _memberPresenceCache[uid] = data;
    const online = _isPresenceOnline(data);

    const row = document.querySelector(`.gc-member-row[data-uid="${uid}"] .gc-member-presence`);
    if (row) {
      if (online) {
        row.textContent   = '● Online';
        row.style.color   = '#22c45e';
        row.style.fontWeight = '600';
      } else {
        row.textContent   = _formatMemberLastSeen(data.lastSeen);
        row.style.color   = 'var(--text-4)';
        row.style.fontWeight = '400';
      }
    }

    _recalcOnlineHeaderCount();
  }

  function _subscribeMemberPresence(members) {
    _unsubscribeMemberPresence();
    (members || []).forEach(m => {
      if (!m || !m.uid) return;
      const unsub = Db().collection('presence').doc(m.uid).onSnapshot(snap => {
        const data = (snap.exists && snap.data()) || {};
        _updateMemberPresenceDOM(m.uid, data);
      }, err => console.warn('[gc] presence watch error:', err));
      _memberPresenceUnsubs[m.uid] = unsub;
    });
  }

  function _unsubscribeMemberPresence() {
    Object.values(_memberPresenceUnsubs).forEach(fn => { try { fn(); } catch (_) {} });
    _memberPresenceUnsubs = {};
  }

  /* ── Public: is this exact group's chat currently open on screen? ── */
  function _isGroupChatOpen(groupId, viewerRole) {
    if (_activeGroupId !== groupId) return false;
    if (viewerRole === 'teacher') {
      return !!document.getElementById('gcTeacherMessages');
    }
    return !!document.getElementById('gcChatMessages');
  }

  /* ══════════════════════════════════════════════════════
     SEND MESSAGE — student
  ══════════════════════════════════════════════════════ */
  async function _sendStudentMessage() {
    const input = document.getElementById('gcInput');
    const text  = (input?.value || '').trim();
    if (!text) return;

    const g = _activeGroupData;
    if (!g) return;

    const banned = _findBannedWord(text, (g.settings && g.settings.bannedWords) || []);
    if (banned) {
      UI.toast(`Your message contains a restricted word and was not sent.`, 'warning', 5000);
      return;
    }

    const uid         = AppState.userId;
    const isMuted     = Array.isArray(g.mutedUids) && g.mutedUids.includes(uid);
    if (isMuted) { UI.toast('You are muted in this group.', 'warning'); return; }

    const groupId     = _activeGroupId;
    const senderName  = AppState.studentData?.name || 'Student';
    const senderClass = AppState.studentData?.class || '';
    const btn         = document.getElementById('gcSendBtn');

    if (input) { input.value = ''; input.style.height = 'auto'; input.style.height = '36px'; }
    _stopTyping(groupId, uid).catch(() => {});
    if (btn) btn.disabled = true;

    const replyPayload = (_replyTo && _replyTo.id)
      ? { id: _replyTo.id, text: _replyTo.text, senderName: _replyTo.senderName }
      : null;
    _clearReply();

    try {
      const batch  = Db().batch();
      const msgRef = Db().collection('groupChats').doc(groupId).collection('messages').doc();
      const msgData = {
        text, senderId: uid, senderName, senderClass,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        deletedForAll: false,
      };
      if (replyPayload) msgData.replyTo = replyPayload;
      batch.set(msgRef, msgData);

      const preview   = text.length > 80 ? text.substring(0, 80) + '…' : text;
      const unreadInc = {};
      const members   = g.members || [];
      members.forEach(m => {
        if (m.uid !== uid) unreadInc[`unread.${m.uid}`] = firebase.firestore.FieldValue.increment(1);
      });
      batch.update(Db().collection('groupChats').doc(groupId), {
        lastMessage: preview,
        lastAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessageSenderName: senderName,
        ...unreadInc,
      });
      await batch.commit();
    } catch (err) {
      console.error('[gc] sendStudentMessage error:', err);
      UI.toast('Failed to send message.', 'error');
      if (input) input.value = text;
    } finally {
      if (btn) btn.disabled = false;
      input?.focus();
    }
  }
  
  async function _sendStudentVoiceNote(voiceNote) {
    if (!voiceNote || !voiceNote.data) return;
    const g = _activeGroupData;
    if (!g) return;
    const uid = AppState.userId;
    const isMuted = Array.isArray(g.mutedUids) && g.mutedUids.includes(uid);
    if (isMuted) { UI.toast('You are muted in this group.', 'warning'); return; }

    const groupId    = _activeGroupId;
    const senderName = AppState.studentData?.name || 'Student';
    const btn        = document.getElementById('gcSendBtn');
    if (btn) btn.disabled = true;

    try {
      const batch  = Db().batch();
      const msgRef = Db().collection('groupChats').doc(groupId).collection('messages').doc();
      const msgData = {
        voiceNote: voiceNote,
        senderId: uid, senderName, senderClass: AppState.studentData?.class || '',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        deletedForAll: false,
      };
      batch.set(msgRef, msgData);

      const unreadInc = {};
      const members = g.members || [];
      members.forEach(m => { if (m.uid !== uid) unreadInc['unread.' + m.uid] = firebase.firestore.FieldValue.increment(1); });
      batch.update(Db().collection('groupChats').doc(groupId), {
        lastMessage: '🎤 Voice note',
        lastAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessageSenderName: senderName,
        ...unreadInc,
      });
      await batch.commit();
    } catch (err) {
      console.error('[gc] _sendStudentVoiceNote error:', err);
      UI.toast('Failed to send voice note.', 'error');
    } finally {
      if (btn) btn.disabled = false;
      document.getElementById('gcInput')?.focus();
    }
  }

  /* ══════════════════════════════════════════════════════
     GROUP INFO MODAL (student view)
  ══════════════════════════════════════════════════════ */
  function _showGroupInfo(groupId) {
    const g = _activeGroupData;
    if (!g) return;
    const existing = document.getElementById('gcInfoModal');
    if (existing) existing.remove();

    const members = g.members || [];
    const overlay = document.createElement('div');
    overlay.className = 'gc-modal-overlay';
    overlay.id = 'gcInfoModal';
    overlay.innerHTML = `
      <div class="gc-modal">
        <div class="gc-modal-header">
          <span style="font-size:.9375rem;font-weight:700;color:var(--text-1);">Group Info</span>
          <button onclick="document.getElementById('gcInfoModal').remove()"
                  style="background:none;border:none;cursor:pointer;color:var(--text-3);
                         display:flex;align-items:center;padding:4px;border-radius:4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="gc-modal-body">
          <div style="text-align:center;padding:.5rem 0;">
            <div class="gc-group-av" style="width:56px;height:56px;font-size:1.5rem;margin:0 auto .5rem;">
              ${_esc((g.name||'?').charAt(0).toUpperCase())}
            </div>
            <p style="font-size:1rem;font-weight:700;color:var(--text-1);">${_esc(g.name)}</p>
            ${g.settings && g.settings.description
              ? `<p style="font-size:.8125rem;color:var(--text-3);margin-top:4px;">${_esc(g.settings.description)}</p>`
              : ''}
            <p style="font-size:.75rem;color:var(--text-4);margin-top:4px;">
              ${members.length} member${members.length!==1?'s':''}
            </p>
          </div>
          <div>
            <p style="font-size:.75rem;font-weight:700;color:var(--text-3);text-transform:uppercase;
                      letter-spacing:.04em;margin-bottom:.5rem;">Members</p>
            <div style="display:flex;flex-direction:column;gap:.375rem;">
              ${members.map(m => `
                <div class="gc-member-row" data-uid="${_escAttr(m.uid)}">
                  <div class="gc-member-av">${_esc((m.name||'?').charAt(0).toUpperCase())}</div>
                  <div style="flex:1;min-width:0;">
                    <div class="gc-member-name">${_esc(m.name||'Unknown')}</div>
                    <div class="gc-member-presence" style="font-size:.6875rem;color:var(--text-4);margin-top:1px;">…</div>
                  </div>
                  <span class="gc-member-cls">${_esc(m.cls||'')}</span>
                </div>`).join('')}
            </div>
          </div>
        </div>
        <div class="gc-modal-footer">
          <button onclick="document.getElementById('gcInfoModal').remove()"
                  class="btn bg-gray-500" style="width:100%;justify-content:center;">Close</button>
        </div>
      </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    // Fill in presence text for members whose status we've already received
    Object.keys(_memberPresenceCache).forEach(uid => _updateMemberPresenceDOM(uid, _memberPresenceCache[uid]));
  }

  /* ══════════════════════════════════════════════════════
     TEACHER PANEL — rendered inside #teacher-groups div
  ══════════════════════════════════════════════════════ */
  function openForTeacher() {
    _injectStyles();
    const panel = document.getElementById('teacher-groups');
    if (!panel) return;

    panel.innerHTML = `
      <div id="gcTeacherShell" style="border:1px solid var(--border);border-radius:12px;
           background:var(--bg-base);width:100%;max-width:100%;box-sizing:border-box;overflow:hidden;">

        <div id="gcTeacherList" style="display:flex;flex-direction:column;width:100%;box-sizing:border-box;">
          <div style="padding:.75rem 1rem;border-bottom:1px solid var(--border);
                      background:var(--bg-subtle);display:flex;align-items:center;
                      justify-content:space-between;gap:.5rem;box-sizing:border-box;">
            <h3 style="font-size:.9375rem;font-weight:700;color:var(--text-1);">Group Chats</h3>
            <button onclick="GroupChat._openCreateGroupModal()"
                    title="Create new group"
                    style="width:30px;height:30px;border-radius:50%;flex-shrink:0;
                           border:1px solid var(--accent-border);background:var(--accent-subtle);
                           cursor:pointer;display:flex;align-items:center;justify-content:center;
                           color:var(--accent-text);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
          <div id="gcTeacherGroupList"
               style="overflow-y:auto;max-height:65vh;width:100%;box-sizing:border-box;">
            <p style="font-size:.8125rem;color:var(--text-4);text-align:center;padding:2rem 1rem;">
              Loading…
            </p>
          </div>
        </div>

        <div id="gcTeacherChatView"
             style="display:none;flex-direction:column;width:100%;box-sizing:border-box;background:var(--bg-base);">
        </div>
      </div>`;

    _subscribeTeacherGroupList();
  }

  function _subscribeTeacherGroupList() {
    _cancel('gcTeacherGroups');
    const unsub = Db().collection('groupChats').orderBy('lastAt', 'desc').onSnapshot(snap => {
      const list = document.getElementById('gcTeacherGroupList');
      if (!list) { _cancel('gcTeacherGroups'); return; }
      if (snap.empty) {
        list.innerHTML = `<p style="font-size:.8125rem;color:var(--text-4);text-align:center;padding:2rem 1rem;">
          No groups yet. Click + to create one.</p>`;
        return;
      }
      let html = '';
      snap.forEach(doc => {
        const g      = doc.data();
        const gid    = doc.id;
        const isAct  = _activeGroupId === gid;
        const members = g.members || [];
        const ts = g.lastAt
          ? new Date(g.lastAt.toDate ? g.lastAt.toDate() : g.lastAt)
              .toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
          : '';
        html += `
          <div class="gc-group-item${isAct ? ' is-active' : ''}"
               data-gid="${_escAttr(gid)}"
               onclick="GroupChat._openTeacherChat('${_escAttr(gid)}')">
            <div class="gc-group-av">${_esc((g.name||'?').charAt(0).toUpperCase())}</div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:.375rem;margin-bottom:1px;">
                <span class="gc-group-name">${_esc(g.name||'Unnamed')}</span>
                <span class="gc-group-date">${_esc(ts)}</span>
              </div>
              <span class="gc-group-preview">
                ${g.lastMessageSenderName ? `<strong>${_esc(g.lastMessageSenderName)}:</strong> ` : ''}
                ${_esc(g.lastMessage||'No messages')}
              </span>
              <div style="font-size:.625rem;color:var(--text-4);margin-top:2px;">
                ${members.length} member${members.length!==1?'s':''}
              </div>
            </div>
          </div>`;
      });
      list.innerHTML = html;
    }, err => console.error('[gc] Teacher group list error:', err));
    _reg('gcTeacherGroups', unsub);
  }

  /* ── Teacher chat view ─────────────────────────────── */
  async function _openTeacherChat(groupId) {
    _cancelActiveChat();
    _activeGroupId = groupId;
    _replyTo       = null;

    document.querySelectorAll('#gcTeacherGroupList .gc-group-item').forEach(el => {
      el.classList.toggle('is-active', el.dataset.gid === groupId);
    });

    const snap = await Db().collection('groupChats').doc(groupId).get().catch(() => null);
    if (!snap || !snap.exists) { UI.toast('Group not found.', 'error'); return; }
    _activeGroupData = snap.data();
    const g = _activeGroupData;

    const listView = document.getElementById('gcTeacherList');
    const chatView = document.getElementById('gcTeacherChatView');
    if (!listView || !chatView) return;
    listView.style.display = 'none';
    chatView.style.display = 'flex';
    chatView.style.flexDirection = 'column';
    chatView.dataset.groupId = groupId;

    chatView.innerHTML = `
      <div style="padding:.625rem 1rem;border-bottom:1px solid var(--border);
                  background:var(--bg-subtle);flex-shrink:0;
                  display:flex;align-items:center;gap:.75rem;box-sizing:border-box;">
        <button onclick="GroupChat._backToTeacherList()"
                style="width:32px;height:32px;border-radius:50%;flex-shrink:0;
                       border:1px solid var(--border);background:var(--bg-base);
                       cursor:pointer;display:flex;align-items:center;justify-content:center;
                       color:var(--text-2);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <div class="gc-group-av" style="width:36px;height:36px;font-size:.875rem;">
          ${_esc((g.name||'?').charAt(0).toUpperCase())}
        </div>
        <div style="flex:1;min-width:0;">
          <p style="font-size:.875rem;font-weight:700;color:var(--text-1);
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0;">${_esc(g.name)}</p>
          <p style="font-size:.6875rem;color:var(--text-3);margin:0;" id="gcTeacherMemberCount">
            ${(g.members||[]).length} member${(g.members||[]).length!==1?'s':''}
            <span id="gcTeacherOnlineCount" style="color:#22c45e;font-weight:600;margin-left:.25rem;"></span>
          </p>
        </div>
        <button onclick="GroupChat._openGroupSettingsModal('${_escAttr(groupId)}')"
                title="Group settings"
                style="width:30px;height:30px;border-radius:50%;flex-shrink:0;
                       border:1px solid var(--border);background:var(--bg-subtle);
                       cursor:pointer;display:flex;align-items:center;justify-content:center;
                       color:var(--text-3);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33
                     1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33
                     l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4
                     h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06
                     A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51
                     a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9
                     a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      <div id="gcTeacherMessages"
           class="gc-messages-area"
           style="overflow-y:auto;max-height:55vh;min-height:200px;
                  padding:.875rem 1rem;background:var(--bg-subtle);flex:1;">
        <p style="text-align:center;font-size:.8125rem;color:var(--text-4);padding:2rem 0;">
          Loading messages…
        </p>
      </div>

      <div id="gcTeacherTypingBar" class="gc-typing-bar">
        <span class="dm-typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>
        <span style="font-size:.6875rem;color:var(--text-3);margin-left:.375rem;font-style:italic;"
              id="gcTeacherTypingLabel"></span>
      </div>

      <div id="gcTeacherReplyBar" class="gc-reply-bar">
        <div style="flex:1;min-width:0;overflow:hidden;">
          <span class="gc-reply-bar__name" id="gcTeacherReplyBarName"></span>
          <span class="gc-reply-bar__text" id="gcTeacherReplyBarText"></span>
        </div>
        <button class="gc-reply-bar__close" onclick="GroupChat._clearReply()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div style="padding:.625rem .875rem;border-top:1px solid var(--border);flex-shrink:0;
                  display:flex;gap:.5rem;align-items:flex-end;background:var(--bg-base);
                  box-sizing:border-box;width:100%;margin-top:.5rem;">
        <textarea id="gcTeacherInput"
                  placeholder="Send a message to the group…"
                  rows="1"
                  style="flex:1;min-width:0;resize:none;overflow-y:hidden;line-height:1.5;
                         padding:.5625rem .75rem;min-height:36px;max-height:120px;
                         border-radius:var(--r-md);font-family:var(--font);
                         font-size:var(--text-base);box-sizing:border-box;"></textarea>
        <button id="gcTeacherSendBtn"
                onclick="GroupChat._sendTeacherMessage()"
                class="btn bg-green-600 hover:bg-green-700"
                style="flex-shrink:0;align-self:flex-end;">Send</button>
      </div>`;

    const input = document.getElementById('gcTeacherInput');
    if (input) {
      input.focus();
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _sendTeacherMessage(); }
      });
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        input.style.overflowY = input.scrollHeight > 120 ? 'auto' : 'hidden';
        _startTyping(groupId, TEACHER_UID(), 'Master Timothy');
      });
      input.addEventListener('blur', () => _stopTyping(groupId, TEACHER_UID()));
    }

    _subscribeGroupMessages(groupId, TEACHER_UID(), true);
    _subscribeGroupTyping(groupId, TEACHER_UID());
    _attachSwipeListeners('gcTeacherMessages', true);
      if (window.VoiceNotes) VoiceNotes.injectRecorderButton('gcTeacherInput', _sendTeacherVoiceNote);

    _memberPresenceCache = {};
    _subscribeMemberPresence(g.members || []);
  }

  function _backToTeacherList() {
    _cancelActiveChat();
    _replyTo = null;
    if (_activeGroupId) {
      _stopTyping(_activeGroupId, TEACHER_UID()).catch(() => {});
    }
    _activeGroupId   = null;
    _activeGroupData = null;

    document.querySelectorAll('#gcTeacherGroupList .gc-group-item').forEach(el => el.classList.remove('is-active'));
    const listView = document.getElementById('gcTeacherList');
    const chatView = document.getElementById('gcTeacherChatView');
    if (listView) listView.style.display = 'flex';
    if (chatView) { chatView.style.display = 'none'; chatView.innerHTML = ''; }
  }

  /* ── Teacher send message ──────────────────────────── */
  async function _sendTeacherMessage() {
    const input   = document.getElementById('gcTeacherInput');
    const text    = (input?.value || '').trim();
    if (!text || !_activeGroupId) return;

    const groupId = _activeGroupId;
    const g       = _activeGroupData;
    const btn     = document.getElementById('gcTeacherSendBtn');

    _stopTyping(groupId, TEACHER_UID()).catch(() => {});
    if (input) { input.value = ''; input.style.height = 'auto'; input.style.height = '36px'; }
    if (btn) btn.disabled = true;

    const replyPayload = (_replyTo && _replyTo.id)
      ? { id: _replyTo.id, text: _replyTo.text, senderName: _replyTo.senderName }
      : null;
    _clearReply();

    try {
      const batch  = Db().batch();
      const msgRef = Db().collection('groupChats').doc(groupId).collection('messages').doc();
      const msgData = {
        text,
        senderId:     TEACHER_UID(),
        senderName:   'Master Timothy',
        senderClass:  '',
        timestamp:    firebase.firestore.FieldValue.serverTimestamp(),
        deletedForAll: false,
      };
      if (replyPayload) msgData.replyTo = replyPayload;
      batch.set(msgRef, msgData);

      const preview   = text.length > 80 ? text.substring(0, 80) + '…' : text;
      const members   = g ? (g.members || []) : [];
      const unreadInc = {};
      members.forEach(m => {
        unreadInc[`unread.${m.uid}`] = firebase.firestore.FieldValue.increment(1);
      });
      batch.update(Db().collection('groupChats').doc(groupId), {
        lastMessage: preview,
        lastAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessageSenderName: 'Master Timothy',
        ...unreadInc,
      });
      await batch.commit();
    } catch (err) {
      console.error('[gc] _sendTeacherMessage error:', err);
      UI.toast('Failed to send message.', 'error');
      if (input) input.value = text;
    } finally {
      if (btn) btn.disabled = false;
      input?.focus();
    }
  }
  
   async function _sendTeacherVoiceNote(voiceNote) {
    if (!voiceNote || !voiceNote.data || !_activeGroupId) return;
    const groupId = _activeGroupId;
    const g       = _activeGroupData;
    const btn     = document.getElementById('gcTeacherSendBtn');
    if (btn) btn.disabled = true;

    try {
      const batch  = Db().batch();
      const msgRef = Db().collection('groupChats').doc(groupId).collection('messages').doc();
      batch.set(msgRef, {
        voiceNote: voiceNote,
        senderId: TEACHER_UID(), senderName: 'Master Timothy', senderClass: '',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        deletedForAll: false,
      });
      const members = g ? (g.members || []) : [];
      const unreadInc = {};
      members.forEach(m => { unreadInc['unread.' + m.uid] = firebase.firestore.FieldValue.increment(1); });
      batch.update(Db().collection('groupChats').doc(groupId), {
        lastMessage: '🎤 Voice note',
        lastAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessageSenderName: 'Master Timothy',
        ...unreadInc,
      });
      await batch.commit();
    } catch (err) {
      console.error('[gc] _sendTeacherVoiceNote error:', err);
      UI.toast('Failed to send voice note.', 'error');
    } finally {
      if (btn) btn.disabled = false;
      document.getElementById('gcTeacherInput')?.focus();
    }
  }

  /* ══════════════════════════════════════════════════════
     CREATE GROUP MODAL
  ══════════════════════════════════════════════════════ */
  function _openCreateGroupModal() {
    const existing = document.getElementById('gcCreateModal');
    if (existing) existing.remove();

    const students = (window.Teacher && Teacher._msgStudentCache) || [];

    const overlay = document.createElement('div');
    overlay.className = 'gc-modal-overlay';
    overlay.id = 'gcCreateModal';
    overlay.innerHTML = `
      <div class="gc-modal">
        <div class="gc-modal-header">
          <span style="font-size:.9375rem;font-weight:700;color:var(--text-1);">Create Group Chat</span>
          <button onclick="document.getElementById('gcCreateModal').remove()"
                  style="background:none;border:none;cursor:pointer;color:var(--text-3);
                         display:flex;align-items:center;padding:4px;border-radius:4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="gc-modal-body">
          <div>
            <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                          text-transform:uppercase;letter-spacing:.04em;margin-bottom:.375rem;">
              Group Name <span style="color:var(--danger);">*</span>
            </label>
            <input id="gcNewGroupName" type="text" placeholder="e.g. JSS2 Study Group"
                   style="width:100%;box-sizing:border-box;" maxlength="60" />
          </div>
          <div>
            <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                          text-transform:uppercase;letter-spacing:.04em;margin-bottom:.375rem;">
              Description <span style="font-weight:400;text-transform:none;color:var(--text-4);">— optional</span>
            </label>
            <input id="gcNewGroupDesc" type="text" placeholder="What is this group for?"
                   style="width:100%;box-sizing:border-box;" maxlength="120" />
          </div>
          <div>
            <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                          text-transform:uppercase;letter-spacing:.04em;margin-bottom:.375rem;">
              Restricted Words
              <span style="font-weight:400;text-transform:none;color:var(--text-4);">— comma separated</span>
            </label>
            <input id="gcNewGroupBanned" type="text" placeholder="e.g. spam, hate, fight"
                   style="width:100%;box-sizing:border-box;" />
            <p style="font-size:.6875rem;color:var(--text-4);margin-top:.25rem;line-height:1.5;">
              Messages containing these words will be silently blocked. Whole-word match only.
            </p>
          </div>
          <div>
            <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                          text-transform:uppercase;letter-spacing:.04em;margin-bottom:.375rem;">
              Add Members
            </label>
            <input id="gcMemberSearch" type="text" placeholder="Search students…"
                   oninput="GroupChat._filterCreateMembers()"
                   style="width:100%;box-sizing:border-box;margin-bottom:.375rem;" />
            <div style="display:flex;gap:.5rem;margin-bottom:.375rem;align-items:center;">
              <span id="gcCreateSelectedCount" style="font-size:var(--text-xs);color:var(--text-3);">0 selected</span>
              <span style="color:var(--border-strong);">·</span>
              <button onclick="GroupChat._selectAllCreateMembers()"
                      style="font-size:var(--text-xs);font-weight:600;color:var(--accent);
                             background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">
                Select all
              </button>
              <span style="color:var(--border-strong);">·</span>
              <button onclick="GroupChat._clearCreateMembers()"
                      style="font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                             background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">
                Clear
              </button>
            </div>
            <div id="gcCreateMemberList"
                 style="max-height:220px;overflow-y:auto;border:1px solid var(--border);
                        border-radius:8px;background:var(--bg-base);">
              ${_renderCreateMemberList(students, '')}
            </div>
          </div>
        </div>
        <div class="gc-modal-footer">
          <button onclick="document.getElementById('gcCreateModal').remove()"
                  class="btn bg-gray-500" style="flex:1;justify-content:center;">Cancel</button>
          <button id="gcCreateBtn" onclick="GroupChat._createGroup()"
                  class="btn" style="flex:1;justify-content:center;">Create Group</button>
        </div>
      </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    document.getElementById('gcNewGroupName')?.focus();
  }

  function _renderCreateMemberList(students, query) {
    const q        = (query || '').toLowerCase().trim();
    const filtered = q ? students.filter(s =>
      (s.name||'').toLowerCase().includes(q) || (s.cls||'').toLowerCase().includes(q)
    ) : students;

    if (!filtered.length) {
      return `<p style="font-size:.8125rem;color:var(--text-4);text-align:center;padding:1.5rem;">No students found.</p>`;
    }

    return filtered.map((s, idx) => `
      <label style="display:flex;align-items:center;gap:.625rem;padding:.4375rem .75rem;
                    cursor:pointer;border-bottom:${idx<filtered.length-1?'1px solid var(--border)':'none'};"
             onmouseenter="this.style.background='var(--accent-subtle)'"
             onmouseleave="this.style.background=''">
        <input type="checkbox" class="gc-create-member-cb" value="${_escAttr(s.id)}"
               data-name="${_escAttr(s.name||'')}" data-cls="${_escAttr(s.cls||'')}"
               onchange="GroupChat._updateCreateCount()"
               style="width:.9375rem;height:.9375rem;accent-color:var(--accent);flex-shrink:0;cursor:pointer;" />
        <div class="gc-member-av" style="width:28px;height:28px;font-size:.6875rem;flex-shrink:0;">
          ${_esc((s.name||'?').charAt(0).toUpperCase())}
        </div>
        <span style="font-size:.875rem;font-weight:600;color:var(--text-1);flex:1;
                     white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${_esc(s.name||'Unknown')}
          <span style="font-size:.6875rem;font-weight:400;color:var(--text-3);margin-left:.25rem;">
            ${_esc(s.cls||'')}
          </span>
        </span>
      </label>`).join('');
  }

  function _filterCreateMembers() {
    const search   = document.getElementById('gcMemberSearch')?.value || '';
    const list     = document.getElementById('gcCreateMemberList');
    if (!list) return;
    const students = (window.Teacher && Teacher._msgStudentCache) || [];
    const checked  = new Set([...document.querySelectorAll('.gc-create-member-cb:checked')].map(cb => cb.value));
    list.innerHTML = _renderCreateMemberList(students, search);
    document.querySelectorAll('.gc-create-member-cb').forEach(cb => {
      if (checked.has(cb.value)) cb.checked = true;
    });
    _updateCreateCount();
  }

  function _updateCreateCount() {
    const count = document.querySelectorAll('.gc-create-member-cb:checked').length;
    const el    = document.getElementById('gcCreateSelectedCount');
    if (el) el.textContent = count + ' selected';
  }

  function _selectAllCreateMembers() {
    document.querySelectorAll('.gc-create-member-cb').forEach(cb => { cb.checked = true; });
    _updateCreateCount();
  }

  function _clearCreateMembers() {
    document.querySelectorAll('.gc-create-member-cb').forEach(cb => { cb.checked = false; });
    _updateCreateCount();
  }

  async function _createGroup() {
    const name = document.getElementById('gcNewGroupName')?.value.trim();
    if (!name) { UI.toast('Please enter a group name.', 'warning'); return; }

    const desc        = document.getElementById('gcNewGroupDesc')?.value.trim() || '';
    const bannedRaw   = document.getElementById('gcNewGroupBanned')?.value || '';
    const bannedWords = bannedRaw.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);

    const checkedCbs = [...document.querySelectorAll('.gc-create-member-cb:checked')];
    if (checkedCbs.length === 0) { UI.toast('Add at least one member.', 'warning'); return; }

    const members   = checkedCbs.map(cb => ({ uid: cb.value, name: cb.dataset.name, cls: cb.dataset.cls }));
    const memberUids = members.map(m => m.uid);

    const btn = document.getElementById('gcCreateBtn');
    UI.setLoading(btn, true);

    try {
      await Db().collection('groupChats').add({
        name,
        createdBy:   TEACHER_UID(),
        createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
        members,
        memberUids,
        mutedUids:   [],
        settings: {
          description: desc,
          bannedWords,
        },
        lastMessage:          '',
        lastAt:               firebase.firestore.FieldValue.serverTimestamp(),
        lastMessageSenderName: '',
        unread:               {},
        typing:               {},
      });

      document.getElementById('gcCreateModal')?.remove();
      UI.toast(`Group "${name}" created with ${members.length} member${members.length!==1?'s':''}.`, 'success');
    } catch (err) {
      console.error('[gc] _createGroup error:', err);
      UI.toast('Failed to create group.', 'error');
    } finally {
      UI.setLoading(btn, false);
    }
  }

  /* ══════════════════════════════════════════════════════
     GROUP SETTINGS MODAL (teacher only)
  ══════════════════════════════════════════════════════ */
  async function _openGroupSettingsModal(groupId) {
    const snap = await Db().collection('groupChats').doc(groupId).get().catch(() => null);
    if (!snap || !snap.exists) { UI.toast('Group not found.', 'error'); return; }
    const g = snap.data();
    _activeGroupData = g;

    const existing = document.getElementById('gcSettingsModal');
    if (existing) existing.remove();

    const students   = (window.Teacher && Teacher._msgStudentCache) || [];
    const mutedUids  = g.mutedUids || [];
    const members    = g.members || [];
    const memberUids = g.memberUids || [];
    const bannedStr  = ((g.settings && g.settings.bannedWords) || []).join(', ');

    const overlay = document.createElement('div');
    overlay.className = 'gc-modal-overlay';
    overlay.id = 'gcSettingsModal';
    overlay.innerHTML = `
      <div class="gc-modal" style="width:min(560px,95vw);">
        <div class="gc-modal-header">
          <span style="font-size:.9375rem;font-weight:700;color:var(--text-1);">
            Group Settings — ${_esc(g.name)}
          </span>
          <button onclick="document.getElementById('gcSettingsModal').remove()"
                  style="background:none;border:none;cursor:pointer;color:var(--text-3);
                         display:flex;align-items:center;padding:4px;border-radius:4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="gc-modal-body">

          <!-- Basic info -->
          <div>
            <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                          text-transform:uppercase;letter-spacing:.04em;margin-bottom:.375rem;">Group Name</label>
            <input id="gcSetName" type="text" value="${_escAttr(g.name||'')}"
                   style="width:100%;box-sizing:border-box;" maxlength="60" />
          </div>
          <div>
            <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                          text-transform:uppercase;letter-spacing:.04em;margin-bottom:.375rem;">Description</label>
            <input id="gcSetDesc" type="text"
                   value="${_escAttr((g.settings && g.settings.description) || '')}"
                   style="width:100%;box-sizing:border-box;" maxlength="120" />
          </div>
          <div>
            <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                          text-transform:uppercase;letter-spacing:.04em;margin-bottom:.375rem;">
              Restricted Words
              <span style="font-weight:400;text-transform:none;color:var(--text-4);">— comma separated</span>
            </label>
            <input id="gcSetBanned" type="text" value="${_escAttr(bannedStr)}"
                   style="width:100%;box-sizing:border-box;" />
          </div>

          <!-- Current members -->
          <div>
            <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                          text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem;">
              Members (${members.length})
            </label>
            <div id="gcSettingsMemberList" style="display:flex;flex-direction:column;gap:.375rem;">
              ${members.map(m => {
                const isMuted = mutedUids.includes(m.uid);
                return `
                  <div class="gc-member-row" id="gcMemberRow-${_escAttr(m.uid)}">
                    <div class="gc-member-av">${_esc((m.name||'?').charAt(0).toUpperCase())}</div>
                    <div style="flex:1;min-width:0;">
                      <div class="gc-member-name">${_esc(m.name||'Unknown')}</div>
                    </div>
                    <span class="gc-member-cls">${_esc(m.cls||'')}</span>
                    ${isMuted ? `<span class="gc-member-muted-badge">Muted</span>` : ''}
                    <button onclick="GroupChat._toggleMuteMember('${_escAttr(groupId)}','${_escAttr(m.uid)}','${_escAttr(m.name||'')}',${isMuted})"
                            style="font-size:var(--text-xs);font-weight:600;padding:3px 10px;border-radius:5px;
                                   border:1px solid ${isMuted ? 'var(--success-border)' : 'var(--warning-border)'};
                                   background:${isMuted ? 'var(--success-subtle)' : 'var(--warning-subtle)'};
                                   color:${isMuted ? 'var(--success-text)' : 'var(--warning-text)'};
                                   cursor:pointer;font-family:var(--font);white-space:nowrap;"
                            id="gcMuteBtn-${_escAttr(m.uid)}">
                      ${isMuted ? 'Unmute' : 'Mute'}
                    </button>
                    <button onclick="GroupChat._removeMemberFromGroup('${_escAttr(groupId)}','${_escAttr(m.uid)}','${_escAttr(m.name||'')}')"
                            style="background:none;border:none;cursor:pointer;font-size:1rem;
                                   line-height:1;padding:2px 4px;color:var(--text-4);"
                            onmouseenter="this.style.color='var(--danger)'"
                            onmouseleave="this.style.color='var(--text-4)'">×</button>
                  </div>`;
              }).join('')}
            </div>
          </div>

          <!-- Add members -->
          <div>
            <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                          text-transform:uppercase;letter-spacing:.04em;margin-bottom:.375rem;">
              Add Members
            </label>
            <input id="gcAddMemberSearch" type="text" placeholder="Search students to add…"
                   oninput="GroupChat._filterAddMembers('${_escAttr(groupId)}')"
                   style="width:100%;box-sizing:border-box;margin-bottom:.375rem;" />
            <div id="gcAddMemberList"
                 style="max-height:160px;overflow-y:auto;border:1px solid var(--border);
                        border-radius:8px;background:var(--bg-base);">
              ${_renderAddMemberList(students, memberUids, '')}
            </div>
            <button id="gcAddMembersBtn" onclick="GroupChat._addSelectedMembers('${_escAttr(groupId)}')"
                    class="btn" style="margin-top:.5rem;font-size:var(--text-sm);width:100%;justify-content:center;">
              Add Selected Members
            </button>
          </div>

          <!-- Danger zone -->
          <div style="padding:.875rem;border:1px solid var(--danger-border);border-radius:8px;
                      background:var(--danger-subtle);">
            <p style="font-size:.8125rem;font-weight:700;color:var(--danger);margin-bottom:.625rem;">Danger Zone</p>
            <button onclick="GroupChat._deleteGroup('${_escAttr(groupId)}')"
                    class="btn bg-red-600 hover:bg-red-700"
                    style="font-size:var(--text-sm);">
              Delete This Group
            </button>
          </div>

        </div>
        <div class="gc-modal-footer">
          <button onclick="document.getElementById('gcSettingsModal').remove()"
                  class="btn bg-gray-500" style="flex:1;justify-content:center;">Cancel</button>
          <button id="gcSaveSettingsBtn" onclick="GroupChat._saveGroupSettings('${_escAttr(groupId)}')"
                  class="btn" style="flex:1;justify-content:center;">Save Settings</button>
        </div>
      </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  function _renderAddMemberList(students, existingUids, query) {
    const q        = (query || '').toLowerCase().trim();
    const notInGrp = students.filter(s => !existingUids.includes(s.id));
    const filtered = q ? notInGrp.filter(s =>
      (s.name||'').toLowerCase().includes(q) || (s.cls||'').toLowerCase().includes(q)
    ) : notInGrp;

    if (!filtered.length) {
      return `<p style="font-size:.8125rem;color:var(--text-4);text-align:center;padding:1rem;">
        ${notInGrp.length === 0 ? 'All students are already in this group.' : 'No students found.'}</p>`;
    }
    return filtered.map((s, idx) => `
      <label style="display:flex;align-items:center;gap:.625rem;padding:.4375rem .75rem;
                    cursor:pointer;border-bottom:${idx<filtered.length-1?'1px solid var(--border)':'none'};"
             onmouseenter="this.style.background='var(--accent-subtle)'"
             onmouseleave="this.style.background=''">
        <input type="checkbox" class="gc-add-member-cb" value="${_escAttr(s.id)}"
               data-name="${_escAttr(s.name||'')}" data-cls="${_escAttr(s.cls||'')}"
               style="width:.9375rem;height:.9375rem;accent-color:var(--accent);flex-shrink:0;cursor:pointer;" />
        <span style="font-size:.875rem;font-weight:600;color:var(--text-1);flex:1;
                     white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${_esc(s.name||'Unknown')}
          <span style="font-size:.6875rem;font-weight:400;color:var(--text-3);">${_esc(s.cls||'')}</span>
        </span>
      </label>`).join('');
  }

  function _filterAddMembers(groupId) {
    const snap_g    = _activeGroupData;
    const students  = (window.Teacher && Teacher._msgStudentCache) || [];
    const existing  = (snap_g && snap_g.memberUids) || [];
    const query     = document.getElementById('gcAddMemberSearch')?.value || '';
    const list      = document.getElementById('gcAddMemberList');
    if (list) list.innerHTML = _renderAddMemberList(students, existing, query);
  }

  async function _addSelectedMembers(groupId) {
    const checked = [...document.querySelectorAll('.gc-add-member-cb:checked')];
    if (!checked.length) { UI.toast('No students selected.', 'warning'); return; }

    const btn = document.getElementById('gcAddMembersBtn');
    UI.setLoading(btn, true);

    try {
      const snap = await Db().collection('groupChats').doc(groupId).get();
      if (!snap.exists) { UI.toast('Group not found.', 'error'); return; }
      const g          = snap.data();
      const curMembers = g.members    || [];
      const curUids    = g.memberUids || [];

      const newMembers = checked
        .filter(cb => !curUids.includes(cb.value))
        .map(cb => ({ uid: cb.value, name: cb.dataset.name, cls: cb.dataset.cls }));

      if (!newMembers.length) { UI.toast('All selected students are already in the group.', 'warning'); return; }

      const updatedMembers = [...curMembers, ...newMembers];
      const updatedUids    = [...curUids,    ...newMembers.map(m => m.uid)];

      await Db().collection('groupChats').doc(groupId).update({
        members:    updatedMembers,
        memberUids: updatedUids,
      });

      const evtRef  = Db().collection('groupChats').doc(groupId).collection('messages').doc();
      const names   = newMembers.map(m => m.name).join(', ');
      await Db().collection('groupChats').doc(groupId).collection('messages').doc().set({
        type:      'event',
        text:      `${names} ${newMembers.length > 1 ? 'were' : 'was'} added to the group.`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        deletedForAll: false,
      });

      _activeGroupData = (await Db().collection('groupChats').doc(groupId).get()).data();
      UI.toast(`${newMembers.length} member${newMembers.length!==1?'s':''} added.`, 'success');
      document.getElementById('gcSettingsModal')?.remove();
      _openGroupSettingsModal(groupId);
    } catch (err) {
      console.error('[gc] _addSelectedMembers error:', err);
      UI.toast('Failed to add members.', 'error');
    } finally {
      UI.setLoading(btn, false);
    }
  }

  function _showCustomConfirmation(title, message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    padding: 1rem;
    box-sizing: border-box;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: var(--bg-base);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.5rem;
    max-width: 420px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0,0,0,.3);
    box-sizing: border-box;
  `;

  modal.innerHTML = `
    <p style="font-size: 1rem; font-weight: 700; color: var(--text-1); margin: 0 0 0.75rem 0;">
      ${_esc(title)}
    </p>
    <p style="font-size: 0.875rem; color: var(--text-2); margin: 0 0 1.5rem 0; line-height: 1.6;">
      ${_esc(message)}
    </p>
    <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
      <button id="gcConfirmCancel" class="btn bg-gray-500" style="flex: 1; justify-content: center;">
        Cancel
      </button>
      <button id="gcConfirmOk" class="btn bg-red-600 hover:bg-red-700" style="flex: 1; justify-content: center;">
        Confirm
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById('gcConfirmCancel').onclick = () => {
    overlay.remove();
  };

  document.getElementById('gcConfirmOk').onclick = () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  };

  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

async function _removeMemberFromGroup(groupId, uid, name) {
  _showCustomConfirmation(
    'Remove Member',
    `Remove ${name} from this group?`,
    async () => {
      try {
        const snap = await Db().collection('groupChats').doc(groupId).get();
        if (!snap.exists) return;
        const g = snap.data();
        const newMembers = (g.members || []).filter(m => m.uid !== uid);
        const newUids = (g.memberUids || []).filter(id => id !== uid);
        const newMuted = (g.mutedUids || []).filter(id => id !== uid);

        await Db().collection('groupChats').doc(groupId).update({
          members: newMembers,
          memberUids: newUids,
          mutedUids: newMuted,
        });

        await Db().collection('groupChats').doc(groupId).collection('messages').doc().set({
          type: 'event',
          text: `${name} was removed from the group.`,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          deletedForAll: false,
        });

        _activeGroupData = (await Db().collection('groupChats').doc(groupId).get()).data();
        UI.toast(`${name} removed.`, 'success');
        document.getElementById('gcSettingsModal')?.remove();
        _openGroupSettingsModal(groupId);
      } catch (err) {
        console.error('[gc] _removeMemberFromGroup error:', err);
        UI.toast('Failed to remove member.', 'error');
      }
    }
  );
}

async function _deleteGroup(groupId) {
  _showCustomConfirmation(
    'Delete Group',
    'Permanently delete this group and ALL its messages? This cannot be undone.',
    async () => {
      try {
        const msgsSnap = await Db().collection('groupChats').doc(groupId).collection('messages').get();
        if (!msgsSnap.empty) {
          const refs = msgsSnap.docs.map(d => d.ref);
          for (let i = 0; i < refs.length; i += 400) {
            const batch = Db().batch();
            refs.slice(i, i + 400).forEach(r => batch.delete(r));
            await batch.commit();
          }
        }
        await Db().collection('groupChats').doc(groupId).delete();
        document.getElementById('gcSettingsModal')?.remove();
        _backToTeacherList();
        UI.toast('Group deleted.', 'success');
      } catch (err) {
        console.error('[gc] _deleteGroup error:', err);
        UI.toast('Failed to delete group.', 'error');
      }
    }
  );
}

  async function _toggleMuteMember(groupId, uid, name, currentlyMuted) {
    try {
      const snap = await Db().collection('groupChats').doc(groupId).get();
      if (!snap.exists) return;
      const g = snap.data();
      let mutedUids = g.mutedUids || [];

      if (currentlyMuted) {
        mutedUids = mutedUids.filter(id => id !== uid);
      } else {
        if (!mutedUids.includes(uid)) mutedUids.push(uid);
      }

      await Db().collection('groupChats').doc(groupId).update({ mutedUids });

      await Db().collection('groupChats').doc(groupId).collection('messages').doc().set({
        type:      'event',
        text:      currentlyMuted ? `${name} has been unmuted.` : `${name} has been muted.`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        deletedForAll: false,
      });

      _activeGroupData = (await Db().collection('groupChats').doc(groupId).get()).data();

      const newMuted = !currentlyMuted;
      const muteBtn = document.getElementById(`gcMuteBtn-${uid}`);
      const row     = document.getElementById(`gcMemberRow-${uid}`);
      if (muteBtn) {
        muteBtn.textContent = newMuted ? 'Unmute' : 'Mute';
        muteBtn.style.borderColor  = newMuted ? 'var(--success-border)' : 'var(--warning-border)';
        muteBtn.style.background   = newMuted ? 'var(--success-subtle)' : 'var(--warning-subtle)';
        muteBtn.style.color        = newMuted ? 'var(--success-text)'   : 'var(--warning-text)';
        muteBtn.setAttribute('onclick',
          `GroupChat._toggleMuteMember('${_escAttr(groupId)}','${_escAttr(uid)}','${_escAttr(name)}',${newMuted})`);
      }
      if (row) {
        const badge = row.querySelector('.gc-member-muted-badge');
        if (newMuted && !badge) {
          const b = document.createElement('span');
          b.className = 'gc-member-muted-badge';
          b.textContent = 'Muted';
          muteBtn?.before(b);
        } else if (!newMuted && badge) {
          badge.remove();
        }
      }

      UI.toast(`${name} ${newMuted ? 'muted' : 'unmuted'}.`, 'success');
    } catch (err) {
      console.error('[gc] _toggleMuteMember error:', err);
      UI.toast('Failed to update mute status.', 'error');
    }
  }

  async function _saveGroupSettings(groupId) {
    const name = document.getElementById('gcSetName')?.value.trim();
    if (!name) { UI.toast('Group name cannot be empty.', 'warning'); return; }
    const desc       = document.getElementById('gcSetDesc')?.value.trim() || '';
    const bannedRaw  = document.getElementById('gcSetBanned')?.value || '';
    const bannedWords = bannedRaw.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);

    const btn = document.getElementById('gcSaveSettingsBtn');
    UI.setLoading(btn, true);
    try {
      await Db().collection('groupChats').doc(groupId).update({
        name,
        'settings.description': desc,
        'settings.bannedWords': bannedWords,
      });
      _activeGroupData = { ..._activeGroupData, name, settings: { ...(_activeGroupData?.settings||{}), description: desc, bannedWords } };
      UI.toast('Group settings saved.', 'success');
      document.getElementById('gcSettingsModal')?.remove();

      const headerName = document.querySelector('#gcTeacherChatView p[style*="font-weight:700"]');
      if (headerName) headerName.textContent = name;
    } catch (err) {
      console.error('[gc] _saveGroupSettings error:', err);
      UI.toast('Failed to save settings.', 'error');
    } finally {
      UI.setLoading(btn, false);
    }
  }

  /* ══════════════════════════════════════════════════════
     UNREAD BADGE — student nav button
  ══════════════════════════════════════════════════════ */
  function _updateGroupBadge(uid) {
    const btn = document.getElementById('gcOpenBtn');
    if (!btn) return;

    Db().collection('groupChats')
      .where('memberUids', 'array-contains', uid)
      .get()
      .then(snap => {
        let total = 0;
        snap.forEach(doc => { total += (doc.data().unread && doc.data().unread[uid]) || 0; });
        const existing = btn.querySelector('.gc-nav-badge');
        if (existing) existing.remove();
        if (total > 0) {
          const badge = document.createElement('span');
          badge.className = 'gc-nav-badge';
          badge.textContent = total > 9 ? '9+' : String(total);
          badge.style.cssText = [
            'position:absolute','top:-6px','right:-6px','min-width:18px','height:18px',
            'background:var(--danger)','color:#fff','font-size:.625rem','font-weight:700',
            'border-radius:99px','display:flex','align-items:center','justify-content:center',
            'padding:0 4px','pointer-events:none','border:2px solid var(--bg-base)','line-height:1',
          ].join(';');
          btn.style.position = 'relative';
          btn.appendChild(badge);
        }
      }).catch(() => {});
  }

  /* ── Init unread listener for student ──────────────── */
  function initStudentGroupListener(uid) {
    _cancel('gcStudentUnread');
    const unsub = Db()
      .collection('groupChats')
      .where('memberUids', 'array-contains', uid)
      .onSnapshot(snap => {
        let total = 0;
        snap.forEach(doc => { total += (doc.data().unread && doc.data().unread[uid]) || 0; });
        const btn = document.getElementById('gcOpenBtn');
        if (!btn) return;
        const existing = btn.querySelector('.gc-nav-badge');
        if (existing) existing.remove();
        if (total > 0) {
          const badge = document.createElement('span');
          badge.className = 'gc-nav-badge';
          badge.textContent = total > 9 ? '9+' : String(total);
          badge.style.cssText = [
            'position:absolute','top:-6px','right:-6px','min-width:18px','height:18px',
            'background:var(--danger)','color:#fff','font-size:.625rem','font-weight:700',
            'border-radius:99px','display:flex','align-items:center','justify-content:center',
            'padding:0 4px','pointer-events:none','border:2px solid var(--bg-base)','line-height:1',
          ].join(';');
          btn.style.position = 'relative';
          btn.appendChild(badge);
        }
      }, err => console.warn('[gc] Student unread listener error:', err));
    _reg('gcStudentUnread', unsub);
  }

  /* ── Cleanup ───────────────────────────────────────── */
  function cancelListeners() {
    if (_typingActive && _typingGroupId) {
      const uid = AppState.isTeacher ? TEACHER_UID() : AppState.userId;
      if (uid) _stopTyping(_typingGroupId, uid).catch(() => {});
    }
    Object.keys(_listeners).forEach(k => _cancel(k));
    _activeGroupId   = null;
    _activeGroupData = null;
    _replyTo         = null;
    _unsubscribeMemberPresence();
    _memberPresenceCache = {};
    stopPresence();
  }

  /* ── Public API ────────────────────────────────────── */
  window.GroupChat = {
    openForStudent,
    openForTeacher,
    cancelListeners,
    initStudentGroupListener,
    initPresence,
    stopPresence,
    _isGroupChatOpen,
    _openStudentChat,
    _backToStudentList,
    _backFromStudent,
    _sendStudentMessage,
    _sendTeacherMessage,
    _showGroupInfo,
    _scrollToMsg,
    _clearReply,
    _openCreateGroupModal,
    _filterCreateMembers,
    _updateCreateCount,
    _selectAllCreateMembers,
    _clearCreateMembers,
    _createGroup,
    _openGroupSettingsModal,
    _filterAddMembers,
    _addSelectedMembers,
    _removeMemberFromGroup,
    _toggleMuteMember,
    _saveGroupSettings,
    _deleteGroup,
    _openTeacherChat,
    _backToTeacherList,
    _toggleActionMenu,
    _showEditHistory,
    _scrollToMsg,
  };

}());
