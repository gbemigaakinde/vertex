/* ============================================================
   js/tasks.js — Coaching task management
   Responsibilities:
     - Load and subscribe to coaching tasks from Firestore
     - Subscribe to student profile for completion state
     - Render task UI into #tasksContainer
     - Load private messages for the current student
   ============================================================ */

(function () {
  'use strict';

  /* -------------------------------------------------- */
  /* Private listener handles                           */
  /* -------------------------------------------------- */

  let _tasksUnsubscribe   = null;
  let _studentUnsubscribe = null;

  /* -------------------------------------------------- */
  /* Load coaching tasks (real-time)                    */
  /* Returns a Promise that resolves when the first     */
  /* snapshot arrives (or on error).                    */
  /* -------------------------------------------------- */

  function loadCoachingTasks() {
    return new Promise((resolve) => {
      // Cancel any existing listener before opening a new one
      if (_tasksUnsubscribe) {
        _tasksUnsubscribe();
        _tasksUnsubscribe = null;
      }

      _tasksUnsubscribe = Db()
        .collection('coachingTasks')
        .doc('current')
        .onSnapshot(
          (snap) => {
            // Store under canonical key — exam.js reads AppState.currentTaskConfig
            AppState.currentTaskConfig = snap.exists
              ? snap.data()
              : { active: false };

            // Re-render if the tasks container is currently visible
            if (document.getElementById('tasksContainer')) {
              renderTasksHTML();
            }
            resolve();
          },
          (err) => {
            console.error('[tasks] Failed to load coaching tasks:', err);
            AppState.currentTaskConfig = { active: false };
            resolve();
          }
        );

      AppState.registerListener('coachingTasks', _tasksUnsubscribe);
    });
  }

  /* -------------------------------------------------- */
  /* Listen for student profile updates (real-time)     */
  /* Keeps coachingCompleted state fresh without a      */
  /* full page reload.                                  */
  /* -------------------------------------------------- */

  function listenForStudentUpdates() {
    const uid = AppState.userId;
    if (!uid) return;

    if (_studentUnsubscribe) {
      _studentUnsubscribe();
      _studentUnsubscribe = null;
    }

    _studentUnsubscribe = Db()
      .collection('students')
      .doc(uid)
      .onSnapshot(
        (snap) => {
          if (snap.exists) {
            // Merge into existing studentData rather than replacing wholesale
            AppState.studentData = { ...AppState.studentData, ...snap.data() };
            if (document.getElementById('tasksContainer')) {
              renderTasksHTML();
            }
          }
        },
        (err) => console.error('[tasks] Student update listener error:', err)
      );

    AppState.registerListener('studentProfile', _studentUnsubscribe);
  }

  /* -------------------------------------------------- */
  /* Load private messages for the logged-in student.   */
  /* Stores results in AppState.studentMessages and     */
  /* also returns them for callers that need the array. */
  /*                                                    */
  /* NOTE: The compound query (recipientId + expiresAt) */
  /* requires a Firestore composite index. Create it in */
  /* the Firebase Console:                              */
  /*   Collection: privateMessages                      */
  /*   Fields: recipientId (ASC), expiresAt (ASC)       */
  /* -------------------------------------------------- */

  async function loadStudentMessages() {
    const uid = AppState.userId;
    if (!uid) {
      AppState.studentMessages = [];
      return [];
    }

    try {
      const snap = await Db()
        .collection('privateMessages')
        .where('recipientId', '==', uid)
        .where('expiresAt',   '>',  new Date())
        .orderBy('expiresAt', 'desc')
        .get();

      const messages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      AppState.studentMessages = messages;
      return messages;
    } catch (err) {
      console.error('[tasks] Failed to load private messages:', err);
      // If the composite index is missing, Firestore throws with a link to create it.
      // Log the error — do not crash the UI.
      AppState.studentMessages = [];
      return [];
    }
  }

  /* -------------------------------------------------- */
  /* Render tasks into #tasksContainer.                 */
  /* Safe to call at any time — silently no-ops if the  */
  /* container element does not exist in the DOM.       */
  /* -------------------------------------------------- */

  function renderTasksHTML() {
    const container = document.getElementById('tasksContainer');
    if (!container) return;

    const currentTasks = AppState.currentTaskConfig || {};
    const studentData  = AppState.studentData || {};

    if (!currentTasks.active || !Array.isArray(currentTasks.dates) || currentTasks.dates.length === 0) {
      container.innerHTML = '';
      return;
    }

    const completed = studentData.coachingCompleted || {};
    const allDone   = currentTasks.dates.every(d => completed[d]);

    const datesHTML = currentTasks.dates.map(dateStr => {
      // Parse as local date to avoid UTC-offset issues
      const parts = dateStr.split('-');
      const date  = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      const formatted = date.toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short'
      });
      const isDone = !!completed[dateStr];
      return `
        <div class="glass p-6 rounded-2xl text-center">
          <p class="text-xl font-medium">${_esc(dateStr)}</p>
          <p class="text-lg opacity-70 mb-2">${_esc(formatted)}</p>
          <p class="text-5xl mt-2">${isDone ? '&#10003;' : '&#9675;'}</p>
          <p class="text-sm opacity-70 mt-2">${isDone ? 'Completed' : 'Pending'}</p>
        </div>`;
    }).join('');

    // Safely convert newlines in the message to HTML paragraphs
    const messageSafe = _esc(currentTasks.message || 'Complete the tests on these dates to mark them done!');
    const messageLines = messageSafe.replace(/\n\n/g, '</p><p class="text-lg leading-relaxed mb-4">').replace(/\n/g, '<br>');

    container.innerHTML = `
      <div class="glass-dark p-8 rounded-3xl mb-10 shadow-2xl border-4 border-purple-500/50">
        <h3 class="text-3xl font-bold mb-4 text-purple-700">${_esc(currentTasks.title || 'Coaching Tasks Active!')}</h3>
        <p class="text-lg leading-relaxed mb-6 text-left">${messageLines}</p>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          ${datesHTML}
        </div>
        ${allDone ? '<p class="text-green-600 text-3xl mt-8 font-bold">Amazing! All tasks completed!</p>' : ''}
      </div>`;
  }

  /* -------------------------------------------------- */
  /* Mark today as completed (called after exam submit) */
  /* Exam.js uses a Firestore batch for this — this     */
  /* function is retained as a standalone fallback.     */
  /* -------------------------------------------------- */

  async function markTodayCompleted() {
    const uid          = AppState.userId;
    const currentTasks = AppState.currentTaskConfig;

    if (!uid || !currentTasks || !currentTasks.active || !Array.isArray(currentTasks.dates)) return;

    const todayStr = new Date().toISOString().split('T')[0];
    if (!currentTasks.dates.includes(todayStr)) return;

    try {
      await Db()
        .collection('students')
        .doc(uid)
        .set({ coachingCompleted: { [todayStr]: true } }, { merge: true });
    } catch (err) {
      console.error('[tasks] Failed to mark today as completed:', err);
    }
  }

  /* -------------------------------------------------- */
  /* Cancel all task listeners                          */
  /* -------------------------------------------------- */

  function cancelListeners() {
    if (_tasksUnsubscribe) {
      _tasksUnsubscribe();
      _tasksUnsubscribe = null;
    }
    if (_studentUnsubscribe) {
      _studentUnsubscribe();
      _studentUnsubscribe = null;
    }
    // Also clean up from AppState registry
    AppState.cancelListener('coachingTasks');
    AppState.cancelListener('studentProfile');
  }

  /* -------------------------------------------------- */
  /* Private helpers                                    */
  /* -------------------------------------------------- */

  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* -------------------------------------------------- */
  /* Expose                                             */
  /* -------------------------------------------------- */

  window.Tasks = {
    loadCoachingTasks,
    listenForStudentUpdates,
    loadStudentMessages,
    renderTasksHTML,
    markTodayCompleted,
    cancelListeners,
  };

})();