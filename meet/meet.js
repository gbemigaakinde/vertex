/* ============================================================
   meet/meet.js — Vertex Live Meetings (Google-Meet-style, LiveKit)
   Self-contained: injects its own launcher button, panel and room UI.
   Needs: window.fbAuth (js/config.js), window.AppConfig (js/state.js),
          meet/vendor/livekit-client.umd.js, meet/meet.css
   Backend: POST {WORKER_URL}/meet/op  (see meet/worker-meet.js)
   ============================================================ */
(function () {
  'use strict';
  var WORKER_URL = (window.MEET_WORKER_URL || 'https://vertex-worker.gbemigaakinde.workers.dev');
  var root, fab, state = { tab: 'upcoming', meetings: [], replays: [], role: 'student', audience: null, form: null, room: null };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var $ = function (sel, el) { return (el || root).querySelector(sel); };
  var ICON = {
    mic: '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z"/></svg>',
    cam: '<svg viewBox="0 0 24 24"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11z"/></svg>',
    screen: '<svg viewBox="0 0 24 24"><path d="M21 3H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5v2h8v-2h5a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 14H3V5h18z"/></svg>',
    leave: '<svg viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1a1 1 0 0 1-.56.9c-.98.49-1.87 1.12-2.66 1.85a1 1 0 0 1-1.4 0L.3 13.7a1 1 0 0 1 0-1.4C3.34 9.4 7.46 7.6 12 7.6s8.66 1.8 11.7 4.7a1 1 0 0 1 0 1.4l-2.04 2.04a1 1 0 0 1-1.4 0c-.8-.73-1.68-1.36-2.66-1.85a1 1 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>',
    video: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11z"/></svg>'
  };

  /* ── API ── */
  function api(action, body) {
    var u = window.fbAuth && window.fbAuth.currentUser;
    if (!u) return Promise.reject(new Error('Please sign in first.'));
    return u.getIdToken().then(function (t) {
      return fetch(WORKER_URL + '/meet/op', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(Object.assign({ action: action }, body || {})) });
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.message || j.error || 'Request failed.'); e.code = j.error; e.status = r.status; throw e; } return j; }); });
  }
  function toast(msg) { var t = document.createElement('div'); t.className = 'vm-toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }
  function isTeacher() { return state.role === 'teacher'; }
  function fmt(ts) { try { return new Date(ts).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function localInput(ts) { var d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  /* ── Shell ── */
  function build() {
    if (root) return;
    fab = document.createElement('button');
    fab.className = 'vm-fab'; fab.setAttribute('aria-label', 'Live meetings');
    fab.innerHTML = ICON.video + '<span>Live Meetings</span><i class="vm-dot"></i>';
    fab.onclick = open;
    document.body.appendChild(fab);
    root = document.createElement('div');
    root.className = 'vm-root';
    root.innerHTML = '<div class="vm-top"><h2>Live Meetings</h2><button class="vm-btn pri" data-a="new" style="display:none">+ New meeting</button><button class="vm-btn ghost" data-a="close">Close</button></div>' +
      '<div class="vm-tabs"><button class="vm-tab on" data-tab="upcoming">Meetings</button><button class="vm-tab" data-tab="replays">Replays</button></div>' +
      '<div class="vm-body" id="vm-body"></div>' +
      '<div class="vm-room" id="vm-room"></div>';
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
  }
  function open() { build(); root.classList.add('open'); refresh(); }
  function close() { if (state.room) { toast('Leave the meeting first.'); return; } root.classList.remove('open'); }

  function refresh() {
    var b = $('#vm-body'); b.innerHTML = '<div class="vm-empty">Loading…</div>';
    Promise.all([api('list'), api('replays')]).then(function (r) {
      state.meetings = r[0].meetings; state.role = r[0].role; state.replays = r[1].replays;
      $('[data-a="new"]').style.display = isTeacher() ? '' : 'none';
      fab.classList.toggle('live', state.meetings.some(function (m) { return m.status === 'live'; }));
      render();
    }).catch(function (e) { b.innerHTML = '<div class="vm-empty">' + esc(e.message) + '</div>'; });
  }

  function render() {
    root.querySelectorAll('.vm-tab').forEach(function (t) { t.classList.toggle('on', t.dataset.tab === state.tab); });
    var b = $('#vm-body'), h = '';
    if (state.form) h += formHtml();
    if (state.tab === 'upcoming') {
      var list = state.meetings.filter(function (m) { return m.status !== 'ended'; }).sort(function (a, c) { return (a.status === 'live' ? -1 : 0) - (c.status === 'live' ? -1 : 0) || a.startsAt - c.startsAt; });
      if (!list.length && !state.form) h += '<div class="vm-empty">No meetings scheduled.' + (isTeacher() ? ' Tap “New meeting” to create one.' : '') + '</div>';
      list.forEach(function (m) { h += meetingCard(m); });
    } else {
      if (!state.replays.length) h += '<div class="vm-empty">No recordings yet. Replays appear here after a recorded meeting ends.</div>';
      state.replays.forEach(function (m) { h += '<div class="vm-card"><div class="vm-info"><h3>' + esc(m.title) + '</h3><div class="vm-meta">' + esc(fmt(m.startsAt)) + '</div></div><div class="vm-actions"><button class="vm-btn pri" data-a="replay" data-id="' + esc(m.id) + '">▶ Watch replay</button></div></div>'; });
    }
    b.innerHTML = h;
    if (state.form) bindForm();
  }

  function meetingCard(m) {
    var live = m.status === 'live', t = isTeacher(), a = '';
    var who = m.audience.type === 'all' ? 'Everyone' : m.audience.type === 'classes' ? (m.audience.classes || []).join(', ') : m.audience.type === 'students' ? (m.audience.students || []).length + ' selected student(s)' : '';
    if (t) {
      a += live ? '<button class="vm-btn pri" data-a="join" data-id="' + esc(m.id) + '">Re-join</button>' : '<button class="vm-btn pri" data-a="start" data-id="' + esc(m.id) + '">Start meeting</button>';
      if (!live) a += '<button class="vm-btn" data-a="edit" data-id="' + esc(m.id) + '">Edit</button>';
      a += '<button class="vm-btn ghost" data-a="cancel" data-id="' + esc(m.id) + '">' + (live ? 'End' : 'Cancel') + '</button>';
    } else a += '<button class="vm-btn ' + (live ? 'pri' : '') + '" data-a="join" data-id="' + esc(m.id) + '">' + (live ? 'Join now' : 'Join') + '</button>';
    return '<div class="vm-card"><div class="vm-info"><h3>' + esc(m.title) + '</h3><div class="vm-meta">' +
      (live ? '<span class="vm-badge live">● LIVE</span>' : '') + esc(fmt(m.startsAt)) + ' · ' + m.durationMin + ' min' + (m.recordingEnabled ? ' · <span class="vm-badge ok">Recorded</span>' : '') +
      (t && who ? '<br>For: ' + esc(who) : '') + (m.description ? '<br>' + esc(m.description) : '') + '</div></div><div class="vm-actions">' + a + '</div></div>';
  }

  /* ── Schedule form (teacher) ── */
  function openForm(m) {
    state.form = { id: m ? m.id : null, title: m ? m.title : '', description: m ? m.description : '', startsAt: m ? m.startsAt : Date.now() + 3600e3, durationMin: m ? m.durationMin : 60,
      type: m ? m.audience.type : 'classes', classes: m ? (m.audience.classes || []).slice() : [], students: m ? (m.audience.students || []).slice() : [], rec: m ? m.recordingEnabled : true, err: '' };
    state.tab = 'upcoming'; render();
    if (!state.audience) api('audience').then(function (a) { state.audience = a; if (state.form) { render(); } }).catch(function (e) { state.form && (state.form.err = e.message); render(); });
  }
  function formHtml() {
    var f = state.form, au = state.audience, chips = '';
    if (!au) chips = '<div class="vm-meta">Loading classes and students…</div>';
    else if (f.type === 'classes') chips = au.classes.map(function (c) { return '<span class="vm-chip' + (f.classes.indexOf(c.name) > -1 ? ' on' : '') + '" data-cls="' + esc(c.name) + '">' + esc(c.name) + ' (' + c.count + ')</span>'; }).join(''), chips = chips ? '<div class="vm-chips">' + chips + '</div>' : '<div class="vm-meta">No classes found.</div>';
    else if (f.type === 'students') chips = '<input type="search" id="vm-sq" placeholder="Search students…" style="margin-bottom:6px"><div class="vm-chips" id="vm-slist">' + studentChips() + '</div>';
    return '<div class="vm-form"><b>' + (f.id ? 'Edit meeting' : 'New meeting') + '</b>' +
      '<label>Title<input id="vm-t" maxlength="120" value="' + esc(f.title) + '" placeholder="e.g. SS2 Physics — Waves revision"></label>' +
      '<label>Description (optional)<textarea id="vm-d" rows="2" maxlength="500">' + esc(f.description) + '</textarea></label>' +
      '<div class="vm-row"><label>Starts<input type="datetime-local" id="vm-s" value="' + localInput(f.startsAt) + '"></label><label>Duration (minutes)<input type="number" id="vm-m" min="5" max="480" value="' + f.durationMin + '"></label></div>' +
      '<label>Who can join<select id="vm-ty"><option value="classes"' + (f.type === 'classes' ? ' selected' : '') + '>Selected class(es)</option><option value="students"' + (f.type === 'students' ? ' selected' : '') + '>Selected students</option><option value="all"' + (f.type === 'all' ? ' selected' : '') + '>All students</option></select></label>' +
      '<div id="vm-aud">' + chips + '</div>' +
      '<label style="display:flex;grid-template:none;align-items:center;gap:8px;flex-direction:row"><input type="checkbox" id="vm-r" style="width:auto"' + (f.rec ? ' checked' : '') + '> Record this meeting so students can replay it</label>' +
      '<div class="vm-err">' + esc(f.err) + '</div><div class="vm-actions"><button class="vm-btn pri" data-a="save">' + (f.id ? 'Save changes' : 'Schedule meeting') + '</button><button class="vm-btn ghost" data-a="cancelform">Cancel</button></div></div>';
  }
  function studentChips(q) {
    q = (q || '').toLowerCase(); var f = state.form;
    return state.audience.students.filter(function (s) { return !q || (s.name + ' ' + s.class).toLowerCase().indexOf(q) > -1; }).slice(0, 300).map(function (s) {
      return '<span class="vm-chip' + (f.students.indexOf(s.uid) > -1 ? ' on' : '') + '" data-stu="' + esc(s.uid) + '">' + esc(s.name) + (s.class ? ' · ' + esc(s.class) : '') + '</span>';
    }).join('');
  }
  function readForm() {
    var f = state.form;
    f.title = $('#vm-t').value; f.description = $('#vm-d').value; f.durationMin = parseInt($('#vm-m').value, 10) || 60;
    var d = new Date($('#vm-s').value); f.startsAt = isNaN(d) ? 0 : d.getTime(); f.rec = $('#vm-r').checked;
  }
  function bindForm() {
    $('#vm-ty').onchange = function () { readForm(); state.form.type = this.value; render(); };
    var sq = $('#vm-sq'); if (sq) sq.oninput = function () { $('#vm-slist').innerHTML = studentChips(this.value); };
  }
  function saveForm() {
    readForm(); var f = state.form;
    if (!f.title.trim()) { f.err = 'Give the meeting a title.'; return render(); }
    if (!f.startsAt) { f.err = 'Pick a start time.'; return render(); }
    var p = { id: f.id, title: f.title, description: f.description, startsAt: f.startsAt, durationMin: f.durationMin, recordingEnabled: f.rec, audience: { type: f.type, classes: f.classes, students: f.students } };
    var btn = $('[data-a="save"]'); btn.disabled = true;
    api(f.id ? 'update' : 'create', p).then(function () { state.form = null; toast('Meeting saved.'); refresh(); }).catch(function (e) { f.err = e.message; render(); });
  }

  /* ── Clicks ── */
  function onClick(e) {
    var chip = e.target.closest('.vm-chip');
    if (chip && state.form) {
      var f = state.form, list, v;
      if (chip.dataset.cls) { list = f.classes; v = chip.dataset.cls; } else { list = f.students; v = chip.dataset.stu; }
      var i = list.indexOf(v); if (i > -1) list.splice(i, 1); else list.push(v); chip.classList.toggle('on'); return;
    }
    var tab = e.target.closest('.vm-tab'); if (tab) { state.tab = tab.dataset.tab; return render(); }
    var el = e.target.closest('[data-a]'); if (!el) return;
    var a = el.dataset.a, id = el.dataset.id;
    var m = state.meetings.filter(function (x) { return x.id === id; })[0];
    if (a === 'close') close();
    else if (a === 'new') openForm();
    else if (a === 'edit') openForm(m);
    else if (a === 'cancelform') { state.form = null; render(); }
    else if (a === 'save') saveForm();
    else if (a === 'cancel') { if (confirm(m.status === 'live' ? 'End this meeting for everyone?' : 'Cancel this meeting?')) api(m.status === 'live' ? 'end' : 'cancel', { id: id }).then(refresh).catch(function (er) { toast(er.message); }); }
    else if (a === 'start') { el.disabled = true; api('start', { id: id }).then(function () { return joinRoom(id); }).catch(function (er) { el.disabled = false; toast(er.message); }); }
    else if (a === 'join') joinRoom(id);
    else if (a === 'replay') playReplay(id);
  }

  /* ── Replay ── */
  function playReplay(id) {
    var m = state.replays.filter(function (x) { return x.id === id; })[0] || {};
    api('replay', { id: id }).then(function (r) {
      var ov = document.createElement('div'); ov.className = 'vm-room open'; ov.style.background = '#101114';
      ov.innerHTML = '<div class="vm-rhead"><b>' + esc(r.title || m.title) + ' — replay</b><button class="vm-btn ghost" style="color:#fff" data-x>Close</button></div><div style="flex:1;display:flex;align-items:center;justify-content:center;padding:12px;min-height:0"><video class="vm-player" controls playsinline autoplay src="' + esc(r.url) + '"></video></div>';
      ov.querySelector('[data-x]').onclick = function () { ov.querySelector('video').pause(); ov.remove(); };
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
    var cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
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
      cx.fillStyle = '#202124'; cx.fillRect(0, 0, 1280, 720);
      var keys = Object.keys(R.tiles), scr = keys.filter(function (k) { return /:screen$/.test(k); });
      var list = scr.length ? [scr[0]] : keys, n = list.length || 1, cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4, rows = Math.ceil(n / cols), w = 1280 / cols, h = 720 / rows;
      list.forEach(function (k, i) {
        var x = (i % cols) * w, y = Math.floor(i / cols) * h, t = R.tiles[k], v = t.querySelector('video'), tag = t.querySelector('.vm-tag');
        cx.fillStyle = '#3c4043'; cx.fillRect(x + 3, y + 3, w - 6, h - 6);
        if (v && v.videoWidth) box(v, x + 3, y + 3, w - 6, h - 6, !scr.length);
        else { cx.fillStyle = '#1a73e8'; cx.beginPath(); cx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 7, 0, 7); cx.fill(); cx.fillStyle = '#fff'; cx.font = '700 ' + Math.round(Math.min(w, h) / 6) + 'px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(((tag && tag.textContent) || '?').charAt(0).toUpperCase(), x + w / 2, y + h / 2); }
        if (tag) { cx.font = '600 16px sans-serif'; cx.textAlign = 'left'; cx.textBaseline = 'alphabetic'; var tw = cx.measureText(tag.textContent).width + 16; cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(x + 10, y + h - 34, tw, 24); cx.fillStyle = '#fff'; cx.fillText(tag.textContent, x + 18, y + h - 17); }
      });
    }
    try { var osc = actx.createOscillator(), g0 = actx.createGain(); g0.gain.value = 0; osc.connect(g0); g0.connect(dest); osc.start(); } catch (e) { /* ignore */ }
    wire(); draw();
    var drawT = setInterval(draw, 66), wireT = setInterval(wire, 3000);
    var stream = cv.captureStream(15); dest.stream.getAudioTracks().forEach(function (t) { stream.addTrack(t); });
    var mime = ['video/webm;codecs=vp8,opus', 'video/webm'].filter(function (m) { return window.MediaRecorder && MediaRecorder.isTypeSupported(m); })[0];
    if (!mime) { clearInterval(drawT); clearInterval(wireT); throw new Error('Recording is not supported in this browser. Use Chrome or Edge.'); }
    var mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 600000, audioBitsPerSecond: 64000 }), seq = 0, q = Promise.resolve(), failed = false;
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
  function joinRoom(id) {
    if (!window.LivekitClient) { toast('Meeting engine failed to load.'); return; }
    api('join', { id: id }).then(function (j) { enterRoom(id, j); }).catch(function (e) { toast(e.code === 'waiting' ? 'The teacher has not started yet — you will be able to join once they do.' : e.message); });
  }

  function enterRoom(id, j) {
    var LK = window.LivekitClient, el = $('#vm-room'), tch = j.role === 'teacher';
    var R = state.room = { id: id, tiles: {}, hands: {}, chat: [], unread: 0, panel: 'chat', mic: true, cam: true, sharing: false, recording: !!j.recording, role: j.role };
    el.innerHTML = '<div class="vm-rhead"><b>' + esc(j.title) + '</b><span class="vm-rec' + (R.recording ? ' on' : '') + '"><i></i>REC</span>' +
      (tch ? '<button class="vm-btn" data-r="rec">' + (R.recording ? '■ Stop recording' : '● Record') + '</button><button class="vm-btn" data-r="muteall">Mute all</button>' : '') + '</div>' +
      '<div class="vm-main"><div class="vm-stage" id="vm-stage"></div><div class="vm-side" id="vm-side"><div class="vm-sidehead"><button data-p="chat" class="on">Chat</button><button data-p="people">People</button></div><div class="vm-pane" id="vm-pane"></div><div class="vm-send" id="vm-send"><input id="vm-ci" placeholder="Message everyone" maxlength="500"><button class="vm-btn pri" data-r="send">Send</button></div></div></div>' +
      '<div class="vm-bar"><button class="vm-ctl" data-r="mic" aria-label="Microphone">' + ICON.mic + '</button><button class="vm-ctl" data-r="cam" aria-label="Camera">' + ICON.cam + '</button><button class="vm-ctl" data-r="screen" aria-label="Share screen">' + ICON.screen + '</button><button class="vm-ctl" data-r="hand" aria-label="Raise hand">✋</button><button class="vm-ctl" data-r="chat" aria-label="Chat and people">💬<span class="vm-n" style="display:none"></span></button><button class="vm-ctl leave" data-r="leave" aria-label="Leave">' + ICON.leave + '</button></div>';
    el.classList.add('open');
    var room = R.lk = new LK.Room({ adaptiveStream: true, dynacast: true, videoCaptureDefaults: { resolution: LK.VideoPresets.h540.resolution } });

    function tileFor(p) {
      if (R.tiles[p.identity]) return R.tiles[p.identity];
      var t = document.createElement('div'); t.className = 'vm-tile';
      t.innerHTML = '<div class="vm-av">' + esc((p.name || '?').charAt(0).toUpperCase()) + '</div><div class="vm-tag"></div><div class="vm-hand" style="display:none">✋</div>';
      $('#vm-stage').appendChild(t); R.tiles[p.identity] = t; layout(); return t;
    }
    function updTag(p) { var t = tileFor(p); t.querySelector('.vm-tag').textContent = (p.name || 'Guest') + (p.isLocal ? ' (You)' : '') + (p.isMicrophoneEnabled ? '' : ' 🔇'); }
    function attach(track, p, pub) {
      var t = tileFor(p), key = pub && pub.source === LK.Track.Source.ScreenShare ? 'screen' : 'cam';
      if (track.kind === 'video') {
        var tile = key === 'screen' ? tileFor({ identity: p.identity + ':screen', name: (p.name || '') + ' — screen' }) : t;
        if (key === 'screen') tile.classList.add('screen');
        var v = track.attach(); v.setAttribute('playsinline', ''); if (p.isLocal) v.muted = true;
        tile.querySelector('video') && tile.querySelector('video').remove(); tile.insertBefore(v, tile.firstChild);
        tile.querySelector('.vm-av').style.display = 'none';
      } else if (track.kind === 'audio' && !p.isLocal) { var a = track.attach(); a.style.display = 'none'; t.appendChild(a); }
      updTag(p);
    }
    function detach(track, p, pub) {
      var key = pub && pub.source === LK.Track.Source.ScreenShare ? 'screen' : 'cam';
      track.detach().forEach(function (n) { n.remove(); });
      if (key === 'screen') { var s = R.tiles[p.identity + ':screen']; if (s) { s.remove(); delete R.tiles[p.identity + ':screen']; layout(); } }
      else if (track.kind === 'video') { var t = R.tiles[p.identity]; if (t) t.querySelector('.vm-av').style.display = ''; }
      updTag(p);
    }
    function removeP(p) { [p.identity, p.identity + ':screen'].forEach(function (k) { if (R.tiles[k]) { R.tiles[k].remove(); delete R.tiles[k]; } }); delete R.hands[p.identity]; layout(); people(); }
    function layout() {
      var s = $('#vm-stage'), n = s.children.length, cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
      if (window.innerWidth < 720 && n > 1) cols = n <= 6 ? 2 : 3;
      s.style.gridTemplateColumns = 'repeat(' + cols + ',minmax(0,1fr))';
    }
    R.layout = layout;
    function people() {
      if (R.panel !== 'people') return; var h = '';
      var all = [room.localParticipant].concat(Array.from(room.remoteParticipants.values()));
      all.forEach(function (p) {
        h += '<div class="vm-person"><span>' + esc(p.name || 'Guest') + (p.isLocal ? ' (You)' : '') + '</span>' + (R.hands[p.identity] ? '✋' : '') + (p.isMicrophoneEnabled ? '' : '🔇') +
          (tch && !p.isLocal ? '<button class="vm-btn ghost" data-kick="' + esc(p.identity) + '">Remove</button>' : '') + '</div>';
      });
      $('#vm-pane').innerHTML = h;
    }
    function chatView() {
      if (R.panel !== 'chat') return;
      $('#vm-pane').innerHTML = R.chat.map(function (m) { return '<div class="vm-msg"><b>' + esc(m.from) + '</b><span>' + esc(m.text) + '</span></div>'; }).join('') || '<div class="vm-meta" style="padding:8px">Messages are visible to everyone in the meeting.</div>';
      $('#vm-pane').scrollTop = 1e9;
    }
    R.people = people; R.chatView = chatView;
    function badge() { var n = el.querySelector('.vm-n'); n.style.display = R.unread ? '' : 'none'; n.textContent = R.unread; }

    room.on(LK.RoomEvent.TrackSubscribed, function (tr, pub, p) { attach(tr, p, pub); })
      .on(LK.RoomEvent.TrackUnsubscribed, function (tr, pub, p) { detach(tr, p, pub); })
      .on(LK.RoomEvent.LocalTrackPublished, function (pub, p) { if (pub.track) attach(pub.track, p, pub); })
      .on(LK.RoomEvent.LocalTrackUnpublished, function (pub, p) { if (pub.track) detach(pub.track, p, pub); })
      .on(LK.RoomEvent.ParticipantConnected, function (p) { tileFor(p); updTag(p); people(); })
      .on(LK.RoomEvent.ParticipantDisconnected, removeP)
      .on(LK.RoomEvent.TrackMuted, function (pub, p) { updTag(p); people(); })
      .on(LK.RoomEvent.TrackUnmuted, function (pub, p) { updTag(p); people(); })
      .on(LK.RoomEvent.ActiveSpeakersChanged, function (sp) { Object.keys(R.tiles).forEach(function (k) { R.tiles[k].classList.remove('speaking'); }); sp.forEach(function (p) { if (R.tiles[p.identity]) R.tiles[p.identity].classList.add('speaking'); }); })
      .on(LK.RoomEvent.DataReceived, function (data, p) {
        var m; try { m = JSON.parse(new TextDecoder().decode(data)); } catch (e) { return; }
        if (m.t === 'chat') { R.chat.push({ from: (p && p.name) || 'Guest', text: String(m.x).slice(0, 500) }); if (R.panel === 'chat' && $('#vm-side').classList.contains('open')) chatView(); else { R.unread++; badge(); } }
        if (m.t === 'hand' && p) { R.hands[p.identity] = !!m.on; var tl = R.tiles[p.identity]; if (tl) tl.querySelector('.vm-hand').style.display = m.on ? '' : 'none'; people(); if (m.on && tch) toast((p.name || 'A student') + ' raised a hand'); }
        if (m.t === 'rec') { R.recording = !!m.on; el.querySelector('.vm-rec').classList.toggle('on', R.recording); }
      })
      .on(LK.RoomEvent.Disconnected, function () { if (state.room === R) leave(true); });

    room.connect(j.url, j.token).then(function () {
      tileFor(room.localParticipant); updTag(room.localParticipant);
      room.remoteParticipants.forEach(function (p) { tileFor(p); updTag(p); p.trackPublications.forEach(function (pub) { if (pub.track) attach(pub.track, p, pub); }); });
      return room.localParticipant.setMicrophoneEnabled(true).catch(function () { R.mic = false; }).then(function () { return room.localParticipant.setCameraEnabled(true).catch(function () { R.cam = false; }); });
    }).then(function () { syncCtl(); }).catch(function (e) { toast('Could not connect: ' + e.message); leave(true); });

    function syncCtl() {
      var mic = room.localParticipant.isMicrophoneEnabled, cam = room.localParticipant.isCameraEnabled;
      el.querySelector('[data-r="mic"]').classList.toggle('off', !mic); el.querySelector('[data-r="cam"]').classList.toggle('off', !cam);
      el.querySelector('[data-r="screen"]').classList.toggle('on', R.sharing); el.querySelector('[data-r="hand"]').classList.toggle('on', !!R.hands[room.localParticipant.identity]);
      updTag(room.localParticipant);
    }
    function send(obj) { room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(obj)), { reliable: true }); }
    function leave(silent) {
      var r = state.room; if (!r) return;
      if (r.rec) { toast('Saving the recording…'); stopRecording(r).then(function () { leave(silent); }); return; }
      state.room = null;
      try { r.lk.disconnect(); } catch (e) { /* ignore */ }
      el.classList.remove('open'); el.innerHTML = '';
      if (!silent) toast('You left the meeting.');
      refresh();
    }

    el.onclick = function (ev) {
      var k = ev.target.closest('[data-kick]');
      if (k) { if (confirm('Remove this participant?')) api('kick', { id: id, identity: k.dataset.kick }).catch(function (e) { toast(e.message); }); return; }
      var pbtn = ev.target.closest('[data-p]');
      if (pbtn) { R.panel = pbtn.dataset.p; el.querySelectorAll('[data-p]').forEach(function (b) { b.classList.toggle('on', b === pbtn); }); $('#vm-send').style.display = R.panel === 'chat' ? '' : 'none'; R.panel === 'chat' ? chatView() : people(); return; }
      var b = ev.target.closest('[data-r]'); if (!b) return; var a = b.dataset.r, lp = room.localParticipant;
      if (a === 'mic') lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled).then(syncCtl).catch(function (e) { toast('Microphone: ' + e.message); });
      else if (a === 'cam') lp.setCameraEnabled(!lp.isCameraEnabled).then(syncCtl).catch(function (e) { toast('Camera: ' + e.message); });
      else if (a === 'screen') lp.setScreenShareEnabled(!R.sharing).then(function () { R.sharing = !R.sharing; syncCtl(); }).catch(function (e) { R.sharing = false; toast('Screen share: ' + (e.message || 'not available')); });
      else if (a === 'hand') { var on = !R.hands[lp.identity]; R.hands[lp.identity] = on; send({ t: 'hand', on: on }); R.tiles[lp.identity].querySelector('.vm-hand').style.display = on ? '' : 'none'; syncCtl(); }
      else if (a === 'chat') { var sd = $('#vm-side'); sd.classList.toggle('open'); if (sd.classList.contains('open')) { R.unread = 0; badge(); R.panel === 'chat' ? chatView() : people(); } layout(); }
      else if (a === 'send') { var inp = $('#vm-ci'), x = inp.value.trim(); if (!x) return; send({ t: 'chat', x: x }); R.chat.push({ from: 'You', text: x }); inp.value = ''; chatView(); }
      else if (a === 'leave') { if (tch) { if (confirm('Leave only, or end the meeting for everyone?\n\nOK = End for everyone\nCancel = Just leave')) { if (R.rec) toast('Saving the recording…'); stopRecording(R).then(function () { return api('end', { id: id }); }).catch(function () {}).then(function () { leave(); }); } else leave(); } else leave(); }
      else if (a === 'rec') {
        b.disabled = true;
        var done = function () { el.querySelector('.vm-rec').classList.toggle('on', R.recording); b.textContent = R.recording ? '■ Stop recording' : '● Record'; b.disabled = false; };
        if (R.recording) { toast('Saving the recording…'); stopRecording(R).then(function () { R.recording = false; send({ t: 'rec', on: false }); done(); }); }
        else { try { startRecorder(R, room); } catch (e) { b.disabled = false; return toast(e.message); }
          api('rec-start', { id: id }).then(function () { R.recording = true; send({ t: 'rec', on: true }); done(); }).catch(function (e) { stopRecording(R); b.disabled = false; toast(e.message); }); }
      }
      else if (a === 'muteall') api('mute-all', { id: id }).then(function (r) { toast('Muted ' + (r.muted || 0) + ' participant(s).'); }).catch(function (e) { toast(e.message); });
    };
    el.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && ev.target.id === 'vm-ci') el.querySelector('[data-r="send"]').click(); });
    window.addEventListener('beforeunload', function (ev) { if (R.rec) { ev.preventDefault(); ev.returnValue = 'Recording in progress'; } try { room.disconnect(); } catch (e) { /* ignore */ } });
    chatView();
  }

  /* ── Boot: show the launcher once someone is signed in ── */
  function boot() {
    if (!window.fbAuth) return setTimeout(boot, 500);
    window.fbAuth.onAuthStateChanged(function (u) {
      if (u) { build(); fab.style.display = ''; } else if (fab) { fab.style.display = 'none'; if (root) root.classList.remove('open'); }
    });
  }
  window.Meet = { open: open, close: close, refresh: refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
