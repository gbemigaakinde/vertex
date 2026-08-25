/* ============================================================
   js/session-reminders.js — In-app TTS reminder engine
   Fires contextual nudges while the student is active.
   Requires window.SpeechEngine (from speech.js).
   ============================================================ */

(function () {
  'use strict';

  var _running        = false;
  var _lastInteractMs = Date.now();
  var _checkInterval  = null;

  // Cooldowns: { type: lastFiredMs }
  var _cooldowns = {};
  var COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

  // Timer tracking
  var _questionStartMs  = null;
  var _currentQuestionKey = null;

  /* ── Interaction detection ── */
  function _onInteract() {
    _lastInteractMs = Date.now();
  }

  function _attachInteractionListeners() {
    document.addEventListener('click',      _onInteract, { passive: true });
    document.addEventListener('keydown',    _onInteract, { passive: true });
    document.addEventListener('touchstart', _onInteract, { passive: true });
  }

  function _detachInteractionListeners() {
    document.removeEventListener('click',      _onInteract);
    document.removeEventListener('keydown',    _onInteract);
    document.removeEventListener('touchstart', _onInteract);
  }

  /* ── Helpers ── */
  function _canFire(type) {
    var last = _cooldowns[type] || 0;
    return (Date.now() - last) > COOLDOWN_MS;
  }

  function _markFired(type) {
    _cooldowns[type] = Date.now();
  }

  function _isTTSReady() {
    if (!window.SpeechEngine) return false;
    if (!SpeechEngine.ttsSupported) return false;
    // Use isSpeaking() if available; fall back to false (speak anyway)
    if (typeof SpeechEngine.isSpeaking === 'function') {
      return !SpeechEngine.isSpeaking();
    }
    return true;
  }

  function _speak(msg, type) {
    if (!_isTTSReady()) return;
    if (!_canFire(type)) return;
    _markFired(type);
    SpeechEngine.speak(msg, null, false);
  }

  function _isInExam() {
    // Check AppState
    if (window.AppState && window.AppState.exam && window.AppState.exam.step === 'exam') return true;
    // Fallback: check DOM
    return !!document.getElementById('seExamControls');
  }

  function _isTabVisible() {
    return document.visibilityState === 'visible';
  }

  /* ── Question tracking: call this whenever a new question renders ── */
  function _trackQuestion() {
    if (!window.AppState || !window.AppState.exam) return;
    var exam = window.AppState.exam;
    if (!exam) return;
    var key = (exam.currentSubject || '') + '-' + (exam.currentIndex || 0);
    if (key !== _currentQuestionKey) {
      _currentQuestionKey = key;
      _questionStartMs    = Date.now();
    }
  }

  /* ── Main check loop (runs every 30 seconds) ── */
  function _check() {
    if (!_running || !_isTabVisible()) return;

    _trackQuestion();

    var now      = Date.now();
    var idleMs   = now - _lastInteractMs;
    var idleMins = idleMs / 60000;

    // ── IDLE reminder ──────────────────────────────────────────
    if (_isInExam() && idleMins >= 3 && _canFire('idle')) {
      _speak(
        "You've been quiet for " + Math.floor(idleMins) + " minutes. " +
        "Take your time, but remember the clock is running.",
        'idle'
      );
      return; // one reminder per check
    }

    // ── STUCK reminder ─────────────────────────────────────────
    if (_isInExam() && _questionStartMs) {
      var stuckMins = (now - _questionStartMs) / 60000;
      // Check if no answer has been selected for the current question
      if (stuckMins >= 4 && _canFire('stuck')) {
        var exam     = window.AppState && window.AppState.exam;
        var answered = false;
        if (exam && exam.answers) {
          var k = (exam.currentSubject || '') + '-' + (exam.currentIndex || 0);
          answered = exam.answers[k] !== undefined;
        }
        if (!answered) {
          _speak(
            "You've been on this question for over " + Math.floor(stuckMins) + " minutes. " +
            "Would you like me to read it again? Press R to hear the question.",
            'stuck'
          );
          return;
        }
      }
    }

    // ── STREAK AT RISK reminder ────────────────────────────────
    if (!_isInExam() && _canFire('streak_at_risk')) {
      var sd = window.AppState && window.AppState.studentData;
      if (sd && sd.studyStreak && sd.studyStreak > 0) {
        var hour = new Date().getHours();
        // Warn between 20:00 and 22:00 if they haven't done an exam today
        if (hour >= 20 && hour < 22) {
          var today     = (window.Tasks && Tasks._localDateStr) ? Tasks._localDateStr() : _todayStr();
          var completed = (sd.coachingCompleted || {})[today];
          if (!completed) {
            _speak(
              "Don't forget — you have a " + sd.studyStreak + "-day study streak. " +
              "Start a quick practice exam to keep it going!",
              'streak_at_risk'
            );
          }
        }
      }
    }
  }

  function _todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /* ── Public API ── */
  function start() {
    if (_running) return;
    _running        = true;
    _lastInteractMs = Date.now();
    _cooldowns      = {};
    _questionStartMs = null;
    _currentQuestionKey = null;

    _attachInteractionListeners();
    _checkInterval = setInterval(_check, 30000); // check every 30s
    _showIndicator(true);
  }

  function stop() {
    if (!_running) return;
    _running = false;
    _detachInteractionListeners();
    if (_checkInterval) { clearInterval(_checkInterval); _checkInterval = null; }
    _showIndicator(false);
  }

  function resetQuestionTimer() {
    _questionStartMs    = Date.now();
    _currentQuestionKey = null;
    _lastInteractMs     = Date.now();
  }

  /* ── Indicator dot in exam controls bar ── */
  function _showIndicator(on) {
    var existing = document.getElementById('vtxReminderDot');
    if (!on) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return; // already shown
    var pill = document.getElementById('seExamControls');
    if (!pill) return;
    var dot = document.createElement('span');
    dot.id = 'vtxReminderDot';
    dot.title = 'Smart reminders active';
    dot.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'gap:.25rem',
      'font-size:.5625rem',
      'font-weight:700',
      'letter-spacing:.06em',
      'color:var(--success)',
      'margin-left:.5rem',
    ].join(';');
    dot.innerHTML =
      '<span style="width:6px;height:6px;border-radius:50%;' +
        'background:var(--success);display:inline-block;' +
        'animation:cbt-pulse 1.5s ease-in-out infinite;"></span>' +
      'REMINDERS';
    pill.appendChild(dot);
  }

  window.SessionReminders = {
    start:              start,
    stop:               stop,
    resetQuestionTimer: resetQuestionTimer,
  };

}());
