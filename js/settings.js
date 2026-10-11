/* ============================================================
   js/settings.js — Student Settings
   ============================================================
   One place where a student controls their own app experience.
   Every switch takes effect immediately.

   Saved on THIS device (localStorage):
     dark mode, text size, sounds, fewer animations, in-app pop-ups
   Saved on the student's ACCOUNT (Firestore students/{uid}.pushPrefs),
   because the server needs to read them when deciding who gets a
   phone alert:
     pushPrefs.dm        false = student paused teacher-message alerts
     pushPrefs.games     true  = alert me about game challenges
     pushPrefs.reminders false = no daily study reminders
     pushPrefs.groups    { [groupId]: true } = alert me for that group

   Teacher-message alerts also need students/{uid}.dmPushEnabled === true,
   which only the teacher can set (Teacher → Push tab).
   Public chat is never sent as a phone alert.
   ============================================================ */
(function () {
  'use strict';

  var LS = {
    text:   'vtx_set_text',     // 'normal' | 'large' | 'xlarge'
    motion: 'vtx_set_motion',   // 'full' | 'reduce'
    sound:  'vtx_set_sound',    // 'on' | 'off'
    popups: 'vtx_set_popups',   // 'on' | 'off'
  };
  var TEXT_SIZES = { normal: '100%', large: '112.5%', xlarge: '125%' };
  var MODAL_ID   = 'vtxSettingsModal';

  var _s = null;          // loaded state while the modal is open
  var _busy = false;

  /* ── tiny helpers ── */
  function _ls(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function _lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _toast(msg, type) { if (window.UI && UI.toast) UI.toast(msg, type || 'info', 3500); }
  function _uid() { return window.AppState && AppState.userId; }
  function _db()  { return window.fbDb; }
  function _isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

  /* ══════════════════════════════════════════════════════════
     DEVICE SETTINGS — applied instantly, on load and on change
  ══════════════════════════════════════════════════════════ */
  function applyLocal() {
    document.documentElement.style.fontSize = TEXT_SIZES[_ls(LS.text, 'normal')] || '100%';
    document.documentElement.setAttribute('data-reduce-motion', _ls(LS.motion, 'full') === 'reduce' ? 'true' : 'false');
    if (window.VtxSound) {
      if (_ls(LS.sound, 'on') === 'off') { VtxSound.disable(); } else { VtxSound.enable(); }
    }
    _injectGlobalStyles();
  }

  function get(key) {
    if (key === 'popups') return _ls(LS.popups, 'on') !== 'off';
    if (key === 'sound')  return _ls(LS.sound,  'on') !== 'off';
    if (key === 'reduceMotion') return _ls(LS.motion, 'full') === 'reduce';
    if (key === 'textSize') return _ls(LS.text, 'normal');
    return undefined;
  }

  function _injectGlobalStyles() {
    if (document.getElementById('_vtxSettingsGlobalCss')) return;
    var st = document.createElement('style');
    st.id = '_vtxSettingsGlobalCss';
    st.textContent =
      '[data-reduce-motion="true"] *, [data-reduce-motion="true"] *::before, [data-reduce-motion="true"] *::after {' +
        'animation-duration:.01ms !important; animation-iteration-count:1 !important;' +
        'transition-duration:.01ms !important; scroll-behavior:auto !important; }';
    document.head.appendChild(st);
  }

  /* ══════════════════════════════════════════════════════════
     MODAL STYLES
  ══════════════════════════════════════════════════════════ */
  function _injectStyles() {
    if (document.getElementById('_vtxSettingsCss')) return;
    var st = document.createElement('style');
    st.id = '_vtxSettingsCss';
    st.textContent = [
      '#' + MODAL_ID + '{position:fixed;inset:0;z-index:9000;display:flex;align-items:flex-end;justify-content:center;',
        'background:rgba(0,0,0,.45);animation:vsFade .18s ease both;font-family:var(--font,inherit);}',
      '.vs-sheet{width:100%;max-width:520px;max-height:92vh;display:flex;flex-direction:column;',
        'background:var(--bg-page,var(--bg-base,#fff));border-radius:20px 20px 0 0;',
        'box-shadow:0 -10px 40px rgba(0,0,0,.25);animation:vsUp .25s cubic-bezier(.2,.9,.3,1) both;}',
      '@media (min-width:640px){#' + MODAL_ID + '{align-items:center;}.vs-sheet{border-radius:20px;max-height:86vh;}}',
      '.vs-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;',
        'padding:1rem 1.125rem;border-bottom:1px solid var(--border,#e5e7eb);flex-shrink:0;}',
      '.vs-title{font-size:1.0625rem;font-weight:700;color:var(--text-1,#0d0d0f);letter-spacing:-.01em;}',
      '.vs-x{width:34px;height:34px;border-radius:50%;border:1px solid var(--border,#e5e7eb);background:var(--bg-base,#fff);',
        'color:var(--text-2,#374151);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;}',
      '.vs-body{overflow-y:auto;padding:.5rem 1.125rem 1.5rem;-webkit-overflow-scrolling:touch;}',
      '.vs-h{font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;',
        'color:var(--text-4,#9ca3af);margin:1.25rem 0 .5rem;}',
      '.vs-card{border:1px solid var(--border,#e5e7eb);border-radius:14px;background:var(--bg-base,#fff);overflow:hidden;}',
      '.vs-row{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.8125rem .9375rem;}',
      '.vs-row + .vs-row{border-top:1px solid var(--border,#e5e7eb);}',
      '.vs-txt{min-width:0;flex:1;}',
      '.vs-t{font-size:.875rem;font-weight:600;color:var(--text-1,#0d0d0f);line-height:1.3;word-break:break-word;}',
      '.vs-d{font-size:.75rem;color:var(--text-3,#6b7280);margin-top:2px;line-height:1.45;}',
      '.vs-note{font-size:.75rem;line-height:1.45;margin-top:.375rem;padding:.5rem .625rem;border-radius:10px;',
        'background:var(--warning-subtle,#fff7e6);color:var(--warning-text,#8a5a00);}',
      '.vs-info{font-size:.75rem;color:var(--text-3,#6b7280);line-height:1.5;padding:.625rem .25rem 0;}',
      '.vs-sw{position:relative;width:46px;height:28px;border-radius:99px;border:none;cursor:pointer;flex-shrink:0;padding:0;',
        'background:var(--bg-muted,#d1d5db);transition:background .2s;}',
      '.vs-sw span{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;',
        'box-shadow:0 1px 4px rgba(0,0,0,.25);transition:transform .2s;display:block;}',
      '.vs-sw[aria-checked="true"]{background:var(--success,#16a34a);}',
      '.vs-sw[aria-checked="true"] span{transform:translateX(18px);}',
      '.vs-sw:disabled{opacity:.45;cursor:not-allowed;}',
      '.vs-sw:focus-visible,.vs-seg button:focus-visible,.vs-x:focus-visible,.vs-btn:focus-visible{outline:2px solid var(--accent,#4f6ef7);outline-offset:2px;}',
      '.vs-seg{display:flex;gap:4px;padding:3px;border-radius:10px;background:var(--bg-muted,#eef0f3);flex-shrink:0;}',
      '.vs-seg button{border:none;background:transparent;padding:.375rem .625rem;border-radius:8px;cursor:pointer;',
        'font-size:.75rem;font-weight:600;color:var(--text-3,#6b7280);font-family:inherit;}',
      '.vs-seg button[aria-pressed="true"]{background:var(--bg-base,#fff);color:var(--text-1,#0d0d0f);box-shadow:0 1px 3px rgba(0,0,0,.15);}',
      '.vs-btn{width:100%;padding:.75rem;border-radius:12px;border:1px solid var(--border,#e5e7eb);background:var(--bg-base,#fff);',
        'color:var(--text-2,#374151);font-size:.875rem;font-weight:600;cursor:pointer;font-family:inherit;}',
      '.vs-loading{padding:2rem 0;text-align:center;color:var(--text-3,#6b7280);font-size:.875rem;}',
      '@keyframes vsFade{from{opacity:0}to{opacity:1}}',
      '@keyframes vsUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}',
    ].join('');
    document.head.appendChild(st);
  }

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  function _switchRow(act, title, desc, on, opts) {
    opts = opts || {};
    return '<div class="vs-row">' +
      '<div class="vs-txt"><p class="vs-t">' + _esc(title) + '</p>' +
        (desc ? '<p class="vs-d">' + _esc(desc) + '</p>' : '') +
        (opts.note ? '<p class="vs-note">' + _esc(opts.note) + '</p>' : '') +
      '</div>' +
      '<button class="vs-sw" role="switch" aria-label="' + _esc(title) + '" aria-checked="' + (on ? 'true' : 'false') + '"' +
        ' data-act="' + _esc(act) + '"' + (opts.disabled ? ' disabled' : '') + '><span></span></button>' +
    '</div>';
  }

  function _segRow(act, title, desc, options, current) {
    return '<div class="vs-row">' +
      '<div class="vs-txt"><p class="vs-t">' + _esc(title) + '</p>' +
        (desc ? '<p class="vs-d">' + _esc(desc) + '</p>' : '') + '</div>' +
      '<div class="vs-seg" role="group" aria-label="' + _esc(title) + '">' +
        options.map(function (o) {
          return '<button data-act="' + _esc(act + ':' + o[0]) + '" aria-pressed="' + (o[0] === current ? 'true' : 'false') + '">' + _esc(o[1]) + '</button>';
        }).join('') +
      '</div></div>';
  }

  function _alertsHtml() {
    if (!_s) return '<div class="vs-loading">Loading your settings…</div>';

    var st = _s.status || {};
    var p  = _s.prefs;
    var masterNote = '';
    if (st.needsIOSInstall) {
      masterNote = 'On iPhone, first tap the Share button, choose “Add to Home Screen”, then open Vertex from your Home Screen.';
    } else if (!st.supported) {
      masterNote = 'This phone or browser can’t show alerts.';
    } else if (st.blocked) {
      masterNote = 'Alerts are blocked. Open your phone or browser settings, find this app, and allow Notifications.';
    }

    var anyOn = (p.dm !== false && _s.dmByTeacher) || p.games === true || p.reminders !== false ||
      Object.keys(p.groups || {}).some(function (k) { return p.groups[k] === true; });
    var offHint = (!st.on && st.supported && !st.blocked && anyOn)
      ? 'Phone alerts are off, so nothing will pop up on your phone yet. Switch it on above.' : '';

    var html = '';
    html += '<p class="vs-h">Alerts on your phone</p><div class="vs-card">';
    html += _switchRow('master', 'Phone alerts',
      'Get a little pop-up on your phone when something new happens — even when the app is closed.',
      !!st.on, { disabled: !st.supported || (!!st.blocked && !st.on), note: masterNote });
    html += '</div>';
    if (offHint) html += '<p class="vs-note" style="margin-top:.5rem;">' + _esc(offHint) + '</p>';

    html += '<p class="vs-h">What should pop up?</p><div class="vs-card">';
    html += _switchRow('dm', 'Messages from your teacher',
      _s.dmByTeacher
        ? 'Get an alert when Master Timothy sends you a message.'
        : 'Your teacher has not turned this on for you yet. Once they do, you can pause or resume it here.',
      _s.dmByTeacher && p.dm !== false, { disabled: !_s.dmByTeacher });
    html += _switchRow('games', 'Game challenges',
      'Find out right away when a friend challenges you to a quiz.', p.games === true);
    html += _switchRow('reminders', 'Daily study reminders',
      'A nudge about your tasks and upcoming sessions.', p.reminders !== false);
    html += '</div>';

    html += '<p class="vs-h">Group chats</p>';
    if (_s.groups.length === 0) {
      html += '<div class="vs-card"><div class="vs-row"><div class="vs-txt"><p class="vs-d" style="margin:0;">You are not in any group chats yet.</p></div></div></div>';
    } else {
      html += '<div class="vs-card">' + _s.groups.map(function (g) {
        return _switchRow('group:' + g.id, g.name, 'Alert me about new messages in this group.',
          !!(p.groups && p.groups[g.id] === true));
      }).join('') + '</div>';
    }
    html += '<p class="vs-info">Public chat messages only show up inside the app. They never pop up on your phone.</p>';
    return html;
  }

  function _deviceHtml() {
    var html = '<p class="vs-h">How the app looks and feels</p><div class="vs-card">';
    html += _switchRow('dark', 'Dark mode', 'Easier on your eyes at night.', _isDark());
    html += _segRow('text', 'Text size', 'Make words bigger if they are hard to read.',
      [['normal', 'Normal'], ['large', 'Big'], ['xlarge', 'Bigger']], _ls(LS.text, 'normal'));
    html += _switchRow('sound', 'Sounds', 'Game and app sound effects.', get('sound'));
    html += _switchRow('motion', 'Fewer animations', 'Less moving and sliding around on the screen.', get('reduceMotion'));
    html += _switchRow('popups', 'Message pop-ups inside the app',
      'The small box that slides in when a new message arrives while you are using the app.', get('popups'));
    html += '</div>';
    return html;
  }

  function _accountHtml() {
    var d = (window.AppState && AppState.studentData) || {};
    return '<p class="vs-h">Your account</p>' +
      '<div class="vs-card"><div class="vs-row"><div class="vs-txt">' +
        '<p class="vs-t">' + _esc(d.name || 'Student') + '</p>' +
        '<p class="vs-d">' + _esc([d.class, d.school].filter(Boolean).join(' • ')) + '</p>' +
      '</div></div></div>' +
      '<div style="margin-top:.75rem;"><button class="vs-btn" data-act="signout">Sign out</button></div>';
  }

  function _render() {
    var body = document.getElementById('vsBody');
    if (!body) return;
    var top = body.scrollTop;
    body.innerHTML = _alertsHtml() + _deviceHtml() + _accountHtml();
    body.scrollTop = top;
  }

  /* ══════════════════════════════════════════════════════════
     LOAD + SAVE
  ══════════════════════════════════════════════════════════ */
  async function _load() {
    var uid = _uid();
    var status = { supported: false, on: false };
    try { if (window.Notifications) status = await Notifications.getStatus(); } catch (e) {}

    var doc = {};
    try {
      var snap = await _db().collection('students').doc(uid).get();
      if (snap.exists) doc = snap.data() || {};
    } catch (e) { console.warn('[settings] profile read failed:', e); }

    var groups = [];
    try {
      var gs = await _db().collection('groupChats').where('memberUids', 'array-contains', uid).get();
      gs.forEach(function (d) { groups.push({ id: d.id, name: (d.data().name || 'Group chat') }); });
      groups.sort(function (a, b) { return a.name.localeCompare(b.name); });
    } catch (e) { console.warn('[settings] groups read failed:', e); }

    var prefs = doc.pushPrefs || {};
    _s = {
      status: status,
      dmByTeacher: doc.dmPushEnabled === true,
      prefs: { dm: prefs.dm, games: prefs.games, reminders: prefs.reminders, groups: prefs.groups || {} },
      groups: groups,
    };
  }

  function _savePref(pathParts, value) {
    var fp = new firebase.firestore.FieldPath(...['pushPrefs'].concat(pathParts));
    return _db().collection('students').doc(_uid()).update(fp, value);
  }

  function _mirrorLocally() {
    if (window.AppState && AppState.studentData && _s) AppState.studentData.pushPrefs = JSON.parse(JSON.stringify(_s.prefs));
  }

  async function _refreshStatus() {
    try { _s.status = await Notifications.getStatus(); } catch (e) {}
  }

  // Turn a saved alert choice on/off. Turning ON also makes sure the phone is set up for alerts.
  async function _togglePref(key, groupId) {
    var p = _s.prefs;
    var cur, next;
    if (groupId) { cur = p.groups[groupId] === true; }
    else if (key === 'games') { cur = p.games === true; }
    else { cur = p[key] !== false; }               // dm, reminders default to ON
    next = !cur;

    if (next && window.Notifications) {
      var ok = await Notifications.ensureOn();
      await _refreshStatus();
      if (!ok) { _render(); return; }              // permission refused → leave switch off
    }

    // apply instantly in the UI
    if (groupId) { p.groups[groupId] = next; } else { p[key] = next; }
    _render();

    try {
      if (groupId) await _savePref(['groups', groupId], next);
      else         await _savePref([key], next);
      _mirrorLocally();
    } catch (e) {
      console.error('[settings] save failed:', e);
      if (groupId) { p.groups[groupId] = cur; } else { p[key] = cur; }
      _render();
      _toast('Could not save that. Check your internet and try again.', 'error');
    }
  }

  async function _toggleMaster() {
    if (!window.Notifications) return;
    if (_s.status.on) { await Notifications.unsubscribe(); }
    else              { await Notifications.subscribe(); }
    await _refreshStatus();
    _render();
  }

  /* ══════════════════════════════════════════════════════════
     EVENTS
  ══════════════════════════════════════════════════════════ */
  async function _onClick(e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var act = el.getAttribute('data-act');

    // Device settings (instant, no waiting)
    if (act === 'dark') {
      if (window.VtxTheme) VtxTheme.apply(_isDark() ? 'light' : 'dark');
      _render(); return;
    }
    if (act.indexOf('text:') === 0) {
      _lsSet(LS.text, act.split(':')[1]); applyLocal(); _render(); return;
    }
    if (act === 'sound')  { _lsSet(LS.sound,  get('sound')  ? 'off' : 'on');   applyLocal(); _render(); return; }
    if (act === 'motion') { _lsSet(LS.motion, get('reduceMotion') ? 'full' : 'reduce'); applyLocal(); _render(); return; }
    if (act === 'popups') { _lsSet(LS.popups, get('popups') ? 'off' : 'on'); _render(); return; }
    if (act === 'signout') { close(); if (window.App && App.logout) App.logout(); return; }

    // Alert settings (need the loaded state; ignore taps while one is still saving)
    if (!_s || _busy) return;
    _busy = true;
    try {
      if (act === 'master')                { await _toggleMaster(); }
      else if (act === 'dm')               { await _togglePref('dm'); }
      else if (act === 'games')            { await _togglePref('games'); }
      else if (act === 'reminders')        { await _togglePref('reminders'); }
      else if (act.indexOf('group:') === 0){ await _togglePref(null, act.slice(6)); }
    } finally { _busy = false; }
  }

  function _onKey(e) { if (e.key === 'Escape') close(); }

  /* ══════════════════════════════════════════════════════════
     OPEN / CLOSE
  ══════════════════════════════════════════════════════════ */
  async function open() {
    if (document.getElementById(MODAL_ID)) return;
    if (!_uid()) return;
    _injectStyles();
    _s = null;

    var m = document.createElement('div');
    m.id = MODAL_ID;
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-label', 'Settings');
    m.innerHTML =
      '<div class="vs-sheet">' +
        '<div class="vs-head"><h2 class="vs-title">Settings</h2>' +
          '<button class="vs-x" id="vsClose" aria-label="Close settings"><i class="ph ph-x"></i></button></div>' +
        '<div class="vs-body" id="vsBody"></div>' +
      '</div>';
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    m.addEventListener('click', _onClick);
    document.body.appendChild(m);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', _onKey);
    document.getElementById('vsClose').addEventListener('click', close);
    document.getElementById('vsClose').focus();

    _render();            // shows "Loading…" for the alerts part, device settings are ready now
    await _load();
    _render();
  }

  function close() {
    var m = document.getElementById(MODAL_ID);
    if (m) m.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', _onKey);
    _s = null;
  }

  applyLocal();

  window.VtxSettings = { open: open, close: close, get: get, applyLocal: applyLocal };
})();
