/* ============================================================
   js/msgnotif.js — In-App Direct Message Notification System
   ============================================================
   Renders WhatsApp-style toast popups for incoming DMs.
   
   Rules:
   - Students: suppressed during exam (exam.step==='exam') and
     when Study Room modal is active. Never suppressed for teacher.
   - If the target thread's inbox is already open → suppress.
   - Multiple rapid messages → grouped into one notification.
   - Messages that arrived while offline → shown on reconnect.
   - Max 3 stacked toasts; extras queue silently.
   - Each toast: 6s auto-dismiss, swipe/click-to-dismiss.
   ============================================================ */
(function () {
  'use strict';

  /* ── Constants ── */
  const MAX_VISIBLE       = 3;
  const DISMISS_AFTER_MS  = 6000;
  const BATCH_WINDOW_MS   = 400;   // group messages arriving within this window
  const CONTAINER_ID      = 'msgNotifContainer';

  /* ── State ── */
  let _queue              = [];     // pending notifications not yet shown
  let _visible            = [];     // currently visible toast elements
  let _batchBuffer        = {};     // { threadUid: [msg, ...] } for grouping
  let _batchTimers        = {};     // { threadUid: timeoutId }
  let _baseline           = {};     // { threadUid: Set<messageId> } — IDs seen at attach time
  let _listeners          = {};     // { key: unsubFn }
  let _initialized        = false;
  let _role               = null;   // 'student' | 'teacher'
  let _myUid              = null;

  /* ── Suppression check ── */
  function _isSuppressed(threadUid) {
    // Teacher is never suppressed
    if (_role === 'teacher') {
      // But suppress if that exact thread's chat view is open
      return window._dmActiveUid === threadUid &&
             !!document.getElementById('dmTeacherMessages');
    }

    // Student: suppress during exam
    const exam = window.AppState && window.AppState.exam;
    if (exam && exam.step === 'exam') return true;

    // Student: suppress if study room modal is open
    if (document.getElementById('studyRoomModal') ||
        document.getElementById('studyroomModal') ||
        document.querySelector('[id*="studyroom"][id*="modal"]') ||
        document.querySelector('[id*="StudyRoom"][id*="modal"]')) {
      return true;
    }

    // Student: suppress if inbox is open (already reading)
    if (document.getElementById('dmMessages')) return true;

    return false;
  }

  /* ── Container ── */
  function _ensureContainer() {
    let c = document.getElementById(CONTAINER_ID);
    if (!c) {
      c = document.createElement('div');
      c.id = CONTAINER_ID;
      c.setAttribute('aria-live', 'polite');
      c.setAttribute('aria-atomic', 'false');
      c.style.cssText = [
        'position:fixed',
        'bottom:1.25rem',
        'right:1.25rem',
        'z-index:8500',
        'display:flex',
        'flex-direction:column-reverse',
        'gap:.5rem',
        'max-width:340px',
        'width:calc(100vw - 2.5rem)',
        'pointer-events:none',
      ].join(';');
      document.body.appendChild(c);
    }
    return c;
  }

  /* ── Styles ── */
  function _injectStyles() {
    if (document.getElementById('_msgNotifStyles')) return;
    const s = document.createElement('style');
    s.id = '_msgNotifStyles';
    s.textContent = `
      #msgNotifContainer { box-sizing:border-box; }

      .msg-notif-toast {
        pointer-events:auto;
        display:flex;
        align-items:flex-start;
        gap:.625rem;
        padding:.75rem .875rem;
        border-radius:14px;
        background:var(--bg-base,#fff);
        border:1px solid var(--border,#e5e7eb);
        box-shadow:0 8px 28px rgba(0,0,0,.14),0 2px 8px rgba(0,0,0,.08);
        cursor:pointer;
        user-select:none;
        min-width:0;
        max-width:100%;
        box-sizing:border-box;
        animation:msgNotifIn .3s cubic-bezier(.34,1.45,.64,1) both;
        position:relative;
        overflow:hidden;
        border-left:3px solid var(--accent,#4f6ef7);
        transition:transform .15s ease, opacity .15s ease;
      }
      .msg-notif-toast:hover { transform:translateY(-2px);box-shadow:0 12px 36px rgba(0,0,0,.16); }
      .msg-notif-toast.is-out { animation:msgNotifOut .25s ease-in both; }

      .msg-notif-toast--teacher { border-left-color:#7c3aed; }
      .msg-notif-toast--student { border-left-color:var(--accent,#4f6ef7); }

      .msg-notif-progress {
        position:absolute;
        bottom:0; left:0;
        height:2px;
        background:var(--accent,#4f6ef7);
        border-radius:0 0 0 14px;
        animation:msgNotifProgress var(--notif-duration,6000ms) linear both;
        transform-origin:left;
      }
      .msg-notif-toast--teacher .msg-notif-progress { background:#7c3aed; }

      .msg-notif-av {
        flex-shrink:0;
        width:38px; height:38px;
        border-radius:50%;
        background:var(--accent-subtle,rgba(79,110,247,.1));
        border:1.5px solid var(--accent-border,rgba(79,110,247,.25));
        display:flex; align-items:center; justify-content:center;
        font-size:.875rem; font-weight:700;
        color:var(--accent-text,#2d49d6);
      }
      .msg-notif-toast--teacher .msg-notif-av {
        background:#f5f3ff; border-color:#ddd6fe; color:#7c3aed;
      }

      .msg-notif-bd { flex:1; min-width:0; }
      .msg-notif-header {
        display:flex; align-items:center; justify-content:space-between;
        gap:.375rem; margin-bottom:2px;
      }
      .msg-notif-name {
        font-size:.8125rem; font-weight:700; color:var(--text-1,#0d0d0f);
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        flex:1; min-width:0;
      }
      .msg-notif-time {
        font-size:.6rem; color:var(--text-4,#9ca3af);
        flex-shrink:0; white-space:nowrap; line-height:1;
      }
      .msg-notif-preview {
        font-size:.8125rem; color:var(--text-3,#6b7280);
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        line-height:1.4;
      }
      .msg-notif-badge {
        display:inline-flex; align-items:center;
        font-size:.5625rem; font-weight:700;
        background:var(--accent,#4f6ef7); color:#fff;
        border-radius:99px; padding:1px 6px; margin-left:4px;
        flex-shrink:0; line-height:1.4;
      }
      .msg-notif-toast--teacher .msg-notif-badge { background:#7c3aed; }

      .msg-notif-dismiss {
        flex-shrink:0; background:none; border:none; cursor:pointer;
        color:var(--text-4,#9ca3af); font-size:.875rem; line-height:1;
        padding:0; display:flex; align-items:center; opacity:.6;
        transition:opacity .12s;
        pointer-events:auto;
      }
      .msg-notif-dismiss:hover { opacity:1; }

      .msg-notif-app-label {
        font-size:.5625rem; font-weight:600; letter-spacing:.06em;
        text-transform:uppercase; color:var(--accent-text,#2d49d6);
        margin-bottom:1px; display:block; line-height:1;
      }
      .msg-notif-toast--teacher .msg-notif-app-label { color:#7c3aed; }

      @keyframes msgNotifIn {
        from { opacity:0; transform:translateX(110%) scale(.92); }
        to   { opacity:1; transform:translateX(0)    scale(1);   }
      }
      @keyframes msgNotifOut {
        from { opacity:1; transform:translateX(0)    scale(1);   max-height:200px; margin-bottom:0; }
        to   { opacity:0; transform:translateX(110%) scale(.92); max-height:0;     margin-bottom:-.5rem; }
      }
      @keyframes msgNotifProgress {
        from { width:100%; }
        to   { width:0%;   }
      }

      @media (max-width:480px) {
        #msgNotifContainer {
          right:.75rem;
          bottom:.875rem;
          max-width:calc(100vw - 1.5rem);
          width:calc(100vw - 1.5rem);
        }
        .msg-notif-toast { border-radius:12px; }
      }

      [data-theme="dark"] .msg-notif-toast {
        background:var(--bg-subtle,#18181b);
        border-color:var(--border,#2a2a30);
        box-shadow:0 8px 28px rgba(0,0,0,.5),0 2px 8px rgba(0,0,0,.4);
      }
    `;
    document.head.appendChild(s);
  }

  /* ── Escape helper ── */
  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Time label ── */
  function _timeLabel(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  /* ── Show a notification ── */
  function _showNotification({ senderName, preview, count, threadUid, isTeacherSender, latestTs }) {
    const container = _ensureContainer();
    count = count || 1;

    // If already MAX_VISIBLE shown, queue it
    if (_visible.length >= MAX_VISIBLE) {
      _queue.push({ senderName, preview, count, threadUid, isTeacherSender, latestTs });
      return;
    }

    const avatarLetter = (senderName || '?').charAt(0).toUpperCase();
    const toastClass   = isTeacherSender ? 'msg-notif-toast--teacher' : 'msg-notif-toast--student';
    const timeStr      = _timeLabel(latestTs);
    const countBadge   = count > 1
      ? `<span class="msg-notif-badge">${count} new</span>`
      : '';

    const toast = document.createElement('div');
    toast.className = `msg-notif-toast ${toastClass}`;
    toast.setAttribute('role', 'alert');
    toast.style.setProperty('--notif-duration', DISMISS_AFTER_MS + 'ms');

    toast.innerHTML = `
      <div class="msg-notif-av">${_esc(avatarLetter)}</div>
      <div class="msg-notif-bd">
        <span class="msg-notif-app-label">New Message</span>
        <div class="msg-notif-header">
          <span class="msg-notif-name">${_esc(senderName)}${countBadge}</span>
          <span class="msg-notif-time">${_esc(timeStr)}</span>
        </div>
        <p class="msg-notif-preview">${_esc(preview)}</p>
      </div>
      <button class="msg-notif-dismiss" aria-label="Dismiss">&#x2715;</button>
      <div class="msg-notif-progress"></div>`;

    // Click → navigate to conversation
    toast.addEventListener('click', (e) => {
      if (e.target.closest('.msg-notif-dismiss')) return;
      _dismiss(toast);
      _navigateToThread(threadUid, senderName);
    });

    toast.querySelector('.msg-notif-dismiss').addEventListener('click', (e) => {
      e.stopPropagation();
      _dismiss(toast);
    });

    // Touch-swipe right to dismiss
    let _touchStartX = 0;
    toast.addEventListener('touchstart', (e) => { _touchStartX = e.touches[0].clientX; }, { passive: true });
    toast.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - _touchStartX;
      if (dx > 60) _dismiss(toast);
    }, { passive: true });

    container.appendChild(toast);
    _visible.push(toast);

    // Auto-dismiss
    const timer = setTimeout(() => _dismiss(toast), DISMISS_AFTER_MS);
    toast._dismissTimer = timer;

    // Pause auto-dismiss on hover
    toast.addEventListener('mouseenter', () => {
      clearTimeout(toast._dismissTimer);
      const bar = toast.querySelector('.msg-notif-progress');
      if (bar) bar.style.animationPlayState = 'paused';
    });
    toast.addEventListener('mouseleave', () => {
      const bar = toast.querySelector('.msg-notif-progress');
      if (bar) bar.style.animationPlayState = 'running';
      toast._dismissTimer = setTimeout(() => _dismiss(toast), 2000);
    });
  }

  /* ── Dismiss a toast ── */
  function _dismiss(toast) {
    clearTimeout(toast._dismissTimer);
    if (!toast.isConnected) return;
    toast.classList.add('is-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
      _visible = _visible.filter(t => t !== toast);
      // Show next queued item
      if (_queue.length > 0) {
        const next = _queue.shift();
        _showNotification(next);
      }
    }, { once: true });
  }

  /* ── Navigate to thread when notification clicked ── */
  function _navigateToThread(threadUid, senderName) {
    if (_role === 'teacher') {
      // Switch to DM tab and open the conversation
      if (window.Teacher && typeof Teacher.showTab === 'function') {
        Teacher.showTab('dm');
        setTimeout(() => {
          if (window.DM && typeof DM._openConversation === 'function') {
            const student = (window.Teacher._msgStudentCache || []).find(s => s.id === threadUid);
            DM._openConversation(threadUid, senderName, student ? student.cls : '');
          }
        }, 180);
      }
    } else {
      // Open student DM inbox
      if (window.DM && typeof DM.openStudentInbox === 'function') {
        DM.openStudentInbox();
      }
    }
  }

  /* ── Flush batch buffer for a thread ── */
  function _flushBatch(threadUid) {
    const msgs = _batchBuffer[threadUid] || [];
    delete _batchBuffer[threadUid];
    delete _batchTimers[threadUid];
    if (!msgs.length) return;

    if (_isSuppressed(threadUid)) return;

    const latest = msgs[msgs.length - 1];
    const senderName = latest.senderName || (latest.role === 'teacher' ? 'Master Timothy' : 'Student');
    const preview = msgs.length === 1
      ? (latest.text || '')
      : `${msgs.length} new messages`;

    _showNotification({
      senderName,
      preview,
      count: msgs.length,
      threadUid,
      isTeacherSender: latest.role === 'teacher',
      latestTs: latest.timestamp,
    });
  }

  /* ── Buffer an incoming message ── */
  function _bufferMessage(threadUid, msg) {
    if (!_batchBuffer[threadUid]) _batchBuffer[threadUid] = [];
    _batchBuffer[threadUid].push(msg);

    if (_batchTimers[threadUid]) clearTimeout(_batchTimers[threadUid]);
    _batchTimers[threadUid] = setTimeout(() => _flushBatch(threadUid), BATCH_WINDOW_MS);
  }

  /* ── Attach listener for a single thread (student watching their own thread) ── */
  function _watchStudentThread(uid) {
    const key = 'msgNotif_student_' + uid;
    if (_listeners[key]) return; // already watching

    let baselineReady = false;

    const unsub = window.fbDb
      .collection('directMessages').doc(uid)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .onSnapshot(snap => {
        if (!baselineReady) {
          // Build baseline from first snapshot — these are "already seen"
          _baseline[uid] = new Set();
          snap.forEach(doc => _baseline[uid].add(doc.id));
          baselineReady = true;
          return;
        }

        // Any doc NOT in baseline AND sent by teacher = new notification candidate
        snap.docChanges().forEach(change => {
          if (change.type !== 'added') return;
          const doc = change.doc;
          if (_baseline[uid] && _baseline[uid].has(doc.id)) return; // already known
          if (_baseline[uid]) _baseline[uid].add(doc.id);

          const data = doc.data();
          if (data.role !== 'teacher') return; // only notify student of teacher messages
          _bufferMessage(uid, { id: doc.id, ...data });
        });
      }, err => console.warn('[MsgNotif] Student thread watch error:', err));

    _listeners[key] = unsub;
  }

  /* ── Attach listeners for ALL student threads (teacher watching) ── */
  function _watchAllThreadsForTeacher() {
    const key = 'msgNotif_teacher_allThreads';
    if (_listeners[key]) return;

    // Track per-thread baselines
    const threadBaselines = {}; // { uid: { ready: bool, ids: Set } }

    const unsub = window.fbDb
      .collection('directMessages')
      .onSnapshot(snap => {
        snap.docChanges().forEach(change => {
          const threadUid = change.doc.id;

          // For new threads, attach a message sub-listener
          if (change.type === 'added' || change.type === 'modified') {
            const subKey = 'msgNotif_teacher_thread_' + threadUid;
            if (_listeners[subKey]) return; // already watching this thread

            let baselineReady = false;

            const subUnsub = window.fbDb
              .collection('directMessages').doc(threadUid)
              .collection('messages')
              .orderBy('timestamp', 'desc')
              .limit(50)
              .onSnapshot(msgSnap => {
                if (!baselineReady) {
                  threadBaselines[threadUid] = new Set();
                  msgSnap.forEach(doc => threadBaselines[threadUid].add(doc.id));
                  baselineReady = true;
                  return;
                }

                msgSnap.docChanges().forEach(msgChange => {
                  if (msgChange.type !== 'added') return;
                  const doc = msgChange.doc;
                  if (threadBaselines[threadUid] && threadBaselines[threadUid].has(doc.id)) return;
                  if (threadBaselines[threadUid]) threadBaselines[threadUid].add(doc.id);

                  const data = doc.data();
                  if (data.role !== 'student') return; // only notify teacher of student messages
                  _bufferMessage(threadUid, { id: doc.id, ...data });
                });
              }, err => console.warn('[MsgNotif] Teacher thread msg watch error:', err));

            _listeners[subKey] = subUnsub;
          }

          if (change.type === 'removed') {
            const subKey = 'msgNotif_teacher_thread_' + change.doc.id;
            if (_listeners[subKey]) {
              _listeners[subKey]();
              delete _listeners[subKey];
            }
          }
        });
      }, err => console.warn('[MsgNotif] Teacher thread list watch error:', err));

    _listeners[key] = unsub;
  }

  /* ── Public: init for student ── */
  function initForStudent(uid) {
    if (!uid || !window.fbDb) return;
    _injectStyles();
    _role       = 'student';
    _myUid      = uid;
    _initialized = true;
    _watchStudentThread(uid);
  }

  /* ── Public: init for teacher ── */
  function initForTeacher() {
    if (!window.fbDb) return;
    _injectStyles();
    _role        = 'teacher';
    _myUid       = window.AppConfig && AppConfig.TEACHER_UID;
    _initialized = true;
    _watchAllThreadsForTeacher();
  }

  /* ── Public: cancel all listeners (call on logout) ── */
  function cancel() {
    Object.keys(_listeners).forEach(k => {
      if (typeof _listeners[k] === 'function') _listeners[k]();
    });
    _listeners   = {};
    _baseline    = {};
    _batchBuffer = {};
    Object.values(_batchTimers).forEach(t => clearTimeout(t));
    _batchTimers = {};
    _queue       = [];
    _visible.forEach(t => { clearTimeout(t._dismissTimer); t.remove(); });
    _visible     = [];
    _initialized = false;
    _role        = null;
    _myUid       = null;
  }

  /* ── Public: dismiss all visible toasts (e.g. when entering exam) ── */
  function dismissAll() {
    [..._visible].forEach(t => _dismiss(t));
    _queue = [];
    Object.values(_batchTimers).forEach(t => clearTimeout(t));
    _batchTimers = {};
    _batchBuffer = {};
  }

  window.MsgNotif = { initForStudent, initForTeacher, cancel, dismissAll };

})();
