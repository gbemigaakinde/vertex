/* ============================================================
   vector/platform.js  |  What device is this, and how is it being used?

   One small object owns every question about the device so the rest of
   the game never sniffs the browser itself:

   - caps       what the device CAN do (touch, mouse, gamepad, fullscreen...)
   - mode       what the player is USING right now: 'touch' | 'kbm' | 'pad'
                It follows the player: touch a screen and it becomes 'touch',
                move a mouse or press a key and it becomes 'kbm', press a
                controller button and it becomes 'pad'.
   - viewport   the real visible size (not 100vh, which lies on iOS Safari)
                written to the root as --vw / --vh (1% in px) plus data-*
                attributes the stylesheet reads.
   - fullscreen / landscape lock, both requested only from a tap, both
                allowed to fail without breaking anything.

   Every listener and timer here is tracked and removed in dispose().
   ============================================================ */
const NOOP_MQ = { matches: false, addEventListener() {}, removeEventListener() {} };
const mq = (q) => { try { return window.matchMedia ? window.matchMedia(q) : NOOP_MQ; } catch { return NOOP_MQ; } };
const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

export function detectCaps() {
  const ua = navigator.userAgent || '';
  const mac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;   // iPadOS pretends to be a Mac
  const el = document.documentElement;
  return {
    ios: /iPad|iPhone|iPod/.test(ua) || mac,
    ipad: /iPad/.test(ua) || mac,
    android: /Android/i.test(ua),
    touch: navigator.maxTouchPoints > 0 || 'ontouchstart' in window,
    coarse: mq('(any-pointer: coarse)').matches,
    fine: mq('(any-pointer: fine)').matches,
    primaryCoarse: mq('(pointer: coarse)').matches,
    fullscreen: !!(el.requestFullscreen || el.webkitRequestFullscreen),
    orientationLock: !!(window.screen && screen.orientation && screen.orientation.lock),
    gamepad: !!navigator.getGamepads,
    vibrate: !!navigator.vibrate,
    standalone: mq('(display-mode: standalone)').matches || navigator.standalone === true,
  };
}

/* Best first guess before the player has done anything. */
export function guessMode(c) {
  if (c.primaryCoarse) return 'touch';          // phones and tablets
  if (c.fine) return 'kbm';                      // desktops and laptops, touchscreen or not
  if (c.coarse || c.touch) return 'touch';
  return 'kbm';
}

export class Platform {
  constructor(root) {
    this.root = root; this.subs = new Set(); this.listeners = []; this.timers = []; this.padTimer = 0;
    this.caps = detectCaps(); this.mode = guessMode(this.caps);
    this.w = 0; this.h = 0; this.layout = 'desktop'; this.portrait = false; this.compact = false; this.narrow = false; this.wide = false; this.tiny = false;
    this.fs = isFs(); this.enteredFs = false; this.orientLocked = false; this.immersing = false; this.padCount = 0; this.portraitOk = false; this.started = false;
  }

  /* ---------------- tiny event hub ---------------- */
  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  emit(type) { for (const fn of [...this.subs]) { try { fn(type, this); } catch (e) { console.error('[vector platform]', e); } } }
  on(t, type, fn, o) { t.addEventListener(type, fn, o); this.listeners.push([t, type, fn, o]); }
  later(fn, ms) { const t = setTimeout(() => { this.timers = this.timers.filter((x) => x !== t); fn(); }, ms); this.timers.push(t); return t; }

  start() {
    if (this.started) return; this.started = true;
    const m = () => this.measure();
    this.on(window, 'resize', m);
    // iOS reports the new size a moment after the rotation event, so measure again shortly after.
    this.on(window, 'orientationchange', () => { m(); this.later(m, 200); this.later(m, 600); });
    if (window.screen && screen.orientation && screen.orientation.addEventListener) this.on(screen.orientation, 'change', () => { m(); this.later(m, 250); });
    if (window.visualViewport) this.on(window.visualViewport, 'resize', m);
    const fsc = () => { this.fs = isFs(); if (!this.fs) { this.enteredFs = false; this.orientLocked = false; } this.measure(); this.later(m, 150); this.later(m, 500); this.emit('fs'); };
    this.on(document, 'fullscreenchange', fsc); this.on(document, 'webkitfullscreenchange', fsc);

    // The active input mode follows what the player actually touches.
    const typing = (e) => { const t = e.target && e.target.tagName; return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT'; };
    this.on(window, 'pointerdown', (e) => { if (e.pointerType === 'touch' || e.pointerType === 'pen') this.setMode('touch'); else if (e.pointerType === 'mouse') this.setMode('kbm'); }, { capture: true, passive: true });
    this.on(window, 'pointermove', (e) => { if (e.pointerType === 'mouse' && (e.movementX || e.movementY)) this.setMode('kbm'); }, { capture: true, passive: true });
    this.on(window, 'keydown', (e) => { if (!typing(e)) this.setMode('kbm'); }, { capture: true, passive: true });
    this.on(window, 'gamepadconnected', () => this.scanPads());
    this.on(window, 'gamepaddisconnected', () => this.scanPads());
    this.scanPads(); this.measure(); this.applyAttrs();
  }

  /* ---------------- input mode ---------------- */
  setMode(m) {
    if (m === this.mode) return;
    this.mode = m; this.applyAttrs(); this.measure(); this.emit('mode');
  }

  /* Counts controllers and notices a press. The timer only runs while a controller is plugged in. */
  scanPads() {
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads() || []) : [];
    let n = 0, active = false;
    for (const p of pads) {
      if (!p || !p.connected) continue; n++;
      for (const b of p.buttons) if (b.pressed) active = true;
      for (const a of p.axes) if (Math.abs(a) > 0.65) active = true;
    }
    const was = this.padCount; this.padCount = n;
    if (n && !this.padTimer) this.padTimer = setInterval(() => this.scanPads(), 140);
    if (!n && this.padTimer) { clearInterval(this.padTimer); this.padTimer = 0; if (this.mode === 'pad') this.setMode(guessMode(this.caps)); }
    if (active) this.setMode('pad');
    if (was !== n) { this.applyAttrs(); this.emit('pads'); }
  }

  /* ---------------- viewport ---------------- */
  /* The visible area, in CSS pixels. Safari's toolbars make 100vh taller than what you can see. */
  measure() {
    const r = this.root; if (!r) return;
    const vv = window.visualViewport;
    let w = r.clientWidth || window.innerWidth, h = r.clientHeight || window.innerHeight;
    if (vv && vv.width && vv.height) { w = Math.min(w, Math.round(vv.width)); h = Math.min(h, Math.round(vv.height)); }
    if (h < (r.clientHeight || 0) - 1) r.style.height = h + 'px';          // the page is taller than what is visible: shrink to fit
    else if (r.style.height && vv && Math.round(vv.height) >= r.clientHeight) r.style.removeProperty('height');
    const s = Math.min(w, h), touch = this.mode === 'touch';
    const phys = Math.min((window.screen && screen.width) || w, (window.screen && screen.height) || h);
    const layout = !touch ? 'desktop' : phys >= 600 ? 'tablet' : s <= 330 ? 'phone-s' : s > 400 ? 'phone-l' : 'phone';
    const portrait = h > w, compact = h < 340, tiny = h < 250, narrow = w < 780, wide = w / h > 2.15;
    const changed = w !== this.w || h !== this.h || layout !== this.layout;
    this.w = w; this.h = h; this.layout = layout; this.portrait = portrait; this.compact = compact; this.tiny = tiny; this.narrow = narrow; this.wide = wide;
    const st = r.style; st.setProperty('--vw', (w / 100) + 'px'); st.setProperty('--vh', (h / 100) + 'px');
    this.applyAttrs();
    if (changed) this.emit('viewport');
  }

  applyAttrs() {
    const r = this.root; if (!r) return;
    const set = (k, v) => { if (r.dataset[k] !== v) r.dataset[k] = v; };
    set('input', this.mode); set('layout', this.layout); set('orient', this.portrait ? 'portrait' : 'landscape');
    set('compact', this.compact ? '1' : '0'); set('tiny', this.tiny ? '1' : '0'); set('narrow', this.narrow ? '1' : '0'); set('wide', this.wide ? '1' : '0'); set('pads', this.padCount ? '1' : '0'); set('fs', this.fs ? '1' : '0');
    r.classList.toggle('vb-touchmode', this.mode === 'touch');      // kept for older selectors
  }

  /* A phone held upright needs the turn-your-device screen. Tablets and desktops never do. */
  needsLandscape() {
    if (this.mode !== 'touch' || !this.portrait || this.portraitOk) return false;
    return Math.min((window.screen && screen.width) || this.w, (window.screen && screen.height) || this.h) < 600;
  }
  allowPortrait() { this.portraitOk = true; }
  resetPortraitChoice() { this.portraitOk = false; }

  /* ---------------- fullscreen and landscape ---------------- */
  /* Browsers only allow these from a tap. Call from a click or touch handler, never from a timer. */
  async enterFullscreen() {
    if (!this.caps.fullscreen) return false;
    if (isFs()) { this.fs = true; return true; }
    const el = document.documentElement;
    try {
      const f = el.requestFullscreen || el.webkitRequestFullscreen;
      const p = f.call(el, { navigationUI: 'hide' }); if (p && p.then) await p;
      this.fs = isFs(); this.enteredFs = this.fs; return this.fs;
    } catch { return false; }
  }
  async exitFullscreen() {
    try { const f = document.exitFullscreen || document.webkitExitFullscreen; if (isFs() && f) { const p = f.call(document); if (p && p.then) await p; } } catch { /* ignore */ }
    this.fs = isFs(); this.enteredFs = false;
  }
  async toggleFullscreen() { if (isFs()) await this.exitFullscreen(); else await this.enterFullscreen(); this.measure(); return this.fs; }
  async lockLandscape() {
    if (!this.caps.orientationLock) return false;
    try { await screen.orientation.lock('landscape'); this.orientLocked = true; return true; } catch { return false; }
  }
  /* pref: 'auto' (touch devices only), 'on', 'off'. Returns what actually happened so the UI can be honest. */
  async enterImmersive(pref = 'auto') {
    const out = { fs: isFs(), lock: this.orientLocked };
    if (this.immersing) return out; this.immersing = true;
    try {
      const want = pref === 'on' || (pref === 'auto' && this.mode === 'touch');
      if (want && !out.fs) out.fs = await this.enterFullscreen();
      if (this.mode === 'touch' && !out.lock) out.lock = await this.lockLandscape();
    } finally { this.immersing = false; this.measure(); }
    return out;
  }
  releaseImmersive() {
    try { if (this.orientLocked && screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch { /* ignore */ }
    this.orientLocked = false;
    if (this.enteredFs) this.exitFullscreen();
  }
  /* iPhone Safari has no fullscreen API at all. Installing to the Home Screen is the only way to hide its toolbars. */
  needsInstallHint() { return this.caps.ios && !this.caps.fullscreen && !this.caps.standalone; }

  dispose() {
    for (const [t, type, fn, o] of this.listeners) t.removeEventListener(type, fn, o); this.listeners.length = 0;
    for (const t of this.timers) clearTimeout(t); this.timers.length = 0;
    if (this.padTimer) { clearInterval(this.padTimer); this.padTimer = 0; }
    this.subs.clear(); this.started = false;
    const r = this.root;
    if (r) { r.style.removeProperty('--vw'); r.style.removeProperty('--vh'); r.style.removeProperty('height'); for (const k of ['input', 'layout', 'orient', 'compact', 'tiny', 'narrow', 'wide', 'pads', 'fs']) delete r.dataset[k]; r.classList.remove('vb-touchmode'); }
    this.root = null;
  }
}
