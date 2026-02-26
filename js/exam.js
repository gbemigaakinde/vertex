/* ============================================================
   js/exam.js — Exam engine: start, navigate, timer, submit
   ============================================================
   CHANGES FROM PREVIOUS VERSION:
   1. preprocessLatex() added — converts bare LaTeX symbols
      (outside $...$ blocks) to Unicode/HTML before escaping.
      Acts as Option B: cheap, offline-safe symbol conversion.
   2. _renderKatex() fixed:
      - Checks window._katexAutoRenderReady (the flag index.html
        actually sets) instead of window.renderMathInElement alone.
      - Wrapped in requestAnimationFrame() so KaTeX runs after
        the browser has painted the new DOM nodes.
      - Scoped to #app instead of document.body (faster).
      - try/catch prevents one bad expression breaking the page.
      - Added \( \) and \[ \] delimiters for full LaTeX coverage.
   3. All question text, options, and explanations now pass
      through preprocessLatex() before _escHtml() so both
      Option A (KaTeX) and Option B (preprocessor) run together.
   ============================================================ */

(function () {
  'use strict';

  const S   = () => AppState;
  const Db  = () => window.fbDb;
  const CFG = () => AppConfig;

  /* ══════════════════════════════════════════════════════════
     OPTION B — LaTeX preprocessor
     Runs BEFORE html is written to the DOM.
     Only touches symbols that are OUTSIDE $...$ math blocks —
     those are left untouched for KaTeX (Option A) to handle.
     ══════════════════════════════════════════════════════════ */
  function preprocessLatex(str) {
    if (str == null) return '';
    str = String(str);

    /* ── Step 1: Pull out $...$ / $$...$$ blocks ──
       Replace them with numbered placeholders so the symbol
       substitutions below never accidentally touch LaTeX math. */
    const protectedBlocks = [];
    str = str.replace(/\$\$[\s\S]*?\$\$|\$[^$]*?\$/g, function (match) {
      protectedBlocks.push(match);
      return '%%MATH_' + (protectedBlocks.length - 1) + '%%';
    });

    /* ── Step 2: Convert bare symbols outside math blocks ── */
    str = str
      // Arrows / logic
      .replace(/\\implies/g,        '⟹')
      .replace(/\\Rightarrow/g,     '⇒')
      .replace(/\\rightarrow/g,     '→')
      .replace(/\\leftarrow/g,      '←')
      .replace(/\\leftrightarrow/g, '↔')

      // Inequalities
      .replace(/\\geq/g,  '≥')
      .replace(/\\leq/g,  '≤')
      .replace(/\\neq/g,  '≠')
      .replace(/\\approx/g, '≈')

      // Arithmetic
      .replace(/\\times/g, '×')
      .replace(/\\div/g,   '÷')
      .replace(/\\pm/g,    '±')
      .replace(/\\cdot/g,  '·')

      // Degree sign — handles 90^\circ and bare \degree
      .replace(/\^\\circ/g,  '°')
      .replace(/\\degree/g,  '°')

      // Common constants / Greek
      .replace(/\\infty/g,  '∞')
      .replace(/\\pi/g,     'π')
      .replace(/\\alpha/g,  'α')
      .replace(/\\beta/g,   'β')
      .replace(/\\gamma/g,  'γ')
      .replace(/\\delta/g,  'δ')
      .replace(/\\theta/g,  'θ')
      .replace(/\\lambda/g, 'λ')
      .replace(/\\mu/g,     'μ')
      .replace(/\\sigma/g,  'σ')
      .replace(/\\omega/g,  'ω')

      // Sets / misc
      .replace(/\\in/g,      '∈')
      .replace(/\\notin/g,   '∉')
      .replace(/\\subset/g,  '⊂')
      .replace(/\\cup/g,     '∪')
      .replace(/\\cap/g,     '∩')
      .replace(/\\emptyset/g,'∅')
      .replace(/\\therefore/g,'∴')
      .replace(/\\because/g, '∵');

    /* ── Step 3: Restore protected math blocks ── */
    str = str.replace(/%%MATH_(\d+)%%/g, function (_, i) {
      return protectedBlocks[parseInt(i, 10)];
    });

    return str;
  }

  /* ══════════════════════════════════════════════════════════
     Convenience wrapper — preprocess then HTML-escape.
     Use this everywhere question text / options / explanations
     are inserted into HTML.
     ══════════════════════════════════════════════════════════ */
  function _safeQ(str) {
    return _escHtml(preprocessLatex(str));
  }

  /* ── Load or resume exam after login ── */
  async function loadOrStart() {
    try {
      const snap = await Db().collection('ongoingExams').doc(S().userId).get();

      if (snap.exists) {
        S().exam = snap.data();

        // Normalize startTime from Firestore Timestamp to JS timestamp
        const st = S().exam.startTime;
        if (st) {
          const ms = typeof st.toDate === 'function' ? st.toDate().getTime()
                   : st.seconds                      ? st.seconds * 1000
                   : null;
          if (ms) {
            S().examStartMs = ms;
            renderExam();
            _startTimer();
            return;
          }
        }

        // Exam exists but timer not yet started — show instructions modal
        renderExam();
        _showInstructionsModal();
      } else {
        await renderSubjectSelection();
      }
    } catch (err) {
      console.error('[exam] loadOrStart error:', err);
      UI.toast('Failed to load your exam. Please refresh.', 'error');
    }
  }

  /* ── Subject selection screen ── */
  async function renderSubjectSelection() {
    try {
    const classKey  = (S().studentData.class || '').replace(/\s+/g, '').toLowerCase();
    const _qBank    = window.questions || (typeof questions !== 'undefined' ? questions : {});
    if (!_qBank[classKey]) {
  console.error('[exam] No questions for classKey:', classKey, '| keys:', Object.keys(_qBank));
  UI.toast(`No subjects found for class "${S().studentData.class}". Contact Master Timothy.`, 'error', 0);
  return;
}
    const available = _qBank[classKey] ? Object.keys(_qBank[classKey]) : [];

    // Load messages and tasks in parallel — neither blocks rendering
    await Promise.all([
      Tasks.loadStudentMessages(),
      Tasks.loadCoachingTasks(),
    ]).catch(err => console.warn('[exam] Subject selection pre-load error:', err));

    // Messages are now in AppState.studentMessages
    const messages = S().studentMessages || [];

    let messagesHtml = '';
    if (messages.length > 0) {
      messagesHtml = `
        <div class="space-y-4 mb-10">
          <h3 class="text-2xl font-bold text-center text-red-600">Messages from Master Timothy</h3>
          ${messages.map(m => `
            <div class="glass-dark p-6 rounded-2xl border-2 border-red-500 bg-red-50">
              <p class="text-lg font-medium mb-2">${_escHtml(m.message)}</p>
              <p class="text-sm opacity-60 text-right">
                Expires: ${new Date(m.expiresAt && m.expiresAt.toDate ? m.expiresAt.toDate() : m.expiresAt).toLocaleString()}
              </p>
            </div>`).join('')}
        </div>`;
    }

    const subjectsHtml = available.length === 0
      ? '<p class="text-red-500 text-xl">No subjects available for your class.</p>'
      : `<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          ${available.map(subj => `
            <label class="glass p-6 rounded-2xl cursor-pointer hover:scale-105 transition shadow block">
              <input type="checkbox" value="${_escAttr(subj)}" class="subject-checkbox w-5 h-5 accent-purple-600" />
              <span class="block mt-3 text-lg font-medium">${_escHtml(subj)}</span>
            </label>`).join('')}
        </div>
        <button id="startExamBtn" onclick="Exam.startExam()" disabled class="btn text-2xl px-16 py-5">
          Start Exam
        </button>`;

    UI.mount(`
      <div class="max-w-4xl mx-auto glass p-10 mt-10 rounded-3xl text-center animate-fadeIn">
        <h1 class="text-4xl font-bold mb-3">Welcome, ${_escHtml(S().studentData.name)}!</h1>
        <p class="text-xl mb-6 opacity-80">
          Class: ${_escHtml(S().studentData.class)} &bull; School: ${_escHtml(S().studentData.school)}
        </p>

        ${messagesHtml}

        <div id="tasksContainer" class="mb-8"></div>

        <button onclick="Chat.openPublicChat()" class="btn bg-green-600 hover:bg-green-700 text-xl px-10 py-4 mb-8">
          Public Discussion Chat
        </button>

        <p class="text-xl mb-6 font-medium">Select at least 2 subjects to start the exam</p>

        ${subjectsHtml}

        <div class="mt-8">
          <button onclick="window.fbAuth.signOut()" class="text-sm opacity-60 underline">Logout</button>
        </div>
      </div>`);

    // Render tasks into #tasksContainer now that the DOM is ready
    Tasks.renderTasksHTML();

    // Wire up checkboxes via JS — no inline handlers
    document.querySelectorAll('.subject-checkbox').forEach(cb => {
      cb.addEventListener('change', _updateStartBtn);
    });

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

  /* ── Start exam ── */
  let _startExamLock = false;

  async function startExam() {
    if (_startExamLock) return;

    const chosen = _getSelectedSubjects();
    if (chosen.length < 2) {
      UI.toast('Select at least 2 subjects.', 'warning');
      return;
    }

const classKey          = (S().studentData.class || '').replace(/\s+/g, '').toLowerCase();
const selectedQuestions = {};

const _qBank = window.questions;
console.log('[DEBUG] classKey:', classKey, '| qBank keys:', Object.keys(_qBank || {}));
console.log('[DEBUG] subjects in class:', _qBank && _qBank[classKey] ? Object.keys(_qBank[classKey]) : 'NONE');
console.log('[DEBUG] chosen subjects:', chosen);

if (!_qBank || !_qBank[classKey]) {
  UI.toast(`No subjects found for class "${S().studentData.class}". Contact Master Timothy.`, 'error', 0);
  return;
}

    for (const subj of chosen) {
      const all = (_qBank[classKey] || {})[subj] || [];
      if (all.length === 0) {
        UI.toast(`No questions available for ${subj}.`, 'error');
        return;
      }
      const shuffled = [...all].sort(() => Math.random() - 0.5);
      selectedQuestions[subj] = shuffled.slice(0, CFG().QUESTIONS_PER_SUBJECT);
    }

    const examDoc = {
      step:           'exam',
      subjects:       chosen,
      questions:      selectedQuestions,
      currentSubject: chosen[0],
      currentIndex:   0,
      answers:        {}
      // startTime intentionally omitted — set when user clicks OK in instructions modal
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
    } finally {
      if (document.getElementById('startExamBtn')) {
        UI.setLoading(btn, false);
      }
      _startExamLock = false;
    }
  }

  /* ── Instructions modal ── */
  function _showInstructionsModal() {
    const existing = document.getElementById('examModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id        = 'examModal';
    modal.className = 'modal-overlay';
    modal.setAttribute('role',            'dialog');
    modal.setAttribute('aria-modal',      'true');
    modal.setAttribute('aria-labelledby', 'examModalTitle');

    modal.innerHTML = `
      <div class="modal-box max-w-xl">
        <h2 id="examModalTitle" class="text-4xl font-bold mb-8 text-center">Exam Instructions</h2>
        <ul class="space-y-3 text-lg mb-8 text-left list-none">
          <li>• This exam lasts <strong>2 hours</strong> (120 minutes).</li>
          <li>• Answer questions for all selected subjects.</li>
          <li>• Use <strong>Previous / Next</strong> or the navigator to move between questions.</li>
          <li>• Questions with a <strong>green ring</strong> in the navigator have been answered.</li>
          <li>• You can open Public Chat at any time.</li>
          <li>• Once submitted, answers cannot be changed.</li>
          <li class="font-bold text-red-600 text-center mt-4">The timer starts when you click the button below.</li>
        </ul>
        <div class="text-center">
          <button onclick="Exam.beginExam()" class="btn text-xl px-12 py-5 bg-green-600 hover:bg-green-700">
            I understand — Start Exam Now
          </button>
        </div>
        <p class="text-center text-sm opacity-60 mt-6">Good luck!</p>
      </div>`;

    document.body.appendChild(modal);
  }

  /* ── Begin exam — user clicks OK in instructions modal ── */
  async function beginExam() {
    const modal = document.getElementById('examModal');
    if (modal) modal.remove();

    const now = new Date();
    S().examStartMs     = now.getTime();
    S().exam.startTime  = now;

    // Persist start time — if this fails, the local time is still used
    try {
      await Db().collection('ongoingExams').doc(S().userId).update({ startTime: now });
    } catch (err) {
      console.warn('[exam] Could not persist startTime, using local time.', err);
    }

    _startTimer();
    renderExam();
  }

  /* ── Render exam question page ── */
  function renderExam() {
    const exam = S().exam;
    if (!exam) return;

    const subj    = exam.currentSubject;
    const qList   = exam.questions[subj];
    const q       = qList[exam.currentIndex];
    const subjIdx = exam.subjects.indexOf(subj);

    UI.mount(`
      <div class="max-w-4xl mx-auto p-4 flex flex-col gap-6">

        <!-- Header -->
        <div class="glass p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 class="text-2xl md:text-3xl font-bold">${_escHtml(subj)}</h2>
            <p class="text-sm opacity-70 mt-1">Subject ${subjIdx + 1} of ${exam.subjects.length}</p>
          </div>
          <div class="text-center">
            <div id="timerDisplay"
                 class="text-4xl md:text-5xl font-extrabold timer-green font-mono"
                 aria-live="polite" aria-label="Time remaining">02:00:00</div>
            <p class="text-sm opacity-70 mt-1">Q ${exam.currentIndex + 1} / ${qList.length}</p>
          </div>
        </div>

        <!-- Question -->
        <div class="glass p-8 rounded-3xl">
          <p class="text-xl md:text-2xl leading-relaxed mb-8 font-medium">${_safeQ(q.q)}</p>
          <div class="space-y-4" id="optionsContainer">
            ${q.opts.map((opt, idx) => {
              const selected = exam.answers[`${subj}-${exam.currentIndex}`] === idx;
              return `
                <label class="block glass p-5 rounded-xl cursor-pointer hover:bg-purple-50 transition text-lg option-label"
                       style="${selected ? 'border:2px solid #7c3aed;background:rgba(124,58,237,0.07)' : ''}">
                  <input type="radio" name="option" value="${idx}"
                    ${selected ? 'checked' : ''}
                    class="w-5 h-5 accent-purple-600 mr-4"
                    aria-label="Option ${String.fromCharCode(65 + idx)}" />
                  <span>${_safeQ(opt)}</span>
                </label>`;
            }).join('')}
          </div>
        </div>

        <!-- Controls -->
        <div class="grid grid-cols-3 gap-4">
          <button id="prevBtn" onclick="Exam.prevQuestion()"
                  ${exam.currentIndex === 0 ? 'disabled' : ''}
                  class="btn bg-gray-500 hover:bg-gray-600 text-lg py-4 ${exam.currentIndex === 0 ? 'opacity-50' : ''}">
            Previous
          </button>
          <button onclick="Chat.openPublicChat()" class="btn bg-green-600 hover:bg-green-700 text-lg py-4">
            Chat
          </button>
          <button onclick="Exam.nextQuestion()" class="btn text-lg py-4">
            Next
          </button>
        </div>

        <!-- Subject tabs -->
        <div class="glass p-4 rounded-2xl flex flex-wrap gap-3 justify-center">
          ${exam.subjects.map(s => `
            <button onclick="Exam.switchSubject('${_escAttr(s)}')"
                    class="px-4 py-2 rounded-xl font-semibold text-sm transition
                           ${s === subj ? 'bg-purple-600 text-white' : 'bg-white/60 hover:bg-white/80'}">
              ${_escHtml(s)}
            </button>`).join('')}
        </div>

        <!-- Navigator -->
        <div class="glass-dark p-6 rounded-3xl border-t-4 border-purple-400/40">
          <h3 class="text-lg font-bold mb-4 text-center">${_escHtml(subj)} — Question Navigator</h3>
          <div id="navGrid" class="flex flex-wrap gap-2 justify-center">
            ${qList.map((_, i) => {
              const answered = exam.answers[`${subj}-${i}`] !== undefined;
              const current  = i === exam.currentIndex;
              return `
                <button onclick="Exam.goTo(${i})"
                        class="nav-btn ${current ? 'current' : ''} ${answered ? 'answered' : ''}"
                        aria-label="Question ${i + 1}${answered ? ', answered' : ''}">${i + 1}</button>`;
            }).join('')}
          </div>
        </div>

        <!-- Submit -->
        <div class="text-center pb-6">
          <button onclick="Exam.submitExam()" id="submitBtn"
                  class="btn bg-red-600 hover:bg-red-700 text-xl px-16 py-5">
            Submit Exam
          </button>
        </div>

      </div>`);

    // Wire answer selection — no inline handlers, no full re-render on answer change
    document.querySelectorAll('input[name="option"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const val = parseInt(radio.value, 10);
        _saveAnswer(subj, exam.currentIndex, val);
        _updateOptionsDisplay(subj, exam.currentIndex);
        _updateNavButton(exam.currentIndex);
      });
    });

    // Sync timer display immediately
    _updateTimerDisplay();

    // Option A — KaTeX renders any remaining $...$ math expressions
    _renderKatex();
  }

  /* ── Save answer — debounced Firestore write ── */
  function _saveAnswer(subj, idx, val) {
    S().exam.answers[`${subj}-${idx}`] = val;
    clearTimeout(_saveAnswer._debounce);
    _saveAnswer._debounce = setTimeout(() => {
      Db()
        .collection('ongoingExams')
        .doc(S().userId)
        .update({ answers: S().exam.answers })
        .catch(err => console.warn('[exam] Answer save error:', err));
    }, 800);
  }

  /* ── Update option highlight without full re-render ── */
  function _updateOptionsDisplay(subj, idx) {
    const selected = S().exam.answers[`${subj}-${idx}`];
    document.querySelectorAll('.option-label').forEach((lbl, i) => {
      lbl.style.cssText = i === selected
        ? 'border:2px solid #7c3aed;background:rgba(124,58,237,0.07)'
        : '';
    });
  }

  /* ── Update a single navigator button ── */
  function _updateNavButton(idx) {
    const subj    = S().exam.currentSubject;
    const answered = S().exam.answers[`${subj}-${idx}`] !== undefined;
    const btn      = document.querySelector(`#navGrid button:nth-child(${idx + 1})`);
    if (btn && answered) btn.classList.add('answered');
  }

  /* ── Navigation ── */
  function prevQuestion() {
    if (S().exam.currentIndex > 0) {
      S().exam.currentIndex--;
      renderExam();
    }
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

  function goTo(index) {
    S().exam.currentIndex = index;
    renderExam();
  }

  function switchSubject(subj) {
    S().exam.currentSubject = subj;
    S().exam.currentIndex   = 0;
    renderExam();
  }

  /* ── Timer ── */
  function _startTimer() {
    S().clearTimer();
    S().timerHandle = setInterval(_updateTimerDisplay, 1000);
  }

  function _updateTimerDisplay() {
    const el = document.getElementById('timerDisplay');
    if (!el || !S().examStartMs) return;

    const remaining = CFG().EXAM_DURATION_MS - (Date.now() - S().examStartMs);

    if (remaining <= 0) {
      S().clearTimer();
      el.textContent = '00:00:00';
      el.className   = 'text-4xl md:text-5xl font-extrabold timer-red font-mono';
      UI.toast('Time is up! Your exam is being submitted.', 'warning', 0);
      submitExam();
      return;
    }

    const h   = String(Math.floor(remaining / 3_600_000)).padStart(2, '0');
    const m   = String(Math.floor((remaining % 3_600_000) / 60_000)).padStart(2, '0');
    const sec = String(Math.floor((remaining % 60_000) / 1_000)).padStart(2, '0');
    el.textContent = `${h}:${m}:${sec}`;

    const cls = remaining < 600_000   ? 'timer-red'
              : remaining < 1_800_000 ? 'timer-yellow'
              : 'timer-green';
    el.className = `text-4xl md:text-5xl font-extrabold ${cls} font-mono`;
  }

  /* ── Submit exam ── */
  let _submitLock = false;

  async function submitExam() {
    if (_submitLock) return;

    const confirmed = await UI.confirmAction('Submit your exam? This cannot be undone.');
    if (!confirmed) return;

    _submitLock = true;
    S().clearTimer();

    const btn = document.getElementById('submitBtn');
    UI.setLoading(btn, true);

    try {
      const exam   = S().exam;
      const result = _computeResult(exam);

      // Atomic batch — all writes succeed or all fail
      const batch = Db().batch();

      // 1. Save result with server timestamp
      const resultRef = Db().collection('results').doc();
      batch.set(resultRef, {
        ...result,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      // 2. Delete ongoing exam
      batch.delete(Db().collection('ongoingExams').doc(S().userId));

      // 3. Mark coaching task if applicable
      const today    = new Date().toISOString().split('T')[0];
      const taskCfg  = S().currentTaskConfig;
      if (taskCfg && taskCfg.active && Array.isArray(taskCfg.dates) && taskCfg.dates.includes(today)) {
        const studentRef = Db().collection('students').doc(S().userId);
        batch.update(studentRef, { [`coachingCompleted.${today}`]: true });
      }

      await batch.commit();
      renderResults(exam, result);
    } catch (err) {
      console.error('[exam] submitExam error:', err);
      UI.toast('Submission failed. Please try again.', 'error');
      _submitLock = false;
      if (document.getElementById('submitBtn')) {
        UI.setLoading(document.getElementById('submitBtn'), false);
      }
    }
  }

  function _computeResult(exam) {
    let totalCorrect = 0, totalQuestions = 0;
    const scores        = {};
    const correctCounts = {};

    for (const subj of exam.subjects) {
      const qs = exam.questions[subj];
      let correct = 0;
      qs.forEach((q, i) => {
        if (exam.answers[`${subj}-${i}`] === q.ans) correct++;
      });
      correctCounts[subj] = correct;
      scores[subj]        = Math.round((correct / qs.length) * 100);
      totalCorrect        += correct;
      totalQuestions      += qs.length;
    }

    const percentage = Math.round((totalCorrect / totalQuestions) * 100);
    const grade = percentage >= 80 ? 'A'
                : percentage >= 70 ? 'B'
                : percentage >= 60 ? 'C'
                : percentage >= 50 ? 'D'
                : 'E';

    return {
      name:          S().studentData.name,
      class:         S().studentData.class,
      school:        S().studentData.school,
      subjects:      exam.subjects,
      scores,
      correctCounts,
      percentage,
      grade
    };
  }

  /* ── Results screen ── */
  function renderResults(exam, result) {
    const gradeColor = result.grade === 'A' ? '#16a34a'
                     : result.grade === 'B' ? '#2563eb'
                     : result.grade === 'C' ? '#ca8a04'
                     : result.grade === 'D' ? '#ea580c'
                     : '#dc2626';

    UI.mount(`
      <div class="max-w-5xl mx-auto glass p-10 mt-10 rounded-3xl text-center animate-fadeIn">
        <h1 class="text-5xl font-bold mb-8 text-green-600">Exam Completed!</h1>

        <div class="glass-dark p-10 rounded-2xl mb-10">
          <div class="text-7xl font-extrabold" style="color:${gradeColor}">
            ${result.percentage}% — Grade ${result.grade}
          </div>
          <p class="text-xl mt-4 opacity-70">
            ${_escHtml(result.name)} &bull; ${_escHtml(result.class)} &bull; ${_escHtml(result.school)}
          </p>
        </div>

        <p class="text-xl mb-8 opacity-80">Click each subject below to review your answers and explanations.</p>

        <div class="space-y-6 mb-12 text-left">
          ${exam.subjects.map(subj => {
            const qs = exam.questions[subj];
            return `
              <details class="glass-dark rounded-2xl overflow-hidden shadow-lg">
                <summary class="p-6 text-2xl font-bold cursor-pointer hover:bg-white/10 transition">
                  ${_escHtml(subj)} — ${result.correctCounts[subj]}/${qs.length} Correct (${result.scores[subj]}%)
                </summary>
                <div class="p-6 space-y-6">
                  ${qs.map((q, i) => {
                    const userAns = exam.answers[`${subj}-${i}`];
                    const correct = userAns === q.ans;
                    const border  = correct        ? 'border-green-500 bg-green-50'
                                  : userAns === undefined ? 'border-gray-400 bg-gray-50'
                                  : 'border-red-500 bg-red-50';
                    return `
                      <div class="glass p-6 rounded-xl border-4 ${border}">
                        <p class="font-semibold text-lg mb-4">Q${i + 1}: ${_safeQ(q.q)}</p>
                        <div class="grid md:grid-cols-2 gap-6 mb-4">
                          <div>
                            <strong>Your answer:</strong>
                            <span class="ml-3 ${correct ? 'text-green-700' : userAns === undefined ? 'text-gray-600' : 'text-red-700'}">
                              ${userAns !== undefined ? _safeQ(q.opts[userAns]) : 'Not answered'}
                            </span>
                          </div>
                          <div>
                            <strong>Correct answer:</strong>
                            <span class="ml-3 text-green-700">${_safeQ(q.opts[q.ans])}</span>
                          </div>
                        </div>
                        <div class="bg-gray-100 p-4 rounded-lg text-sm">
                          <strong>Explanation:</strong> ${_safeQ(q.exp)}
                        </div>
                      </div>`;
                  }).join('')}
                </div>
              </details>`;
          }).join('')}
        </div>

        <div class="flex flex-col md:flex-row gap-4 justify-center">
          <button onclick="Exam._shareWhatsApp()" class="btn bg-green-600 hover:bg-green-700 text-xl px-10 py-4">Share on WhatsApp</button>
          <button onclick="Exam._copyResult()"    class="btn bg-blue-600 hover:bg-blue-700 text-xl px-10 py-4">Copy Result</button>
          <button onclick="Exam.renderSubjectSelection()" class="btn text-xl px-10 py-4">Start New Exam</button>
        </div>
      </div>`);

   _currentResultForShare = { exam, result };

    // Option A — KaTeX renders math in review/explanations section
    _renderKatex();
  }

  /* ══════════════════════════════════════════════════════════
     OPTION A — KaTeX renderer (fixed)

     Changes from original:
     1. Checks window._katexAutoRenderReady (the flag set by the
        onload on the auto-render <script> tag in index.html)
        AND window.renderMathInElement — both must be ready.
     2. Wrapped in requestAnimationFrame() so KaTeX scans the
        DOM after the browser has actually painted the new nodes
        written by UI.mount() / renderExam() / renderResults().
     3. Scoped to #app instead of document.body — faster and
        avoids re-processing static page chrome on every question.
     4. try/catch so a single malformed expression (e.g. unclosed
        $) doesn't silently kill rendering for the whole question.
     5. Added \( \) and \[ \] delimiters for full LaTeX coverage.
     ══════════════════════════════════════════════════════════ */
  function _renderKatex() {
    requestAnimationFrame(function () {
      if (window._katexAutoRenderReady && window.renderMathInElement) {
        try {
          renderMathInElement(document.getElementById('app'), {
            delimiters: [
              { left: '$$', right: '$$', display: true  },
              { left: '$',  right: '$',  display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '\\[', right: '\\]', display: true  }
            ],
            throwOnError: false,
            errorColor: '#cc0000'
          });
        } catch (err) {
          console.warn('[KaTeX] Render error:', err);
        }
      } else {
        // KaTeX scripts still loading — retry shortly
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

  /* ── HTML escaping helpers ── */
  function _escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _escAttr(str) {
    return _escHtml(str).replace(/'/g, '&#39;');
  }

  /* ── Expose ── */
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
    preprocessLatex,   // exposed for testing / use by other modules if needed
  };

})();