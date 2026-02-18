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
      // Registration in auth.js raises this flag to suppress routing
      // during the Auth-create -> Firestore-write -> signOut sequence.
      // Both the signed-in and signed-out events during that window are ignored.
      if (window._registrationInProgress) {
        return;
      }

      if (firebaseUser) {
        await _onLogin(firebaseUser);
      } else {
        _onLogout();
      }
    });
  }

  async function _onLogin(firebaseUser) {
    const uid = firebaseUser.uid;

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
      Tasks.listenForStudentUpdates();
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