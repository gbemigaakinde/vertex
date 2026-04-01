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

    // ── Initialize offline infrastructure first ──────────────
    if (window.LocalDB) {
      LocalDB.init().catch((e) => console.warn('[app] LocalDB init error (non-fatal):', e));
    }
    if (window.SyncManager) {
      SyncManager.init();
    }

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

      if (window.MsgNotif) {
        MsgNotif.initForTeacher();
      }

      if (window.VtxLoader) window.VtxLoader.done();
      return;
    }

    // ── Student path ──
    AppState.isTeacher = false;
    try {
      // 1. Try local profile first (works offline)
      let studentData = null;
      if (window.LocalDB) {
        try {
          studentData = await LocalDB.getStudentProfile(uid);
        } catch (e) {
          console.warn('[app] LocalDB profile read failed:', e);
        }
      }

      // 2. If online, fetch from Firebase (authoritative) and update local cache
      if (navigator.onLine) {
        try {
          const snap = await window.fbDb.collection('students').doc(uid).get();
          if (!snap.exists) {
            if (window.VtxLoader) window.VtxLoader.done();
            UI.toast('Profile not found. Please register again.', 'error', 0);
            if (window.DM && typeof DM.cancelListeners === 'function') {
              await DM.cancelListeners();
            }
            await window.fbAuth.signOut();
            return;
          }
          studentData = snap.data();
          // Cache for offline use
          if (window.SyncManager) {
            SyncManager.cacheStudentProfile(uid, studentData).catch(() => {});
          }
        } catch (networkErr) {
          console.warn('[app] Firebase profile fetch failed — using local copy:', networkErr);
          if (!studentData) {
            // No local copy and Firebase failed — can't proceed
            if (window.VtxLoader) window.VtxLoader.done();
            UI.toast('Could not load profile. Please check your connection.', 'error', 0);
            return;
          }
        }
      } else if (!studentData) {
        // Offline with no cached profile
        if (window.VtxLoader) window.VtxLoader.done();
        UI.toast('You are offline and no cached profile was found. Please connect and try again.', 'error', 0);
        return;
      }

      AppState.studentData = studentData;
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

    // Destroy sync manager on logout
    if (window.SyncManager) {
      SyncManager.destroy();
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
