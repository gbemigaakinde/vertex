/* ============================================================
   viewer.js — in-app file viewer (modal) + threaded feedback
   Public API:
     Viewer.open({ docId, objectKey, fileName })
     Viewer.close()
   Files are streamed through the Worker (/storage/view) so no
   download is needed. Feedback threads use /files/op comment.*
   ============================================================ */
(function () {
  'use strict';

  var WORKER_URL = 'https://vertex-worker.gbemigaakinde.workers.dev';
  var CDN = {
    pdf:    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfw:   'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    mammoth:'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
    xlsx:   'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  };

  var IMG = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
  var VID = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'];
  var AUD = ['mp3', 'wav', 'ogg', 'm4a'];
  var TXT = ['txt', 'md', 'json', 'js', 'css', 'html', 'py', 'log', 'xml', 'yml', 'yaml'];
  var OFFICE_EMBED = ['ppt', 'pptx', 'doc', 'xls'];
  var MAX_INLINE_MB = 100;      // pdf/docx/xlsx/image are loaded into memory
  var MAX_TEXT_BYTES = 2 * 1024 * 1024;
  var MAX_SHEET_ROWS = 2000, MAX_SHEET_COLS = 60;

  var STATUS = {
    pending:        { label: 'Awaiting review', cls: 'pending' },
    reviewed:       { label: 'Reviewed',        cls: 'reviewed' },
    needs_revision: { label: 'Needs revision',  cls: 'revise' },
    approved:       { label: 'Approved',        cls: 'approved' },
  };

  /* ── tiny helpers ─────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ext(n) { var p = String(n || '').split('.'); return p.length > 1 ? p.pop().toLowerCase() : ''; }
  function fmtBytes(b) {
    b = Number(b) || 0;
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
    return (b / 1073741824).toFixed(2) + ' GB';
  }
  function toDate(v) {
    if (!v) return null;
    if (v.toDate) return v.toDate();
    if (v.seconds) return new Date(v.seconds * 1000);
    var d = new Date(v); return isNaN(d) ? null : d;
  }
  function ago(v) {
    var d = toDate(v); if (!d) return '';
    var s = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (s < 45) return 'just now';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    if (s < 604800) return Math.round(s / 86400) + 'd ago';
    return d.toLocaleDateString();
  }
  function toast(msg, type) { if (window.UI && UI.toast) UI.toast(msg, type || 'info', 4000); }

  var _scripts = {};
  function loadScript(src) {
    if (_scripts[src]) return _scripts[src];
    _scripts[src] = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () { delete _scripts[src]; s.remove(); rej(new Error('Could not load the viewer component. Check your connection.')); };
      document.head.appendChild(s);
    });
    return _scripts[src];
  }

  async function authHeaders(force) {
    var u = (window.fbAuth && window.fbAuth.currentUser) || (window.firebase && firebase.auth && firebase.auth().currentUser);
    if (!u) throw new Error('Please sign in again.');
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (await u.getIdToken(!!force)) };
  }

  async function post(path, body, opts) {
    opts = opts || {};
    if (navigator.onLine === false) throw new Error('You are offline. Reconnect and try again.');
    for (var attempt = 0; attempt < 2; attempt++) {
      var res = await fetch(WORKER_URL + path, {
        method: 'POST', headers: await authHeaders(attempt > 0),
        body: JSON.stringify(body), signal: opts.signal,
      });
      if (res.status === 401 && attempt === 0) continue; // refresh token once
      return res;
    }
  }
  async function postJson(path, body, opts) {
    var res = await post(path, body, opts);
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) { var e = new Error(data.error || 'Request failed (' + res.status + ').'); e.status = res.status; throw e; }
    return data;
  }
  function op(action, extra) { return postJson('/files/op', Object.assign({ action: action }, extra)); }

  /* ── styles ───────────────────────────────────────────── */
  var _styled = false;
  function injectStyles() {
    if (_styled) return; _styled = true;
    var css = [
      '.vv-ov{position:fixed;inset:0;z-index:100000;background:rgba(8,10,14,.72);display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(3px);animation:vvIn .14s ease-out}',
      '@keyframes vvIn{from{opacity:0}to{opacity:1}}',
      '.vv-dlg{position:relative;width:min(1280px,100%);height:min(900px,100%);display:flex;flex-direction:column;background:var(--bg-base,#fff);color:var(--text-1,#111);border:1px solid var(--border,#ddd);border-radius:var(--r-xl,16px);box-shadow:0 24px 70px rgba(0,0,0,.45);overflow:hidden}',
      '.vv-head{display:flex;align-items:center;gap:.625rem;padding:.625rem .75rem;border-bottom:1px solid var(--border,#ddd);flex-shrink:0}',
      '.vv-title{min-width:0;flex:1}',
      '.vv-name{font-size:.9375rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.vv-meta{font-size:.75rem;color:var(--text-3,#777);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.vv-btn{display:inline-flex;align-items:center;justify-content:center;gap:.375rem;min-height:38px;min-width:38px;padding:0 .75rem;border-radius:var(--r-lg,10px);border:1px solid var(--border,#ddd);background:var(--bg-subtle,#f6f6f6);color:var(--text-2,#333);font:600 .8125rem var(--font,inherit);cursor:pointer;position:relative}',
      '.vv-btn:hover{background:var(--bg-muted,#eee)}',
      '.vv-btn.on{background:var(--accent-subtle,#e8f0ff);border-color:var(--accent-border,#9bb8f5);color:var(--accent-text,#1d4ed8)}',
      '.vv-btn.icon{padding:0}',
      '.vv-btn[disabled]{opacity:.5;cursor:not-allowed}',
      '.vv-dot{position:absolute;top:5px;right:5px;width:9px;height:9px;border-radius:50%;background:var(--danger,#e11d48);border:2px solid var(--bg-base,#fff)}',
      '.vv-count{margin-left:.125rem;font-size:.6875rem;background:var(--accent,#2563eb);color:#fff;border-radius:99px;padding:0 .4rem;min-width:18px;line-height:18px;text-align:center}',
      '.vv-body{flex:1;min-height:0;display:flex;position:relative}',
      '.vv-stage{flex:1;min-width:0;position:relative;background:var(--bg-muted,#eceff3);display:flex;flex-direction:column}',
      '.vv-tools{display:flex;align-items:center;gap:.375rem;padding:.375rem .625rem;background:var(--bg-base,#fff);border-bottom:1px solid var(--border,#ddd);flex-shrink:0;flex-wrap:wrap}',
      '.vv-tools .vv-btn{min-height:32px;min-width:32px;padding:0 .5rem}',
      '.vv-tools .sp{flex:1}',
      '.vv-tools .vv-jump{width:52px!important;min-width:0!important;height:32px!important;min-height:32px!important;padding:0 .25rem!important;margin:0!important;box-sizing:border-box;text-align:center;border-radius:var(--r-lg,10px);border:1px solid var(--border,#ddd);background:var(--bg-subtle,#f6f6f6);color:var(--text-1,#111);font:600 .8125rem var(--font,inherit);-moz-appearance:textfield;flex:0 0 auto}',
      '.vv-tools .vv-jump[data-rj]{width:84px!important}',
      '.vv-tools .vv-jump::-webkit-outer-spin-button,.vv-tools .vv-jump::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}',
      '.vv-pg{display:inline-flex;align-items:center;gap:.25rem;flex-shrink:0;white-space:nowrap}',
      '.vv-pg .lbl{min-width:0!important;text-align:left}',
      '@media(max-width:520px){.vv-tools{gap:.25rem;padding:.375rem .5rem}.vv-tools .sp{display:none}.vv-tools .lbl{min-width:0}.vv-tools>.lbl{flex:1;text-align:center}.vv-pg{margin-left:auto}}',
      '.vv-jump::-webkit-outer-spin-button,.vv-jump::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}',
      '.vv-jumpbox{display:inline-flex;align-items:center;gap:.25rem;flex-shrink:0;white-space:nowrap;font-size:.75rem;color:var(--text-3,#777);margin-left:auto}',
      '.vv-sheet tr{scroll-margin-top:34px}',
      '.vv-sheet tr.hit td{background:var(--accent-subtle,#e8f0ff);transition:background .3s}',
      '.vv-tools .lbl{font-size:.75rem;color:var(--text-3,#777);min-width:60px;text-align:center}',
      '.vv-view{flex:1;min-height:0;position:relative;overflow:auto;-webkit-overflow-scrolling:touch}',
      '.vv-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.75rem;padding:1.5rem;text-align:center;color:var(--text-2,#333)}',
      '.vv-center p{max-width:360px;font-size:.875rem;line-height:1.5}',
      '.vv-spin{width:34px;height:34px;border-radius:50%;border:3px solid var(--border,#ddd);border-top-color:var(--accent,#2563eb);animation:vvSpin .8s linear infinite}',
      '@keyframes vvSpin{to{transform:rotate(360deg)}}',
      '.vv-bar{width:200px;height:4px;border-radius:4px;background:var(--border,#ddd);overflow:hidden}',
      '.vv-bar i{display:block;height:100%;width:0;background:var(--accent,#2563eb);transition:width .15s}',
      '.vv-img-wrap{position:absolute;inset:0;overflow:hidden;touch-action:none;cursor:grab;display:flex;align-items:center;justify-content:center}',
      '.vv-img-wrap.drag{cursor:grabbing}',
      '.vv-img-wrap img{max-width:100%;max-height:100%;transform-origin:center center;user-select:none;-webkit-user-drag:none;will-change:transform}',
      '.vv-pages{display:flex;flex-direction:column;align-items:center;gap:12px;padding:12px}',
      '.vv-page{background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.18);position:relative;flex-shrink:0}',
      '.vv-page canvas{display:block;width:100%;height:100%}',
      '.vv-media{position:absolute;inset:0;width:100%;height:100%;background:#000;object-fit:contain}',
      '.vv-audio{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(520px,92%)}',
      '.vv-text{margin:0;padding:1rem 1.25rem;font:.8125rem/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word;background:var(--bg-base,#fff);color:var(--text-1,#111);min-height:100%;box-sizing:border-box;tab-size:4}',
      '.vv-doc{max-width:860px;margin:12px auto;padding:2rem 2.25rem;background:#fff;color:#111;box-shadow:0 2px 10px rgba(0,0,0,.15);line-height:1.6;font-size:.9375rem;overflow-wrap:anywhere}',
      '.vv-doc img{max-width:100%;height:auto}.vv-doc table{border-collapse:collapse;max-width:100%}.vv-doc td,.vv-doc th{border:1px solid #ccc;padding:4px 8px}',
      '.vv-sheet{border-collapse:collapse;font-size:.8125rem;background:var(--bg-base,#fff);color:var(--text-1,#111)}',
      '.vv-sheet td,.vv-sheet th{border:1px solid var(--border,#ddd);padding:4px 8px;white-space:nowrap;max-width:320px;overflow:hidden;text-overflow:ellipsis}',
      '.vv-sheet th{background:var(--bg-subtle,#f3f4f6);position:sticky;top:0;z-index:1}',
      '.vv-sheet td.n{color:var(--text-4,#888);background:var(--bg-subtle,#f3f4f6);text-align:right}',
      '.vv-tabs{display:flex;gap:.25rem;overflow-x:auto;flex:1}',
      '.vv-tabs .vv-btn{white-space:nowrap}',
      '.vv-frame{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}',
      '.vv-note{font-size:.75rem;color:var(--text-3,#777);padding:.5rem .875rem;background:var(--bg-base,#fff);border-top:1px solid var(--border,#ddd)}',
      /* feedback */
      '.vv-fb{width:360px;max-width:100%;flex-shrink:0;border-left:1px solid var(--border,#ddd);background:var(--bg-base,#fff);display:none;flex-direction:column;min-height:0}',
      '.vv-fb.open{display:flex}',
      '.vv-fb-head{padding:.75rem .875rem;border-bottom:1px solid var(--border,#ddd);display:flex;flex-direction:column;gap:.5rem}',
      '.vv-fb-title{font-weight:700;font-size:.875rem;display:flex;align-items:center;justify-content:space-between;gap:.5rem}',
      '.vv-status{display:inline-flex;align-items:center;font-size:.6875rem;font-weight:700;padding:.15rem .55rem;border-radius:99px;border:1px solid var(--border,#ddd);background:var(--bg-subtle,#f6f6f6);color:var(--text-2,#333)}',
      '.vv-status.pending{background:#fff7e6;border-color:#f5d28a;color:#8a5a00}',
      '.vv-status.reviewed{background:#e8f0ff;border-color:#9bb8f5;color:#1d4ed8}',
      '.vv-status.revise{background:#fff0f0;border-color:#f0a5a5;color:#b42323}',
      '.vv-status.approved{background:#e7f8ee;border-color:#8fd6aa;color:#16794a}',
      '.vv-fb select{min-height:36px;border-radius:var(--r-lg,10px);border:1px solid var(--border,#ddd);background:var(--bg-subtle,#f6f6f6);color:var(--text-1,#111);padding:0 .5rem;font:600 .8125rem var(--font,inherit)}',
      '.vv-thread{flex:1;min-height:0;overflow-y:auto;padding:.75rem .875rem;display:flex;flex-direction:column;gap:.625rem}',
      '.vv-empty{color:var(--text-3,#777);font-size:.8125rem;text-align:center;padding:2rem .5rem;line-height:1.5}',
      '.vv-c{display:flex;flex-direction:column;gap:.25rem}',
      '.vv-c-body{border:1px solid var(--border,#ddd);border-radius:12px;padding:.5rem .7rem;background:var(--bg-subtle,#f6f6f6)}',
      '.vv-c.mine>.vv-c-body{background:var(--accent-subtle,#e8f0ff);border-color:var(--accent-border,#9bb8f5)}',
      '.vv-c.del>.vv-c-body{opacity:.6;font-style:italic}',
      '.vv-c-top{display:flex;align-items:center;gap:.375rem;font-size:.75rem;margin-bottom:.125rem;flex-wrap:wrap}',
      '.vv-c-top b{font-weight:700;color:var(--text-1,#111)}',
      '.vv-role{font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:.05rem .4rem;border-radius:99px;background:var(--accent,#2563eb);color:#fff}',
      '.vv-role.student{background:var(--text-3,#777)}',
      '.vv-c-time{color:var(--text-3,#777)}',
      '.vv-c-text{font-size:.8125rem;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}',
      '.vv-c-act{display:flex;gap:.75rem;padding-left:.5rem}',
      '.vv-c-act button{border:none;background:none;color:var(--text-3,#777);font:600 .6875rem var(--font,inherit);cursor:pointer;padding:.2rem 0;min-height:24px}',
      '.vv-c-act button:hover{color:var(--accent-text,#1d4ed8)}',
      '.vv-c-act button.dng:hover{color:var(--danger,#e11d48)}',
      '.vv-kids{margin-left:.875rem;padding-left:.625rem;border-left:2px solid var(--border,#ddd);display:flex;flex-direction:column;gap:.625rem}',
      '.vv-compose{border-top:1px solid var(--border,#ddd);padding:.625rem .75rem;display:flex;flex-direction:column;gap:.375rem;flex-shrink:0}',
      '.vv-compose textarea{width:100%;box-sizing:border-box;min-height:64px;max-height:160px;resize:vertical;border-radius:10px;border:1px solid var(--border,#ddd);background:var(--bg-subtle,#f6f6f6);color:var(--text-1,#111);padding:.5rem .625rem;font:.8125rem/1.45 var(--font,inherit)}',
      '.vv-compose-row{display:flex;align-items:center;justify-content:space-between;gap:.5rem;font-size:.6875rem;color:var(--text-3,#777)}',
      '.vv-chip{display:flex;align-items:center;justify-content:space-between;gap:.5rem;font-size:.75rem;padding:.25rem .5rem;border-radius:8px;background:var(--bg-muted,#eee);color:var(--text-2,#333)}',
      '.vv-chip button{border:none;background:none;cursor:pointer;color:var(--text-3,#777);font-size:1rem;line-height:1}',
      '.vv-send{background:var(--accent,#2563eb);border-color:var(--accent,#2563eb);color:#fff}.vv-send:hover{background:var(--accent,#2563eb);opacity:.9}',
      '@media(max-width:820px){',
      '.vv-ov{padding:0}.vv-dlg{width:100%;height:100%;border-radius:0;border:none}',
      '.vv-fb{position:absolute;inset:0;width:100%;z-index:5;border-left:none}',
      '.vv-btn .t{display:none}',
      '}',
    ].join('\n');
    var st = document.createElement('style'); st.id = 'vv-styles'; st.textContent = css;
    document.head.appendChild(st);
  }

  /* ── session state ────────────────────────────────────── */
  var S = null; // current viewer session

  function ic(name) { return '<i class="ph ph-' + name + '" style="font-size:16px;pointer-events:none"></i>'; }

  async function open(opts) {
    opts = opts || {};
    if (!opts.docId && !opts.objectKey) { toast('This file cannot be opened.', 'error'); return; }
    if (S) close();
    injectStyles();

    var prevFocus = document.activeElement;
    var ov = document.createElement('div');
    ov.className = 'vv-ov';
    ov.innerHTML =
      '<div class="vv-dlg" role="dialog" aria-modal="true" aria-label="File viewer">' +
        '<div class="vv-head">' +
          '<div class="vv-title"><div class="vv-name">' + esc(opts.fileName || 'File') + '</div><div class="vv-meta">Loading…</div></div>' +
          '<button class="vv-btn" data-a="fb" style="display:none" aria-pressed="false" title="Feedback">' + ic('chat-circle-text') + '<span class="t">Feedback</span><span class="vv-count" style="display:none"></span><span class="vv-dot" style="display:none"></span></button>' +
          '<button class="vv-btn" data-a="dl" title="Download">' + ic('download-simple') + '<span class="t">Download</span></button>' +
          '<button class="vv-btn icon" data-a="close" aria-label="Close viewer" title="Close (Esc)">' + ic('x') + '</button>' +
        '</div>' +
        '<div class="vv-body">' +
          '<div class="vv-stage"><div class="vv-tools" style="display:none"></div><div class="vv-view"></div></div>' +
          '<aside class="vv-fb" aria-label="Feedback"></aside>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    S = {
      opts: opts, ov: ov, prevFocus: prevFocus, prevOverflow: prevOverflow,
      dlg: ov.firstChild, tools: ov.querySelector('.vv-tools'), view: ov.querySelector('.vv-view'),
      fb: ov.querySelector('.vv-fb'), meta: null, token: Date.now() + Math.random(),
      abort: new AbortController(), blobUrl: null, cleanup: [], poll: null,
      fbOpen: false, replyTo: null, editing: null, comments: [], sending: false,
    };
    var mySession = S;

    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    ov.addEventListener('click', onHeadClick);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('online', onOnline);
    S.dlg.querySelector('[data-a="close"]').focus();

    setCenter('loading', 'Loading file…');

    // 1) metadata + access check
    var info;
    try {
      info = await op('file.info', { docId: opts.docId, objectKey: opts.objectKey });
    } catch (e) {
      if (S !== mySession) return;
      info = null;
      if (e.status === 403 || e.status === 404 || e.status === 410) {
        setCenter('error', e.message, { noDownload: true });
        mySession.ov.querySelector('.vv-meta').textContent = 'Unavailable';
        return;
      }
      // Network/other failure: fall back to what the caller told us.
      info = { fileName: opts.fileName, fileExt: ext(opts.fileName), fileSize: opts.fileSize || 0, canFeedback: false, _fallback: true };
    }
    if (S !== mySession) return;
    S.meta = info;
    S.docId = info.id || opts.docId || null;
    var name = info.fileName || opts.fileName || 'file';
    S.name = name;
    ov.querySelector('.vv-name').textContent = name;
    ov.querySelector('[data-a="dl"]').title = 'Download ' + name;
    var bits = [];
    if (info.fileSize) bits.push(fmtBytes(info.fileSize));
    if (info.uploaderName) bits.push('by ' + info.uploaderName);
    if (info.createdAt) bits.push(toDate(info.createdAt) ? toDate(info.createdAt).toLocaleDateString() : '');
    ov.querySelector('.vv-meta').textContent = bits.filter(Boolean).join(' · ');

    if (info.canFeedback && S.docId) initFeedback();
    renderFile();
  }

  function close() {
    if (!S) return;
    var s = S; S = null;
    try { s.abort.abort(); } catch (e) { /* ignore */ }
    s.cleanup.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
    if (s.blobUrl) { try { URL.revokeObjectURL(s.blobUrl); } catch (e) { /* ignore */ } }
    if (s.poll) clearInterval(s.poll);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('online', onOnline);
    s.ov.remove();
    document.body.style.overflow = s.prevOverflow || '';
    if (s.prevFocus && s.prevFocus.focus) { try { s.prevFocus.focus(); } catch (e) { /* ignore */ } }
  }

  function onOnline() { if (S && S.errored) renderFile(); }

  function onHeadClick(e) {
    var b = e.target.closest('[data-a]'); if (!b || !S) return;
    var a = b.getAttribute('data-a');
    if (a === 'close') close();
    else if (a === 'dl') download();
    else if (a === 'fb') toggleFeedback();
    else if (a === 'retry') renderFile();
  }

  function onKey(e) {
    if (!S) return;
    if (e.key === 'Escape') {
      var ta = document.activeElement;
      if (ta && ta.tagName === 'TEXTAREA' && ta.value.trim() && S.dlg.contains(ta)) { ta.blur(); e.stopPropagation(); return; }
      e.stopPropagation(); e.preventDefault(); close(); return;
    }
    if (e.key === 'Tab') { // focus trap
      var f = Array.prototype.filter.call(S.dlg.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'),
        function (n) { return !n.disabled && n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      else if (!S.dlg.contains(document.activeElement)) { first.focus(); e.preventDefault(); }
      return;
    }
    var typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');
    if (!typing && S.keyHandler) S.keyHandler(e);
  }

  /* ── file download (explicit, never automatic) ─────────── */
  function saveBlob(blob, name) {
    var u = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = u; a.download = name || 'file'; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(u); }, 30000);
  }
  async function download() {
    if (!S) return;
    var sess = S, name = S.name || 'file';
    try {
      toast('Preparing download…', 'info');
      var size = (S.meta && S.meta.fileSize) || 0;
      // Normal files: stream through the app server (same path the viewer uses, so
      // it works for every role) and save from memory. No direct Backblaze navigation.
      if (!size || size <= MAX_INLINE_MB * 1024 * 1024) {
        var blob = await fcGet();
        if (!blob) blob = await fetchBlobNet(sess.token);
        if (!blob || !blob.size) throw new Error('The file came back empty. Please retry.');
        saveBlob(blob, name);
        toast('Download started.', 'success');
        return;
      }
      // Very large files: open the signed link in this tab (no popup, no download attribute).
      var d = await postJson('/storage/presign-download', S.docId ? { docId: S.docId } : { objectKey: S.opts.objectKey });
      window.location.href = d.url;
    } catch (e) { if (e && e.message === 'cancelled') return; toast('Could not download: ' + e.message, 'error'); }
  }

  /* ── stage helpers ─────────────────────────────────────── */
  function setCenter(kind, msg, o) {
    if (!S) return;
    o = o || {};
    S.errored = kind === 'error';
    S.tools.style.display = 'none'; S.tools.innerHTML = '';
    S.view.style.overflow = 'hidden';
    var h;
    if (kind === 'loading') {
      h = '<div class="vv-spin"></div><p>' + esc(msg) + '</p><div class="vv-bar" style="display:none"><i></i></div>';
    } else {
      h = '<div style="font-size:2rem;color:var(--text-4,#999)">' + ic(kind === 'info' ? 'file-dashed' : 'warning-circle').replace('16px', '40px') + '</div><p>' + esc(msg) + '</p>' +
        '<div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center">' +
        (kind === 'error' && !o.noRetry && !o.noDownload ? '<button class="vv-btn" data-a="retry">' + ic('arrow-clockwise') + ' Retry</button>' : '') +
        (!o.noDownload ? '<button class="vv-btn vv-send" data-a="dl">' + ic('download-simple') + ' Download</button>' : '') + '</div>';
    }
    S.view.innerHTML = '<div class="vv-center">' + h + '</div>';
  }
  function setProgress(p) {
    if (!S) return;
    var bar = S.view.querySelector('.vv-bar'); if (!bar) return;
    bar.style.display = p == null ? 'none' : 'block';
    if (p != null) bar.firstChild.style.width = Math.round(p * 100) + '%';
  }
  function setTools(html) {
    S.tools.innerHTML = html; S.tools.style.display = html ? 'flex' : 'none';
  }

  /* ── On-device file cache ──
     Access is still checked by the server (file.info) on every open; only the
     download is skipped. Cleared automatically when a different user signs in. */
  var FC_NAME = 'vtx-files', FC_MAX_BYTES = 150 * 1048576, FC_MAX_FILE = 40 * 1048576;
  function fcKey() { return S && S.docId && S.meta && !S.meta._fallback && S.meta.fileSize ? '/__vtxfile/' + S.docId + '/' + S.meta.fileSize : ''; }
  function fcIdx() { try { return JSON.parse(localStorage.getItem('vtx_fc_idx') || '[]'); } catch (e) { return []; } }
  function fcSetIdx(a) { try { localStorage.setItem('vtx_fc_idx', JSON.stringify(a)); } catch (e) { } }
  async function fcGet() {
    var key = fcKey(); if (!key || !window.caches) return null;
    try {
      var u = window.fbAuth && window.fbAuth.currentUser, uid = u ? u.uid : '';
      if (localStorage.getItem('vtx_fc_uid') !== uid) { await caches.delete(FC_NAME); fcSetIdx([]); localStorage.setItem('vtx_fc_uid', uid); return null; }
      var c = await caches.open(FC_NAME), hit = await c.match(key);
      if (!hit) return null;
      var blob = await hit.blob();
      if (blob.size !== S.meta.fileSize) { await c.delete(key); return null; }
      var idx = fcIdx().filter(function (e) { return e.k !== key; }); idx.push({ k: key, n: blob.size }); fcSetIdx(idx);
      return blob;
    } catch (e) { return null; }
  }
  async function fcPut(blob) {
    var key = fcKey(); if (!key || !window.caches || blob.size > FC_MAX_FILE) return;
    try {
      var u = window.fbAuth && window.fbAuth.currentUser;
      localStorage.setItem('vtx_fc_uid', u ? u.uid : '');
      var c = await caches.open(FC_NAME);
      await c.put(key, new Response(blob, { headers: { 'Content-Type': blob.type || 'application/octet-stream' } }));
      var idx = fcIdx().filter(function (e) { return e.k !== key; }); idx.push({ k: key, n: blob.size });
      var total = idx.reduce(function (a, e) { return a + e.n; }, 0);
      while (total > FC_MAX_BYTES && idx.length > 1) { var old = idx.shift(); total -= old.n; await c.delete(old.k); }
      fcSetIdx(idx);
    } catch (e) { /* cache full or blocked: ignore */ }
  }

  /* Fetch the file through the Worker as a Blob, with progress. */
  async function fetchBlob(token) {
    var cached = await fcGet();
    if (cached) { setProgress(1); return cached; }
    var blob = await fetchBlobNet(token);
    fcPut(blob);
    return blob;
  }
  async function fetchBlobNet(token) {
    var res = await post('/storage/view', S.docId ? { docId: S.docId } : { objectKey: S.opts.objectKey }, { signal: S.abort.signal });
    if (!res.ok) {
      var j = await res.json().catch(function () { return {}; });
      throw new Error(j.error || 'Could not load this file (' + res.status + ').');
    }
    var total = parseInt(res.headers.get('Content-Length') || '0', 10) || (S.meta && S.meta.fileSize) || 0;
    var type = res.headers.get('Content-Type') || '';
    if (!res.body || !res.body.getReader) { return res.blob(); }
    var reader = res.body.getReader(), chunks = [], got = 0;
    for (;;) {
      var r = await reader.read();
      if (r.done) break;
      chunks.push(r.value); got += r.value.length;
      if (!S || S.token !== token) throw new Error('cancelled');
      if (total) setProgress(Math.min(1, got / total));
    }
    if (total && got < total * 0.98) throw new Error('The download was interrupted. Please retry.');
    return new Blob(chunks, { type: type });
  }

  /* ── main render dispatch ─────────────────────────────── */
  async function renderFile() {
    if (!S) return;
    var s = S, token = (s.token = Date.now() + Math.random());
    if (s.blobUrl) { URL.revokeObjectURL(s.blobUrl); s.blobUrl = null; }
    s.cleanup.splice(0).forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
    s.keyHandler = null;
    var e = ext(s.name);
    var sizeMB = ((s.meta && s.meta.fileSize) || 0) / 1048576;
    setCenter('loading', 'Loading file…');
    try {
      if (s.meta && s.meta.fileSize === 0 && !s.meta._fallback) {
        return setCenter('info', 'This file is empty.', { noDownload: true });
      }
      if (VID.indexOf(e) !== -1 || AUD.indexOf(e) !== -1) return await renderMedia(s, e, token);
      if (OFFICE_EMBED.indexOf(e) !== -1) return await renderOfficeEmbed(s, token);
      var known = e === 'pdf' || IMG.indexOf(e) !== -1 || TXT.indexOf(e) !== -1 || e === 'csv' || e === 'docx' || e === 'xlsx';
      if (!known) return setCenter('info', 'A preview is not available for ".' + (e || 'unknown') + '" files. You can still download it.');
      if (sizeMB > MAX_INLINE_MB) return setCenter('info', 'This file is too large (' + fmtBytes(s.meta.fileSize) + ') to preview in the app. Please download it instead.');

      var blob = await fetchBlob(token);
      if (S !== s || s.token !== token) return;
      if (!blob.size) return setCenter('info', 'This file is empty.', { noDownload: true });

      if (e === 'pdf') return await renderPdf(s, blob, token);
      if (IMG.indexOf(e) !== -1) return renderImage(s, blob, e);
      if (e === 'csv') return renderCsv(s, await blob.text());
      if (TXT.indexOf(e) !== -1) return renderText(s, blob);
      if (e === 'docx') return await renderDocx(s, blob, token);
      if (e === 'xlsx') return await renderXlsx(s, blob, token);
    } catch (err) {
      if (S !== s || s.token !== token || err.message === 'cancelled' || err.name === 'AbortError') return;
      var offline = navigator.onLine === false;
      setCenter('error', offline ? 'You are offline. Reconnect to view this file.' : (err.message || 'Could not open this file.'));
    }
  }

  /* ── images (zoom, pan, pinch) ─────────────────────────── */
  function renderImage(s, blob) {
    s.blobUrl = URL.createObjectURL(blob);
    s.view.style.overflow = 'hidden';
    s.view.innerHTML = '<div class="vv-img-wrap"><img alt="' + esc(s.name) + '" draggable="false"></div>';
    var wrap = s.view.firstChild, img = wrap.firstChild;
    var z = 1, x = 0, y = 0;
    setTools('<button class="vv-btn" data-z="out" aria-label="Zoom out">' + ic('minus') + '</button><span class="lbl" data-lbl>100%</span>' +
      '<button class="vv-btn" data-z="in" aria-label="Zoom in">' + ic('plus') + '</button><button class="vv-btn" data-z="fit">Fit</button><span class="sp"></span>');
    function clamp() {
      var w = wrap.clientWidth, h = wrap.clientHeight, iw = img.clientWidth * z, ih = img.clientHeight * z;
      var mx = Math.max(0, (iw - w) / 2), my = Math.max(0, (ih - h) / 2);
      x = Math.min(mx, Math.max(-mx, x)); y = Math.min(my, Math.max(-my, y));
    }
    function apply() {
      clamp();
      img.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + z + ')';
      s.tools.querySelector('[data-lbl]').textContent = Math.round(z * 100) + '%';
    }
    function setZ(nz) { z = Math.min(8, Math.max(1, nz)); if (z === 1) { x = 0; y = 0; } apply(); }
    s.tools.onclick = function (ev) {
      var b = ev.target.closest('[data-z]'); if (!b) return;
      var k = b.getAttribute('data-z');
      setZ(k === 'in' ? z * 1.25 : k === 'out' ? z / 1.25 : 1);
    };
    wrap.addEventListener('wheel', function (ev) { ev.preventDefault(); setZ(z * (ev.deltaY < 0 ? 1.12 : 1 / 1.12)); }, { passive: false });
    wrap.addEventListener('dblclick', function () { setZ(z > 1 ? 1 : 2.5); });
    var pts = {}, lastDist = 0, sx, sy;
    wrap.addEventListener('pointerdown', function (ev) {
      pts[ev.pointerId] = { x: ev.clientX, y: ev.clientY }; sx = ev.clientX; sy = ev.clientY;
      try { wrap.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      wrap.classList.add('drag'); lastDist = 0;
    });
    wrap.addEventListener('pointermove', function (ev) {
      if (!pts[ev.pointerId]) return;
      pts[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastDist) setZ(z * d / lastDist);
        lastDist = d;
      } else if (z > 1) { x += ev.clientX - sx; y += ev.clientY - sy; sx = ev.clientX; sy = ev.clientY; apply(); }
    });
    function up(ev) { delete pts[ev.pointerId]; lastDist = 0; if (!Object.keys(pts).length) wrap.classList.remove('drag'); }
    wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
    img.onload = apply;
    img.onerror = function () { setCenter('error', 'This image could not be displayed. It may be corrupted.'); };
    img.src = s.blobUrl;
    var onR = function () { apply(); }; window.addEventListener('resize', onR); s.cleanup.push(function () { window.removeEventListener('resize', onR); });
    s.keyHandler = function (ev) {
      if (ev.key === '+' || ev.key === '=') setZ(z * 1.25); else if (ev.key === '-') setZ(z / 1.25); else if (ev.key === '0') setZ(1);
    };
  }

  /* ── video / audio (streamed via presigned URL; supports seeking) ── */
  async function renderMedia(s, e, token) {
    var d = await postJson('/storage/presign-download', s.docId ? { docId: s.docId } : { objectKey: s.opts.objectKey }, { signal: s.abort.signal });
    if (S !== s || s.token !== token) return;
    var isAudio = AUD.indexOf(e) !== -1;
    s.view.style.overflow = 'hidden';
    s.view.innerHTML = isAudio
      ? '<div class="vv-center"><div style="font-size:3rem;color:var(--accent,#2563eb)">' + ic('music-notes').replace('16px', '56px') + '</div><audio class="vv-audio" style="position:static;transform:none" controls preload="metadata"></audio></div>'
      : '<video class="vv-media" controls playsinline preload="metadata"></video>';
    var m = s.view.querySelector(isAudio ? 'audio' : 'video');
    var failed = false;
    m.addEventListener('error', function () {
      if (failed || S !== s) return; failed = true;
      var code = m.error && m.error.code;
      setCenter('info', code === 4 || code === 3
        ? 'Your browser cannot play this ' + e.toUpperCase() + ' format. Download it to play in another app.'
        : 'This media could not be loaded. Please retry or download it.');
    });
    m.src = d.url;
    s.cleanup.push(function () { try { m.pause(); m.removeAttribute('src'); m.load(); } catch (x) { /* ignore */ } });
    s.keyHandler = function (ev) { if (ev.key === ' ') { ev.preventDefault(); m.paused ? m.play() : m.pause(); } };
  }

  /* ── PDF (pdf.js, all pages, lazy-rendered, zoomable) ──── */
  async function renderPdf(s, blob, token) {
    var buf = await blob.arrayBuffer();
    try {
      await loadScript(CDN.pdf);
      var lib = window.pdfjsLib;
      if (!lib) throw new Error('pdf.js missing');
      if (!lib.GlobalWorkerOptions.workerSrc) {
        try {
          var wt = await (await fetch(CDN.pdfw)).text();
          lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([wt], { type: 'text/javascript' }));
        } catch (x) { lib.GlobalWorkerOptions.workerSrc = CDN.pdfw; }
      }
    } catch (x) { return pdfNativeFallback(s, blob); }
    if (S !== s || s.token !== token) return;

    var pdf;
    try {
      pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    } catch (err) {
      if (err && err.name === 'PasswordException') return setCenter('info', 'This PDF is password-protected and cannot be previewed. Download it to open with your password.');
      if (err && err.name === 'InvalidPDFException') return setCenter('error', 'This PDF appears to be corrupted and cannot be previewed.', { noRetry: true });
      return pdfNativeFallback(s, blob);
    }
    if (S !== s || s.token !== token) { pdf.destroy(); return; }
    s.cleanup.push(function () { try { pdf.destroy(); } catch (x) { /* ignore */ } });

    var n = pdf.numPages, zoom = 1, cur = 1;
    s.view.style.overflow = 'auto';
    s.view.innerHTML = '<div class="vv-pages"></div>';
    var box = s.view.firstChild;
    setTools('<button class="vv-btn" data-p="out" aria-label="Zoom out">' + ic('minus') + '</button><span class="lbl" data-zl>100%</span>' +
      '<button class="vv-btn" data-p="in" aria-label="Zoom in">' + ic('plus') + '</button><button class="vv-btn" data-p="fit">Fit</button><span class="sp"></span>' +
      '<span class="vv-pg"><button class="vv-btn" data-p="prev" aria-label="Previous page">' + ic('caret-up') + '</button>' +
      '<input class="vv-jump" data-pj type="number" inputmode="numeric" min="1" max="' + n + '" value="1" aria-label="Go to page">' +
      '<span class="lbl" data-pl>/ ' + n + '</span>' +
      '<button class="vv-btn" data-p="next" aria-label="Next page">' + ic('caret-down') + '</button></span>');
    var first = await pdf.getPage(1);
    var base = first.getViewport({ scale: 1 });
    var pages = [], renderTok = 0, queue = Promise.resolve();

    function fitScale() { return Math.max(0.2, (s.view.clientWidth - 24) / base.width); }
    function layout() {
      var sc = fitScale() * zoom;
      pages.forEach(function (p) {
        p.el.style.width = Math.floor(base.width * sc * (p.ratioW || 1)) + 'px';
        p.el.style.height = Math.floor(base.height * sc * (p.ratioH || 1)) + 'px';
      });
      s.tools.querySelector('[data-zl]').textContent = Math.round(zoom * 100) + '%';
    }
    function release(p) { if (p.canvas) { p.canvas.width = 0; p.canvas.height = 0; p.canvas.remove(); p.canvas = null; } p.done = 0; }
    function renderPage(p) {
      var my = renderTok;
      queue = queue.then(async function () {
        if (!S || S !== s || my !== renderTok || p.canvas || !p.visible) return;
        try {
          var page = await pdf.getPage(p.num);
          var vp1 = page.getViewport({ scale: 1 });
          p.ratioW = vp1.width / base.width; p.ratioH = vp1.height / base.height;
          var sc = fitScale() * zoom;
          p.el.style.width = Math.floor(vp1.width * sc) + 'px'; p.el.style.height = Math.floor(vp1.height * sc) + 'px';
          var vp = page.getViewport({ scale: sc });
          var out = Math.min(window.devicePixelRatio || 1, 2);
          var area = vp.width * vp.height * out * out;
          if (area > 16e6) out = Math.sqrt(16e6 / (vp.width * vp.height)); // canvas memory guard
          var cv = document.createElement('canvas');
          cv.width = Math.floor(vp.width * out); cv.height = Math.floor(vp.height * out);
          var task = page.render({ canvasContext: cv.getContext('2d'), viewport: page.getViewport({ scale: sc * out }) });
          await task.promise;
          if (!S || S !== s || my !== renderTok || !p.visible) { cv.width = 0; return; }
          p.el.innerHTML = ''; p.el.appendChild(cv); p.canvas = cv; p.done = 1;
        } catch (x) { /* a failed page shows blank; others still render */ }
      });
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var p = en.target._p; p.visible = en.isIntersecting;
        if (en.isIntersecting) renderPage(p); else release(p);
      });
    }, { root: s.view, rootMargin: '700px 0px' });
    s.cleanup.push(function () { io.disconnect(); renderTok++; pages.forEach(release); });

    for (var i = 1; i <= n; i++) {
      var el = document.createElement('div'); el.className = 'vv-page'; el.setAttribute('aria-label', 'Page ' + i);
      var p = { num: i, el: el, visible: false, canvas: null }; el._p = p; pages.push(p); box.appendChild(el);
    }
    layout();
    pages.forEach(function (p) { io.observe(p.el); });

    function rerender() { renderTok++; pages.forEach(release); layout(); pages.forEach(function (p) { io.unobserve(p.el); io.observe(p.el); }); }
    var rt; function onResize() { clearTimeout(rt); rt = setTimeout(rerender, 200); }
    window.addEventListener('resize', onResize); s.cleanup.push(function () { window.removeEventListener('resize', onResize); clearTimeout(rt); });

    function goto(k) { k = Math.max(1, Math.min(n, k)); pages[k - 1].el.scrollIntoView({ block: 'start' }); cur = k; var pj = s.tools.querySelector('[data-pj]'); if (pj && document.activeElement !== pj) pj.value = k; }
    function jumpFromInput() {
      var pj = s.tools.querySelector('[data-pj]'); if (!pj) return;
      var k = parseInt(pj.value, 10);
      if (!k || k < 1 || k > n) { toast('Enter a page from 1 to ' + n + '.', 'error'); pj.value = cur; return; }
      goto(k); pj.blur();
    }
    s.tools.addEventListener('keydown', function (ev) {
      if (ev.target && ev.target.hasAttribute && ev.target.hasAttribute('data-pj')) {
        if (ev.key === 'Enter') { ev.preventDefault(); jumpFromInput(); }
        ev.stopPropagation();
      }
    });
    s.tools.addEventListener('focusin', function (ev) { if (ev.target && ev.target.hasAttribute && ev.target.hasAttribute('data-pj')) ev.target.select(); });
    s.tools.addEventListener('change', function (ev) { if (ev.target && ev.target.hasAttribute && ev.target.hasAttribute('data-pj')) jumpFromInput(); });
    function setZoom(z) { zoom = Math.min(4, Math.max(0.4, z)); rerender(); }
    s.tools.onclick = function (ev) {
      var b = ev.target.closest('[data-p]'); if (!b) return; var k = b.getAttribute('data-p');
      if (k === 'in') setZoom(zoom * 1.25); else if (k === 'out') setZoom(zoom / 1.25); else if (k === 'fit') setZoom(1);
      else if (k === 'prev') goto(cur - 1); else if (k === 'next') goto(cur + 1);
    };
    var st;
    s.view.addEventListener('scroll', function () {
      if (st) return;
      st = setTimeout(function () {
        st = null; var mid = s.view.scrollTop + s.view.clientHeight / 3, best = 1;
        for (var j = 0; j < pages.length; j++) { if (pages[j].el.offsetTop <= mid) best = j + 1; else break; }
        cur = best; var pj = s.tools.querySelector('[data-pj]'); if (pj && document.activeElement !== pj) pj.value = cur;
      }, 80);
    });
    s.keyHandler = function (ev) {
      if (ev.key === 'g' || ev.key === 'G') { var pj = s.tools.querySelector('[data-pj]'); if (pj) { pj.focus(); pj.select(); ev.preventDefault(); } }
      else if (ev.key === 'Home') { goto(1); ev.preventDefault(); }
      else if (ev.key === 'End') { goto(n); ev.preventDefault(); }
      else if (ev.key === 'ArrowRight' || ev.key === 'PageDown') { goto(cur + 1); ev.preventDefault(); }
      else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { goto(cur - 1); ev.preventDefault(); }
      else if (ev.key === '+' || ev.key === '=') setZoom(zoom * 1.25);
      else if (ev.key === '-') setZoom(zoom / 1.25);
    };
  }
  function pdfNativeFallback(s, blob) {
    s.blobUrl = URL.createObjectURL(blob);
    s.view.style.overflow = 'hidden';
    s.view.innerHTML = '<iframe class="vv-frame" title="PDF" src="' + s.blobUrl + '"></iframe>';
  }

  /* ── text / csv ───────────────────────────────────────── */
  function renderText(s, blob) {
    var big = blob.size > MAX_TEXT_BYTES;
    (big ? blob.slice(0, MAX_TEXT_BYTES) : blob).text().then(function (t) {
      if (S !== s) return;
      s.view.style.overflow = 'auto';
      s.view.innerHTML = '<pre class="vv-text"></pre>' + (big ? '<div class="vv-note">Showing the first ' + fmtBytes(MAX_TEXT_BYTES) + ' of ' + fmtBytes(blob.size) + '. Download for the full file.</div>' : '');
      s.view.firstChild.textContent = t.replace(/\u0000/g, '');
    });
  }
  function parseCsv(t) {
    var rows = [], row = [], cell = '', q = false, i = 0, c;
    if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
    var delim = (t.split('\n', 1)[0].split(';').length > t.split('\n', 1)[0].split(',').length) ? ';' : ',';
    for (; i < t.length; i++) {
      c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; if (rows.length > MAX_SHEET_ROWS) break; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function tableHtml(rows) {
    var cols = Math.min(MAX_SHEET_COLS, rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0));
    var h = '<table class="vv-sheet"><thead><tr><th></th>';
    for (var c = 0; c < cols; c++) h += '<th>' + colName(c) + '</th>';
    h += '</tr></thead><tbody>';
    rows.slice(0, MAX_SHEET_ROWS).forEach(function (r, i) {
      h += '<tr data-r="' + (i + 1) + '"><td class="n">' + (i + 1) + '</td>';
      for (var c2 = 0; c2 < cols; c2++) h += '<td title="' + esc(r[c2]) + '">' + esc(r[c2] == null ? '' : r[c2]) + '</td>';
      h += '</tr>';
    });
    return h + '</tbody></table>';
  }
  function jumpBoxHtml() {
    return '<span class="vv-jumpbox"><span>Row</span><input class="vv-jump" data-rj type="text" inputmode="numeric" placeholder="e.g. 250" aria-label="Go to row"><button class="vv-btn" data-rjgo>Go</button></span>';
  }
  function bindRowJump(s) {
    function go() {
      var inp = s.tools.querySelector('[data-rj]'); if (!inp) return;
      var m = String(inp.value).match(/(\d+)\s*$/); var r = m ? parseInt(m[1], 10) : 0;
      var rows = s.view.querySelectorAll('tbody tr'); var total = rows.length;
      if (!r || r < 1) { toast('Enter a row number.', 'error'); return; }
      if (r > total) { toast('This sheet shows ' + total + ' rows.', 'error'); r = total; }
      var tr = s.view.querySelector('tr[data-r="' + r + '"]'); if (!tr) return;
      var old = s.view.querySelector('tr.hit'); if (old) old.classList.remove('hit');
      tr.classList.add('hit'); tr.scrollIntoView({ block: 'start' });
      setTimeout(function () { tr.classList.remove('hit'); }, 2500);
      inp.blur();
    }
    s.tools.addEventListener('keydown', function (ev) {
      if (ev.target && ev.target.hasAttribute && ev.target.hasAttribute('data-rj')) { if (ev.key === 'Enter') { ev.preventDefault(); go(); } ev.stopPropagation(); }
    });
    s.tools.addEventListener('click', function (ev) { if (ev.target.closest && ev.target.closest('[data-rjgo]')) go(); });
    s.keyHandler = function (ev) { if (ev.key === 'g' || ev.key === 'G') { var i = s.tools.querySelector('[data-rj]'); if (i) { i.focus(); ev.preventDefault(); } } };
  }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function renderCsv(s, text) {
    var rows = parseCsv(text);
    s.view.style.overflow = 'auto';
    if (!rows.length) return setCenter('info', 'This file is empty.', { noDownload: true });
    s.view.innerHTML = tableHtml(rows) + (rows.length > MAX_SHEET_ROWS ? '<div class="vv-note">Showing the first ' + MAX_SHEET_ROWS + ' rows. Download for the full file.</div>' : '');
    setTools('<span class="sp"></span>' + jumpBoxHtml());
    bindRowJump(s);
  }

  /* ── docx (mammoth) ───────────────────────────────────── */
  function sanitizeHtml(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,iframe,object,embed,link,meta,form,base').forEach(function (n) { n.remove(); });
    doc.body.querySelectorAll('*').forEach(function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        var nm = a.name.toLowerCase(), v = String(a.value).trim().toLowerCase();
        if (nm.indexOf('on') === 0 || nm === 'style' || ((nm === 'href' || nm === 'src' || nm === 'xlink:href') && /^(javascript|vbscript|data:(?!image\/))/.test(v))) n.removeAttribute(a.name);
      });
      if (n.tagName === 'A') { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener noreferrer'); }
    });
    return doc.body.innerHTML;
  }
  async function renderDocx(s, blob, token) {
    await loadScript(CDN.mammoth);
    var buf = await blob.arrayBuffer();
    var r;
    try { r = await window.mammoth.convertToHtml({ arrayBuffer: buf }); }
    catch (x) { return setCenter('error', 'This Word file could not be read. It may be corrupted or password-protected.', { noRetry: true }); }
    if (S !== s || s.token !== token) return;
    s.view.style.overflow = 'auto';
    var html = sanitizeHtml(r.value || '');
    if (!html.trim()) return setCenter('info', 'This document has no previewable content.');
    s.view.innerHTML = '<div class="vv-doc">' + html + '</div>';
  }

  /* ── xlsx (SheetJS) ───────────────────────────────────── */
  async function renderXlsx(s, blob, token) {
    await loadScript(CDN.xlsx);
    var buf = await blob.arrayBuffer(), wb;
    try { wb = window.XLSX.read(buf, { type: 'array', cellDates: true, sheetRows: MAX_SHEET_ROWS + 1 }); }
    catch (x) { return setCenter('error', 'This spreadsheet could not be read. It may be corrupted or password-protected.', { noRetry: true }); }
    if (S !== s || s.token !== token) return;
    var names = wb.SheetNames || [];
    if (!names.length) return setCenter('info', 'This workbook has no sheets.');
    s.view.style.overflow = 'auto';
    function show(i) {
      var ws = wb.Sheets[names[i]];
      var rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
      s.view.innerHTML = rows.length ? tableHtml(rows) + (rows.length > MAX_SHEET_ROWS ? '<div class="vv-note">Showing the first ' + MAX_SHEET_ROWS + ' rows. Download for the full sheet.</div>' : '') : '<div class="vv-center"><p>This sheet is empty.</p></div>';
      s.tools.querySelectorAll('[data-sh]').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-sh') === i); });
    }
    setTools('<div class="vv-tabs">' + names.map(function (nm, i) { return '<button class="vv-btn" data-sh="' + i + '">' + esc(nm) + '</button>'; }).join('') + '</div>' + jumpBoxHtml());
    s.tools.onclick = function (ev) { var b = ev.target.closest('[data-sh]'); if (b) show(+b.getAttribute('data-sh')); };
    bindRowJump(s);
    show(0);
  }

  /* ── ppt/pptx/doc/xls via Office Online embed ─────────── */
  async function renderOfficeEmbed(s, token) {
    var d = await postJson('/storage/presign-download', s.docId ? { docId: s.docId } : { objectKey: s.opts.objectKey }, { signal: s.abort.signal });
    if (S !== s || s.token !== token) return;
    s.view.style.overflow = 'hidden';
    s.view.innerHTML = '<iframe class="vv-frame" title="Document preview" allowfullscreen src="https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(d.url) + '"></iframe>';
    s.view.insertAdjacentHTML('beforeend', '<div class="vv-note" style="position:absolute;left:0;right:0;bottom:0">Preview provided by Microsoft Office Online. If it does not load, use Download.</div>');
  }

  /* ══════════════ FEEDBACK (threaded comments) ══════════════ */
  function initFeedback() {
    var btn = S.ov.querySelector('[data-a="fb"]');
    btn.style.display = '';
    var m = S.meta;
    S.status = m.reviewStatus; S.canReview = !!m.canReview;
    updateFbBadge(m.feedbackCount || 0);
    if (m.id) { op('notif.read', { docId: m.id }).then(function () { window.dispatchEvent(new CustomEvent('vtx:filenotifs-cleared', { detail: { docId: m.id } })); }).catch(function () { }); }
    // Open automatically for submissions awaiting a response, so feedback is never missed.
    S.fb.innerHTML =
      '<div class="vv-fb-head"><div class="vv-fb-title"><span>Feedback</span><span data-st></span></div><div data-rv></div></div>' +
      '<div class="vv-thread" data-th aria-live="polite"><div class="vv-empty">Loading…</div></div>' +
      '<div class="vv-compose">' +
        '<div data-chip></div>' +
        '<textarea data-ta maxlength="2000" placeholder="Write a comment…" aria-label="Write a comment"></textarea>' +
        '<div class="vv-compose-row"><span data-cc>0 / 2000</span><span style="display:flex;gap:.375rem"><button class="vv-btn vv-send" data-f="send">' + ic('paper-plane-tilt') + ' Send</button></span></div>' +
      '</div>';
    S.fb.addEventListener('click', onFbClick);
    var ta = S.fb.querySelector('[data-ta]');
    ta.addEventListener('input', function () { S.fb.querySelector('[data-cc]').textContent = ta.value.length + ' / 2000'; });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
    renderStatus();
    if (m.role === 'teacher' && m.uploaderRole === 'student' && (m.reviewStatus === 'pending' || !m.reviewStatus)) toggleFeedback(true);
    else if (m.feedbackCount && m.role === 'student') toggleFeedback(true);
    S.poll = setInterval(function () { if (S && S.fbOpen && !document.hidden && !S.editing) loadComments(true); }, 20000);
  }

  function updateFbBadge(count) {
    if (!S) return;
    var c = S.ov.querySelector('.vv-count');
    c.style.display = count ? '' : 'none'; c.textContent = count > 99 ? '99+' : count;
  }

  function toggleFeedback(force) {
    if (!S || !S.meta || !S.meta.canFeedback) return;
    S.fbOpen = typeof force === 'boolean' ? force : !S.fbOpen;
    S.fb.classList.toggle('open', S.fbOpen);
    var b = S.ov.querySelector('[data-a="fb"]');
    b.classList.toggle('on', S.fbOpen); b.setAttribute('aria-pressed', S.fbOpen ? 'true' : 'false');
    S.ov.querySelector('.vv-dot').style.display = 'none';
    if (S.fbOpen) { loadComments(); if (window.innerWidth > 820) { var t = S.fb.querySelector('[data-ta]'); if (t && !S.comments.length) t.focus(); } }
    window.dispatchEvent(new Event('resize'));
  }

  function renderStatus() {
    if (!S) return;
    var st = STATUS[S.status];
    S.fb.querySelector('[data-st]').innerHTML = st ? '<span class="vv-status ' + st.cls + '">' + esc(st.label) + '</span>' : '';
    var rv = S.fb.querySelector('[data-rv]');
    if (S.canReview) {
      rv.innerHTML = '<label style="display:flex;align-items:center;gap:.5rem;font-size:.75rem;color:var(--text-3,#777)">Mark as ' +
        '<select data-f="status" aria-label="Review status">' +
        Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (k === S.status ? ' selected' : '') + '>' + STATUS[k].label + '</option>'; }).join('') +
        '</select></label>';
      rv.querySelector('select').addEventListener('change', setStatus);
    } else rv.innerHTML = '';
  }

  async function setStatus(e) {
    var sel = e.target, val = sel.value, prev = S.status, s = S;
    sel.disabled = true;
    try {
      await op('review.set', { docId: S.docId, status: val });
      if (S !== s) return;
      S.status = val; toast('Marked as ' + STATUS[val].label.toLowerCase() + '.', 'success');
    } catch (err) { if (S === s) { sel.value = prev; toast(err.message, 'error'); } }
    if (S === s) { sel.disabled = false; renderStatus(); }
  }

  async function loadComments(silent) {
    var s = S; if (!s) return;
    var th = s.fb.querySelector('[data-th]');
    try {
      var d = await op('comment.list', { docId: s.docId });
      if (S !== s) return;
      s.comments = d.comments || [];
      if (d.reviewStatus && d.reviewStatus !== s.status && !s.canReview) { s.status = d.reviewStatus; renderStatus(); }
      updateFbBadge(s.comments.filter(function (c) { return !c.deleted; }).length);
      renderThread();
    } catch (e) {
      if (S !== s) return;
      if (!silent) th.innerHTML = '<div class="vv-empty">' + esc(e.message) + '<br><button class="vv-btn" data-f="reload" style="margin-top:.5rem">Try again</button></div>';
    }
  }

  function renderThread() {
    if (!S) return;
    var th = S.fb.querySelector('[data-th]');
    var list = S.comments, kids = {}, roots = [];
    list.forEach(function (c) { if (c.parentId && list.some(function (x) { return x.id === c.parentId; })) (kids[c.parentId] = kids[c.parentId] || []).push(c); else roots.push(c); });
    if (!list.length) {
      th.innerHTML = '<div class="vv-empty">' + (S.meta.role === 'teacher'
        ? 'No feedback yet. Write your response below.'
        : 'No feedback yet. Your teacher\'s response will appear here.') + '</div>';
      return;
    }
    var atBottom = th.scrollHeight - th.scrollTop - th.clientHeight < 60, keep = th.scrollTop;
    function node(c) {
      var k = kids[c.id] || [];
      var canEdit = c.mine && !c.deleted, canDel = (c.mine || S.meta.role === 'teacher') && !c.deleted;
      var editing = S.editing === c.id;
      var body = c.deleted ? '<div class="vv-c-text">This comment was deleted.</div>'
        : editing ? '<textarea data-edit maxlength="2000" style="width:100%;box-sizing:border-box;min-height:60px;border-radius:8px;border:1px solid var(--border,#ddd);padding:.4rem;font:.8125rem var(--font,inherit);background:var(--bg-base,#fff);color:var(--text-1,#111)">' + esc(c.text) + '</textarea>' +
          '<div style="display:flex;gap:.375rem;margin-top:.375rem"><button class="vv-btn vv-send" data-f="saveedit" data-id="' + esc(c.id) + '" style="min-height:30px">Save</button><button class="vv-btn" data-f="canceledit" style="min-height:30px">Cancel</button></div>'
          : '<div class="vv-c-text">' + esc(c.text) + '</div>';
      return '<div class="vv-c' + (c.mine ? ' mine' : '') + (c.deleted ? ' del' : '') + '" data-cid="' + esc(c.id) + '">' +
        '<div class="vv-c-body"><div class="vv-c-top"><b>' + esc(c.authorName) + '</b><span class="vv-role ' + esc(c.authorRole) + '">' + esc(c.authorRole) + '</span>' +
        '<span class="vv-c-time" title="' + esc((toDate(c.createdAt) || '').toString()) + '">' + esc(ago(c.createdAt)) + (c.editedAt ? ' · edited' : '') + '</span></div>' + body + '</div>' +
        (editing || c.deleted && !k.length ? '' : '<div class="vv-c-act">' +
          (!c.deleted ? '<button data-f="reply" data-id="' + esc(c.id) + '">Reply</button>' : '') +
          (canEdit ? '<button data-f="edit" data-id="' + esc(c.id) + '">Edit</button>' : '') +
          (canDel ? '<button class="dng" data-f="del" data-id="' + esc(c.id) + '">Delete</button>' : '') + '</div>') +
        (k.length ? '<div class="vv-kids">' + k.map(node).join('') + '</div>' : '') + '</div>';
    }
    th.innerHTML = roots.map(node).join('');
    if (S.editing) { var ed = th.querySelector('[data-edit]'); if (ed) { ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length); } }
    else th.scrollTop = atBottom ? th.scrollHeight : keep;
  }

  function setReply(id) {
    S.replyTo = id;
    var chip = S.fb.querySelector('[data-chip]');
    var c = S.comments.filter(function (x) { return x.id === id; })[0];
    chip.innerHTML = c ? '<div class="vv-chip"><span>Replying to <b>' + esc(c.authorName) + '</b></span><button data-f="noreply" aria-label="Cancel reply">&times;</button></div>' : '';
    S.fb.querySelector('[data-ta]').focus();
  }

  async function send() {
    var s = S; if (!s || s.sending) return;
    var ta = s.fb.querySelector('[data-ta]'), text = ta.value.trim();
    if (!text) { toast('Write something before sending.', 'error'); return; }
    var btn = s.fb.querySelector('[data-f="send"]');
    s.sending = true; btn.disabled = true;
    try {
      await op('comment.add', { docId: s.docId, text: text, parentId: s.replyTo || null });
      if (S !== s) return;
      ta.value = ''; s.fb.querySelector('[data-cc]').textContent = '0 / 2000';
      s.replyTo = null; s.fb.querySelector('[data-chip]').innerHTML = '';
      await loadComments(true);
      var th = s.fb.querySelector('[data-th]'); th.scrollTop = th.scrollHeight;
    } catch (e) { if (S === s) toast(e.message, 'error'); }
    if (S === s) { s.sending = false; btn.disabled = false; }
  }

  async function onFbClick(e) {
    var b = e.target.closest('[data-f]'); if (!b || !S) return;
    var f = b.getAttribute('data-f'), id = b.getAttribute('data-id'), s = S;
    if (f === 'send') return send();
    if (f === 'reload') return loadComments();
    if (f === 'reply') return setReply(id);
    if (f === 'noreply') { s.replyTo = null; s.fb.querySelector('[data-chip]').innerHTML = ''; return; }
    if (f === 'edit') { s.editing = id; return renderThread(); }
    if (f === 'canceledit') { s.editing = null; return renderThread(); }
    if (f === 'saveedit') {
      var ta = s.fb.querySelector('[data-edit]'), text = ta ? ta.value.trim() : '';
      if (!text) { toast('A comment cannot be empty. Delete it instead.', 'error'); return; }
      b.disabled = true;
      try { await op('comment.edit', { commentId: id, text: text }); if (S !== s) return; s.editing = null; await loadComments(true); }
      catch (err) { if (S === s) { toast(err.message, 'error'); b.disabled = false; } }
      return;
    }
    if (f === 'del') {
      var ok = window.UI && UI.confirmAction ? await UI.confirmAction('Delete this comment?') : window.confirm('Delete this comment?');
      if (!ok || S !== s) return;
      try { await op('comment.delete', { commentId: id }); if (S !== s) return; if (s.replyTo === id) { s.replyTo = null; s.fb.querySelector('[data-chip]').innerHTML = ''; } await loadComments(true); }
      catch (err) { if (S === s) { toast(err.message, 'error'); loadComments(true); } }
    }
  }

  window.Viewer = { open: open, close: close };
}());
