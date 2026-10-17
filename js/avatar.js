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
  var OUT = 256;                          // saved size (px)
  var MISS_TTL = 5 * 60 * 1000;           // re-check "no photo" after 5 min
  var missing = {}, loaded = {}, blobs = {}, pending = {}, ver = {};
  try { ver = JSON.parse(localStorage.getItem('vtxAvVer') || '{}'); } catch (e) {}

  function validUid(u) { return /^[A-Za-z0-9_-]{6,128}$/.test(u || ''); }
  function isMissing(uid) { return missing[uid] && Date.now() - missing[uid] < MISS_TTL; }
  function url(uid) { return WORKER_URL + '/avatar/' + encodeURIComponent(uid) + (ver[uid] ? '?v=' + ver[uid] : ''); }
  function key(uid) { return uid + '|' + (ver[uid] || ''); }
  function myUid() { return window.AppState && AppState.userId; }
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
    return Array.prototype.filter.call(document.querySelectorAll('[data-vtx-av]'), function (el) { return el.getAttribute('data-vtx-av') === uid; });
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
    var uid = el.getAttribute('data-vtx-av');
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
      if (first && uid === myUid()) emit();
    });
  }

  function scan(root) { (root || document).querySelectorAll('[data-vtx-av]').forEach(apply); }
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
  async function upload(blob) {
    var uid = myUid(); if (!uid) throw new Error('Not signed in.');
    if (navigator.onLine === false) throw new Error('You are offline. Try again when you are connected.');
    var res = await fetch(WORKER_URL + '/avatar/upload', {
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

  async function remove() {
    var uid = myUid(); if (!uid) throw new Error('Not signed in.');
    var res = await fetch(WORKER_URL + '/avatar/delete', { method: 'POST', headers: { 'Authorization': 'Bearer ' + (await token()) } });
    if (!res.ok) throw new Error('Could not remove your photo. Try again.');
    missing[uid] = Date.now(); loaded[uid] = false; delete ver[uid];
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

  function openCropper(file) {
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
          '<div class="vac-sheet"><h2 class="vac-t">Adjust your photo</h2>' +
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
            upload(blob).then(function (r) { close(r && r.warn ? { warn: r.warn } : 'saved'); })
              .catch(function (e2) { busy = false; save.disabled = cancel.disabled = false; save.textContent = 'Try again'; err.textContent = e2.message || 'Upload failed.'; });
          }, 'image/jpeg', 0.86);
        });
        document.body.appendChild(ov);
        save.focus();
      };
      img.src = srcUrl;
    });
  }

  // Full flow: choose -> crop -> save.  Resolves 'saved' | 'cancelled' | {warn}
  async function pick() {
    if (!myUid()) throw new Error('Please sign in again.');
    var f = await chooseFile();
    if (!f) return 'cancelled';
    return openCropper(f);
  }

  window.VtxAvatar = {
    url: url, scan: scan, pick: pick, upload: upload, remove: remove,
    has: function (uid) { return !!loaded[uid]; }, _cropState: cropState
  };
})();
