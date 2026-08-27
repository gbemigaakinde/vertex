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

  window.TeacherPush = {
    renderPushPanel:   renderPushPanel,
    _onModeChange:     _onModeChange,
    _onTimingChange:   _onTimingChange,
    _send:             _send,
    _loadScheduled:    _loadScheduled,
    _cancelScheduled:  _cancelScheduled,
  };

}());
