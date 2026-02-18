/* ============================================================
   js/app.js — Application entry point
   Responsibilities:
     - Single auth state listener (no duplicates)
     - Route authenticated users to correct views
     - Coordinate module initialisation on login/logout
     - Global error boundary for uncaught promise rejections
   ============================================================ */

(function () {
  'use strict';

  /* -------------------------------------------------- */
  /* Constants                                          */
  /* -------------------------------------------------- */

  const TEACHER_UID = 'bV4u2V7aakMF7EyYe1bpCXGj4ny1';

  /* -------------------------------------------------- */
  /* Bootstrap                                          */
  /* -------------------------------------------------- */

  document.addEventListener('DOMContentLoaded', () => {
    _injectToastContainer();
    _registerGlobalErrorHandlers();
    _startAuthListener();
  });

  /* -------------------------------------------------- */
  /* Auth state listener                                */
  /* -------------------------------------------------- */

  function _startAuthListener() {
    Auth().onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        await _onLogin(firebaseUser);
      } else {
        _onLogout();
      }
    });
  }

  async function _onLogin(firebaseUser) {
    const uid = firebaseUser.uid;
    AppState.set('user', uid);

    // Teacher route
    if (uid === TEACHER_UID) {
      Teacher.renderTeacherDashboard();
      return;
    }

    // Student route — load profile
    try {
      const snap = await Db().collection('students').doc(uid).get();

      if (!snap.exists) {
        UI.toast('Profile not found. Please register again.', 'error', 0);
        await Auth().signOut();
        return;
      }

      AppState.set('studentData', snap.data());

      // Start real-time profile listener (for coaching task completion updates)
      Tasks.listenForStudentUpdates();

      // Route to exam or subject selection
      await _routeStudent();
    } catch (err) {
      console.error('[app] Profile load error:', err);
      UI.toast('Access error. Please try again.', 'error', 0);
      await Auth().signOut();
    }
  }

  function _onLogout() {
    // Cancel all active listeners
    AppState.cancelAllListeners();
    Tasks.cancelListeners();

    // Clear app state
    AppState.reset();

    // Render login screen
    Auth && Auth().currentUser === null && renderLogin();
  }

  /* -------------------------------------------------- */
  /* Student routing                                    */
  /* -------------------------------------------------- */

  async function _routeStudent() {
    const uid = AppState.get('user');

    try {
      const ongoingSnap = await Db().collection('ongoingExams').doc(uid).get();

      if (ongoingSnap.exists) {
        const examData = ongoingSnap.data();

        // Normalise startTime from Firestore Timestamp or plain object
        if (examData.startTime) {
          if (typeof examData.startTime.toDate === 'function') {
            examData.startTime = examData.startTime.toDate();
          } else if (examData.startTime.seconds) {
            examData.startTime = new Date(examData.startTime.seconds * 1000);
          }
        }

        AppState.set('exam', examData);
        Exam.render();

        if (examData.startTime) {
          Exam.startTimer();
        } else {
          Exam.showInstructionsModal();
        }
      } else {
        // No ongoing exam — show subject selection
        await _showSubjectSelection();
      }
    } catch (err) {
      console.error('[app] Routing error:', err);
      UI.toast('Failed to load exam state. Please refresh.', 'error');
    }
  }

  /* -------------------------------------------------- */
  /* Subject selection (dashboard)                      */
  /* -------------------------------------------------- */

  async function _showSubjectSelection() {
    const studentData = AppState.get('studentData');

    // Load tasks and messages in parallel
    await Promise.all([
      Tasks.loadCoachingTasks(),
      Tasks.loadStudentMessages(),
    ]);

    const classKey = (studentData.class || '').replace(/\s+/g, '').toLowerCase();
    const available = questions[classKey] ? Object.keys(questions[classKey]) : [];

    const messages = AppState.get('studentMessages') || [];
    const messagesHTML =
      messages.length > 0
        ? `<div class="space-y-6 mb-10">
             <h3 class="text-2xl font-bold text-center text-red-600">Messages from Master Timothy</h3>
             ${messages
               .map(
                 (msg) => `
               <div class="glass-dark p-6 rounded-2xl border-2 border-red-500 bg-red-50">
                 <p class="text-xl font-medium mb-2">${_esc(msg.message)}</p>
                 <p class="text-sm opacity-70 text-right">
                   Expires: ${new Date(msg.expiresAt.toDate ? msg.expiresAt.toDate() : msg.expiresAt).toLocaleString()}
                 </p>
               </div>`
               )
               .join('')}
           </div>`
        : '';

    const subjectsHTML =
      available.length === 0
        ? '<p class="text-red-500 text-2xl">No subjects available for your class.</p>'
        : `<div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
             ${available
               .map(
                 (subject) => `
               <label class="glass p-8 rounded-2xl cursor-pointer hover:scale-105 transition shadow-lg">
                 <input type="checkbox" value="${_esc(subject)}"
                        onchange="App.toggleSubject(this)"
                        class="w-6 h-6 accent-purple-600">
                 <span class="block mt-4 text-xl font-medium">${_esc(subject)}</span>
               </label>`
               )
               .join('')}
           </div>
           <button onclick="App.startExam()" id="startExamBtn" disabled
                   class="btn text-2xl px-16 py-5"
                   aria-label="Start exam (select at least 2 subjects)">
             Start Exam
           </button>`;

    document.getElementById('app').innerHTML = `
      <div class="max-w-4xl mx-auto glass p-10 mt-10 rounded-3xl text-center">
        <h1 class="text-4xl font-bold mb-6">Welcome, ${_esc(studentData.name)}!</h1>
        <p class="text-xl mb-4">
          Class: ${_esc(studentData.class)} &bull; School: ${_esc(studentData.school)}
        </p>

        ${messagesHTML}

        <div id="tasksContainer"></div>

        <button onclick="Chat.open()" class="btn bg-green-600 text-xl px-12 py-4 mb-8">
          Public Discussion Chat
        </button>

        <p class="text-xl mb-6">Select at least 2 subjects to start the exam</p>

        ${subjectsHTML}

        <button onclick="App.logout()" class="mt-10 text-sm opacity-70 underline">Logout</button>
      </div>`;

    // Initialise checkbox tracking state
    AppState.set('exam', { chosen: [] });

    // Render tasks now that container exists
    Tasks.renderTasksHTML();
  }

  /* -------------------------------------------------- */
  /* Subject toggle                                     */
  /* -------------------------------------------------- */

  function toggleSubject(checkbox) {
    let exam = AppState.get('exam') || { chosen: [] };
    if (!Array.isArray(exam.chosen)) exam.chosen = [];

    if (checkbox.checked) {
      if (!exam.chosen.includes(checkbox.value)) {
        exam.chosen.push(checkbox.value);
      }
    } else {
      exam.chosen = exam.chosen.filter((s) => s !== checkbox.value);
    }

    AppState.set('exam', exam);

    const btn = document.getElementById('startExamBtn');
    if (btn) btn.disabled = exam.chosen.length < 2;
  }

  /* -------------------------------------------------- */
  /* Start exam                                         */
  /* -------------------------------------------------- */

  async function startExam() {
    const exam = AppState.get('exam') || {};
    if (!exam.chosen || exam.chosen.length < 2) {
      UI.toast('Please select at least 2 subjects.', 'warning');
      return;
    }

    const studentData = AppState.get('studentData');
    const classKey = (studentData.class || '').replace(/\s+/g, '').toLowerCase();
    const selectedQuestions = {};

    for (const subject of exam.chosen) {
      const all = (questions[classKey] || {})[subject] || [];
      if (all.length === 0) {
        UI.toast(`No questions available for ${subject}.`, 'error');
        return;
      }
      const shuffled = [...all].sort(() => Math.random() - 0.5);
      selectedQuestions[subject] = shuffled.slice(0, 40);
    }

    const newExam = {
      step: 'exam',
      subjects: exam.chosen,
      questions: selectedQuestions,
      currentSubject: exam.chosen[0],
      currentIndex: 0,
      answers: {},
      duration: 120 * 60 * 1000,
      // startTime set after instructions modal
    };

    const btn = document.getElementById('startExamBtn');
    UI.setLoading(btn, true);

    try {
      await Db().collection('ongoingExams').doc(AppState.get('user')).set(newExam);
      AppState.set('exam', newExam);
      Exam.render();
      Exam.showInstructionsModal();
    } catch (err) {
      console.error('[app] startExam error:', err);
      UI.toast('Failed to start exam. Please try again.', 'error');
    } finally {
      UI.setLoading(btn, false);
    }
  }

  /* -------------------------------------------------- */
  /* Logout                                             */
  /* -------------------------------------------------- */

  async function logout() {
    AppState.cancelAllListeners();
    Tasks.cancelListeners();
    await Auth().signOut();
  }

  /* -------------------------------------------------- */
  /* Toast container injection                          */
  /* -------------------------------------------------- */

  function _injectToastContainer() {
    if (document.getElementById('toastContainer')) return;
    const div = document.createElement('div');
    div.id = 'toastContainer';
    document.body.appendChild(div);
  }

  /* -------------------------------------------------- */
  /* Global error handlers                              */
  /* -------------------------------------------------- */

  function _registerGlobalErrorHandlers() {
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[app] Unhandled promise rejection:', event.reason);
      // Do not surface every internal Firebase error to the user
    });
  }

  /* -------------------------------------------------- */
  /* Private helpers                                    */
  /* -------------------------------------------------- */

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* -------------------------------------------------- */
  /* Public API (called from inline HTML handlers)      */
  /* -------------------------------------------------- */

  window.App = {
    toggleSubject,
    startExam,
    logout,
  };

  /* Convenience alias used throughout modules */
  window.renderLogin = () => Auth_module && Auth_module.renderLogin();

})();