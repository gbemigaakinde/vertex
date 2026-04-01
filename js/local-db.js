/* ============================================================
   js/local-db.js — IndexedDB wrapper for offline-first data
   
   Provides typed CRUD operations for all app data stores.
   All operations are Promise-based. Errors are caught and
   logged; they do NOT propagate to crash the app — Firebase
   remains the authoritative fallback.
   ============================================================ */

(function () {
  'use strict';

  const DB_NAME    = 'vtx_offline_db';
  const DB_VERSION = 1;

  const STORES = {
    STUDENT_PROFILE:  'student_profile',
    EXAM_SESSIONS:    'exam_sessions',
    EXAM_RESULTS:     'exam_results',
    COACHING_TASKS:   'coaching_tasks',
    LESSONS:          'lessons',
    DM_THREADS:       'dm_threads',
    DM_MESSAGES:      'dm_messages',
    OFFLINE_QUEUE:    'offline_queue',
    APP_METADATA:     'app_metadata',
  };

  let _db = null;
  let _initPromise = null;

  /* ── Open / upgrade DB ─────────────────────────────────── */

  function _open() {
    if (_initPromise) return _initPromise;

    _initPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (event) => {
        const db = event.target.result;

        // student_profile
        if (!db.objectStoreNames.contains(STORES.STUDENT_PROFILE)) {
          db.createObjectStore(STORES.STUDENT_PROFILE, { keyPath: 'uid' });
        }

        // exam_sessions
        if (!db.objectStoreNames.contains(STORES.EXAM_SESSIONS)) {
          db.createObjectStore(STORES.EXAM_SESSIONS, { keyPath: 'uid' });
        }

        // exam_results
        if (!db.objectStoreNames.contains(STORES.EXAM_RESULTS)) {
          const rs = db.createObjectStore(STORES.EXAM_RESULTS, { keyPath: 'localId' });
          rs.createIndex('by_uid',    'uid',    { unique: false });
          rs.createIndex('by_synced', 'synced', { unique: false });
        }

        // coaching_tasks
        if (!db.objectStoreNames.contains(STORES.COACHING_TASKS)) {
          db.createObjectStore(STORES.COACHING_TASKS, { keyPath: 'docId' });
        }

        // lessons
        if (!db.objectStoreNames.contains(STORES.LESSONS)) {
          const ls = db.createObjectStore(STORES.LESSONS, { keyPath: 'id' });
          ls.createIndex('by_class', 'class', { unique: false });
        }

        // dm_threads
        if (!db.objectStoreNames.contains(STORES.DM_THREADS)) {
          db.createObjectStore(STORES.DM_THREADS, { keyPath: 'uid' });
        }

        // dm_messages
        if (!db.objectStoreNames.contains(STORES.DM_MESSAGES)) {
          const ms = db.createObjectStore(STORES.DM_MESSAGES, { keyPath: 'localId' });
          ms.createIndex('by_thread', 'threadUid', { unique: false });
          ms.createIndex('by_synced', 'synced',    { unique: false });
        }

        // offline_queue
        if (!db.objectStoreNames.contains(STORES.OFFLINE_QUEUE)) {
          const qs = db.createObjectStore(STORES.OFFLINE_QUEUE, {
            keyPath:       'queueId',
            autoIncrement: true,
          });
          qs.createIndex('by_synced',   'synced',    { unique: false });
          qs.createIndex('by_priority', 'priority',  { unique: false });
        }

        // app_metadata
        if (!db.objectStoreNames.contains(STORES.APP_METADATA)) {
          db.createObjectStore(STORES.APP_METADATA, { keyPath: 'key' });
        }
      };

      req.onsuccess = (event) => {
        _db = event.target.result;
        _db.onerror = (err) => console.error('[LocalDB] Database error:', err);
        resolve(_db);
      };

      req.onerror = (event) => {
        console.error('[LocalDB] Open failed:', event.target.error);
        reject(event.target.error);
      };

      req.onblocked = () => {
        console.warn('[LocalDB] Open blocked — another tab may have an older version open.');
      };
    });

    return _initPromise;
  }

  /* ── Low-level transaction helpers ────────────────────── */

  async function _tx(storeName, mode, fn) {
    try {
      const db = await _open();
      return new Promise((resolve, reject) => {
        const tx    = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req   = fn(store);

        if (req && typeof req.onsuccess !== 'undefined') {
          req.onsuccess = () => resolve(req.result);
          req.onerror   = () => reject(req.error);
        } else {
          tx.oncomplete = () => resolve(req);
          tx.onerror    = () => reject(tx.error);
        }
      });
    } catch (err) {
      console.error(`[LocalDB] Transaction error on "${storeName}" (${mode}):`, err);
      throw err;
    }
  }

  async function _txMulti(storeNames, mode, fn) {
    try {
      const db = await _open();
      return new Promise((resolve, reject) => {
        const tx     = db.transaction(storeNames, mode);
        const result = fn(tx);
        tx.oncomplete = () => resolve(result);
        tx.onerror    = () => reject(tx.error);
        tx.onabort    = () => reject(new Error('Transaction aborted'));
      });
    } catch (err) {
      console.error('[LocalDB] Multi-store transaction error:', err);
      throw err;
    }
  }

  /* ── Generic CRUD ──────────────────────────────────────── */

  async function get(storeName, key) {
    return _tx(storeName, 'readonly', (store) => store.get(key));
  }

  async function getAll(storeName) {
    return _tx(storeName, 'readonly', (store) => store.getAll());
  }

  async function put(storeName, record) {
    return _tx(storeName, 'readwrite', (store) => store.put(record));
  }

  async function remove(storeName, key) {
    return _tx(storeName, 'readwrite', (store) => store.delete(key));
  }

  async function getByIndex(storeName, indexName, value) {
    try {
      const db = await _open();
      return new Promise((resolve, reject) => {
        const tx    = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const req   = index.getAll(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
      });
    } catch (err) {
      console.error('[LocalDB] getByIndex error:', err);
      return [];
    }
  }

  async function clear(storeName) {
    return _tx(storeName, 'readwrite', (store) => store.clear());
  }

  /* ── Typed helpers: Student Profile ───────────────────── */

  async function saveStudentProfile(uid, data) {
    return put(STORES.STUDENT_PROFILE, {
      uid,
      data,
      savedAt:  Date.now(),
      isDirty:  false,
    });
  }

  async function getStudentProfile(uid) {
    const rec = await get(STORES.STUDENT_PROFILE, uid);
    return rec ? rec.data : null;
  }

  /* ── Typed helpers: Exam Session ───────────────────────── */

  async function saveExamSession(uid, examData) {
    return put(STORES.EXAM_SESSIONS, {
      uid,
      examData,
      savedAt: Date.now(),
      synced:  false,
    });
  }

  async function getExamSession(uid) {
    const rec = await get(STORES.EXAM_SESSIONS, uid);
    return rec ? rec.examData : null;
  }

  async function updateExamAnswers(uid, answers) {
    const rec = await get(STORES.EXAM_SESSIONS, uid);
    if (!rec) return;
    rec.examData         = rec.examData || {};
    rec.examData.answers = answers;
    rec.savedAt          = Date.now();
    rec.synced           = false;
    return put(STORES.EXAM_SESSIONS, rec);
  }

  async function updateExamStartTime(uid, startTime) {
    const rec = await get(STORES.EXAM_SESSIONS, uid);
    if (!rec) return;
    rec.examData              = rec.examData || {};
    rec.examData.startTime    = startTime;
    rec.savedAt               = Date.now();
    return put(STORES.EXAM_SESSIONS, rec);
  }

  async function clearExamSession(uid) {
    return remove(STORES.EXAM_SESSIONS, uid);
  }

  /* ── Typed helpers: Exam Results ───────────────────────── */

  function _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  async function saveExamResult(uid, resultData, questionSnapshots, sessionDate) {
    const localId = _uuid();
    return put(STORES.EXAM_RESULTS, {
      localId,
      uid,
      resultData,
      questionSnapshots,
      sessionDate,
      synced:    false,
      createdAt: Date.now(),
      error:     null,
    });
  }

  async function getUnsynedResults() {
    return getByIndex(STORES.EXAM_RESULTS, 'by_synced', false);
  }

  async function markResultSynced(localId) {
    const rec = await get(STORES.EXAM_RESULTS, localId);
    if (!rec) return;
    rec.synced   = true;
    rec.syncedAt = Date.now();
    return put(STORES.EXAM_RESULTS, rec);
  }

  async function markResultError(localId, errorMsg) {
    const rec = await get(STORES.EXAM_RESULTS, localId);
    if (!rec) return;
    rec.error    = errorMsg;
    rec.attempts = (rec.attempts || 0) + 1;
    return put(STORES.EXAM_RESULTS, rec);
  }

  /* ── Typed helpers: Coaching Tasks ────────────────────── */

  async function saveCoachingTask(docId, data) {
    return put(STORES.COACHING_TASKS, { docId, data, fetchedAt: Date.now() });
  }

  async function getCoachingTask(docId) {
    const rec = await get(STORES.COACHING_TASKS, docId);
    return rec ? rec.data : null;
  }

  /* ── Typed helpers: Lessons ────────────────────────────── */

  async function saveLessons(lessons) {
    const db = await _open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORES.LESSONS, 'readwrite');
      const store = tx.objectStore(STORES.LESSONS);
      const now   = Date.now();
      lessons.forEach((lesson) => {
        store.put({ ...lesson, fetchedAt: now });
      });
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  async function getLessonsByClass(classStr) {
    return getByIndex(STORES.LESSONS, 'by_class', classStr);
  }

  /* ── Typed helpers: DM Messages ────────────────────────── */

  async function saveDMMessage(threadUid, messageData, localId) {
    localId = localId || _uuid();
    return put(STORES.DM_MESSAGES, {
      localId,
      threadUid,
      messageData,
      synced:    false,
      createdAt: Date.now(),
    });
  }

  async function getUnsyncedMessages() {
    return getByIndex(STORES.DM_MESSAGES, 'by_synced', false);
  }

  async function markMessageSynced(localId) {
    const rec = await get(STORES.DM_MESSAGES, localId);
    if (!rec) return;
    rec.synced   = true;
    rec.syncedAt = Date.now();
    return put(STORES.DM_MESSAGES, rec);
  }

  /* ── Typed helpers: Offline Queue ──────────────────────── */

  async function enqueue(operation, collection, docId, data, priority) {
    priority = priority || 5;
    return put(STORES.OFFLINE_QUEUE, {
      operation,   // 'set' | 'update' | 'delete' | 'add' | 'batch'
      collection,
      docId,
      data,
      priority,
      synced:    false,
      attempts:  0,
      createdAt: Date.now(),
      error:     null,
    });
  }

  async function getPendingQueue() {
    const all = await getAll(STORES.OFFLINE_QUEUE);
    return all
      .filter((item) => !item.synced && item.attempts < 5)
      .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);
  }

  async function markQueueItemSynced(queueId) {
    const rec = await get(STORES.OFFLINE_QUEUE, queueId);
    if (!rec) return;
    rec.synced   = true;
    rec.syncedAt = Date.now();
    return put(STORES.OFFLINE_QUEUE, rec);
  }

  async function markQueueItemFailed(queueId, error) {
    const rec = await get(STORES.OFFLINE_QUEUE, queueId);
    if (!rec) return;
    rec.attempts++;
    rec.error    = String(error);
    rec.lastTry  = Date.now();
    return put(STORES.OFFLINE_QUEUE, rec);
  }

  async function clearSyncedQueue() {
    const all = await getAll(STORES.OFFLINE_QUEUE);
    const db  = await _open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORES.OFFLINE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.OFFLINE_QUEUE);
      all.filter((item) => item.synced).forEach((item) => store.delete(item.queueId));
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  /* ── App Metadata ──────────────────────────────────────── */

  async function getMeta(key) {
    const rec = await get(STORES.APP_METADATA, key);
    return rec ? rec.value : null;
  }

  async function setMeta(key, value) {
    return put(STORES.APP_METADATA, { key, value });
  }

  /* ── Initialization ────────────────────────────────────── */

  async function init() {
    try {
      await _open();
      console.log('[LocalDB] IndexedDB ready.');
      return true;
    } catch (err) {
      console.error('[LocalDB] Init failed — offline features degraded:', err);
      return false;
    }
  }

  /* ── Public API ────────────────────────────────────────── */

  window.LocalDB = {
    init,
    STORES,

    // Generic
    get,
    getAll,
    put,
    remove,
    getByIndex,
    clear,

    // Typed
    saveStudentProfile,
    getStudentProfile,

    saveExamSession,
    getExamSession,
    updateExamAnswers,
    updateExamStartTime,
    clearExamSession,

    saveExamResult,
    getUnsynedResults,
    markResultSynced,
    markResultError,

    saveCoachingTask,
    getCoachingTask,

    saveLessons,
    getLessonsByClass,

    saveDMMessage,
    getUnsyncedMessages,
    markMessageSynced,

    enqueue,
    getPendingQueue,
    markQueueItemSynced,
    markQueueItemFailed,
    clearSyncedQueue,

    getMeta,
    setMeta,
  };

}());
