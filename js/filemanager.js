/* ============================================================
   js/filemanager.js — Vertex file manager
   My Files (nested folders + breadcrumbs), Collections,
   Shared files, and the multi-file upload queue.

   All permission, quota and ownership checks run on the Worker
   (worker-files.js). This file only renders and calls it.
   Folders and collections are logical metadata in Firestore
   (userFolders, userCollections, uploads.folderId/collectionId);
   stored objects are never moved or renamed.
   ============================================================ */
(function () {
  'use strict';

  var WORKER_URL = 'https://vertex-worker.gbemigaakinde.workers.dev';
  var CONCURRENCY = 3;
  var STUDENT_DAILY_LIMIT = 50;
  var STUDENT_MAX_FILE_MB = 20;
  var STUDENT_MAX_VIDEO_MB = 30;
  var STUDENT_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'mkv', 'avi'];
  var VIDEO_EXTS = ['mp4', 'webm', 'mov', 'mkv', 'avi'];
  var ICONS = {
    pdf: 'ph-file-pdf', doc: 'ph-file-doc', docx: 'ph-file-doc', xls: 'ph-file-xls', xlsx: 'ph-file-xls',
    ppt: 'ph-file-ppt', pptx: 'ph-file-ppt', txt: 'ph-file-text',
    jpg: 'ph-image', jpeg: 'ph-image', png: 'ph-image', gif: 'ph-image', webp: 'ph-image',
    mp4: 'ph-film-strip', webm: 'ph-film-strip', mov: 'ph-film-strip', mkv: 'ph-film-strip', avi: 'ph-film-strip'
  };

  /* ── helpers ─────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
    return (b / 1073741824).toFixed(2) + ' GB';
  }
  function ext(n) { return (String(n || '').split('.').pop() || '').toLowerCase(); }
  function ms(ts) { return !ts ? 0 : (ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime()); }
  function fmtDate(ts) {
    var t = ms(ts); if (!t) return '';
    return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function toast(m, t) { if (window.UI && UI.toast) UI.toast(m, t || 'info'); }
  function icon(name, size) { return '<i class="ph ' + name + '" style="font-size:' + (size || 18) + 'px" aria-hidden="true"></i>'; }
  function fileIcon(e) { return ICONS[e] || 'ph-file'; }
  function uid8() { return Math.random().toString(36).slice(2, 10); }

  async function api(path, body) {
    var u = window.fbAuth && window.fbAuth.currentUser;
    if (!u) throw new Error('Please sign in again.');
    var res = await fetch(WORKER_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (await u.getIdToken()) },
      body: JSON.stringify(body || {})
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) { var e = new Error(data.error || 'Request failed.'); e.code = data.code; e.data = data; throw e; }
    return data;
  }
  function op(action, extra) { return api('/files/op', Object.assign({ action: action }, extra || {})); }

  /* ── styles ──────────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('vtxFmStyles')) return;
    var st = document.createElement('style');
    st.id = 'vtxFmStyles';
    st.textContent =
      '.fm{display:flex;flex-direction:column;gap:.75rem}' +
      '.fm button,.fm select,.fm input[type=text],.fmd button,.fmd select,.fmd input[type=text]{font-family:var(--font,inherit)}' +
      '.fm :focus-visible,.fmd :focus-visible{outline:2px solid var(--accent);outline-offset:2px}' +
      '.fm-head{display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap}' +
      '.fm-title{font-size:1rem;font-weight:700;color:var(--text-1);letter-spacing:-.015em}' +
      '.fm-btn{display:inline-flex;align-items:center;justify-content:center;gap:.375rem;min-height:40px;padding:.4rem .875rem;border-radius:var(--r-lg);border:1px solid var(--border);background:var(--bg-subtle);color:var(--text-2);font-size:.8125rem;font-weight:600;cursor:pointer}' +
      '.fm-btn:hover{background:var(--bg-muted)}' +
      '.fm-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}' +
      '.fm-btn.primary:hover{opacity:.9}' +
      '.fm-btn.danger{color:var(--danger);border-color:var(--danger-border);background:var(--danger-subtle)}' +
      '.fm-btn[disabled]{opacity:.5;cursor:not-allowed}' +
      '.fm-icon-btn{width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;border-radius:var(--r-lg);border:1px solid transparent;background:transparent;color:var(--text-3);cursor:pointer}' +
      '.fm-icon-btn:hover{background:var(--bg-muted);color:var(--text-1)}' +
      '.fm-tabs{display:flex;gap:.25rem;background:var(--bg-muted);border:1px solid var(--border);border-radius:var(--r-lg);padding:3px}' +
      '.fm-tab{flex:1;min-height:36px;border:none;border-radius:8px;background:transparent;color:var(--text-3);font-size:.8125rem;font-weight:600;cursor:pointer}' +
      '.fm-tab[aria-selected=true]{background:var(--bg-base);color:var(--text-1);box-shadow:var(--shadow-xs)}' +
      '.fm-tools{display:flex;gap:.5rem;flex-wrap:wrap}' +
      '.fm-tools input,.fm-tools select{min-height:40px;box-sizing:border-box}' +
      '.fm-tools input{flex:1;min-width:140px}' +
      '.fm-crumbs{display:flex;align-items:center;flex-wrap:wrap;gap:.125rem;font-size:.8125rem}' +
      '.fm-crumb{border:none;background:transparent;color:var(--accent-text,var(--accent));font-weight:600;cursor:pointer;padding:.375rem .375rem;min-height:36px;border-radius:6px}' +
      '.fm-crumb[aria-current=page]{color:var(--text-1);cursor:default}' +
      '.fm-sel{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;padding:.5rem .75rem;border-radius:var(--r-lg);background:var(--accent-subtle);border:1px solid var(--accent-border);font-size:.8125rem;font-weight:600;color:var(--text-1)}' +
      '.fm-list{display:flex;flex-direction:column;gap:.375rem}' +
      '.fm-row{display:flex;align-items:center;gap:.625rem;padding:.5rem .625rem;border-radius:var(--r-lg);border:1px solid var(--border);background:var(--bg-base);min-width:0}' +
      '.fm-row.sel{border-color:var(--accent);background:var(--accent-subtle)}' +
      '.fm-row-main{flex:1;min-width:0;background:none;border:none;text-align:left;cursor:pointer;display:flex;align-items:center;gap:.625rem;padding:0;min-height:44px;color:inherit}' +
      '.fm-row-name{font-size:.875rem;font-weight:700;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.fm-row-meta{font-size:.75rem;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.fm-badge{display:inline-block;font-size:.625rem;font-weight:700;padding:1px 6px;border-radius:99px;background:var(--bg-muted);color:var(--text-3);margin-left:.25rem;vertical-align:middle}' +
      '.fm-check{width:20px;height:20px;flex-shrink:0;accent-color:var(--accent);cursor:pointer}' +
      '.fm-empty{display:flex;flex-direction:column;align-items:center;gap:.625rem;text-align:center;padding:2.5rem 1rem;color:var(--text-3);font-size:.875rem}' +
      '.fm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:.5rem}' +
      '.fm-menu{position:fixed;z-index:9700;min-width:190px;background:var(--bg-base);border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:0 8px 28px rgba(0,0,0,.18);padding:.25rem}' +
      '.fm-menu button{display:flex;align-items:center;gap:.5rem;width:100%;min-height:40px;padding:.4rem .625rem;border:none;background:transparent;color:var(--text-2);font-size:.8125rem;font-weight:600;border-radius:8px;cursor:pointer;text-align:left}' +
      '.fm-menu button:hover{background:var(--bg-muted)}' +
      '.fm-menu button.danger{color:var(--danger)}' +
      '.fmd-ov{position:fixed;inset:0;z-index:9600;background:var(--bg-overlay,rgba(0,0,0,.45));display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px)}' +
      '.fmd{width:100%;max-width:560px;max-height:90dvh;display:flex;flex-direction:column;background:var(--bg-base);border-radius:var(--r-2xl) var(--r-2xl) 0 0;box-shadow:0 -8px 40px rgba(0,0,0,.14)}' +
      '@media(min-width:640px){.fmd-ov{align-items:center}.fmd{border-radius:var(--r-2xl)}}' +
      '.fmd-h{display:flex;align-items:center;justify-content:space-between;padding:.875rem 1.125rem;border-bottom:1px solid var(--border)}' +
      '.fmd-h h2{font-size:.9375rem;font-weight:700;color:var(--text-1);margin:0}' +
      '.fmd-b{padding:1rem 1.125rem;overflow-y:auto;display:flex;flex-direction:column;gap:.875rem;-webkit-overflow-scrolling:touch}' +
      '.fmd-b>*{flex-shrink:0}' +
      '.fm-group{font-size:.75rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;margin:.5rem 0 .25rem;display:flex;align-items:center;gap:.375rem}' +
      '.fmd-f{padding:.875rem 1.125rem calc(.875rem + env(safe-area-inset-bottom,0px));border-top:1px solid var(--border);display:flex;gap:.5rem;justify-content:flex-end}' +
      '.fmd label.lbl{display:block;font-size:.75rem;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.375rem}' +
      '.fmd input[type=text],.fmd input[type=datetime-local],.fmd select{width:100%;box-sizing:border-box;min-height:42px}' +
      '.fmd-err{color:var(--danger);font-size:.8125rem;margin:0}' +
      '.fm-pick{display:flex;flex-direction:column;gap:2px;max-height:50dvh;overflow-y:auto}' +
      '.fm-pick label{display:flex;align-items:center;gap:.5rem;min-height:42px;padding:.25rem .5rem;border-radius:8px;cursor:pointer;font-size:.875rem;color:var(--text-1)}' +
      '.fm-pick label:hover{background:var(--bg-muted)}' +
      '.fm-pick input{accent-color:var(--accent)}' +
      '.fm-drop{border:2px dashed var(--border);border-radius:var(--r-xl);padding:1.5rem 1rem;text-align:center;cursor:pointer;background:var(--bg-subtle);transition:border-color .15s,background .15s}' +
      '.fm-drop.over{border-color:var(--accent);background:var(--accent-subtle)}' +
      '.fm-drop.off{opacity:.5;pointer-events:none}' +
      '.fm-q{display:flex;flex-direction:column;gap:.375rem;max-height:240px;min-height:64px;overflow-y:auto}' +
      '.fm-qi{display:flex;align-items:center;gap:.5rem;padding:.5rem .625rem;border-radius:var(--r-lg);border:1px solid var(--border);background:var(--bg-subtle)}' +
      '.fm-qi.err{border-color:var(--danger-border);background:var(--danger-subtle)}' +
      '.fm-bar{height:4px;border-radius:4px;background:var(--bg-muted);overflow:hidden;margin-top:4px}' +
      '.fm-bar>span{display:block;height:100%;background:var(--accent);width:0;transition:width .15s}' +
      '.fm-chips{display:flex;flex-wrap:wrap;gap:.375rem}' +
      '.fm-chip{display:inline-flex;align-items:center;gap:.25rem;min-height:36px;padding:.25rem .625rem;border-radius:99px;border:1px solid var(--accent-border);background:var(--accent-subtle);color:var(--accent-text,var(--accent));font-size:.8125rem;font-weight:600;cursor:pointer}' +
      '.fm-vis{display:flex;background:var(--bg-muted);border:1px solid var(--border);border-radius:var(--r-md);padding:3px;gap:3px}' +
      '.fm-vis button{flex:1;min-height:38px;border:none;border-radius:6px;background:transparent;color:var(--text-3);font-size:.75rem;font-weight:600;cursor:pointer}' +
      '.fm-vis button[aria-pressed=true]{background:var(--bg-base);color:var(--text-1);box-shadow:var(--shadow-xs)}' +
      '.fm-banner{padding:.625rem .75rem;border-radius:var(--r-lg);font-size:.8125rem;font-weight:600}' +
      '.fm-banner.warn{background:var(--danger-subtle);border:1px solid var(--danger-border);color:var(--danger)}' +
      '.fm-banner.info{background:var(--bg-subtle);border:1px solid var(--border);color:var(--text-2);font-weight:500}' +
      '@media(prefers-reduced-motion:reduce){.fm-bar>span,.fm-drop{transition:none}}';
    document.head.appendChild(st);
  }

  /* ── generic dialog ──────────────────────────────────────── */
  function dialog(opts) {
    return new Promise(function (resolve) {
      var prev = document.activeElement;
      var ov = document.createElement('div');
      ov.className = 'fmd-ov';
      ov.innerHTML =
        '<div class="fmd" role="dialog" aria-modal="true" aria-labelledby="fmdT">' +
        '<div class="fmd-h"><h2 id="fmdT">' + esc(opts.title) + '</h2>' +
        '<button type="button" class="fm-icon-btn" data-x aria-label="Close">' + icon('ph-x', 16) + '</button></div>' +
        '<div class="fmd-b">' + opts.body + '<p class="fmd-err" role="alert" hidden></p></div>' +
        '<div class="fmd-f"><button type="button" class="fm-btn" data-x>Cancel</button>' +
        '<button type="button" class="fm-btn primary" data-ok>' + esc(opts.ok || 'Save') + '</button></div></div>';
      document.body.appendChild(ov);
      var dlg = ov.querySelector('.fmd');
      var err = ov.querySelector('.fmd-err');
      function close(v) { document.removeEventListener('keydown', onKey, true); ov.remove(); if (prev && prev.focus) prev.focus(); resolve(v); }
      function onKey(e) {
        if (e.key === 'Escape') { e.stopPropagation(); close(null); }
        if (e.key === 'Tab') {
          var f = dlg.querySelectorAll('button,input,select,[tabindex]:not([tabindex="-1"])');
          if (!f.length) return;
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
        if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT' && e.target.type === 'text') { e.preventDefault(); ov.querySelector('[data-ok]').click(); }
      }
      document.addEventListener('keydown', onKey, true);
      ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-x]')) close(null); });
      ov.querySelector('[data-ok]').addEventListener('click', async function (e) {
        var btn = e.currentTarget;
        var val = opts.read ? opts.read(dlg) : true;
        if (opts.validate) { var m = opts.validate(val); if (m) { err.textContent = m; err.hidden = false; return; } }
        btn.disabled = true;
        try {
          if (opts.submit) await opts.submit(val);
          close(val === undefined ? true : val);
        } catch (ex) { err.textContent = ex.message || 'Something went wrong.'; err.hidden = false; btn.disabled = false; }
      });
      var focusEl = dlg.querySelector('input,select,button[data-ok]');
      if (focusEl) { focusEl.focus(); if (focusEl.select) focusEl.select(); }
    });
  }

  function confirmDanger(title, message, okLabel) {
    return dialog({ title: title, ok: okLabel || 'Delete', body: '<p style="margin:0;font-size:.875rem;color:var(--text-2);line-height:1.5">' + esc(message) + '</p>' });
  }

  /* ══════════════════════════════════════════════════════════
     PANEL
  ══════════════════════════════════════════════════════════ */
  var M = null; // active mount state

  async function mount(containerId, ctx) {
    injectStyles();
    var el = document.getElementById(containerId);
    if (!el) return;
    M = {
      id: containerId, ctx: ctx, tab: 'shared', folderId: null, collectionId: null,
      folders: [], collections: [], files: [], shared: [], search: '', sort: 'newest',
      selected: new Set(), loaded: false, error: ''
    };
    el.innerHTML = '<div class="fm" id="fmRoot"></div>';
    bind(el);
    render();
    await refresh();
  }

  async function refresh() {
    if (!M) return;
    var uid = M.ctx.uid, db = window.fbDb;
    try {
      var r = await Promise.all([
        db.collection('userFolders').where('ownerUid', '==', uid).get(),
        db.collection('userCollections').where('ownerUid', '==', uid).get(),
        db.collection('uploads').where('uploaderUid', '==', uid).get(),
        db.collection('uploads').orderBy('createdAt', 'desc').limit(200).get()
      ]);
      M.folders = r[0].docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      M.collections = r[1].docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      M.files = r[2].docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      var now = Date.now();
      M.shared = r[3].docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).filter(function (d) {
        if (M.ctx.role === 'teacher') return true;
        if (d.uploaderUid === uid) return false;
        if (d.expiresAt && ms(d.expiresAt) <= now) return false;
        if (d.sharedWith === 'all') return true;
        if (d.sharedWith === 'student') return d.targetStudentUid === uid;
        if (d.sharedWith === 'class') {
          var cls = (d.targetClasses && d.targetClasses.length) ? d.targetClasses : [d.targetClass || d.uploaderClass || ''];
          return cls.indexOf(M.ctx.cls) !== -1;
        }
        return false;
      });
      M.loaded = true; M.error = '';
      var live = new Set(M.files.map(function (f) { return f.id; }));
      M.selected.forEach(function (id) { if (!live.has(id)) M.selected.delete(id); });
      if (M.folderId && !M.folders.some(function (f) { return f.id === M.folderId; })) M.folderId = null;
      if (M.collectionId && !M.collections.some(function (c) { return c.id === M.collectionId; })) M.collectionId = null;
    } catch (e) {
      M.error = 'Could not load your files. Check your connection and try again.';
    }
    render();
  }

  function folderById(id) { return M.folders.filter(function (f) { return f.id === id; })[0]; }
  function collById(id) { return M.collections.filter(function (c) { return c.id === id; })[0]; }
  function pathOf(id) {
    var parts = [], cur = id, guard = 0;
    while (cur && guard++ < 60) { var f = folderById(cur); if (!f) break; parts.unshift(f); cur = f.parentId || null; }
    return parts;
  }
  function pathLabel(id) { return ['My Files'].concat(pathOf(id).map(function (f) { return f.name; })).join(' / '); }
  function descendantsOf(id) {
    var out = new Set([id]), grew = true;
    while (grew) {
      grew = false;
      M.folders.forEach(function (f) { if (f.parentId && out.has(f.parentId) && !out.has(f.id)) { out.add(f.id); grew = true; } });
    }
    return out;
  }
  function folderOptions(exclude) {
    var out = [];
    (function walk(parent, depth) {
      M.folders.filter(function (f) { return (f.parentId || null) === parent && !(exclude && exclude.has(f.id)); })
        .sort(function (a, b) { return a.name.localeCompare(b.name); })
        .forEach(function (f) { out.push({ id: f.id, name: f.name, depth: depth }); walk(f.id, depth + 1); });
    })(null, 0);
    return out;
  }

  function sorter(kind) {
    return function (a, b) {
      if (kind === 'name') return String(a.fileName || a.name).localeCompare(String(b.fileName || b.name));
      if (kind === 'size') return (b.fileSize || 0) - (a.fileSize || 0);
      return ms(b.createdAt) - ms(a.createdAt);
    };
  }

  function rowFile(f, shared) {
    var mine = f.uploaderUid === M.ctx.uid;
    var canDel = mine || M.ctx.role === 'teacher';
    var coll = f.collectionId && mine ? collById(f.collectionId) : null;
    var meta = [fmtBytes(f.fileSize || 0), fmtDate(f.createdAt)];
    if (shared) meta.unshift(f.uploaderName || 'Unknown');
    if (M.search && !shared && mine) meta.push(pathLabel(f.folderId || null));
    var classes = (f.sharedWith === 'class') ? ((f.targetClasses && f.targetClasses.length) ? f.targetClasses : [f.targetClass].filter(Boolean)) : [];
    var share = f.sharedWith === 'all' ? 'All students' : f.sharedWith === 'class' ? classes.join(', ') : f.sharedWith === 'student' ? (f.targetStudentName || 'One student') : f.sharedWith === 'teacher' ? 'Teacher' : 'Only me';
    var sel = M.selected.has(f.id);
    return '<div class="fm-row' + (sel ? ' sel' : '') + '" data-file="' + esc(f.id) + '">' +
      (!shared && mine ? '<input type="checkbox" class="fm-check" data-act="toggle" data-id="' + esc(f.id) + '" aria-label="Select ' + esc(f.fileName) + '"' + (sel ? ' checked' : '') + '>' : '') +
      '<button type="button" class="fm-row-main" data-act="open" data-id="' + esc(f.id) + '" aria-label="Open ' + esc(f.fileName) + '">' +
      '<span style="font-size:1.5rem;color:var(--accent);display:inline-flex;flex-shrink:0">' + icon(fileIcon(f.fileExt), 24) + '</span>' +
      '<span style="min-width:0"><span class="fm-row-name" style="display:block">' + esc(f.fileName) + '</span>' +
      '<span class="fm-row-meta" style="display:block">' + esc(meta.join(' · ')) + '<span class="fm-badge">' + esc(share) + '</span>' +
      (coll ? '<span class="fm-badge">' + esc(coll.name) + '</span>' : '') + '</span></span></button>' +
      ((!shared && mine) || canDel ? '<button type="button" class="fm-icon-btn" data-act="filemenu" data-id="' + esc(f.id) + '" data-shared="' + (shared ? 1 : 0) + '" aria-label="Actions for ' + esc(f.fileName) + '" aria-haspopup="menu">' + icon('ph-dots-three-vertical', 18) + '</button>' : '') +
      '</div>';
  }

  function rowFolder(f) {
    var kids = M.folders.filter(function (x) { return x.parentId === f.id; }).length + M.files.filter(function (x) { return x.folderId === f.id; }).length;
    return '<div class="fm-row"><button type="button" class="fm-row-main" data-act="enter" data-id="' + esc(f.id) + '" aria-label="Open folder ' + esc(f.name) + '">' +
      '<span style="color:var(--accent);display:inline-flex">' + icon('ph-folder-simple', 26) + '</span>' +
      '<span style="min-width:0"><span class="fm-row-name" style="display:block">' + esc(f.name) + '</span>' +
      '<span class="fm-row-meta" style="display:block">' + kids + (kids === 1 ? ' item' : ' items') + (M.search ? ' · ' + esc(pathLabel(f.parentId || null)) : '') + '</span></span></button>' +
      '<button type="button" class="fm-icon-btn" data-act="foldermenu" data-id="' + esc(f.id) + '" aria-label="Actions for folder ' + esc(f.name) + '" aria-haspopup="menu">' + icon('ph-dots-three-vertical', 18) + '</button></div>';
  }

  function empty(iconName, title, text, btn) {
    return '<div class="fm-empty">' + icon(iconName, 36) + '<strong style="color:var(--text-2)">' + esc(title) + '</strong><span>' + esc(text) + '</span>' + (btn || '') + '</div>';
  }

  function render() {
    var root = document.getElementById('fmRoot');
    if (!root || !M) return;
    var isT = M.ctx.role === 'teacher';
    var q = M.search.trim().toLowerCase();
    var h = '';
    h += '<div class="fm-head"><span class="fm-title">Files</span><div style="display:flex;gap:.5rem;flex-wrap:wrap">';
    if (M.tab === 'files') h += '<button type="button" class="fm-btn" data-act="newfolder">' + icon('ph-folder-plus', 16) + ' New folder</button>';
    if (M.tab === 'collections' && !M.collectionId) h += '<button type="button" class="fm-btn" data-act="newcoll">' + icon('ph-plus', 16) + ' New collection</button>';
    h += '<button type="button" class="fm-btn primary" data-act="upload">' + icon('ph-upload-simple', 16) + ' Upload</button></div></div>';
    h += '<div class="fm-tabs" role="tablist" aria-label="File views">' +
      '<button type="button" role="tab" class="fm-tab" data-act="tab" data-id="shared" aria-selected="' + (M.tab === 'shared') + '">' + (isT ? 'All files' : 'Shared with me') + '</button>' +
      '<button type="button" role="tab" class="fm-tab" data-act="tab" data-id="files" aria-selected="' + (M.tab === 'files') + '">My Files</button>' +
      '<button type="button" role="tab" class="fm-tab" data-act="tab" data-id="collections" aria-selected="' + (M.tab === 'collections') + '">Collections</button></div>';
    h += '<div class="fm-tools"><input type="text" id="fmSearch" placeholder="Search files and folders" aria-label="Search files and folders" value="' + esc(M.search) + '">' +
      '<select id="fmSort" aria-label="Sort by"><option value="newest"' + (M.sort === 'newest' ? ' selected' : '') + '>Newest</option><option value="name"' + (M.sort === 'name' ? ' selected' : '') + '>Name</option><option value="size"' + (M.sort === 'size' ? ' selected' : '') + '>Largest</option></select></div>';

    if (M.error) {
      h += '<div class="fm-banner warn" role="alert">' + esc(M.error) + ' <button type="button" class="fm-btn" data-act="reload" style="margin-left:.5rem">Retry</button></div>';
    } else if (!M.loaded) {
      h += '<div class="fm-empty">Loading files…</div>';
    } else if (M.tab === 'files') {
      h += filesView(q);
    } else if (M.tab === 'collections') {
      h += collectionsView(q);
    } else {
      var list = M.shared.filter(function (f) { return !q || String(f.fileName).toLowerCase().indexOf(q) !== -1; }).sort(sorter(M.sort));
      h += list.length ? sharedList(list)
        : empty('ph-tray', q ? 'No matches' : 'Nothing shared yet', q ? 'Try a different search.' : (isT ? 'No files have been uploaded yet.' : 'Files your teacher shares with you will appear here.'));
    }
    var active = document.activeElement && document.activeElement.id;
    root.innerHTML = h;
    if (active === 'fmSearch') { var s = document.getElementById('fmSearch'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }
  }

  function sharedList(list) {
    if (!list.some(function (f) { return f.folderName; })) return '<div class="fm-list">' + list.map(function (f) { return rowFile(f, true); }).join('') + '</div>';
    var groups = {}, order = [];
    list.forEach(function (f) { var k = f.folderName || ''; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(f); });
    order.sort(function (a, b) { return a === '' ? 1 : b === '' ? -1 : a.localeCompare(b); });
    return order.map(function (k) {
      return '<div class="fm-group">' + icon(k ? 'ph-folder-simple' : 'ph-files', 16) + ' ' + esc(k || 'Other files') + ' <span style="font-weight:500">(' + groups[k].length + ')</span></div><div class="fm-list">' + groups[k].map(function (f) { return rowFile(f, true); }).join('') + '</div>';
    }).join('');
  }

  function selectionBar() {
    if (!M.selected.size) return '';
    return '<div class="fm-sel" role="region" aria-label="Selected files"><span>' + M.selected.size + ' selected</span>' +
      '<button type="button" class="fm-btn" data-act="bulkmove">' + icon('ph-folder-simple', 15) + ' Move</button>' +
      '<button type="button" class="fm-btn" data-act="bulkcoll">' + icon('ph-bookmarks-simple', 15) + ' Collection</button>' +
      '<button type="button" class="fm-btn danger" data-act="bulkdel">' + icon('ph-trash', 15) + ' Delete</button>' +
      '<button type="button" class="fm-btn" data-act="clearsel">Clear</button></div>';
  }

  function filesView(q) {
    var out = '';
    var folders, files;
    if (q) {
      folders = M.folders.filter(function (f) { return f.name.toLowerCase().indexOf(q) !== -1; });
      files = M.files.filter(function (f) { return String(f.fileName).toLowerCase().indexOf(q) !== -1; });
    } else {
      folders = M.folders.filter(function (f) { return (f.parentId || null) === M.folderId; });
      files = M.files.filter(function (f) { return (f.folderId || null) === M.folderId; });
      var trail = pathOf(M.folderId);
      if (M.folderId) out += '<nav class="fm-crumbs" aria-label="Breadcrumb"><button type="button" class="fm-crumb" data-act="goto" data-id="" ' + (!M.folderId ? 'aria-current="page"' : '') + '>My Files</button>';
      trail.forEach(function (f, i) {
        out += '<span aria-hidden="true" style="color:var(--text-4)">' + icon('ph-caret-right', 12) + '</span><button type="button" class="fm-crumb" data-act="goto" data-id="' + esc(f.id) + '" ' + (i === trail.length - 1 ? 'aria-current="page"' : '') + '>' + esc(f.name) + '</button>';
      });
      if (M.folderId) out += '</nav>';
    }
    folders = folders.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    files = files.slice().sort(sorter(M.sort));
    out += selectionBar();
    if (!folders.length && !files.length) {
      out += q ? empty('ph-magnifying-glass', 'No matches', 'Try a different search.')
        : M.folderId ? empty('ph-folder-open', 'This folder is empty', 'Tap Upload above to add files here, or create a subfolder.')
          : empty('ph-folder-open', 'No files yet', 'Tap Upload above, or create a folder to get organised.');
      return out;
    }
    if (files.length > 1) out += '<label style="display:flex;align-items:center;gap:.5rem;font-size:.75rem;color:var(--text-3);min-height:32px"><input type="checkbox" class="fm-check" data-act="selall" aria-label="Select all files in this view"' + (files.every(function (f) { return M.selected.has(f.id); }) ? ' checked' : '') + '> Select all files</label>';
    out += '<div class="fm-list">' + folders.map(rowFolder).join('') + files.map(function (f) { return rowFile(f, false); }).join('') + '</div>';
    return out;
  }

  function collectionsView(q) {
    if (M.collectionId) {
      var c = collById(M.collectionId);
      var files = M.files.filter(function (f) { return f.collectionId === M.collectionId && (!q || String(f.fileName).toLowerCase().indexOf(q) !== -1); }).sort(sorter(M.sort));
      var out = '<nav class="fm-crumbs" aria-label="Breadcrumb"><button type="button" class="fm-crumb" data-act="collback">Collections</button><span aria-hidden="true" style="color:var(--text-4)">' + icon('ph-caret-right', 12) + '</span><span class="fm-crumb" aria-current="page">' + esc(c ? c.name : '') + '</span></nav>';
      out += selectionBar();
      out += files.length ? '<div class="fm-list">' + files.map(function (f) { return rowFile(f, false); }).join('') + '</div>'
        : empty('ph-bookmarks-simple', 'No files in this collection', 'Select files in My Files and choose Collection to add them.');
      return out;
    }
    var cols = M.collections.filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) !== -1; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (!cols.length) return empty('ph-bookmarks-simple', q ? 'No matches' : 'No collections yet', 'Collections group files across folders, like "Exam revision".', q ? '' : '<button type="button" class="fm-btn primary" data-act="newcoll">' + icon('ph-plus', 16) + ' New collection</button>');
    return '<div class="fm-grid">' + cols.map(function (c) {
      var n = M.files.filter(function (f) { return f.collectionId === c.id; }).length;
      return '<div class="fm-row"><button type="button" class="fm-row-main" data-act="opencoll" data-id="' + esc(c.id) + '" aria-label="Open collection ' + esc(c.name) + '">' +
        '<span style="color:var(--accent);display:inline-flex">' + icon('ph-bookmarks-simple', 24) + '</span><span style="min-width:0"><span class="fm-row-name" style="display:block">' + esc(c.name) + '</span><span class="fm-row-meta" style="display:block">' + n + (n === 1 ? ' file' : ' files') + '</span></span></button>' +
        '<button type="button" class="fm-icon-btn" data-act="collmenu" data-id="' + esc(c.id) + '" aria-label="Actions for collection ' + esc(c.name) + '" aria-haspopup="menu">' + icon('ph-dots-three-vertical', 18) + '</button></div>';
    }).join('') + '</div>';
  }

  /* ── menus ───────────────────────────────────────────────── */
  function closeMenu() { var m = document.getElementById('fmMenu'); if (m) m.remove(); }
  function openMenu(anchor, items) {
    closeMenu();
    var m = document.createElement('div');
    m.id = 'fmMenu'; m.className = 'fm-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = items.map(function (it, i) {
      return '<button type="button" role="menuitem" data-i="' + i + '" class="' + (it.danger ? 'danger' : '') + '">' + icon(it.icon, 16) + esc(it.label) + '</button>';
    }).join('');
    document.body.appendChild(m);
    var r = anchor.getBoundingClientRect();
    var w = m.offsetWidth, hh = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
    m.style.top = (r.bottom + hh + 8 > window.innerHeight ? Math.max(8, r.top - hh - 4) : r.bottom + 4) + 'px';
    m.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]'); if (!b) return;
      closeMenu(); anchor.focus(); items[+b.dataset.i].fn();
    });
    m.addEventListener('keydown', function (e) {
      var bs = Array.prototype.slice.call(m.querySelectorAll('button')), i = bs.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
      if (e.key === 'Escape') { closeMenu(); anchor.focus(); }
    });
    m.querySelector('button').focus();
  }
  document.addEventListener('click', function (e) { if (!e.target.closest('#fmMenu') && !e.target.closest('[aria-haspopup=menu]')) closeMenu(); });

  /* ── actions ─────────────────────────────────────────────── */
  async function run(fn, okMsg) {
    try { await fn(); if (okMsg) toast(okMsg, 'success'); } catch (e) { toast(e.message || 'Something went wrong.', 'error'); }
    await refresh();
  }

  function nameDialog(title, initial, label) {
    return dialog({
      title: title, ok: 'Save',
      body: '<div><label class="lbl" for="fmName">' + esc(label || 'Name') + '</label><input type="text" id="fmName" maxlength="80" autocomplete="off" value="' + esc(initial || '') + '"></div>',
      read: function (d) { return d.querySelector('#fmName').value.trim(); },
      validate: function (v) { return v ? '' : 'Please enter a name.'; }
    });
  }

  function folderPicker(title, exclude, currentId) {
    var opts = folderOptions(exclude);
    var body = '<div class="fm-pick" role="radiogroup" aria-label="Destination folder">' +
      '<label><input type="radio" name="fmDest" value=""' + (!currentId ? ' checked' : '') + '>' + icon('ph-house-simple', 16) + ' My Files</label>' +
      opts.map(function (o) {
        return '<label style="padding-left:' + (0.5 + o.depth * 1.1) + 'rem"><input type="radio" name="fmDest" value="' + esc(o.id) + '"' + (currentId === o.id ? ' checked' : '') + '>' + icon('ph-folder-simple', 16) + ' ' + esc(o.name) + '</label>';
      }).join('') + '</div>';
    return dialog({
      title: title, ok: 'Move here', body: body,
      read: function (d) { var r = d.querySelector('input[name=fmDest]:checked'); return { id: r ? (r.value || null) : null }; }
    });
  }

  function collPicker(title, currentId) {
    var body = '<div class="fm-pick" role="radiogroup" aria-label="Collection">' +
      '<label><input type="radio" name="fmColl" value=""' + (!currentId ? ' checked' : '') + '> No collection</label>' +
      M.collections.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (c) {
        return '<label><input type="radio" name="fmColl" value="' + esc(c.id) + '"' + (currentId === c.id ? ' checked' : '') + '>' + icon('ph-bookmarks-simple', 16) + ' ' + esc(c.name) + '</label>';
      }).join('') +
      '<label><input type="radio" name="fmColl" value="__new"> ' + icon('ph-plus', 16) + ' New collection…</label></div>' +
      '<div id="fmNewCollWrap" hidden><label class="lbl" for="fmNewColl">Collection name</label><input type="text" id="fmNewColl" maxlength="80" autocomplete="off"></div>';
    var d = dialog({
      title: title, ok: 'Apply', body: body,
      read: function (dl) {
        var r = dl.querySelector('input[name=fmColl]:checked');
        return { id: r ? (r.value || null) : null, newName: dl.querySelector('#fmNewColl').value.trim() };
      },
      validate: function (v) { return v.id === '__new' && !v.newName ? 'Enter a name for the new collection.' : ''; }
    });
    setTimeout(function () {
      var wrap = document.getElementById('fmNewCollWrap');
      document.querySelectorAll('input[name=fmColl]').forEach(function (r) {
        r.addEventListener('change', function () { if (wrap) { wrap.hidden = r.value !== '__new' || !r.checked; if (!wrap.hidden) document.getElementById('fmNewColl').focus(); } });
      });
    }, 0);
    return d;
  }

  async function moveFiles(ids) {
    var cur = null;
    if (ids.length === 1) { var f = M.files.filter(function (x) { return x.id === ids[0]; })[0]; cur = f ? (f.folderId || null) : null; }
    var r = await folderPicker('Move ' + ids.length + (ids.length === 1 ? ' file' : ' files'), null, cur);
    if (!r) return;
    await run(function () { return op('file.move', { ids: ids, folderId: r.id }); }, 'Moved to ' + (r.id ? (folderById(r.id) || {}).name : 'My Files') + '.');
    M.selected.clear(); render();
  }

  async function setCollection(ids) {
    var cur = null;
    if (ids.length === 1) { var f = M.files.filter(function (x) { return x.id === ids[0]; })[0]; cur = f ? (f.collectionId || null) : null; }
    var r = await collPicker('Add to collection', cur);
    if (!r) return;
    await run(async function () {
      var cid = r.id;
      if (cid === '__new') cid = (await op('collection.create', { name: r.newName })).id;
      await op('file.setCollection', { ids: ids, collectionId: cid });
    }, 'Collection updated.');
    M.selected.clear(); render();
  }

  async function deleteFiles(ids) {
    var ok = await confirmDanger(ids.length === 1 ? 'Delete this file?' : 'Delete ' + ids.length + ' files?', 'This permanently removes ' + (ids.length === 1 ? 'the file' : 'the files') + ' and cannot be undone.');
    if (!ok) return;
    await run(async function () { for (var i = 0; i < ids.length; i++) await Storage.deleteFile(ids[i]); }, ids.length === 1 ? 'File deleted.' : ids.length + ' files deleted.');
    M.selected.clear(); render();
  }

  function fileById(id) {
    return M.files.concat(M.shared).filter(function (f) { return f.id === id; })[0];
  }

  function bind(el) {
    el.addEventListener('input', function (e) {
      if (e.target.id === 'fmSearch') { M.search = e.target.value; render(); }
    });
    el.addEventListener('change', function (e) {
      if (e.target.id === 'fmSort') { M.sort = e.target.value; render(); return; }
      var t = e.target;
      if (t.dataset && t.dataset.act === 'toggle') { t.checked ? M.selected.add(t.dataset.id) : M.selected.delete(t.dataset.id); render(); }
      if (t.dataset && t.dataset.act === 'selall') {
        var q = M.search.trim().toLowerCase();
        M.files.filter(function (f) { return q ? String(f.fileName).toLowerCase().indexOf(q) !== -1 : (M.tab === 'collections' ? f.collectionId === M.collectionId : (f.folderId || null) === M.folderId); })
          .forEach(function (f) { t.checked ? M.selected.add(f.id) : M.selected.delete(f.id); });
        render();
      }
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b || b.type === 'checkbox') return;
      var act = b.dataset.act, id = b.dataset.id;
      switch (act) {
        case 'tab': M.tab = id; M.selected.clear(); M.collectionId = null; render(); break;
        case 'reload': M.error = ''; M.loaded = false; render(); refresh(); break;
        case 'upload': openUpload({ uploaderRole: M.ctx.role, uploaderUid: M.ctx.uid, uploaderName: M.ctx.name, uploaderClass: M.ctx.cls }, { folderId: M.tab === 'files' ? M.folderId : null, collectionId: M.tab === 'collections' ? M.collectionId : null }); break;
        case 'goto': M.folderId = id || null; M.search = ''; M.selected.clear(); render(); break;
        case 'enter': M.folderId = id; M.search = ''; M.selected.clear(); render(); break;
        case 'clearsel': M.selected.clear(); render(); break;
        case 'bulkmove': moveFiles(Array.from(M.selected)); break;
        case 'bulkcoll': setCollection(Array.from(M.selected)); break;
        case 'bulkdel': deleteFiles(Array.from(M.selected)); break;
        case 'open': { var f = fileById(id); if (f) Storage.openFile(f.objectKey, f.fileName, f.id); break; }
        case 'newfolder': nameDialog('New folder', '', 'Folder name').then(function (n) { if (n) run(function () { return op('folder.create', { name: n, parentId: M.folderId }); }, 'Folder created.'); }); break;
        case 'newcoll': nameDialog('New collection', '', 'Collection name').then(function (n) { if (n) run(function () { return op('collection.create', { name: n }); }, 'Collection created.'); }); break;
        case 'opencoll': M.collectionId = id; M.search = ''; M.selected.clear(); render(); break;
        case 'collback': M.collectionId = null; M.selected.clear(); render(); break;
        case 'filemenu': {
          var file = fileById(id); if (!file) break;
          var mine = file.uploaderUid === M.ctx.uid, items = [];
          if (b.dataset.shared !== '1' && mine) {
            items.push({ icon: 'ph-folder-simple', label: 'Move to folder', fn: function () { moveFiles([id]); } });
            items.push({ icon: 'ph-bookmarks-simple', label: 'Add to collection', fn: function () { setCollection([id]); } });
          }
          items.push({ icon: 'ph-download-simple', label: 'Open / download', fn: function () { Storage.openFile(file.objectKey, file.fileName, file.id); } });
          items.push({ icon: 'ph-trash', label: 'Delete', danger: true, fn: function () { deleteFiles([id]); } });
          openMenu(b, items); break;
        }
        case 'foldermenu': {
          var fo = folderById(id); if (!fo) break;
          openMenu(b, [
            { icon: 'ph-pencil-simple', label: 'Rename', fn: function () { nameDialog('Rename folder', fo.name, 'Folder name').then(function (n) { if (n && n !== fo.name) run(function () { return op('folder.rename', { id: id, name: n }); }, 'Folder renamed.'); }); } },
            { icon: 'ph-arrows-out-line-horizontal', label: 'Move to…', fn: function () { folderPicker('Move folder "' + fo.name + '"', descendantsOf(id), fo.parentId || null).then(function (r) { if (r) run(function () { return op('folder.move', { id: id, parentId: r.id }); }, 'Folder moved.'); }); } },
            { icon: 'ph-trash', label: 'Delete', danger: true, fn: function () {
              confirmDanger('Delete folder "' + fo.name + '"?', 'The folder and its subfolders are removed. Files inside are not deleted; they move up to the parent folder.').then(function (ok) { if (ok) run(function () { return op('folder.delete', { id: id }); }, 'Folder deleted.'); });
            } }
          ]); break;
        }
        case 'collmenu': {
          var co = collById(id); if (!co) break;
          openMenu(b, [
            { icon: 'ph-pencil-simple', label: 'Rename', fn: function () { nameDialog('Rename collection', co.name, 'Collection name').then(function (n) { if (n && n !== co.name) run(function () { return op('collection.rename', { id: id, name: n }); }, 'Collection renamed.'); }); } },
            { icon: 'ph-trash', label: 'Delete', danger: true, fn: function () {
              confirmDanger('Delete collection "' + co.name + '"?', 'Only the collection is removed. Its files stay where they are.').then(function (ok) { if (ok) run(function () { return op('collection.delete', { id: id }); }, 'Collection deleted.'); });
            } }
          ]); break;
        }
      }
    });
  }

  /* ══════════════════════════════════════════════════════════
     UPLOAD MODAL (multi-file queue)
  ══════════════════════════════════════════════════════════ */
  var classCache = null, studentCache = null;

  async function openUpload(opts, dest) {
    injectStyles();
    var old = document.getElementById('fmUpload'); if (old) old.remove();
    var isT = opts.uploaderRole === 'teacher';
    var uid = opts.uploaderUid;
    dest = dest || {};
    if (!M || M.ctx.uid !== uid) {
      // opened outside the panel: load folders/collections for the pickers
      M = M || { ctx: { role: isT ? 'teacher' : 'student', uid: uid, name: opts.uploaderName, cls: opts.uploaderClass || '' }, folders: [], collections: [], files: [], shared: [], selected: new Set(), loaded: false, tab: 'shared', folderId: null, collectionId: null, search: '', sort: 'newest' };
      try {
        var rr = await Promise.all([window.fbDb.collection('userFolders').where('ownerUid', '==', uid).get(), window.fbDb.collection('userCollections').where('ownerUid', '==', uid).get()]);
        M.folders = rr[0].docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
        M.collections = rr[1].docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      } catch (e) { /* pickers fall back to top level */ }
    }

    var st = {
      queue: [], busy: false, vis: isT ? 'all' : 'teacher', classes: new Set(), allClasses: [],
      studentUid: '', studentName: '', folderId: dest.folderId || '', collectionId: dest.collectionId || '', newColl: '',
      used: 0, limit: isT ? null : STUDENT_DAILY_LIMIT
    };
    var prev = document.activeElement;
    var ov = document.createElement('div');
    ov.id = 'fmUpload'; ov.className = 'fmd-ov';
    document.body.appendChild(ov);

    function remainingToday() { return st.limit === null ? Infinity : Math.max(0, st.limit - st.used); }
    function queuedCount() { return st.queue.filter(function (i) { return i.status === 'queued' || i.status === 'error'; }).length; }
    function validateFile(f) {
      if (isT) return '';
      var e = ext(f.name);
      if (STUDENT_EXTS.indexOf(e) === -1) return 'File type not allowed.';
      var vid = VIDEO_EXTS.indexOf(e) !== -1, cap = (vid ? STUDENT_MAX_VIDEO_MB : STUDENT_MAX_FILE_MB) * 1048576;
      return f.size > cap ? 'Too large. Maximum is ' + (vid ? STUDENT_MAX_VIDEO_MB : STUDENT_MAX_FILE_MB) + ' MB.' : '';
    }

    function limitsText() {
      if (isT) return 'Any file type. No size limit is set by the app (your storage provider still has its own limits).';
      return 'Up to ' + STUDENT_MAX_FILE_MB + ' MB per file (' + STUDENT_MAX_VIDEO_MB + ' MB for video). ' + st.used + ' of ' + st.limit + ' uploads used today.';
    }

    function canSubmit() {
      if (st.busy) return false;
      var ready = st.queue.filter(function (i) { return (i.status === 'queued' || i.status === 'error') && !i.invalid; });
      if (!ready.length) return false;
      if (!isT && ready.length > remainingToday()) return false;
      if (st.vis === 'class' && isT && !st.classes.size) return false;
      if (st.vis === 'student' && !st.studentUid) return false;
      return true;
    }

    function autoFolderName() {
      if (st.vis === 'class') { var c = Array.from(st.classes); return c.length === 1 ? c[0] + ' files' : c.length ? 'Class files' : ''; }
      if (st.vis === 'student') return st.studentName ? st.studentName + ' files' : 'Student files';
      if (st.vis === 'all') return 'General files';
      return '';
    }
    async function ensureFolder(name) {
      var ex = M.folders.filter(function (f) { return !f.parentId && f.name.toLowerCase() === name.toLowerCase(); })[0];
      if (ex) return ex.id;
      var id = (await op('folder.create', { name: name, parentId: null })).id;
      M.folders.push({ id: id, name: name, parentId: null, ownerUid: uid });
      return id;
    }

    function draw() {
      var fo = folderOptions(null);
      var h = '<div class="fmd fm" role="dialog" aria-modal="true" aria-labelledby="fmuT" style="gap:0">' +
        '<div class="fmd-h"><h2 id="fmuT">Upload files</h2><button type="button" class="fm-icon-btn" data-u="close" aria-label="Close">' + icon('ph-x', 16) + '</button></div><div class="fmd-b">';
      var limitHit = !isT && remainingToday() === 0 && !st.busy;
      if (limitHit) h += '<div class="fm-banner warn" role="alert">You have used all ' + st.limit + ' uploads for today. Try again tomorrow.</div>';
      h += '<p class="fm-banner info" style="margin:0">' + esc(limitsText()) + '</p>';
      h += '<div class="fm-drop' + (limitHit || st.busy ? ' off' : '') + '" id="fmDrop" tabindex="0" role="button" aria-label="Choose files to upload">' +
        icon('ph-cloud-arrow-up', 30) + '<p style="margin:.375rem 0 .125rem;font-weight:600;color:var(--text-2)">Choose files or drop them here</p><p style="margin:0;font-size:.75rem;color:var(--text-4)">You can select many files at once</p></div>' +
        '<input type="file" id="fmFiles" multiple style="display:none"' + (isT ? '' : ' accept=".' + STUDENT_EXTS.join(',.') + '"') + '>';
      if (st.queue.length) {
        h += '<div class="fm-q" id="fmQ" aria-live="polite">' + st.queue.map(queueItem).join('') + '</div>';
      } else {
        h += '<p style="margin:0;font-size:.8125rem;color:var(--text-4);text-align:center">No files selected yet.</p>';
      }
      if (!isT && st.queue.length) {
        var rdy = st.queue.filter(function (i) { return (i.status === 'queued' || i.status === 'error') && !i.invalid; }).length;
        if (rdy > remainingToday() && remainingToday() > 0) h += '<div class="fm-banner warn" role="alert">You can upload ' + remainingToday() + ' more file' + (remainingToday() === 1 ? '' : 's') + ' today. Remove ' + (rdy - remainingToday()) + ' from the queue to continue.</div>';
      }
      h += '<div><span class="lbl" style="display:block;font-size:.75rem;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.375rem">Save in</span>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem"><div><label class="lbl" for="fmuFolder" style="font-size:.6875rem">Folder</label><select id="fmuFolder"' + (st.busy ? ' disabled' : '') + '><option value="">My Files</option>' +
        fo.map(function (o) { return '<option value="' + esc(o.id) + '"' + (st.folderId === o.id ? ' selected' : '') + '>' + '\u00A0\u00A0'.repeat(o.depth) + esc(o.name) + '</option>'; }).join('') + '<option value="__new"' + (st.folderId === '__new' ? ' selected' : '') + '>New folder…</option></select></div>' +
        '<div><label class="lbl" for="fmuColl" style="font-size:.6875rem">Collection</label><select id="fmuColl"' + (st.busy ? ' disabled' : '') + '><option value="">None</option>' +
        M.collections.map(function (c) { return '<option value="' + esc(c.id) + '"' + (st.collectionId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '<option value="__new">New collection…</option></select></div></div>' +
        '<div id="fmuNewFolderWrap" style="margin-top:.5rem"' + (st.folderId === '__new' ? '' : ' hidden') + '><input type="text" id="fmuNewFolder" maxlength="80" placeholder="New folder name" aria-label="New folder name" value="' + esc(st.newFolder || '') + '"></div>' +
        (isT && st.vis !== 'private' && !st.folderId ? '<p style="margin:.5rem 0 0;font-size:.75rem;color:var(--text-3)">A folder for students is created automatically' + (autoFolderName() ? ': ' + esc(autoFolderName()) : '') + '.</p>' : '') +
        '<div id="fmuNewWrap" style="margin-top:.5rem"' + (st.collectionId === '__new' ? '' : ' hidden') + '><input type="text" id="fmuNew" maxlength="80" placeholder="New collection name" aria-label="New collection name" value="' + esc(st.newColl) + '"></div></div>';
      h += '<div><span style="display:block;font-size:.75rem;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.375rem">Who is this for?</span><div class="fm-vis" role="group" aria-label="Who is this for">' +
        (isT ? [['all', 'All students'], ['class', 'Classes'], ['student', '1 student'], ['private', 'Only me']] : [['teacher', 'Teacher'], ['class', 'My class'], ['private', 'Only me']])
          .map(function (v) { return '<button type="button" data-vis="' + v[0] + '" aria-pressed="' + (st.vis === v[0]) + '"' + (st.busy ? ' disabled' : '') + '>' + v[1] + '</button>'; }).join('') + '</div></div>';
      if (isT && st.vis === 'class') {
        h += '<div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.375rem"><span style="font-size:.75rem;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em">Select classes</span>' +
          '<span><button type="button" class="fm-crumb" data-u="allcls">Select all</button><button type="button" class="fm-crumb" data-u="nocls">Clear all</button></span></div>';
        h += st.allClasses.length ? '<div class="fm-pick" style="max-height:160px" role="group" aria-label="Classes">' + st.allClasses.map(function (c) {
          return '<label><input type="checkbox" data-cls="' + esc(c) + '"' + (st.classes.has(c) ? ' checked' : '') + (st.busy ? ' disabled' : '') + '> ' + esc(c) + '</label>';
        }).join('') + '</div>' : '<p style="margin:0;font-size:.8125rem;color:var(--text-3)">Loading classes…</p>';
        h += st.classes.size ? '<div class="fm-chips" style="margin-top:.5rem" aria-label="Selected classes">' + Array.from(st.classes).map(function (c) {
          return '<button type="button" class="fm-chip" data-rmcls="' + esc(c) + '" aria-label="Remove ' + esc(c) + '">' + esc(c) + ' ' + icon('ph-x', 11) + '</button>';
        }).join('') + '</div><p style="margin:.375rem 0 0;font-size:.75rem;color:var(--text-3)">Files will be shared with ' + st.classes.size + (st.classes.size === 1 ? ' class' : ' classes') + ': ' + esc(Array.from(st.classes).join(', ')) + '.</p>'
          : '<p style="margin:.375rem 0 0;font-size:.75rem;color:var(--danger)">Choose at least one class.</p>';
        h += '</div>';
      }
      if (isT && st.vis === 'student') {
        h += '<div><label class="lbl" for="fmuStu">Student</label><select id="fmuStu"><option value="">' + (studentCache ? 'Choose a student…' : 'Loading students…') + '</option>' +
          (studentCache || []).map(function (s) { return '<option value="' + esc(s.uid) + '"' + (st.studentUid === s.uid ? ' selected' : '') + '>' + esc(s.name) + (s.cls ? ' (' + esc(s.cls) + ')' : '') + '</option>'; }).join('') + '</select></div>';
      }
      if (!isT && st.vis === 'class') h += '<p class="fm-banner info" style="margin:0">Shared with your class' + (opts.uploaderClass ? ': ' + esc(opts.uploaderClass) : '') + '.</p>';
      h += '<div><label class="lbl" for="fmuDesc">Description <span style="font-weight:400;text-transform:none">(optional)</span></label><input type="text" id="fmuDesc" maxlength="300" placeholder="What is this for?"' + (st.busy ? ' disabled' : '') + ' value="' + esc(st.desc || '') + '"></div>';
      if (isT) h += '<div><label class="lbl" for="fmuExp">Auto-remove for students <span style="font-weight:400;text-transform:none">(optional)</span></label><input type="datetime-local" id="fmuExp"' + (st.busy ? ' disabled' : '') + ' value="' + esc(st.exp || '') + '"></div>';
      h += '<p class="fmd-err" id="fmuErr" role="alert" hidden></p></div>';
      var failed = st.queue.filter(function (i) { return i.status === 'error'; }).length;
      var done = st.queue.filter(function (i) { return i.status === 'done'; }).length;
      var n = queuedCount();
      h += '<div class="fmd-f"><button type="button" class="fm-btn" data-u="close">' + (done && !n ? 'Done' : 'Cancel') + '</button>' +
        '<button type="button" class="fm-btn primary" data-u="go"' + (canSubmit() ? '' : ' disabled') + '>' + (st.busy ? 'Uploading…' : failed ? 'Retry ' + failed + ' failed' + (n > failed ? ' + upload ' + (n - failed) + ' more' : '') : n ? 'Upload ' + n + (n === 1 ? ' file' : ' files') : 'Upload') + '</button></div></div>';
      var active = document.activeElement && document.activeElement.id;
      var qScroll = document.getElementById('fmQ') ? document.getElementById('fmQ').scrollTop : 0;
      ov.innerHTML = h;
      var q = document.getElementById('fmQ'); if (q) q.scrollTop = qScroll;
      if (active && document.getElementById(active) && active !== 'fmuDesc') document.getElementById(active).focus();
    }

    function queueItem(i) {
      var s = i.status;
      var line = s === 'queued' ? (i.invalid ? esc(i.invalid) : 'Ready') : s === 'uploading' ? i.msg || 'Uploading…' : s === 'done' ? 'Uploaded' : esc(i.error || 'Failed');
      var color = (s === 'error' || i.invalid) ? 'var(--danger)' : s === 'done' ? 'var(--success,var(--accent))' : 'var(--text-3)';
      return '<div class="fm-qi' + ((s === 'error' || i.invalid) ? ' err' : '') + '" data-q="' + i.id + '">' +
        '<span style="color:var(--accent);display:inline-flex">' + icon(s === 'done' ? 'ph-check-circle' : fileIcon(ext(i.file.name)), 22) + '</span>' +
        '<div style="flex:1;min-width:0"><div class="fm-row-name">' + esc(i.file.name) + '</div>' +
        '<div class="fm-row-meta" style="color:' + color + '">' + fmtBytes(i.file.size) + ' · ' + line + '</div>' +
        (s === 'uploading' ? '<div class="fm-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + i.pct + '"><span style="width:' + i.pct + '%"></span></div>' : '') + '</div>' +
        (s === 'error' && !i.invalid ? '<button type="button" class="fm-icon-btn" data-retry="' + i.id + '" aria-label="Retry ' + esc(i.file.name) + '"' + (st.busy ? ' disabled' : '') + '>' + icon('ph-arrow-clockwise', 16) + '</button>' : '') +
        (s !== 'uploading' && s !== 'done' ? '<button type="button" class="fm-icon-btn" data-rm="' + i.id + '" aria-label="Remove ' + esc(i.file.name) + ' from queue"' + (st.busy ? ' disabled' : '') + '>' + icon('ph-x', 16) + '</button>' : '') + '</div>';
    }

    function patchItem(i) {
      var el = ov.querySelector('[data-q="' + i.id + '"]');
      if (!el) return;
      var tmp = document.createElement('div'); tmp.innerHTML = queueItem(i);
      el.replaceWith(tmp.firstChild);
    }

    function addFiles(list) {
      var added = 0, dup = 0;
      Array.prototype.forEach.call(list, function (f) {
        var sig = f.name + '|' + f.size + '|' + f.lastModified;
        if (st.queue.some(function (q) { return q.sig === sig && q.status !== 'done'; })) { dup++; return; }
        var inv = validateFile(f);
        st.queue.push({ id: uid8(), file: f, sig: sig, status: 'queued', pct: 0, invalid: inv, key: '', error: '' });
        added++;
      });
      if (dup) showErr(dup + (dup === 1 ? ' file was' : ' files were') + ' already in the queue.');
      draw();
    }
    function showErr(m) { var e = document.getElementById('fmuErr'); if (e) { e.textContent = m; e.hidden = !m; } }

    function close() {
      var keys = st.queue.filter(function (i) { return i.status !== 'done' && i.key; }).map(function (i) { return i.key; });
      if (keys.length && !isT) api('/storage/release', { keys: keys }).catch(function () { });
      document.removeEventListener('keydown', onKey, true);
      ov.remove();
      if (prev && prev.focus) prev.focus();
      if (M && M.id && document.getElementById(M.id)) refresh();
    }
    function onKey(e) {
      if (e.key === 'Escape' && !st.busy) { e.stopPropagation(); close(); }
      if (e.key === 'Tab') {
        var dlg = ov.querySelector('.fmd'); if (!dlg) return;
        var f = dlg.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type=file]),select:not([disabled])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);

    function xhrPut(item, url) {
      return new Promise(function (resolve, reject) {
        var x = new XMLHttpRequest();
        x.open('PUT', url);
        x.setRequestHeader('Content-Type', item.file.type || 'application/octet-stream');
        x.upload.onprogress = function (e) {
          if (!e.lengthComputable) return;
          item.pct = Math.round(e.loaded / e.total * 100); item.msg = 'Uploading… ' + item.pct + '%';
          var el = ov.querySelector('[data-q="' + item.id + '"]');
          if (el) {
            var bar = el.querySelector('.fm-bar span'); if (bar) bar.style.width = item.pct + '%';
            var meta = el.querySelector('.fm-row-meta'); if (meta) meta.textContent = fmtBytes(item.file.size) + ' · ' + item.msg;
          }
        };
        x.onload = function () { x.status >= 200 && x.status < 300 ? resolve() : reject(new Error('Upload failed (HTTP ' + x.status + ').')); };
        x.onerror = function () { reject(new Error('Network error. Check your connection and retry.')); };
        x.onabort = function () { reject(new Error('Upload cancelled.')); };
        x.send(item.file); // streamed from disk, never read into memory
      });
    }

    async function submit() {
      if (!canSubmit()) return;
      var items = st.queue.filter(function (i) { return (i.status === 'queued' || i.status === 'error') && !i.invalid; });
      showErr('');
      st.busy = true;
      st.desc = (document.getElementById('fmuDesc') || {}).value || st.desc || '';
      var expEl = document.getElementById('fmuExp'); st.exp = expEl ? expEl.value : st.exp;
      var newEl = document.getElementById('fmuNew'); if (newEl) st.newColl = newEl.value.trim();
      var nfEl = document.getElementById('fmuNewFolder'); if (nfEl) st.newFolder = nfEl.value.trim();
      items.forEach(function (i) {
        if (!i.key) i.key = 'uploads/' + uid + '/' + Date.now() + '_' + uid8() + '_' + i.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
        i.status = 'uploading'; i.pct = 0; i.msg = 'Waiting…'; i.error = '';
      });
      draw();

      try {
        // create a new collection first if requested (server validates)
        var collId = st.collectionId || null;
        if (collId === '__new') {
          if (!st.newColl) throw new Error('Enter a name for the new collection.');
          collId = (await op('collection.create', { name: st.newColl })).id;
          M.collections.push({ id: collId, name: st.newColl, ownerUid: uid });
          st.collectionId = collId; st.newColl = '';
        }
        var folderId = st.folderId || null;
        if (folderId === '__new') {
          if (!st.newFolder) throw new Error('Enter a name for the new folder.');
          folderId = await ensureFolder(st.newFolder.trim()); st.folderId = folderId; st.newFolder = '';
        } else if (!folderId && isT && st.vis !== 'private' && autoFolderName()) {
          folderId = await ensureFolder(autoFolderName());
        }
        var pre = await api('/storage/presign-upload', {
          files: items.map(function (i) { return { key: i.key, name: i.file.name, size: i.file.size, type: i.file.type || 'application/octet-stream' }; })
        });
        if (pre.used !== undefined) st.used = pre.used;
        var urls = {}; pre.items.forEach(function (p) { urls[p.key] = p.url; });

        var idx = 0;
        async function worker() {
          while (idx < items.length) {
            var item = items[idx++];
            try {
              item.msg = 'Uploading… 0%'; patchItem(item);
              await xhrPut(item, urls[item.key]);
              item.msg = 'Saving…'; item.pct = 100; patchItem(item);
              await api('/storage/commit', {
                key: item.key, name: item.file.name, type: item.file.type || 'application/octet-stream',
                description: (document.getElementById('fmuDesc') || {}).value || st.desc || '',
                sharedWith: st.vis,
                targetClasses: st.vis === 'class' && isT ? Array.from(st.classes) : [],
                targetStudentUid: st.vis === 'student' ? st.studentUid : null,
                expiresAt: st.exp ? new Date(st.exp).getTime() : null,
                folderId: folderId, collectionId: collId
              });
              item.status = 'done';
            } catch (e) {
              item.status = 'error'; item.error = e.message || 'Upload failed.';
              if (e.code === 'daily_limit') { item.invalid = ''; }
            }
            patchItem(item);
          }
        }
        var pool = []; for (var k = 0; k < Math.min(CONCURRENCY, items.length); k++) pool.push(worker());
        await Promise.all(pool);
      } catch (e) {
        items.forEach(function (i) { if (i.status === 'uploading') { i.status = 'error'; i.error = e.message; } });
        if (e.code === 'daily_limit' && e.data) { st.used = e.data.used; }
        showErr(e.message || 'Upload failed.');
      }

      st.busy = false;
      var ok = items.filter(function (i) { return i.status === 'done'; }).length;
      var bad = items.length - ok;
      if (!isT) { try { var qq = await api('/storage/quota'); st.used = qq.used; } catch (e) { } }
      draw();
      if (ok) toast(ok + (ok === 1 ? ' file uploaded.' : ' files uploaded.'), 'success');
      if (bad) showErr(bad + (bad === 1 ? ' file' : ' files') + ' failed. Use the retry button on each file, or the Retry button below.');
      if (M && document.getElementById(M.id)) refresh();
    }

    ov.addEventListener('click', function (e) {
      var t = e.target;
      if (t === ov && !st.busy) return close();
      var b = t.closest('button'); 
      if (t.closest('#fmDrop') && !st.busy) { var fi = document.getElementById('fmFiles'); if (fi) fi.click(); return; }
      if (!b) return;
      if (b.dataset.u === 'close') { if (!st.busy) close(); }
      else if (b.dataset.u === 'go') submit();
      else if (b.dataset.u === 'allcls') { st.classes = new Set(st.allClasses); draw(); }
      else if (b.dataset.u === 'nocls') { st.classes.clear(); draw(); }
      else if (b.dataset.rmcls) { st.classes.delete(b.dataset.rmcls); draw(); }
      else if (b.dataset.vis) { st.vis = b.dataset.vis; if (isT && st.vis === 'class') loadClasses(); if (isT && st.vis === 'student') loadStudents(); draw(); }
      else if (b.dataset.rm) {
        var it = st.queue.filter(function (i) { return i.id === b.dataset.rm; })[0];
        if (it && it.key && !isT) api('/storage/release', { keys: [it.key] }).then(function (r) { if (r && r.used !== undefined) { st.used = r.used; draw(); } }).catch(function () { });
        st.queue = st.queue.filter(function (i) { return i.id !== b.dataset.rm; }); draw();
      }
      else if (b.dataset.retry) { var r = st.queue.filter(function (i) { return i.id === b.dataset.retry; })[0]; if (r) { r.status = 'queued'; r.error = ''; submitOnly(r); } }
    });
    function submitOnly(item) {
      // retry a single file: mark only it as ready, upload via the same pipeline
      st.queue.forEach(function (i) { if (i !== item && i.status === 'error') i._hold = true; });
      var held = st.queue.filter(function (i) { return i._hold; });
      held.forEach(function (i) { i.status = 'held'; delete i._hold; });
      submit().then(function () { held.forEach(function (i) { i.status = 'error'; }); draw(); });
    }
    ov.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'fmFiles') { addFiles(t.files); t.value = ''; }
      else if (t.id === 'fmuFolder') { st.folderId = t.value; draw(); if (t.value === '__new') { var nf = document.getElementById('fmuNewFolder'); if (nf) nf.focus(); } }
      else if (t.id === 'fmuColl') { st.collectionId = t.value; var w = document.getElementById('fmuNewWrap'); if (w) w.hidden = t.value !== '__new'; if (t.value === '__new') document.getElementById('fmuNew').focus(); }
      else if (t.dataset && t.dataset.cls) { t.checked ? st.classes.add(t.dataset.cls) : st.classes.delete(t.dataset.cls); draw(); }
      else if (t.id === 'fmuStu') { st.studentUid = t.value; var sc = (studentCache || []).filter(function (x) { return x.uid === t.value; })[0]; st.studentName = sc ? sc.name : ''; draw(); }
      else if (t.id === 'fmuExp') st.exp = t.value;
    });
    ov.addEventListener('input', function (e) { if (e.target.id === 'fmuDesc') st.desc = e.target.value; if (e.target.id === 'fmuNew') st.newColl = e.target.value; if (e.target.id === 'fmuNewFolder') st.newFolder = e.target.value; });
    ov.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'fmDrop') { e.preventDefault(); var fi = document.getElementById('fmFiles'); if (fi) fi.click(); }
    });
    ov.addEventListener('dragover', function (e) { if (st.busy) return; e.preventDefault(); var d = document.getElementById('fmDrop'); if (d) d.classList.add('over'); });
    ov.addEventListener('dragleave', function (e) { var d = document.getElementById('fmDrop'); if (d && !ov.contains(e.relatedTarget)) d.classList.remove('over'); });
    ov.addEventListener('drop', function (e) {
      e.preventDefault(); var d = document.getElementById('fmDrop'); if (d) d.classList.remove('over');
      if (st.busy || !e.dataTransfer || !e.dataTransfer.files.length) return;
      if (!isT && remainingToday() === 0) return;
      addFiles(e.dataTransfer.files);
    });

    async function loadClasses() {
      if (st.allClasses.length) return;
      try {
        if (!classCache) classCache = (await op('classes')).classes;
        st.allClasses = classCache; draw();
      } catch (e) { showErr('Could not load classes: ' + e.message); }
    }
    async function loadStudents() {
      if (studentCache) return;
      try {
        var snap = await window.fbDb.collection('students').orderBy('name').get();
        studentCache = snap.docs.map(function (d) { var x = d.data(); return { uid: d.id, name: x.name || 'Unnamed', cls: x.class || '' }; });
        draw();
      } catch (e) { showErr('Could not load students.'); }
    }

    draw();
    var df = document.getElementById('fmDrop'); if (df) df.focus();
    if (!isT) api('/storage/quota').then(function (q) { st.used = q.used; draw(); }).catch(function () { });
  }

  window.FileManager = { mount: mount, openUpload: openUpload, refresh: refresh };
}());
