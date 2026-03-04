/* ============================================================
   js/tasks.js  — v3
   ============================================================
   ARCHITECTURE CHANGES FROM v2:
   ─────────────────────────────
   A. Task document shape (new fields):
      {
        active,
        scope,          // 'global' | 'class' | 'student' | 'weekly'
        assignScope,    // 'all' | 'class' | 'student'
        title,
        message,

        // ── Recurrence ──
        recurrence,     // 'once' | 'weekly' | 'range'
                        //
                        // 'once'   : exactly the dates[] array (old behaviour)
                        // 'weekly' : weeklyDays[] repeats every Mon–Sun week
                        //            from startDate to endDate (inclusive)
                        //            endDate = null → open-ended / indefinite
                        // 'range'  : every calendar day from startDate to
                        //            endDate whose weekday is in weeklyDays[]
                        //            (or every day if weeklyDays is empty)

        startDate,      // 'YYYY-MM-DD' — first possible session date
        endDate,        // 'YYYY-MM-DD' | null — last possible session date

        // kept for backward compat (one-time / 'once' tasks)
        dates,          // string[]

        // day names for weekly / range recurrence
        weeklyDays,     // string[]  e.g. ['Monday','Wednesday']

        // per-date OR per-day-name subject restrictions
        dateSubjects,   // { 'YYYY-MM-DD': string[] }
                        // OR { 'Monday': string[] }
                        // both forms are resolved at read time

        updatedAt,
      }

   B. _resolveTaskDates(doc)
      Returns every concrete YYYY-MM-DD date the task covers
      up to today (or endDate, whichever is earlier).  This
      replaces the old _resolveWeeklyDates which only returned
      the current ISO week.

   C. _resolveCurrentWeekDates(doc)
      Returns only the dates that fall in the current Mon–Sun
      week AND are ≤ today.  Used by the student-facing widget
      so the student always sees "this week's tasks" regardless
      of how long the task has been running.

   D. _resolveSubjectsForDate(doc, dateStr)
      Handles both the new YYYY-MM-DD keyed map AND the old
      day-name keyed map transparently.

   E. loadCoachingTasks() opens the same 6 listeners as before;
      _resolveTask() priority chain is unchanged.

   F. renderTasksHTML() now shows only the current week's dates
      in the student widget, plus a running completion tally
      for the full task history.

   G. Tasks._resolveTaskDates is exported so teacher.js can use
      it when building the progress table.
   ============================================================ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     Constants
     ══════════════════════════════════════════════════════════ */
  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  /* ══════════════════════════════════════════════════════════
     _localDateStr(date?) → 'YYYY-MM-DD'
     ══════════════════════════════════════════════════════════ */
  function _localDateStr(date) {
    const d = date || new Date();
    return (
      d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  /* ══════════════════════════════════════════════════════════
     _parseLocalDate('YYYY-MM-DD') → Date (local midnight)
     ══════════════════════════════════════════════════════════ */
  function _parseLocalDate(str) {
    if (!str) return null;
    const p = str.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  /* ══════════════════════════════════════════════════════════
     _addDays(date, n) → new Date
     ══════════════════════════════════════════════════════════ */
  function _addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  /* ══════════════════════════════════════════════════════════
     _mondayOf(date) → Date (Monday of the ISO week containing date)
     ══════════════════════════════════════════════════════════ */
  function _mondayOf(date) {
    const d   = new Date(date);
    const dow = d.getDay(); // 0=Sun
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /* ══════════════════════════════════════════════════════════
     _classDocId / _studentDocId
     ══════════════════════════════════════════════════════════ */
  function _classDocId(classStr) {
    return 'class_' + (classStr || '').replace(/\s+/g, '').toLowerCase();
  }

  function _studentDocId(uid) {
    return 'student_' + uid;
  }

  /* ══════════════════════════════════════════════════════════
     _resolveSubjectsForDate(doc, dateStr)

     Checks dateSubjects for:
       1. Exact YYYY-MM-DD key  (new format)
       2. Day-name key          (old weekly format)
     Returns string[] (may be empty = no restriction).
     ══════════════════════════════════════════════════════════ */
  function _resolveSubjectsForDate(doc, dateStr) {
    const ds = doc.dateSubjects || {};

    // Exact date key (new format)
    if (Array.isArray(ds[dateStr])) return ds[dateStr];

    // Day-name key (old weekly format)
    const date    = _parseLocalDate(dateStr);
    if (!date) return [];
    const dayName = DAY_NAMES[date.getDay()];
    if (Array.isArray(ds[dayName])) return ds[dayName];

    return [];
  }

  /* ══════════════════════════════════════════════════════════
     _resolveTaskDates(doc, opts?)
     ──────────────────────────────────────────────────────────
     Returns ALL concrete YYYY-MM-DD session dates for a task
     doc up to min(today, endDate).

     opts.upToDate  – override ceiling (default: today)
     opts.fromDate  – override floor   (default: startDate or first date)

     Handles all three recurrence modes:
       'once'   – returns doc.dates as-is (filtered to ceiling)
       'weekly' – every week from startDate to ceiling whose
                  weekday is in weeklyDays[]
       'range'  – every calendar day from startDate to ceiling
                  whose weekday is in weeklyDays[] (or every
                  day if weeklyDays is empty / not set)

     Backward compat: docs that have no recurrence field but
     have weeklyDays[] are treated as 'weekly'; docs with only
     dates[] are treated as 'once'.
     ══════════════════════════════════════════════════════════ */
  function _resolveTaskDates(doc, opts) {
    if (!doc) return [];
    opts = opts || {};

    const ceiling = opts.upToDate || _localDateStr();
    const recurrence = doc.recurrence ||
      (Array.isArray(doc.weeklyDays) && doc.weeklyDays.length > 0 ? 'weekly' : 'once');

    /* ── 'once' ── */
    if (recurrence === 'once') {
      const raw = Array.isArray(doc.dates) ? doc.dates : [];
      return raw.filter(d => d <= ceiling).sort();
    }

    /* ── 'weekly' and 'range' share the same generation loop ── */
    const startDate = doc.startDate || (Array.isArray(doc.dates) && doc.dates[0]) || null;
    if (!startDate) return [];

    const floor   = opts.fromDate || startDate;
    const endDate = doc.endDate   || null;
    const cap     = endDate && endDate < ceiling ? endDate : ceiling;

    if (floor > cap) return [];

    const activeDayIndices = new Set(
      (doc.weeklyDays || []).map(name => DAY_NAMES.indexOf(name)).filter(i => i !== -1)
    );
    // 'range' with no weeklyDays = every calendar day
    const allDays = activeDayIndices.size === 0 && recurrence === 'range';

    const results = [];
    let current   = _parseLocalDate(floor);
    const capDate = _parseLocalDate(cap);

    // Safety: cap iteration at 3 years (1095 days) to prevent infinite loops
    let guard = 0;
    while (current <= capDate && guard++ < 1095) {
      const dow = current.getDay();
      if (allDays || activeDayIndices.has(dow)) {
        results.push(_localDateStr(current));
      }
      current = _addDays(current, 1);
    }

    return results.sort();
  }

  /* ══════════════════════════════════════════════════════════
     _resolveCurrentWeekDates(doc)
     ──────────────────────────────────────────────────────────
     Returns only the session dates that fall within the
     current Mon–Sun ISO week AND are ≤ today.
     Used by the student-facing widget so it stays scoped
     to "this week" regardless of overall task duration.
     ══════════════════════════════════════════════════════════ */
  function _resolveCurrentWeekDates(doc) {
    const today   = _localDateStr();
    const monday  = _mondayOf(new Date());
    const sunday  = _addDays(monday, 6);
    const weekStart = _localDateStr(monday);
    const weekEnd   = _localDateStr(sunday);

    return _resolveTaskDates(doc, {
      fromDate: weekStart,
      upToDate: today < weekEnd ? today : weekEnd,
    });
  }

  /* ══════════════════════════════════════════════════════════
     _resolveWeeklyDates(doc)   — kept for backward compat
     (teacher.js and exam.js still call this)
     Now delegates to the full _resolveTaskDates resolver.
     ══════════════════════════════════════════════════════════ */
  function _resolveWeeklyDates(weeklyDoc) {
    if (!weeklyDoc) return weeklyDoc;
    const dates        = _resolveTaskDates(weeklyDoc);
    const dateSubjects = {};
    dates.forEach(dateStr => {
      dateSubjects[dateStr] = _resolveSubjectsForDate(weeklyDoc, dateStr);
    });
    return Object.assign({}, weeklyDoc, {
      dates,
      dateSubjects,
      _isRecurring: true,
      // keep legacy flag so old code paths that check _isWeekly still work
      _isWeekly: weeklyDoc.recurrence === 'weekly' ||
        (Array.isArray(weeklyDoc.weeklyDays) && weeklyDoc.weeklyDays.length > 0 &&
         weeklyDoc.recurrence !== 'once'),
    });
  }

  /* ══════════════════════════════════════════════════════════
     loadCoachingTasks
     ══════════════════════════════════════════════════════════ */
  function loadCoachingTasks() {
    const uid        = AppState.userId;
    const classStr   = (AppState.studentData || {}).class || '';
    const classKey   = _classDocId(classStr);
    const studentKey = uid ? _studentDocId(uid) : null;
    const wkAllKey   = 'weekly';
    const wkClassKey = 'weekly_' + classKey;
    const wkStudKey  = uid ? 'weekly_student_' + uid : null;

    AppState.cancelListener('taskGlobal');
    AppState.cancelListener('taskClass');
    AppState.cancelListener('taskStudent');
    AppState.cancelListener('taskWeekly');
    AppState.cancelListener('taskWeeklyClass');
    AppState.cancelListener('taskWeeklyStudent');

    const _docs = {
      global: null, class: null, student: null,
      weekly: null, weeklyClass: null, weeklyStudent: null,
    };

    const _needed = 4 + (studentKey ? 1 : 0) + (wkStudKey ? 1 : 0);
    let _initialCount = 0;
    let _resolveFn    = null;
    const promise     = new Promise(res => { _resolveFn = res; });

    function _onSnap(key, snap) {
      _docs[key] = snap.exists ? snap.data() : null;
      _initialCount++;
      _resolveTask(_docs);
      if (_initialCount >= _needed && _resolveFn) { _resolveFn(); _resolveFn = null; }
    }
    function _onErr(key, err) {
      console.error('[tasks] coachingTasks/' + key + ' error:', err);
      _docs[key] = null;
      _initialCount++;
      if (_initialCount >= _needed && _resolveFn) { _resolveFn(); _resolveFn = null; }
    }

    AppState.registerListener('taskGlobal',
      Db().collection('coachingTasks').doc('global')
        .onSnapshot(s => _onSnap('global', s), e => _onErr('global', e)));

    AppState.registerListener('taskClass',
      Db().collection('coachingTasks').doc(classKey)
        .onSnapshot(s => _onSnap('class', s), e => _onErr('class', e)));

    AppState.registerListener('taskWeekly',
      Db().collection('coachingTasks').doc(wkAllKey)
        .onSnapshot(s => _onSnap('weekly', s), e => _onErr('weekly', e)));

    AppState.registerListener('taskWeeklyClass',
      Db().collection('coachingTasks').doc(wkClassKey)
        .onSnapshot(s => _onSnap('weeklyClass', s), e => _onErr('weeklyClass', e)));

    if (studentKey) {
      AppState.registerListener('taskStudent',
        Db().collection('coachingTasks').doc(studentKey)
          .onSnapshot(s => _onSnap('student', s), e => _onErr('student', e)));
    } else {
      _docs.student = null;
    }

    if (wkStudKey) {
      AppState.registerListener('taskWeeklyStudent',
        Db().collection('coachingTasks').doc(wkStudKey)
          .onSnapshot(s => _onSnap('weeklyStudent', s), e => _onErr('weeklyStudent', e)));
    } else {
      _docs.weeklyStudent = null;
    }

    return promise;
  }

  /* ══════════════════════════════════════════════════════════
     _resolveTask(docs)

     Priority (highest → lowest):
       1. student one-time / range
       2. student weekly
       3. class one-time / range
       4. class weekly
       5. global weekly (all)
       6. global one-time (all)

     Each winning doc is expanded via _resolveWeeklyDates so
     the resolved doc always has a flat dates[] array covering
     all history up to today.
     ══════════════════════════════════════════════════════════ */
  function _resolveTask(docs) {
    function expand(doc) {
      if (!doc) return null;
      // Always run through the full resolver so dates[] is always a complete history array
      return _resolveWeeklyDates(doc);
    }

    const studentExp      = expand(docs.student);
    const weeklyStudExp   = expand(docs.weeklyStudent);
    const classExp        = expand(docs.class);
    const weeklyClassExp  = expand(docs.weeklyClass);
    const weeklyExp       = expand(docs.weekly);
    const globalExp       = expand(docs.global);

    const resolved =
      (studentExp     && studentExp.active     ? studentExp     : null) ||
      (weeklyStudExp  && weeklyStudExp.active   ? weeklyStudExp  : null) ||
      (classExp       && classExp.active        ? classExp       : null) ||
      (weeklyClassExp && weeklyClassExp.active  ? weeklyClassExp : null) ||
      (weeklyExp      && weeklyExp.active       ? weeklyExp      : null) ||
      (globalExp      && globalExp.active       ? globalExp      : null) ||
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
        .map(doc => Object.assign({ id: doc.id }, doc.data()))
        .filter(m => {
          if (!m.expiresAt) return true;
          const ms = m.expiresAt.toDate
            ? m.expiresAt.toDate().getTime()
            : new Date(m.expiresAt).getTime();
          return ms > now;
        })
        .sort((a, b) => {
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
     ══════════════════════════════════════════════════════════ */
  function listenForStudentUpdates() {
    const uid = AppState.userId;
    if (!uid) return Promise.resolve();

    AppState.cancelListener('studentProfile');

    const unsub = Db()
      .collection('students').doc(uid)
      .onSnapshot(
        snap => {
          if (snap.exists) {
            AppState.studentData = Object.assign({}, AppState.studentData, snap.data());
            if (document.getElementById('tasksContainer')) renderTasksHTML();
          }
        },
        err => console.error('[tasks] Student update listener error:', err)
      );

    AppState.registerListener('studentProfile', unsub);

    return Promise.all([
      loadCoachingTasks().catch(err => console.warn('[tasks] loadCoachingTasks error:', err)),
      loadStudentMessages().catch(err => console.warn('[tasks] loadStudentMessages error:', err)),
    ]);
  }

  /* ══════════════════════════════════════════════════════════
     renderTasksHTML
     ──────────────────────────────────────────────────────────
     Student-facing widget.
     Shows ONLY the current week's session dates so the widget
     stays compact regardless of overall task length.
     Shows a summary tally (all-time) above the weekly grid.
     ══════════════════════════════════════════════════════════ */
  function renderTasksHTML() {
    const container = document.getElementById('tasksContainer');
    if (!container) return;

    const currentTask = AppState.currentTaskConfig || {};
    const studentData = AppState.studentData       || {};

    if (!currentTask.active) { container.innerHTML = ''; return; }

    // Full history (all dates up to today)
    const allDates = Array.isArray(currentTask.dates) ? currentTask.dates : [];
    if (allDates.length === 0) { container.innerHTML = ''; return; }

    const completed    = studentData.coachingCompleted || {};
    const dateSubjects = currentTask.dateSubjects      || {};
    const todayStr     = _localDateStr();
    const isRecurring  = !!(currentTask._isRecurring || currentTask._isWeekly);

    // All-time stats
    const totalPast    = allDates.filter(d => d <= todayStr).length;
    const totalDone    = allDates.filter(d => completed[d]).length;
    const totalMissed  = allDates.filter(d => d < todayStr && !completed[d]).length;

    // Current-week dates only (what we show in the grid)
    const weekDates = _resolveCurrentWeekDates(currentTask);

    // If no sessions this week yet, fall back to the most recent 7 dates
    const displayDates = weekDates.length > 0
      ? weekDates
      : allDates.filter(d => d <= todayStr).slice(-7);

    if (displayDates.length === 0) { container.innerHTML = ''; return; }

    let weekDoneCount    = 0;
    let weekMissedCount  = 0;
    let weekPendingCount = 0;

    const datesHTML = displayDates.map(dateStr => {
      const parts     = dateStr.split('-');
      const date      = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      const formatted = date.toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
      });

      const isDone   = !!completed[dateStr];
      const isPast   = dateStr < todayStr;
      const isToday  = dateStr === todayStr;
      const isMissed = isPast && !isDone;
      const isFuture = !isPast && !isToday;

      if (isDone)        weekDoneCount++;
      else if (isMissed) weekMissedCount++;
      else if (isToday)  weekPendingCount++;

      const subjects = _resolveSubjectsForDate(currentTask, dateStr);
      const subjNote = subjects.length > 0
        ? '<p style="font-size:.625rem;color:var(--brand-text,#3730a3);margin-top:4px;font-weight:600;line-height:1.4;">' +
          subjects.map(_esc).join(', ') + '</p>'
        : '';

      let bgColor, borderColor, iconColor, icon, labelText, labelColor;

      if (isDone) {
        bgColor = 'var(--success-bg,#ebfbee)'; borderColor = 'var(--success-border,#b2f2bb)';
        iconColor = 'var(--success,#2f9e44)'; icon = '✓'; labelText = 'Done';
        labelColor = 'var(--success-text,#1a5c29)';
      } else if (isMissed) {
        bgColor = 'var(--danger-bg,#fff5f5)'; borderColor = 'var(--danger,#e03131)';
        iconColor = 'var(--danger,#e03131)'; icon = '✗'; labelText = 'Missed';
        labelColor = 'var(--danger,#e03131)';
      } else if (isToday) {
        bgColor = 'var(--warning-bg,#fff9db)'; borderColor = 'var(--warning,#e8890c)';
        iconColor = 'var(--warning,#e8890c)'; icon = '○'; labelText = 'Today';
        labelColor = 'var(--warning-text,#7c4a00)';
      } else {
        bgColor = 'var(--surface,#fff)'; borderColor = 'var(--border,#e5e7eb)';
        iconColor = 'var(--border-medium,#d1d5db)'; icon = '–'; labelText = 'Upcoming';
        labelColor = 'var(--text-disabled,#9ca3af)';
      }

      return `<div style="background:${bgColor};border:1.5px solid ${borderColor};` +
        `border-radius:8px;padding:.625rem .875rem;text-align:center;">` +
        `<p style="font-size:.8125rem;font-weight:500;color:var(--text-secondary,#374151);">${_esc(formatted)}</p>` +
        `<p style="font-size:1.25rem;margin-top:4px;color:${iconColor};font-weight:700;">${icon}</p>` +
        `<p style="font-size:.6875rem;color:${labelColor};margin-top:2px;font-weight:600;">${labelText}</p>` +
        subjNote +
        `</div>`;
    }).join('');

    // All-time history badge (only meaningful for recurring tasks)
    const historyBadge = isRecurring && totalPast > displayDates.length
      ? `<div style="margin-top:.75rem;padding:.5rem .875rem;border-radius:6px;` +
        `background:var(--surface-muted,#f3f4f6);border:1px solid var(--border,#e5e7eb);` +
        `display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;">` +
        `<span style="font-size:.75rem;color:var(--text-tertiary,#6b7280);">All-time history</span>` +
        `<div style="display:flex;gap:.75rem;align-items:center;">` +
        `<span style="font-size:.75rem;font-weight:700;color:var(--success,#2f9e44);">✓ ${totalDone} done</span>` +
        (totalMissed > 0
          ? `<span style="font-size:.75rem;font-weight:700;color:var(--danger,#e03131);">✗ ${totalMissed} missed</span>`
          : '') +
        `<span style="font-size:.75rem;color:var(--text-disabled,#9ca3af);">${totalPast} total</span>` +
        `</div></div>`
      : '';

    // Week summary badge
    const weekAllDone = weekDoneCount === displayDates.filter(d => d <= todayStr).length
      && displayDates.filter(d => d <= todayStr).length > 0;

    const statusBadge = weekAllDone && !isFutureOnly(displayDates, todayStr)
      ? `<div style="margin-top:.75rem;padding:.875rem 1rem;border-radius:8px;` +
        `background:var(--success-bg,#ebfbee);border:1px solid var(--success-border,#b2f2bb);text-align:center;">` +
        `<p style="font-size:.9375rem;font-weight:700;color:var(--success-text,#1a5c29);">This week: all done! 🎉</p>` +
        `</div>`
      : weekMissedCount > 0
        ? `<div style="margin-top:.75rem;padding:.75rem 1rem;border-radius:8px;` +
          `background:var(--danger-bg,#fff5f5);border:1px solid var(--danger,#e03131);text-align:center;">` +
          `<p style="font-size:.875rem;font-weight:700;color:var(--danger,#e03131);">` +
          `${weekDoneCount}/${displayDates.filter(d => d <= todayStr).length} done this week — ` +
          `${weekMissedCount} missed. Keep going!</p>` +
          `</div>`
        : '';

    const recurringBadge = isRecurring
      ? `<span style="font-size:.6875rem;font-weight:700;padding:2px 9px;border-radius:99px;` +
        `background:var(--brand-bg,#edf2ff);color:var(--brand-text,#3730a3);` +
        `border:1px solid var(--brand-border,#bac8ff);margin-left:.5rem;">🔄 Recurring</span>`
      : '';

    const messageSafe = _esc(currentTask.message || 'Complete the tests on these dates!')
      .replace(/\n\n/g, '</p><p style="font-size:.8125rem;color:var(--text-secondary,#374151);line-height:1.7;margin-bottom:.75rem;">')
      .replace(/\n/g, '<br>');

    const weekLabel = weekDates.length > 0 ? 'This Week' : 'Recent Sessions';

    container.innerHTML =
      `<div style="background:var(--brand-bg,#edf2ff);border:1px solid var(--brand-border,#bac8ff);` +
      `border-radius:12px;padding:1.25rem;margin-bottom:1.25rem;">` +

      `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;">` +
      `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:.375rem;">` +
      `<h3 style="font-size:1rem;font-weight:700;color:var(--brand-text,#3730a3);">` +
      _esc(currentTask.title || 'Coaching Tasks') + `</h3>` +
      recurringBadge +
      `</div>` +
      `<span style="font-size:.6875rem;font-weight:600;color:var(--brand-text,#3730a3);` +
      `background:rgba(255,255,255,.6);border:1px solid var(--brand-border,#bac8ff);` +
      `border-radius:99px;padding:2px 10px;flex-shrink:0;">${totalDone}/${totalPast} all-time</span>` +
      `</div>` +

      `<p style="font-size:.8125rem;color:var(--text-secondary,#374151);line-height:1.7;margin-bottom:1rem;">` +
      messageSafe + `</p>` +

      `<p style="font-size:.6875rem;font-weight:700;color:var(--brand-text,#3730a3);` +
      `text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem;">${weekLabel}</p>` +

      `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.5rem;">` +
      datesHTML + `</div>` +

      statusBadge +
      historyBadge +
      `</div>`;
  }

  function isFutureOnly(dates, todayStr) {
    return dates.every(d => d > todayStr);
  }

  /* ══════════════════════════════════════════════════════════
     cancelListeners
     ══════════════════════════════════════════════════════════ */
  function cancelListeners() {
    AppState.cancelListener('taskGlobal');
    AppState.cancelListener('taskClass');
    AppState.cancelListener('taskStudent');
    AppState.cancelListener('taskWeekly');
    AppState.cancelListener('taskWeeklyClass');
    AppState.cancelListener('taskWeeklyStudent');
    AppState.cancelListener('studentProfile');
  }

  /* ── Private helpers ── */
  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    _resolveTaskDates,
    _resolveCurrentWeekDates,
    _resolveSubjectsForDate,
  };

})();
