/* ============================================================
   js/activitylog.js — Student Activity Logger
   Fire-and-forget writes to Firestore. Never throws.
   ============================================================ */

(function () {
  'use strict';

  // Debounce map: prevents duplicate events within 3 seconds
  // key: uid + action, value: last timestamp
  const _debounceMap = {};
  const DEBOUNCE_MS  = 3000;

  // Rate limiter: max 30 writes per student per minute
  const _rateMap  = {};
  const RATE_LIMIT = 30;
  const RATE_MS    = 60000;

  function _canWrite(uid, action) {
    const key = uid + '|' + action;
    const now = Date.now();

    // Debounce: skip if same action fired within 3 seconds
    if (_debounceMap[key] && (now - _debounceMap[key]) < DEBOUNCE_MS) {
      return false;
    }
    _debounceMap[key] = now;

    // Rate limit per student
    if (!_rateMap[uid]) _rateMap[uid] = [];
    _rateMap[uid] = _rateMap[uid].filter(function (t) { return now - t < RATE_MS; });
    if (_rateMap[uid].length >= RATE_LIMIT) return false;
    _rateMap[uid].push(now);

    return true;
  }

  /**
   * Track a student action.
   * @param {string} action  - Machine-readable key e.g. 'login', 'exam_start'
   * @param {string} detail  - Human-readable sentence shown in the teacher feed
   * @param {object} [extra] - Optional extra fields merged into the document
   */
  function track(action, detail, extra) {
    // Must have Firebase and a logged-in student
    if (!window.fbDb || !window.AppState) return;

    var state = window.AppState;
    var uid   = state.userId;

    // Never log the teacher
    if (!uid || uid === (window.AppConfig && AppConfig.TEACHER_UID)) return;

    if (!_canWrite(uid, action)) return;

    var studentData = state.studentData || {};
    var name        = studentData.name   || 'Unknown';
    var cls         = studentData.class  || '';
    var school      = studentData.school || '';

    // TTL: auto-expire after 7 days (configure Firestore TTL policy on field 'ttl')
    var ttl = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    var doc = {
      uid:       uid,
      name:      name,
      class:     cls,
      school:    school,
      action:    action,
      detail:    detail,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      ttl:       ttl,
    };

    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach(function (k) { doc[k] = extra[k]; });
    }

    // Fire and forget — never await, never throw to caller
    window.fbDb.collection('activityLog').add(doc).catch(function (err) {
      console.warn('[ActivityLog] Write failed (non-fatal):', err);
    });
  }

  /**
   * Special: log logout using a direct write (called just before signOut,
   * when AppState is about to be cleared). Caller must pass name/class/school
   * explicitly because AppState.reset() may have already run.
   */
  function trackLogout(uid, name, cls, school) {
    if (!window.fbDb || !uid) return;
    if (uid === (window.AppConfig && AppConfig.TEACHER_UID)) return;

    var ttl = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    window.fbDb.collection('activityLog').add({
      uid:       uid,
      name:      name      || 'Unknown',
      class:     cls       || '',
      school:    school    || '',
      action:    'logout',
      detail:    (name || 'A student') + ' logged out',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      ttl:       ttl,
    }).catch(function (err) {
      console.warn('[ActivityLog] Logout write failed (non-fatal):', err);
    });
  }

  window.ActivityLog = { track: track, trackLogout: trackLogout };

}());