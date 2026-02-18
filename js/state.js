/* ============================================================
   js/state.js — Centralized application state
   All modules read and write state through this object.
   ============================================================ */

(function () {
  'use strict';

  // The single source of truth for runtime state
  window.AppState = {
    // Auth
    userId:       null,
    studentData:  null,
    isTeacher:    false,

    // Exam
    exam:         null,   // Active exam document (mirrors ongoingExams Firestore doc)
    timerHandle:  null,   // setInterval handle — cleared before re-assignment
    examStartMs:  null,   // Unix ms timestamp when exam timer began

    // Teacher
    currentTaskConfig: null,

    // Chat
    replyingTo:      null,   // { name: string, text: string } | null
    studentMessages: [],     // private messages for current student

    // Firestore unsubscribe handles — stored so we can cancel before re-subscribing
    _unsubs: {},

    /**
     * Register an unsubscribe function under a named key.
     * Calling this again with the same key will first cancel the previous listener.
     */
    registerListener(key, unsub) {
      if (typeof this._unsubs[key] === 'function') {
        this._unsubs[key]();
      }
      this._unsubs[key] = unsub;
    },

    /**
     * Cancel a specific named listener.
     */
    cancelListener(key) {
      if (typeof this._unsubs[key] === 'function') {
        this._unsubs[key]();
        delete this._unsubs[key];
      }
    },

    /**
     * Cancel all active Firestore listeners.
     * Call this on logout.
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
     * Hard reset — called on logout.
     */
    reset() {
      this.cancelAllListeners();
      this.clearTimer();
      this.userId      = null;
      this.studentData = null;
      this.isTeacher   = false;
      this.exam        = null;
      this.examStartMs = null;
      this.replyingTo  = null;
      this.studentMessages = [];
      this.currentTaskConfig = null;
    }
  };

  // Constants (shared across modules)
  window.AppConfig = {
    TEACHER_UID:              'bV4u2V7aakMF7EyYe1bpCXGj4ny1',
    QUESTIONS_PER_SUBJECT:    40,
    EXAM_DURATION_MS:         120 * 60 * 1000,   // 2 hours
  };

  // Shortcut helpers used by all modules
  // Db() returns the Firestore instance
  // S()  returns the current AppState
  window.Db = function () { return window.fbDb; };
  window.S  = function () { return window.AppState; };

})();