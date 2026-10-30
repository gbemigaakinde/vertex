/* ============================================================
   js/proctor.js — optional exam proctoring (camera)
   Student side: live preview in exam UI + video segments or
   intermittent photos uploaded to Backblaze B2 via the Worker.
   Teacher side: Proctor.openViewer(sessionId) gallery/player.
   Modes (set per task by the teacher): 'off' | 'video' | 'photo'
   ============================================================ */
(function () {
  'use strict';
  var BASE = (document.currentScript && document.currentScript.src) ? new URL('../vendor/mediapipe/', document.currentScript.src).href : '/vendor/mediapipe/';
  var WORKER = 'https://vertex-worker.gbemigaakinde.workers.dev';
  var SEG_MS = 60000;                 // each video segment is a standalone playable file
  var stream = null, host = null, shadow = null, panel = null, vid = null, cap = null, blockEl = null;
  var recorder = null, cfg = null, sid = null, seq = 0, active = false, queue = [], pumping = false, mime = '';
  var ticker = null, tickWorker = null, startMs = 0, segDue = 0, photoDue = 0, photoBase = 60000, modeNow = 'photo';
  var flagSeq = 0, flagLast = {}, bodyObs = null, hostObs = null, lastVisTs = 0, hiddenAt = 0;
  var cameraLost = false, lostAt = 0, reacquiring = false, lastCheck = 0, lastTamper = 0;
  var lm = null, lmState = 'idle', away = 0;
  var detector = null, noFace = 0, multiFace = 0, dark = 0, lastFaceState = '';
  var HOST_CSS = 'all:initial;position:fixed;left:0;top:0;width:0;height:0;z-index:2147483000;';
  var COOL = { looking_away: 30000, camera_stopped: 0, camera_restored: 0, tab_returned: 0, tab_hidden: 5000 };
  var LABEL = { no_face: 'No face seen', multiple_faces: 'More than one face', camera_covered: 'Camera covered or very dark',
    camera_stopped: 'Camera stopped', camera_restored: 'Camera turned back on', tab_hidden: 'Left the exam tab',
    tab_returned: 'Returned to the exam tab', panel_tampered: 'Preview panel was hidden or removed', face_back: 'Face visible again', looking_away: 'Looking away from the screen' };

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
  function camConstraints() {
    return { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 24 } }, audio: false };
  }

  /* Must be called from a user tap (permission prompt + iOS autoplay rules). */
  async function prepare(taskCfg) {
    if (!required(taskCfg)) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      throw new Error('This browser cannot access the camera. Use Chrome, Edge, Firefox or Safari over HTTPS.');
    cfg = taskCfg;
    try { stream = await navigator.mediaDevices.getUserMedia(camConstraints()); }
    catch (e) { throw new Error('Camera access is required for this exam. Allow the camera in your browser settings, then try again.'); }
    loadLandmarker();
    return true;
  }

  /* ── panel: lives in a closed shadow root and is restored if it is hidden or removed ── */
  function buildPanel(mode) {
    removePanel();
    host = document.createElement('div');
    host.id = 'proctorPanel';
    host.style.cssText = HOST_CSS;
    shadow = host.attachShadow({ mode: 'closed' });
    var st = document.createElement('style');
    st.textContent = '@keyframes pxBlink{50%{opacity:.25}}' +
      '.p{position:fixed;left:10px;bottom:10px;width:132px;background:#111;color:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.35);font:600 10px/1.3 system-ui,sans-serif;}' +
      '.p video{width:100%;height:99px;object-fit:cover;display:block;transform:scaleX(-1);background:#000;}' +
      '.b{padding:4px 6px;display:flex;align-items:center;gap:5px;}.d{width:8px;height:8px;border-radius:50%;background:#ef4444;animation:pxBlink 1.2s infinite;flex-shrink:0}' +
      '.c{position:fixed;left:0;top:0;width:2px;height:2px;opacity:.01;pointer-events:none}' +
      '.o{position:fixed;inset:0;background:rgba(10,10,10,.96);color:#fff;display:none;align-items:center;justify-content:center;text-align:center;padding:24px;font:600 16px/1.5 system-ui,sans-serif;flex-direction:column;gap:14px}' +
      '.o button{background:#ef4444;color:#fff;border:0;border-radius:8px;padding:12px 22px;font:700 15px system-ui,sans-serif;cursor:pointer}' +
      '@media(max-width:640px){.p{width:96px}.p video{height:72px}}';
    panel = document.createElement('div'); panel.className = 'p'; panel.setAttribute('role', 'status');
    vid = document.createElement('video'); vid.muted = true; vid.autoplay = true; vid.playsInline = true;
    vid.setAttribute('playsinline', ''); vid.setAttribute('muted', '');
    var bar = document.createElement('div'); bar.className = 'b';
    bar.innerHTML = '<span class="d"></span><span>' + (mode === 'video' ? 'Recording video' : 'Photos being taken') + '</span>';
    panel.appendChild(vid); panel.appendChild(bar);
    // Capture and analysis read from this hidden copy, so removing the preview cannot stop photos.
    cap = document.createElement('video'); cap.className = 'c'; cap.muted = true; cap.autoplay = true; cap.playsInline = true;
    cap.setAttribute('playsinline', ''); cap.setAttribute('muted', '');
    blockEl = document.createElement('div'); blockEl.className = 'o';
    blockEl.innerHTML = '<div>Your camera has stopped.<br><span style="font-weight:400;font-size:14px">This exam is proctored. Turn the camera back on to continue.</span></div><button type="button">Turn camera on</button>';
    blockEl.querySelector('button').onclick = function () { reacquire(true); };
    shadow.appendChild(st); shadow.appendChild(panel); shadow.appendChild(cap); shadow.appendChild(blockEl);
    document.body.appendChild(host);
    attachStream();
    watchHost();
  }
  function attachStream() {
    if (!stream) return;
    [vid, cap].forEach(function (v) { if (!v) return; v.srcObject = stream; var p = v.play(); if (p && p.catch) p.catch(function () {}); });
  }
  function removePanel() {
    if (bodyObs) { bodyObs.disconnect(); bodyObs = null; }
    if (hostObs) { hostObs.disconnect(); hostObs = null; }
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = shadow = panel = vid = cap = blockEl = null;
  }
  function watchHost() {
    if (!window.MutationObserver) return;
    hostObs = new MutationObserver(function () {
      if (!active || !host) return;
      if (host.getAttribute('style') !== HOST_CSS || host.hasAttribute('hidden') || host.hasAttribute('class')) {
        host.removeAttribute('class'); host.removeAttribute('hidden'); host.setAttribute('style', HOST_CSS);
        flag('panel_tampered', 'style changed', false);
      }
    });
    hostObs.observe(host, { attributes: true });
    bodyObs = new MutationObserver(function () {
      if (active && host && !host.isConnected) { document.body.appendChild(host); flag('panel_tampered', 'removed', false); }
    });
    bodyObs.observe(document.body, { childList: true });
  }
  function panelVisible() {
    if (!host || !host.isConnected || !panel) return false;
    var r = panel.getBoundingClientRect(), cs = getComputedStyle(panel), hs = getComputedStyle(host);
    return r.width > 20 && r.height > 20 && cs.visibility !== 'hidden' && cs.display !== 'none' && hs.display !== 'none' &&
           hs.visibility !== 'hidden' && parseFloat(hs.opacity || '1') > 0.5 && parseFloat(cs.opacity || '1') > 0.5;
  }

  /* ── flags: small JSON records (plus an evidence photo when a frame is available) ── */
  function flag(code, detail, withPhoto) {
    if (!active || !sid) return;
    var now = Date.now(), cd = COOL[code] == null ? 20000 : COOL[code];
    if (flagLast[code] && now - flagLast[code] < cd) return;
    flagLast[code] = now;
    var s = Math.floor((now - startMs) / 250); if (!(s > flagSeq)) s = flagSeq + 1; flagSeq = Math.min(19999, s);
    var body = JSON.stringify({ code: code, label: LABEL[code] || code, detail: detail || '', t: now });
    enqueue({ sid: sid, kind: 'flag', seq: flagSeq, t: now, type: 'application/json', note: code, blob: new Blob([body], { type: 'application/json' }) });
    if (withPhoto) snap(code);
  }

  /* ── upload queue with retry ── */
  function enqueue(item) { queue.push(item); pump(); }
  async function pump() {
    if (pumping) return; pumping = true;
    while (queue.length) {
      var it = queue[0];
      try {
        var tk = await token();
        if (it.event) {
          var er = await fetch(WORKER + '/proctor/event', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
            body: JSON.stringify({ sid: it.sid, code: it.code, t: it.t, durationSec: it.durationSec, detail: it.detail }) });
          if (!er.ok && er.status >= 400 && er.status < 500 && er.status !== 429) { queue.shift(); continue; }
          if (!er.ok) throw new Error('retry');
          queue.shift(); continue;
        }
        var q = '?sid=' + encodeURIComponent(it.sid) + '&kind=' + it.kind + '&seq=' + it.seq +
                '&t=' + it.t + '&type=' + encodeURIComponent(it.type) + (it.note ? '&note=' + encodeURIComponent(it.note) : '');
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
    if (!active || !stream || cameraLost) return;
    var chunks = [];
    try { recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 250000 } : { videoBitsPerSecond: 250000 }); }
    catch (e) { modeNow = 'photo'; photoDue = Date.now() + 1500; return; }
    var t0 = Date.now(), mySeq = seq++, rec = recorder;
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function () {
      var type = (rec && rec.mimeType) || mime || 'video/webm';
      if (chunks.length) enqueue({ sid: sid, kind: 'video', seq: mySeq, t: t0, type: type.split(';')[0], blob: new Blob(chunks, { type: type.split(';')[0] }) });
      if (rec === recorder) { recorder = null; if (active && !cameraLost) startSegment(); }
    };
    rec.start();
    segDue = Date.now() + SEG_MS;
  }
  function endSegment() { try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch (e) {} }

  /* ── photo mode ── */
  function snap(note) {
    var v = cap && cap.videoWidth ? cap : vid;
    if (!active || !v || !v.videoWidth) return;
    var c = document.createElement('canvas'), w = 480, h = Math.round(w * v.videoHeight / v.videoWidth);
    c.width = w; c.height = h;
    try { c.getContext('2d').drawImage(v, 0, 0, w, h); } catch (e) { return; }
    var mySeq = seq++, t = Date.now();
    c.toBlob(function (b) { if (b) enqueue({ sid: sid, kind: 'photo', seq: mySeq, t: t, type: 'image/jpeg', note: typeof note === 'string' ? note : '', blob: b }); }, 'image/jpeg', 0.6);
  }
  function nextPhotoDue() { return Date.now() + photoBase * (0.7 + Math.random() * 0.6); }  // slight jitter

  /* ── lightweight on-device checks (no frames leave the device for this) ── */
  function sampleLuma() {
    if (!cap || !cap.videoWidth) return null;
    try {
      var c = document.createElement('canvas'); c.width = 32; c.height = 24;
      var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(cap, 0, 0, 32, 24);
      var d = x.getImageData(0, 0, 32, 24).data, s = 0, n = 0;
      for (var i = 0; i < d.length; i += 4) { s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++; }
      return s / n;
    } catch (e) { return null; }
  }
  /* ── MediaPipe Face Landmarker (self-hosted in /vendor/mediapipe; works in every modern browser, runs on-device) ── */
  async function loadLandmarker() {
    if (lmState !== 'idle') return;
    lmState = 'loading';
    try {
      var mod = await import(BASE + 'vision_bundle.mjs');
      var fs = await mod.FilesetResolver.forVisionTasks(BASE + 'wasm');
      lm = await mod.FaceLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath: BASE + 'face_landmarker.task' },
        runningMode: 'VIDEO', numFaces: 4, outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5
      });
      lmState = 'ready';
    } catch (e) { lm = null; lmState = 'failed'; }
  }
  // Head direction from landmarks: yaw 0 = facing the screen; pitch ~0.5-0.65 when facing it.
  function poseOf(l) {
    if (!l || !l[454]) return null;
    var nose = l[1], L = l[234], R = l[454], top = l[10], chin = l[152];
    var w = R.x - L.x, h = chin.y - top.y;
    if (!(Math.abs(w) > 1e-4) || !(h > 1e-4)) return null;
    return { yaw: (nose.x - L.x) / w - 0.5, pitch: (nose.y - top.y) / h };
  }
  function gazeOf(bs) {
    if (!bs || !bs[0] || !bs[0].categories) return 0;
    var m = {}; bs[0].categories.forEach(function (c) { m[c.categoryName] = c.score; });
    var a = ((m.eyeLookInLeft || 0) + (m.eyeLookOutRight || 0)) / 2, b = ((m.eyeLookOutLeft || 0) + (m.eyeLookInRight || 0)) / 2;
    return Math.max(a, b);
  }
  function judge(pose, gaze) {
    if (!pose) return '';
    if (Math.abs(pose.yaw) > 0.2) return 'head turned';
    if (pose.pitch < 0.36 || pose.pitch > 0.82) return pose.pitch > 0.82 ? 'head down' : 'head up';
    if (gaze > 0.75) return 'eyes to the side';
    return '';
  }
  function faceCheckMP() {
    if (!active || cameraLost || document.hidden || lmState !== 'ready' || !cap || !cap.videoWidth || dark) return;
    var r;
    try { r = lm.detectForVideo(cap, performance.now()); } catch (e) { return; }
    var faces = (r && r.faceLandmarks) || [], n = faces.length;
    noFace = n === 0 ? noFace + 1 : 0;
    multiFace = n > 1 ? multiFace + 1 : 0;
    var why = n === 1 ? judge(poseOf(faces[0]), gazeOf(r.faceBlendshapes)) : '';
    away = why ? away + 1 : 0;
    if (noFace >= 4) { lastFaceState = 'none'; flag('no_face', noFace + ' s in a row', true); }
    else if (multiFace >= 3) { lastFaceState = 'multi'; flag('multiple_faces', n + ' faces', true); }
    else if (away >= 4) { lastFaceState = 'away'; flag('looking_away', why, true); }
    else if (n === 1 && !why && lastFaceState) { lastFaceState = ''; flag('face_back', '', false); }
  }

  async function checkFrame() {
    if (!active || cameraLost || !cap || !cap.videoWidth || document.hidden) return;
    var luma = sampleLuma();
    if (luma != null) {
      if (luma < 14) { dark++; if (dark >= 2) flag('camera_covered', 'brightness ' + Math.round(luma), true); } else dark = 0;
    }
    if (!detector && detector !== false) {
      try { detector = ('FaceDetector' in window) ? new window.FaceDetector({ fastMode: true, maxDetectedFaces: 4 }) : false; } catch (e) { detector = false; }
    }
    if (lmState === 'ready' || lmState === 'loading' || !detector || dark) return;
    try {
      var faces = await detector.detect(cap), n = faces ? faces.length : 0;
      noFace = n === 0 ? noFace + 1 : 0;
      multiFace = n > 1 ? multiFace + 1 : 0;
      if (noFace >= 3) { lastFaceState = 'none'; flag('no_face', noFace + ' checks in a row', true); }
      else if (multiFace >= 2) { lastFaceState = 'multi'; flag('multiple_faces', n + ' faces', true); }
      else if (n === 1 && lastFaceState) { lastFaceState = ''; flag('face_back', '', false); }
    } catch (e) { detector = false; }
  }

  /* ── camera loss: block the exam screen until the camera is back ── */
  function showBlock(on) { if (blockEl) blockEl.style.display = on ? 'flex' : 'none'; }
  function onCameraLost(why) {
    if (!active || cameraLost) return;
    cameraLost = true; lostAt = Date.now();
    endSegment();
    flag('camera_stopped', why || 'track ended', false);
    if (sc.active) logEvent('camera_stopped', why || 'track ended', 0);
    showBlock(true);
    if (window.UI) UI.toast('Camera stopped. Turn it back on to continue the exam.', 'error', 8000);
  }
  function bindTrack() {
    var tr = stream && stream.getVideoTracks()[0];
    if (!tr) return;
    tr.addEventListener('ended', function () { if (stream && stream.getVideoTracks()[0] === tr) onCameraLost('track ended'); });
    tr.addEventListener('mute', function () { setTimeout(function () { if (tr.muted && active) onCameraLost('track muted'); }, 4000); });
  }
  async function reacquire(manual) {
    if (!active || !cameraLost || reacquiring) return;
    reacquiring = true;
    try {
      var s = await navigator.mediaDevices.getUserMedia(camConstraints());
      if (stream) stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      stream = s; attachStream(); bindTrack();
      var away = Math.round((Date.now() - lostAt) / 1000);
      cameraLost = false; dark = 0; noFace = 0; multiFace = 0; showBlock(false);
      flag('camera_restored', 'off for ' + away + 's', false);
      if (modeNow === 'video') startSegment(); else photoDue = Date.now() + 1500;
    } catch (e) {
      if (manual && window.UI) UI.toast('Could not turn the camera on. Check it is connected and allowed in the browser.', 'error', 6000);
    }
    reacquiring = false;
  }

  /* ── tab visibility: flag it and catch up straight away when the student returns ── */
  function onVis() {
    if (!active) return;
    if (document.hidden) {
      hiddenAt = Date.now();
      flag('tab_hidden', '', false);
      if (modeNow === 'video') endSegment();          // upload what we have now, in case the tab gets frozen
    } else {
      var away = hiddenAt ? Math.round((Date.now() - hiddenAt) / 1000) : 0; hiddenAt = 0;
      flag('tab_returned', 'away ' + away + 's', false);
      if (cap) { var p = cap.play(); if (p && p.catch) p.catch(function () {}); }
      if (modeNow === 'photo') { photoDue = Date.now() + 500; }
    }
  }
  function onPageHide() { if (active && modeNow === 'video') endSegment(); }

  /* ── one scheduler. A Worker clock is throttled far less than page timers when the tab is in the background ── */
  function startTicker() {
    stopTicker();
    var fn = function () { tick(); };
    try {
      var url = URL.createObjectURL(new Blob(['setInterval(function(){postMessage(1)},1000)'], { type: 'application/javascript' }));
      tickWorker = new Worker(url); tickWorker._url = url;
      tickWorker.onmessage = fn;
      tickWorker.onerror = function () { try { tickWorker.terminate(); } catch (e) {} tickWorker = null; if (!ticker) ticker = setInterval(fn, 1000); };
    } catch (e) { tickWorker = null; }
    if (!tickWorker) ticker = setInterval(fn, 1000);
  }
  function stopTicker() {
    if (ticker) { clearInterval(ticker); ticker = null; }
    if (tickWorker) { try { tickWorker.terminate(); URL.revokeObjectURL(tickWorker._url); } catch (e) {} tickWorker = null; }
  }
  function tick() {
    if (!active) return;
    var now = Date.now();
    var tr = stream && stream.getVideoTracks()[0];
    if (!cameraLost && (!tr || tr.readyState === 'ended')) onCameraLost('track ended');
    if (cameraLost) { if (now - lastCheck > 4000) { lastCheck = now; reacquire(false); } return; }
    if (modeNow === 'video') { if (now >= segDue) endSegment(); }
    else if (now >= photoDue) { snap(); photoDue = nextPhotoDue(); }
    faceCheckMP();
    if (now - lastCheck >= 4000) {
      lastCheck = now;
      if (!panelVisible() && host) { host.setAttribute('style', HOST_CSS); if (now - lastTamper > 30000) { lastTamper = now; flag('panel_tampered', 'hidden', false); } }
      if (vid && vid.srcObject !== stream) attachStream();
      if (vid && vid.paused) { var p = vid.play(); if (p && p.catch) p.catch(function () {}); }
      checkFrame();
    }
  }

  function begin(sessionId, resumed) {
    if (!stream || !required(cfg)) return null;
    sid = sessionId; active = true; cameraLost = false;
    startMs = parseInt(String(sessionId).split('_').pop(), 10) || Date.now();
    // On resume, continue numbering by elapsed seconds so earlier recordings are never overwritten.
    seq = (resumed && startMs) ? Math.min(15000, Math.max(1, Math.floor((Date.now() - startMs) / 1000))) : 0;
    flagSeq = 0; flagLast = {}; away = 0; dark = noFace = multiFace = 0; lastFaceState = '';
    var mode = modeOf(cfg);
    mime = pickMime();
    if (mode === 'video' && !mime && !window.MediaRecorder) mode = 'photo';
    modeNow = mode;
    photoBase = Math.max(10, Math.min(600, cfg.proctorIntervalSec || 60)) * 1000;
    buildPanel(mode);
    bindTrack();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onPageHide);
    if (mode === 'video') startSegment(); else photoDue = Date.now() + 1500;
    lastCheck = Date.now();
    loadLandmarker();
    startTicker();
    if (resumed) flag('tab_returned', 'exam page reopened', false);
    return sid;
  }

  async function stop() {
    try { await stopScreen(); } catch (e) {}
    var wasActive = active;
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pagehide', onPageHide);
    stopTicker();
    var rec = recorder;
    if (wasActive && modeNow === 'photo' && !cameraLost) snap();   // final photo while still active
    active = false;
    if (rec && rec.state !== 'inactive') {
      await new Promise(function (res) {
        var prev = rec.onstop;
        rec.onstop = function (ev) { try { if (prev) prev.call(rec, ev); } catch (e) {} res(); };
        try { rec.stop(); } catch (e) { res(); }
        setTimeout(res, 3000);
      });
    }
    // give the final photo / segment a moment to be built and flushed
    for (var i = 0; i < 4 && !queue.length; i++) await new Promise(function (r) { setTimeout(r, 100); });
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    removePanel();
    for (var j = 0; j < 20 && (pumping || queue.length); j++) await new Promise(function (r) { setTimeout(r, 500); });
    recorder = null; cfg = null; cameraLost = false;
  }
  function release() { releaseScreen(); active = false; stopTicker(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', onPageHide); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; removePanel(); }

  /* ================= Screen capture (independent of the camera) ================= */
  var SCREEN_LABEL = { tab_hidden: 'Left the exam tab', tab_visible: 'Returned to the exam tab', window_blur: 'Exam window lost focus', window_focus: 'Exam window in focus again',
    screen_share_started: 'Screen sharing started', screen_share_stopped: 'Screen sharing stopped', screen_share_resumed: 'Screen sharing resumed',
    camera_stopped: 'Camera stopped (screen exam)', unsupported_device_blocked: 'Device cannot share its screen: exam blocked', unsupported_device_camera_only: 'Device cannot share its screen: allowed with camera only' };
  var sc = { pending: null, stream: null, vid: null, host: null, shadow: null, over: null, overTitle: null, overSub: null, cfg: null, sid: null, active: false, lost: false, lostAt: 0,
    startMs: 0, shotSeq: 0, vidSeq: 0, rec: null, segDue: 0, shotDue: 0, shotBase: 30000, modeNow: 'shots', ticker: null, tickWorker: null, lastExtra: 0,
    badge: null, hiddenAt: 0, blurAt: 0, asking: false, mime: '', bodyObs: null, everShared: false };
  var SC_CSS = 'all:initial;position:fixed;left:0;top:0;width:0;height:0;z-index:2147483100;';

  function screenModeOf(c) { var m = c && c.screenMode; return m === 'shots' || m === 'video' ? m : 'off'; }
  function screenRequired(c) { return screenModeOf(c) !== 'off'; }
  function screenSupported() { return !!(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function'); }
  function screenFallbackCamera(c) { return screenRequired(c) && !screenSupported() && c.screenUnsupported === 'camera'; }
  // If the device cannot share its screen and the teacher allowed "camera only", the camera is switched on even if the task had it off.
  function effectiveConfig(c) {
    if (screenFallbackCamera(c) && modeOf(c) === 'off') return Object.assign({}, c, { proctorMode: 'photo', proctorIntervalSec: 30 });
    return c;
  }
  function consentHtml(c) {
    var cam = modeOf(c) !== 'off', scr = screenRequired(c);
    if (!scr) return '';
    var items = [];
    if (cam) items.push('your <strong>camera</strong> (' + (modeOf(c) === 'video' ? 'video of you during the whole exam' : 'photos of you at intervals') + ')');
    var iv = c.screenIntervalSec || 30;
    items.push('your <strong>entire screen</strong> (' + (screenModeOf(c) === 'video' ? 'video of everything on your screen during the whole exam' : 'screenshots about every ' + (iv >= 60 ? Math.round(iv / 60) + ' minute(s)' : iv + ' seconds') + ', plus one whenever you leave this tab') + ')');
    var note = screenSupported() ? '' : '<br><span style="color:var(--danger,#b91c1c)">This device cannot share its screen (phones and tablets usually cannot). ' +
      (c.screenUnsupported === 'camera' ? 'You may continue with your camera only.' : 'Please use a computer to take this exam.') + '</span>';
    return '<div id="proctorConsent" style="border:1px solid var(--border,#ddd);border-radius:8px;padding:.6rem .75rem;margin-bottom:1rem;font-size:.8rem;text-align:left;">' +
      '<strong>This exam is proctored.</strong> While it runs, the following is recorded: ' + items.join(' and ') + '. ' +
      'When you press Start you will be asked to share your screen: choose <strong>Entire Screen</strong>. If you stop sharing, the exam is blocked until you share again. ' +
      'Recordings are visible only to your teacher.' + note + '</div>';
  }

  async function grabScreen() {
    var s;
    try {
      s = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor', frameRate: { ideal: 8, max: 10 }, width: { max: 1280 } }, audio: false,
        selfBrowserSurface: 'exclude', monitorTypeSurfaces: 'include', surfaceSwitching: 'exclude' });
    } catch (e) { throw new Error('Screen sharing is required for this exam. Press the button again and choose Entire Screen.'); }
    var tr = s.getVideoTracks()[0], surf;
    try { surf = tr && tr.getSettings ? tr.getSettings().displaySurface : undefined; } catch (e) {}
    // Browsers that do not report the surface (older Firefox / Safari desktop) cannot be checked; anything reported other than "monitor" is rejected.
    if (!tr || tr.readyState === 'ended' || (surf && surf !== 'monitor')) {
      s.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      throw new Error('Please choose Entire Screen — not a window or a tab. Try again.');
    }
    return s;
  }
  /* Must be called straight from the tap on "Begin Exam". */
  async function prepareScreen(c) {
    if (!screenRequired(c)) return true;
    if (!screenSupported()) throw new Error('unsupported');
    if (sc.pending) { sc.pending.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); sc.pending = null; }
    sc.pending = await grabScreen();
    sc.cfg = c;
    return true;
  }
  function releasePendingScreen() { if (sc.pending) { sc.pending.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); sc.pending = null; } }

  function logEvent(code, detail, durationSec, t) {
    if (!sc.sid) return;
    enqueue({ event: true, sid: sc.sid, code: code, t: t || Date.now(), durationSec: durationSec || 0, detail: detail || '' });
  }
  function logEventFor(sessionId, code, detail) {  // for decisions made before a screen session exists
    enqueue({ event: true, sid: sessionId, code: code, t: Date.now(), durationSec: 0, detail: detail || '' });
  }

  function buildScreenUi() {
    removeScreenUi();
    sc.host = document.createElement('div'); sc.host.id = 'screenProctorHost'; sc.host.style.cssText = SC_CSS;
    sc.shadow = sc.host.attachShadow({ mode: 'closed' });
    var st = document.createElement('style');
    st.textContent = '@keyframes spBlink{50%{opacity:.25}}' +
      '.bd{position:fixed;left:10px;bottom:10px;background:#111;color:#fff;border-radius:999px;padding:5px 10px;box-shadow:0 4px 18px rgba(0,0,0,.35);font:600 10px/1.3 system-ui,sans-serif;display:flex;align-items:center;gap:5px;white-space:nowrap;max-width:calc(100vw - 120px)}' +
      '.d{width:8px;height:8px;border-radius:50%;background:#ef4444;animation:spBlink 1.2s infinite;flex-shrink:0}' +
      '.sv{position:fixed;left:0;top:0;width:2px;height:2px;opacity:.01;pointer-events:none}' +
      '.o{position:fixed;inset:0;background:rgba(10,10,10,.97);color:#fff;display:none;align-items:center;justify-content:center;text-align:center;padding:24px;font:600 18px/1.5 system-ui,sans-serif;flex-direction:column;gap:14px}' +
      '.o small{font-weight:400;font-size:14px;max-width:420px;opacity:.85}' +
      '.o button{background:#ef4444;color:#fff;border:0;border-radius:8px;padding:12px 22px;font:700 15px system-ui,sans-serif;cursor:pointer}' +
      '.bd.c{left:152px}@media(max-width:640px){.bd.c{left:116px}}';
    var badge = document.createElement('div'); badge.className = 'bd'; badge.setAttribute('role', 'status'); sc.badge = badge;
    badge.innerHTML = '<span class="d"></span><span>Screen being recorded</span>';
    sc.vid = document.createElement('video'); sc.vid.className = 'sv'; sc.vid.muted = true; sc.vid.autoplay = true; sc.vid.playsInline = true;
    sc.vid.setAttribute('playsinline', ''); sc.vid.setAttribute('muted', '');
    sc.over = document.createElement('div'); sc.over.className = 'o';
    sc.overTitle = document.createElement('div'); sc.overSub = document.createElement('small');
    var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Share my screen';
    btn.onclick = function () { regainScreen(); };
    sc.over.appendChild(sc.overTitle); sc.over.appendChild(sc.overSub); sc.over.appendChild(btn);
    sc.shadow.appendChild(st); sc.shadow.appendChild(badge); sc.shadow.appendChild(sc.vid); sc.shadow.appendChild(sc.over);
    document.body.appendChild(sc.host);
    if (window.MutationObserver) {
      sc.bodyObs = new MutationObserver(function () { if (sc.active && sc.host && !sc.host.isConnected) document.body.appendChild(sc.host); });
      sc.bodyObs.observe(document.body, { childList: true });
    }
  }
  function camPanelActive() { return !!(host && host.isConnected); }
  function removeScreenUi() {
    if (sc.bodyObs) { sc.bodyObs.disconnect(); sc.bodyObs = null; }
    if (sc.host && sc.host.parentNode) sc.host.parentNode.removeChild(sc.host);
    sc.badge = null; sc.host = sc.shadow = sc.vid = sc.over = sc.overTitle = sc.overSub = null;
  }
  function showScreenOverlay(on, resume) {
    if (!sc.over) return;
    sc.overTitle.textContent = resume ? 'Share your screen to continue.' : 'Screen sharing stopped. Share your entire screen to continue.';
    sc.overSub.textContent = 'This exam records your entire screen. Press the button, then choose Entire Screen. Your exam timer is still running.';
    sc.over.style.display = on ? 'flex' : 'none';
  }
  function attachScreen() {
    if (!sc.vid || !sc.stream) return;
    sc.vid.srcObject = sc.stream; var p = sc.vid.play(); if (p && p.catch) p.catch(function () {});
  }
  function bindScreenTrack() {
    var tr = sc.stream && sc.stream.getVideoTracks()[0]; if (!tr) return;
    tr.addEventListener('ended', function () { if (sc.stream && sc.stream.getVideoTracks()[0] === tr) onScreenLost('track ended'); });
  }

  function shot(note) {
    var v = sc.vid;
    if (!sc.active || sc.lost || !v || !v.videoWidth) return;
    var w = Math.min(1280, v.videoWidth), h = Math.round(w * v.videoHeight / v.videoWidth);
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    try { c.getContext('2d').drawImage(v, 0, 0, w, h); } catch (e) { return; }
    var mySeq = Math.min(19999, sc.shotSeq++), t = Date.now();
    c.toBlob(function (b) { if (b) enqueue({ sid: sc.sid, kind: 'screen', seq: mySeq, t: t, type: 'image/jpeg', note: typeof note === 'string' ? note : '', blob: b }); }, 'image/jpeg', 0.6);
  }
  function nextShotDue() { return Date.now() + sc.shotBase * (0.7 + Math.random() * 0.6); }
  // Extra evidence when the student leaves the tab: one now, one a moment later (shows what they switched to).
  function extraShot(note) {
    var now = Date.now();
    if (now - sc.lastExtra < 2500) return;
    sc.lastExtra = now; shot(note);
    setTimeout(function () { if (sc.active && !sc.lost && (document.hidden || !document.hasFocus())) shot(note); }, 1500);
  }
  function startScreenSegment() {
    if (!sc.active || !sc.stream || sc.lost) return;
    var chunks = [], rec;
    try { rec = new MediaRecorder(sc.stream, sc.mime ? { mimeType: sc.mime, videoBitsPerSecond: 400000 } : { videoBitsPerSecond: 400000 }); }
    catch (e) { sc.modeNow = 'shots'; sc.shotDue = Date.now() + 1500; return; }
    sc.rec = rec;
    var t0 = Date.now(), mySeq = Math.min(19999, sc.vidSeq++);
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function () {
      var type = (rec.mimeType || sc.mime || 'video/webm').split(';')[0];
      if (chunks.length) enqueue({ sid: sc.sid, kind: 'screenvideo', seq: mySeq, t: t0, type: type, blob: new Blob(chunks, { type: type }) });
      if (rec === sc.rec) { sc.rec = null; if (sc.active && !sc.lost) startScreenSegment(); }
    };
    rec.start();
    sc.segDue = Date.now() + SEG_MS;
  }
  function endScreenSeg() { try { if (sc.rec && sc.rec.state !== 'inactive') sc.rec.stop(); } catch (e) {} }

  function onScreenLost(why) {
    if (!sc.active || sc.lost) return;
    sc.lost = true; sc.lostAt = Date.now();
    endScreenSeg();
    logEvent('screen_share_stopped', why || 'stopped', 0, sc.lostAt);
    showScreenOverlay(true, false);
    if (window.UI) UI.toast('Screen sharing stopped. Share your entire screen to continue the exam.', 'error', 8000);
  }
  async function regainScreen() {
    if (!sc.active || !sc.lost || sc.asking) return;
    sc.asking = true;
    try {
      var s = await grabScreen();
      if (sc.stream) sc.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      sc.stream = s; attachScreen(); bindScreenTrack();
      var now = Date.now(), gap = Math.round((now - sc.lostAt) / 1000);
      sc.lost = false; sc.everShared = true; showScreenOverlay(false);
      logEvent('screen_share_resumed', 'gap ' + new Date(sc.lostAt).toISOString() + ' to ' + new Date(now).toISOString(), gap, now);
      if (sc.modeNow === 'video') startScreenSegment(); else sc.shotDue = Date.now() + 1500;
    } catch (e) { if (window.UI) UI.toast(e.message || 'Could not start screen sharing.', 'error', 6000); }
    sc.asking = false;
  }

  function scOnVis() {
    if (!sc.active) return;
    if (document.hidden) {
      sc.hiddenAt = Date.now(); logEvent('tab_hidden', '', 0); extraShot('tab_hidden');
      if (sc.modeNow === 'video') endScreenSeg();
    } else {
      var away = sc.hiddenAt ? Math.round((Date.now() - sc.hiddenAt) / 1000) : 0; sc.hiddenAt = 0;
      logEvent('tab_visible', 'away ' + away + 's', away);
      if (sc.vid) { var p = sc.vid.play(); if (p && p.catch) p.catch(function () {}); }
    }
  }
  function scOnBlur() { if (!sc.active || sc.blurAt) return; sc.blurAt = Date.now(); logEvent('window_blur', '', 0); extraShot('window_blur'); }
  function scOnFocus() {
    if (!sc.active || !sc.blurAt) return;
    var away = Math.round((Date.now() - sc.blurAt) / 1000); sc.blurAt = 0; logEvent('window_focus', 'unfocused ' + away + 's', away);
  }
  function scOnPageHide() { if (sc.active && sc.modeNow === 'video') endScreenSeg(); }
  function scBindListeners(on) {
    var f = on ? 'addEventListener' : 'removeEventListener';
    document[f]('visibilitychange', scOnVis); window[f]('blur', scOnBlur); window[f]('focus', scOnFocus); window[f]('pagehide', scOnPageHide);
  }
  function scTick() {
    if (!sc.active) return;
    if (sc.badge) sc.badge.className = camPanelActive() ? 'bd c' : 'bd';
    var now = Date.now(), tr = sc.stream && sc.stream.getVideoTracks()[0];
    if (!sc.lost && (!tr || tr.readyState === 'ended')) onScreenLost('track ended');
    if (sc.lost) { if (sc.over && sc.over.style.display !== 'flex') showScreenOverlay(true, !sc.everShared); return; }
    if (sc.modeNow === 'video') { if (now >= sc.segDue) endScreenSeg(); }
    else if (now >= sc.shotDue) { shot(''); sc.shotDue = nextShotDue(); }
    if (sc.vid && sc.vid.paused) { var p = sc.vid.play(); if (p && p.catch) p.catch(function () {}); }
  }
  function scStartTicker() {
    scStopTicker();
    var fn = function () { scTick(); };
    try {
      var u = URL.createObjectURL(new Blob(['setInterval(function(){postMessage(1)},1000)'], { type: 'application/javascript' }));
      sc.tickWorker = new Worker(u); sc.tickWorker._url = u; sc.tickWorker.onmessage = fn;
      sc.tickWorker.onerror = function () { try { sc.tickWorker.terminate(); } catch (e) {} sc.tickWorker = null; if (!sc.ticker) sc.ticker = setInterval(fn, 1000); };
    } catch (e) { sc.tickWorker = null; }
    if (!sc.tickWorker) sc.ticker = setInterval(fn, 1000);
  }
  function scStopTicker() {
    if (sc.ticker) { clearInterval(sc.ticker); sc.ticker = null; }
    if (sc.tickWorker) { try { sc.tickWorker.terminate(); URL.revokeObjectURL(sc.tickWorker._url); } catch (e) {} sc.tickWorker = null; }
  }

  /* Start capturing. Fresh start: the stream chosen at "Begin Exam" is used. Resume after reload: no stream yet, so the blocking overlay asks for one. */
  function beginScreen(sessionId, resumed, cfgIn) {
    if (cfgIn) sc.cfg = cfgIn;
    if (!screenRequired(sc.cfg)) return null;
    if (!resumed && !sc.pending) return null;
    sc.sid = sessionId; sc.active = true; sc.lost = false; sc.everShared = false;
    sc.startMs = parseInt(String(sessionId).split('_').pop(), 10) || Date.now();
    var base = (resumed && sc.startMs) ? Math.min(15000, Math.max(1, Math.floor((Date.now() - sc.startMs) / 1000))) : 0;
    sc.shotSeq = base; sc.vidSeq = base; sc.lastExtra = 0; sc.hiddenAt = 0; sc.blurAt = 0;
    sc.mime = pickMime();
    sc.modeNow = screenModeOf(sc.cfg) === 'video' && window.MediaRecorder ? 'video' : 'shots';
    sc.shotBase = Math.max(10, Math.min(600, sc.cfg.screenIntervalSec || 30)) * 1000;
    buildScreenUi();
    scBindListeners(true);
    if (sc.pending) {
      sc.stream = sc.pending; sc.pending = null; sc.everShared = true;
      attachScreen(); bindScreenTrack();
      logEvent('screen_share_started', resumed ? 'resumed exam' : 'exam started', 0);
      if (sc.modeNow === 'video') startScreenSegment(); else sc.shotDue = Date.now() + 1500;
    } else {
      sc.lost = true; sc.lostAt = Date.now();
      logEvent('screen_share_stopped', 'exam page reopened', 0, sc.lostAt);
      showScreenOverlay(true, true);
    }
    scStartTicker();
    return sessionId;
  }
  /* Reload mid-exam on a device that cannot share a screen and the teacher chose "Block exam": permanent block, no button. */
  function blockUnsupportedOverlay(sessionId) {
    logEventFor(sessionId, 'unsupported_device_blocked', 'exam reopened on unsupported device');
    var o = document.createElement('div'); o.id = 'screenUnsupportedBlock';
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483100;background:rgba(10,10,10,.97);color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font:600 18px/1.5 system-ui,sans-serif;';
    o.textContent = 'This exam requires screen sharing, which this device cannot do. Please continue on a computer (Chrome, Edge or Firefox). Your exam timer is still running.';
    document.body.appendChild(o);
  }
  async function stopScreen() {
    if (!sc.active) { releasePendingScreen(); return; }
    scBindListeners(false); scStopTicker();
    var rec = sc.rec;
    if (!sc.lost && sc.modeNow === 'shots') shot('final');
    sc.active = false;
    if (rec && rec.state !== 'inactive') {
      await new Promise(function (res) {
        var prev = rec.onstop;
        rec.onstop = function (ev) { try { if (prev) prev.call(rec, ev); } catch (e) {} res(); };
        try { rec.stop(); } catch (e) { res(); }
        setTimeout(res, 3000);
      });
    }
    for (var i = 0; i < 4 && !queue.length; i++) await new Promise(function (r) { setTimeout(r, 100); });
    if (sc.stream) { sc.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); sc.stream = null; }
    removeScreenUi(); sc.rec = null; sc.lost = false; sc.sid = null;
    var b = document.getElementById('screenUnsupportedBlock'); if (b) b.remove();
  }
  function releaseScreen() {
    sc.active = false; scStopTicker(); scBindListeners(false); releasePendingScreen();
    if (sc.stream) sc.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
    sc.stream = null; removeScreenUi(); sc.sid = null;
  }

  /* ================= Teacher viewer ================= */
  var urls = [];
  var FLAG_TEXT = LABEL;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  async function mediaBlob(id) {
    var r = await fetch(WORKER + '/proctor/media', { method: 'POST', headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id }) });
    if (!r.ok) throw new Error('Could not load media.');
    var b = await r.blob(); var u = URL.createObjectURL(b); urls.push(u); return u;
  }
  async function openViewer(sessionId, title) {
    closeViewer();
    var ov = document.createElement('div'); ov.id = 'proctorViewer';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:8px;';
    ov.innerHTML = '<div style="background:var(--bg-base,#fff);color:var(--text-1,#111);border-radius:12px;max-width:900px;width:100%;max-height:94vh;overflow:auto;padding:12px;box-sizing:border-box;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;"><strong style="min-width:0;overflow-wrap:anywhere;">Proctoring — ' + esc(title || 'exam') + '</strong>' +
      '<button id="pxClose" class="btn" style="padding:4px 12px;flex-shrink:0;">Close</button></div><div id="pxBody">Loading…</div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#pxClose').onclick = closeViewer;
    var body = ov.querySelector('#pxBody');
    try {
      var r = await fetch(WORKER + '/proctor/list', { method: 'POST', headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' }, body: JSON.stringify({ sid: sessionId }) });
      var j = await r.json(); if (!r.ok) throw new Error(j.error || 'Failed');
      var items = j.items || [], evs = j.events || [];
      if (!items.length && !evs.length) { body.innerHTML = '<p>No recordings were saved for this exam.</p>'; return; }

      // Durations: pair "left" with the next "returned" so each event row shows how long it lasted.
      var PAIR = { tab_hidden: 'tab_visible', window_blur: 'window_focus', screen_share_stopped: 'screen_share_resumed' };
      function dur(e) {
        var want = PAIR[e.code]; if (!want) return e.code === 'tab_visible' || e.code === 'window_focus' || e.code === 'screen_share_resumed' ? e.durationSec : 0;
        for (var i = 0; i < evs.length; i++) if (evs[i].t > e.t && evs[i].code === want) return Math.max(e.durationSec || 0, Math.round((evs[i].t - e.t) / 1000));
        return 0;
      }
      var entries = [];
      items.forEach(function (it) {
        var grp = it.kind === 'flag' ? 'events' : (it.kind === 'screen' || it.kind === 'screenvideo') ? 'screen' : 'camera';
        entries.push({ t: it.t, grp: grp, item: it });
      });
      evs.forEach(function (e) { entries.push({ t: e.t, grp: 'events', ev: e }); });
      entries.sort(function (a, b) { return a.t - b.t; });
      var counts = { all: entries.length, camera: 0, screen: 0, events: 0 };
      entries.forEach(function (e) { counts[e.grp]++; });
      var TABS = [['all', 'All'], ['camera', 'Camera'], ['screen', 'Screen'], ['events', 'Events']];
      var cur = 'all', onlyFlagged = false;

      body.innerHTML = '<div id="pxTabs" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;"></div>' +
        '<label id="pxOnlyWrap" style="font-size:12px;display:none;margin-bottom:8px;"><input type="checkbox" id="pxOnly"> Show only flagged photos</label>' +
        '<div id="pxGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;"></div>';
      var tabs = body.querySelector('#pxTabs'), grid = body.querySelector('#pxGrid'), onlyWrap = body.querySelector('#pxOnlyWrap'), only = body.querySelector('#pxOnly');
      only.onchange = function () { onlyFlagged = only.checked; draw(); };

      function fmtDur(s) { return s >= 60 ? Math.floor(s / 60) + ' min ' + (s % 60) + ' s' : s + ' s'; }
      function eventRow(e) {
        var d = document.createElement('div');
        var bad = e.code === 'screen_share_stopped' || e.code === 'tab_hidden' || e.code === 'camera_stopped' || e.code === 'unsupported_device_blocked' || e.code === 'window_blur';
        d.style.cssText = 'grid-column:1/-1;border:1px solid ' + (bad ? '#f59e0b' : 'var(--border,#ddd)') + ';background:' + (bad ? 'rgba(245,158,11,.14)' : 'transparent') + ';border-radius:8px;padding:6px 8px;font-size:12px;overflow-wrap:anywhere;';
        var du = dur(e);
        d.innerHTML = (bad ? '⚠ ' : '• ') + '<strong>' + esc(SCREEN_LABEL[e.code] || e.code) + '</strong> · ' + esc(new Date(e.t).toLocaleTimeString()) +
          (du ? ' · lasted ' + esc(fmtDur(du)) : '') + (e.detail && e.code !== 'screen_share_resumed' ? ' <span style="opacity:.7">(' + esc(e.detail) + ')</span>' : '');
        return d;
      }
      function flagRow(it) {
        var d = document.createElement('div');
        d.style.cssText = 'grid-column:1/-1;border:1px solid #ef4444;background:rgba(239,68,68,.08);border-radius:8px;padding:6px 8px;font-size:12px;overflow-wrap:anywhere;';
        d.innerHTML = '⚠ <strong>' + esc(FLAG_TEXT[it.note] || it.note || 'Event') + '</strong> · ' + esc(new Date(it.t).toLocaleTimeString()) + ' <span style="opacity:.7">(camera)</span>';
        return d;
      }
      var KIND_LABEL = { photo: '📷 Camera photo', video: '🎥 Camera video', screen: '🖥 Screenshot', screenvideo: '🖥 Screen video' };
      function mediaCell(it) {
        var cell = document.createElement('div'), isVid = it.kind === 'video' || it.kind === 'screenvideo';
        var noteTxt = it.note ? (FLAG_TEXT[it.note] || SCREEN_LABEL[it.note] || it.note) : '';
        cell.style.cssText = 'border:1px solid ' + (it.note ? '#ef4444' : 'var(--border,#ddd)') + ';border-radius:8px;padding:6px;font-size:12px;';
        var when = new Date(it.t).toLocaleTimeString();
        var tag = it.note ? '<div style="color:#ef4444;font-weight:700;margin-bottom:4px;overflow-wrap:anywhere;">⚠ ' + esc(noteTxt) + '</div>' : '';
        var head = '<div style="margin-bottom:4px;">' + (KIND_LABEL[it.kind] || it.kind) + ' · ' + esc(when) + '</div>';
        cell.innerHTML = tag + head + '<button class="btn" style="width:100%;padding:4px;">Load</button>';
        cell.querySelector('button').onclick = async function () {
          this.textContent = 'Loading…';
          try {
            var u = await mediaBlob(it.id);
            if (it.kind === 'screen' || it.kind === 'screenvideo') cell.style.gridColumn = '1/-1';
            cell.innerHTML = tag + head + (isVid ? '<video controls playsinline src="' + u + '" style="width:100%;border-radius:6px;"></video>'
              : '<img src="' + u + '" style="width:100%;border-radius:6px;" alt="Captured image">');
          } catch (e) { this.textContent = 'Failed — retry'; }
        };
        return cell;
      }
      function draw() {
        tabs.innerHTML = '';
        TABS.forEach(function (tb) {
          var b = document.createElement('button'); b.className = 'btn'; b.type = 'button';
          b.style.cssText = 'padding:4px 10px;font-size:12px;' + (cur === tb[0] ? 'font-weight:700;outline:2px solid var(--accent,#4f6ef7);' : '');
          b.textContent = tb[1] + ' (' + counts[tb[0]] + ')';
          b.onclick = function () { cur = tb[0]; draw(); };
          tabs.appendChild(b);
        });
        var nFlag = entries.filter(function (e) { return e.item && e.grp === 'camera' && e.item.note; }).length;
        onlyWrap.style.display = (nFlag && (cur === 'all' || cur === 'camera')) ? 'block' : 'none';
        grid.innerHTML = '';
        var shown = 0;
        entries.forEach(function (e) {
          if (cur !== 'all' && e.grp !== cur) return;
          if (onlyFlagged && e.grp === 'camera' && !(e.item && e.item.note)) return;
          if (e.ev) grid.appendChild(eventRow(e.ev));
          else if (e.item.kind === 'flag') grid.appendChild(flagRow(e.item));
          else grid.appendChild(mediaCell(e.item));
          shown++;
        });
        if (!shown) grid.innerHTML = '<p style="grid-column:1/-1;font-size:12px;opacity:.75;">Nothing in this view.</p>';
      }
      draw();
    } catch (e) { body.innerHTML = '<p style="color:var(--danger,#c00)">' + esc(e.message) + '</p>'; }
  }
  function closeViewer() {
    var o = document.getElementById('proctorViewer'); if (o) o.remove();
    urls.forEach(function (u) { URL.revokeObjectURL(u); }); urls = [];
  }

  window.Proctor = { screenRequired: screenRequired, screenModeOf: screenModeOf, screenSupported: screenSupported, screenFallbackCamera: screenFallbackCamera,
    effectiveConfig: effectiveConfig, consentHtml: consentHtml, prepareScreen: prepareScreen, beginScreen: beginScreen, releasePendingScreen: releasePendingScreen,
    logEventFor: logEventFor, blockUnsupportedOverlay: blockUnsupportedOverlay, _test: { screenState: function () { return { active: sc.active, lost: sc.lost, overlay: !!(sc.over && sc.over.style.display === 'flex'), shotSeq: sc.shotSeq, vidSeq: sc.vidSeq, mode: sc.modeNow }; }, overlayButtonRect: function () { var b = sc.over && sc.over.querySelector('button'); if (!b) return null; var r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, poseOf: poseOf, judge: judge, state: function () { return lmState; } }, required: required, modeOf: modeOf, prepare: prepare, begin: begin, stop: stop, release: release, openViewer: openViewer };
})();
