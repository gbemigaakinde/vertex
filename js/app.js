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

   UPDATE: Added Notifications.init(uid) call after student
   profile loads. This requests push notification permission
   and saves the FCM token to Firestore so the teacher can
   send push notifications to students. Non-fatal — the app
   works normally if the student declines or the browser
   does not support notifications.
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

    // ── Teacher path ──
    if (uid === AppConfig.TEACHER_UID) {
      AppState.isTeacher = true;
      Teacher.renderTeacherDashboard();

      // Start notification listener for the teacher so they get a badge
      // on the Chat tab when a student mentions them.
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
      return;
    }

    // ── Student path ──
    AppState.isTeacher = false;
    try {
      var snap = await window.fbDb.collection('students').doc(uid).get();
      if (!snap.exists) {
        UI.toast('Profile not found. Please register again.', 'error', 0);
        await window.fbAuth.signOut();
        return;
      }

      AppState.studentData = snap.data();
      AppState.chatUnread = 0;

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
      // Request permission and save FCM token. Non-fatal if declined or
      // unsupported — a warning is logged but the app continues normally.
      if (window.Notifications && typeof window.Notifications.init === 'function') {
        Notifications.init(uid).catch(function (e) {
          console.warn('[app] Notifications.init error (non-fatal):', e);
        });
      }

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

}());
