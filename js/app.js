/* ============================================================
   js/app.js — Application entry point
   ============================================================
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    _registerGlobalErrorHandlers();
    if (window.VtxLoader) window.VtxLoader.progress(10, 'Connecting…');
    _startAuthListener();
    window._appReady = true;
  });

  function _startAuthListener() {
  if (window.VtxLoader) window.VtxLoader.progress(30, 'Checking session…');

  window.fbAuth.onAuthStateChanged(async function (firebaseUser) {
    if (firebaseUser) {
      if (window._registrationInProgress) return;
      await _onLogin(firebaseUser);
    } else {
      await _onLogout();
    }
  });
}

  async function _onLogin(firebaseUser) {
    var uid = firebaseUser.uid;
    AppState.cancelAllListeners();
    AppState.userId = uid;

    if (window.VtxLoader) window.VtxLoader.progress(50, 'Loading your profile…');

    // ── Teacher path ──
    if (uid === AppConfig.TEACHER_UID) {
      AppState.isTeacher = true;
      if (window.VtxLoader) window.VtxLoader.progress(90, 'Opening dashboard…');

      Teacher.renderTeacherDashboard();

      AppState.chatUnread = 0;
      var teacherNotifUnsub = window.fbDb
        .collection('chatNotifications')
        .doc(uid)
        .onSnapshot(function (notifSnap) {
          var count = (notifSnap.exists && notifSnap.data().unread) || 0;
          AppState.chatUnread = count;
          if (window.Chat && Chat._updateChatBadge) Chat._updateChatBadge(count);
        }, function (err) {
          console.warn('[app] teacher chatNotifications listener error:', err);
        });
      AppState.registerListener('chatNotifications', teacherNotifUnsub);

      if (window.DM && typeof DM.initTeacherDMListener === 'function') {
        DM.initTeacherDMListener();
      }

      // ── Init teacher message notifications ──
      if (window.MsgNotif) {
        MsgNotif.initForTeacher();
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
        if (window.DM && typeof DM.cancelListeners === 'function') {
          await DM.cancelListeners();
        }
        await window.fbAuth.signOut();
        return;
      }

      AppState.studentData = snap.data();
      AppState.chatUnread  = 0;

      if (window.VtxLoader) window.VtxLoader.progress(70, 'Loading your tasks…');

      var notifUnsub = window.fbDb
        .collection('chatNotifications')
        .doc(uid)
        .onSnapshot(function (notifSnap) {
          var count = (notifSnap.exists && notifSnap.data().unread) || 0;
          AppState.chatUnread = count;
          if (window.Chat && Chat._updateChatBadge) Chat._updateChatBadge(count);
        }, function (err) {
          console.warn('[app] chatNotifications listener error:', err);
        });
      AppState.registerListener('chatNotifications', notifUnsub);

      if (window.Notifications && typeof window.Notifications.init === 'function') {
        Notifications.init(uid).catch(function (e) {
          console.warn('[app] Notifications.init error (non-fatal):', e);
        });
      }

      await Tasks.listenForStudentUpdates();

      if (window.DM && typeof DM.initStudentDMListener === 'function') {
        DM.initStudentDMListener(uid);
      }

      // ── Init student message notifications ──
      if (window.MsgNotif) {
        MsgNotif.initForStudent(uid);
      }

      if (window.VtxLoader) window.VtxLoader.progress(90, 'Almost ready…');
      await Exam.loadOrStart();
      if (window.VtxLoader) window.VtxLoader.done();

    } catch (err) {
      console.error('[app] Profile load error:', err);
      if (window.VtxLoader) window.VtxLoader.done();
      UI.toast('Access error. Please try again.', 'error', 0);
      if (window.DM && typeof DM.cancelListeners === 'function') {
        await DM.cancelListeners();
      }
      await window.fbAuth.signOut();
    }
  }

async function _onLogout() {
  window._registrationInProgress = false;

  if (window.MsgNotif) {
    MsgNotif.cancel();
  }

  if (window.DM && typeof DM.cancelListeners === 'function') {
    await DM.cancelListeners().catch(e => console.warn('[app] DM.cancelListeners error on logout:', e));
  }

  Tasks.cancelListeners();
  AppState.reset();

  if (window.VtxLoader) window.VtxLoader.done();

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
