/* ============================================================
   js/app.js — Application entry point
   ============================================================
   CHANGES FROM ORIGINAL:
   1. window._appReady flag set after initialisation so the
      inline SW registration script in index.html knows the
      UI module is ready to display the update toast.
   2. No other logic changed.
   ============================================================ */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    _registerGlobalErrorHandlers();
    _startAuthListener();

    /*
     * Signal to the inline SW registration script in index.html
     * that the UI module is ready to accept showUpdateToast() calls.
     * The SW registration script polls for this flag before attempting
     * to show any toast, avoiding a race condition on first load.
     */
    window._appReady = true;
  });

  function _startAuthListener() {
    window.fbAuth.onAuthStateChanged(async function (firebaseUser) {
      if (firebaseUser) {
        /*
         * During registration auth.js creates an account then immediately
         * signs out. We must not route this transient signed-in state into
         * the exam flow — the Firestore profile write has not happened yet.
         * Block _onLogin only. Allow the subsequent sign-out to fall through
         * to _onLogout so Firebase's internal state machine stays in sync
         * and the next real login fires onAuthStateChanged correctly.
         */
        if (window._registrationInProgress) {
          return;
        }
        await _onLogin(firebaseUser);
      } else {
        /*
         * Always process sign-out normally, even during registration.
         * After registration's signOut(), this fires and _onLogout() calls
         * Auth.renderLogin() which rebuilds the page cleanly. This also
         * ensures Firebase's listener receives the null state, preventing
         * the SDK from skipping the next real sign-in event.
         */
        _onLogout();
      }
    });
  }

  async function _onLogin(firebaseUser) {
    var uid = firebaseUser.uid;
    AppState.cancelAllListeners();
    AppState.userId = uid;

    /* Teacher route */
    if (uid === AppConfig.TEACHER_UID) {
      AppState.isTeacher = true;
      Teacher.renderTeacherDashboard();
      return;
    }

    AppState.isTeacher = false;

    try {
      var snap = await window.fbDb.collection('students').doc(uid).get();

      if (!snap.exists) {
        UI.toast('Profile not found. Please register again.', 'error', 0);
        await window.fbAuth.signOut();
        return;
      }

      AppState.studentData = snap.data();
      Tasks.listenForStudentUpdates();
      await Exam.loadOrStart();
    } catch (err) {
      console.error('[app] Profile load error:', err);
      UI.toast('Access error. Please try again.', 'error', 0);
      await window.fbAuth.signOut();
    }
  }

  function _onLogout() {
    /*
     * Clear the registration guard in case it was somehow left raised
     * (e.g. an exception before auth.js cleared it). This ensures the
     * next login attempt is never silently blocked.
     */
    window._registrationInProgress = false;
    Tasks.cancelListeners();
    AppState.reset();
    Auth.renderLogin();
  }

  function _registerGlobalErrorHandlers() {
    window.addEventListener('unhandledrejection', function (event) {
      console.error('[app] Unhandled promise rejection:', event.reason);
    });
  }

})();