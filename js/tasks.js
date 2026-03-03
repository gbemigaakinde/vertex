/* ============================================================
   js/tasks.js — Coaching task management
   ============================================================
   TASK SCOPING (v3):
   Tasks can now target:
     • All students   → Firestore doc: coachingTasks/global
     • A class        → Firestore doc: coachingTasks/class_<classkey>
     • One student    → Firestore doc: coachingTasks/student_<uid>

   A student sees the MOST SPECIFIC active task that applies
   to them.  Priority (highest wins):
     student-specific  >  class-specific  >  global

   If the winning task is not active, the next level is tried.
   The student panel shows only one task at a time.

   Backward compat: the old coachingTasks/current doc is
   ignored.  Migrate by re-saving as coachingTasks/global.
   ============================================================ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     _localDateStr()  — local-timezone YYYY-MM-DD
     ══════════════════════════════════════════════════════════ */
  function _localDateStr(date) {
    const d = date || new Date();
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /* ══════════════════════════════════════════════════════════
     _classDocId(classStr)
     Converts a class name to its Firestore doc ID.
     Matches the classKey format used throughout the app.
     ══════════════════════════════════════════════════════════ */
  function _classDocId(classStr) {
    return 'class_' + (classStr || '').replace(/\s+/g, '').toLowerCase();
  }

  /* ══════════════════════════════════════════════════════════
     _studentDocId(uid)
     ══════════════════════════════════════════════════════════ */
  function _studentDocId(uid) {
    return 'student_' + uid;
  }

  /* ══════════════════════════════════════════════════════════
     loadCoachingTasks

     Subscribes to up to three Firestore docs simultaneously:
       coachingTasks/global
       coachingTasks/class_<studentClass>
       coachingTasks/student_<uid>

     Whenever any of them changes, _resolveTask() picks the
     most specific active one and stores it in
     AppState.currentTaskConfig, then re-renders the panel.

     Returns a Promise that resolves once all three initial
     values have been received (or errored).
     ══════════════════════════════════════════════════════════ */
  function loadCoachingTasks() {
    const uid          = AppState.userId;
    const classStr     = (AppState.studentData || {}).class || '';
    const classDocId   = _classDocId(classStr);
    const studentDocId = uid ? _studentDocId(uid) : null;

    // Cancel any previous task listeners
    AppState.cancelListener('taskGlobal');
    AppState.cancelListener('taskClass');
    AppState.cancelListener('taskStudent');

    // Local cache of the three docs
    const _docs = { global: null, class: null, student: null };

    // Resolve once all initial snapshots have fired
    let _initialCount = 0;
    const _needed     = studentDocId ? 3 : 2;
    let   _resolveFn  = null;
    const promise     = new Promise(res => { _resolveFn = res; });

    function _onSnap(key, snap) {
      _docs[key] = snap.exists ? snap.data() : null;
      _initialCount++;
      _resolveTask(_docs);
      if (_initialCount >= _needed && _resolveFn) {
        _resolveFn();
        _resolveFn = null;
      }
    }

    function _onErr(key, err) {
      console.error('[tasks] coachingTasks/' + key + ' listener error:', err);
      _docs[key] = null;
      _initialCount++;
      if (_initialCount >= _needed && _resolveFn) {
        _resolveFn();
        _resolveFn = null;
      }
    }

    // Global listener
    const unsubGlobal = Db()
      .collection('coachingTasks').doc('global')
      .onSnapshot(
        function(s) { _onSnap('global', s); },
        function(e) { _onErr('global',  e); }
      );
    AppState.registerListener('taskGlobal', unsubGlobal);

    // Class listener
    const unsubClass = Db()
      .collection('coachingTasks').doc(classDocId)
      .onSnapshot(
        function(s) { _onSnap('class', s); },
        function(e) { _onErr('class',  e); }
      );
    AppState.registerListener('taskClass', unsubClass);

    // Student listener (only when uid is known)
    if (studentDocId) {
      const unsubStudent = Db()
        .collection('coachingTasks').doc(studentDocId)
        .onSnapshot(
          function(s) { _onSnap('student', s); },
          function(e) { _onErr('student',  e); }
        );
      AppState.registerListener('taskStudent', unsubStudent);
    } else {
      // No uid yet — count this slot as received so the promise
      // still resolves after the other two fire.
      _docs.student = null;
    }

    return promise;
  }

  /* ── Pick the most specific active task and store it ── */
  function _resolveTask(docs) {
    const resolved =
      (docs.student && docs.student.active ? docs.student : null) ||
      (docs.class   && docs.class.active   ? docs.class   : null) ||
      (docs.global  && docs.global.active  ? docs.global  : null) ||
      { active: false };

    AppState.currentTaskConfig = resolved;

    if (document.getElementById('tasksContainer')) {
      renderTasksHTML();
    }
  }

  /* ══════════════════════════════════════════════════════════
     loadStudentMessages  — client-side expiry filter
     (single-field query, no composite index required)
     ══════════════════════════════════════════════════════════ */
  async function loadStudentMessages() {
    const uid = AppState.userId;
    if (!uid) { AppState.studentMessages = []; return []; }

    try {
      const snap = await Db()
        .collection('privateMessages')
        .where('recipientId', '==', uid)
        .get();

      const now = Date.now();

      const messages = snap.docs
        .map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); })
        .filter(function(m) {
          if (!m.expiresAt) return true;
          const ms = m.expiresAt.toDate
            ? m.expiresAt.toDate().getTime()
            : new Date(m.expiresAt).getTime();
          return ms > now;
        })
        .sort(function(a, b) {
          const ta = a.sentAt && a.sentAt.toDate ? a.sentAt.toDate().getTime() : 0;
          const tb = b.sentAt && b.sentAt.toDate ? b.sentAt.toDate().getTime() : 0;
          return tb - ta;
        });

      AppState.studentMessages = messages;
      return messages;
    } catch (err) {
      console.error('[tasks] Failed to load private messages:', err);
      AppState.studentMessages = [];
      return [];
    }
  }

  /* ══════════════════════════════════════════════════════════
     listenForStudentUpdates

     Called once from app.js on every login path (fresh start
     AND exam resume). Keeps coachingCompleted in sync and
     bootstraps task + message loading so both paths always
     have the data they need.
     ══════════════════════════════════════════════════════════ */
  function listenForStudentUpdates() {
    const uid = AppState.userId;
    if (!uid) return;

    AppState.cancelListener('studentProfile');

    const unsub = Db()
      .collection('students').doc(uid)
      .onSnapshot(
        function(snap) {
          if (snap.exists) {
            AppState.studentData = Object.assign({}, AppState.studentData, snap.data());
            if (document.getElementById('tasksContainer')) {
              renderTasksHTML();
            }
          }
        },
        function(err) { console.error('[tasks] Student update listener error:', err); }
      );

    AppState.registerListener('studentProfile', unsub);

    loadCoachingTasks().catch(function(err) {
      console.warn('[tasks] loadCoachingTasks error:', err);
    });
    loadStudentMessages().catch(function(err) {
      console.warn('[tasks] loadStudentMessages error:', err);
    });
  }

  /* ══════════════════════════════════════════════════════════
     renderTasksHTML
     ══════════════════════════════════════════════════════════ */
  function renderTasksHTML() {
    const container = document.getElementById('tasksContainer');
    if (!container) return;

    const currentTasks = AppState.currentTaskConfig || {};
    const studentData  = AppState.studentData       || {};

    if (!currentTasks.active ||
        !Array.isArray(currentTasks.dates) ||
        currentTasks.dates.length === 0) {
      container.innerHTML = '';
      return;
    }

    const completed = studentData.coachingCompleted || {};
    const allDone   = currentTasks.dates.every(function(d) { return completed[d]; });

    const datesHTML = currentTasks.dates.map(function(dateStr) {
      const parts = dateStr.split('-');
      const date  = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      const formatted = date.toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short'
      });
      const isDone = !!completed[dateStr];
      return '<div style="background:' + (isDone ? 'var(--success-bg)' : 'var(--surface)') + ';' +
             'border:1px solid ' + (isDone ? 'var(--success-border)' : 'var(--border)') + ';' +
             'border-radius:var(--r-md);padding:0.625rem 0.875rem;text-align:center;">' +
             '<p style="font-size:var(--text-sm);font-weight:500;color:var(--text-secondary);">' +
             _esc(formatted) + '</p>' +
             '<p style="font-size:1.125rem;margin-top:4px;color:' +
             (isDone ? 'var(--success)' : 'var(--border-medium)') + ';">' +
             (isDone ? '✓' : '○') + '</p>' +
             '<p style="font-size:var(--text-xs);color:' +
             (isDone ? 'var(--success-text)' : 'var(--text-disabled)') + ';margin-top:2px;">' +
             (isDone ? 'Done' : 'Pending') + '</p></div>';
    }).join('');

    const messageSafe = _esc(
      currentTasks.message || 'Complete the tests on these dates to mark them done!'
    )
      .replace(/\n\n/g, '</p><p style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.7;margin-bottom:var(--sp-3);">')
      .replace(/\n/g, '<br>');

    container.innerHTML =
      '<div style="background:var(--brand-bg);border:1px solid var(--brand-border);' +
      'border-radius:var(--r-xl);padding:var(--sp-5);margin-bottom:var(--sp-5);">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3);">' +
      '<h3 style="font-size:var(--text-lg);font-weight:700;color:var(--brand-text);">' +
      _esc(currentTasks.title || 'Coaching Tasks') + '</h3>' +
      (allDone
        ? '<span style="font-size:var(--text-xs);font-weight:700;color:var(--success-text);' +
          'background:var(--success-bg);border:1px solid var(--success-border);' +
          'border-radius:99px;padding:2px 10px;">All complete ✓</span>'
        : '') +
      '</div>' +
      '<p style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.7;margin-bottom:var(--sp-4);">' +
      messageSafe + '</p>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:var(--sp-2);">' +
      datesHTML + '</div></div>';
  }

  /* ══════════════════════════════════════════════════════════
     cancelListeners
     ══════════════════════════════════════════════════════════ */
  function cancelListeners() {
    AppState.cancelListener('taskGlobal');
    AppState.cancelListener('taskClass');
    AppState.cancelListener('taskStudent');
    AppState.cancelListener('studentProfile');
  }

  /* ── Private helpers ── */
  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function Db() { return window.fbDb; }

  /* ── Expose ── */
  window.Tasks = {
    loadCoachingTasks,
    listenForStudentUpdates,
    loadStudentMessages,
    renderTasksHTML,
    cancelListeners,
    _localDateStr,
    _classDocId,
    _studentDocId,
  };

})();