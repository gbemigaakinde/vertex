/* ============================================================
   js/proctor.js — optional exam proctoring (camera)
   Student side: live preview in exam UI + video segments or
   intermittent photos uploaded to Backblaze B2 via the Worker.
   Teacher side: Proctor.openViewer(sessionId) gallery/player.
   Modes (set per task by the teacher): 'off' | 'video' | 'photo'
   ============================================================ */
(function () {
  'use strict';
  var WORKER = 'https://vertex-worker.gbemigaakinde.workers.dev';
  var SEG_MS = 60000;                 // each video segment is a standalone playable file
  var stream = null, panel = null, vid = null, recorder = null, segTimer = null, photoTimer = null;
  var cfg = null, sid = null, seq = 0, active = false, queue = [], pumping = false, mime = '';

  function token() {
    var u = window.fbAuth && window.fbAuth.currentUser;
    if (!u) return Promise.reject(new Error('Please sign in again.'));
    return u.getIdToken();
  }
  function pickMime() {
    if (!window.MediaRecorder) return '';
    var c = ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    for (var i = 0; i < c.length; i++) { try { if (MediaRecorder.isTypeSupported(c[i])) return c[i]; } catch (e) {} }
    return '';
  }
  function modeOf(taskCfg) { var m = taskCfg && taskCfg.proctorMode; return m === 'video' || m === 'photo' ? m : 'off'; }
  function required(taskCfg) { return modeOf(taskCfg) !== 'off'; }

  /* Must be called from a user tap (permission prompt + iOS autoplay rules). */
  async function prepare(taskCfg) {
    if (!required(taskCfg)) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      throw new Error('This browser cannot access the camera. Use Chrome, Edge, Firefox or Safari over HTTPS.');
    cfg = taskCfg;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 24 } },
        audio: false
      });
    } catch (e) {
      throw new Error('Camera access is required for this exam. Allow the camera in your browser settings, then try again.');
    }
    return true;
  }

  function buildPanel(mode) {
    removePanel();
    panel = document.createElement('div');
    panel.id = 'proctorPanel';
    panel.setAttribute('role', 'status');
    panel.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:9999;width:132px;background:#111;color:#fff;' +
      'border-radius:10px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.35);font:600 10px/1.3 system-ui,sans-serif;';
    vid = document.createElement('video');
    vid.muted = true; vid.autoplay = true; vid.playsInline = true;
    vid.setAttribute('playsinline', ''); vid.setAttribute('muted', '');
    vid.style.cssText = 'width:100%;height:99px;object-fit:cover;display:block;transform:scaleX(-1);background:#000;';
    var bar = document.createElement('div');
    bar.style.cssText = 'padding:4px 6px;display:flex;align-items:center;gap:5px;';
    bar.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#ef4444;animation:pxBlink 1.2s infinite;flex-shrink:0"></span>' +
      '<span>' + (mode === 'video' ? 'Recording video' : 'Photos being taken') + '</span>';
    var st = document.createElement('style');
    st.textContent = '@keyframes pxBlink{50%{opacity:.25}}@media(max-width:640px){#proctorPanel{width:96px!important}#proctorPanel video{height:72px!important}}';
    panel.appendChild(st); panel.appendChild(vid); panel.appendChild(bar);
    document.body.appendChild(panel);
    vid.srcObject = stream;
    var p = vid.play(); if (p && p.catch) p.catch(function () {});
  }
  function removePanel() { if (panel && panel.parentNode) panel.parentNode.removeChild(panel); panel = null; vid = null; }

  /* ── upload queue with retry ── */
  function enqueue(item) { queue.push(item); pump(); }
  async function pump() {
    if (pumping) return; pumping = true;
    while (queue.length) {
      var it = queue[0];
      try {
        var tk = await token();
        var q = '?sid=' + encodeURIComponent(it.sid) + '&kind=' + it.kind + '&seq=' + it.seq +
                '&t=' + it.t + '&type=' + encodeURIComponent(it.type);
        var r = await fetch(WORKER + '/proctor/upload' + q, { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': it.type }, body: it.blob });
        if (!r.ok && r.status >= 400 && r.status < 500 && r.status !== 429) { queue.shift(); continue; } // permanent
        if (!r.ok) throw new Error('retry');
        queue.shift();
      } catch (e) {
        it.tries = (it.tries || 0) + 1;
        if (it.tries > 8) { queue.shift(); continue; }
        await new Promise(function (res) { setTimeout(res, Math.min(30000, 1500 * it.tries)); });
      }
    }
    pumping = false;
  }

  /* ── video: restart recorder each segment so every file plays on its own ── */
  function startSegment() {
    if (!active || !stream) return;
    var chunks = [];
    try { recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 250000 } : { videoBitsPerSecond: 250000 }); }
    catch (e) { startPhotos(20); return; }
    var t0 = Date.now(), mySeq = seq++;
    recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = function () {
      var type = (recorder && recorder.mimeType) || mime || 'video/webm';
      if (chunks.length) enqueue({ sid: sid, kind: 'video', seq: mySeq, t: t0, type: type.split(';')[0], blob: new Blob(chunks, { type: type.split(';')[0] }) });
      if (active) startSegment();
    };
    recorder.start();
    segTimer = setTimeout(function () { try { if (recorder.state !== 'inactive') recorder.stop(); } catch (e) {} }, SEG_MS);
  }

  /* ── photo mode ── */
  function snap() {
    if (!active || !vid || !vid.videoWidth) return;
    var c = document.createElement('canvas'), w = 480, h = Math.round(w * vid.videoHeight / vid.videoWidth);
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(vid, 0, 0, w, h);
    var mySeq = seq++, t = Date.now();
    c.toBlob(function (b) { if (b) enqueue({ sid: sid, kind: 'photo', seq: mySeq, t: t, type: 'image/jpeg', blob: b }); }, 'image/jpeg', 0.6);
  }
  function startPhotos(sec) {
    var base = Math.max(10, Math.min(600, sec || 60)) * 1000;
    setTimeout(snap, 1500);
    (function next() {
      if (!active) return;
      photoTimer = setTimeout(function () { snap(); next(); }, base * (0.7 + Math.random() * 0.6)); // slight jitter
    })();
  }

  function begin(sessionId) {
    if (!stream || !required(cfg)) return null;
    sid = sessionId; seq = 0; active = true;
    var mode = modeOf(cfg);
    mime = pickMime();
    if (mode === 'video' && !mime && !window.MediaRecorder) mode = 'photo';
    buildPanel(mode);
    if (stream.getVideoTracks()[0]) stream.getVideoTracks()[0].addEventListener('ended', function () {
      if (active && window.UI) UI.toast('Camera stopped. Please re-enable it — this exam is being proctored.', 'error', 8000);
    });
    if (mode === 'video') startSegment(); else startPhotos(cfg.proctorIntervalSec || 60);
    return sid;
  }

  async function stop() {
    var wasActive = active; active = false;
    clearTimeout(segTimer); clearTimeout(photoTimer);
    try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch (e) {}
    if (wasActive && vid && cfg && modeOf(cfg) === 'photo') { active = true; snap(); active = false; }
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    removePanel();
    // give the final segment a moment to flush
    for (var i = 0; i < 20 && (pumping || queue.length); i++) await new Promise(function (r) { setTimeout(r, 500); });
    recorder = null; cfg = null;
  }
  function release() { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; removePanel(); }

  /* ================= Teacher viewer ================= */
  var urls = [];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  async function mediaBlob(id) {
    var r = await fetch(WORKER + '/proctor/media', { method: 'POST', headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id }) });
    if (!r.ok) throw new Error('Could not load media.');
    var b = await r.blob(); var u = URL.createObjectURL(b); urls.push(u); return u;
  }
  async function openViewer(sessionId, title) {
    closeViewer();
    var ov = document.createElement('div'); ov.id = 'proctorViewer';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:12px;';
    ov.innerHTML = '<div style="background:var(--bg-base,#fff);color:var(--text-1,#111);border-radius:12px;max-width:900px;width:100%;max-height:92vh;overflow:auto;padding:16px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><strong>Proctoring — ' + esc(title || 'exam') + '</strong>' +
      '<button id="pxClose" class="btn" style="padding:4px 12px;">Close</button></div><div id="pxBody">Loading…</div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#pxClose').onclick = closeViewer;
    var body = ov.querySelector('#pxBody');
    try {
      var r = await fetch(WORKER + '/proctor/list', { method: 'POST', headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' }, body: JSON.stringify({ sid: sessionId }) });
      var j = await r.json(); if (!r.ok) throw new Error(j.error || 'Failed');
      var items = j.items || [];
      if (!items.length) { body.innerHTML = '<p>No recordings were saved for this exam.</p>'; return; }
      body.innerHTML = '<div id="pxGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;"></div>';
      var grid = body.querySelector('#pxGrid');
      items.forEach(function (it) {
        var cell = document.createElement('div');
        cell.style.cssText = 'border:1px solid var(--border,#ddd);border-radius:8px;padding:6px;font-size:12px;';
        var when = new Date(it.t).toLocaleTimeString();
        cell.innerHTML = '<div style="margin-bottom:4px;">' + (it.kind === 'video' ? '🎥 Video' : '📷 Photo') + ' · ' + esc(when) + '</div><button class="btn" style="width:100%;padding:4px;">Load</button>';
        cell.querySelector('button').onclick = async function () {
          this.textContent = 'Loading…';
          try {
            var u = await mediaBlob(it.id);
            cell.innerHTML = '<div style="margin-bottom:4px;">' + (it.kind === 'video' ? '🎥 ' : '📷 ') + esc(when) + '</div>' +
              (it.kind === 'video' ? '<video controls playsinline src="' + u + '" style="width:100%;border-radius:6px;"></video>'
                                   : '<img src="' + u + '" style="width:100%;border-radius:6px;" alt="Student photo">');
          } catch (e) { this.textContent = 'Failed — retry'; }
        };
        grid.appendChild(cell);
      });
    } catch (e) { body.innerHTML = '<p style="color:var(--danger,#c00)">' + esc(e.message) + '</p>'; }
  }
  function closeViewer() {
    var o = document.getElementById('proctorViewer'); if (o) o.remove();
    urls.forEach(function (u) { URL.revokeObjectURL(u); }); urls = [];
  }

  window.Proctor = { required: required, modeOf: modeOf, prepare: prepare, begin: begin, stop: stop, release: release, openViewer: openViewer };
})();
