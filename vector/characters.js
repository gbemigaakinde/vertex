/* ============================================================
   vector/characters.js  |  Asset loading + human-like characters.

   THREE kinds of character model are understood. The game tells them apart
   by itself when a file is loaded:

   1. "legacy"  Your original procedural characters: separate named parts
                (legL, legR, armL, armR, head ...), Z-up, facing -Y. They are
                posed by pivoting those parts (walk, aim, fall).
   2. "rigged"  A model with a skeleton (a glTF "skin"). Plays real animation
                clips: idle, walk, run, sprint, crouch, crouch_walk, death.
                Clips can be inside the character file or in one shared file
                (vector-3dassets/animations/humanoid.glb).
   3. "static"  A detailed single mesh with no skeleton (typical AI-generated
                or sculpted model). It cannot swing its arms and legs, so it
                gets whole-body motion only: bob, sway, lean, crouch, fall.

   Y-up files (the glTF standard) and Z-up files (your original pack) both
   work. Everything is converted to one internal convention before the game
   sees it, so the rest of the game is unchanged.

   Models are fetched on demand, one at a time, and kept in the browser's
   storage: see vector/assetstore.js.

   If a model file is missing or broken, a procedural stand-in with the same
   part names is built instead, so the game never stops.
   ============================================================ */
import * as THREE from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { MeshoptDecoder } from './lib/meshopt_decoder.module.js';
import { clone as cloneSkinned } from './lib/SkeletonUtils.js';
import { ASSET_BASE, MODELS, ANIMATION_LIBRARY } from './config.js';
import { COSMETICS, DEFAULT_LOOK } from './cosmetics.js';
import { ModelStore } from './assetstore.js';

const BASE = new URL(ASSET_BASE, import.meta.url).href;

/* Names that do not exist yet. Create these .glb files and drop them into
   vector-3dassets/ at the path shown: no code change needed.              */
export const PLACEHOLDERS = [
  'characters/enemy_scout.glb', 'characters/enemy_commander.glb', 'characters/ally_civilian.glb',
  'environment/tree.glb', 'environment/server_rack.glb', 'environment/door.glb', 'environment/fence_section.glb',
  'environment/wall_module.glb', 'environment/stairs_module.glb', 'environment/intel_case.glb', 'environment/terminal_console.glb',
  'props/ammo_box.glb', 'props/armor_vest.glb',
];

/* ---------------- what the loader learned about each model ---------------- */
const META = new WeakMap();
/* { mode: 'legacy'|'rigged'|'static', up, height, verts, skinned, clips[] } or null */
export const getModelMeta = (model) => (model && META.get(model)) || null;

const find = (root, key) => { let f = null; root.traverse((o) => { if (!f && o.isMesh && o.name && o.name.toLowerCase().includes(key.toLowerCase()) && !o.name.toLowerCase().includes('volume')) f = o; }); return f; };
const LEGACY_KEYS = ['legL', 'legR', 'armL', 'armR'];
const TEX_KEYS = ['map', 'normalMap', 'metalnessMap', 'roughnessMap', 'aoMap', 'emissiveMap', 'alphaMap'];
const cloneAny = (src) => { const m = getModelMeta(src); return m && m.skinned ? cloneSkinned(src) : src.clone(true); };

/* Free the GPU memory held by a loaded model (it is re-uploaded if used again). */
function disposeModel(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) { if (!m) continue; for (const k of TEX_KEYS) if (m[k]) m[k].dispose(); m.dispose(); }
  });
}

/* ---------------- animation clips ---------------- */

/* Pick the clip for each action by name. Works with Mixamo-style names too
   ("Idle", "Walking", "Running", "Crouch Idle", "Crouched Walking", "Dying"). */
export function mapClips(clips) {
  const list = (clips || []).filter((c) => c && c.tracks && c.tracks.length);
  const by = (re, not) => list.find((c) => re.test(c.name) && !(not && not.test(c.name))) || null;
  const MOVE_NOT = /crouch|back|left|right|strafe/i;
  const out = {
    idle: by(/idle|stand|breath|rest/i, /crouch/i),
    walk: by(/walk/i, MOVE_NOT),
    run: by(/run|jog/i, MOVE_NOT),
    sprint: by(/sprint|fast.?run/i, /crouch/i),
    crouch: by(/crouch.*idle|idle.*crouch|crouch(?!.*(walk|run|move))/i),
    crouchWalk: by(/crouch.*(walk|move|run)|(walk|move).*crouch/i),
    death: by(/death|die|dying|dead|killed/i),
  };
  // a file with exactly one clip whose name says nothing (Mixamo calls it "mixamo.com"): treat it as the idle loop
  if (!Object.values(out).some(Boolean) && list.length === 1) out.idle = list[0];
  if (!out.walk) out.walk = out.run;
  if (!out.run) out.run = out.walk;
  if (!out.sprint) out.sprint = out.run;
  return out;
}

/* Game code moves the character, so a clip that also walks forward would slide
   twice. Freeze the hips' sideways/forward motion (keep the up-down bob). */
export function stripRootMotion(clip) {
  const out = clip.clone();
  for (const t of out.tracks) {
    const dot = t.name.lastIndexOf('.');
    if (dot < 0 || t.name.slice(dot) !== '.position') continue;
    if (!/hips|pelvis|root|armature/i.test(t.name.slice(0, dot))) continue;
    const v = t.values; if (v.length < 6) continue;
    for (let i = 0; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; }
  }
  return out;
}

/* Do this clip's tracks belong to this skeleton? (A shared clip file made for a
   different skeleton would otherwise silently do nothing.) */
export function clipFits(clip, root) {
  const seen = new Set(); let ok = 0;
  for (const t of clip.tracks) {
    const dot = t.name.lastIndexOf('.'); const node = dot < 0 ? t.name : t.name.slice(0, dot);
    if (seen.has(node)) continue; seen.add(node);
    if (root.getObjectByName(node)) ok++;
  }
  return seen.size > 0 && ok / seen.size >= 0.6;
}

/* ---------------- the loader ---------------- */
export class AssetLoader {
  constructor(opts = {}) {
    this.store = opts.store || new ModelStore({ base: BASE, cacheName: MODELS.cacheName, concurrency: MODELS.concurrency, retries: MODELS.retries, timeoutMs: MODELS.timeoutMs, stallMs: MODELS.stallMs, maxBytes: MODELS.maxBytes });
    this.loader = new GLTFLoader();
    this.loader.setMeshoptDecoder(MeshoptDecoder);       // models compressed by tools/optimize-model.mjs
    this.models = new Map();        // path -> Promise<model | null>
    this.clipsCache = new Map();    // path -> Promise<AnimationClip[]>
    this.cache = this.models;       // old name, kept for any outside code
    this.missing = new Set();       // paths that are not usable (stand-ins are used instead)
    this.retryAt = new Map();       // path -> time before which we do not retry a network failure
    this.session = 0;               // bumped once per mission; used to free models nobody has needed lately
    this.used = new Map();          // path -> session it was last asked for
    this.maxAniso = 1;
    this.dead = false;
    this.logged = new Set();
  }

  /* Start fetching the manifest now so the first model request does not wait for it. */
  warmUp() { return this.store.init(); }
  setMaxAnisotropy(n) { this.maxAniso = Math.max(1, Math.min(8, n | 0 || 1)); }
  info(path) { return this.store.info(path); }
  stats() { return { ...this.store.stats, resident: this.models.size, missing: this.missing.size }; }

  /* Resolves to a model (a THREE.Group), or null if it is not there / not usable. Never throws. */
  load(path, { priority = 0 } = {}) {
    if (!path || this.dead) return Promise.resolve(null);
    this.used.set(path, this.session);
    const hold = this.retryAt.get(path);
    if (hold && Date.now() < hold) return Promise.resolve(null);
    let p = this.models.get(path);
    if (!p) { p = this._load(path, priority); this.models.set(path, p); }
    return p;
  }

  async loadAny(paths) { for (const p of paths) { if (!p) continue; const m = await this.load(p); if (m) return m; } return null; }

  /* Several at once (the store only runs a few downloads at a time). */
  preload(paths, { onProgress = null, priority = 0 } = {}) {
    const list = [...new Set((paths || []).filter(Boolean))]; let done = 0;
    if (!list.length) { if (onProgress) onProgress(1); return Promise.resolve([]); }
    return Promise.all(list.map((p) => this.load(p, { priority }).then((m) => { done++; if (onProgress) onProgress(done / list.length); return m; })));
  }

  /* Download into the browser cache only. Nothing is parsed or uploaded to the GPU. */
  prefetch(paths) { return this.store.prefetch((paths || []).filter((p) => p && !this.models.has(p))); }

  /* Call at the start of every mission. Frees models that neither this mission
     nor the previous one asked for (they stay in the browser cache on disk). */
  beginSession() {
    this.session++;
    for (const [path, p] of [...this.models]) {
      if ((this.used.get(path) ?? 0) < this.session - 1) {
        this.models.delete(path); this.used.delete(path);
        p.then((m) => { if (m) disposeModel(m); });
      }
    }
  }

  async _load(path, priority) {
    try {
      const got = await this.store.fetchModel(path, { priority });
      if (this.dead) return null;
      const gltf = await this.loader.parseAsync(got.buffer, '');
      if (this.dead) { disposeModel(gltf.scene); return null; }
      return this._prepare(path, gltf);
    } catch (e) {
      this.missing.add(path);
      const code = e && e.code;
      if (code === 'network' || code === 'timeout') { this.models.delete(path); this.retryAt.set(path, Date.now() + 15000); }   // transient: try again later
      if (code !== 'aborted') this._report(path, e);
      return null;
    }
  }

  _report(path, e) {
    if (this.logged.has(path)) return; this.logged.add(path);
    const code = (e && e.code) || 'error', msg = (e && e.message) || String(e);
    const text = `${path}: ${code === 'missing' ? 'not found, using a stand-in' : msg + ' (using a stand-in)'}`;
    try { (code === 'missing' ? console.info : console.warn)('[vector assets] ' + text); } catch { /* ignore */ }
  }

  /* Turn what GLTFLoader gave us into the model the game expects. */
  _prepare(path, gltf) {
    const scene = gltf.scene;
    const entry = this.store.info(path) || {};
    const ov = entry.override || {};
    let skinned = false, verts = 0;
    scene.traverse((o) => {
      if (o.isSkinnedMesh) { skinned = true; o.frustumCulled = false; }   // its box is for the rest pose; animated limbs would pop out of view
      if (o.isMesh) verts += o.geometry && o.geometry.attributes.position ? o.geometry.attributes.position.count : 0;
    });
    const legacyParts = LEGACY_KEYS.every((k) => !!find(scene, k));
    const isChar = path.startsWith('characters/');
    this._tuneMaterials(scene);

    // clips that came inside this file
    const clips = (gltf.animations || []).filter((c) => c && c.tracks.length).map(stripRootMotion);

    // Which way is up? manifest/override first; characters are measured (the tall axis); everything else is Z-up like the original pack.
    let up = ov.up || entry.up || null;
    if (!up) {
      if (isChar && !legacyParts) {
        const b = new THREE.Box3().setFromObject(scene), s = b.getSize(new THREE.Vector3());
        up = s.z > s.y * 1.15 ? 'Z' : 'Y';
      } else up = 'Z';
    }
    const flip = up === 'Y' ? ov.front === '-Z' : ov.front === '+Y';
    /* Which kind of character is it?
       - skeleton            -> "rigged"
       - glTF-standard Y-up, no skeleton, no part names -> "static" (a detailed single mesh)
       - everything else (the original Z-up pack, with or without part names) -> "legacy": handled exactly as before
       "override": { "kind": "legacy" | "static" } in manifest.json can force it. */
    const hifi = isChar && (ov.kind ? ov.kind !== 'legacy' : (skinned || (!legacyParts && up === 'Y')));
    const mode = !isChar ? 'static' : hifi ? (skinned ? 'rigged' : 'static') : 'legacy';
    // Original-style models (Z-up, front -Y) need no conversion: hand them back untouched.
    if (up === 'Z' && !flip && !hifi) {
      META.set(scene, { mode, up, height: 0, verts, skinned, clips });
      scene.userData.vb = { mode, verts, up };
      return scene;
    }
    // Convert to the game's internal convention: Z-up, front toward -Y (what the original pack uses).
    const orient = new THREE.Group(); orient.add(scene);
    if (up === 'Y') orient.rotation.x = Math.PI / 2;                  // glTF is Y-up, front +Z  ->  Z-up, front -Y
    const top = new THREE.Group(); top.add(orient);
    if (flip) top.rotation.z = Math.PI;
    const out = new THREE.Group(); out.name = 'vb-model'; out.add(top);

    let height = 0;
    if (hifi) {
      // stand the character on the floor, centred, and remember how tall it is
      out.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(out), ctr = box.getCenter(new THREE.Vector3());
      top.position.set(-ctr.x, -ctr.y, -box.min.z);
      height = box.getSize(new THREE.Vector3()).z;
    }
    const meta = { mode, up, height, verts, skinned, clips };
    META.set(out, meta);
    out.userData.vb = { mode: meta.mode, verts, up };
    return out;
  }

  /* The game has no reflection map, so a fully-metallic texture set renders black. */
  _tuneMaterials(root) {
    const maxM = MODELS.maxMetalness, aniso = Math.min(this.maxAniso, 4);
    root.traverse((o) => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        if (!m) continue;
        if (m.metalnessMap && m.metalness > maxM) m.metalness = maxM;
        for (const k of TEX_KEYS) if (m[k]) m[k].anisotropy = aniso;
      }
    });
  }

  /* Clips from the shared animation file (loaded once, shared by every rigged character). */
  loadAnimations(path = ANIMATION_LIBRARY) {
    if (this.dead || !this.store.has(path)) return Promise.resolve([]);
    let p = this.clipsCache.get(path);
    if (!p) {
      p = (async () => {
        try {
          const got = await this.store.fetchModel(path, { priority: 5 });
          const gltf = await this.loader.parseAsync(got.buffer, '');
          disposeModel(gltf.scene);                                  // only the clips are wanted
          return gltf.animations.filter((c) => c.tracks.length).map(stripRootMotion);
        } catch (e) { if (e && e.code !== 'missing' && e.code !== 'aborted') this._report(path, e); return []; }
      })();
      this.clipsCache.set(path, p);
    }
    return p;
  }

  dispose() {
    this.dead = true;
    this.store.dispose();
    for (const pr of this.models.values()) pr.then((m) => { if (m) disposeModel(m); });
    this.models.clear(); this.clipsCache.clear(); this.used.clear();
  }
}

/* Put a Z-up model into a Y-up group at a requested size.
   mode "stretch": fill exactly w x h x d.  mode "height": scale uniformly to height h. */
export function fitModel(src, { w, d, h, mode = 'stretch', faceFix = 0 } = {}) {
  const inner = cloneAny(src);
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
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/* How fast each clip was authored to move, so feet do not slide. */
const CLIP_SPEED = { walk: 3.0, run: 4.8, sprint: 6.6, crouchWalk: 1.9 };

/* A character. Works for all three model kinds (see the top of this file). */
export class Character {
  constructor(srcModel, opts = {}) {
    this.group = new THREE.Group();
    this.opts = opts;
    const meta = srcModel ? getModelMeta(srcModel) : null;
    this.meta = meta;
    this.mode = meta ? meta.mode : 'legacy';                   // a stand-in is a legacy-style model
    this.hifi = this.mode !== 'legacy';
    this.scale = this.hifi ? MODELS.highFidelityHeight / Math.max(0.1, meta.height || 2.31) : 1.85 / 2.31;
    const model = srcModel || placeholderHumanoid();
    this.usedPlaceholder = !srcModel;
    this.body = new THREE.Group();            // everything that bobs / falls
    this.group.add(this.body);
    this.inner = this.mode === 'rigged' ? cloneSkinned(model) : model.clone(true); this.inner.rotation.x = -Math.PI / 2;
    const face = new THREE.Group(); face.rotation.y = Math.PI; face.add(this.inner);   // model front is -Y, so after rotation.x it faces +Z; flip to -Z
    const sc = new THREE.Group(); sc.scale.setScalar(this.scale); sc.add(face); this.body.add(sc);
    this.sc = sc;
    this.parts = {}; this.mats = [];
    const heavy = this.hifi && meta.verts > 60000;               // very dense meshes do not cast shadows (it doubles their cost)
    // give every mesh its own material so tinting one character never affects another
    this.inner.traverse((o) => {
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      o.castShadow = !heavy; o.receiveShadow = false; o.frustumCulled = !o.isSkinnedMesh;
      this.mats.push(...(Array.isArray(o.material) ? o.material : [o.material]));
    });
    this.bodyMats = this.mats.slice();
    this.hairGroup = new THREE.Group(); this.faceGroup = new THREE.Group();
    this.pv = {}; this.hands = [];
    if (!this.hifi) {
      for (const k of ['legL', 'legR', 'bootL', 'bootR', 'torso', 'vest', 'belt', 'armL', 'armR', 'head', 'neck', 'helmet', 'backpack']) this.parts[k] = find(this.inner, k);
      this.parts.rim = find(this.inner, 'rim');
      this.rig();
    }
    this.weapon = null; this.weaponId = null; this.muzzle = new THREE.Object3D();
    this.aim = new THREE.Group(); this.aim.position.set(0, 1.32, 0); this.body.add(this.aim);   // shoulder height, real metres
    this.aim.add(this.muzzle);
    this.phase = Math.random() * 6; this.speed = 0; this.dead = 0; this.flash = 0; this.lean = 0; this.crouchT = 0; this.fireKick = 0;
    this.height = 1.85;
    // animation (rigged models only)
    this.mixer = null; this.clipSet = null; this.acts = new Map(); this.curKey = null; this.curAct = null; this.dwell = 0; this.clipDrivesCrouch = false; this.clipDrivesDeath = false;
    if (this.mode === 'rigged') {
      this.mixer = new THREE.AnimationMixer(this.inner);
      this.setClips(meta.clips || []);
    }
  }

  /* True when this is a skeleton model that still has no usable clips (so the game should try the shared clip file). */
  needsClips() { return this.mode === 'rigged' && !(this.clipSet && this.clipSet.idle); }

  /* Give a rigged character its animation clips. Clips that do not belong to this skeleton are ignored. */
  setClips(clips) {
    if (!this.mixer) return false;
    const fit = (clips || []).filter((c) => clipFits(c, this.inner));
    const set = mapClips(fit);
    // keep anything we already had that the new set lacks
    if (this.clipSet) for (const k of Object.keys(this.clipSet)) if (!set[k] && this.clipSet[k]) set[k] = this.clipSet[k];
    this.clipSet = set;
    if (this.curAct) { this.curAct.stop(); this.curAct = null; this.curKey = null; }
    this.poseRigged(0, { alive: true }, 0, true);
    return !!set.idle;
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

  /* look = cosmetic selection (ids). Outfit / vest / skin / hair / face recolouring
     only exists for the original part-built models; a detailed model keeps its own
     textures and only takes a gentle team / enemy colour wash. */
  setLook(look, enemyTint) {
    const l = { ...DEFAULT_LOOK, ...(look || {}) };
    if (this.hifi) {
      const wash = enemyTint && (enemyTint.outfit || enemyTint.vest);
      const tint = wash ? new THREE.Color(wash) : null;
      for (const m of this.bodyMats) { if (!m.color) continue; m.color.set(0xffffff); if (tint) m.color.lerp(tint, 0.4); }
      this.emblem = l.emblem; this.look = l;
      return;
    }
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

  /* Skeleton animation: choose the clip that fits what the character is doing and blend to it. */
  poseRigged(dt, st, moving, instant) {
    const C = this.clipSet; if (!this.mixer || !C || !C.idle) { this.clipDrivesCrouch = false; this.clipDrivesDeath = false; return; }
    const down = !st.alive || !!st.downed;
    let key, clip;
    if (down && C.death) { key = 'death'; clip = C.death; }
    else if (st.crouched) {
      if (moving > 0.12) { key = C.crouchWalk ? 'crouchWalk' : 'walk'; clip = C.crouchWalk || C.walk || C.idle; }
      else { key = C.crouch ? 'crouch' : 'idle'; clip = C.crouch || C.idle; }
    } else if (this.speed < 0.45) { key = 'idle'; clip = C.idle; }
    else if (this.speed < 3.9) { key = 'walk'; clip = C.walk || C.idle; }
    else if (st.sprinting || this.speed > 5.7) { key = 'sprint'; clip = C.sprint || C.run || C.walk || C.idle; }
    else { key = 'run'; clip = C.run || C.walk || C.idle; }

    this.clipDrivesDeath = key === 'death';
    this.clipDrivesCrouch = !!st.crouched && ((moving > 0.12 && !!C.crouchWalk) || (moving <= 0.12 && !!C.crouch));
    this.dwell = Math.max(0, this.dwell - dt);
    if (clip && key !== this.curKey && (instant || key === 'death' || this.curKey === 'death' || this.dwell <= 0)) {
      let act = this.acts.get(clip);
      if (!act) { act = this.mixer.clipAction(clip); this.acts.set(clip, act); }
      if (key === 'death') { act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; } else { act.setLoop(THREE.LoopRepeat, Infinity); act.clampWhenFinished = false; }
      act.enabled = true; act.reset();
      if (this.curAct && this.curAct !== act && !instant) { act.crossFadeFrom(this.curAct, key === 'death' ? 0.1 : 0.22, false); }
      else if (this.curAct && this.curAct !== act) this.curAct.stop();
      act.play();
      this.curAct = act; this.curKey = key; this.dwell = 0.2;
    }
    if (this.curAct) {
      const ref = CLIP_SPEED[this.curKey];
      this.curAct.timeScale = ref ? clamp(this.speed / ref, 0.6, 1.5) : 1;
    }
    if (dt > 0 ? this.group.visible : true) this.mixer.update(dt);
  }

  /* state: { speed (m/s), crouched, sprinting, pitch, alive, downed, firing } */
  update(dt, st) {
    this.speed += ((st.speed || 0) - this.speed) * Math.min(1, dt * 10);
    const moving = Math.min(1, this.speed / 4.5);
    this.phase += dt * (3 + this.speed * 1.9);
    const pitch = st.pitch || 0;
    if (this.mode === 'legacy') {
      const sw = Math.sin(this.phase) * 0.85 * moving;
      if (this.pv.legL) this.pv.legL.rotation.x = sw; if (this.pv.legR) this.pv.legR.rotation.x = -sw;
      // arms hold the weapon forward; pitch follows the aim
      const armBase = -1.25 - pitch * 0.7 * (st.ads ? 1 : 0.6);
      const bob = Math.sin(this.phase * 2) * 0.04 * moving;
      if (this.pv.armL) { this.pv.armL.rotation.x = armBase + bob; this.pv.armL.rotation.z = -0.22; }
      if (this.pv.armR) { this.pv.armR.rotation.x = armBase + bob; this.pv.armR.rotation.z = 0.15; }
    } else if (this.mode === 'rigged') this.poseRigged(dt, st, moving, false);
    // a model with no skeleton cannot move its limbs: it gets the whole-body motion below instead
    this.aim.rotation.x = pitch * 0.85;
    this.fireKick *= Math.max(0, 1 - dt * 14);
    this.aim.position.z = this.fireKick * 0.06;
    // crouch and lean (skipped for parts a skeleton clip already animates)
    const ct = st.crouched && !this.clipDrivesCrouch ? 1 : 0; this.crouchT += (ct - this.crouchT) * Math.min(1, dt * 12);
    const stepBob = this.mode === 'rigged' && this.curAct ? 0 : Math.abs(Math.sin(this.phase)) * 0.045 * moving * (1 - this.crouchT);
    this.body.position.y = -0.38 * this.crouchT + stepBob;
    const noClips = this.mode === 'static' || (this.mode === 'rigged' && !this.curAct);
    const lean = this.mode === 'rigged' && this.curAct ? 0 : (st.sprinting ? 0.22 : 0) + (this.hifi && noClips ? moving * 0.05 : 0);
    this.lean += (lean - this.lean) * Math.min(1, dt * 8);
    this.body.rotation.x = this.lean;
    this.body.rotation.z = this.hifi && noClips ? Math.sin(this.phase) * 0.035 * moving : 0;   // weight shifts from foot to foot
    // dying / downed
    const target = !st.alive ? 1 : st.downed ? 0.85 : 0;
    this.dead += (target - this.dead) * Math.min(1, dt * 6);
    if (this.dead > 0.01 && !this.clipDrivesDeath) { this.body.rotation.x = -this.dead * Math.PI / 2 * 0.95; this.body.rotation.z = 0; this.body.position.y = -0.85 * this.dead * 0.25 + 0.0; this.body.position.z = this.dead * 0.6; }
    else this.body.position.z = 0;
    // damage flash
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 4); for (const m of this.mats) if (m.emissive) { m.emissive.setRGB(this.flash * 0.9, this.flash * 0.05, this.flash * 0.05); } }
  }

  hit() { this.flash = 1; }
  kick() { this.fireKick = 1; }

  dispose() {
    if (this.mixer) { try { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.inner); } catch { /* ignore */ } this.mixer = null; this.acts.clear(); }
    if (this.hifi) {
      // geometry and textures of a detailed model are shared with every other copy: only free what this character owns
      for (const g of [this.hairGroup, this.faceGroup]) g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    } else this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of this.mats) if (m && m.dispose) m.dispose();
    this.mats.length = 0; this.bodyMats = [];
  }
}

/* Weapon mesh helper: fits a Z-up weapon model so its barrel points -Z. */
export function buildWeaponMesh(model, lengthMeters, skinTint) {
  let g;
  if (model) {
    const inner = cloneAny(model); inner.rotation.x = -Math.PI / 2;
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
