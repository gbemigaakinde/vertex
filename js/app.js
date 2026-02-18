/* ============================================================
   js/app.js — Application entry point
   Responsibilities:
     - Bootstrap Firebase auth listener
     - Route authenticated users to teacher dashboard or exam engine
     - Handle logout cleanup
   ============================================================ */

(function () {
  'use strict';

  /* -------------------------------------------------- */
  /* Bootstrap                                          */
  /* -------------------------------------------------- */

  document.addEventListener('DOMContentLoaded', () => {
    _registerGlobalErrorHandlers();
    _startAuthListener();
  });

  /* -------------------------------------------------- */
  /* Auth state listener                                */
  /* -------------------------------------------------- */

  function _startAuthListener() {
    window.fbAuth.onAuthStateChanged(async firebaseUser => {
      if (firebaseUser) {
        await _onLogin(firebaseUser);
      } else {
        _onLogout();
      }
    });
  }

  async function _onLogin(firebaseUser) {
    const uid = firebaseUser.uid;

    // Cancel any pre-login listeners (e.g. school dropdown in auth.js)
    AppState.cancelAllListeners();

    AppState.userId = uid;

    // Teacher route
    if (uid === AppConfig.TEACHER_UID) {
      AppState.isTeacher = true;
      Teacher.renderTeacherDashboard();
      return;
    }

    AppState.isTeacher = false;

    try {
      const snap = await window.fbDb.collection('students').doc(uid).get();

      if (!snap.exists) {
        UI.toast('Profile not found. Please register again.', 'error', 0);
        await window.fbAuth.signOut();
        return;
      }

      AppState.studentData = snap.data();

      // Start real-time profile listener for coaching task completion updates
      Tasks.listenForStudentUpdates();

      // Route to exam engine — exam.js handles subject selection and exam resumption
      await Exam.loadOrStart();
    } catch (err) {
      console.error('[app] Profile load error:', err);
      UI.toast('Access error. Please try again.', 'error', 0);
      await window.fbAuth.signOut();
    }
  }

  function _onLogout() {
    // Cancel all Firestore listeners and clear timers
    Tasks.cancelListeners();
    AppState.reset();  // reset() calls cancelAllListeners() and clearTimer() internally

    // Show login screen
    Auth.renderLogin();
  }

  /* -------------------------------------------------- */
  /* Global error handlers                              */
  /* -------------------------------------------------- */

  function _registerGlobalErrorHandlers() {
    window.addEventListener('unhandledrejection', event => {
      console.error('[app] Unhandled promise rejection:', event.reason);
    });
  }

})();