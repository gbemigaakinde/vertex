/* ============================================================
   js/tasks.js — Coaching task management
   ============================================================
   FIXES:
   1. listenForStudentUpdates() now returns a Promise that
      resolves only after BOTH loadCoachingTasks() AND
      loadStudentMessages() have completed their first fetch.
      This lets app.js await it before calling Exam.loadOrStart(),
      guaranteeing AppState.currentTaskConfig is populated before
      the subject selection screen reads it.
   2. renderTasksHTML() now displays the subject restriction list
      inside the student's task panel so students know which
      subjects are required before reaching the exam screen.
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
     ══════════════════════════════════════════════════════════ */
  function loadCoachingTasks() {
    const uid          = AppState.userId;
    const classStr     = (AppState.studentData || {}).class || '';
    const classDocId   = _classDocId(classStr);
    const studentDocId = uid ? _studentDocId(uid) : null;

    AppState.cancelListener('taskGlobal');
    AppState.cancelListener('taskClass');
    AppState.cancelListener('taskStudent');

    const _docs = { global: null, class: null, student: null };

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

    const unsubGlobal = Db()
      .collection('coachingTasks').doc('global')
      .onSnapshot(
        function(s) { _onSnap('global', s); },
        function(e) { _onErr('global',  e); }
      );
    AppState.registerListener('taskGlobal', unsubGlobal);

    const unsubClass = Db()
      .collection('coachingTasks').doc(classDocId)
      .onSnapshot(
        function(s) { _onSnap('class', s); },
        function(e) { _onErr('class',  e); }
      );
    AppState.registerListener('taskClass', unsubClass);

    if (studentDocId) {
      const unsubStudent = Db()
        .collection('coachingTasks').doc(studentDocId)
        .onSnapshot(
          function(s) { _onSnap('student', s); },
          function(e) { _onErr('student',  e); }
        );
      AppState.registerListener('taskStudent', unsubStudent);
    } else {
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
     loadStudentMessages
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

     FIX: Now returns a Promise that resolves only after BOTH
     loadCoachingTasks() AND loadStudentMessages() have
     completed their first fetch. app.js must await this before
     calling Exam.loadOrStart() so that AppState.currentTaskConfig
     is populated before the subject selection screen reads it.
     ══════════════════════════════════════════════════════════ */
  function listenForStudentUpdates() {
    const uid = AppState.userId;
    if (!uid) return Promise.resolve();

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

    // Return a single promise that resolves when BOTH initial fetches complete.
    // This is what app.js awaits before rendering the exam screen.
    return Promise.all([
      loadCoachingTasks().catch(function(err) {
        console.warn('[tasks] loadCoachingTasks error:', err);
      }),
      loadStudentMessages().catch(function(err) {
        console.warn('[tasks] loadStudentMessages error:', err);
      })
    ]);
  }

  /* ══════════════════════════════════════════════════════════
     renderTasksHTML

     FIX: Now shows the subject restriction list in the task
     panel so students can see which subjects are required
     before they reach the subject selection screen.
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

    // FIX: Build subject restriction notice if the task has allowedSubjects
    const hasSubjectRestriction = Array.isArray(currentTasks.allowedSubjects) &&
                                  currentTasks.allowedSubjects.length > 0;
    const subjectRestrictionHTML = hasSubjectRestriction
      ? '<div style="display:flex;align-items:flex-start;gap:.5rem;margin-top:var(--sp-3);' +
        'padding:.625rem .875rem;background:var(--warning-bg,#fff9db);' +
        'border:1px solid var(--warning-border,#ffec99);border-radius:var(--r-md);">' +
        '<span style="flex-shrink:0;font-size:1rem;">📚</span>' +
        '<div>' +
        '<p style="font-size:var(--text-xs);font-weight:700;color:var(--warning-text,#7c4a00);margin-bottom:2px;">Required subjects for this task</p>' +
        '<p style="font-size:var(--text-xs);color:var(--text-secondary,#374151);line-height:1.6;">' +
        currentTasks.allowedSubjects.map(_esc).join(', ') +
        '</p></div></div>'
      : '';

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
      datesHTML + '</div>' +
      subjectRestrictionHTML +   // FIX: subject restriction shown here
      '</div>';
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
