/* ============================================================
   js/app.js — Application entry point
   ============================================================ */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    _registerGlobalErrorHandlers();
    _startAuthListener();
  });

  function _startAuthListener() {
    window.fbAuth.onAuthStateChanged(async firebaseUser => {
      if (firebaseUser) {
        // If auth.js registration is mid-flight, ignore this state change.
        // The registration flow signs out immediately after creating the account,
        // so the next state change will be the signed-out event which renders login.
        if (window._registrationInProgress) {
          return;
        }
        await _onLogin(firebaseUser);
      } else {
        // Also ignore the sign-out that registration triggers mid-flow.
        if (window._registrationInProgress) {
          return;
        }
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

      // Route to exam engine
      await Exam.loadOrStart();
    } catch (err) {
      console.error('[app] Profile load error:', err);
      UI.toast('Access error. Please try again.', 'error', 0);
      await window.fbAuth.signOut();
    }
  }

  function _onLogout() {
    Tasks.cancelListeners();
    AppState.reset();
    Auth.renderLogin();
  }

  function _registerGlobalErrorHandlers() {
    window.addEventListener('unhandledrejection', event => {
      console.error('[app] Unhandled promise rejection:', event.reason);
    });
  }

})();