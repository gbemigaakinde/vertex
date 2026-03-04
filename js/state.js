/* ============================================================
   js/state.js — Centralized application state
   All modules read and write state through this object.
   ============================================================
   v3 notes:
   currentTaskConfig now holds a RESOLVED task doc — meaning
   for weekly/range tasks, tasks.js has already run the full
   _resolveTaskDates() engine and flattened all historical
   dates into doc.dates[].  The raw recurrence fields
   (recurrence, startDate, endDate, weeklyDays) are preserved
   on the object so exam.js / teacher.js can still inspect them
   if needed.  No structural change to AppState itself.
   ============================================================ */
(function () {
  'use strict';

  /*
   * Internal property map — canonical names used by get/set.
   *
   * Canonical key     →  AppState property
   * ─────────────────────────────────────────
   * 'user'            →  userId
   * 'studentData'     →  studentData
   * 'currentTasks'    →  currentTaskConfig
   * 'studentMessages' →  studentMessages
   * 'isTeacher'       →  isTeacher
   * 'exam'            →  exam
   */
  const _keyMap = {
    user:            'userId',
    studentData:     'studentData',
    currentTasks:    'currentTaskConfig',
    studentMessages: 'studentMessages',
    isTeacher:       'isTeacher',
    exam:            'exam',
  };

  window.AppState = {
    /* ── Auth ── */
    userId:      null,
    studentData: null,
    isTeacher:   false,

    /* ── Exam ── */
    exam:        null,   // Active exam document (mirrors ongoingExams Firestore doc)
    timerHandle: null,   // setInterval handle — cleared before re-assignment
    examStartMs: null,   // Unix ms timestamp when exam timer began

    /* ── Task / coaching ──
     *
     * currentTaskConfig is always the RESOLVED winning task doc:
     *   • For 'once' tasks: { recurrence:'once', dates:[...], dateSubjects:{...}, ... }
     *   • For 'weekly'/'range' tasks: the raw doc PLUS
     *       dates:        all concrete YYYY-MM-DD dates up to today
     *       dateSubjects: { 'YYYY-MM-DD': string[] } resolved from day-name keys
     *       _isRecurring: true
     *       _isWeekly:    true  (kept for backward compat)
     *
     * The resolution is done by tasks.js _resolveWeeklyDates() which
     * now calls the full _resolveTaskDates() engine instead of only
     * returning the current ISO week.
     */
    currentTaskConfig: null,

    /* ── Chat ── */
    replyingTo:      null,   // { name: string, text: string } | null
    studentMessages: [],     // Private messages for current student

    /* ── Firestore unsubscribe handles ── */
    _unsubs: {},

    /* ─────────────────────────────────────────────────────── */
    /* Generic accessor API                                    */
    /* ─────────────────────────────────────────────────────── */

    get(key) {
      const prop = _keyMap[key] || key;
      return this[prop];
    },

    set(key, value) {
      const prop = _keyMap[key] || key;
      this[prop] = value;
    },

    /* ─────────────────────────────────────────────────────── */
    /* Listener registry                                       */
    /* ─────────────────────────────────────────────────────── */

    registerListener(key, unsub) {
      if (typeof this._unsubs[key] === 'function') {
        this._unsubs[key]();
      }
      this._unsubs[key] = unsub;
    },

    cancelListener(key) {
      if (typeof this._unsubs[key] === 'function') {
        this._unsubs[key]();
        delete this._unsubs[key];
      }
    },

    cancelAllListeners() {
      Object.keys(this._unsubs).forEach(k => {
        if (typeof this._unsubs[k] === 'function') this._unsubs[k]();
      });
      this._unsubs = {};
    },

    clearTimer() {
      if (this.timerHandle) {
        clearInterval(this.timerHandle);
        this.timerHandle = null;
      }
    },

    reset() {
      this.cancelAllListeners();
      this.clearTimer();
      this.userId            = null;
      this.studentData       = null;
      this.isTeacher         = false;
      this.exam              = null;
      this.examStartMs       = null;
      this.replyingTo        = null;
      this.studentMessages   = [];
      this.currentTaskConfig = null;
    },
  };

  /* ── Global constants ── */
  window.AppConfig = {
    TEACHER_UID:           'bV4u2V7aakMF7EyYe1bpCXGj4ny1',
    QUESTIONS_PER_SUBJECT: 40,
    EXAM_DURATION_MS:      120 * 60 * 1000,   // 2 hours
  };

  /* ── Shortcut helpers used by all modules ── */
  window.Db = function () { return window.fbDb; };
  window.S  = function () { return window.AppState; };

})();
