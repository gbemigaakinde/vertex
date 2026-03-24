/* ============================================================
   js/app.js — Application entry point
   ============================================================
   CHANGES FROM PREVIOUS VERSION:

   1. VtxLoader integration — reports loading progress to the
      splash screen defined in index.html so the user sees a
      meaningful loading indicator instead of a blank page.
      Steps reported:
        10% — Firebase initialised
        30% — Auth listener ready
        60% — Student profile loaded
        80% — Tasks and messages loaded
       100% — App ready (loader dismissed)

   2. Landing page — unauthenticated users now see the public
      homepage (Landing.render()) instead of going directly to
      the login screen. The login is reachable via the Sign In
      button on that page.

   All other logic (teacher path, student path, error handling,
   registration guard) is unchanged from the previous version.
   ============================================================ */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    _registerGlobalErrorHandlers();

    /* Step 1 — Firebase is already initialised by config.js which
       loads before this file. Mark first milestone. */
    if (window.VtxLoader) window.VtxLoader.progress(10, 'Connecting…');

    _startAuthListener();
    window._appReady = true;
  });

  function _startAuthListener() {
    /* Step 2 — Auth listener is being established */
    if (window.VtxLoader) window.VtxLoader.progress(30, 'Checking session…');

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

    /* Step 3 — We have a user, loading their profile */
    if (window.VtxLoader) window.VtxLoader.progress(50, 'Loading your profile…');

    // ── Teacher path ──
    if (uid === AppConfig.TEACHER_UID) {
      AppState.isTeacher = true;

      if (window.VtxLoader) window.VtxLoader.progress(90, 'Opening dashboard…');

      Teacher.renderTeacherDashboard();

      // Start notification listener for the teacher
      AppState.chatUnread = 0;
      var teacherNotifUnsub = window.fbDb
        .collection('chatNotifications')
        .doc(uid)
        .onSnapshot(function (notifSnap) {
          var count = (notifSnap.exists && notifSnap.data().unread) || 0;
          AppState.chatUnread = count;
          if (window.Chat && Chat._updateChatBadge) {
            Chat._updateChatBadge(count);
          }
        }, function (err) {
          console.warn('[app] teacher chatNotifications listener error:', err);
        });
      AppState.registerListener('chatNotifications', teacherNotifUnsub);

      // Start DM unread listener for teacher badge
      if (window.DM && typeof DM.initTeacherDMListener === 'function') {
        DM.initTeacherDMListener();
      }

      if (window.VtxLoader) window.VtxLoader.done();
      return;
    }

    // ── Student path ──
    AppState.isTeacher = false;
    try {
      var snap = await window.fbDb.collection('students').doc(uid).get();
      if (!snap.exists) {
        if (window.VtxLoader) window.VtxLoader.done();
        UI.toast('Profile not found. Please register again.', 'error', 0);
        await window.fbAuth.signOut();
        return;
      }

      AppState.studentData = snap.data();
      AppState.chatUnread = 0;

      /* Step 4 — Profile loaded, now loading tasks and messages */
      if (window.VtxLoader) window.VtxLoader.progress(70, 'Loading your tasks…');

      // ── Chat notification listener ──
      var notifUnsub = window.fbDb
        .collection('chatNotifications')
        .doc(uid)
        .onSnapshot(function (notifSnap) {
          var count = (notifSnap.exists && notifSnap.data().unread) || 0;
          AppState.chatUnread = count;
          if (window.Chat && Chat._updateChatBadge) {
            Chat._updateChatBadge(count);
          }
        }, function (err) {
          console.warn('[app] chatNotifications listener error:', err);
        });
      AppState.registerListener('chatNotifications', notifUnsub);

      // ── Push notifications ──
      if (window.Notifications && typeof window.Notifications.init === 'function') {
        Notifications.init(uid).catch(function (e) {
          console.warn('[app] Notifications.init error (non-fatal):', e);
        });
      }

      await Tasks.listenForStudentUpdates();

      // Start DM unread listener for student badge
      if (window.DM && typeof DM.initStudentDMListener === 'function') {
        DM.initStudentDMListener(uid);
      }

      /* Step 5 — Everything loaded, dismiss loader then render */
      if (window.VtxLoader) window.VtxLoader.progress(90, 'Almost ready…');

      await Exam.loadOrStart();

      if (window.VtxLoader) window.VtxLoader.done();

    } catch (err) {
      console.error('[app] Profile load error:', err);
      if (window.VtxLoader) window.VtxLoader.done();
      UI.toast('Access error. Please try again.', 'error', 0);
      await window.fbAuth.signOut();
    }
  }

  function _onLogout() {
    window._registrationInProgress = false;
    Tasks.cancelListeners();
    AppState.reset();

    /* Show the public homepage instead of going directly to login.
       VtxLoader.done() is called here because _onLogout() is also
       triggered on the very first load when no user is signed in. */
    if (window.VtxLoader) window.VtxLoader.done();

    // Use Landing page if available, otherwise fall back to login
    if (window.Landing && typeof Landing.render === 'function') {
      Landing.render();
    } else {
      Auth.renderLogin();
    }
  }

  function _registerGlobalErrorHandlers() {
    window.addEventListener('unhandledrejection', function (event) {
      console.error('[app] Unhandled promise rejection:', event.reason);
    });
  }

}());
