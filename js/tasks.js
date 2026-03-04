/* ============================================================
   REPLACEMENT FUNCTIONS FOR js/tasks.js

   CHANGES:
   1. _resolveWeeklyDates() — NEW helper. For a weekly task,
      generates the concrete YYYY-MM-DD date for each scheduled
      day-of-week within the current Monday–Sunday week. This
      means the task automatically refreshes each week without
      any teacher action.

   2. loadCoachingTasks() — now listens to the 'weekly' doc in
      addition to global / class / student docs, and routes
      weekly task data through _resolveWeeklyDates() before
      merging.

   3. _resolveTask() — priority: student > class > weekly > global.
      Passes weekly docs through _resolveWeeklyDates().

   4. renderTasksHTML() — adds "missed" state (past dates not
      completed), better completion badge, and completion
      congratulations message.

   5. _localDateStr() unchanged — kept for reference.
   ============================================================ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     _localDateStr  — unchanged
     ══════════════════════════════════════════════════════════ */
  function _localDateStr(date) {
    const d = date || new Date();
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /* ══════════════════════════════════════════════════════════
     _classDocId / _studentDocId  — unchanged
     ══════════════════════════════════════════════════════════ */
  function _classDocId(classStr) {
    return 'class_' + (classStr || '').replace(/\s+/g, '').toLowerCase();
  }

  function _studentDocId(uid) {
    return 'student_' + uid;
  }

  /* ══════════════════════════════════════════════════════════
     _resolveWeeklyDates  — NEW
     
     Given a weekly task doc that contains:
       weeklyDays: ['Monday', 'Wednesday', 'Friday']   (day names)
       dateSubjects: { Monday: [...], Wednesday: [...] }  (subjects per day)
     
     Returns a NEW doc object with:
       dates: ['2025-03-03', '2025-03-05', '2025-03-07']  (concrete dates)
       dateSubjects: { '2025-03-03': [...], ... }          (mapped to dates)
     
     The concrete dates are always the occurrences within the
     CURRENT Monday–Sunday ISO week, so they refresh automatically.
     ══════════════════════════════════════════════════════════ */
  function _resolveWeeklyDates(weeklyDoc) {
    if (!weeklyDoc || !Array.isArray(weeklyDoc.weeklyDays)) return weeklyDoc;

    const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    // Find Monday of the current week (ISO week: Mon=start)
    const now       = new Date();
    const todayDow  = now.getDay(); // 0=Sun … 6=Sat
    const diffToMon = (todayDow === 0) ? -6 : 1 - todayDow;
    const monday    = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);

    const resolvedDates     = [];
    const resolvedSubjects  = {};

    weeklyDoc.weeklyDays.forEach(dayName => {
      const dowIndex = DAY_NAMES.indexOf(dayName);
      if (dowIndex === -1) return;

      // Offset from Monday: Mon=0 … Sun=6 in ISO, but JS Mon=1 Sun=0
      // Monday offset = 0, Tuesday = 1, … Saturday = 5, Sunday = 6
      const isoOffset = (dowIndex === 0) ? 6 : dowIndex - 1;
      const date      = new Date(monday);
      date.setDate(monday.getDate() + isoOffset);

      const dateStr = _localDateStr(date);
      resolvedDates.push(dateStr);

      // Map the day-name-keyed subjects to the concrete date key
      const subjectsForDay = (weeklyDoc.dateSubjects || {})[dayName] || [];
      resolvedSubjects[dateStr] = subjectsForDay;
    });

    // Sort chronologically
    resolvedDates.sort();

    return Object.assign({}, weeklyDoc, {
      dates:        resolvedDates,
      dateSubjects: resolvedSubjects,
      _isWeekly:    true,   // flag so renderTasksHTML knows it's a recurring task
    });
  }

  /* ══════════════════════════════════════════════════════════
     loadCoachingTasks  — FULL REPLACEMENT
     Now listens to 4 docs: global, class, student, weekly.
     ══════════════════════════════════════════════════════════ */
  function loadCoachingTasks() {
    const uid          = AppState.userId;
    const classStr     = (AppState.studentData || {}).class || '';
    const classDocId   = _classDocId(classStr);
    const studentDocId = uid ? _studentDocId(uid) : null;

    AppState.cancelListener('taskGlobal');
    AppState.cancelListener('taskClass');
    AppState.cancelListener('taskStudent');
    AppState.cancelListener('taskWeekly');

    const _docs = { global: null, class: null, student: null, weekly: null };

    let _initialCount = 0;
    const _needed     = studentDocId ? 4 : 3;
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
      .onSnapshot(s => _onSnap('global', s), e => _onErr('global', e));
    AppState.registerListener('taskGlobal', unsubGlobal);

    const unsubClass = Db()
      .collection('coachingTasks').doc(classDocId)
      .onSnapshot(s => _onSnap('class', s), e => _onErr('class', e));
    AppState.registerListener('taskClass', unsubClass);

    const unsubWeekly = Db()
      .collection('coachingTasks').doc('weekly')
      .onSnapshot(s => _onSnap('weekly', s), e => _onErr('weekly', e));
    AppState.registerListener('taskWeekly', unsubWeekly);

    if (studentDocId) {
      const unsubStudent = Db()
        .collection('coachingTasks').doc(studentDocId)
        .onSnapshot(s => _onSnap('student', s), e => _onErr('student', e));
      AppState.registerListener('taskStudent', unsubStudent);
    } else {
      _docs.student = null;
    }

    return promise;
  }

  /* ══════════════════════════════════════════════════════════
     _resolveTask  — FULL REPLACEMENT
     Priority: student > class > weekly > global.
     Weekly docs are expanded to concrete dates before merging.
     ══════════════════════════════════════════════════════════ */
  function _resolveTask(docs) {
    const weeklyExpanded = docs.weekly ? _resolveWeeklyDates(docs.weekly) : null;

    const resolved =
      (docs.student && docs.student.active ? docs.student        : null) ||
      (docs.class   && docs.class.active   ? docs.class          : null) ||
      (weeklyExpanded && weeklyExpanded.active ? weeklyExpanded  : null) ||
      (docs.global  && docs.global.active  ? docs.global         : null) ||
      { active: false };

    AppState.currentTaskConfig = resolved;

    if (document.getElementById('tasksContainer')) {
      renderTasksHTML();
    }
  }

  /* ══════════════════════════════════════════════════════════
     loadStudentMessages  — unchanged
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
     listenForStudentUpdates  — unchanged from fixed version
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
     renderTasksHTML  — FULL REPLACEMENT

     Changes:
     • Past-date detection: a date whose calendar day has passed
       AND is not completed is shown as "Missed" (✗) in red.
     • Today not yet completed = Pending (○) in amber.
     • Future dates = Upcoming (–) in grey.
     • Completed = Done (✓) in green.
     • All-done banner with congratulations.
     • Weekly badge shown if _isWeekly flag is set.
     • Subject list shown per date (unchanged from before).
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

    const completed    = studentData.coachingCompleted || {};
    const dateSubjects = currentTasks.dateSubjects || {};
    const todayStr     = _localDateStr();
    const isWeekly     = !!currentTasks._isWeekly;

    // Categorise each date
    let doneCount    = 0;
    let missedCount  = 0;
    let pendingCount = 0;
    let futureCount  = 0;

    const datesHTML = currentTasks.dates.map(dateStr => {
      const parts     = dateStr.split('-');
      const date      = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      const formatted = date.toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short'
      });

      const isDone    = !!completed[dateStr];
      const isPast    = dateStr < todayStr;
      const isToday   = dateStr === todayStr;
      const isFuture  = dateStr > todayStr;
      const isMissed  = isPast && !isDone;

      if (isDone)        doneCount++;
      else if (isMissed) missedCount++;
      else if (isToday)  pendingCount++;
      else               futureCount++;

      const subjects = dateSubjects[dateStr] || [];
      const subjNote = subjects.length > 0
        ? '<p style="font-size:var(--text-xs,0.6875rem);color:var(--brand-text,#3730a3);' +
          'margin-top:4px;font-weight:600;line-height:1.4;">' +
          subjects.map(_esc).join(', ') + '</p>'
        : '';

      // Style per state
      let bgColor, borderColor, iconColor, icon, labelText, labelColor;

      if (isDone) {
        bgColor     = 'var(--success-bg,#ebfbee)';
        borderColor = 'var(--success-border,#b2f2bb)';
        iconColor   = 'var(--success,#2f9e44)';
        icon        = '✓';
        labelText   = 'Done';
        labelColor  = 'var(--success-text,#1a5c29)';
      } else if (isMissed) {
        bgColor     = 'var(--danger-bg,#fff5f5)';
        borderColor = 'var(--danger,#e03131)';
        iconColor   = 'var(--danger,#e03131)';
        icon        = '✗';
        labelText   = 'Missed';
        labelColor  = 'var(--danger,#e03131)';
      } else if (isToday) {
        bgColor     = 'var(--warning-bg,#fff9db)';
        borderColor = 'var(--warning,#e8890c)';
        iconColor   = 'var(--warning,#e8890c)';
        icon        = '○';
        labelText   = 'Today';
        labelColor  = 'var(--warning-text,#7c4a00)';
      } else {
        // future
        bgColor     = 'var(--surface,#fff)';
        borderColor = 'var(--border,#e5e7eb)';
        iconColor   = 'var(--border-medium,#d1d5db)';
        icon        = '–';
        labelText   = 'Upcoming';
        labelColor  = 'var(--text-disabled,#9ca3af)';
      }

      return `<div style="background:${bgColor};border:1.5px solid ${borderColor};` +
             `border-radius:var(--r-md,8px);padding:0.625rem 0.875rem;text-align:center;">` +
             `<p style="font-size:var(--text-sm,0.8125rem);font-weight:500;color:var(--text-secondary,#374151);">` +
             `${_esc(formatted)}</p>` +
             `<p style="font-size:1.25rem;margin-top:4px;color:${iconColor};font-weight:700;">` +
             `${icon}</p>` +
             `<p style="font-size:var(--text-xs,0.6875rem);color:${labelColor};margin-top:2px;font-weight:600;">` +
             `${labelText}</p>` +
             subjNote +
             `</div>`;
    }).join('');

    const totalDates  = currentTasks.dates.length;
    const allDone     = doneCount === totalDates;
    const noneFuture  = futureCount === 0;

    // Status badge / completion message
    let statusBadgeHtml = '';
    if (allDone) {
      // Full congratulations banner
      statusBadgeHtml =
        '<div style="margin-top:var(--sp-3,0.75rem);padding:0.875rem 1rem;border-radius:8px;' +
        'background:var(--success-bg,#ebfbee);border:1px solid var(--success-border,#b2f2bb);text-align:center;">' +
        '<p style="font-size:1.375rem;margin-bottom:0.25rem;">🎉</p>' +
        '<p style="font-size:0.9375rem;font-weight:700;color:var(--success-text,#1a5c29);">All tasks complete!</p>' +
        '<p style="font-size:0.8125rem;color:var(--success,#2f9e44);margin-top:3px;line-height:1.5;">' +
        'Outstanding work! You have completed every scheduled session' +
        (isWeekly ? ' for this week.' : '.') +
        ' Keep up the great effort!</p>' +
        '</div>';
    } else if (missedCount > 0 && noneFuture && !allDone) {
      // Week ended with some missed
      statusBadgeHtml =
        '<div style="margin-top:var(--sp-3,0.75rem);padding:0.75rem 1rem;border-radius:8px;' +
        'background:var(--danger-bg,#fff5f5);border:1px solid var(--danger,#e03131);text-align:center;">' +
        `<p style="font-size:0.875rem;font-weight:700;color:var(--danger,#e03131);">` +
        `${doneCount}/${totalDates} sessions completed — ${missedCount} missed.</p>` +
        '<p style="font-size:0.8125rem;color:var(--text-secondary,#374151);margin-top:3px;line-height:1.5;">' +
        'Don\'t worry — aim to complete every session next time. You\'ve got this!</p>' +
        '</div>';
    }

    // Weekly marker
    const weeklyBadge = isWeekly
      ? '<span style="font-size:.6875rem;font-weight:700;padding:2px 9px;border-radius:99px;' +
        'background:var(--brand-bg,#edf2ff);color:var(--brand-text,#3730a3);' +
        'border:1px solid var(--brand-border,#bac8ff);margin-left:.5rem;">🔄 Weekly</span>'
      : '';

    const messageSafe = _esc(
      currentTasks.message || 'Complete the tests on these dates to mark them done!'
    )
      .replace(/\n\n/g, '</p><p style="font-size:var(--text-sm,0.8125rem);color:var(--text-secondary,#374151);line-height:1.7;margin-bottom:var(--sp-3,0.75rem);">')
      .replace(/\n/g, '<br>');

    container.innerHTML =
      '<div style="background:var(--brand-bg,#edf2ff);border:1px solid var(--brand-border,#bac8ff);' +
      'border-radius:var(--r-xl,12px);padding:var(--sp-5,1.25rem);margin-bottom:var(--sp-5,1.25rem);">' +

      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3,0.75rem);">' +
      '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:.375rem;">' +
      '<h3 style="font-size:var(--text-lg,1rem);font-weight:700;color:var(--brand-text,#3730a3);">' +
      _esc(currentTasks.title || 'Coaching Tasks') + '</h3>' +
      weeklyBadge +
      '</div>' +
      (allDone
        ? '<span style="font-size:var(--text-xs,.6875rem);font-weight:700;color:var(--success-text,#1a5c29);' +
          'background:var(--success-bg,#ebfbee);border:1px solid var(--success-border,#b2f2bb);' +
          'border-radius:99px;padding:2px 10px;flex-shrink:0;">All complete ✓</span>'
        : `<span style="font-size:var(--text-xs,.6875rem);font-weight:600;color:var(--brand-text,#3730a3);` +
          `background:rgba(255,255,255,.6);border:1px solid var(--brand-border,#bac8ff);` +
          `border-radius:99px;padding:2px 10px;flex-shrink:0;">${doneCount}/${totalDates} done</span>`) +
      '</div>' +

      '<p style="font-size:var(--text-sm,0.8125rem);color:var(--text-secondary,#374151);line-height:1.7;margin-bottom:var(--sp-4,1rem);">' +
      messageSafe + '</p>' +

      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:var(--sp-2,0.5rem);">' +
      datesHTML + '</div>' +

      statusBadgeHtml +

      '</div>';
  }

  /* ══════════════════════════════════════════════════════════
     cancelListeners  — unchanged
     ══════════════════════════════════════════════════════════ */
  function cancelListeners() {
    AppState.cancelListener('taskGlobal');
    AppState.cancelListener('taskClass');
    AppState.cancelListener('taskStudent');
    AppState.cancelListener('taskWeekly');
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
    _resolveWeeklyDates,
  };

})();