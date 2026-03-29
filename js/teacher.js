/* ============================================================
   js/teacher.js — Teacher dashboard (UI v3)
   ============================================================ */

(function () {
  'use strict';

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

function renderTeacherDashboard() {
  AppState.isTeacher = true;

  document.getElementById('app').innerHTML = `
    <div class="max-w-7xl mx-auto glass mt-6" style="margin-bottom:1.5rem;">

      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:0.875rem 1.25rem;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <div style="width:30px;height:30px;background:var(--accent);border-radius:7px;
                      display:flex;align-items:center;justify-content:center;flex-shrink:0;
                      box-shadow:var(--shadow-accent);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white"
                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
              <line x1="12" y1="22" x2="12" y2="15.5"/>
              <polyline points="22 8.5 12 15.5 2 8.5"/>
            </svg>
          </div>
          <div>
            <div style="font-size:var(--text-base);font-weight:600;color:var(--text-1);
                        letter-spacing:-0.015em;line-height:1.2;">
              Teacher Dashboard
            </div>
            <div style="font-size:var(--text-xs);color:var(--text-4);margin-top:1px;">
              Administrator
            </div>
          </div>
        </div>
        <button onclick="Teacher.logout()" class="btn bg-gray-500"
                style="font-size:var(--text-sm);">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </div>

      <div style="display:flex;align-items:center;gap:0.25rem;padding:0.5rem 1.25rem;
                  border-bottom:1px solid var(--border);flex-wrap:wrap;overflow-x:auto;">
        <button onclick="Teacher.showTab('students')" id="tab-students"
                class="tab-btn btn">Students</button>
        <button onclick="Teacher.showTab('results')"  id="tab-results"
                class="tab-btn btn">Results</button>
        <button onclick="Teacher.showTab('schools')"  id="tab-schools"
                class="tab-btn btn">Schools</button>
        <button onclick="Teacher.showTab('tasks')"    id="tab-tasks"
                class="tab-btn btn">Tasks &amp; Messages</button>
        <button onclick="Teacher.showTab('studyroom')" id="tab-studyroom"
                class="tab-btn btn">Study Room</button>
        <div style="width:1px;height:20px;background:var(--border);margin:0 0.25rem;flex-shrink:0;"></div>
        <button onclick="Teacher.showTab('chat')" id="tab-chat"
                class="tab-btn btn bg-green-600"
                style="position:relative;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Chat
        </button>
        <button onclick="Teacher.showTab('dm')" id="tab-dm"
                class="tab-btn btn bg-indigo-600"
                style="position:relative;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Messages
        </button>
      </div>

      <div style="padding:1.25rem 1.5rem;overflow:visible;min-width:0;box-sizing:border-box;max-width:100%;">

        <div id="teacher-students" class="teacher-tab">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
            <div>
              <h2 style="font-size:var(--text-md);font-weight:600;color:var(--text-1);
                          letter-spacing:-0.015em;">Registered Students</h2>
              <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:2px;">Grouped by school</p>
            </div>
            <button onclick="Teacher._loadStudents()" class="btn bg-gray-500"
                    style="font-size:var(--text-sm);">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
              </svg>
              Refresh
            </button>
          </div>
          <div id="studentsList"></div>
        </div>

        <div id="teacher-results" class="teacher-tab hidden">
          <div style="margin-bottom:1rem;">
            <h2 style="font-size:var(--text-md);font-weight:600;color:var(--text-1);
                        letter-spacing:-0.015em;">All Exam Results</h2>
            <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:2px;">
              Most recent first — click any card to review the full attempt
            </p>
          </div>
          <div id="resultsList" class="grid gap-3 md:grid-cols-2 lg:grid-cols-3"></div>
        </div>

        <div id="teacher-schools" class="teacher-tab hidden">
          <div style="margin-bottom:1rem;">
            <h2 style="font-size:var(--text-md);font-weight:600;color:var(--text-1);
                        letter-spacing:-0.015em;">Manage Schools</h2>
            <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:2px;">
              Add, rename, or remove schools from the registration list
            </p>
          </div>
          <div style="display:flex;gap:0.5rem;margin-bottom:1.25rem;max-width:520px;">
            <input id="newSchoolName" type="text" placeholder="New school name" style="flex:1;" />
            <button onclick="Teacher.addSchool()" class="btn"
                    style="white-space:nowrap;font-size:var(--text-sm);">Add School</button>
          </div>
          <div id="schoolsList" class="space-y-2"></div>
        </div>

        <div id="teacher-tasks" class="teacher-tab hidden">
          <div style="margin-bottom:1.25rem;">
            <h2 style="font-size:var(--text-md);font-weight:600;color:var(--text-1);
                        letter-spacing:-0.015em;">Coaching Tasks &amp; Messages</h2>
            <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:2px;">
              Configure scheduled tasks and send private messages to students
            </p>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;" class="tasks-grid">

            <div class="glass-dark" style="padding:1.25rem;border-radius:var(--r-lg);">
              <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;
                          padding-bottom:0.75rem;border-bottom:1px solid var(--border);">
                <div style="width:6px;height:6px;border-radius:50%;background:var(--accent);flex-shrink:0;"></div>
                <h3 style="font-size:var(--text-base);font-weight:600;color:var(--text-1);">
                  Coaching Tasks
                </h3>
              </div>

              <div style="margin-bottom:0.875rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;
                              color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">
                  Recurrence
                </label>
                <div style="display:flex;background:var(--bg-muted);border:1px solid var(--border);
                            border-radius:var(--r-md);padding:3px;gap:3px;">
                  <button id="taskScopeAll" onclick="Teacher._setTaskScope('once')"
                          style="flex:1;padding:0.375rem 0.25rem;font-size:var(--text-xs);font-weight:500;
                                 cursor:pointer;border:none;border-radius:5px;transition:background var(--t-fast),color var(--t-fast),box-shadow var(--t-fast);
                                 background:var(--bg-base);color:var(--text-1);box-shadow:var(--shadow-xs);font-family:inherit;">
                    One-time
                  </button>
                  <button id="taskScopeWeekly" onclick="Teacher._setTaskScope('weekly')"
                          style="flex:1;padding:0.375rem 0.25rem;font-size:var(--text-xs);font-weight:500;
                                 cursor:pointer;border:none;border-radius:5px;transition:background var(--t-fast),color var(--t-fast);
                                 background:transparent;color:var(--text-3);box-shadow:none;font-family:inherit;">
                    Weekly
                  </button>
                  <button id="taskScopeRange" onclick="Teacher._setTaskScope('range')"
                          style="flex:1;padding:0.375rem 0.25rem;font-size:var(--text-xs);font-weight:500;
                                 cursor:pointer;border:none;border-radius:5px;transition:background var(--t-fast),color var(--t-fast);
                                 background:transparent;color:var(--text-3);box-shadow:none;font-family:inherit;">
                    Date Range
                  </button>
                </div>
              </div>

              <div id="taskRecurrenceHint" style="display:none;margin-bottom:0.75rem;padding:0.5rem 0.75rem;
                   background:var(--accent-subtle);border:1px solid var(--accent-border);
                   border-radius:var(--r-md);font-size:var(--text-xs);color:var(--accent-text);line-height:1.6;"></div>

              <div id="taskAssignToWrap" style="margin-bottom:0.875rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;
                              color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">
                  Assign to
                </label>
                <div style="display:flex;background:var(--bg-muted);border:1px solid var(--border);
                            border-radius:var(--r-md);padding:3px;gap:3px;">
                  <button id="taskAssignAll" onclick="Teacher._setAssignScope('all')"
                          style="flex:1;padding:0.375rem 0.25rem;font-size:var(--text-xs);font-weight:500;
                                 cursor:pointer;border:none;border-radius:5px;transition:background var(--t-fast),color var(--t-fast),box-shadow var(--t-fast);
                                 background:var(--bg-base);color:var(--text-1);box-shadow:var(--shadow-xs);font-family:inherit;">
                    All
                  </button>
                  <button id="taskAssignClass" onclick="Teacher._setAssignScope('class')"
                          style="flex:1;padding:0.375rem 0.25rem;font-size:var(--text-xs);font-weight:500;
                                 cursor:pointer;border:none;border-radius:5px;transition:background var(--t-fast),color var(--t-fast);
                                 background:transparent;color:var(--text-3);box-shadow:none;font-family:inherit;">
                    By Class
                  </button>
                  <button id="taskAssignStudent" onclick="Teacher._setAssignScope('student')"
                          style="flex:1;padding:0.375rem 0.25rem;font-size:var(--text-xs);font-weight:500;
                                 cursor:pointer;border:none;border-radius:5px;transition:background var(--t-fast),color var(--t-fast);
                                 background:transparent;color:var(--text-3);box-shadow:none;font-family:inherit;">
                    By Student
                  </button>
                </div>
              </div>

              <div id="taskTargetClassWrap" style="display:none;margin-bottom:0.75rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;
                              color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">
                  Class
                </label>
                <select id="taskTargetClass" onchange="Teacher._onTaskTargetChange()"></select>
              </div>

              <div id="taskTargetStudentWrap" style="display:none;margin-bottom:0.75rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;
                              color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">
                  Student
                </label>
                <select id="taskTargetStudent" onchange="Teacher._onTaskTargetChange()"></select>
              </div>

              <label style="display:flex;align-items:center;gap:0.625rem;margin-bottom:0.875rem;
                            cursor:pointer;padding:0.625rem 0.75rem;border-radius:var(--r-md);
                            border:1px solid var(--border);background:var(--bg-base);">
                <input type="checkbox" id="tasksActive"
                       style="width:1rem;height:1rem;accent-color:var(--accent);flex-shrink:0;cursor:pointer;" />
                <div>
                  <span style="font-size:var(--text-sm);font-weight:500;color:var(--text-1);">Active</span>
                  <span style="display:block;font-size:var(--text-xs);color:var(--text-3);margin-top:1px;">
                    Students only see this task when Active is on
                  </span>
                </div>
              </label>

              <div style="margin-bottom:0.75rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;
                              color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">
                  Task Title
                </label>
                <input type="text" id="tasksTitle" placeholder="e.g. Term 2 Coaching Programme" />
              </div>

              <div style="margin-bottom:0.875rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;
                              color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">
                  Message for Students
                </label>
                <textarea id="tasksMessage" placeholder="Instructions or motivation..."
                          style="height:4rem;resize:vertical;"></textarea>
              </div>

              <div style="margin-bottom:0.875rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;
                              color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">
                  Exam Duration
                  <span style="font-weight:400;text-transform:none;color:var(--text-4);">— for this task</span>
                </label>
                <select id="taskDurationMs">
                  <option value="">Use default (2 hours)</option>
                  <option value="1800000">30 minutes</option>
                  <option value="2700000">45 minutes</option>
                  <option value="3600000">1 hour</option>
                  <option value="5400000">1 hour 30 minutes</option>
                  <option value="7200000">2 hours (default)</option>
                  <option value="9000000">2 hours 30 minutes</option>
                  <option value="10800000">3 hours</option>
                </select>
              </div>

              <div id="taskDateConfigArea"></div>

              <div id="taskRecurringSubjectsWrap" style="display:none;margin-bottom:0.875rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;
                              color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">
                  Subject Restrictions
                  <span style="font-weight:400;text-transform:none;color:var(--text-4);">— per day of week</span>
                </label>
                <div id="taskRecurringSubjectsList"></div>
              </div>

              <div style="display:flex;gap:0.5rem;padding-top:0.875rem;border-top:1px solid var(--border);">
                <button id="saveTasksBtn" onclick="Teacher.saveTasksConfig()"
                        class="btn bg-green-600 hover:bg-green-700"
                        style="flex:1;justify-content:center;font-size:var(--text-sm);">
                  Save &amp; Apply
                </button>
              </div>
            </div>

            <div class="glass-dark" style="padding:1.25rem;border-radius:var(--r-lg);">
              <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;
                          padding-bottom:0.75rem;border-bottom:1px solid var(--border);">
                <div style="width:6px;height:6px;border-radius:50%;background:var(--danger);flex-shrink:0;"></div>
                <h3 style="font-size:var(--text-base);font-weight:600;color:var(--text-1);">
                  Private Message
                </h3>
              </div>

              <div style="margin-bottom:0.75rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.375rem;">
                  <label style="font-size:var(--text-xs);font-weight:500;color:var(--text-3);
                                text-transform:uppercase;letter-spacing:.04em;">Recipients</label>
                  <div style="display:flex;background:var(--bg-muted);border:1px solid var(--border);
                              border-radius:var(--r-sm);padding:2px;gap:2px;">
                    <button id="msgModeSingle" onclick="Teacher._setMsgMode('single')"
                            style="padding:2px 9px;font-size:var(--text-xs);font-weight:500;cursor:pointer;
                                   border:none;border-radius:4px;font-family:inherit;transition:background var(--t-fast),color var(--t-fast),box-shadow var(--t-fast);
                                   background:var(--bg-base);color:var(--text-1);box-shadow:var(--shadow-xs);">
                      Single
                    </button>
                    <button id="msgModeMulti" onclick="Teacher._setMsgMode('multi')"
                            style="padding:2px 9px;font-size:var(--text-xs);font-weight:500;cursor:pointer;
                                   border:none;border-radius:4px;font-family:inherit;transition:background var(--t-fast),color var(--t-fast);
                                   background:transparent;color:var(--text-3);">
                      Multiple
                    </button>
                  </div>
                </div>
                <div id="msgSingleWrap">
                  <select id="msgStudent"><option value="">Select a student...</option></select>
                </div>
                <div id="msgMultiWrap" style="display:none;">
                  <input id="msgStudentSearch" type="text" placeholder="Search students..."
                         oninput="Teacher._filterMsgStudents()" style="margin-bottom:0.375rem;" />
                  <div id="msgStudentList"
                       style="max-height:160px;overflow-y:auto;border:1px solid var(--border);
                              border-radius:var(--r-md);background:var(--bg-base);"></div>
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-top:0.375rem;">
                    <span id="msgSelectedCount" style="font-size:var(--text-xs);color:var(--text-3);">0 selected</span>
                    <div style="display:flex;gap:0.375rem;align-items:center;">
                      <button onclick="Teacher._selectAllMsgStudents()"
                              style="font-size:var(--text-xs);font-weight:500;color:var(--accent);
                                     background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">
                        Select all
                      </button>
                      <span style="color:var(--border-strong);">·</span>
                      <button onclick="Teacher._clearMsgStudents()"
                              style="font-size:var(--text-xs);font-weight:500;color:var(--text-3);
                                     background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div style="margin-bottom:0.75rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;
                              color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">
                  Message
                </label>
                <textarea id="msgText" placeholder="Write your private message..."
                          style="height:6rem;resize:vertical;"></textarea>
              </div>

              <div style="margin-bottom:0.875rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;
                              color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">
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

              <div style="padding-top:0.875rem;border-top:1px solid var(--border);">
                <button id="sendMsgBtn" onclick="Teacher.sendPrivateMessage()"
                        class="btn bg-red-600 hover:bg-red-700"
                        style="width:100%;justify-content:center;font-size:var(--text-sm);">
                  Send Private Message
                </button>
              </div>
            </div>

          </div>
        </div>

        <div id="teacher-studyroom" class="teacher-tab hidden"></div>
        <div id="teacher-dm" class="teacher-tab hidden"></div>

      </div>
    </div>`;

  const existing = document.getElementById('_teacherGridStyle');
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = '_teacherGridStyle';
  style.textContent = `
    @media (max-width:768px) { .tasks-grid { grid-template-columns:1fr !important; } }
    .teacher-result-card {
      cursor:pointer;
      transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;
    }
    .teacher-result-card:hover {
      transform:translateY(-2px);
      box-shadow:var(--shadow-md);
      border-color:var(--accent-border) !important;
    }
    #teacherReviewModal {
      position:fixed;inset:0;background:var(--bg-overlay);z-index:1200;
      display:flex;align-items:flex-start;justify-content:center;
      padding:1.25rem;overflow-y:auto;
      backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
      animation:cbt-overlay-in .16s ease-out both;
    }
    #teacherReviewModal .review-panel {
      background:var(--bg-base);border:1px solid var(--border);
      border-radius:var(--r-xl);padding:1.5rem;width:100%;max-width:760px;margin:auto;
      box-shadow:var(--shadow-xl);
      animation:cbt-modal-in .24s cubic-bezier(.34,1.45,.64,1) both;
    }
    .review-q-card { border-radius:var(--r-md);padding:1rem;border-width:1px;border-style:solid; }
    .review-q-card--correct  { border-color:var(--success-border);background:var(--success-subtle); }
    .review-q-card--wrong    { border-color:var(--danger-border);background:var(--danger-subtle); }
    .review-q-card--skipped  { border-color:var(--border);background:var(--bg-subtle); }
    .progress-week-row summary { cursor:pointer;list-style:none;user-select:none; }
    .progress-week-row summary::-webkit-details-marker { display:none; }
    #teacherEditStudentModal {
      position:fixed;inset:0;background:var(--bg-overlay);z-index:1300;
      display:flex;align-items:center;justify-content:center;
      padding:1.25rem;overflow-y:auto;
      backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
      animation:cbt-overlay-in .16s ease-out both;
    }
  `;
  document.head.appendChild(style);

  _startGlobalStudentCache();
  showTab('students');
}

function showTab(tab) {
  ['students','results','schools','tasks','studyroom','chat','dm'].forEach(t => {
    const el  = document.getElementById(`teacher-${t}`);
    const btn = document.getElementById(`tab-${t}`);
    if (el) {
      if (t === 'dm' && t !== tab) {
        el.innerHTML = '';
      }
      el.classList.toggle('hidden', t !== tab);
    }
    if (btn) btn.classList.toggle('active', t === tab);
  });

  if (tab === 'dm') {
    DM.openTeacherInbox();
    return;
  }

  if (tab === 'chat')      { Chat.openPublicChat();       return; }
  if (tab === 'studyroom') { StudyRoom.openForTeacher();  return; }
  if (tab === 'students')  _loadStudents();
  if (tab === 'results')   _loadResults();
  if (tab === 'schools')   _loadSchools();
  if (tab === 'tasks')     _loadTasksManager();
}

  function _loadStudents() {
  const container = document.getElementById('studentsList');
  if (!container) return;
  container.innerHTML = `
    <div style="text-align:center;padding:2rem;color:var(--text-3);font-size:var(--text-sm);">
      Loading students...</div>`;

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
          <div style="text-align:center;padding:2rem;color:var(--text-3);font-size:var(--text-sm);">
            No students registered yet.</div>`;
        return;
      }
      container.innerHTML = schools.map(school => {
        const students = bySchool[school];
        return `
          <details class="glass-dark overflow-hidden mb-3" style="border-radius:10px;" open>
            <summary style="cursor:pointer;">
              <span style="font-weight:700;font-size:var(--text-base);">${_esc(school)}</span>
              <span style="margin-left:.5rem;font-size:var(--text-xs);font-weight:500;
                           background:var(--accent-subtle);color:var(--accent-text);
                           border:1px solid var(--accent-border);
                           padding:1px 7px;border-radius:99px;">${students.length}</span>
            </summary>
            <div style="padding:.875rem 1rem;">
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.625rem;">
                ${students.map(s => {
                  const joined = s.createdAt
                    ? new Date(s.createdAt.toDate ? s.createdAt.toDate() : s.createdAt).toLocaleDateString()
                    : '—';
                  const admno = s.admissionNo ? `<p style="font-size:var(--text-xs);color:var(--accent);
                    margin-top:2px;font-weight:600;">🪪 ${_esc(s.admissionNo)}</p>` : '';
                  return `
                    <div style="position:relative;background:var(--bg-base);
                                border:1px solid var(--border);border-radius:8px;
                                padding:.75rem .875rem .75rem 2.25rem;">
                      <button class="teacher-toggle-admin"
                              data-uid="${_esc(s.id)}" data-name="${_esc(s.name)}"
                              data-is-admin="${s.isAdmin ? 'true' : 'false'}"
                              aria-label="Toggle admin for ${_esc(s.name)}"
                              style="position:absolute;top:.5rem;left:.5rem;background:none;border:none;
                                     cursor:pointer;font-size:.875rem;line-height:1;padding:2px;
                                     color:${s.isAdmin ? 'var(--warning)' : 'var(--border-strong)'};">
                        ${s.isAdmin ? '★' : '☆'}
                      </button>
                      <button class="teacher-edit-student" data-uid="${_esc(s.id)}"
                              aria-label="Edit ${_esc(s.name)}"
                              style="position:absolute;top:.375rem;right:1.625rem;background:none;border:none;
                                     cursor:pointer;font-size:.75rem;line-height:1;padding:2px 4px;
                                     color:var(--accent);font-weight:700;"
                              onmouseenter="this.style.color='var(--accent-hover)'"
                              onmouseleave="this.style.color='var(--accent)'">✎</button>
                      <button class="teacher-delete-student" data-uid="${_esc(s.id)}"
                              aria-label="Delete ${_esc(s.name)}"
                              style="position:absolute;top:.375rem;right:.5rem;background:none;border:none;
                                     cursor:pointer;font-size:1rem;line-height:1;padding:2px 4px;
                                     color:var(--text-4);"
                              onmouseenter="this.style.color='var(--danger)'"
                              onmouseleave="this.style.color='var(--text-4)'">×</button>
                      <p style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:1rem;">
                        ${_esc(s.name)}</p>
                      <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:1px;">${_esc(s.class || '—')}</p>
                      <p style="font-size:var(--text-xs);color:var(--text-4);margin-top:3px;
                                overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(s.email || '')}</p>
                      ${admno}
                      <p style="font-size:var(--text-xs);color:var(--text-4);margin-top:4px;">Joined ${joined}</p>
                    </div>`;
                }).join('')}
              </div>
            </div>
          </details>`;
      }).join('');
    },
    err => {
      console.error('[teacher] Error loading students:', err);
      container.innerHTML = `<p style="text-align:center;color:var(--danger);font-size:var(--text-sm);">Error loading students.</p>`;
    }
  );
  _reg('students', unsub);
}

  document.addEventListener('click', async e => {
  const deleteBtn = e.target.closest('.teacher-delete-student');
  if (deleteBtn) { await removeStudent(deleteBtn.dataset.uid); return; }
  const editBtn = e.target.closest('.teacher-edit-student');
  if (editBtn) { await editStudent(editBtn.dataset.uid); return; }
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
    // 1. Fetch student record first (need name + admissionNo before deleting)
    const studentSnap = await Db().collection('students').doc(uid).get();
    const studentData = studentSnap.exists ? studentSnap.data() : null;
    const name        = studentData ? studentData.name        : null;
    const admissionNo = studentData ? studentData.admissionNo : null;

    const batch = Db().batch();

    // 2. Delete student profile
    batch.delete(Db().collection('students').doc(uid));

    // 3. Delete ongoing exam
    batch.delete(Db().collection('ongoingExams').doc(uid));

    // 4. Delete chat notification doc
    batch.delete(Db().collection('chatNotifications').doc(uid));

    // 5. Delete admission number lookup doc (if one exists)
    if (admissionNo) {
      batch.delete(Db().collection('admissionNumbers').doc(admissionNo.toUpperCase()));
    }

    // 6. Delete student-specific coaching task docs
    batch.delete(Db().collection('coachingTasks').doc('student_' + uid));
    batch.delete(Db().collection('coachingTasks').doc('weekly_student_' + uid));

    await batch.commit();

    // 7. Delete exam results (query-based — can't batch without IDs upfront)
    let resultSnap = await Db().collection('results').where('uid', '==', uid).get();
    if (resultSnap.empty && name) {
      resultSnap = await Db().collection('results').where('name', '==', name).get();
    }
    if (!resultSnap.empty) {
      const resultBatch = Db().batch();
      resultSnap.forEach(d => resultBatch.delete(d.ref));
      await resultBatch.commit();
    }

    // 8. Delete private messages sent to this student
    const privateMsgSnap = await Db()
      .collection('privateMessages')
      .where('recipientId', '==', uid)
      .get();
    if (!privateMsgSnap.empty) {
      const pmBatch = Db().batch();
      privateMsgSnap.forEach(d => pmBatch.delete(d.ref));
      await pmBatch.commit();
    }

    // 9. Delete the DM thread subcollection messages, then the thread doc itself
    //    Firestore does not auto-delete subcollections, so we must do it manually.
    const dmThreadRef = Db().collection('directMessages').doc(uid);
    const dmMsgSnap   = await dmThreadRef.collection('messages').get();
    if (!dmMsgSnap.empty) {
      // Delete in chunks of 400 to stay within batch limits
      const allMsgRefs = dmMsgSnap.docs.map(d => d.ref);
      for (let i = 0; i < allMsgRefs.length; i += 400) {
        const msgBatch = Db().batch();
        allMsgRefs.slice(i, i + 400).forEach(ref => msgBatch.delete(ref));
        await msgBatch.commit();
      }
    }
    await dmThreadRef.delete();

    UI.toast('Student and all associated data deleted.', 'success');

  } catch (err) {
    console.error('[teacher] removeStudent error:', err);
    UI.toast('Failed to delete student. Please try again.', 'error');
  }
}

async function editStudent(uid) {
  if (!uid) return;

  let studentData;
  try {
    const snap = await Db().collection('students').doc(uid).get();
    if (!snap.exists) { UI.toast('Student not found.', 'error'); return; }
    studentData = snap.data();
  } catch (err) {
    console.error('[teacher] editStudent fetch error:', err);
    UI.toast('Failed to load student data.', 'error');
    return;
  }

  const existing = document.getElementById('teacherEditStudentModal');
  if (existing) existing.remove();

  const classOptions = ['JSS1','JSS2','JSS3','SSS1','SSS2','SSS3','TUTORIAL']
    .map(c => `<option value="${c}" ${studentData.class === c ? 'selected' : ''}>${c}</option>`)
    .join('');

  const overlay = document.createElement('div');
  overlay.id = 'teacherEditStudentModal';

  overlay.innerHTML = `
    <div style="background:var(--bg-base);border:1px solid var(--border);
                border-radius:12px;padding:1.5rem;width:100%;max-width:440px;margin:auto;
                box-shadow:var(--shadow-xl);
                animation:cbt-modal-in .22s cubic-bezier(.34,1.45,.64,1) both;">

      <div style="display:flex;align-items:center;justify-content:space-between;
                  margin-bottom:1.25rem;padding-bottom:.875rem;
                  border-bottom:1px solid var(--border);">
        <div>
          <h2 style="font-size:1rem;font-weight:700;color:var(--text-1);">Edit Student</h2>
          <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:2px;">
            ${_esc(studentData.name || '')} &bull; UID: ${_esc(uid.slice(0,8))}…
          </p>
        </div>
        <button onclick="document.getElementById('teacherEditStudentModal').remove()"
                style="background:none;border:none;cursor:pointer;font-size:1.25rem;
                       line-height:1;color:var(--text-3);padding:2px 6px;"
                onmouseenter="this.style.color='var(--danger)'"
                onmouseleave="this.style.color='var(--text-3)'">×</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:.875rem;">

        <div>
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-2);margin-bottom:.3125rem;">Full Name</label>
          <input id="editStudentName" type="text" value="${_esc(studentData.name || '')}"
                 placeholder="Student's full name"
                 style="width:100%;box-sizing:border-box;" />
        </div>

        <div>
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-2);margin-bottom:.3125rem;">Class</label>
          <select id="editStudentClass" style="width:100%;box-sizing:border-box;">
            ${classOptions}
          </select>
        </div>

        <div>
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-2);margin-bottom:.3125rem;">School</label>
          <select id="editStudentSchool" style="width:100%;box-sizing:border-box;">
            <option value="" disabled>Loading schools…</option>
          </select>
        </div>

        <div>
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-2);margin-bottom:.3125rem;">
            Admission / Registration Number
            <span style="font-weight:400;color:var(--text-3);">— optional</span>
          </label>
          <input id="editStudentAdmno" type="text"
                 value="${_esc(studentData.admissionNo || '')}"
                 placeholder="e.g. VTX-2024-001"
                 style="width:100%;box-sizing:border-box;text-transform:uppercase;"
                 oninput="this.value=this.value.toUpperCase()" />
          <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:.25rem;line-height:1.5;">
            Must be unique. Students can use this to log in instead of their email.
            Leave blank to remove.
          </p>
        </div>

        <div style="padding:.625rem .875rem;background:var(--bg-subtle);
                    border:1px solid var(--border);border-radius:8px;
                    font-size:var(--text-xs);color:var(--text-3);line-height:1.6;">
          ℹ️ Email address cannot be changed here. To update a student's email,
          the student must contact you and re-register with the new email.
        </div>

      </div>

      <div style="display:flex;gap:.625rem;margin-top:1.25rem;padding-top:.875rem;
                  border-top:1px solid var(--border);">
        <button onclick="document.getElementById('teacherEditStudentModal').remove()"
                class="btn bg-gray-500 hover:bg-gray-600"
                style="flex:1;justify-content:center;font-size:var(--text-sm);">
          Cancel
        </button>
        <button id="editStudentSaveBtn"
                onclick="Teacher._saveStudentEdit('${_esc(uid)}', '${_esc(studentData.admissionNo || '')}')"
                class="btn bg-blue-600 hover:bg-blue-700"
                style="flex:1;justify-content:center;font-size:var(--text-sm);">
          Save Changes
        </button>
      </div>

    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });

  try {
    const schoolsSnap = await Db().collection('schools').orderBy('name').get();
    const schoolSel   = document.getElementById('editStudentSchool');
    if (schoolSel) {
      let html = '<option value="" disabled>Select school</option>';
      if (schoolsSnap.empty) {
        html += `<option value="${_esc(studentData.school || '')}" selected>${_esc(studentData.school || 'No schools listed')}</option>`;
      } else {
        schoolsSnap.forEach(doc => {
          const n = _esc(doc.data().name);
          html += `<option value="${n}" ${studentData.school === doc.data().name ? 'selected' : ''}>${n}</option>`;
        });
        const names = schoolsSnap.docs.map(d => d.data().name);
        if (studentData.school && !names.includes(studentData.school)) {
          html += `<option value="${_esc(studentData.school)}" selected>${_esc(studentData.school)} (current)</option>`;
        }
      }
      schoolSel.innerHTML = html;
    }
  } catch (err) {
    console.warn('[teacher] editStudent school load error:', err);
    const schoolSel = document.getElementById('editStudentSchool');
    if (schoolSel) {
      schoolSel.innerHTML = `<option value="${_esc(studentData.school || '')}" selected>${_esc(studentData.school || '—')}</option>`;
    }
  }
}

async function _saveStudentEdit(uid, previousAdmno) {
  const btn       = document.getElementById('editStudentSaveBtn');
  const nameEl    = document.getElementById('editStudentName');
  const classEl   = document.getElementById('editStudentClass');
  const schoolEl  = document.getElementById('editStudentSchool');
  const admnoEl   = document.getElementById('editStudentAdmno');

  const name   = (nameEl?.value   || '').trim();
  const cls    = (classEl?.value  || '').trim();
  const school = (schoolEl?.value || '').trim();
  const admno  = (admnoEl?.value  || '').trim().toUpperCase();

  if (!name)   { UI.toast('Name cannot be empty.',  'warning'); return; }
  if (!cls)    { UI.toast('Please select a class.', 'warning'); return; }
  if (!school) { UI.toast('Please select a school.','warning'); return; }

  if (admno && !/^[A-Z0-9\-_]{1,30}$/.test(admno)) {
    UI.toast(
      'Admission number can only contain letters, numbers, hyphens, and underscores (max 30 characters).',
      'warning',
      6000
    );
    return;
  }

  UI.setLoading(btn, true);

  try {
    const admnoChanged     = admno !== previousAdmno.toUpperCase();
    const removingAdmno    = admnoChanged && admno === '';
    const addingOrChanging = admnoChanged && admno !== '';

    if (addingOrChanging) {
      const existingSnap = await Db().collection('admissionNumbers').doc(admno).get();
      if (existingSnap.exists && existingSnap.data().uid !== uid) {
        UI.toast(
          `Admission number "${admno}" is already assigned to another student.`,
          'error',
          7000
        );
        UI.setLoading(btn, false);
        return;
      }
    }

    const studentSnap = await Db().collection('students').doc(uid).get();
    if (!studentSnap.exists) {
      UI.toast('Student record not found. It may have been deleted.', 'error');
      UI.setLoading(btn, false);
      return;
    }
    const email = studentSnap.data().email || '';

    const batch = Db().batch();

    // Update student profile
    batch.update(Db().collection('students').doc(uid), {
      name,
      class:       cls,
      school,
      admissionNo: admno || null,
    });

    // Update denormalized name in DM thread doc
    batch.set(Db().collection('directMessages').doc(uid), {
      studentName:  name,
      studentClass: cls,
    }, { merge: true });

    // Update denormalized name in student-specific coaching task docs
    batch.set(Db().collection('coachingTasks').doc('student_' + uid), {
      studentName: name,
    }, { merge: true });
    batch.set(Db().collection('coachingTasks').doc('weekly_student_' + uid), {
      studentName: name,
    }, { merge: true });

    if (addingOrChanging) {
      batch.set(Db().collection('admissionNumbers').doc(admno), { uid, email });
      if (previousAdmno) {
        batch.delete(Db().collection('admissionNumbers').doc(previousAdmno.toUpperCase()));
      }
    } else if (removingAdmno && previousAdmno) {
      batch.delete(Db().collection('admissionNumbers').doc(previousAdmno.toUpperCase()));
    }

    await batch.commit();

    // Update denormalized name in all result documents for this student
    try {
      const resultsSnap = await Db().collection('results').where('uid', '==', uid).get();
      if (!resultsSnap.empty) {
        const resultsBatch = Db().batch();
        resultsSnap.forEach(d => resultsBatch.update(d.ref, { name }));
        await resultsBatch.commit();
      }
    } catch (e) {
      console.warn('[teacher] Could not update name in results:', e);
    }

    // Update denormalized name in all public chat messages from this student
    try {
      const chatSnap = await Db().collection('publicChat').where('senderId', '==', uid).get();
      if (!chatSnap.empty) {
        const chatBatch = Db().batch();
        chatSnap.forEach(d => chatBatch.update(d.ref, { senderName: name, senderClass: cls }));
        await chatBatch.commit();
      }
    } catch (e) {
      console.warn('[teacher] Could not update name in public chat:', e);
    }

    UI.toast(`Student record updated successfully.`, 'success');
    document.getElementById('teacherEditStudentModal')?.remove();

  } catch (err) {
    console.error('[teacher] _saveStudentEdit error:', err);
    const msg = err.code === 'permission-denied'
      ? 'Permission denied. Are you logged in as a teacher?'
      : 'Failed to save changes. Please try again.';
    UI.toast(msg, 'error');
  } finally {
    UI.setLoading(btn, false);
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

  function _loadResults() {
    const container = document.getElementById('resultsList');
    if (!container) return;
    _cancel('results');
    const unsub = Db().collection('results').orderBy('timestamp', 'desc').onSnapshot(
      snap => {
        if (snap.empty) {
          container.innerHTML = `
            <p style="grid-column:1/-1;text-align:center;padding:2rem;
                      color:var(--text-3);font-size:var(--text-sm);">No results yet.</p>`;
          return;
        }
        container.innerHTML = snap.docs.map(doc => {
          const r = doc.data();
          const gradeColor = r.grade === 'A' ? 'var(--success)'
                           : r.grade === 'B' ? 'var(--info)'
                           : r.grade === 'C' ? 'var(--warning)'
                           : r.grade === 'D' ? 'var(--warning)'
                           : 'var(--danger)';
          const pct = r.percentage || 0;
          const ts  = r.timestamp
            ? new Date(r.timestamp.toDate ? r.timestamp.toDate() : r.timestamp).toLocaleDateString()
            : '—';
          const hasDetail = !!(r.questionSnapshots);
          return `
            <div class="teacher-result-card" data-result-id="${_esc(doc.id)}"
                 title="${hasDetail ? 'Click to review full attempt' : 'No detailed data'}"
                 style="position:relative;background:var(--bg-base);
                        border:1px solid var(--border);border-radius:10px;
                        padding:.875rem 1rem;overflow:hidden;">
              <button class="teacher-delete-result" data-id="${_esc(doc.id)}" aria-label="Delete result"
                      style="position:absolute;top:.5rem;right:.625rem;background:none;border:none;
                             cursor:pointer;font-size:1rem;line-height:1;padding:2px 4px;
                             color:var(--text-4);z-index:2;"
                      onmouseenter="this.style.color='var(--danger)'"
                      onmouseleave="this.style.color='var(--text-4)'">×</button>
              <div style="display:flex;align-items:flex-start;gap:.625rem;margin-bottom:.625rem;">
                <div style="min-width:48px;height:48px;border-radius:8px;
                            background:var(--bg-subtle);border:1px solid var(--border);
                            display:flex;flex-direction:column;align-items:center;
                            justify-content:center;flex-shrink:0;">
                  <span style="font-size:var(--text-xs);font-weight:700;color:${gradeColor};line-height:1;">${pct}%</span>
                  <span style="font-size:1rem;font-weight:800;color:${gradeColor};line-height:1;margin-top:1px;">
                    ${_esc(r.grade || '?')}</span>
                </div>
                <div style="min-width:0;flex:1;padding-right:1.25rem;">
                  <p style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);
                             white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(r.name || '')}</p>
                  <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:1px;">
                    ${_esc(r.class || '')} · ${_esc(r.school || '')}</p>
                </div>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:.25rem;margin-bottom:.5rem;">
                ${(r.subjects || []).map(s => `
                  <span style="font-size:var(--text-xs);font-weight:600;
                               background:var(--bg-subtle);border:1px solid var(--border);
                               border-radius:4px;padding:1px 6px;color:var(--text-2);">
                    ${_esc(s)}: ${r.scores?.[s] || 0}%
                  </span>`).join('')}
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <p style="font-size:var(--text-xs);color:var(--text-4);">${ts}</p>
                ${hasDetail
                  ? `<span style="font-size:var(--text-xs);font-weight:600;color:var(--accent-text);
                                  background:var(--accent-subtle);border:1px solid var(--accent-border);
                                  border-radius:4px;padding:1px 7px;">View attempt →</span>`
                  : `<span style="font-size:var(--text-xs);color:var(--text-4);font-style:italic;">No detail</span>`}
              </div>
            </div>`;
        }).join('');
      },
      err => {
        console.error('[teacher] Error loading results:', err);
        container.innerHTML = `
          <p style="grid-column:1/-1;text-align:center;color:var(--danger);font-size:var(--text-sm);">
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

  async function _openReviewModal(resultId) {
    const existing = document.getElementById('teacherReviewModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'teacherReviewModal';
    overlay.innerHTML = `
      <div class="review-panel" style="text-align:center;padding:3rem 1.5rem;">
        <div style="font-size:var(--text-base);color:var(--text-3);">Loading attempt…</div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });

    let r;
    try {
      const snap = await Db().collection('results').doc(resultId).get();
      if (!snap.exists) {
        overlay.querySelector('.review-panel').innerHTML = `
          <p style="color:var(--danger);font-size:var(--text-base);">Result not found.</p>
          <button onclick="document.getElementById('teacherReviewModal').remove()"
                  class="btn bg-gray-500" style="margin-top:1rem;">Close</button>`;
        return;
      }
      r = snap.data();
    } catch (err) {
      overlay.querySelector('.review-panel').innerHTML = `
        <p style="color:var(--danger);font-size:var(--text-base);">Failed to load result.</p>
        <button onclick="document.getElementById('teacherReviewModal').remove()"
                class="btn bg-gray-500" style="margin-top:1rem;">Close</button>`;
      return;
    }

    const gradeColor = r.grade === 'A' ? 'var(--success)'
                     : r.grade === 'B' ? 'var(--info)'
                     : r.grade === 'C' ? 'var(--warning)'
                     : r.grade === 'D' ? 'var(--warning)'
                     : 'var(--danger)';
    const ts = r.timestamp
      ? new Date(r.timestamp.toDate ? r.timestamp.toDate() : r.timestamp)
          .toLocaleString('en-GB', { dateStyle:'medium', timeStyle:'short' })
      : '—';

    if (!r.questionSnapshots) {
      overlay.querySelector('.review-panel').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;">
          <div>
            <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">${_esc(r.name || '')}</h2>
            <p style="font-size:var(--text-sm);color:var(--text-3);margin-top:2px;">
              ${_esc(r.class || '')} · ${_esc(r.school || '')} · ${ts}</p>
          </div>
          <button onclick="document.getElementById('teacherReviewModal').remove()"
                  class="btn bg-gray-500" style="font-size:var(--text-sm);">Close</button>
        </div>
        <div style="padding:2rem;text-align:center;background:var(--bg-subtle);
                    border-radius:8px;border:1px solid var(--border);">
          <p style="font-size:2rem;">📋</p>
          <p style="font-size:var(--text-base);font-weight:600;color:var(--text-1);margin-top:.5rem;">
            Detailed attempt data not available</p>
          <p style="font-size:var(--text-sm);color:var(--text-3);margin-top:.375rem;line-height:1.6;">
            This result was submitted before per-question tracking was introduced.</p>
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
        const chosenColor = isCorrect ? 'var(--success)' : isSkipped ? 'var(--text-4)' : 'var(--danger)';
        const chosenText  = isSkipped ? 'Not answered' : _escQ(q.opts?.[q.chosen] ?? '—');
        const correctText = _escQ(q.opts?.[q.ans] ?? '—');
        return `
          <div class="review-q-card ${cardClass}">
            <p style="font-size:var(--text-base);font-weight:600;margin-bottom:.75rem;line-height:1.6;">
              ${i + 1}. ${_escQ(q.q)}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;font-size:var(--text-sm);margin-bottom:.75rem;">
              <div>
                <span style="font-weight:600;color:var(--text-3);">Student answered:</span>
                <span style="display:block;margin-top:2px;font-weight:500;color:${chosenColor};">${chosenText}</span>
              </div>
              <div>
                <span style="font-weight:600;color:var(--text-3);">Correct answer:</span>
                <span style="display:block;margin-top:2px;font-weight:500;color:var(--success);">${correctText}</span>
              </div>
            </div>
            ${q.exp ? `
              <div style="background:var(--bg-subtle);border:1px solid var(--border);
                          border-radius:6px;padding:.5625rem .875rem;font-size:var(--text-sm);
                          color:var(--text-2);line-height:1.6;">
                <span style="font-weight:600;">Explanation:</span> ${_escQ(q.exp)}
              </div>` : ''}
          </div>`;
      }).join('');
      return `
        <details style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:.75rem;">
          <summary style="padding:.875rem 1.125rem;font-size:var(--text-base);font-weight:700;cursor:pointer;
                          background:var(--bg-subtle);display:flex;align-items:center;
                          justify-content:space-between;list-style:none;user-select:none;">
            <span>${_esc(subj)}</span>
            <span style="font-size:var(--text-sm);font-weight:600;
                         color:${pct >= 50 ? 'var(--success)' : 'var(--danger)'};">
              ${correctCount}/${qs.length} correct · ${pct}%</span>
          </summary>
          <div style="padding:1rem;display:flex;flex-direction:column;gap:.75rem;">
            ${questionsHtml || '<p style="font-size:var(--text-sm);color:var(--text-3);">No questions found.</p>'}
          </div>
        </details>`;
    }).join('');

    overlay.querySelector('.review-panel').innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;
                  margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid var(--border);">
        <div>
          <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">${_esc(r.name || '')}</h2>
          <p style="font-size:var(--text-sm);color:var(--text-3);margin-top:3px;">
            ${_esc(r.class || '')} · ${_esc(r.school || '')}</p>
          <p style="font-size:var(--text-xs);color:var(--text-4);margin-top:2px;">${ts}</p>
        </div>
        <button onclick="document.getElementById('teacherReviewModal').remove()"
                class="btn bg-gray-500" style="font-size:var(--text-sm);flex-shrink:0;">Close</button>
      </div>
      <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;
                  background:var(--bg-subtle);border:1px solid var(--border);
                  border-radius:8px;padding:.875rem 1.125rem;margin-bottom:1.25rem;">
        <div style="text-align:center;min-width:60px;">
          <div style="font-size:2rem;font-weight:800;color:${gradeColor};line-height:1;">${r.percentage || 0}%</div>
          <div style="font-size:var(--text-sm);font-weight:700;color:${gradeColor};">Grade ${_esc(r.grade || '?')}</div>
        </div>
        <div style="flex:1;display:flex;flex-wrap:wrap;gap:.375rem;">
          ${(r.subjects || []).map(s => `
            <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:6px;
                        padding:.375rem .75rem;text-align:center;min-width:80px;">
              <div style="font-size:var(--text-xs);color:var(--text-3);font-weight:500;">${_esc(s)}</div>
              <div style="font-size:var(--text-base);font-weight:700;color:var(--text-1);">${r.scores?.[s] || 0}%</div>
              <div style="font-size:var(--text-xs);color:var(--text-4);">
                ${r.correctCounts?.[s] ?? '?'}/${(r.questionSnapshots?.[s] || []).length}</div>
            </div>`).join('')}
        </div>
      </div>
      <div>${subjectBlocks || '<p style="font-size:var(--text-sm);color:var(--text-3);">No subjects found.</p>'}</div>`;

    if (window._katexAutoRenderReady && window.renderMathInElement) {
      requestAnimationFrame(() => {
        try {
          renderMathInElement(overlay, {
            delimiters: [
              { left:'$$', right:'$$', display:true  },
              { left:'$',  right:'$',  display:false },
              { left:'\\(', right:'\\)', display:false },
              { left:'\\[', right:'\\]', display:true  },
            ],
            throwOnError: false,
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
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _loadSchools() {
    const container = document.getElementById('schoolsList');
    if (!container) return;
    container.innerHTML = `<p style="font-size:var(--text-sm);color:var(--text-3);">Loading...</p>`;
    _cancel('schools');
    const unsub = Db().collection('schools').orderBy('name').onSnapshot(
      snap => {
        if (snap.empty) {
          container.innerHTML = `<p style="font-size:var(--text-sm);color:var(--text-3);">No schools added yet.</p>`;
          return;
        }
        container.innerHTML = snap.docs.map(doc => `
          <div style="display:flex;align-items:center;justify-content:space-between;
                      background:var(--bg-base);border:1px solid var(--border);
                      border-radius:8px;padding:.625rem 1rem;">
            <p style="font-size:var(--text-base);font-weight:500;color:var(--text-1);">${_esc(doc.data().name)}</p>
            <div style="display:flex;gap:.375rem;align-items:center;">
              <button class="teacher-rename-school btn bg-blue-600"
                      data-id="${_esc(doc.id)}" data-name="${_esc(doc.data().name)}"
                      style="font-size:var(--text-xs);padding:.3125rem .75rem;">Rename</button>
              <button class="teacher-delete-school" data-id="${_esc(doc.id)}" data-name="${_esc(doc.data().name)}"
                      style="background:none;border:none;cursor:pointer;font-size:1rem;
                             line-height:1;padding:2px 4px;color:var(--text-4);"
                      onmouseenter="this.style.color='var(--danger)'"
                      onmouseleave="this.style.color='var(--text-4)'">×</button>
            </div>
          </div>`).join('');
      },
      err => {
        console.error('[teacher] Error loading schools:', err);
        container.innerHTML = `<p style="color:var(--danger);font-size:var(--text-sm);">Error loading schools.</p>`;
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

  const btn = document.querySelector('#teacher-schools button[onclick="Teacher.addSchool()"]');
  UI.setLoading(btn, true);
  try {
    const snap = await Db().collection('schools').where('name', '==', name).get();
    if (!snap.empty) {
      UI.toast('This school name already exists.', 'warning');
      UI.setLoading(btn, false);
      return;
    }
    await Db().collection('schools').add({ name });
    if (input) input.value = '';
    UI.toast(`School "${name}" added.`, 'success');
  } catch (err) {
    console.error('[teacher] addSchool error:', err);
    UI.toast('Failed to add school.', 'error');
  } finally {
    UI.setLoading(btn, false);
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
      `Delete "${schoolName}" from the list?\n\nStudents already registered keep their school name.`
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

  let _taskScope   = 'once';
  let _assignScope = 'all';

  function _setTaskScope(scope) {
  _taskScope = scope;

  const btnOnce   = document.getElementById('taskScopeAll');
  const btnWeekly = document.getElementById('taskScopeWeekly');
  const btnRange  = document.getElementById('taskScopeRange');

  [btnOnce, btnWeekly, btnRange].forEach(b => {
    if (!b) return;
    b.style.background = 'transparent';
    b.style.color      = 'var(--text-3)';
    b.style.boxShadow  = 'none';
  });

  const active = scope === 'weekly' ? btnWeekly : scope === 'range' ? btnRange : btnOnce;
  if (active) {
    active.style.background = 'var(--bg-base)';
    active.style.color      = 'var(--text-1)';
    active.style.boxShadow  = 'var(--shadow-xs)';
  }

  const hint = document.getElementById('taskRecurrenceHint');
  if (hint) {
    if (scope === 'weekly') {
      hint.style.display = '';
      hint.innerHTML = '<strong>Weekly</strong>: runs every week between Start Date and End Date. Pick which days of the week are active.';
    } else if (scope === 'range') {
      hint.style.display = '';
      hint.innerHTML = '<strong>Date Range</strong>: runs every selected weekday between Start Date and End Date.';
    } else {
      hint.style.display = 'none';
      hint.innerHTML = '';
    }
  }

  _renderDateConfigArea();
  _renderRecurringSubjectPicker();
  _clearTaskFormDates();
}

  function _renderDateConfigArea() {
    const area = document.getElementById('taskDateConfigArea');
    if (!area) return;

    if (_taskScope === 'once') {
      area.innerHTML = `
        <div style="margin-bottom:.875rem;">
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-2);margin-bottom:.375rem;">
            Task Dates &amp; Subjects
          </label>
          <p style="font-size:var(--text-xs);color:var(--text-3);margin-bottom:.5rem;line-height:1.5;">
            Add each specific date, then choose which subjects are required for that day.
            Leave all unchecked = no subject restriction.
          </p>
          <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem;">
            <input type="date" id="newTaskDate" style="flex:1;" />
            <button onclick="Teacher.addTaskDate()" class="btn"
                    style="white-space:nowrap;padding:.5rem .875rem;font-size:var(--text-sm);">+ Add</button>
          </div>
          <div id="tasksDates" class="space-y-1"></div>
        </div>`;

    } else {
      const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      const rangeLabel = _taskScope === 'range' ? 'Active weekdays' : 'Days of week';

      area.innerHTML = `
        <div style="margin-bottom:.875rem;">
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-2);margin-bottom:.375rem;">Start Date <span style="color:var(--danger);">*</span></label>
          <input type="date" id="taskStartDate" style="width:100%;" />
        </div>
        <div style="margin-bottom:.875rem;">
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-2);margin-bottom:.375rem;">
            End Date
            <span style="font-weight:400;color:var(--text-3);">— leave blank for open-ended</span>
          </label>
          <input type="date" id="taskEndDate" style="width:100%;" />
        </div>
        <div style="margin-bottom:.875rem;">
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-2);margin-bottom:.375rem;">${_esc(rangeLabel)}</label>
          <div style="display:flex;flex-wrap:wrap;gap:.375rem;">
            ${dayNames.map(day => `
              <label style="display:flex;align-items:center;gap:.375rem;font-size:var(--text-sm);
                            cursor:pointer;padding:.3125rem .625rem;border-radius:6px;
                            border:1px solid var(--border);background:var(--bg-base);">
                <input type="checkbox" class="task-day-cb" value="${day}"
                       style="width:.875rem;height:.875rem;accent-color:var(--accent);cursor:pointer;" />
                ${day.slice(0,3)}
              </label>`).join('')}
          </div>
          ${_taskScope === 'range'
            ? `<p style="font-size:var(--text-xs);color:var(--text-3);margin-top:.375rem;line-height:1.4;">
                 Leave all unchecked to run every calendar day in the range.
               </p>`
            : ''}
        </div>`;
    }

    const rswWrap = document.getElementById('taskRecurringSubjectsWrap');
    if (rswWrap) rswWrap.style.display = _taskScope !== 'once' ? '' : 'none';
  }

  function _renderRecurringSubjectPicker() {
    const wrap = document.getElementById('taskRecurringSubjectsList');
    if (!wrap) return;
    if (_taskScope === 'once') { wrap.innerHTML = ''; return; }

    const subjects = _getSubjectsForCurrentScope();
    if (subjects.length === 0) {
      wrap.innerHTML = `<p style="font-size:var(--text-sm);color:var(--text-3);font-style:italic;">
        Select a target first to see available subjects.</p>`;
      return;
    }

    const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    wrap.innerHTML = dayNames.map(day => `
      <details style="border:1px solid var(--border);border-radius:8px;
                      overflow:hidden;margin-bottom:.375rem;">
        <summary style="padding:.4375rem .75rem;font-size:var(--text-sm);font-weight:600;cursor:pointer;
                        background:var(--bg-subtle);display:flex;align-items:center;
                        justify-content:space-between;list-style:none;user-select:none;">
          <span>${day}</span>
          <span class="recurring-day-count-${day}" style="font-size:var(--text-xs);color:var(--text-3);">
            (all subjects)
          </span>
        </summary>
        <div style="padding:.5rem .75rem;">
          <div style="display:flex;gap:.5rem;margin-bottom:.375rem;">
            <button onclick="Teacher._selectAllDaySubjects('${day}')"
                    style="font-size:var(--text-xs);font-weight:600;color:var(--accent);
                           background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">All</button>
            <span style="color:var(--border-strong);">·</span>
            <button onclick="Teacher._clearDaySubjects('${day}')"
                    style="font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                           background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">None</button>
          </div>
          ${subjects.map(subj => `
            <label style="display:flex;align-items:center;gap:.5rem;padding:.25rem 0;
                          font-size:var(--text-sm);cursor:pointer;">
              <input type="checkbox" class="recurring-day-subj-cb" data-day="${day}" value="${_esc(subj)}"
                     onchange="Teacher._updateDaySubjCount('${day}')"
                     style="width:.875rem;height:.875rem;accent-color:var(--accent);cursor:pointer;" />
              ${_esc(subj)}
            </label>`).join('')}
        </div>
      </details>`).join('');
  }

  function _selectAllDaySubjects(day) {
    document.querySelectorAll(`.recurring-day-subj-cb[data-day="${day}"]`)
      .forEach(cb => { cb.checked = true; });
    _updateDaySubjCount(day);
  }

  function _clearDaySubjects(day) {
    document.querySelectorAll(`.recurring-day-subj-cb[data-day="${day}"]`)
      .forEach(cb => { cb.checked = false; });
    _updateDaySubjCount(day);
  }

  function _updateDaySubjCount(day) {
    const count = document.querySelectorAll(`.recurring-day-subj-cb[data-day="${day}"]:checked`).length;
    const label = document.querySelector(`.recurring-day-count-${day}`);
    if (!label) return;
    label.textContent = count === 0 ? '(all subjects)' : `(${count} restricted)`;
    label.style.color = count === 0 ? 'var(--text-3)' : 'var(--accent)';
  }

  function _setAssignScope(scope) {
  _assignScope = scope;

  const btnAll     = document.getElementById('taskAssignAll');
  const btnClass   = document.getElementById('taskAssignClass');
  const btnStudent = document.getElementById('taskAssignStudent');
  const classWrap  = document.getElementById('taskTargetClassWrap');
  const studWrap   = document.getElementById('taskTargetStudentWrap');

  [btnAll, btnClass, btnStudent].forEach(b => {
    if (!b) return;
    b.style.background = 'transparent';
    b.style.color      = 'var(--text-3)';
    b.style.boxShadow  = 'none';
  });

  const active = scope === 'class' ? btnClass : scope === 'student' ? btnStudent : btnAll;
  if (active) {
    active.style.background = 'var(--bg-base)';
    active.style.color      = 'var(--text-1)';
    active.style.boxShadow  = 'var(--shadow-xs)';
  }

  if (classWrap) classWrap.style.display = scope === 'class'   ? '' : 'none';
  if (studWrap)  studWrap.style.display  = scope === 'student' ? '' : 'none';

  _renderRecurringSubjectPicker();
  _onTaskTargetChange();
}

  function _clearTaskFormDates() {
    const datesEl = document.getElementById('tasksDates');
    if (datesEl) datesEl.innerHTML = '';
  }

  function _clearTaskForm() {
    const activeEl    = document.getElementById('tasksActive');
    const titleEl     = document.getElementById('tasksTitle');
    const messageEl   = document.getElementById('tasksMessage');
    const startEl     = document.getElementById('taskStartDate');
    const endEl       = document.getElementById('taskEndDate');
    const durationEl  = document.getElementById('taskDurationMs');
    if (activeEl)   activeEl.checked  = false;
    if (titleEl)    titleEl.value     = '';
    if (messageEl)  messageEl.value   = '';
    if (startEl)    startEl.value     = '';
    if (endEl)      endEl.value       = '';
    if (durationEl) durationEl.value  = '';
    document.querySelectorAll('.task-day-cb').forEach(cb => { cb.checked = false; });
    document.querySelectorAll('.recurring-day-subj-cb').forEach(cb => { cb.checked = false; });
    _clearTaskFormDates();
  }

  function _currentTaskDocId() {
    const prefix = _taskScope !== 'once' ? 'weekly' : '';

    if (_assignScope === 'all') return prefix || 'global';

    if (_assignScope === 'class') {
      const sel = document.getElementById('taskTargetClass');
      const cls = sel ? sel.value.trim() : '';
      if (!cls) return null;
      const key = 'class_' + cls.replace(/\s+/g,'').toLowerCase();
      return prefix ? prefix + '_' + key : key;
    }

    if (_assignScope === 'student') {
      const sel = document.getElementById('taskTargetStudent');
      const uid = sel ? sel.value.trim() : '';
      if (!uid) return null;
      const key = 'student_' + uid;
      return prefix ? prefix + '_' + key : key;
    }

    return null;
  }

  function _onTaskTargetChange() {
    if (_taskScope !== 'once') {
      _renderRecurringSubjectPicker();
      return;
    }

    const datesEl = document.getElementById('tasksDates');
    if (!datesEl) return;
    const data = Array.from(datesEl.querySelectorAll('.task-date-row'))
      .map(r => r.dataset.date);
    datesEl.innerHTML = '';
    data.forEach(date => _appendDateItem(date, []));
  }

  function _getSubjectsForCurrentScope() {
    const qBank = window.questions || {};

    if (_assignScope === 'all') {
      const all = new Set();
      Object.values(qBank).forEach(cls => Object.keys(cls).forEach(s => all.add(s)));
      return [...all].sort();
    }

    if (_assignScope === 'class') {
      const sel = document.getElementById('taskTargetClass');
      const cls = sel ? sel.value.trim() : '';
      if (!cls) return [];
      return Object.keys(qBank[cls.replace(/\s+/g,'').toLowerCase()] || {}).sort();
    }

    if (_assignScope === 'student') {
      const sel = document.getElementById('taskTargetStudent');
      const uid = sel ? sel.value.trim() : '';
      if (!uid) return [];
      const student = _msgStudentCache.find(s => s.id === uid);
      if (!student || !student.cls) return [];
      return Object.keys(qBank[student.cls.replace(/\s+/g,'').toLowerCase()] || {}).sort();
    }

    return [];
  }

  function addTaskDate() {
    const container = document.getElementById('tasksDates');
    if (!container) return;
    const dateInput = document.getElementById('newTaskDate');
    const val = dateInput ? dateInput.value.trim() : '';
    if (!val) { UI.toast('Please select a date first.', 'warning'); return; }
    const existing = Array.from(container.querySelectorAll('.task-date-row')).map(r => r.dataset.date);
    if (existing.includes(val)) { UI.toast('This date is already in the list.', 'warning'); return; }
    _appendDateItem(val, []);
    if (dateInput) dateInput.value = '';
  }

  function _appendDateItem(dateStr, preselected) {
    const container = document.getElementById('tasksDates');
    if (!container) return;
    preselected = preselected || [];

    const subjects = _getSubjectsForCurrentScope();
    const parts    = dateStr.split('-');
    const label    = new Date(+parts[0], +parts[1] - 1, +parts[2])
      .toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });

    const subjectCheckboxesHtml = subjects.length > 0
      ? subjects.map(subj => `
          <label style="display:flex;align-items:center;gap:.5rem;padding:.3125rem .625rem;cursor:pointer;
                        border-bottom:1px solid var(--border);"
                 onmouseenter="this.style.background='var(--accent-subtle)'"
                 onmouseleave="this.style.background=''">
            <input type="checkbox" class="date-subj-cb" value="${_esc(subj)}"
                   ${preselected.includes(subj) ? 'checked' : ''}
                   style="width:.875rem;height:.875rem;accent-color:var(--accent);cursor:pointer;" />
            <span style="font-size:var(--text-sm);color:var(--text-1);">${_esc(subj)}</span>
          </label>`).join('')
      : `<p style="font-size:var(--text-sm);color:var(--text-3);padding:.5rem .75rem;font-style:italic;">
           No subjects available.</p>`;

    const div = document.createElement('div');
    div.className    = 'task-date-row';
    div.dataset.date = dateStr;
    div.style.cssText = `border:1.5px solid var(--accent-border);border-radius:8px;
      overflow:hidden;margin-bottom:.5rem;background:var(--bg-base);`;

    div.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:.5rem .75rem;background:var(--accent-subtle);cursor:pointer;"
           onclick="this.nextElementSibling.style.display =
                    this.nextElementSibling.style.display === 'none' ? '' : 'none'">
        <div style="display:flex;align-items:center;gap:.5rem;">
          <span style="font-size:var(--text-sm);font-weight:700;color:var(--accent-text);">${_esc(label)}</span>
          <span class="date-subj-count" style="font-size:var(--text-xs);font-weight:600;color:var(--text-3);">
            (all subjects)</span>
        </div>
        <div style="display:flex;align-items:center;gap:.375rem;">
          <span style="font-size:var(--text-xs);color:var(--accent);">▾ subjects</span>
          <button onclick="event.stopPropagation();this.closest('.task-date-row').remove()"
                  style="background:none;border:none;cursor:pointer;font-size:1rem;
                         line-height:1;padding:2px 4px;color:var(--danger);">×</button>
        </div>
      </div>
      <div style="border-top:1px solid var(--border);">
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:.375rem .75rem;background:var(--bg-subtle);
                    border-bottom:1px solid var(--border);">
          <span style="font-size:var(--text-xs);font-weight:600;color:var(--text-3);">
            Subjects <span style="font-weight:400;">(leave all unchecked = no restriction)</span>
          </span>
          <div style="display:flex;gap:.375rem;">
            <button onclick="Teacher._selectAllDateSubjects(this)"
                    style="font-size:var(--text-xs);font-weight:600;color:var(--accent);
                           background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">All</button>
            <span style="color:var(--border-strong);">·</span>
            <button onclick="Teacher._clearDateSubjects(this)"
                    style="font-size:var(--text-xs);font-weight:600;color:var(--text-3);
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
    label.textContent = checked === 0 ? '(all subjects)' : `(${checked} subject${checked !== 1 ? 's' : ''} required)`;
    label.style.color = checked === 0 ? 'var(--text-3)' : 'var(--accent)';
  }

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

  async function saveTasksConfig() {
    const docId = _currentTaskDocId();
    if (!docId) {
      if (_assignScope === 'class')   { UI.toast('Please select a class.',   'warning'); return; }
      if (_assignScope === 'student') { UI.toast('Please select a student.', 'warning'); return; }
      UI.toast('No valid target selected.', 'warning');
      return;
    }

    const active  = !!document.getElementById('tasksActive')?.checked;
    const title   = document.getElementById('tasksTitle')?.value.trim()   || '';
    const message = document.getElementById('tasksMessage')?.value.trim() || '';

    const durationRaw = document.getElementById('taskDurationMs')?.value;
    const durationMs  = durationRaw ? parseInt(durationRaw, 10) : null;

    if (!title) { UI.toast('Please enter a task title.', 'warning'); return; }

    let payload;

    if (_taskScope === 'once') {
      const dateRows = Array.from(document.querySelectorAll('.task-date-row'));
      if (dateRows.length === 0) { UI.toast('Please add at least one date.', 'warning'); return; }

      const dates        = dateRows.map(r => r.dataset.date).filter(Boolean);
      const dateSubjects = {};
      dateRows.forEach(row => {
        dateSubjects[row.dataset.date] =
          [...row.querySelectorAll('.date-subj-cb:checked')].map(cb => cb.value);
      });

      payload = {
        recurrence:  'once',
        active, title,
        message:     message || 'Complete the required exams on the scheduled dates.',
        dates,
        dateSubjects,
        durationMs:  durationMs || null,
        assignScope: _assignScope,
        updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
      };

      if (_assignScope === 'class') {
        const sel = document.getElementById('taskTargetClass');
        if (sel) payload.className = sel.value;
      }
      if (_assignScope === 'student') {
        const sel = document.getElementById('taskTargetStudent');
        const opt = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
        if (sel)  payload.studentUid  = sel.value;
        if (opt)  payload.studentName = opt.text;
      }

    } else {
      const startDate = document.getElementById('taskStartDate')?.value.trim() || '';
      const endDate   = document.getElementById('taskEndDate')?.value.trim()   || null;

      if (!startDate) { UI.toast('Please set a start date.', 'warning'); return; }
      if (endDate && endDate < startDate) {
        UI.toast('End date must be after start date.', 'warning'); return;
      }

      const checkedDays = [...document.querySelectorAll('.task-day-cb:checked')].map(cb => cb.value);
      if (_taskScope === 'weekly' && checkedDays.length === 0) {
        UI.toast('Please select at least one day of the week.', 'warning'); return;
      }

      const dateSubjects = {};
      const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      dayNames.forEach(day => {
        const selected = [...document.querySelectorAll(`.recurring-day-subj-cb[data-day="${day}"]:checked`)]
          .map(cb => cb.value);
        if (selected.length > 0) dateSubjects[day] = selected;
      });

      payload = {
        recurrence:  _taskScope,
        active, title,
        message:     message || 'Complete the required exams on the scheduled dates.',
        startDate,
        endDate:     endDate || null,
        weeklyDays:  checkedDays,
        dateSubjects,
        durationMs:  durationMs || null,
        assignScope: _assignScope,
        updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
      };

      if (_assignScope === 'class') {
        const sel = document.getElementById('taskTargetClass');
        if (sel) payload.className = sel.value;
      }
      if (_assignScope === 'student') {
        const sel = document.getElementById('taskTargetStudent');
        const opt = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
        if (sel)  payload.studentUid  = sel.value;
        if (opt)  payload.studentName = opt.text;
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
      UI.toast('Failed to save task' + (err?.code ? ' (' + err.code + ')' : '') + '.', 'error');
    } finally {
      UI.setLoading(btn, false);
    }
  }
  
  function _startGlobalStudentCache() {
  _cancel('msgStudents');
  _msgStudentCache = [];
  const unsub = Db().collection('students').orderBy('name').onSnapshot(snap => {
    _msgStudentCache = [];
    snap.forEach(doc => {
      const s = doc.data();
      _msgStudentCache.push({
        id:                doc.id,
        name:              s.name  || '',
        cls:               s.class || '',
        coachingCompleted: s.coachingCompleted || {},
      });
    });
    _populateMsgSingleSelect();
    _populateMsgCheckboxList();
    _populateTaskStudentSelect();
    const existingTasksList = document.getElementById('existingTasksList');
    if (existingTasksList) {
      Db().collection('coachingTasks').get().then(snap => {
        _renderExistingTasksList(snap.docs);
      }).catch(() => {});
    }
  });
  _reg('msgStudents', unsub);
}

  function _loadTasksManager() {
  _cancel('tasksManager');
  _taskScope   = 'once';
  _assignScope = 'all';

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

  // Re-populate form dropdowns from the already-live global cache
  _populateMsgSingleSelect();
  _populateMsgCheckboxList();
  _populateTaskStudentSelect();

  _setTaskScope('once');
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

function _renderExistingTasksList(docs) {
    let container = document.getElementById('existingTasksList');
    if (!container) {
      const panel = document.getElementById('teacher-tasks');
      if (!panel) return;
      const inner = panel.querySelector('[style*="padding:1.25rem 1.5rem"]') || panel;
      container = document.createElement('div');
      container.id = 'existingTasksList';
      container.style.cssText = 'margin-top:1rem;';
      inner.appendChild(container);
    }

    const tasks = docs.filter(d => d.id !== 'current');
    if (tasks.length === 0) { container.innerHTML = ''; _renderStudentProgress([]); return; }

    function scopeLabel(docId) {
      if (docId === 'global')
        return { label:'All Students', color:'var(--accent-text)', bg:'var(--accent-subtle)', border:'var(--accent-border)' };
      if (docId === 'weekly')
        return { label:'🔄 Recurring · All', color:'var(--accent-text)', bg:'var(--accent-subtle)', border:'var(--accent-border)' };
      if (docId.startsWith('weekly_class_'))
        return { label:'🔄 Recurring · Class: ' + docId.replace('weekly_class_','').toUpperCase(), color:'var(--accent-text)', bg:'var(--accent-subtle)', border:'var(--accent-border)' };
      if (docId.startsWith('weekly_student_'))
        return { label:'🔄 Recurring · Student', color:'var(--accent-text)', bg:'var(--accent-subtle)', border:'var(--accent-border)' };
      if (docId.startsWith('class_'))
        return { label:'Class: ' + docId.replace('class_','').toUpperCase(), color:'var(--warning-text)', bg:'var(--warning-subtle)', border:'var(--warning-border)' };
      if (docId.startsWith('student_'))
        return { label:'Student', color:'var(--success-text)', bg:'var(--success-subtle)', border:'var(--success-border)' };
      return { label:docId, color:'var(--text-3)', bg:'var(--bg-subtle)', border:'var(--border)' };
    }

    function resolveStudentName(docId) {
      const prefix = docId.startsWith('weekly_student_') ? 'weekly_student_'
                   : docId.startsWith('student_')        ? 'student_'
                   : null;
      if (!prefix) return null;
      const uid   = docId.replace(prefix,'');
      const found = _msgStudentCache.find(s => s.id === uid);
      return found ? found.name + ' (' + found.cls + ')' : uid;
    }

    function isRecurringTask(doc) {
      const d = doc.data();
      return d.recurrence === 'weekly' ||
             d.recurrence === 'range'  ||
             doc.id === 'weekly'       ||
             doc.id.startsWith('weekly_');
    }

    container.innerHTML =
      '<div style="border-top:1px solid var(--border);padding-top:1rem;margin-top:.25rem;">' +
      '<h3 style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);margin-bottom:.625rem;">Existing Tasks</h3>' +
      '<div style="display:flex;flex-direction:column;gap:.375rem;">' +
      tasks.map(doc => {
        const d           = doc.data();
        const scope       = scopeLabel(doc.id);
        const studentName = resolveStudentName(doc.id);
        const scopeDisp   = studentName
          ? (doc.id.startsWith('weekly_') ? '🔄 Recurring · Student: ' : 'Student: ') + studentName
          : scope.label;

        const recurring = isRecurringTask(doc);

        let datesDisplay;
        if (recurring) {
          const dayList = (d.weeklyDays && d.weeklyDays.length > 0)
          ? d.weeklyDays.join(', ')
          : (d.recurrence === 'range' ? 'All days in range' : '—');
          const start   = d.startDate || '?';
          const end     = d.endDate   || 'open-ended';
          datesDisplay  = `${d.recurrence || 'recurring'} · ${dayList} · ${start} → ${end}`;
        } else {
          datesDisplay = (d.dates || []).join(', ') || '—';
        }

        return '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;' +
          'background:var(--bg-base);border:1px solid var(--border);border-radius:8px;padding:.5rem .875rem;">' +
          '<div style="min-width:0;flex:1;">' +
          '<div style="display:flex;align-items:center;gap:.375rem;flex-wrap:wrap;margin-bottom:2px;">' +
          `<span style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);">${_esc(d.title || '—')}</span>` +
          `<span style="font-size:var(--text-xs);font-weight:600;padding:1px 7px;border-radius:99px;` +
          `background:${scope.bg};color:${scope.color};border:1px solid ${scope.border};">${_esc(scopeDisp)}</span>` +
          `<span style="font-size:var(--text-xs);font-weight:600;padding:1px 7px;border-radius:99px;` +
          (d.active
            ? 'background:var(--success-subtle);color:var(--success-text);border:1px solid var(--success-border);'
            : 'background:var(--bg-subtle);color:var(--text-4);border:1px solid var(--border);') +
          '">' + (d.active ? 'Active' : 'Inactive') + '</span>' +
          '</div>' +
          `<p style="font-size:var(--text-xs);color:var(--text-4);word-break:break-all;">${_esc(datesDisplay)}</p>` +
          '</div>' +
          '<div style="display:flex;gap:.375rem;align-items:center;flex-shrink:0;margin-top:1px;">' +
          `<button onclick="Teacher.exportTaskReportPDF('${_esc(doc.id)}')"` +
          ` style="background:var(--accent);color:var(--text-inverse);border:none;cursor:pointer;` +
          `font-size:var(--text-xs);font-weight:700;padding:3px 9px;border-radius:4px;` +
          `white-space:nowrap;font-family:inherit;line-height:1.5;` +
          `transition:background .12s;" ` +
          `onmouseenter="this.style.background='var(--accent-hover)'" onmouseleave="this.style.background='var(--accent)'"` +
          `title="Export attendance & progress report as PDF">📄 PDF</button>` +
          `<button class="teacher-delete-task" data-task-id="${_esc(doc.id)}"` +
          ` style="background:none;border:none;cursor:pointer;font-size:1rem;line-height:1;` +
          `padding:2px 4px;color:var(--text-4);"` +
          ` onmouseenter="this.style.color='var(--danger)'"` +
          ` onmouseleave="this.style.color='var(--text-4)'">&times;</button>` +
          '</div>' +
          '</div>';
      }).join('') +
      '</div></div>';

    _renderStudentProgress(tasks);
  }

  function _renderStudentProgress(taskDocs) {
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

    const activeTasks = taskDocs.filter(doc => doc.data().active);

    if (activeTasks.length === 0) { container.innerHTML = ''; return; }

    function _localDate(d) {
      const dt = d || new Date();
      return dt.getFullYear() + '-' +
        String(dt.getMonth() + 1).padStart(2, '0') + '-' +
        String(dt.getDate()).padStart(2, '0');
    }

    const todayStr = (window.Tasks && Tasks._localDateStr) ? Tasks._localDateStr() : _localDate();

    function getTaskDates(doc) {
      const d = doc.data();
      return (window.Tasks && Tasks._resolveTaskDates)
        ? Tasks._resolveTaskDates(d, { upToDate: todayStr })
        : [];
    }

    function getStudentsForTask(doc) {
      const id = doc.id;
      if (id === 'global' || id === 'weekly') return _msgStudentCache;
      if (id.startsWith('weekly_class_')) {
        const cls = id.replace('weekly_class_', '');
        return _msgStudentCache.filter(s => s.cls.replace(/\s+/g, '').toLowerCase() === cls);
      }
      if (id.startsWith('weekly_student_')) {
        const uid = id.replace('weekly_student_', '');
        return _msgStudentCache.filter(s => s.id === uid);
      }
      if (id.startsWith('class_')) {
        const cls = id.replace('class_', '');
        return _msgStudentCache.filter(s => s.cls.replace(/\s+/g, '').toLowerCase() === cls);
      }
      if (id.startsWith('student_')) {
        const uid = id.replace('student_', '');
        return _msgStudentCache.filter(s => s.id === uid);
      }
      return [];
    }

    function groupByWeek(dates) {
      const weeks = {};
      dates.forEach(dateStr => {
        const parts  = dateStr.split('-');
        const date   = new Date(+parts[0], +parts[1] - 1, +parts[2]);
        const dow    = date.getDay();
        const diff   = dow === 0 ? -6 : 1 - dow;
        const monday = new Date(date);
        monday.setDate(date.getDate() + diff);
        const weekKey = _localDate(monday);
        if (!weeks[weekKey]) weeks[weekKey] = [];
        weeks[weekKey].push(dateStr);
      });
      return Object.keys(weeks).sort().reverse().map(weekKey => ({
        weekKey,
        dates: weeks[weekKey].sort(),
      }));
    }

    function weekLabel(weekKey) {
      const parts  = weekKey.split('-');
      const monday = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const opts = { day: 'numeric', month: 'short' };
      return monday.toLocaleDateString('en-GB', opts) + ' – ' + sunday.toLocaleDateString('en-GB', opts);
    }

    function isRecurringDoc(doc) {
      const d = doc.data();
      return d.recurrence === 'weekly' || d.recurrence === 'range' ||
             doc.id === 'weekly' || doc.id.startsWith('weekly_');
    }

    container.innerHTML = activeTasks.map(doc => {
      const d        = doc.data();
      const title    = d.title || doc.id;
      const allDates = getTaskDates(doc);
      const students = getStudentsForTask(doc);

      if (allDates.length === 0 || students.length === 0) return '';

      const recurring = isRecurringDoc(doc);
      const weeks     = groupByWeek(allDates);
      if (weeks.length === 0) return '';

      const weeksHTML = weeks.map((weekObj, wIdx) => {
        const { weekKey, dates: weekDates } = weekObj;

        const pastWeekDates = weekDates.filter(dt => dt <= todayStr);
        const allStudentsDone = pastWeekDates.length > 0 && students.every(student => {
          const comp = student.coachingCompleted || {};
          return pastWeekDates.every(dt => !!comp[dt]);
        });

        const studentRows = students.map(student => {
          const completed   = student.coachingCompleted || {};
          const doneDates   = weekDates.filter(dt => !!completed[dt]);
          const missedDates = weekDates.filter(dt => dt < todayStr && !completed[dt]);
          const doneCount   = doneDates.length;
          const missedCount = missedDates.length;
          const totalPast   = weekDates.filter(dt => dt <= todayStr).length;

          const statusColor = missedCount > 0
            ? 'var(--danger)'
            : doneCount === totalPast && totalPast > 0
              ? 'var(--success)'
              : 'var(--text-3)';

          const dayDots = weekDates.map(dt => {
            const isDone   = !!completed[dt];
            const isPast   = dt < todayStr;
            const isToday  = dt === todayStr;
            const isMissed = isPast && !isDone;
            const icon     = isDone ? '✓' : isMissed ? '✗' : isToday ? '○' : '–';
            const color    = isDone    ? 'var(--success)'
                           : isMissed  ? 'var(--danger)'
                           : isToday   ? 'var(--warning)'
                           : 'var(--border-strong)';
            const parts2   = dt.split('-');
            const dayLabel = new Date(+parts2[0], +parts2[1] - 1, +parts2[2])
              .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            return `<div style="text-align:center;min-width:60px;">` +
              `<div style="font-size:var(--text-xs);color:var(--text-4);">${_esc(dayLabel)}</div>` +
              `<div style="font-size:1rem;font-weight:700;color:${color};">${icon}</div>` +
              `</div>`;
          }).join('');

          return `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:.375rem .75rem;white-space:nowrap;border-right:1px solid var(--border);">
              <div style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);">${_esc(student.name)}</div>
              <div style="font-size:var(--text-xs);color:var(--text-3);">${_esc(student.cls)}</div>
            </td>
            <td style="padding:.375rem .75rem;text-align:center;border-right:1px solid var(--border);">
              <span style="font-size:var(--text-sm);font-weight:700;color:${statusColor};">${doneCount}/${totalPast}</span>
              ${missedCount > 0
                ? `<div style="font-size:var(--text-xs);color:var(--danger);">${missedCount} missed</div>` : ''}
            </td>
            <td style="padding:.375rem .75rem;">
              <div style="display:flex;gap:.625rem;flex-wrap:wrap;">${dayDots}</div>
            </td>
          </tr>`;
        }).join('');

        const wLabel = weekLabel(weekKey);

        return `<details class="progress-week-row" ${wIdx === 0 ? 'open' : ''} style="margin-bottom:.375rem;">
          <summary style="padding:.5rem .875rem;border-radius:8px;
                          background:${allStudentsDone ? 'var(--success-subtle)' : 'var(--bg-subtle)'};
                          border:1px solid ${allStudentsDone ? 'var(--success-border)' : 'var(--border)'};
                          display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:.5rem;">
              <span style="font-size:var(--text-xs);color:var(--text-3);">▶</span>
              <span style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);">${_esc(wLabel)}</span>
              <span style="font-size:var(--text-xs);font-weight:600;padding:1px 6px;border-radius:4px;
                           background:var(--bg-muted);color:var(--text-3);">
                ${weekDates.length} session${weekDates.length !== 1 ? 's' : ''}
              </span>
            </div>
            ${allStudentsDone
              ? `<span style="font-size:var(--text-xs);font-weight:700;color:var(--success-text);">All done ✓</span>`
              : ''}
          </summary>
          <div style="overflow-x:auto;border:1px solid var(--border);
                      border-radius:0 0 8px 8px;border-top:none;margin-top:-1px;">
            <table style="width:100%;border-collapse:collapse;min-width:360px;">
              <thead>
                <tr style="border-bottom:1.5px solid var(--border);background:var(--bg-subtle);">
                  <th style="text-align:left;padding:.375rem .75rem;border-right:1px solid var(--border);
                             font-size:var(--text-xs);font-weight:700;color:var(--text-2);">Student</th>
                  <th style="text-align:center;padding:.375rem .75rem;border-right:1px solid var(--border);
                             font-size:var(--text-xs);font-weight:700;color:var(--text-2);">Done</th>
                  <th style="text-align:left;padding:.375rem .75rem;
                             font-size:var(--text-xs);font-weight:700;color:var(--text-2);">Days</th>
                </tr>
              </thead>
              <tbody>${studentRows}</tbody>
            </table>
          </div>
        </details>`;
      }).join('');

      const totalSessions = allDates.length;
      const totalDone     = students.reduce((sum, s) =>
        sum + allDates.filter(dt => !!((s.coachingCompleted || {})[dt])).length, 0);
      const possibleTotal = students.length * totalSessions;

      const recurrenceLabel = d.recurrence
        ? d.recurrence.charAt(0).toUpperCase() + d.recurrence.slice(1)
        : 'Recurring';

      return `<div style="margin-bottom:1.5rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.625rem;">
          <div>
            <h4 style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);">
              📊 ${_esc(title)}
              ${recurring
                ? `<span style="font-size:var(--text-xs);font-weight:600;padding:1px 7px;border-radius:99px;
                               background:var(--accent-subtle);color:var(--accent-text);border:1px solid var(--accent-border);margin-left:.375rem;">
                     🔄 ${_esc(recurrenceLabel)}
                   </span>`
                : ''}
            </h4>
            <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:1px;">
              ${students.length} student${students.length !== 1 ? 's' : ''} ·
              ${totalSessions} session${totalSessions !== 1 ? 's' : ''} to date ·
              ${totalDone}/${possibleTotal} completions all-time
            </p>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:.25rem;">
          ${weeksHTML || '<p style="font-size:var(--text-sm);color:var(--text-3);">No sessions yet.</p>'}
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
    const ok = await UI.confirmAction('Delete ALL tasks?');
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
    singleWrap.style.display = '';
    multiWrap.style.display  = 'none';
    if (singleBtn) {
      singleBtn.style.background = 'var(--bg-base)';
      singleBtn.style.color      = 'var(--text-1)';
      singleBtn.style.boxShadow  = 'var(--shadow-xs)';
    }
    if (multiBtn) {
      multiBtn.style.background = 'transparent';
      multiBtn.style.color      = 'var(--text-3)';
    }
  } else {
    singleWrap.style.display = 'none';
    multiWrap.style.display  = '';
    if (multiBtn) {
      multiBtn.style.background = 'var(--bg-base)';
      multiBtn.style.color      = 'var(--text-1)';
      multiBtn.style.boxShadow  = 'var(--shadow-xs)';
    }
    if (singleBtn) {
      singleBtn.style.background = 'transparent';
      singleBtn.style.color      = 'var(--text-3)';
    }
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
      container.innerHTML = `<p style="font-size:var(--text-sm);color:var(--text-3);padding:.5rem .75rem;">No students found.</p>`;
      return;
    }
    container.innerHTML = filtered.map(s => `
      <label style="display:flex;align-items:center;gap:.625rem;padding:.4375rem .75rem;
                    cursor:pointer;border-bottom:1px solid var(--border);"
             onmouseenter="this.style.background='var(--accent-subtle)'"
             onmouseleave="this.style.background=''">
        <input type="checkbox" class="msg-student-cb" value="${_esc(s.id)}"
               onchange="Teacher._updateMsgSelectedCount()"
               style="width:.9375rem;height:.9375rem;accent-color:var(--accent);flex-shrink:0;cursor:pointer;" />
        <span style="font-size:var(--text-sm);color:var(--text-1);flex:1;
                     white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${_esc(s.name)}
          <span style="color:var(--text-3);font-size:var(--text-xs);"> — ${_esc(s.cls)}</span>
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

  async function logout() {
  if (window.DM && typeof DM.cancelListeners === 'function') {
    await DM.cancelListeners();
  }
  _cancelAll();
  AppState.isTeacher = false;
  try {
    await window.fbAuth.signOut();
  } catch (err) {
    console.error('[teacher] logout error:', err);
    UI.toast('Logout failed. Please try again.', 'error');
  }
}

  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function Db() { return window.fbDb; }

  function _loadJsPDF() {
    return new Promise((resolve, reject) => {
      if (window.jspdf && window.jspdf.jsPDF) { resolve(window.jspdf.jsPDF); return; }

      function loadScript(src) {
        return new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = src; s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }

      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
        .then(() => loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'))
        .then(() => resolve(window.jspdf.jsPDF))
        .catch(reject);
    });
  }

  async function exportTaskReportPDF(docId) {
    if (!docId) return;

    UI.toast('Generating PDF report…', 'info', 3000);

    let jsPDF;
    try {
      jsPDF = await _loadJsPDF();
    } catch (e) {
      UI.toast('Could not load PDF library. Check your internet connection.', 'error');
      return;
    }

    let taskDoc;
    try {
      const snap = await Db().collection('coachingTasks').doc(docId).get();
      if (!snap.exists) { UI.toast('Task not found.', 'error'); return; }
      taskDoc = snap.data();
    } catch (e) {
      console.error('[teacher] exportTaskReportPDF fetch error:', e);
      UI.toast('Failed to fetch task data.', 'error');
      return;
    }

    const todayStr = (window.Tasks && Tasks._localDateStr) ? Tasks._localDateStr() : (() => {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    })();

    const allDates = (window.Tasks && Tasks._resolveTaskDates)
      ? Tasks._resolveTaskDates(taskDoc, { upToDate: todayStr })
      : (taskDoc.dates || []).filter(d => d <= todayStr);

    function getStudentsForDocId(id) {
      if (id === 'global' || id === 'weekly') return _msgStudentCache;
      if (id.startsWith('weekly_class_')) {
        const cls = id.replace('weekly_class_', '');
        return _msgStudentCache.filter(s => s.cls.replace(/\s+/g,'').toLowerCase() === cls);
      }
      if (id.startsWith('weekly_student_')) {
        const uid = id.replace('weekly_student_', '');
        return _msgStudentCache.filter(s => s.id === uid);
      }
      if (id.startsWith('class_')) {
        const cls = id.replace('class_', '');
        return _msgStudentCache.filter(s => s.cls.replace(/\s+/g,'').toLowerCase() === cls);
      }
      if (id.startsWith('student_')) {
        const uid = id.replace('student_', '');
        return _msgStudentCache.filter(s => s.id === uid);
      }
      return [];
    }

    const students = getStudentsForDocId(docId);

    function fmtDate(str) {
      if (!str) return '-';
      const p = str.split('-');
      return new Date(+p[0], +p[1]-1, +p[2]).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
    }
    function fmtDateShort(str) {
      if (!str) return '-';
      const p = str.split('-');
      return new Date(+p[0], +p[1]-1, +p[2]).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
    }
    function fmtDuration(ms) {
      if (!ms) return 'Default (2 hrs)';
      const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000);
      if (h===0) return m + ' min';
      if (m===0) return h + ' hr';
      return h + ' hr ' + m + ' min';
    }
    function scopeText(id) {
      if (id === 'global' || id === 'weekly') return 'All Students';
      if (id.startsWith('weekly_class_') || id.startsWith('class_')) {
        const cls = id.replace('weekly_class_','').replace('class_','');
        return 'Class: ' + cls.toUpperCase();
      }
      if (id.startsWith('weekly_student_') || id.startsWith('student_')) {
        const uid = id.replace('weekly_student_','').replace('student_','');
        const s = _msgStudentCache.find(x => x.id === uid);
        return 'Student: ' + (s ? s.name : uid);
      }
      return id;
    }
    function recurrenceText(d) {
      if (!d.recurrence || d.recurrence === 'once') return 'One-time';
      if (d.recurrence === 'weekly') return 'Weekly (recurring)';
      if (d.recurrence === 'range') return 'Date range';
      return d.recurrence;
    }

    const studentStats = students.map(s => {
      const comp = s.coachingCompleted || {};
      const done = allDates.filter(d => !!comp[d]).length;
      const pastOnly = allDates.filter(d => d < todayStr);
      const missed = pastOnly.filter(d => !comp[d]).length;
      const pct = allDates.length > 0 ? Math.round((done / allDates.length) * 100) : 0;
      return { ...s, done, missed, total: allDates.length, pct, comp };
    }).sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));

    const cohortDone     = studentStats.reduce((n, s) => n + s.done, 0);
    const cohortPossible = studentStats.length * allDates.length;
    const cohortPct      = cohortPossible > 0 ? Math.round((cohortDone / cohortPossible) * 100) : 0;

    const byClass = {};
    studentStats.forEach(s => {
      if (!byClass[s.cls]) byClass[s.cls] = { done:0, total:0, count:0 };
      byClass[s.cls].done  += s.done;
      byClass[s.cls].total += s.total;
      byClass[s.cls].count++;
    });

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const PAGE_W    = 210;
    const PAGE_H    = 297;
    const MARGIN    = 14;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    const C = {
      brand:       [59, 91, 219],
      brandLight:  [237, 242, 255],
      brandBorder: [186, 200, 255],
      success:     [47, 158, 68],
      successBg:   [235, 251, 238],
      danger:      [224, 49, 49],
      dangerBg:    [255, 245, 245],
      warning:     [232, 137, 12],
      warningBg:   [255, 249, 219],
      text:        [17, 24, 39],
      textSec:     [55, 65, 81],
      textTert:    [107, 114, 128],
      textDis:     [156, 163, 175],
      border:      [229, 231, 235],
      surface:     [255, 255, 255],
      surfaceMuted:[243, 244, 246],
      purple:      [124, 58, 237],
      purpleBg:    [245, 243, 255],
    };

    let y = 0;

    function checkPage(needed) {
      if (y + needed > PAGE_H - 16) {
        doc.addPage();
        y = MARGIN;
        _drawPageFooter();
      }
    }

    function fillRect(x, ry, w, h, color, stroke) {
      doc.setFillColor(...color);
      if (stroke) { doc.setDrawColor(...stroke); doc.roundedRect(x, ry, w, h, 2, 2, 'FD'); }
      else { doc.roundedRect(x, ry, w, h, 2, 2, 'F'); }
    }

    // Draws a real filled progress bar using jsPDF drawing primitives — no Unicode
    function drawProgressBar(x, ry, w, h, pct, filledColor) {
      const radius = h / 2;
      // Track (background)
      doc.setFillColor(...C.border);
      doc.roundedRect(x, ry, w, h, radius, radius, 'F');
      // Fill
      if (pct > 0) {
        const fillW = Math.max(w * pct / 100, h); // minimum fill = diameter so it stays rounded
        doc.setFillColor(...filledColor);
        doc.roundedRect(x, ry, fillW, h, radius, radius, 'F');
      }
    }

    function _drawPageHeader() {
      doc.setFillColor(...C.brand);
      doc.rect(0, 0, PAGE_W, 22, 'F');

      doc.setFillColor(255,255,255);
      doc.roundedRect(MARGIN, 5, 12, 12, 2, 2, 'F');
      doc.setTextColor(...C.brand);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('V', MARGIN + 6, 13.5, { align: 'center' });

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Vertex Tutorial CBT', MARGIN + 16, 12.5);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text('COACHING TASK REPORT', PAGE_W - MARGIN, 9, { align: 'right' });
      doc.text('Generated: ' + new Date().toLocaleString('en-GB', { dateStyle:'medium', timeStyle:'short' }), PAGE_W - MARGIN, 14, { align: 'right' });

      y = 28;
    }

    function _drawPageFooter() {
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, PAGE_H - 10, PAGE_W - MARGIN, PAGE_H - 10);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.textDis);
      doc.text('Vertex Tutorial CBT - Confidential Report', MARGIN, PAGE_H - 5.5);
      doc.text('Page ' + doc.internal.getNumberOfPages(), PAGE_W - MARGIN, PAGE_H - 5.5, { align: 'right' });
    }

    function sectionHeading(text) {
      checkPage(14);
      doc.setFillColor(...C.surfaceMuted);
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1.5, 1.5, 'FD');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.brand);
      doc.text(text.toUpperCase(), MARGIN + 4, y + 5.3);
      y += 11;
    }

    function kvRow(label, value, accent) {
      checkPage(8);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.textTert);
      doc.text(label, MARGIN + 2, y + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...(accent || C.text));
      doc.text(String(value), MARGIN + 48, y + 4.5);
      y += 6.5;
    }

    function pctColor(pct) {
      if (pct >= 80) return C.success;
      if (pct >= 50) return C.warning;
      return C.danger;
    }

    // ── PAGE 1 HEADER ──────────────────────────────────────────────
    _drawPageHeader();

    // Title card
    fillRect(MARGIN, y, CONTENT_W, 28, C.brandLight, C.brandBorder);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.brand);
    const titleLines = doc.splitTextToSize(taskDoc.title || 'Untitled Task', CONTENT_W - 30);
    doc.text(titleLines, MARGIN + 5, y + 9);

    const badgeX = PAGE_W - MARGIN - 30;
    if (taskDoc.active) {
      fillRect(badgeX, y + 4, 26, 7, C.success);
      doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
      doc.text('ACTIVE', badgeX + 13, y + 8.8, { align:'center' });
    } else {
      fillRect(badgeX, y + 4, 26, 7, C.surfaceMuted, C.border);
      doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...C.textDis);
      doc.text('INACTIVE', badgeX + 13, y + 8.8, { align:'center' });
    }

    const recTxt = recurrenceText(taskDoc);
    const isRec  = taskDoc.recurrence && taskDoc.recurrence !== 'once';
    fillRect(MARGIN + 5, y + 18, 40, 6, isRec ? C.purpleBg : C.surfaceMuted);
    doc.setFontSize(7); doc.setFont('helvetica','bold');
    doc.setTextColor(...(isRec ? C.purple : C.textTert));
    doc.text((isRec ? 'RECURRING  ' : '') + recTxt, MARGIN + 7, y + 22.2);

    y += 32;

    // ── TASK DETAILS ───────────────────────────────────────────────
    sectionHeading('Task Details');
    kvRow('Scope',      scopeText(docId));
    kvRow('Recurrence', recurrenceText(taskDoc));
    kvRow('Status',     taskDoc.active ? 'Active (visible to students)' : 'Inactive', taskDoc.active ? C.success : C.textDis);
    kvRow('Duration',   fmtDuration(taskDoc.durationMs));
    kvRow('Sessions',   allDates.length + ' scheduled (to date)');
    kvRow('Students',   students.length + ' enrolled');

    if (taskDoc.message) {
      checkPage(18);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.textTert);
      doc.text('Task Message', MARGIN + 2, y + 4);
      y += 6;
      const msgLines = doc.splitTextToSize(taskDoc.message, CONTENT_W - 10);
      const msgH = msgLines.length * 4.5 + 5;
      checkPage(msgH + 4);
      fillRect(MARGIN, y, CONTENT_W, msgH, C.surfaceMuted, C.border);
      doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...C.textSec);
      doc.text(msgLines, MARGIN + 4, y + 4.5);
      y += msgH + 4;
    }

    y += 2;

    // ── TIMETABLE ─────────────────────────────────────────────────
    sectionHeading('Timetable & Schedule');

    if (taskDoc.recurrence && taskDoc.recurrence !== 'once') {
      kvRow('Start Date', taskDoc.startDate ? fmtDate(taskDoc.startDate) : '-');
      kvRow('End Date',   taskDoc.endDate   ? fmtDate(taskDoc.endDate)   : 'Open-ended');
      kvRow('Active Days', (taskDoc.weeklyDays && taskDoc.weeklyDays.length > 0)
        ? taskDoc.weeklyDays.join(', ')
        : taskDoc.recurrence === 'range' ? 'All calendar days' : '-');
    }

    if (allDates.length > 0) {
      checkPage(14);
      doc.setFontSize(7.5);
      doc.setFont('helvetica','bold');
      doc.setTextColor(...C.textTert);
      doc.text('Scheduled Sessions to Date (' + allDates.length + ' total)', MARGIN + 2, y + 4);
      y += 7;

      const COLS = 4;
      const colW = CONTENT_W / COLS;
      const chunks = [];
      for (let i = 0; i < allDates.length; i += COLS) chunks.push(allDates.slice(i, i + COLS));

      const rowH = 8;

      chunks.forEach((row, ri) => {
        checkPage(rowH + 2);
        row.forEach((dateStr, ci) => {
          const cx = MARGIN + ci * colW;
          const ry2 = y;
          const isPast  = dateStr < todayStr;
          const isToday = dateStr === todayStr;

          const completedCount = studentStats.filter(s => !!s.comp[dateStr]).length;
          const allDone = completedCount === studentStats.length && studentStats.length > 0;

          const bgColor     = isToday ? C.warningBg : allDone ? C.successBg : isPast ? C.surfaceMuted : C.surface;
          const borderColor = isToday ? C.warning   : allDone ? C.success   : C.border;

          fillRect(cx + 1, ry2, colW - 2, rowH - 1, bgColor, borderColor);

          doc.setFontSize(6.5); doc.setFont('helvetica','bold');
          doc.setTextColor(...(isToday ? C.warning : allDone ? C.success : C.text));
          doc.text(fmtDateShort(dateStr), cx + 3, ry2 + 4);

          doc.setFontSize(5.5); doc.setFont('helvetica','normal');
          doc.setTextColor(...C.textTert);
          doc.text(completedCount + '/' + studentStats.length + ' done', cx + 3, ry2 + 7);
        });
        y += rowH;
      });

      y += 4;
    }

    // ── SUBJECT RESTRICTIONS ───────────────────────────────────────
    const dsKeys = Object.keys(taskDoc.dateSubjects || {});
    if (dsKeys.length > 0) {
      sectionHeading('Subject Restrictions');
      const subjRows = dsKeys.map(k => [
        k.match(/^\d{4}-\d{2}-\d{2}$/) ? fmtDate(k) : k,
        (taskDoc.dateSubjects[k] || []).join(', ') || 'None'
      ]);
      doc.autoTable({
        startY: y,
        head: [['Date / Day', 'Required Subjects']],
        body: subjRows,
        margin: { left: MARGIN, right: MARGIN },
        headStyles: {
          fillColor: C.brand,
          textColor: [255,255,255],
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: { top:3, bottom:3, left:4, right:4 },
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: C.text,
          cellPadding: { top:2.5, bottom:2.5, left:4, right:4 },
        },
        alternateRowStyles: { fillColor: C.surfaceMuted },
        tableLineColor: C.border,
        tableLineWidth: 0.2,
        theme: 'grid',
      });
      y = doc.lastAutoTable.finalY + 6;
    }

    _drawPageFooter();

    // ── PAGE 2: STUDENT ATTENDANCE & PROGRESS ─────────────────────
    doc.addPage();
    _drawPageHeader();
    _drawPageFooter();

    sectionHeading('Student Attendance & Progress');

    // Cohort summary stat bar
    checkPage(24);
    fillRect(MARGIN, y, CONTENT_W, 20, C.brandLight, C.brandBorder);

    const statCols = [
      { label:'Students Enrolled', value: students.length,    color: C.brand   },
      { label:'Sessions to Date',  value: allDates.length,    color: C.brand   },
      { label:'Total Completions', value: cohortDone,         color: C.success },
      { label:'Cohort Attendance', value: cohortPct + '%',    color: pctColor(cohortPct) },
    ];
    const sw = CONTENT_W / statCols.length;
    statCols.forEach((sc, i) => {
      const sx = MARGIN + i * sw;
      if (i > 0) {
        doc.setDrawColor(...C.brandBorder);
        doc.setLineWidth(0.3);
        doc.line(sx, y + 3, sx, y + 17);
      }
      doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(...sc.color);
      doc.text(String(sc.value), sx + sw/2, y + 11, { align:'center' });
      doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(...C.textTert);
      doc.text(sc.label, sx + sw/2, y + 17, { align:'center' });
    });
    y += 24;

    // ── MAIN ATTENDANCE TABLE ──────────────────────────────────────
    // Show up to 10 most recent date columns
    const MAX_DATE_COLS = 10;
    const displayDates  = allDates.slice(-MAX_DATE_COLS);
    const hasMore       = allDates.length > MAX_DATE_COLS;

    // Date column headers: short day + date e.g. "F 7/3"
    const dateHeaders = displayDates.map(d => {
      const p  = d.split('-');
      const dt = new Date(+p[0], +p[1]-1, +p[2]);
      const dayInitial = dt.toLocaleDateString('en-GB', { weekday:'narrow' });
      const dayNum     = dt.getDate();
      const month      = dt.getMonth() + 1;
      return dayInitial + '\n' + dayNum + '/' + month;
    });

    // Progress column is drawn via willDrawCell — the cell text carries the numeric pct
    // Status dot columns use plain ASCII: Y (done), N (missed), - (upcoming/today)
    const tableHead = [['#', 'Student', 'Class', 'Done', 'Miss', '%', 'Progress', ...dateHeaders]];

    const PROGRESS_COL_IDX = 6; // 0-based index of the "Progress" column
    const FIRST_DATE_COL   = 7;

    const tableBody = studentStats.map((s, idx) => {
      // Status dots: Y / N / - only (ASCII — renders perfectly in Helvetica)
      const dateDots = displayDates.map(d => {
        if (s.comp[d])          return 'Y';   // completed
        if (d < todayStr)       return 'N';   // past, not done
        if (d === todayStr)     return 'O';   // today, not done yet
        return '-';                            // future
      });
      return [
        String(idx + 1),
        s.name,
        s.cls || '-',
        String(s.done),
        String(s.missed),
        s.pct + '%',
        String(s.pct),   // numeric string — willDrawCell draws the bar, hides this text
        ...dateDots
      ];
    });

    doc.autoTable({
      startY: y,
      head: tableHead,
      body: tableBody,
      margin: { left: MARGIN, right: MARGIN },
      headStyles: {
        fillColor: C.brand,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 6,
        cellPadding: { top:2, bottom:2, left:2, right:2 },
        halign: 'center',
        valign: 'middle',
      },
      columnStyles: {
        0: { cellWidth: 7,  halign:'center', fontSize: 6 },
        1: { cellWidth: 30, halign:'left',   fontStyle:'bold', fontSize: 7 },
        2: { cellWidth: 16, halign:'left',   fontSize: 6.5 },
        3: { cellWidth: 9,  halign:'center', fontSize: 7 },
        4: { cellWidth: 9,  halign:'center', fontSize: 7 },
        5: { cellWidth: 10, halign:'center', fontStyle:'bold', fontSize: 7 },
        6: { cellWidth: 24, halign:'left',   fontSize: 1 }, // text hidden; bar drawn in willDrawCell
      },
      bodyStyles: {
        fontSize: 6,
        textColor: C.text,
        cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
        valign: 'middle',
      },
      alternateRowStyles: { fillColor: C.surfaceMuted },
      tableLineColor: C.border,
      tableLineWidth: 0.2,
      theme: 'grid',
      didDrawCell: function(data) {
        if (data.section !== 'body') return;

        // ── Progress bar (column 6) ──────────────────────────────
        if (data.column.index === PROGRESS_COL_IDX) {
          const pct    = parseInt(data.cell.raw, 10) || 0;
          const color  = pctColor(pct);
          const pad    = 2;
          const barX   = data.cell.x + pad;
          const barW   = data.cell.width - pad * 2;
          const barH   = 3;
          const barY   = data.cell.y + (data.cell.height - barH) / 2;
          // Track
          doc.setFillColor(...C.border);
          doc.roundedRect(barX, barY, barW, barH, barH/2, barH/2, 'F');
          // Fill
          if (pct > 0) {
            const fillW = Math.max(barW * pct / 100, barH);
            doc.setFillColor(...color);
            doc.roundedRect(barX, barY, fillW, barH, barH/2, barH/2, 'F');
          }
          // Percentage label centered on bar
          doc.setFontSize(5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(pct > 55 ? 255 : color[0], pct > 55 ? 255 : color[1], pct > 55 ? 255 : color[2]);
          doc.text(pct + '%', barX + barW / 2, barY + barH - 0.6, { align:'center' });
        }

        // ── Date status dots (columns 7+) ────────────────────────
        if (data.column.index >= FIRST_DATE_COL) {
          const txt  = (data.cell.raw || '').toString().trim();
          const cx   = data.cell.x + data.cell.width / 2;
          const cy   = data.cell.y + data.cell.height / 2;
          const r    = 2.2;

          if (txt === 'Y') {
            doc.setFillColor(...C.success);
            doc.circle(cx, cy, r, 'F');
            doc.setFontSize(5.5); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
            doc.text('Y', cx, cy + 1.8, { align:'center' });
          } else if (txt === 'N') {
            doc.setFillColor(...C.danger);
            doc.circle(cx, cy, r, 'F');
            doc.setFontSize(5.5); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
            doc.text('N', cx, cy + 1.8, { align:'center' });
          } else if (txt === 'O') {
            doc.setDrawColor(...C.warning);
            doc.setLineWidth(0.5);
            doc.circle(cx, cy, r, 'S');
            doc.setFontSize(5); doc.setFont('helvetica','normal'); doc.setTextColor(...C.warning);
            doc.text('O', cx, cy + 1.8, { align:'center' });
          } else {
            // future: small grey dash
            doc.setDrawColor(...C.border);
            doc.setLineWidth(0.4);
            doc.line(cx - 1.5, cy, cx + 1.5, cy);
          }
        }

        // ── Colour %  column (col 5) ────────────────────────────
        if (data.column.index === 5) {
          const pct = parseInt(data.cell.raw, 10) || 0;
          // Re-draw the text in the correct colour (autoTable draws it black first)
          doc.setFillColor(...(data.row.index % 2 === 0 ? C.surface : C.surfaceMuted));
          doc.rect(data.cell.x + 0.1, data.cell.y + 0.1, data.cell.width - 0.2, data.cell.height - 0.2, 'F');
          doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...pctColor(pct));
          doc.text(pct + '%', data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 2, { align:'center' });
        }

        // ── Colour Done / Miss columns (cols 3 & 4) ─────────────
        if (data.column.index === 3 || data.column.index === 4) {
          const val = parseInt(data.cell.raw, 10) || 0;
          if (val > 0) {
            const color = data.column.index === 3 ? C.success : C.danger;
            doc.setFillColor(...(data.row.index % 2 === 0 ? C.surface : C.surfaceMuted));
            doc.rect(data.cell.x + 0.1, data.cell.y + 0.1, data.cell.width - 0.2, data.cell.height - 0.2, 'F');
            doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...color);
            doc.text(String(val), data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 2, { align:'center' });
          }
        }
      },
    });

    y = doc.lastAutoTable.finalY + 4;

    if (hasMore) {
      checkPage(8);
      doc.setFontSize(7); doc.setFont('helvetica','italic'); doc.setTextColor(...C.textTert);
      doc.text(
        '* Showing most recent ' + MAX_DATE_COLS + ' sessions. ' + (allDates.length - MAX_DATE_COLS) + ' earlier session(s) omitted from date columns but included in totals.',
        MARGIN, y + 4
      );
      y += 8;
    }

    // ── CLASS BREAKDOWN ────────────────────────────────────────────
    const classKeys = Object.keys(byClass);
    if (classKeys.length > 1) {
      checkPage(20);
      y += 4;
      sectionHeading('Class Breakdown');

      doc.autoTable({
        startY: y,
        head: [['Class', 'Students', 'Sessions', 'Total Done', 'Attendance %']],
        body: classKeys.sort().map(cls => {
          const b   = byClass[cls];
          const pct = b.total > 0 ? Math.round((b.done / b.total) * 100) : 0;
          return [cls || '-', String(b.count), String(b.total / b.count | 0), String(b.done), pct + '%'];
        }),
        margin: { left: MARGIN, right: MARGIN },
        headStyles: {
          fillColor: C.brand,
          textColor: [255,255,255],
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: { top:3, bottom:3, left:4, right:4 },
        },
        bodyStyles: {
          fontSize: 7.5,
          cellPadding: { top:2.5, bottom:2.5, left:4, right:4 },
        },
        columnStyles: {
          0: { fontStyle:'bold' },
          4: { fontStyle:'bold' },
        },
        alternateRowStyles: { fillColor: C.surfaceMuted },
        tableLineColor: C.border,
        tableLineWidth: 0.2,
        theme: 'grid',
        didDrawCell: function(data) {
          if (data.column.index === 4 && data.section === 'body') {
            const pct = parseInt(data.cell.raw, 10) || 0;
            doc.setFillColor(...(data.row.index % 2 === 0 ? C.surface : C.surfaceMuted));
            doc.rect(data.cell.x + 0.1, data.cell.y + 0.1, data.cell.width - 0.2, data.cell.height - 0.2, 'F');
            doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(...pctColor(pct));
            doc.text(pct + '%', data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 2.5, { align:'center' });
          }
        },
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    // ── PER-STUDENT DETAIL PAGES ───────────────────────────────────
    if (allDates.length > 0 && studentStats.length <= 30) {
      studentStats.forEach((s) => {
        doc.addPage();
        _drawPageHeader();
        _drawPageFooter();

        // Student header card
        fillRect(MARGIN, y, CONTENT_W, 22, C.brandLight, C.brandBorder);
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...C.brand);
        doc.text(s.name, MARGIN + 5, y + 9);
        doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...C.textSec);
        doc.text(s.cls || '-', MARGIN + 5, y + 15);

        // Stat pills
        const pills = [
          { label:'Done',    value: s.done,      color: C.success      },
          { label:'Missed',  value: s.missed,    color: C.danger       },
          { label:'Total',   value: s.total,     color: C.brand        },
          { label:'Rate',    value: s.pct + '%', color: pctColor(s.pct) },
        ];
        pills.forEach((p, pi) => {
          const px = MARGIN + 70 + pi * 32;
          fillRect(px, y + 4, 28, 13, C.surface, C.border);
          doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...p.color);
          doc.text(String(p.value), px + 14, y + 12, { align:'center' });
          doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(...C.textTert);
          doc.text(p.label, px + 14, y + 16, { align:'center' });
        });

        y += 26;

        // Attendance progress bar
        checkPage(10);
        doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...C.textTert);
        doc.text('ATTENDANCE PROGRESS', MARGIN, y + 4);
        doc.setTextColor(...pctColor(s.pct));
        doc.text(s.pct + '%', PAGE_W - MARGIN, y + 4, { align:'right' });
        y += 6;
        drawProgressBar(MARGIN, y, CONTENT_W, 4, s.pct, pctColor(s.pct));
        y += 9;

        sectionHeading('Session Log - ' + s.name);

        // Session log table: status as plain text labels, no Unicode
        const sessionRows = allDates.map((dateStr, i) => {
          const done    = !!s.comp[dateStr];
          const isPast  = dateStr < todayStr;
          const isToday = dateStr === todayStr;
          // Plain ASCII status text
          const status  = done    ? 'Done'
                        : isToday ? 'Today'
                        : isPast  ? 'Missed'
                        : 'Upcoming';
          const p2 = dateStr.split('-');
          const dayName = new Date(+p2[0], +p2[1]-1, +p2[2]).toLocaleDateString('en-GB', { weekday:'long' });
          const subjList = (taskDoc.dateSubjects || {})[dateStr] || (taskDoc.dateSubjects || {})[dayName] || [];
          return [
            String(i + 1),
            dayName,
            fmtDate(dateStr),
            subjList.join(', ') || 'No restriction',
            status,
          ];
        });

        doc.autoTable({
          startY: y,
          head: [['#', 'Day', 'Date', 'Required Subjects', 'Status']],
          body: sessionRows,
          margin: { left: MARGIN, right: MARGIN },
          headStyles: {
            fillColor: C.brand,
            textColor: [255,255,255],
            fontStyle: 'bold',
            fontSize: 7.5,
            cellPadding: { top:3, bottom:3, left:3, right:3 },
          },
          columnStyles: {
            0: { cellWidth: 8,  halign:'center', fontSize:7 },
            1: { cellWidth: 26, fontSize:7.5 },
            2: { cellWidth: 38, fontSize:7.5 },
            3: { cellWidth: 50, fontSize:7 },
            4: { cellWidth: 30, fontStyle:'bold', halign:'center', fontSize:7.5 },
          },
          bodyStyles: {
            fontSize: 7,
            cellPadding: { top:2.5, bottom:2.5, left:3, right:3 },
          },
          alternateRowStyles: { fillColor: C.surfaceMuted },
          tableLineColor: C.border,
          tableLineWidth: 0.2,
          theme: 'grid',
          didDrawCell: function(data) {
            if (data.column.index === 4 && data.section === 'body') {
              const txt   = (data.cell.raw || '').toString();
              const color = txt === 'Done'     ? C.success
                          : txt === 'Missed'   ? C.danger
                          : txt === 'Today'    ? C.warning
                          : C.textDis;
              // Repaint cell background then re-draw coloured text
              doc.setFillColor(...(data.row.index % 2 === 0 ? C.surface : C.surfaceMuted));
              doc.rect(data.cell.x + 0.1, data.cell.y + 0.1, data.cell.width - 0.2, data.cell.height - 0.2, 'F');
              doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...color);
              doc.text(txt, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 2.3, { align:'center' });
            }
          },
        });

        y = doc.lastAutoTable.finalY + 6;
      });
    }

    // ── SAVE ──────────────────────────────────────────────────────
    const safeName  = (taskDoc.title || 'task').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStamp = todayStr.replace(/-/g,'');
    doc.save('vtx_report_' + safeName + '_' + dateStamp + '.pdf');
    UI.toast('PDF report downloaded.', 'success');
  }

  window.Teacher = {
    renderTeacherDashboard,
    showTab,
    logout,
    _loadStudents,
    removeStudent,
    editStudent,
    _saveStudentEdit,
    toggleAdmin,
    deleteResult,
    addSchool,
    renameSchool,
    deleteSchool,
    addTaskDate,
    deleteTask,
    deleteAllTasks,
    saveTasksConfig,
    sendPrivateMessage,
    _setMsgMode,
    _filterMsgStudents,
    _updateMsgSelectedCount,
    _selectAllMsgStudents,
    _clearMsgStudents,
    _setTaskScope,
    _setAssignScope,
    _onTaskTargetChange,
    _selectAllDateSubjects,
    _clearDateSubjects,
    _selectAllDaySubjects,
    _clearDaySubjects,
    _updateDaySubjCount,
    exportTaskReportPDF,
    get _msgStudentCache() { return _msgStudentCache; },
  };

})();
