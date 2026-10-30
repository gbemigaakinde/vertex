/* ============================================================
   js/tasks.js  — v4.4
   ============================================================
   v4.4 fixes
   • All active task docs that apply to a student are now MERGED
     (previously only the single highest-priority active doc was
     used, so e.g. an active class task hid an active global task
     scheduled for today).  For each date the most specific doc
     (student > class > everyone, one-off before recurring) decides
     the subject restriction and time limit.
   • Open-ended weekly/range tasks no longer silently stop 365 days
     after their start date.
   • loadCoachingTasks() waits for the FIRST snapshot of every task
     document (a repeated snapshot used to release it early).
   • A task's time limit only applies on a day that is a task day.
   • Student profile snapshots re-subscribe task listeners when the
     student's class changes and no longer pin stale completions.
 */

(function () {
  'use strict';

  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  // How far ahead an open-ended recurring task is expanded.
  const OPEN_ENDED_DAYS_AHEAD = 120;
  // Hard stop for the expansion loop (about 11 years of days).
  const MAX_EXPANSION_DAYS    = 4000;

  /* ─────────────────────────────────────────────────────── */
  /* Phosphor icon helper                                    */
  /* ─────────────────────────────────────────────────────── */
  function _icon(name, size) {
    size = size || 16;
    const icons = {
      ArrowsClockwise: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M240,56v48a8,8,0,0,1-8,8H184a8,8,0,0,1,0-16h28.69L196.12,79.51a96.07,96.07,0,0,0-131.77,9A8,8,0,0,1,52.6,77.14,112.08,112.08,0,0,1,206.53,66.46L224,83.93V56a8,8,0,1,1,16,0ZM195.4,178.86a96,96,0,0,1-131.53-8.37L47.31,152H76a8,8,0,0,0,0-16H28a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V163.93l17.47,17.61A112.11,112.11,0,0,0,206.89,178.5,8,8,0,1,0,195.4,178.86Z"/></svg>`,
      Check: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>`,
      X: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>`,
      Circle: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Z"/></svg>`,
      Minus: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128Z"/></svg>`,
      Confetti: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M228.24,75.06l-116,204a12,12,0,0,1-20.78-12l116-204a12,12,0,1,1,20.78,12ZM36,96a12,12,0,1,0,12-12A12,12,0,0,0,36,96Zm44,52a12,12,0,1,0,12-12A12,12,0,0,0,80,148Zm-24,56a12,12,0,1,0,12-12A12,12,0,0,0,56,204Zm136-96a12,12,0,1,0,12-12A12,12,0,0,0,192,108Zm-20,60a12,12,0,1,0,12-12A12,12,0,0,0,172,168Z"/></svg>`,
    };
    return icons[name] || '';
  }

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
      // Open-ended: run from the start date until a little way past today
      // (or past the start date if the task has not begun yet).
      const todayStr  = _localDateStr();
      const anchor    = startDate > todayStr ? startDate : todayStr;
      cap = _localDateStr(_addDays(_parseLocalDate(anchor), OPEN_ENDED_DAYS_AHEAD));
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
    while (current <= capDate && guard++ < MAX_EXPANSION_DAYS) {
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

    // A merged config (see _mergeTaskDocs) already carries its final date list.
    if (doc && doc._merged && Array.isArray(doc.dates)) {
      return doc.dates.filter(d => d >= weekStart && d <= weekEnd).sort();
    }

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

    // Remember which class these listeners were built for, so a later
    // class change on the student profile can rebuild them.
    _listenedClass = classStr;

    const _docs = {
      global: null, class: null, student: null,
      weekly: null, weeklyClass: null, weeklyStudent: null,
    };

    // Every document must deliver its FIRST snapshot (or error) before the
    // returned promise resolves. Later snapshots of the same document must
    // not count towards that total.
    const _needed   = 4 + (studentKey ? 1 : 0) + (wkStudKey ? 1 : 0);
    const _seen     = {};
    let _seenCount  = 0;
    let _resolveFn  = null;
    const promise   = new Promise(res => { _resolveFn = res; });

    function _markSeen(key) {
      if (!_seen[key]) { _seen[key] = true; _seenCount++; }
      if (_seenCount >= _needed && _resolveFn) { _resolveFn(); _resolveFn = null; }
    }
    function _onSnap(key, snap) {
      _docs[key] = snap.exists ? snap.data() : null;
      _resolveTask(_docs);
      _markSeen(key);
    }
    function _onErr(key, err) {
      console.error('[tasks] coachingTasks/' + key + ' error:', err);
      _docs[key] = null;
      _resolveTask(_docs);
      _markSeen(key);
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
    }

    if (wkStudKey) {
      AppState.registerListener('taskWeeklyStudent',
        Db().collection('coachingTasks').doc(wkStudKey)
          .onSnapshot(s => _onSnap('weeklyStudent', s), e => _onErr('weeklyStudent', e)));
    }

    return promise;
  }

  let _listenedClass = null;

  /* ─────────────────────────────────────────────────────── */
  /* Merge every active task doc that applies to the student */
  /* ─────────────────────────────────────────────────────── */
  // `list` is ordered most-specific first. For every date the first doc in
  // the list that contains that date is the "owner" of that date: its subject
  // restriction (an empty list means "no restriction") and its time limit win.
  function _mergeTaskDocs(list) {
    const today  = _localDateStr();
    const owner  = {};
    const dateSet = {};

    list.forEach(doc => {
      (doc.dates || []).forEach(d => {
        dateSet[d] = true;
        if (!owner[d]) owner[d] = doc;
      });
    });

    const dates     = Object.keys(dateSet).sort();
    const pastDates = dates.filter(d => d <= today);

    const dateSubjects = {};
    dates.forEach(d => {
      const subj = (owner[d].dateSubjects || {})[d];
      if (Array.isArray(subj) && subj.length > 0) dateSubjects[d] = subj;
    });

    // Doc whose title/message the student sees: today's owner, else the next
    // upcoming session's owner, else the most recent past session's owner,
    // else simply the most specific active doc.
    const nextDate = dates.find(d => d > today);
    const lastDate = pastDates.length ? pastDates[pastDates.length - 1] : null;
    const primary  = owner[today] || (nextDate && owner[nextDate]) || (lastDate && owner[lastDate]) || list[0];

    const todayOwner = owner[today] || null;
    const durationMs = todayOwner && typeof todayOwner.durationMs === 'number' && todayOwner.durationMs > 0
      ? todayOwner.durationMs : null;

    const pOwner = todayOwner || primary;
    const proctorMode = (pOwner && (pOwner.proctorMode === 'video' || pOwner.proctorMode === 'photo')) ? pOwner.proctorMode : 'off';
    return Object.assign({}, primary, {
      proctorMode,
      proctorIntervalSec: (pOwner && pOwner.proctorIntervalSec) || 60,
      screenMode: (pOwner && (pOwner.screenMode === 'shots' || pOwner.screenMode === 'video')) ? pOwner.screenMode : 'off',
      screenIntervalSec: (pOwner && pOwner.screenIntervalSec) || 30,
      screenUnsupported: (pOwner && pOwner.screenUnsupported === 'camera') ? 'camera' : 'block',
      active:       true,
      dates,
      pastDates,
      dateSubjects,
      durationMs,
      _merged:      true,
      _isRecurring: list.some(d => d._isRecurring),
      _isWeekly:    list.some(d => d._isWeekly),
    });
  }

  function _resolveTask(docs) {
    function expand(doc) {
      if (!doc) return null;
      return _expandTaskDoc(doc);
    }

    // Most specific first. A one-off doc is listed before the recurring doc
    // of the same scope because it is the more deliberate instruction.
    const ordered = [
      expand(docs.student),
      expand(docs.weeklyStudent),
      expand(docs.class),
      expand(docs.weeklyClass),
      expand(docs.global),
      expand(docs.weekly),
    ].filter(d => d && d.active === true);

    const resolved = ordered.length > 0 ? _mergeTaskDocs(ordered) : { active: false };

    AppState.currentTaskConfig = resolved;

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

            // The server copy is the truth. Only while this client still has
            // unconfirmed local writes do we protect a completion we just made
            // from being overwritten by an older snapshot.
            const meta       = snap.metadata || {};
            const unconfirmed = !!(meta.hasPendingWrites || meta.fromCache);
            const existingCompleted =
              (AppState.studentData && AppState.studentData.coachingCompleted) || {};
            const incomingCompleted = incoming.coachingCompleted || {};

            const mergedCompleted = unconfirmed
              ? Object.assign({}, incomingCompleted, existingCompleted)
              : Object.assign({}, incomingCompleted);

            AppState.studentData = Object.assign(
              {},
              AppState.studentData,
              incoming,
              { coachingCompleted: mergedCompleted }
            );

            // Moved to another class? The class-level task documents are
            // different ones, so the task listeners must be rebuilt.
            if (_listenedClass !== null && (incoming.class || '') !== _listenedClass) {
              loadCoachingTasks().catch(err => console.warn('[tasks] reload after class change:', err));
            }

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

      let bgColor, borderColor, iconColor, iconName, labelText, labelColor;

      if (isDone) {
        bgColor = 'var(--success-bg)'; borderColor = 'var(--success-border)';
        iconColor = 'var(--success)'; iconName = 'Check'; labelText = 'Done';
        labelColor = 'var(--success-text)';
      } else if (isMissed) {
        bgColor = 'var(--danger-bg)'; borderColor = 'var(--danger)';
        iconColor = 'var(--danger)'; iconName = 'X'; labelText = 'Missed';
        labelColor = 'var(--danger)';
      } else if (isToday) {
        bgColor = 'var(--warning-bg)'; borderColor = 'var(--warning)';
        iconColor = 'var(--warning)'; iconName = 'Circle'; labelText = 'Today';
        labelColor = 'var(--warning-text)';
      } else if (isFuture) {
        bgColor = 'var(--surface)'; borderColor = 'var(--border)';
        iconColor = 'var(--border-medium)'; iconName = 'Minus'; labelText = 'Upcoming';
        labelColor = 'var(--text-disabled)';
      } else {
        bgColor = 'var(--surface)'; borderColor = 'var(--border)';
        iconColor = 'var(--border-medium)'; iconName = 'Minus'; labelText = '–';
        labelColor = 'var(--text-disabled)';
      }

      return `<div style="background:${bgColor};border:1.5px solid ${borderColor};` +
        `border-radius:8px;padding:.625rem .875rem;text-align:center;">` +
        `<p style="font-size:.8125rem;font-weight:500;color:var(--text-secondary);">${_esc(formatted)}</p>` +
        `<p style="margin-top:4px;display:flex;justify-content:center;color:${iconColor};">${_icon(iconName, 20)}</p>` +
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
        `<span style="font-size:.75rem;font-weight:700;color:var(--success);display:inline-flex;align-items:center;gap:3px;">${_icon('Check', 13)} ${totalDone} done</span>` +
        (totalMissed > 0
          ? `<span style="font-size:.75rem;font-weight:700;color:var(--danger);display:inline-flex;align-items:center;gap:3px;">${_icon('X', 13)} ${totalMissed} missed</span>`
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
        `<p style="font-size:.9375rem;font-weight:700;color:var(--success-text);display:inline-flex;align-items:center;gap:.375rem;">` +
        `${_icon('Confetti', 18)} This week: all done!</p>` +
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
        `border:1px solid var(--brand-border);margin-left:.5rem;` +
        `display:inline-flex;align-items:center;gap:4px;">${_icon('ArrowsClockwise', 11)} Recurring</span>`
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
    _listenedClass = null;
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
