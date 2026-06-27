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
  let _sessionToken        = 0;
  let _authResolved        = false;
  let _offlineTimer        = null;
  let _slowNetTimer        = null;
  let _cacheBootRetry      = null;
  let _loggingOut          = false;
  let _cacheBootInProgress = false;

  function _cancelPendingTimers() {
    if (_offlineTimer   !== null) { clearTimeout(_offlineTimer);   _offlineTimer   = null; }
    if (_slowNetTimer   !== null) { clearTimeout(_slowNetTimer);   _slowNetTimer   = null; }
    if (_cacheBootRetry !== null) { clearTimeout(_cacheBootRetry); _cacheBootRetry = null; }
  }

  function _startAuthListener() {
    if (window.VtxLoader) window.VtxLoader.progress(30, 'Checking session…');

    if (!navigator.onLine) {
      _offlineTimer = setTimeout(function () {
        _offlineTimer = null;
        if (!_authResolved && !_cacheBootInProgress) _tryBootFromCache(_sessionToken);
      }, 800);
    }

    window.fbAuth.onAuthStateChanged(async function (firebaseUser) {
      if (_authResolved)        return;
      if (_loggingOut)          return;
      if (_cacheBootInProgress) return;

      _authResolved = true;
      _cancelPendingTimers();

      if (firebaseUser) {
        if (window._registrationInProgress) return;
        await _onLogin(firebaseUser);
      } else {
        await _onLogout();
      }
    });

    _slowNetTimer = setTimeout(function () {
      _slowNetTimer = null;
      if (!_authResolved && !_cacheBootInProgress) {
        console.warn('[app] Firebase Auth taking too long — attempting cache boot.');
        _tryBootFromCache(_sessionToken);
      }
    }, 5000);
  }

  // ── Boot from IndexedDB cache ────────────────────────────────
  async function _tryBootFromCache(token) {
    if (token !== _sessionToken) return;
    if (_authResolved) return;
    _cacheBootInProgress = true;

    if (!window.LocalDB) {
      _cacheBootRetry = setTimeout(function () {
        _cacheBootRetry      = null;
        _cacheBootInProgress = false;
        _tryBootFromCache(token);
      }, 300);
      return;
    }

    try {
      const allProfiles = await LocalDB.getAll(LocalDB.STORES.STUDENT_PROFILE);

      if (token !== _sessionToken || _authResolved) {
        _cacheBootInProgress = false;
        return;
      }

      if (!allProfiles || allProfiles.length === 0) {
        _cacheBootInProgress = false;
        if (window.VtxLoader) window.VtxLoader.done();
        _renderOfflineNoCache();
        return;
      }

      const latest = allProfiles
        .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0];

      if (!latest || !latest.uid || !latest.data) {
        _cacheBootInProgress = false;
        if (window.VtxLoader) window.VtxLoader.done();
        _renderOfflineNoCache();
        return;
      }

      if (token !== _sessionToken || _authResolved) {
        _cacheBootInProgress = false;
        return;
      }

      _authResolved        = true;
      _cacheBootInProgress = false;

      console.log('[app] Booting from cached profile for uid:', latest.uid);
      await _onLoginFromCache(latest.uid, latest.data);

    } catch (err) {
      console.warn('[app] Cache boot failed:', err);
      _cacheBootInProgress = false;
      if (!_authResolved && token === _sessionToken) {
        if (window.VtxLoader) window.VtxLoader.done();
        _renderOfflineNoCache();
      }
    }
  }

  // ── Load the student dashboard using only cached data ────────
  async function _onLoginFromCache(uid, studentData) {
    AppState.cancelAllListeners();
    AppState.reset();

    AppState.userId      = uid;
    AppState.studentData = studentData;
    AppState.isTeacher   = false;
    AppState.chatUnread  = 0;

    if (window.LocalDB) {
      LocalDB.init().catch((e) => console.warn('[app] LocalDB init error (non-fatal):', e));
    }
    if (window.SyncManager) {
      SyncManager.init();
    }

    if (window.VtxLoader) window.VtxLoader.progress(60, 'Loading from device…');

    await _loadOfflineCoachingTasks(uid);

    await Tasks.listenForStudentUpdates().catch((err) => {
      console.warn('[app] Tasks listener error (offline, non-fatal):', err);
    });

    if (window.VtxLoader) window.VtxLoader.progress(85, 'Almost ready…');

    if (!AppState.studentData || !AppState.userId) {
      console.warn('[app] AppState lost during offline boot — aborting.');
      if (window.VtxLoader) window.VtxLoader.done();
      _renderOfflineNoCache();
      return;
    }

    await Exam.loadOrStart().catch((err) => {
      console.warn('[app] Exam loadOrStart error (offline, non-fatal):', err);
    });

    if (window.VtxLoader) window.VtxLoader.done();

    window.addEventListener('online', function _onReconnect() {
      window.removeEventListener('online', _onReconnect);
      console.log('[app] Connection restored — refreshing session from server.');

      _authResolved = false;

      if (window.SyncManager) SyncManager.syncAll();

      const currentUser = window.fbAuth.currentUser;
      if (currentUser) {
        _onLogin(currentUser).catch(console.error);
      } else {
        const unsub = window.fbAuth.onAuthStateChanged(function (user) {
          unsub();
          if (user) _onLogin(user).catch(console.error);
        });
      }
    });
  }

  // ── Offline coaching task loader ─────────────────────────────
  async function _loadOfflineCoachingTasks(uid) {
    if (!window.LocalDB || !window.Tasks) return;

    const classStr   = (AppState.studentData || {}).class || '';
    const classKey   = Tasks._classDocId(classStr);
    const studentKey = uid ? Tasks._studentDocId(uid) : null;

    const keys = ['global', classKey, 'weekly', 'weekly_' + classKey];
    if (studentKey) {
      keys.push(studentKey);
      keys.push('weekly_' + studentKey);
    }

    const docs = { global: null, class: null, student: null, weekly: null, weeklyClass: null, weeklyStudent: null };
    const keyMap = {
      global:                 'global',
      [classKey]:             'class',
      'weekly':               'weekly',
      ['weekly_' + classKey]: 'weeklyClass',
    };
    if (studentKey) {
      keyMap[studentKey]             = 'student';
      keyMap['weekly_' + studentKey] = 'weeklyStudent';
    }

    try {
      await Promise.all(keys.map(async (key) => {
        try {
          const data = await LocalDB.getCoachingTask(key);
          if (data && keyMap[key]) docs[keyMap[key]] = data;
        } catch (_) {}
      }));
    } catch (e) {
      console.warn('[app] _loadOfflineCoachingTasks error (non-fatal):', e);
      return;
    }

    if (window.Tasks && typeof Tasks._resolveTask === 'function') {
      const _expand = (doc) => doc && typeof Tasks._expandTaskDoc === 'function'
        ? Tasks._expandTaskDoc(doc)
        : null;

      const studentExp     = _expand(docs.student);
      const weeklyStudExp  = _expand(docs.weeklyStudent);
      const classExp       = _expand(docs.class);
      const weeklyClassExp = _expand(docs.weeklyClass);
      const weeklyExp      = _expand(docs.weekly);
      const globalExp      = _expand(docs.global);

      const resolved =
        (studentExp     && studentExp.active     ? studentExp     : null) ||
        (weeklyStudExp  && weeklyStudExp.active   ? weeklyStudExp  : null) ||
        (classExp       && classExp.active        ? classExp       : null) ||
        (weeklyClassExp && weeklyClassExp.active  ? weeklyClassExp : null) ||
        (weeklyExp      && weeklyExp.active       ? weeklyExp      : null) ||
        (globalExp      && globalExp.active       ? globalExp      : null) ||
        { active: false };

      if (!AppState.currentTaskConfig || !AppState.currentTaskConfig.active) {
        AppState.currentTaskConfig = resolved;
        console.log('[app] Offline task config loaded from LocalDB:', resolved.active ? resolved.title : 'none active');
      }
    }
  }

  function _renderOfflineNoCache() {
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = `
      <div style="
        max-width: 360px;
        margin: 6rem auto;
        text-align: center;
        padding: 2rem 1.5rem;
        font-family: var(--font, system-ui, sans-serif);
      ">
        <div style="font-size: 3rem; margin-bottom: 1rem;">📡</div>
        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text-1, #111);
                   margin-bottom: 0.75rem;">You're offline</h2>
        <p style="font-size: 0.9rem; color: var(--text-3, #666); line-height: 1.6;
                  margin-bottom: 1.5rem;">
          Please connect to the internet to sign in for the first time on this device.
          Once you've signed in once, you can use the app offline.
        </p>
        <div style="width: 8px; height: 8px; border-radius: 50%;
                    background: #e53e3e; display: inline-block; margin-right: 6px;"></div>
        <span style="font-size: 0.8rem; color: #e53e3e; font-weight: 600;">No connection</span>
      </div>`;

    window.addEventListener('online', function _onBack() {
      window.removeEventListener('online', _onBack);
      console.log('[app] Connection restored after offline-no-cache — reloading auth.');
      _authResolved        = false;
      _cacheBootInProgress = false;
      _sessionToken++;
      if (window.VtxLoader) window.VtxLoader.progress(10, 'Connecting…');
      _startAuthListener();
    });
  }

  async function _onLogin(firebaseUser) {
    var uid = firebaseUser.uid;
    AppState.cancelAllListeners();
    AppState.userId = uid;

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
      let studentData = null;

      if (window.LocalDB) {
        try {
          studentData = await LocalDB.getStudentProfile(uid);
        } catch (e) {
          console.warn('[app] LocalDB profile read failed:', e);
        }
      }

      if (navigator.onLine) {
        try {
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
          studentData = snap.data();
          if (window.SyncManager) {
            SyncManager.cacheStudentProfile(uid, studentData).catch(() => {});
          }
        } catch (networkErr) {
          console.warn('[app] Firebase profile fetch failed — using local copy:', networkErr);
          if (!studentData) {
            if (window.VtxLoader) window.VtxLoader.done();
            UI.toast('Could not load your profile. Please check your connection and try again.', 'error', 0);
            await _teardownAndSignOut();
            return;
          }
          console.log('[app] Using cached profile for uid:', uid);
          UI.toast('Offline mode — loaded your cached profile.', 'info', 4000);
        }
      } else if (!studentData) {
        if (window.VtxLoader) window.VtxLoader.done();
        UI.toast('You are offline and no cached profile was found. Please connect and try again.', 'error', 0);
        await _teardownAndSignOut();
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

      // Start challenge listener at login so popup notifications fire
      // immediately whenever a challenge arrives — even outside the game.
      if (window.Game && typeof Game._startChallengeListener === 'function') {
        Game._startChallengeListener();
      }

      // Start group chat unread listener so the badge updates in real time.
      if (window.GroupChat && typeof GroupChat.initStudentGroupListener === 'function') {
        GroupChat.initStudentGroupListener(uid);
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
      await _teardownAndSignOut();
    }
  }

  // ── Shared teardown ──────────────────────────────────────────
  async function _teardownAndSignOut() {
    _loggingOut = true;
    Tasks.cancelListeners();
    AppState.cancelAllListeners();
    AppState.reset();
    if (window.SyncManager) SyncManager.destroy();
    try {
      await window.fbAuth.signOut();
    } catch (e) {
      console.warn('[app] signOut error:', e);
    }
    setTimeout(function () {
      _authResolved        = false;
      _cacheBootInProgress = false;
      _loggingOut          = false;
    }, 500);
  }

  // ── Public logout ────────────────────────────────────────────
  async function logout() {
    if (_loggingOut) return;
    _loggingOut = true;

    _sessionToken++;
    _cancelPendingTimers();

    window._registrationInProgress = false;

    if (window.MsgNotif) {
      MsgNotif.cancel();
    }

    if (window.DM && typeof DM.cancelListeners === 'function') {
      await DM.cancelListeners().catch(e =>
        console.warn('[app] DM.cancelListeners error on logout:', e)
      );
    }

    Tasks.cancelListeners();
  AppState.cancelAllListeners();
  if (window.Game && typeof Game._stopChallengeListener === 'function') {
    Game._stopChallengeListener();
  }

    if (window.SyncManager) {
      SyncManager.destroy();
    }

    AppState.reset();

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
      _authResolved        = false;
      _cacheBootInProgress = false;
      _loggingOut          = false;
    }, 500);
  }

  // ── Internal logout (cold start, no user signed in) ─────────
  async function _onLogout() {
    _loggingOut = true;

    _sessionToken++;
    _cancelPendingTimers();

    window._registrationInProgress = false;

    if (window.MsgNotif) MsgNotif.cancel();

    if (window.DM && typeof DM.cancelListeners === 'function') {
      await DM.cancelListeners().catch(e =>
        console.warn('[app] DM.cancelListeners error on logout:', e)
      );
    }

    if (window.SyncManager) SyncManager.destroy();

    Tasks.cancelListeners();
    AppState.reset();
    
    if (window.Game && typeof Game._stopChallengeListener === 'function') {
    Game._stopChallengeListener();
  }
  if (window.GroupChat && typeof GroupChat.cancelListeners === 'function') {
    GroupChat.cancelListeners();
  }

    if (window.VtxLoader) window.VtxLoader.done();

    if (window.Landing && typeof Landing.render === 'function') {
      Landing.render();
    } else {
      Auth.renderLogin();
    }

    setTimeout(function () {
      _authResolved        = false;
      _cacheBootInProgress = false;
      _loggingOut          = false;
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
