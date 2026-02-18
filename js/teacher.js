/* ============================================================
   js/teacher.js — Teacher dashboard
   Responsibilities:
     - Render teacher dashboard shell with tabs
     - Students tab: list grouped by school, delete, toggle admin
     - Results tab: all results, delete
     - Schools tab: add, rename, delete schools
     - Tasks tab: coaching task config, private messages
     - Chat tab: open public chat (returns to dashboard via backFromChat)
   ============================================================ */

(function () {
  'use strict';

  /* -------------------------------------------------- */
  /* Active Firestore listeners — tracked for cleanup   */
  /* -------------------------------------------------- */

  const _listeners = {};

  function _reg(key, unsub) {
    if (typeof _listeners[key] === 'function') _listeners[key]();
    _listeners[key] = unsub;
  }

  function _cancel(key) {
    if (typeof _listeners[key] === 'function') {
      _listeners[key]();
      delete _listeners[key];
    }
  }

  function _cancelAll() {
    Object.keys(_listeners).forEach(k => _cancel(k));
  }

  /* -------------------------------------------------- */
  /* Render dashboard shell                             */
  /* -------------------------------------------------- */

  function renderTeacherDashboard() {
    // Mark teacher status in AppState so chat.js backFromChat routes correctly
    AppState.isTeacher = true;

    document.getElementById('app').innerHTML = `
      <div class="max-w-7xl mx-auto glass p-10 mt-10 rounded-3xl">
        <div class="flex justify-between items-center mb-10">
          <h1 class="text-5xl font-bold">Teacher Dashboard</h1>
          <button onclick="Teacher.logout()" class="btn text-xl px-8 py-4">Logout</button>
        </div>

        <div class="flex justify-center gap-6 mb-12 flex-wrap">
          <button onclick="Teacher.showTab('students')" id="tab-students" class="tab-btn btn text-xl px-8 py-4">Students</button>
          <button onclick="Teacher.showTab('results')"  id="tab-results"  class="tab-btn btn text-xl px-8 py-4">Results</button>
          <button onclick="Teacher.showTab('schools')"  id="tab-schools"  class="tab-btn btn text-xl px-8 py-4">Schools</button>
          <button onclick="Teacher.showTab('tasks')"    id="tab-tasks"    class="tab-btn btn text-xl px-8 py-4">Tasks &amp; Messages</button>
          <button onclick="Teacher.showTab('chat')"     id="tab-chat"     class="tab-btn btn bg-green-600 text-xl px-8 py-4">Chat</button>
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
                   class="w-full p-4 rounded-xl mb-4 text-lg" />
            <button onclick="Teacher.addSchool()" class="btn w-full text-xl py-4">Add School</button>
          </div>
          <div id="schoolsList" class="space-y-4"></div>
        </div>

        <!-- Tasks & Messages tab -->
        <div id="teacher-tasks" class="teacher-tab hidden">
          <h2 class="text-3xl font-bold mb-8 text-center">Coaching Tasks &amp; Private Messages</h2>

          <div class="glass-dark p-8 rounded-3xl mb-12 max-w-5xl mx-auto shadow-2xl">
            <h3 class="text-2xl font-bold mb-6 text-purple-700">Coaching Tasks Manager</h3>

            <label class="flex items-center gap-4 mb-6 cursor-pointer">
              <input type="checkbox" id="tasksActive" class="w-8 h-8 accent-purple-600" />
              <span class="text-2xl font-medium">Activate Coaching Tasks for All Students</span>
            </label>

            <input    type="text" id="tasksTitle"
                      placeholder="Title (e.g., Weekend Challenge)"
                      class="w-full p-5 rounded-xl text-xl mb-4" />
            <textarea id="tasksMessage"
                      placeholder="Message for students"
                      class="w-full p-5 rounded-xl text-xl h-40 mb-6"></textarea>

            <div class="space-y-4 mb-8">
              <h4 class="text-xl font-bold">Task Dates</h4>
              <div class="flex gap-4 items-end">
                <div class="flex-1">
                  <label class="block text-lg font-medium mb-2">Select Date</label>
                  <input type="date" id="newTaskDate"
                         class="w-full p-4 rounded-xl text-lg border border-gray-300
                                focus:ring-2 focus:ring-purple-500 focus:outline-none" />
                </div>
                <button onclick="Teacher.addTaskDate()" class="btn px-8 py-4 text-lg">+ Add Date</button>
              </div>
              <div id="tasksDates" class="space-y-3"></div>
            </div>

            <div class="text-center space-y-4">
              <button id="saveTasksBtn" onclick="Teacher.saveTasksConfig()"
                      class="btn bg-green-600 text-2xl px-16 py-5">
                Save &amp; Apply Tasks
              </button>
              <br />
              <button id="deleteTasksBtn" onclick="Teacher.deleteAllTasks()"
                      class="btn bg-red-600 text-xl px-12 py-4 mt-4">
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
              <button id="sendMsgBtn" onclick="Teacher.sendPrivateMessage()"
                      class="btn bg-red-600 text-2xl px-16 py-5">
                Send Private Message
              </button>
            </div>
          </div>
        </div>

      </div>`;

    showTab('students');
  }

  /* -------------------------------------------------- */
  /* Tab switching                                      */
  /* -------------------------------------------------- */

  function showTab(tab) {
    ['students', 'results', 'schools', 'tasks'].forEach(t => {
      const el  = document.getElementById(`teacher-${t}`);
      const btn = document.getElementById(`tab-${t}`);
      if (el)  el.classList.toggle('hidden', t !== tab);
      if (btn) btn.classList.toggle('active', t === tab);
    });

    // Chat is handled separately — it replaces #app via UI.mount.
    // The teacher dashboard shell is re-rendered when chat.js backFromChat()
    // detects AppState.isTeacher and calls Teacher.renderTeacherDashboard().
    if (tab === 'chat') {
      Chat.openPublicChat();
      return;
    }

    if (tab === 'students') _loadStudents();
    if (tab === 'results')  _loadResults();
    if (tab === 'schools')  _loadSchools();
    if (tab === 'tasks')    _loadTasksManager();
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
        snap => {
          const bySchool = {};
          snap.forEach(doc => {
            const d      = doc.data();
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

          container.innerHTML = schools.map(school => {
            const students = bySchool[school];
            return `
              <details class="glass-dark rounded-2xl overflow-hidden shadow-xl mb-4" open>
                <summary class="p-6 text-2xl font-bold cursor-pointer hover:bg-white/10 bg-purple-600/30">
                  ${_esc(school)}
                  <span class="text-lg font-normal opacity-80">(${students.length})</span>
                </summary>
                <div class="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  ${students.map(s => {
                    const joined = s.createdAt
                      ? new Date(s.createdAt.toDate ? s.createdAt.toDate() : s.createdAt).toLocaleDateString()
                      : 'Unknown';
                    // Store id in data attributes — avoids JS-string-in-HTML escaping pitfalls
                    return `
                      <div class="glass p-6 rounded-2xl relative">
                        <button class="teacher-delete-student absolute top-3 right-3 text-red-500 text-2xl leading-none"
                                data-uid="${_esc(s.id)}"
                                aria-label="Delete ${_esc(s.name)}">&#215;</button>
                        <button class="teacher-toggle-admin absolute top-3 left-3 text-yellow-500 text-xl"
                                data-uid="${_esc(s.id)}"
                                data-name="${_esc(s.name)}"
                                data-is-admin="${s.isAdmin ? 'true' : 'false'}"
                                aria-label="Toggle admin for ${_esc(s.name)}">
                          ${s.isAdmin ? '&#9733;' : '&#9734;'}
                        </button>
                        <p class="text-xl font-bold">${_esc(s.name)}</p>
                        <p class="opacity-80">${_esc(s.class || '')}</p>
                        <p class="text-sm opacity-70 mt-2 break-all">${_esc(s.email || '')}</p>
                        <p class="text-xs opacity-60 mt-4 italic">Joined: ${joined}</p>
                      </div>`;
                  }).join('')}
                </div>
              </details>`;
          }).join('');
        },
        err => {
          console.error('[teacher] Error loading students:', err);
          container.innerHTML = '<p class="text-center text-red-500">Error loading students.</p>';
        }
      );

    _reg('students', unsub);
  }

  // Event delegation for student card actions — avoids inline handlers with JS strings
  document.addEventListener('click', async e => {
    const deleteBtn = e.target.closest('.teacher-delete-student');
    if (deleteBtn) { await removeStudent(deleteBtn.dataset.uid); return; }

    const adminBtn = e.target.closest('.teacher-toggle-admin');
    if (adminBtn) {
      await toggleAdmin(
        adminBtn.dataset.uid,
        adminBtn.dataset.name,
        adminBtn.dataset.isAdmin === 'true'
      );
    }
  });

  async function removeStudent(uid) {
    if (!uid) return;
    const ok = await UI.confirmAction('Permanently delete this student and all their data?');
    if (!ok) return;

    try {
      // Read name before deleting (for results cleanup)
      const snap = await Db().collection('students').doc(uid).get();
      const name = snap.exists ? snap.data().name : null;

      // Delete student record
      await Db().collection('students').doc(uid).delete();

      // Delete ongoing exam
      await Db().collection('ongoingExams').doc(uid).delete().catch(() => {});

      // Best-effort: delete results matched by uid field if present, fall back to name
      let resultSnap = await Db().collection('results').where('uid', '==', uid).get();
      if (resultSnap.empty && name) {
        resultSnap = await Db().collection('results').where('name', '==', name).get();
      }
      if (!resultSnap.empty) {
        const batch = Db().batch();
        resultSnap.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      UI.toast('Student deleted.', 'success');
    } catch (err) {
      console.error('[teacher] removeStudent error:', err);
      UI.toast('Failed to delete student.', 'error');
    }
  }

  async function toggleAdmin(uid, name, currentlyAdmin) {
    if (!uid) return;
    const ok = await UI.confirmAction(
      currentlyAdmin ? `Remove admin role from ${name}?` : `Give admin role to ${name}?`
    );
    if (!ok) return;

    try {
      const ref = Db().collection('admins').doc(uid);
      if (currentlyAdmin) {
        await ref.delete();
        await Db().collection('students').doc(uid).update({ isAdmin: false }).catch(() => {});
      } else {
        await ref.set({ created: firebase.firestore.FieldValue.serverTimestamp() });
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
        snap => {
          if (snap.empty) {
            container.innerHTML =
              '<p class="col-span-full text-center text-2xl opacity-70">No results yet.</p>';
            return;
          }

          container.innerHTML = snap.docs.map(doc => {
            const r = doc.data();
            const gradeColor = r.grade === 'A' ? 'text-green-500'
                             : r.grade === 'B' ? 'text-blue-500'
                             : r.grade === 'C' ? 'text-yellow-600'
                             : r.grade === 'D' ? 'text-orange-500'
                             : 'text-red-500';
            return `
              <div class="glass-dark p-6 rounded-2xl relative">
                <button class="teacher-delete-result absolute top-3 right-3 text-red-500 text-2xl leading-none"
                        data-id="${_esc(doc.id)}"
                        aria-label="Delete result">&#215;</button>
                <p class="text-xl font-bold">${_esc(r.name || '')}</p>
                <p class="opacity-80">${_esc(r.class || '')} &bull; ${_esc(r.school || '')}</p>
                <p class="text-4xl font-bold mt-4 ${gradeColor}">
                  ${r.percentage || 0}% &rarr; ${_esc(r.grade || '?')}
                </p>
                ${(r.subjects || []).map(s =>
                  `<p><strong>${_esc(s)}:</strong> ${r.scores?.[s] || 0}%</p>`
                ).join('')}
              </div>`;
          }).join('');
        },
        err => {
          console.error('[teacher] Error loading results:', err);
          container.innerHTML =
            '<p class="col-span-full text-center text-red-500">Error loading results.</p>';
        }
      );

    _reg('results', unsub);
  }

  // Event delegation for result deletion
  document.addEventListener('click', async e => {
    const btn = e.target.closest('.teacher-delete-result');
    if (btn) await deleteResult(btn.dataset.id);
  });

  async function deleteResult(id) {
    if (!id) return;
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
        snap => {
          if (snap.empty) {
            container.innerHTML =
              '<p class="text-center text-xl opacity-70">No schools added yet.</p>';
            return;
          }
          container.innerHTML = snap.docs.map(doc => `
            <div class="glass-dark p-6 rounded-2xl flex justify-between items-center shadow">
              <p class="text-xl font-medium">${_esc(doc.data().name)}</p>
              <div class="flex gap-4">
                <button class="teacher-rename-school btn bg-blue-600 px-6 py-3 text-lg"
                        data-id="${_esc(doc.id)}"
                        data-name="${_esc(doc.data().name)}">Rename</button>
                <button class="teacher-delete-school text-red-500 text-3xl leading-none"
                        data-id="${_esc(doc.id)}"
                        data-name="${_esc(doc.data().name)}">&#215;</button>
              </div>
            </div>`).join('');
        },
        err => {
          console.error('[teacher] Error loading schools:', err);
          container.innerHTML = '<p class="text-center text-red-500">Error loading schools.</p>';
        }
      );

    _reg('schools', unsub);
  }

  // Event delegation for school actions
  document.addEventListener('click', async e => {
    const renameBtn = e.target.closest('.teacher-rename-school');
    if (renameBtn) { await renameSchool(renameBtn.dataset.id, renameBtn.dataset.name); return; }

    const deleteBtn = e.target.closest('.teacher-delete-school');
    if (deleteBtn) { await deleteSchool(deleteBtn.dataset.id, deleteBtn.dataset.name); }
  });

  async function addSchool() {
    const input = document.getElementById('newSchoolName');
    const name  = input ? input.value.trim() : '';

    if (!name) { UI.toast('Please enter a school name.', 'warning'); return; }

    try {
      const snap = await Db().collection('schools').where('name', '==', name).get();
      if (!snap.empty) { UI.toast('This school name already exists.', 'warning'); return; }

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
      const snap = await Db().collection('schools').where('name', '==', trimmed).get();
      if (!snap.empty) { UI.toast('This name already exists.', 'warning'); return; }

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
    _cancel('tasksManager');
    const unsub = Db()
      .collection('coachingTasks')
      .doc('current')
      .onSnapshot(snap => {
        const data = snap.exists
          ? snap.data()
          : { active: false, dates: [], title: '', message: '' };

        const activeEl  = document.getElementById('tasksActive');
        const titleEl   = document.getElementById('tasksTitle');
        const messageEl = document.getElementById('tasksMessage');
        const datesEl   = document.getElementById('tasksDates');

        if (activeEl)  activeEl.checked = !!data.active;
        if (titleEl)   titleEl.value    = data.title   || '';
        if (messageEl) messageEl.value  = data.message || '';
        if (datesEl) {
          datesEl.innerHTML = '';
          (data.dates || []).forEach(d => _appendDateItem(d));
        }
      });
    _reg('tasksManager', unsub);

    // Populate students dropdown for private messages
    _cancel('msgStudents');
    const unsubStudents = Db()
      .collection('students')
      .orderBy('name')
      .onSnapshot(snap => {
        const sel = document.getElementById('msgStudent');
        if (!sel) return;
        let html = '<option value="">Select student...</option>';
        snap.forEach(doc => {
          const s = doc.data();
          html += `<option value="${_esc(doc.id)}">${_esc(s.name)} (${_esc(s.class || '')})</option>`;
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
    if (!val) { UI.toast('Please select a date first.', 'warning'); return; }

    const existing = Array.from(container.querySelectorAll('span.date-val')).map(s => s.textContent);
    if (existing.includes(val)) { UI.toast('This date is already in the list.', 'warning'); return; }

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
    const active   = !!document.getElementById('tasksActive')?.checked;
    const title    = document.getElementById('tasksTitle')?.value.trim()   || '';
    const message  = document.getElementById('tasksMessage')?.value.trim() || '';
    const dates    = Array.from(document.querySelectorAll('#tasksDates span.date-val'))
                         .map(s => s.textContent.trim());

    if (active && !title)          { UI.toast('Please enter a title for the coaching task.', 'warning'); return; }
    if (active && dates.length === 0) { UI.toast('Please add at least one date when activating tasks.', 'warning'); return; }

    const payload = {
      active,
      title:   title   || 'Coaching Task',
      message: message || 'Complete the required exams on the scheduled dates.',
      dates,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    const btn = document.getElementById('saveTasksBtn');
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

      const titleEl  = document.getElementById('tasksTitle');
      const msgEl    = document.getElementById('tasksMessage');
      const datesEl  = document.getElementById('tasksDates');
      const activeEl = document.getElementById('tasksActive');
      if (titleEl)  titleEl.value    = '';
      if (msgEl)    msgEl.value      = '';
      if (datesEl)  datesEl.innerHTML = '';
      if (activeEl) activeEl.checked  = false;
    } catch (err) {
      console.error('[teacher] deleteAllTasks error:', err);
      UI.toast('Failed to delete tasks.', 'error');
    }
  }

  async function sendPrivateMessage() {
    const studentId = document.getElementById('msgStudent')?.value;
    const text      = document.getElementById('msgText')?.value.trim();
    const duration  = parseInt(document.getElementById('msgDuration')?.value || '86400000', 10);

    if (!studentId) { UI.toast('Please select a student.',   'warning'); return; }
    if (!text)      { UI.toast('Please write a message.', 'warning'); return; }

    const btn = document.getElementById('sendMsgBtn');
    UI.setLoading(btn, true);

    try {
      // Use server timestamp for sentAt; compute expiresAt via a client-calculated offset.
      // Firestore does not support computed server timestamps, so we use client Date for
      // expiresAt. The duration values are large enough that minor clock skew is acceptable.
      const expiresAt = new Date(Date.now() + duration);

      await Db().collection('privateMessages').add({
        recipientId: studentId,
        message:     text,
        sentAt:      firebase.firestore.FieldValue.serverTimestamp(),
        expiresAt,
        sentBy:      'Master Timothy',
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

  async function logout() {
    _cancelAll();
    AppState.isTeacher = false;
    try {
      await window.fbAuth.signOut();
      // app.js onAuthStateChanged listener handles the rest
    } catch (err) {
      console.error('[teacher] logout error:', err);
      UI.toast('Logout failed. Please try again.', 'error');
    }
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