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

  // Track whether auth has already resolved, so the offline
  // fallback and the Firebase callback don't both try to run.
  let _authResolved = false;

  function _startAuthListener() {
    if (window.VtxLoader) window.VtxLoader.progress(30, 'Checking session…');

    // ── Offline-first fast path ──────────────────────────────
    // If the device is offline, Firebase Auth will never call back.
    // Instead of leaving the user on a blank screen, we immediately
    // check IndexedDB for a cached session and boot from that.
    if (!navigator.onLine) {
      _tryBootFromCache();
    }

    // ── Normal Firebase Auth path ────────────────────────────
    // This fires whether online or offline eventually, but offline
    // it may take a long time or never fire. The _authResolved flag
    // ensures only one path wins.
    window.fbAuth.onAuthStateChanged(async function (firebaseUser) {
      if (_authResolved) return;   // offline path already handled it
      _authResolved = true;

      if (firebaseUser) {
        if (window._registrationInProgress) return;
        await _onLogin(firebaseUser);
      } else {
        await _onLogout();
      }
    });

    // ── Slow-connection safety net ───────────────────────────
    // If we're online but Firebase Auth is taking unusually long
    // (slow network, captive portal, etc.), try cache after 5 seconds.
    // This prevents an indefinite blank/spinning state.
    setTimeout(function () {
      if (!_authResolved) {
        console.warn('[app] Firebase Auth taking too long — attempting cache boot.');
        _tryBootFromCache();
      }
    }, 5000);
  }

  // ── Boot from IndexedDB cache (no network needed) ────────────
  async function _tryBootFromCache() {
    if (_authResolved) return;   // Firebase Auth already responded

    // We need LocalDB to be open first
    if (!window.LocalDB) {
      // LocalDB not loaded yet — wait a moment and retry once
      setTimeout(_tryBootFromCache, 300);
      return;
    }

    try {
      // Find the most recently saved student profile in IndexedDB
      const allProfiles = await LocalDB.getAll(LocalDB.STORES.STUDENT_PROFILE);

      if (!allProfiles || allProfiles.length === 0) {
        // No cached profile at all — user has genuinely never logged in
        // on this device. Nothing we can do without a connection.
        if (!navigator.onLine) {
          if (window.VtxLoader) window.VtxLoader.done();
          // Show a friendly message instead of a blank screen
          _renderOfflineNoCache();
        }
        return;
      }

      // Pick the most recently saved profile
      const latest = allProfiles.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0];

      if (!latest || !latest.uid || !latest.data) {
        if (!navigator.onLine) {
          if (window.VtxLoader) window.VtxLoader.done();
          _renderOfflineNoCache();
        }
        return;
      }

      // We have a cached profile — mark auth as resolved so
      // the Firebase callback (if it eventually fires) does nothing
      if (_authResolved) return;
      _authResolved = true;

      console.log('[app] Booting from cached profile for uid:', latest.uid);

      // Boot the app with cached data
      await _onLoginFromCache(latest.uid, latest.data);

    } catch (err) {
      console.warn('[app] Cache boot failed:', err);
      if (!navigator.onLine && !_authResolved) {
        if (window.VtxLoader) window.VtxLoader.done();
        _renderOfflineNoCache();
      }
    }
  }

  // ── Load the student dashboard using only cached data ────────
  async function _onLoginFromCache(uid, studentData) {
    AppState.cancelAllListeners();
    AppState.userId      = uid;
    AppState.studentData = studentData;
    AppState.isTeacher   = false;  // Teacher always needs to be online
    AppState.chatUnread  = 0;

    if (window.LocalDB) {
      LocalDB.init().catch((e) => console.warn('[app] LocalDB init error (non-fatal):', e));
    }
    if (window.SyncManager) {
      SyncManager.init();
    }

    if (window.VtxLoader) window.VtxLoader.progress(60, 'Loading from device…');

    // Load coaching tasks from cache
    await Tasks.listenForStudentUpdates().catch((err) => {
      console.warn('[app] Tasks listener error (offline, non-fatal):', err);
    });

    if (window.VtxLoader) window.VtxLoader.progress(85, 'Almost ready…');

    // Load exam state from cache
    await Exam.loadOrStart().catch((err) => {
      console.warn('[app] Exam loadOrStart error (offline, non-fatal):', err);
    });

    if (window.VtxLoader) window.VtxLoader.done();

    // When connection returns, do a proper Firebase Auth check
    // to refresh the session and pull any server updates
    window.addEventListener('online', function _onReconnect() {
      window.removeEventListener('online', _onReconnect);
      console.log('[app] Connection restored — refreshing session from server.');
      // Force a fresh auth check by reloading auth state
      window.fbAuth.currentUser
        ? _onLogin(window.fbAuth.currentUser).catch(console.error)
        : window.fbAuth.onAuthStateChanged(function onceHandler(user) {
            onceHandler = null;
            if (user) _onLogin(user).catch(console.error);
          });
      if (window.SyncManager) SyncManager.syncAll();
    });
  }

  // ── Friendly screen when offline with no cached data ─────────
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
            if (window.VtxLoader) window.VtxLoader.done();
            UI.toast('Could not load profile. Please check your connection.', 'error', 0);
            return;
          }
        }
      } else if (!studentData) {
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

    // Reset the auth flag so the next login works correctly
    _authResolved = false;

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
