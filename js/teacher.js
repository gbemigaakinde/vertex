/* ============================================================
   js/teacher.js — Teacher dashboard (UI v2)
   ============================================================ */

(function () {
  'use strict';

  /* -------------------------------------------------- */
  /* Active Firestore listeners                         */
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
            <p style="font-size:.75rem;color:var(--c-text-3,#6b7280);margin-top:1px;">Admin</p>
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
                class="tab-btn btn" style="font-size:.8125rem;padding:.4375rem .875rem;">Students</button>
        <button onclick="Teacher.showTab('results')" id="tab-results"
                class="tab-btn btn" style="font-size:.8125rem;padding:.4375rem .875rem;">Results</button>
        <button onclick="Teacher.showTab('schools')" id="tab-schools"
                class="tab-btn btn" style="font-size:.8125rem;padding:.4375rem .875rem;">Schools</button>
        <button onclick="Teacher.showTab('tasks')" id="tab-tasks"
                class="tab-btn btn" style="font-size:.8125rem;padding:.4375rem .875rem;">Tasks &amp; Messages</button>
        <button onclick="Teacher.showTab('chat')" id="tab-chat"
                class="tab-btn btn bg-green-600" style="font-size:.8125rem;padding:.4375rem .875rem;">Chat</button>
      </div>

      <!-- ── Tab panels ── -->
      <div style="padding:1.25rem 1.5rem;">

        <!-- Students -->
        <div id="teacher-students" class="teacher-tab">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
            <div>
              <h2 style="font-size:1rem;font-weight:700;">Registered Students</h2>
              <p style="font-size:.75rem;color:var(--c-text-3,#6b7280);margin-top:2px;">Grouped by school</p>
            </div>
            <button onclick="Teacher._loadStudents()" class="btn bg-blue-600"
                    style="font-size:.8125rem;padding:.4375rem .875rem;">Refresh</button>
          </div>
          <div id="studentsList"></div>
        </div>

        <!-- Results -->
        <div id="teacher-results" class="teacher-tab hidden">
          <div style="margin-bottom:1rem;">
            <h2 style="font-size:1rem;font-weight:700;">All Exam Results</h2>
            <p style="font-size:.75rem;color:var(--c-text-3,#6b7280);margin-top:2px;">
              Most recent first &mdash; click any card to review the full attempt
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
          <div style="display:flex;gap:.625rem;margin-bottom:1.25rem;max-width:520px;">
            <input id="newSchoolName" type="text" placeholder="New school name" style="flex:1;" />
            <button onclick="Teacher.addSchool()" class="btn"
                    style="white-space:nowrap;padding:.5rem 1rem;font-size:.875rem;">Add School</button>
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
                <h3 style="font-size:.9375rem;font-weight:700;color:var(--c-brand-text,#3730a3);">Coaching Tasks</h3>
              </div>

              <!-- Scope selector — now 4 options including Weekly -->
              <div style="margin-bottom:.875rem;">
                <label style="display:block;font-size:.75rem;font-weight:600;
                              color:var(--c-text-2,#374151);margin-bottom:.375rem;">Assign to</label>
                <div style="display:flex;gap:0;border:1px solid var(--c-border,#e5e7eb);
                            border-radius:6px;overflow:hidden;width:100%;">
                  <button id="taskScopeAll" onclick="Teacher._setTaskScope('all')"
                          style="flex:1;padding:.4375rem .375rem;font-size:.6875rem;font-weight:600;
                                 cursor:pointer;border:none;transition:background .12s,color .12s;
                                 background:var(--brand,#3b5bdb);color:#fff;">All</button>
                  <button id="taskScopeWeekly" onclick="Teacher._setTaskScope('weekly')"
                          style="flex:1;padding:.4375rem .375rem;font-size:.6875rem;font-weight:600;
                                 cursor:pointer;border:none;border-left:1px solid var(--c-border,#e5e7eb);
                                 transition:background .12s,color .12s;
                                 background:var(--surface-muted,#f3f4f6);color:var(--text-tertiary,#6b7280);">Weekly</button>
                  <button id="taskScopeClass" onclick="Teacher._setTaskScope('class')"
                          style="flex:1;padding:.4375rem .375rem;font-size:.6875rem;font-weight:600;
                                 cursor:pointer;border:none;border-left:1px solid var(--c-border,#e5e7eb);
                                 transition:background .12s,color .12s;
                                 background:var(--surface-muted,#f3f4f6);color:var(--text-tertiary,#6b7280);">By Class</button>
                  <button id="taskScopeStudent" onclick="Teacher._setTaskScope('student')"
                          style="flex:1;padding:.4375rem .375rem;font-size:.6875rem;font-weight:600;
                                 cursor:pointer;border:none;border-left:1px solid var(--c-border,#e5e7eb);
                                 transition:background .12s,color .12s;
                                 background:var(--surface-muted,#f3f4f6);color:var(--text-tertiary,#6b7280);">By Student</button>
                </div>
              </div>

              <!-- Weekly hint -->
              <div id="taskWeeklyHint" style="display:none;margin-bottom:.75rem;padding:.5rem .75rem;
                   background:var(--brand-bg,#edf2ff);border:1px solid var(--brand-border,#bac8ff);
                   border-radius:6px;font-size:.75rem;color:var(--brand-text,#3730a3);line-height:1.6;">
                🔄 Weekly tasks repeat automatically every week. Select the days below; the system
                will resolve the exact dates for each week on its own.
              </div>

              <!-- Class target -->
              <div id="taskTargetClassWrap" style="display:none;margin-bottom:.75rem;">
                <label style="display:block;font-size:.75rem;font-weight:600;
                              color:var(--c-text-2,#374151);margin-bottom:.375rem;">Class</label>
                <select id="taskTargetClass" onchange="Teacher._onTaskTargetChange()">
                  <option value="">Select a class...</option>
                </select>
              </div>

              <!-- Student target -->
              <div id="taskTargetStudentWrap" style="display:none;margin-bottom:.75rem;">
                <label style="display:block;font-size:.75rem;font-weight:600;
                              color:var(--c-text-2,#374151);margin-bottom:.375rem;">Student</label>
                <select id="taskTargetStudent" onchange="Teacher._onTaskTargetChange()">
                  <option value="">Select a student...</option>
                </select>
              </div>

              <!-- Active toggle -->
              <label style="display:flex;align-items:center;gap:.625rem;margin-bottom:.875rem;
                            cursor:pointer;padding:.625rem .75rem;border-radius:8px;
                            border:1px solid var(--c-border,#e5e7eb);background:var(--c-surface,#fff);">
                <input type="checkbox" id="tasksActive"
                       style="width:1rem;height:1rem;accent-color:var(--c-brand,#4f46e5);
                              flex-shrink:0;cursor:pointer;" />
                <div>
                  <span style="font-size:.875rem;font-weight:600;color:var(--c-text,#111827);">Active</span>
                  <span style="display:block;font-size:.6875rem;color:var(--text-tertiary,#6b7280);margin-top:1px;">
                    Students only see this task when Active is checked
                  </span>
                </div>
              </label>

              <!-- Title -->
              <div style="margin-bottom:.75rem;">
                <label style="display:block;font-size:.75rem;font-weight:600;
                              color:var(--c-text-2,#374151);margin-bottom:.375rem;">Task Title</label>
                <input type="text" id="tasksTitle" placeholder="e.g., Weekend Challenge" />
              </div>

              <!-- Message -->
              <div style="margin-bottom:.875rem;">
                <label style="display:block;font-size:.75rem;font-weight:600;
                              color:var(--c-text-2,#374151);margin-bottom:.375rem;">Message for Students</label>
                <textarea id="tasksMessage" placeholder="Instructions or motivation..."
                          style="height:5.5rem;resize:vertical;"></textarea>
              </div>

              <!-- Date / day picker area -->
              <div style="margin-bottom:.875rem;">
                <label style="display:block;font-size:.75rem;font-weight:600;
                              color:var(--c-text-2,#374151);margin-bottom:.375rem;">
                  <span id="taskDateLabel">Task Dates &amp; Subjects</span>
                </label>
                <p id="taskDateHint" style="font-size:.6875rem;color:var(--text-tertiary,#6b7280);margin-bottom:.5rem;line-height:1.5;">
                  Add each date then choose which subjects are required for that day.
                  Leave all unchecked on a date = no subject restriction for that day.
                </p>

                <!-- Calendar date input (non-weekly) -->
                <div id="taskDatePickerWrap" style="display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem;">
                  <input type="date" id="newTaskDate" style="flex:1;" />
                  <button onclick="Teacher.addTaskDate()" class="btn"
                          style="white-space:nowrap;padding:.5rem .875rem;font-size:.8125rem;">+ Add</button>
                </div>

                <!-- Day-of-week selector (weekly scope only) -->
                <div id="taskDayOfWeekPickerWrap" style="display:none;margin-bottom:.5rem;">
                  <select id="newTaskDayOfWeek" style="flex:1;width:100%;">
                    <option value="">Select a day of the week...</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                  <button onclick="Teacher.addTaskDate()" class="btn"
                          style="white-space:nowrap;padding:.5rem .875rem;font-size:.8125rem;margin-top:.375rem;width:100%;">
                    + Add Day
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
              </div>
            </div>

            <!-- ── Private message sender ── (unchanged HTML) -->
            <div class="glass-dark" style="padding:1.25rem;border-radius:10px;">
              <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1rem;
                          padding-bottom:.75rem;border-bottom:1px solid var(--c-border,#e5e7eb);">
                <div style="width:6px;height:6px;border-radius:50%;background:var(--c-danger,#dc2626);"></div>
                <h3 style="font-size:.9375rem;font-weight:700;color:var(--c-danger,#dc2626);">Private Message</h3>
              </div>

              <div style="margin-bottom:.75rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.375rem;">
                  <label style="font-size:.75rem;font-weight:600;color:var(--c-text-2,#374151);">Recipients</label>
                  <div style="display:flex;border:1px solid var(--c-border,#e5e7eb);border-radius:6px;overflow:hidden;">
                    <button id="msgModeSingle" onclick="Teacher._setMsgMode('single')"
                            style="padding:2px 9px;font-size:.6875rem;font-weight:600;cursor:pointer;
                                   border:none;background:var(--brand,#3b5bdb);color:#fff;">Single</button>
                    <button id="msgModeMulti" onclick="Teacher._setMsgMode('multi')"
                            style="padding:2px 9px;font-size:.6875rem;font-weight:600;cursor:pointer;
                                   border:none;background:var(--surface-muted,#f3f4f6);color:var(--text-tertiary,#6b7280);">Multiple</button>
                  </div>
                </div>
                <div id="msgSingleWrap">
                  <select id="msgStudent"><option value="">Select a student...</option></select>
                </div>
                <div id="msgMultiWrap" style="display:none;">
                  <input id="msgStudentSearch" type="text" placeholder="Search students..."
                         oninput="Teacher._filterMsgStudents()" style="margin-bottom:.375rem;" />
                  <div id="msgStudentList"
                       style="max-height:160px;overflow-y:auto;border:1.5px solid var(--border-medium,#d1d5db);
                              border-radius:6px;background:var(--surface,#fff);"></div>
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-top:.375rem;">
                    <span id="msgSelectedCount" style="font-size:.75rem;color:var(--text-tertiary,#6b7280);">0 selected</span>
                    <div style="display:flex;gap:.375rem;align-items:center;">
                      <button onclick="Teacher._selectAllMsgStudents()"
                              style="font-size:.6875rem;font-weight:600;color:var(--brand,#3b5bdb);
                                     background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">Select all</button>
                      <span style="color:var(--border-medium,#d1d5db);">·</span>
                      <button onclick="Teacher._clearMsgStudents()"
                              style="font-size:.6875rem;font-weight:600;color:var(--text-tertiary,#6b7280);
                                     background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">Clear</button>
                    </div>
                  </div>
                </div>
              </div>

              <div style="margin-bottom:.75rem;">
                <label style="display:block;font-size:.75rem;font-weight:600;
                              color:var(--c-text-2,#374151);margin-bottom:.375rem;">Message</label>
                <textarea id="msgText" placeholder="Write your private message..."
                          style="height:6rem;resize:vertical;"></textarea>
              </div>

              <div style="margin-bottom:.875rem;">
                <label style="display:block;font-size:.75rem;font-weight:600;
                              color:var(--c-text-2,#374151);margin-bottom:.375rem;">Expires after</label>
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

  const style = document.createElement('style');
  style.id = '_teacherGridStyle';
  style.textContent = `
    @media (max-width: 768px) {
      .tasks-grid { grid-template-columns: 1fr !important; }
    }
    .teacher-result-card {
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    }
    .teacher-result-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,.10);
      border-color: var(--brand-border, #bac8ff);
    }
    #teacherReviewModal {
      position: fixed; inset: 0;
      background: rgba(17,24,39,.6);
      z-index: 1200;
      display: flex; align-items: flex-start; justify-content: center;
      padding: 1.25rem; overflow-y: auto;
      backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
      animation: cbt-overlay-in 0.16s ease-out both;
    }
    #teacherReviewModal .review-panel {
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e5e7eb);
      border-radius: 12px; padding: 1.5rem;
      width: 100%; max-width: 760px; margin: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,.12);
      animation: cbt-modal-in 0.24s cubic-bezier(.34,1.45,.64,1) both;
    }
    .review-q-card { border-radius:8px; padding:1rem; border-width:2px; border-style:solid; }
    .review-q-card--correct  { border-color:var(--success,#2f9e44); background:var(--success-bg,#ebfbee); }
    .review-q-card--wrong    { border-color:var(--danger,#e03131);  background:var(--danger-bg,#fff5f5); }
    .review-q-card--skipped  { border-color:var(--border-medium,#d1d5db); background:var(--surface-subtle,#f9fafb); }
    .task-date-row .date-subj-list label:last-child { border-bottom: none; }
    .progress-student-row { transition: background .12s; }
    .progress-student-row:hover { background: var(--brand-bg,#edf2ff) !important; }
  `;
  if (!document.getElementById('_teacherGridStyle')) {
    document.head.appendChild(style);
  }

  showTab('students');
}

  /* -------------------------------------------------- */
  /* Tab switching                                       */
  /* -------------------------------------------------- */

  function showTab(tab) {
    ['students', 'results', 'schools', 'tasks', 'chat'].forEach(t => {
      const el  = document.getElementById(`teacher-${t}`);
      const btn = document.getElementById(`tab-${t}`);
      if (el)  el.classList.toggle('hidden', t !== tab);
      if (btn) btn.classList.toggle('active', t === tab);
    });
    if (tab === 'chat')     { Chat.openPublicChat(); return; }
    if (tab === 'students') _loadStudents();
    if (tab === 'results')  _loadResults();
    if (tab === 'schools')  _loadSchools();
    if (tab === 'tasks')    _loadTasksManager();
  }

  /* -------------------------------------------------- */
  /* Students tab                                        */
  /* -------------------------------------------------- */

  function _loadStudents() {
    const container = document.getElementById('studentsList');
    if (!container) return;
    container.innerHTML = `
      <div style="text-align:center;padding:2rem;color:var(--c-text-3,#6b7280);font-size:.875rem;">
        Loading students...
      </div>`;

    _cancel('students');
    const unsub = Db().collection('students').onSnapshot(
      snap => {
        const bySchool = {};
        snap.forEach(doc => {
          const d = doc.data();
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
          return `
            <details class="glass-dark overflow-hidden mb-3" style="border-radius:10px;" open>
              <summary style="cursor:pointer;">
                <span style="font-weight:700;font-size:.9375rem;">${_esc(school)}</span>
                <span style="margin-left:.5rem;font-size:.75rem;font-weight:500;
                             background:var(--c-brand-light,#eef2ff);color:var(--c-brand-text,#3730a3);
                             border:1px solid var(--c-brand-border,#c7d2fe);
                             padding:1px 7px;border-radius:99px;">${students.length}</span>
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
                        <button class="teacher-toggle-admin"
                                data-uid="${_esc(s.id)}" data-name="${_esc(s.name)}"
                                data-is-admin="${s.isAdmin ? 'true' : 'false'}"
                                aria-label="Toggle admin for ${_esc(s.name)}"
                                style="position:absolute;top:.5rem;left:.5rem;background:none;border:none;
                                       cursor:pointer;font-size:.875rem;line-height:1;padding:2px;
                                       color:${s.isAdmin ? '#d97706' : '#d1d5db'};">
                          ${s.isAdmin ? '★' : '☆'}
                        </button>
                        <button class="teacher-delete-student" data-uid="${_esc(s.id)}"
                                aria-label="Delete ${_esc(s.name)}"
                                style="position:absolute;top:.375rem;right:.5rem;background:none;border:none;
                                       cursor:pointer;font-size:1rem;line-height:1;padding:2px 4px;
                                       color:var(--c-text-4,#9ca3af);"
                                onmouseenter="this.style.color='var(--c-danger,#dc2626)'"
                                onmouseleave="this.style.color='var(--c-text-4,#9ca3af)'">×</button>
                        <p style="font-size:.875rem;font-weight:700;color:var(--c-text,#111827);
                                  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:1rem;">
                          ${_esc(s.name)}</p>
                        <p style="font-size:.75rem;color:var(--c-text-3,#6b7280);margin-top:1px;">${_esc(s.class || '—')}</p>
                        <p style="font-size:.6875rem;color:var(--c-text-4,#9ca3af);margin-top:3px;
                                  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(s.email || '')}</p>
                        <p style="font-size:.6875rem;color:var(--c-text-4,#9ca3af);margin-top:4px;">Joined ${joined}</p>
                      </div>`;
                  }).join('')}
                </div>
              </div>
            </details>`;
        }).join('');
      },
      err => {
        console.error('[teacher] Error loading students:', err);
        container.innerHTML = `<p style="text-align:center;color:var(--c-danger,#dc2626);font-size:.875rem;">Error loading students.</p>`;
      }
    );
    _reg('students', unsub);
  }

  document.addEventListener('click', async e => {
    const deleteBtn = e.target.closest('.teacher-delete-student');
    if (deleteBtn) { await removeStudent(deleteBtn.dataset.uid); return; }
    const adminBtn = e.target.closest('.teacher-toggle-admin');
    if (adminBtn) {
      await toggleAdmin(adminBtn.dataset.uid, adminBtn.dataset.name, adminBtn.dataset.isAdmin === 'true');
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
  /* Results tab                                         */
  /* -------------------------------------------------- */

  function _loadResults() {
    const container = document.getElementById('resultsList');
    if (!container) return;
    _cancel('results');
    const unsub = Db().collection('results').orderBy('timestamp', 'desc').onSnapshot(
      snap => {
        if (snap.empty) {
          container.innerHTML = `
            <p style="grid-column:1/-1;text-align:center;padding:2rem;
                      color:var(--c-text-3,#6b7280);font-size:.875rem;">No results yet.</p>`;
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
          const hasDetail = !!(r.questionSnapshots);
          return `
            <div class="teacher-result-card" data-result-id="${_esc(doc.id)}"
                 title="${hasDetail ? 'Click to review full attempt' : 'No detailed data for this attempt'}"
                 style="position:relative;background:var(--c-surface,#fff);
                        border:1px solid var(--c-border,#e5e7eb);border-radius:10px;
                        padding:.875rem 1rem;overflow:hidden;">
              <button class="teacher-delete-result" data-id="${_esc(doc.id)}" aria-label="Delete result"
                      style="position:absolute;top:.5rem;right:.625rem;background:none;border:none;
                             cursor:pointer;font-size:1rem;line-height:1;padding:2px 4px;
                             color:var(--c-text-4,#9ca3af);z-index:2;"
                      onmouseenter="this.style.color='var(--c-danger,#dc2626)'"
                      onmouseleave="this.style.color='var(--c-text-4,#9ca3af)'">×</button>
              <div style="display:flex;align-items:flex-start;gap:.625rem;margin-bottom:.625rem;">
                <div style="min-width:48px;height:48px;border-radius:8px;
                            background:${gradeColor}12;border:1px solid ${gradeColor}40;
                            display:flex;flex-direction:column;align-items:center;
                            justify-content:center;flex-shrink:0;">
                  <span style="font-size:.6875rem;font-weight:700;color:${gradeColor};line-height:1;">${pct}%</span>
                  <span style="font-size:1rem;font-weight:800;color:${gradeColor};line-height:1;margin-top:1px;">
                    ${_esc(r.grade || '?')}</span>
                </div>
                <div style="min-width:0;flex:1;padding-right:1.25rem;">
                  <p style="font-size:.875rem;font-weight:700;color:var(--c-text,#111827);
                             white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(r.name || '')}</p>
                  <p style="font-size:.75rem;color:var(--c-text-3,#6b7280);margin-top:1px;">
                    ${_esc(r.class || '')} · ${_esc(r.school || '')}</p>
                </div>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:.25rem;margin-bottom:.5rem;">
                ${(r.subjects || []).map(s => `
                  <span style="font-size:.6875rem;font-weight:600;
                               background:var(--c-surface-2,#f9fafb);border:1px solid var(--c-border,#e5e7eb);
                               border-radius:4px;padding:1px 6px;color:var(--c-text-2,#374151);">
                    ${_esc(s)}: ${r.scores?.[s] || 0}%
                  </span>`).join('')}
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <p style="font-size:.6875rem;color:var(--c-text-4,#9ca3af);">${ts}</p>
                ${hasDetail
                  ? `<span style="font-size:.6875rem;font-weight:600;color:var(--brand,#3b5bdb);
                                  background:var(--brand-bg,#edf2ff);border:1px solid var(--brand-border,#bac8ff);
                                  border-radius:4px;padding:1px 7px;">View attempt →</span>`
                  : `<span style="font-size:.6875rem;color:var(--c-text-4,#9ca3af);font-style:italic;">No detail available</span>`}
              </div>
            </div>`;
        }).join('');
      },
      err => {
        console.error('[teacher] Error loading results:', err);
        container.innerHTML = `
          <p style="grid-column:1/-1;text-align:center;color:var(--c-danger,#dc2626);font-size:.875rem;">
            Error loading results.</p>`;
      }
    );
    _reg('results', unsub);
  }

  document.addEventListener('click', async e => {
    const deleteBtn = e.target.closest('.teacher-delete-result');
    if (deleteBtn) { e.stopPropagation(); await deleteResult(deleteBtn.dataset.id); return; }
    const card = e.target.closest('.teacher-result-card');
    if (card && card.dataset.resultId) { await _openReviewModal(card.dataset.resultId); }
    const taskBtn = e.target.closest('.teacher-delete-task');
    if (taskBtn) { e.stopPropagation(); await deleteTask(taskBtn.dataset.taskId); }
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
  /* Review modal                                        */
  /* -------------------------------------------------- */

  async function _openReviewModal(resultId) {
    const existing = document.getElementById('teacherReviewModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'teacherReviewModal';
    overlay.innerHTML = `
      <div class="review-panel" style="text-align:center;padding:3rem 1.5rem;">
        <div style="font-size:.9375rem;color:var(--text-tertiary,#6b7280);">Loading attempt…</div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });

    let r;
    try {
      const snap = await Db().collection('results').doc(resultId).get();
      if (!snap.exists) {
        overlay.querySelector('.review-panel').innerHTML = `
          <p style="color:var(--danger,#e03131);font-size:.9375rem;">Result not found.</p>
          <button onclick="document.getElementById('teacherReviewModal').remove()"
                  class="btn bg-gray-500" style="margin-top:1rem;">Close</button>`;
        return;
      }
      r = snap.data();
    } catch (err) {
      console.error('[teacher] _openReviewModal fetch error:', err);
      overlay.querySelector('.review-panel').innerHTML = `
        <p style="color:var(--danger,#e03131);font-size:.9375rem;">Failed to load result.</p>
        <button onclick="document.getElementById('teacherReviewModal').remove()"
                class="btn bg-gray-500" style="margin-top:1rem;">Close</button>`;
      return;
    }

    const gradeColor = r.grade === 'A' ? 'var(--success,#2f9e44)'
                     : r.grade === 'B' ? 'var(--info,#1971c2)'
                     : r.grade === 'C' ? 'var(--warning,#e8890c)'
                     : r.grade === 'D' ? '#ea580c'
                     : 'var(--danger,#e03131)';
    const ts = r.timestamp
      ? new Date(r.timestamp.toDate ? r.timestamp.toDate() : r.timestamp)
          .toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
      : '—';

    if (!r.questionSnapshots) {
      overlay.querySelector('.review-panel').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;">
          <div>
            <h2 style="font-size:1.125rem;font-weight:700;">${_esc(r.name || '')}</h2>
            <p style="font-size:.8125rem;color:var(--text-tertiary,#6b7280);margin-top:2px;">
              ${_esc(r.class || '')} · ${_esc(r.school || '')} · ${ts}</p>
          </div>
          <button onclick="document.getElementById('teacherReviewModal').remove()"
                  class="btn bg-gray-500" style="font-size:.8125rem;">Close</button>
        </div>
        <div style="padding:2rem;text-align:center;background:var(--surface-muted,#f3f4f6);
                    border-radius:8px;border:1px solid var(--border,#e5e7eb);">
          <p style="font-size:2rem;">📋</p>
          <p style="font-size:.9375rem;font-weight:600;color:var(--text-primary,#111827);margin-top:.5rem;">
            Detailed attempt data not available</p>
          <p style="font-size:.8125rem;color:var(--text-tertiary,#6b7280);margin-top:.375rem;line-height:1.6;">
            This result was submitted before per-question tracking was introduced.<br>
            All future attempts will include the full question-by-question breakdown.</p>
        </div>`;
      return;
    }

    const subjectBlocks = (r.subjects || []).map(subj => {
      const qs = r.questionSnapshots[subj] || [];
      const correctCount = r.correctCounts?.[subj] ?? qs.filter(q => q.chosen === q.ans).length;
      const pct = r.scores?.[subj] ?? 0;
      const questionsHtml = qs.map((q, i) => {
        const isSkipped = q.chosen === null || q.chosen === undefined;
        const isCorrect = !isSkipped && q.chosen === q.ans;
        const cardClass = isCorrect ? 'review-q-card--correct' : isSkipped ? 'review-q-card--skipped' : 'review-q-card--wrong';
        const chosenColor = isCorrect ? 'var(--success,#2f9e44)' : isSkipped ? 'var(--text-disabled,#9ca3af)' : 'var(--danger,#e03131)';
        const chosenText  = isSkipped ? 'Not answered' : _escQ(q.opts?.[q.chosen] ?? '—');
        const correctText = _escQ(q.opts?.[q.ans] ?? '—');
        return `
          <div class="review-q-card ${cardClass}">
            <p style="font-size:.9375rem;font-weight:600;margin-bottom:.75rem;line-height:1.6;">
              ${i + 1}. ${_escQ(q.q)}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;font-size:.8125rem;margin-bottom:.75rem;">
              <div>
                <span style="font-weight:600;color:var(--text-tertiary,#6b7280);">Student answered:</span>
                <span style="display:block;margin-top:2px;font-weight:500;color:${chosenColor};">${chosenText}</span>
              </div>
              <div>
                <span style="font-weight:600;color:var(--text-tertiary,#6b7280);">Correct answer:</span>
                <span style="display:block;margin-top:2px;font-weight:500;color:var(--success,#2f9e44);">${correctText}</span>
              </div>
            </div>
            ${q.exp ? `
              <div style="background:var(--surface-muted,#f3f4f6);border:1px solid var(--border,#e5e7eb);
                          border-radius:6px;padding:.5625rem .875rem;font-size:.8125rem;
                          color:var(--text-secondary,#374151);line-height:1.6;">
                <span style="font-weight:600;">Explanation:</span> ${_escQ(q.exp)}
              </div>` : ''}
          </div>`;
      }).join('');
      return `
        <details style="border:1px solid var(--border,#e5e7eb);border-radius:10px;overflow:hidden;margin-bottom:.75rem;">
          <summary style="padding:.875rem 1.125rem;font-size:.9375rem;font-weight:700;cursor:pointer;
                          background:var(--surface-subtle,#f9fafb);display:flex;align-items:center;
                          justify-content:space-between;list-style:none;user-select:none;">
            <span>${_esc(subj)}</span>
            <span style="font-size:.8125rem;font-weight:600;
                         color:${pct >= 50 ? 'var(--success,#2f9e44)' : 'var(--danger,#e03131)'};">
              ${correctCount}/${qs.length} correct · ${pct}%</span>
          </summary>
          <div style="padding:1rem;display:flex;flex-direction:column;gap:.75rem;">
            ${questionsHtml || '<p style="font-size:.875rem;color:var(--text-tertiary,#6b7280);">No questions found.</p>'}
          </div>
        </details>`;
    }).join('');

    overlay.querySelector('.review-panel').innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;
                  margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid var(--border,#e5e7eb);">
        <div>
          <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-primary,#111827);">${_esc(r.name || '')}</h2>
          <p style="font-size:.8125rem;color:var(--text-tertiary,#6b7280);margin-top:3px;">
            ${_esc(r.class || '')} · ${_esc(r.school || '')}</p>
          <p style="font-size:.75rem;color:var(--text-disabled,#9ca3af);margin-top:2px;">${ts}</p>
        </div>
        <button onclick="document.getElementById('teacherReviewModal').remove()"
                class="btn bg-gray-500" style="font-size:.8125rem;padding:.4375rem .875rem;flex-shrink:0;">Close</button>
      </div>
      <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;
                  background:var(--surface-subtle,#f9fafb);border:1px solid var(--border,#e5e7eb);
                  border-radius:8px;padding:.875rem 1.125rem;margin-bottom:1.25rem;">
        <div style="text-align:center;min-width:60px;">
          <div style="font-size:2rem;font-weight:800;color:${gradeColor};line-height:1;">${r.percentage || 0}%</div>
          <div style="font-size:.875rem;font-weight:700;color:${gradeColor};">Grade ${_esc(r.grade || '?')}</div>
        </div>
        <div style="flex:1;display:flex;flex-wrap:wrap;gap:.375rem;">
          ${(r.subjects || []).map(s => `
            <div style="background:#fff;border:1px solid var(--border,#e5e7eb);border-radius:6px;
                        padding:.375rem .75rem;text-align:center;min-width:80px;">
              <div style="font-size:.75rem;color:var(--text-tertiary,#6b7280);font-weight:500;">${_esc(s)}</div>
              <div style="font-size:.9375rem;font-weight:700;color:var(--text-primary,#111827);">${r.scores?.[s] || 0}%</div>
              <div style="font-size:.6875rem;color:var(--text-disabled,#9ca3af);">
                ${r.correctCounts?.[s] ?? '?'}/${(r.questionSnapshots?.[s] || []).length}</div>
            </div>`).join('')}
        </div>
      </div>
      <div>${subjectBlocks || '<p style="font-size:.875rem;color:var(--text-tertiary,#6b7280);">No subjects found.</p>'}</div>`;

    if (window._katexAutoRenderReady && window.renderMathInElement) {
      requestAnimationFrame(() => {
        try {
          renderMathInElement(overlay, {
            delimiters: [
              { left: '$$', right: '$$', display: true  },
              { left: '$',  right: '$',  display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '\\[', right: '\\]', display: true  }
            ],
            throwOnError: false
          });
        } catch (e) { /* non-fatal */ }
      });
    }
  }

  function _escQ(str) {
    if (str == null) return '';
    const processed = (window.Exam && window.Exam.preprocessLatex)
      ? window.Exam.preprocessLatex(str) : str;
    return String(processed)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* -------------------------------------------------- */
  /* Schools tab                                         */
  /* -------------------------------------------------- */

  function _loadSchools() {
    const container = document.getElementById('schoolsList');
    if (!container) return;
    container.innerHTML = `<p style="font-size:.875rem;color:var(--c-text-3,#6b7280);">Loading...</p>`;
    _cancel('schools');
    const unsub = Db().collection('schools').orderBy('name').onSnapshot(
      snap => {
        if (snap.empty) {
          container.innerHTML = `<p style="font-size:.875rem;color:var(--c-text-3,#6b7280);">No schools added yet.</p>`;
          return;
        }
        container.innerHTML = snap.docs.map(doc => `
          <div style="display:flex;align-items:center;justify-content:space-between;
                      background:var(--c-surface,#fff);border:1px solid var(--c-border,#e5e7eb);
                      border-radius:8px;padding:.625rem 1rem;">
            <p style="font-size:.9375rem;font-weight:500;color:var(--c-text,#111827);">${_esc(doc.data().name)}</p>
            <div style="display:flex;gap:.375rem;align-items:center;">
              <button class="teacher-rename-school btn bg-blue-600"
                      data-id="${_esc(doc.id)}" data-name="${_esc(doc.data().name)}"
                      style="font-size:.75rem;padding:.3125rem .75rem;">Rename</button>
              <button class="teacher-delete-school" data-id="${_esc(doc.id)}" data-name="${_esc(doc.data().name)}"
                      style="background:none;border:none;cursor:pointer;font-size:1rem;
                             line-height:1;padding:2px 4px;color:var(--c-text-4,#9ca3af);"
                      onmouseenter="this.style.color='var(--c-danger,#dc2626)'"
                      onmouseleave="this.style.color='var(--c-text-4,#9ca3af)'">×</button>
            </div>
          </div>`).join('');
      },
      err => {
        console.error('[teacher] Error loading schools:', err);
        container.innerHTML = `<p style="color:var(--c-danger,#dc2626);font-size:.875rem;">Error loading schools.</p>`;
      }
    );
    _reg('schools', unsub);
  }

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
  /* Tasks & Messages tab                                */
  /* -------------------------------------------------- */

  let _taskScope = 'all';

  function _setTaskScope(scope) {
  _taskScope = scope;
  const classWrap   = document.getElementById('taskTargetClassWrap');
  const studentWrap = document.getElementById('taskTargetStudentWrap');
  const weeklyHint  = document.getElementById('taskWeeklyHint');
  const datePickerW = document.getElementById('taskDatePickerWrap');
  const dayPickerW  = document.getElementById('taskDayOfWeekPickerWrap');
  const dateLabel   = document.getElementById('taskDateLabel');
  const dateHint    = document.getElementById('taskDateHint');
  const btnAll      = document.getElementById('taskScopeAll');
  const btnWeekly   = document.getElementById('taskScopeWeekly');
  const btnClass    = document.getElementById('taskScopeClass');
  const btnStudent  = document.getElementById('taskScopeStudent');

  [btnAll, btnWeekly, btnClass, btnStudent].forEach(b => {
    if (b) { b.style.background = 'var(--surface-muted,#f3f4f6)'; b.style.color = 'var(--text-tertiary,#6b7280)'; }
  });

  const highlight = btn => {
    if (btn) { btn.style.background = 'var(--brand,#3b5bdb)'; btn.style.color = '#fff'; }
  };

  // Reset pickers
  if (classWrap)   classWrap.style.display   = 'none';
  if (studentWrap) studentWrap.style.display = 'none';
  if (weeklyHint)  weeklyHint.style.display  = 'none';

  if (scope === 'all') {
    highlight(btnAll);
    if (datePickerW) datePickerW.style.display = '';
    if (dayPickerW)  dayPickerW.style.display  = 'none';
    if (dateLabel)   dateLabel.innerHTML = 'Task Dates &amp; Subjects';
    if (dateHint)    dateHint.textContent = 'Add each date then choose which subjects are required for that day. Leave all unchecked = no restriction.';
  } else if (scope === 'weekly') {
    highlight(btnWeekly);
    if (weeklyHint)  weeklyHint.style.display  = '';
    if (datePickerW) datePickerW.style.display = 'none';
    if (dayPickerW)  dayPickerW.style.display  = '';
    if (dateLabel)   dateLabel.innerHTML = 'Days of Week &amp; Subjects';
    if (dateHint)    dateHint.textContent = 'Select which days of the week this task runs. The system automatically maps these to the correct calendar dates each week.';
  } else if (scope === 'class') {
    highlight(btnClass);
    if (classWrap)   classWrap.style.display   = '';
    if (datePickerW) datePickerW.style.display = '';
    if (dayPickerW)  dayPickerW.style.display  = 'none';
    if (dateLabel)   dateLabel.innerHTML = 'Task Dates &amp; Subjects';
    if (dateHint)    dateHint.textContent = 'Add each date then choose which subjects are required for that day. Leave all unchecked = no restriction.';
  } else {
    // student
    highlight(btnStudent);
    if (studentWrap) studentWrap.style.display = '';
    if (datePickerW) datePickerW.style.display = '';
    if (dayPickerW)  dayPickerW.style.display  = 'none';
    if (dateLabel)   dateLabel.innerHTML = 'Task Dates &amp; Subjects';
    if (dateHint)    dateHint.textContent = 'Add each date then choose which subjects are required for that day. Leave all unchecked = no restriction.';
  }

  _clearTaskForm();
}

  function _clearTaskForm() {
    const activeEl  = document.getElementById('tasksActive');
    const titleEl   = document.getElementById('tasksTitle');
    const messageEl = document.getElementById('tasksMessage');
    const datesEl   = document.getElementById('tasksDates');
    if (activeEl)  activeEl.checked  = false;
    if (titleEl)   titleEl.value     = '';
    if (messageEl) messageEl.value   = '';
    if (datesEl)   datesEl.innerHTML = '';
  }

  function _currentTaskDocId() {
  if (_taskScope === 'all')    return 'global';
  if (_taskScope === 'weekly') return 'weekly';
  if (_taskScope === 'class') {
    const sel = document.getElementById('taskTargetClass');
    const cls = sel ? sel.value.trim() : '';
    if (!cls) return null;
    return 'class_' + cls.replace(/\s+/g, '').toLowerCase();
  }
  if (_taskScope === 'student') {
    const sel = document.getElementById('taskTargetStudent');
    const uid = sel ? sel.value.trim() : '';
    if (!uid) return null;
    return 'student_' + uid;
  }
  return null;
}

  function _onTaskTargetChange() {
    // Rebuild any already-added date rows with the correct subject list
    // for the newly selected target.
    const datesEl = document.getElementById('tasksDates');
    if (!datesEl) return;
    const existingDates = Array.from(datesEl.querySelectorAll('.task-date-row'))
                               .map(r => r.dataset.date);
    datesEl.innerHTML = '';
    existingDates.forEach(d => _appendDateItem(d, []));
  }

  /* ── Get subjects for the current scope/target ── */
  function _getSubjectsForCurrentScope() {
    const qBank = window.questions || {};
    if (_taskScope === 'all') {
      const all = new Set();
      Object.values(qBank).forEach(classSubjects => {
        Object.keys(classSubjects).forEach(s => all.add(s));
      });
      return [...all].sort();
    }
    if (_taskScope === 'class') {
      const sel = document.getElementById('taskTargetClass');
      const cls = sel ? sel.value.trim() : '';
      if (!cls) return [];
      return Object.keys(qBank[cls.replace(/\s+/g, '').toLowerCase()] || {}).sort();
    }
    if (_taskScope === 'student') {
      const sel = document.getElementById('taskTargetStudent');
      const uid = sel ? sel.value.trim() : '';
      if (!uid) return [];
      const student = _msgStudentCache.find(s => s.id === uid);
      if (!student || !student.cls) return [];
      return Object.keys(qBank[student.cls.replace(/\s+/g, '').toLowerCase()] || {}).sort();
    }
    return [];
  }

  /* ── addTaskDate ── */
  function addTaskDate() {
  const container = document.getElementById('tasksDates');
  if (!container) return;

  if (_taskScope === 'weekly') {
    const daySelect = document.getElementById('newTaskDayOfWeek');
    const val = daySelect ? daySelect.value.trim() : '';
    if (!val) { UI.toast('Please select a day of the week.', 'warning'); return; }

    const existing = Array.from(container.querySelectorAll('.task-date-row')).map(r => r.dataset.date);
    if (existing.includes(val)) { UI.toast('This day is already in the list.', 'warning'); return; }

    _appendDateItem(val, [], true /* isWeekly */);
    if (daySelect) daySelect.value = '';
  } else {
    const dateInput = document.getElementById('newTaskDate');
    const val = dateInput ? dateInput.value.trim() : '';
    if (!val) { UI.toast('Please select a date first.', 'warning'); return; }

    const existing = Array.from(container.querySelectorAll('.task-date-row')).map(r => r.dataset.date);
    if (existing.includes(val)) { UI.toast('This date is already in the list.', 'warning'); return; }

    _appendDateItem(val, [], false /* not weekly */);
    if (dateInput) dateInput.value = '';
  }
}

  /* ── _appendDateItem ──
     Renders one date card with its own subject checklist.
     preselected = array of subject strings to pre-check.     */
  function _appendDateItem(dateStr, preselected, isWeeklyMode) {
  const container = document.getElementById('tasksDates');
  if (!container) return;
  preselected  = preselected  || [];
  isWeeklyMode = !!isWeeklyMode;

  const subjects = _getSubjectsForCurrentScope();

  // Display label: day name for weekly, formatted date otherwise
  let displayLabel;
  if (isWeeklyMode) {
    displayLabel = dateStr; // e.g. 'Monday'
  } else {
    const parts = dateStr.split('-');
    displayLabel = new Date(+parts[0], +parts[1] - 1, +parts[2])
      .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  const subjectCheckboxesHtml = subjects.length > 0
    ? subjects.map(subj => `
        <label style="display:flex;align-items:center;gap:.5rem;padding:.3125rem .625rem;
                      cursor:pointer;border-bottom:1px solid var(--border,#e5e7eb);transition:background .1s;"
               onmouseenter="this.style.background='var(--brand-bg,#edf2ff)'"
               onmouseleave="this.style.background=''">
          <input type="checkbox" class="date-subj-cb" value="${_esc(subj)}"
                 ${preselected.includes(subj) ? 'checked' : ''}
                 style="width:.875rem;height:.875rem;accent-color:var(--brand,#3b5bdb);
                        flex-shrink:0;cursor:pointer;" />
          <span style="font-size:.8125rem;color:var(--text-primary,#111827);">${_esc(subj)}</span>
        </label>`).join('')
    : `<p style="font-size:.8125rem;color:var(--text-tertiary,#6b7280);
                 padding:.5rem .75rem;font-style:italic;">
         No subjects available — select a scope target first.
       </p>`;

  const div = document.createElement('div');
  div.className    = 'task-date-row';
  div.dataset.date = dateStr;
  div.dataset.isWeekly = isWeeklyMode ? 'true' : 'false';
  div.style.cssText = `
    border:1.5px solid var(--brand-border,#bac8ff);border-radius:8px;
    overflow:hidden;margin-bottom:.5rem;background:var(--surface,#fff);`;

  div.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;
                padding:.5rem .75rem;background:var(--brand-bg,#edf2ff);cursor:pointer;"
         onclick="this.nextElementSibling.style.display =
                  this.nextElementSibling.style.display === 'none' ? '' : 'none'">
      <div style="display:flex;align-items:center;gap:.5rem;">
        ${isWeeklyMode ? '<span style="font-size:.6875rem;font-weight:700;color:var(--brand,#3b5bdb);background:rgba(59,91,219,.12);padding:1px 6px;border-radius:4px;">🔄</span>' : ''}
        <span style="font-size:.8125rem;font-weight:700;color:var(--brand-text,#3730a3);">
          ${_esc(displayLabel)}
        </span>
        <span class="date-subj-count"
              style="font-size:.6875rem;font-weight:600;color:var(--text-tertiary,#6b7280);">
          (all subjects)
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:.375rem;">
        <span style="font-size:.6875rem;color:var(--brand,#3b5bdb);">▾ subjects</span>
        <button onclick="event.stopPropagation();this.closest('.task-date-row').remove()"
                style="background:none;border:none;cursor:pointer;font-size:1rem;
                       line-height:1;padding:2px 4px;color:var(--c-danger,#dc2626);">×</button>
      </div>
    </div>
    <div style="border-top:1px solid var(--border,#e5e7eb);">
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:.375rem .75rem;background:var(--surface-muted,#f9fafb);
                  border-bottom:1px solid var(--border,#e5e7eb);">
        <span style="font-size:.6875rem;font-weight:600;color:var(--text-tertiary,#6b7280);">
          Subjects for this ${isWeeklyMode ? 'day' : 'date'}
          <span style="font-weight:400;">(leave all unchecked = no restriction)</span>
        </span>
        <div style="display:flex;gap:.375rem;">
          <button onclick="Teacher._selectAllDateSubjects(this)"
                  style="font-size:.6875rem;font-weight:600;color:var(--brand,#3b5bdb);
                         background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">All</button>
          <span style="color:var(--border-medium,#d1d5db);">·</span>
          <button onclick="Teacher._clearDateSubjects(this)"
                  style="font-size:.6875rem;font-weight:600;color:var(--text-tertiary,#6b7280);
                         background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">None</button>
        </div>
      </div>
      <div class="date-subj-list" style="max-height:130px;overflow-y:auto;">
        ${subjectCheckboxesHtml}
      </div>
    </div>`;

  container.appendChild(div);

  div.querySelectorAll('.date-subj-cb').forEach(cb => {
    cb.addEventListener('change', () => _updateDateSubjCount(div));
  });
  _updateDateSubjCount(div);
}

  function _updateDateSubjCount(rowEl) {
    const checked = rowEl.querySelectorAll('.date-subj-cb:checked').length;
    const label   = rowEl.querySelector('.date-subj-count');
    if (!label) return;
    label.textContent = checked === 0
      ? '(all subjects)'
      : `(${checked} subject${checked !== 1 ? 's' : ''} required)`;
    label.style.color = checked === 0 ? 'var(--text-tertiary,#6b7280)' : 'var(--brand,#3b5bdb)';
  }

  /* Called from onclick inside dynamically-created HTML — must be on Teacher */
  function _selectAllDateSubjects(btn) {
    const row = btn.closest('.task-date-row');
    if (!row) return;
    row.querySelectorAll('.date-subj-cb').forEach(cb => { cb.checked = true; });
    _updateDateSubjCount(row);
  }

  function _clearDateSubjects(btn) {
    const row = btn.closest('.task-date-row');
    if (!row) return;
    row.querySelectorAll('.date-subj-cb').forEach(cb => { cb.checked = false; });
    _updateDateSubjCount(row);
  }

  /* ── saveTasksConfig ── */
  async function saveTasksConfig() {
  const docId = _currentTaskDocId();
  if (!docId) {
    if (_taskScope === 'class')   { UI.toast('Please select a class.',   'warning'); return; }
    if (_taskScope === 'student') { UI.toast('Please select a student.', 'warning'); return; }
    UI.toast('No valid target selected.', 'warning');
    return;
  }

  const active  = !!document.getElementById('tasksActive')?.checked;
  const title   = document.getElementById('tasksTitle')?.value.trim()   || '';
  const message = document.getElementById('tasksMessage')?.value.trim() || '';

  const dateRows = Array.from(document.querySelectorAll('.task-date-row'));
  if (!title)             { UI.toast('Please enter a task title.',    'warning'); return; }
  if (dateRows.length === 0) {
    UI.toast(_taskScope === 'weekly' ? 'Please add at least one day of the week.' : 'Please add at least one date.', 'warning');
    return;
  }

  let payload;

  if (_taskScope === 'weekly') {
    // Weekly: keys are day names, not calendar dates
    const weeklyDays    = dateRows.map(row => row.dataset.date).filter(Boolean);
    const dateSubjects  = {};
    dateRows.forEach(row => {
      dateSubjects[row.dataset.date] =
        [...row.querySelectorAll('.date-subj-cb:checked')].map(cb => cb.value);
    });

    payload = {
      active,
      scope:        'weekly',
      title,
      message:      message || 'Complete the required exams on the scheduled days.',
      weeklyDays,          // ['Monday','Wednesday','Friday']
      dateSubjects,        // { Monday: ['Maths'], Wednesday: [], Friday: ['English'] }
      updatedAt:    firebase.firestore.FieldValue.serverTimestamp(),
    };
  } else {
    // Non-weekly: keys are YYYY-MM-DD calendar dates (existing behaviour)
    const dates = dateRows.map(row => row.dataset.date).filter(Boolean);
    const dateSubjects = {};
    dateRows.forEach(row => {
      dateSubjects[row.dataset.date] =
        [...row.querySelectorAll('.date-subj-cb:checked')].map(cb => cb.value);
    });

    payload = {
      active,
      scope:        _taskScope,
      title,
      message:      message || 'Complete the required exams on the scheduled dates.',
      dates,
      dateSubjects,
      updatedAt:    firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (_taskScope === 'student') {
      const sel = document.getElementById('taskTargetStudent');
      const opt = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      if (opt) payload.studentName = opt.text;
    }
    if (_taskScope === 'class') {
      const sel = document.getElementById('taskTargetClass');
      if (sel) payload.className = sel.value;
    }
  }

  const btn = document.getElementById('saveTasksBtn');
  UI.setLoading(btn, true);
  try {
    await Db().collection('coachingTasks').doc(docId).set(payload);
    UI.toast('Task saved.', 'success');
    _clearTaskForm();
  } catch (err) {
    console.error('[teacher] saveTasksConfig error:', err);
    const detail = err && err.code ? ' (' + err.code + ')' : '';
    UI.toast('Failed to save task' + detail + '.', 'error');
  } finally {
    UI.setLoading(btn, false);
  }
}

  /* ── _loadTasksManager ── */
  function _loadTasksManager() {
  _cancel('tasksManager');
  _taskScope = 'all';

  _cancel('taskClassList');
  const unsubClasses = Db().collection('students').onSnapshot(snap => {
    const classes = new Set();
    snap.forEach(doc => { const c = doc.data().class; if (c) classes.add(c); });
    const sel = document.getElementById('taskTargetClass');
    if (sel) {
      let html = '<option value="">Select a class...</option>';
      [...classes].sort().forEach(c => { html += `<option value="${_esc(c)}">${_esc(c)}</option>`; });
      sel.innerHTML = html;
    }
  });
  _reg('taskClassList', unsubClasses);

  _cancel('tasksList');
  const unsubTasks = Db().collection('coachingTasks').onSnapshot(snap => {
    _renderExistingTasksList(snap.docs);
  });
  _reg('tasksList', unsubTasks);

  _cancel('msgStudents');
  _msgStudentCache = [];
  const unsubStudents = Db().collection('students').orderBy('name').onSnapshot(snap => {
    _msgStudentCache = [];
    snap.forEach(doc => {
      const s = doc.data();
      _msgStudentCache.push({
        id:                 doc.id,
        name:               s.name  || '',
        cls:                s.class || '',
        coachingCompleted:  s.coachingCompleted || {},   // ← for progress table
      });
    });
    _populateMsgSingleSelect();
    _populateMsgCheckboxList();
    _populateTaskStudentSelect();
    if (_taskScope === 'student') {
      _onTaskTargetChange();
    }
    // Re-render progress whenever student data changes
    const taskPanel = document.getElementById('existingTasksList');
    if (taskPanel) {
      // Re-run progress render with the latest task docs
      Db().collection('coachingTasks').get().then(snap => {
        _renderStudentProgress(snap.docs.filter(d => d.id !== 'current'));
      }).catch(() => {});
    }
  });
  _reg('msgStudents', unsubStudents);

  _setTaskScope('all');
}

  function _populateTaskStudentSelect() {
    const sel = document.getElementById('taskTargetStudent');
    if (!sel) return;
    let html = '<option value="">Select a student...</option>';
    _msgStudentCache.forEach(s => {
      html += `<option value="${_esc(s.id)}">${_esc(s.name)} (${_esc(s.cls)})</option>`;
    });
    sel.innerHTML = html;
  }

  /* ── _renderExistingTasksList ── */
  function _renderExistingTasksList(docs) {
  let container = document.getElementById('existingTasksList');
  if (!container) {
    const panel = document.getElementById('teacher-tasks');
    if (!panel) return;
    const inner = panel.querySelector('div[style*="padding:1.25rem 1.5rem"]') || panel;
    container = document.createElement('div');
    container.id = 'existingTasksList';
    container.style.cssText = 'margin-top:1rem;';
    inner.appendChild(container);
  }

  const tasks = docs.filter(d => d.id !== 'current');
  if (tasks.length === 0) { container.innerHTML = ''; return; }

  function scopeLabel(docId) {
    if (docId === 'global')           return { label: 'All Students', color: 'var(--brand,#3b5bdb)',   bg: 'var(--brand-bg,#edf2ff)',    border: 'var(--brand-border,#bac8ff)' };
    if (docId === 'weekly')           return { label: '🔄 Weekly',    color: '#7c3aed',                bg: '#f5f3ff',                    border: '#ddd6fe' };
    if (docId.startsWith('class_'))   return { label: 'Class: ' + docId.replace('class_','').toUpperCase(), color: 'var(--warning,#e8890c)', bg: 'var(--warning-bg,#fff9db)', border: 'var(--warning-border,#ffec99)' };
    if (docId.startsWith('student_')) return { label: 'Student', color: 'var(--success,#2f9e44)', bg: 'var(--success-bg,#ebfbee)', border: 'var(--success-border,#b2f2bb)' };
    return { label: docId, color: 'var(--text-tertiary,#6b7280)', bg: 'var(--surface-muted,#f3f4f6)', border: 'var(--border,#e5e7eb)' };
  }

  function resolveStudentName(docId) {
    if (!docId.startsWith('student_')) return null;
    const uid   = docId.replace('student_', '');
    const found = _msgStudentCache.find(s => s.id === uid);
    return found ? found.name + ' (' + found.cls + ')' : uid;
  }

  container.innerHTML =
    '<div style="border-top:1px solid var(--c-border,#e5e7eb);padding-top:1rem;margin-top:.25rem;">' +
    '<h3 style="font-size:.875rem;font-weight:700;color:var(--c-text,#111827);margin-bottom:.625rem;">Existing Tasks</h3>' +
    '<div style="display:flex;flex-direction:column;gap:.375rem;">' +
    tasks.map(doc => {
      const d            = doc.data();
      const scope        = scopeLabel(doc.id);
      const studentName  = resolveStudentName(doc.id);
      const scopeDisplay = studentName ? 'Student: ' + studentName : scope.label;

      const isWeekly = doc.id === 'weekly' || d.scope === 'weekly';

      let datesDisplay, subjBadge;

      if (isWeekly) {
        datesDisplay = (d.weeklyDays || []).join(', ') || '—';
        const dateSubjects  = d.dateSubjects || {};
        const totalWithSubj = Object.values(dateSubjects).filter(arr => arr.length > 0).length;
        subjBadge = totalWithSubj > 0
          ? '<span style="font-size:.6875rem;font-weight:600;padding:1px 7px;border-radius:99px;' +
            'background:var(--surface-muted,#f3f4f6);color:var(--text-secondary,#374151);' +
            'border:1px solid var(--border,#e5e7eb);" title="Per-day subject restrictions active">' +
            '📚 ' + totalWithSubj + ' day' + (totalWithSubj !== 1 ? 's' : '') + ' restricted</span>'
          : '';
      } else {
        datesDisplay = (d.dates || []).join(', ') || '—';
        const dateSubjects  = d.dateSubjects || {};
        const totalWithSubj = Object.values(dateSubjects).filter(arr => arr.length > 0).length;
        subjBadge = totalWithSubj > 0
          ? '<span style="font-size:.6875rem;font-weight:600;padding:1px 7px;border-radius:99px;' +
            'background:var(--surface-muted,#f3f4f6);color:var(--text-secondary,#374151);' +
            'border:1px solid var(--border,#e5e7eb);" title="Per-date subject restrictions active">' +
            '📚 ' + totalWithSubj + ' date' + (totalWithSubj !== 1 ? 's' : '') + ' restricted</span>'
          : '';
      }

      return '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;' +
             'background:var(--c-surface,#fff);border:1px solid var(--c-border,#e5e7eb);border-radius:8px;padding:.5rem .875rem;">' +
             '<div style="min-width:0;flex:1;">' +
             '<div style="display:flex;align-items:center;gap:.375rem;flex-wrap:wrap;margin-bottom:2px;">' +
             '<span style="font-size:.8125rem;font-weight:700;color:var(--c-text,#111827);">' + _esc(d.title || '—') + '</span>' +
             '<span style="font-size:.6875rem;font-weight:600;padding:1px 7px;border-radius:99px;' +
             'background:' + scope.bg + ';color:' + scope.color + ';border:1px solid ' + scope.border + ';">' +
             _esc(scopeDisplay) + '</span>' +
             '<span style="font-size:.6875rem;font-weight:600;padding:1px 7px;border-radius:99px;' +
             (d.active
               ? 'background:var(--success-bg,#ebfbee);color:var(--success-text,#1a5c29);border:1px solid var(--success-border,#b2f2bb);'
               : 'background:var(--surface-muted,#f3f4f6);color:var(--text-disabled,#9ca3af);border:1px solid var(--border,#e5e7eb);') +
             '">' + (d.active ? 'Active' : 'Inactive') + '</span>' +
             subjBadge +
             '</div>' +
             '<p style="font-size:.6875rem;color:var(--c-text-4,#9ca3af);">' + _esc(datesDisplay) + '</p>' +
             '</div>' +
             '<button class="teacher-delete-task" data-task-id="' + _esc(doc.id) + '"' +
             ' style="background:none;border:none;cursor:pointer;font-size:1rem;line-height:1;' +
             'padding:2px 4px;color:var(--c-text-4,#9ca3af);flex-shrink:0;margin-top:1px;"' +
             ' onmouseenter="this.style.color=&apos;var(--c-danger,#dc2626)&apos;"' +
             ' onmouseleave="this.style.color=&apos;var(--c-text-4,#9ca3af)&apos;">&#215;</button>' +
             '</div>';
    }).join('') +
    '</div></div>';

  // Render progress section below the task list
  _renderStudentProgress(tasks);
}

function _renderStudentProgress(taskDocs) {
  // Find or create progress container (appended after existingTasksList)
  let container = document.getElementById('taskProgressPanel');
  if (!container) {
    const parent = document.getElementById('existingTasksList');
    if (!parent) return;
    container = document.createElement('div');
    container.id = 'taskProgressPanel';
    container.style.cssText = 'margin-top:1.25rem;';
    parent.parentNode.insertBefore(container, parent.nextSibling);
  }

  if (_msgStudentCache.length === 0) { container.innerHTML = ''; return; }

  const activeTasks = taskDocs.filter(doc => {
    const d = doc.data();
    return d.active && (
      (d.dates && d.dates.length > 0) ||
      (d.weeklyDays && d.weeklyDays.length > 0)
    );
  });

  if (activeTasks.length === 0) { container.innerHTML = ''; return; }

  const todayStr = (function() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  // Helper: resolve dates array for a task doc
  function getTaskDates(doc) {
    const d = doc.data();
    if (d.scope === 'weekly' || doc.id === 'weekly') {
      if (window.Tasks && Tasks._resolveWeeklyDates) {
        const resolved = Tasks._resolveWeeklyDates(d);
        return resolved.dates || [];
      }
    }
    return d.dates || [];
  }

  container.innerHTML = activeTasks.map(doc => {
    const d     = doc.data();
    const title = d.title || doc.id;
    const dates = getTaskDates(doc);
    const isWeekly = d.scope === 'weekly' || doc.id === 'weekly';

    // Only show dates up to today (past + today)
    const relevantDates = dates.filter(dt => dt <= todayStr);
    if (relevantDates.length === 0) return '';

    // For each student, compute done / missed per date
    const rows = _msgStudentCache.map(student => {
      const completed = (student.coachingCompleted || {});
      const cells = relevantDates.map(dt => {
        const isDone   = !!completed[dt];
        const isToday  = dt === todayStr;
        const isMissed = !isDone && dt < todayStr;

        const icon  = isDone ? '✓' : isMissed ? '✗' : '○';
        const color = isDone ? 'var(--success,#2f9e44)' : isMissed ? 'var(--danger,#e03131)' : 'var(--warning,#e8890c)';
        const bg    = isDone ? 'var(--success-bg,#ebfbee)' : isMissed ? 'var(--danger-bg,#fff5f5)' : 'var(--warning-bg,#fff9db)';
        const label = isDone ? 'Done' : isMissed ? 'Missed' : 'Today';

        const parts = dt.split('-');
        const dispDate = new Date(+parts[0], +parts[1]-1, +parts[2])
          .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

        return `<td style="text-align:center;padding:.375rem .5rem;border-right:1px solid var(--border,#e5e7eb);">
          <div style="font-size:.5625rem;color:var(--text-disabled,#9ca3af);margin-bottom:1px;">${_esc(dispDate)}</div>
          <div style="font-size:.875rem;font-weight:700;color:${color};">${icon}</div>
          <div style="font-size:.5rem;color:${color};font-weight:600;">${label}</div>
        </td>`;
      }).join('');

      const doneCount   = relevantDates.filter(dt => !!completed[dt]).length;
      const missedCount = relevantDates.filter(dt => !completed[dt] && dt < todayStr).length;

      return `<tr class="progress-student-row" style="border-bottom:1px solid var(--border,#e5e7eb);">
        <td style="padding:.375rem .75rem;white-space:nowrap;border-right:1px solid var(--border,#e5e7eb);">
          <div style="font-size:.8125rem;font-weight:700;color:var(--text-primary,#111827);">${_esc(student.name)}</div>
          <div style="font-size:.6875rem;color:var(--text-tertiary,#6b7280);">${_esc(student.cls)}</div>
        </td>
        ${cells}
        <td style="padding:.375rem .75rem;text-align:center;white-space:nowrap;">
          <div style="font-size:.75rem;font-weight:700;color:${missedCount > 0 ? 'var(--danger,#e03131)' : 'var(--success,#2f9e44)'};">
            ${doneCount}/${relevantDates.length}
          </div>
          ${missedCount > 0
            ? `<div style="font-size:.5625rem;color:var(--danger,#e03131);">${missedCount} missed</div>`
            : doneCount === relevantDates.length && relevantDates.length > 0
              ? '<div style="font-size:.5625rem;color:var(--success,#2f9e44);">All done ✓</div>'
              : ''}
        </td>
      </tr>`;
    }).join('');

    const headerCells = relevantDates.map(dt => {
      const parts = dt.split('-');
      const label = new Date(+parts[0], +parts[1]-1, +parts[2])
        .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      const isToday = dt === todayStr;
      return `<th style="text-align:center;padding:.375rem .5rem;border-right:1px solid var(--border,#e5e7eb);
                         font-size:.6875rem;font-weight:700;
                         color:${isToday ? 'var(--brand,#3b5bdb)' : 'var(--text-secondary,#374151)'};
                         background:var(--surface-subtle,#f9fafb);">${_esc(label)}${isToday ? '<br><span style="font-size:.5rem;color:var(--brand,#3b5bdb);">TODAY</span>' : ''}</th>`;
    }).join('');

    return `<div style="margin-bottom:1rem;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;">
        <div>
          <h4 style="font-size:.875rem;font-weight:700;color:var(--c-text,#111827);">
            📊 Progress: ${_esc(title)}
            ${isWeekly ? '<span style="font-size:.6875rem;font-weight:600;padding:1px 7px;border-radius:99px;background:#f5f3ff;color:#7c3aed;border:1px solid #ddd6fe;margin-left:.375rem;">🔄 Weekly</span>' : ''}
          </h4>
          <p style="font-size:.6875rem;color:var(--text-tertiary,#6b7280);margin-top:1px;">
            Showing ${relevantDates.length} session${relevantDates.length !== 1 ? 's' : ''} up to today
          </p>
        </div>
      </div>
      <div style="overflow-x:auto;border:1px solid var(--border,#e5e7eb);border-radius:8px;">
        <table style="width:100%;border-collapse:collapse;min-width:400px;">
          <thead>
            <tr style="border-bottom:1.5px solid var(--border,#e5e7eb);">
              <th style="text-align:left;padding:.375rem .75rem;border-right:1px solid var(--border,#e5e7eb);
                         font-size:.6875rem;font-weight:700;color:var(--text-secondary,#374151);
                         background:var(--surface-subtle,#f9fafb);">Student</th>
              ${headerCells}
              <th style="text-align:center;padding:.375rem .5rem;font-size:.6875rem;font-weight:700;
                         color:var(--text-secondary,#374151);background:var(--surface-subtle,#f9fafb);">Total</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="99" style="text-align:center;padding:1rem;font-size:.875rem;color:var(--text-tertiary,#6b7280);">No students found.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
  }).filter(Boolean).join('');
}

  async function deleteTask(docId) {
    if (!docId) return;
    const ok = await UI.confirmAction('Delete this task? Students will stop seeing it immediately.');
    if (!ok) return;
    try {
      await Db().collection('coachingTasks').doc(docId).delete();
      UI.toast('Task deleted.', 'success');
    } catch (err) {
      console.error('[teacher] deleteTask error:', err);
      UI.toast('Failed to delete task.', 'error');
    }
  }

  async function deleteAllTasks() {
    const ok = await UI.confirmAction('Delete ALL tasks? Every student will stop seeing their tasks immediately.');
    if (!ok) return;
    try {
      const snap = await Db().collection('coachingTasks').get();
      if (!snap.empty) {
        const batch = Db().batch();
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      UI.toast('All tasks deleted.', 'success');
      _clearTaskForm();
    } catch (err) {
      console.error('[teacher] deleteAllTasks error:', err);
      UI.toast('Failed to delete tasks.', 'error');
    }
  }

  /* ── Private messaging ── */
  let _msgStudentCache = [];
  let _msgMode = 'single';

  function _setMsgMode(mode) {
    _msgMode = mode;
    const singleWrap = document.getElementById('msgSingleWrap');
    const multiWrap  = document.getElementById('msgMultiWrap');
    const singleBtn  = document.getElementById('msgModeSingle');
    const multiBtn   = document.getElementById('msgModeMulti');
    if (!singleWrap || !multiWrap) return;
    if (mode === 'single') {
      singleWrap.style.display = ''; multiWrap.style.display = 'none';
      if (singleBtn) { singleBtn.style.background = 'var(--brand,#3b5bdb)'; singleBtn.style.color = '#fff'; }
      if (multiBtn)  { multiBtn.style.background  = 'var(--surface-muted,#f3f4f6)'; multiBtn.style.color = 'var(--text-tertiary,#6b7280)'; }
    } else {
      singleWrap.style.display = 'none'; multiWrap.style.display = '';
      if (multiBtn)  { multiBtn.style.background  = 'var(--brand,#3b5bdb)'; multiBtn.style.color = '#fff'; }
      if (singleBtn) { singleBtn.style.background = 'var(--surface-muted,#f3f4f6)'; singleBtn.style.color = 'var(--text-tertiary,#6b7280)'; }
      _populateMsgCheckboxList();
    }
  }

  function _populateMsgSingleSelect() {
    const sel = document.getElementById('msgStudent');
    if (!sel) return;
    let html = '<option value="">Select a student...</option>';
    _msgStudentCache.forEach(s => {
      html += `<option value="${_esc(s.id)}">${_esc(s.name)} (${_esc(s.cls)})</option>`;
    });
    sel.innerHTML = html;
  }

  function _populateMsgCheckboxList(filter) {
    const container = document.getElementById('msgStudentList');
    if (!container) return;
    const q = (filter || document.getElementById('msgStudentSearch')?.value || '').toLowerCase();
    const filtered = q
      ? _msgStudentCache.filter(s => s.name.toLowerCase().includes(q) || s.cls.toLowerCase().includes(q))
      : _msgStudentCache;
    if (filtered.length === 0) {
      container.innerHTML = `<p style="font-size:.8125rem;color:var(--text-tertiary,#6b7280);padding:.5rem .75rem;">No students found.</p>`;
      return;
    }
    container.innerHTML = filtered.map(s => `
      <label style="display:flex;align-items:center;gap:.625rem;padding:.4375rem .75rem;
                    cursor:pointer;border-bottom:1px solid var(--border,#e5e7eb);transition:background .1s;"
             onmouseenter="this.style.background='var(--brand-bg,#edf2ff)'"
             onmouseleave="this.style.background=''">
        <input type="checkbox" class="msg-student-cb" value="${_esc(s.id)}"
               onchange="Teacher._updateMsgSelectedCount()"
               style="width:.9375rem;height:.9375rem;accent-color:var(--brand,#3b5bdb);flex-shrink:0;cursor:pointer;" />
        <span style="font-size:.8125rem;color:var(--text-primary,#111827);flex:1;
                     white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${_esc(s.name)}
          <span style="color:var(--text-tertiary,#6b7280);font-size:.75rem;"> — ${_esc(s.cls)}</span>
        </span>
      </label>`).join('');
    _updateMsgSelectedCount();
  }

  function _filterMsgStudents() {
    const checked = new Set([...document.querySelectorAll('.msg-student-cb:checked')].map(cb => cb.value));
    _populateMsgCheckboxList();
    document.querySelectorAll('.msg-student-cb').forEach(cb => {
      if (checked.has(cb.value)) cb.checked = true;
    });
    _updateMsgSelectedCount();
  }

  function _updateMsgSelectedCount() {
    const count = document.querySelectorAll('.msg-student-cb:checked').length;
    const el    = document.getElementById('msgSelectedCount');
    if (el) el.textContent = `${count} selected`;
  }

  function _selectAllMsgStudents() {
    document.querySelectorAll('.msg-student-cb').forEach(cb => { cb.checked = true; });
    _updateMsgSelectedCount();
  }

  function _clearMsgStudents() {
    document.querySelectorAll('.msg-student-cb').forEach(cb => { cb.checked = false; });
    _updateMsgSelectedCount();
  }

  async function sendPrivateMessage() {
    const text     = document.getElementById('msgText')?.value.trim();
    const duration = parseInt(document.getElementById('msgDuration')?.value || '86400000', 10);
    if (!text) { UI.toast('Please write a message.', 'warning'); return; }

    let recipientIds = [];
    if (_msgMode === 'single') {
      const val = document.getElementById('msgStudent')?.value;
      if (!val) { UI.toast('Please select a student.', 'warning'); return; }
      recipientIds = [val];
    } else {
      recipientIds = [...document.querySelectorAll('.msg-student-cb:checked')].map(cb => cb.value);
      if (recipientIds.length === 0) { UI.toast('Please select at least one student.', 'warning'); return; }
    }

    const btn = document.getElementById('sendMsgBtn');
    UI.setLoading(btn, true);
    try {
      const expiresAt = new Date(Date.now() + duration);
      const sentAt    = firebase.firestore.FieldValue.serverTimestamp();
      const batch     = Db().batch();
      recipientIds.forEach(id => {
        batch.set(Db().collection('privateMessages').doc(), {
          recipientId: id, message: text, sentAt, expiresAt, sentBy: 'Master Timothy',
        });
      });
      await batch.commit();
      const msgEl = document.getElementById('msgText');
      if (msgEl) msgEl.value = '';
      _clearMsgStudents();
      const singleSel = document.getElementById('msgStudent');
      if (singleSel) singleSel.value = '';
      UI.toast(`Message sent to ${recipientIds.length === 1 ? '1 student' : recipientIds.length + ' students'}.`, 'success');
    } catch (err) {
      console.error('[teacher] sendPrivateMessage error:', err);
      UI.toast('Failed to send message.', 'error');
    } finally {
      UI.setLoading(btn, false);
    }
  }

  /* -------------------------------------------------- */
  /* Logout                                              */
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
  /* Private helpers                                     */
  /* -------------------------------------------------- */

  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function Db() { return window.fbDb; }

  /* -------------------------------------------------- */
  /* Expose                                              */
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
    deleteTask,
    saveTasksConfig,
    deleteAllTasks,
    sendPrivateMessage,
    _setMsgMode,
    _filterMsgStudents,
    _updateMsgSelectedCount,
    _selectAllMsgStudents,
    _clearMsgStudents,
    _setTaskScope,
    _onTaskTargetChange,
    // Per-date subject helpers — called from onclick inside dynamic HTML
    _selectAllDateSubjects,
    _clearDateSubjects,
  };

})();