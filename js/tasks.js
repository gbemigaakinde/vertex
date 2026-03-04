/* ============================================================
   js/tasks.js  — v4
   ============================================================
   FIXES FROM v3:
   ─────────────────────────────────────────────────────────────
   A. _resolveTaskDates(doc, opts):
      • 'once' recurrence now respects opts.fromDate (floor),
        not just opts.upToDate (ceiling).  Previously fromDate
        was silently ignored for one-time tasks, so the
        weekly-window filter in renderTasksHTML had no effect.

   B. _expandTaskDoc(doc)  [was _resolveWeeklyDates]:
      • Renamed to describe what it actually does: expand any
        task doc (once / weekly / range) into a resolved form
        with concrete dates[].
      • CRITICAL FIX: no longer strips future dates from
        'once' tasks.  Previously the ceiling was hardcoded to
        today for ALL tasks, so students could never see
        upcoming one-time sessions in the widget.  Now:
          – dates[]      contains ALL dates (past + future),
                         sorted ascending.
          – pastDates[]  contains only dates <= today (used
                         by completion logic and the teacher
                         progress table).
        renderTasksHTML and exam.js use the appropriate array.
      • _isRecurring flag is set for weekly AND range, not
        only weekly.

   C. _resolveCurrentWeekDates(doc):
      • Now operates on the ORIGINAL raw recurrence fields
        (recurrence, startDate, weeklyDays, dates) rather than
        the already-resolved doc, so fromDate is respected
        correctly for 'once' tasks.

   D. renderTasksHTML (student widget):
      • allDates now comes from currentTask.dates (full list,
        incl. future) so upcoming sessions are visible.
      • pastDates (new) = dates <= today used for done/missed
        counts.
      • displayDates = current-week sessions (may include
        today and future days this week).
      • Fallback when no current-week sessions falls back to
        the surrounding 7 dates (past + future) rather than
        only past.

   E. _resolveWeeklyDates kept as a thin alias of
      _expandTaskDoc for backward compatibility with any
      external callers.

   F. Tasks._expandTaskDoc exported so teacher.js can use the
      full resolver when building the progress table (it was
      previously using _resolveTaskDates directly on raw data,
      which is still fine; now both paths are available).

   All other public API shapes are unchanged.
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
     _mondayOf(date) → Date (Monday of the ISO week)
     ══════════════════════════════════════════════════════════ */
  function _mondayOf(date) {
    const d   = new Date(date);
    const dow = d.getDay(); // 0 = Sun
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
       1. Exact YYYY-MM-DD key  (set by teacher for one-time
          tasks and for new recurring tasks)
       2. Day-name key          (legacy weekly format, e.g.
          { 'Monday': ['Maths', 'English'] })
     Returns string[] (may be empty = no restriction).
     ══════════════════════════════════════════════════════════ */
  function _resolveSubjectsForDate(doc, dateStr) {
    const ds = doc.dateSubjects || {};

    // 1. Exact date key (preferred format)
    if (Array.isArray(ds[dateStr])) return ds[dateStr];

    // 2. Day-name key (legacy format used by old weekly tasks)
    const date = _parseLocalDate(dateStr);
    if (!date) return [];
    const dayName = DAY_NAMES[date.getDay()];
    if (Array.isArray(ds[dayName])) return ds[dayName];

    return [];
  }

  /* ══════════════════════════════════════════════════════════
     _resolveTaskDates(doc, opts?)
     ──────────────────────────────────────────────────────────
     Returns ALL concrete YYYY-MM-DD session dates for a task.

     opts.upToDate  – ceiling date string (default: no ceiling,
                      i.e. include all future dates)
     opts.fromDate  – floor date string   (default: task start
                      / first date in dates[])

     Recurrence modes:
       'once'   – returns doc.dates filtered to [floor, ceil]
                  (FIX: floor is now respected for 'once' too)
       'weekly' – every week from startDate whose weekday is
                  in weeklyDays[], up to min(ceiling, endDate)
       'range'  – every calendar day from startDate whose
                  weekday is in weeklyDays[] (or every day if
                  weeklyDays is empty), up to ceiling/endDate

     Backward compat: docs with weeklyDays[] but no recurrence
     field are treated as 'weekly'.
     ══════════════════════════════════════════════════════════ */
  function _resolveTaskDates(doc, opts) {
    if (!doc) return [];
    opts = opts || {};

    const hasCeiling = !!opts.upToDate;
    const ceiling    = opts.upToDate || null; // null = no upper limit

    const recurrence = doc.recurrence ||
      (Array.isArray(doc.weeklyDays) && doc.weeklyDays.length > 0 ? 'weekly' : 'once');

    /* ── 'once' ── */
    if (recurrence === 'once') {
      const raw = Array.isArray(doc.dates) ? doc.dates : [];
      return raw
        .filter(d => {
          if (opts.fromDate && d < opts.fromDate) return false;
          if (hasCeiling && d > ceiling)          return false;
          return true;
        })
        .sort();
    }

    /* ── 'weekly' and 'range' share the same generation loop ── */
    const startDate = doc.startDate || (Array.isArray(doc.dates) && doc.dates[0]) || null;
    if (!startDate) return [];

    const floor   = opts.fromDate || startDate;
    const endDate = doc.endDate   || null;

    // Cap = min(opts.upToDate, doc.endDate) — either may be absent
    let cap;
    if (hasCeiling && endDate) {
      cap = ceiling < endDate ? ceiling : endDate;
    } else if (hasCeiling) {
      cap = ceiling;
    } else if (endDate) {
      cap = endDate;
    } else {
      // Open-ended recurring task with no ceiling requested:
      // generate up to 365 days from startDate so we don't loop forever
      const limitDate = _addDays(_parseLocalDate(startDate), 365);
      cap = _localDateStr(limitDate);
    }

    if (floor > cap) return [];

    const activeDayIndices = new Set(
      (doc.weeklyDays || []).map(name => DAY_NAMES.indexOf(name)).filter(i => i !== -1)
    );
    // 'range' with no weeklyDays = every calendar day
    const allDays = activeDayIndices.size === 0 && recurrence === 'range';

    const results  = [];
    let current    = _parseLocalDate(floor);
    const capDate  = _parseLocalDate(cap);

    // Safety: cap iteration at 1095 days (~3 years) to prevent infinite loops
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
     Returns session dates that fall within the current Mon–Sun
     ISO week.  Includes future days within the week (shown as
     "upcoming" in the student widget) but not days after this
     week.

     NOTE: operates on the RAW doc fields (recurrence, dates,
     weeklyDays, startDate) — NOT the pre-resolved doc — so
     fromDate is respected correctly for every recurrence mode.
     ══════════════════════════════════════════════════════════ */
  function _resolveCurrentWeekDates(doc) {
    const monday    = _mondayOf(new Date());
    const sunday    = _addDays(monday, 6);
    const weekStart = _localDateStr(monday);
    const weekEnd   = _localDateStr(sunday);

    return _resolveTaskDates(doc, {
      fromDate:  weekStart,
      upToDate:  weekEnd,
    });
  }

  /* ══════════════════════════════════════════════════════════
     _expandTaskDoc(doc)
     ──────────────────────────────────────────────────────────
     Expands any task doc into a "resolved" form where:
       • dates[]      = ALL session dates (past + future),
                        sorted ascending.  Future dates are
                        preserved so students can see upcoming
                        sessions in the widget.
       • pastDates[]  = only dates <= today.  Used for
                        completion logic and teacher progress.
       • dateSubjects = { 'YYYY-MM-DD': string[] } rebuilt
                        from whatever format the teacher used
                        (day-name or exact-date keys).
       • _isRecurring = true for weekly / range tasks.
       • _isWeekly    = true for weekly tasks (legacy compat).

     This is the function that was previously named
     _resolveWeeklyDates.  The old name is kept as an alias.
     ══════════════════════════════════════════════════════════ */
  function _expandTaskDoc(doc) {
    if (!doc) return null;

    const today      = _localDateStr();
    const allDates   = _resolveTaskDates(doc);           // no ceiling → all dates
    const pastDates  = allDates.filter(d => d <= today); // completion logic only needs these

    // Rebuild dateSubjects keyed by YYYY-MM-DD for every date
    const dateSubjects = {};
    allDates.forEach(dateStr => {
      const subjects = _resolveSubjectsForDate(doc, dateStr);
      if (subjects.length > 0) dateSubjects[dateStr] = subjects;
    });

    const recurrence = doc.recurrence ||
      (Array.isArray(doc.weeklyDays) && doc.weeklyDays.length > 0 ? 'weekly' : 'once');

    return Object.assign({}, doc, {
      dates:        allDates,      // full list incl. future
      pastDates:    pastDates,     // <= today only
      dateSubjects,
      _isRecurring: recurrence === 'weekly' || recurrence === 'range',
      _isWeekly:    recurrence === 'weekly', // legacy flag
    });
  }

  /* Backward-compat alias */
  function _resolveWeeklyDates(doc) {
    return _expandTaskDoc(doc);
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

    // Count of expected first-snapshots before we resolve the promise
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
     ──────────────────────────────────────────────────────────
     Priority chain (highest → lowest):
       1. student  one-time / range   (doc ID: 'student_UID')
       2. student  weekly             (doc ID: 'weekly_student_UID')
       3. class    one-time / range   (doc ID: 'class_X')
       4. class    weekly             (doc ID: 'weekly_class_X')
       5. global   weekly / range     (doc ID: 'weekly')
       6. global   one-time           (doc ID: 'global')

     Each candidate is expanded via _expandTaskDoc so the
     resolved doc always has:
       dates[]      – all session dates (past + future)
       pastDates[]  – dates <= today
       dateSubjects – normalised YYYY-MM-DD keyed map
     ══════════════════════════════════════════════════════════ */
  function _resolveTask(docs) {
    function expand(doc) {
      if (!doc) return null;
      return _expandTaskDoc(doc);
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
     Student-facing coaching task widget.

     Shows the current ISO week's session dates so the student
     always sees "this week" regardless of overall task length.
     Future sessions within the current week are shown as
     "upcoming" — this lets students plan ahead.

     All-time completion tallies use pastDates[] (never future
     dates) so counts are always accurate.
     ══════════════════════════════════════════════════════════ */
  function renderTasksHTML() {
    const container = document.getElementById('tasksContainer');
    if (!container) return;

    const currentTask = AppState.currentTaskConfig || {};
    const studentData = AppState.studentData       || {};

    if (!currentTask.active) { container.innerHTML = ''; return; }

    // Full list of all session dates (past + future) — set by _expandTaskDoc
    const allDates = Array.isArray(currentTask.dates) ? currentTask.dates : [];
    if (allDates.length === 0) { container.innerHTML = ''; return; }

    // Past/today dates only — for done/missed counts
    const todayStr  = _localDateStr();
    const pastDates = Array.isArray(currentTask.pastDates)
      ? currentTask.pastDates
      : allDates.filter(d => d <= todayStr);

    const completed    = studentData.coachingCompleted || {};
    const isRecurring  = !!(currentTask._isRecurring || currentTask._isWeekly);

    // All-time stats (past only)
    const totalPast   = pastDates.length;
    const totalDone   = pastDates.filter(d => completed[d]).length;
    const totalMissed = pastDates.filter(d => d < todayStr && !completed[d]).length;

    // Current-week dates (past + future within this Mon–Sun week)
    // _resolveCurrentWeekDates works on the raw recurrence fields
    const weekDates = _resolveCurrentWeekDates(currentTask);

    // Fallback: if no sessions this week, show the nearest 7 dates
    // (up to 3 before today, today if applicable, up to 3 after)
    let displayDates;
    if (weekDates.length > 0) {
      displayDates = weekDates;
    } else {
      const nearPast   = allDates.filter(d => d <= todayStr).slice(-3);
      const nearFuture = allDates.filter(d => d > todayStr).slice(0, 4);
      displayDates     = [...nearPast, ...nearFuture];
    }

    if (displayDates.length === 0) { container.innerHTML = ''; return; }

    let weekDoneCount   = 0;
    let weekMissedCount = 0;

    const datesHTML = displayDates.map(dateStr => {
      const parts     = dateStr.split('-');
      const date      = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      const formatted = date.toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
      });

      const isDone   = !!completed[dateStr];
      const isPast   = dateStr < todayStr;
      const isToday  = dateStr === todayStr;
      const isFuture = dateStr > todayStr;
      const isMissed = isPast && !isDone;

      if (isDone)        weekDoneCount++;
      else if (isMissed) weekMissedCount++;

      // Resolve subject restriction for this specific date
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
      } else if (isFuture) {
        bgColor = 'var(--surface,#fff)'; borderColor = 'var(--border,#e5e7eb)';
        iconColor = 'var(--border-medium,#d1d5db)'; icon = '–'; labelText = 'Upcoming';
        labelColor = 'var(--text-disabled,#9ca3af)';
      } else {
        // Past but not missed (shouldn't reach here normally)
        bgColor = 'var(--surface,#fff)'; borderColor = 'var(--border,#e5e7eb)';
        iconColor = 'var(--border-medium,#d1d5db)'; icon = '–'; labelText = '–';
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

    // All-time history badge (only meaningful for recurring tasks with history beyond this week)
    const historyBadge = isRecurring && totalPast > displayDates.filter(d => d <= todayStr).length
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

    // This-week summary badge
    const pastThisWeek   = displayDates.filter(d => d <= todayStr).length;
    const weekAllDone    = pastThisWeek > 0 && weekDoneCount === pastThisWeek;
    const allFutureThisWeek = displayDates.every(d => d > todayStr);

    const statusBadge = weekAllDone && !allFutureThisWeek
      ? `<div style="margin-top:.75rem;padding:.875rem 1rem;border-radius:8px;` +
        `background:var(--success-bg,#ebfbee);border:1px solid var(--success-border,#b2f2bb);text-align:center;">` +
        `<p style="font-size:.9375rem;font-weight:700;color:var(--success-text,#1a5c29);">This week: all done! 🎉</p>` +
        `</div>`
      : weekMissedCount > 0
        ? `<div style="margin-top:.75rem;padding:.75rem 1rem;border-radius:8px;` +
          `background:var(--danger-bg,#fff5f5);border:1px solid var(--danger,#e03131);text-align:center;">` +
          `<p style="font-size:.875rem;font-weight:700;color:var(--danger,#e03131);">` +
          `${weekDoneCount}/${pastThisWeek} done this week — ${weekMissedCount} missed. Keep going!</p>` +
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

    const weekLabel = weekDates.length > 0 ? 'This Week' : 'Sessions';

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
    _expandTaskDoc,
    _resolveWeeklyDates,   // alias → _expandTaskDoc (backward compat)
    _resolveTaskDates,
    _resolveCurrentWeekDates,
    _resolveSubjectsForDate,
  };

})();
