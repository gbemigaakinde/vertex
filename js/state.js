/* ============================================================
   js/state.js — Centralized application state
   All modules read and write state through this object.
   ============================================================ */
(function () {
  'use strict';

  /*
   * Internal property map — canonical names used by get/set.
   * Direct property access is also supported for back-compat,
   * but all modules should prefer get/set going forward.
   *
   * Canonical key  →  AppState property
   * ─────────────────────────────────────
   * 'user'         →  userId
   * 'studentData'  →  studentData
   * 'currentTasks' →  currentTaskConfig   (single canonical name)
   * 'studentMessages' → studentMessages
   * 'isTeacher'    →  isTeacher
   * 'exam'         →  exam
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
    userId:       null,
    studentData:  null,
    isTeacher:    false,

    /* ── Exam ── */
    exam:         null,   // Active exam document (mirrors ongoingExams Firestore doc)
    timerHandle:  null,   // setInterval handle — cleared before re-assignment
    examStartMs:  null,   // Unix ms timestamp when exam timer began

    /* ── Task / coaching ── */
    currentTaskConfig: null,  // Snapshot of coachingTasks/current doc

    /* ── Chat ── */
    replyingTo:      null,   // { name: string, text: string } | null
    studentMessages: [],     // Private messages for current student

    /* ── Firestore unsubscribe handles ── */
    _unsubs: {},

    /* ─────────────────────────────────────────── */
    /* Generic accessor API (used by tasks.js etc) */
    /* ─────────────────────────────────────────── */

    /**
     * Get a state value by canonical key or direct property name.
     * @param {string} key
     * @returns {*}
     */
    get(key) {
      const prop = _keyMap[key] || key;
      return this[prop];
    },

    /**
     * Set a state value by canonical key or direct property name.
     * @param {string} key
     * @param {*}      value
     */
    set(key, value) {
      const prop = _keyMap[key] || key;
      this[prop] = value;
    },

    /* ─────────────────────────────────────────── */
    /* Listener registry                           */
    /* ─────────────────────────────────────────── */

    /**
     * Register an unsubscribe function under a named key.
     * Calling this again with the same key first cancels the previous listener.
     * @param {string}   key
     * @param {Function} unsub
     */
    registerListener(key, unsub) {
      if (typeof this._unsubs[key] === 'function') {
        this._unsubs[key]();
      }
      this._unsubs[key] = unsub;
    },

    /**
     * Cancel a specific named listener.
     * @param {string} key
     */
    cancelListener(key) {
      if (typeof this._unsubs[key] === 'function') {
        this._unsubs[key]();
        delete this._unsubs[key];
      }
    },

    /**
     * Cancel all active Firestore listeners. Call this on logout.
     */
    cancelAllListeners() {
      Object.keys(this._unsubs).forEach(k => {
        if (typeof this._unsubs[k] === 'function') this._unsubs[k]();
      });
      this._unsubs = {};
    },

    /**
     * Clear the countdown timer if one is running.
     */
    clearTimer() {
      if (this.timerHandle) {
        clearInterval(this.timerHandle);
        this.timerHandle = null;
      }
    },

    /**
     * Hard reset — called on logout. Cancels all listeners and clears all state.
     */
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
    }
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