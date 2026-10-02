/* ============================================================
   vector/renderer.js  |  Three.js scene, world builder, VFX, camera.
   Owns every GPU resource it creates and frees them in dispose().
   ============================================================ */
import * as THREE from './lib/three.module.js';
import { mergeGeometries } from './lib/BufferGeometryUtils.js';
import { AssetLoader, Character, fitModel, buildWeaponMesh } from './characters.js';
import { WEAPONS, EQUIPMENT } from './weapons.js';
import { ARCHETYPES } from './enemies.js';
import { dirFromAngles } from './combat.js';

export const QUALITY = {
  LOW:    { pr: 1.0,  shadows: 0,    sparks: 120, puffs: 50,  lights: 1, draw: 90,  fogMul: 1.5, aa: false, tracers: 12, chars: 10 },
  MEDIUM: { pr: 1.25, shadows: 1024, sparks: 300, puffs: 110, lights: 2, draw: 130, fogMul: 1.0, aa: true,  tracers: 24, chars: 14 },
  HIGH:   { pr: 2.0,  shadows: 2048, sparks: 700, puffs: 220, lights: 4, draw: 190, fogMul: 0.8, aa: true,  tracers: 40, chars: 20 },
};

export function detectQuality() {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  if (mobile || cores <= 4 || mem <= 2) return 'LOW';
  if (cores >= 8 && mem >= 8) return 'HIGH';
  return 'MEDIUM';
}

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; }
}

/* ---------- procedural textures (tiny, generated once) ---------- */
function canvasTex(size, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t;
}
const noiseFill = (g, s, base, amp, n) => { g.fillStyle = base; g.fillRect(0, 0, s, s); for (let i = 0; i < n; i++) { const v = (Math.random() * 2 - 1) * amp; g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`; g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 3); } };
function makeTextures() {
  return {
    concrete: canvasTex(128, (g, s) => { noiseFill(g, s, '#9a9a9a', 40, 900); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, s - 1, s - 1); }),
    metal: canvasTex(128, (g, s) => { noiseFill(g, s, '#8b9096', 28, 500); g.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 0; x < s; x += 16) g.fillRect(x, 0, 2, s); }),
    roof: canvasTex(128, (g, s) => { noiseFill(g, s, '#66696c', 30, 700); }),
    ground: canvasTex(256, (g, s) => { noiseFill(g, s, '#8d8d8d', 55, 2200); }),
    asphalt: canvasTex(128, (g, s) => { noiseFill(g, s, '#7c7c7c', 50, 1500); }),
    glow: canvasTex(64, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); }, false),
    puff: canvasTex(64, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(0.6, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); }, false),
  };
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TMP = new THREE.Object3D();

/* ============================================================ */
export class Renderer {
  constructor(canvas, qualityName) {
    this.canvas = canvas; this.dead = false;
    this.qName = qualityName in QUALITY ? qualityName : 'MEDIUM'; this.q = QUALITY[this.qName];
    this.r = new THREE.WebGLRenderer({ canvas, antialias: this.q.aa, powerPreference: 'high-performance', alpha: false, stencil: false });
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.toneMapping = THREE.ACESFilmicToneMapping; this.r.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 400);
    this.tex = makeTextures();
    this.assets = new AssetLoader();
    this.chars = new Map();      // id -> { c: Character, tag }
    this.map = null; this.worldGroup = null; this.dyn = new THREE.Group(); this.scene.add(this.dyn);
    this.doorMeshes = new Map(); this.barrelMeshes = new Map(); this.pickupMeshes = new Map(); this.intMeshes = new Map(); this.tgtMeshes = new Map(); this.coverMeshes = new Map(); this.projMeshes = new Map(); this.smokeMeshes = []; this.beacons = [];
    this.weaponCache = new Map();
    this.camState = { pos: V(), pivot: V(), dist: 3.6, shake: 0, fov: 70, off: 0.55, init: false, recoilPitch: 0 };
    this.time = 0; this.frameAvg = 16; this.frames = 0; this.onQuality = null; this.lastAdapt = 0;
    this.lightPool = []; this.size = { w: 1, h: 1 };
    this.initLights(); this.initVfx(); this.applyQuality();
  }

  /* ---------------- quality ---------------- */
  applyQuality() {
    const q = this.q;
    this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
    this.r.shadowMap.enabled = q.shadows > 0; this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    if (this.sun) {
      this.sun.castShadow = q.shadows > 0;
      if (q.shadows) { this.sun.shadow.mapSize.set(q.shadows, q.shadows); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    }
    if (this.scene.fog && this.baseFog) this.scene.fog.density = this.baseFog * q.fogMul;
    this.resize(this.size.w, this.size.h);
  }
  setQuality(name) { if (!(name in QUALITY)) return; this.qName = name; this.q = QUALITY[name]; this.applyQuality(); this.buildPools(); }
  resize(w, h) {
    this.size = { w, h };
    this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pr));
    this.r.setSize(w, h, false); this.cam.aspect = w / Math.max(1, h); this.cam.updateProjectionMatrix();
  }
  /* Drop a quality level if frames are slow for a while. Returns the new name or null. */
  adapt(frameMs, allowUp, ceiling) {
    this.frames++; this.frameAvg += (frameMs - this.frameAvg) * 0.04;
    if (this.frames < 120) return null;
    const order = ['LOW', 'MEDIUM', 'HIGH'], i = order.indexOf(this.qName);
    const now = performance.now();
    if (now - this.lastAdapt < 4000) return null;
    if (this.frameAvg > 26 && i > 0) { this.lastAdapt = now; this.setQuality(order[i - 1]); this.frameAvg = 16; return order[i - 1]; }
    if (allowUp && this.frameAvg < 11 && i < order.indexOf(ceiling || 'HIGH')) { this.lastAdapt = now + 6000; this.setQuality(order[i + 1]); this.frameAvg = 16; return order[i + 1]; }
    return null;
  }

  initLights() {
    this.hemi = new THREE.HemisphereLight('#bcd0e0', '#3a3a34', 0.6); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1d6', 1.6); this.sun.position.set(30, 50, 20);
    const sc = this.sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 130; this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.head = new THREE.SpotLight('#dfe8ff', 0, 40, 0.5, 0.6, 1.2); this.scene.add(this.head); this.scene.add(this.head.target);
  }

  /* ---------------- VFX pools ---------------- */
  initVfx() {
    this.vfx = new THREE.Group(); this.scene.add(this.vfx);
    this.buildPools();
  }
  buildPools() {
    if (this.pools) this.disposePools();
    const q = this.q;
    const P = this.pools = { sparks: null, puffs: null, tracers: [], flashes: [], booms: [], lights: [] };
    const mkPoints = (n, size, tex, blending, color) => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending, sizeAttenuation: true, opacity: 1 });
      const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; this.vfx.add(pts);
      return { pts, geo, pos, col, n, vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n), grow: new Float32Array(n), base: new Float32Array(n * 3), head: 0, rgb: new Float32Array(n * 3) };
    };
    P.sparks = mkPoints(q.sparks, 0.12, this.tex.glow, THREE.AdditiveBlending);
    P.puffs = mkPoints(q.puffs, 1.6, this.tex.puff, THREE.NormalBlending);
    const tm = new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const tg = new THREE.BoxGeometry(0.03, 0.03, 1);
    for (let i = 0; i < q.tracers; i++) { const m = new THREE.Mesh(tg, tm.clone()); m.visible = false; m.frustumCulled = false; this.vfx.add(m); P.tracers.push({ m, t: 0 }); }
    const fm = new THREE.SpriteMaterial({ map: this.tex.glow, color: '#ffcf7a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(fm.clone()); s.visible = false; s.scale.setScalar(0.7); this.vfx.add(s); P.flashes.push({ s, t: 0 }); }
    for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: '#ffb056', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.visible = false; this.vfx.add(s); P.booms.push({ s, t: 0, r: 4 }); }
    for (let i = 0; i < q.lights; i++) { const l = new THREE.PointLight('#ffb36b', 0, 14, 2); l.visible = false; this.vfx.add(l); P.lights.push({ l, t: 0, peak: 0 }); }
    this.tmpC = new THREE.Color();
  }
  disposePools() {
    const P = this.pools; if (!P) return;
    for (const s of [P.sparks, P.puffs]) { if (!s) continue; this.vfx.remove(s.pts); s.geo.dispose(); s.pts.material.dispose(); }
    for (const t of P.tracers) { this.vfx.remove(t.m); t.m.material.dispose(); }
    for (const f of P.flashes) { this.vfx.remove(f.s); f.s.material.dispose(); }
    for (const b of P.booms) { this.vfx.remove(b.s); b.s.material.dispose(); }
    for (const l of P.lights) { this.vfx.remove(l.l); l.l.dispose && l.l.dispose(); }
    this.pools = null;
  }

  emit(sys, x, y, z, vx, vy, vz, life, r, g, b, grow = 0) {
    const i = sys.head; sys.head = (sys.head + 1) % sys.n;
    sys.base[i * 3] = x; sys.base[i * 3 + 1] = y; sys.base[i * 3 + 2] = z;
    sys.vel[i * 3] = vx; sys.vel[i * 3 + 1] = vy; sys.vel[i * 3 + 2] = vz;
    sys.life[i] = life; sys.max[i] = life; sys.grow[i] = grow; sys.rgb[i * 3] = r; sys.rgb[i * 3 + 1] = g; sys.rgb[i * 3 + 2] = b;
  }
  stepSystem(sys, dt, gravity, drag) {
    const { pos, col, vel, life, max, base, rgb, n } = sys;
    for (let i = 0; i < n; i++) {
      if (life[i] <= 0) { pos[i * 3 + 1] = -999; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
      life[i] -= dt;
      vel[i * 3 + 1] -= gravity * dt; const k = Math.max(0, 1 - drag * dt); vel[i * 3] *= k; vel[i * 3 + 1] *= k; vel[i * 3 + 2] *= k;
      base[i * 3] += vel[i * 3] * dt; base[i * 3 + 1] += vel[i * 3 + 1] * dt; base[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (base[i * 3 + 1] < 0.02) { base[i * 3 + 1] = 0.02; vel[i * 3 + 1] *= -0.3; }
      const f = Math.max(0, life[i] / max[i]);
      pos[i * 3] = base[i * 3]; pos[i * 3 + 1] = base[i * 3 + 1]; pos[i * 3 + 2] = base[i * 3 + 2];
      col[i * 3] = rgb[i * 3] * f; col[i * 3 + 1] = rgb[i * 3 + 1] * f; col[i * 3 + 2] = rgb[i * 3 + 2] * f;
    }
    sys.geo.attributes.position.needsUpdate = true; sys.geo.attributes.color.needsUpdate = true;
  }

  spark(x, y, z, n = 6, nx = 0, ny = 1, nz = 0, color = [1, 0.75, 0.35]) {
    const P = this.pools; if (!P) return;
    for (let i = 0; i < n; i++) this.emit(P.sparks, x, y, z, nx * 2 + (Math.random() - 0.5) * 4, ny * 2 + Math.random() * 3, nz * 2 + (Math.random() - 0.5) * 4, 0.25 + Math.random() * 0.3, color[0], color[1], color[2]);
  }
  dust(x, y, z, n = 3, size = 1) {
    const P = this.pools; if (!P) return;
    for (let i = 0; i < n; i++) this.emit(P.puffs, x, y, z, (Math.random() - 0.5) * 1.2, 0.4 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2, 0.7 + Math.random() * 0.6, 0.5 * size, 0.47 * size, 0.42 * size);
  }
  tracer(ox, oy, oz, ex, ey, ez, color = '#ffd9a0') {
    const P = this.pools; if (!P) return;
    const t = P.tracers.find((x) => !x.m.visible) || P.tracers[0];
    const dx = ex - ox, dy = ey - oy, dz = ez - oz, len = Math.hypot(dx, dy, dz) || 1;
    t.m.position.set((ox + ex) / 2, (oy + ey) / 2, (oz + ez) / 2); t.m.scale.set(1, 1, len); t.m.lookAt(ex, ey, ez);
    t.m.material.color.set(color); t.m.material.opacity = 0.9; t.m.visible = true; t.t = 0.07;
  }
  flash(x, y, z, size = 0.7) {
    const P = this.pools; if (!P) return;
    const f = P.flashes.find((q) => !q.s.visible) || P.flashes[0];
    f.s.position.set(x, y, z); f.s.scale.setScalar(size); f.s.visible = true; f.t = 0.05; f.s.material.rotation = Math.random() * 6;
  }
  pointLight(x, y, z, peak = 3, dur = 0.12, color = '#ffb36b') {
    const P = this.pools; if (!P || !P.lights.length) return;
    const L = P.lights.reduce((a, b) => (a.t <= b.t ? a : b));
    L.l.position.set(x, y, z); L.l.color.set(color); L.l.intensity = peak; L.l.visible = true; L.t = dur; L.peak = peak; L.dur = dur;
  }
  explosion(x, y, z, r) {
    const P = this.pools; if (!P) return;
    const b = P.booms.find((q) => !q.s.visible) || P.booms[0];
    b.s.position.set(x, y + 0.5, z); b.r = r; b.t = 0.45; b.s.visible = true;
    for (let i = 0; i < Math.min(40, this.q.sparks / 6); i++) { const a = Math.random() * 6.28, e = Math.random() * 1.2, s = 4 + Math.random() * 9; this.emit(P.sparks, x, y + 0.4, z, Math.cos(a) * s * 0.7, 2 + e * s * 0.6, Math.sin(a) * s * 0.7, 0.4 + Math.random() * 0.6, 1, 0.55 + Math.random() * 0.3, 0.2); }
    for (let i = 0; i < Math.min(14, this.q.puffs / 5); i++) this.emit(P.puffs, x + (Math.random() - 0.5) * r * 0.5, y + 0.4, z + (Math.random() - 0.5) * r * 0.5, (Math.random() - 0.5) * 3, 1.2 + Math.random() * 2, (Math.random() - 0.5) * 3, 1.4 + Math.random(), 0.25, 0.23, 0.21);
    this.pointLight(x, y + 1, z, 8, 0.35, '#ff9a4a');
  }
  smokeCloud(x, y, z, r, ttl) { this.smokeMeshes.push({ x, y, z, r, t: ttl, acc: 0 }); }

  updateVfx(dt) {
    const P = this.pools; if (!P) return;
    this.stepSystem(P.sparks, dt, 9, 0.6); this.stepSystem(P.puffs, dt, -0.15, 0.9);
    for (const t of P.tracers) if (t.m.visible) { t.t -= dt; t.m.material.opacity = Math.max(0, t.t / 0.07) * 0.9; if (t.t <= 0) t.m.visible = false; }
    for (const f of P.flashes) if (f.s.visible) { f.t -= dt; if (f.t <= 0) f.s.visible = false; }
    for (const b of P.booms) if (b.s.visible) { b.t -= dt; const k = 1 - b.t / 0.45; b.s.scale.setScalar(b.r * (0.6 + k * 1.6)); b.s.material.opacity = Math.max(0, 1 - k); if (b.t <= 0) b.s.visible = false; }
    for (const L of P.lights) if (L.l.visible) { L.t -= dt; L.l.intensity = Math.max(0, L.peak * (L.t / L.dur)); if (L.t <= 0) L.l.visible = false; }
    for (let i = this.smokeMeshes.length - 1; i >= 0; i--) {
      const s = this.smokeMeshes[i]; s.t -= dt; s.acc += dt;
      if (s.acc > 0.12) { s.acc = 0; const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * s.r * 0.7; this.emit(P.puffs, s.x + Math.cos(a) * d, s.y + Math.random() * 1.5, s.z + Math.sin(a) * d, 0, 0.25, 0, 2.6, 0.78, 0.78, 0.8); }
      if (s.t <= 0) this.smokeMeshes.splice(i, 1);
    }
  }

  /* ---------------- world ---------------- */
  materialFor(kind, color) {
    const key = kind + '|' + color; this._mats = this._mats || new Map();
    if (this._mats.has(key)) return this._mats.get(key);
    const tex = kind === 'roof' ? this.tex.roof : kind === 'cover' || kind === 'fence' || kind === 'seawall' ? this.tex.metal : kind === 'road' ? this.tex.asphalt : this.tex.concrete;
    const m = new THREE.MeshStandardMaterial({ map: tex, color: color || '#888', roughness: 0.92, metalness: kind === 'fence' ? 0.4 : 0.05 });
    this._mats.set(key, m); return m;
  }
  boxGeo(w, h, d, tile = 2.2) {
    const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv;
    const f = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let face = 0; face < 6; face++) for (let i = 0; i < 4; i++) { const k = face * 4 + i; uv.setXY(k, uv.getX(k) * f[face][0] / tile, uv.getY(k) * f[face][1] / tile); }
    return g;
  }

  async buildWorld(map, onProgress) {
    this.clearWorld();
    this.map = map; const env = map.env;
    this.scene.background = new THREE.Color(env.sky); this.baseFog = env.fog; this.scene.fog = new THREE.FogExp2(env.sky, env.fog * this.q.fogMul);
    this.hemi.intensity = env.ambient * (env.indoor ? 1.2 : 1.7); this.hemi.color.set(env.indoor ? '#6f8396' : '#c6d8e8'); this.sun.intensity = env.sun * 2.4; this.sun.visible = env.sun > 0.05;
    this.head.intensity = env.indoor ? 40 : 0;
    const g = new THREE.Group(); this.worldGroup = g; this.scene.add(g);
    // ground
    const gt = this.tex.ground.clone(); gt.needsUpdate = true; gt.repeat.set(map.half / 3, map.half / 3);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(map.half * 2 + 120, map.half * 2 + 120), new THREE.MeshStandardMaterial({ map: gt, color: env.ground, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground); this._gt = gt;
    // decor patches (roads, floors, water, docks)
    const decorBuckets = new Map();
    for (const d of map.decor) {
      const y = d.type === 'floor' ? 0.03 : d.type === 'water' ? 0.02 : d.type === 'dock' ? 0.45 : 0.015;
      const geo = new THREE.BoxGeometry(d.w, d.type === 'dock' ? 0.12 : 0.03, d.d); geo.translate(d.x, y, d.z);
      const key = d.type + d.color; if (!decorBuckets.has(key)) decorBuckets.set(key, { geos: [], d }); decorBuckets.get(key).geos.push(geo);
    }
    for (const { geos, d } of decorBuckets.values()) {
      const m = mergeGeometries(geos); geos.forEach((x) => x.dispose());
      const mat = d.type === 'water' ? new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.88 }) : this.materialFor(d.type === 'road' ? 'road' : 'floor', d.color);
      const mesh = new THREE.Mesh(m, mat); mesh.receiveShadow = true; g.add(mesh);
    }
    // collision boxes: merged per material, models instanced per prop
    const buckets = new Map(); let i = 0; const total = map.boxes.length;
    const propJobs = [];
    for (const b of map.boxes) {
      if (b.door) { this.addDoor(b, g); continue; }
      if (b.kind === 'target') continue;
      if (b.kind === 'cover' && (b.model || b.tree || b.rack)) { propJobs.push(b); continue; }
      if (b.tree) { propJobs.push(b); continue; }
      const kind = b.kind === 'boundary' ? 'building' : b.kind;
      const key = kind + '|' + (b.color || '#777'); if (!buckets.has(key)) buckets.set(key, { geos: [], kind, color: b.color });
      const geo = this.boxGeo(b.w, b.h, b.d); geo.translate(b.x, b.y + b.h / 2, b.z); buckets.get(key).geos.push(geo);
    }
    for (const { geos, kind, color } of buckets.values()) {
      const m = mergeGeometries(geos); geos.forEach((x) => x.dispose());
      const mesh = new THREE.Mesh(m, this.materialFor(kind, color)); mesh.castShadow = kind !== 'roof'; mesh.receiveShadow = true; g.add(mesh);
    }
    // Props (your GLB models when present, procedural otherwise)
    const needed = [...new Set(propJobs.map((b) => b.model).filter(Boolean))];
    needed.push('environment/supply_drop', 'props/medkit');
    let done = 0;
    await Promise.all(needed.map((p) => this.assets.load(p).then(() => { done++; if (onProgress) onProgress(done / needed.length); })));
    for (const b of propJobs) { const o = await this.makeProp(b); if (o) { g.add(o); if (b.explosive) this.barrelMeshes.set(b.id, o); } }
    this.addZoneMarkers(map, g);
    if (env.indoor) this.addLamps(map, g);
    this.sun.position.set(30, 50, 20);
    return true;
  }

  addDoor(b, g) {
    const m = new THREE.Mesh(this.boxGeo(b.w, b.h, b.d, 1.6), this.materialFor('door', '#6a5a46')); m.position.set(b.x, b.y + b.h / 2, b.z); m.castShadow = true; g.add(m);
    this.doorMeshes.set(b.id, { m, y0: m.position.y, open: 0, target: 0 });
  }

  async makeProp(b) {
    const w = b.rotated ? b.d : b.w, d = b.rotated ? b.w : b.d;
    let o = null;
    if (b.model) {
      const src = await this.assets.load(b.model);
      if (src) o = fitModel(src, { w, d, h: b.h, mode: 'stretch' });
    }
    if (!o) {
      o = new THREE.Group();
      if (b.tree) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 3.2, 6), new THREE.MeshStandardMaterial({ color: '#4a3a2a', roughness: 1 })); trunk.position.y = 1.6; trunk.castShadow = true; o.add(trunk);
        for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(2.0 - k * 0.45, 2.8, 7), new THREE.MeshStandardMaterial({ color: k % 2 ? '#2b4a2c' : '#2f5131', roughness: 1 })); c.position.y = 3.2 + k * 1.5; c.castShadow = true; o.add(c); }
      } else if (b.rack) {
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, b.h, d), new THREE.MeshStandardMaterial({ color: '#1b2025', roughness: 0.6, metalness: 0.5 })); body.position.y = b.h / 2; body.castShadow = true; o.add(body);
        for (let k = 0; k < 8; k++) { const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: k % 3 ? '#35e08a' : '#e0a335' })); led.position.set(-w / 2 + 0.12 + (k % 4) * 0.2, 0.4 + Math.floor(k / 4) * 0.7, d / 2 + 0.01); o.add(led); }
      } else {
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, b.h, d), this.materialFor('cover', b.color || '#6f6f66')); body.position.y = b.h / 2; body.castShadow = true; body.receiveShadow = true; o.add(body);
      }
    }
    if (b.rotated && b.model) o.rotation.y = Math.PI / 2;
    o.position.set(b.x, b.y || 0, b.z); return o;
  }

  addZoneMarkers(map, g) {
    for (const [k, z] of Object.entries(map.zones)) {
      if (k !== 'START' && k !== 'EXTRACT') continue;
      const ring = new THREE.Mesh(new THREE.RingGeometry(z.r - 0.25, z.r, 48), new THREE.MeshBasicMaterial({ color: k === 'EXTRACT' ? '#4fe3a0' : '#7aa7ff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(z.x, 0.06, z.z); g.add(ring);
      if (k === 'EXTRACT') { const beam = new THREE.Mesh(new THREE.CylinderGeometry(z.r * 0.25, z.r * 0.25, 30, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#4fe3a0', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.set(z.x, 15, z.z); g.add(beam); }
    }
  }
  addLamps(map, g) {
    const geos = [], m = new THREE.MeshBasicMaterial({ color: '#d8ecff' });
    for (let x = -28; x <= 28; x += 14) for (let z = -28; z <= 28; z += 14) { const geo = new THREE.BoxGeometry(2.2, 0.06, 0.3); geo.translate(x, 3.9, z); geos.push(geo); }
    const mesh = new THREE.Mesh(mergeGeometries(geos), m); geos.forEach((q) => q.dispose()); g.add(mesh);
  }
  clearWorld() {
    for (const [, c] of this.chars) { if (c.c) { this.dyn.remove(c.c.group); c.c.dispose(); } } this.chars.clear();   // a model that is still loading has no mesh yet
    for (const coll of [this.pickupMeshes, this.intMeshes, this.tgtMeshes, this.coverMeshes, this.projMeshes]) { for (const o of coll.values()) { this.dyn.remove(o); this.disposeObj(o); } coll.clear(); }
    this.doorMeshes.clear(); this.barrelMeshes.clear(); this.smokeMeshes.length = 0;
    for (const b of this.beacons) { this.scene.remove(b); this.disposeObj(b); } this.beacons.length = 0;
    if (this.worldGroup) { this.scene.remove(this.worldGroup); this.disposeObj(this.worldGroup, true); this.worldGroup = null; }
    if (this._gt) { this._gt.dispose(); this._gt = null; }
    this.camState.init = false;
  }
  disposeObj(o, skipTextures) {
    o.traverse((n) => { if (n.geometry) n.geometry.dispose(); const ms = Array.isArray(n.material) ? n.material : [n.material]; for (const m of ms) if (m && !(this._mats && [...this._mats.values()].includes(m)) && m.dispose) m.dispose(); });
  }

  /* ---------------- dynamic state from the simulation ---------------- */
  setDoors(openIds) {
    const set = new Set(openIds);
    for (const [id, d] of this.doorMeshes) d.target = set.has(id) ? 1 : 0;
  }
  setBarrels(goneIds) { for (const id of goneIds) { const o = this.barrelMeshes.get(id); if (o) { this.worldGroup.remove(o); this.disposeObj(o); this.barrelMeshes.delete(id); } } }

  async ensureWeapon(id) {
    if (this.weaponCache.has(id)) return this.weaponCache.get(id);
    const w = WEAPONS[id]; if (!w) return null;
    const lens = { 'Assault Rifle': 0.95, Carbine: 0.8, SMG: 0.62, Shotgun: 1.0, 'Marksman Rifle': 1.15, 'Sniper Rifle': 1.3, Sidearm: 0.3, Launcher: 1.05 };
    const src = await this.assets.load(w.model);
    this.weaponCache.set(id, { src, len: lens[w.cat] || 0.9 });
    return this.weaponCache.get(id);
  }

  async spawnChar(id, kind, look, tint) {
    if (this.chars.has(id)) return this.chars.get(id);
    const entry = { c: null, kind, pending: true, tag: null };
    this.chars.set(id, entry);
    let src;
    if (kind === 'player') src = await this.assets.load('characters/player_operative');
    else { const a = ARCHETYPES[kind]; src = await this.assets.loadAny([a.model, a.fallback, 'characters/enemy_rifleman']); }
    if (this.dead || !this.chars.has(id)) return null;
    const c = new Character(src); c.setLook(look, tint); c.group.visible = false;
    entry.c = c; entry.pending = false; this.dyn.add(c.group);
    return entry;
  }
  removeChar(id) { const e = this.chars.get(id); if (!e) return; if (e.c) { this.dyn.remove(e.c.group); e.c.dispose(); } this.chars.delete(id); }

  async giveWeapon(entry, wid, skin) {
    if (!entry || !entry.c || !wid || entry.c.weaponId === wid || entry.wLoading === wid) return;
    entry.wLoading = wid;
    const w = await this.ensureWeapon(wid);
    entry.wLoading = null;
    if (!w || !entry.c || this.dead || entry.c.weaponId === wid) return;
    const tint = skin ? (skin) : null;
    entry.c.setWeapon(wid, buildWeaponMesh(w.src, w.len, tint), w.len);
  }

  /* World position of a character's muzzle, or null. */
  muzzlePos(id) {
    const e = this.chars.get(id); if (!e || !e.c || !e.c.weapon) return null;
    e.c.group.updateMatrixWorld(true);
    const p = e.c.muzzle.getWorldPosition(this._mv || (this._mv = new THREE.Vector3()));
    return { x: p.x, y: p.y, z: p.z };
  }

  syncPickups(list) {
    const seen = new Set();
    for (const p of list) {
      seen.add(p.id);
      let o = this.pickupMeshes.get(p.id);
      if (!o) {
        o = new THREE.Group();
        const col = p.k === 'ammo' ? '#d4a93a' : p.k === 'health' ? '#e05252' : '#5a8fd0';
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.36), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, emissive: col, emissiveIntensity: 0.25 })); box.position.y = 0.3; o.add(box);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 20), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; o.add(ring);
        o.position.set(p.x, 0, p.z); o.userData.box = box; this.dyn.add(o); this.pickupMeshes.set(p.id, o);
        const model = p.k === 'health' ? 'props/medkit' : p.k === 'ammo' ? 'environment/supply_drop' : null;
        if (model) this.assets.load(model).then((src) => { if (src && this.pickupMeshes.get(p.id) === o) { o.remove(box); box.geometry.dispose(); const m = fitModel(src, { w: 0.55, d: 0.45, h: 0.4, mode: 'stretch' }); o.add(m); o.userData.box = m; } });
      }
      o.userData.box.rotation.y = this.time * 1.4; o.userData.box.position.y = (o.userData.box.isGroup ? 0.15 : 0.3) + Math.sin(this.time * 2 + p.x) * 0.06;
    }
    for (const [id, o] of this.pickupMeshes) if (!seen.has(id)) { this.dyn.remove(o); this.disposeObj(o); this.pickupMeshes.delete(id); }
  }

  syncInteractables(list, tgts) {
    const seen = new Set();
    for (const i of list) {
      seen.add(i.id);
      let o = this.intMeshes.get(i.id);
      if (!o) {
        o = new THREE.Group();
        const col = i.k === 'device' ? '#58d0ff' : i.k === 'hostage' ? '#ffd45a' : i.k === 'item' ? '#c6ff5a' : '#7fb5ff';
        const base = new THREE.Mesh(new THREE.BoxGeometry(i.k === 'device' ? 0.9 : 0.4, i.k === 'device' ? 1.1 : 0.3, i.k === 'device' ? 0.6 : 0.3), new THREE.MeshStandardMaterial({ color: '#2a3138', roughness: 0.5, metalness: 0.5 }));
        base.position.y = i.k === 'device' ? 0.55 : 0.4; base.castShadow = true; o.add(base);
        const glow = new THREE.Mesh(new THREE.BoxGeometry(i.k === 'device' ? 0.7 : 0.25, i.k === 'device' ? 0.4 : 0.06, 0.05), new THREE.MeshBasicMaterial({ color: col }));
        glow.position.set(0, i.k === 'device' ? 0.8 : 0.56, i.k === 'device' ? 0.31 : 0.12); o.add(glow);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 12, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 6; o.add(beam);
        o.position.set(i.x, 0, i.z); this.dyn.add(o); this.intMeshes.set(i.id, o);
      }
    }
    for (const [id, o] of this.intMeshes) if (!seen.has(id)) { this.dyn.remove(o); this.disposeObj(o); this.intMeshes.delete(id); }
    const ts = new Set();
    for (const t of tgts || []) {
      ts.add(t.id);
      let o = this.tgtMeshes.get(t.id);
      if (!o) {
        o = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.3, 1.0), new THREE.MeshStandardMaterial({ color: '#7a2a20', roughness: 0.6, emissive: '#ff3a1a', emissiveIntensity: 0.3 })); body.position.y = 0.65; body.castShadow = true; o.add(body);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 10, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ff5a3a', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 5; o.add(beam);
        o.position.set(t.x, 0, t.z); o.userData.body = body; this.dyn.add(o); this.tgtMeshes.set(t.id, o);
      }
      const k = t.mh ? t.hp / t.mh : 1; o.userData.body.material.emissiveIntensity = 0.15 + (1 - k) * 0.9 + Math.sin(this.time * 6) * 0.08;
    }
    for (const [id, o] of this.tgtMeshes) if (!ts.has(id)) { this.dyn.remove(o); this.disposeObj(o); this.tgtMeshes.delete(id); }
  }

  addCover(ev) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ev.w, ev.h, ev.d), this.materialFor('cover', '#5b6b7a')); m.position.set(ev.x, ev.h / 2, ev.z); m.castShadow = true; this.dyn.add(m); this.coverMeshes.set(ev.id, m);
    this.assets.load('environment/barrier').then((src) => { if (src && this.coverMeshes.get(ev.id) === m) { this.dyn.remove(m); const o = fitModel(src, { w: ev.w, d: ev.d, h: ev.h, mode: 'stretch' }); o.position.set(ev.x, 0, ev.z); this.dyn.add(o); this.coverMeshes.set(ev.id, o); } });
  }
  removeCover(id) { const o = this.coverMeshes.get(id); if (o) { this.dyn.remove(o); this.disposeObj(o); this.coverMeshes.delete(id); } }

  syncProjectiles(list) {
    const seen = new Set();
    for (const p of list) {
      seen.add(p.id); let o = this.projMeshes.get(p.id);
      if (!o) {
        o = new THREE.Group(); const isRocket = p.k === 'rocket';
        const body = new THREE.Mesh(isRocket ? new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6) : new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: isRocket ? '#3a3f3a' : p.k === 'frag' ? '#3b4a32' : p.k === 'smoke' ? '#7c7c80' : '#d0d0d0', roughness: 0.6 }));
        if (isRocket) body.rotation.x = Math.PI / 2; o.add(body); this.dyn.add(o); this.projMeshes.set(p.id, o); o.userData.last = V(p.x, p.y, p.z);
      }
      const last = o.userData.last; const dir = V(p.x - last.x, p.y - last.y, p.z - last.z);
      o.position.set(p.x, p.y, p.z); if (dir.lengthSq() > 1e-6 && p.k === 'rocket') { o.lookAt(p.x + dir.x, p.y + dir.y, p.z + dir.z); if (this.pools && Math.random() < 0.6) this.emit(this.pools.puffs, p.x, p.y, p.z, 0, 0.2, 0, 0.8, 0.5, 0.5, 0.5); }
      last.set(p.x, p.y, p.z);
    }
    for (const [id, o] of this.projMeshes) if (!seen.has(id)) { this.dyn.remove(o); this.disposeObj(o); this.projMeshes.delete(id); }
  }

  /* Objective beacons (floating markers in the world). */
  setBeacons(list) {
    for (const b of this.beacons) { this.scene.remove(b); this.disposeObj(b); } this.beacons.length = 0;
    for (const z of list) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 40, 10, 1, true), new THREE.MeshBasicMaterial({ color: z.color || '#ffd45a', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      b.position.set(z.x, 20, z.z); this.scene.add(b); this.beacons.push(b);
    }
  }

  /* ---------------- camera ---------------- */
  /* aimYaw/aimPitch are the player's true aim. Camera sits on the shoulder. */
  updateCamera(dt, p, aim, opts) {
    const cs = this.camState, map = this.map;
    const ads = opts.ads, zoom = opts.zoom || 1;
    const eye = p.crouched ? 1.25 : 1.62;
    const tp = V(p.x, p.y + eye, p.z);
    if (!cs.init) { cs.pivot.copy(tp); cs.init = true; }
    const k = 1 - Math.exp(-dt * 16);
    cs.pivot.x += (tp.x - cs.pivot.x) * k; cs.pivot.z += (tp.z - cs.pivot.z) * k; cs.pivot.y += (tp.y - cs.pivot.y) * (1 - Math.exp(-dt * 10));
    const yaw = aim.yaw, pitch = aim.pitch + cs.recoilPitch;
    const fwd = dirFromAngles(yaw, pitch); const right = V(Math.cos(yaw), 0, -Math.sin(yaw));
    const wantDist = ads ? Math.min(1.6, opts.dist * 0.5) : opts.dist, wantOff = (ads ? 0.42 : 0.6) * (opts.shoulder || 1);
    cs.dist += (wantDist - cs.dist) * (1 - Math.exp(-dt * 12)); cs.off += (wantOff - cs.off) * (1 - Math.exp(-dt * 12));
    const first = opts.firstPerson;
    const origin = cs.pivot.clone(); origin.x += right.x * cs.off * 0.6; origin.z += right.z * cs.off * 0.6;
    const want = V(origin.x - fwd.x * cs.dist + right.x * cs.off * 0.4, origin.y - fwd.y * cs.dist + 0.15, origin.z - fwd.z * cs.dist + right.z * cs.off * 0.4);
    let final = want;
    if (first) final = V(p.x, p.y + eye, p.z);
    else if (map) {
      const dv = V(want.x - origin.x, want.y - origin.y, want.z - origin.z); const len = dv.length(); dv.normalize();
      const hit = map.raycast({ x: origin.x, y: origin.y, z: origin.z }, { x: dv.x, y: dv.y, z: dv.z }, len + 0.3);
      const t = hit ? Math.max(0.3, hit.t - 0.35) : len;
      final = V(origin.x + dv.x * t, origin.y + dv.y * t, origin.z + dv.z * t);
      if (final.y < 0.25) final.y = 0.25;
    }
    cs.shake = Math.max(0, cs.shake - dt * 1.8);
    const sh = opts.reducedMotion ? 0 : cs.shake * cs.shake, sx = (Math.random() - 0.5) * sh * 0.25, sy = (Math.random() - 0.5) * sh * 0.25;
    this.cam.position.set(final.x + sx, final.y + sy, final.z);
    const look = V(final.x + fwd.x * 20 + sx, final.y + fwd.y * 20 + sy, final.z + fwd.z * 20);
    // aim line from screen centre stays parallel to the true aim direction
    this.cam.lookAt(look);
    const fovWant = 72 / (ads ? zoom : 1) - (opts.sprint ? -4 : 0);
    cs.fov += (fovWant - cs.fov) * (1 - Math.exp(-dt * 14)); if (Math.abs(this.cam.fov - cs.fov) > 0.05) { this.cam.fov = cs.fov; this.cam.updateProjectionMatrix(); }
    this.head.position.copy(this.cam.position); this.head.target.position.set(look.x, look.y, look.z);
    // shadow follows the player
    this.sun.position.set(p.x + 30, 50, p.z + 20); this.sun.target.position.set(p.x, 0, p.z);
    return fwd;
  }
  shake(amount) { this.camState.shake = Math.min(1, this.camState.shake + amount); }

  /* ---------------- frame ---------------- */
  render(dt) {
    this.time += dt;
    for (const d of this.doorMeshes.values()) { d.open += (d.target - d.open) * Math.min(1, dt * 7); d.m.position.y = d.y0 + d.open * 2.7; d.m.visible = d.open < 0.97; }
    this.updateVfx(dt);
    this.r.render(this.scene, this.cam);
  }

  /* World position -> screen pixels (for name tags and markers). */
  project(x, y, z) {
    const v = V(x, y, z).project(this.cam);
    if (v.z > 1 || v.z < -1) return null;
    return { x: (v.x * 0.5 + 0.5) * this.size.w, y: (-v.y * 0.5 + 0.5) * this.size.h, d: v.z };
  }

  /* ---------------- menu backdrop: your operator, rotating ---------------- */
  async startMenu(look) {
    if (this.menu) { this.setMenuLook(look); return; }
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#070a0d'); scene.fog = new THREE.Fog('#070a0d', 6, 16);
    const cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 40); cam.position.set(0, 1.25, 4.2); cam.lookAt(0, 1.0, 0);
    scene.add(new THREE.HemisphereLight('#a9bfd2', '#2a2f34', 2.0));
    const key = new THREE.DirectionalLight('#fff1d6', 3.4); key.position.set(3, 4, 4); scene.add(key);
    const rim = new THREE.DirectionalLight('#ffb35a', 2.6); rim.position.set(-4, 2.5, -3); scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40), new THREE.MeshStandardMaterial({ color: '#12171c', roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.0, 48), new THREE.MeshBasicMaterial({ color: '#ffb35a', transparent: true, opacity: 0.5 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; scene.add(ring);
    this.menu = { scene, cam, char: null, t: 0, big: false, floor, ring };
    const src = await this.assets.load('characters/player_operative');
    if (this.dead || !this.menu) return;
    const c = new Character(src); c.setLook(look); c.update(0, { speed: 0, pitch: 0, alive: true });
    scene.add(c.group); this.menu.char = c;
    const w = await this.ensureWeapon('ar_vanguard');
    if (this.menu && this.menu.char === c && w) c.setWeapon('ar_vanguard', buildWeaponMesh(w.src, w.len, null), w.len);
  }
  setMenuLook(look) { if (this.menu && this.menu.char) this.menu.char.setLook(look); }
  renderMenu(dt, big) {
    const m = this.menu; if (!m) return;
    m.t += dt; const x = big ? 1.5 : 1.7;
    if (m.char) { m.char.group.position.set(x, 0, 0); m.char.group.rotation.y = Math.PI + Math.sin(m.t * 0.5) * 0.6 + 0.2; m.char.update(dt, { speed: 0, pitch: 0, alive: true, ads: false }); m.floor.position.x = x; m.ring.position.x = x; }
    m.cam.aspect = this.size.w / Math.max(1, this.size.h); m.cam.updateProjectionMatrix();
    this.r.render(m.scene, m.cam);
  }
  stopMenu() {
    const m = this.menu; if (!m) return; this.menu = null;
    if (m.char) m.char.dispose();
    m.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
    m.scene.clear();
  }

  dispose() {
    this.dead = true;
    this.stopMenu(); this.clearWorld(); this.disposePools();
    for (const [, w] of this.weaponCache) void w;
    this.weaponCache.clear(); this.assets.dispose();
    if (this._mats) { for (const m of this._mats.values()) m.dispose(); this._mats.clear(); }
    for (const t of Object.values(this.tex)) t.dispose();
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.scene.clear();
    this.r.dispose();
    try { this.r.forceContextLoss(); } catch { /* ignore */ }
    this.r.domElement = null;
  }
}
