/* ============================================================
   avatar.js — optional profile pictures (stored in B2 via Worker)
   Anything with  data-vtx-av="<uid>"  is upgraded to the student's
   photo if one exists; otherwise the letter avatar stays untouched.
   Photos are served by the Worker with immutable cache headers and
   cached again by the service worker, so they load instantly.
   ============================================================ */
(function () {
  'use strict';
  var WORKER_URL = 'https://vertex-worker.gbemigaakinde.workers.dev';
  var missing = {};            // uid -> time we last learned there's no photo
  var MISS_TTL = 5 * 60 * 1000; // re-check after 5 min (covers transient errors + new uploads)
  function isMissing(uid) { return missing[uid] && Date.now() - missing[uid] < MISS_TTL; }
  function validUid(u) { return /^[A-Za-z0-9_-]{6,128}$/.test(u || ''); }
  var ver = {};                // uid -> cache-busting version (own uploads)
  try { ver = JSON.parse(localStorage.getItem('vtxAvVer') || '{}'); } catch (e) {}

  function url(uid) { return WORKER_URL + '/avatar/' + encodeURIComponent(uid) + (ver[uid] ? '?v=' + ver[uid] : ''); }

  function apply(el) {
    var uid = el.getAttribute('data-vtx-av');
    if (!validUid(uid) || isMissing(uid) || el.getAttribute('data-vtx-av-done') === (ver[uid] || '1')) return;
    el.setAttribute('data-vtx-av-done', ver[uid] || '1');
    var img = new Image();
    img.crossOrigin = 'anonymous';   // CORS response (not opaque) so the service worker can cache it
    img.onload = function () {
      var old = el.querySelector('img.vtx-av-img'); if (old) old.remove();
      img.className = 'vtx-av-img'; img.alt = '';
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;';
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      if (el.getAttribute('data-vtx-av-orig') === null) el.setAttribute('data-vtx-av-orig', (el.style.color || '') + '|' + (el.style.overflow || ''));
      el.style.overflow = 'hidden';
      el.style.color = 'transparent';   // hide the letter underneath
      el.appendChild(img);
    };
    img.onerror = function () { missing[uid] = Date.now(); el.removeAttribute('data-vtx-av-done'); };   // no photo: keep letter avatar
    img.src = url(uid);
  }

  function scan(root) {
    (root || document).querySelectorAll('[data-vtx-av]').forEach(apply);
  }

  var t = null;
  new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 60); })
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', function () { scan(); });

  async function token() {
    var u = window.fbAuth && window.fbAuth.currentUser;
    if (!u) throw new Error('Please sign in again.');
    return u.getIdToken();
  }

  // Resize to 256x256 JPEG (small, fast, cheap to store)
  function resize(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return reject(new Error('Please choose a JPG, PNG or WebP image.'));
      if (file.size > 10 * 1024 * 1024) return reject(new Error('Image is too large (max 10 MB).'));
      var img = new Image(), src = URL.createObjectURL(file);
      img.onload = function () {
        var s = 256, c = document.createElement('canvas'); c.width = c.height = s;
        var m = Math.min(img.width, img.height), sx = (img.width - m) / 2, sy = (img.height - m) / 2;
        c.getContext('2d').drawImage(img, sx, sy, m, m, 0, 0, s, s);
        URL.revokeObjectURL(src);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('Could not process image.')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { reject(new Error('That file is not a valid image.')); };
      img.src = src;
    });
  }

  function restore(el) {
    var i = el.querySelector('img.vtx-av-img'); if (i) i.remove();
    var o = el.getAttribute('data-vtx-av-orig');
    if (o !== null) { var a = o.split('|'); el.style.color = a[0]; el.style.overflow = a[1] || ''; el.removeAttribute('data-vtx-av-orig'); }
    el.removeAttribute('data-vtx-av-done');
  }
  function mine(uid) { return Array.prototype.filter.call(document.querySelectorAll('[data-vtx-av]'), function (el) { return el.getAttribute('data-vtx-av') === uid; }); }

  function bump(uid, v) {
    ver[uid] = v; delete missing[uid];
    try { localStorage.setItem('vtxAvVer', JSON.stringify(ver)); } catch (e) {}
    mine(uid).forEach(function (el) { restore(el); apply(el); });
  }

  async function upload(file) {
    var uid = window.AppState && AppState.userId; if (!uid) throw new Error('Not signed in.');
    if (navigator.onLine === false) throw new Error('You are offline. Try again when connected.');
    var blob = await resize(file);
    var res = await fetch(WORKER_URL + '/avatar/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg', 'Authorization': 'Bearer ' + (await token()) },
      body: blob
    });
    if (!res.ok) { var d = await res.json().catch(function () { return {}; }); throw new Error(d.error || 'Upload failed.'); }
    bump(uid, String(Date.now()));
  }

  async function remove() {
    var uid = window.AppState && AppState.userId; if (!uid) throw new Error('Not signed in.');
    var res = await fetch(WORKER_URL + '/avatar/delete', { method: 'POST', headers: { 'Authorization': 'Bearer ' + (await token()) } });
    if (!res.ok) throw new Error('Could not remove photo.');
    missing[uid] = Date.now(); delete ver[uid];
    try { localStorage.setItem('vtxAvVer', JSON.stringify(ver)); } catch (e) {}
    mine(uid).forEach(restore);
    // tell the SW to forget the cached copy
    try { caches.keys().then(function (ks) { ks.forEach(function (k) { if (k.indexOf('avatar') === 0) caches.delete(k); }); }); } catch (e) {}
  }

  window.VtxAvatar = { url: url, scan: scan, upload: upload, remove: remove, has: function (uid) { return !isMissing(uid); } };
})();
