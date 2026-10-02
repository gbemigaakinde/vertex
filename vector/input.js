/* ============================================================
   vector/input.js  |  Keyboard + mouse + touch input for VECTOR.
   Every listener registered here is tracked and removed in dispose(),
   so opening and closing the game repeatedly cannot leak handlers.
   poll() returns one intent object per frame.
   ============================================================ */
const isTouchDevice = () => ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

export class Input {
  constructor(root, canvas, getSettings) {
    this.root = root; this.canvas = canvas; this.getSettings = getSettings;
    this.listeners = [];
    this.keys = new Set(); this.edges = { jump: false, reload: false, equip: false, heal: false, sw: -1, swap: false, pause: false, shoulder: false, scoreboard: false };
    this.mouse = { dx: 0, dy: 0, left: false, right: false };
    this.touch = { enabled: isTouchDevice(), moveId: null, lookId: null, moveVec: { x: 0, y: 0 }, moveOrigin: null, look: { dx: 0, dy: 0 }, held: new Set(), fire: false, ads: false, crouch: false, interact: false, sprint: false };
    this.locked = false; this.crouchToggle = false; this.enabled = false; this.onPause = null; this.onLockChange = null; this.adsToggle = false;
    this.touchEl = null; this.lastTouchLook = new Map();
  }

  on(target, type, fn, opts) { target.addEventListener(type, fn, opts); this.listeners.push([target, type, fn, opts]); }

  enable() {
    if (this.enabled) return; this.enabled = true;
    const c = this.canvas;
    this.on(window, 'keydown', (e) => this.key(e, true));
    this.on(window, 'keyup', (e) => this.key(e, false));
    this.on(window, 'blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
    this.on(document, 'pointerlockchange', () => {
      const was = this.locked; this.locked = document.pointerLockElement === c;
      if (was && !this.locked && this.onLockChange) this.onLockChange(false);
      if (!was && this.locked && this.onLockChange) this.onLockChange(true);
    });
    this.on(document, 'mousemove', (e) => { if (this.locked) { this.mouse.dx += e.movementX || 0; this.mouse.dy += e.movementY || 0; } });
    this.on(c, 'mousedown', (e) => {
      if (!this.locked) { if (!this.touch.enabled) this.requestLock(); return; }
      if (e.button === 0) this.mouse.left = true; else if (e.button === 2) this.mouse.right = true;
    });
    this.on(window, 'mouseup', (e) => { if (e.button === 0) this.mouse.left = false; else if (e.button === 2) this.mouse.right = false; });
    this.on(c, 'contextmenu', (e) => e.preventDefault());
    this.on(c, 'wheel', (e) => { if (this.locked) { this.edges.sw = e.deltaY > 0 ? 1 : 0; e.preventDefault(); } }, { passive: false });
    if (this.touch.enabled) this.buildTouch();
  }

  requestLock() {
    const c = this.canvas;
    if (!c.requestPointerLock) return;
    try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* not allowed right now */ }
  }
  exitLock() { if (document.pointerLockElement === this.canvas) document.exitPointerLock(); }

  key(e, down) {
    const k = e.code;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (down) {
      if (e.repeat) { if (this.locked) e.preventDefault(); return; }
      switch (k) {
        case 'Space': this.edges.jump = true; break;
        case 'KeyR': this.edges.reload = true; break;
        case 'KeyG': this.edges.equip = true; break;
        case 'KeyH': this.edges.heal = true; break;
        case 'Digit1': this.edges.sw = 0; break;
        case 'Digit2': this.edges.sw = 1; break;
        case 'KeyQ': this.edges.swap = true; break;
        case 'KeyV': this.edges.shoulder = true; break;
        case 'KeyC': this.crouchToggle = !this.crouchToggle; break;
        case 'Tab': this.edges.scoreboard = true; e.preventDefault(); break;
        case 'Escape': this.edges.pause = true; break;
        default: break;
      }
      this.keys.add(k);
    } else { this.keys.delete(k); if (k === 'Tab') this.edges.scoreboard = false; }
    if (this.locked && ['Space', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown'].includes(k)) e.preventDefault();
  }

  /* ---------------- touch ---------------- */
  buildTouch() {
    const el = document.createElement('div');
    el.className = 'vb-touch';
    el.innerHTML = `
      <div class="vb-stick" data-role="stick"><div class="vb-stick-base"></div><div class="vb-stick-knob"></div></div>
      <div class="vb-lookzone" data-role="look"></div>
      <button class="vb-tbtn vb-t-fire" data-btn="fire" aria-label="Fire"><span>FIRE</span></button>
      <button class="vb-tbtn vb-t-ads" data-btn="ads" aria-label="Aim"><span>AIM</span></button>
      <button class="vb-tbtn vb-t-reload" data-btn="reload" aria-label="Reload"><span>RLD</span></button>
      <button class="vb-tbtn vb-t-jump" data-btn="jump" aria-label="Jump"><span>JMP</span></button>
      <button class="vb-tbtn vb-t-crouch" data-btn="crouch" aria-label="Crouch"><span>CRCH</span></button>
      <button class="vb-tbtn vb-t-use" data-btn="interact" aria-label="Interact"><span>USE</span></button>
      <button class="vb-tbtn vb-t-swap" data-btn="swap" aria-label="Switch weapon"><span>SWAP</span></button>
      <button class="vb-tbtn vb-t-equip" data-btn="equip" aria-label="Equipment"><span>EQP</span></button>
      <button class="vb-tbtn vb-t-heal" data-btn="heal" aria-label="Heal"><span>MED</span></button>
      <button class="vb-tbtn vb-t-pause" data-btn="pause" aria-label="Pause"><span>II</span></button>`;
    this.root.appendChild(el); this.touchEl = el;
    const stick = el.querySelector('.vb-stick'), knob = el.querySelector('.vb-stick-knob'), look = el.querySelector('.vb-lookzone');
    const T = this.touch;
    const R = 56;
    const setKnob = (x, y) => { knob.style.transform = `translate(${x}px, ${y}px)`; };
    this.on(stick, 'pointerdown', (e) => {
      if (T.moveId !== null) return; T.moveId = e.pointerId; stick.setPointerCapture(e.pointerId);
      const r = stick.getBoundingClientRect(); T.moveOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; this.dragStick(e, R, setKnob); e.preventDefault();
    });
    this.on(stick, 'pointermove', (e) => { if (e.pointerId === T.moveId) this.dragStick(e, R, setKnob); });
    const endStick = (e) => { if (e.pointerId !== T.moveId) return; T.moveId = null; T.moveVec = { x: 0, y: 0 }; T.sprint = false; setKnob(0, 0); };
    this.on(stick, 'pointerup', endStick); this.on(stick, 'pointercancel', endStick);
    this.on(look, 'pointerdown', (e) => { if (T.lookId !== null) return; T.lookId = e.pointerId; look.setPointerCapture(e.pointerId); this.lastTouchLook.set(e.pointerId, { x: e.clientX, y: e.clientY }); e.preventDefault(); });
    this.on(look, 'pointermove', (e) => {
      if (e.pointerId !== T.lookId) return; const l = this.lastTouchLook.get(e.pointerId); if (!l) return;
      T.look.dx += e.clientX - l.x; T.look.dy += e.clientY - l.y; l.x = e.clientX; l.y = e.clientY; e.preventDefault();
    });
    const endLook = (e) => { if (e.pointerId === T.lookId) { T.lookId = null; this.lastTouchLook.delete(e.pointerId); } };
    this.on(look, 'pointerup', endLook); this.on(look, 'pointercancel', endLook);
    for (const b of el.querySelectorAll('[data-btn]')) {
      const id = b.dataset.btn;
      this.on(b, 'pointerdown', (e) => {
        e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on');
        if (navigator.vibrate && this.getSettings().vibration) { try { navigator.vibrate(8); } catch { /* ignore */ } }
        switch (id) {
          case 'fire': T.fire = true; break; case 'ads': T.ads = !T.ads; b.classList.toggle('latched', T.ads); break;
          case 'reload': this.edges.reload = true; break; case 'jump': this.edges.jump = true; break;
          case 'crouch': T.crouch = !T.crouch; b.classList.toggle('latched', T.crouch); break;
          case 'interact': T.interact = true; break; case 'swap': this.edges.swap = true; break;
          case 'equip': this.edges.equip = true; break; case 'heal': this.edges.heal = true; break;
          case 'pause': this.edges.pause = true; break; default: break;
        }
      });
      const up = (e) => { b.classList.remove('on'); if (id === 'fire') T.fire = false; if (id === 'interact') T.interact = false; };
      this.on(b, 'pointerup', up); this.on(b, 'pointercancel', up);
    }
    this.on(el, 'touchmove', (e) => e.preventDefault(), { passive: false });
  }

  dragStick(e, R, setKnob) {
    const T = this.touch; const dx = e.clientX - T.moveOrigin.x, dy = e.clientY - T.moveOrigin.y;
    const d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / R);
    const nx = dx / d, ny = dy / d;
    T.moveVec = { x: nx * m, y: ny * m };
    T.sprint = m > 0.92 && ny < -0.5;
    setKnob(nx * Math.min(d, R), ny * Math.min(d, R));
  }

  setTouchVisible(v) { if (this.touchEl) this.touchEl.style.display = v ? '' : 'none'; }
  resetLatches() {
    this.touch.ads = false; this.touch.crouch = false; this.touch.fire = false; this.touch.interact = false;
    if (this.touchEl) for (const b of this.touchEl.querySelectorAll('.latched')) b.classList.remove('latched');
    this.crouchToggle = false;
  }

  /* One snapshot of intent per frame. */
  poll() {
    const s = this.getSettings();
    const k = this.keys, T = this.touch, e = this.edges, m = this.mouse;
    let mx = 0, mz = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) mz -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) mz += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    if (T.moveVec.x || T.moveVec.y) { mx = T.moveVec.x; mz = T.moveVec.y; }
    const ads = m.right || T.ads;
    const sens = (ads ? s.aimSens : 1) * s.sens;
    const inv = s.invertY ? -1 : 1;
    const dyaw = -(m.dx * 0.0022 * sens) - T.look.dx * 0.0034 * s.touchSens * (ads ? s.aimSens : 1);
    const dpitch = -(m.dy * 0.0022 * sens + T.look.dy * 0.0034 * s.touchSens * (ads ? s.aimSens : 1)) * inv;
    m.dx = m.dy = 0; T.look.dx = T.look.dy = 0;
    const out = {
      mx, mz, dyaw, dpitch, ads,
      fire: m.left || T.fire, sprint: k.has('ShiftLeft') || k.has('ShiftRight') || T.sprint,
      crouch: this.crouchToggle || T.crouch || k.has('ControlLeft'), interact: k.has('KeyE') || k.has('KeyF') || T.interact,
      jump: e.jump, reload: e.reload, equip: e.equip, heal: e.heal, sw: e.sw, swap: e.swap, pause: e.pause, shoulder: e.shoulder, scoreboard: e.scoreboard || k.has('Tab'),
    };
    e.jump = e.reload = e.equip = e.heal = e.swap = e.pause = e.shoulder = false; e.sw = -1;
    return out;
  }

  dispose() {
    for (const [t, type, fn, opts] of this.listeners) t.removeEventListener(type, fn, opts);
    this.listeners.length = 0; this.enabled = false; this.exitLock();
    if (this.touchEl && this.touchEl.parentNode) this.touchEl.parentNode.removeChild(this.touchEl);
    this.touchEl = null;
  }
}
