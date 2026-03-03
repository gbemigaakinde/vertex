/* ============================================================
   js/exam.js — Exam engine: start, navigate, timer, submit
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
      .replace(/\\geq/g,  '≥')
      .replace(/\\leq/g,  '≤')
      .replace(/\\neq/g,  '≠')
      .replace(/\\approx/g, '≈')
      .replace(/\\times/g, '×')
      .replace(/\\div/g,   '÷')
      .replace(/\\pm/g,    '±')
      .replace(/\\cdot/g,  '·')
      .replace(/\^\\circ/g,  '°')
      .replace(/\\degree/g,  '°')
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
      .replace(/\\in/g,      '∈')
      .replace(/\\notin/g,   '∉')
      .replace(/\\subset/g,  '⊂')
      .replace(/\\cup/g,     '∪')
      .replace(/\\cap/g,     '∩')
      .replace(/\\emptyset/g,'∅')
      .replace(/\\therefore/g,'∴')
      .replace(/\\because/g, '∵');

    str = str.replace(/%%MATH_(\d+)%%/g, function (_, i) {
      return protectedBlocks[parseInt(i, 10)];
    });

    return str;
  }

  function _safeQ(str) {
    return _escHtml(preprocessLatex(str));
  }

  /* ══════════════════════════════════════════════════════════
     _resolveStartMs(startTime)
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
        if (elapsed >= CFG().EXAM_DURATION_MS) {
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
     renderSubjectSelection
     ══════════════════════════════════════════════════════════ */
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

      await Promise.all([
        Tasks.loadStudentMessages(),
        Tasks.loadCoachingTasks(),
      ]).catch(err => console.warn('[exam] Subject selection pre-load error:', err));

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

      const subjectsHtml = available.length === 0
        ? '<p class="text-red-500 text-sm">No subjects available for your class.</p>'
        : `<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            ${available.map(subj => `
              <label class="glass p-4 rounded-xl cursor-pointer hover:scale-105 transition shadow block">
                <input type="checkbox" value="${_escAttr(subj)}" class="subject-checkbox w-4 h-4 accent-indigo-600" />
                <span class="block mt-2 text-sm font-semibold">${_escHtml(subj)}</span>
              </label>`).join('')}
          </div>
          <button id="startExamBtn" onclick="Exam.startExam()" disabled class="btn btn-lg w-full max-w-xs">
            Start Exam
          </button>`;

      UI.mount(`
        <div class="max-w-4xl mx-auto glass p-6 mt-6 rounded-2xl text-center animate-fadeIn">
          <div class="mb-5">
            <h1 class="text-2xl font-bold mb-1">Welcome, ${_escHtml(S().studentData.name)}</h1>
            <p class="text-sm text-gray-500">
              ${_escHtml(S().studentData.class)} &bull; ${_escHtml(S().studentData.school)}
            </p>
          </div>

          ${messagesHtml}

          <div id="tasksContainer" class="mb-6"></div>

          <div class="mb-6">
            <button onclick="Chat.openPublicChat()" class="btn bg-green-600 hover:bg-green-700">
              Public Discussion Chat
            </button>
          </div>

          <div class="text-left mb-3">
            <p class="text-sm font-semibold text-gray-600">Select at least 2 subjects to begin</p>
          </div>

          ${subjectsHtml}

          <div class="mt-6 pt-5 border-t border-gray-100">
            <button onclick="window.fbAuth.signOut()" class="text-xs text-gray-400 hover:text-gray-600 underline">
              Sign out
            </button>
          </div>
        </div>`);

      Tasks.renderTasksHTML();

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

  /* ══════════════════════════════════════════════════════════
     startExam
     ══════════════════════════════════════════════════════════ */
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
    const _qBank            = window.questions;

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
    modal.setAttribute('role',            'dialog');
    modal.setAttribute('aria-modal',      'true');
    modal.setAttribute('aria-labelledby', 'examModalTitle');

    modal.innerHTML = `
      <div class="modal-box" style="max-width:400px;width:100%;margin:auto;">
        <h2 id="examModalTitle" class="font-bold mb-4 text-center" style="font-size:1.125rem;">Exam Instructions</h2>
        <ul class="space-y-2 mb-5 text-left list-none" style="font-size:0.875rem;">
          <li>• This exam lasts <strong>2 hours</strong> (120 minutes).</li>
          <li>• Answer questions for all selected subjects.</li>
          <li>• Use <strong>Previous / Next</strong> or the navigator to move between questions.</li>
          <li>• <span class="font-semibold" style="color:var(--success,#2f9e44);">Green</span> buttons in the navigator = answered.</li>
          <li>• You can open Public Chat at any time.</li>
          <li>• Once submitted, answers cannot be changed.</li>
          <li class="font-semibold pt-1" style="color:var(--danger,#e03131);">
            ⏱ The timer starts when you click below. Switching devices will not reset it.
          </li>
        </ul>
        <button onclick="Exam.beginExam()"
                class="btn bg-green-600 hover:bg-green-700 w-full"
                style="justify-content:center;">
          I understand — Start Exam Now
        </button>
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

    try {
      await Db().collection('ongoingExams').doc(S().userId).set(
        { startTime: startDate },
        { merge: true }
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

        <!-- Student info bar -->
        <div class="glass-dark flex flex-wrap items-center gap-x-4 gap-y-1"
             style="padding:0.4375rem 0.875rem;border-radius:8px;font-size:0.8125rem;">
          <span class="font-semibold">${_escHtml(S().studentData.name)}</span>
          <span style="color:var(--border-medium,#d1d5db);">|</span>
          <span style="color:var(--text-tertiary,#6b7280);">${_escHtml(S().studentData.class)}</span>
          <span style="color:var(--border-medium,#d1d5db);">|</span>
          <span style="color:var(--text-tertiary,#6b7280);">${_escHtml(S().studentData.school)}</span>
        </div>

        <!-- Header: subject info + timer -->
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
              ${S().examStartMs ? '...' : '02:00:00'}
            </div>
            <p style="font-size:0.75rem;color:var(--text-disabled,#9ca3af);margin-top:2px;">Time remaining</p>
          </div>
        </div>

        <!-- Question + Options -->
        <div class="glass" style="padding:1.25rem 1.5rem;">
          <p class="font-medium" style="font-size:1.0625rem;line-height:1.65;margin-bottom:1.25rem;">${_safeQ(q.q)}</p>
          <div class="space-y-2" id="optionsContainer">
            ${q.opts.map((opt, idx) => {
              const selected = exam.answers[`${subj}-${exam.currentIndex}`] === idx;
              return `
                <label class="block glass cursor-pointer option-label${selected ? ' is-selected' : ''}"
                       style="${selected ? 'border-color:var(--brand,#3b5bdb);background:var(--brand-bg,#edf2ff);' : ''}">
                  <input type="radio" name="option" value="${idx}"
                    ${selected ? 'checked' : ''}
                    class="accent-indigo-600"
                    aria-label="Option ${String.fromCharCode(65 + idx)}" />
                  <span class="flex-1">${_safeQ(opt)}</span>
                </label>`;
            }).join('')}
          </div>
        </div>

        <!-- Controls -->
        <div class="grid grid-cols-3 gap-3">
          <button id="prevBtn" onclick="Exam.prevQuestion()"
                  ${exam.currentIndex === 0 ? 'disabled' : ''}
                  class="btn bg-gray-500 hover:bg-gray-600">
            ← Prev
          </button>
          <button onclick="Chat.openPublicChat()" class="btn bg-green-600 hover:bg-green-700">
            Chat
          </button>
          <button onclick="Exam.nextQuestion()" class="btn">
            Next →
          </button>
        </div>

        <!-- Subject tabs -->
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

        <!-- Navigator -->
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

        <!-- Submit -->
        <div class="text-center" style="padding-bottom:1rem;">
          <button onclick="Exam.submitExam()" id="submitBtn"
                  class="btn bg-red-600 hover:bg-red-700">
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
      Db()
        .collection('ongoingExams')
        .doc(S().userId)
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
        ? 'border-color:var(--brand,#3b5bdb);background:var(--brand-bg,#edf2ff);'
        : '';
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

    if (!S().examStartMs) {
      el.textContent = '02:00:00';
      el.className   = 'timer-green';
      return;
    }

    const remaining = CFG().EXAM_DURATION_MS - (Date.now() - S().examStartMs);

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

    el.className = remaining < 600_000   ? 'timer-red'
                 : remaining < 1_800_000 ? 'timer-yellow'
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

      /*
       * Build a serialisable snapshot of every question + the student's
       * chosen answer index. This is stored permanently in the result
       * document so the teacher can review the exact attempt later.
       *
       * Shape per subject:
       *   { q: string, opts: string[], ans: number, exp: string, chosen: number|null }
       */
      const questionSnapshots = {};
      for (const subj of exam.subjects) {
        questionSnapshots[subj] = exam.questions[subj].map((q, i) => {
          // Firestore rejects writes that contain `undefined` anywhere in the
          // payload — even nested inside arrays — and will throw or silently
          // drop the field depending on the SDK version.  Coerce every value
          // to a safe type before writing.
          const chosenRaw = exam.answers[`${subj}-${i}`];
          return {
            q:      q.q    != null ? String(q.q)   : '',
            opts:   Array.isArray(q.opts)
                      ? q.opts.map(o => o != null ? String(o) : '')
                      : [],
            ans:    q.ans  != null ? Number(q.ans)  : 0,
            exp:    q.exp  != null ? String(q.exp)  : '',
            chosen: chosenRaw !== undefined && chosenRaw !== null
                      ? Number(chosenRaw)
                      : null,
          };
        });
      }

      const batch = Db().batch();

      const resultRef = Db().collection('results').doc();
      batch.set(resultRef, {
        ...result,
        questionSnapshots,          // ← full attempt detail saved here
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      batch.delete(Db().collection('ongoingExams').doc(S().userId));

      const today   = new Date().toISOString().split('T')[0];
      const taskCfg = S().currentTaskConfig;
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

  /* ══════════════════════════════════════════════════════════
     _computeResult
     ══════════════════════════════════════════════════════════ */
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
    const grade = percentage >= 70 ? 'A'
                : percentage >= 60 ? 'B'
                : percentage >= 50 ? 'C'
                : percentage >= 40 ? 'D'
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

  /* ══════════════════════════════════════════════════════════
     renderResults
     ══════════════════════════════════════════════════════════ */
  function renderResults(exam, result) {
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
          <div style="font-size:1.125rem;font-weight:700;color:${gradeColor};margin-top:4px;">
            Grade ${result.grade}
          </div>

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

  /* ── HTML escaping ── */
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
    preprocessLatex,
  };

})();