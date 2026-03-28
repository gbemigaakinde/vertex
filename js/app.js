/* ============================================================
   js/app.js — Application entry point
   ============================================================
   Key rule: DM.cancelListeners() MUST be awaited before EVERY
   call to fbAuth.signOut(). This is because:

   - cancelListeners() writes online:false to Firestore while
     the auth token is still valid.
   - signOut() clears the auth token synchronously.
   - Any Firestore write after signOut() is rejected by the
     security rules (which require isSignedIn()), leaving the
     user stuck as "Online" indefinitely.

   There are two signOut() call sites in this file:
     1. _onLogin() — profile not found, signs out with error.
     2. _onLogin() — access error, signs out with error.
   Both now await DM.cancelListeners() first.

   _onLogout() fires from onAuthStateChanged AFTER signOut()
   has already happened, so it must NOT attempt any Firestore
   writes itself. DM.cancelListeners() is safe to call there
   too (it's idempotent — the cleanup functions will already
   be null if cancelListeners was properly called pre-signOut).
   ============================================================ */
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
        _onLogout();
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

  function _onLogout() {
    window._registrationInProgress = false;

    // ── Cancel message notifications ──
    if (window.MsgNotif) {
      MsgNotif.cancel();
    }

    if (window.DM && typeof DM.cancelListeners === 'function') {
      DM.cancelListeners();
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
