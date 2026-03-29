/* ============================================================
   js/exam.js — Exam engine: start, navigate, timer, submit
   ============================================================ */

(function () {
  'use strict';

  const S   = () => AppState;
  const Db  = () => window.fbDb;
  const CFG = () => AppConfig;

  let _questionRenderedAt = 0;

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

  function _safeQ(str) {
    return _escHtml(preprocessLatex(str));
  }

  function _examDurationMs() {
    const fromExam = S().exam && typeof S().exam.durationMs === 'number' && S().exam.durationMs > 0
      ? S().exam.durationMs : null;
    const fromTask = S().currentTaskConfig && typeof S().currentTaskConfig.durationMs === 'number'
      && S().currentTaskConfig.durationMs > 0
      ? S().currentTaskConfig.durationMs : null;
    return fromExam || fromTask || CFG().EXAM_DURATION_MS;
  }

  function _formatDuration(ms) {
    const totalMin = Math.round(ms / 60_000);
    const h        = Math.floor(totalMin / 60);
    const m        = totalMin % 60;
    if (h === 0)   return `${m} minute${m !== 1 ? 's' : ''}`;
    if (m === 0)   return `${h} hour${h !== 1 ? 's' : ''}`;
    return `${h} hour${h !== 1 ? 's' : ''} ${m} minute${m !== 1 ? 's' : ''}`;
  }

  function _initialTimerStr(ms) {
    const h = String(Math.floor(ms / 3_600_000)).padStart(2, '0');
    const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0');
    return `${h}:${m}:00`;
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

  async function loadOrStart() {
    try {
      const snap = await Db().collection('ongoingExams').doc(S().userId).get();

      if (!snap.exists) {
        await renderSubjectSelection();
        return;
      }

      S().exam = snap.data();
      const startMs = _resolveStartMs(S().exam.startTime);

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
      `Rise and grind, ${n}! The exam won't pass itself.`,
      `Good morning, ${n}! Neurons charged and ready?`,
      `Morning, ${n}! Today's forecast: 100% chance of correct answers.`,
      `Ah, ${n}! The early bird catches the A-grade.`,
      `Up and at 'em, ${n}! Shakespeare didn't write itself either.`,
      `Good morning, ${n}! Your future self is cheering you on.`,
      `Morning, ${n}! Let's make those neurons dance.`,
    ];

    const wittyAfternoon = [
      `Still going strong, ${n}? The afternoon slump is a myth!`,
      `Good afternoon, ${n}! Half the day is yours — own it.`,
      `Hey ${n}, afternoon fuel: focus + determination = results.`,
      `Welcome back, ${n}! Post-lunch brain is a myth — prove it.`,
      `Afternoon, ${n}! Every question answered is a step closer.`,
      `Great to see you, ${n}! The grind doesn't take a lunch break.`,
    ];

    const wittyEvening = [
      `Evening, ${n}! The great minds studied by lamplight too.`,
      `Night owl mode activated, ${n}! 🦉`,
      `Good evening, ${n}! The quiet hours belong to the dedicated.`,
      `Welcome, ${n}! Even Newton had evening breakthroughs.`,
      `Evening grind, ${n}! This is where legends are made.`,
      `Hey ${n}, the library never judges. Neither do we.`,
      `Burning the midnight oil early, ${n}? Respect.`,
    ];

    const wittyLateNight = [
      `Still here, ${n}? Dedication level: extraordinary.`,
      `Late night session, ${n}! Einstein approved of this hustle.`,
      `Burning the midnight oil, ${n}? The results will show it.`,
      `Night mode: ON. Sleep can wait, ${n}!`,
      `${n}, the night is young and so is your potential.`,
      `Midnight warrior, ${n}! Every minute counts.`,
    ];

    function _pick(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    const goWitty = Math.random() < 0.40;

    if (time >= 0 && time < 5) {
      return goWitty ? _pick(wittyLateNight) : `Burning the midnight oil, ${n}? Let's go!`;
    }
    if (time >= 5 && time < 6.5) {
      return goWitty ? _pick(wittyMorning) : `You're up early, ${n}! The early bird catches the grade.`;
    }
    if (time >= 6.5 && time < 12) {
      return goWitty ? _pick(wittyMorning) : `Good morning, ${n}!`;
    }
    if (time >= 12 && time < 13) {
      const noonOptions = [
        `Good afternoon, ${n}! Right on time.`,
        `High noon, ${n}! Time to show what you know.`,
        `Midday check-in, ${n}! Let's make this session count.`,
      ];
      return _pick(noonOptions);
    }
    if (time >= 13 && time < 17) {
      return goWitty ? _pick(wittyAfternoon) : `Good afternoon, ${n}!`;
    }
    if (time >= 17 && time < 19) {
      const earlyEveOptions = [
        `Evening, ${n}! The day's work isn't done yet.`,
        `Good evening, ${n}! Prime study hours ahead.`,
        `Hey ${n}, the evening session awaits!`,
      ];
      return goWitty ? _pick(wittyEvening) : _pick(earlyEveOptions);
    }
    if (time >= 19 && time < 21) {
      return goWitty ? _pick(wittyEvening) : `Good evening, ${n}!`;
    }
    if (time >= 21 && time < 23) {
      return goWitty ? _pick(wittyLateNight) : `Night study session, ${n}! Keep pushing.`;
    }
    return goWitty ? _pick(wittyLateNight) : `Late night hustle, ${n}! Respect the dedication.`;
  }

  async function renderSubjectSelection() {
    try {
      const classKey = (S().studentData.class || '').replace(/\s+/g, '').toLowerCase();

      const _qBank = window.questions || {};

      if (!_qBank[classKey]) {
        console.error('[exam] No questions for classKey:', classKey, '| keys:', Object.keys(_qBank));
        UI.toast(`No subjects found for class "${S().studentData.class}". Contact Master Timothy.`, 'error', 0);
        return;
      }

      const todayTaskDone = _isTodayTaskDayCompleted();

      const allAvailable    = Object.keys(_qBank[classKey]);
      const restrictedSubjs = _getRestrictedSubjectsForToday();
      const available       = restrictedSubjs
        ? allAvailable.filter(s => restrictedSubjs.includes(s))
        : allAvailable;

      const messages = S().studentMessages || [];

      let messagesHtml = '';
      if (messages.length > 0) {
        messagesHtml = `
          <div class="space-y-3 mb-6">
            <h3 class="text-base font-bold text-center text-red-600">Messages from Master Timothy</h3>
            ${messages.map(m => `
              <div class="glass-dark rounded-xl border border-red-300 bg-red-50 px-4 py-3">
                <p class="text-sm font-medium mb-1">${_escHtml(m.message)}</p>
                <p class="text-xs opacity-60 text-right">
                  Expires: ${new Date(m.expiresAt && m.expiresAt.toDate ? m.expiresAt.toDate() : m.expiresAt).toLocaleString()}
                </p>
              </div>`).join('')}
          </div>`;
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
                 Other subjects are not available for this session.
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
               <p style="font-size:.875rem;font-weight:700;color:var(--brand-text);margin-bottom:.25rem;">
                 No task session today
               </p>
               <p style="font-size:.8125rem;color:var(--text-secondary);line-height:1.6;">
                 You can take a free practice exam now. Your next required session is on
                 <strong>${offDayNextLabel}</strong>.
               </p>
             </div>
           </div>`
        : '';

      let subjectsHtml;

      if (todayTaskDone) {
        const nextLabel = _nextUnlockedDateLabel();
        const nextLine  = nextLabel
          ? `Your next session opens on <strong>${nextLabel}</strong>.`
          : 'There are no upcoming sessions scheduled right now.';

        subjectsHtml = `
          <div style="margin-bottom:1.25rem;padding:1.25rem 1.5rem;border-radius:12px;
                      background:var(--success-bg);border:2px solid var(--success-border);
                      text-align:center;">
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
                         border:1.5px solid var(--border);cursor:not-allowed;
                         width:100%;max-width:20rem;">
            🔒 Exam Locked for Today
          </button>`;

      } else if (available.length === 0) {
        subjectsHtml = `
          <p class="text-red-500 text-sm">
            ${restrictedSubjs
              ? 'The subjects assigned for today are not available for your class. Please contact Master Timothy.'
              : 'No subjects available for your class.'}
          </p>`;
      } else if (restrictedSubjs) {
        const enoughSubjects = available.length >= 2;
        subjectsHtml = `
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            ${available.map(subj => `
              <label class="glass p-4 rounded-xl shadow block" style="opacity:.9;cursor:default;">
                <input type="checkbox" value="${_escAttr(subj)}"
                       class="subject-checkbox w-4 h-4 accent-indigo-600" checked disabled />
                <span class="block mt-2 text-sm font-semibold">${_escHtml(subj)}</span>
                <span style="display:block;font-size:.6875rem;color:var(--success);
                              font-weight:600;margin-top:3px;">✓ Required today</span>
              </label>`).join('')}
          </div>
          ${enoughSubjects
            ? `<button id="startExamBtn" onclick="Exam.startExam()" class="btn btn-lg w-full max-w-xs">
                 Start Exam
               </button>`
            : `<p class="text-red-500 text-sm">
                 Only ${available.length} required subject${available.length !== 1 ? 's' : ''} found.
                 At least 2 are needed. Please contact Master Timothy.
               </p>`}`;
      } else {
        subjectsHtml = `
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            ${allAvailable.map(subj => `
              <label class="glass p-4 rounded-xl cursor-pointer hover:scale-105 transition shadow block">
                <input type="checkbox" value="${_escAttr(subj)}"
                       class="subject-checkbox w-4 h-4 accent-indigo-600" />
                <span class="block mt-2 text-sm font-semibold">${_escHtml(subj)}</span>
              </label>`).join('')}
          </div>
          <button id="startExamBtn" onclick="Exam.startExam()" disabled class="btn btn-lg w-full max-w-xs">
            Start Exam
          </button>`;
      }

      UI.mount(`
        <div class="max-w-4xl mx-auto glass p-6 mt-6 rounded-2xl text-center animate-fadeIn">
          <div class="mb-5">
            <h1 class="text-2xl font-bold mb-1">${_getGreeting(S().studentData.name)}</h1>
            <p class="text-sm text-gray-500">
              ${_escHtml(S().studentData.class)} &bull; ${_escHtml(S().studentData.school)}
            </p>
          </div>

          ${messagesHtml}

          <div id="tasksContainer" class="mb-6"></div>

          <div class="mb-6" style="display:flex;gap:.625rem;flex-wrap:wrap;justify-content:center;">
            <button id="chatOpenBtn" onclick="Chat.openPublicChat()" class="btn bg-green-600 hover:bg-green-700" style="position:relative;">
              Public Discussion Chat
            </button>
            <button onclick="StudyRoom.openForStudent()" class="btn bg-blue-600 hover:bg-blue-700"
                    style="position:relative;">
              📖 Study Room
            </button>
            <button id="dmOpenBtn" onclick="DM.openStudentInbox()" class="btn bg-indigo-600 hover:bg-indigo-700"
                    style="position:relative;">
              ✉️ Message Teacher
            </button>
          </div>

          ${offDayBannerHtml}
          ${todayTaskDone ? '' : restrictionBannerHtml}

          <div class="text-left mb-3">
            ${todayTaskDone ? '' : `<p class="text-sm font-semibold text-gray-600">
              ${restrictedSubjs
                ? 'Your required subjects for today:'
                : 'Select at least 2 subjects to begin'}
            </p>`}
          </div>

          ${subjectsHtml}

          <div class="mt-6 pt-5 border-t border-gray-100">
            <button onclick="window.fbAuth.signOut()"
                    class="text-xs text-gray-400 hover:text-gray-600 underline">Sign out</button>
          </div>
        </div>`);

      Tasks.renderTasksHTML();

    if (AppState.chatUnread && AppState.chatUnread > 0 && window.Chat && Chat._updateChatBadge) {
      requestAnimationFrame(function () {
        Chat._updateChatBadge(AppState.chatUnread);
      });
    }

    if (AppState.dmStudentUnread && AppState.dmStudentUnread > 0 && window.DM && DM._updateStudentBadge) {
      requestAnimationFrame(function () {
        DM._updateStudentBadge(AppState.dmStudentUnread);
      });
    }

      if (!restrictedSubjs && !todayTaskDone) {
        document.querySelectorAll('.subject-checkbox').forEach(cb => {
          cb.addEventListener('change', _updateStartBtn);
        });
      }

    } catch (err) {
      console.error('[exam] renderSubjectSelection error:', err);
      UI.toast('Failed to load subject selection. Please refresh the page.', 'error', 0);
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

  let _startExamLock = false;

  async function startExam() {
    if (_startExamLock) return;

    if (_isTodayTaskDayCompleted()) {
      UI.toast("You've already completed today's required session.", 'warning');
      await renderSubjectSelection();
      return;
    }

    const chosen = _getSelectedSubjects();
    if (chosen.length < 2) {
      UI.toast('Select at least 2 subjects.', 'warning');
      return;
    }

    const classKey = (S().studentData.class || '').replace(/\s+/g, '').toLowerCase();

    const _qBank = window.questions || {};

    if (!_qBank[classKey]) {
      UI.toast(`No subjects found for class "${S().studentData.class}". Contact Master Timothy.`, 'error', 0);
      return;
    }

    const restrictedSubjs = _getRestrictedSubjectsForToday();
    const finalChosen     = restrictedSubjs
      ? chosen.filter(s => restrictedSubjs.includes(s))
      : chosen;

    if (finalChosen.length < 2) {
      UI.toast('Not enough allowed subjects selected. Please contact Master Timothy.', 'error');
      return;
    }

    const selectedQuestions = {};
    for (const subj of finalChosen) {
      const all = (_qBank[classKey] || {})[subj] || [];
      if (all.length === 0) {
        UI.toast(`No questions available for ${subj}.`, 'error');
        return;
      }
      const shuffled = [...all].sort(() => Math.random() - 0.5);
      selectedQuestions[subj] = shuffled.slice(0, CFG().QUESTIONS_PER_SUBJECT);
    }

    const sessionDate  = _todayStr();
    const examDuration = (S().currentTaskConfig && S().currentTaskConfig.durationMs)
      || CFG().EXAM_DURATION_MS;

    const examDoc = {
      step:           'exam',
      subjects:       finalChosen,
      questions:      selectedQuestions,
      currentSubject: finalChosen[0],
      currentIndex:   0,
      answers:        {},
      sessionDate,
      durationMs:     examDuration,
    };

    const btn = document.getElementById('startExamBtn');
    UI.setLoading(btn, true);
    _startExamLock = true;

    try {
      await Db().collection('ongoingExams').doc(S().userId).set(examDoc);
      S().exam = examDoc;
      renderExam();
      _showInstructionsModal();
    } catch (err) {
      console.error('[exam] startExam error:', err);
      UI.toast('Failed to start exam. Please try again.', 'error');
      _startExamLock = false;
    } finally {
      if (document.getElementById('startExamBtn')) UI.setLoading(btn, false);
    }
  }

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
        <button onclick="Exam.beginExam()" class="btn bg-green-600 hover:bg-green-700 w-full"
                style="justify-content:center;">I understand — Start Exam Now</button>
        <p class="text-center mt-3" style="font-size:0.75rem;color:var(--text-disabled);">Good luck!</p>
      </div>`;

    document.body.appendChild(modal);
    requestAnimationFrame(() => { modal.scrollTop = 0; });
  }

  let _visibilityHideCount = 0;
  let _visibilityHandler   = null;

  function _setupVisibilityGuard() {
    _teardownVisibilityGuard();
    _visibilityHideCount = 0;

    _visibilityHandler = function () {
      if (document.visibilityState !== 'hidden') return;

      _visibilityHideCount++;

      if (_visibilityHideCount === 2) {
        UI.toast(
          '⚠️ Warning: If you minimize again, your exam will be submitted automatically.',
          'warning',
          6000
        );
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
  }

  async function beginExam() {
    const modal = document.getElementById('examModal');
    if (modal) modal.remove();

    const startMs = Date.now();
    S().examStartMs = startMs;
    const startDate = new Date(startMs);
    S().exam.startTime = startDate;

    if (!S().exam.sessionDate) {
      S().exam.sessionDate = _todayStr();
    }

    try {
      await Db().collection('ongoingExams').doc(S().userId).set(
        { startTime: startDate, sessionDate: S().exam.sessionDate }, { merge: true }
      );
    } catch (err) {
      console.warn('[exam] Could not persist startTime, timer continues from local value.', err);
    }

    _startTimer();
    _setupVisibilityGuard();
    renderExam();
  }

  function renderExam() {
    _questionRenderedAt = Date.now();
    const exam = S().exam;
    if (!exam) return;

    if (window.MsgNotif) MsgNotif.dismissAll();

    const subj    = exam.currentSubject;
    const qList   = exam.questions[subj];
    const q       = qList[exam.currentIndex];
    const subjIdx = exam.subjects.indexOf(subj);

    UI.mount(`
      <div class="max-w-4xl mx-auto flex flex-col gap-4" style="padding:0.75rem 0;">

        <div class="glass-dark flex flex-wrap items-center gap-x-4 gap-y-1"
             style="padding:0.4375rem 0.875rem;border-radius:8px;font-size:0.8125rem;">
          <span class="font-semibold">${_escHtml(S().studentData.name)}</span>
          <span style="color:var(--border-medium);">|</span>
          <span style="color:var(--text-tertiary);">${_escHtml(S().studentData.class)}</span>
          <span style="color:var(--border-medium);">|</span>
          <span style="color:var(--text-tertiary);">${_escHtml(S().studentData.school)}</span>
        </div>

        <div class="glass flex flex-col md:flex-row justify-between items-start md:items-center gap-3"
             style="padding:1rem 1.25rem;">
          <div>
            <h2 class="font-bold" style="font-size:1.1875rem;line-height:1.3;">${_escHtml(subj)}</h2>
            <p style="font-size:0.8125rem;color:var(--text-tertiary);margin-top:2px;">
              Subject ${subjIdx + 1} of ${exam.subjects.length} &bull; Q${exam.currentIndex + 1} / ${qList.length}
            </p>
          </div>
          <div class="text-right">
            <div id="timerDisplay" class="timer-green" aria-live="polite" aria-label="Time remaining">
              ${S().examStartMs ? '...' : _initialTimerStr(_examDurationMs())}
            </div>
            <p style="font-size:0.75rem;color:var(--text-disabled);margin-top:2px;">Time remaining</p>
          </div>
        </div>

        <div class="glass" style="padding:1.25rem 1.5rem;">
          <p class="font-medium" style="font-size:1.0625rem;line-height:1.65;margin-bottom:1.25rem;">
            ${_safeQ(q.q)}</p>
          <div class="space-y-2" id="optionsContainer">
            ${q.opts.map((opt, idx) => {
              const selected = exam.answers[`${subj}-${exam.currentIndex}`] === idx;
              return `
                <label class="block glass cursor-pointer option-label${selected ? ' is-selected' : ''}"
                       style="${selected ? 'border-color:var(--brand);background:var(--brand-bg);' : ''}">
                  <input type="radio" name="option" value="${idx}" ${selected ? 'checked' : ''}
                         class="accent-indigo-600" aria-label="Option ${String.fromCharCode(65 + idx)}" />
                  <span class="flex-1">${_safeQ(opt)}</span>
                </label>`;
            }).join('')}
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <button id="prevBtn" onclick="Exam.prevQuestion()"
                  ${exam.currentIndex === 0 ? 'disabled' : ''}
                  class="btn bg-gray-500 hover:bg-gray-600">← Prev</button>
          <button onclick="Chat.openPublicChat()" class="btn bg-green-600 hover:bg-green-700">Chat</button>
          <button onclick="Exam.nextQuestion()" class="btn">Next →</button>
        </div>

        <div class="glass flex flex-wrap gap-2 justify-center" style="padding:0.75rem 1rem;">
          ${exam.subjects.map(s => `
            <button onclick="Exam.switchSubject('${_escAttr(s)}')"
                    style="padding:0.3125rem 0.875rem;border-radius:6px;font-size:0.8125rem;
                           font-weight:600;border:1.5px solid transparent;transition:all .15s;cursor:pointer;
                           ${s === subj
                             ? 'background:var(--brand);color:var(--text-inverse);border-color:var(--brand);'
                             : 'background:var(--surface-muted);color:var(--text-secondary);border-color:var(--border);'}">
              ${_escHtml(s)}
            </button>`).join('')}
        </div>

        <div class="glass-dark" style="padding:0.875rem 1rem;">
          <h3 class="font-semibold text-center mb-3"
              style="font-size:0.8125rem;color:var(--text-tertiary);letter-spacing:.02em;text-transform:uppercase;">
            ${_escHtml(subj)} — Navigator
          </h3>
          <div id="navGrid" class="flex flex-wrap gap-1.5 justify-center">
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

        <div class="text-center" style="padding-bottom:1rem;">
          <button onclick="Exam.submitExam()" id="submitBtn" class="btn bg-red-600 hover:bg-red-700">
            Submit Exam
          </button>
        </div>

      </div>`);

    document.querySelectorAll('input[name="option"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const val = parseInt(radio.value, 10);
        _saveAnswer(subj, exam.currentIndex, val);
        _updateOptionsDisplay(subj, exam.currentIndex);
        _updateNavButton(exam.currentIndex);
      });
    });

    _updateTimerDisplay();
    _renderKatex();
  }

  function _saveAnswer(subj, idx, val) {
    S().exam.answers[`${subj}-${idx}`] = val;
    clearTimeout(_saveAnswer._debounce);
    _saveAnswer._debounce = setTimeout(() => {
      Db().collection('ongoingExams').doc(S().userId)
        .update({ answers: S().exam.answers })
        .catch(err => console.warn('[exam] Answer save error:', err));
    }, 800);
  }

  function _updateOptionsDisplay(subj, idx) {
    const selected = S().exam.answers[`${subj}-${idx}`];
    document.querySelectorAll('.option-label').forEach((lbl, i) => {
      const isSelected = i === selected;
      lbl.classList.toggle('is-selected', isSelected);
      lbl.style.cssText = isSelected
        ? 'border-color:var(--brand);background:var(--brand-bg);' : '';
    });
  }

  function _updateNavButton(idx) {
    const subj    = S().exam.currentSubject;
    const answered = S().exam.answers[`${subj}-${idx}`] !== undefined;
    const btn      = document.querySelector(`#navGrid button:nth-child(${idx + 1})`);
    if (btn && answered) btn.classList.add('answered');
  }

  function prevQuestion() {
    if (S().exam.currentIndex > 0) { S().exam.currentIndex--; renderExam(); }
  }

  function nextQuestion() {
    const elapsed = Date.now() - _questionRenderedAt;
    if (elapsed < 3000) {
      UI.toast(
        "⚠️ You're moving too fast! Take a moment to read the question carefully.",
        'warning',
        3500
      );
      return;
    }

    const exam  = S().exam;
    const qList = exam.questions[exam.currentSubject];
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
  }

  function goTo(index)         { S().exam.currentIndex = index; renderExam(); }
  function switchSubject(subj) { S().exam.currentSubject = subj; S().exam.currentIndex = 0; renderExam(); }

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
      el.textContent = '00:00:00'; el.className = 'timer-red';
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
    el.className = remaining < redThreshold ? 'timer-red'
                 : remaining < yellowThreshold ? 'timer-yellow'
                 : 'timer-green';
  }

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

      const batch = Db().batch();

      batch.set(Db().collection('results').doc(), {
        ...result,
        questionSnapshots,
        sessionDate,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });

      batch.delete(Db().collection('ongoingExams').doc(S().userId));

      const taskCfg   = S().currentTaskConfig;
      const isTaskDay = taskCfg &&
                        taskCfg.active &&
                        Array.isArray(taskCfg.dates) &&
                        taskCfg.dates.includes(sessionDate);

      if (isTaskDay) {
        batch.update(Db().collection('students').doc(S().userId), {
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

      renderResults(exam, result);

    } catch (err) {
      console.error('[exam] submitExam error:', err);
      UI.toast('Submission failed. Please try again.', 'error');
      if (document.getElementById('submitBtn')) {
        UI.setLoading(document.getElementById('submitBtn'), false);
      }
    } finally {
      _submitLock = false;
    }
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

  function renderResults(exam, result) {
    const gradeColor = result.grade === 'A' ? 'var(--success)'
                     : result.grade === 'B' ? 'var(--info)'
                     : result.grade === 'C' ? 'var(--warning)'
                     : result.grade === 'D' ? 'var(--warning)'
                     : 'var(--danger)';

    UI.mount(`
      <div class="max-w-4xl mx-auto glass animate-fadeIn" style="padding:1.5rem;margin-top:1.5rem;margin-bottom:1.5rem;">

        <div class="text-center mb-6">
          <div class="inline-flex items-center gap-2 mb-3"
               style="background:var(--success-bg);border:1px solid var(--success-border);border-radius:99px;padding:.375rem 1rem;">
            <span style="color:var(--success);font-size:0.875rem;font-weight:600;">✓ Submitted</span>
          </div>
          <h1 class="font-bold" style="font-size:1.625rem;">Exam Complete</h1>
          <p style="font-size:0.875rem;color:var(--text-tertiary);margin-top:4px;">
            ${_escHtml(result.name)} &bull; ${_escHtml(result.class)} &bull; ${_escHtml(result.school)}
          </p>
        </div>

        <div class="glass-dark text-center mb-6" style="padding:1.5rem;border-radius:10px;">
          <div style="font-size:2.75rem;font-weight:800;color:${gradeColor};font-family:'Outfit',sans-serif;line-height:1;">
            ${result.percentage}%
          </div>
          <div style="font-size:1.125rem;font-weight:700;color:${gradeColor};margin-top:4px;">Grade ${result.grade}</div>
          <div class="flex flex-wrap gap-3 justify-center mt-4">
            ${result.subjects.map(s => `
              <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:8px;padding:.5rem .875rem;text-align:center;">
                <div style="font-size:0.75rem;color:var(--text-tertiary);font-weight:500;">${_escHtml(s)}</div>
                <div style="font-size:1rem;font-weight:700;color:var(--text-primary);">${result.scores[s]}%</div>
                <div style="font-size:0.6875rem;color:var(--text-disabled);">${result.correctCounts[s]}/${exam.questions[s].length}</div>
              </div>`).join('')}
          </div>
        </div>

        <p style="font-size:0.875rem;color:var(--text-tertiary);text-align:center;margin-bottom:1.25rem;">
          Click a subject below to review your answers and explanations.
        </p>

        <div class="space-y-3 mb-6">
          ${exam.subjects.map(subj => {
            const qs = exam.questions[subj];
            return `
              <details class="glass-dark rounded-xl overflow-hidden">
                <summary style="padding:.875rem 1.125rem;font-size:.9375rem;font-weight:700;cursor:pointer;">
                  ${_escHtml(subj)} — ${result.correctCounts[subj]}/${qs.length} Correct (${result.scores[subj]}%)
                </summary>
                <div style="padding:1rem;display:flex;flex-direction:column;gap:0.75rem;">
                  ${qs.map((q, i) => {
                    const userAns = exam.answers[`${subj}-${i}`];
                    const correct = userAns === q.ans;
                    const border  = correct
                      ? 'border-color:var(--success);background:var(--success-bg);'
                      : userAns === undefined
                        ? 'border-color:var(--border-medium);background:var(--bg-subtle);'
                        : 'border-color:var(--danger);background:var(--danger-bg);';
                    return `
                      <div class="glass rounded-lg" style="padding:1rem;border-width:2px;border-style:solid;${border}">
                        <p class="font-semibold mb-3" style="font-size:.9375rem;">${i + 1}. ${_safeQ(q.q)}</p>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;font-size:.8125rem;margin-bottom:.75rem;">
                          <div>
                            <span style="font-weight:600;color:var(--text-tertiary);">Your answer:</span>
                            <span class="ml-2 font-medium"
                                  style="color:${correct ? 'var(--success)' : userAns === undefined ? 'var(--text-disabled)' : 'var(--danger)'}">
                              ${userAns !== undefined ? _safeQ(q.opts[userAns]) : 'Not answered'}
                            </span>
                          </div>
                          <div>
                            <span style="font-weight:600;color:var(--text-tertiary);">Correct:</span>
                            <span class="ml-2 font-medium" style="color:var(--success);">${_safeQ(q.opts[q.ans])}</span>
                          </div>
                        </div>
                        <div class="bg-gray-100 rounded p-3" style="font-size:.8125rem;color:var(--text-secondary);">
                          <span style="font-weight:600;">Explanation:</span> ${_safeQ(q.exp)}
                        </div>
                      </div>`;
                  }).join('')}
                </div>
              </details>`;
          }).join('')}
        </div>

        <div class="flex flex-wrap gap-3 justify-center">
          <button onclick="Exam._shareWhatsApp()" class="btn bg-green-600 hover:bg-green-700">Share on WhatsApp</button>
          <button onclick="Exam._copyResult()"    class="btn bg-blue-600 hover:bg-blue-700">Copy Result</button>
          <button onclick="Exam.renderSubjectSelection()" class="btn">New Exam</button>
        </div>

      </div>`);

    _currentResultForShare = { exam, result };
    _renderKatex();
  }

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

  function _escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _escAttr(str) { return _escHtml(str).replace(/'/g,'&#39;'); }

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
