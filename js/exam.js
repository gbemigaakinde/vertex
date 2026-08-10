/* ============================================================
   js/exam.js — Exam engine
   ============================================================ */

(function () {
  'use strict';

  const S   = () => AppState;
  const Db  = () => window.fbDb;
  const CFG = () => AppConfig;

  let _questionRenderedAt = 0;
  let _renderSubjectSelectionInProgress = false;

  /* ─────────────────────────────────────────────────────── */
  /* LaTeX preprocessing                                     */
  /* ─────────────────────────────────────────────────────── */
  function preprocessLatex(str) {
    if (str == null) return '';
    str = String(str);
    const protectedBlocks = [];
    str = str.replace(/\$\$[\s\S]*?\$\$|\$[^$]*?\$/g, function (match) {
      protectedBlocks.push(match);
      return '%%MATH_' + (protectedBlocks.length - 1) + '%%';
    });
    str = str
      .replace(/\\implies/g,        '⟹')
      .replace(/\\Rightarrow/g,     '⇒')
      .replace(/\\rightarrow/g,     '→')
      .replace(/\\leftarrow/g,      '←')
      .replace(/\\leftrightarrow/g, '↔')
      .replace(/\\geq/g,   '≥').replace(/\\leq/g,   '≤').replace(/\\neq/g,   '≠')
      .replace(/\\approx/g,'≈').replace(/\\times/g, '×').replace(/\\div/g,   '÷')
      .replace(/\\pm/g,    '±').replace(/\\cdot/g,  '·')
      .replace(/\^\\circ/g,'°').replace(/\\degree/g,'°').replace(/\\infty/g, '∞')
      .replace(/\\pi/g,    'π').replace(/\\alpha/g, 'α').replace(/\\beta/g,  'β')
      .replace(/\\gamma/g, 'γ').replace(/\\delta/g, 'δ').replace(/\\theta/g, 'θ')
      .replace(/\\lambda/g,'λ').replace(/\\mu/g,    'μ').replace(/\\sigma/g, 'σ')
      .replace(/\\omega/g, 'ω')
      .replace(/\\in/g,      '∈').replace(/\\notin/g,  '∉').replace(/\\subset/g,'⊂')
      .replace(/\\cup/g,     '∪').replace(/\\cap/g,    '∩').replace(/\\emptyset/g,'∅')
      .replace(/\\therefore/g,'∴').replace(/\\because/g,'∵');
    str = str.replace(/%%MATH_(\d+)%%/g, function (_, i) {
      return protectedBlocks[parseInt(i, 10)];
    });
    return str;
  }

  function _safeQ(str) { return _escHtml(preprocessLatex(str)); }

  /* ─────────────────────────────────────────────────────── */
  /* Duration helpers                                        */
  /* ─────────────────────────────────────────────────────── */
  function _examDurationMs() {
    const fromExam = S().exam && typeof S().exam.durationMs === 'number' && S().exam.durationMs > 0
      ? S().exam.durationMs : null;
    const fromTask = S().currentTaskConfig && typeof S().currentTaskConfig.durationMs === 'number'
      && S().currentTaskConfig.durationMs > 0 ? S().currentTaskConfig.durationMs : null;
    return fromExam || fromTask || CFG().EXAM_DURATION_MS;
  }

  function _formatDuration(ms) {
    const totalMin = Math.round(ms / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0)  return `${m} minute${m !== 1 ? 's' : ''}`;
    if (m === 0)  return `${h} hour${h !== 1 ? 's' : ''}`;
    return `${h} hour${h !== 1 ? 's' : ''} ${m} minute${m !== 1 ? 's' : ''}`;
  }

  function _initialTimerStr(ms) {
    const h = String(Math.floor(ms / 3_600_000)).padStart(2, '0');
    const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0');
    return `${h}:${m}:00`;
  }

  function _currentTimerStr() {
    if (!S().examStartMs) return _initialTimerStr(_examDurationMs());
    const remaining = _examDurationMs() - (Date.now() - S().examStartMs);
    if (remaining <= 0) return '00:00:00';
    const h   = String(Math.floor(remaining / 3_600_000)).padStart(2, '0');
    const m   = String(Math.floor((remaining % 3_600_000) / 60_000)).padStart(2, '0');
    const sec = String(Math.floor((remaining % 60_000) / 1_000)).padStart(2, '0');
    return `${h}:${m}:${sec}`;
  }

  function _currentTimerClass() {
    if (!S().examStartMs) return 'timer-green';
    const duration  = _examDurationMs();
    const remaining = duration - (Date.now() - S().examStartMs);
    if (remaining < duration * 0.08)  return 'timer-red';
    if (remaining < duration * 0.25)  return 'timer-yellow';
    return 'timer-green';
  }

  /* Timer ring progress 0..1 */
  function _timerProgress() {
    if (!S().examStartMs) return 1;
    const duration  = _examDurationMs();
    const remaining = Math.max(0, duration - (Date.now() - S().examStartMs));
    return remaining / duration;
  }

  function _resolveStartMs(startTime) {
    if (!startTime) return null;
    if (typeof startTime.toDate === 'function') return startTime.toDate().getTime();
    if (typeof startTime.seconds === 'number')  return startTime.seconds * 1000;
    if (startTime instanceof Date)              return startTime.getTime();
    if (typeof startTime === 'number')          return startTime;
    return null;
  }

  function _todayStr() {
    return (window.Tasks && Tasks._localDateStr)
      ? Tasks._localDateStr()
      : (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        })();
  }

  function _getRestrictedSubjectsForToday() {
    const taskCfg = S().currentTaskConfig || {};
    if (!taskCfg.active) return null;
    const today = _todayStr();
    if (window.Tasks && Tasks._resolveSubjectsForDate) {
      const subjects = Tasks._resolveSubjectsForDate(taskCfg, today);
      return Array.isArray(subjects) && subjects.length > 0 ? subjects : null;
    }
    if (taskCfg.dateSubjects && typeof taskCfg.dateSubjects === 'object') {
      const todaySubjects = taskCfg.dateSubjects[today];
      if (Array.isArray(todaySubjects) && todaySubjects.length > 0) return todaySubjects;
    }
    if (Array.isArray(taskCfg.allowedSubjects) && taskCfg.allowedSubjects.length > 0) {
      return taskCfg.allowedSubjects;
    }
    return null;
  }

  function _isTaskRestricted() {
    const taskCfg = S().currentTaskConfig || {};
    if (!taskCfg.active) return false;
    const today = _todayStr();
    const dates = Array.isArray(taskCfg.dates) ? taskCfg.dates : [];
    return dates.includes(today);
  }

  /* ─────────────────────────────────────────────────────── */
  /* Greeting                                                */
  /* ─────────────────────────────────────────────────────── */
  async function loadOrStart() {
    try {
      let examData = null;
      try {
        const snap = await window.fbDb.collection('ongoingExams').doc(S().userId).get();
        if (snap.exists) examData = snap.data();
      } catch (err) {
        console.error('[exam] Firebase ongoingExams read failed:', err);
        UI.toast('Could not load your exam. Please check your internet connection and try again.', 'error', 0);
        return;
      }

      if (!examData) { await renderSubjectSelection(); return; }

      S().exam = examData;
      const startMs = _resolveStartMs(examData.startTime);

      if (startMs) {
        S().examStartMs = startMs;
        const elapsed = Date.now() - startMs;
        if (elapsed >= _examDurationMs()) {
          console.warn('[exam] Resumed but time already expired. Auto-submitting.');
          renderExam();
          await submitExam(true);
          return;
        }
        renderExam();
        _startTimer();
      } else {
        renderExam();
        _showInstructionsModal();
      }
    } catch (err) {
      console.error('[exam] loadOrStart error:', err);
      UI.toast('Failed to load your exam. Please refresh.', 'error');
    }
  }

  function _isTodayTaskDayCompleted() {
    const taskCfg = S().currentTaskConfig;
    if (!taskCfg || !taskCfg.active) return false;
    const today     = _todayStr();
    const dates     = Array.isArray(taskCfg.dates) ? taskCfg.dates : [];
    const completed = (S().studentData && S().studentData.coachingCompleted) || {};
    return dates.includes(today) && !!completed[today];
  }

  function _isTodayATaskDay() {
    const taskCfg = S().currentTaskConfig;
    if (!taskCfg || !taskCfg.active) return false;
    const today = _todayStr();
    const dates = Array.isArray(taskCfg.dates) ? taskCfg.dates : [];
    return dates.includes(today);
  }

  function _nextUnlockedDateLabel() {
    const taskCfg = S().currentTaskConfig;
    if (!taskCfg) return null;
    const today     = _todayStr();
    const dates     = Array.isArray(taskCfg.dates) ? taskCfg.dates : [];
    const completed = (S().studentData && S().studentData.coachingCompleted) || {};
    const next = dates.find(d => d > today && !completed[d]);
    if (!next) return null;
    const parts = next.split('-');
    return new Date(+parts[0], +parts[1] - 1, +parts[2])
      .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function _getGreeting(name) {
    const hour   = new Date().getHours();
    const minute = new Date().getMinutes();
    const time   = hour + minute / 60;
    const n      = _escHtml(name);
    const wittyMorning = [
      `Good morning, ${n}. Welcome to your dashboard.`,
      `Good morning, ${n}. It is good to see you.`,
      `Good morning, ${n}. Ready for a great day?`,
      `Good morning, ${n}. Welcome back.`,
      `Good morning, ${n}. Have a productive day.`,
      `Good morning, ${n}. Ready for another day of learning?`,
      `Good morning, ${n}. Have a great day and do your best.`,
    ];
    const wittyAfternoon = [
      `Good afternoon, ${n}. Welcome to your dashboard.`,
      `Good afternoon, ${n}. It is good to see you.`,
      `Good afternoon, ${n}. How is your day going?`,
      `Good afternoon, ${n}. Welcome back.`,
      `Good afternoon, ${n}. Have a productive afternoon.`,
      `Good afternoon, ${n}. Keep up the good work.`,
    ];
    const wittyEvening = [
      `Good evening, ${n}. Welcome to your dashboard.`,
      `Good evening, ${n}. It is good to see you.`,
      `Good evening, ${n}. How was your day?`,
      `Good evening, ${n}. Welcome back.`,
      `Good evening, ${n}. Have a productive study session.`,
      `Good evening, ${n}. Have a pleasant evening.`,
      `Good evening, ${n}. Keep up the good work.`,
    ];
    const wittyLateNight = [
      `Good evening, ${n}. Welcome to your dashboard.`,
      `Welcome back, ${n}. How are you doing?`,
      `Good evening, ${n}. It is good to see you.`,
      `Welcome back, ${n}. Take your time and do your best.`,
      `Good evening, ${n}. How was your day?`,
      `Welcome, ${n}. Have a good study session.`,
    ];
    function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    const goWitty = Math.random() < 0.40;
    if (time >= 0 && time < 5)   return goWitty ? _pick(wittyLateNight) : `Burning the midnight oil, ${n}? Let's go!`;
    if (time >= 5 && time < 6.5) return goWitty ? _pick(wittyMorning) : `You're up early, ${n}! The early bird catches the grade.`;
    if (time >= 6.5 && time < 12) return goWitty ? _pick(wittyMorning) : `Good morning, ${n}!`;
    if (time >= 12 && time < 13) {
      const noonOptions = [
        `Good afternoon, ${n}! Right on time.`,
        `High noon, ${n}! Time to show what you know.`,
        `Midday check-in, ${n}! Let's make this session count.`,
      ];
      return _pick(noonOptions);
    }
    if (time >= 13 && time < 17) return goWitty ? _pick(wittyAfternoon) : `Good afternoon, ${n}!`;
    if (time >= 17 && time < 19) {
      const earlyEveOptions = [
        `Evening, ${n}! The day's work isn't done yet.`,
        `Good evening, ${n}! Prime study hours ahead.`,
        `Hey ${n}, the evening session awaits!`,
      ];
      return goWitty ? _pick(wittyEvening) : _pick(earlyEveOptions);
    }
    if (time >= 19 && time < 21) return goWitty ? _pick(wittyEvening) : `Good evening, ${n}!`;
    if (time >= 21 && time < 23) return goWitty ? _pick(wittyLateNight) : `Night study session, ${n}! Keep pushing.`;
    return goWitty ? _pick(wittyLateNight) : `Late night hustle, ${n}! Respect the dedication.`;
  }

  /* ─────────────────────────────────────────────────────── */
  /* Weekly timetable                                        */
  /* ─────────────────────────────────────────────────────── */
  function _isoWeekKey(date) {
    const d        = date ? new Date(date) : new Date();
    const thursday = new Date(d);
    thursday.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const yearStart = new Date(thursday.getFullYear(), 0, 4);
    const wn        = Math.round(((thursday - yearStart) / 86400000 + 1) / 7);
    return thursday.getFullYear() + '-W' + String(wn).padStart(2, '0');
  }

  async function _fetchWeeklyTimetableHtml(classKey) {
    try {
      if (!navigator.onLine || !window.fbDb || !classKey) return '';
      const snap = await window.fbDb.collection('weeklyTimetable').doc(classKey).get();
      if (!snap || !snap.exists) return '';
      const ttData   = snap.data() || {};
      const allWeeks = ttData.weeks || {};
      const topics   = allWeeks[_isoWeekKey()] || {};
      const entries  = Object.entries(topics).filter(function (pair) {
        return pair[1] && String(pair[1]).trim();
      });
      if (entries.length === 0) return '';

      const d      = new Date();
      const dow    = d.getDay();
      const diff   = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(d); monday.setDate(d.getDate() + diff);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      const rangeLabel =
        monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
        ' – ' +
        sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

      const rows = entries.map(function (pair) {
        return '<div style="display:flex;align-items:flex-start;gap:.625rem;' +
          'padding:.4375rem 0;border-bottom:1px solid var(--border);">' +
          '<span style="font-size:.8125rem;font-weight:700;color:var(--accent-text);' +
          'min-width:100px;flex-shrink:0;">' + _escHtml(pair[0]) + '</span>' +
          '<span style="font-size:.8125rem;color:var(--text-1);line-height:1.5;">' +
          _escHtml(pair[1]) + '</span></div>';
      }).join('');

      return '<div style="margin-bottom:1.25rem;border:1px solid var(--accent-border);' +
        'border-left:3px solid var(--accent);border-radius:8px;' +
        'background:var(--accent-subtle);padding:.875rem 1rem;text-align:left;">' +
        '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.625rem;">' +
        '<span style="font-size:1rem;flex-shrink:0;">📚</span>' +
        '<div><p style="font-size:.875rem;font-weight:700;color:var(--accent-text);">This Week\'s Study Topics</p>' +
        '<p style="font-size:.75rem;color:var(--text-3);margin-top:1px;">' + _escHtml(rangeLabel) + '</p>' +
        '</div></div><div style="padding-top:.125rem;">' + rows + '</div></div>';
    } catch (err) {
      console.warn('[exam] Weekly timetable fetch failed (non-fatal):', err);
      return '';
    }
  }

  /* ─────────────────────────────────────────────────────── */
  /* renderSubjectSelection — pill chip version              */
  /* ─────────────────────────────────────────────────────── */
  async function renderSubjectSelection() {
    if (_renderSubjectSelectionInProgress) {
      console.warn('[exam] renderSubjectSelection already in progress — skipping duplicate call.');
      return;
    }
    if (!S().studentData || !S().userId) {
      console.warn('[exam] renderSubjectSelection called with no studentData/userId — aborting.');
      return;
    }

    _renderSubjectSelectionInProgress = true;

    try {
      const classKey = (S().studentData.class || '').replace(/\s+/g, '').toLowerCase();
      const _qBank   = window.questions || {};

      if (!S().studentData || !S().userId) {
        console.warn('[exam] State lost before timetable fetch — aborting render.');
        return;
      }

      const weeklyTimetableHtmlPromise = _fetchWeeklyTimetableHtml(classKey);

      if (!_qBank[classKey]) {
        console.error('[exam] No questions for classKey:', classKey);
        UI.toast(`No subjects found for class "${S().studentData.class}". Contact Master Timothy.`, 'error', 0);
        return;
      }

      const todayTaskDone   = _isTodayTaskDayCompleted();
      const allAvailable    = Object.keys(_qBank[classKey]);
      const restrictedSubjs = _getRestrictedSubjectsForToday();
      const available       = restrictedSubjs
        ? allAvailable.filter(s => restrictedSubjs.includes(s))
        : allAvailable;
      const isTaskDay   = _isTaskRestricted();
      const minSubjects = (restrictedSubjs && isTaskDay) ? 1 : 2;
      const messages    = S().studentMessages || [];

      // Ticker
      let tickerHtml = '';
      if (messages.length > 0) {
        const tickerItems = messages
          .map(m => '<span class="vtx-ticker-item">' + _escHtml(m.message) + '</span>')
          .join('<span class="vtx-ticker-sep">✦ ✦ ✦</span>');
        tickerHtml =
          '<div class="vtx-ticker-wrap">' +
            '<div class="vtx-ticker-label">INFO</div>' +
            '<div class="vtx-ticker-viewport">' +
              '<div class="vtx-ticker-track" id="vtxTickerTrack">' +
                '<span class="vtx-ticker-half" id="vtxTickerHalf">' +
                  tickerItems +
                  '<span class="vtx-ticker-sep">✦✦✦</span>' +
                '</span>' +
              '</div>' +
            '</div>' +
          '</div>';
      }

      const restrictionBannerHtml = restrictedSubjs
        ? `<div style="display:flex;align-items:flex-start;gap:.625rem;margin-bottom:1rem;
                       background:var(--warning-bg);border:1px solid var(--warning-border);
                       border-left:3px solid var(--warning);border-radius:8px;
                       padding:.75rem 1rem;text-align:left;">
             <span style="font-size:1.125rem;flex-shrink:0;margin-top:1px;">📋</span>
             <div>
               <p style="font-size:.875rem;font-weight:700;color:var(--warning-text);margin-bottom:.25rem;">
                 Subject restriction active for today
               </p>
               <p style="font-size:.8125rem;color:var(--text-secondary);line-height:1.6;">
                 Your coaching task requires you to attempt only:
                 <strong>${available.map(s => _escHtml(s)).join(', ') || 'no subjects'}</strong>.
               </p>
             </div>
           </div>`
        : '';

      const taskCfgForBanner = S().currentTaskConfig;
      const offDayNextLabel  = _nextUnlockedDateLabel();
      const offDayBannerHtml = (
        taskCfgForBanner && taskCfgForBanner.active &&
        !_isTodayATaskDay() && offDayNextLabel
      )
        ? `<div style="display:flex;align-items:flex-start;gap:.625rem;margin-bottom:1rem;
                       background:var(--brand-bg);border:1px solid var(--brand-border);
                       border-left:3px solid var(--brand);border-radius:8px;
                       padding:.75rem 1rem;text-align:left;">
             <span style="font-size:1.125rem;flex-shrink:0;margin-top:1px;">📅</span>
             <div>
               <p style="font-size:.875rem;font-weight:700;color:var(--brand-text);margin-bottom:.25rem;">No task session today</p>
               <p style="font-size:.8125rem;color:var(--text-secondary);line-height:1.6;">
                 You can take a free practice exam now. Your next required session is on
                 <strong>${offDayNextLabel}</strong>.
               </p>
             </div>
           </div>`
        : '';

      // ── Subject pill HTML ──────────────────────────────────
      let subjectsHtml;

      if (todayTaskDone) {
        const nextLabel = _nextUnlockedDateLabel();
        const nextLine  = nextLabel
          ? `Your next session opens on <strong>${nextLabel}</strong>.`
          : 'There are no upcoming sessions scheduled right now.';
        subjectsHtml = `
          <div style="margin-bottom:1.25rem;padding:1.25rem 1.5rem;border-radius:12px;
                      background:var(--success-bg);border:2px solid var(--success-border);text-align:center;">
            <div style="font-size:2rem;margin-bottom:.5rem;">✅</div>
            <p style="font-size:1rem;font-weight:700;color:var(--success-text);margin-bottom:.375rem;">
              Today's session complete!
            </p>
            <p style="font-size:.875rem;color:var(--text-secondary);line-height:1.6;">
              You've already submitted your exam for today's task. ${nextLine}
            </p>
          </div>
          <button disabled
                  style="display:inline-flex;align-items:center;justify-content:center;gap:.5rem;
                         padding:.75rem 2rem;border-radius:8px;font-size:.9375rem;font-weight:700;
                         background:var(--surface-muted);color:var(--text-disabled);
                         border:1.5px solid var(--border);cursor:not-allowed;width:100%;max-width:20rem;">
            🔒 Exam Locked for Today
          </button>`;

      } else if (available.length === 0) {
        subjectsHtml = `
          <p style="color:var(--danger);font-size:var(--text-sm);">
            ${restrictedSubjs
              ? 'The subjects assigned for today are not available for your class. Please contact Master Timothy.'
              : 'No subjects available for your class.'}
          </p>`;

      } else if (restrictedSubjs) {
        const enoughSubjects = available.length >= minSubjects;
        subjectsHtml = `
          <div class="vtx-subject-grid">
            ${available.map(subj => `
              <label class="vtx-subject-pill is-required is-selected">
                <input type="checkbox" value="${_escAttr(subj)}" class="subject-checkbox" checked disabled />
                <span class="vtx-subject-pill-check"></span>
                <span>${_escHtml(subj)}</span>
              </label>`).join('')}
          </div>
          ${enoughSubjects
            ? `<button id="startExamBtn" onclick="Exam.startExam()" class="btn btn-lg w-full max-w-xs">
                 Start Exam
               </button>`
            : `<p style="color:var(--danger);font-size:var(--text-sm);">
                 The assigned subject is not available for your class.
                 Please contact Master Timothy.
               </p>`}`;

      } else {
        subjectsHtml = `
          <div class="vtx-subject-grid" id="subjectPillGrid">
            ${allAvailable.map(subj => `
              <label class="vtx-subject-pill" id="pill-${_escAttr(subj)}">
                <input type="checkbox" value="${_escAttr(subj)}" class="subject-checkbox" />
                <span class="vtx-subject-pill-check"></span>
                <span>${_escHtml(subj)}</span>
              </label>`).join('')}
          </div>
          <button id="startExamBtn" onclick="Exam.startExam()" disabled class="btn btn-lg w-full max-w-xs">
            Start Exam
          </button>`;
      }

      const weeklyTimetableHtml = await weeklyTimetableHtmlPromise;

      if (!S().studentData || !S().userId) {
        console.warn('[exam] State lost before DOM mount — aborting render.');
        return;
      }

      UI.mount(`
        <div class="max-w-4xl mx-auto glass p-6 mt-6 rounded-2xl text-center animate-fadeIn">
          <div class="mb-5">
            <h1 class="text-2xl font-bold mb-1">${_getGreeting(S().studentData.name)}</h1>
            <p class="text-sm text-gray-500">
              ${_escHtml(S().studentData.class)} &bull; ${_escHtml(S().studentData.school)}
            </p>
          </div>

          ${tickerHtml}

          <div id="tasksContainer" class="mb-6"></div>

          ${weeklyTimetableHtml}

          <div class="mb-6" style="display:flex;gap:.625rem;flex-wrap:wrap;justify-content:center;">
            <button id="chatOpenBtn" onclick="Chat.openPublicChat()" class="btn bg-green-600 hover:bg-green-700" style="position:relative;">
              Public Discussion Chat
            </button>
            <button onclick="StudyRoom.openForStudent()" class="btn bg-blue-600 hover:bg-blue-700" style="position:relative;">
              📖 Study Room
            </button>
            <button onclick="ThreeDClass.openForStudent()" class="btn bg-indigo-600 hover:bg-indigo-700" style="position:relative;">
              🧪 3D Class
            </button>
            <button onclick="window.open('english.html', '_blank')" class="btn bg-purple-600 hover:bg-purple-700" style="position:relative;">
              📘 English Mastery
            </button>
            <button id="gameOpenBtn" onclick="(function(){
  if (!window.Game || typeof Game.openGameLobby !== 'function') {
    alert('Games are not loaded yet. Please wait a moment and try again.');
    return;
  }
  Promise.resolve().then(function(){ return Game.openGameLobby(); })
    .catch(function(err){
      console.error('[game] openGameLobby error:', err);
      if (window.UI && window.UI.toast) {
        UI.toast('Could not open Games. Please try again.', 'error', 4000);
      } else {
        alert('Could not open Games. Please refresh the page.');
      }
    });
  })()" class="btn"
  style="position:relative;background:linear-gradient(135deg,#7c3aed,#4f6ef7);color:#fff;">
              🎮 Games
            </button>
            <button id="gcOpenBtn" onclick="GroupChat.openForStudent()" class="btn"
              style="position:relative;background:var(--success);color:#fff;">
              💬 Group Chats
            </button>
            <button id="dmOpenBtn" onclick="DM.openStudentInbox()" class="btn bg-indigo-600 hover:bg-indigo-700"
              style="position:relative;">
              ✉️ Message Teacher
            </button>
          </div>

          ${offDayBannerHtml}
          ${todayTaskDone ? '' : restrictionBannerHtml}

          <div class="text-left mb-3">
            ${todayTaskDone ? '' : `<p style="font-size:var(--text-sm);font-weight:600;color:var(--text-3);">
              ${restrictedSubjs ? 'Your required subjects for today:' : 'Select subjects to begin (minimum 2)'}
            </p>`}
          </div>

          ${subjectsHtml}

          <div class="mt-6 pt-5" style="border-top:1px solid var(--border);">
            <button onclick="App.logout()"
                    style="font-size:var(--text-xs);color:var(--text-4);background:none;border:none;
                           cursor:pointer;text-decoration:underline;">Sign out</button>
          </div>
        </div>`);

      Tasks.renderTasksHTML();

      // Ticker scroll
      (function () {
        const track = document.getElementById('vtxTickerTrack');
        const half  = document.getElementById('vtxTickerHalf');
        if (!track || !half) return;
        let pos = 0, rafId = null, halfW = 0;
        const speed = 0.45;
        function step() {
          pos += speed;
          if (pos >= halfW) pos -= halfW;
          track.style.transform = 'translate3d(-' + pos + 'px, 0, 0)';
          rafId = requestAnimationFrame(step);
        }
        function start() {
          const clone = half.cloneNode(true);
          clone.removeAttribute('id');
          clone.setAttribute('aria-hidden', 'true');
          track.appendChild(clone);
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              halfW = Math.round(half.getBoundingClientRect().width || half.scrollWidth);
              if (halfW === 0) return;
              rafId = requestAnimationFrame(step);
            });
          });
        }
        start();
        const observer = new MutationObserver(function () {
          if (!document.getElementById('vtxTickerTrack')) { cancelAnimationFrame(rafId); observer.disconnect(); }
        });
        const appEl = document.getElementById('app');
        if (appEl) observer.observe(appEl, { childList: true, subtree: false });
      })();

      // Badge updates
      if (AppState.chatUnread && AppState.chatUnread > 0 && window.Chat && Chat._updateChatBadge) {
        requestAnimationFrame(function () { Chat._updateChatBadge(AppState.chatUnread); });
      }
      if (AppState.dmStudentUnread && AppState.dmStudentUnread > 0 && window.DM && DM._updateStudentBadge) {
        requestAnimationFrame(function () { DM._updateStudentBadge(AppState.dmStudentUnread); });
      }

      // Wire pill selection
if (!restrictedSubjs && !todayTaskDone) {
  document.querySelectorAll('.vtx-subject-pill').forEach(pill => {
    pill.addEventListener('click', function (e) {
      // Let native checkbox clicks pass through untouched
      if (e.target.type === 'checkbox') return;

      const cb = pill.querySelector('input[type="checkbox"]');
      if (!cb || cb.disabled) return;

      // Toggle manually and dispatch change so _updateStartBtn fires
      cb.checked = !cb.checked;
      pill.classList.toggle('is-selected', cb.checked);
      _updateStartBtn();
    });

    // Handle the case where the native checkbox is clicked directly
    const cb = pill.querySelector('input[type="checkbox"]');
    if (cb) {
      cb.addEventListener('change', function () {
        pill.classList.toggle('is-selected', cb.checked);
        _updateStartBtn();
      });
    }
  });
}

      // Show 3D background on dashboard
      _showBgCanvas(true);

    } catch (err) {
      console.error('[exam] renderSubjectSelection error:', err);
      if (!S().studentData || !S().userId) {
        console.warn('[exam] Caught error but state is gone — likely a logout race.');
        return;
      }
      UI.toast('Failed to load subject selection. Please refresh the page.', 'error', 0);
    } finally {
      _renderSubjectSelectionInProgress = false;
    }
  }

  function _updateStartBtn() {
    const selected = document.querySelectorAll('.subject-checkbox:checked').length;
    const btn = document.getElementById('startExamBtn');
    if (btn) btn.disabled = selected < 2;
  }

  function _getSelectedSubjects() {
    return [...document.querySelectorAll('.subject-checkbox:checked')].map(cb => cb.value);
  }

  /* ─────────────────────────────────────────────────────── */
  /* Background canvas control                               */
  /* ─────────────────────────────────────────────────────── */
  function _showBgCanvas(show) {
    const canvas = document.getElementById('vtx-bg-canvas');
    if (!canvas) return;
    if (show) {
      canvas.classList.add('is-visible');
    } else {
      canvas.classList.remove('is-visible');
    }
  }

  /* ─────────────────────────────────────────────────────── */
  /* Start exam                                              */
  /* ─────────────────────────────────────────────────────── */
  let _startExamLock = false;

  async function startExam() {
    if (_startExamLock) return;

    if (_isTodayTaskDayCompleted()) {
      UI.toast("You've already completed today's required session.", 'warning');
      await renderSubjectSelection();
      return;
    }

    const chosen = _getSelectedSubjects();
    const restrictedSubjs = _getRestrictedSubjectsForToday();
    const isTaskDay       = _isTaskRestricted();
    const minSubjects     = (restrictedSubjs && isTaskDay) ? 1 : 2;

    if (chosen.length < minSubjects) {
      UI.toast(`Select at least ${minSubjects} subject${minSubjects !== 1 ? 's' : ''}.`, 'warning');
      return;
    }

    const classKey = (S().studentData.class || '').replace(/\s+/g, '').toLowerCase();
    const _qBank   = window.questions || {};

    if (!_qBank[classKey]) {
      UI.toast(`No subjects found for class "${S().studentData.class}". Contact Master Timothy.`, 'error', 0);
      return;
    }

    const finalChosen = restrictedSubjs
      ? chosen.filter(s => restrictedSubjs.includes(s))
      : chosen;

    if (finalChosen.length < minSubjects) {
      UI.toast('Not enough allowed subjects selected. Please contact Master Timothy.', 'error');
      return;
    }

    const selectedQuestions = {};
    for (const subj of finalChosen) {
      const all = (_qBank[classKey] || {})[subj] || [];
      if (all.length === 0) { UI.toast(`No questions available for ${subj}.`, 'error'); return; }
      const shuffled = [...all].sort(() => Math.random() - 0.5);
      selectedQuestions[subj] = shuffled.slice(0, CFG().QUESTIONS_PER_SUBJECT);
    }

    const sessionDate  = _todayStr();
    const examDuration = (S().currentTaskConfig && S().currentTaskConfig.durationMs)
      || CFG().EXAM_DURATION_MS;

    const examDoc = {
      step: 'exam',
      subjects: finalChosen,
      questions: selectedQuestions,
      currentSubject: finalChosen[0],
      currentIndex: 0,
      answers: {},
      sessionDate,
      durationMs: examDuration,
    };

    const btn = document.getElementById('startExamBtn');
    UI.setLoading(btn, true);
    _startExamLock = true;

    try {
      await window.fbDb.collection('ongoingExams').doc(S().userId).set(examDoc);
      S().exam = examDoc;
      renderExam();
      _showInstructionsModal();
    } catch (err) {
      console.error('[exam] startExam error:', err);
      UI.toast('Failed to start exam. Please check your internet connection and try again.', 'error');
      _startExamLock = false;
    } finally {
      if (document.getElementById('startExamBtn')) UI.setLoading(btn, false);
    }
  }

  /* ─────────────────────────────────────────────────────── */
  /* Instructions modal                                      */
  /* ─────────────────────────────────────────────────────── */
  function _showInstructionsModal() {
    const existing = document.getElementById('examModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id        = 'examModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'align-items:flex-start;overflow-y:auto;padding:1rem 0.75rem;';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'examModalTitle');

    modal.innerHTML = `
      <div class="modal-box" style="max-width:400px;width:100%;margin:auto;">
        <h2 id="examModalTitle" class="font-bold mb-4 text-center" style="font-size:1.125rem;">Exam Instructions</h2>
        <ul class="space-y-2 mb-5 text-left list-none" style="font-size:0.875rem;">
          <li>• This exam lasts <strong>${_formatDuration(_examDurationMs())}</strong>.</li>
          <li>• Answer questions for all selected subjects.</li>
          <li>• Use <strong>Previous / Next</strong> or the navigator to move between questions.</li>
          <li>• <span class="font-semibold" style="color:var(--success);">Green</span> buttons in the navigator = answered.</li>
          <li>• You can open Public Chat at any time.</li>
          <li>• Once submitted, answers cannot be changed.</li>
          <li class="font-semibold pt-1" style="color:var(--danger);">
            ⏱ The timer starts when you click below. Switching devices will not reset it.
          </li>
        </ul>
        <button id="beginExamBtn" onclick="Exam.beginExam()" class="btn bg-green-600 hover:bg-green-700 w-full"
                style="justify-content:center;">I understand — Start Exam Now</button>
        <p class="text-center mt-3" style="font-size:0.75rem;color:var(--text-disabled);">Good luck!</p>
      </div>`;

    document.body.appendChild(modal);
    requestAnimationFrame(() => { modal.scrollTop = 0; });
  }

  /* ─────────────────────────────────────────────────────── */
  /* Visibility guard                                        */
  /* ─────────────────────────────────────────────────────── */
  let _visibilityHideCount = 0;
  let _visibilityHandler   = null;
  let _visibilityCooldown  = false;

  function _setupVisibilityGuard() {
    _teardownVisibilityGuard();
    _visibilityHandler = function () {
      if (document.visibilityState !== 'hidden') return;
      if (_visibilityCooldown) return;
      _visibilityCooldown = true;
      setTimeout(function () { _visibilityCooldown = false; }, 1000);
      _visibilityHideCount++;
      if (_visibilityHideCount === 1) {
        UI.toast('⚠️ Warning: You switched away from the exam. Please stay on this tab.', 'warning', 5000);
      } else if (_visibilityHideCount === 2) {
        UI.toast('⚠️ Final warning: One more switch will automatically submit your exam.', 'warning', 7000);
      } else if (_visibilityHideCount >= 3) {
        _teardownVisibilityGuard();
        UI.toast('Exam auto-submitted: tab hidden too many times.', 'error', 0);
        submitExam(true);
      }
    };
    document.addEventListener('visibilitychange', _visibilityHandler);
  }

  function _teardownVisibilityGuard() {
    if (_visibilityHandler) {
      document.removeEventListener('visibilitychange', _visibilityHandler);
      _visibilityHandler = null;
    }
    _visibilityHideCount = 0;
    _visibilityCooldown  = false;
  }

  /* ─────────────────────────────────────────────────────── */
  /* beginExam                                               */
  /* ─────────────────────────────────────────────────────── */
  let _beginExamLock = false;

  async function beginExam() {
    if (_beginExamLock) return;
    _beginExamLock = true;

    const beginBtn = document.getElementById('beginExamBtn');
    if (beginBtn) { beginBtn.disabled = true; beginBtn.textContent = 'Starting…'; }

    const modal = document.getElementById('examModal');
    if (modal) modal.remove();

    const startMs   = Date.now();
    const startDate = new Date(startMs);
    S().examStartMs    = startMs;
    S().exam.startTime = startDate;
    if (!S().exam.sessionDate) S().exam.sessionDate = _todayStr();

    try {
      await window.fbDb.collection('ongoingExams').doc(S().userId).set(
        { startTime: startDate, sessionDate: S().exam.sessionDate }, { merge: true }
      );
    } catch (err) {
      console.warn('[exam] Could not persist startTime to Firebase.', err);
      UI.toast('Connection issue — please make sure you stay online during this exam.', 'warning', 6000);
    }

    _startTimer();
    _setupVisibilityGuard();
    _showBgCanvas(false); // hide particles during exam for focus
    renderExam();
  }

  /* ─────────────────────────────────────────────────────── */
  /* renderExam — reduced card nesting + question transition */
  /* ─────────────────────────────────────────────────────── */
  function renderExam() {
    _questionRenderedAt = Date.now();
    const exam = S().exam;
    if (!exam) return;

    if (window.MsgNotif) MsgNotif.dismissAll();

    const subj    = exam.currentSubject;
    const qList   = exam.questions[subj];
    const q       = qList[exam.currentIndex];
    const subjIdx = exam.subjects.indexOf(subj);

    const timerStr   = _currentTimerStr();
    const timerClass = _currentTimerClass();

    // Timer ring constants
    const RING_R  = 28;
    const RING_C  = 2 * Math.PI * RING_R; // circumference
    const progress = _timerProgress();
    const offset   = RING_C * (1 - progress);
    const ringColor = timerClass === 'timer-red' ? 'is-red' : timerClass === 'timer-yellow' ? 'is-yellow' : '';

    UI.mount(`
      <div class="max-w-4xl mx-auto" style="padding:0.75rem 0;">

        <!-- Student bar — flat strip, no card -->
        <div class="vtx-student-bar">
          <span>${_escHtml(S().studentData.name)}</span>
          <span style="color:var(--border-strong);">|</span>
          <span>${_escHtml(S().studentData.class)}</span>
          <span style="color:var(--border-strong);">|</span>
          <span>${_escHtml(S().studentData.school)}</span>
        </div>

        <!-- Exam header — single glass container -->
        <div class="glass exam-header-sticky" style="padding:0.875rem 1.25rem;margin-bottom:0.75rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;">
            <div>
              <h2 style="font-size:1.1875rem;font-weight:700;line-height:1.3;">${_escHtml(subj)}</h2>
              <p style="font-size:0.8125rem;color:var(--text-3);margin-top:2px;">
                Subject ${subjIdx + 1} of ${exam.subjects.length} &bull; Q${exam.currentIndex + 1} / ${qList.length}
              </p>
            </div>
            <!-- Timer with ring -->
            <div class="vtx-timer-wrap" style="flex-shrink:0;">
              <svg class="vtx-timer-ring" width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
                <circle class="vtx-timer-ring-track" cx="36" cy="36" r="${RING_R}"/>
                <circle class="vtx-timer-ring-prog ${ringColor}"
                        cx="36" cy="36" r="${RING_R}"
                        stroke-dasharray="${RING_C}"
                        stroke-dashoffset="${offset.toFixed(2)}"
                        id="timerRingProg"/>
              </svg>
              <div style="text-align:center;position:relative;z-index:1;">
                <div id="timerDisplay" class="${timerClass}" aria-live="polite" aria-label="Time remaining">
                  ${timerStr}
                </div>
                <p style="font-size:0.625rem;color:var(--text-disabled);margin-top:1px;letter-spacing:.04em;">TIME</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Subject strip — flat pill tabs, no card -->
        <div class="vtx-subj-strip">
          ${exam.subjects.map(s => `
            <button onclick="Exam.switchSubject('${_escAttr(s)}')"
                    class="vtx-subj-tab${s === subj ? ' is-active' : ''}">
              ${_escHtml(s)}
            </button>`).join('')}
        </div>

        <!-- Question — single container -->
        <div class="vtx-question-section" id="questionSection">
          <div class="vtx-question-wrap">
            <p style="font-size:1.0625rem;font-weight:500;line-height:1.7;margin-bottom:1.25rem;color:var(--text-1);">
              <span style="font-family:var(--font-mono);font-size:.8125rem;font-weight:700;
                           color:var(--accent);margin-right:.5rem;">${exam.currentIndex + 1}.</span>${_safeQ(q.q)}</p>
            <div style="display:flex;flex-direction:column;gap:0.625rem;" id="optionsContainer">
              ${q.opts.map((opt, idx) => {
                const selected = exam.answers[`${subj}-${exam.currentIndex}`] === idx;
                const letterLabel = String.fromCharCode(65 + idx);
                return `
                  <label class="option-label${selected ? ' is-selected' : ''}"
                         style="${selected ? 'border-color:var(--brand);background:var(--brand-bg);transform:translateX(4px);' : ''}">
                    <span style="font-family:var(--font-mono);font-size:.75rem;font-weight:700;
                                 color:${selected ? 'var(--accent)' : 'var(--text-4)'};
                                 min-width:1.25rem;flex-shrink:0;margin-top:.15rem;">${letterLabel}.</span>
                    <input type="radio" name="option" value="${idx}" ${selected ? 'checked' : ''}
                           style="display:none;" aria-label="Option ${letterLabel}" />
                    <span class="flex-1">${_safeQ(opt)}</span>
                  </label>`;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Navigation buttons — no card -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;padding:0.75rem 0;border-top:1px solid var(--border);">
          <button id="prevBtn" onclick="Exam.prevQuestion()"
                  ${exam.currentIndex === 0 ? 'disabled' : ''}
                  class="btn bg-gray-500">← Prev</button>
          <button onclick="Chat.openPublicChat()" class="btn bg-green-600">Chat</button>
          <button onclick="Exam.nextQuestion()" class="btn">Next →</button>
        </div>

        <!-- Question navigator — no card wrapper -->
        <div class="vtx-nav-section">
          <div class="vtx-nav-label">${_escHtml(subj)} — Navigator</div>
          <div id="navGrid" style="display:flex;flex-wrap:wrap;gap:0.375rem;justify-content:center;">
            ${qList.map((_, i) => {
              const answered = exam.answers[`${subj}-${i}`] !== undefined;
              const current  = i === exam.currentIndex;
              return `
                <button onclick="Exam.goTo(${i})"
                        class="nav-btn ${current ? 'current' : ''} ${answered ? 'answered' : ''}"
                        aria-label="Q${i + 1}${answered ? ', answered' : ''}">${i + 1}</button>`;
            }).join('')}
          </div>
        </div>

        <!-- Submit -->
        <div style="text-align:center;padding:1rem 0 0.5rem;">
          <button onclick="Exam.submitExam()" id="submitBtn" class="btn bg-red-600">
            Submit Exam
          </button>
        </div>

      </div>`);

    // Wire options: click anywhere on the label selects it
    document.querySelectorAll('.option-label').forEach((lbl, idx) => {
      lbl.addEventListener('click', function () {
        const radio = lbl.querySelector('input[type="radio"]');
        if (!radio) return;
        radio.checked = true;
        _saveAnswer(subj, exam.currentIndex, idx);
        _updateOptionsDisplay(subj, exam.currentIndex);
        _updateNavButton(exam.currentIndex);
      });
    });

    _renderKatex();
  }

  /* ─────────────────────────────────────────────────────── */
  /* Answer helpers                                          */
  /* ─────────────────────────────────────────────────────── */
  function _saveAnswer(subj, idx, val) {
    S().exam.answers[`${subj}-${idx}`] = val;
    clearTimeout(_saveAnswer._debounce);
    _saveAnswer._debounce = setTimeout(() => {
      window.fbDb.collection('ongoingExams').doc(S().userId)
        .update({ answers: S().exam.answers })
        .catch((err) => console.warn('[exam] Firebase answer save error (non-fatal):', err));
    }, 800);
  }

  function _updateOptionsDisplay(subj, idx) {
    const selected = S().exam.answers[`${subj}-${idx}`];
    document.querySelectorAll('.option-label').forEach((lbl, i) => {
      const isSelected = i === selected;
      lbl.classList.toggle('is-selected', isSelected);
      if (isSelected) {
        lbl.style.cssText = 'border-color:var(--brand);background:var(--brand-bg);transform:translateX(4px);';
        const letter = lbl.querySelector('span');
        if (letter) letter.style.color = 'var(--accent)';
      } else {
        lbl.style.cssText = '';
        const letter = lbl.querySelector('span');
        if (letter) letter.style.color = 'var(--text-4)';
      }
    });
  }

  function _updateNavButton(idx) {
    const subj    = S().exam.currentSubject;
    const answered = S().exam.answers[`${subj}-${idx}`] !== undefined;
    const btn      = document.querySelector(`#navGrid button:nth-child(${idx + 1})`);
    if (btn && answered) btn.classList.add('answered');
  }

  /* ─────────────────────────────────────────────────────── */
  /* Question navigation with transition                     */
  /* ─────────────────────────────────────────────────────── */
  function _navigateWithTransition(fn) {
    const section = document.getElementById('questionSection');
    // Check reduced motion preference
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!section || reducedMotion) { fn(); return; }

    const wrap = section.querySelector('.vtx-question-wrap');
    if (!wrap) { fn(); return; }

    wrap.classList.add('is-leaving');
    const duration = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--t-question')) || 180;

    setTimeout(function () {
      fn();
    }, duration);
  }

  function prevQuestion() {
    if (S().exam.currentIndex > 0) {
      _navigateWithTransition(function () {
        S().exam.currentIndex--;
        renderExam();
      });
    }
  }

  function nextQuestion() {
    const elapsed = Date.now() - _questionRenderedAt;
    if (elapsed < 3000) {
      UI.toast('⚠️ You\'re moving too fast! Take a moment to read the question carefully.', 'warning', 3500);
      return;
    }
    const exam  = S().exam;
    const qList = exam.questions[exam.currentSubject];
    _navigateWithTransition(function () {
      if (exam.currentIndex < qList.length - 1) {
        exam.currentIndex++;
      } else {
        const nextIdx = exam.subjects.indexOf(exam.currentSubject) + 1;
        if (nextIdx < exam.subjects.length) {
          exam.currentSubject = exam.subjects[nextIdx];
          exam.currentIndex   = 0;
        }
      }
      renderExam();
    });
  }

  function goTo(index) {
    _navigateWithTransition(function () {
      S().exam.currentIndex = index;
      renderExam();
    });
  }

  function switchSubject(subj) {
    _navigateWithTransition(function () {
      S().exam.currentSubject = subj;
      S().exam.currentIndex   = 0;
      renderExam();
    });
  }

  /* ─────────────────────────────────────────────────────── */
  /* Timer                                                   */
  /* ─────────────────────────────────────────────────────── */
  function _startTimer() {
    S().clearTimer();
    S().timerHandle = setInterval(_updateTimerDisplay, 1000);
  }

  function _updateTimerDisplay() {
    const el = document.getElementById('timerDisplay');
    if (!el) return;

    const duration = _examDurationMs();

    if (!S().examStartMs) {
      el.textContent = _initialTimerStr(duration);
      el.className   = 'timer-green';
      return;
    }

    const remaining = duration - (Date.now() - S().examStartMs);

    if (remaining <= 0) {
      S().clearTimer();
      el.textContent = '00:00:00';
      el.className   = 'timer-red';
      UI.toast('Time is up! Your exam is being submitted.', 'warning', 0);
      submitExam(true);
      return;
    }

    const h   = String(Math.floor(remaining / 3_600_000)).padStart(2, '0');
    const m   = String(Math.floor((remaining % 3_600_000) / 60_000)).padStart(2, '0');
    const sec = String(Math.floor((remaining % 60_000) / 1_000)).padStart(2, '0');
    el.textContent = `${h}:${m}:${sec}`;

    const redThreshold    = duration * 0.08;
    const yellowThreshold = duration * 0.25;
    const newClass = remaining < redThreshold ? 'timer-red'
                   : remaining < yellowThreshold ? 'timer-yellow'
                   : 'timer-green';
    el.className = newClass;

    // Update ring
    const ring = document.getElementById('timerRingProg');
    if (ring) {
      const RING_R  = 28;
      const RING_C  = 2 * Math.PI * RING_R;
      const progress = Math.max(0, remaining / duration);
      ring.setAttribute('stroke-dashoffset', (RING_C * (1 - progress)).toFixed(2));
      ring.className = 'vtx-timer-ring-prog' +
        (remaining < redThreshold ? ' is-red' : remaining < yellowThreshold ? ' is-yellow' : '');
    }
  }

  /* ─────────────────────────────────────────────────────── */
  /* Submit                                                  */
  /* ─────────────────────────────────────────────────────── */
  let _submitLock = false;

  async function submitExam(skipConfirm) {
    if (_submitLock) return;

    if (!skipConfirm) {
      const confirmed = await UI.confirmAction('Submit your exam? This cannot be undone.');
      if (!confirmed) return;
    }

    _submitLock = true;
    S().clearTimer();
    _teardownVisibilityGuard();

    const btn = document.getElementById('submitBtn');
    UI.setLoading(btn, true);

    try {
      const exam   = S().exam;
      const result = _computeResult(exam);

      const questionSnapshots = {};
      for (const subj of exam.subjects) {
        questionSnapshots[subj] = exam.questions[subj].map((q, i) => {
          const chosenRaw = exam.answers[`${subj}-${i}`];
          return {
            q:      q.q    != null ? String(q.q)   : '',
            opts:   Array.isArray(q.opts) ? q.opts.map(o => o != null ? String(o) : '') : [],
            ans:    q.ans  != null ? Number(q.ans)  : 0,
            exp:    q.exp  != null ? String(q.exp)  : '',
            chosen: chosenRaw !== undefined && chosenRaw !== null ? Number(chosenRaw) : null,
          };
        });
      }

      const sessionDate = exam.sessionDate || _todayStr();
      const taskCfg   = S().currentTaskConfig;
      const isTaskDay = taskCfg &&
                        taskCfg.active &&
                        Array.isArray(taskCfg.dates) &&
                        taskCfg.dates.includes(sessionDate);

      const batch = window.fbDb.batch();
      batch.set(window.fbDb.collection('results').doc(), {
        ...result,
        questionSnapshots,
        sessionDate,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
      batch.delete(window.fbDb.collection('ongoingExams').doc(S().userId));
      if (isTaskDay) {
        batch.update(window.fbDb.collection('students').doc(S().userId), {
          [`coachingCompleted.${sessionDate}`]: true,
        });
      }
      await batch.commit();

      if (isTaskDay) {
        if (!S().studentData) S().studentData = {};
        if (!S().studentData.coachingCompleted) S().studentData.coachingCompleted = {};
        S().studentData.coachingCompleted[sessionDate] = true;
      }

      S().exam        = null;
      S().examStartMs = null;
      _startExamLock  = false;
      _beginExamLock  = false;

      _showBgCanvas(true); // bring background back on results screen
      renderResults(exam, result);

    } catch (err) {
      console.error('[exam] submitExam error:', err);
      UI.toast('Submission failed. Please check your internet connection and try again.', 'error', 0);
      if (document.getElementById('submitBtn')) {
        UI.setLoading(document.getElementById('submitBtn'), false);
      }
      _submitLock = false;
      return;
    }

    _submitLock = false;
  }

  function _computeResult(exam) {
    let totalCorrect = 0, totalQuestions = 0;
    const scores = {}, correctCounts = {};
    for (const subj of exam.subjects) {
      const qs = exam.questions[subj];
      let correct = 0;
      qs.forEach((q, i) => { if (exam.answers[`${subj}-${i}`] === q.ans) correct++; });
      correctCounts[subj] = correct;
      scores[subj]        = Math.round((correct / qs.length) * 100);
      totalCorrect        += correct;
      totalQuestions      += qs.length;
    }
    const percentage = Math.round((totalCorrect / totalQuestions) * 100);
    const grade = percentage >= 70 ? 'A' : percentage >= 60 ? 'B'
                : percentage >= 50 ? 'C' : percentage >= 40 ? 'D' : 'E';
    return {
      uid:    S().userId,
      name:   S().studentData.name,
      class:  S().studentData.class,
      school: S().studentData.school,
      subjects: exam.subjects,
      scores, correctCounts, percentage, grade,
    };
  }

  /* ─────────────────────────────────────────────────────── */
  /* Results — count-up animation                            */
  /* ─────────────────────────────────────────────────────── */
  function renderResults(exam, result) {
    const gradeColor = result.grade === 'A' ? 'var(--success)'
                     : result.grade === 'B' ? 'var(--info)'
                     : result.grade === 'C' ? 'var(--warning)'
                     : result.grade === 'D' ? 'var(--warning)'
                     : 'var(--danger)';

    const gradeEmoji = result.grade === 'A' ? '🏆'
                     : result.grade === 'B' ? '🥈'
                     : result.grade === 'C' ? '👍'
                     : result.grade === 'D' ? '📚'
                     : '💪';

    UI.mount(`
      <div class="max-w-4xl mx-auto glass animate-fadeIn" style="padding:1.5rem;margin-top:1.5rem;margin-bottom:1.5rem;">

        <div class="text-center mb-6">
          <div class="inline-flex items-center gap-2 mb-3"
               style="background:var(--success-bg);border:1px solid var(--success-border);border-radius:99px;padding:.375rem 1rem;">
            <span style="color:var(--success);font-size:0.875rem;font-weight:600;">✓ Submitted</span>
          </div>
          <h1 style="font-size:1.625rem;font-weight:700;">Exam Complete</h1>
          <p style="font-size:0.875rem;color:var(--text-3);margin-top:4px;">
            ${_escHtml(result.name)} &bull; ${_escHtml(result.class)} &bull; ${_escHtml(result.school)}
          </p>
        </div>

        <!-- Score display — count-up animation -->
        <div style="text-align:center;padding:2rem 1rem;border-radius:var(--r-xl);
                    background:var(--bg-subtle);margin-bottom:1.5rem;">
          <div style="display:flex;align-items:baseline;justify-content:center;gap:0.25rem;">
            <span id="vtxScoreCount" class="vtx-score-display" style="color:${gradeColor};">0</span>
            <span style="font-size:1.5rem;font-weight:700;color:${gradeColor};">%</span>
          </div>
          <div style="margin-top:0.5rem;display:flex;align-items:center;justify-content:center;gap:0.5rem;">
            <span style="font-size:1.25rem;font-weight:700;color:${gradeColor};">Grade ${result.grade}</span>
            <span style="font-size:1.5rem;" id="vtxGradeEmoji">${gradeEmoji}</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:0.75rem;justify-content:center;margin-top:1.25rem;">
            ${result.subjects.map(s => `
              <div class="cbt-score-card">
                <div style="font-size:0.75rem;color:var(--text-3);font-weight:500;">${_escHtml(s)}</div>
                <div style="font-size:1.125rem;font-weight:700;color:var(--text-1);">${result.scores[s]}%</div>
                <div style="font-size:0.6875rem;color:var(--text-4);">${result.correctCounts[s]}/${exam.questions[s].length}</div>
              </div>`).join('')}
          </div>
        </div>

        <p style="font-size:0.875rem;color:var(--text-3);text-align:center;margin-bottom:1.25rem;">
          Click a subject below to review your answers and explanations.
        </p>

        <div style="display:flex;flex-direction:column;gap:0.625rem;margin-bottom:1.5rem;">
          ${exam.subjects.map(subj => {
            const qs = exam.questions[subj];
            return `
              <details style="border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;">
                <summary style="padding:.875rem 1.125rem;font-size:.9375rem;font-weight:700;cursor:pointer;
                                list-style:none;display:flex;align-items:center;justify-content:space-between;
                                background:var(--bg-subtle);user-select:none;">
                  <span>${_escHtml(subj)} — ${result.correctCounts[subj]}/${qs.length} Correct (${result.scores[subj]}%)</span>
                  <span style="font-size:1.125rem;color:var(--text-4);transition:transform .15s;">›</span>
                </summary>
                <div style="padding:1rem;display:flex;flex-direction:column;gap:0.75rem;background:var(--bg-base);">
                  ${qs.map((q, i) => {
                    const userAns = exam.answers[`${subj}-${i}`];
                    const correct = userAns === q.ans;
                    const borderStyle = correct
                      ? 'border-left:3px solid var(--success);background:var(--success-subtle);'
                      : userAns === undefined
                      ? 'border-left:3px solid var(--border-strong);background:var(--bg-subtle);'
                      : 'border-left:3px solid var(--danger);background:var(--danger-subtle);';
                    return `
                      <div style="border-radius:var(--r-lg);padding:1rem;border:1px solid var(--border);${borderStyle}">
                        <p style="font-weight:600;margin-bottom:.75rem;font-size:.9375rem;">${i + 1}. ${_safeQ(q.q)}</p>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;font-size:.8125rem;margin-bottom:.75rem;">
                          <div>
                            <span style="font-weight:600;color:var(--text-3);">Your answer:</span>
                            <span style="margin-left:.375rem;font-weight:500;
                                         color:${correct ? 'var(--success)' : userAns === undefined ? 'var(--text-4)' : 'var(--danger)'};">
                              ${userAns !== undefined ? _safeQ(q.opts[userAns]) : 'Not answered'}
                            </span>
                          </div>
                          <div>
                            <span style="font-weight:600;color:var(--text-3);">Correct:</span>
                            <span style="margin-left:.375rem;font-weight:500;color:var(--success);">${_safeQ(q.opts[q.ans])}</span>
                          </div>
                        </div>
                        <div style="background:var(--bg-subtle);border:1px solid var(--border);border-radius:var(--r-sm);
                                    padding:.625rem .875rem;font-size:.8125rem;color:var(--text-2);line-height:1.6;">
                          <span style="font-weight:600;">Explanation:</span> ${_safeQ(q.exp)}
                        </div>
                      </div>`;
                  }).join('')}
                </div>
              </details>`;
          }).join('')}
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:0.75rem;justify-content:center;">
          <button onclick="Exam._shareWhatsApp()" class="btn bg-green-600">Share on WhatsApp</button>
          <button onclick="Exam._copyResult()"    class="btn bg-blue-600">Copy Result</button>
          <button onclick="Exam.renderSubjectSelection()" class="btn">New Exam</button>
        </div>

      </div>`);

    _currentResultForShare = { exam, result };

    // Count-up animation
    _countUp('vtxScoreCount', result.percentage, 1200);

    // Details summary arrow rotation
    document.querySelectorAll('details').forEach(function (det) {
      det.addEventListener('toggle', function () {
        const arrow = det.querySelector('summary span:last-child');
        if (arrow) arrow.style.transform = det.open ? 'rotate(90deg)' : '';
      });
    });

    _renderKatex();
  }

  /* Count-up number animation */
  function _countUp(id, target, duration) {
    const el = document.getElementById(id);
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = target;
      return;
    }
    const start     = 0;
    const startTime = performance.now();
    function step(now) {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased    = 1 - Math.pow(1 - progress, 3);
      const current  = Math.round(start + (target - start) * eased);
      el.textContent = current;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ─────────────────────────────────────────────────────── */
  /* KaTeX                                                   */
  /* ─────────────────────────────────────────────────────── */
  function _renderKatex() {
    requestAnimationFrame(function () {
      if (window._katexAutoRenderReady && window.renderMathInElement) {
        try {
          renderMathInElement(document.getElementById('app'), {
            delimiters: [
              { left:'$$', right:'$$', display:true  },
              { left:'$',  right:'$',  display:false },
              { left:'\\(', right:'\\)', display:false },
              { left:'\\[', right:'\\]', display:true  },
            ],
            throwOnError: false, errorColor: '#cc0000',
          });
        } catch (err) { console.warn('[KaTeX] Render error:', err); }
      } else {
        setTimeout(_renderKatex, 150);
      }
    });
  }

  /* ─────────────────────────────────────────────────────── */
  /* Share / copy                                            */
  /* ─────────────────────────────────────────────────────── */
  let _currentResultForShare = null;

  function _shareWhatsApp() {
    if (!_currentResultForShare) return;
    const { result } = _currentResultForShare;
    let text = `*Vertex Tutorial CBT Result*%0A%0AName: ${result.name}%0AClass: ${result.class}%0ASchool: ${result.school}%0A%0AOverall: ${result.percentage}% - Grade ${result.grade}%0A%0A`;
    result.subjects.forEach(s => { text += `${s}: ${result.scores[s]}%25%0A`; });
    window.open(`https://wa.me/?text=${text}`);
  }

  function _copyResult() {
    if (!_currentResultForShare) return;
    const { result } = _currentResultForShare;
    let text = `Vertex Tutorial CBT Result\n\nName: ${result.name}\nClass: ${result.class}\nSchool: ${result.school}\n\nOverall: ${result.percentage}% - Grade ${result.grade}\n\n`;
    result.subjects.forEach(s => { text += `${s}: ${result.scores[s]}%\n`; });
    navigator.clipboard.writeText(text)
      .then(() => UI.toast('Result copied to clipboard!', 'success'))
      .catch(() => UI.toast('Could not copy to clipboard.', 'error'));
  }

  /* ─────────────────────────────────────────────────────── */
  /* Escape helpers                                          */
  /* ─────────────────────────────────────────────────────── */
  function _escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _escAttr(str) { return _escHtml(str).replace(/'/g,'&#39;'); }

  /* ─────────────────────────────────────────────────────── */
  /* Public API                                              */
  /* ─────────────────────────────────────────────────────── */
  window.Exam = {
    loadOrStart,
    renderSubjectSelection,
    startExam,
    beginExam,
    renderExam,
    prevQuestion,
    nextQuestion,
    goTo,
    switchSubject,
    submitExam,
    renderResults,
    _shareWhatsApp,
    _copyResult,
    _escHtml,
    _escAttr,
    preprocessLatex,
    _isTodayTaskDayCompleted,
    _isTodayATaskDay,
    _nextUnlockedDateLabel,
  };

})();
