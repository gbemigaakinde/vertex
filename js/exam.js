/* ============================================================
   js/exam.js — Exam engine: start, navigate, timer, submit
   ============================================================
   CHANGES FROM v4:
   ─────────────────────────────────────────────────────────────
   A. Study Room feature added:
      • openStudyRoom(returnTo)  — entry point called from both
        the student dashboard and the exam results screen.
        returnTo = 'dashboard' | 'results' controls where the
        Back button goes.
      • renderStudyRoom()        — full panel renderer.
      • _studySelectSource()     — switches between "From My
        Exam" and "Type a Problem" tabs.
      • _studyLoadExamQuestions()— fetches and renders the
        question cards from the most recent exam result.
      • _studySelectQuestion()   — pre-loads a question from
        the exam card into the active problem slot.
      • _studyStartManual()      — starts a session from the
        free-text input.
      • _studyAsk()              — sends a message to the AI
        tutor (full conversation history included each call).
      • _studyRenderThread()     — re-renders the conversation
        bubbles after each exchange.
      • _studyShare()            — posts a formatted summary
        of the session to publicChat as type:'study'.
      • _studyBack()             — navigates back to wherever
        the student came from.

   B. renderSubjectSelection() updated:
      • "Study Room" button added next to the Chat button on
        the student dashboard.

   C. renderResults() updated:
      • "Study Room" button added next to "New Exam".
      • Passes the exam + result objects to openStudyRoom so
        "From My Exam" works instantly without a Firestore
        fetch.

   D. No other logic changes from v4.
   ─────────────────────────────────────────────────────────────
   All other exam functionality (timer, navigation, KaTeX,
   results display, sharing) is unchanged.
   ============================================================ */

(function () {
  'use strict';

  const S   = () => AppState;
  const Db  = () => window.fbDb;
  const CFG = () => AppConfig;

  /* ══════════════════════════════════════════════════════════
     LaTeX preprocessor
     ══════════════════════════════════════════════════════════ */
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

  /* ══════════════════════════════════════════════════════════
     _examDurationMs()
     ══════════════════════════════════════════════════════════ */
  function _examDurationMs() {
    const fromExam = S().exam && typeof S().exam.durationMs === 'number' && S().exam.durationMs > 0
      ? S().exam.durationMs : null;
    const fromTask = S().currentTaskConfig && typeof S().currentTaskConfig.durationMs === 'number'
      && S().currentTaskConfig.durationMs > 0
      ? S().currentTaskConfig.durationMs : null;
    return fromExam || fromTask || CFG().EXAM_DURATION_MS;
  }

  /* ══════════════════════════════════════════════════════════
     _formatDuration(ms)
     ══════════════════════════════════════════════════════════ */
  function _formatDuration(ms) {
    const totalMin = Math.round(ms / 60_000);
    const h        = Math.floor(totalMin / 60);
    const m        = totalMin % 60;
    if (h === 0)   return `${m} minute${m !== 1 ? 's' : ''}`;
    if (m === 0)   return `${h} hour${h !== 1 ? 's' : ''}`;
    return `${h} hour${h !== 1 ? 's' : ''} ${m} minute${m !== 1 ? 's' : ''}`;
  }

  /* ══════════════════════════════════════════════════════════
     _initialTimerStr(ms)
     ══════════════════════════════════════════════════════════ */
  function _initialTimerStr(ms) {
    const h = String(Math.floor(ms / 3_600_000)).padStart(2, '0');
    const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0');
    return `${h}:${m}:00`;
  }

  /* ══════════════════════════════════════════════════════════
     _resolveStartMs
     ══════════════════════════════════════════════════════════ */
  function _resolveStartMs(startTime) {
    if (!startTime) return null;
    if (typeof startTime.toDate === 'function') return startTime.toDate().getTime();
    if (typeof startTime.seconds === 'number')  return startTime.seconds * 1000;
    if (startTime instanceof Date)              return startTime.getTime();
    if (typeof startTime === 'number')          return startTime;
    return null;
  }

  /* ══════════════════════════════════════════════════════════
     _todayStr
     ══════════════════════════════════════════════════════════ */
  function _todayStr() {
    return (window.Tasks && Tasks._localDateStr)
      ? Tasks._localDateStr()
      : (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        })();
  }

  /* ══════════════════════════════════════════════════════════
     _getRestrictedSubjectsForToday
     ══════════════════════════════════════════════════════════ */
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

  /* ══════════════════════════════════════════════════════════
     loadOrStart
     ══════════════════════════════════════════════════════════ */
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

  /* ══════════════════════════════════════════════════════════
     _isTodayTaskDayCompleted
     ══════════════════════════════════════════════════════════ */
  function _isTodayTaskDayCompleted() {
    const taskCfg = S().currentTaskConfig;
    if (!taskCfg || !taskCfg.active) return false;

    const today     = _todayStr();
    const dates     = Array.isArray(taskCfg.dates) ? taskCfg.dates : [];
    const completed = (S().studentData && S().studentData.coachingCompleted) || {};

    return dates.includes(today) && !!completed[today];
  }

  /* ══════════════════════════════════════════════════════════
     _isTodayATaskDay
     ══════════════════════════════════════════════════════════ */
  function _isTodayATaskDay() {
    const taskCfg = S().currentTaskConfig;
    if (!taskCfg || !taskCfg.active) return false;
    const today = _todayStr();
    const dates = Array.isArray(taskCfg.dates) ? taskCfg.dates : [];
    return dates.includes(today);
  }

  /* ══════════════════════════════════════════════════════════
     _nextUnlockedDateLabel
     ══════════════════════════════════════════════════════════ */
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

  /* ══════════════════════════════════════════════════════════
     renderSubjectSelection
     ══════════════════════════════════════════════════════════ */
  async function renderSubjectSelection() {
    try {
      const classKey = (S().studentData.class || '').replace(/\s+/g, '').toLowerCase();
      const _qBank   = window.questions || (typeof questions !== 'undefined' ? questions : {});
      if (!_qBank[classKey]) {
        console.error('[exam] No questions for classKey:', classKey, '| keys:', Object.keys(_qBank));
        UI.toast(`No subjects found for class "${S().studentData.class}". Contact Master Timothy.`, 'error', 0);
        return;
      }

      const todayTaskDone   = _isTodayTaskDayCompleted();
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
                       background:var(--warning-bg,#fff9db);border:1px solid var(--warning-border,#ffec99);
                       border-left:3px solid var(--warning,#e8890c);border-radius:8px;
                       padding:.75rem 1rem;text-align:left;">
             <span style="font-size:1.125rem;flex-shrink:0;margin-top:1px;">📋</span>
             <div>
               <p style="font-size:.875rem;font-weight:700;color:var(--warning-text,#7c4a00);margin-bottom:.25rem;">
                 Subject restriction active for today
               </p>
               <p style="font-size:.8125rem;color:var(--text-secondary,#374151);line-height:1.6;">
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
                       background:var(--brand-bg,#edf2ff);border:1px solid var(--brand-border,#bac8ff);
                       border-left:3px solid var(--brand,#3b5bdb);border-radius:8px;
                       padding:.75rem 1rem;text-align:left;">
             <span style="font-size:1.125rem;flex-shrink:0;margin-top:1px;">📅</span>
             <div>
               <p style="font-size:.875rem;font-weight:700;color:var(--brand-text,#3730a3);margin-bottom:.25rem;">
                 No task session today
               </p>
               <p style="font-size:.8125rem;color:var(--text-secondary,#374151);line-height:1.6;">
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
                      background:var(--success-bg,#ebfbee);border:2px solid var(--success-border,#b2f2bb);
                      text-align:center;">
            <div style="font-size:2rem;margin-bottom:.5rem;">✅</div>
            <p style="font-size:1rem;font-weight:700;color:var(--success-text,#1a5c29);margin-bottom:.375rem;">
              Today's session complete!
            </p>
            <p style="font-size:.875rem;color:var(--text-secondary,#374151);line-height:1.6;">
              You've already submitted your exam for today's task. ${nextLine}
            </p>
          </div>
          <button disabled
                  style="display:inline-flex;align-items:center;justify-content:center;gap:.5rem;
                         padding:.75rem 2rem;border-radius:8px;font-size:.9375rem;font-weight:700;
                         background:var(--surface-muted,#f3f4f6);color:var(--text-disabled,#9ca3af);
                         border:1.5px solid var(--border,#e5e7eb);cursor:not-allowed;
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
                <span style="display:block;font-size:.6875rem;color:var(--success,#2f9e44);
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
            <h1 class="text-2xl font-bold mb-1">Welcome, ${_escHtml(S().studentData.name)}!</h1>
            <p class="text-sm text-gray-500">
              ${_escHtml(S().studentData.class)} &bull; ${_escHtml(S().studentData.school)}
            </p>
          </div>

          ${messagesHtml}

          <div id="tasksContainer" class="mb-6"></div>

          <div class="mb-6" style="display:flex;gap:.625rem;justify-content:center;flex-wrap:wrap;">
            <button id="chatOpenBtn" onclick="Chat.openPublicChat()"
                    class="btn bg-green-600 hover:bg-green-700" style="position:relative;">
              Public Discussion Chat
            </button>
            <button onclick="Exam.openStudyRoom('dashboard')"
                    class="btn bg-indigo-600 hover:bg-indigo-700" style="position:relative;">
              🧠 Study Room
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

  /* ══════════════════════════════════════════════════════════
     startExam
     ══════════════════════════════════════════════════════════ */
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
    const _qBank   = window.questions;

    if (!_qBank || !_qBank[classKey]) {
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

  /* ══════════════════════════════════════════════════════════
     Instructions modal
     ══════════════════════════════════════════════════════════ */
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
          <li>• <span class="font-semibold" style="color:var(--success,#2f9e44);">Green</span> buttons in the navigator = answered.</li>
          <li>• You can open Public Chat at any time.</li>
          <li>• Once submitted, answers cannot be changed.</li>
          <li class="font-semibold pt-1" style="color:var(--danger,#e03131);">
            ⏱ The timer starts when you click below. Switching devices will not reset it.
          </li>
        </ul>
        <button onclick="Exam.beginExam()" class="btn bg-green-600 hover:bg-green-700 w-full"
                style="justify-content:center;">I understand — Start Exam Now</button>
        <p class="text-center mt-3" style="font-size:0.75rem;color:#9ca3af;">Good luck!</p>
      </div>`;

    document.body.appendChild(modal);
    requestAnimationFrame(() => { modal.scrollTop = 0; });
  }

  /* ══════════════════════════════════════════════════════════
     beginExam
     ══════════════════════════════════════════════════════════ */
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
    renderExam();
  }

  /* ══════════════════════════════════════════════════════════
     renderExam
     ══════════════════════════════════════════════════════════ */
  function renderExam() {
    const exam = S().exam;
    if (!exam) return;

    const subj    = exam.currentSubject;
    const qList   = exam.questions[subj];
    const q       = qList[exam.currentIndex];
    const subjIdx = exam.subjects.indexOf(subj);

    UI.mount(`
      <div class="max-w-4xl mx-auto flex flex-col gap-4" style="padding:0.75rem 0;">

        <div class="glass-dark flex flex-wrap items-center gap-x-4 gap-y-1"
             style="padding:0.4375rem 0.875rem;border-radius:8px;font-size:0.8125rem;">
          <span class="font-semibold">${_escHtml(S().studentData.name)}</span>
          <span style="color:var(--border-medium,#d1d5db);">|</span>
          <span style="color:var(--text-tertiary,#6b7280);">${_escHtml(S().studentData.class)}</span>
          <span style="color:var(--border-medium,#d1d5db);">|</span>
          <span style="color:var(--text-tertiary,#6b7280);">${_escHtml(S().studentData.school)}</span>
        </div>

        <div class="glass flex flex-col md:flex-row justify-between items-start md:items-center gap-3"
             style="padding:1rem 1.25rem;">
          <div>
            <h2 class="font-bold" style="font-size:1.1875rem;line-height:1.3;">${_escHtml(subj)}</h2>
            <p style="font-size:0.8125rem;color:var(--text-tertiary,#6b7280);margin-top:2px;">
              Subject ${subjIdx + 1} of ${exam.subjects.length} &bull; Q${exam.currentIndex + 1} / ${qList.length}
            </p>
          </div>
          <div class="text-right">
            <div id="timerDisplay" class="timer-green" aria-live="polite" aria-label="Time remaining">
              ${S().examStartMs ? '...' : _initialTimerStr(_examDurationMs())}
            </div>
            <p style="font-size:0.75rem;color:var(--text-disabled,#9ca3af);margin-top:2px;">Time remaining</p>
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
                       style="${selected ? 'border-color:var(--brand,#3b5bdb);background:var(--brand-bg,#edf2ff);' : ''}">
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
                             ? 'background:var(--brand,#3b5bdb);color:#fff;border-color:var(--brand,#3b5bdb);'
                             : 'background:var(--surface-muted,#f3f4f6);color:var(--text-secondary,#374151);border-color:var(--border,#e5e7eb);'}">
              ${_escHtml(s)}
            </button>`).join('')}
        </div>

        <div class="glass-dark" style="padding:0.875rem 1rem;">
          <h3 class="font-semibold text-center mb-3"
              style="font-size:0.8125rem;color:var(--text-tertiary,#6b7280);letter-spacing:.02em;text-transform:uppercase;">
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

  /* ══════════════════════════════════════════════════════════
     _saveAnswer
     ══════════════════════════════════════════════════════════ */
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
        ? 'border-color:var(--brand,#3b5bdb);background:var(--brand-bg,#edf2ff);' : '';
    });
  }

  function _updateNavButton(idx) {
    const subj    = S().exam.currentSubject;
    const answered = S().exam.answers[`${subj}-${idx}`] !== undefined;
    const btn      = document.querySelector(`#navGrid button:nth-child(${idx + 1})`);
    if (btn && answered) btn.classList.add('answered');
  }

  /* ══════════════════════════════════════════════════════════
     Navigation
     ══════════════════════════════════════════════════════════ */
  function prevQuestion() {
    if (S().exam.currentIndex > 0) { S().exam.currentIndex--; renderExam(); }
  }

  function nextQuestion() {
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

  /* ══════════════════════════════════════════════════════════
     Timer
     ══════════════════════════════════════════════════════════ */
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

  /* ══════════════════════════════════════════════════════════
     submitExam
     ══════════════════════════════════════════════════════════ */
  let _submitLock = false;

  async function submitExam(skipConfirm) {
    if (_submitLock) return;

    if (!skipConfirm) {
      const confirmed = await UI.confirmAction('Submit your exam? This cannot be undone.');
      if (!confirmed) return;
    }

    _submitLock = true;
    S().clearTimer();

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

  /* ══════════════════════════════════════════════════════════
     _computeResult
     ══════════════════════════════════════════════════════════ */
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

  /* ══════════════════════════════════════════════════════════
     renderResults
     ══════════════════════════════════════════════════════════ */
  function renderResults(exam, result) {
    // Store for Study Room access via "From My Exam" tab
    _studyLastExam   = exam;
    _studyLastResult = result;

    const gradeColor = result.grade === 'A' ? 'var(--success, #2f9e44)'
                     : result.grade === 'B' ? 'var(--info, #1971c2)'
                     : result.grade === 'C' ? 'var(--warning, #e8890c)'
                     : result.grade === 'D' ? '#ea580c'
                     : 'var(--danger, #e03131)';

    UI.mount(`
      <div class="max-w-4xl mx-auto glass animate-fadeIn" style="padding:1.5rem;margin-top:1.5rem;margin-bottom:1.5rem;">

        <div class="text-center mb-6">
          <div class="inline-flex items-center gap-2 mb-3"
               style="background:var(--success-bg,#ebfbee);border:1px solid var(--success-border,#b2f2bb);border-radius:99px;padding:.375rem 1rem;">
            <span style="color:var(--success,#2f9e44);font-size:0.875rem;font-weight:600;">✓ Submitted</span>
          </div>
          <h1 class="font-bold" style="font-size:1.625rem;">Exam Complete</h1>
          <p style="font-size:0.875rem;color:var(--text-tertiary,#6b7280);margin-top:4px;">
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
              <div style="background:#fff;border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:.5rem .875rem;text-align:center;">
                <div style="font-size:0.75rem;color:var(--text-tertiary,#6b7280);font-weight:500;">${_escHtml(s)}</div>
                <div style="font-size:1rem;font-weight:700;color:var(--text-primary,#111827);">${result.scores[s]}%</div>
                <div style="font-size:0.6875rem;color:var(--text-disabled,#9ca3af);">${result.correctCounts[s]}/${exam.questions[s].length}</div>
              </div>`).join('')}
          </div>
        </div>

        <p style="font-size:0.875rem;color:var(--text-tertiary,#6b7280);text-align:center;margin-bottom:1.25rem;">
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
                      ? 'border-color:var(--success,#2f9e44);background:var(--success-bg,#ebfbee);'
                      : userAns === undefined
                        ? 'border-color:var(--border-medium,#d1d5db);background:var(--surface-subtle,#f9fafb);'
                        : 'border-color:var(--danger,#e03131);background:var(--danger-bg,#fff5f5);';
                    return `
                      <div class="glass rounded-lg" style="padding:1rem;border-width:2px;border-style:solid;${border}">
                        <p class="font-semibold mb-3" style="font-size:.9375rem;">${i + 1}. ${_safeQ(q.q)}</p>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;font-size:.8125rem;margin-bottom:.75rem;">
                          <div>
                            <span style="font-weight:600;color:var(--text-tertiary,#6b7280);">Your answer:</span>
                            <span class="ml-2 font-medium"
                                  style="color:${correct ? 'var(--success,#2f9e44)' : userAns === undefined ? 'var(--text-disabled,#9ca3af)' : 'var(--danger,#e03131)'}">
                              ${userAns !== undefined ? _safeQ(q.opts[userAns]) : 'Not answered'}
                            </span>
                          </div>
                          <div>
                            <span style="font-weight:600;color:var(--text-tertiary,#6b7280);">Correct:</span>
                            <span class="ml-2 font-medium" style="color:var(--success,#2f9e44);">${_safeQ(q.opts[q.ans])}</span>
                          </div>
                        </div>
                        <div class="bg-gray-100 rounded p-3" style="font-size:.8125rem;color:var(--text-secondary,#374151);">
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
          <button onclick="Exam.openStudyRoom('results')" class="btn bg-indigo-600 hover:bg-indigo-700">🧠 Study Room</button>
          <button onclick="Exam.renderSubjectSelection()" class="btn">New Exam</button>
        </div>

      </div>`);

    _currentResultForShare = { exam, result };
    _renderKatex();
  }

  /* ══════════════════════════════════════════════════════════
     KaTeX renderer
     ══════════════════════════════════════════════════════════ */
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

  /* ══════════════════════════════════════════════════════════
     ╔══════════════════════════════════════════════════════╗
     ║                    STUDY ROOM                        ║
     ╚══════════════════════════════════════════════════════╝

     Private state — scoped to the current Study Room session.
     Reset fully each time openStudyRoom() is called.
     ══════════════════════════════════════════════════════════ */

  // The exam/result data most recently passed to renderResults(),
  // persisted here so "From My Exam" works even after navigating away.
  let _studyLastExam   = null;
  let _studyLastResult = null;

  // Per-session state (reset on every openStudyRoom() call)
  let _studyReturnTo      = 'dashboard'; // 'dashboard' | 'results'
  let _studySource        = 'exam';      // 'exam' | 'manual'
  let _studyProblem       = null;        // { text, subject } | null
  let _studyConversation  = [];          // [{role:'user'|'assistant', content:string}]
  let _studyLoading       = false;

  /* ──────────────────────────────────────────────────────────
     openStudyRoom(returnTo)
     Entry point. Called from the dashboard and results screen.
     ────────────────────────────────────────────────────────── */
  function openStudyRoom(returnTo) {
    _studyReturnTo     = returnTo || 'dashboard';
    _studySource       = 'exam';
    _studyProblem      = null;
    _studyConversation = [];
    _studyLoading      = false;
    renderStudyRoom();
  }

  /* ──────────────────────────────────────────────────────────
     renderStudyRoom()
     Full panel renderer — called on open and after each
     conversation update.
     ────────────────────────────────────────────────────────── */
  function renderStudyRoom() {
    const hasExamData = !!(_studyLastExam && _studyLastResult);

    UI.mount(`
      <div class="max-w-4xl mx-auto animate-fadeIn"
           style="padding:.75rem 0;margin-top:.75rem;margin-bottom:1.5rem;">

        <!-- ── Header ── -->
        <div class="glass" style="display:flex;align-items:center;justify-content:space-between;
                                   padding:.875rem 1.25rem;border-radius:12px;margin-bottom:1rem;">
          <div style="display:flex;align-items:center;gap:.625rem;">
            <span style="font-size:1.375rem;">🧠</span>
            <div>
              <h2 style="font-size:1rem;font-weight:700;color:var(--text-primary,#111827);line-height:1.2;">
                Study Room</h2>
              <p style="font-size:.75rem;color:var(--text-tertiary,#6b7280);margin-top:1px;">
                AI-powered maths tutor — ask anything
              </p>
            </div>
          </div>
          <button onclick="Exam._studyBack()"
                  class="btn bg-gray-500 hover:bg-gray-600"
                  style="font-size:.8125rem;padding:.4375rem .875rem;">← Back</button>
        </div>

        <!-- ── Source tabs ── -->
        <div class="glass" style="padding:.75rem 1rem;border-radius:12px;margin-bottom:1rem;">
          <div style="display:flex;gap:0;border:1px solid var(--c-border,#e5e7eb);
                      border-radius:8px;overflow:hidden;max-width:380px;">
            <button id="studyTabExam" onclick="Exam._studySelectSource('exam')"
                    style="flex:1;padding:.5rem .75rem;font-size:.8125rem;font-weight:600;
                           cursor:pointer;border:none;transition:background .12s,color .12s;
                           background:${_studySource === 'exam' ? 'var(--brand,#3b5bdb)' : 'var(--surface-muted,#f3f4f6)'};
                           color:${_studySource === 'exam' ? '#fff' : 'var(--text-tertiary,#6b7280)'};">
              📋 From My Exam
            </button>
            <button id="studyTabManual" onclick="Exam._studySelectSource('manual')"
                    style="flex:1;padding:.5rem .75rem;font-size:.8125rem;font-weight:600;
                           cursor:pointer;border:none;border-left:1px solid var(--c-border,#e5e7eb);
                           transition:background .12s,color .12s;
                           background:${_studySource === 'manual' ? 'var(--brand,#3b5bdb)' : 'var(--surface-muted,#f3f4f6)'};
                           color:${_studySource === 'manual' ? '#fff' : 'var(--text-tertiary,#6b7280)'};">
              ✏️ Type a Problem
            </button>
          </div>

          <!-- From My Exam tab content -->
          <div id="studyExamPanel" style="margin-top:.875rem;${_studySource !== 'exam' ? 'display:none;' : ''}">
            ${hasExamData
              ? _buildExamQuestionCards()
              : `<div style="padding:1rem;text-align:center;border-radius:8px;
                             background:var(--surface-muted,#f3f4f6);border:1px solid var(--border,#e5e7eb);">
                   <p style="font-size:.875rem;color:var(--text-tertiary,#6b7280);">
                     No recent exam data in this session.
                   </p>
                   <p style="font-size:.8125rem;color:var(--text-disabled,#9ca3af);margin-top:.375rem;">
                     Complete an exam first, or use "Type a Problem" to study anything.
                   </p>
                 </div>`}
          </div>

          <!-- Type a Problem tab content -->
          <div id="studyManualPanel" style="margin-top:.875rem;${_studySource !== 'manual' ? 'display:none;' : ''}">
            <label style="display:block;font-size:.8125rem;font-weight:600;
                          color:var(--text-secondary,#374151);margin-bottom:.5rem;">
              Type or paste your maths problem below
            </label>
            <textarea id="studyManualInput"
                      placeholder="e.g. Solve for x: 3x² − 5x + 2 = 0&#10;or&#10;Explain the difference between permutation and combination."
                      style="width:100%;height:5rem;resize:vertical;font-size:.875rem;
                             border:1.5px solid var(--border,#e5e7eb);border-radius:8px;
                             padding:.625rem .875rem;background:var(--surface,#fff);
                             color:var(--text-primary,#111827);line-height:1.6;"></textarea>
            <button onclick="Exam._studyStartManual()"
                    class="btn bg-indigo-600 hover:bg-indigo-700"
                    style="margin-top:.625rem;font-size:.875rem;">
              Ask Tutor →
            </button>
          </div>
        </div>

        <!-- ── Active problem display (shown once a problem is selected) ── -->
        ${_studyProblem ? `
          <div style="padding:.875rem 1rem;border-radius:10px;margin-bottom:1rem;
                      background:var(--brand-bg,#edf2ff);border:1.5px solid var(--brand-border,#bac8ff);
                      border-left:4px solid var(--brand,#3b5bdb);">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;">
              <div style="min-width:0;flex:1;">
                <p style="font-size:.6875rem;font-weight:700;color:var(--brand-text,#3730a3);
                           text-transform:uppercase;letter-spacing:.04em;margin-bottom:.375rem;">
                  ${_studyProblem.subject ? '📚 ' + _escHtml(_studyProblem.subject) : '📝 Current Problem'}
                </p>
                <p style="font-size:.9375rem;color:var(--text-primary,#111827);line-height:1.65;">
                  ${_safeQ(_studyProblem.text)}
                </p>
              </div>
              <button onclick="Exam._studyClearProblem()"
                      style="background:none;border:none;cursor:pointer;font-size:1rem;
                             line-height:1;color:var(--text-tertiary,#6b7280);flex-shrink:0;
                             padding:2px 4px;"
                      title="Clear problem">×</button>
            </div>
          </div>` : ''}

        <!-- ── Conversation thread ── -->
        ${_studyConversation.length > 0 ? `
          <div id="studyThread" style="display:flex;flex-direction:column;gap:.75rem;margin-bottom:1rem;">
            ${_buildConversationHTML()}
          </div>` : ''}

        <!-- ── Loading indicator ── -->
        ${_studyLoading ? `
          <div style="display:flex;align-items:center;gap:.75rem;padding:.875rem 1rem;
                      border-radius:10px;background:var(--surface-subtle,#f9fafb);
                      border:1px solid var(--border,#e5e7eb);margin-bottom:1rem;">
            <div style="width:8px;height:8px;border-radius:50%;background:var(--brand,#3b5bdb);
                        animation:pulse 1s infinite;"></div>
            <p style="font-size:.875rem;color:var(--text-tertiary,#6b7280);font-style:italic;">
              Study Assistant is thinking…
            </p>
          </div>` : ''}

        <!-- ── Follow-up input (shown after first AI response) ── -->
        ${_studyProblem && _studyConversation.length > 0 && !_studyLoading ? `
          <div class="glass" style="padding:.875rem 1rem;border-radius:12px;margin-bottom:1rem;">
            <label style="display:block;font-size:.75rem;font-weight:600;
                          color:var(--text-secondary,#374151);margin-bottom:.5rem;">
              Ask a follow-up question
            </label>
            <div style="display:flex;gap:.5rem;">
              <input id="studyFollowUp" type="text"
                     placeholder="e.g. Why do we use that formula? Can you show another example?"
                     style="flex:1;font-size:.875rem;"
                     onkeydown="if(event.key==='Enter'){event.preventDefault();Exam._studyAsk();}" />
              <button onclick="Exam._studyAsk()"
                      class="btn bg-indigo-600 hover:bg-indigo-700"
                      style="font-size:.875rem;white-space:nowrap;">Ask</button>
            </div>
          </div>` : ''}

        <!-- ── Share to chat button (shown after at least one AI response) ── -->
        ${_studyConversation.filter(m => m.role === 'assistant').length > 0 && !_studyLoading ? `
          <div style="text-align:center;padding-top:.25rem;">
            <button onclick="Exam._studyShare()"
                    class="btn bg-green-600 hover:bg-green-700"
                    style="font-size:.875rem;">
              📢 Share this explanation to Public Chat
            </button>
            <p style="font-size:.6875rem;color:var(--text-disabled,#9ca3af);margin-top:.5rem;">
              Share a summary so your classmates can benefit too
            </p>
          </div>` : ''}

      </div>
    `);

    // Scroll thread to bottom after render
    requestAnimationFrame(() => {
      const thread = document.getElementById('studyThread');
      if (thread) thread.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });

    _renderKatex();
  }

  /* ──────────────────────────────────────────────────────────
     _buildExamQuestionCards()
     Builds HTML for the "From My Exam" tab question grid.
     ────────────────────────────────────────────────────────── */
  function _buildExamQuestionCards() {
    const exam   = _studyLastExam;
    const result = _studyLastResult;
    if (!exam || !result) return '';

    return exam.subjects.map(subj => {
      const qs = exam.questions[subj] || [];
      const cardsHTML = qs.map((q, i) => {
        const userAns  = exam.answers[`${subj}-${i}`];
        const isCorrect = userAns === q.ans;
        const isSkipped = userAns === undefined;

        const indicator = isCorrect ? '✓' : isSkipped ? '–' : '✗';
        const indicatorColor = isCorrect
          ? 'var(--success,#2f9e44)'
          : isSkipped
            ? 'var(--text-disabled,#9ca3af)'
            : 'var(--danger,#e03131)';

        const borderColor = isCorrect
          ? 'var(--success-border,#b2f2bb)'
          : isSkipped
            ? 'var(--border,#e5e7eb)'
            : 'var(--danger,#e03131)';

        const bgColor = isCorrect
          ? 'var(--success-bg,#ebfbee)'
          : isSkipped
            ? 'var(--surface,#fff)'
            : 'var(--danger-bg,#fff5f5)';

        // Truncate question text for the card preview
        const qText   = String(q.q || '');
        const preview = qText.length > 90 ? qText.slice(0, 90) + '…' : qText;

        // Encode question for onclick attribute safely
        const qIndex = i;

        return `
          <div style="border:1.5px solid ${borderColor};border-radius:8px;padding:.625rem .875rem;
                      background:${bgColor};position:relative;">
            <div style="display:flex;align-items:flex-start;gap:.5rem;margin-bottom:.5rem;">
              <span style="font-size:.875rem;font-weight:700;color:${indicatorColor};
                            flex-shrink:0;margin-top:1px;">${indicator}</span>
              <p style="font-size:.8125rem;color:var(--text-primary,#111827);line-height:1.55;
                         flex:1;min-width:0;">
                Q${i + 1}. ${_safeQ(preview)}
              </p>
            </div>
            <button onclick="Exam._studySelectQuestion('${_escAttr(subj)}', ${qIndex})"
                    style="font-size:.75rem;font-weight:700;color:var(--brand-text,#3730a3);
                           background:var(--brand-bg,#edf2ff);border:1px solid var(--brand-border,#bac8ff);
                           border-radius:6px;padding:3px 10px;cursor:pointer;
                           transition:background .1s;">
              Study this →
            </button>
          </div>`;
      }).join('');

      return `
        <details style="margin-bottom:.625rem;" open>
          <summary style="font-size:.875rem;font-weight:700;color:var(--text-primary,#111827);
                          cursor:pointer;padding:.375rem 0;list-style:none;
                          display:flex;align-items:center;gap:.5rem;user-select:none;">
            <span style="font-size:.625rem;color:var(--text-tertiary,#6b7280);">▶</span>
            ${_escHtml(subj)}
            <span style="font-size:.6875rem;font-weight:500;color:var(--text-tertiary,#6b7280);">
              — ${result.correctCounts[subj] || 0}/${qs.length} correct
            </span>
          </summary>
          <div style="display:flex;flex-direction:column;gap:.5rem;margin-top:.5rem;padding-left:.25rem;">
            ${cardsHTML}
          </div>
        </details>`;
    }).join('');
  }

  /* ──────────────────────────────────────────────────────────
     _buildConversationHTML()
     Renders all messages in the conversation thread.
     ────────────────────────────────────────────────────────── */
  function _buildConversationHTML() {
    return _studyConversation.map((msg, idx) => {
      const isAI = msg.role === 'assistant';

      if (isAI) {
        // Convert markdown-like formatting in AI responses for readability:
        // **bold**, numbered lists, line breaks
        let content = _escHtml(msg.content)
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n\n/g, '</p><p style="margin-bottom:.625rem;">')
          .replace(/\n/g, '<br>');

        return `
          <div style="display:flex;align-items:flex-start;gap:.75rem;">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--brand,#3b5bdb);
                        display:flex;align-items:center;justify-content:center;
                        flex-shrink:0;font-size:.875rem;color:#fff;font-weight:700;margin-top:2px;">🎓</div>
            <div style="flex:1;min-width:0;background:var(--brand-bg,#edf2ff);
                        border:1px solid var(--brand-border,#bac8ff);border-radius:0 10px 10px 10px;
                        border-left:3px solid var(--brand,#3b5bdb);padding:.875rem 1rem;">
              <p style="font-size:.6875rem;font-weight:700;color:var(--brand-text,#3730a3);
                         margin-bottom:.5rem;letter-spacing:.02em;">STUDY ASSISTANT</p>
              <div style="font-size:.9375rem;color:var(--text-primary,#111827);line-height:1.7;">
                <p style="margin-bottom:.625rem;">${content}</p>
              </div>
            </div>
          </div>`;
      } else {
        return `
          <div style="display:flex;align-items:flex-start;gap:.75rem;flex-direction:row-reverse;">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--surface-muted,#f3f4f6);
                        border:1.5px solid var(--border,#e5e7eb);display:flex;align-items:center;
                        justify-content:center;flex-shrink:0;font-size:.875rem;margin-top:2px;">👤</div>
            <div style="flex:1;min-width:0;background:var(--surface,#fff);
                        border:1px solid var(--border,#e5e7eb);border-radius:10px 0 10px 10px;
                        padding:.75rem 1rem;max-width:85%;">
              <p style="font-size:.9375rem;color:var(--text-primary,#111827);line-height:1.6;">
                ${_escHtml(msg.content)}
              </p>
            </div>
          </div>`;
      }
    }).join('');
  }

  /* ──────────────────────────────────────────────────────────
     _studySelectSource(source)
     Switches between the two input tabs.
     ────────────────────────────────────────────────────────── */
  function _studySelectSource(source) {
    _studySource = source;
    const examPanel   = document.getElementById('studyExamPanel');
    const manualPanel = document.getElementById('studyManualPanel');
    const tabExam     = document.getElementById('studyTabExam');
    const tabManual   = document.getElementById('studyTabManual');

    if (examPanel)   examPanel.style.display   = source === 'exam'   ? '' : 'none';
    if (manualPanel) manualPanel.style.display = source === 'manual' ? '' : 'none';

    if (tabExam) {
      tabExam.style.background = source === 'exam' ? 'var(--brand,#3b5bdb)' : 'var(--surface-muted,#f3f4f6)';
      tabExam.style.color      = source === 'exam' ? '#fff' : 'var(--text-tertiary,#6b7280)';
    }
    if (tabManual) {
      tabManual.style.background = source === 'manual' ? 'var(--brand,#3b5bdb)' : 'var(--surface-muted,#f3f4f6)';
      tabManual.style.color      = source === 'manual' ? '#fff' : 'var(--text-tertiary,#6b7280)';
    }
  }

  /* ──────────────────────────────────────────────────────────
     _studySelectQuestion(subject, qIndex)
     Pre-loads a question from the exam card into the active
     problem, then sends the first message to the AI.
     ────────────────────────────────────────────────────────── */
  function _studySelectQuestion(subject, qIndex) {
    const exam = _studyLastExam;
    if (!exam) return;

    const q         = (exam.questions[subject] || [])[qIndex];
    if (!q) return;

    const userAns   = exam.answers[`${subject}-${qIndex}`];
    const isCorrect = userAns === q.ans;
    const isSkipped = userAns === undefined;

    // Build a rich context message for the AI including what the student answered
    const userAnswerText = isSkipped
      ? 'I did not answer this question.'
      : isCorrect
        ? `I answered correctly: "${q.opts[userAns]}"`
        : `I answered "${q.opts[userAns]}" but the correct answer was "${q.opts[q.ans]}".`;

    const problemText = q.q;
    const optsText    = q.opts.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n');

    _studyProblem      = { text: problemText, subject };
    _studyConversation = [];

    // First user message sent automatically, as if the student said:
    // "Please explain this question to me"
    const firstUserMsg =
      `I need help with this ${subject} question:\n\n` +
      `${problemText}\n\n` +
      `Options:\n${optsText}\n\n` +
      `${userAnswerText} Please explain this to me step by step.`;

    _studyAskWith(firstUserMsg);
  }

  /* ──────────────────────────────────────────────────────────
     _studyStartManual()
     Starts a session from the free-text input.
     ────────────────────────────────────────────────────────── */
  function _studyStartManual() {
    const input = document.getElementById('studyManualInput');
    const text  = (input ? input.value.trim() : '');
    if (!text) { UI.toast('Please type a problem first.', 'warning'); return; }

    _studyProblem      = { text, subject: null };
    _studyConversation = [];

    _studyAskWith(`Please explain this maths problem to me step by step:\n\n${text}`);
  }

  /* ──────────────────────────────────────────────────────────
     _studyAsk()
     Sends the follow-up input field's content to the AI.
     ────────────────────────────────────────────────────────── */
  function _studyAsk() {
    const input = document.getElementById('studyFollowUp');
    const text  = (input ? input.value.trim() : '');
    if (!text) return;
    if (input) input.value = '';
    _studyAskWith(text);
  }

  /* ──────────────────────────────────────────────────────────
     _studyAskWith(userMessage)
     Core function that appends a user message and calls the
     Anthropic API with the full conversation history.
     ────────────────────────────────────────────────────────── */
  async function _studyAskWith(userMessage) {
    if (_studyLoading) return;

    _studyConversation.push({ role: 'user', content: userMessage });
    _studyLoading = true;
    renderStudyRoom();

    const systemPrompt =
      `You are a patient, encouraging maths tutor called "Study Assistant" for secondary school students in Nigeria. ` +
      `Your job is to help students understand maths problems deeply, not just get the right answer.\n\n` +
      `When a student brings you a problem, always follow this structure:\n` +
      `1. **What the question is asking** — restate it simply in one sentence.\n` +
      `2. **Concept or formula needed** — name it and write it out clearly.\n` +
      `3. **Step-by-step solution** — number each step. Show all working. Do not skip steps.\n` +
      `4. **Final answer** — state it clearly and directly.\n` +
      `5. **Remember this** — one short memorable tip about the concept for future questions.\n\n` +
      `For follow-up questions, stay in context of the same problem. Be warm and encouraging. ` +
      `If the student got it wrong, never make them feel bad — focus on the concept, not the mistake. ` +
      `Keep responses focused and clear. Avoid unnecessary padding. ` +
      `Use plain text formatting — no markdown tables, no code blocks.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system:     systemPrompt,
          messages:   _studyConversation.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API error ${response.status}`);
      }

      const data = await response.json();
      const aiText = (data.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('');

      if (!aiText) throw new Error('Empty response from AI.');

      _studyConversation.push({ role: 'assistant', content: aiText });

    } catch (err) {
      console.error('[studyRoom] AI call failed:', err);
      // Remove the user message we added so the state stays consistent
      _studyConversation.pop();
      UI.toast('Could not reach the Study Assistant. Please try again.', 'error');
    } finally {
      _studyLoading = false;
      renderStudyRoom();
    }
  }

  /* ──────────────────────────────────────────────────────────
     _studyClearProblem()
     Resets the active problem and conversation.
     ────────────────────────────────────────────────────────── */
  function _studyClearProblem() {
    _studyProblem      = null;
    _studyConversation = [];
    _studyLoading      = false;
    renderStudyRoom();
  }

  /* ──────────────────────────────────────────────────────────
     _studyShare()
     Posts a formatted summary of the session to publicChat.
     ────────────────────────────────────────────────────────── */
  async function _studyShare() {
    const aiMessages = _studyConversation.filter(m => m.role === 'assistant');
    if (aiMessages.length === 0) {
      UI.toast('Nothing to share yet — ask the tutor first.', 'warning');
      return;
    }

    const confirmed = await UI.confirmAction(
      'Share this explanation to Public Chat? Your classmates will be able to see it.'
    );
    if (!confirmed) return;

    // Build the share text — problem + first AI explanation (trimmed if very long)
    const problemLine = _studyProblem
      ? `Problem: ${_studyProblem.text.slice(0, 200)}${_studyProblem.text.length > 200 ? '…' : ''}`
      : 'Problem: (typed manually)';

    const firstExplanation = aiMessages[0].content;
    const trimmedExplanation = firstExplanation.length > 800
      ? firstExplanation.slice(0, 800) + '…\n\n[See full explanation in Study Room]'
      : firstExplanation;

    const subjectTag = _studyProblem && _studyProblem.subject
      ? ` — ${_studyProblem.subject}`
      : '';

    const shareText =
      `📚 Study Room${subjectTag}\n\n` +
      `${problemLine}\n\n` +
      `${trimmedExplanation}\n\n` +
      `— Shared by ${S().studentData.name}`;

    try {
      await Db().collection('publicChat').add({
        text:          shareText,
        senderName:    S().studentData.name,
        senderClass:   S().studentData.class || '',
        senderId:      S().userId,
        timestamp:     firebase.firestore.FieldValue.serverTimestamp(),
        replyTo:       null,
        pinned:        false,
        mentionedUids: null,
        type:          'study',
      });
      UI.toast('Explanation shared to Public Chat! 🎉', 'success');
    } catch (err) {
      console.error('[studyRoom] Share failed:', err);
      UI.toast('Failed to share. Please try again.', 'error');
    }
  }

  /* ──────────────────────────────────────────────────────────
     _studyBack()
     Returns to the correct screen based on how Study Room was opened.
     ────────────────────────────────────────────────────────── */
  function _studyBack() {
    if (_studyReturnTo === 'results' && _studyLastExam && _studyLastResult) {
      renderResults(_studyLastExam, _studyLastResult);
    } else {
      renderSubjectSelection();
    }
  }

  /* ══════════════════════════════════════════════════════════
     HTML escaping helpers
     ══════════════════════════════════════════════════════════ */
  function _escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _escAttr(str) { return _escHtml(str).replace(/'/g,'&#39;'); }

  /* ══════════════════════════════════════════════════════════
     Expose
     ══════════════════════════════════════════════════════════ */
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
    // Study Room
    openStudyRoom,
    renderStudyRoom,
    _studyBack,
    _studySelectSource,
    _studySelectQuestion,
    _studyStartManual,
    _studyAsk,
    _studyClearProblem,
    _studyShare,
  };

})();
