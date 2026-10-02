/* ============================================================
   vector/characters.js  |  Asset loading + human-like characters.

   Your models in vector-3dassets/ are authored Z-up, face -Y and have no
   skeleton. This file re-orients and scales them, then "rigs" them by
   pivoting the named parts (legL, legR, armL, armR ...) so they can walk,
   aim and fall without skeletal animation. If a model file is missing,
   a procedural placeholder with the SAME part names is built instead, so
   dropping in a real model later needs no code change.
   ============================================================ */
import * as THREE from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { ASSET_BASE } from './config.js';
import { COSMETICS, DEFAULT_LOOK } from './cosmetics.js';

const BASE = new URL(ASSET_BASE, import.meta.url).href;

/* Names that do not exist yet. Create these .glb files and drop them into
   vector-3dassets/ at the path shown: no code change needed.              */
export const PLACEHOLDERS = [
  'characters/enemy_scout.glb', 'characters/enemy_commander.glb', 'characters/ally_civilian.glb',
  'environment/tree.glb', 'environment/server_rack.glb', 'environment/door.glb', 'environment/fence_section.glb',
  'environment/wall_module.glb', 'environment/stairs_module.glb', 'environment/intel_case.glb', 'environment/terminal_console.glb',
  'props/ammo_box.glb', 'props/armor_vest.glb',
];

export class AssetLoader {
  constructor() { this.loader = new GLTFLoader(); this.cache = new Map(); this.missing = new Set(); this.dead = false; }

  /* Resolves to a THREE.Group, or null if the file is not there. Never throws. */
  load(path) {
    if (!path) return Promise.resolve(null);
    if (this.cache.has(path)) return this.cache.get(path);
    const p = new Promise((resolve) => {
      this.loader.load(BASE + path + '.glb', (g) => resolve(g.scene), undefined, () => { this.missing.add(path); resolve(null); });
    });
    this.cache.set(path, p);
    return p;
  }

  async loadAny(paths) { for (const p of paths) { if (!p) continue; const m = await this.load(p); if (m) return m; } return null; }

  dispose() {
    this.dead = true;
    for (const pr of this.cache.values()) pr.then((scene) => { if (!scene) return; scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m) { if (m.map) m.map.dispose(); m.dispose(); } }); }); });
    this.cache.clear();
  }
}

/* Put a Z-up model into a Y-up group at a requested size.
   mode "stretch": fill exactly w x h x d.  mode "height": scale uniformly to height h. */
export function fitModel(src, { w, d, h, mode = 'stretch', faceFix = 0 } = {}) {
  const inner = src.clone(true);
  inner.rotation.x = -Math.PI / 2;
  const holder = new THREE.Group(); holder.add(inner);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  let sx, sy, sz;
  if (mode === 'height') sx = sy = sz = h / Math.max(1e-4, size.y);
  else { sx = w / Math.max(1e-4, size.x); sy = h / Math.max(1e-4, size.y); sz = d / Math.max(1e-4, size.z); }
  holder.scale.set(sx, sy, sz);
  holder.position.set(-ctr.x * sx, -box.min.y * sy, -ctr.z * sz);
  const out = new THREE.Group(); out.add(holder); out.rotation.y = faceFix;
  out.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return out;
}

/* ---------------- procedural stand-ins (same part names as your GLB) ---------------- */
function placeholderHumanoid() {
  const root = new THREE.Group(); root.name = 'world';
  const mk = (name, w, d, h, x, y, z, color) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    m.geometry.translate(0, 0, 0); m.position.set(x, y, z); m.name = name; root.add(m); return m;
  };
  // Part boxes authored in the same Z-up space and ~2.3 tall, like the real model.
  mk('g0_legL', 0.27, 0.3, 0.85, -0.2, 0, 0.55, '#2a2b2a'); mk('g1_legR', 0.27, 0.3, 0.85, 0.2, 0, 0.55, '#2a2b2a');
  mk('g2_bootL', 0.32, 0.5, 0.18, -0.2, -0.05, 0.1, '#0b0e11'); mk('g3_bootR', 0.32, 0.5, 0.18, 0.2, -0.05, 0.1, '#0b0e11');
  mk('g4_torso', 0.72, 0.38, 0.8, 0, 0, 1.35, '#2a2b2a'); mk('g5_vest', 0.8, 0.42, 0.62, 0, 0, 1.43, '#1a1f24'); mk('g6_belt', 0.78, 0.44, 0.12, 0, 0, 1.08, '#0b0e11');
  mk('g7_armL', 0.22, 0.28, 0.72, -0.53, 0, 1.38, '#2a2b2a'); mk('g8_armR', 0.22, 0.28, 0.72, 0.53, 0, 1.38, '#2a2b2a');
  mk('g9_head', 0.44, 0.44, 0.28, 0, 0, 2.02, '#b57a4a'); mk('g11_neck', 0.26, 0.26, 0.14, 0, 0, 1.83, '#b57a4a');
  mk('g12_helmet', 0.54, 0.54, 0.12, 0, 0, 2.25, '#0b0e11'); mk('g13_helmet rim', 0.56, 0.46, 0.08, 0, 0, 2.18, '#0b0e11');
  mk('g14_backpack', 0.62, 0.2, 0.72, 0, 0.28, 1.45, '#1a1f24');
  return root;
}

const OUTFIT = new Set(['legL', 'legR', 'torso', 'armL', 'armR']);
const find = (root, key) => { let f = null; root.traverse((o) => { if (!f && o.isMesh && o.name && o.name.toLowerCase().includes(key.toLowerCase()) && !o.name.toLowerCase().includes('volume')) f = o; }); return f; };

/* A rigged, customisable human. */
export class Character {
  constructor(srcModel, opts = {}) {
    this.group = new THREE.Group();
    this.opts = opts;
    this.scale = 1.85 / 2.31;
    const model = srcModel || placeholderHumanoid();
    this.usedPlaceholder = !srcModel;
    this.body = new THREE.Group();            // everything that bobs / falls
    this.group.add(this.body);
    this.inner = model.clone(true); this.inner.rotation.x = -Math.PI / 2;
    const face = new THREE.Group(); face.rotation.y = Math.PI; face.add(this.inner);   // model front is -Y, so after rotation.x it faces +Z; flip to -Z
    const sc = new THREE.Group(); sc.scale.setScalar(this.scale); sc.add(face); this.body.add(sc);
    this.sc = sc;
    this.parts = {}; this.mats = [];
    // give every mesh its own material so tinting one character never affects another
    this.inner.traverse((o) => {
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      o.castShadow = true; o.receiveShadow = false; o.frustumCulled = true;
      this.mats.push(o.material);
    });
    for (const k of ['legL', 'legR', 'bootL', 'bootR', 'torso', 'vest', 'belt', 'armL', 'armR', 'head', 'neck', 'helmet', 'backpack']) this.parts[k] = find(this.inner, k);
    this.parts.rim = find(this.inner, 'rim');
    this.hairGroup = new THREE.Group(); this.faceGroup = new THREE.Group();
    this.rig();
    this.weapon = null; this.weaponId = null; this.muzzle = new THREE.Object3D();
    this.aim = new THREE.Group(); this.aim.position.set(0, 1.32, 0); this.body.add(this.aim);   // shoulder height, real metres
    this.aim.add(this.muzzle);
    this.phase = Math.random() * 6; this.speed = 0; this.dead = 0; this.flash = 0; this.lean = 0; this.crouchT = 0; this.fireKick = 0;
    this.height = 1.85;
  }

  /* pivot legs at the hip and arms at the shoulder (model space, Z-up) */
  rig() {
    const pivotFor = (mesh, z) => {
      if (!mesh) return null;
      mesh.geometry.computeBoundingBox();
      const b = mesh.geometry.boundingBox, p = new THREE.Group();
      p.position.set((b.min.x + b.max.x) / 2, 0, z ?? b.max.z);
      mesh.parent.add(p); mesh.parent.remove(mesh); p.add(mesh); mesh.position.set(-p.position.x, -p.position.y, -p.position.z);
      return p;
    };
    const P = this.parts;
    this.pv = { legL: pivotFor(P.legL, 0.98), legR: pivotFor(P.legR, 0.98), armL: pivotFor(P.armL, 1.74), armR: pivotFor(P.armR, 1.74) };
    for (const k of ['bootL', 'bootR']) {
      const leg = k === 'bootL' ? this.pv.legL : this.pv.legR, m = P[k];
      if (leg && m) { m.parent.remove(m); leg.add(m); m.position.set(-leg.position.x, -leg.position.y, -leg.position.z); }
    }
    // hands, added to the arm pivots so they swing with the arms
    this.hands = [];
    for (const k of ['armL', 'armR']) {
      const pv = this.pv[k]; if (!pv) continue;
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.9 }));
      h.position.set(0, 0, 1.02 - 1.74 - 0.02); pv.add(h); this.hands.push(h); this.mats.push(h.material);
    }
    // head extras in model space
    const head = P.head ? P.head.parent : this.inner;
    const addTo = P.head ? P.head.parent : this.inner;
    addTo.add(this.hairGroup); addTo.add(this.faceGroup);
  }

  setWeapon(id, weaponMesh, len) {
    if (this.weaponId === id) return;
    this.weaponId = id;
    if (this.weapon) this.aim.remove(this.weapon);
    this.weapon = weaponMesh || null;
    if (!weaponMesh) return;
    // weaponMesh is already fitted: forward = -Z
    this.aim.add(weaponMesh);
    weaponMesh.position.set(0.14, -0.06, -0.3);
    const mz = weaponMesh.userData.muzzleZ || -(len || 0.9) / 2;
    this.muzzle.position.set(0.14, -0.04, -0.3 + mz);
  }

  /* look = cosmetic selection (ids). */
  setLook(look, enemyTint) {
    const l = { ...DEFAULT_LOOK, ...(look || {}) };
    const C = COSMETICS, col = (list, id, key = 'color') => { const o = list.find((x) => x.id === id); return o ? o[key] : null; };
    const P = this.parts;
    const outfit = enemyTint?.outfit || col(C.outfit, l.outfit) || '#2a2b2a';
    const vest = enemyTint?.vest || col(C.vest, l.vest) || '#1a1f24';
    const skin = enemyTint?.skin || col(C.skin, l.skin) || '#b57a4a';
    const helm = enemyTint?.helmet || col(C.helmet, l.helmet);
    const gloves = col(C.gloves, l.gloves) || '#111';
    for (const k of OUTFIT) if (P[k]) P[k].material.color.set(outfit);
    if (P.vest) P.vest.material.color.set(vest);
    if (P.backpack) { P.backpack.material.color.set(vest); P.backpack.visible = l.backpack !== 'b_off'; }
    if (P.head) P.head.material.color.set(skin); if (P.neck) P.neck.material.color.set(skin);
    for (const k of ['helmet', 'rim']) if (P[k]) { P[k].visible = !!helm; if (helm) P[k].material.color.set(helm); }
    for (const h of this.hands) h.material.color.set(gloves);
    this.buildHair(l.hair, enemyTint?.hair || '#1c1612', !!helm);
    this.buildFace(l.face, skin);
    this.emblem = l.emblem; this.look = l;
  }

  buildHair(style, color, helmet) {
    const g = this.hairGroup; while (g.children.length) { const c = g.children.pop(); c.geometry.dispose(); c.material.dispose(); }
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 1 }); this.mats.push(mat);
    const add = (geo, x, y, z, sx = 1, sy = 1, sz = 1, m = mat) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); g.add(o); return o; };
    if (style === 'crop') add(new THREE.SphereGeometry(0.245, 10, 8), 0, 0.01, 2.06, 1, 1, 0.75);
    else if (style === 'afro') add(new THREE.SphereGeometry(0.34, 12, 10), 0, 0.02, 2.1, 1, 1, 0.92);
    else if (style === 'braids') {
      add(new THREE.SphereGeometry(0.245, 10, 8), 0, 0.01, 2.06, 1, 1, 0.75);
      for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI - Math.PI / 2; add(new THREE.CylinderGeometry(0.028, 0.02, 0.5, 5), Math.sin(a) * 0.22, 0.17 + Math.cos(a) * 0.04, 1.93, 1, 1, 1).rotation.x = Math.PI / 2; }
    } else if (style === 'wrap') {
      const w = new THREE.MeshStandardMaterial({ color: '#7a2f2f', roughness: 0.95 }); this.mats.push(w);
      add(new THREE.SphereGeometry(0.255, 10, 8), 0, 0.01, 2.07, 1, 1, 0.8, w);
    }
    g.visible = !(helmet && style === 'crop');
  }

  buildFace(preset, skin) {
    const g = this.faceGroup; while (g.children.length) { const c = g.children.pop(); c.geometry.dispose(); c.material.dispose(); }
    const dark = new THREE.MeshBasicMaterial({ color: '#110d0b' }), white = new THREE.MeshBasicMaterial({ color: '#e6e0d6' }), hairM = new THREE.MeshBasicMaterial({ color: '#1c1612' });
    const add = (w, h, x, z, m = dark, depth = 0.02) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, depth, h), m); o.position.set(x, -0.225, z); g.add(o); return o; };
    const spread = preset === 'f2' ? 0.095 : preset === 'f3' ? 0.07 : 0.082;
    for (const s of [-1, 1]) { add(0.075, 0.042, s * spread, 2.06, white); add(0.04, 0.04, s * spread, 2.06, dark, 0.024); add(0.1, 0.022, s * spread, 2.11, hairM); }
    add(0.12, 0.018, 0, 1.96, dark);   // mouth
    if (preset === 'f2') add(0.3, 0.1, 0, 1.935, hairM, 0.03);                    // beard
    if (preset === 'f3') { const s = add(0.02, 0.15, 0.11, 2.03, new THREE.MeshBasicMaterial({ color: '#8c5a4a' }), 0.024); s.rotation.y = 0.4; }   // scar
    if (preset === 'f4') for (const s of [-1, 1]) add(0.12, 0.085, s * 0.085, 2.06, new THREE.MeshBasicMaterial({ color: '#15181b', wireframe: true }), 0.03);   // glasses
    this.mats.push(dark, white, hairM);
  }

  /* state: { speed (m/s), crouched, sprinting, pitch, alive, downed, firing } */
  update(dt, st) {
    this.speed += ((st.speed || 0) - this.speed) * Math.min(1, dt * 10);
    const moving = Math.min(1, this.speed / 4.5);
    this.phase += dt * (3 + this.speed * 1.9);
    const sw = Math.sin(this.phase) * 0.85 * moving;
    if (this.pv.legL) this.pv.legL.rotation.x = sw; if (this.pv.legR) this.pv.legR.rotation.x = -sw;
    // arms hold the weapon forward; pitch follows the aim
    const pitch = st.pitch || 0, armBase = -1.25 - pitch * 0.7 * (st.ads ? 1 : 0.6);
    const bob = Math.sin(this.phase * 2) * 0.04 * moving;
    if (this.pv.armL) { this.pv.armL.rotation.x = armBase + bob; this.pv.armL.rotation.z = -0.22; }
    if (this.pv.armR) { this.pv.armR.rotation.x = armBase + bob; this.pv.armR.rotation.z = 0.15; }
    this.aim.rotation.x = pitch * 0.85;
    this.fireKick *= Math.max(0, 1 - dt * 14);
    this.aim.position.z = this.fireKick * 0.06;
    // crouch and lean
    const ct = st.crouched ? 1 : 0; this.crouchT += (ct - this.crouchT) * Math.min(1, dt * 12);
    this.body.position.y = -0.38 * this.crouchT + Math.abs(Math.sin(this.phase)) * 0.045 * moving * (1 - this.crouchT);
    const lean = st.sprinting ? 0.22 : 0; this.lean += (lean - this.lean) * Math.min(1, dt * 8);
    this.body.rotation.x = this.lean;
    // dying / downed
    const target = !st.alive ? 1 : st.downed ? 0.85 : 0;
    this.dead += (target - this.dead) * Math.min(1, dt * 6);
    if (this.dead > 0.01) { this.body.rotation.x = -this.dead * Math.PI / 2 * 0.95; this.body.position.y = -0.85 * this.dead * 0.25 + 0.0; this.body.position.z = this.dead * 0.6; }
    else this.body.position.z = 0;
    // damage flash
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 4); for (const m of this.mats) if (m.emissive) { m.emissive.setRGB(this.flash * 0.9, this.flash * 0.05, this.flash * 0.05); } }
  }

  hit() { this.flash = 1; }
  kick() { this.fireKick = 1; }

  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of this.mats) if (m && m.dispose) m.dispose();
    this.mats.length = 0;
  }
}

/* Weapon mesh helper: fits a Z-up weapon model so its barrel points -Z. */
export function buildWeaponMesh(model, lengthMeters, skinTint) {
  let g;
  if (model) {
    const inner = model.clone(true); inner.rotation.x = -Math.PI / 2;
    const holder = new THREE.Group(); holder.add(inner); holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder), sz = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const s = lengthMeters / Math.max(1e-4, sz.x);
    holder.scale.setScalar(s); holder.position.set(-ctr.x * s, -ctr.y * s, -ctr.z * s);
    g = new THREE.Group(); g.add(holder); g.rotation.y = Math.PI / 2;   // +X (barrel) -> -Z
    g.userData.muzzleZ = -lengthMeters / 2;
    holder.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.castShadow = true; if (skinTint && o.name && /receiver|handguard|stock|slide|frame|body/i.test(o.name)) o.material.color.set(skinTint); } });
  } else {
    g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: '#15181b', roughness: 0.6, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, lengthMeters), m); g.add(body);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), m); grip.position.set(0, -0.12, 0.06); g.add(grip);
    g.userData.muzzleZ = -lengthMeters / 2;
  }
  return g;
}
