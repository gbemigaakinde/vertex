/* ============================================================
   meet/meet.js — Vertex Live Meetings (LiveKit)
   Self-contained: injects its own screen (no floating button).
   Open it with Meet.open(): students from Settings, teachers from the "Live" tab.
   Needs: window.fbAuth (js/config.js), meet/vendor/livekit-client.umd.js, meet/meet.css,
          Phosphor icons (already loaded by index.html)
   Backend: POST {WORKER_URL}/meet/op  (see meet/worker-meet.js)
   ============================================================ */
(function () {
  'use strict';
  var WORKER_URL = (window.MEET_WORKER_URL || 'https://vertex-worker.gbemigaakinde.workers.dev');
  var root, poll, loadSeq = 0;
  var state = { tab: 'upcoming', meetings: [], replays: [], role: 'student', audience: null, form: null, room: null, loaded: false, extra: {}, codeText: '' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var $ = function (sel, el) { return (el || root).querySelector(sel); };
  var ic = function (n) { return '<i class="ph ph-' + n + '" aria-hidden="true"></i>'; };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ── API ── */
  function api(action, body) {
    var u = window.fbAuth && window.fbAuth.currentUser;
    if (!u) return Promise.reject(new Error('Please sign in first.'));
    return u.getIdToken().then(function (t) {
      return fetch(WORKER_URL + '/meet/op', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(Object.assign({ action: action }, body || {})) });
    }, function () { throw new Error('Could not verify your sign-in. Please try again.'); })
      .catch(function (e) { if (e && e.message && /Failed to fetch|NetworkError|Load failed/i.test(e.message)) throw new Error('You appear to be offline. Check your connection and try again.'); throw e; })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error(j.message || j.error || 'Something went wrong. Please try again.'); e.code = j.error; e.status = r.status; throw e; }
          return j;
        });
      });
  }
  function toast(msg) {
    var old = document.querySelector('.vm-toast'); if (old) old.remove();
    var t = document.createElement('div'); t.className = 'vm-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3600);
  }
  function isTeacher() { return state.role === 'teacher'; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTime(ts) { try { return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
  function fmtDate(ts) { try { return new Date(ts).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return ''; } }
  function localInput(ts) { var d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function when(m) {
    var d = new Date(m.startsAt), now = new Date(), tom = new Date(now.getTime() + 864e5);
    var day = d.toDateString() === now.toDateString() ? 'Today' : d.toDateString() === tom.toDateString() ? 'Tomorrow' : fmtDate(m.startsAt);
    return day + ', ' + fmtTime(m.startsAt);
  }

  /* ── Dialog (replaces browser confirm popups) ── */
  function ask(o, host) {
    var h = host || root, m = document.createElement('div'); m.className = 'vm-modal';
    var btns = (o.buttons || [{ label: 'Cancel', ghost: true }, { label: o.ok || 'OK', danger: o.danger, pri: !o.danger, ok: true }]).map(function (b, i) {
      return '<button class="vm-btn' + (b.danger ? ' danger' : b.pri ? ' pri' : b.ghost ? ' ghost' : '') + '" data-i="' + i + '">' + esc(b.label) + '</button>';
    }).join('');
    m.innerHTML = '<div class="vm-dialog' + (o.stack ? ' stack' : '') + '" role="dialog" aria-modal="true"><h4>' + esc(o.title) + '</h4><p>' + esc(o.text || '') + '</p><div class="vm-actions">' + btns + '</div></div>';
    m.addEventListener('click', function (e) {
      if (e.target === m) return m.remove();
      var b = e.target.closest('[data-i]'); if (!b) return;
      var spec = (o.buttons || [null, { ok: true }])[+b.dataset.i]; m.remove();
      if (o.buttons) { if (spec.fn) spec.fn(); } else if (spec && spec.ok && o.onOk) o.onOk();
    });
    h.appendChild(m); var first = m.querySelector('.vm-btn.pri,.vm-btn.danger'); if (first) first.focus();
  }

  /* ── Shell ── */
  function build() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'vm-root'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Live meetings');
    root.innerHTML =
      '<div class="vm-top"><div class="vm-top-title"><div class="vm-logo">' + ic('video-camera') + '</div><div><h2>Live</h2><small>Classes and meetings</small></div></div>' +
      '<button class="vm-btn pri newbtn" data-a="new" style="display:none">' + ic('plus') + '<span>New meeting</span></button>' +
      '<button class="vm-iconbtn" data-a="theme" aria-label="Switch light or dark mode">' + ic('moon') + '</button>' +
      '<button class="vm-iconbtn" data-a="close" aria-label="Close">' + ic('x') + '</button></div>' +
      '<div class="vm-tabs" role="tablist"><button class="vm-tab on" data-tab="upcoming" role="tab">Meetings</button><button class="vm-tab" data-tab="replays" role="tab">Replays</button></div>' +
      '<div class="vm-body" id="vm-body"></div>' +
      '<div class="vm-room" id="vm-room"></div>';
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    root.addEventListener('input', function () { if (state.form) readForm(); });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.id === 'vm-code') { e.preventDefault(); joinByCode(e.target.value, $('[data-a="joincode"]')); return; }
      if (e.key !== 'Escape') return;
      var dlg = root.querySelector('.vm-modal:last-child'); if (dlg && dlg.classList.contains('vm-modal')) { dlg.remove(); return; }
      if (!state.room) close();
    });
    themeIcon();
    new MutationObserver(themeIcon).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  function themeIcon() {
    if (!root) return; var b = root.querySelector('[data-a="theme"]'); if (!b) return;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    b.innerHTML = ic(dark ? 'sun' : 'moon');
  }
  function open() {
    build(); root.classList.add('open'); document.body.classList.add('vm-open');
    refresh(true); clearInterval(poll);
    poll = setInterval(function () { if (!state.room && !state.form && root.classList.contains('open') && !(document.activeElement && document.activeElement.id === 'vm-code')) refresh(false); }, 30000);
  }
  function close() {
    if (!root) return;
    if (state.room) { toast('Leave the meeting first.'); return; }
    root.classList.remove('open'); document.body.classList.remove('vm-open'); clearInterval(poll); state.form = null;
    checkLive();
  }

  function refresh(showSkeleton) {
    if (!root) return;
    var b = $('#vm-body'), seq = ++loadSeq;
    if (showSkeleton && !state.loaded) b.innerHTML = '<div class="vm-skel"></div><div class="vm-skel"></div><div class="vm-skel"></div>';
    Promise.all([api('list'), api('replays').catch(function () { return { replays: [] }; })]).then(function (r) {
      state.meetings = r[0].meetings || []; state.role = r[0].role; state.replays = r[1].replays || [];
      var ids = Object.keys(state.extra);
      return Promise.all(ids.map(function (id) {
        return api('find-code', { code: state.extra[id].code }).then(function (x) { return x.meeting; }).catch(function () { return null; });
      })).then(function (found) {
        ids.forEach(function (id, i) {
          var m = found[i];
          if (!m) { delete state.extra[id]; return; }
          if (state.meetings.some(function (x) { return x.id === m.id; })) { delete state.extra[id]; return; }
          m._code = state.extra[id].code; state.meetings.push(m);
        });
      });
    }).then(function () {
      if (seq !== loadSeq) return;
      state.loaded = true; setLive();
      $('[data-a="new"]').style.display = isTeacher() ? '' : 'none';
      if (!state.form) render();
    }).catch(function (e) {
      if (seq !== loadSeq || state.loaded) return;
      var off = /offline|connection/i.test(e.message || '');
      b.innerHTML = '<div class="vm-empty">' + ic(off ? 'wifi-slash' : 'warning-circle') + '<b>' + (off ? 'You are offline' : 'Could not load meetings') + '</b><p>' + esc(e.message) + '</p><p style="margin-top:14px"><button class="vm-btn pri" data-a="retry">Try again</button></p></div>';
    });
  }
  function setLive() {
    var live = state.meetings.some(function (m) { return m.status === 'live'; });
    if (window.Meet) Meet.live = live;
    try { window.dispatchEvent(new CustomEvent('vm:live', { detail: live })); } catch (e) { /* ignore */ }
  }
  function checkLive() { if (window.fbAuth && window.fbAuth.currentUser) api('list').then(function (r) { state.meetings = r.meetings || []; state.role = r.role; setLive(); }).catch(function () {}); }

  function render() {
    root.querySelectorAll('.vm-tab').forEach(function (t) { var on = t.dataset.tab === state.tab; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); });
    var b = $('#vm-body'), h = '', ci = $('#vm-code'); if (ci) state.codeText = ci.value;
    if (!isTeacher() && state.tab === 'upcoming' && !state.form) h += '<form class="vm-joincode" onsubmit="return false">' + ic('key') + '<input type="text" id="vm-code" placeholder="Have a meeting code? Enter it here" maxlength="14" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-label="Meeting code" value="' + esc(state.codeText) + '"><button type="button" class="vm-btn pri" data-a="joincode">Join</button></form>';
    if (state.form) h += formHtml();
    if (state.tab === 'upcoming') {
      var list = state.meetings.filter(function (m) { return m.status !== 'ended'; }).sort(function (a, c) { return (a.status === 'live' ? -1 : 0) - (c.status === 'live' ? -1 : 0) || a.startsAt - c.startsAt; });
      if (!list.length && !state.form) h += '<div class="vm-empty">' + ic('calendar-blank') + '<b>No meetings scheduled</b><p>' + (isTeacher() ? 'Create a meeting to teach live, share your screen and record the class.' : 'When your teacher schedules a live class for you, it shows up here. Got a code? Enter it above.') + '</p></div>';
      list.forEach(function (m) { h += meetingCard(m); });
    } else {
      if (!state.replays.length) h += '<div class="vm-empty">' + ic('film-slate') + '<b>No recordings yet</b><p>Replays appear here after a recorded meeting ends.</p></div>';
      state.replays.forEach(function (m) {
        var d = new Date(m.startsAt);
        h += '<div class="vm-card"><div class="vm-date"><b>' + d.getDate() + '</b><span>' + MONTHS[d.getMonth()] + '</span></div><div class="vm-info"><h3>' + esc(m.title) + '</h3><div class="vm-meta"><span>' + ic('clock') + esc(fmtTime(m.startsAt)) + '</span></div></div><div class="vm-actions"><button class="vm-btn soft" data-a="replay" data-id="' + esc(m.id) + '">' + ic('play') + 'Watch replay</button></div></div>';
      });
    }
    b.innerHTML = h;
    if (state.form) bindForm();
  }

  function meetingCard(m) {
    var live = m.status === 'live', t = isTeacher(), a = '', d = new Date(m.startsAt), id = esc(m.id);
    var au = m.audience || { type: 'all' };
    var who = au.type === 'all' ? 'All students' : au.type === 'classes' ? (au.classes || []).join(', ') : au.type === 'students' ? (au.students || []).length + ' selected student' + ((au.students || []).length === 1 ? '' : 's') : '';
    if (t) {
      a += live ? '<button class="vm-btn pri" data-a="join" data-id="' + id + '">' + ic('sign-in') + 'Re-join</button>' : '<button class="vm-btn pri" data-a="start" data-id="' + id + '">' + ic('play') + 'Start</button>';
      a += '<button class="vm-btn" data-a="share" data-id="' + id + '">' + ic('share-network') + 'Invite</button>';
      if (!live) a += '<button class="vm-btn" data-a="edit" data-id="' + id + '">' + ic('pencil-simple') + 'Edit</button>';
      a += '<button class="vm-btn ghost" data-a="cancel" data-id="' + id + '">' + (live ? 'End' : 'Cancel') + '</button>';
    } else a += live ? '<button class="vm-btn pri" data-a="join" data-id="' + id + '">' + ic('sign-in') + 'Join now</button>' : '<button class="vm-btn" data-a="join" data-id="' + id + '">Join</button>';
    if (!t && m._code) a = a.replace(/data-a="join"/g, 'data-a="join" data-code="' + esc(m._code) + '"');
    return '<div class="vm-card' + (live ? ' is-live' : '') + '"><div class="vm-date"><b>' + d.getDate() + '</b><span>' + MONTHS[d.getMonth()] + '</span></div>' +
      '<div class="vm-info"><h3>' + esc(m.title) + '</h3><div class="vm-meta">' + (live ? '<span class="vm-badge live">Live</span>' : '') +
      '<span>' + ic('clock') + esc(when(m)) + ' &middot; ' + (+m.durationMin || 0) + ' min</span>' +
      (m.recordingEnabled ? '<span class="vm-badge ok">' + ic('record') + 'Recorded</span>' : '') +
      (t && who ? '<span>' + ic('users') + esc(who) + '</span>' : '') + '</div>' +
      (m.description ? '<p class="vm-desc">' + esc(m.description) + '</p>' : '') + '</div><div class="vm-actions">' + a + '</div></div>';
  }

  /* ── Schedule form (teacher) ── */
  function openForm(m) {
    state.form = { id: m ? m.id : null, title: m ? m.title : '', description: m ? (m.description || '') : '', startsAt: m ? m.startsAt : Math.ceil((Date.now() + 36e5) / 9e5) * 9e5, durationMin: m ? m.durationMin : 60,
      type: m ? m.audience.type : 'classes', classes: m ? (m.audience.classes || []).slice() : [], students: m ? (m.audience.students || []).slice() : [], rec: m ? !!m.recordingEnabled : true, err: '' };
    state.tab = 'upcoming'; render(); $('#vm-body').scrollTop = 0;
    var t = $('#vm-t'); if (t) t.focus();
    if (!state.audience) api('audience').then(function (a) { state.audience = a; if (state.form) { readForm(); render(); } }).catch(function (e) { if (state.form) { state.form.err = e.message; readForm(); render(); } });
  }
  function formHtml() {
    var f = state.form, au = state.audience, chips = '';
    if (f.type === 'all') chips = '<p class="vm-hint">Every student in your school can join.</p>';
    else if (!au) chips = '<p class="vm-hint">Loading classes and students…</p>';
    else if (f.type === 'classes') { chips = (au.classes || []).map(function (c) { return '<button type="button" class="vm-chip' + (f.classes.indexOf(c.name) > -1 ? ' on' : '') + '" data-cls="' + esc(c.name) + '" aria-pressed="' + (f.classes.indexOf(c.name) > -1) + '">' + esc(c.name) + ' (' + (+c.count || 0) + ')</button>'; }).join(''); chips = chips ? '<div class="vm-chips">' + chips + '</div>' : '<p class="vm-hint">No classes found yet.</p>'; }
    else chips = '<input type="search" id="vm-sq" placeholder="Search students" aria-label="Search students"><div class="vm-chips" id="vm-slist">' + studentChips() + '</div>';
    return '<form class="vm-form" onsubmit="return false" novalidate><h3>' + (f.id ? 'Edit meeting' : 'New meeting') + '</h3>' +
      '<label class="vm-field">Title<input type="text" id="vm-t" maxlength="120" autocomplete="off" value="' + esc(f.title) + '" placeholder="e.g. SS2 Physics: Waves revision"></label>' +
      '<label class="vm-field"><span>Description <em>(optional)</em></span><textarea id="vm-d" rows="2" maxlength="500" placeholder="What will you cover?">' + esc(f.description) + '</textarea></label>' +
      '<div class="vm-row"><label class="vm-field">Starts<input type="datetime-local" id="vm-s" value="' + localInput(f.startsAt) + '"></label><label class="vm-field">Duration (minutes)<input type="number" id="vm-m" min="5" max="480" inputmode="numeric" value="' + f.durationMin + '"></label></div>' +
      '<label class="vm-field">Who can join<select id="vm-ty"><option value="classes"' + (f.type === 'classes' ? ' selected' : '') + '>Selected classes</option><option value="students"' + (f.type === 'students' ? ' selected' : '') + '>Selected students</option><option value="all"' + (f.type === 'all' ? ' selected' : '') + '>All students</option></select></label>' +
      '<div id="vm-aud">' + chips + '</div>' +
      '<label class="vm-switch"><input type="checkbox" id="vm-r"' + (f.rec ? ' checked' : '') + '><span class="trk"></span>Record so students can watch the replay</label>' +
      '<div class="vm-err' + (f.err ? ' show' : '') + '" id="vm-err" role="alert">' + ic('warning-circle') + '<span>' + esc(f.err) + '</span></div>' +
      '<div class="vm-form-actions"><button type="button" class="vm-btn ghost" data-a="cancelform">Cancel</button><button type="button" class="vm-btn pri" data-a="save">' + (f.id ? 'Save changes' : 'Schedule meeting') + '</button></div></form>';
  }
  function studentChips(q) {
    q = (q || '').toLowerCase(); var f = state.form;
    var rows = (state.audience.students || []).filter(function (s) { return !q || (s.name + ' ' + (s.class || '')).toLowerCase().indexOf(q) > -1; });
    if (!rows.length) return '<p class="vm-hint">No students match.</p>';
    return rows.slice(0, 300).map(function (s) {
      var on = f.students.indexOf(s.uid) > -1;
      return '<button type="button" class="vm-chip' + (on ? ' on' : '') + '" data-stu="' + esc(s.uid) + '" aria-pressed="' + on + '">' + esc(s.name) + (s.class ? ' &middot; ' + esc(s.class) : '') + '</button>';
    }).join('');
  }
  function readForm() {
    var f = state.form, t = $('#vm-t'); if (!f || !t) return;
    f.title = t.value; f.description = $('#vm-d').value; f.durationMin = parseInt($('#vm-m').value, 10) || 0;
    var d = new Date($('#vm-s').value); f.startsAt = isNaN(d) ? 0 : d.getTime(); f.rec = $('#vm-r').checked;
  }
  function showErr(msg) { if (state.form) state.form.err = msg; var e = $('#vm-err'); if (!e) return; e.classList.toggle('show', !!msg); e.lastChild.textContent = msg || ''; }
  function bindForm() {
    $('#vm-ty').onchange = function () { readForm(); state.form.type = this.value; state.form.err = ''; render(); };
    var sq = $('#vm-sq'); if (sq) sq.oninput = function () { $('#vm-slist').innerHTML = studentChips(this.value); };
  }
  function saveForm() {
    readForm(); var f = state.form, title = f.title.trim();
    if (!title) { showErr('Give the meeting a title.'); $('#vm-t').focus(); return; }
    if (!f.startsAt) { showErr('Pick a valid start date and time.'); return; }
    if (f.durationMin < 5 || f.durationMin > 480) { showErr('Duration must be between 5 and 480 minutes.'); $('#vm-m').focus(); return; }
    if (!f.id && f.startsAt < Date.now() - 6e4) { showErr('The start time is in the past. Pick a time from now onward.'); return; }
    if (f.type === 'classes' && !f.classes.length) { showErr('Pick at least one class.'); return; }
    if (f.type === 'students' && !f.students.length) { showErr('Pick at least one student.'); return; }
    showErr('');
    var p = { id: f.id, title: title, description: f.description.trim(), startsAt: f.startsAt, durationMin: f.durationMin, recordingEnabled: f.rec, audience: { type: f.type, classes: f.type === 'classes' ? f.classes : [], students: f.type === 'students' ? f.students : [] } };
    var btn = $('[data-a="save"]'); btn.disabled = true; btn.textContent = 'Saving…';
    api(f.id ? 'update' : 'create', p).then(function (r) { var isNew = !f.id; state.form = null; toast(isNew ? 'Meeting scheduled.' : 'Changes saved.'); refresh(false); render(); if (isNew && r && r.code) shareDialog({ id: r.id, code: r.code }); })
      .catch(function (e) { var b = $('[data-a="save"]'); if (b) { b.disabled = false; b.textContent = f.id ? 'Save changes' : 'Schedule meeting'; } showErr(e.message); });
  }

  /* ── Clicks ── */
  function onClick(e) {
    var chip = e.target.closest('.vm-chip');
    if (chip && state.form) {
      var f = state.form, list, v;
      if (chip.dataset.cls) { list = f.classes; v = chip.dataset.cls; } else { list = f.students; v = chip.dataset.stu; }
      var i = list.indexOf(v); if (i > -1) list.splice(i, 1); else list.push(v);
      chip.classList.toggle('on'); chip.setAttribute('aria-pressed', i === -1); showErr(''); return;
    }
    var tab = e.target.closest('.vm-tab'); if (tab) { state.tab = tab.dataset.tab; return render(); }
    var el = e.target.closest('[data-a]'); if (!el) return;
    var a = el.dataset.a, id = el.dataset.id;
    var m = state.meetings.filter(function (x) { return x.id === id; })[0];
    if (['edit', 'cancel', 'start', 'join', 'share'].indexOf(a) > -1 && !m) { toast('That meeting is no longer available.'); return refresh(false); }
    if (a === 'close') close();
    else if (a === 'retry') refresh(true);
    else if (a === 'theme') { if (window.VtxTheme) VtxTheme.toggle(); }
    else if (a === 'new') openForm();
    else if (a === 'edit') openForm(m);
    else if (a === 'cancelform') { state.form = null; render(); }
    else if (a === 'save') saveForm();
    else if (a === 'cancel') {
      var live = m.status === 'live';
      ask({ title: live ? 'End this meeting?' : 'Cancel this meeting?', text: live ? 'Everyone will be disconnected.' : 'Students will no longer see it.', ok: live ? 'End meeting' : 'Cancel meeting', danger: true,
        onOk: function () { api(live ? 'end' : 'cancel', { id: id }).then(function () { refresh(false); }).catch(function (er) { toast(er.message); }); } });
    }
    else if (a === 'start') { el.disabled = true; api('start', { id: id }).then(function () { return joinRoom(id, el); }).catch(function (er) { el.disabled = false; toast(er.message); }); }
    else if (a === 'join') { el.disabled = true; joinRoom(id, el, el.dataset.code); }
    else if (a === 'share') shareDialog(m);
    else if (a === 'joincode') joinByCode(($('#vm-code') || {}).value, el);
    else if (a === 'replay') playReplay(id);
  }

  /* ── Meeting code: join (students) and invite (teacher) ── */
  var fmtCode = function (c) { c = String(c || ''); return c.length > 4 ? c.slice(0, 4) + '-' + c.slice(4) : c; };
  function joinByCode(raw, btn) {
    var code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 6) { toast('Enter the full meeting code your teacher gave you.'); return; }
    if (state.room) { toast('You are already in a meeting.'); return; }
    if (btn) btn.disabled = true;
    api('find-code', { code: code }).then(function (r) {
      if (btn) btn.disabled = false;
      var m = r.meeting; m._code = code;
      if (!state.meetings.some(function (x) { return x.id === m.id; })) { state.meetings.push(m); state.extra[m.id] = { code: code }; }
      state.codeText = ''; var cbox = $('#vm-code'); if (cbox) cbox.value = ''; if (!state.form) render();
      if (m.status === 'live') joinRoom(m.id, null, code);
      else toast('Found "' + m.title + '". It starts ' + when(m) + '. Tap Join once the teacher begins.');
    }).catch(function (e) { if (btn) btn.disabled = false; toast(e.message); });
  }
  function copyText(text, done) {
    var ok = function () { toast(done); };
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(ok, function () { legacy(); }); } else legacy();
    function legacy() { var t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('Could not copy. Select the text and copy it manually.'); } t.remove(); }
  }
  function shareDialog(m, host) {
    var go = function (code) {
      var link = location.origin + '/?meet=' + code, h = host || root, d = document.createElement('div'); d.className = 'vm-modal';
      d.innerHTML = '<div class="vm-dialog" role="dialog" aria-modal="true"><h4>Invite students</h4><p>Anyone with this code can join once you start the meeting. Students enter it under Live, or open the link.</p>' +
        '<div class="vm-codebig" aria-label="Meeting code">' + esc(fmtCode(code)) + '</div><div class="vm-linkrow">' + esc(link) + '</div>' +
        '<div class="vm-share-actions"><button class="vm-btn" data-c="code">' + ic('copy') + 'Copy code</button><button class="vm-btn" data-c="link">' + ic('link') + 'Copy link</button>' +
        (navigator.share ? '<button class="vm-btn" data-c="share">' + ic('share-network') + 'Share</button>' : '') + '</div>' +
        '<div class="vm-actions" style="margin-top:12px"><button class="vm-btn pri" data-c="done" style="width:100%">Done</button></div></div>';
      d.addEventListener('click', function (e) {
        if (e.target === d) return d.remove();
        var b = e.target.closest('[data-c]'); if (!b) return; var c = b.dataset.c;
        if (c === 'done') d.remove();
        else if (c === 'code') copyText(code, 'Code copied.');
        else if (c === 'link') copyText(link, 'Link copied.');
        else if (c === 'share') navigator.share({ title: 'Join my live class', text: 'Join my live class on Vertex. Meeting code: ' + fmtCode(code), url: link }).catch(function () {});
      });
      h.appendChild(d);
    };
    if (m.code) return go(m.code);
    api('code', { id: m.id }).then(function (r) { m.code = r.code; go(r.code); }).catch(function (e) { toast(e.message); });
  }

  /* ── Replay ── */
  function playReplay(id) {
    var m = state.replays.filter(function (x) { return x.id === id; })[0] || {};
    api('replay', { id: id }).then(function (r) {
      var ov = document.createElement('div'); ov.className = 'vm-room vm-replay open';
      ov.innerHTML = '<div class="vm-rhead"><div class="vm-rtitle"><b>' + esc(r.title || m.title) + '</b><small>Replay</small></div><button class="vm-iconbtn" data-x aria-label="Close replay">' + ic('x') + '</button></div><div class="vm-replay-body"><video class="vm-player" controls playsinline autoplay src="' + esc(r.url) + '"></video></div>';
      var v = ov.querySelector('video');
      v.onerror = function () { toast('This recording could not be played.'); };
      ov.querySelector('[data-x]').onclick = function () { v.pause(); ov.remove(); };
      root.appendChild(ov);
    }).catch(function (e) { toast(e.message); });
  }

  /* ── Teacher-side recording: composites the room onto a canvas + mixes all audio,
     records with MediaRecorder and uploads 4-minute chunks to the Worker (B2). ── */
  function authFetchUpload(id, seq, blob) {
    var u = window.fbAuth.currentUser;
    return u.getIdToken().then(function (t) {
      return fetch(WORKER_URL + '/meet/upload?id=' + encodeURIComponent(id) + '&seq=' + seq, { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'video/webm' }, body: blob });
    }).then(function (r) { if (!r.ok) throw new Error('upload ' + r.status); });
  }
  function startRecorder(R, room) {
    var SLICE = window.MEET_REC_SLICE_MS || 240000, MAXC = 40;
    var cv = document.createElement('canvas'); cv.width = 854; cv.height = 480;
    var cx = cv.getContext('2d'), AC = window.AudioContext || window.webkitAudioContext, actx = new AC(), dest = actx.createMediaStreamDestination(), wired = {};
    function wire() {
      [room.localParticipant].concat(Array.from(room.remoteParticipants.values())).forEach(function (p) {
        p.trackPublications.forEach(function (pub) {
          var mt = pub.track && pub.track.mediaStreamTrack;
          if (pub.kind === 'audio' && mt && !wired[pub.trackSid]) { try { actx.createMediaStreamSource(new MediaStream([mt])).connect(dest); wired[pub.trackSid] = 1; } catch (e) { /* ignore */ } }
        });
      });
    }
    function box(v, x, y, w, h, cover) {
      var vw = v.videoWidth || w, vh = v.videoHeight || h, k = cover ? Math.max(w / vw, h / vh) : Math.min(w / vw, h / vh), dw = vw * k, dh = vh * k;
      cx.save(); cx.beginPath(); cx.rect(x, y, w, h); cx.clip(); cx.drawImage(v, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); cx.restore();
    }
    function draw() {
      cx.fillStyle = '#202124'; cx.fillRect(0, 0, 854, 480);
      var keys = Object.keys(R.tiles), scr = keys.filter(function (k) { return /:screen$/.test(k); });
      var list = scr.length ? [scr[0]] : keys, n = list.length || 1, cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4, rows = Math.ceil(n / cols), w = 854 / cols, h = 480 / rows;
      list.forEach(function (k, i) {
        var x = (i % cols) * w, y = Math.floor(i / cols) * h, t = R.tiles[k], v = t.querySelector('video'), tag = t.querySelector('.vm-tag');
        cx.fillStyle = '#3c4043'; cx.fillRect(x + 3, y + 3, w - 6, h - 6);
        if (v && v.videoWidth) box(v, x + 3, y + 3, w - 6, h - 6, !scr.length);
        else { cx.fillStyle = '#1a73e8'; cx.beginPath(); cx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 7, 0, 7); cx.fill(); cx.fillStyle = '#fff'; cx.font = '700 ' + Math.round(Math.min(w, h) / 6) + 'px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(((tag && tag.textContent) || '?').charAt(0).toUpperCase(), x + w / 2, y + h / 2); }
        if (tag) { cx.font = '600 13px sans-serif'; cx.textAlign = 'left'; cx.textBaseline = 'alphabetic'; var tw = cx.measureText(tag.textContent).width + 16; cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(x + 10, y + h - 34, tw, 24); cx.fillStyle = '#fff'; cx.fillText(tag.textContent, x + 18, y + h - 17); }
      });
    }
    try { var osc = actx.createOscillator(), g0 = actx.createGain(); g0.gain.value = 0; osc.connect(g0); g0.connect(dest); osc.start(); } catch (e) { /* ignore */ }
    wire(); draw();
    var drawT = setInterval(draw, 83), wireT = setInterval(wire, 3000);
    var stream = cv.captureStream(12); dest.stream.getAudioTracks().forEach(function (t) { stream.addTrack(t); });
    var mime = ['video/webm;codecs=vp8,opus', 'video/webm'].filter(function (m) { return window.MediaRecorder && MediaRecorder.isTypeSupported(m); })[0];
    if (!mime) { clearInterval(drawT); clearInterval(wireT); throw new Error('Recording is not supported in this browser. Use Chrome or Edge.'); }
    var mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 350000, audioBitsPerSecond: 40000 }), seq = 0, q = Promise.resolve(), failed = false;
    function up(blob, i) {
      var tries = 0;
      function go() { return authFetchUpload(R.id, i, blob).catch(function (e) { if (++tries < 4) return new Promise(function (r) { setTimeout(r, 1500 * tries); }).then(go); failed = true; throw e; }); }
      return go();
    }
    mr.ondataavailable = function (e) {
      if (!e.data || !e.data.size) return;
      var i = seq++; q = q.then(function () { return up(e.data, i); }).catch(function () { toast('A recording chunk failed to upload.'); });
      if (seq >= MAXC) { toast('Recording limit (160 min) reached.'); try { mr.stop(); } catch (er) { /* ignore */ } }
    };
    mr.start(SLICE);
    R.rec = { stop: function () {
      clearInterval(drawT); clearInterval(wireT);
      return new Promise(function (res) { if (mr.state === 'inactive') return res(); mr.onstop = function () { res(); }; try { mr.stop(); } catch (er) { res(); } })
        .then(function () { return q; }).then(function () { try { actx.close(); } catch (er) { /* ignore */ } return { chunks: seq, failed: failed }; });
    } };
  }
  function stopRecording(R) {
    if (!R.rec) return api('rec-stop', { id: R.id }).catch(function () {});
    var r = R.rec; R.rec = null;
    return r.stop().then(function (x) { if (x.failed) toast('Some recording parts could not be saved.'); return api('rec-stop', { id: R.id }); }).catch(function () {});
  }

  /* ── Room ── */
  function joinRoom(id, btn, code) {
    var again = function () { if (btn) btn.disabled = false; };
    if (state.room) { again(); return; }
    if (!window.LivekitClient) { again(); toast('The meeting engine did not load. Refresh the page and try again.'); return; }
    api('join', { id: id, code: code || undefined }).then(function (j) { again(); enterRoom(id, j); })
      .catch(function (e) { again(); toast(e.code === 'waiting' ? 'The teacher has not started yet. You can join once they do.' : e.message); if (e.status === 404 || e.status === 403) refresh(false); });
  }

  function enterRoom(id, j) {
    var LK = window.LivekitClient, el = $('#vm-room'), tch = j.role === 'teacher';
    var R = state.room = { canPub: !!j.canPublish, id: id, tiles: {}, hands: {}, chat: [], unread: 0, panel: 'chat', sharing: false, recording: !!j.recording, role: j.role, leaving: false, notified: false };
    var mobile = function () { return window.innerWidth < 640; };
    el.innerHTML =
      '<div class="vm-rhead"><div class="vm-rtitle"><b>' + esc(j.title) + '</b><small id="vm-count">Connecting…</small></div><span class="vm-rec' + (R.recording ? ' on' : '') + '"><i></i>REC</span>' +
      (tch ? '<button class="vm-btn" data-r="invite" aria-label="Invite students">' + ic('user-plus') + '<span>Invite</span></button><button class="vm-btn" data-r="rec" aria-label="Record">' + ic(R.recording ? 'stop-circle' : 'record') + '<span>' + (R.recording ? 'Stop' : 'Record') + '</span></button><button class="vm-btn" data-r="muteall" aria-label="Mute everyone">' + ic('microphone-slash') + '<span>Mute all</span></button>' : '') +
      '<button class="vm-iconbtn" data-r="theme" aria-label="Switch light or dark mode" style="display:none"></button></div>' +
      '<div class="vm-main"><div class="vm-stage" id="vm-stage"></div><div class="vm-joins" id="vm-joins" role="status" aria-live="polite"></div>' +
      '<div class="vm-side" id="vm-side"><div class="vm-sidehead"><button class="seg on" data-p="chat">Chat</button><button class="seg" data-p="people">People</button><button class="vm-iconbtn" data-r="chat" aria-label="Close panel">' + ic('x') + '</button></div><div class="vm-pane" id="vm-pane"></div>' +
      '<div class="vm-send" id="vm-send"><input id="vm-ci" placeholder="Message everyone" maxlength="500" autocomplete="off" aria-label="Message"><button class="vm-iconbtn" data-r="send" aria-label="Send">' + ic('paper-plane-right') + '</button></div></div>' +
      '<div class="vm-connecting" id="vm-conn"><div><div class="vm-spin"></div>Joining the meeting…</div></div></div>' +
      '<div class="vm-bar"><button class="vm-ctl' + (R.canPub ? '' : ' vm-hide') + '" data-r="mic" aria-label="Microphone">' + ic('microphone') + '</button><button class="vm-ctl' + (R.canPub ? '' : ' vm-hide') + '" data-r="cam" aria-label="Camera">' + ic('video-camera') + '</button>' +
      (mobile() ? '' : '<button class="vm-ctl' + (R.canPub ? '' : ' vm-hide') + '" data-r="screen" aria-label="Share screen">' + ic('monitor-arrow-up') + '</button>') +
      '<button class="vm-ctl" data-r="hand" aria-label="Raise hand">' + ic('hand') + '</button><button class="vm-ctl" data-r="chat" aria-label="Chat and people">' + ic('chat-circle-text') + '<span class="vm-n" style="display:none"></span></button>' +
      '<button class="vm-ctl leave" data-r="leave" aria-label="Leave meeting">' + ic('phone-disconnect') + '</button></div>';
    el.classList.add('open');
    var room = R.lk = new LK.Room({ adaptiveStream: true, dynacast: true, videoCaptureDefaults: { resolution: LK.VideoPresets.h540.resolution } });

    function tileFor(p) {
      if (R.tiles[p.identity]) return R.tiles[p.identity];
      var t = document.createElement('div'); t.className = 'vm-tile' + (p.isLocal ? ' mirror' : '');
      t.innerHTML = '<div class="vm-av">' + esc((p.name || '?').charAt(0).toUpperCase()) + '</div><div class="vm-tag"><span></span></div><div class="vm-hand">' + ic('hand') + '</div>';
      $('#vm-stage').appendChild(t); R.tiles[p.identity] = t; layout(); return t;
    }
    function wantTile(p) { return p.isLocal ? R.canPub : (isTeach(p) || p.trackPublications.size > 0); }
    function updTag(p) {
      var t = R.tiles[p.identity]; if (!t) return; var tag = t.querySelector('.vm-tag');
      tag.innerHTML = (p.isMicrophoneEnabled ? '' : ic('microphone-slash')) + '<span></span>';
      tag.querySelector('span').textContent = (p.name || 'Guest') + (p.isLocal ? ' (You)' : '');
    }
    function count() { var n = 1 + room.remoteParticipants.size, c = $('#vm-count'); if (c) c.textContent = n + (n === 1 ? ' person' : ' people') + ' in the meeting' + (!tch && !R.canPub ? ' \u00b7 raise your hand to speak' : ''); }
    function attach(track, p, pub) {
      var screen = pub && pub.source === LK.Track.Source.ScreenShare, t = tileFor(p);
      if (track.kind === 'video') {
        var tile = screen ? tileFor({ identity: p.identity + ':screen', name: (p.name || '') + ' (screen)' }) : t;
        if (screen) { tile.classList.add('screen'); tile.classList.remove('mirror'); }
        var v = track.attach(); v.setAttribute('playsinline', ''); if (p.isLocal) v.muted = true;
        var old = tile.querySelector('video'); if (old) old.remove(); tile.insertBefore(v, tile.firstChild);
        tile.querySelector('.vm-av').style.display = 'none';
        if (screen) layout();
      } else if (track.kind === 'audio' && !p.isLocal) { var a = track.attach(); a.style.display = 'none'; t.appendChild(a); }
      updTag(p);
    }
    function detach(track, p, pub) {
      var screen = pub && pub.source === LK.Track.Source.ScreenShare;
      track.detach().forEach(function (n) { n.remove(); });
      if (screen) { var s = R.tiles[p.identity + ':screen']; if (s) { s.remove(); delete R.tiles[p.identity + ':screen']; layout(); } }
      else if (track.kind === 'video') { var t = R.tiles[p.identity]; if (t) t.querySelector('.vm-av').style.display = ''; }
      if (R.tiles[p.identity]) updTag(p);
    }
    function removeP(p) { [p.identity, p.identity + ':screen'].forEach(function (k) { if (R.tiles[k]) { R.tiles[k].remove(); delete R.tiles[k]; } }); delete R.hands[p.identity]; layout(); count(); people(); }
    function layout() {
      var s = $('#vm-stage'); if (!s) return;
      var screens = s.querySelectorAll('.vm-tile.screen').length; s.classList.toggle('has-screen', screens > 0);
      var n = screens ? screens : s.children.length, cols;
      if (mobile()) cols = n <= 2 ? 1 : n <= 6 ? 2 : 3; else cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
      s.style.gridTemplateColumns = 'repeat(' + cols + ',minmax(0,1fr))';
    }
    R.onResize = layout; window.addEventListener('resize', layout);
    // Students show their profile photo (or character); the teacher keeps the letter.
    function isTeach(p) { try { return JSON.parse(p.metadata || '{}').role === 'teacher'; } catch (e) { return false; } }
    /* ── "Name joined" cards (teacher only). Max 3 at once, extra joins collapse into "+N more". ── */
    var cards = [], more = { n: 0, el: null }, seenAt = {}; R.joinTimers = [];
    function later(fn, ms) { var t = setTimeout(fn, ms); R.joinTimers.push(t); return t; }
    function dismiss(c) {
      var i = cards.indexOf(c); if (i > -1) cards.splice(i, 1);
      c.classList.add('out'); later(function () { c.remove(); }, 260);
    }
    function announce(p) {
      if (!tch || p.isLocal || isTeach(p) || !R.t0 || Date.now() - R.t0 < 1500) return;
      var now = Date.now(); if (seenAt[p.identity] && now - seenAt[p.identity] < 60000) return;   // ignore reconnect flicker
      seenAt[p.identity] = now;
      var host = $('#vm-joins', el); if (!host) return;
      var name = String(p.name || '').trim() || 'A student';
      if (cards.length >= 3) {
        more.n++;
        if (!more.el || !more.el.isConnected) { more.el = document.createElement('div'); more.el.className = 'vm-join more'; host.appendChild(more.el); }
        more.el.innerHTML = '<div class="vm-join-ic">' + ic('users') + '</div><div class="vm-join-t"><b></b><span>joined the meeting</span></div>';
        more.el.querySelector('b').textContent = '+' + more.n + ' more';
        clearTimeout(more.t); more.t = later(function () { var m = more.el; more.n = 0; more.el = null; if (m) { m.classList.add('out'); later(function () { m.remove(); }, 260); } }, 4500);
        return;
      }
      var c = document.createElement('div'); c.className = 'vm-join';
      c.innerHTML = '<div class="vm-av" data-vtx-av="' + esc(p.identity) + '"></div><div class="vm-join-t"><b></b><span>joined the meeting</span></div>';
      c.querySelector('.vm-av').textContent = name.charAt(0).toUpperCase();
      c.querySelector('b').textContent = name; c.title = name;
      if (more.el && more.el.isConnected) host.insertBefore(c, more.el); else host.appendChild(c);
      cards.push(c);
      if (window.VtxAvatar && VtxAvatar.scan) VtxAvatar.scan(c);
      later(function () { dismiss(c); }, 4500);
    }
    function people() {
      if (R.panel !== 'people') return; var h = '';
      [room.localParticipant].concat(Array.from(room.remoteParticipants.values())).forEach(function (p) {
        var tp = p.isLocal ? tch : isTeach(p);
        h += '<div class="vm-person"><div class="vm-av"' + (tp ? '' : ' data-vtx-av="' + esc(p.identity) + '"') + '>' + esc((p.name || '?').charAt(0).toUpperCase()) + '</div><span class="nm">' + esc(p.name || 'Guest') + (p.isLocal ? ' (You)' : '') + '</span>' +
          (R.hands[p.identity] ? ic('hand') : '') + (p.isMicrophoneEnabled ? '' : ic('microphone-slash')) +
          (tch && !p.isLocal && !isTeach(p) && (R.hands[p.identity] || (p.permissions && p.permissions.canPublish)) ? '<button class="vm-btn" data-allow="' + esc(p.identity) + '" data-on="' + ((p.permissions && p.permissions.canPublish) ? '0' : '1') + '">' + ((p.permissions && p.permissions.canPublish) ? 'Stop speaking' : 'Allow to speak') + '</button>' : '') +
          (tch && !p.isLocal ? '<button class="vm-btn" data-kick="' + esc(p.identity) + '">Remove</button>' : '') + '</div>';
      });
      $('#vm-pane').innerHTML = h;
      if (window.VtxAvatar && VtxAvatar.scan) VtxAvatar.scan($('#vm-pane'));
    }
    function chatView() {
      if (R.panel !== 'chat') return; var p = $('#vm-pane');
      p.innerHTML = R.chat.map(function (m) { return '<div class="vm-msg' + (m.me ? ' me' : '') + '">' + (m.me ? '' : '<b>' + esc(m.from) + '</b>') + '<span>' + esc(m.text) + '</span></div>'; }).join('') || '<div class="vm-note">No messages yet. Messages are visible to everyone in the meeting.</div>';
      p.scrollTop = 1e9;
    }
    function badge() { var n = el.querySelector('.vm-n'); if (n) { n.style.display = R.unread ? '' : 'none'; n.textContent = R.unread > 9 ? '9+' : R.unread; } }
    function panelOpen() { return $('#vm-side').classList.contains('open'); }

    room.on(LK.RoomEvent.TrackSubscribed, function (tr, pub, p) { attach(tr, p, pub); })
      .on(LK.RoomEvent.TrackUnsubscribed, function (tr, pub, p) { detach(tr, p, pub); })
      .on(LK.RoomEvent.LocalTrackPublished, function (pub, p) { if (pub.track) attach(pub.track, p, pub); syncCtl(); })
      .on(LK.RoomEvent.LocalTrackUnpublished, function (pub, p) { if (pub.track) detach(pub.track, p, pub); if (pub.source === LK.Track.Source.ScreenShare) R.sharing = false; syncCtl(); })
      .on(LK.RoomEvent.ParticipantConnected, function (p) { if (wantTile(p)) { tileFor(p); updTag(p); } count(); people(); announce(p); })
      .on(LK.RoomEvent.TrackUnpublished, function (pub, p) { if (!p.isLocal && !wantTile(p) && R.tiles[p.identity]) { R.tiles[p.identity].remove(); delete R.tiles[p.identity]; layout(); } people(); })
      .on(LK.RoomEvent.ParticipantPermissionsChanged, function (prev, p) {
        p = p || room.localParticipant;
        if (p.isLocal) {
          var can = !!(p.permissions && p.permissions.canPublish), was = R.canPub; R.canPub = can;
          if (can && !was) { R.hands[p.identity] = false; send({ t: 'hand', on: false }); toast('The teacher allowed you to speak.'); p.setMicrophoneEnabled(true).catch(function () { toast('Allow microphone access to speak.'); }); }
          if (!can && was) toast('You are back to listening mode.');
          el.querySelectorAll('[data-r="mic"],[data-r="cam"],[data-r="screen"]').forEach(function (b) { b.classList.toggle('vm-hide', !can); });
          syncCtl();
        }
        people();
      })
      .on(LK.RoomEvent.ParticipantDisconnected, removeP)
      .on(LK.RoomEvent.TrackMuted, function (pub, p) { updTag(p); people(); })
      .on(LK.RoomEvent.TrackUnmuted, function (pub, p) { updTag(p); people(); })
      .on(LK.RoomEvent.Reconnecting, function () { toast('Connection lost. Reconnecting…'); })
      .on(LK.RoomEvent.Reconnected, function () { toast('You are back online.'); })
      .on(LK.RoomEvent.AudioPlaybackStatusChanged, function () {
        var g = el.querySelector('.vm-audio-gate');
        if (!room.canPlaybackAudio && !g) { g = document.createElement('button'); g.className = 'vm-btn pri vm-audio-gate'; g.innerHTML = ic('speaker-high') + 'Tap to turn on sound'; g.onclick = function () { room.startAudio().then(function () { g.remove(); }); }; $('.vm-main', el).appendChild(g); }
        else if (room.canPlaybackAudio && g) g.remove();
      })
      .on(LK.RoomEvent.ActiveSpeakersChanged, function (sp) { Object.keys(R.tiles).forEach(function (k) { R.tiles[k].classList.remove('speaking'); }); sp.forEach(function (p) { if (R.tiles[p.identity]) R.tiles[p.identity].classList.add('speaking'); }); })
      .on(LK.RoomEvent.DataReceived, function (data, p) {
        var m; try { m = JSON.parse(new TextDecoder().decode(data)); } catch (e) { return; }
        if (!m || typeof m !== 'object') return;
        if (m.t === 'chat') { R.chat.push({ from: (p && p.name) || 'Guest', text: String(m.x).slice(0, 500) }); if (R.panel === 'chat' && panelOpen()) chatView(); else { R.unread++; badge(); } }
        if (m.t === 'hand' && p) { R.hands[p.identity] = !!m.on; var tl = R.tiles[p.identity]; if (tl) tl.querySelector('.vm-hand').classList.toggle('on', !!m.on); people(); if (m.on && tch) toast((p.name || 'A student') + ' raised a hand'); }
        if (m.t === 'rec') { R.recording = !!m.on; el.querySelector('.vm-rec').classList.toggle('on', R.recording); }
      })
      .on(LK.RoomEvent.Disconnected, function () { if (state.room === R) { if (!R.leaving) toast('The meeting ended or you were removed.'); leave(true); } });

    room.connect(j.url, j.token).then(function () {
      if (R.canPub) { tileFor(room.localParticipant); updTag(room.localParticipant); } count();
      room.remoteParticipants.forEach(function (p) { if (wantTile(p)) { tileFor(p); updTag(p); } p.trackPublications.forEach(function (pub) { if (pub.track) attach(pub.track, p, pub); }); });
      R.t0 = Date.now();
      var c = $('#vm-conn'); if (c) c.classList.add('gone');
      var lp = room.localParticipant, blocked = false;
      if (!R.canPub) return;
      return lp.setMicrophoneEnabled(true).catch(function () { blocked = true; }).then(function () { return lp.setCameraEnabled(true).catch(function () { blocked = true; }); }).then(function () {
        if (blocked) toast('Camera or microphone is blocked. Allow access in your browser to be seen and heard.');
      });
    }).then(function () { syncCtl(); }).catch(function (e) { if (state.room === R) { R.leaving = true; toast('Could not connect: ' + (e.message || 'please try again')); leave(true); } });

    function syncCtl() {
      if (!state.room || state.room !== R) return;
      var lp = room.localParticipant, mic = lp.isMicrophoneEnabled, cam = lp.isCameraEnabled;
      var set = function (k, cls, on, icon) { var b = el.querySelector('[data-r="' + k + '"]'); if (!b) return; b.classList.toggle(cls, on); if (icon) b.innerHTML = icon; };
      set('mic', 'off', !mic, ic(mic ? 'microphone' : 'microphone-slash')); set('cam', 'off', !cam, ic(cam ? 'video-camera' : 'video-camera-slash'));
      set('screen', 'on', R.sharing); set('hand', 'on', !!R.hands[lp.identity]);
      updTag(lp);
    }
    function send(obj) { try { room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(obj)), { reliable: true }); } catch (e) { toast('Could not send. Check your connection.'); } }
    function onUnload(ev) { if (R.rec) { ev.preventDefault(); ev.returnValue = 'Recording in progress'; } try { room.disconnect(); } catch (e) { /* ignore */ } }
    window.addEventListener('beforeunload', onUnload);
    function leave(silent) {
      var r = state.room; if (!r) return; r.leaving = true;
      if (r.rec) { toast('Saving the recording…'); stopRecording(r).then(function () { leave(silent); }); return; }
      (r.joinTimers || []).forEach(clearTimeout);
      state.room = null; window.removeEventListener('beforeunload', onUnload); window.removeEventListener('resize', layout);
      try { r.lk.disconnect(); } catch (e) { /* ignore */ }
      el.classList.remove('open'); el.innerHTML = '';
      if (!silent) toast('You left the meeting.');
      refresh(false);
    }

    el.onclick = function (ev) {
      var al = ev.target.closest('[data-allow]');
      if (al) { al.disabled = true; api('allow', { id: id, identity: al.dataset.allow, on: al.dataset.on === '1' }).then(function () { R.hands[al.dataset.allow] = false; var t = R.tiles[al.dataset.allow]; if (t) t.querySelector('.vm-hand').classList.remove('on'); people(); }).catch(function (e) { al.disabled = false; toast(e.message); }); return; }
      var k = ev.target.closest('[data-kick]');
      if (k) { ask({ title: 'Remove this person?', text: 'They will be disconnected from the meeting.', ok: 'Remove', danger: true, onOk: function () { api('kick', { id: id, identity: k.dataset.kick }).catch(function (e) { toast(e.message); }); } }, el); return; }
      var pbtn = ev.target.closest('[data-p]');
      if (pbtn) { R.panel = pbtn.dataset.p; el.querySelectorAll('[data-p]').forEach(function (b) { b.classList.toggle('on', b === pbtn); }); $('#vm-send').style.display = R.panel === 'chat' ? '' : 'none'; if (R.panel === 'chat') chatView(); else people(); return; }
      var b = ev.target.closest('[data-r]'); if (!b) return; var a = b.dataset.r, lp = room.localParticipant;
      if (a === 'mic') lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled).then(syncCtl).catch(function () { toast('Microphone is blocked. Allow access in your browser settings.'); });
      else if (a === 'cam') lp.setCameraEnabled(!lp.isCameraEnabled).then(syncCtl).catch(function () { toast('Camera is blocked. Allow access in your browser settings.'); });
      else if (a === 'screen') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return toast('Screen sharing is not supported on this device.');
        lp.setScreenShareEnabled(!R.sharing).then(function () { R.sharing = !R.sharing; syncCtl(); }).catch(function (e) { R.sharing = false; syncCtl(); if (!/denied|cancel|abort|NotAllowed/i.test(String(e && (e.name + e.message)))) toast('Screen sharing is not available.'); });
      }
      else if (a === 'hand') { var on = !R.hands[lp.identity]; R.hands[lp.identity] = on; send({ t: 'hand', on: on }); var lt = R.tiles[lp.identity]; if (lt) lt.querySelector('.vm-hand').classList.toggle('on', on); syncCtl(); }
      else if (a === 'chat') { var sd = $('#vm-side'); sd.classList.toggle('open'); if (sd.classList.contains('open')) { R.unread = 0; badge(); if (R.panel === 'chat') { chatView(); var ci = $('#vm-ci'); if (ci && !mobile()) ci.focus(); } else people(); } layout(); }
      else if (a === 'send') { var inp = $('#vm-ci'), x = inp.value.trim(); if (!x) return; send({ t: 'chat', x: x }); R.chat.push({ from: 'You', text: x, me: true }); inp.value = ''; chatView(); }
      else if (a === 'leave') {
        if (!tch) return leave();
        ask({ title: 'Leave this meeting?', text: 'You can leave and keep it running for students, or end it for everyone.', stack: true, buttons: [
          { label: 'Stay', ghost: true },
          { label: 'Leave, keep it running', fn: function () { leave(); } },
          { label: 'End for everyone', danger: true, fn: function () { if (R.rec) toast('Saving the recording…'); stopRecording(R).then(function () { return api('end', { id: id }); }).catch(function () {}).then(function () { leave(); }); } }
        ] }, el);
      }
      else if (a === 'rec') {
        b.disabled = true;
        var done = function () { el.querySelector('.vm-rec').classList.toggle('on', R.recording); b.innerHTML = ic(R.recording ? 'stop-circle' : 'record') + '<span>' + (R.recording ? 'Stop' : 'Record') + '</span>'; b.disabled = false; };
        if (R.recording) { toast('Saving the recording…'); stopRecording(R).then(function () { R.recording = false; send({ t: 'rec', on: false }); done(); }); }
        else {
          try { startRecorder(R, room); } catch (e) { b.disabled = false; return toast(e.message); }
          api('rec-start', { id: id }).then(function () { R.recording = true; send({ t: 'rec', on: true }); done(); }).catch(function (e) { stopRecording(R); b.disabled = false; toast(e.message); });
        }
      }
      else if (a === 'invite') { var mm = state.meetings.filter(function (x) { return x.id === id; })[0] || { id: id }; shareDialog(mm, el); }
      else if (a === 'muteall') api('mute-all', { id: id }).then(function (r) { toast('Muted ' + (r.muted || 0) + ' participant' + (r.muted === 1 ? '' : 's') + '.'); }).catch(function (e) { toast(e.message); });
    };
    el.onkeydown = function (ev) { if (ev.key === 'Enter' && ev.target.id === 'vm-ci') { ev.preventDefault(); var s = el.querySelector('[data-r="send"]'); if (s) s.click(); } };
    chatView();
  }

  /* ── Boot: nothing is added to the page until Meet.open() is called ── */
  function captureLink() {
    try {
      var q = new URLSearchParams(location.search).get('meet');
      if (!q) return;
      sessionStorage.setItem('vtx-meet-code', q);
      var u = new URL(location.href); u.searchParams.delete('meet');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (e) { /* ignore */ }
  }
  function openFromLink() {
    var c = null; try { c = sessionStorage.getItem('vtx-meet-code'); sessionStorage.removeItem('vtx-meet-code'); } catch (e) { /* ignore */ }
    if (!c) return;
    setTimeout(function () { open(); joinByCode(c, null); }, 1500);
  }
  function boot() {
    if (!window.fbAuth) return setTimeout(boot, 500);
    window.fbAuth.onAuthStateChanged(function (u) {
      if (u) { checkLive(); openFromLink(); return; }
      state = { tab: 'upcoming', meetings: [], replays: [], role: 'student', audience: null, form: null, room: null, loaded: false, extra: {}, codeText: '' };
      if (root) { root.classList.remove('open'); root.remove(); root = null; document.body.classList.remove('vm-open'); }
      clearInterval(poll); window.Meet.live = false;
    });
  }
  window.Meet = { open: open, close: close, refresh: refresh, live: false };
  captureLink();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
