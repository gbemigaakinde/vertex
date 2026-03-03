/* ============================================================
   js/tasks.js — Coaching task management
   ============================================================
   BUGS FIXED:
   1. markTodayCompleted() was dead code — never called. Removed.
      Completion is correctly marked in submitExam() already.

   2. loadStudentMessages() used a compound Firestore query
      (where recipientId == x AND where expiresAt > now AND
      orderBy expiresAt). Firestore requires a composite index
      for this — if it doesn't exist the query throws and
      silently returns []. Fixed by fetching all messages for
      the recipient and filtering expired ones client-side,
      which requires no index and is reliable.

   3. loadCoachingTasks() and loadStudentMessages() were only
      called from renderSubjectSelection(). Students resuming
      an ongoing exam never reach that function, so their
      coaching tasks and private messages were never loaded.
      Fixed by calling both from listenForStudentUpdates(),
      which IS called for every login path via app.js.

   4. Listener ownership was split between module-level vars
      (_tasksUnsubscribe, _studentUnsubscribe) AND
      AppState.registerListener(), causing stale-reference
      confusion on re-login. Consolidated: AppState owns all
      listener lifetimes; module vars are removed.

   5. The date used to check/record task completion was derived
      from new Date().toISOString() in exam.js, which is UTC.
      The task dates stored by the teacher are local-calendar
      dates (YYYY-MM-DD). In timezones behind UTC a late-night
      submission would record the NEXT day's date, never
      matching the task date. Fixed by using a local-date
      helper (_localDateStr()) in both files consistently.
      (exam.js is updated separately with the same helper.)

   6. renderTasksHTML() could be called before the
      tasksContainer element exists (e.g. during an active
      exam). The null-guard was already present and is kept.
   ============================================================ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     _localDateStr()

     Returns today's date as "YYYY-MM-DD" in the device's
     LOCAL timezone — not UTC.  This must match the format
     the teacher enters dates (calendar input, also local).

     Using toISOString() would return the UTC date, which
     can differ from local date near midnight in any timezone.
     ══════════════════════════════════════════════════════════ */
  function _localDateStr(date) {
    const d = date || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /* ══════════════════════════════════════════════════════════
     loadCoachingTasks  (real-time listener)

     Sets up a Firestore onSnapshot on coachingTasks/current.
     Returns a Promise that resolves once the first value
     (or error) has been received, so callers can await it
     before rendering.

     Listener lifetime is owned by AppState so logout/re-login
     always produces a clean state.
     ══════════════════════════════════════════════════════════ */
  function loadCoachingTasks() {
    return new Promise((resolve) => {
      // Cancel any pre-existing listener for this key
      AppState.cancelListener('coachingTasks');

      let resolved = false;

      const unsub = Db()
        .collection('coachingTasks')
        .doc('current')
        .onSnapshot(
          (snap) => {
            AppState.currentTaskConfig = snap.exists
              ? snap.data()
              : { active: false };

            // Re-render the task panel whenever the config changes
            if (document.getElementById('tasksContainer')) {
              renderTasksHTML();
            }

            if (!resolved) { resolved = true; resolve(); }
          },
          (err) => {
            console.error('[tasks] Failed to load coaching tasks:', err);
            AppState.currentTaskConfig = { active: false };
            if (!resolved) { resolved = true; resolve(); }
          }
        );

      AppState.registerListener('coachingTasks', unsub);
    });
  }

  /* ══════════════════════════════════════════════════════════
     loadStudentMessages

     Fetches all non-expired private messages for the current
     student.

     Previous implementation used:
       .where('expiresAt', '>', new Date())
       .orderBy('expiresAt', 'desc')
     which requires a Firestore composite index.  Without the
     index the SDK throws a permission/index error and returns
     nothing.  We now fetch all messages for the recipient and
     filter client-side — no index needed, and the message
     count per student is always small.
     ══════════════════════════════════════════════════════════ */
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
        .get();

      const now = Date.now();

      const messages = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(m => {
          // expiresAt may be a Firestore Timestamp or a plain Date/ms value
          if (!m.expiresAt) return true; // no expiry = keep
          const ms = m.expiresAt.toDate
            ? m.expiresAt.toDate().getTime()
            : new Date(m.expiresAt).getTime();
          return ms > now;
        })
        // Most recent first
        .sort((a, b) => {
          const ta = a.sentAt?.toDate ? a.sentAt.toDate().getTime() : 0;
          const tb = b.sentAt?.toDate ? b.sentAt.toDate().getTime() : 0;
          return tb - ta;
        });

      AppState.studentMessages = messages;
      return messages;
    } catch (err) {
      console.error('[tasks] Failed to load private messages:', err);
      AppState.studentMessages = [];
      return [];
    }
  }

  /* ══════════════════════════════════════════════════════════
     listenForStudentUpdates  (real-time listener)

     Called once from app.js on every login (both fresh start
     and exam resume).  It:
       1. Keeps the student's coachingCompleted map in sync so
          the task panel reflects completions in real time.
       2. Triggers an initial load of coaching tasks and
          private messages so BOTH login paths (subject
          selection AND exam resume) always have this data.
          Previously these were only loaded from
          renderSubjectSelection(), so resuming students never
          saw their tasks or messages.
     ══════════════════════════════════════════════════════════ */
  function listenForStudentUpdates() {
    const uid = AppState.userId;
    if (!uid) return;

    AppState.cancelListener('studentProfile');

    const unsub = Db()
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

    AppState.registerListener('studentProfile', unsub);

    // Ensure tasks and messages are loaded for EVERY login path,
    // not only when the subject-selection screen is shown.
    loadCoachingTasks().catch(err =>
      console.warn('[tasks] loadCoachingTasks error in listenForStudentUpdates:', err)
    );
    loadStudentMessages().catch(err =>
      console.warn('[tasks] loadStudentMessages error in listenForStudentUpdates:', err)
    );
  }

  /* ══════════════════════════════════════════════════════════
     renderTasksHTML

     Renders the coaching task panel into #tasksContainer.
     Called automatically by the real-time listeners whenever
     the config or the student's completion map changes.
     ══════════════════════════════════════════════════════════ */
  function renderTasksHTML() {
    const container = document.getElementById('tasksContainer');
    if (!container) return;

    const currentTasks = AppState.currentTaskConfig || {};
    const studentData  = AppState.studentData       || {};

    if (!currentTasks.active ||
        !Array.isArray(currentTasks.dates) ||
        currentTasks.dates.length === 0) {
      container.innerHTML = '';
      return;
    }

    const completed = studentData.coachingCompleted || {};
    const allDone   = currentTasks.dates.every(d => completed[d]);

    const datesHTML = currentTasks.dates.map(dateStr => {
      // Parse as local date so display always matches the calendar date
      // the teacher entered — regardless of timezone.
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
          <p style="font-size:1.125rem;margin-top:4px;
                    color:${isDone ? 'var(--success)' : 'var(--border-medium)'};">
            ${isDone ? '✓' : '○'}
          </p>
          <p style="font-size:var(--text-xs);
                    color:${isDone ? 'var(--success-text)' : 'var(--text-disabled)'};
                    margin-top:2px;">
            ${isDone ? 'Done' : 'Pending'}
          </p>
        </div>`;
    }).join('');

    const messageSafe = _esc(
      currentTasks.message || 'Complete the tests on these dates to mark them done!'
    )
      .replace(
        /\n\n/g,
        '</p><p style="font-size:var(--text-sm);color:var(--text-secondary);' +
        'line-height:1.7;margin-bottom:var(--sp-3);">'
      )
      .replace(/\n/g, '<br>');

    container.innerHTML = `
      <div style="background:var(--brand-bg);border:1px solid var(--brand-border);
                  border-radius:var(--r-xl);padding:var(--sp-5);margin-bottom:var(--sp-5);">

        <div style="display:flex;align-items:center;justify-content:space-between;
                    margin-bottom:var(--sp-3);">
          <h3 style="font-size:var(--text-lg);font-weight:700;color:var(--brand-text);">
            ${_esc(currentTasks.title || 'Coaching Tasks')}
          </h3>
          ${allDone
            ? '<span style="font-size:var(--text-xs);font-weight:700;' +
              'color:var(--success-text);background:var(--success-bg);' +
              'border:1px solid var(--success-border);border-radius:99px;' +
              'padding:2px 10px;">All complete ✓</span>'
            : ''}
        </div>

        <p style="font-size:var(--text-sm);color:var(--text-secondary);
                  line-height:1.7;margin-bottom:var(--sp-4);">
          ${messageSafe}
        </p>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));
                    gap:var(--sp-2);">
          ${datesHTML}
        </div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════════════
     cancelListeners

     Called on logout.  AppState.cancelAllListeners() handles
     the actual Firestore unsubscribes; this function just
     provides a clean public API for app.js / exam.js to call.
     ══════════════════════════════════════════════════════════ */
  function cancelListeners() {
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
    cancelListeners,
    // Exposed so exam.js can use the same local-date logic
    // when recording completion, keeping dates consistent.
    _localDateStr,
  };

})();