/* ============================================================
   js/sync-manager.js — Background sync engine
   
   Responsibilities:
   - Drain the offline queue when online
   - Push unsynced exam results to Firebase
   - Push unsynced DM messages
   - Seed IndexedDB from Firebase snapshots (read-through cache)
   - Handle retries with exponential back-off
   ============================================================ */

(function () {
  'use strict';

  const SYNC_INTERVAL_MS    = 30_000;  // 30s periodic sync
  const MAX_ATTEMPTS        = 5;
  const BACK_OFF_BASE_MS    = 2_000;

  let _syncTimer     = null;
  let _isSyncing     = false;
  let _initialized   = false;

  /* ── Online/offline detection ──────────────────────────── */

  function _isOnline() { return navigator.onLine !== false; }

  /* ── Init ──────────────────────────────────────────────── */

  function init() {
    if (_initialized) return;
    _initialized = true;

    window.addEventListener('online',  _onOnline);
    window.addEventListener('offline', _onOffline);
    document.addEventListener('visibilitychange', _onVisibilityChange);

    _startPeriodicSync();

    if (_isOnline()) {
      _syncSoon(500);
    }

    console.log('[SyncManager] Initialized.');
  }

  function destroy() {
    window.removeEventListener('online',  _onOnline);
    window.removeEventListener('offline', _onOffline);
    document.removeEventListener('visibilitychange', _onVisibilityChange);
    _stopPeriodicSync();
    _initialized = false;
  }

  /* ── Event handlers ────────────────────────────────────── */

  function _onOnline() {
    console.log('[SyncManager] Connection restored — syncing.');
    _syncSoon(300);
  }

  function _onOffline() {
    console.log('[SyncManager] Went offline — pausing sync.');
    _stopPeriodicSync();
  }

  function _onVisibilityChange() {
    if (document.visibilityState === 'visible' && _isOnline()) {
      _syncSoon(1000);
      _startPeriodicSync();
    }
  }

  /* ── Periodic sync ─────────────────────────────────────── */

  function _startPeriodicSync() {
    if (_syncTimer) return;
    _syncTimer = setInterval(() => {
      if (_isOnline() && !_isSyncing) syncAll();
    }, SYNC_INTERVAL_MS);
  }

  function _stopPeriodicSync() {
    if (_syncTimer) { clearInterval(_syncTimer); _syncTimer = null; }
  }

  let _syncDebounce = null;
  function _syncSoon(delayMs) {
    if (_syncDebounce) clearTimeout(_syncDebounce);
    _syncDebounce = setTimeout(() => { syncAll(); }, delayMs);
  }

  /* ── Main sync orchestrator ────────────────────────────── */

  async function syncAll() {
    if (_isSyncing || !_isOnline()) return;
    _isSyncing = true;

    try {
      await Promise.allSettled([
        _syncExamResults(),
        _syncOfflineQueue(),
        _syncUnsyncedDMMessages(),
      ]);

      await LocalDB.setMeta('lastSync', Date.now());
      console.log('[SyncManager] Sync complete.');
    } catch (err) {
      console.error('[SyncManager] Sync error:', err);
    } finally {
      _isSyncing = false;
    }
  }

  /* ── Sync: Exam Results ────────────────────────────────── */

  async function _syncExamResults() {
    let pending;
    try {
      pending = await LocalDB.getUnsynedResults();
    } catch (e) {
      console.warn('[SyncManager] Could not read unsynced results:', e);
      return;
    }

    if (!pending || pending.length === 0) return;

    console.log(`[SyncManager] Syncing ${pending.length} exam result(s).`);

    for (const item of pending) {
      if (!_isOnline()) break;
      if ((item.attempts || 0) >= MAX_ATTEMPTS) continue;

      try {
        const db      = window.fbDb;
        const batch   = db.batch();
        const ts      = firebase.firestore.FieldValue.serverTimestamp();

        const resultPayload = {
          ...item.resultData,
          questionSnapshots: item.questionSnapshots,
          sessionDate:       item.sessionDate,
          timestamp:         ts,
        };

        batch.set(db.collection('results').doc(), resultPayload);
        batch.delete(db.collection('ongoingExams').doc(item.uid));

        // Mark coaching completed if this was a task day
        if (item.sessionDate && item.taskDay) {
          batch.update(db.collection('students').doc(item.uid), {
            [`coachingCompleted.${item.sessionDate}`]: true,
          });
        }

        await batch.commit();
        await LocalDB.markResultSynced(item.localId);

        console.log(`[SyncManager] Result ${item.localId} synced.`);
      } catch (err) {
        console.warn(`[SyncManager] Result ${item.localId} sync failed:`, err.message);
        await LocalDB.markResultError(item.localId, err.message);
        await _backOff(item.attempts || 0);
      }
    }
  }

  /* ── Sync: Offline Queue ───────────────────────────────── */

  async function _syncOfflineQueue() {
    let queue;
    try {
      queue = await LocalDB.getPendingQueue();
    } catch (e) {
      console.warn('[SyncManager] Could not read queue:', e);
      return;
    }

    if (!queue || queue.length === 0) return;

    console.log(`[SyncManager] Draining ${queue.length} queued operation(s).`);

    for (const item of queue) {
      if (!_isOnline()) break;

      const ok = await OfflineQueue.retryItem(item);
      if (!ok) {
        await _backOff(item.attempts || 0);
      }
    }

    // Clean up successfully synced items
    try {
      await LocalDB.clearSyncedQueue();
    } catch (e) {
      console.warn('[SyncManager] Could not clear synced queue:', e);
    }
  }

  /* ── Sync: DM Messages ─────────────────────────────────── */

  async function _syncUnsyncedDMMessages() {
    let messages;
    try {
      messages = await LocalDB.getUnsyncedMessages();
    } catch (e) {
      console.warn('[SyncManager] Could not read unsynced messages:', e);
      return;
    }

    if (!messages || messages.length === 0) return;

    console.log(`[SyncManager] Syncing ${messages.length} DM message(s).`);

    for (const item of messages) {
      if (!_isOnline()) break;

      try {
        const db  = window.fbDb;
        const msg = item.messageData;

        await db.collection('directMessages')
          .doc(item.threadUid)
          .collection('messages')
          .add({
            ...msg,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          });

        await LocalDB.markMessageSynced(item.localId);
      } catch (err) {
        console.warn(`[SyncManager] DM message ${item.localId} sync failed:`, err.message);
      }
    }
  }

  /* ── Cache seeders (Firebase → IndexedDB) ─────────────── */

  /**
   * Called from tasks.js onSnapshot handlers to cache task docs locally.
   */
  async function cacheCoachingTask(docId, data) {
    try {
      if (data) {
        await LocalDB.saveCoachingTask(docId, data);
      }
    } catch (e) {
      console.warn('[SyncManager] cacheCoachingTask error:', e);
    }
  }

  /**
   * Called from studyroom.js after fetching lessons.
   */
  async function cacheLessons(lessons) {
    try {
      if (lessons && lessons.length > 0) {
        await LocalDB.saveLessons(lessons);
      }
    } catch (e) {
      console.warn('[SyncManager] cacheLessons error:', e);
    }
  }

  /**
   * Called from app.js after loading student profile.
   */
  async function cacheStudentProfile(uid, data) {
    try {
      if (uid && data) {
        await LocalDB.saveStudentProfile(uid, data);
      }
    } catch (e) {
      console.warn('[SyncManager] cacheStudentProfile error:', e);
    }
  }

  /* ── Back-off ──────────────────────────────────────────── */

  function _backOff(attempt) {
    const delay = Math.min(BACK_OFF_BASE_MS * Math.pow(2, attempt), 30_000);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /* ── Status ────────────────────────────────────────────── */

  async function getStatus() {
    const [pending, results, messages, lastSync] = await Promise.allSettled([
      LocalDB.getPendingQueue(),
      LocalDB.getUnsynedResults(),
      LocalDB.getUnsyncedMessages(),
      LocalDB.getMeta('lastSync'),
    ]);
    return {
      queuedOps:       (pending.value  || []).length,
      unsyncedResults: (results.value  || []).length,
      unsyncedMessages:(messages.value || []).length,
      lastSync:         lastSync.value || null,
      isSyncing:        _isSyncing,
      isOnline:         _isOnline(),
    };
  }

  /* ── Public API ────────────────────────────────────────── */

  window.SyncManager = {
    init,
    destroy,
    syncAll,
    cacheCoachingTask,
    cacheLessons,
    cacheStudentProfile,
    getStatus,
  };

}());
