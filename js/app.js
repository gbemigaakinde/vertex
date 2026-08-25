/* ============================================================
   js/app.js — Application entry point
   ============================================================ */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    _registerGlobalErrorHandlers();
    if (window.VtxLoader) window.VtxLoader.progress(10, 'Connecting…');
    _startAuthListener();
    window._appReady = true;
  });

  // ── Auth session state ───────────────────────────────────────
  let _authResolved = false;
  let _loggingOut   = false;

  function _startAuthListener() {
    if (window.VtxLoader) window.VtxLoader.progress(30, 'Checking session…');

    window.fbAuth.onAuthStateChanged(async function (firebaseUser) {
      if (_authResolved) return;
      if (_loggingOut)   return;

      _authResolved = true;

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
      if (window.VtxSound) {
        try { VtxSound.welcome(); } catch (e) {}
      }

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

      // Start approval badge listener for teacher
      if (window.ActivityLog && typeof ActivityLog.initTeacherApprovalListener === 'function') {
        ActivityLog.initTeacherApprovalListener();
      }

      if (window.VtxLoader) window.VtxLoader.done();
      return;
    }

    // ── Student path ──
    AppState.isTeacher = false;
    try {
      // ── APPROVAL GATE CHECK ──
      // Before fetching from students collection, check if this uid is pending or declined.
      const approvalStatus = await ActivityLog.checkApprovalStatus(uid);

      if (approvalStatus === 'pending') {
        // Student is still awaiting approval — show waiting room
        if (window.VtxLoader) window.VtxLoader.done();
        const pendingData = await ActivityLog.getPendingStudentData(uid);
        const studentName = (pendingData && pendingData.name) ? pendingData.name : '';
        ActivityLog.renderWaitingRoom(uid, studentName);
        return;
      }

      if (approvalStatus === 'declined') {
        // Student was declined — show declined state and sign out
        if (window.VtxLoader) window.VtxLoader.done();
        const declinedData = await ActivityLog.getDeclinedStudentData(uid);
        const reason = (declinedData && declinedData.reason) ? declinedData.reason : '';
        // Sign out in background, show declined overlay
        window.fbAuth.signOut().catch(function () {});
        ActivityLog._showDeclinedOverlay(reason);
        return;
      }

      // ── Normal approved student path ──
      const snap = await window.fbDb.collection('students').doc(uid).get();

      if (!snap.exists) {
        if (window.VtxLoader) window.VtxLoader.done();
        UI.toast('Profile not found. Please register again.', 'error', 0);
        if (window.DM && typeof DM.cancelListeners === 'function') {
          await DM.cancelListeners();
        }
        await _teardownAndSignOut();
        return;
      }

      AppState.studentData = snap.data();
      AppState.chatUnread  = 0;

      // ── ACTIVITY LOG: login ──
      if (window.ActivityLog) {
        var _sd = AppState.studentData;
        ActivityLog.track(
          'login',
          (_sd.name || 'A student') + ' logged in',
          { deviceInfo: navigator.userAgent.slice(0, 120) }
        );
      }

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

      if (window.Game && typeof Game._startChallengeListener === 'function') {
        Game._startChallengeListener();
      }

      if (window.GroupChat && typeof GroupChat.initStudentGroupListener === 'function') {
        GroupChat.initStudentGroupListener(uid);
      }

      if (window.GroupChat && typeof GroupChat.initPresence === 'function') {
        GroupChat.initPresence(uid);
      }

      if (window.VtxLoader) window.VtxLoader.progress(90, 'Almost ready…');
      if (window.VtxSound) {
        try { VtxSound.welcome(); } catch (e) {}
      }
      await Exam.loadOrStart();
      // ── Start session reminders ──
      if (window.SessionReminders) {
        SessionReminders.start();
      }
      // ── Sync push notification state ──
      if (window.Notifications) {
        Notifications.init().catch(function (e) {
          console.warn('[app] Notifications.init error:', e);
        });
      }
      if (window.VtxLoader) window.VtxLoader.done();

    } catch (err) {
      console.error('[app] Profile load error:', err);
      if (window.VtxLoader) window.VtxLoader.done();
      UI.toast('Could not load your profile. Please check your internet connection and try again.', 'error', 0);
      if (window.DM && typeof DM.cancelListeners === 'function') {
        await DM.cancelListeners();
      }
      await _teardownAndSignOut();
    }
  }

  // ── Shared teardown ──────────────────────────────────────────
  async function _teardownAndSignOut() {
    _loggingOut = true;
    Tasks.cancelListeners();
    AppState.cancelAllListeners();
    AppState.reset();
    try {
      await window.fbAuth.signOut();
    } catch (e) {
      console.warn('[app] signOut error:', e);
    }
    setTimeout(function () {
      _authResolved = false;
      _loggingOut   = false;
    }, 500);
  }

  // ── Public logout ────────────────────────────────────────────
  async function logout() {
    if (_loggingOut) return;
    _loggingOut = true;

    window._registrationInProgress = false;

    // ── ACTIVITY LOG: logout — must be BEFORE AppState.reset() ──
    if (window.ActivityLog && AppState.userId && AppState.studentData) {
      var _logUid    = AppState.userId;
      var _logName   = (AppState.studentData || {}).name   || 'Unknown';
      var _logClass  = (AppState.studentData || {}).class  || '';
      var _logSchool = (AppState.studentData || {}).school || '';
      ActivityLog.trackLogout(_logUid, _logName, _logClass, _logSchool);
    }

    if (window.MsgNotif) {
      MsgNotif.cancel();
    }

    if (window.DM && typeof DM.cancelListeners === 'function') {
      await DM.cancelListeners().catch(e =>
        console.warn('[app] DM.cancelListeners error on logout:', e)
      );
    }

    // Cancel approval gate listener (teacher only — no-op for students)
    if (window.ActivityLog && typeof ActivityLog.cancelTeacherApprovalListener === 'function') {
      ActivityLog.cancelTeacherApprovalListener();
    }

    // Cancel waiting room listener if student was in waiting room
    if (window.ActivityLog && typeof ActivityLog._cancelWaitingRoomListener === 'function') {
      ActivityLog._cancelWaitingRoomListener();
    }

    Tasks.cancelListeners();
    AppState.cancelAllListeners();
    if (window.Game && typeof Game._stopChallengeListener === 'function') {
      Game._stopChallengeListener();
    }
    if (window.GroupChat && typeof GroupChat.cancelListeners === 'function') {
      GroupChat.cancelListeners();
    }
    if (window.SpeechEngine) SpeechEngine.cancel();

    AppState.reset();
    if (window.SessionReminders) {
      SessionReminders.stop();
    }

    try {
      await window.fbAuth.signOut();
    } catch (e) {
      console.warn('[app] signOut error (non-fatal):', e);
    }

    if (window.VtxLoader) window.VtxLoader.done();

    if (window.Landing && typeof Landing.render === 'function') {
      Landing.render();
    } else {
      Auth.renderLogin();
    }

    setTimeout(function () {
      _authResolved = false;
      _loggingOut   = false;
    }, 500);
  }

  // ── Internal logout (cold start, no user signed in) ─────────
  async function _onLogout() {
    _loggingOut = true;

    window._registrationInProgress = false;

    if (window.MsgNotif) MsgNotif.cancel();

    if (window.DM && typeof DM.cancelListeners === 'function') {
      await DM.cancelListeners().catch(e =>
        console.warn('[app] DM.cancelListeners error on logout:', e)
      );
    }

    Tasks.cancelListeners();
    AppState.reset();
    if (window.SessionReminders) {
      SessionReminders.stop();
    }

    if (window.Game && typeof Game._stopChallengeListener === 'function') {
      Game._stopChallengeListener();
    }
    if (window.GroupChat && typeof GroupChat.cancelListeners === 'function') {
      GroupChat.cancelListeners();
    }
    if (window.SpeechEngine) SpeechEngine.cancel();

    if (window.VtxLoader) window.VtxLoader.done();

    if (window.Landing && typeof Landing.render === 'function') {
      Landing.render();
    } else {
      Auth.renderLogin();
    }

    setTimeout(function () {
      _authResolved = false;
      _loggingOut   = false;
    }, 500);
  }

  function _registerGlobalErrorHandlers() {
    window.addEventListener('unhandledrejection', function (event) {
      console.error('[app] Unhandled promise rejection:', event.reason);
    });
  }

  // ── Public API ────────────────────────────────────────────────
  window.App = { logout: logout };

}());
