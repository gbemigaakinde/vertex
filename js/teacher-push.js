/* ============================================================
   Teacher push notification panel
   Call Teacher.renderPushPanel('someDivId') to mount it,
   or inline it wherever the teacher dashboard renders.
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

        // Header
        '<div style="padding:.875rem 1.125rem;background:var(--accent);' +
          'display:flex;align-items:center;gap:.625rem;">' +
          '<i class="ph ph-bell-ringing" style="font-size:18px;color:#fff;flex-shrink:0;"></i>' +
          '<div>' +
            '<p style="font-size:.9375rem;font-weight:700;color:#fff;line-height:1.2;">Send Push Notification</p>' +
            '<p style="font-size:.6875rem;color:rgba(255,255,255,.75);margin-top:1px;">Send to one student or broadcast to all</p>' +
          '</div>' +
        '</div>' +

        // Form body
        '<div style="padding:1rem 1.125rem;display:flex;flex-direction:column;gap:.75rem;">' +

          // Target selector
          '<div>' +
            '<label style="font-size:.75rem;font-weight:700;color:var(--text-3);' +
              'text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:.375rem;">Send to</label>' +
            '<select id="vtxPushTarget" style="width:100%;padding:.5rem .625rem;border-radius:var(--r-md);' +
              'border:1px solid var(--border);background:var(--bg-subtle);' +
              'color:var(--text-1);font-size:.875rem;font-family:var(--font);cursor:pointer;">' +
              '<option value="all">All students</option>' +
            '</select>' +
          '</div>' +

          // Title
          '<div>' +
            '<label style="font-size:.75rem;font-weight:700;color:var(--text-3);' +
              'text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:.375rem;">Notification title</label>' +
            '<input id="vtxPushTitle" type="text" value="Message from Master Timothy" ' +
              'style="width:100%;padding:.5rem .625rem;border-radius:var(--r-md);' +
              'border:1px solid var(--border);background:var(--bg-subtle);' +
              'color:var(--text-1);font-size:.875rem;font-family:var(--font);box-sizing:border-box;" />' +
          '</div>' +

          // Message
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

          // Send button + result
          '<div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;">' +
            '<button id="vtxPushSendBtn" onclick="TeacherPush._send()" ' +
              'style="height:40px;padding:0 1.25rem;border-radius:var(--r-lg);' +
                'background:var(--accent);color:#fff;border:none;cursor:pointer;' +
                'font-size:.875rem;font-weight:700;font-family:var(--font);' +
                'display:inline-flex;align-items:center;gap:.5rem;' +
                'transition:opacity var(--t-fast);">' +
              '<i class="ph ph-paper-plane-tilt" style="font-size:16px;"></i> Send Notification' +
            '</button>' +
            '<span id="vtxPushResult" style="font-size:.8125rem;color:var(--text-3);"></span>' +
          '</div>' +

        '</div>' +
      '</div>';

    // Populate student list from Firestore
    _populateStudentSelect();
  }

  async function _populateStudentSelect() {
    var sel = document.getElementById('vtxPushTarget');
    if (!sel) return;

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

  async function _send() {
    var sel     = document.getElementById('vtxPushTarget');
    var titleEl = document.getElementById('vtxPushTitle');
    var bodyEl  = document.getElementById('vtxPushBody');
    var btn     = document.getElementById('vtxPushSendBtn');
    var result  = document.getElementById('vtxPushResult');

    if (!sel || !titleEl || !bodyEl) return;

    var targetUid = sel.value || 'all';
    var title     = (titleEl.value || '').trim() || 'Message from Master Timothy';
    var bodyText  = (bodyEl.value || '').trim();

    if (!bodyText) {
      if (window.UI) UI.toast('Please enter a message.', 'warning', 2500);
      return;
    }

    btn.disabled      = true;
    btn.style.opacity = '.5';
    if (result) result.textContent = 'Sending…';

    try {
      var res = await fetch(WORKER_URL + '/api/send-push', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherUid: AppState.userId,
          targetUid:  targetUid,
          title:      title,
          bodyText:   bodyText,
          notifUrl:   '/',
        }),
      });

      var data = await res.json();

      if (res.ok && data.success) {
        var msg;
        if (targetUid === 'all') {
          msg = 'Sent to ' + (data.sent || 0) + ' / ' + (data.total || 0) + ' students.';
        } else {
          if (data.sent) {
            msg = 'Notification sent.';
          } else if (data.reason === 'No subscription.' || data.reason === 'No subscription found.') {
            msg = 'Student has no push subscription.';
          } else {
            msg = 'Failed to send: ' + (data.reason || 'Push delivery failed. Check worker logs.');
          }
        }
        if (result) result.textContent = msg;
        if (window.UI) UI.toast(msg, 'success', 4000);
        if (bodyEl) bodyEl.value = '';
      } else {
        var errMsg = (data && data.error) || 'Send failed.';
        if (result) result.textContent = errMsg;
        if (window.UI) UI.toast(errMsg, 'error', 4000);
      }
    } catch (e) {
      console.error('[TeacherPush] send error:', e);
      if (result) result.textContent = 'Network error. Please try again.';
      if (window.UI) UI.toast('Could not send notification. Check your connection.', 'error', 4000);
    } finally {
      btn.disabled      = false;
      btn.style.opacity = '1';
    }
  }

  window.TeacherPush = {
    renderPushPanel: renderPushPanel,
    _send:           _send,
  };

}());
