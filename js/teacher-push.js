/* ============================================================
   Teacher push notification panel — with class targeting and
   scheduled/recurring sends
   ============================================================ */

(function () {
  'use strict';

  var WORKER_URL = 'https://vertex-worker.gbemigaakinde.workers.dev';

  function renderPushPanel(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;

    el.innerHTML =
      '<div style="border:1.5px solid var(--border);border-radius:var(--r-xl);' +
        'background:var(--bg-base);overflow:hidden;margin-bottom:1.25rem;">' +

        '<div style="padding:.875rem 1.125rem;background:var(--accent);' +
          'display:flex;align-items:center;gap:.625rem;">' +
          '<i class="ph ph-bell-ringing" style="font-size:18px;color:#fff;flex-shrink:0;"></i>' +
          '<div>' +
            '<p style="font-size:.9375rem;font-weight:700;color:#fff;line-height:1.2;">Send Push Notification</p>' +
            '<p style="font-size:.6875rem;color:rgba(255,255,255,.75);margin-top:1px;">Send now or schedule for later</p>' +
          '</div>' +
        '</div>' +

        '<div style="padding:1rem 1.125rem;display:flex;flex-direction:column;gap:.75rem;">' +

          '<div>' +
            '<label style="font-size:.75rem;font-weight:700;color:var(--text-3);' +
              'text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:.375rem;">Send to</label>' +
            '<select id="vtxPushMode" onchange="TeacherPush._onModeChange()" style="width:100%;padding:.5rem .625rem;border-radius:var(--r-md);' +
              'border:1px solid var(--border);background:var(--bg-subtle);' +
              'color:var(--text-1);font-size:.875rem;font-family:var(--font);cursor:pointer;">' +
              '<option value="all">All students</option>' +
              '<option value="classes">By class</option>' +
              '<option value="student">One student</option>' +
            '</select>' +
          '</div>' +

          '<div id="vtxPushClassWrap" style="display:none;">' +
            '<label style="font-size:.75rem;font-weight:700;color:var(--text-3);' +
              'text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:.375rem;">Classes</label>' +
            '<div id="vtxPushClassList" style="display:flex;flex-wrap:wrap;gap:.5rem;padding:.5rem;' +
              'border:1px solid var(--border);border-radius:var(--r-md);background:var(--bg-subtle);' +
              'max-height:140px;overflow-y:auto;">' +
              '<span style="font-size:.75rem;color:var(--text-4);">Loading classes…</span>' +
            '</div>' +
          '</div>' +

          '<div id="vtxPushStudentWrap" style="display:none;">' +
            '<label style="font-size:.75rem;font-weight:700;color:var(--text-3);' +
              'text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:.375rem;">Student</label>' +
            '<select id="vtxPushTarget" style="width:100%;padding:.5rem .625rem;border-radius:var(--r-md);' +
              'border:1px solid var(--border);background:var(--bg-subtle);' +
              'color:var(--text-1);font-size:.875rem;font-family:var(--font);cursor:pointer;"></select>' +
          '</div>' +

          '<div>' +
            '<label style="font-size:.75rem;font-weight:700;color:var(--text-3);' +
              'text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:.375rem;">Notification title</label>' +
            '<input id="vtxPushTitle" type="text" value="Message from Master Timothy" ' +
              'style="width:100%;padding:.5rem .625rem;border-radius:var(--r-md);' +
              'border:1px solid var(--border);background:var(--bg-subtle);' +
              'color:var(--text-1);font-size:.875rem;font-family:var(--font);box-sizing:border-box;" />' +
          '</div>' +

          '<div>' +
            '<label style="font-size:.75rem;font-weight:700;color:var(--text-3);' +
              'text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:.375rem;">Message</label>' +
            '<textarea id="vtxPushBody" rows="3" ' +
              'placeholder="Type your message to students…" ' +
              'style="width:100%;padding:.5rem .625rem;border-radius:var(--r-md);' +
              'border:1px solid var(--border);background:var(--bg-subtle);' +
              'color:var(--text-1);font-size:.875rem;font-family:var(--font);' +
              'resize:vertical;box-sizing:border-box;"></textarea>' +
          '</div>' +

          '<div>' +
            '<label style="font-size:.75rem;font-weight:700;color:var(--text-3);' +
              'text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:.375rem;">Timing</label>' +
            '<select id="vtxPushTiming" onchange="TeacherPush._onTimingChange()" style="width:100%;padding:.5rem .625rem;border-radius:var(--r-md);' +
              'border:1px solid var(--border);background:var(--bg-subtle);' +
              'color:var(--text-1);font-size:.875rem;font-family:var(--font);cursor:pointer;">' +
              '<option value="now">Send now</option>' +
              '<option value="once">Schedule once</option>' +
              '<option value="daily">Repeat daily</option>' +
              '<option value="weekly">Repeat weekly</option>' +
            '</select>' +
          '</div>' +

          '<div id="vtxPushOnceWrap" style="display:none;">' +
            '<label style="font-size:.75rem;font-weight:700;color:var(--text-3);' +
              'text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:.375rem;">Send at</label>' +
            '<input id="vtxPushOnceAt" type="datetime-local" style="width:100%;padding:.5rem .625rem;border-radius:var(--r-md);' +
              'border:1px solid var(--border);background:var(--bg-subtle);color:var(--text-1);' +
              'font-size:.875rem;font-family:var(--font);box-sizing:border-box;" />' +
          '</div>' +

          '<div id="vtxPushTimeWrap" style="display:none;">' +
            '<label style="font-size:.75rem;font-weight:700;color:var(--text-3);' +
              'text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:.375rem;">Time (Lagos time)</label>' +
            '<input id="vtxPushTimeOfDay" type="time" value="18:00" style="width:100%;padding:.5rem .625rem;border-radius:var(--r-md);' +
              'border:1px solid var(--border);background:var(--bg-subtle);color:var(--text-1);' +
              'font-size:.875rem;font-family:var(--font);box-sizing:border-box;" />' +
          '</div>' +

          '<div id="vtxPushWeeklyWrap" style="display:none;">' +
            '<label style="font-size:.75rem;font-weight:700;color:var(--text-3);' +
              'text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:.375rem;">Days</label>' +
            '<div style="display:flex;flex-wrap:wrap;gap:.5rem;">' +
              ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(function (d, i) {
                return '<label style="display:inline-flex;align-items:center;gap:.25rem;font-size:.75rem;color:var(--text-2);' +
                  'padding:.25rem .5rem;border:1px solid var(--border);border-radius:99px;cursor:pointer;">' +
                  '<input type="checkbox" class="vtx-push-weekday" value="' + i + '" style="margin:0;" />' + d +
                  '</label>';
              }).join('') +
            '</div>' +
          '</div>' +

          '<div id="vtxPushEndDateWrap" style="display:none;">' +
            '<label style="font-size:.75rem;font-weight:700;color:var(--text-3);' +
              'text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:.375rem;">End date (optional)</label>' +
            '<input id="vtxPushEndDate" type="date" style="width:100%;padding:.5rem .625rem;border-radius:var(--r-md);' +
              'border:1px solid var(--border);background:var(--bg-subtle);color:var(--text-1);' +
              'font-size:.875rem;font-family:var(--font);box-sizing:border-box;" />' +
          '</div>' +

          '<div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;">' +
            '<button id="vtxPushSendBtn" onclick="TeacherPush._send()" ' +
              'style="height:40px;padding:0 1.25rem;border-radius:var(--r-lg);' +
                'background:var(--accent);color:#fff;border:none;cursor:pointer;' +
                'font-size:.875rem;font-weight:700;font-family:var(--font);' +
                'display:inline-flex;align-items:center;gap:.5rem;' +
                'transition:opacity var(--t-fast);">' +
              '<i class="ph ph-paper-plane-tilt" style="font-size:16px;"></i> <span id="vtxPushSendLabel">Send Notification</span>' +
            '</button>' +
            '<span id="vtxPushResult" style="font-size:.8125rem;color:var(--text-3);"></span>' +
          '</div>' +

        '</div>' +
      '</div>' +

      '<div id="vtxScheduledWrap" style="border:1.5px solid var(--border);border-radius:var(--r-xl);' +
        'background:var(--bg-base);overflow:hidden;margin-bottom:1.25rem;">' +
        '<div style="padding:.75rem 1.125rem;background:var(--bg-subtle);border-bottom:1px solid var(--border);' +
          'display:flex;align-items:center;justify-content:space-between;">' +
          '<p style="font-size:.8125rem;font-weight:700;color:var(--text-1);">Scheduled &amp; Recurring Pushes</p>' +
          '<button onclick="TeacherPush._loadScheduled()" style="background:none;border:none;color:var(--accent);' +
            'font-size:.75rem;font-weight:600;cursor:pointer;font-family:var(--font);">Refresh</button>' +
        '</div>' +
        '<div id="vtxScheduledList" style="padding:1rem 1.125rem;font-size:.8125rem;color:var(--text-4);">Loading…</div>' +
      '</div>';

    _populateStudentSelect();
    _populateClassList();
    _loadScheduled();
  }

  function _onModeChange() {
    var mode = document.getElementById('vtxPushMode').value;
    var classWrap   = document.getElementById('vtxPushClassWrap');
    var studentWrap = document.getElementById('vtxPushStudentWrap');
    if (classWrap)   classWrap.style.display   = mode === 'classes' ? '' : 'none';
    if (studentWrap) studentWrap.style.display = mode === 'student' ? '' : 'none';
  }

  function _onTimingChange() {
    var timing = document.getElementById('vtxPushTiming').value;
    var onceWrap    = document.getElementById('vtxPushOnceWrap');
    var timeWrap    = document.getElementById('vtxPushTimeWrap');
    var weeklyWrap  = document.getElementById('vtxPushWeeklyWrap');
    var endDateWrap = document.getElementById('vtxPushEndDateWrap');
    var sendLabel   = document.getElementById('vtxPushSendLabel');

    if (onceWrap)    onceWrap.style.display    = timing === 'once' ? '' : 'none';
    if (timeWrap)    timeWrap.style.display    = (timing === 'daily' || timing === 'weekly') ? '' : 'none';
    if (weeklyWrap)  weeklyWrap.style.display  = timing === 'weekly' ? '' : 'none';
    if (endDateWrap) endDateWrap.style.display = (timing === 'daily' || timing === 'weekly') ? '' : 'none';

    if (sendLabel) sendLabel.textContent = timing === 'now' ? 'Send Notification' : 'Schedule Notification';
  }

  async function _populateStudentSelect() {
    var sel = document.getElementById('vtxPushTarget');
    if (!sel) return;
    sel.innerHTML = '';
    try {
      var snap = await window.fbDb.collection('students').orderBy('name').get();
      snap.forEach(function (doc) {
        var data = doc.data();
        if (!data.name) return;
        var opt = document.createElement('option');
        opt.value       = doc.id;
        opt.textContent = data.name + (data.class ? ' (' + data.class + ')' : '');
        sel.appendChild(opt);
      });
    } catch (e) {
      console.warn('[TeacherPush] Could not load student list:', e);
    }
  }

  async function _populateClassList() {
    var wrap = document.getElementById('vtxPushClassList');
    if (!wrap) return;
    try {
      var snap = await window.fbDb.collection('students').get();
      var set = {};
      snap.forEach(function (doc) {
        var c = (doc.data() || {}).class;
        if (c) set[c] = true;
      });
      var classes = Object.keys(set).sort();

      if (classes.length === 0) {
        wrap.innerHTML = '<span style="font-size:.75rem;color:var(--text-4);">No classes found.</span>';
        return;
      }

      wrap.innerHTML = classes.map(function (c) {
        return '<label style="display:inline-flex;align-items:center;gap:.3rem;font-size:.75rem;color:var(--text-2);' +
          'padding:.25rem .5rem;border:1px solid var(--border);border-radius:99px;cursor:pointer;">' +
          '<input type="checkbox" class="vtx-push-class-cb" value="' + c.replace(/"/g, '&quot;') + '" style="margin:0;" />' +
          c +
          '</label>';
      }).join('');
    } catch (e) {
      console.warn('[TeacherPush] Could not load class list:', e);
      wrap.innerHTML = '<span style="font-size:.75rem;color:var(--danger);">Could not load classes.</span>';
    }
  }

  async function _send() {
    var mode    = document.getElementById('vtxPushMode').value;
    var timing  = document.getElementById('vtxPushTiming').value;
    var titleEl = document.getElementById('vtxPushTitle');
    var bodyEl  = document.getElementById('vtxPushBody');
    var btn     = document.getElementById('vtxPushSendBtn');
    var result  = document.getElementById('vtxPushResult');

    if (!titleEl || !bodyEl) return;

    var title    = (titleEl.value || '').trim() || 'Message from Master Timothy';
    var bodyText = (bodyEl.value || '').trim();

    if (!bodyText) {
      if (window.UI) UI.toast('Please enter a message.', 'warning', 2500);
      return;
    }

    var targetClasses = null;
    var targetUid = null;

    if (mode === 'classes') {
      targetClasses = Array.prototype.slice.call(document.querySelectorAll('.vtx-push-class-cb:checked'))
        .map(function (cb) { return cb.value; });
      if (targetClasses.length === 0) {
        if (window.UI) UI.toast('Select at least one class.', 'warning', 2500);
        return;
      }
    } else if (mode === 'student') {
      var sel = document.getElementById('vtxPushTarget');
      targetUid = sel ? sel.value : null;
      if (!targetUid) {
        if (window.UI) UI.toast('Select a student.', 'warning', 2500);
        return;
      }
    }

    btn.disabled      = true;
    btn.style.opacity = '.5';
    if (result) result.textContent = timing === 'now' ? 'Sending…' : 'Scheduling…';

    try {
      if (timing === 'now') {
        var payload = {
          teacherUid: AppState.userId,
          title:      title,
          bodyText:   bodyText,
          notifUrl:   '/',
        };
        if (mode === 'all') {
          payload.targetUid = 'all';
        } else if (mode === 'classes') {
          payload.targetType    = 'classes';
          payload.targetClasses = targetClasses;
        } else {
          payload.targetUid = targetUid;
        }

        var res  = await fetch(WORKER_URL + '/api/send-push', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        });
        var data = await res.json();

        if (res.ok && data.success) {
          var msg;
          if (mode === 'student') {
            msg = data.sent ? 'Notification sent.' : ('Failed to send: ' + (data.reason || 'Push delivery failed.'));
          } else {
            msg = 'Sent to ' + (data.sent || 0) + ' / ' + (data.total || 0) + ' students.';
          }
          if (result) result.textContent = msg;
          if (window.UI) UI.toast(msg, 'success', 4000);
          if (bodyEl) bodyEl.value = '';
        } else {
          var errMsg = (data && data.error) || 'Send failed.';
          if (result) result.textContent = errMsg;
          if (window.UI) UI.toast(errMsg, 'error', 4000);
        }

      } else {
        var schedPayload = {
          teacherUid: AppState.userId,
          title:      title,
          bodyText:   bodyText,
          notifUrl:   '/',
          targetType: mode,
          recurrence: timing,
        };

        if (mode === 'classes') schedPayload.targetClasses = targetClasses;
        if (mode === 'student')  schedPayload.targetUid     = targetUid;

        if (timing === 'once') {
          var onceEl = document.getElementById('vtxPushOnceAt');
          if (!onceEl || !onceEl.value) {
            if (window.UI) UI.toast('Pick a date and time.', 'warning', 2500);
            btn.disabled = false; btn.style.opacity = '1';
            return;
          }
          schedPayload.sendAtUTC = new Date(onceEl.value).toISOString();
        } else {
          var timeEl = document.getElementById('vtxPushTimeOfDay');
          if (!timeEl || !timeEl.value) {
            if (window.UI) UI.toast('Pick a time of day.', 'warning', 2500);
            btn.disabled = false; btn.style.opacity = '1';
            return;
          }
          schedPayload.timeOfDay = timeEl.value;

          var endEl = document.getElementById('vtxPushEndDate');
          if (endEl && endEl.value) schedPayload.endDate = endEl.value;

          if (timing === 'weekly') {
            var days = Array.prototype.slice.call(document.querySelectorAll('.vtx-push-weekday:checked'))
              .map(function (cb) { return parseInt(cb.value, 10); });
            if (days.length === 0) {
              if (window.UI) UI.toast('Select at least one day.', 'warning', 2500);
              btn.disabled = false; btn.style.opacity = '1';
              return;
            }
            schedPayload.weeklyDays = days;
          }
        }

        var res2  = await fetch(WORKER_URL + '/api/schedule-push', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(schedPayload),
        });
        var data2 = await res2.json();

        if (res2.ok && data2.success) {
          if (result) result.textContent = 'Scheduled.';
          if (window.UI) UI.toast('Notification scheduled.', 'success', 4000);
          if (bodyEl) bodyEl.value = '';
          _loadScheduled();
        } else {
          var errMsg2 = (data2 && data2.error) || 'Scheduling failed.';
          if (result) result.textContent = errMsg2;
          if (window.UI) UI.toast(errMsg2, 'error', 4000);
        }
      }
    } catch (e) {
      console.error('[TeacherPush] send/schedule error:', e);
      if (result) result.textContent = 'Network error. Please try again.';
      if (window.UI) UI.toast('Could not reach the server. Check your connection.', 'error', 4000);
    } finally {
      btn.disabled      = false;
      btn.style.opacity = '1';
    }
  }

  async function _loadScheduled() {
    var wrap = document.getElementById('vtxScheduledList');
    if (!wrap) return;
    wrap.textContent = 'Loading…';

    try {
      var res  = await fetch(WORKER_URL + '/api/list-scheduled-pushes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ teacherUid: AppState.userId }),
      });
      var data = await res.json();

      if (!res.ok || !data.success) {
        wrap.innerHTML = '<span style="color:var(--danger);">Could not load scheduled pushes.</span>';
        return;
      }

      var active = (data.scheduled || []).filter(function (r) { return r.status === 'active'; });

      if (active.length === 0) {
        wrap.innerHTML = '<span style="color:var(--text-4);">No scheduled or recurring pushes.</span>';
        return;
      }

      wrap.innerHTML = active.map(function (r) {
        var targetLabel = r.targetType === 'classes'
          ? 'Classes: ' + (r.targetClasses || []).join(', ')
          : r.targetType === 'student'
          ? 'One student'
          : 'All students';

        var whenLabel;
        if (r.recurrence === 'once') {
          whenLabel = 'Once — ' + new Date(r.sendAtUTC).toLocaleString();
        } else if (r.recurrence === 'daily') {
          whenLabel = 'Daily at ' + r.timeOfDay + ' (Lagos)';
        } else {
          var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          var days = (r.weeklyDays || []).map(function (d) { return dayNames[d]; }).join(', ');
          whenLabel = 'Weekly (' + days + ') at ' + r.timeOfDay + ' (Lagos)';
        }

        return '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;' +
          'padding:.625rem 0;border-bottom:1px solid var(--border);">' +
          '<div style="min-width:0;">' +
            '<p style="font-size:.8125rem;font-weight:600;color:var(--text-1);">' + (r.title || '') + '</p>' +
            '<p style="font-size:.75rem;color:var(--text-3);margin-top:2px;">' + (r.bodyText || '') + '</p>' +
            '<p style="font-size:.6875rem;color:var(--text-4);margin-top:2px;">' + targetLabel + ' &middot; ' + whenLabel + '</p>' +
          '</div>' +
          '<button onclick="TeacherPush._cancelScheduled(\'' + r.id + '\')" ' +
            'style="flex-shrink:0;background:var(--danger-subtle);border:1px solid var(--danger-border);' +
            'color:var(--danger-text);font-size:.6875rem;font-weight:600;padding:.25rem .625rem;' +
            'border-radius:99px;cursor:pointer;font-family:var(--font);">Cancel</button>' +
        '</div>';
      }).join('');
    } catch (e) {
      console.warn('[TeacherPush] load scheduled error:', e);
      wrap.innerHTML = '<span style="color:var(--danger);">Network error loading scheduled pushes.</span>';
    }
  }

  async function _cancelScheduled(id) {
    try {
      var res  = await fetch(WORKER_URL + '/api/cancel-scheduled-push', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ teacherUid: AppState.userId, id: id }),
      });
      var data = await res.json();
      if (res.ok && data.success) {
        if (window.UI) UI.toast('Scheduled push cancelled.', 'info', 3000);
        _loadScheduled();
      } else {
        if (window.UI) UI.toast((data && data.error) || 'Could not cancel.', 'error', 3000);
      }
    } catch (e) {
      if (window.UI) UI.toast('Network error.', 'error', 3000);
    }
  }

  /* ══════════════════════════════════════════════════════════
     MESSAGE ALERTS — private-message phone alerts
     ──────────────────────────────────────────────────────────
     • "Alerts on this phone"  → registers THIS device for pushes
     • "Alert me when students message me" → master switch (default ON, KV tprefs.enabled)
     • Per student:
         "Student gets my messages" → students/{uid}.dmPushEnabled   (default OFF)
         "I get their messages"     → KV tprefs.mutedStudents        (default ON)
     ══════════════════════════════════════════════════════════ */
  var _al = { enabled: true, muted: [], subscribed: [], students: [], deviceOn: false, filter: '' };
  var _alBox = null;

  function _alEsc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _alToast(msg, type) { if (window.UI && UI.toast) UI.toast(msg, type || 'info', 3000); }

  async function _alPost(payload) {
    var res = await fetch(WORKER_URL + '/api/teacher-push-prefs', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(Object.assign({ teacherUid: AppState.userId }, payload)),
    });
    var data = await res.json();
    if (!res.ok || !data.success) throw new Error((data && data.error) || 'Request failed');
    return data;
  }

  function _alSwitch(on, onclick, label, disabled) {
    return '<button role="switch" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="' + _alEsc(label) + '" ' +
      (disabled ? 'disabled ' : '') + 'onclick="' + onclick + '" ' +
      'style="position:relative;width:40px;height:24px;border-radius:99px;border:none;padding:0;flex-shrink:0;' +
      'cursor:' + (disabled ? 'not-allowed' : 'pointer') + ';opacity:' + (disabled ? '.45' : '1') + ';' +
      'background:' + (on ? 'var(--success)' : 'var(--bg-muted)') + ';transition:background .2s;">' +
      '<span style="position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;' +
      'box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s;display:block;' +
      'transform:' + (on ? 'translateX(16px)' : 'none') + ';"></span></button>';
  }

  function _alStudentRows() {
    var q = _al.filter.trim().toLowerCase();
    var list = _al.students.filter(function (s) {
      return !q || (s.name || '').toLowerCase().indexOf(q) !== -1 || (s.cls || '').toLowerCase().indexOf(q) !== -1;
    });
    if (list.length === 0) {
      return '<p style="font-size:.8125rem;color:var(--text-4);padding:.75rem 0;">No students found.</p>';
    }
    return list.map(function (s) {
      var ready   = _al.subscribed.indexOf(s.uid) !== -1;
      var iGet    = _al.muted.indexOf(s.uid) === -1;
      var uidAttr = _alEsc(s.uid).replace(/'/g, '');
      return '<div style="padding:.625rem 0;border-top:1px solid var(--border);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.5rem;">' +
          '<div style="min-width:0;">' +
            '<p style="font-size:.875rem;font-weight:600;color:var(--text-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _alEsc(s.name || 'Student') + '</p>' +
            '<p style="font-size:.6875rem;color:var(--text-4);">' + _alEsc(s.cls || '') + '</p>' +
          '</div>' +
          '<span style="flex-shrink:0;font-size:.625rem;font-weight:700;padding:2px 8px;border-radius:99px;' +
            (ready ? 'background:var(--success-subtle,#e7f7ec);color:var(--success-text,#15803d);'
                   : 'background:var(--bg-muted);color:var(--text-4);') + '">' +
            (ready ? 'Phone ready' : 'Phone not set up') + '</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.375rem;">' +
          '<span style="font-size:.75rem;color:var(--text-2);">Student gets my messages</span>' +
          _alSwitch(s.dmPush, "TeacherPush._alStudent('" + uidAttr + "')", 'Student gets my messages') +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;">' +
          '<span style="font-size:.75rem;color:var(--text-2);">I get their messages</span>' +
          _alSwitch(iGet && _al.enabled, "TeacherPush._alMute('" + uidAttr + "')", 'I get their messages', !_al.enabled) +
        '</div>' +
      '</div>';
    }).join('');
  }

  function _alRender() {
    if (!_alBox || !document.body.contains(_alBox)) return;
    var keepFocus = document.activeElement && document.activeElement.id === 'vtxAlSearch';
    var caret = keepFocus ? document.activeElement.selectionStart : 0;

    _alBox.innerHTML =
      '<div style="border:1.5px solid var(--border);border-radius:var(--r-xl);background:var(--bg-base);overflow:hidden;margin-bottom:1.25rem;">' +
        '<div style="padding:.875rem 1.125rem;background:var(--accent);display:flex;align-items:center;gap:.625rem;">' +
          '<i class="ph ph-chat-circle-dots" style="font-size:18px;color:#fff;flex-shrink:0;"></i>' +
          '<div>' +
            '<p style="font-size:.9375rem;font-weight:700;color:#fff;line-height:1.2;">Message alerts</p>' +
            '<p style="font-size:.6875rem;color:rgba(255,255,255,.75);margin-top:1px;">Phone alerts for private messages</p>' +
          '</div>' +
        '</div>' +
        '<div style="padding:1rem 1.125rem;">' +

          '<div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.875rem;">' +
            '<div><p style="font-size:.875rem;font-weight:600;color:var(--text-1);">Alerts on this phone</p>' +
            '<p style="font-size:.75rem;color:var(--text-3);margin-top:2px;line-height:1.5;">Turn this on so this device can receive alerts.</p></div>' +
            _alSwitch(_al.deviceOn, 'TeacherPush._alDevice()', 'Alerts on this phone') +
          '</div>' +

          '<div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1rem;">' +
            '<div><p style="font-size:.875rem;font-weight:600;color:var(--text-1);">Alert me when students message me</p>' +
            '<p style="font-size:.75rem;color:var(--text-3);margin-top:2px;line-height:1.5;">On by default. Switch off to stop all of them, or mute single students below.</p></div>' +
            _alSwitch(_al.enabled, 'TeacherPush._alMaster()', 'Alert me when students message me') +
          '</div>' +

          '<div style="border-top:1px solid var(--border);padding-top:.875rem;">' +
            '<p style="font-size:.75rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.25rem;">Students</p>' +
            '<p style="font-size:.75rem;color:var(--text-3);line-height:1.5;margin-bottom:.625rem;">' +
              '“Student gets my messages” sends your private messages to that student’s phone. It stays off until you turn it on. ' +
              'A student also needs to have opened the app and allowed alerts (shown as “Phone ready”).</p>' +
            '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.625rem;">' +
              '<input id="vtxAlSearch" type="search" placeholder="Search students…" value="' + _alEsc(_al.filter) + '" ' +
                'oninput="TeacherPush._alFilter(this.value)" ' +
                'style="flex:1;min-width:140px;padding:.5rem .625rem;border-radius:var(--r-md);border:1px solid var(--border);' +
                'background:var(--bg-subtle);color:var(--text-1);font-size:.875rem;font-family:var(--font);box-sizing:border-box;" />' +
              '<button onclick="TeacherPush._alBulk(true)" style="padding:.5rem .75rem;border-radius:var(--r-md);border:1px solid var(--border);' +
                'background:var(--bg-base);color:var(--text-2);font-size:.75rem;font-weight:600;cursor:pointer;font-family:var(--font);">Turn on for everyone</button>' +
              '<button onclick="TeacherPush._alBulk(false)" style="padding:.5rem .75rem;border-radius:var(--r-md);border:1px solid var(--border);' +
                'background:var(--bg-base);color:var(--text-2);font-size:.75rem;font-weight:600;cursor:pointer;font-family:var(--font);">Turn off for everyone</button>' +
            '</div>' +
            '<div>' + _alStudentRows() + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    if (keepFocus) {
      var inp = document.getElementById('vtxAlSearch');
      if (inp) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch (e) {} }
    }
  }

  async function renderAlertsPanel(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    _alBox = el;
    el.innerHTML = '<p style="font-size:.8125rem;color:var(--text-3);padding:.75rem 0;">Loading message alerts…</p>';

    try {
      var results = await Promise.all([
        _alPost({ action: 'get' }),
        window.fbDb.collection('students').get(),
        (window.Notifications && Notifications.isSubscribed) ? Notifications.isSubscribed() : Promise.resolve(false),
      ]);
      var prefs = results[0];
      _al.enabled    = prefs.enabled !== false;
      _al.muted      = prefs.mutedStudents || [];
      _al.subscribed = prefs.subscribed || [];
      _al.deviceOn   = !!results[2];
      _al.students   = [];
      results[1].forEach(function (d) {
        var x = d.data() || {};
        if (d.id === AppState.userId) return;
        _al.students.push({ uid: d.id, name: x.name || '', cls: x.class || '', dmPush: x.dmPushEnabled === true });
      });
      _al.students.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
      _al.filter = '';
      _alRender();
    } catch (e) {
      console.warn('[TeacherPush] alerts panel load error:', e);
      el.innerHTML = '<p style="font-size:.8125rem;color:var(--danger);padding:.75rem 0;">Could not load message alerts. Check your internet and reopen this tab.</p>';
    }
  }

  async function _alDevice() {
    if (!window.Notifications) return;
    if (_al.deviceOn) { await Notifications.unsubscribe(); }
    else              { await Notifications.subscribe(); }
    _al.deviceOn = await Notifications.isSubscribed();
    _alRender();
  }

  async function _alMaster() {
    var next = !_al.enabled;
    _al.enabled = next; _alRender();
    try { await _alPost({ action: 'set', enabled: next }); }
    catch (e) { _al.enabled = !next; _alRender(); _alToast('Could not save. Try again.', 'error'); }
  }

  async function _alMute(uid) {
    var wasMuted = _al.muted.indexOf(uid) !== -1;
    var before = _al.muted.slice();
    _al.muted = wasMuted ? _al.muted.filter(function (u) { return u !== uid; }) : _al.muted.concat([uid]);
    _alRender();
    try { await _alPost({ action: 'set', mutedStudents: _al.muted }); }
    catch (e) { _al.muted = before; _alRender(); _alToast('Could not save. Try again.', 'error'); }
  }

  async function _alStudent(uid) {
    var s = _al.students.filter(function (x) { return x.uid === uid; })[0];
    if (!s) return;
    var next = !s.dmPush;
    s.dmPush = next; _alRender();
    try {
      await window.fbDb.collection('students').doc(uid).update({ dmPushEnabled: next });
    } catch (e) {
      s.dmPush = !next; _alRender();
      _alToast('Could not save. Try again.', 'error');
    }
  }

  async function _alBulk(on) {
    var targets = _al.students.filter(function (s) {
      var q = _al.filter.trim().toLowerCase();
      return !q || (s.name || '').toLowerCase().indexOf(q) !== -1 || (s.cls || '').toLowerCase().indexOf(q) !== -1;
    });
    if (targets.length === 0) return;
    var label = _al.filter.trim() ? 'the ' + targets.length + ' students shown' : 'all ' + targets.length + ' students';
    if (!window.confirm((on ? 'Turn ON' : 'Turn OFF') + ' phone alerts for your messages to ' + label + '?')) return;

    try {
      for (var i = 0; i < targets.length; i += 400) {
        var batch = window.fbDb.batch();
        targets.slice(i, i + 400).forEach(function (s) {
          batch.update(window.fbDb.collection('students').doc(s.uid), { dmPushEnabled: on });
        });
        await batch.commit();
      }
      targets.forEach(function (s) { s.dmPush = on; });
      _alRender();
      _alToast('Done — updated ' + targets.length + ' students.', 'success');
    } catch (e) {
      console.warn('[TeacherPush] bulk update failed:', e);
      _alToast('Could not update everyone. Try again.', 'error');
    }
  }

  function _alFilter(v) { _al.filter = v || ''; _alRender(); }

  window.TeacherPush = {
    renderPushPanel:   renderPushPanel,
    renderAlertsPanel: renderAlertsPanel,
    _alDevice:         _alDevice,
    _alMaster:         _alMaster,
    _alMute:           _alMute,
    _alStudent:        _alStudent,
    _alBulk:           _alBulk,
    _alFilter:         _alFilter,
    _onModeChange:     _onModeChange,
    _onTimingChange:   _onTimingChange,
    _send:             _send,
    _loadScheduled:    _loadScheduled,
    _cancelScheduled:  _cancelScheduled,
  };

}());
