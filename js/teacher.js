/* ============================================================
   js/teacher.js — Teacher dashboard
   Responsibilities:
     - Render teacher dashboard shell with tabs
     - Students tab: list grouped by school, delete, toggle admin
     - Results tab: all results, delete
     - Schools tab: add, rename, delete schools
     - Tasks tab: coaching task config, private messages
     - Chat tab: delegate to Chat module
   ============================================================ */

(function () {
  'use strict';

  /* -------------------------------------------------- */
  /* Active Firestore listeners — tracked for cleanup   */
  /* -------------------------------------------------- */

  const _listeners = {};

  function _reg(key, unsub) {
    if (_listeners[key]) _listeners[key]();
    _listeners[key] = unsub;
  }

  function _cancel(key) {
    if (_listeners[key]) {
      _listeners[key]();
      delete _listeners[key];
    }
  }

  /* -------------------------------------------------- */
  /* Render dashboard shell                             */
  /* -------------------------------------------------- */

  function renderTeacherDashboard() {
    document.getElementById('app').innerHTML = `
      <div class="max-w-7xl mx-auto glass p-10 mt-10 rounded-3xl">
        <div class="flex justify-between items-center mb-10">
          <h1 class="text-5xl font-bold">Teacher Dashboard</h1>
          <button onclick="Teacher.logout()" class="btn text-xl px-8 py-4">Logout</button>
        </div>

        <div class="flex justify-center gap-6 mb-12 flex-wrap">
          <button onclick="Teacher.showTab('students')" id="tab-students" class="btn text-xl px-8 py-4">Students</button>
          <button onclick="Teacher.showTab('results')"  id="tab-results"  class="btn text-xl px-8 py-4">Results</button>
          <button onclick="Teacher.showTab('schools')"  id="tab-schools"  class="btn text-xl px-8 py-4">Schools</button>
          <button onclick="Teacher.showTab('tasks')"    id="tab-tasks"    class="btn text-xl px-8 py-4">Tasks &amp; Messages</button>
          <button onclick="Teacher.showTab('chat')"     id="tab-chat"     class="btn bg-green-600 text-xl px-8 py-4">Chat</button>
        </div>

        <!-- Students tab -->
        <div id="teacher-students" class="teacher-tab">
          <div class="flex justify-between items-center mb-8">
            <h2 class="text-3xl font-bold">Registered Students</h2>
            <button onclick="Teacher._loadStudents()" class="btn bg-blue-600 text-lg px-6 py-3">Refresh</button>
          </div>
          <div id="studentsList"></div>
        </div>

        <!-- Results tab -->
        <div id="teacher-results" class="teacher-tab hidden">
          <h2 class="text-3xl font-bold mb-8 text-center">All Exam Results</h2>
          <div id="resultsList" class="grid gap-6 md:grid-cols-3 lg:grid-cols-4"></div>
        </div>

        <!-- Schools tab -->
        <div id="teacher-schools" class="teacher-tab hidden">
          <h2 class="text-3xl font-bold mb-8 text-center">Manage Schools</h2>
          <div class="max-w-2xl mx-auto glass-dark p-8 rounded-2xl mb-8">
            <input id="newSchoolName" type="text" placeholder="Enter new school name"
                   class="w-full p-4 rounded-xl mb-4 text-lg">
            <button onclick="Teacher.addSchool()" class="btn w-full text-xl py-4">Add School</button>
          </div>
          <div id="schoolsList" class="space-y-4"></div>
        </div>

        <!-- Tasks & Messages tab -->
        <div id="teacher-tasks" class="teacher-tab hidden">
          <h2 class="text-3xl font-bold mb-8 text-center">Coaching Tasks &amp; Private Messages</h2>

          <!-- Coaching task config -->
          <div class="glass-dark p-8 rounded-3xl mb-12 max-w-5xl mx-auto shadow-2xl">
            <h3 class="text-2xl font-bold mb-6 text-purple-700">Coaching Tasks Manager</h3>

            <label class="flex items-center gap-4 mb-6 cursor-pointer">
              <input type="checkbox" id="tasksActive" class="w-8 h-8 accent-purple-600">
              <span class="text-2xl font-medium">Activate Coaching Tasks for All Students</span>
            </label>

            <input  type="text"     id="tasksTitle"   placeholder="Title (e.g., Weekend Challenge)"
                    class="w-full p-5 rounded-xl text-xl mb-4">
            <textarea id="tasksMessage" placeholder="Message for students"
                      class="w-full p-5 rounded-xl text-xl h-40 mb-6"></textarea>

            <div class="space-y-4 mb-8">
              <h4 class="text-xl font-bold">Task Dates</h4>
              <div class="flex gap-4 items-end">
                <div class="flex-1">
                  <label class="block text-lg font-medium mb-2">Select Date</label>
                  <input type="date" id="newTaskDate"
                         class="w-full p-4 rounded-xl text-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:outline-none">
                </div>
                <button onclick="Teacher.addTaskDate()" class="btn px-8 py-4 text-lg">+ Add Date</button>
              </div>
              <div id="tasksDates" class="space-y-3"></div>
            </div>

            <div class="text-center space-y-4">
              <button onclick="Teacher.saveTasksConfig()" class="btn bg-green-600 text-2xl px-16 py-5">
                Save &amp; Apply Tasks
              </button>
              <br>
              <button onclick="Teacher.deleteAllTasks()" class="btn bg-red-600 text-xl px-12 py-4 mt-4">
                Delete All Tasks
              </button>
            </div>
          </div>

          <!-- Private message sender -->
          <div class="glass-dark p-8 rounded-3xl max-w-5xl mx-auto shadow-2xl">
            <h3 class="text-2xl font-bold mb-6 text-red-700">Send Private Message to a Student</h3>

            <select id="msgStudent" class="w-full p-5 rounded-xl text-xl mb-6">
              <option value="">Select a student...</option>
            </select>

            <textarea id="msgText" placeholder="Write your private message here..."
                      class="w-full p-5 rounded-xl text-xl h-40 mb-6"></textarea>

            <div class="mb-8">
              <label class="text-xl font-medium block mb-3">Message expires in:</label>
              <select id="msgDuration" class="w-full p-5 rounded-xl text-xl">
                <option value="3600000">1 hour</option>
                <option value="86400000">1 day</option>
                <option value="172800000">2 days</option>
                <option value="259200000">3 days</option>
                <option value="604800000">1 week</option>
                <option value="1209600000">2 weeks</option>
                <option value="2592000000">30 days</option>
              </select>
            </div>

            <div class="text-center">
              <button onclick="Teacher.sendPrivateMessage()" class="btn bg-red-600 text-2xl px-16 py-5">
                Send Private Message
              </button>
            </div>
          </div>
        </div>

        <!-- Chat tab (Chat module renders into this) -->
        <div id="teacher-chat" class="teacher-tab hidden"></div>
      </div>`;

    showTab('students');
  }

  /* -------------------------------------------------- */
  /* Tab switching                                      */
  /* -------------------------------------------------- */

  function showTab(tab) {
    ['students', 'results', 'schools', 'tasks', 'chat'].forEach((t) => {
      const el = document.getElementById(`teacher-${t}`);
      if (el) el.classList.toggle('hidden', t !== tab);
      const btn = document.getElementById(`tab-${t}`);
      if (btn) btn.classList.toggle('ring-4', t === tab);
      if (btn) btn.classList.toggle('ring-purple-400', t === tab);
    });

    if (tab === 'students') _loadStudents();
    if (tab === 'results')  _loadResults();
    if (tab === 'schools')  _loadSchools();
    if (tab === 'tasks')    _loadTasksManager();
    if (tab === 'chat')     Chat.open({ isTeacher: true });
  }

  /* -------------------------------------------------- */
  /* Students tab                                       */
  /* -------------------------------------------------- */

  function _loadStudents() {
    const container = document.getElementById('studentsList');
    if (!container) return;
    container.innerHTML = '<p class="text-center text-2xl opacity-70">Loading...</p>';

    _cancel('students');
    const unsub = Db()
      .collection('students')
      .onSnapshot(
        (snap) => {
          const bySchool = {};
          snap.forEach((doc) => {
            const d = doc.data();
            const school = d.school || 'No School';
            if (!bySchool[school]) bySchool[school] = [];
            bySchool[school].push({ id: doc.id, ...d });
          });

          const schools = Object.keys(bySchool).sort();

          if (schools.length === 0) {
            container.innerHTML =
              '<p class="text-center text-2xl opacity-70">No students registered yet.</p>';
            return;
          }

          container.innerHTML = schools
            .map((school) => {
              const students = bySchool[school];
              return `
                <details class="glass-dark rounded-2xl overflow-hidden shadow-xl mb-4" open>
                  <summary class="p-6 text-2xl font-bold cursor-pointer hover:bg-white/10 bg-purple-600/30">
                    ${_esc(school)}
                    <span class="text-lg font-normal opacity-80">(${students.length})</span>
                  </summary>
                  <div class="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${students
                      .map((s) => {
                        const joined = s.createdAt
                          ? new Date(
                              s.createdAt.toDate ? s.createdAt.toDate() : s.createdAt
                            ).toLocaleDateString()
                          : 'Unknown';
                        return `
                          <div class="glass p-6 rounded-2xl relative">
                            <button onclick="Teacher.removeStudent('${s.id}')"
                                    class="absolute top-3 right-3 text-red-500 text-2xl leading-none"
                                    aria-label="Delete ${_esc(s.name)}">&#215;</button>
                            <button onclick="Teacher.toggleAdmin('${s.id}', '${_esc(s.name).replace(/'/g, "\\'")}', ${!!s.isAdmin})"
                                    class="absolute top-3 left-3 text-yellow-500 text-xl"
                                    aria-label="Toggle admin for ${_esc(s.name)}">
                              ${s.isAdmin ? '&#9733;' : '&#9734;'}
                            </button>
                            <p class="text-xl font-bold">${_esc(s.name)}</p>
                            <p class="opacity-80">${_esc(s.class || '')}</p>
                            <p class="text-sm opacity-70 mt-2 break-all">${_esc(s.email || '')}</p>
                            <p class="text-xs opacity-60 mt-4 italic">Joined: ${joined}</p>
                          </div>`;
                      })
                      .join('')}
                  </div>
                </details>`;
            })
            .join('');
        },
        (err) => {
          console.error('[teacher] Error loading students:', err);
          container.innerHTML =
            '<p class="text-center text-red-500">Error loading students.</p>';
        }
      );

    _reg('students', unsub);
  }

  async function removeStudent(uid) {
    const ok = await UI.confirmAction(
      'Permanently delete this student and all their data?'
    );
    if (!ok) return;

    try {
      // Get the name before deleting for the results cleanup
      const snap = await Db().collection('students').doc(uid).get();
      const name = snap.exists ? snap.data().name : null;

      // Delete student doc
      await Db().collection('students').doc(uid).delete();

      // Delete their ongoing exam
      await Db().collection('ongoingExams').doc(uid).delete().catch(() => {});

      // Delete their results (matched by name — best effort)
      if (name) {
        const results = await Db()
          .collection('results')
          .where('name', '==', name)
          .get();
        const batch = Db().batch();
        results.forEach((d) => batch.delete(d.ref));
        if (!results.empty) await batch.commit();
      }

      UI.toast('Student deleted.', 'success');
    } catch (err) {
      console.error('[teacher] removeStudent error:', err);
      UI.toast('Failed to delete student.', 'error');
    }
  }

  async function toggleAdmin(uid, name, currentlyAdmin) {
    const ok = await UI.confirmAction(
      currentlyAdmin
        ? `Remove admin role from ${name}?`
        : `Give admin role to ${name}?`
    );
    if (!ok) return;

    try {
      const ref = Db().collection('admins').doc(uid);
      if (currentlyAdmin) {
        await ref.delete();
        // Also update the students doc if isAdmin field present
        await Db().collection('students').doc(uid).update({ isAdmin: false }).catch(() => {});
      } else {
        await ref.set({ created: new Date() });
        await Db().collection('students').doc(uid).update({ isAdmin: true }).catch(() => {});
      }
      UI.toast(`Admin status updated for ${name}.`, 'success');
    } catch (err) {
      console.error('[teacher] toggleAdmin error:', err);
      UI.toast('Failed to update admin status.', 'error');
    }
  }

  /* -------------------------------------------------- */
  /* Results tab                                        */
  /* -------------------------------------------------- */

  function _loadResults() {
    const container = document.getElementById('resultsList');
    if (!container) return;

    _cancel('results');
    const unsub = Db()
      .collection('results')
      .orderBy('timestamp', 'desc')
      .onSnapshot(
        (snap) => {
          if (snap.empty) {
            container.innerHTML =
              '<p class="col-span-full text-center text-2xl opacity-70">No results yet.</p>';
            return;
          }

          container.innerHTML = snap.docs
            .map((doc) => {
              const r = doc.data();
              const gradeColor =
                r.grade === 'A'
                  ? 'text-green-500'
                  : r.grade === 'B'
                  ? 'text-blue-500'
                  : r.grade === 'C'
                  ? 'text-yellow-600'
                  : r.grade === 'D'
                  ? 'text-orange-500'
                  : 'text-red-500';

              return `
                <div class="glass-dark p-6 rounded-2xl relative">
                  <button onclick="Teacher.deleteResult('${doc.id}')"
                          class="absolute top-3 right-3 text-red-500 text-2xl leading-none"
                          aria-label="Delete result">&#215;</button>
                  <p class="text-xl font-bold">${_esc(r.name || '')}</p>
                  <p class="opacity-80">${_esc(r.class || '')} &bull; ${_esc(r.school || '')}</p>
                  <p class="text-4xl font-bold mt-4 ${gradeColor}">
                    ${r.percentage || 0}% &rarr; ${_esc(r.grade || '?')}
                  </p>
                  ${(r.subjects || [])
                    .map((s) => `<p><strong>${_esc(s)}:</strong> ${r.scores?.[s] || 0}%</p>`)
                    .join('')}
                </div>`;
            })
            .join('');
        },
        (err) => {
          console.error('[teacher] Error loading results:', err);
          container.innerHTML =
            '<p class="col-span-full text-center text-red-500">Error loading results.</p>';
        }
      );

    _reg('results', unsub);
  }

  async function deleteResult(id) {
    const ok = await UI.confirmAction('Delete this result permanently?');
    if (!ok) return;

    try {
      await Db().collection('results').doc(id).delete();
      UI.toast('Result deleted.', 'success');
    } catch (err) {
      console.error('[teacher] deleteResult error:', err);
      UI.toast('Failed to delete result.', 'error');
    }
  }

  /* -------------------------------------------------- */
  /* Schools tab                                        */
  /* -------------------------------------------------- */

  function _loadSchools() {
    const container = document.getElementById('schoolsList');
    if (!container) return;
    container.innerHTML = '<p class="text-center opacity-70">Loading schools...</p>';

    _cancel('schools');
    const unsub = Db()
      .collection('schools')
      .orderBy('name')
      .onSnapshot(
        (snap) => {
          if (snap.empty) {
            container.innerHTML =
              '<p class="text-center text-xl opacity-70">No schools added yet.</p>';
            return;
          }

          container.innerHTML = snap.docs
            .map(
              (doc) => `
              <div class="glass-dark p-6 rounded-2xl flex justify-between items-center shadow">
                <p class="text-xl font-medium">${_esc(doc.data().name)}</p>
                <div class="flex gap-4">
                  <button onclick="Teacher.renameSchool('${doc.id}', '${_esc(doc.data().name).replace(/'/g, "\\'")}')"
                          class="btn bg-blue-600 px-6 py-3 text-lg">Rename</button>
                  <button onclick="Teacher.deleteSchool('${doc.id}', '${_esc(doc.data().name).replace(/'/g, "\\'")}')"
                          class="text-red-500 text-3xl leading-none">&#215;</button>
                </div>
              </div>`
            )
            .join('');
        },
        (err) => {
          console.error('[teacher] Error loading schools:', err);
          container.innerHTML =
            '<p class="text-center text-red-500">Error loading schools.</p>';
        }
      );

    _reg('schools', unsub);
  }

  async function addSchool() {
    const input = document.getElementById('newSchoolName');
    const name = input ? input.value.trim() : '';

    if (!name) {
      UI.toast('Please enter a school name.', 'warning');
      return;
    }

    try {
      const snap = await Db()
        .collection('schools')
        .where('name', '==', name)
        .get();

      if (!snap.empty) {
        UI.toast('This school name already exists.', 'warning');
        return;
      }

      await Db().collection('schools').add({ name });
      if (input) input.value = '';
      UI.toast(`School "${name}" added.`, 'success');
    } catch (err) {
      console.error('[teacher] addSchool error:', err);
      UI.toast('Failed to add school.', 'error');
    }
  }

  async function renameSchool(id, currentName) {
    const newName = window.prompt('Enter new school name:', currentName);
    if (!newName || newName.trim() === currentName) return;

    const trimmed = newName.trim();

    try {
      const snap = await Db()
        .collection('schools')
        .where('name', '==', trimmed)
        .get();

      if (!snap.empty) {
        UI.toast('This name already exists.', 'warning');
        return;
      }

      const ok = await UI.confirmAction(
        `Rename "${currentName}" to "${trimmed}"?\nExisting students keep their current school name.`
      );
      if (!ok) return;

      await Db().collection('schools').doc(id).update({ name: trimmed });
      UI.toast('School renamed.', 'success');
    } catch (err) {
      console.error('[teacher] renameSchool error:', err);
      UI.toast('Failed to rename school.', 'error');
    }
  }

  async function deleteSchool(id, schoolName) {
    const ok = await UI.confirmAction(
      `Delete "${schoolName}" from the list?\n\nStudents already registered keep their school name, but new students will not see it.`
    );
    if (!ok) return;

    try {
      await Db().collection('schools').doc(id).delete();
      UI.toast('School deleted.', 'success');
    } catch (err) {
      console.error('[teacher] deleteSchool error:', err);
      UI.toast('Failed to delete school.', 'error');
    }
  }

  /* -------------------------------------------------- */
  /* Tasks & Messages tab                               */
  /* -------------------------------------------------- */

  function _loadTasksManager() {
    // Populate task config from Firestore
    _cancel('tasksManager');
    const unsub = Db()
      .collection('coachingTasks')
      .doc('current')
      .onSnapshot((snap) => {
        const data = snap.exists
          ? snap.data()
          : { active: false, dates: [], title: '', message: '' };

        const activeEl = document.getElementById('tasksActive');
        const titleEl = document.getElementById('tasksTitle');
        const messageEl = document.getElementById('tasksMessage');
        const datesEl = document.getElementById('tasksDates');

        if (activeEl) activeEl.checked = !!data.active;
        if (titleEl) titleEl.value = data.title || '';
        if (messageEl) messageEl.value = data.message || '';
        if (datesEl) {
          datesEl.innerHTML = '';
          (data.dates || []).forEach((d) => _appendDateItem(d));
        }
      });
    _reg('tasksManager', unsub);

    // Populate students dropdown for private messages
    _cancel('msgStudents');
    const unsubStudents = Db()
      .collection('students')
      .orderBy('name')
      .onSnapshot((snap) => {
        const sel = document.getElementById('msgStudent');
        if (!sel) return;
        let html = '<option value="">Select student...</option>';
        snap.forEach((doc) => {
          const s = doc.data();
          html += `<option value="${doc.id}">${_esc(s.name)} (${_esc(s.class || '')})</option>`;
        });
        sel.innerHTML = html;
      });
    _reg('msgStudents', unsubStudents);
  }

  function addTaskDate() {
    const dateInput = document.getElementById('newTaskDate');
    const container = document.getElementById('tasksDates');
    if (!dateInput || !container) return;

    const val = dateInput.value.trim();
    if (!val) {
      UI.toast('Please select a date first.', 'warning');
      return;
    }

    // Prevent duplicates
    const existing = Array.from(container.querySelectorAll('span.date-val')).map(
      (s) => s.textContent
    );
    if (existing.includes(val)) {
      UI.toast('This date is already in the list.', 'warning');
      return;
    }

    _appendDateItem(val);
    dateInput.value = '';
  }

  function _appendDateItem(dateStr) {
    const container = document.getElementById('tasksDates');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'flex justify-between items-center bg-purple-100 p-4 rounded-xl shadow';
    div.innerHTML = `
      <span class="date-val text-lg font-medium">${_esc(dateStr)}</span>
      <button onclick="this.parentElement.remove()" class="text-red-600 font-bold text-2xl px-3">&#215;</button>`;
    container.appendChild(div);
  }

  async function saveTasksConfig() {
    const active = document.getElementById('tasksActive')?.checked || false;
    const title = document.getElementById('tasksTitle')?.value.trim() || '';
    const message = document.getElementById('tasksMessage')?.value.trim() || '';

    if (active && !title) {
      UI.toast('Please enter a title for the coaching task.', 'warning');
      return;
    }

    const dates = Array.from(
      document.querySelectorAll('#tasksDates span.date-val')
    ).map((s) => s.textContent.trim());

    if (active && dates.length === 0) {
      UI.toast('Please add at least one date when activating tasks.', 'warning');
      return;
    }

    const payload = {
      active,
      title: title || 'Coaching Task',
      message: message || 'Complete the required exams on the scheduled dates.',
      dates,
      updatedAt: new Date().toISOString(),
    };

    const btn = document.querySelector('button[onclick="Teacher.saveTasksConfig()"]');
    UI.setLoading(btn, true);

    try {
      await Db().collection('coachingTasks').doc('current').set(payload);
      UI.toast('Coaching tasks saved.', 'success');
    } catch (err) {
      console.error('[teacher] saveTasksConfig error:', err);
      UI.toast('Failed to save tasks.', 'error');
    } finally {
      UI.setLoading(btn, false);
    }
  }

  async function deleteAllTasks() {
    const ok = await UI.confirmAction(
      'Delete all current tasks? This removes them from every student portal immediately.'
    );
    if (!ok) return;

    try {
      await Db().collection('coachingTasks').doc('current').delete();
      UI.toast('All tasks deleted.', 'success');

      // Clear the form
      const titleEl = document.getElementById('tasksTitle');
      const msgEl = document.getElementById('tasksMessage');
      const datesEl = document.getElementById('tasksDates');
      const activeEl = document.getElementById('tasksActive');
      if (titleEl) titleEl.value = '';
      if (msgEl) msgEl.value = '';
      if (datesEl) datesEl.innerHTML = '';
      if (activeEl) activeEl.checked = false;
    } catch (err) {
      console.error('[teacher] deleteAllTasks error:', err);
      UI.toast('Failed to delete tasks.', 'error');
    }
  }

  async function sendPrivateMessage() {
    const studentId = document.getElementById('msgStudent')?.value;
    const text = document.getElementById('msgText')?.value.trim();
    const duration = parseInt(document.getElementById('msgDuration')?.value || '86400000', 10);

    if (!studentId) {
      UI.toast('Please select a student.', 'warning');
      return;
    }
    if (!text) {
      UI.toast('Please write a message.', 'warning');
      return;
    }

    const btn = document.querySelector('button[onclick="Teacher.sendPrivateMessage()"]');
    UI.setLoading(btn, true);

    try {
      await Db().collection('privateMessages').add({
        recipientId: studentId,
        message: text,
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + duration),
        sentBy: 'Master Timothy',
      });

      const msgEl = document.getElementById('msgText');
      if (msgEl) msgEl.value = '';

      UI.toast('Message sent successfully.', 'success');
    } catch (err) {
      console.error('[teacher] sendPrivateMessage error:', err);
      UI.toast('Failed to send message.', 'error');
    } finally {
      UI.setLoading(btn, false);
    }
  }

  /* -------------------------------------------------- */
  /* Logout                                             */
  /* -------------------------------------------------- */

  function logout() {
    Object.keys(_listeners).forEach((k) => _cancel(k));
    Auth().signOut();
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
  /* Expose                                             */
  /* -------------------------------------------------- */

  window.Teacher = {
    renderTeacherDashboard,
    showTab,
    logout,
    // Students
    _loadStudents,
    removeStudent,
    toggleAdmin,
    // Results
    deleteResult,
    // Schools
    addSchool,
    renameSchool,
    deleteSchool,
    // Tasks
    addTaskDate,
    saveTasksConfig,
    deleteAllTasks,
    sendPrivateMessage,
  };
})();