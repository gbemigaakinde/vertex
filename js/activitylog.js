/* ============================================================
   js/activitylog.js — Student Activity Logger + Approval System
   Fire-and-forget writes to Firestore. Never throws.
   ============================================================ */
(function () {
  'use strict';

  // ── Debounce map: prevents duplicate events within 3 seconds ──
  const _debounceMap = {};
  const DEBOUNCE_MS  = 3000;

  // ── Rate limiter: max 30 writes per student per minute ──
  const _rateMap   = {};
  const RATE_LIMIT = 30;
  const RATE_MS    = 60000;

  function _canWrite(uid, action) {
    const key = uid + '|' + action;
    const now = Date.now();
    if (_debounceMap[key] && (now - _debounceMap[key]) < DEBOUNCE_MS) return false;
    _debounceMap[key] = now;
    if (!_rateMap[uid]) _rateMap[uid] = [];
    _rateMap[uid] = _rateMap[uid].filter(function (t) { return now - t < RATE_MS; });
    if (_rateMap[uid].length >= RATE_LIMIT) return false;
    _rateMap[uid].push(now);
    return true;
  }

  /**
   * Track a student action.
   */
  function track(action, detail, extra) {
    if (!window.fbDb || !window.AppState) return;
    var state = window.AppState;
    var uid   = state.userId;
    if (!uid || uid === (window.AppConfig && AppConfig.TEACHER_UID)) return;
    if (!_canWrite(uid, action)) return;
    var studentData = state.studentData || {};
    var name        = studentData.name   || 'Unknown';
    var cls         = studentData.class  || '';
    var school      = studentData.school || '';
    var ttl = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    var doc = {
      uid:       uid,
      name:      name,
      class:     cls,
      school:    school,
      action:    action,
      detail:    detail,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      ttl:       ttl,
    };
    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach(function (k) { doc[k] = extra[k]; });
    }
    window.fbDb.collection('activityLog').add(doc).catch(function (err) {
      console.warn('[ActivityLog] Write failed (non-fatal):', err);
    });
  }

  /**
   * Special: log logout using a direct write.
   */
  function trackLogout(uid, name, cls, school) {
    if (!window.fbDb || !uid) return;
    if (uid === (window.AppConfig && AppConfig.TEACHER_UID)) return;
    var ttl = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    window.fbDb.collection('activityLog').add({
      uid:       uid,
      name:      name      || 'Unknown',
      class:     cls       || '',
      school:    school    || '',
      action:    'logout',
      detail:    (name || 'A student') + ' logged out',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      ttl:       ttl,
    }).catch(function (err) {
      console.warn('[ActivityLog] Logout write failed (non-fatal):', err);
    });
  }

  /* ================================================================
     APPROVAL GATE — Waiting Room Logic
  ================================================================ */

  // Active Firestore listener for the waiting room (student side)
  let _waitingRoomUnsub = null;

  /**
   * Called after registration. Writes to pendingStudents only.
   * Returns a promise that resolves when the pending doc is written.
   */
  async function submitForApproval(uid, email, name, cls, school) {
    if (!window.fbDb || !uid) return;
    const ttl = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48-hour TTL on pending
    await window.fbDb.collection('pendingStudents').doc(uid).set({
      uid,
      email,
      name,
      class:      cls,
      school,
      status:     'pending',
      submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
      ttl,
    });

    // Log the registration request into activity feed for teacher
    var ttlLog = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    window.fbDb.collection('activityLog').add({
      uid,
      name,
      class:     cls,
      school,
      action:    'registration_pending',
      detail:    name + ' registered and is awaiting approval',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      ttl:       ttlLog,
    }).catch(function (err) {
      console.warn('[ActivityLog] Pending registration log failed (non-fatal):', err);
    });
  }

  /**
   * Renders the waiting room UI for a pending student.
   * Sets up a real-time listener: auto-redirects on approval, shows rejection on decline.
   */
  function renderWaitingRoom(uid, studentName) {
    _cancelWaitingRoomListener();

    UI.mount(_buildWaitingRoomHTML(studentName));

    // Real-time listener on the pending doc
    _waitingRoomUnsub = window.fbDb
      .collection('pendingStudents')
      .doc(uid)
      .onSnapshot(
        async function (snap) {
          if (!snap.exists) {
            // Doc deleted — check if approved (now in students collection)
            try {
              const studentSnap = await window.fbDb.collection('students').doc(uid).get();
              if (studentSnap.exists) {
                // Approved — proceed into the app normally
                _cancelWaitingRoomListener();
                _showApprovalSuccessOverlay(function () {
                  AppState.studentData = studentSnap.data();
                  AppState.userId      = uid;
                  AppState.isTeacher   = false;
                  Exam.loadOrStart();
                });
              } else {
                // Check declined collection
                const declinedSnap = await window.fbDb.collection('declinedStudents').doc(uid).get();
                _cancelWaitingRoomListener();
                if (declinedSnap.exists) {
                  _showDeclinedOverlay(declinedSnap.data().reason || '');
                } else {
                  // Unknown state — sign out cleanly
                  _showDeclinedOverlay('');
                }
              }
            } catch (err) {
              console.warn('[ApprovalGate] Snapshot check error:', err);
            }
            return;
          }

          const data   = snap.data() || {};
          const status = data.status || 'pending';

          if (status === 'approved') {
            // Teacher approved — fetch full student doc and enter app
            _cancelWaitingRoomListener();
            try {
              const studentSnap = await window.fbDb.collection('students').doc(uid).get();
              if (studentSnap.exists) {
                _showApprovalSuccessOverlay(function () {
                  AppState.studentData = studentSnap.data();
                  AppState.userId      = uid;
                  AppState.isTeacher   = false;
                  Exam.loadOrStart();
                });
              }
            } catch (err) {
              console.warn('[ApprovalGate] Post-approval student fetch error:', err);
              UI.toast('Something went wrong. Please refresh the page.', 'error', 0);
            }
          } else if (status === 'declined') {
            _cancelWaitingRoomListener();
            _showDeclinedOverlay(data.reason || '');
          }
          // If still 'pending', do nothing — UI stays as is
        },
        function (err) {
          console.warn('[ApprovalGate] Waiting room listener error:', err);
          // Non-fatal — UI stays, student can refresh
        }
      );
  }

  /**
   * Called during login (_onLogin in app.js) to check if a uid is pending/declined
   * before trying to fetch from students collection.
   * Returns: 'pending' | 'declined' | 'none'
   */
  async function checkApprovalStatus(uid) {
    if (!window.fbDb || !uid) return 'none';

    try {
      // Check declined first (fast path)
      const declinedSnap = await window.fbDb.collection('declinedStudents').doc(uid).get();
      if (declinedSnap.exists) return 'declined';

      const pendingSnap = await window.fbDb.collection('pendingStudents').doc(uid).get();
      if (pendingSnap.exists) {
        const status = (pendingSnap.data() || {}).status || 'pending';
        if (status === 'approved') return 'none'; // Will be found in students collection
        return status; // 'pending' or 'declined'
      }
    } catch (err) {
      console.warn('[ApprovalGate] checkApprovalStatus error:', err);
    }

    return 'none';
  }

  /**
   * Returns the pending student data for rendering waiting room after login.
   */
  async function getPendingStudentData(uid) {
    if (!window.fbDb || !uid) return null;
    try {
      const snap = await window.fbDb.collection('pendingStudents').doc(uid).get();
      return snap.exists ? snap.data() : null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Returns the declined student data.
   */
  async function getDeclinedStudentData(uid) {
    if (!window.fbDb || !uid) return null;
    try {
      const snap = await window.fbDb.collection('declinedStudents').doc(uid).get();
      return snap.exists ? snap.data() : null;
    } catch (err) {
      return null;
    }
  }

  function _cancelWaitingRoomListener() {
    if (typeof _waitingRoomUnsub === 'function') {
      _waitingRoomUnsub();
      _waitingRoomUnsub = null;
    }
  }

  /* ── Waiting Room HTML ── */
  function _buildWaitingRoomHTML(studentName) {
    const first = (studentName || 'there').split(' ')[0];
    return `
      <div class="cbt-layout cbt-layout--auth cbt-animate-in" style="padding:var(--sp-6) var(--sp-4);max-width:480px;">

        <div style="text-align:center;margin-bottom:var(--sp-8);">
          <div style="display:inline-flex;align-items:center;justify-content:center;
                      width:40px;height:40px;background:var(--accent);border-radius:10px;
                      margin-bottom:var(--sp-4);box-shadow:var(--shadow-accent);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white"
                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
              <line x1="12" y1="22" x2="12" y2="15.5"/>
              <polyline points="22 8.5 12 15.5 2 8.5"/>
            </svg>
          </div>
          <h1 style="font-size:var(--text-xl);font-weight:700;color:var(--text-1);
                     letter-spacing:-0.025em;margin-bottom:0.25rem;">
            Vertex Tutorial
          </h1>
          <p style="font-size:var(--text-sm);color:var(--text-3);">Computer-Based Testing System</p>
        </div>

        <div class="cbt-card" style="text-align:center;">

          <!-- Animated waiting icon -->
          <div style="display:flex;align-items:center;justify-content:center;
                      width:64px;height:64px;border-radius:50%;
                      background:var(--accent-subtle);border:2px solid var(--accent-border);
                      margin:0 auto var(--sp-5);
                      animation:vtx-waiting-pulse 2.4s ease-in-out infinite;">
            <i class="ph ph-hourglass-medium" style="font-size:28px;color:var(--accent);
               animation:vtx-hourglass-spin 3s ease-in-out infinite;"></i>
          </div>

          <h2 style="font-size:var(--text-lg);font-weight:700;color:var(--text-1);
                     letter-spacing:-0.015em;margin-bottom:0.5rem;">
            Awaiting Approval
          </h2>

          <p style="font-size:var(--text-sm);color:var(--text-3);line-height:1.7;
                    margin-bottom:var(--sp-5);max-width:340px;margin-left:auto;margin-right:auto;">
            Hi <strong style="color:var(--text-1);">${_esc(first)}</strong>, your registration
            has been received. Master Timothy will review and approve your account shortly.
            This page will update automatically — please keep it open or check again later.
          </p>

          <!-- Status indicator -->
          <div style="display:inline-flex;align-items:center;gap:0.5rem;
                      padding:0.5rem 1rem;border-radius:var(--r-full);
                      background:var(--warning-subtle);border:1px solid var(--warning-border);
                      margin-bottom:var(--sp-5);">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--warning);
                         display:inline-block;animation:cbt-pulse 1.4s ease-in-out infinite;
                         flex-shrink:0;"></span>
            <span style="font-size:var(--text-xs);font-weight:700;color:var(--warning-text);
                         letter-spacing:0.04em;text-transform:uppercase;">
              Pending Review
            </span>
          </div>

          <div style="padding:var(--sp-4);background:var(--bg-subtle);border-radius:var(--r-lg);
                      border:1px solid var(--border);margin-bottom:var(--sp-5);text-align:left;">
            <p style="font-size:var(--text-xs);color:var(--text-3);line-height:1.6;">
              <i class="ph ph-info" style="color:var(--accent);margin-right:4px;"></i>
              Your account will be activated as soon as Master Timothy approves it.
              You will be redirected automatically — no need to refresh.
            </p>
          </div>

          <button onclick="ActivityLog._signOutFromWaiting()"
                  style="font-size:var(--text-xs);color:var(--text-4);background:none;
                         border:1px solid var(--border);padding:.375rem .75rem;
                         border-radius:var(--r-full);cursor:pointer;font-family:var(--font);
                         transition:color var(--t-fast),border-color var(--t-fast);"
                  onmouseenter="this.style.color='var(--text-2)';this.style.borderColor='var(--border-strong)';"
                  onmouseleave="this.style.color='var(--text-4)';this.style.borderColor='var(--border)';">
            Sign out
          </button>

        </div>

        <div class="cbt-auth-footer">
          With care from your master,
          <span style="font-weight:600;color:var(--accent);">Master Timothy</span>
        </div>

      </div>

      <style id="vtxWaitingRoomStyles">
        @keyframes vtx-waiting-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(79,110,247,0.18), 0 0 0 6px rgba(79,110,247,0); }
          50%       { box-shadow: 0 0 0 8px rgba(79,110,247,0.10), 0 0 0 14px rgba(79,110,247,0.04); }
        }
        @keyframes vtx-hourglass-spin {
          0%   { transform: rotate(0deg);   }
          45%  { transform: rotate(0deg);   }
          55%  { transform: rotate(180deg); }
          100% { transform: rotate(180deg); }
        }
        @keyframes vtx-approval-pop {
          0%   { opacity:0; transform:scale(0.7) translateY(16px); }
          60%  { opacity:1; transform:scale(1.04) translateY(-2px); }
          100% { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes vtx-check-draw {
          from { stroke-dashoffset: 60; }
          to   { stroke-dashoffset: 0;  }
        }
        @keyframes vtx-shake {
          0%,100% { transform:translateX(0);  }
          20%     { transform:translateX(-6px); }
          40%     { transform:translateX(6px);  }
          60%     { transform:translateX(-4px); }
          80%     { transform:translateX(4px);  }
        }
      </style>`;
  }

  /* ── Approval success overlay ── */
  function _showApprovalSuccessOverlay(onContinue) {
    const overlay = document.createElement('div');
    overlay.id    = 'vtxApprovalOverlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:rgba(0,0,0,0.55);
      backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
      display:flex;align-items:center;justify-content:center;
      padding:1.5rem;
    `;
    overlay.innerHTML = `
      <div style="background:var(--bg-base);border-radius:var(--r-2xl);
                  padding:2.5rem 2rem;max-width:360px;width:100%;text-align:center;
                  box-shadow:var(--shadow-xl);
                  animation:vtx-approval-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both;">

        <div style="display:inline-flex;align-items:center;justify-content:center;
                    width:72px;height:72px;border-radius:50%;
                    background:var(--success-subtle);border:2px solid var(--success-border);
                    margin-bottom:1.25rem;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
               stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="7 12.5 10.5 16 17 9"
                      style="stroke-dasharray:60;stroke-dashoffset:60;
                             animation:vtx-check-draw 0.45s ease 0.3s forwards;"/>
          </svg>
        </div>

        <h2 style="font-size:var(--text-xl);font-weight:700;color:var(--text-1);
                   letter-spacing:-0.02em;margin-bottom:0.5rem;">
          You're Approved!
        </h2>

        <p style="font-size:var(--text-sm);color:var(--text-3);line-height:1.6;
                  margin-bottom:1.75rem;">
          Master Timothy has approved your account.
          Welcome to Vertex Tutorial.
        </p>

        <button id="vtxApprovalContinueBtn"
                class="btn btn-lg w-full"
                style="justify-content:center;background:var(--success);max-width:100%;">
          Enter Dashboard
        </button>
      </div>`;
    document.body.appendChild(overlay);

    // Wire button
    document.getElementById('vtxApprovalContinueBtn').addEventListener('click', function () {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s ease';
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (typeof onContinue === 'function') onContinue();
      }, 300);
    });

    // Auto-continue after 4 seconds
    setTimeout(function () {
      const btn = document.getElementById('vtxApprovalContinueBtn');
      if (btn) btn.click();
    }, 4000);
  }

  /* ── Declined overlay ── */
  function _showDeclinedOverlay(reason) {
    const overlay = document.createElement('div');
    overlay.id    = 'vtxDeclinedOverlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:rgba(0,0,0,0.55);
      backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
      display:flex;align-items:center;justify-content:center;
      padding:1.5rem;
    `;
    overlay.innerHTML = `
      <div style="background:var(--bg-base);border-radius:var(--r-2xl);
                  padding:2.5rem 2rem;max-width:360px;width:100%;text-align:center;
                  box-shadow:var(--shadow-xl);
                  animation:vtx-approval-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both;">

        <div style="display:inline-flex;align-items:center;justify-content:center;
                    width:72px;height:72px;border-radius:50%;
                    background:var(--danger-subtle);border:2px solid var(--danger-border);
                    margin-bottom:1.25rem;
                    animation:vtx-shake 0.5s ease 0.2s both;">
          <i class="ph ph-x-circle" style="font-size:36px;color:var(--danger);"></i>
        </div>

        <h2 style="font-size:var(--text-xl);font-weight:700;color:var(--text-1);
                   letter-spacing:-0.02em;margin-bottom:0.5rem;">
          Registration Declined
        </h2>

        <p style="font-size:var(--text-sm);color:var(--text-3);line-height:1.6;
                  margin-bottom:${reason ? '0.75rem' : '1.75rem'};">
          Your registration was not approved. Please contact Master Timothy for more information.
        </p>

        ${reason ? `
          <div style="padding:0.75rem 1rem;background:var(--danger-subtle);
                      border:1px solid var(--danger-border);border-radius:var(--r-lg);
                      margin-bottom:1.75rem;text-align:left;">
            <p style="font-size:var(--text-xs);color:var(--danger-text);line-height:1.6;">
              <strong>Reason:</strong> ${_esc(reason)}
            </p>
          </div>` : ''}

        <button id="vtxDeclinedDismissBtn"
                class="btn btn-lg w-full"
                style="justify-content:center;background:var(--danger);max-width:100%;">
          OK, I Understand
        </button>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('vtxDeclinedDismissBtn').addEventListener('click', async function () {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s ease';
      setTimeout(async function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        // Sign out and show login
        try { await window.fbAuth.signOut(); } catch (e) {}
        if (window.Auth && typeof Auth.renderLogin === 'function') Auth.renderLogin();
      }, 300);
    });
  }

  /* ── Public helper: sign out from waiting room ── */
  async function _signOutFromWaiting() {
    _cancelWaitingRoomListener();
    try { await window.fbAuth.signOut(); } catch (e) {}
    if (window.Auth && typeof Auth.renderLogin === 'function') Auth.renderLogin();
  }

  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ================================================================
     TEACHER: Pending Approvals Panel
     Called from teacher.js to render the approvals UI inside a tab.
  ================================================================ */

  let _pendingUnsub  = null;
  let _pendingBadgeUnsub = null;

  /**
   * Start listening to pendingStudents for the teacher badge/notification.
   * Called once after teacher logs in.
   */
  function initTeacherApprovalListener() {
    if (_pendingBadgeUnsub) return; // already listening
    _pendingBadgeUnsub = window.fbDb
      .collection('pendingStudents')
      .where('status', '==', 'pending')
      .onSnapshot(function (snap) {
        _updateApprovalBadge(snap.size);
      }, function (err) {
        console.warn('[ApprovalGate] Teacher badge listener error:', err);
      });
  }

  function cancelTeacherApprovalListener() {
    if (typeof _pendingBadgeUnsub === 'function') {
      _pendingBadgeUnsub();
      _pendingBadgeUnsub = null;
    }
    if (typeof _pendingUnsub === 'function') {
      _pendingUnsub();
      _pendingUnsub = null;
    }
  }

  function _updateApprovalBadge(count) {
    const badge = document.getElementById('badge-approvals');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.add('is-visible');
    } else {
      badge.textContent = '';
      badge.classList.remove('is-visible');
    }
  }

  /**
   * Renders the full approvals management panel inside the given container element id.
   */
  function renderApprovalsPanel(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Cancel any previous listener
    if (typeof _pendingUnsub === 'function') { _pendingUnsub(); _pendingUnsub = null; }

    container.innerHTML = `
      <div style="margin-bottom:1rem;">
        <h2 style="font-size:var(--text-md);font-weight:600;color:var(--text-1);
                   letter-spacing:-0.015em;">
          Registration Approvals
        </h2>
        <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:2px;">
          Students waiting for account activation. Approve or decline each request in real time.
        </p>
      </div>
      <div id="vtxApprovalList"
           style="display:flex;flex-direction:column;gap:0.625rem;"></div>`;

    _pendingUnsub = window.fbDb
      .collection('pendingStudents')
      .where('status', '==', 'pending')
      .orderBy('submittedAt', 'asc')
      .onSnapshot(
        function (snap) {
          _renderApprovalList(snap.docs);
          _updateApprovalBadge(snap.size);
        },
        function (err) {
          console.warn('[ApprovalGate] Approvals panel listener error:', err);
          const list = document.getElementById('vtxApprovalList');
          if (list) {
            list.innerHTML = `<p style="font-size:var(--text-sm);color:var(--danger);">
              Could not load pending registrations.</p>`;
          }
        }
      );
  }

  function _renderApprovalList(docs) {
    const list = document.getElementById('vtxApprovalList');
    if (!list) return;

    if (docs.length === 0) {
      list.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;
                    justify-content:center;gap:0.625rem;text-align:center;
                    padding:3rem 1rem;color:var(--text-3);">
          <i class="ph ph-check-circle" style="font-size:2rem;color:var(--success);opacity:0.6;"></i>
          <span style="font-size:var(--text-sm);">
            No pending registrations. All caught up.
          </span>
        </div>`;
      return;
    }

    list.innerHTML = docs.map(function (doc) {
      const d  = doc.data();
      const ts = d.submittedAt
        ? (d.submittedAt.toDate ? d.submittedAt.toDate() : new Date(d.submittedAt))
            .toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
        : '—';

      return `
        <div id="vtxPendingCard_${_esc(doc.id)}"
             style="display:flex;align-items:flex-start;gap:1rem;
                    background:var(--bg-base);border:1px solid var(--border);
                    border-radius:var(--r-xl);padding:1rem 1.125rem;
                    animation:cbt-fade-in 0.25s var(--ease) both;
                    transition:border-color 0.15s,box-shadow 0.15s;">

          <!-- Avatar -->
          <div style="flex-shrink:0;width:42px;height:42px;border-radius:50%;
                      background:var(--accent-subtle);border:1.5px solid var(--accent-border);
                      display:flex;align-items:center;justify-content:center;
                      color:var(--accent);font-size:1.125rem;">
            <i class="ph ph-student"></i>
          </div>

          <!-- Info -->
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;
                        margin-bottom:2px;">
              <span style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);">
                ${_esc(d.name || '—')}
              </span>
              <span style="font-size:var(--text-xs);font-weight:600;
                           padding:1px 7px;border-radius:99px;
                           background:var(--warning-subtle);color:var(--warning-text);
                           border:1px solid var(--warning-border);">
                ${_esc(d.class || '—')}
              </span>
            </div>
            <p style="font-size:var(--text-xs);color:var(--text-3);
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${_esc(d.school || '—')}
              <span style="color:var(--border-strong);margin:0 .375rem;">·</span>
              ${_esc(d.email || '—')}
            </p>
            <p style="font-size:var(--text-xs);color:var(--text-4);margin-top:3px;">
              Requested: ${_esc(ts)}
            </p>
          </div>

          <!-- Actions -->
          <div style="display:flex;flex-direction:column;gap:0.375rem;flex-shrink:0;
                      align-items:flex-end;">
            <button id="vtxApproveBtn_${_esc(doc.id)}"
                    onclick="ActivityLog._approveStudent('${_esc(doc.id)}')"
                    style="display:inline-flex;align-items:center;gap:0.375rem;
                           padding:0.375rem 0.875rem;border-radius:var(--r-md);
                           background:var(--success);color:#fff;border:none;cursor:pointer;
                           font-size:var(--text-xs);font-weight:700;font-family:var(--font);
                           transition:background 0.14s,transform 0.14s;white-space:nowrap;"
                    onmouseenter="this.style.background='var(--success-text)';this.style.transform='translateY(-1px)';"
                    onmouseleave="this.style.background='var(--success)';this.style.transform='';">
              <i class="ph ph-check" style="font-size:13px;"></i>
              Approve
            </button>
            <button id="vtxDeclineBtn_${_esc(doc.id)}"
                    onclick="ActivityLog._declineStudentPrompt('${_esc(doc.id)}', '${_esc(d.name || '')}')"
                    style="display:inline-flex;align-items:center;gap:0.375rem;
                           padding:0.375rem 0.875rem;border-radius:var(--r-md);
                           background:var(--bg-subtle);color:var(--danger);
                           border:1px solid var(--danger-border);cursor:pointer;
                           font-size:var(--text-xs);font-weight:700;font-family:var(--font);
                           transition:background 0.14s,transform 0.14s;white-space:nowrap;"
                    onmouseenter="this.style.background='var(--danger-subtle)';this.style.transform='translateY(-1px)';"
                    onmouseleave="this.style.background='var(--bg-subtle)';this.style.transform='';">
              <i class="ph ph-x" style="font-size:13px;"></i>
              Decline
            </button>
          </div>

        </div>`;
    }).join('');
  }

  /* ── Approve student ── */
async function _approveStudent(uid) {
  const approveBtn = document.getElementById('vtxApproveBtn_' + uid);
  const declineBtn = document.getElementById('vtxDeclineBtn_' + uid);
  if (approveBtn) { approveBtn.disabled = true; approveBtn.style.opacity = '0.6'; }
  if (declineBtn) { declineBtn.disabled = true; }

  try {
    const pendingSnap = await window.fbDb.collection('pendingStudents').doc(uid).get();
    if (!pendingSnap.exists) {
      UI.toast('Pending record not found. It may have already been processed.', 'warning');
      if (approveBtn) { approveBtn.disabled = false; approveBtn.style.opacity = '1'; }
      if (declineBtn) { declineBtn.disabled = false; }
      return;
    }
    const d = pendingSnap.data();

    // 1. Write to students collection and delete pending doc in a batch
    const batch = window.fbDb.batch();
    batch.set(window.fbDb.collection('students').doc(uid), {
      name:        d.name   || '',
      class:       d.class  || '',
      school:      d.school || '',
      email:       d.email  || '',
      admissionNo: null,
      createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
      approvedAt:  firebase.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Delete the pending doc (triggers waiting room listener on student's device)
    batch.delete(window.fbDb.collection('pendingStudents').doc(uid));

    await batch.commit();

    // 3. Log the approval
    const ttlLog = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    window.fbDb.collection('activityLog').add({
      uid,
      name:      d.name   || 'Unknown',
      class:     d.class  || '',
      school:    d.school || '',
      action:    'registration_approved',
      detail:    (d.name || 'A student') + ' was approved and can now log in',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      ttl:       ttlLog,
    }).catch(function () {});

    // 4. Animate card out
    const card = document.getElementById('vtxPendingCard_' + uid);
    if (card) {
      card.style.transition = 'opacity 0.35s ease, transform 0.35s ease, max-height 0.35s ease';
      card.style.overflow   = 'hidden';
      card.style.maxHeight  = card.offsetHeight + 'px';
      requestAnimationFrame(function () {
        card.style.opacity   = '0';
        card.style.transform = 'translateX(20px)';
        card.style.maxHeight = '0';
        card.style.padding   = '0';
        card.style.margin    = '0';
        setTimeout(function () {
          if (card.parentNode) card.parentNode.removeChild(card);
        }, 380);
      });
    }

    UI.toast((d.name || 'Student') + ' approved and can now access the platform.', 'success');

  } catch (err) {
    console.error('[ApprovalGate] _approveStudent error:', err.code, err.message, err);
    if (approveBtn) { approveBtn.disabled = false; approveBtn.style.opacity = '1'; }
    if (declineBtn) { declineBtn.disabled = false; }
    const msg = err.code === 'permission-denied'
      ? 'Permission denied. Make sure your Firestore rules allow admin to create student documents.'
      : 'Failed to approve student. Please try again.';
    UI.toast(msg, 'error');
  }
}

  /* ── Decline: show reason prompt, then process ── */
  function _declineStudentPrompt(uid, name) {
    // Build a simple inline modal for entering a decline reason
    const existing = document.getElementById('vtxDeclineModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id    = 'vtxDeclineModal';
    modal.style.cssText = `
      position:fixed;inset:0;z-index:1400;
      background:var(--bg-overlay);
      backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
      display:flex;align-items:center;justify-content:center;
      padding:1.25rem;
      animation:cbt-overlay-in 0.15s ease-out both;
    `;
    modal.innerHTML = `
      <div style="background:var(--bg-base);border:1px solid var(--border);
                  border-radius:var(--r-xl);padding:1.5rem;width:100%;max-width:400px;
                  box-shadow:var(--shadow-xl);
                  animation:cbt-modal-in 0.22s cubic-bezier(.34,1.45,.64,1) both;">

        <div style="display:flex;align-items:center;justify-content:space-between;
                    margin-bottom:1.25rem;">
          <h3 style="font-size:var(--text-base);font-weight:700;color:var(--text-1);">
            Decline Registration
          </h3>
          <button onclick="document.getElementById('vtxDeclineModal').remove()"
                  style="background:none;border:none;cursor:pointer;
                         color:var(--text-3);font-size:1.125rem;line-height:1;padding:2px 6px;"
                  onmouseenter="this.style.color='var(--danger)'"
                  onmouseleave="this.style.color='var(--text-3)'">
            <i class="ph ph-x"></i>
          </button>
        </div>

        <p style="font-size:var(--text-sm);color:var(--text-2);margin-bottom:1rem;line-height:1.6;">
          You are about to decline <strong>${_esc(name || 'this student')}</strong>'s
          registration. This action cannot be undone.
        </p>

        <div style="margin-bottom:1rem;">
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-3);margin-bottom:0.375rem;
                        text-transform:uppercase;letter-spacing:.04em;">
            Reason <span style="font-weight:400;text-transform:none;">(optional)</span>
          </label>
          <textarea id="vtxDeclineReason" rows="3"
                    placeholder="e.g. Not a registered student of Vertex Tutorial..."
                    style="width:100%;box-sizing:border-box;resize:none;"></textarea>
        </div>

        <div style="display:flex;gap:0.5rem;">
          <button onclick="document.getElementById('vtxDeclineModal').remove()"
                  class="btn bg-gray-500" style="flex:1;justify-content:center;
                  font-size:var(--text-sm);">
            Cancel
          </button>
          <button id="vtxDeclineConfirmBtn"
                  onclick="ActivityLog._declineStudent('${_esc(uid)}', '${_esc(name)}')"
                  class="btn" style="flex:1;justify-content:center;
                  font-size:var(--text-sm);background:var(--danger);">
            <i class="ph ph-x-circle" style="font-size:14px;"></i>
            Decline
          </button>
        </div>
      </div>`;

    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
    modal.addEventListener('keydown', function (e) { if (e.key === 'Escape') modal.remove(); });
    setTimeout(function () {
      const ta = document.getElementById('vtxDeclineReason');
      if (ta) ta.focus();
    }, 100);
  }

  /* ── Decline student ── */
  async function _declineStudent(uid, name) {
    const reasonEl = document.getElementById('vtxDeclineReason');
    const reason   = (reasonEl ? reasonEl.value.trim() : '');
    const btn      = document.getElementById('vtxDeclineConfirmBtn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

    try {
      const pendingSnap = await window.fbDb.collection('pendingStudents').doc(uid).get();
      const d = pendingSnap.exists ? pendingSnap.data() : {};

      const batch = window.fbDb.batch();

      // 1. Write to declinedStudents — the waiting room listener will detect this
      batch.set(window.fbDb.collection('declinedStudents').doc(uid), {
        uid,
        name:        d.name   || name || '',
        class:       d.class  || '',
        school:      d.school || '',
        email:       d.email  || '',
        reason:      reason,
        declinedAt:  firebase.firestore.FieldValue.serverTimestamp(),
        status:      'declined',
      });

      // 2. Update the pending doc status to 'declined' (triggers waiting room listener)
      if (pendingSnap.exists) {
        batch.update(window.fbDb.collection('pendingStudents').doc(uid), {
          status: 'declined',
          reason: reason,
        });
      }

      await batch.commit();

      // 3. Log the decline
      const ttlLog = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      window.fbDb.collection('activityLog').add({
        uid,
        name:      d.name   || name || 'Unknown',
        class:     d.class  || '',
        school:    d.school || '',
        action:    'registration_declined',
        detail:    (d.name || name || 'A student') + ' was declined' + (reason ? ': ' + reason : ''),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        ttl:       ttlLog,
      }).catch(function () {});

      // 4. Close the modal
      const modal = document.getElementById('vtxDeclineModal');
      if (modal) modal.remove();

      // 5. Animate card out
      const card = document.getElementById('vtxPendingCard_' + uid);
      if (card) {
        card.style.transition = 'opacity 0.35s ease, transform 0.35s ease, max-height 0.35s ease';
        card.style.overflow   = 'hidden';
        card.style.maxHeight  = card.offsetHeight + 'px';
        requestAnimationFrame(function () {
          card.style.opacity   = '0';
          card.style.transform = 'translateX(-20px)';
          card.style.maxHeight = '0';
          card.style.padding   = '0';
          card.style.margin    = '0';
          setTimeout(function () {
            if (card.parentNode) card.parentNode.removeChild(card);
          }, 380);
        });
      }

      UI.toast((d.name || name || 'Student') + '\'s registration was declined.', 'info');

    } catch (err) {
      console.error('[ApprovalGate] _declineStudent error:', err);
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
      UI.toast('Failed to decline registration. Please try again.', 'error');
    }
  }

  // Activity meta for teacher feed
  const ACTION_META_APPROVAL = {
    registration_pending:  { icon: 'ph-user-plus',     label: 'Registration request', color: 'var(--warning)' },
    registration_approved: { icon: 'ph-check-circle',  label: 'Registration approved', color: 'var(--success)' },
    registration_declined: { icon: 'ph-x-circle',      label: 'Registration declined', color: 'var(--danger)'  },
  };

  // Expose ACTION_META_APPROVAL so teacher.js can merge it into ACTION_META
  window._ApprovalActionMeta = ACTION_META_APPROVAL;

  window.ActivityLog = {
    track,
    trackLogout,
    // Approval gate — student side
    submitForApproval,
    renderWaitingRoom,
    checkApprovalStatus,
    getPendingStudentData,
    getDeclinedStudentData,
    _signOutFromWaiting,
    _cancelWaitingRoomListener,
    // Approval gate — teacher side
    initTeacherApprovalListener,
    cancelTeacherApprovalListener,
    renderApprovalsPanel,
    _approveStudent,
    _declineStudentPrompt,
    _declineStudent,
    _updateApprovalBadge,
  };

}());
