/* ============================================================
   avatar.js — optional profile pictures (stored in B2 via Worker)

   * Anything with  data-vtx-av="<uid>"  is upgraded to that student's
     photo if one exists; otherwise the letter avatar stays untouched.
   * VtxAvatar.pick()  opens: choose photo -> drag/zoom crop screen ->
     save. Resolves 'saved' | 'cancelled'.
   * Photos are fetched once, kept as in-memory blobs, served by the Worker
     with immutable cache headers and cached again by the service worker.
   ============================================================ */
(function () {
  'use strict';
  var WORKER_URL = 'https://vertex-worker.gbemigaakinde.workers.dev';
  var OUT = 400;                          // saved size (px): sharp when a teacher zooms in, still ~30-50 KB
  var MISS_TTL = 5 * 60 * 1000;           // re-check "no photo" after 5 min
  var missing = {}, loaded = {}, blobs = {}, pending = {}, ver = {};
  try { ver = JSON.parse(localStorage.getItem('vtxAvVer') || '{}'); } catch (e) {}

  function validUid(u) { return /^(g:)?[A-Za-z0-9_-]{6,128}$/.test(u || ''); }
  // id of an element: a student uid, or 'g:<groupId>' for a group icon
  function elId(el) { var g = el.getAttribute('data-vtx-gav'); return g ? 'g:' + g : el.getAttribute('data-vtx-av'); }
  function isMissing(uid) { return missing[uid] && Date.now() - missing[uid] < MISS_TTL; }
  function url(uid) {
    var path = uid.indexOf('g:') === 0 ? 'g/' + encodeURIComponent(uid.slice(2)) : encodeURIComponent(uid);
    return WORKER_URL + '/avatar/' + path + (ver[uid] ? '?v=' + ver[uid] : '');
  }
  function key(uid) { return uid + '|' + (ver[uid] || ''); }
  function myUid() { return window.AppState && AppState.userId; }
  function isTeacher() { return !!(window.AppState && AppState.isTeacher); }
  function signedIn() { return !!(window.fbAuth && window.fbAuth.currentUser) || !!myUid(); }
  // target: undefined = my own photo | 'groupId' string = group icon | {uid} = another student (teacher only)
  function target(t) {
    if (!t) { var m = myUid(); return { id: m, base: '/avatar/', kind: 'self' }; }
    if (typeof t === 'object' && t.uid) return { id: t.uid, base: '/avatar/u/' + encodeURIComponent(t.uid) + '/', kind: 'student' };
    if (typeof t === 'object' && t.gid) t = t.gid;
    return { id: 'g:' + t, base: '/avatar/g/' + encodeURIComponent(t) + '/', kind: 'group' };
  }
  function emit() { try { document.dispatchEvent(new CustomEvent('vtx-avatar-change')); } catch (e) {} }

  /* ───────── show / hide the photo on an element ───────── */
  function show(el, src) {
    var old = el.querySelector('img.vtx-av-img');
    if (old) { if (old.src === src) return; old.remove(); }
    if (el.getAttribute('data-vtx-av-orig') === null) el.setAttribute('data-vtx-av-orig', (el.style.color || '') + '|' + (el.style.overflow || ''));
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.style.overflow = 'hidden';
    el.style.color = 'transparent';                       // hides the letter underneath
    var img = document.createElement('img');
    img.className = 'vtx-av-img'; img.alt = ''; img.draggable = false; img.src = src;
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;';
    el.appendChild(img);
  }
  function restore(el) {
    var i = el.querySelector('img.vtx-av-img'); if (i) i.remove();
    var o = el.getAttribute('data-vtx-av-orig');
    if (o !== null) { var a = o.split('|'); el.style.color = a[0]; el.style.overflow = a[1] || ''; el.removeAttribute('data-vtx-av-orig'); }
    el.removeAttribute('data-vtx-av-done');
  }
  function mine(uid) {
    return Array.prototype.filter.call(document.querySelectorAll('[data-vtx-av],[data-vtx-gav]'), function (el) { return elId(el) === uid; });
  }

  /* ───────── load a student's photo (once) ───────── */
  function getBlobUrl(uid) {
    var k = key(uid);
    if (blobs[k]) return Promise.resolve(blobs[k]);
    if (pending[k]) return pending[k];
    pending[k] = fetch(url(uid)).then(function (r) {
      var ct = (r.headers && r.headers.get && r.headers.get('Content-Type')) || '';
      if (!r.ok || (ct && ct.indexOf('image/') !== 0)) { missing[uid] = Date.now(); return null; }
      return r.blob().then(function (b) {
        if (!b || !b.size || (b.type && b.type.indexOf('image/') !== 0)) { missing[uid] = Date.now(); return null; }
        blobs[k] = URL.createObjectURL(b); return blobs[k];
      });
    }).catch(function () { missing[uid] = Date.now(); return null; })
      .then(function (u) { delete pending[k]; return u; });
    return pending[k];
  }

  function apply(el) {
    var uid = elId(el);
    if (!validUid(uid)) return;
    var k = key(uid);
    if (el.getAttribute('data-vtx-av-done') === k) return;
    if (blobs[k]) { el.setAttribute('data-vtx-av-done', k); show(el, blobs[k]); return; }   // instant, no flicker
    if (isMissing(uid)) return;
    el.setAttribute('data-vtx-av-done', k);
    getBlobUrl(uid).then(function (u) {
      if (!u) { if (el.getAttribute('data-vtx-av-done') === k) el.removeAttribute('data-vtx-av-done'); return; }
      if (el.getAttribute('data-vtx-av-done') !== k || !el.isConnected) return;
      var first = !loaded[uid]; loaded[uid] = true;
      show(el, u);
      if (first && (uid === myUid() || uid.indexOf('g:') === 0)) emit();
    });
  }

  function scan(root) {
    if (isTeacher() && document.body) document.body.classList.add('vtx-teacher');
     (root || document).querySelectorAll('[data-vtx-av],[data-vtx-gav]').forEach(apply); }
  var t = null;
  new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 60); })
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', function () { scan(); });

  /* ───────── server calls ───────── */
  async function token() {
    var u = window.fbAuth && window.fbAuth.currentUser;
    if (!u) throw new Error('Please sign in again.');
    return u.getIdToken();
  }

  // blob must already be a small JPEG (the cropper produces it)
  async function upload(blob, t) {
    if (!signedIn()) throw new Error('Not signed in.');
    var T = target(t), uid = T.id; if (!uid) throw new Error('Not signed in.');
    var base = WORKER_URL + T.base;
    if (navigator.onLine === false) throw new Error('You are offline. Try again when you are connected.');
    var res = await fetch(base + 'upload', {
      method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'Authorization': 'Bearer ' + (await token()) }, body: blob
    });
    if (!res.ok) { var d = await res.json().catch(function () { return {}; }); throw new Error(d.error || 'Upload failed (' + res.status + ').'); }
    // show it everywhere straight away from the copy we already have
    ver[uid] = String(Date.now()); delete missing[uid]; loaded[uid] = true;
    blobs[key(uid)] = URL.createObjectURL(blob);
    try { localStorage.setItem('vtxAvVer', JSON.stringify(ver)); } catch (e) {}
    mine(uid).forEach(function (el) { restore(el); apply(el); });
    emit();
    // Confirm the stored copy can be read back. The URL carries a fresh ?v=, so it is
    // never stale; we deliberately do NOT use cache:'no-store' because iOS Safari then adds
    // Pragma/Cache-Control request headers, which forces a CORS preflight the Worker rejects.
    // Only a definite server error is reported; a flaky connection is not the student's problem
    // (the upload already succeeded and the photo is showing).
    try {
      var chk = await fetch(url(uid));
      var cct = (chk.headers && chk.headers.get && chk.headers.get('Content-Type')) || '';
      if (chk.ok && cct && cct.indexOf('image/') !== 0) return { warn: 'Saved, but the server did not return an image. Please tell your teacher.' };
      if (!chk.ok && chk.status >= 500) return { warn: 'Saved, but the server had trouble (HTTP ' + chk.status + '). Please try again if it does not show for others.' };
      if (!chk.ok) return { warn: 'Saved, but it could not be read back (HTTP ' + chk.status + ').' };
    } catch (e) { /* network hiccup on a check only: ignore */ }
    return {};
  }

  async function remove(t) {
    if (!signedIn()) throw new Error('Not signed in.');
    var T = target(t), uid = T.id; if (!uid) throw new Error('Not signed in.');
    var gid = T.kind === 'group';
    var res = await fetch(WORKER_URL + T.base + 'delete', { method: 'POST', headers: { 'Authorization': 'Bearer ' + (await token()) } });
    if (!res.ok) throw new Error(gid ? 'Could not remove the group icon. Try again.' : T.kind === 'student' ? 'Could not remove the photo. Try again.' : 'Could not remove your photo. Try again.');
    missing[uid] = Date.now(); loaded[uid] = false; delete ver[uid];
    Object.keys(blobs).forEach(function (k) { if (k.indexOf(uid + '|') === 0) delete blobs[k]; });   // drop every in-memory copy
    try { localStorage.setItem('vtxAvVer', JSON.stringify(ver)); } catch (e) {}
    mine(uid).forEach(restore);
    try { caches.keys().then(function (ks) { ks.forEach(function (k) { if (k.indexOf('avatar') === 0) caches.delete(k); }); }); } catch (e) {}
    emit();
  }

  /* ───────── crop maths (pure, testable) ───────── */
  // image w×h, viewport V, zoom z>=1, centre (cx,cy) in image px -> clamped state
  function cropState(w, h, V, z, cx, cy) {
    var s0 = V / Math.min(w, h);
    z = Math.max(1, Math.min(4, z));
    var s = s0 * z, half = V / (2 * s);
    cx = Math.max(half, Math.min(w - half, cx));
    cy = Math.max(half, Math.min(h - half, cy));
    return { s: s, z: z, cx: cx, cy: cy, half: half };
  }

  /* ───────── crop screen ───────── */
  function injectCss() {
    if (document.getElementById('vtxAvCss')) return;
    var st = document.createElement('style'); st.id = 'vtxAvCss';
    st.textContent =
      '.vac{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;font-family:var(--font,inherit)}' +
      '@media(min-width:640px){.vac{align-items:center}}' +
      '.vac-sheet{width:100%;max-width:420px;background:var(--bg-base,#fff);color:var(--text-1,#111);border-radius:20px 20px 0 0;padding:1.125rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom,0px));box-sizing:border-box;max-height:96vh;overflow:auto}' +
      '@media(min-width:640px){.vac-sheet{border-radius:20px}}' +
      '.vac-t{margin:0;font-size:1.0625rem;font-weight:700;text-align:center}' +
      '.vac-s{margin:.25rem 0 1rem;font-size:.8125rem;color:var(--text-3,#6b7280);text-align:center}' +
      '.vac-vp{position:relative;margin:0 auto;border-radius:50%;overflow:hidden;background:#111;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;box-shadow:0 0 0 3px var(--accent,#4f6ef7)}' +
      '.vac-vp:active{cursor:grabbing}' +
      '.vac-vp img{position:absolute;left:0;top:0;max-width:none;transform-origin:0 0;pointer-events:none;-webkit-user-drag:none}' +
      '.vac-zoom{display:flex;align-items:center;gap:.75rem;margin:1.125rem auto .25rem;max-width:280px;color:var(--text-3,#6b7280)}' +
      '.vac-zoom input{flex:1;accent-color:var(--accent,#4f6ef7);min-height:32px}' +
      '.vac-err{margin:.75rem 0 0;font-size:.8125rem;color:var(--danger,#dc2626);text-align:center;min-height:1em}' +
      '.vac-row{display:flex;gap:.625rem;margin-top:.875rem}' +
      '.vac-btn{flex:1;min-height:48px;border-radius:12px;border:1px solid var(--border,#e5e7eb);background:var(--bg-base,#fff);color:var(--text-1,#111);font:inherit;font-weight:600;font-size:.9375rem;cursor:pointer}' +
      '.vac-btn.pri{background:var(--accent,#4f6ef7);border-color:var(--accent,#4f6ef7);color:#fff}' +
      '.vac-btn:disabled{opacity:.6;cursor:default}' +
      '.vac-btn:focus-visible,.vac-zoom input:focus-visible{outline:2px solid var(--accent,#4f6ef7);outline-offset:2px}';
    document.head.appendChild(st);
  }

  function chooseFile() {
    return new Promise(function (resolve) {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.style.display = 'none';
      var done = false;
      inp.onchange = function () { done = true; var f = inp.files && inp.files[0]; inp.remove(); resolve(f || null); };
      window.addEventListener('focus', function once() {   // picker dismissed without choosing
        window.removeEventListener('focus', once);
        setTimeout(function () { if (!done) { inp.remove(); resolve(null); } }, 1200);
      });
      document.body.appendChild(inp); inp.click();
    });
  }

  function openCropper(file, tgt) {
      var gid = tgt && typeof tgt === 'string';
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type || 'image/')) return reject(new Error('Please choose a photo (JPG, PNG or WebP).'));
      if (file.size > 25 * 1024 * 1024) return reject(new Error('That photo is too large (max 25 MB).'));
      injectCss();
      var srcUrl = URL.createObjectURL(file), img = new Image();
      img.onerror = function () { URL.revokeObjectURL(srcUrl); reject(new Error('We could not open that photo. Try a JPG or PNG.')); };
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) return img.onerror();
        var V = Math.max(200, Math.min(280, window.innerWidth - 80));
        var st = cropState(w, h, V, 1, w / 2, h / 2);
        var ov = document.createElement('div'); ov.className = 'vac';
        ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Adjust your photo');
        ov.innerHTML =
          '<div class="vac-sheet"><h2 class="vac-t">' + (gid ? 'Adjust group icon' : 'Adjust your photo') + '</h2>' +
          '<p class="vac-s">Drag to move. Pinch or use the slider to zoom.</p>' +
          '<div class="vac-vp" style="width:' + V + 'px;height:' + V + 'px"></div>' +
          '<label class="vac-zoom"><i class="ph ph-image" aria-hidden="true"></i>' +
          '<input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom"><i class="ph ph-image" style="font-size:1.4rem" aria-hidden="true"></i></label>' +
          '<p class="vac-err" role="alert"></p>' +
          '<div class="vac-row"><button type="button" class="vac-btn" data-c="cancel">Cancel</button>' +
          '<button type="button" class="vac-btn pri" data-c="save">Save photo</button></div></div>';
        var vp = ov.querySelector('.vac-vp'), range = ov.querySelector('input'), err = ov.querySelector('.vac-err');
        var save = ov.querySelector('[data-c=save]'), cancel = ov.querySelector('[data-c=cancel]');
        img.alt = ''; img.draggable = false; vp.appendChild(img);

        function paint() {
          img.style.width = (w * st.s) + 'px'; img.style.height = (h * st.s) + 'px';
          img.style.transform = 'translate(' + (V / 2 - st.cx * st.s) + 'px,' + (V / 2 - st.cy * st.s) + 'px)';
          range.value = st.z;
        }
        paint();

        // drag + pinch with pointer events
        var ptrs = {}, lastDist = 0;
        function dist() { var k = Object.keys(ptrs); if (k.length < 2) return 0; var a = ptrs[k[0]], b = ptrs[k[1]]; return Math.hypot(a.x - b.x, a.y - b.y); }
        vp.addEventListener('pointerdown', function (e) { try { vp.setPointerCapture(e.pointerId); } catch (x) {} ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; lastDist = dist(); });
        vp.addEventListener('pointermove', function (e) {
          var p = ptrs[e.pointerId]; if (!p) return;
          var n = Object.keys(ptrs).length;
          if (n >= 2) {
            ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
            var d = dist(); if (lastDist && d) st = cropState(w, h, V, st.z * (d / lastDist), st.cx, st.cy);
            lastDist = d;
          } else {
            st = cropState(w, h, V, st.z, st.cx - (e.clientX - p.x) / st.s, st.cy - (e.clientY - p.y) / st.s);
            ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
          }
          paint();
        });
        function up(e) { delete ptrs[e.pointerId]; lastDist = 0; }
        vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up);
        vp.addEventListener('wheel', function (e) { e.preventDefault(); st = cropState(w, h, V, st.z * (e.deltaY < 0 ? 1.08 : 0.926), st.cx, st.cy); paint(); }, { passive: false });
        range.addEventListener('input', function () { st = cropState(w, h, V, parseFloat(range.value), st.cx, st.cy); paint(); });

        var busy = false;
        function close(result, error) {
          document.removeEventListener('keydown', onKey);
          ov.remove(); URL.revokeObjectURL(srcUrl);
          error ? reject(error) : resolve(result);
        }
        function onKey(e) { if (e.key === 'Escape' && !busy) close('cancelled'); }
        document.addEventListener('keydown', onKey);
        cancel.addEventListener('click', function () { if (!busy) close('cancelled'); });
        ov.addEventListener('click', function (e) { if (e.target === ov && !busy) close('cancelled'); });
        save.addEventListener('click', function () {
          if (busy) return; busy = true; err.textContent = '';
          save.disabled = cancel.disabled = true; save.textContent = 'Saving…';
          var c = document.createElement('canvas'); c.width = c.height = OUT;
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, OUT, OUT);
          g.drawImage(img, st.cx - st.half, st.cy - st.half, st.half * 2, st.half * 2, 0, 0, OUT, OUT);
          c.toBlob(function (blob) {
            if (!blob) { busy = false; save.disabled = cancel.disabled = false; save.textContent = 'Save photo'; err.textContent = 'Could not process that photo.'; return; }
            upload(blob, tgt).then(function (r) { close(r && r.warn ? { warn: r.warn } : 'saved'); })
              .catch(function (e2) { busy = false; save.disabled = cancel.disabled = false; save.textContent = 'Try again'; err.textContent = e2.message || 'Upload failed.'; });
          }, 'image/jpeg', 0.86);
        });
        document.body.appendChild(ov);
        save.focus();
      };
      img.src = srcUrl;
    });
  }


  /* ───────── full-screen viewer (teacher): zoom, change, remove ───────── */
  function injectViewCss() {
    if (document.getElementById('vtxAvViewCss')) return;
    var st = document.createElement('style'); st.id = 'vtxAvViewCss';
    st.textContent =
      'body.vtx-teacher [data-vtx-av],body.vtx-teacher [data-vtx-gav]{cursor:zoom-in}' +
      '.vav{position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.92);display:flex;flex-direction:column;color:#fff;font-family:var(--font,inherit);touch-action:none}' +
      '.vav-top{display:flex;align-items:center;justify-content:space-between;padding:calc(.75rem + env(safe-area-inset-top,0px)) 1rem .75rem}' +
      '.vav-t{font-size:1rem;font-weight:700;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.vav-x{width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:1.25rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
      '.vav-stage{flex:1;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none}' +
      '.vav-stage img{max-width:100%;max-height:100%;object-fit:contain;transform-origin:50% 50%;will-change:transform;pointer-events:none;-webkit-user-drag:none;border-radius:6px}' +
      '.vav-letter{width:min(70vw,320px);height:min(70vw,320px);border-radius:50%;background:var(--accent-subtle,#eaf0ff);color:var(--accent-text,#2d49d6);display:flex;align-items:center;justify-content:center;font-size:7rem;font-weight:700}' +
      '.vav-hint{text-align:center;font-size:.8125rem;color:rgba(255,255,255,.7);padding:.25rem 1rem 0;min-height:1.2em}' +
      '.vav-bar{display:flex;gap:.625rem;padding:.75rem 1rem calc(1rem + env(safe-area-inset-bottom,0px))}' +
      '.vav-btn{flex:1;min-height:48px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;font:inherit;font-weight:600;font-size:.9375rem;cursor:pointer}' +
      '.vav-btn.pri{background:var(--accent,#4f6ef7);border-color:var(--accent,#4f6ef7)}' +
      '.vav-btn.dng{color:#ff8a80}' +
      '.vav-btn:disabled{opacity:.55}' +
      '.vav-btn:focus-visible,.vav-x:focus-visible{outline:2px solid #fff;outline-offset:2px}';
    document.head.appendChild(st);
  }

  // t: same target as pick(); label: heading; letter: shown when there is no photo
  function openViewer(t, label, letter) {
    if (document.querySelector('.vav')) return;
    injectViewCss();
    var T = target(t), id = T.id, canEdit = isTeacher();
    var ov = document.createElement('div'); ov.className = 'vav';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', label || 'Photo');
    ov.innerHTML =
      '<div class="vav-top"><p class="vav-t"></p><button type="button" class="vav-x" aria-label="Close"><i class="ph ph-x"></i></button></div>' +
      '<div class="vav-stage"></div><p class="vav-hint"></p>' +
      (canEdit ? '<div class="vav-bar"><button type="button" class="vav-btn pri" data-v="change"></button><button type="button" class="vav-btn dng" data-v="remove" hidden>Remove</button></div>' : '<div class="vav-bar" style="padding-top:0"></div>');
    ov.querySelector('.vav-t').textContent = label || (T.kind === 'group' ? 'Group icon' : 'Profile photo');
    var stage = ov.querySelector('.vav-stage'), hint = ov.querySelector('.vav-hint');
    var chg = ov.querySelector('[data-v=change]'), rm = ov.querySelector('[data-v=remove]');
    var z = 1, tx = 0, ty = 0, img = null;

    function paint() { if (img) img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + z + ')'; }
    function clamp() {
      if (!img) return;
      z = Math.max(1, Math.min(6, z));
      var mx = Math.max(0, (img.offsetWidth * z - stage.clientWidth) / 2), my = Math.max(0, (img.offsetHeight * z - stage.clientHeight) / 2);
      tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty));
      if (z === 1) { tx = 0; ty = 0; }
    }
    function render() {
      var k = key(id), src = blobs[k];
      stage.innerHTML = ''; img = null; z = 1; tx = ty = 0;
      if (src) {
        img = document.createElement('img'); img.alt = label || 'Photo'; img.draggable = false; img.src = src; stage.appendChild(img);
        hint.textContent = 'Pinch, double-tap or scroll to zoom. Drag to move.';
      } else {
        var l = document.createElement('div'); l.className = 'vav-letter'; l.textContent = (letter || '?'); stage.appendChild(l);
        hint.textContent = canEdit ? 'No photo yet.' : '';
      }
      if (chg) { chg.textContent = src ? 'Change photo' : 'Add photo'; rm.hidden = !src; }
    }
    function show() { render(); }
    // make sure the photo is loaded (may be opened on a letter avatar that never fetched)
    if (blobs[key(id)]) show(); else { render(); getBlobUrl(id).then(function (u) { if (u && ov.isConnected) show(); }); }

    // zoom / pan with pointer events
    var ptrs = {}, last = 0, lastTap = 0;
    function dist() { var k = Object.keys(ptrs); if (k.length < 2) return 0; var p = ptrs[k[0]], q = ptrs[k[1]]; return Math.hypot(p.x - q.x, p.y - q.y); }
    stage.addEventListener('pointerdown', function (e) {
      try { stage.setPointerCapture(e.pointerId); } catch (x) {}
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; last = dist();
      var now = Date.now();
      if (Object.keys(ptrs).length === 1 && img) { if (now - lastTap < 300) { z = z > 1 ? 1 : 2.5; clamp(); paint(); } lastTap = now; }
    });
    stage.addEventListener('pointermove', function (e) {
      var p = ptrs[e.pointerId]; if (!p || !img) return;
      if (Object.keys(ptrs).length >= 2) {
        ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
        var d = dist(); if (last && d) z *= d / last; last = d;
      } else { tx += e.clientX - p.x; ty += e.clientY - p.y; ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; }
      clamp(); paint();
    });
    function up(e) { delete ptrs[e.pointerId]; last = 0; }
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', function (e) { if (!img) return; e.preventDefault(); z *= e.deltaY < 0 ? 1.12 : 0.89; clamp(); paint(); }, { passive: false });
    stage.addEventListener('click', function (e) { if (e.target === stage && z === 1) close(); });

    function close() { document.removeEventListener('keydown', onKey); document.removeEventListener('vtx-avatar-change', onChange); ov.remove(); }
    function onKey(e) { if (e.key === 'Escape' && !document.querySelector('.vac')) close(); }
    function onChange() { if (ov.isConnected) show(); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('vtx-avatar-change', onChange);
    ov.querySelector('.vav-x').addEventListener('click', close);

    var busy = false;
    if (chg) chg.addEventListener('click', async function () {
      if (busy) return; busy = true;
      try {
        var r = await pick(T.kind === 'group' ? T.id.slice(2) : { uid: T.id });
        if (r === 'saved') hint.textContent = 'Photo updated.'; else if (r && r.warn) hint.textContent = r.warn;
      } catch (e) { hint.textContent = e.message || 'Could not update the photo.'; }
      busy = false; show();
    });
    if (rm) rm.addEventListener('click', async function () {
      if (busy) return;
      if (rm.getAttribute('data-confirm') !== '1') {
        rm.setAttribute('data-confirm', '1'); rm.textContent = 'Tap again to remove';
        setTimeout(function () { if (rm.isConnected) { rm.removeAttribute('data-confirm'); rm.textContent = 'Remove'; } }, 3000);
        return;
      }
      busy = true; rm.disabled = true;
      try { await remove(T.kind === 'group' ? T.id.slice(2) : { uid: T.id }); hint.textContent = 'Photo removed.'; }
      catch (e) { hint.textContent = e.message || 'Could not remove the photo.'; }
      rm.disabled = false; rm.removeAttribute('data-confirm'); rm.textContent = 'Remove'; busy = false; show();
    });
    document.body.appendChild(ov);
    (chg || ov.querySelector('.vav-x')).focus();
  }

  // Teachers: tap any student photo / group icon anywhere in the app to open the viewer.
  document.addEventListener('click', function (e) {
    if (!isTeacher()) return;
    var el = e.target && e.target.closest && e.target.closest('[data-vtx-av],[data-vtx-gav]');
    if (!el || el.closest('.vav,.vac,.vs-avbtn')) return;
    var gid = el.getAttribute('data-vtx-gav'), uid = el.getAttribute('data-vtx-av');
    var id = gid ? 'g:' + gid : uid;
    if (!validUid(id)) return;
    e.preventDefault(); e.stopPropagation();
    var row = el.closest('[data-name]');
    var name = (row && row.getAttribute('data-name')) || '';
    var letter = (el.textContent || name || '?').trim().charAt(0).toUpperCase() || '?';
    openViewer(gid ? gid : { uid: uid }, name || (gid ? 'Group icon' : 'Profile photo'), letter);
  }, true);

  // Full flow: choose -> crop -> save.  Resolves 'saved' | 'cancelled' | {warn}
  async function pick(t) {
    if (!signedIn()) throw new Error('Please sign in again.');
    var f = await chooseFile();
    if (!f) return 'cancelled';
    return openCropper(f, t);
  }

  window.VtxAvatar = {
    url: url, scan: scan, pick: pick, view: openViewer, upload: upload, remove: remove,
    has: function (uid) { return !!loaded[uid]; },
    hasGroup: function (gid) { return !!loaded['g:' + gid]; }, _cropState: cropState
  };
})();
