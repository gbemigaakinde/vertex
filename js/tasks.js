/* ============================================================
   js/tasks.js — Coaching task management
   ============================================================
   CHANGES FROM v2:
   - renderTasksHTML() uses design-system sizing
   - Removed shadow-2xl, rounded-3xl, border-4, text-3xl,
     text-5xl from task panel — everything is proportional
   - Date cards are compact, not dominant
   - Task panel visually subordinate to exam content
   - No logic or functional changes
   ============================================================ */

(function () {
  'use strict';

  let _tasksUnsubscribe   = null;
  let _studentUnsubscribe = null;

  /* ── Load coaching tasks (real-time) ── */
  function loadCoachingTasks() {
    return new Promise((resolve) => {
      if (_tasksUnsubscribe) {
        _tasksUnsubscribe();
        _tasksUnsubscribe = null;
      }

      _tasksUnsubscribe = Db()
        .collection('coachingTasks')
        .doc('current')
        .onSnapshot(
          (snap) => {
            AppState.currentTaskConfig = snap.exists ? snap.data() : { active: false };
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

  /* ── Listen for student profile updates (real-time) ── */
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

  /* ── Load private messages ── */
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
      AppState.studentMessages = [];
      return [];
    }
  }

  /* ── Render tasks HTML ── */
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
      const parts = dateStr.split('-');
      const date  = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      const formatted = date.toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short'
      });
      const isDone = !!completed[dateStr];
      return `
        <div style="background:${isDone ? 'var(--success-bg)' : 'var(--surface)'};
                    border:1px solid ${isDone ? 'var(--success-border)' : 'var(--border)'};
                    border-radius:var(--r-md);padding:0.625rem 0.875rem;text-align:center;">
          <p style="font-size:var(--text-sm);font-weight:500;color:var(--text-secondary);">
            ${_esc(formatted)}
          </p>
          <p style="font-size:1.125rem;margin-top:4px;color:${isDone ? 'var(--success)' : 'var(--border-medium)'};">
            ${isDone ? '✓' : '○'}
          </p>
          <p style="font-size:var(--text-xs);color:${isDone ? 'var(--success-text)' : 'var(--text-disabled)'};margin-top:2px;">
            ${isDone ? 'Done' : 'Pending'}
          </p>
        </div>`;
    }).join('');

    // Sanitise message text
    const messageSafe = _esc(currentTasks.message || 'Complete the tests on these dates to mark them done!')
      .replace(/\n\n/g, '</p><p style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.7;margin-bottom:var(--sp-3);">')
      .replace(/\n/g, '<br>');

    container.innerHTML = `
      <div style="background:var(--brand-bg);border:1px solid var(--brand-border);
                  border-radius:var(--r-xl);padding:var(--sp-5);margin-bottom:var(--sp-5);">

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3);">
          <h3 style="font-size:var(--text-lg);font-weight:700;color:var(--brand-text);">
            ${_esc(currentTasks.title || 'Coaching Tasks')}
          </h3>
          ${allDone
            ? '<span style="font-size:var(--text-xs);font-weight:700;color:var(--success-text);' +
              'background:var(--success-bg);border:1px solid var(--success-border);' +
              'border-radius:99px;padding:2px 10px;">All complete ✓</span>'
            : ''
          }
        </div>

        <p style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.7;margin-bottom:var(--sp-4);">
          ${messageSafe}
        </p>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:var(--sp-2);">
          ${datesHTML}
        </div>
      </div>`;
  }

  /* ── Mark today as completed ── */
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

  /* ── Cancel all task listeners ── */
  function cancelListeners() {
    if (_tasksUnsubscribe) {
      _tasksUnsubscribe();
      _tasksUnsubscribe = null;
    }
    if (_studentUnsubscribe) {
      _studentUnsubscribe();
      _studentUnsubscribe = null;
    }
    AppState.cancelListener('coachingTasks');
    AppState.cancelListener('studentProfile');
  }

  /* ── Private helpers ── */
  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function Db() { return window.fbDb; }

  /* ── Expose ── */
  window.Tasks = {
    loadCoachingTasks,
    listenForStudentUpdates,
    loadStudentMessages,
    renderTasksHTML,
    markTodayCompleted,
    cancelListeners,
  };

})();