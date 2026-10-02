/* ============================================================
   vector/ui.js  |  All VECTOR DOM lives inside #vectorBlacklineRoot.
   Screens (menus) and the in-game HUD. Every selector is scoped under
   .vector-blackline (see css/vector-blackline.css).
   ============================================================ */
import { WEAPONS, EQUIPMENT, ARMOR, LOADOUTS, sanitizeLoadout } from './weapons.js';
import { COSMETICS, DEFAULT_LOOK } from './cosmetics.js';
import { CAMPAIGN } from './missions.js';
import { MAP_LIST, } from './world.js';
import { MODES, NET } from './config.js';
import { levelFromXp, DEFAULT_SETTINGS } from './storage.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

const SETTINGS_SCHEMA = [
  { group: 'Graphics', items: [
    { k: 'quality', label: 'Quality', type: 'select', opts: [['auto', 'Automatic'], ['LOW', 'Low'], ['MEDIUM', 'Medium'], ['HIGH', 'High']] },
    { k: 'hudScale', label: 'HUD scale', type: 'range', min: 0.7, max: 1.4, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' },
    { k: 'motionFx', label: 'Motion effects (camera shake)', type: 'toggle' },
    { k: 'reducedMotion', label: 'Reduced motion', type: 'toggle' } ] },
  { group: 'Audio', items: [
    { k: 'masterVol', label: 'Master', type: 'range', min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' },
    { k: 'sfxVol', label: 'Effects', type: 'range', min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' },
    { k: 'musicVol', label: 'Ambience', type: 'range', min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' },
    { k: 'voiceVol', label: 'Radio', type: 'range', min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' },
    { k: 'subtitles', label: 'Subtitles', type: 'toggle' } ] },
  { group: 'Controls', items: [
    { k: 'sens', label: 'Mouse sensitivity', type: 'range', min: 0.2, max: 3, step: 0.05, fmt: (v) => v.toFixed(2) },
    { k: 'aimSens', label: 'Aim sensitivity', type: 'range', min: 0.2, max: 1.5, step: 0.05, fmt: (v) => v.toFixed(2) },
    { k: 'touchSens', label: 'Touch sensitivity', type: 'range', min: 0.3, max: 3, step: 0.05, fmt: (v) => v.toFixed(2) },
    { k: 'camDist', label: 'Camera distance', type: 'range', min: 2.0, max: 5.5, step: 0.1, fmt: (v) => v.toFixed(1) + ' m' },
    { k: 'invertY', label: 'Invert look', type: 'toggle' },
    { k: 'vibration', label: 'Vibration', type: 'toggle' } ] },
];

export class UI {
  constructor(root, app) {
    this.root = root; this.app = app; this.screen = null; this.state = { mission: null, tab: 'story', mpMode: 'coop', mpMap: 'industrial', mpMission: 'm01', code: '', lobby: null, myId: null, custom: null, opTab: 'face' };
    this.timers = []; this.listeners = []; this.cache = {}; this.toastQ = []; this.subT = null; this.mini = null; this.mmStatic = null;
    this.build();
  }

  on(t, type, fn, o) { t.addEventListener(type, fn, o); this.listeners.push([t, type, fn, o]); }
  later(fn, ms) { const t = setTimeout(() => { this.timers = this.timers.filter((x) => x !== t); fn(); }, ms); this.timers.push(t); return t; }
  q(sel) { return this.root.querySelector(sel); }

  /* ---------------- static skeleton ---------------- */
  build() {
    this.root.innerHTML = `
      <canvas class="vb-canvas" id="vbCanvas"></canvas>
      <div class="vb-hud" id="vbHud" hidden></div>
      <div class="vb-screen" id="vbScreen" hidden></div>
      <div class="vb-overlay" id="vbLoading" hidden></div>
      <div class="vb-overlay vb-orient" id="vbOrient" hidden>
        <div class="vb-orient-icon" aria-hidden="true"><svg viewBox="0 0 64 64" width="84" height="84"><rect x="20" y="6" width="24" height="42" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M48 52c7-2 10-8 8-14m0 0l-5 1m5-1l1 5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <h2>Turn your phone sideways</h2>
        <p>VECTOR: BLACKLINE is designed for landscape gameplay. Rotate your device to continue.</p>
        <button class="vb-btn ghost" data-act="exit-vertex">Back to Vertex</button>
      </div>
      <div class="vb-toast-wrap" id="vbToasts" aria-live="polite"></div>`;
    this.canvas = this.q('#vbCanvas'); this.hud = this.q('#vbHud'); this.scr = this.q('#vbScreen'); this.loading = this.q('#vbLoading'); this.orient = this.q('#vbOrient'); this.toasts = this.q('#vbToasts');
    this.on(this.root, 'click', (e) => {
      const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
      this.app.audio.unlock(); this.app.audio.play(el.dataset.act === 'back' ? 'ui_back' : 'ui_click');
      this.act(el.dataset.act, el.dataset, el);
    });
    this.on(this.root, 'input', (e) => { const el = e.target; if (el.dataset && el.dataset.setting) this.onSetting(el); });
    this.on(this.root, 'change', (e) => { const el = e.target; if (el.dataset && el.dataset.setting) this.onSetting(el, true); if (el.dataset && el.dataset.lo) this.onCustomLoadout(el); });
    this.buildHud();
  }

  act(name, d, el) {
    const a = this.app, s = this.state;
    switch (name) {
      case 'home': return this.showMenu();
      case 'back': return this.showMenu();
      case 'continue': return a.continueCampaign();
      case 'campaign': return this.showCampaign();
      case 'multiplayer': return this.showMultiplayer();
      case 'loadout': return this.showLoadout();
      case 'operators': return this.showOperators();
      case 'armory': return this.showArmory();
      case 'profile': return this.showProfile();
      case 'settings': return this.showSettings(d.from || 'menu');
      case 'exit-vertex': return a.exitToVertex();
      case 'pick-mission': s.mission = d.id; return this.showCampaign();
      case 'deploy': return a.deployMission(s.mission);
      case 'difficulty': a.store.profile.difficulty = d.v; a.store.flush(); return this.showCampaign();
      case 'tab': s.tab = d.v; return this.showCampaign();
      case 'mp-mode': s.mpMode = d.v; return this.showMultiplayer();
      case 'mp-create': return a.mpCreate({ mode: s.mpMode, mapId: s.mpMap, mission: s.mpMission, difficulty: a.store.profile.difficulty });
      case 'mp-join': { const v = (this.q('#vbCode') || {}).value; return a.mpJoin(v); }
      case 'mp-ready': return a.mpReady();
      case 'mp-start': return a.mpStart();
      case 'mp-leave': return a.mpLeave();
      case 'mp-kick': return a.mpKick(d.uid);
      case 'mp-team': return a.mpTeam(+d.v);
      case 'mp-copy': try { navigator.clipboard.writeText(s.lobby.code); this.toast('Lobby code copied'); } catch { this.toast(s.lobby.code); } return;
      case 'mp-lobby': return a.mpBackToLobby();
      case 'set-loadout': a.store.setLoadout(d.id); return this.showLoadout();
      case 'look': { const k = d.k; a.store.profile.look[k] = d.v; a.store.flush(); a.previewLook(); return this.showOperators(); }
      case 'op-tab': s.opTab = d.v; return this.showOperators();
      case 'name-save': { const v = (this.q('#vbName') || {}).value || ''; a.store.profile.name = v.replace(/[^\p{L}\p{N} _\-.]/gu, '').slice(0, 18); a.store.flush(); this.toast('Callsign saved'); return; }
      case 'reset-profile': if (confirm('Erase all VECTOR progress on this device? This cannot be undone.')) { a.store.reset(); this.toast('Progress erased'); this.showProfile(); } return;
      case 'reset-settings': Object.assign(a.store.profile.settings, DEFAULT_SETTINGS); a.store.flush(); a.applySettings(); return this.showSettings(s.settingsFrom);
      case 'resume': return a.resume();
      case 'pause-settings': return this.showSettings('pause');
      case 'pause-controls': return this.showControls('pause');
      case 'controls': return this.showControls('menu');
      case 'restart-cp': return a.restartCheckpoint();
      case 'exit-mission': return a.exitMission();
      case 'results-continue': return a.afterResults(d.v);
      case 'settings-back': return s.settingsFrom === 'pause' ? this.showPause() : this.showMenu();
      case 'controls-back': return s.settingsFrom === 'pause' ? this.showPause() : this.showMenu();
      case 'fullscreen': return a.toggleFullscreen();
      case 'retry': return a.afterResults('retry');
      default: return undefined;
    }
  }

  /* ---------------- generic screen plumbing ---------------- */
  setScreen(name, html, cls = '') {
    this.screen = name; this.scr.hidden = false; this.scr.className = 'vb-screen ' + cls; this.scr.innerHTML = html; this.scr.scrollTop = 0;
    const f = this.scr.querySelector('[data-autofocus]'); if (f) f.focus({ preventScroll: true });
  }
  hideScreen() { this.screen = null; this.scr.hidden = true; this.scr.innerHTML = ''; }
  topbar(title, back) { return `<header class="vb-top"><div class="vb-top-title">${esc(title)}</div>${back ? `<button class="vb-btn ghost small" data-act="${back}">Back</button>` : ''}</header>`; }
  toast(msg, ms = 2400) {
    const t = document.createElement('div'); t.className = 'vb-toast'; t.textContent = msg; this.toasts.appendChild(t);
    this.later(() => t.classList.add('out'), ms); this.later(() => t.remove(), ms + 400);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
  }

  /* ---------------- loading / errors ---------------- */
  showLoading(title = 'INITIALIZING...', sub = '') {
    this.loading.hidden = false;
    this.loading.innerHTML = `<div class="vb-load"><div class="vb-logo">VECTOR<span>:</span> BLACKLINE</div><div class="vb-load-line" id="vbLoadLine">${esc(title)}</div><div class="vb-bar"><i id="vbLoadBar" style="width:0%"></i></div><div class="vb-load-sub" id="vbLoadSub">${esc(sub)}</div></div>`;
  }
  setLoading(frac, line, sub) {
    const b = this.q('#vbLoadBar'); if (b) b.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
    if (line) { const l = this.q('#vbLoadLine'); if (l) l.textContent = line; }
    if (sub !== undefined) { const s = this.q('#vbLoadSub'); if (s) s.textContent = sub; }
  }
  hideLoading() { this.loading.hidden = true; this.loading.innerHTML = ''; }
  showError(title, msg, actions) {
    this.hideLoading(); this.hud.hidden = true;
    this.setScreen('error', `<div class="vb-center"><div class="vb-panel narrow"><h2>${esc(title)}</h2><p>${esc(msg)}</p><div class="vb-row">${(actions || [{ act: 'exit-vertex', label: 'Back to Vertex' }]).map((a) => `<button class="vb-btn ${a.primary ? 'primary' : 'ghost'}" data-act="${a.act}">${esc(a.label)}</button>`).join('')}</div></div></div>`, 'vb-dim');
  }
  showOrient(v) { this.orient.hidden = !v; }

  /* ---------------- main menu ---------------- */
  showMenu() {
    this.hud.hidden = true; const p = this.app.store.profile, lv = levelFromXp(p.xp);
    const has = !!(p.save && p.save.cp);
    const name = p.name || this.app.userName || 'Operative';
    this.setScreen('menu', `
      <div class="vb-menu">
        <div class="vb-menu-main">
          <div class="vb-logo big">VECTOR<span>:</span> BLACKLINE</div>
          <div class="vb-tag">Action Adventure Shooter</div>
          <nav class="vb-nav">
            <button class="vb-nav-btn ${has ? 'primary' : 'disabled'}" data-act="continue" ${has ? '' : 'disabled'}>Continue${has ? `<small>${esc((CAMPAIGN.find((m) => m.id === p.save.missionId) || {}).title || '')}</small>` : '<small>No saved checkpoint</small>'}</button>
            <button class="vb-nav-btn" data-act="campaign" data-autofocus>Campaign<small>12 missions, single player</small></button>
            <button class="vb-nav-btn" data-act="multiplayer">Multiplayer<small>Co-op, Team Skirmish, Free-For-All</small></button>
            <button class="vb-nav-btn" data-act="loadout">Loadout</button>
            <button class="vb-nav-btn" data-act="operators">Operators</button>
            <button class="vb-nav-btn" data-act="armory">Armory</button>
            <button class="vb-nav-btn" data-act="profile">Profile</button>
            <button class="vb-nav-btn" data-act="settings">Settings</button>
            <button class="vb-nav-btn ghost" data-act="exit-vertex">Back to Vertex</button>
          </nav>
        </div>
        <aside class="vb-card">
          <div class="vb-callsign">${esc(name)}</div>
          <div class="vb-level">Level ${lv.level}</div>
          <div class="vb-xp"><i style="width:${Math.round(lv.into / lv.need * 100)}%"></i></div>
          <div class="vb-xp-t">${lv.into} / ${lv.need} XP</div>
          <div class="vb-mini-stats"><span>${p.stats.missions} missions</span><span>${p.stats.kills} eliminations</span></div>
        </aside>
      </div>`, 'vb-bgmenu');
    this.app.menuBackdrop(true);
  }

  /* ---------------- campaign ---------------- */
  showCampaign() {
    const a = this.app, p = a.store.profile, s = this.state;
    if (!s.mission || !p.unlocked.includes(s.mission)) s.mission = p.unlocked[p.unlocked.length - 1] || 'm01';
    const m = CAMPAIGN.find((x) => x.id === s.mission);
    const acts = [...new Set(CAMPAIGN.map((x) => x.act))];
    const list = acts.map((act) => {
      const ms = CAMPAIGN.filter((x) => x.act === act);
      return `<div class="vb-act"><div class="vb-act-h">ACT ${['', 'I', 'II', 'III', 'IV'][act]} · ${esc(ms[0].actName)}</div>${ms.map((x) => {
        const lock = !p.unlocked.includes(x.id), done = !!p.completed[x.id];
        return `<button class="vb-mission ${x.id === s.mission ? 'sel' : ''} ${lock ? 'lock' : ''}" data-act="pick-mission" data-id="${x.id}" ${lock ? 'disabled' : ''}><b>${x.id.slice(1)}</b><span>${esc(x.title)}</span><em>${lock ? 'Locked' : done ? 'Complete ' + fmtTime(p.completed[x.id].best) : 'Available'}</em></button>`; }).join('')}</div>`;
    }).join('');
    const mapName = (MAP_LIST.find((q) => q.id === m.map) || {}).name;
    const diff = ['recruit', 'standard', 'veteran'].map((d) => `<button class="vb-chip ${p.difficulty === d ? 'on' : ''}" data-act="difficulty" data-v="${d}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('');
    this.setScreen('campaign', `${this.topbar('Campaign', 'home')}
      <div class="vb-split"><div class="vb-list">${list}</div>
      <section class="vb-panel brief"><div class="vb-kicker">MISSION ${m.id.slice(1)} · ${esc(mapName || '')}</div><h2>${esc(m.title)}</h2><p class="vb-lead">${esc(m.summary)}</p><p>${esc(m.briefing)}</p>
        <h4>Objectives</h4><ol class="vb-objs">${m.objectives.map((o) => `<li>${esc(o.text)}</li>`).join('')}</ol>
        ${m.timeLimit ? `<p class="vb-warn">Time limit: ${fmtTime(m.timeLimit)}</p>` : ''}
        <div class="vb-row wrap"><span class="vb-label">Difficulty</span>${diff}</div>
        <div class="vb-row"><button class="vb-btn primary" data-act="deploy">Choose loadout and deploy</button></div></section></div>`);
  }

  /* ---------------- multiplayer ---------------- */
  showMultiplayer() {
    const s = this.state, a = this.app;
    const modes = ['coop', 'tdm', 'ffa'].map((m) => `<button class="vb-chip ${s.mpMode === m ? 'on' : ''}" data-act="mp-mode" data-v="${m}">${MODES[m].name}</button>`).join('');
    const maps = MAP_LIST.map((m) => `<option value="${m.id}" ${s.mpMap === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
    const mis = CAMPAIGN.map((m) => `<option value="${m.id}" ${s.mpMission === m.id ? 'selected' : ''}>${m.id.slice(1)} · ${esc(m.title)}</option>`).join('');
    const info = { coop: `2 to ${NET.maxPlayers.coop} players. Shared objectives, revive downed teammates, extract together.`, tdm: `Two teams of up to ${NET.maxPlayers.tdm / 2}. First to ${MODES.tdm.scoreLimit} eliminations or highest score at time.`, ffa: `Up to ${NET.maxPlayers.ffa} players. First to ${MODES.ffa.scoreLimit} eliminations.` }[s.mpMode];
    const online = a.net && a.net.configured;
    this.setScreen('mp', `${this.topbar('Multiplayer', 'home')}
      <div class="vb-split"><section class="vb-panel"><h3>Create a private lobby</h3><div class="vb-row wrap">${modes}</div><p class="vb-dim">${info}</p>
        ${s.mpMode === 'coop' ? `<label class="vb-field">Mission<select id="vbMpMission" data-mp="mission">${mis}</select></label>` : `<label class="vb-field">Map<select id="vbMpMap" data-mp="map">${maps}</select></label>`}
        <div class="vb-row"><button class="vb-btn primary" data-act="mp-create" ${online ? '' : 'disabled'}>Create lobby</button></div></section>
        <section class="vb-panel"><h3>Join with a code</h3><label class="vb-field">Lobby code<input id="vbCode" class="vb-input code" maxlength="8" placeholder="BLK-7F2K" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(s.code)}"></label>
        <div class="vb-row"><button class="vb-btn" data-act="mp-join" ${online ? '' : 'disabled'}>Join lobby</button></div>
        ${online ? '' : '<p class="vb-warn">Multiplayer server address is not set. See vector/README.md, step "Deploy the multiplayer server".</p>'}</section></div>`);
    const mm = this.q('#vbMpMission'), mp = this.q('#vbMpMap');
    if (mm) this.on(mm, 'change', () => { this.state.mpMission = mm.value; });
    if (mp) this.on(mp, 'change', () => { this.state.mpMap = mp.value; });
    const code = this.q('#vbCode'); if (code) this.on(code, 'input', () => { this.state.code = code.value.toUpperCase(); });
  }

  showLobby(lobby, myId) {
    const s = this.state; s.lobby = lobby; s.myId = myId;
    const isHost = lobby.host === myId; const me = lobby.members.find((m) => m.uid === myId) || {};
    const mode = lobby.config.mode;
    const cfg = `<span class="vb-pill">${MODES[mode].name}</span><span class="vb-pill">${esc(mode === 'coop' ? (CAMPAIGN.find((m) => m.id === lobby.config.mission) || {}).title : (MAP_LIST.find((m) => m.id === lobby.config.mapId) || {}).name)}</span><span class="vb-pill">${lobby.state.replace('_', ' ')}</span>`;
    const rows = lobby.members.map((m) => `<li class="${m.uid === myId ? 'me' : ''}"><span class="vb-dot ${m.presence === 'OFFLINE' ? 'off' : 'on'}"></span><b>${esc(m.name)}</b>${m.isHost ? '<em>HOST</em>' : ''}<span class="vb-lvl">Lv ${m.level}</span>${mode === 'tdm' ? `<span class="vb-team t${m.team}">${m.team ? 'RED' : 'BLUE'}</span>` : ''}<span class="vb-ready ${m.ready || m.isHost ? 'ok' : ''}">${m.isHost ? 'Host' : m.ready ? 'Ready' : 'Not ready'}</span>${isHost && !m.isHost && lobby.state !== 'STARTING' ? `<button class="vb-btn tiny ghost" data-act="mp-kick" data-uid="${esc(m.uid)}">Remove</button>` : ''}</li>`).join('');
    const hostCfg = isHost ? `<div class="vb-row wrap"><span class="vb-label">Mode</span>${['coop', 'tdm', 'ffa'].map((m) => `<button class="vb-chip ${mode === m ? 'on' : ''}" data-cfg-mode="${m}">${MODES[m].name}</button>`).join('')}</div>
      <div class="vb-row wrap"><label class="vb-field inline">${mode === 'coop' ? 'Mission' : 'Map'}<select id="vbCfgSel">${mode === 'coop' ? CAMPAIGN.map((m) => `<option value="${m.id}" ${lobby.config.mission === m.id ? 'selected' : ''}>${m.id.slice(1)} · ${esc(m.title)}</option>`).join('') : MAP_LIST.map((m) => `<option value="${m.id}" ${lobby.config.mapId === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label></div>` : '';
    const teamBtn = mode === 'tdm' && lobby.state !== 'STARTING' ? `<div class="vb-row"><span class="vb-label">Your team</span><button class="vb-chip ${me.team === 0 ? 'on' : ''}" data-act="mp-team" data-v="0">Blue</button><button class="vb-chip ${me.team === 1 ? 'on' : ''}" data-act="mp-team" data-v="1">Red</button></div>` : '';
    const starting = lobby.state === 'STARTING';
    const wait = lobby.state === 'FINISHED' ? '<p class="vb-warn">The last match has ended. Waiting for the host to return everyone to the lobby.</p>' : '';
    this.setScreen('lobby', `${this.topbar('Lobby')}
      <div class="vb-split"><section class="vb-panel"><div class="vb-codebox"><span>Lobby code</span><b>${esc(lobby.code)}</b><button class="vb-btn tiny" data-act="mp-copy">Copy</button></div><div class="vb-row wrap">${cfg}</div>
      <ul class="vb-players">${rows}</ul><p class="vb-dim">${lobby.members.length} / ${lobby.max} players</p>${wait}</section>
      <section class="vb-panel">${hostCfg}${teamBtn}
        <div class="vb-row wrap">${isHost ? `<button class="vb-btn primary" data-act="mp-start" ${starting ? 'disabled' : ''}>${starting ? 'Starting in ' + lobby.countdown + '...' : 'Start match'}</button>` : `<button class="vb-btn primary" data-act="mp-ready" ${starting ? 'disabled' : ''}>${me.ready ? 'Cancel ready' : 'Ready'}</button>`}
        <button class="vb-btn ghost" data-act="mp-leave">Leave lobby</button></div>
        <p class="vb-dim">Your loadout (${esc(LOADOUTS[this.app.store.profile.activeLoadout].name)}) is used in the match. Change it from the main menu before joining.</p></section></div>`);
    for (const b of this.scr.querySelectorAll('[data-cfg-mode]')) this.on(b, 'click', () => this.app.mpConfig({ mode: b.dataset.cfgMode }));
    const sel = this.q('#vbCfgSel'); if (sel) this.on(sel, 'change', () => this.app.mpConfig(mode === 'coop' ? { mission: sel.value } : { mapId: sel.value }));
  }

  /* ---------------- loadout ---------------- */
  showLoadout(after) {
    const a = this.app, p = a.store.profile, lv = p.level, active = p.activeLoadout;
    const cards = Object.values(LOADOUTS).map((l) => {
      const lo = l.id === 'CUSTOM' ? p.loadouts.CUSTOM : l;
      return `<button class="vb-lo ${l.id === active ? 'sel' : ''}" data-act="set-loadout" data-id="${l.id}"><b>${esc(l.name)}</b><em>${esc(l.desc)}</em><span>${esc(WEAPONS[lo.primary].name)} · ${esc(WEAPONS[lo.secondary].name)}</span><span>${esc(EQUIPMENT[lo.tactical].name)} · ${esc(ARMOR[lo.armor].name)}</span></button>`; }).join('');
    const c = p.loadouts.CUSTOM;
    const wsel = (slot, cur) => `<select data-lo="${slot}">${Object.values(WEAPONS).filter((w) => w.slot === slot).map((w) => `<option value="${w.id}" ${w.id === cur ? 'selected' : ''} ${w.unlock > lv ? 'disabled' : ''}>${esc(w.name)} (${esc(w.cat)})${w.unlock > lv ? ' · Lv ' + w.unlock : ''}</option>`).join('')}</select>`;
    const custom = active === 'CUSTOM' ? `<section class="vb-panel"><h3>Custom build</h3>
      <label class="vb-field">Primary${wsel('primary', c.primary)}</label><label class="vb-field">Secondary${wsel('secondary', c.secondary)}</label>
      <label class="vb-field">Tactical<select data-lo="tactical">${Object.values(EQUIPMENT).filter((e) => e.id !== 'medkit').map((e) => `<option value="${e.id}" ${c.tactical === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
      <label class="vb-field">Armour<select data-lo="armor">${['none', 'light', 'medium', 'heavy'].map((k) => `<option value="${k}" ${c.armor === k ? 'selected' : ''}>${ARMOR[k].name}</option>`).join('')}</select></label>
      <label class="vb-field">Medkits<select data-lo="heal">${[0, 1, 2, 3].map((n) => `<option value="${n}" ${c.heal === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <p class="vb-dim">Heavier armour absorbs more damage but slows you down and slows your aim.</p></section>` : '';
    const lo = a.store.activeLoadout(); const w = WEAPONS[lo.primary], ar = ARMOR[lo.armor];
    this.setScreen('loadout', `${this.topbar('Loadout', after ? '' : 'home')}
      <div class="vb-split"><div class="vb-list">${cards}</div><div>${custom}
      <section class="vb-panel"><h3>Selected</h3><div class="vb-stat-grid">${this.weaponBars(w)}<div class="vb-kv"><span>Armour</span><b>${ar.name}: absorbs ${Math.round(ar.absorb * 100)}%, speed ${Math.round(ar.speed * 100)}%, aim ${Math.round(ar.aim * 100)}%</b></div></div>
      ${after ? '<div class="vb-row"><button class="vb-btn primary" data-act="deploy-now">Deploy</button><button class="vb-btn ghost" data-act="back">Cancel</button></div>' : ''}</section></div></div>`);
    if (after) { const b = this.q('[data-act="deploy-now"]'); if (b) this.on(b, 'click', () => after()); }
  }
  onCustomLoadout(el) {
    const p = this.app.store.profile, c = { ...p.loadouts.CUSTOM }; c[el.dataset.lo] = el.dataset.lo === 'heal' ? +el.value : el.value;
    this.app.store.setLoadout('CUSTOM', sanitizeLoadout(c, p.level)); this.showLoadout(this._after);
  }
  weaponBars(w) {
    const bar = (label, v, max) => `<div class="vb-bar-row"><span>${label}</span><div class="vb-meter"><i style="width:${Math.min(100, v / max * 100)}%"></i></div><b>${Math.round(v)}</b></div>`;
    return `<div class="vb-wname">${esc(w.name)} <em>${esc(w.cat)}</em></div>${bar('Damage', w.damage * w.pellets, 160)}${bar('Fire rate', w.rpm, 900)}${bar('Magazine', w.mag, 32)}${bar('Reserve', w.reserve, 160)}${bar('Range', w.range, 200)}${bar('Mobility', w.moveMult * 100, 105)}`;
  }

  /* ---------------- operators (cosmetics) ---------------- */
  showOperators() {
    const a = this.app, p = a.store.profile, s = this.state, lv = p.level, look = p.look;
    const tabs = [['face', 'Face'], ['skin', 'Skin'], ['hair', 'Hair'], ['outfit', 'Outfit'], ['vest', 'Vest'], ['helmet', 'Helmet'], ['gloves', 'Gloves'], ['backpack', 'Backpack'], ['weaponSkin', 'Weapon skin'], ['emblem', 'Emblem'], ['banner', 'Banner']];
    const list = COSMETICS[s.opTab] || [];
    const items = list.map((o) => { const locked = (o.unlock || 1) > lv; const sw = o.color || o.tint ? `<i class="vb-sw" style="background:${o.color || o.tint}"></i>` : o.glyph ? `<i class="vb-sw glyph">${esc(o.glyph)}</i>` : '';
      return `<button class="vb-opt ${look[s.opTab] === o.id ? 'sel' : ''}" data-act="look" data-k="${s.opTab}" data-v="${o.id}" ${locked ? 'disabled' : ''}>${sw}<span>${esc(o.name)}</span>${locked ? `<em>Lv ${o.unlock}</em>` : ''}</button>`; }).join('');
    this.setScreen('operators', `${this.topbar('Operators', 'home')}
      <div class="vb-split wide"><div><div class="vb-tabs">${tabs.map(([k, n]) => `<button class="vb-chip ${s.opTab === k ? 'on' : ''}" data-act="op-tab" data-v="${k}">${n}</button>`).join('')}</div><div class="vb-opts">${items}</div>
        <p class="vb-dim">Cosmetics change how you look. They never change your stats.</p></div><div class="vb-preview-gap" aria-hidden="true"></div></div>`, 'vb-preview');
    this.app.menuBackdrop(true, true);
  }

  /* ---------------- armory ---------------- */
  showArmory() {
    const lv = this.app.store.profile.level;
    const w = Object.values(WEAPONS).map((x) => `<article class="vb-wcard ${x.unlock > lv ? 'lock' : ''}">${this.weaponBars(x)}<div class="vb-dim">${x.unlock > lv ? 'Unlocks at level ' + x.unlock : 'Unlocked'} · ${x.auto ? 'Automatic' : 'Semi-auto'}${x.pellets > 1 ? ' · ' + x.pellets + ' pellets' : ''}</div></article>`).join('');
    const e = Object.values(EQUIPMENT).map((x) => `<article class="vb-wcard"><div class="vb-wname">${esc(x.name)}</div><p class="vb-dim">${esc(x.desc)}</p></article>`).join('');
    this.setScreen('armory', `${this.topbar('Armory', 'home')}<h3 class="vb-sub">Weapons</h3><div class="vb-grid">${w}</div><h3 class="vb-sub">Tactical equipment</h3><div class="vb-grid">${e}</div>`);
  }

  /* ---------------- profile ---------------- */
  showProfile() {
    const p = this.app.store.profile, lv = levelFromXp(p.xp), s = p.stats;
    const acc = s.shots ? Math.round(s.hits / s.shots * 100) : 0;
    const kd = (s.kills / Math.max(1, s.deaths)).toFixed(2);
    const kv = (k, v) => `<div class="vb-kv"><span>${k}</span><b>${v}</b></div>`;
    this.setScreen('profile', `${this.topbar('Profile', 'home')}
      <div class="vb-split"><section class="vb-panel"><h3>Operative</h3><label class="vb-field">Callsign<input id="vbName" class="vb-input" maxlength="18" value="${esc(p.name || this.app.userName || '')}"></label><div class="vb-row"><button class="vb-btn" data-act="name-save">Save callsign</button></div>
        <div class="vb-level big">Level ${lv.level}</div><div class="vb-xp"><i style="width:${Math.round(lv.into / lv.need * 100)}%"></i></div><div class="vb-xp-t">${lv.into} / ${lv.need} XP to next level</div>
        <div class="vb-row"><button class="vb-btn ghost danger" data-act="reset-profile">Erase progress</button></div></section>
        <section class="vb-panel"><h3>Career</h3><div class="vb-stat-grid">${kv('Missions completed', s.missions)}${kv('Matches played', s.matches)}${kv('Wins', s.wins)}${kv('Eliminations', s.kills)}${kv('Assists', s.assists)}${kv('Deaths', s.deaths)}${kv('K/D', kd)}${kv('Accuracy', acc + '%')}${kv('Headshots', s.headshots)}${kv('Objectives', s.objectives)}${kv('Distance', Math.round(s.dist / 1000 * 10) / 10 + ' km')}${kv('Play time', Math.round(s.playtime / 60) + ' min')}</div></section></div>`);
  }

  /* ---------------- settings / controls ---------------- */
  showSettings(from) {
    this.state.settingsFrom = from; const set = this.app.store.settings;
    const rows = SETTINGS_SCHEMA.map((g) => `<section class="vb-panel"><h3>${g.group}</h3>${g.items.map((it) => {
      const v = set[it.k];
      if (it.type === 'toggle') return `<label class="vb-set"><span>${it.label}</span><input type="checkbox" data-setting="${it.k}" ${v ? 'checked' : ''}></label>`;
      if (it.type === 'select') return `<label class="vb-set"><span>${it.label}</span><select data-setting="${it.k}">${it.opts.map(([val, n]) => `<option value="${val}" ${val === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
      return `<label class="vb-set"><span>${it.label}</span><input type="range" data-setting="${it.k}" min="${it.min}" max="${it.max}" step="${it.step}" value="${v}"><output>${it.fmt(v)}</output></label>`; }).join('')}</section>`).join('');
    this.setScreen('settings', `<header class="vb-top"><div class="vb-top-title">Settings</div><div class="vb-row"><button class="vb-btn ghost small" data-act="reset-settings">Reset</button><button class="vb-btn small" data-act="settings-back">Done</button></div></header><div class="vb-grid cols2">${rows}</div>`, from === 'pause' ? 'vb-dim' : '');
  }
  onSetting(el, commit) {
    const k = el.dataset.setting, item = SETTINGS_SCHEMA.flatMap((g) => g.items).find((i) => i.k === k); if (!item) return;
    let v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? parseFloat(el.value) : el.value;
    this.app.store.setSetting(k, v);
    if (el.type === 'range') { const out = el.parentElement.querySelector('output'); if (out) out.textContent = item.fmt(v); }
    this.app.applySettings(); if (commit) this.app.store.flush();
  }
  showControls(from) {
    this.state.settingsFrom = from;
    const k = (a, b) => `<div class="vb-kv"><span>${a}</span><b>${b}</b></div>`;
    this.setScreen('controls', `<header class="vb-top"><div class="vb-top-title">Controls</div><button class="vb-btn small" data-act="controls-back">Done</button></header>
      <div class="vb-grid cols2"><section class="vb-panel"><h3>Keyboard and mouse</h3>${k('Move', 'W A S D')}${k('Look', 'Mouse')}${k('Fire / Aim', 'Left / Right mouse')}${k('Sprint', 'Shift')}${k('Crouch', 'C (toggle) or Ctrl')}${k('Jump', 'Space')}${k('Reload', 'R')}${k('Interact / Revive', 'Hold E')}${k('Weapons', '1, 2, Q or wheel')}${k('Equipment', 'G')}${k('Medkit', 'H')}${k('Swap shoulder', 'V')}${k('Scoreboard', 'Tab')}${k('Pause', 'Esc')}</section>
      <section class="vb-panel"><h3>Touch (landscape)</h3>${k('Move', 'Left stick (push fully to sprint)')}${k('Look', 'Drag the right side')}${k('Fire', 'FIRE')}${k('Aim', 'AIM (toggle)')}${k('Reload', 'RLD')}${k('Jump / Crouch', 'JMP / CRCH')}${k('Interact', 'Hold USE')}${k('Weapon', 'SWAP')}${k('Equipment / Medkit', 'EQP / MED')}${k('Pause', 'II')}</section></div>`, from === 'pause' ? 'vb-dim' : '');
  }

  /* ---------------- pause ---------------- */
  showPause() {
    const camp = this.app.engine && this.app.engine.kind === 'local';
    this.setScreen('pause', `<div class="vb-center"><div class="vb-panel narrow"><h2>Paused</h2><div class="vb-stack">
      <button class="vb-btn primary" data-act="resume" data-autofocus>Resume</button><button class="vb-btn" data-act="pause-settings">Settings</button><button class="vb-btn" data-act="pause-controls">Controls</button>
      ${camp ? '<button class="vb-btn" data-act="restart-cp">Restart checkpoint</button>' : ''}<button class="vb-btn ghost danger" data-act="exit-mission">${camp ? 'Exit mission' : 'Leave match'}</button></div>
      ${camp ? '' : '<p class="vb-dim">Online matches keep running while this menu is open.</p>'}</div></div>`, 'vb-dim');
  }

  /* ---------------- results ---------------- */
  showResults(result, summary, meId, kind) {
    this.hud.hidden = true; const ok = result.outcome === 'SUCCESS', mine = result.players.find((p) => p.id === meId) || { stats: {} };
    const m = result.mission ? CAMPAIGN.find((x) => x.id === result.mission) : null;
    const title = m ? (ok ? 'MISSION COMPLETE' : 'MISSION FAILED') : result.mode === 'ffa' ? (result.winnerId === meId ? 'VICTORY' : 'MATCH OVER') : result.mode === 'tdm' ? (result.winnerTeam === -1 ? 'DRAW' : (mine.team === result.winnerTeam ? 'VICTORY' : 'DEFEAT')) : 'MATCH OVER';
    const rows = result.players.slice().sort((a, b) => b.score - a.score).map((p) => `<tr class="${p.id === meId ? 'me' : ''}"><td>${esc(p.name)}</td><td>${p.score}</td><td>${p.stats.kills}</td><td>${p.stats.assists}</td><td>${p.stats.deaths}</td><td>${p.stats.shots ? Math.round(p.stats.hits / p.stats.shots * 100) : 0}%</td><td>+${p.xp}</td></tr>`).join('');
    const lvl = summary ? `<div class="vb-xp-t">+${summary.xp} XP${summary.levelAfter > summary.levelBefore ? ` · Level ${summary.levelAfter}!` : ''}${summary.unlockedNext ? ' · Next mission unlocked' : ''}</div>` : '';
    const btns = kind === 'local'
      ? (ok ? `<button class="vb-btn primary" data-act="results-continue" data-v="menu">Continue</button>${m && m.reward.unlock ? '<button class="vb-btn" data-act="results-continue" data-v="next">Next mission</button>' : ''}` : '<button class="vb-btn primary" data-act="results-continue" data-v="retry">Retry from checkpoint</button><button class="vb-btn ghost" data-act="results-continue" data-v="menu">Main menu</button>')
      : '<button class="vb-btn primary" data-act="results-continue" data-v="lobby">Back to lobby</button><button class="vb-btn ghost" data-act="results-continue" data-v="menu">Leave</button>';
    this.setScreen('results', `<div class="vb-center"><div class="vb-panel wide"><div class="vb-kicker">${esc(m ? 'MISSION ' + m.id.slice(1) + ' · ' + m.title : MODES[result.mode].name)}</div><h1 class="${ok || /VICTORY/.test(title) ? 'good' : 'bad'}">${title}</h1>
      <p class="vb-dim">${esc(result.reason || '')} · ${fmtTime(result.time)}</p>${lvl}
      <div class="vb-tablewrap"><table class="vb-table"><thead><tr><th>Operative</th><th>Score</th><th>Elims</th><th>Assists</th><th>Deaths</th><th>Acc</th><th>XP</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="vb-row wrap">${btns}</div></div></div>`, 'vb-dim');
  }

  /* ============================================================
     HUD
     ============================================================ */
  buildHud() {
    this.hud.innerHTML = `
      <div class="vb-vig" id="hVig"></div><div class="vb-flash" id="hFlash"></div><div class="vb-scope" id="hScope"><i></i><b></b></div>
      <div class="vb-hits" id="hHits"></div>
      <div class="vb-cross" id="hCross"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><u id="hMark"></u></div>
      <div class="vb-tags" id="hTags"></div><div class="vb-ways" id="hWays"></div>
      <div class="vb-tl"><div class="vb-obj" id="hObj"><div class="vb-obj-k" id="hObjK">OBJECTIVE</div><div class="vb-obj-t" id="hObjT"></div><div class="vb-meter thin" id="hObjBarW"><i id="hObjBar"></i></div><div class="vb-obj-s" id="hObjS"></div></div><div class="vb-feed" id="hFeed"></div></div>
      <div class="vb-tr"><canvas id="hMini" width="176" height="176" aria-label="Minimap"></canvas><div class="vb-score" id="hScore"></div><div class="vb-ping" id="hPing"></div></div>
      <div class="vb-bl"><div class="vb-squad" id="hSquad"></div><div class="vb-vitals"><div class="vb-hp"><span id="hHpT">100</span><div class="vb-meter hp"><i id="hHp"></i></div></div><div class="vb-ar"><span id="hArT">0</span><div class="vb-meter ar"><i id="hAr"></i></div></div></div></div>
      <div class="vb-br"><div class="vb-eq" id="hEq"></div><div class="vb-ammo"><div class="vb-wn" id="hWn"></div><div class="vb-am"><b id="hMag">0</b><span id="hRes">/ 0</span></div><div class="vb-meter thin" id="hRelW"><i id="hRel"></i></div></div></div>
      <div class="vb-prompt" id="hPrompt" hidden><div class="vb-ring"><i id="hPromptBar"></i></div><span id="hPromptT"></span></div>
      <div class="vb-center-msg" id="hMsg"></div>
      <div class="vb-sub-line" id="hSub" hidden><b id="hSubWho"></b><span id="hSubTxt"></span></div>
      <div class="vb-board" id="hBoard" hidden></div>`;
    const g = (id) => this.hud.querySelector('#' + id);
    this.H = { vig: g('hVig'), flash: g('hFlash'), scope: g('hScope'), hits: g('hHits'), cross: g('hCross'), mark: g('hMark'), tags: g('hTags'), ways: g('hWays'), obj: g('hObj'), objK: g('hObjK'), objT: g('hObjT'), objBarW: g('hObjBarW'), objBar: g('hObjBar'), objS: g('hObjS'), feed: g('hFeed'),
      mini: g('hMini'), score: g('hScore'), ping: g('hPing'), squad: g('hSquad'), hpT: g('hHpT'), hp: g('hHp'), arT: g('hArT'), ar: g('hAr'), eq: g('hEq'), wn: g('hWn'), mag: g('hMag'), res: g('hRes'), relW: g('hRelW'), rel: g('hRel'),
      prompt: g('hPrompt'), promptBar: g('hPromptBar'), promptT: g('hPromptT'), msg: g('hMsg'), sub: g('hSub'), subWho: g('hSubWho'), subTxt: g('hSubTxt'), board: g('hBoard') };
    this.mini = this.H.mini.getContext('2d');
  }

  showHud(v) { this.hud.hidden = !v; if (v) { this.hideScreen(); this.applyHudScale(); } }
  applyHudScale() { this.root.style.setProperty('--hud', this.app.store.settings.hudScale); }
  setText(el, v) { if (el.textContent !== v) el.textContent = v; }
  setW(el, pct) { const v = Math.max(0, Math.min(100, pct)).toFixed(1) + '%'; if (el.style.width !== v) el.style.width = v; }

  subtitle(who, text, ms = 5200) {
    if (!this.app.store.settings.subtitles) return;
    const H = this.H; H.sub.hidden = false; H.subWho.textContent = who ? who + ': ' : ''; H.subTxt.textContent = text;
    clearTimeout(this.subT); this.subT = setTimeout(() => { H.sub.hidden = true; }, ms);
  }
  banner(text, ms = 2200) { const m = this.H.msg; m.textContent = text; m.classList.add('show'); clearTimeout(this._mt); this._mt = setTimeout(() => m.classList.remove('show'), ms); }
  hitMarker(head) { const m = this.H.mark; m.className = 'on' + (head ? ' head' : ''); clearTimeout(this._hm); this._hm = setTimeout(() => { m.className = ''; }, 140); }

  /* Called every frame while playing. */
  updateHud(eng) {
    const H = this.H, h = eng.hud, w = h.slots[h.cur];
    this.hud.classList.toggle('vb-cine', !!eng.cine);
    this.setText(H.hpT, String(Math.max(0, Math.round(h.hp)))); this.setW(H.hp, h.hp / (h.maxHp || 100) * 100);
    this.setText(H.arT, String(Math.round(h.armor))); this.setW(H.ar, h.armorMax ? h.armor / h.armorMax * 100 : 0);
    H.hp.parentElement.classList.toggle('low', h.hp < 30);
    if (w) {
      const def = WEAPONS[w.id]; this.setText(H.wn, def ? def.name : ''); this.setText(H.mag, String(w.m)); this.setText(H.res, '/ ' + w.r);
      H.mag.classList.toggle('low', def && w.m <= Math.ceil(def.mag * 0.25));
      const rel = h.reload > 0 && def ? 1 - h.reload / (def.reload / 1000) : 0; this.setW(H.rel, rel * 100); H.relW.classList.toggle('on', h.reload > 0);
    }
    const eq = h.eq ? EQUIPMENT[h.eq] : null;
    const eqHtml = (eq ? `<span><b>G</b> ${esc(eq.name)} ×${h.eqn}</span>` : '') + `<span><b>H</b> Medkit ×${h.heal}${h.healT > 0 ? ' · healing' : ''}</span>`;
    if (this.cache.eq !== eqHtml) { this.cache.eq = eqHtml; H.eq.innerHTML = eqHtml; }
    // objective
    const m = h.mission;
    if (m && m.text) {
      H.obj.hidden = false; this.setText(H.objT, m.text);
      let sub = ''; let bar = 0;
      if (m.need > 1 && (m.type === 'intel' || m.type === 'investigate' || m.type === 'destroy')) { sub = m.c + ' / ' + m.need; bar = m.c / m.need; }
      else if (m.type === 'secure' || m.type === 'survive' || m.type === 'extract') { bar = m.p; sub = m.type === 'survive' && m.dt !== null ? fmtTime(m.dt) : m.contested ? 'Contested: clear the area' : ''; }
      if (m.dt !== null && m.type !== 'survive') sub = (sub ? sub + ' · ' : '') + 'Time ' + fmtTime(m.dt);
      if (m.tl !== null) sub = (sub ? sub + ' · ' : '') + 'Mission ' + fmtTime(m.tl);
      this.setText(H.objS, sub); H.objBarW.style.display = bar > 0 ? '' : 'none'; this.setW(H.objBar, bar * 100);
      this.setText(H.objK, `OBJECTIVE ${m.i + 1} / ${m.n}`);
    } else if (h.mode === 'tdm' || h.mode === 'ffa') {
      H.obj.hidden = false; this.setText(H.objK, h.mode === 'tdm' ? 'TEAM SKIRMISH' : 'FREE-FOR-ALL'); this.setText(H.objT, h.mode === 'tdm' ? `First to ${MODES.tdm.scoreLimit} eliminations` : `First to ${MODES.ffa.scoreLimit} eliminations`); this.setText(H.objS, h.tl !== null ? fmtTime(h.tl) : ''); H.objBarW.style.display = 'none';
    } else H.obj.hidden = true;
    this.setText(H.score, h.mode === 'tdm' ? `BLUE ${h.ts[0]}  :  ${h.ts[1]} RED` : '');
    this.setText(H.ping, eng.kind === 'net' ? (h.rtt ? h.rtt + ' ms' : '') : '');
    // prompt
    const ip = h.interact;
    if (ip && h.alive) { H.prompt.hidden = false; this.setText(H.promptT, (this.app.input.touch.enabled ? 'Hold USE · ' : 'Hold E · ') + ip.label); this.setW(H.promptBar, ip.p * 100); } else H.prompt.hidden = true;
    // crosshair
    const hip = w && WEAPONS[w.id] ? WEAPONS[w.id].spread.hip : 3; const spread = (h.ads ? 4 : 10 + hip * 3 + (h.bloom || 0) * 6) * (h.crouched ? 0.8 : 1);
    H.cross.style.setProperty('--sp', spread.toFixed(1) + 'px'); H.cross.classList.toggle('ads', !!h.ads); H.cross.hidden = (h.zoom >= 2.5 && h.ads) || !h.alive;
    H.scope.classList.toggle('on', !!(h.ads && h.zoom >= 2.5 && h.alive));
    // screen effects
    const vig = Math.max(h.vignette, h.hp < 30 ? 0.45 : 0); H.vig.style.opacity = this.app.store.settings.reducedMotion ? Math.min(0.5, vig) : vig;
    H.flash.style.opacity = Math.min(1, h.blind > 0 ? h.blind / 1.2 : 0);
    // directional hit indicators
    let hh = ''; for (const d of eng.dirHits) hh += `<i style="transform:rotate(${(d.ang * 180 / Math.PI).toFixed(0)}deg);opacity:${Math.min(1, d.t)}"></i>`; if (this.cache.hh !== hh) { this.cache.hh = hh; H.hits.innerHTML = hh; }
    // kill feed
    let fh = ''; for (const f of eng.killfeed) fh += `<div class="${f.me ? 'me' : ''}${f.dead ? ' dead' : ''}"><b>${esc(f.killer)}</b> ${f.head ? '◎' : '›'} ${esc(f.victim)}</div>`; if (this.cache.fh !== fh) { this.cache.fh = fh; H.feed.innerHTML = fh; }
    // centre messages: downed / respawn
    let msg = '';
    if (h.downed) msg = `DOWN. Teammates can revive you (${h.downT}s)`; else if (!h.alive && eng.kind === 'net' && (h.mode === 'tdm' || h.mode === 'ffa')) msg = `Respawning in ${Math.ceil(h.respawn || 0)}`; else if (!h.alive && h.mode === 'coop') msg = 'You are down. Spectating until revived or mission end';
    if (msg) { H.msg.textContent = msg; H.msg.classList.add('show'); this.stickyMsg = true; } else if (this.stickyMsg) { H.msg.classList.remove('show'); this.stickyMsg = false; }
    this.updateTags(eng); this.updateWays(eng); this.drawMinimap(eng);
    H.board.hidden = !(eng.lastIntent && eng.lastIntent.scoreboard && eng.kind === 'net');
    if (!H.board.hidden) this.drawBoard(eng);
    if (eng.hud.squad && false) void 0;
    this.updateSquad(eng);
  }

  updateTags(eng) {
    const tags = eng.getTags(); let html = '';
    for (const t of tags) html += `<div class="vb-tag-i ${t.kind}${t.dn ? ' dn' : ''}" style="transform:translate(${t.x.toFixed(0)}px,${t.y.toFixed(0)}px)"><span>${esc(t.label || '')}${t.state && t.kind === 'enemy' ? ` <em>${t.state === 'COMBAT' ? 'HOSTILE' : t.state === 'ALERT' ? 'ALERT' : t.state === 'SEARCH' ? 'SEARCHING' : t.state === 'SUSPICIOUS' ? '?' : ''}</em>` : ''}</span><i><u style="width:${Math.round(Math.max(0, Math.min(1, t.hp)) * 100)}%"></u></i></div>`;
    if (this.cache.tags !== html) { this.cache.tags = html; this.H.tags.innerHTML = html; }
  }
  updateWays(eng) {
    const ws = eng.getWaypoints(); let html = '';
    for (const w of ws.slice(0, 4)) {
      const W = this.root.clientWidth, Hh = this.root.clientHeight;
      let x, y, edge = false;
      if (w.sp && w.sp.x > 30 && w.sp.x < W - 30 && w.sp.y > 30 && w.sp.y < Hh - 30) { x = w.sp.x; y = w.sp.y; }
      else { const a = w.ang; x = W / 2 + Math.max(-1, Math.min(1, -Math.sin(a) * 3)) * (W / 2 - 40); y = Hh * 0.2; edge = true; }
      html += `<div class="vb-way${edge ? ' edge' : ''}" style="transform:translate(${x.toFixed(0)}px,${y.toFixed(0)}px);color:${w.color}"><i></i><span>${esc(w.label)} · ${w.dist}m</span></div>`;
    }
    if (this.cache.ways !== html) { this.cache.ways = html; this.H.ways.innerHTML = html; }
  }
  updateSquad(eng) {
    if (eng.mode !== 'coop' && eng.mode !== 'tdm') { if (this.cache.sq) { this.cache.sq = ''; this.H.squad.innerHTML = ''; } return; }
    const s = eng.lastSnap; if (!s) return; let html = '';
    for (const p of s.players) { if (p.id === eng.meId) continue; if (eng.mode === 'tdm' && p.tm !== eng.hud.team) continue; html += `<div class="${p.dn ? 'dn' : !p.al ? 'dead' : ''}"><b>${esc(p.n)}</b><div class="vb-meter thin"><i style="width:${p.dn ? 100 : p.hp}%"></i></div><em>${p.dn ? 'DOWN' : !p.al ? 'OUT' : !p.cn ? 'LOST' : ''}</em></div>`; }
    if (this.cache.sq !== html) { this.cache.sq = html; this.H.squad.innerHTML = html; }
  }
  drawBoard(eng) {
    const rows = eng.scoreboard.slice().sort((a, b) => b.sc - a.sc).map((p) => `<tr class="${p.me ? 'me' : ''}"><td>${esc(p.n)}${p.cn ? '' : ' (offline)'}</td>${eng.mode === 'tdm' ? `<td>${p.tm ? 'RED' : 'BLUE'}</td>` : ''}<td>${p.sc}</td><td>${p.k}</td><td>${p.a}</td><td>${p.d}</td></tr>`).join('');
    const html = `<table class="vb-table"><thead><tr><th>Operative</th>${eng.mode === 'tdm' ? '<th>Team</th>' : ''}<th>Score</th><th>Elims</th><th>Assists</th><th>Deaths</th></tr></thead><tbody>${rows}</tbody></table>`;
    if (this.cache.board !== html) { this.cache.board = html; this.H.board.innerHTML = html; }
  }

  /* Minimap: static wall layer cached per map, drawn rotated around the player. */
  buildMiniStatic(map) {
    const S = 4, size = Math.ceil(map.half * 2 * S); const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    g.fillStyle = '#0b1014'; g.fillRect(0, 0, size, size);
    for (const d of map.decor) if (d.type === 'road' || d.type === 'floor') { g.fillStyle = d.type === 'road' ? '#1a2128' : '#161c22'; g.fillRect((d.x - d.w / 2 + map.half) * S, (d.z - d.d / 2 + map.half) * S, d.w * S, d.d * S); }
    for (const d of map.decor) if (d.type === 'water') { g.fillStyle = '#10303f'; g.fillRect((d.x - d.w / 2 + map.half) * S, (d.z - d.d / 2 + map.half) * S, d.w * S, d.d * S); }
    for (const b of map.boxes) { if (!b.solid || b.door || b.kind === 'roof' || b.maxY < 0.9) continue; g.fillStyle = b.kind === 'cover' ? '#3a444d' : '#6b7782'; g.fillRect((b.minX + map.half) * S, (b.minZ + map.half) * S, b.w * S, b.d * S); }
    this.mmStatic = { c, map, S };
  }
  drawMinimap(eng) {
    const data = eng.getMinimap(); if (!data || !this.mini) return;
    if (!this.mmStatic || this.mmStatic.map !== eng.map) this.buildMiniStatic(eng.map);
    const g = this.mini, W = 176, R = 80, view = 34, k = R / view, { c, S } = this.mmStatic, half = data.half;
    g.save(); g.clearRect(0, 0, W, W); g.translate(W / 2, W / 2);
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.clip(); g.fillStyle = '#05080a'; g.fillRect(-R, -R, 2 * R, 2 * R);
    g.rotate(data.me.yaw);
    g.drawImage(c, -(data.me.x + half) * k, -(data.me.z + half) * k, c.width / S * k, c.height / S * k);
    const P = (x, z) => [(x - data.me.x) * k, (z - data.me.z) * k];
    for (const z of [data.zones.extract].filter(Boolean)) { const [x, y] = P(z.x, z.z); g.strokeStyle = '#4fe3a0'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, z.r * k, 0, 6.28); g.stroke(); }
    for (const o of data.objectives) { const [x, y] = P(o.x, o.z); const d = Math.hypot(x, y); const px = d > R - 8 ? x / d * (R - 8) : x, py = d > R - 8 ? y / d * (R - 8) : y; g.fillStyle = o.color; g.beginPath(); g.moveTo(px, py - 6); g.lineTo(px + 5, py); g.lineTo(px, py + 6); g.lineTo(px - 5, py); g.closePath(); g.fill(); }
    for (const m of data.mates) { const [x, y] = P(m.x, m.z); g.fillStyle = m.dn ? '#ffb347' : '#5bb8ff'; g.fillRect(x - 3, y - 3, 6, 6); }
    for (const h of data.hostile) { const [x, y] = P(h.x, h.z); g.fillStyle = '#ff5a4a'; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 4, y + 3); g.lineTo(x - 4, y + 3); g.closePath(); g.fill(); }
    for (const h of data.foes) { const [x, y] = P(h.x, h.z); g.fillStyle = '#ff5a4a'; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 4, y + 3); g.lineTo(x - 4, y + 3); g.closePath(); g.fill(); }
    g.restore();
    g.save(); g.translate(W / 2, W / 2); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill(); g.restore();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, W / 2, R, 0, 6.28); g.stroke();
  }

  dispose() {
    for (const [t, type, fn, o] of this.listeners) t.removeEventListener(type, fn, o); this.listeners.length = 0;
    for (const t of this.timers) clearTimeout(t); this.timers.length = 0; clearTimeout(this.subT); clearTimeout(this._mt); clearTimeout(this._hm);
    this.mmStatic = null; this.mini = null; this.root.innerHTML = '';
  }
}
