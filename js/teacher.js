/* ============================================================
   js/teacher.js — Teacher dashboard (UI v2)
   ============================================================
   UI REDESIGN — what changed:
   ┌──────────────────────────────────────────────────────────┐
   │ SHELL                                                    │
   │  Before: max-w-7xl glass p-10 mt-10, text-5xl heading,  │
   │          tab buttons text-xl px-8 py-4 (58px tall each) │
   │  After:  compact admin shell with sidebar-style pill nav,│
   │          page header 1rem padding, nav pills 34px tall   │
   │                                                          │
   │ STUDENTS                                                 │
   │  Before: text-3xl section H2, gap-6, p-6 cards          │
   │  After:  compact header bar, tighter cards with badges   │
   │                                                          │
   │ RESULTS                                                  │
   │  Before: text-4xl score display, 4-col grid gap-6        │
   │  After:  2-3 col grid, compact score pill, proper rhythm │
   │                                                          │
   │ SCHOOLS                                                  │
   │  Before: p-8 glass-dark add-form, full-width btn py-4   │
   │  After:  inline input + button row, clean list           │
   │                                                          │
   │ TASKS                                                    │
   │  Before: w-8 h-8 checkbox, text-xl inputs (52px), px-16 │
   │          py-5 buttons (~68px), glass-dark p-8 rounded-3xl│
   │  After:  standard form controls, two-section layout,     │
   │          proper label/input hierarchy                    │
   │                                                          │
   │ ZERO LOGIC CHANGES — all Firestore, Auth, event         │
   │ delegation, IDs, data-attributes, onclick handlers,      │
   │ class names used by JS unchanged                        │
   └──────────────────────────────────────────────────────────┘
   ============================================================ */

(function () {
  'use strict';

  /* -------------------------------------------------- */
  /* Active Firestore listeners — unchanged             */
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
    AppState.isTeacher = true;

    document.getElementById('app').innerHTML = `
      <div class="max-w-7xl mx-auto glass mt-6" style="margin-bottom:1.5rem;">

        <!-- ── Dashboard header ── -->
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:1rem 1.5rem;border-bottom:1px solid var(--c-border,#e5e7eb);">
          <div style="display:flex;align-items:center;gap:.75rem;">
            <div style="width:28px;height:28px;background:var(--c-brand,#4f46e5);border-radius:7px;
                        display:flex;align-items:center;justify-content:center;
                        color:#fff;font-weight:800;font-size:.75rem;flex-shrink:0;">V</div>
            <div>
              <h1 style="font-size:1rem;font-weight:700;line-height:1.2;color:var(--c-text,#111827);">
                Teacher Dashboard
              </h1>
              <p style="font-size:.75rem;color:var(--c-text-3,#6b7280);margin-top:1px;">
                Master Timothy — Admin
              </p>
            </div>
          </div>
          <button onclick="Teacher.logout()" class="btn bg-gray-500 hover:bg-gray-600"
                  style="font-size:.8125rem;padding:.4375rem .875rem;">
            Sign out
          </button>
        </div>

        <!-- ── Tab nav ── -->
        <div style="display:flex;align-items:center;gap:.375rem;padding:.625rem 1.5rem;
                    border-bottom:1px solid var(--c-border,#e5e7eb);flex-wrap:wrap;">
          <button onclick="Teacher.showTab('students')" id="tab-students"
                  class="tab-btn btn" style="font-size:.8125rem;padding:.4375rem .875rem;">
            Students
          </button>
          <button onclick="Teacher.showTab('results')" id="tab-results"
                  class="tab-btn btn" style="font-size:.8125rem;padding:.4375rem .875rem;">
            Results
          </button>
          <button onclick="Teacher.showTab('schools')" id="tab-schools"
                  class="tab-btn btn" style="font-size:.8125rem;padding:.4375rem .875rem;">
            Schools
          </button>
          <button onclick="Teacher.showTab('tasks')" id="tab-tasks"
                  class="tab-btn btn" style="font-size:.8125rem;padding:.4375rem .875rem;">
            Tasks &amp; Messages
          </button>
          <button onclick="Teacher.showTab('chat')" id="tab-chat"
                  class="tab-btn btn bg-green-600" style="font-size:.8125rem;padding:.4375rem .875rem;">
            Chat
          </button>
        </div>

        <!-- ── Tab panels ── -->
        <div style="padding:1.25rem 1.5rem;">

          <!-- Students -->
          <div id="teacher-students" class="teacher-tab">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
              <div>
                <h2 style="font-size:1rem;font-weight:700;">Registered Students</h2>
                <p style="font-size:.75rem;color:var(--c-text-3,#6b7280);margin-top:2px;">
                  Grouped by school
                </p>
              </div>
              <button onclick="Teacher._loadStudents()" class="btn bg-blue-600"
                      style="font-size:.8125rem;padding:.4375rem .875rem;">
                Refresh
              </button>
            </div>
            <div id="studentsList"></div>
          </div>

          <!-- Results -->
          <div id="teacher-results" class="teacher-tab hidden">
            <div style="margin-bottom:1rem;">
              <h2 style="font-size:1rem;font-weight:700;">All Exam Results</h2>
              <p style="font-size:.75rem;color:var(--c-text-3,#6b7280);margin-top:2px;">
                Most recent first
              </p>
            </div>
            <div id="resultsList" class="grid gap-3 md:grid-cols-2 lg:grid-cols-3"></div>
          </div>

          <!-- Schools -->
          <div id="teacher-schools" class="teacher-tab hidden">
            <div style="margin-bottom:1rem;">
              <h2 style="font-size:1rem;font-weight:700;">Manage Schools</h2>
              <p style="font-size:.75rem;color:var(--c-text-3,#6b7280);margin-top:2px;">
                Add, rename, or remove schools from the registration list
              </p>
            </div>

            <!-- Inline add form -->
            <div style="display:flex;gap:.625rem;margin-bottom:1.25rem;max-width:520px;">
              <input id="newSchoolName" type="text" placeholder="New school name"
                     style="flex:1;" />
              <button onclick="Teacher.addSchool()" class="btn"
                      style="white-space:nowrap;padding:.5rem 1rem;font-size:.875rem;">
                Add School
              </button>
            </div>

            <div id="schoolsList" class="space-y-2"></div>
          </div>

          <!-- Tasks & Messages -->
          <div id="teacher-tasks" class="teacher-tab hidden">
            <div style="margin-bottom:1.25rem;">
              <h2 style="font-size:1rem;font-weight:700;">Coaching Tasks &amp; Messages</h2>
              <p style="font-size:.75rem;color:var(--c-text-3,#6b7280);margin-top:2px;">
                Configure scheduled tasks and send private messages to students
              </p>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;" class="tasks-grid">

              <!-- ── Coaching task config ── -->
              <div class="glass-dark" style="padding:1.25rem;border-radius:10px;">
                <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1rem;
                            padding-bottom:.75rem;border-bottom:1px solid var(--c-border,#e5e7eb);">
                  <div style="width:6px;height:6px;border-radius:50%;background:var(--c-brand,#4f46e5);"></div>
                  <h3 style="font-size:.9375rem;font-weight:700;color:var(--c-brand-text,#3730a3);">
                    Coaching Tasks
                  </h3>
                </div>

                <!-- Active toggle -->
                <label style="display:flex;align-items:center;gap:.625rem;margin-bottom:1rem;
                              cursor:pointer;padding:.625rem .75rem;border-radius:8px;
                              border:1px solid var(--c-border,#e5e7eb);background:var(--c-surface,#fff);">
                  <input type="checkbox" id="tasksActive"
                         style="width:1rem;height:1rem;accent-color:var(--c-brand,#4f46e5);
                                flex-shrink:0;cursor:pointer;" />
                  <span style="font-size:.875rem;font-weight:600;color:var(--c-text,#111827);">
                    Activate for all students
                  </span>
                </label>

                <!-- Title -->
                <div style="margin-bottom:.75rem;">
                  <label style="display:block;font-size:.75rem;font-weight:600;
                                color:var(--c-text-2,#374151);margin-bottom:.375rem;">
                    Task Title
                  </label>
                  <input type="text" id="tasksTitle"
                         placeholder="e.g., Weekend Challenge" />
                </div>

                <!-- Message -->
                <div style="margin-bottom:.875rem;">
                  <label style="display:block;font-size:.75rem;font-weight:600;
                                color:var(--c-text-2,#374151);margin-bottom:.375rem;">
                    Message for Students
                  </label>
                  <textarea id="tasksMessage"
                            placeholder="Instructions or motivation..."
                            style="height:6rem;resize:vertical;"></textarea>
                </div>

                <!-- Date picker -->
                <div style="margin-bottom:.875rem;">
                  <label style="display:block;font-size:.75rem;font-weight:600;
                                color:var(--c-text-2,#374151);margin-bottom:.375rem;">
                    Task Dates
                  </label>
                  <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem;">
                    <input type="date" id="newTaskDate" style="flex:1;" />
                    <button onclick="Teacher.addTaskDate()" class="btn"
                            style="white-space:nowrap;padding:.5rem .875rem;font-size:.8125rem;">
                      + Add
                    </button>
                  </div>
                  <div id="tasksDates" class="space-y-1"></div>
                </div>

                <!-- Actions -->
                <div style="display:flex;gap:.5rem;padding-top:.875rem;
                            border-top:1px solid var(--c-border,#e5e7eb);">
                  <button id="saveTasksBtn" onclick="Teacher.saveTasksConfig()"
                          class="btn bg-green-600 hover:bg-green-700"
                          style="flex:1;font-size:.875rem;padding:.5625rem .875rem;">
                    Save &amp; Apply
                  </button>
                  <button id="deleteTasksBtn" onclick="Teacher.deleteAllTasks()"
                          class="btn bg-red-600 hover:bg-red-700"
                          style="font-size:.875rem;padding:.5625rem .875rem;">
                    Delete All
                  </button>
                </div>
              </div>

              <!-- ── Private message sender ── -->
              <div class="glass-dark" style="padding:1.25rem;border-radius:10px;">
                <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1rem;
                            padding-bottom:.75rem;border-bottom:1px solid var(--c-border,#e5e7eb);">
                  <div style="width:6px;height:6px;border-radius:50%;background:var(--c-danger,#dc2626);"></div>
                  <h3 style="font-size:.9375rem;font-weight:700;color:var(--c-danger,#dc2626);">
                    Private Message
                  </h3>
                </div>

                <!-- Student selector -->
                <div style="margin-bottom:.75rem;">
                  <label style="display:block;font-size:.75rem;font-weight:600;
                                color:var(--c-text-2,#374151);margin-bottom:.375rem;">
                    Recipient
                  </label>
                  <select id="msgStudent">
                    <option value="">Select a student...</option>
                  </select>
                </div>

                <!-- Message text -->
                <div style="margin-bottom:.75rem;">
                  <label style="display:block;font-size:.75rem;font-weight:600;
                                color:var(--c-text-2,#374151);margin-bottom:.375rem;">
                    Message
                  </label>
                  <textarea id="msgText"
                            placeholder="Write your private message..."
                            style="height:6rem;resize:vertical;"></textarea>
                </div>

                <!-- Duration -->
                <div style="margin-bottom:.875rem;">
                  <label style="display:block;font-size:.75rem;font-weight:600;
                                color:var(--c-text-2,#374151);margin-bottom:.375rem;">
                    Expires after
                  </label>
                  <select id="msgDuration">
                    <option value="3600000">1 hour</option>
                    <option value="86400000">1 day</option>
                    <option value="172800000">2 days</option>
                    <option value="259200000">3 days</option>
                    <option value="604800000">1 week</option>
                    <option value="1209600000">2 weeks</option>
                    <option value="2592000000">30 days</option>
                  </select>
                </div>

                <!-- Send -->
                <div style="padding-top:.875rem;border-top:1px solid var(--c-border,#e5e7eb);">
                  <button id="sendMsgBtn" onclick="Teacher.sendPrivateMessage()"
                          class="btn bg-red-600 hover:bg-red-700"
                          style="width:100%;justify-content:center;font-size:.875rem;">
                    Send Private Message
                  </button>
                </div>
              </div>

            </div><!-- /tasks-grid -->
          </div>

        </div><!-- /tab panels wrapper -->
      </div>`;

    /* Make tasks grid single column on mobile */
    const style = document.createElement('style');
    style.id = '_teacherGridStyle';
    style.textContent = `
      @media (max-width: 768px) {
        .tasks-grid { grid-template-columns: 1fr !important; }
      }
    `;
    if (!document.getElementById('_teacherGridStyle')) {
      document.head.appendChild(style);
    }

    showTab('students');
  }

  /* -------------------------------------------------- */
  /* Tab switching — logic unchanged                    */
  /* -------------------------------------------------- */

  function showTab(tab) {
    ['students', 'results', 'schools', 'tasks'].forEach(t => {
      const el  = document.getElementById(`teacher-${t}`);
      const btn = document.getElementById(`tab-${t}`);
      if (el)  el.classList.toggle('hidden', t !== tab);
      if (btn) btn.classList.toggle('active', t === tab);
    });

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
  /* Students tab — logic unchanged, template redesigned*/
  /* -------------------------------------------------- */

  function _loadStudents() {
    const container = document.getElementById('studentsList');
    if (!container) return;
    container.innerHTML = `
      <div style="text-align:center;padding:2rem;color:var(--c-text-3,#6b7280);font-size:.875rem;">
        Loading students...
      </div>`;

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
            container.innerHTML = `
              <div style="text-align:center;padding:2rem;color:var(--c-text-3,#6b7280);font-size:.875rem;">
                No students registered yet.
              </div>`;
            return;
          }

          container.innerHTML = schools.map(school => {
            const students = bySchool[school];
            const total    = students.length;
            return `
              <details class="glass-dark overflow-hidden mb-3" style="border-radius:10px;" open>
                <summary style="cursor:pointer;">
                  <span style="font-weight:700;font-size:.9375rem;">${_esc(school)}</span>
                  <span style="margin-left:.5rem;font-size:.75rem;font-weight:500;
                               background:var(--c-brand-light,#eef2ff);color:var(--c-brand-text,#3730a3);
                               border:1px solid var(--c-brand-border,#c7d2fe);
                               padding:1px 7px;border-radius:99px;">${total}</span>
                </summary>
                <div style="padding:.875rem 1rem;">
                  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.625rem;">
                    ${students.map(s => {
                      const joined = s.createdAt
                        ? new Date(s.createdAt.toDate ? s.createdAt.toDate() : s.createdAt).toLocaleDateString()
                        : '—';
                      return `
                        <div style="position:relative;background:var(--c-surface,#fff);
                                    border:1px solid var(--c-border,#e5e7eb);border-radius:8px;
                                    padding:.75rem .875rem .75rem 2.25rem;">
                          <!-- Admin toggle (star) — top-left -->
                          <button class="teacher-toggle-admin"
                                  data-uid="${_esc(s.id)}"
                                  data-name="${_esc(s.name)}"
                                  data-is-admin="${s.isAdmin ? 'true' : 'false'}"
                                  aria-label="Toggle admin for ${_esc(s.name)}"
                                  style="position:absolute;top:.5rem;left:.5rem;
                                         background:none;border:none;cursor:pointer;
                                         font-size:.875rem;line-height:1;padding:2px;
                                         color:${s.isAdmin ? '#d97706' : '#d1d5db'};">
                            ${s.isAdmin ? '★' : '☆'}
                          </button>

                          <!-- Delete (×) — top-right -->
                          <button class="teacher-delete-student"
                                  data-uid="${_esc(s.id)}"
                                  aria-label="Delete ${_esc(s.name)}"
                                  style="position:absolute;top:.375rem;right:.5rem;
                                         background:none;border:none;cursor:pointer;
                                         font-size:1rem;line-height:1;padding:2px 4px;
                                         color:var(--c-text-4,#9ca3af);"
                                  onmouseenter="this.style.color='var(--c-danger,#dc2626)'"
                                  onmouseleave="this.style.color='var(--c-text-4,#9ca3af)'">
                            ×
                          </button>

                          <p style="font-size:.875rem;font-weight:700;color:var(--c-text,#111827);
                                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                                    padding-right:1rem;">${_esc(s.name)}</p>
                          <p style="font-size:.75rem;color:var(--c-text-3,#6b7280);margin-top:1px;">
                            ${_esc(s.class || '—')}
                          </p>
                          <p style="font-size:.6875rem;color:var(--c-text-4,#9ca3af);margin-top:3px;
                                    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                            ${_esc(s.email || '')}
                          </p>
                          <p style="font-size:.6875rem;color:var(--c-text-4,#9ca3af);margin-top:4px;">
                            Joined ${joined}
                          </p>
                        </div>`;
                    }).join('')}
                  </div>
                </div>
              </details>`;
          }).join('');
        },
        err => {
          console.error('[teacher] Error loading students:', err);
          container.innerHTML = `
            <p style="text-align:center;color:var(--c-danger,#dc2626);font-size:.875rem;">
              Error loading students.
            </p>`;
        }
      );

    _reg('students', unsub);
  }

  /* Event delegation — logic unchanged */
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
      const snap = await Db().collection('students').doc(uid).get();
      const name = snap.exists ? snap.data().name : null;

      await Db().collection('students').doc(uid).delete();
      await Db().collection('ongoingExams').doc(uid).delete().catch(() => {});

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
  /* Results tab — logic unchanged, template redesigned */
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
            container.innerHTML = `
              <p style="grid-column:1/-1;text-align:center;padding:2rem;
                        color:var(--c-text-3,#6b7280);font-size:.875rem;">
                No results yet.
              </p>`;
            return;
          }

          container.innerHTML = snap.docs.map(doc => {
            const r = doc.data();
            const gradeColor = r.grade === 'A' ? 'var(--c-success,#16a34a)'
                             : r.grade === 'B' ? 'var(--c-info,#2563eb)'
                             : r.grade === 'C' ? 'var(--c-warning,#d97706)'
                             : r.grade === 'D' ? '#ea580c'
                             : 'var(--c-danger,#dc2626)';
            const pct = r.percentage || 0;
            const ts  = r.timestamp
              ? new Date(r.timestamp.toDate ? r.timestamp.toDate() : r.timestamp).toLocaleDateString()
              : '—';

            return `
              <div style="position:relative;background:var(--c-surface,#fff);
                          border:1px solid var(--c-border,#e5e7eb);border-radius:10px;
                          padding:.875rem 1rem;overflow:hidden;">

                <!-- Delete -->
                <button class="teacher-delete-result"
                        data-id="${_esc(doc.id)}"
                        aria-label="Delete result"
                        style="position:absolute;top:.5rem;right:.625rem;background:none;
                               border:none;cursor:pointer;font-size:1rem;line-height:1;
                               padding:2px 4px;color:var(--c-text-4,#9ca3af);"
                        onmouseenter="this.style.color='var(--c-danger,#dc2626)'"
                        onmouseleave="this.style.color='var(--c-text-4,#9ca3af)'">
                  ×
                </button>

                <!-- Grade badge -->
                <div style="display:flex;align-items:flex-start;gap:.625rem;margin-bottom:.625rem;">
                  <div style="min-width:48px;height:48px;border-radius:8px;
                              background:${gradeColor}12;border:1px solid ${gradeColor}40;
                              display:flex;flex-direction:column;align-items:center;
                              justify-content:center;flex-shrink:0;">
                    <span style="font-size:.6875rem;font-weight:700;color:${gradeColor};
                                 line-height:1;">${pct}%</span>
                    <span style="font-size:1rem;font-weight:800;color:${gradeColor};
                                 line-height:1;margin-top:1px;">${_esc(r.grade || '?')}</span>
                  </div>
                  <div style="min-width:0;flex:1;padding-right:1.25rem;">
                    <p style="font-size:.875rem;font-weight:700;color:var(--c-text,#111827);
                               white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      ${_esc(r.name || '')}
                    </p>
                    <p style="font-size:.75rem;color:var(--c-text-3,#6b7280);margin-top:1px;">
                      ${_esc(r.class || '')} · ${_esc(r.school || '')}
                    </p>
                  </div>
                </div>

                <!-- Per-subject scores -->
                <div style="display:flex;flex-wrap:wrap;gap:.25rem;margin-bottom:.5rem;">
                  ${(r.subjects || []).map(s => `
                    <span style="font-size:.6875rem;font-weight:600;
                                 background:var(--c-surface-2,#f9fafb);
                                 border:1px solid var(--c-border,#e5e7eb);
                                 border-radius:4px;padding:1px 6px;color:var(--c-text-2,#374151);">
                      ${_esc(s)}: ${r.scores?.[s] || 0}%
                    </span>`).join('')}
                </div>

                <p style="font-size:.6875rem;color:var(--c-text-4,#9ca3af);">${ts}</p>
              </div>`;
          }).join('');
        },
        err => {
          console.error('[teacher] Error loading results:', err);
          container.innerHTML = `
            <p style="grid-column:1/-1;text-align:center;color:var(--c-danger,#dc2626);font-size:.875rem;">
              Error loading results.
            </p>`;
        }
      );

    _reg('results', unsub);
  }

  /* Event delegation for result deletion — logic unchanged */
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
  /* Schools tab — logic unchanged, template redesigned */
  /* -------------------------------------------------- */

  function _loadSchools() {
    const container = document.getElementById('schoolsList');
    if (!container) return;
    container.innerHTML = `
      <p style="font-size:.875rem;color:var(--c-text-3,#6b7280);">Loading...</p>`;

    _cancel('schools');
    const unsub = Db()
      .collection('schools')
      .orderBy('name')
      .onSnapshot(
        snap => {
          if (snap.empty) {
            container.innerHTML = `
              <p style="font-size:.875rem;color:var(--c-text-3,#6b7280);">
                No schools added yet.
              </p>`;
            return;
          }
          container.innerHTML = snap.docs.map(doc => `
            <div style="display:flex;align-items:center;justify-content:space-between;
                        background:var(--c-surface,#fff);border:1px solid var(--c-border,#e5e7eb);
                        border-radius:8px;padding:.625rem 1rem;">
              <p style="font-size:.9375rem;font-weight:500;color:var(--c-text,#111827);">
                ${_esc(doc.data().name)}
              </p>
              <div style="display:flex;gap:.375rem;align-items:center;">
                <button class="teacher-rename-school btn bg-blue-600"
                        data-id="${_esc(doc.id)}"
                        data-name="${_esc(doc.data().name)}"
                        style="font-size:.75rem;padding:.3125rem .75rem;">
                  Rename
                </button>
                <button class="teacher-delete-school"
                        data-id="${_esc(doc.id)}"
                        data-name="${_esc(doc.data().name)}"
                        style="background:none;border:none;cursor:pointer;font-size:1rem;
                               line-height:1;padding:2px 4px;color:var(--c-text-4,#9ca3af);"
                        onmouseenter="this.style.color='var(--c-danger,#dc2626)'"
                        onmouseleave="this.style.color='var(--c-text-4,#9ca3af)'">
                  ×
                </button>
              </div>
            </div>`).join('');
        },
        err => {
          console.error('[teacher] Error loading schools:', err);
          container.innerHTML = `
            <p style="color:var(--c-danger,#dc2626);font-size:.875rem;">Error loading schools.</p>`;
        }
      );

    _reg('schools', unsub);
  }

  /* Event delegation — logic unchanged */
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
  /* Tasks & Messages tab — logic unchanged             */
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
    div.style.cssText = `
      display:flex;align-items:center;justify-content:space-between;
      background:var(--c-brand-light,#eef2ff);border:1px solid var(--c-brand-border,#c7d2fe);
      border-radius:6px;padding:.375rem .75rem;
    `;
    div.innerHTML = `
      <span class="date-val" style="font-size:.8125rem;font-weight:600;
                                    color:var(--c-brand-text,#3730a3);">${_esc(dateStr)}</span>
      <button onclick="this.parentElement.remove()"
              style="background:none;border:none;cursor:pointer;font-size:.875rem;
                     color:var(--c-danger,#dc2626);line-height:1;padding:0 2px;">
        ×
      </button>`;
    container.appendChild(div);
  }

  async function saveTasksConfig() {
    const active   = !!document.getElementById('tasksActive')?.checked;
    const title    = document.getElementById('tasksTitle')?.value.trim()   || '';
    const message  = document.getElementById('tasksMessage')?.value.trim() || '';
    const dates    = Array.from(document.querySelectorAll('#tasksDates span.date-val'))
                         .map(s => s.textContent.trim());

    if (active && !title)             { UI.toast('Please enter a title for the coaching task.', 'warning'); return; }
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
      if (titleEl)  titleEl.value     = '';
      if (msgEl)    msgEl.value       = '';
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

    if (!studentId) { UI.toast('Please select a student.',  'warning'); return; }
    if (!text)      { UI.toast('Please write a message.',   'warning'); return; }

    const btn = document.getElementById('sendMsgBtn');
    UI.setLoading(btn, true);

    try {
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
  /* Logout — unchanged                                 */
  /* -------------------------------------------------- */

  async function logout() {
    _cancelAll();
    AppState.isTeacher = false;
    try {
      await window.fbAuth.signOut();
    } catch (err) {
      console.error('[teacher] logout error:', err);
      UI.toast('Logout failed. Please try again.', 'error');
    }
  }

  /* -------------------------------------------------- */
  /* Private helpers — unchanged                        */
  /* -------------------------------------------------- */

  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function Db() { return window.fbDb; }

  /* -------------------------------------------------- */
  /* Expose — unchanged                                 */
  /* -------------------------------------------------- */

  window.Teacher = {
    renderTeacherDashboard,
    showTab,
    logout,
    _loadStudents,
    removeStudent,
    toggleAdmin,
    deleteResult,
    addSchool,
    renameSchool,
    deleteSchool,
    addTaskDate,
    saveTasksConfig,
    deleteAllTasks,
    sendPrivateMessage,
  };

})();