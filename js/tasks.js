/* ============================================================
   js/tasks.js  — v4.2
   ============================================================
 */

(function () {
  'use strict';

  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  function _localDateStr(date) {
    const d = date || new Date();
    return (
      d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  function _parseLocalDate(str) {
    if (!str) return null;
    const p = str.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function _addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function _mondayOf(date) {
    const d   = new Date(date);
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function _classDocId(classStr) {
    return 'class_' + (classStr || '').replace(/\s+/g, '').toLowerCase();
  }

  function _studentDocId(uid) {
    return 'student_' + uid;
  }

  function _resolveSubjectsForDate(doc, dateStr) {
    const ds = doc.dateSubjects || {};

    if (Array.isArray(ds[dateStr])) return ds[dateStr];

    const date = _parseLocalDate(dateStr);
    if (!date) return [];
    const dayName = DAY_NAMES[date.getDay()];
    if (Array.isArray(ds[dayName])) return ds[dayName];

    return [];
  }

  function _resolveTaskDates(doc, opts) {
    if (!doc) return [];
    opts = opts || {};

    const hasCeiling = !!opts.upToDate;
    const ceiling    = opts.upToDate || null;

    const recurrence = doc.recurrence ||
      (Array.isArray(doc.weeklyDays) && doc.weeklyDays.length > 0 ? 'weekly' : 'once');

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

    const startDate = doc.startDate || (Array.isArray(doc.dates) && doc.dates[0]) || null;
    if (!startDate) return [];

    const candidateFloor = opts.fromDate || startDate;
    const floor = candidateFloor > startDate ? candidateFloor : startDate;

    const endDate = doc.endDate || null;

    let cap;
    if (hasCeiling && endDate) {
      cap = ceiling < endDate ? ceiling : endDate;
    } else if (hasCeiling) {
      cap = ceiling;
    } else if (endDate) {
      cap = endDate;
    } else {
      const limitDate = _addDays(_parseLocalDate(startDate), 365);
      cap = _localDateStr(limitDate);
    }

    if (floor > cap) return [];

    const activeDayIndices = new Set(
      (doc.weeklyDays || []).map(name => DAY_NAMES.indexOf(name)).filter(i => i !== -1)
    );
    const allDays = activeDayIndices.size === 0 && recurrence === 'range';

    const results  = [];
    let current    = _parseLocalDate(floor);
    const capDate  = _parseLocalDate(cap);

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

  function _expandTaskDoc(doc) {
    if (!doc) return null;

    const today      = _localDateStr();
    const allDates   = _resolveTaskDates(doc);
    const pastDates  = allDates.filter(d => d <= today);

    const dateSubjects = {};
    allDates.forEach(dateStr => {
      const subjects = _resolveSubjectsForDate(doc, dateStr);
      if (subjects.length > 0) dateSubjects[dateStr] = subjects;
    });

    const recurrence = doc.recurrence ||
      (Array.isArray(doc.weeklyDays) && doc.weeklyDays.length > 0 ? 'weekly' : 'once');

    return Object.assign({}, doc, {
      dates:        allDates,
      pastDates:    pastDates,
      dateSubjects,
      _isRecurring: recurrence === 'weekly' || recurrence === 'range',
      _isWeekly:    recurrence === 'weekly',
    });
  }

  function _resolveWeeklyDates(doc) {
    return _expandTaskDoc(doc);
  }

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

    // Cache each received task doc locally for offline use
    if (window.SyncManager) {
      const docMap = {
        global: docs.global, class: docs.class, student: docs.student,
        weekly: docs.weekly, weeklyClass: docs.weeklyClass, weeklyStudent: docs.weeklyStudent,
      };
      Object.entries(docMap).forEach(([key, data]) => {
        if (data) SyncManager.cacheCoachingTask(key, data).catch(() => {});
      });
    }

    if (document.getElementById('tasksContainer')) {
      renderTasksHTML();
    }
  }

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

  function listenForStudentUpdates() {
    const uid = AppState.userId;
    if (!uid) return Promise.resolve();

    AppState.cancelListener('studentProfile');

    const unsub = Db()
      .collection('students').doc(uid)
      .onSnapshot(
        snap => {
          if (snap.exists) {
            const incoming = snap.data();

            // ── FIX: Deep-merge coachingCompleted so that optimistic local
            // updates made during exam submission are never overwritten by a
            // stale snapshot that arrives before Firestore finishes the write.
            // We union the two maps: any date already marked true locally is
            // preserved even if the incoming snapshot doesn't carry it yet.
            const existingCompleted =
              (AppState.studentData && AppState.studentData.coachingCompleted) || {};
            const incomingCompleted = incoming.coachingCompleted || {};

            const mergedCompleted = Object.assign(
              {},
              incomingCompleted,   // start with what Firestore says
              existingCompleted    // overlay any locally-known completions on top
            );

            AppState.studentData = Object.assign(
              {},
              AppState.studentData,
              incoming,
              { coachingCompleted: mergedCompleted }  // use the merged map
            );

            if (document.getElementById('tasksContainer')) {
              renderTasksHTML();
            }
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

  function renderTasksHTML() {
    const container = document.getElementById('tasksContainer');
    if (!container) return;

    const currentTask = AppState.currentTaskConfig || {};
    const studentData = AppState.studentData       || {};

    if (!currentTask.active) { container.innerHTML = ''; return; }

    const allDates = Array.isArray(currentTask.dates) ? currentTask.dates : [];
    if (allDates.length === 0) { container.innerHTML = ''; return; }

    const todayStr  = _localDateStr();
    const pastDates = Array.isArray(currentTask.pastDates)
      ? currentTask.pastDates
      : allDates.filter(d => d <= todayStr);

    const completed    = studentData.coachingCompleted || {};
    const isRecurring  = !!(currentTask._isRecurring || currentTask._isWeekly);

    const totalPast   = pastDates.length;
    const totalDone   = pastDates.filter(d => completed[d]).length;
    const totalMissed = pastDates.filter(d => d < todayStr && !completed[d]).length;

    const weekDates = _resolveCurrentWeekDates(currentTask);

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

      const subjects = _resolveSubjectsForDate(currentTask, dateStr);
      const subjNote = subjects.length > 0
        ? '<p style="font-size:.625rem;color:var(--brand-text);margin-top:4px;font-weight:600;line-height:1.4;">' +
          subjects.map(_esc).join(', ') + '</p>'
        : '';

      let bgColor, borderColor, iconColor, icon, labelText, labelColor;

      if (isDone) {
        bgColor = 'var(--success-bg)'; borderColor = 'var(--success-border)';
        iconColor = 'var(--success)'; icon = '✓'; labelText = 'Done';
        labelColor = 'var(--success-text)';
      } else if (isMissed) {
        bgColor = 'var(--danger-bg)'; borderColor = 'var(--danger)';
        iconColor = 'var(--danger)'; icon = '✗'; labelText = 'Missed';
        labelColor = 'var(--danger)';
      } else if (isToday) {
        bgColor = 'var(--warning-bg)'; borderColor = 'var(--warning)';
        iconColor = 'var(--warning)'; icon = '○'; labelText = 'Today';
        labelColor = 'var(--warning-text)';
      } else if (isFuture) {
        bgColor = 'var(--surface)'; borderColor = 'var(--border)';
        iconColor = 'var(--border-medium)'; icon = '–'; labelText = 'Upcoming';
        labelColor = 'var(--text-disabled)';
      } else {
        bgColor = 'var(--surface)'; borderColor = 'var(--border)';
        iconColor = 'var(--border-medium)'; icon = '–'; labelText = '–';
        labelColor = 'var(--text-disabled)';
      }

      return `<div style="background:${bgColor};border:1.5px solid ${borderColor};` +
        `border-radius:8px;padding:.625rem .875rem;text-align:center;">` +
        `<p style="font-size:.8125rem;font-weight:500;color:var(--text-secondary);">${_esc(formatted)}</p>` +
        `<p style="font-size:1.25rem;margin-top:4px;color:${iconColor};font-weight:700;">${icon}</p>` +
        `<p style="font-size:.6875rem;color:${labelColor};margin-top:2px;font-weight:600;">${labelText}</p>` +
        subjNote +
        `</div>`;
    }).join('');

    const historyBadge = isRecurring && totalPast > displayDates.filter(d => d <= todayStr).length
      ? `<div style="margin-top:.75rem;padding:.5rem .875rem;border-radius:6px;` +
        `background:var(--surface-muted);border:1px solid var(--border);` +
        `display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;">` +
        `<span style="font-size:.75rem;color:var(--text-tertiary);">All-time history</span>` +
        `<div style="display:flex;gap:.75rem;align-items:center;">` +
        `<span style="font-size:.75rem;font-weight:700;color:var(--success);">✓ ${totalDone} done</span>` +
        (totalMissed > 0
          ? `<span style="font-size:.75rem;font-weight:700;color:var(--danger);">✗ ${totalMissed} missed</span>`
          : '') +
        `<span style="font-size:.75rem;color:var(--text-disabled);">${totalPast} total</span>` +
        `</div></div>`
      : '';

    const pastThisWeek   = displayDates.filter(d => d <= todayStr).length;
    const allSessionsThisWeekDone =
      displayDates.length > 0 &&
      displayDates.every(d => !!completed[d]);

    const allFutureThisWeek = displayDates.every(d => d > todayStr);

    const statusBadge = allSessionsThisWeekDone && !allFutureThisWeek
      ? `<div style="margin-top:.75rem;padding:.875rem 1rem;border-radius:8px;` +
        `background:var(--success-bg);border:1px solid var(--success-border);text-align:center;">` +
        `<p style="font-size:.9375rem;font-weight:700;color:var(--success-text);">This week: all done! 🎉</p>` +
        `</div>`
      : weekMissedCount > 0
        ? `<div style="margin-top:.75rem;padding:.75rem 1rem;border-radius:8px;` +
          `background:var(--danger-bg);border:1px solid var(--danger);text-align:center;">` +
          `<p style="font-size:.875rem;font-weight:700;color:var(--danger);">` +
          `${weekDoneCount}/${pastThisWeek} done this week — ${weekMissedCount} missed. Keep going!</p>` +
          `</div>`
        : '';

    const recurringBadge = isRecurring
      ? `<span style="font-size:.6875rem;font-weight:700;padding:2px 9px;border-radius:99px;` +
        `background:var(--brand-bg);color:var(--brand-text);` +
        `border:1px solid var(--brand-border);margin-left:.5rem;">🔄 Recurring</span>`
      : '';

    const messageSafe = _esc(currentTask.message || 'Complete the tests on these dates!')
      .replace(/\n\n/g, '</p><p style="font-size:.8125rem;color:var(--text-secondary);line-height:1.7;margin-bottom:.75rem;">')
      .replace(/\n/g, '<br>');

    const weekLabel = weekDates.length > 0 ? 'This Week' : 'Sessions';

    container.innerHTML =
      `<div style="background:var(--brand-bg);border:1px solid var(--brand-border);` +
      `border-radius:12px;padding:1.25rem;margin-bottom:1.25rem;">` +

      `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;">` +
      `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:.375rem;">` +
      `<h3 style="font-size:1rem;font-weight:700;color:var(--brand-text);">` +
      _esc(currentTask.title || 'Coaching Tasks') + `</h3>` +
      recurringBadge +
      `</div>` +
      `<span style="font-size:.6875rem;font-weight:600;color:var(--brand-text);` +
      `background:var(--bg-base);border:1px solid var(--brand-border);` +
      `border-radius:99px;padding:2px 10px;flex-shrink:0;">${totalDone}/${totalPast} all-time</span>` +
      `</div>` +

      `<p style="font-size:.8125rem;color:var(--text-secondary);line-height:1.7;margin-bottom:1rem;">` +
      messageSafe + `</p>` +

      `<p style="font-size:.6875rem;font-weight:700;color:var(--brand-text);` +
      `text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem;">${weekLabel}</p>` +

      `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.5rem;">` +
      datesHTML + `</div>` +

      statusBadge +
      historyBadge +
      `</div>`;
  }

  function cancelListeners() {
    AppState.cancelListener('taskGlobal');
    AppState.cancelListener('taskClass');
    AppState.cancelListener('taskStudent');
    AppState.cancelListener('taskWeekly');
    AppState.cancelListener('taskWeeklyClass');
    AppState.cancelListener('taskWeeklyStudent');
    AppState.cancelListener('studentProfile');
  }

  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function Db() { return window.fbDb; }

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
    _resolveWeeklyDates,
    _resolveTaskDates,
    _resolveCurrentWeekDates,
    _resolveSubjectsForDate,
  };

})();
