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
  /* State                                              */
  /* -------------------------------------------------- */

  let _tasksUnsubscribe = null;
  let _studentUnsubscribe = null;

  /* -------------------------------------------------- */
  /* Load coaching tasks (real-time)                    */
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
            if (snap.exists) {
              AppState.set('currentTasks', snap.data());
            } else {
              AppState.set('currentTasks', { active: false });
            }
            renderTasksHTML();
            resolve();
          },
          (err) => {
            console.error('[tasks] Failed to load coaching tasks:', err);
            AppState.set('currentTasks', { active: false });
            resolve();
          }
        );

      AppState.registerListener('coachingTasks', _tasksUnsubscribe);
    });
  }

  /* -------------------------------------------------- */
  /* Listen for student profile updates (real-time)     */
  /* -------------------------------------------------- */

  function listenForStudentUpdates() {
    const uid = AppState.get('user');
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
            AppState.set('studentData', snap.data());
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
  /* Load private messages for the logged-in student    */
  /* -------------------------------------------------- */

  async function loadStudentMessages() {
    const uid = AppState.get('user');
    if (!uid) return;

    try {
      const snap = await Db()
        .collection('privateMessages')
        .where('recipientId', '==', uid)
        .where('expiresAt', '>', new Date())
        .orderBy('expiresAt', 'desc')
        .get();

      const messages = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      AppState.set('studentMessages', messages);
    } catch (err) {
      console.error('[tasks] Failed to load private messages:', err);
      AppState.set('studentMessages', []);
    }
  }

  /* -------------------------------------------------- */
  /* Render tasks into #tasksContainer                  */
  /* -------------------------------------------------- */

  function renderTasksHTML() {
    const container = document.getElementById('tasksContainer');
    if (!container) return;

    const currentTasks = AppState.get('currentTasks') || {};
    const studentData = AppState.get('studentData') || {};

    if (!currentTasks.active || !currentTasks.dates || currentTasks.dates.length === 0) {
      container.innerHTML = '';
      return;
    }

    const completed = studentData.coachingCompleted || {};
    const allDone = currentTasks.dates.every((d) => completed[d]);

    const datesHTML = currentTasks.dates
      .map((dateStr) => {
        const date = new Date(dateStr);
        const formatted = date.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
        const isDone = completed[dateStr];
        return `
          <div class="glass p-6 rounded-2xl text-center">
            <p class="text-xl font-medium">${formatted}</p>
            <p class="text-6xl mt-4">${isDone ? '&#10003;' : '&#9675;'}</p>
            <p class="text-sm opacity-70 mt-2">${isDone ? 'Completed' : 'Pending'}</p>
          </div>`;
      })
      .join('');

    const messageLines = (currentTasks.message || 'Complete the tests on these dates to mark them done!')
      .replace(/\n\n/g, '</p><p class="text-lg leading-relaxed mb-4">')
      .replace(/\n/g, '<br>');

    container.innerHTML = `
      <div class="glass-dark p-8 rounded-3xl mb-10 shadow-2xl border-4 border-purple-500/50">
        <h3 class="text-3xl font-bold mb-6 text-purple-700">
          ${_escapeHTML(currentTasks.title || 'Coaching Tasks Active!')}
        </h3>
        <p class="text-lg leading-relaxed mb-6 text-left">${messageLines}</p>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          ${datesHTML}
        </div>
        ${allDone
          ? '<p class="text-green-600 text-3xl mt-8 font-bold">Amazing! All tasks completed! &#127942;</p>'
          : ''}
      </div>`;
  }

  /* -------------------------------------------------- */
  /* Mark today as completed (called after exam submit) */
  /* -------------------------------------------------- */

  async function markTodayCompleted() {
    const uid = AppState.get('user');
    const currentTasks = AppState.get('currentTasks');

    if (!uid || !currentTasks || !currentTasks.active || !currentTasks.dates) return;

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
  }

  /* -------------------------------------------------- */
  /* Private helpers                                    */
  /* -------------------------------------------------- */

  function _escapeHTML(str) {
    return String(str)
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