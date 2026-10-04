/* ============================================================
   vector/input.js  |  Keyboard + mouse, touch and controller input.

   - Which of the three is ACTIVE comes from Platform (platform.mode) and
     can change while playing. The touch controls only exist in the DOM
     while mode is 'touch', so desktop never carries a hidden joystick.
   - Every listener is tracked and removed (in dispose(), or in
     unmountTouch() for the touch layer), so opening and closing the game
     or switching devices cannot leak handlers.
   - poll() returns one intent object per frame.
   ============================================================ */
import { icon } from './icons.js';
import { DEFAULT_KEYS } from './prompts.js';

/* The touch layout as data. x / y are the button CENTRE measured from the bottom-right
   corner, d is the diameter, all in units of one button (--tb in the stylesheet).
   Because everything is relative to one unit, the layout keeps its shape from a small
   phone to a tablet. Heal / equipment / weapon swap are not here: they are chips
   built into the health and ammo panels (see ui.js). */
export const TOUCH_BUTTONS = [
  { id: 'fire',     icon: 'fire',     x: 1.15, y: 1.15, d: 1.5,  label: 'FIRE' },
  { id: 'jump',     icon: 'jump',     x: 1.15, y: 2.85, d: 1.0,  label: 'JUMP' },
  { id: 'ads',      icon: 'aim',      x: 2.95, y: 1.05, d: 1.05, label: 'AIM' },
  { id: 'crouch',   icon: 'crouch',   x: 2.75, y: 2.45, d: 1.0,  label: 'CROUCH' },
  { id: 'reload',   icon: 'reload',   x: 4.3,  y: 1.0,  d: 0.95, label: 'RELOAD' },
  { id: 'interact', icon: 'interact', x: 4.15, y: 2.35, d: 0.95, label: 'USE', ctx: true },
];
const ARIA = { fire: 'Fire', jump: 'Jump', ads: 'Aim down sights', crouch: 'Crouch', reload: 'Reload', interact: 'Use', pause: 'Pause' };

export class Input {
  constructor(root, canvas, getSettings, platform) {
    this.root = root; this.canvas = canvas; this.getSettings = getSettings; this.platform = platform;
    this.listeners = []; this.touchListeners = [];
    this.keys = new Set(); this.edges = { jump: false, reload: false, equip: false, heal: false, sw: -1, swap: false, pause: false, shoulder: false, scoreboard: false };
    this.mouse = { dx: 0, dy: 0, left: false, right: false };
    const self = this;
    this.touch = { moveId: null, lookId: null, fireId: null, moveVec: { x: 0, y: 0 }, moveOrigin: null, look: { dx: 0, dy: 0 }, fire: false, ads: false, crouch: false, interact: false, sprint: false,
      get enabled() { return !!(self.platform && self.platform.mode === 'touch'); } };
    this.locked = false; this.crouchToggle = false; this.enabled = false; this.onLockChange = null; this.onSave = null;
    this.touchEl = null; this.lastTouchLook = new Map(); this.touchWanted = false; this.editing = false; this.stickR = 56; this.ctx = { interact: false };
    this.pad = { prev: [], crouch: false, sprint: false, last: 0, nav: { dir: '', t: 0, prev: [] } };
    this.unsub = null; this.B = { ...DEFAULT_KEYS }; this.rev = new Map(); this.rebind = null; this.refreshBinds();
  }

  /* Key bindings: defaults plus the player's overrides. Rebuilt whenever settings change. */
  refreshBinds() {
    const o = (this.getSettings() || {}).keys || {}; this.B = { ...DEFAULT_KEYS, ...o }; this.rev = new Map();
    for (const a in this.B) if (this.B[a]) this.rev.set(this.B[a], a);
  }

  on(target, type, fn, opts) { target.addEventListener(type, fn, opts); this.listeners.push([target, type, fn, opts]); }
  onT(target, type, fn, opts) { target.addEventListener(type, fn, opts); this.touchListeners.push([target, type, fn, opts]); }
  get mode() { return this.platform ? this.platform.mode : 'kbm'; }

  enable() {
    if (this.enabled) return; this.enabled = true;
    const c = this.canvas;
    this.on(window, 'keydown', (e) => this.key(e, true));
    this.on(window, 'keyup', (e) => this.key(e, false));
    this.on(window, 'blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; this.resetTouch(); });
    this.on(document, 'pointerlockchange', () => {
      const was = this.locked; this.locked = document.pointerLockElement === c;
      if (was && !this.locked && this.onLockChange) this.onLockChange(false);
      if (!was && this.locked && this.onLockChange) this.onLockChange(true);
    });
    this.on(document, 'mousemove', (e) => { if (this.locked) { this.mouse.dx += e.movementX || 0; this.mouse.dy += e.movementY || 0; } });
    this.on(c, 'mousedown', (e) => {
      if (!this.locked) { if (this.mode !== 'touch') this.requestLock(); return; }
      if (e.button === 0) this.mouse.left = true; else if (e.button === 2) this.mouse.right = true;
    });
    this.on(window, 'mouseup', (e) => { if (e.button === 0) this.mouse.left = false; else if (e.button === 2) this.mouse.right = false; });
    this.on(c, 'contextmenu', (e) => e.preventDefault());
    this.on(c, 'wheel', (e) => { if (this.locked) { this.edges.sw = e.deltaY > 0 ? 1 : 0; e.preventDefault(); } }, { passive: false });
    // Stop the browser's own pinch gestures, but only inside the game.
    this.on(this.root, 'gesturestart', (e) => e.preventDefault());
    this.on(this.root, 'gesturechange', (e) => e.preventDefault());
    if (this.platform) this.unsub = this.platform.subscribe((t) => { if (t === 'mode') this.applyMode(); else if (t === 'viewport') this.applyLayout(); });
    this.applyMode();
  }

  /* Build the touch layer when touch becomes the active input, remove it when it stops being. */
  applyMode() {
    if (!this.enabled) return;
    if (this.mode === 'touch') { this.exitLock(); this.keys.clear(); this.mouse.left = this.mouse.right = false; if (!this.touchEl) this.mountTouch(); }
    else if (this.touchEl) this.unmountTouch();
    this.pad.crouch = false; this.pad.sprint = false;
  }

  requestLock() {
    const c = this.canvas;
    if (!c.requestPointerLock || this.mode === 'touch') return;
    try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* not allowed right now */ }
  }
  exitLock() { if (document.pointerLockElement === this.canvas) document.exitPointerLock(); }

  key(e, down) {
    const k = e.code;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;     // typing never moves the character
    if (this.rebind) { if (down && !e.repeat) { e.preventDefault(); const cb = this.rebind; this.rebind = null; cb(k); } return; }   // the controls screen is waiting for a new key
    const act = this.rev.get(k);
    if (down) {
      if (e.repeat) { if (this.locked) e.preventDefault(); return; }
      switch (act) {
        case 'jump': this.edges.jump = true; break;
        case 'reload': this.edges.reload = true; break;
        case 'equip': this.edges.equip = true; break;
        case 'heal': this.edges.heal = true; break;
        case 'slot1': this.edges.sw = 0; break;
        case 'slot2': this.edges.sw = 1; break;
        case 'swap': this.edges.swap = true; break;
        case 'shoulder': this.edges.shoulder = true; break;
        case 'crouch': this.crouchToggle = !this.crouchToggle; break;
        case 'scoreboard': this.edges.scoreboard = true; e.preventDefault(); break;
        default: break;
      }
      if (k === 'Escape') this.edges.pause = true;
      this.keys.add(k);
    } else { this.keys.delete(k); if (act === 'scoreboard') this.edges.scoreboard = false; }
    if (this.locked && (act === 'jump' || act === 'scoreboard' || ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown'].includes(k))) e.preventDefault();
  }

  /* ---------------- touch ---------------- */
  mountTouch() {
    const el = document.createElement('div');
    el.className = 'vb-touch';
    const btn = (b) => `<button type="button" class="vb-tbtn vb-t-${b.id}${b.ctx ? ' vb-ctx' : ''}" data-btn="${b.id}" aria-label="${ARIA[b.id]}" style="--x:${b.x};--y:${b.y};--d:${b.d}">${icon(b.icon)}<span class="vb-tlabel">${b.label}</span></button>`;
    el.innerHTML = `
      <div class="vb-lookzone" data-role="look"></div>
      <div class="vb-stick" data-btn="stick" data-role="stick"><div class="vb-stick-base"></div><div class="vb-stick-knob"></div></div>
      ${TOUCH_BUTTONS.map(btn).join('')}
      <button type="button" class="vb-tbtn vb-t-pause" data-btn="pause" aria-label="${ARIA.pause}">${icon('pause')}</button>`;
    this.root.appendChild(el); this.touchEl = el;
    const stick = el.querySelector('.vb-stick'), knob = el.querySelector('.vb-stick-knob'), base = el.querySelector('.vb-stick-base'), look = el.querySelector('.vb-lookzone');
    const T = this.touch, setKnob = (x, y) => { knob.style.transform = `translate(${x}px, ${y}px)`; };
    this.setKnob = setKnob;

    // --- movement stick ---
    this.onT(stick, 'pointerdown', (e) => {
      if (this.editing) return this.startDrag(e, stick);
      if (T.moveId !== null) return; T.moveId = e.pointerId; stick.setPointerCapture(e.pointerId);
      const r = base.getBoundingClientRect(); T.moveOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; this.stickR = Math.max(30, r.width * 0.4);
      this.dragStick(e, setKnob); e.preventDefault();
    });
    this.onT(stick, 'pointermove', (e) => { if (e.pointerId === T.moveId) this.dragStick(e, setKnob); });
    const endStick = (e) => { if (e.pointerId !== T.moveId) return; T.moveId = null; T.moveVec = { x: 0, y: 0 }; T.sprint = false; setKnob(0, 0); };
    this.onT(stick, 'pointerup', endStick); this.onT(stick, 'pointercancel', endStick); this.onT(stick, 'lostpointercapture', endStick);

    // --- look: drag anywhere on the free part of the screen ---
    this.onT(look, 'pointerdown', (e) => { if (this.editing || T.lookId !== null) return; T.lookId = e.pointerId; look.setPointerCapture(e.pointerId); this.lastTouchLook.set(e.pointerId, { x: e.clientX, y: e.clientY }); e.preventDefault(); });
    this.onT(look, 'pointermove', (e) => { if (e.pointerId === T.lookId) this.addLook(e); });
    const endLook = (e) => { if (e.pointerId === T.lookId) { T.lookId = null; this.lastTouchLook.delete(e.pointerId); } };
    this.onT(look, 'pointerup', endLook); this.onT(look, 'pointercancel', endLook); this.onT(look, 'lostpointercapture', endLook);

    // --- action buttons ---
    for (const b of el.querySelectorAll('[data-btn]')) {
      const id = b.dataset.btn; if (id === 'stick') continue;
      this.onT(b, 'pointerdown', (e) => {
        e.preventDefault();
        if (this.editing) return this.startDrag(e, b);
        b.setPointerCapture(e.pointerId); b.classList.add('on'); this.haptic(8);
        const s = this.getSettings();
        switch (id) {
          case 'fire': T.fire = true; T.fireId = e.pointerId; this.lastTouchLook.set(e.pointerId, { x: e.clientX, y: e.clientY }); break;   // drag from FIRE to aim while firing
          case 'ads': if (s.adsMode === 'hold') T.ads = true; else T.ads = !T.ads; b.classList.toggle('latched', T.ads); break;
          case 'crouch': if (s.crouchMode === 'hold') T.crouch = true; else T.crouch = !T.crouch; b.classList.toggle('latched', T.crouch); break;
          case 'reload': this.edges.reload = true; break; case 'jump': this.edges.jump = true; break;
          case 'interact': T.interact = true; break; case 'pause': this.edges.pause = true; break; default: break;
        }
      });
      this.onT(b, 'pointermove', (e) => { if (!this.editing && id === 'fire' && e.pointerId === T.fireId) this.addLook(e); });
      const up = (e) => {
        if (this.editing) return;
        const s = this.getSettings(); b.classList.remove('on');
        if (id === 'fire' && e.pointerId === T.fireId) { T.fire = false; T.fireId = null; this.lastTouchLook.delete(e.pointerId); }
        if (id === 'interact') T.interact = false;
        if (id === 'ads' && s.adsMode === 'hold') { T.ads = false; b.classList.remove('latched'); }
        if (id === 'crouch' && s.crouchMode === 'hold') { T.crouch = false; b.classList.remove('latched'); }
      };
      this.onT(b, 'pointerup', up); this.onT(b, 'pointercancel', up); this.onT(b, 'lostpointercapture', up);
    }
    this.onT(el, 'touchmove', (e) => e.preventDefault(), { passive: false });
    this.onT(el, 'contextmenu', (e) => e.preventDefault());
    this.applyLayout(); this.setTouchVisible(this.touchWanted);
    el.classList.toggle('vb-ctx-use', !!this.ctx.interact);
  }

  unmountTouch() {
    for (const [t, type, fn, o] of this.touchListeners) t.removeEventListener(type, fn, o); this.touchListeners.length = 0;
    this.resetTouch(); this.editing = false;
    if (this.touchEl && this.touchEl.parentNode) this.touchEl.parentNode.removeChild(this.touchEl);
    this.touchEl = null; this.setKnob = null; this.lastTouchLook.clear();
  }

  /* Camera drag from the look zone or while a finger rests on FIRE. */
  addLook(e) {
    const l = this.lastTouchLook.get(e.pointerId); if (!l) return; const T = this.touch;
    let dx = e.clientX - l.x, dy = e.clientY - l.y; l.x = e.clientX; l.y = e.clientY;
    if (this.getSettings().aimAccel) { const f = 1 + Math.min(0.5, Math.hypot(dx, dy) / 60); dx *= f; dy *= f; }
    T.look.dx += dx; T.look.dy += dy; e.preventDefault();
  }

  dragStick(e, setKnob) {
    const T = this.touch, R = this.stickR; const dx = e.clientX - T.moveOrigin.x, dy = e.clientY - T.moveOrigin.y;
    const d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / R);
    const nx = dx / d, ny = dy / d, dz = 0.1, mm = m < dz ? 0 : (m - dz) / (1 - dz);      // small dead zone, then smooth analog
    T.moveVec = { x: nx * mm, y: ny * mm };
    T.sprint = this.getSettings().stickSprint !== false && m > 0.95 && ny < -0.5;
    setKnob(nx * Math.min(d, R), ny * Math.min(d, R));
  }

  /* ---------------- touch layout editing (player-customisable positions) ---------------- */
  /* Positions are saved as fractions of the screen so they stay on screen on any device. */
  applyLayout() {
    const el = this.touchEl; if (!el) return;
    const lay = this.getSettings().touchLayout || {}, W = this.root.clientWidth, H = this.root.clientHeight;
    let custom = false;
    for (const n of el.querySelectorAll('[data-btn]')) {
      const p = lay[n.dataset.btn], s = n.style;
      if (p && W && H) {
        custom = true; const w = n.offsetWidth || 60, h = n.offsetHeight || 60;
        s.right = 'auto'; s.bottom = 'auto'; s.left = Math.max(0, Math.min(W - w, p.ax * W - w / 2)) + 'px'; s.top = Math.max(0, Math.min(H - h, p.ay * H - h / 2)) + 'px';
      } else if (s.left || s.top) { s.left = s.top = s.right = s.bottom = ''; }
    }
    el.dataset.custom = custom ? '1' : '0';
  }
  beginEdit(onDone) {
    if (!this.touchEl) return false;
    this.editing = true; this.resetTouch(); this.onEditDone = onDone; this.touchEl.classList.add('vb-editing'); this.setTouchVisible(true);
    const bar = document.createElement('div'); bar.className = 'vb-editbar';
    bar.innerHTML = '<p>Drag any control to move it</p><button type="button" class="vb-btn small" data-edit="reset">Reset</button><button type="button" class="vb-btn small primary" data-edit="done">Done</button>';
    this.touchEl.appendChild(bar); this.editBar = bar;
    this.onT(bar, 'click', (e) => { const a = e.target.closest('[data-edit]'); if (!a) return; if (a.dataset.edit === 'reset') { const s = this.getSettings(); s.touchLayout = {}; this.persist(); this.applyLayout(); } else this.endEdit(); });
    return true;
  }
  endEdit() {
    if (!this.editing) return; this.editing = false;
    if (this.touchEl) { this.touchEl.classList.remove('vb-editing'); if (this.editBar && this.editBar.parentNode) this.editBar.parentNode.removeChild(this.editBar); }
    this.editBar = null; this.setTouchVisible(this.touchWanted);
    const cb = this.onEditDone; this.onEditDone = null; if (cb) cb();
  }
  startDrag(e, node) {
    node.setPointerCapture(e.pointerId); const id = node.dataset.btn, rect = this.root.getBoundingClientRect();
    const move = (ev) => {
      if (ev.pointerId !== e.pointerId) return; const w = node.offsetWidth, h = node.offsetHeight;
      const cx = Math.max(w / 2, Math.min(rect.width - w / 2, ev.clientX - rect.left)), cy = Math.max(h / 2, Math.min(rect.height - h / 2, ev.clientY - rect.top));
      const s = node.style; s.right = 'auto'; s.bottom = 'auto'; s.left = (cx - w / 2) + 'px'; s.top = (cy - h / 2) + 'px'; node._c = { ax: cx / rect.width, ay: cy / rect.height };
    };
    const end = (ev) => {
      if (ev.pointerId !== e.pointerId) return; node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', end); node.removeEventListener('pointercancel', end);
      if (node._c) { const s = this.getSettings(); s.touchLayout = { ...(s.touchLayout || {}), [id]: node._c }; node._c = null; this.persist(); this.applyLayout(); }
    };
    node.addEventListener('pointermove', move); node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end);
  }
  persist() { if (this.onSave) this.onSave(); }

  /* ---------------- shared helpers ---------------- */
  setTouchVisible(v) { this.touchWanted = !!v; if (this.touchEl) this.touchEl.style.display = (v || this.editing) ? '' : 'none'; if (!v && !this.editing) this.resetTouch(); }
  /* USE only exists while there is something to use. */
  setContext(c) {
    if (c.interact === this.ctx.interact) return; this.ctx.interact = !!c.interact;
    if (this.touchEl) this.touchEl.classList.toggle('vb-ctx-use', this.ctx.interact);
    if (!this.ctx.interact && this.touch.interact) { this.touch.interact = false; const b = this.touchEl && this.touchEl.querySelector('[data-btn=interact]'); if (b) b.classList.remove('on'); }
  }
  /* HUD chips (medkit, equipment, weapon swap) call this. */
  tap(name) { if (name === 'heal') this.edges.heal = true; else if (name === 'equip') this.edges.equip = true; else if (name === 'swap') this.edges.swap = true; this.haptic(8); }
  haptic(ms) { const s = this.getSettings(); if (s.vibration && this.platform && this.platform.caps.vibrate && this.mode === 'touch') { try { navigator.vibrate(ms); } catch { /* ignore */ } } }
  rumble(ms, mag = 0.6) {
    const s = this.getSettings(); if (!s.vibration || this.mode !== 'pad') return;
    const gp = this.firstPad(); const a = gp && gp.vibrationActuator;
    if (a && a.playEffect) { try { a.playEffect('dual-rumble', { duration: Math.min(300, ms), strongMagnitude: mag, weakMagnitude: mag * 0.6 }); } catch { /* ignore */ } }
  }

  /* Drops every held touch so nothing stays pressed after a pause, a hidden layer or a device switch. */
  resetTouch() {
    const T = this.touch; T.moveId = null; T.lookId = null; T.fireId = null; T.moveVec = { x: 0, y: 0 }; T.sprint = false; T.fire = false; T.ads = false; T.crouch = false; T.interact = false;
    T.look.dx = T.look.dy = 0; this.lastTouchLook.clear();
    if (this.setKnob) this.setKnob(0, 0);
    if (this.touchEl) for (const b of this.touchEl.querySelectorAll('.on, .latched')) b.classList.remove('on', 'latched');
  }
  resetLatches() { this.resetTouch(); this.crouchToggle = false; this.pad.crouch = false; this.pad.sprint = false; this.mouse.left = this.mouse.right = false; }

  /* ---------------- controller ---------------- */
  firstPad() { const l = navigator.getGamepads ? navigator.getGamepads() : null; if (!l) return null; for (const p of l) if (p && p.connected) return p; return null; }
  readPad() {
    const p = this.firstPad(); if (!p) return null;
    const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed), v = (i) => (p.buttons[i] ? p.buttons[i].value : 0);
    const prev = this.pad.prev, edge = (i) => b(i) && !prev[i];
    const s = this.getSettings(), dz = s.padDeadzone != null ? s.padDeadzone : 0.15;
    const stick = (x, y) => { const m = Math.hypot(x, y); if (m < dz) return { x: 0, y: 0, m: 0 }; const sc = Math.min(1, (m - dz) / (1 - dz)); return { x: x / m * sc, y: y / m * sc, m: sc }; };
    const L = stick(p.axes[0] || 0, p.axes[1] || 0), R = stick(p.axes[2] || 0, p.axes[3] || 0);
    const any = p.buttons.some((x) => x.pressed) || L.m > 0.5 || R.m > 0.5;
    const out = { L, R, any, a: b(0), edgeA: edge(0), edgeB: edge(1), edgeX: edge(2), edgeY: edge(3), edgeLB: edge(4), edgeRB: edge(5), lt: v(6) > 0.35, rt: v(7) > 0.35, back: b(8), edgeStart: edge(9), edgeL3: edge(10), up: edge(12), down: b(13), left: edge(14), right: edge(15) };
    this.pad.prev = p.buttons.map((x) => x.pressed); return out;
  }
  /* Menu navigation from a controller: 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' or ''. Holding a direction repeats. */
  navPoll(now) {
    const p = this.firstPad(); const N = this.pad.nav; if (!p) { N.dir = ''; N.prev = []; return ''; }
    const pr = N.prev, b = (i) => !!(p.buttons[i] && p.buttons[i].pressed), ax = p.axes;
    const dir = b(12) || (ax[1] || 0) < -0.6 ? 'up' : b(13) || (ax[1] || 0) > 0.6 ? 'down' : b(14) || (ax[0] || 0) < -0.6 ? 'left' : b(15) || (ax[0] || 0) > 0.6 ? 'right' : '';
    let out = '';
    if (dir !== N.dir) { N.dir = dir; N.t = now + 380; if (dir) out = dir; } else if (dir && now >= N.t) { N.t = now + 110; out = dir; }
    if (!out) { if (b(0) && !pr[0]) out = 'a'; else if (b(1) && !pr[1]) out = 'b'; else if (b(9) && !pr[9]) out = 'start'; }
    N.prev = p.buttons.map((x) => x.pressed); return out;
  }

  /* One snapshot of intent per frame. */
  poll() {
    const s = this.getSettings(); const now = performance.now(), dt = Math.min(0.1, Math.max(0.001, (now - (this.pad.last || now)) / 1000)); this.pad.last = now;
    const k = this.keys, T = this.touch, e = this.edges, m = this.mouse;
    let mx = 0, mz = 0, dyaw = 0, dpitch = 0, padFire = false, padAds = false, padInteract = false, padSprint = false;
    let sw = e.sw, swap = e.swap, heal = e.heal, equip = e.equip, jump = e.jump, reload = e.reload, pause = e.pause, shoulder = e.shoulder, board = e.scoreboard || k.has(this.B.scoreboard);
    // keyboard
    if (k.has('KeyW') || k.has('ArrowUp')) mz -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) mz += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    // touch
    if (T.moveVec.x || T.moveVec.y) { mx = T.moveVec.x; mz = T.moveVec.y; }
    // controller. Read whenever one is plugged in; the first press switches the active mode to 'pad'.
    const pd = this.platform && this.platform.padCount ? this.readPad() : null;
    if (pd) {
      if (pd.any && this.mode !== 'pad') this.platform.setMode('pad');
      if (this.mode === 'pad') {
        if (pd.L.m) { mx = pd.L.x; mz = pd.L.y; }
        const rate = 3.1 * (s.padSens != null ? s.padSens : 1) * (pd.lt ? (s.aimSens || 0.6) : 1) * dt, curve = (x) => Math.sign(x) * Math.pow(Math.abs(x), 1.6);
        dyaw -= curve(pd.R.x) * rate; dpitch -= curve(pd.R.y) * rate * (s.invertY ? -1 : 1);
        padFire = pd.rt; padAds = pd.lt; padInteract = pd.a && this.ctx.interact;
        if (pd.edgeA && !this.ctx.interact) jump = true;
        if (pd.edgeB) this.pad.crouch = !this.pad.crouch;
        if (pd.edgeX) reload = true; if (pd.edgeY) swap = true; if (pd.edgeLB) heal = true; if (pd.edgeRB) equip = true; if (pd.edgeStart) pause = true;
        if (pd.edgeL3) this.pad.sprint = !this.pad.sprint; if (!pd.L.m) this.pad.sprint = false;
        padSprint = this.pad.sprint; if (pd.left) sw = 0; if (pd.right) sw = 1; if (pd.up) shoulder = true; board = board || pd.back || pd.down;
      }
    }
    const ads = m.right || T.ads || padAds;
    const sens = (ads ? s.aimSens : 1) * s.sens, inv = s.invertY ? -1 : 1;
    dyaw += -(m.dx * 0.0022 * sens) - T.look.dx * 0.0034 * s.touchSens * (ads ? s.aimSens : 1);
    dpitch += -(m.dy * 0.0022 * sens + T.look.dy * 0.0034 * s.touchSens * (ads ? s.aimSens : 1)) * inv;
    m.dx = m.dy = 0; T.look.dx = T.look.dy = 0;
    const out = {
      mx, mz, dyaw, dpitch, ads,
      fire: m.left || T.fire || padFire, sprint: k.has(this.B.sprint) || (this.B.sprint === 'ShiftLeft' && k.has('ShiftRight')) || T.sprint || padSprint,
      crouch: this.crouchToggle || T.crouch || k.has('ControlLeft') || this.pad.crouch, interact: k.has(this.B.interact) || (k.has('KeyF') && !this.rev.has('KeyF')) || T.interact || padInteract,
      jump, reload, equip, heal, sw, swap, pause, shoulder, scoreboard: board,
    };
    e.jump = e.reload = e.equip = e.heal = e.swap = e.pause = e.shoulder = false; e.sw = -1;
    return out;
  }

  dispose() {
    if (this.unsub) { this.unsub(); this.unsub = null; }
    for (const [t, type, fn, opts] of this.listeners) t.removeEventListener(type, fn, opts);
    this.listeners.length = 0; this.enabled = false; this.exitLock(); this.unmountTouch();
  }
}
