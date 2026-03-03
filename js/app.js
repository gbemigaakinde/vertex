/* ============================================================
   js/app.js — Application entry point
   ============================================================
   FIX: await Tasks.listenForStudentUpdates() before calling
   Exam.loadOrStart(). listenForStudentUpdates() now returns
   a Promise that resolves after both loadCoachingTasks() and
   loadStudentMessages() have completed their first Firestore
   fetch. This guarantees AppState.currentTaskConfig is
   populated before renderSubjectSelection() reads it to apply
   subject restrictions.
   ============================================================ */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    _registerGlobalErrorHandlers();
    _startAuthListener();
    window._appReady = true;
  });

  function _startAuthListener() {
    window.fbAuth.onAuthStateChanged(async function (firebaseUser) {
      if (firebaseUser) {
        if (window._registrationInProgress) {
          return;
        }
        await _onLogin(firebaseUser);
      } else {
        _onLogout();
      }
    });
  }

  async function _onLogin(firebaseUser) {
    var uid = firebaseUser.uid;
    AppState.cancelAllListeners();
    AppState.userId = uid;

    /* Teacher route — tasks/messages not needed */
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

      /*
       * FIX: await listenForStudentUpdates() before proceeding.
       *
       * listenForStudentUpdates() now returns a Promise that resolves
       * only after BOTH loadCoachingTasks() and loadStudentMessages()
       * have received their first Firestore response. This ensures:
       *   • AppState.currentTaskConfig is set (or confirmed null)
       *   • AppState.studentMessages is populated
       * before renderSubjectSelection() reads them to apply subject
       * restrictions and display private messages correctly.
       *
       * Previously this was fire-and-forget, causing subject restrictions
       * to be silently skipped on every fresh login because
       * AppState.currentTaskConfig was still null when the exam screen
       * first rendered.
       */
      await Tasks.listenForStudentUpdates();

      await Exam.loadOrStart();
    } catch (err) {
      console.error('[app] Profile load error:', err);
      UI.toast('Access error. Please try again.', 'error', 0);
      await window.fbAuth.signOut();
    }
  }

  function _onLogout() {
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
