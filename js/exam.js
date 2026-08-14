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
  /* Phosphor icon helper                                    */
  /* ─────────────────────────────────────────────────────── */
  function _icon(name, size) {
    size = size || 18;
    const icons = {
      ClipboardText: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M184,48H136V40a8,8,0,0,0-16,0v8H72A16,16,0,0,0,56,64V216a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V64A16,16,0,0,0,184,48Zm-48-8a0,0,0,0,1,0,0v0a0,0,0,0,1,0,0v0Zm-8,16h48v16H72V56ZM184,216H72V96H184V216Zm-32-88H104a8,8,0,0,0,0,16h48a8,8,0,0,0,0-16Zm0,32H104a8,8,0,0,0,0,16h48a8,8,0,0,0,0-16Z"/></svg>`,
      Books: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M231.65,194.55,198.27,65.4a16,16,0,0,0-19.44-11.33l-31.8,8.52A16,16,0,0,0,136,56H120a16,16,0,0,0-11,4.56L97.17,62.59A16,16,0,0,0,80,56H40A16,16,0,0,0,24,72V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16A16.07,16.07,0,0,0,231.65,194.55ZM120,72h16V200H120ZM40,200V72H80V200Zm96,0V72h4.55L176,194.43V200Z"/></svg>`,
      CalendarBlank: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM208,208H48V96H208ZM48,80V48H72v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80Z"/></svg>`,
      CheckCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/></svg>`,
      Lock: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M208,80H168V56a40,40,0,0,0-80,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM104,56a24,24,0,0,1,48,0V80H104ZM208,208H48V96H208Z"/></svg>`,
      Trophy: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80V96a40,40,0,0,0,37.65,39.87A64.15,64.15,0,0,0,96,183.42V208H80a8,8,0,0,0,0,16h96a8,8,0,0,0,0-16H160V183.42a64.15,64.15,0,0,0,50.35-47.55A40,40,0,0,0,248,96V80A16,16,0,0,0,232,64ZM40,96V80H48v55.33A24,24,0,0,1,40,96Zm176,0a24,24,0,0,1-8,17.33V80h8Z"/></svg>`,
      Medal: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M160,162.1V112a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v50.1a72,72,0,1,0,64,0ZM128,224a56,56,0,1,1,56-56A56.06,56.06,0,0,1,128,224Zm24-168H104a8,8,0,0,1,0-16h48a8,8,0,0,1,0,16Z"/></svg>`,
      ThumbsUp: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M234,80.12A24,24,0,0,0,216,72H160V56a40,40,0,0,0-40-40,8,8,0,0,0-7.16,4.42L75.06,96H32a16,16,0,0,0-16,16v88a16,16,0,0,0,16,16H204a24,24,0,0,0,23.82-21l12-96A24,24,0,0,0,234,80.12ZM32,112H72v88H32Zm183.64,9.61-12,96A8,8,0,0,1,196,224H88V105.89l36.71-73.43A24,24,0,0,1,144,56V80a8,8,0,0,0,8,8h64a8,8,0,0,1,7.94,8.61Z"/></svg>`,
      Fist: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M230.93,119.76C230.45,100.29,215.28,84,196,84H192V72a28,28,0,0,0-28-28H152a28,28,0,0,0-27.66,24H112A28,28,0,0,0,84,96v4H80a28,28,0,0,0-28,28v8H48a16,16,0,0,0-16,16v16a88,88,0,0,0,176,0V136A16.07,16.07,0,0,0,230.93,119.76ZM192,100a12,12,0,0,1,0,24H192V100ZM152,60h12a12,12,0,0,1,12,12V124H152a12,12,0,0,1,0-24h12V96H152a12,12,0,0,1,0-24Zm-52,36a12,12,0,0,1,12-12h12v8H112a12,12,0,0,0,0,24h28v16H112A12,12,0,0,1,100,132Zm-32,36a12,12,0,0,1,12-12H100v4a28,28,0,0,0,8,19.6V168a12,12,0,0,1-12,12H80A12,12,0,0,1,68,168Zm116,0a72,72,0,0,1-144,0V168h4a28,28,0,0,0,28-28V136h76a28,28,0,0,0,27.94-26H180a12,12,0,0,0,12,12h4Z"/></svg>`,
      BookOpen: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M224,48H160a40,40,0,0,0-32,16A40,40,0,0,0,96,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H96a24,24,0,0,1,24,24,8,8,0,0,0,16,0,24,24,0,0,1,24-24h64a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM96,192H32V64H96a24,24,0,0,1,24,24V200A40,40,0,0,0,96,192Zm128,0H160a40,40,0,0,0-24,8V88a24,24,0,0,1,24-24h64Z"/></svg>`,
      Flask: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M221.69,199.77,160,96.92V48h8a8,8,0,0,0,0-16H88a8,8,0,0,0,0,16h8V96.92L34.31,199.77A16,16,0,0,0,48,224H208a16,16,0,0,0,13.72-24.23ZM108.62,103.08A8.07,8.07,0,0,0,112,96.92V48h32V96.92a8.07,8.07,0,0,0,1.38,4.16L168.5,128H87.5ZM48,208l24-36.33L96,208Zm67.1,0L72,144.43,87.5,144h81l15.5.43L141.1,208Z"/></svg>`,
      BookBookmark: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M192,32H64A16,16,0,0,0,48,48V240a8,8,0,0,0,12.65,6.51L80,233.81l19.35,12.7A8,8,0,0,0,104,248a8,8,0,0,0,4.65-1.49L128,233.81l19.35,12.7A8,8,0,0,0,152,248a8,8,0,0,0,4.65-1.49L176,233.81l19.35,12.7A8,8,0,0,0,208,240V48A16,16,0,0,0,192,32Zm0,192-11.35-7.49a8,8,0,0,0-8.9,0L152,229.81l-19.75-13a8,8,0,0,0-8.5,0L104,229.81,84.25,216.51a8,8,0,0,0-8.9,0L64,224V48H192ZM80,120a8,8,0,0,1,8-8h80a8,8,0,0,1,0,16H88A8,8,0,0,1,80,120Zm0,32a8,8,0,0,1,8-8h80a8,8,0,0,1,0,16H88A8,8,0,0,1,80,152Z"/></svg>`,
      GameController: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M205.55,64H50.45A34.56,34.56,0,0,0,16,96.89c-1.67,47.32,4.66,96.93,36.53,119.82a34.17,34.17,0,0,0,20.2,6.58c11.38,0,22.95-5.44,34.37-16.19,6-5.65,8-7.1,20.9-7.1s14.91,1.45,20.9,7.1c11.42,10.75,23,16.19,34.37,16.19a34.17,34.17,0,0,0,20.2-6.58C240,193.86,241.66,144.22,240,96.89A34.56,34.56,0,0,0,205.55,64ZM96,152H80v16a8,8,0,0,1-16,0V152H48a8,8,0,0,1,0-16H64V120a8,8,0,0,1,16,0v16H96a8,8,0,0,1,0,16Zm64,4a12,12,0,1,1,12-12A12,12,0,0,1,160,156Zm32-32a12,12,0,1,1,12-12A12,12,0,0,1,192,124Z"/></svg>`,
      ChatCircleDots: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a88.11,88.11,0,0,1-45.06-12.38,8,8,0,0,0-6.54-.67L40,216l13.05-36.4a8,8,0,0,0-.67-6.54A88,88,0,1,1,128,216Zm12-88a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm-44,0a12,12,0,1,1-12-12A12,12,0,0,1,96,128Zm88,0a12,12,0,1,1-12-12A12,12,0,0,1,184,128Z"/></svg>`,
      EnvelopeSimple: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM203.43,64,128,133.15,52.57,64ZM216,192H40V74.19l82.59,75.71a8,8,0,0,0,10.82,0L216,74.19V192Z"/></svg>`,
      ChatText: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><path d="M216,48H40A16,16,0,0,0,24,64V224a15.85,15.85,0,0,0,9.24,14.5A16.13,16.13,0,0,0,40,240a15.89,15.89,0,0,0,10.25-3.78.69.69,0,0,0,.13-.11L82.5,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM216,192H80a8,8,0,0,0-5.34,2L40,224V64H216ZM88,112a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H96A8,8,0,0,1,88,112Zm0,32a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H96A8,8,0,0,1,88,144Z"/></svg>`,
    };
    return icons[name] || '';
  }

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
      const allWeeks = ttData.weeks  || {};
      const allGuides = ttData.guides || {};
      const weekKey  = _isoWeekKey();
      const todayStr = _todayStr();

      const guide = allGuides[weekKey];
      const guideActive = guide &&
        guide.expiresOn &&
        guide.expiresOn >= todayStr &&
        guide.days &&
        Object.keys(guide.days).length > 0;

      if (guideActive) {
        const d = new Date();
        const dow = d.getDay();
        const diff = dow === 0 ? -6 : 1 - dow;
        const monday = new Date(d); monday.setDate(d.getDate() + diff);
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        const rangeLabel =
          monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
          ' – ' +
          sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

        const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
        const dayRows = dayNames.map((day, i) => {
          const dayDate = new Date(monday);
          dayDate.setDate(monday.getDate() + i);
          const dateStr = dayDate.getFullYear() + '-' +
            String(dayDate.getMonth()+1).padStart(2,'0') + '-' +
            String(dayDate.getDate()).padStart(2,'0');
          const content = (guide.days || {})[dateStr];
          if (!content) return null;
          if (dateStr < todayStr) return null;
          const isToday = dateStr === todayStr;
          const dayLabel = dayDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
          return '<div style="padding:.5rem 0;border-bottom:1px solid var(--border);">' +
            '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.25rem;">' +
            '<span style="font-size:.8125rem;font-weight:700;color:' +
            (isToday ? 'var(--warning-text)' : 'var(--accent-text)') +
            ';">' + _escHtml(dayLabel) + '</span>' +
            (isToday ? '<span style="font-size:.6875rem;font-weight:700;padding:1px 6px;border-radius:99px;background:var(--warning-subtle);color:var(--warning-text);border:1px solid var(--warning-border);">TODAY</span>' : '') +
            '</div>' +
            '<span style="font-size:.8125rem;color:var(--text-1);line-height:1.6;white-space:pre-wrap;">' +
            _escHtml(content) + '</span></div>';
        }).filter(Boolean).join('');

        if (!dayRows) return '';

        return '<div style="margin-bottom:1.25rem;border:1px solid var(--warning-border);' +
          'border-left:3px solid var(--warning);border-radius:8px;' +
          'background:var(--warning-subtle);padding:.875rem 1rem;text-align:left;">' +
          '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.625rem;">' +
          '<span style="flex-shrink:0;color:var(--warning-text);">' + _icon('ClipboardText', 18) + '</span>' +
          '<div><p style="font-size:.875rem;font-weight:700;color:var(--warning-text);">' +
          _escHtml(guide.title || 'Daily Study Guide') + '</p>' +
          '<p style="font-size:.75rem;color:var(--text-3);margin-top:1px;">' + _escHtml(rangeLabel) + '</p>' +
          '</div></div><div style="padding-top:.125rem;">' + dayRows + '</div></div>';
      }

      const topics  = allWeeks[weekKey] || {};
      const entries = Object.entries(topics).filter(function (pair) {
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
        '<span style="flex-shrink:0;color:var(--accent-text);">' + _icon('Books', 18) + '</span>' +
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
             <span style="flex-shrink:0;margin-top:1px;color:var(--warning-text);">${_icon('ClipboardText', 20)}</span>
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
             <span style="flex-shrink:0;margin-top:1px;color:var(--brand-text);">${_icon('CalendarBlank', 20)}</span>
             <div>
               <p style="font-size:.875rem;font-weight:700;color:var(--brand-text);margin-bottom:.25rem;">No task session today</p>
               <p style="font-size:.8125rem;color:var(--text-secondary);line-height:1.6;">
                 You can take a free practice exam now. Your next required session is on
                 <strong>${offDayNextLabel}</strong>.
               </p>
             </div>
           </div>`
        : '';

      // Subject pill HTML
      let subjectsHtml;

      if (todayTaskDone) {
        const nextLabel = _nextUnlockedDateLabel();
        const nextLine  = nextLabel
          ? `Your next session opens on <strong>${nextLabel}</strong>.`
          : 'There are no upcoming sessions scheduled right now.';
        subjectsHtml = `
          <div style="margin-bottom:1.25rem;padding:1.25rem 1.5rem;border-radius:12px;
                      background:var(--success-bg);border:2px solid var(--success-border);text-align:center;">
            <div style="display:flex;justify-content:center;margin-bottom:.5rem;color:var(--success);">${_icon('CheckCircle', 36)}</div>
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
            <span style="display:inline-flex;align-items:center;">${_icon('Lock', 16)}</span> Exam Locked for Today
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
            <div style="position:relative;display:inline-flex;">
              <button id="chatOpenBtn" onclick="Chat.openPublicChat()" class="btn bg-green-600 hover:bg-green-700">
                Public Discussion Chat
              </button>
            </div>
            <div style="position:relative;display:inline-flex;">
              <button onclick="StudyRoom.openForStudent()" class="btn bg-blue-600 hover:bg-blue-700">
                <span style="display:inline-flex;align-items:center;gap:.375rem;">${_icon('BookOpen', 16)} Study Room</span>
              </button>
            </div>
            <div style="position:relative;display:inline-flex;">
              <button onclick="ThreeDClass.openForStudent()" class="btn bg-indigo-600 hover:bg-indigo-700">
                <span style="display:inline-flex;align-items:center;gap:.375rem;">${_icon('Flask', 16)} 3D Class</span>
              </button>
            </div>
            <div style="position:relative;display:inline-flex;">
              <button onclick="window.open('english.html', '_blank')" class="btn bg-purple-600 hover:bg-purple-700">
                <span style="display:inline-flex;align-items:center;gap:.375rem;">${_icon('BookBookmark', 16)} English Mastery</span>
              </button>
            </div>
            <div style="position:relative;display:inline-flex;">
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
  style="background:linear-gradient(135deg,#7c3aed,#4f6ef7);color:#fff;">
                <span style="display:inline-flex;align-items:center;gap:.375rem;">${_icon('GameController', 16)} Games</span>
              </button>
            </div>
            <div style="position:relative;display:inline-flex;">
              <button id="gcOpenBtn" onclick="GroupChat.openForStudent()" class="btn"
                style="background:var(--success);color:#fff;">
                <span style="display:inline-flex;align-items:center;gap:.375rem;">${_icon('ChatCircleDots', 16)} Group Chats</span>
              </button>
            </div>
            <div style="position:relative;display:inline-flex;">
              <button id="dmOpenBtn" onclick="DM.openStudentInbox()" class="btn bg-indigo-600 hover:bg-indigo-700">
                <span style="display:inline-flex;align-items:center;gap:.375rem;">${_icon('EnvelopeSimple', 16)} Message Teacher</span>
              </button>
            </div>
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
      } else {
        const existingChatBadge = document.querySelector('#chatOpenBtn ~ .chat-notif-badge, .chat-notif-badge');
        if (existingChatBadge) existingChatBadge.classList.remove('is-visible');
      }
      if (AppState.dmStudentUnread && AppState.dmStudentUnread > 0 && window.DM && DM._updateStudentBadge) {
        requestAnimationFrame(function () { DM._updateStudentBadge(AppState.dmStudentUnread); });
      } else {
        const existingDmBadge = document.querySelector('#dmOpenBtn ~ .dm-notif-badge, .dm-notif-badge');
        if (existingDmBadge) existingDmBadge.classList.remove('is-visible');
      }

      // Wire pill selection
      if (!restrictedSubjs && !todayTaskDone) {
        document.querySelectorAll('.vtx-subject-pill').forEach(pill => {
          pill.addEventListener('click', function (e) {
            e.preventDefault();
            const cb = pill.querySelector('input[type="checkbox"]');
            if (!cb || cb.disabled) return;
            cb.checked = !cb.checked;
            pill.classList.toggle('is-selected', cb.checked);
            _updateStartBtn();
          });
        });
      }

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
            The timer starts when you click below. Switching devices will not reset it.
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
        UI.toast('Warning: You switched away from the exam. Please stay on this tab.', 'warning', 5000);
      } else if (_visibilityHideCount === 2) {
        UI.toast('Final warning: One more switch will automatically submit your exam.', 'warning', 7000);
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
    _showBgCanvas(false);
    renderExam();
  }

/* ─────────────────────────────────────────────────────── */
  /* renderExam                                              */
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

  const RING_R = 14;
  const RING_C = 2 * Math.PI * RING_R;
  const progress = _timerProgress();
  const offset   = RING_C * (1 - progress);

  const ringColor =
    timerClass === 'timer-red'    ? 'is-red'
  : timerClass === 'timer-yellow' ? 'is-yellow'
  : '';

  const timerTextColor =
    timerClass === 'timer-red'    ? 'var(--danger)'
  : timerClass === 'timer-yellow' ? 'var(--warning)'
  : 'var(--success)';

  UI.mount(`
    <div class="max-w-4xl mx-auto" style="padding:0.5rem 0 1rem;">

      <!-- STUDENT BAR -->
      <div class="vtx-student-bar">
        <span>${_escHtml(S().studentData.name)}</span>
        <span style="color:var(--border-strong);">|</span>
        <span>${_escHtml(S().studentData.class)}</span>
        <span style="color:var(--border-strong);">|</span>
        <span>${_escHtml(S().studentData.school)}</span>
      </div>

      <!-- EXAM HEADER -->
      <div class="glass exam-header-sticky vtx-exam-hdr" style="margin-bottom:0.75rem;">

        <!-- Top row: subject name left, timer right -->
        <div class="vtx-exam-hdr-top">

          <div class="vtx-exam-hdr-subj">
            <h2 class="vtx-exam-hdr-name">${_escHtml(subj)}</h2>
            <p class="vtx-exam-hdr-meta">
              Subject ${subjIdx + 1} of ${exam.subjects.length}
              &bull;
              Q${exam.currentIndex + 1} / ${qList.length}
            </p>
          </div>

          <!-- Timer: arc ring + digits side by side -->
          <div class="vtx-exam-hdr-timer" id="vtxTimerWrap">

            <!-- Small arc ring — purely decorative progress indicator -->
            <svg
              class="vtx-arc-ring"
              viewBox="0 0 36 36"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle class="vtx-arc-track" cx="18" cy="18" r="${RING_R}" />
              <circle
                class="vtx-arc-prog ${ringColor}"
                cx="18" cy="18" r="${RING_R}"
                stroke-dasharray="${RING_C.toFixed(2)}"
                stroke-dashoffset="${offset.toFixed(2)}"
                id="timerRingProg"
              />
            </svg>

            <!-- Digit display — sits beside the ring, never inside it -->
            <div class="vtx-arc-digits">
              <span
                id="timerDisplay"
                class="vtx-arc-time ${timerClass}"
                style="color:${timerTextColor};"
                aria-live="polite"
                aria-label="Time remaining"
              >${timerStr}</span>
              <span class="vtx-arc-label">TIME LEFT</span>
            </div>

          </div>
        </div>

        <!-- Bottom row: speech buttons -->
        <div class="vtx-exam-hdr-bottom">
          <div class="vtx-speech-pill" id="seExamControls">
            <button
              id="seTtsBtn"
              class="se-tts-btn vtx-speech-btn"
              title="Read question aloud (R)"
              aria-label="Read question aloud"
            >
              <i class="ph ph-speaker-high" style="font-size:15px;"></i>
              <span class="vtx-speech-label">Read</span>
            </button>
            <span class="vtx-speech-div"></span>
            <button
              id="seSttBtn"
              class="se-stt-btn vtx-speech-btn"
              title="Voice command (M)"
              aria-label="Start voice command"
            >
              <i class="ph ph-microphone" style="font-size:15px;"></i>
              <span class="vtx-speech-label">Listen</span>
            </button>
          </div>
        </div>

      </div>
      <!-- END EXAM HEADER -->


      <!-- SUBJECT TABS -->
      <div class="vtx-subj-strip" style="margin-bottom:0.75rem;">
        ${exam.subjects.map(s => `
          <button
            onclick="Exam.switchSubject('${_escAttr(s)}')"
            class="vtx-subj-tab${s === subj ? ' is-active' : ''}"
          >${_escHtml(s)}</button>
        `).join('')}
      </div>


      <!-- QUESTION -->
      <div class="vtx-question-section" id="questionSection">
        <div class="vtx-question-wrap">

          <p style="font-size:1rem;font-weight:500;line-height:1.75;margin-bottom:1.125rem;color:var(--text-1);">
            <span style="font-family:var(--font-mono);font-size:.8125rem;font-weight:700;color:var(--accent);margin-right:.5rem;">${exam.currentIndex + 1}.</span>
            ${_safeQ(q.q)}
          </p>

          <div style="display:flex;flex-direction:column;gap:0.625rem;" id="optionsContainer">
            ${q.opts.map((opt, idx) => {
              const selected    = exam.answers[`${subj}-${exam.currentIndex}`] === idx;
              const letterLabel = String.fromCharCode(65 + idx);
              return `
                <label class="option-label${selected ? ' is-selected' : ''}" ${selected ? 'style="border-color:var(--brand);background:var(--brand-bg);transform:translateX(4px);"' : ''}>
                  <span style="font-family:var(--font-mono);font-size:.75rem;font-weight:700;color:${selected ? 'var(--accent)' : 'var(--text-4)'};min-width:1.25rem;flex-shrink:0;margin-top:.15rem;">${letterLabel}.</span>
                  <input type="radio" name="option" value="${idx}" ${selected ? 'checked' : ''} style="display:none;" aria-label="Option ${letterLabel}" />
                  <span class="flex-1">${_safeQ(opt)}</span>
                </label>
              `;
            }).join('')}
          </div>

        </div>
      </div>


      <!-- NAV CONTROLS -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;padding:0.75rem 0;border-top:1px solid var(--border);">
        <button id="prevBtn" onclick="Exam.prevQuestion()" ${exam.currentIndex === 0 ? 'disabled' : ''} class="btn bg-gray-500">← Prev</button>
        <button onclick="Chat.openPublicChat()" class="btn bg-green-600">Chat</button>
        <button onclick="Exam.nextQuestion()" class="btn">Next →</button>
      </div>


      <!-- QUESTION NAVIGATOR -->
      <div class="vtx-nav-section">
        <div class="vtx-nav-label">${_escHtml(subj)} — Navigator</div>
        <div id="navGrid" style="display:flex;flex-wrap:wrap;gap:0.375rem;justify-content:center;">
          ${qList.map((_, i) => {
            const answered = exam.answers[`${subj}-${i}`] !== undefined;
            const current  = i === exam.currentIndex;
            return `
              <button
                onclick="Exam.goTo(${i})"
                class="nav-btn ${current ? 'current' : ''} ${answered ? 'answered' : ''}"
                aria-label="Q${i + 1}${answered ? ', answered' : ''}"
              >${i + 1}</button>
            `;
          }).join('')}
        </div>
      </div>


      <!-- SUBMIT -->
      <div style="text-align:center;padding:1rem 0 0.5rem;">
        <button onclick="Exam.submitExam()" id="submitBtn" class="btn bg-red-600">Submit Exam</button>
      </div>

    </div>
  `);

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

  if (window.SpeechEngine && typeof SpeechEngine.wireExamButtons === 'function') {
    SpeechEngine.wireExamButtons(exam);
  }

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
      UI.toast('You\'re moving too fast! Take a moment to read the question carefully.', 'warning', 3500);
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

    const ring = document.getElementById('timerRingProg');
    if (ring) {
      const RING_R   = 34;
      const RING_C   = 2 * Math.PI * RING_R;
      const progress = Math.max(0, remaining / duration);
      ring.setAttribute('stroke-dashoffset', (RING_C * (1 - progress)).toFixed(2));
      const ringClass = 'vtx-timer-ring-prog' +
        (remaining < redThreshold ? ' is-red' : remaining < yellowThreshold ? ' is-yellow' : '');
      ring.setAttribute('class', ringClass);
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

      _showBgCanvas(true);
      if (window.VtxSound) {
        try { VtxSound.examSubmit(); } catch (e) {}
      }
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
  /* Results                                                 */
  /* ─────────────────────────────────────────────────────── */
  function renderResults(exam, result) {
  const gradeColor = result.grade === 'A' ? 'var(--success)'
                   : result.grade === 'B' ? 'var(--info)'
                   : result.grade === 'C' ? 'var(--warning)'
                   : result.grade === 'D' ? 'var(--warning)'
                   : 'var(--danger)';

  const gradeIconName = result.grade === 'A' ? 'Trophy'
                      : result.grade === 'B' ? 'Medal'
                      : result.grade === 'C' ? 'ThumbsUp'
                      : result.grade === 'D' ? 'Books'
                      : 'Fist';

  UI.mount(`
    <div class="max-w-4xl mx-auto glass animate-fadeIn" style="padding:1.5rem;margin-top:1.5rem;margin-bottom:1.5rem;">

      <div class="text-center mb-6">
        <div class="inline-flex items-center gap-2 mb-3"
             style="background:var(--success-bg);border:1px solid var(--success-border);border-radius:99px;padding:.375rem 1rem;">
          <span style="color:var(--success);display:inline-flex;align-items:center;">${_icon('CheckCircle', 15)}</span>
          <span style="color:var(--success);font-size:0.875rem;font-weight:600;">Submitted</span>
        </div>
        <h1 style="font-size:1.625rem;font-weight:700;">Exam Complete</h1>
        <p style="font-size:0.875rem;color:var(--text-3);margin-top:4px;">
          ${_escHtml(result.name)} &bull; ${_escHtml(result.class)} &bull; ${_escHtml(result.school)}
        </p>
      </div>

      <div style="text-align:center;padding:2rem 1rem;border-radius:var(--r-xl);
                  background:var(--bg-subtle);margin-bottom:1.5rem;">
        <div style="display:flex;align-items:baseline;justify-content:center;gap:0.25rem;">
          <span id="vtxScoreCount" class="vtx-score-display" style="color:${gradeColor};">0</span>
          <span style="font-size:1.5rem;font-weight:700;color:${gradeColor};">%</span>
        </div>
        <div style="margin-top:0.5rem;display:flex;align-items:center;justify-content:center;gap:0.5rem;">
          <span style="font-size:1.25rem;font-weight:700;color:${gradeColor};">Grade ${result.grade}</span>
          <span style="color:${gradeColor};display:inline-flex;align-items:center;" id="vtxGradeIcon">${_icon(gradeIconName, 24)}</span>
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

      <!-- Voice control bar for results page -->
      <div class="se-results-voice-bar" id="seResultsVoiceBar">
        <div class="vtx-speech-pill" id="seResultsSpeechPill">
          <button class="se-stt-btn vtx-speech-btn" id="seResultsSttBtn"
                  title="Voice commands for results page" aria-label="Voice commands">
            <i class="ph ph-microphone" style="font-size:15px;"></i>
            <span class="vtx-speech-label">Voice Commands</span>
          </button>
        </div>
        <span class="se-results-voice-hint">Say "explain question 3 in Maths", "back to dashboard", "share on WhatsApp"…</span>
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
                      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;margin-bottom:.75rem;">
                        <p style="font-weight:600;font-size:.9375rem;margin:0;">${i + 1}. ${_safeQ(q.q)}</p>
                        <button
                          onclick="SpeechEngine.showExplanationModal(${i + 1}, '${_escAttr(subj)}')"
                          class="se-explain-trigger-btn"
                          title="Get AI explanation for this question"
                          aria-label="Explain question ${i + 1}">
                          <i class="ph ph-chats"></i> Explain
                        </button>
                      </div>
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
        <button onclick="Exam.renderSubjectSelection()" class="btn">Back to Dashboard</button>
      </div>

    </div>`);

  _currentResultForShare = { exam, result };
  _countUp('vtxScoreCount', result.percentage, 1200);

  document.querySelectorAll('details').forEach(function (det) {
    det.addEventListener('toggle', function () {
      const arrow = det.querySelector('summary span:last-child');
      if (arrow) arrow.style.transform = det.open ? 'rotate(90deg)' : '';
    });
  });

  if (window.SpeechEngine && typeof SpeechEngine.wireResultsButtons === 'function') {
    SpeechEngine.wireResultsButtons(exam, result);
  }

  _renderKatex();
}

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
