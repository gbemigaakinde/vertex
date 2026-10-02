/* ============================================================
   vector/index.js  |  VECTOR: BLACKLINE entry point and lifecycle.

   window.VectorBlackline = { init, open, close, destroy }   (nothing else)

   open()   builds the UI, checks orientation, loads, shows the main menu
   close()  stops the loop, audio, timers, sockets and listeners, frees
            WebGL memory, releases orientation lock and fullscreen
   destroy() close() + forget the instance
   ============================================================ */
import { API_BASE, VERSION } from './config.js';
import { Store } from './storage.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Engine } from './engine.js';
import { NetClient } from './multiplayer.js';
import { Renderer, detectQuality, webglAvailable } from './renderer.js';
import { CAMPAIGN } from './missions.js';

class App {
  constructor(opts) {
    this.opts = opts || {}; this.root = null; this.ui = null; this.renderer = null; this.engine = null; this.input = null; this.audio = null; this.net = null; this.store = null;
    this.open_ = false; this.listeners = []; this.timers = []; this.uid = null; this.userName = ''; this.menuRaf = 0; this.menuBig = false; this.inMatch = false;
    this.lockedOrientation = false; this.enteredFs = false; this.portrait = false; this.pausedByPortrait = false; this.apiBase = '';
    this.params = new URLSearchParams(location.search);
  }

  on(t, type, fn, o) { t.addEventListener(type, fn, o); this.listeners.push([t, type, fn, o]); }

  /* ---------------- identity (reuses Vertex's Firebase sign-in) ---------------- */
  async resolveUser() {
    const guestOk = this.params.get('guest') === '1';
    const auth = window.fbAuth || (window.firebase && window.firebase.auth && window.firebase.apps && window.firebase.apps.length ? window.firebase.auth() : null);
    if (auth) {
      const user = await new Promise((res) => { let done = false; const off = auth.onAuthStateChanged((u) => { if (done) return; done = true; off(); res(u); }, () => { if (!done) { done = true; res(null); } }); setTimeout(() => { if (!done) { done = true; res(auth.currentUser || null); } }, 5000); });
      if (user) {
        this.uid = user.uid; this.userName = user.displayName || (user.email ? user.email.split('@')[0] : 'Operative');
        this.getToken = () => user.getIdToken();
        return true;
      }
    }
    if (guestOk) {
      // Dev/test mode only (needs ?guest=1). The id rule matches server/worker.js so both sides agree who is who.
      this.userName = (this.params.get('name') || 'Guest').slice(0, 18);
      this.uid = 'guest-' + this.userName.toLowerCase().replace(/[^a-z0-9]/g, '');
      this.getToken = async () => 'guest:' + this.userName;
      return true;
    }
    return false;
  }

  /* ---------------- open ---------------- */
  async open() {
    if (this.open_) return; this.open_ = true;
    this.root = document.getElementById('vectorBlacklineRoot') || Object.assign(document.createElement('div'), { id: 'vectorBlacklineRoot' });
    if (!this.root.parentNode) document.body.appendChild(this.root);
    this.ownRoot = !document.getElementById('vectorBlacklineRoot') || true;
    this.root.classList.add('vector-blackline'); this.root.hidden = false; document.documentElement.classList.add('vb-open'); document.body.classList.add('vb-open');
    this.audio = new AudioSys();
    if (this.params.get('debug') === '1') window.__vectorDebug = this;   // test hook, only with ?debug=1
    this.ui = new UI(this.root, this);
    this.ui.showLoading('INITIALIZING...');
    this.apiBase = (this.params.get('api') || this.opts.apiBase || API_BASE || '').replace(/\/$/, '');
    // orientation handling starts immediately so the prompt can appear over the loader
    this.watchOrientation();
    if (!webglAvailable()) return this.fatal('Graphics not available', 'Your browser cannot run 3D graphics (WebGL). Try an up-to-date Chrome, Edge, Firefox or Safari, and make sure hardware acceleration is on.');
    this.ui.setLoading(0.1, 'CHECKING SIGN-IN...');
    let signedIn = false;
    try { signedIn = await this.resolveUser(); } catch { signedIn = false; }
    if (!this.open_) return;
    if (!signedIn) return this.fatal('Sign in to Vertex', 'VECTOR: BLACKLINE uses your Vertex account. Please sign in to Vertex first, then open the game again.', [{ act: 'exit-vertex', label: 'Go to Vertex', primary: true }]);
    this.store = new Store(this.uid, this.getToken, this.apiBase);
    if (!this.store.profile.name) this.store.profile.name = this.userName;
    this.net = new NetClient({ apiBase: this.apiBase, getToken: this.getToken, getProfile: () => ({ level: this.store.profile.level, loadout: this.store.activeLoadout(), look: this.store.profile.look, name: this.store.profile.name }), onMessage: (m) => this.onNet(m), onState: (s, x) => this.onNetState(s, x) });
    this.ui.setLoading(0.3, 'LOADING OPERATIVE...');
    try {
      const q = this.store.settings.quality === 'auto' ? detectQuality() : this.store.settings.quality;
      this.autoQuality = this.store.settings.quality === 'auto';
      this.input = new Input(this.root, this.ui.canvas, () => this.store.settings);
      this.renderer = new Renderer(this.ui.canvas, q);
      this.resize();
      this.input.onLockChange = (locked) => { if (!locked && this.engine && this.engine.running && !this.engine.paused && !this.input.touch.enabled && !this.engine.cine) this.pause(); };
      this.input.enable();
      this.root.classList.toggle('vb-touchmode', !!this.input.touch.enabled); this.input.setTouchVisible(false);
      this.engine = new Engine({ renderer: this.renderer, audio: this.audio, input: this.input, store: this.store, hooks: this.engineHooks(q) });
    } catch (e) {
      return this.fatal('Could not start the game', 'Something went wrong while starting the graphics: ' + (e && e.message ? e.message : 'unknown error'));
    }
    this.on(window, 'resize', () => this.resize()); this.on(window, 'orientationchange', () => this.later(() => { this.resize(); this.checkOrientation(); }, 250));
    if (window.ResizeObserver) { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.root); }
    this.on(document, 'visibilitychange', () => { if (document.hidden) { if (this.engine && this.engine.running && this.engine.kind === 'local') this.pause(); this.audio.suspend(); } else if (!this.engine || !this.engine.paused) this.audio.resume(); });
    this.on(document, 'fullscreenchange', () => this.resize());
    this.on(this.root, 'pointerdown', () => { this.audio.unlock(); this.firstGesture(); }, { once: false, passive: true });
    this.on(window, 'beforeunload', () => { if (this.store) this.store.flush(); });
    this.applySettings();
    this.ui.setLoading(0.8, 'LOADING WORLD...');
    await this.renderer.startMenu(this.store.profile.look).catch(() => {});
    this.ui.setLoading(1, 'READY');
    this.later(() => { if (!this.open_) return; this.ui.hideLoading(); this.ui.showMenu(); this.checkOrientation(); }, 250);
  }

  fatal(title, msg, actions) { if (this.ui) this.ui.showError(title, msg, actions); }
  later(fn, ms) { const t = setTimeout(() => { this.timers = this.timers.filter((x) => x !== t); fn(); }, ms); this.timers.push(t); return t; }

  engineHooks(ceiling) {
    return {
      qualityCeiling: ceiling,
      onLoad: (f) => this.ui && this.ui.setLoading(f),
      onFrame: (eng) => this.ui && this.ui.updateHud(eng),
      onPause: () => this.pause(),
      onEnd: (r) => this.onEnd(r),
      onDialogue: (e) => { this.ui.subtitle(e.who, e.text); },
      onSubtitle: (t) => this.ui.subtitle('', t, 4200),
      onObjective: (e) => { if (e.index > 0) this.ui.banner('OBJECTIVE: ' + e.text.toUpperCase()); },
      onToast: (m) => this.ui.toast(m),
      onHitMarker: (h) => this.ui.hitMarker(h),
      onHurt: () => {},
      onCineEnd: () => { if (this.engine.mission) this.ui.banner('GO', 1200); },
      onQuality: (q) => { this.ui.toast('Graphics adjusted to ' + q.toLowerCase() + ' for smoother play'); },
    };
  }

  /* ---------------- orientation: landscape-first on touch devices ---------------- */
  isTouch() { return !!(this.input ? this.input.touch.enabled : ('ontouchstart' in window || navigator.maxTouchPoints > 0)) && (window.matchMedia ? window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window : true); }
  isPortrait() { return window.matchMedia ? window.matchMedia('(orientation: portrait)').matches : window.innerHeight > window.innerWidth; }
  watchOrientation() {
    this.on(window, 'resize', () => this.checkOrientation());
    if (screen.orientation && screen.orientation.addEventListener) this.on(screen.orientation, 'change', () => this.checkOrientation());
  }
  /* The prompt only ever shows on touch devices. Desktop is never affected. */
  checkOrientation() {
    if (!this.open_ || !this.ui) return;
    const portrait = this.isTouch() && this.isPortrait();
    this.portrait = portrait; this.ui.showOrient(portrait);
    this.root.classList.toggle('vb-portrait', portrait);
    if (portrait) { if (this.engine && this.engine.running && !this.engine.paused) { this.engine.setPaused(true, 'portrait'); this.pausedByPortrait = true; } }
    else if (this.pausedByPortrait) { this.pausedByPortrait = false; if (this.engine && this.engine.pauseReason === 'portrait') { this.engine.pauseReason = 'menu'; this.pausedMenu = true; this.input.setTouchVisible(false); this.ui.showPause(); } }
    if (!portrait) this.resize();
  }
  /* Browsers only allow fullscreen and orientation lock after a tap. */
  async firstGesture() {
    if (this.gestureDone || !this.isTouch()) return; this.gestureDone = true;
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) { await el.requestFullscreen({ navigationUI: 'hide' }); this.enteredFs = true; }
    } catch { /* iOS Safari and some in-app browsers refuse: the rotate prompt covers it */ }
    try { if (screen.orientation && screen.orientation.lock) { await screen.orientation.lock('landscape'); this.lockedOrientation = true; } } catch { /* not supported or not allowed: rely on the prompt */ }
    this.checkOrientation();
  }
  toggleFullscreen() { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch { /* ignore */ } }
  releaseOrientation() {
    try { if (this.lockedOrientation && screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch { /* ignore */ }
    this.lockedOrientation = false;
    try { if (this.enteredFs && document.fullscreenElement) document.exitFullscreen(); } catch { /* ignore */ }
    this.enteredFs = false;
  }

  resize() {
    if (!this.renderer || !this.root) return;
    const w = this.root.clientWidth || window.innerWidth, h = this.root.clientHeight || window.innerHeight;
    this.renderer.resize(w, h);
  }

  applySettings() {
    const s = this.store.settings;
    this.audio.setVolumes({ master: s.masterVol, sfx: s.sfxVol, music: s.musicVol, voice: s.voiceVol });
    if (this.renderer) { const q = s.quality === 'auto' ? (this.autoQualityName || detectQuality()) : s.quality; this.autoQuality = s.quality === 'auto'; if (q !== this.renderer.qName && s.quality !== 'auto') this.renderer.setQuality(q); }
    if (this.ui) this.ui.applyHudScale();
    this.root.classList.toggle('vb-reduced', !!s.reducedMotion);
  }

  /* ---------------- menu backdrop ---------------- */
  menuBackdrop(on, big) {
    this.menuBig = !!big;
    if (!on) { cancelAnimationFrame(this.menuRaf); this.menuRaf = 0; return; }
    if (this.menuRaf || !this.renderer || (this.engine && this.engine.running)) return;
    let last = performance.now();
    const loop = (now) => {
      if (!this.open_ || !this.renderer) { this.menuRaf = 0; return; }
      this.menuRaf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (this.engine && this.engine.running) return;
      this.renderer.renderMenu(dt, this.menuBig);
    };
    this.menuRaf = requestAnimationFrame(loop);
  }
  previewLook() { if (this.renderer) this.renderer.setMenuLook(this.store.profile.look); }

  /* ---------------- campaign ---------------- */
  continueCampaign() {
    const s = this.store.getCheckpoint(); if (!s) return;
    this.startMission(s.missionId, s.cp);
  }
  deployMission(id) {
    if (!id) return;
    const go = () => this.startMission(id);
    this.ui._after = go; this.ui.showLoadout(go);
  }

  async startMission(id, checkpoint) {
    if (!this.engine) return;
    this.menuBackdrop(false); this.inMatch = true;
    this.ui.showLoading('LOADING WORLD...', CAMPAIGN.find((m) => m.id === id).title);
    try {
      this.audio.unlock();
      await this.engine.startLocal({ missionId: id, loadout: this.store.activeLoadout(), look: this.store.profile.look, name: this.store.profile.name, difficulty: this.store.profile.difficulty, checkpoint });
    } catch (e) { this.inMatch = false; return this.ui.showError('Could not load the mission', e && e.message ? e.message : 'Unknown error', [{ act: 'back', label: 'Main menu', primary: true }]); }
    this.renderer.stopMenu();
    this.beginPlay();
  }

  beginPlay() {
    this.ui.hideLoading(); this.ui.hideScreen(); this.ui.showHud(true);
    this.input.setTouchVisible(true); this.input.resetLatches();
    this.engine.start(); this.engine.paused = false;
    this.checkOrientation();
    if (!this.input.touch.enabled) { this.input.requestLock(); this.ui.toast('Click the game to capture the mouse', 3000); }
  }

  /* ---------------- pause / resume / exit ---------------- */
  pause() {
    if (!this.engine || !this.engine.running || this.engine.paused) return;
    this.engine.setPaused(this.engine.kind === 'local', 'menu');
    if (this.engine.kind === 'net') this.engine.paused = false;      // online match keeps running under the menu
    this.pausedMenu = true; this.input.exitLock(); this.input.setTouchVisible(false); this.ui.showPause();
  }
  resume() {
    if (!this.engine) return;
    this.pausedMenu = false; this.engine.setPaused(false); this.ui.hideScreen(); this.ui.showHud(true); this.input.setTouchVisible(true); this.input.resetLatches();
    if (!this.input.touch.enabled) this.input.requestLock();
  }
  async restartCheckpoint() {
    const e = this.engine; if (!e || e.kind !== 'local') return;
    const cp = (e.sim && e.sim.checkpoint) || (this.store.getCheckpoint() || {}).cp || null;
    const id = e.missionId; e.stop();
    await this.startMission(id, cp && cp.mission === id && cp.index > 0 ? cp : undefined);
  }
  exitMission() {
    const e = this.engine; if (!e) return;
    if (e.kind === 'net' && this.net) this.net.leave();
    this.endSession(); this.ui.showMenu(); this.renderer.startMenu(this.store.profile.look); this.menuBackdrop(true);
  }
  endSession() {
    this.inMatch = false; if (this.engine) { this.engine.stop(); this.engine.setPaused(false); }
    this.audio.stopAmbience(); this.input.exitLock(); this.input.setTouchVisible(false); this.ui.showHud(false); this.pausedMenu = false;
    if (this.renderer) this.renderer.clearWorld();
    this.store.flush();
  }

  /* ---------------- results ---------------- */
  onEnd(result) {
    if (this.endedOnce === result) return; this.endedOnce = result;
    this.input.exitLock(); this.input.setTouchVisible(false); this.engine.stop();
    const summary = this.store.applyResult(result, this.engine.meId);
    if (this.engine.kind === 'net') this.store.pushCloud();
    this.ui.showResults(result, summary, this.engine.meId, this.engine.kind);
    this.renderer.render(0);
  }
  afterResults(v) {
    if (v === 'retry') return this.restartCheckpointAfterFail();
    if (v === 'next') { const cur = CAMPAIGN.find((m) => m.id === this.engine.missionId); const nx = cur && cur.reward.unlock; this.endSession(); if (nx) { this.ui.state.mission = nx; this.renderer.startMenu(this.store.profile.look); this.menuBackdrop(true); return this.deployMission(nx); } }
    if (v === 'lobby') {
      if (this.engine.kind === 'net') { const lb = this.ui.state.lobby; this.endSession(); this.renderer.startMenu(this.store.profile.look); this.menuBackdrop(true); if (lb && lb.host === this.engine.meId) this.net.send({ t: 'backToLobby' }); if (lb) this.ui.showLobby(lb, this.engine.meId); return undefined; }
    }
    if (this.engine.kind === 'net' && this.net) this.net.leave();
    this.endSession(); this.ui.showMenu(); this.renderer.startMenu(this.store.profile.look); this.menuBackdrop(true);
    return undefined;
  }
  async restartCheckpointAfterFail() {
    const e = this.engine; const id = e.missionId; const cp = (e.sim && e.sim.checkpoint) || (this.store.getCheckpoint() || {}).cp;
    this.endSession(); await this.startMission(id, cp && cp.index > 0 ? cp : undefined);
  }

  /* ---------------- multiplayer ---------------- */
  mpGuard() { if (!this.net.configured) { this.ui.toast('Multiplayer server is not configured yet.'); return false; } return true; }
  async mpCreate(cfg) {
    if (!this.mpGuard()) return;
    this.ui.showLoading('CONNECTING...');
    try { await this.net.create(cfg); } catch (e) { this.ui.hideLoading(); this.ui.showMultiplayer(); this.ui.toast(e.message, 4200); return; }
    this.ui.hideLoading();
  }
  async mpJoin(code) {
    if (!this.mpGuard()) return;
    this.ui.showLoading('CONNECTING...');
    try { await this.net.join(code); } catch (e) { this.ui.hideLoading(); this.ui.showMultiplayer(); this.ui.toast(e.message, 4200); return; }
    this.ui.hideLoading();
  }
  mpReady() { const lb = this.ui.state.lobby; const me = lb && lb.members.find((m) => m.uid === this.uid); this.net.send({ t: 'ready', ready: !(me && me.ready) }); }
  mpStart() { this.net.send({ t: 'start' }); }
  mpConfig(c) { this.net.send({ t: 'config', config: c }); }
  mpKick(uid) { this.net.send({ t: 'kick', uid }); }
  mpTeam(t) { this.net.send({ t: 'team', team: t }); }
  mpBackToLobby() { this.net.send({ t: 'backToLobby' }); }
  mpLeave() { this.net.leave(); this.ui.state.lobby = null; this.ui.showMultiplayer(); }

  onNetState(s) {
    if (!this.ui) return;
    if (s === 'reconnecting') this.ui.banner('CONNECTION LOST. RECONNECTING...', 8000);
    if (s === 'online' && this.reconnecting) { this.ui.toast('Reconnected'); }
    this.reconnecting = s === 'reconnecting';
  }
  async onNet(m) {
    if (!this.open_ || !this.ui) return;
    switch (m.t) {
      case 'joined': this.ui.state.myId = m.uid; this.ui.state.lobby = m.lobby; if (!m.rejoin && !this.inMatch) this.ui.showLobby(m.lobby, m.uid); break;
      case 'lobby':
        this.ui.state.lobby = m.lobby;
        if (!this.inMatch && this.ui.screen !== 'results') this.ui.showLobby(m.lobby, this.uid); else if (this.ui.state.lobby && m.lobby.countdown) this.ui.toast('Match starting in ' + m.lobby.countdown);
        if (m.lobby.state === 'STARTING') this.audio.play('countdown');
        break;
      case 'match': await this.startNetMatch(m); break;
      case 's': if (this.engine && this.engine.kind === 'net' && this.engine.running) this.engine.onNetSnapshot(m); break;
      case 'end': if (this.engine && this.engine.kind === 'net' && m.result && !this.engine.ended) { this.engine.ended = m.result; this.onEnd(m.result); } break;
      case 'notice': this.ui.toast(m.msg, 3200); break;
      case 'error': this.ui.toast(m.msg || 'Server error', 3600); break;
      case 'kicked': this.ui.toast('You were removed by the host.'); break;
      case 'lobbyReset': if (this.inMatch) { this.endSession(); this.renderer.startMenu(this.store.profile.look); this.menuBackdrop(true); } if (this.ui.state.lobby) this.ui.showLobby(this.ui.state.lobby, this.uid); break;
      case 'closed': {
        const wasMatch = this.inMatch; if (wasMatch) this.endSession(); this.renderer.startMenu(this.store.profile.look); this.menuBackdrop(true);
        this.ui.showError(wasMatch ? 'Match disconnected' : 'Disconnected', m.reason || 'The connection to the server was lost.', [{ act: 'multiplayer', label: 'Back to multiplayer', primary: true }, { act: 'home', label: 'Main menu' }]);
        break; }
      default: break;
    }
  }
  async startNetMatch(m) {
    if (this.inMatch && this.engine.kind === 'net') return;           // reconnect into a running match: engine already has the world
    this.menuBackdrop(false); this.inMatch = true; this.endedOnce = null;
    this.ui.showLoading('LOADING WORLD...', 'Syncing with server');
    try {
      await this.engine.startNet(m, this.net, { look: this.store.profile.look, name: this.store.profile.name, loadout: this.store.activeLoadout(), uid: this.uid });
    } catch (e) { this.inMatch = false; this.net.leave(); return this.ui.showError('Could not load the match', e.message || 'Unknown error', [{ act: 'multiplayer', label: 'Back', primary: true }]); }
    this.renderer.stopMenu(); this.beginPlay();
  }

  /* ---------------- leaving ---------------- */
  exitToVertex() { this.close(); if (this.opts.onExit) this.opts.onExit(); else location.href = this.opts.vertexUrl || '../index.html'; }

  /* Full teardown. After this nothing of VECTOR is running. */
  close() {
    if (!this.open_) return; this.open_ = false;
    cancelAnimationFrame(this.menuRaf); this.menuRaf = 0;
    for (const t of this.timers) clearTimeout(t); this.timers.length = 0;
    if (this.net) { this.net.dispose(); this.net = null; }
    if (this.engine) { this.engine.dispose(); this.engine = null; }
    if (this.input) { this.input.dispose(); this.input = null; }
    if (this.audio) { this.audio.dispose(); this.audio = null; }
    if (this.ro) { this.ro.disconnect(); this.ro = null; }
    if (this.store) this.store.flush();
    if (this.renderer) { this.renderer.dispose(); this.renderer = null; }
    for (const [t, type, fn, o] of this.listeners) t.removeEventListener(type, fn, o); this.listeners.length = 0;
    if (this.ui) { this.ui.dispose(); this.ui = null; }
    this.releaseOrientation();
    document.documentElement.classList.remove('vb-open'); document.body.classList.remove('vb-open');
    if (this.root) { this.root.hidden = true; this.root.classList.remove('vector-blackline', 'vb-portrait', 'vb-reduced'); if (this.root.parentNode && !this.opts.keepRoot) this.root.parentNode.removeChild(this.root); this.root = null; }
    this.store = null; this.gestureDone = false;
  }
}

/* ---------------- tiny public API ---------------- */
let instance = null;
const VectorBlackline = {
  version: VERSION,
  init(opts) { if (instance) instance.close(); instance = new App(opts); return instance; },
  async open() { if (!instance) instance = new App({}); await instance.open(); return instance; },
  close() { if (instance) instance.close(); },
  destroy() { if (instance) { instance.close(); instance = null; } },
};
if (typeof window !== 'undefined') window.VectorBlackline = VectorBlackline;
export default VectorBlackline;
