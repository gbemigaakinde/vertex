/* ============================================================
   js/offline-queue.js — Offline operation queue
   
   Wraps common Firestore write operations so they:
   1. Always write to IndexedDB (local, instant)
   2. Attempt Firebase write immediately if online
   3. Fall back to the queue for retry if Firebase fails
   
   This file is a THIN SHIM. It does not replace Firebase.
   It adds a local-first safety net around writes.
   ============================================================ */

(function () {
  'use strict';

  function _isOnline() {
    return navigator.onLine !== false;
  }

  function _db() {
    return window.fbDb;
  }

  /* ── Core queued write ─────────────────────────────────── */

  /**
   * Write-through: attempt Firebase immediately; queue on failure.
   * Returns the local queue ID for tracking.
   */
  async function writeWithFallback(operation, collection, docId, data, priority) {
    priority = priority || 5;

    // Always persist locally first
    let queueId;
    try {
      queueId = await LocalDB.enqueue(operation, collection, docId, data, priority);
    } catch (e) {
      console.warn('[OfflineQueue] Could not enqueue locally:', e);
    }

    // Attempt Firebase immediately if online
    if (_isOnline()) {
      try {
        await _executeFirestore(operation, collection, docId, data);
        if (queueId) await LocalDB.markQueueItemSynced(queueId);
        return { success: true, queued: false };
      } catch (err) {
        console.warn('[OfflineQueue] Firebase write failed, item remains queued:', err.message);
        return { success: false, queued: true, queueId };
      }
    }

    return { success: false, queued: true, queueId };
  }

  /**
   * Execute a Firestore operation from a queue item descriptor.
   */
  async function _executeFirestore(operation, collection, docId, data) {
    const db = _db();
    if (!db) throw new Error('Firestore not available');

    switch (operation) {
      case 'set':
        return db.collection(collection).doc(docId).set(data);

      case 'set_merge':
        return db.collection(collection).doc(docId).set(data, { merge: true });

      case 'update':
        return db.collection(collection).doc(docId).update(data);

      case 'add':
        return db.collection(collection).add(data);

      case 'delete':
        return db.collection(collection).doc(docId).delete();

      case 'batch': {
        // data is an array of { op, collection, docId, payload }
        const batch = db.batch();
        (data || []).forEach(({ op, collection: col, docId: dId, payload, merge }) => {
          const ref = db.collection(col).doc(dId);
          if (op === 'set')    batch.set(ref, payload, merge ? { merge: true } : undefined);
          if (op === 'update') batch.update(ref, payload);
          if (op === 'delete') batch.delete(ref);
        });
        return batch.commit();
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /* ── Convenience wrappers ──────────────────────────────── */

  async function queueSet(collection, docId, data, priority) {
    return writeWithFallback('set', collection, docId, data, priority);
  }

  async function queueSetMerge(collection, docId, data, priority) {
    return writeWithFallback('set_merge', collection, docId, data, priority);
  }

  async function queueUpdate(collection, docId, data, priority) {
    return writeWithFallback('update', collection, docId, data, priority);
  }

  async function queueDelete(collection, docId, priority) {
    return writeWithFallback('delete', collection, docId, null, priority);
  }

  async function queueBatch(operations, priority) {
    return writeWithFallback('batch', '__batch__', '__batch__', operations, priority);
  }

  async function queueAdd(collection, data, priority) {
    return writeWithFallback('add', collection, null, data, priority);
  }

  /* ── Manual retry of a queued item ────────────────────── */

  async function retryItem(item) {
    try {
      await _executeFirestore(item.operation, item.collection, item.docId, item.data);
      await LocalDB.markQueueItemSynced(item.queueId);
      return true;
    } catch (err) {
      await LocalDB.markQueueItemFailed(item.queueId, err.message);
      return false;
    }
  }

  /* ── Public API ────────────────────────────────────────── */

  window.OfflineQueue = {
    writeWithFallback,
    queueSet,
    queueSetMerge,
    queueUpdate,
    queueDelete,
    queueBatch,
    queueAdd,
    retryItem,
    _executeFirestore, // exposed for SyncManager
  };

}());
