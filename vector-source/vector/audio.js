/* ============================================================
   vector/audio.js  |  Procedural audio. Every sound is synthesised at
   runtime with the Web Audio API, so there are no copyrighted samples.
   Replace any sound by dropping a file in vector/assets/audio/ and
   registering it in SAMPLES (empty by default).
   ============================================================ */
const SAMPLES = {}; // e.g. { shot_ar: 'assets/audio/shot_ar.ogg' }

export class AudioSys {
  constructor() {
    this.ctx = null; this.master = null; this.buses = {}; this.vol = { master: 0.8, sfx: 0.9, music: 0.5, voice: 0.9 };
    this.noiseBuf = null; this.ambient = null; this.listener = { x: 0, z: 0, yaw: 0 }; this.buffers = {}; this.dead = false;
    this.lastStep = 0; this.musicNodes = null; this.voiceCount = 0;
  }

  /* Must be called from a user gesture on mobile Safari. */
  unlock() {
    if (this.dead) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch { return; }
      this.master = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(this.ctx.destination);
      for (const k of ['sfx', 'music', 'voice']) { const g = this.ctx.createGain(); g.connect(this.master); this.buses[k] = g; }
      const len = this.ctx.sampleRate * 1.5; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setVolumes(v) { Object.assign(this.vol, v); this.applyVolumes(); }
  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.buses.sfx.gain.value = this.vol.sfx; this.buses.music.gain.value = this.vol.music; this.buses.voice.gain.value = this.vol.voice;
  }
  setListener(x, z, yaw) { this.listener.x = x; this.listener.z = z; this.listener.yaw = yaw; }

  _env(g, t, a, d, peak, end = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
  _noise(t, dur, filterType, freq, q, peak, bus, pan = 0, attack = 0.002) {
    const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); this._env(g, t, attack, dur, peak);
    s.connect(f); f.connect(g); this._out(g, bus, pan); s.start(t); s.stop(t + dur + attack + 0.05);
  }
  _tone(t, f0, f1, dur, type, peak, bus, pan = 0) {
    const c = this.ctx; const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); this._env(g, t, 0.003, dur, peak); o.connect(g); this._out(g, bus, pan); o.start(t); o.stop(t + dur + 0.05);
  }
  _out(node, bus, pan) {
    if (this.ctx.createStereoPanner && pan) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); p.connect(this.buses[bus]); } else node.connect(this.buses[bus]);
  }

  /* Spatial helper: returns { vol, pan } for a world position. */
  spat(x, z, maxD = 70) {
    if (x === undefined) return { vol: 1, pan: 0 };
    const dx = x - this.listener.x, dz = z - this.listener.z, d = Math.hypot(dx, dz);
    const vol = Math.max(0, 1 - d / maxD) ** 1.5;
    const ang = Math.atan2(-dx, -dz) - this.listener.yaw;
    return { vol, pan: -Math.sin(ang) * Math.min(1, d / 6) };
  }

  play(name, x, z, o = {}) {
    if (!this.ctx || this.ctx.state !== 'running' || this.dead) return;
    const { vol, pan } = this.spat(x, z, o.maxD || 70);
    if (vol < 0.02) return;
    const t = this.ctx.currentTime + (o.delay || 0), v = vol * (o.gain || 1);
    switch (name) {
      case 'shot_ar': case 'shot_carbine': this._noise(t, 0.12, 'bandpass', 1800, 0.8, 0.5 * v, 'sfx', pan); this._tone(t, 160, 50, 0.1, 'triangle', 0.5 * v, 'sfx', pan); this._noise(t + 0.03, 0.25, 'lowpass', 500, 0.5, 0.15 * v, 'sfx', pan); break;
      case 'shot_smg': this._noise(t, 0.08, 'bandpass', 2600, 0.9, 0.4 * v, 'sfx', pan); this._tone(t, 220, 80, 0.06, 'square', 0.18 * v, 'sfx', pan); break;
      case 'shot_pistol': this._noise(t, 0.1, 'bandpass', 2200, 1, 0.42 * v, 'sfx', pan); this._tone(t, 260, 70, 0.08, 'triangle', 0.4 * v, 'sfx', pan); break;
      case 'shot_shotgun': this._noise(t, 0.3, 'lowpass', 1400, 0.6, 0.8 * v, 'sfx', pan); this._tone(t, 110, 35, 0.22, 'sawtooth', 0.5 * v, 'sfx', pan); break;
      case 'shot_sniper': this._noise(t, 0.35, 'bandpass', 1200, 0.5, 0.8 * v, 'sfx', pan); this._tone(t, 90, 28, 0.35, 'triangle', 0.8 * v, 'sfx', pan); this._noise(t + 0.08, 0.9, 'lowpass', 400, 0.4, 0.25 * v, 'sfx', pan); break;
      case 'shot_enemy': this._noise(t, 0.09, 'bandpass', 1500, 0.9, 0.3 * v, 'sfx', pan); this._tone(t, 140, 60, 0.07, 'triangle', 0.25 * v, 'sfx', pan); break;
      case 'rocket': this._noise(t, 0.6, 'lowpass', 700, 0.7, 0.5 * v, 'sfx', pan); this._tone(t, 90, 40, 0.5, 'sawtooth', 0.3 * v, 'sfx', pan); break;
      case 'explosion': this._noise(t, 1.1, 'lowpass', 500, 0.6, 1.0 * v, 'sfx', pan, 0.004); this._tone(t, 75, 22, 0.9, 'sine', 1.0 * v, 'sfx', pan); this._noise(t + 0.05, 0.6, 'bandpass', 2500, 0.6, 0.3 * v, 'sfx', pan); break;
      case 'impact': this._noise(t, 0.06, 'bandpass', 3200, 1.2, 0.25 * v, 'sfx', pan); break;
      case 'hit_flesh': this._noise(t, 0.09, 'lowpass', 900, 1, 0.35 * v, 'sfx', pan); this._tone(t, 180, 90, 0.08, 'sine', 0.25 * v, 'sfx', pan); break;
      case 'hitmarker': this._tone(t, 1800, 1500, 0.05, 'square', 0.12, 'sfx', 0); break;
      case 'headshot': this._tone(t, 2400, 2000, 0.07, 'square', 0.15, 'sfx', 0); this._tone(t + 0.05, 3000, 2600, 0.08, 'square', 0.12, 'sfx', 0); break;
      case 'kill': this._tone(t, 900, 1300, 0.12, 'triangle', 0.2, 'sfx', 0); break;
      case 'reload': this._noise(t, 0.05, 'highpass', 2500, 1, 0.3 * v, 'sfx', pan); this._noise(t + 0.45, 0.06, 'highpass', 1800, 1, 0.3 * v, 'sfx', pan); this._tone(t + 0.9, 420, 300, 0.06, 'square', 0.14 * v, 'sfx', pan); break;
      case 'empty': this._tone(t, 500, 400, 0.04, 'square', 0.12 * v, 'sfx', pan); break;
      case 'switch': this._noise(t, 0.05, 'highpass', 2000, 1, 0.22 * v, 'sfx', pan); break;
      case 'step': this._noise(t, 0.07, 'lowpass', 350 + Math.random() * 150, 1, 0.22 * v, 'sfx', pan); break;
      case 'jump': this._noise(t, 0.1, 'lowpass', 500, 0.6, 0.18 * v, 'sfx', pan); break;
      case 'door': this._tone(t, 120, 70, 0.25, 'sawtooth', 0.12 * v, 'sfx', pan); this._noise(t, 0.3, 'lowpass', 300, 1, 0.12 * v, 'sfx', pan); break;
      case 'pickup': this._tone(t, 600, 900, 0.1, 'triangle', 0.2 * v, 'sfx', pan); this._tone(t + 0.08, 900, 1200, 0.1, 'triangle', 0.16 * v, 'sfx', pan); break;
      case 'throw': this._noise(t, 0.12, 'bandpass', 900, 0.8, 0.2 * v, 'sfx', pan); break;
      case 'flash': this._noise(t, 0.5, 'highpass', 1500, 0.6, 0.6 * v, 'sfx', pan); this._tone(t, 3800, 3000, 0.9, 'sine', 0.2 * v, 'sfx', pan); break;
      case 'smoke': this._noise(t, 1.0, 'bandpass', 900, 0.4, 0.3 * v, 'sfx', pan, 0.05); break;
      case 'heal': this._tone(t, 500, 800, 0.4, 'sine', 0.2, 'sfx', 0); break;
      case 'hurt': this._noise(t, 0.12, 'lowpass', 700, 1, 0.45, 'sfx', pan); this._tone(t, 140, 60, 0.15, 'sine', 0.4, 'sfx', pan); break;
      case 'alert': this._tone(t, 440, 440, 0.12, 'square', 0.12 * v, 'sfx', pan); this._tone(t + 0.16, 660, 660, 0.12, 'square', 0.12 * v, 'sfx', pan); break;
      case 'radio': this._noise(t, 0.08, 'bandpass', 1800, 2, 0.12, 'voice', 0); this._tone(t + 0.04, 1200, 1100, 0.05, 'square', 0.05, 'voice', 0); break;
      case 'radio_end': this._noise(t, 0.06, 'bandpass', 2200, 2, 0.1, 'voice', 0); break;
      case 'objective': this._tone(t, 520, 520, 0.12, 'triangle', 0.22, 'sfx', 0); this._tone(t + 0.13, 780, 780, 0.22, 'triangle', 0.22, 'sfx', 0); break;
      case 'complete': for (let i = 0; i < 4; i++) this._tone(t + i * 0.12, 440 * [1, 1.25, 1.5, 2][i], 440 * [1, 1.25, 1.5, 2][i], 0.35, 'triangle', 0.22, 'sfx', 0); break;
      case 'fail': this._tone(t, 330, 110, 0.9, 'sawtooth', 0.22, 'sfx', 0); break;
      case 'alarm': for (let i = 0; i < 3; i++) this._tone(t + i * 0.3, 900, 600, 0.25, 'square', 0.1, 'sfx', 0); break;
      case 'ui_click': this._tone(t, 900, 700, 0.04, 'square', 0.09, 'sfx', 0); break;
      case 'ui_back': this._tone(t, 600, 400, 0.05, 'square', 0.09, 'sfx', 0); break;
      case 'ui_ok': this._tone(t, 700, 1100, 0.08, 'triangle', 0.13, 'sfx', 0); break;
      case 'countdown': this._tone(t, 800, 800, 0.08, 'square', 0.14, 'sfx', 0); break;
      case 'down': this._tone(t, 300, 80, 0.5, 'sawtooth', 0.22, 'sfx', 0); break;
      default: break;
    }
  }

  footstep(x, z, sprinting) {
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (now - this.lastStep < (sprinting ? 0.27 : 0.42)) return;
    this.lastStep = now; this.play('step', x, z, { gain: sprinting ? 1 : 0.7, maxD: 30 });
  }

  footstepOther(x, z, speed, _owner, id) {
    if (!this.ctx) return;
    this._fs = this._fs || new Map();
    const now = this.ctx.currentTime, last = this._fs.get(id) || 0;
    if (now - last < (speed > 5 ? 0.3 : 0.45)) return;
    this._fs.set(id, now); this.play('step', x, z, { gain: 0.8, maxD: 26 });
  }

  /* Low ambient drone that changes with the environment. */
  startAmbience(indoor) {
    if (!this.ctx || this.ambient) return;
    const c = this.ctx, g = c.createGain(); g.gain.value = indoor ? 0.06 : 0.035; g.connect(this.buses.music);
    const o1 = c.createOscillator(), o2 = c.createOscillator(); o1.type = 'sine'; o2.type = 'sine';
    o1.frequency.value = indoor ? 55 : 48; o2.frequency.value = indoor ? 82.5 : 72;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 0.02; lfo.connect(lg); lg.connect(g.gain);
    o1.connect(g); o2.connect(g); o1.start(); o2.start(); lfo.start();
    const wind = c.createBufferSource(); wind.buffer = this.noiseBuf; wind.loop = true; const wf = c.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = indoor ? 160 : 420; const wg = c.createGain(); wg.gain.value = indoor ? 0.03 : 0.04;
    wind.connect(wf); wf.connect(wg); wg.connect(this.buses.music); wind.start();
    this.ambient = { stop: () => { for (const n of [o1, o2, lfo, wind]) { try { n.stop(); } catch { /* already stopped */ } } g.disconnect(); wg.disconnect(); } };
  }
  stopAmbience() { if (this.ambient) { this.ambient.stop(); this.ambient = null; } }

  dispose() {
    this.dead = true; this.stopAmbience();
    if (this.ctx) { try { this.ctx.close(); } catch { /* ignore */ } }
    this.ctx = null;
  }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }
}
