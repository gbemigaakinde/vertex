/* ============================================================
   surfer/surfer-assets.js   |   KNOWLEDGE SURFER 3D — model loader

   • Loads every .glb listed in surfer-config.js
   • Resizes + re-centres each one so ANY model scale works
   • If a file is missing, builds a simple stand-in so the game
     still runs (you replace stand-ins by uploading the real .glb)
   ============================================================ */
import * as THREE from '../vector/lib/three.module.js';
import { GLTFLoader } from '../vector/lib/GLTFLoader.js';
import { mergeGeometries } from '../vector/lib/BufferGeometryUtils.js';
import { MODELS, ASSET_BASE } from './surfer-config.js';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...o });
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.set(x, y, z); return k; };
const cyl = (rt, rb, h, m, x = 0, y = 0, z = 0, seg = 14) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); k.position.set(x, y, z); return k; };
const ball = (r, m, x = 0, y = 0, z = 0) => { const k = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); k.position.set(x, y, z); return k; };

/* ───────────── stand-ins (used only when a .glb file is missing) ───────────── */
function person(body, pack, legShift, pose) {
  const g = new THREE.Group();
  const skin = mat(0xe8b88a), pants = mat(0x1d3f9f), shoe = mat(0x111827), top = mat(body);
  const lean = pose === 'stumble' ? 0.5 : pose === 'jump' ? -0.15 : 0;
  const tuck = pose === 'jump';
  const upper = new THREE.Group(); upper.rotation.x = lean; g.add(upper);
  upper.position.y = tuck ? 0.55 : 0.8;
  upper.add(box(0.52, 0.62, 0.3, top, 0, 0.55, 0));
  upper.add(ball(0.17, skin, 0, 1.05, 0));
  upper.add(box(0.12, 0.1, 0.1, mat(body), 0, 1.2, 0));
  if (pack) upper.add(box(0.38, 0.5, 0.2, mat(pack), 0, 0.6, 0.25));
  upper.add(box(0.11, 0.5, 0.11, top, -0.34, 0.5, tuck ? -0.1 : legShift * 0.5));
  upper.add(box(0.11, 0.5, 0.11, top,  0.34, 0.5, tuck ? -0.1 : -legShift * 0.5));
  const l1 = box(0.18, 0.8, 0.18, pants, -0.14, 0.4, tuck ? -0.35 : legShift);
  const l2 = box(0.18, 0.8, 0.18, pants,  0.14, 0.4, tuck ? -0.35 : -legShift);
  if (tuck) { l1.rotation.x = 1.0; l2.rotation.x = 1.0; l1.position.y = 0.3; l2.position.y = 0.3; }
  g.add(l1, l2);
  g.add(box(0.2, 0.1, 0.32, shoe, -0.14, 0.05, (tuck ? -0.5 : legShift) - 0.05));
  g.add(box(0.2, 0.1, 0.32, shoe,  0.14, 0.05, (tuck ? -0.5 : -legShift) - 0.05));
  if (pose === 'slide') { g.rotation.x = -1.35; g.position.y = 0.45; const h = new THREE.Group(); h.add(g); return h; }
  return g;
}
function dog(shift) {
  const g = new THREE.Group(), m = mat(0xd97706);
  g.add(box(0.28, 0.28, 0.7, m, 0, 0.45, 0));
  g.add(ball(0.16, m, 0, 0.62, -0.42));
  g.add(box(0.06, 0.16, 0.06, mat(0xb45309), -0.1, 0.8, -0.4));
  g.add(box(0.06, 0.16, 0.06, mat(0xb45309),  0.1, 0.8, -0.4));
  [[-0.1, -0.25], [0.1, -0.25], [-0.1, 0.25], [0.1, 0.25]].forEach(([x, z], i) => g.add(box(0.07, 0.4, 0.07, m, x, 0.2, z + (i % 2 ? shift : -shift))));
  return g;
}
/* glue all little boxes that share a material into one mesh (keeps draw calls tiny) */
function bake(group) {
  group.updateMatrixWorld(true);
  const byMat = new Map();
  group.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const m = o.material, key = [m.color.getHex(), m.metalness, m.roughness, m.emissive.getHex(), m.emissiveIntensity].join('|');
    if (!byMat.has(key)) byMat.set(key, { m, list: [] });
    byMat.get(key).list.push(g);
  });
  const out = new THREE.Group();
  for (const { m, list } of byMat.values()) out.add(new THREE.Mesh(list.length > 1 ? mergeGeometries(list, false) : list[0], m));
  return out;
}
function standIn(name) { return bake(standInRaw(name)); }
function standInRaw(name) {
  const g = new THREE.Group();
  if (name.startsWith('player_')) {
    const pose = name.split('_')[1];
    return person(0x4f46e5, 0x7c3aed, pose === 'run' ? (name.endsWith('_a') ? 0.22 : -0.22) : 0, pose);
  }
  if (name.startsWith('inspector_')) {
    const p = person(0x1d4ed8, 0xfbbf24, name.endsWith('_a') ? 0.22 : -0.22, 'run');
    p.add(box(0.36, 0.12, 0.36, mat(0x1e3a8a), 0, 1.9, 0));
    return p;
  }
  if (name.startsWith('dog_')) return dog(name.endsWith('_a') ? 0.12 : -0.12);
  if (name.startsWith('obstacle_trolley')) {
    g.add(box(1.7, 0.5, 1.5, mat(name.endsWith('_a') ? 0xb91c1c : 0x9a3412), 0, 0.4, 0));
    g.add(box(1.7, 0.1, 1.5, mat(0x7f1d1d), 0, 0.7, 0));
    g.add(box(0.2, 0.2, 0.2, mat(0x222222), -0.7, 0.1, 0.5)); g.add(box(0.2, 0.2, 0.2, mat(0x222222), 0.7, 0.1, 0.5));
    return g;
  }
  if (name.startsWith('obstacle_beam')) {
    const y = mat(0xfbbf24), k = mat(0x1f2937);
    g.add(box(0.18, 1.3, 0.5, k, -0.95, 0.65, 0)); g.add(box(0.18, 1.3, 0.5, k, 0.95, 0.65, 0));
    g.add(box(2.1, 0.45, 0.6, y, 0, 1.08, 0));
    for (let i = 0; i < 6; i++) g.add(box(0.14, 0.46, 0.62, k, -0.85 + i * 0.34, 1.08, 0));
    return g;
  }
  if (name === 'coin') {
    const c = cyl(0.3, 0.3, 0.07, mat(0xfbbf24, { metalness: 0.9, roughness: 0.25 }), 0, 0, 0, 28);
    c.rotation.x = Math.PI / 2; g.add(c); return g;
  }
  if (name === 'track_segment') {
    g.add(box(7.8, 0.2, 12, mat(0x2b2f36), 0, 0.1, 0));
    for (const lx of [-2.4, 0, 2.4]) {
      g.add(box(0.1, 0.12, 12, mat(0x94a3b8, { metalness: 0.8, roughness: 0.4 }), lx - 0.55, 0.26, 0));
      g.add(box(0.1, 0.12, 12, mat(0x94a3b8, { metalness: 0.8, roughness: 0.4 }), lx + 0.55, 0.26, 0));
      for (let z = -5.7; z < 6; z += 0.6) g.add(box(1.5, 0.08, 0.22, mat(0x3f2d20), lx, 0.22, z));
    }
    return g;
  }
  if (name === 'tunnel_wall') {
    g.add(box(2.2, 7.0, 12, mat(0x3b4452), 0, 3.5, 0));
    g.add(box(0.2, 0.5, 12, mat(0xfbbf24), 1.0, 0.25, 0));
    return g;
  }
  if (name === 'tunnel_arch') {
    const m = mat(0x4b5563, { metalness: 0.3 });
    g.add(box(0.7, 7.2, 1.2, m, -4.45, 3.6, 0)); g.add(box(0.7, 7.2, 1.2, m, 4.45, 3.6, 0));
    g.add(box(9.6, 0.8, 1.2, m, 0, 6.8, 0));
    return g;
  }
  if (name === 'ceiling_lamp') {
    g.add(box(0.7, 0.12, 2.2, mat(0x222222), 0, 0.4, 0));
    g.add(box(0.5, 0.06, 2.0, new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xfff3c4, emissiveIntensity: 1.6 }), 0, 0.32, 0));
    return g;
  }
  if (name === 'signal_light') {
    g.add(cyl(0.05, 0.05, 2.8, mat(0x374151), 0, 1.4, 0, 8));
    g.add(ball(0.14, new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 2 }), 0, 2.6, 0.1));
    return g;
  }
  g.add(box(1, 1, 1, mat(0xff00ff), 0, 0.5, 0));       // unknown name → magenta cube
  return g;
}

/* ───────────── sizing: any model scale → the size in the config ───────────── */
function normalise(src, cfg) {
  const inner = src.clone(true);
  if (cfg.zUp) inner.rotation.x = -Math.PI / 2;
  else if (cfg.pitch) inner.rotation.x = THREE.MathUtils.degToRad(cfg.pitch);
  const yawHolder = new THREE.Group();
  yawHolder.rotation.y = THREE.MathUtils.degToRad(cfg.yaw || 0);
  yawHolder.add(inner);
  const holder = new THREE.Group(); holder.add(yawHolder);
  holder.updateMatrixWorld(true);

  const b0 = new THREE.Box3().setFromObject(holder), size = b0.getSize(new THREE.Vector3());
  const e = 1e-4, mul = cfg.scaleMul || 1;
  let sx, sy, sz;
  if (cfg.mode === 'box') { sx = cfg.width / Math.max(e, size.x); sy = cfg.height / Math.max(e, size.y); sz = cfg.depth / Math.max(e, size.z); }
  else if (cfg.max)       { sx = sy = sz = cfg.max / Math.max(e, size.x, size.y, size.z); }
  else                    { sx = sy = sz = cfg.height / Math.max(e, size.y); }
  holder.scale.set(sx * mul, sy * mul, sz * mul);
  holder.updateMatrixWorld(true);

  const b1 = new THREE.Box3().setFromObject(holder), c = b1.getCenter(new THREE.Vector3());
  holder.position.set(-c.x, cfg.center ? -c.y : -b1.min.y, -c.z);
  holder.position.y += cfg.yOffset || 0;
  const root = new THREE.Group(); root.add(holder);
  return root;
}

function tuneMaterials(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = true;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m) continue;
      if (m.map) m.map.anisotropy = 4;
      m.envMapIntensity = 0.6;
    }
  });
}

/* ───────────── public: load everything ───────────── */
export async function loadAssets(onProgress) {
  const loader = new GLTFLoader();
  const names = Object.keys(MODELS);
  const real = new Map(), standIns = new Map(), missing = [];
  let done = 0;

  await Promise.all(names.map(name => new Promise(resolve => {
    const cfg = MODELS[name];
    const finish = () => { done++; if (onProgress) onProgress(done / names.length, name); resolve(); };
    try {
      loader.load(ASSET_BASE + cfg.file,
        gltf => { try { const r = normalise(gltf.scene, cfg); tuneMaterials(r); real.set(name, r); } catch (e) { console.warn('[surfer] bad model', name, e); missing.push(name); } finish(); },
        undefined,
        () => { missing.push(name); finish(); });
    } catch (e) { missing.push(name); finish(); }
  })));

  for (const name of missing) {
    const cfg = { ...MODELS[name], yaw: 0, scaleMul: 1, yOffset: 0, zUp: false };
    const r = normalise(standIn(name), cfg); tuneMaterials(r); standIns.set(name, r);
  }

  return {
    realCount: real.size, total: names.length, missing,
    isReal: name => real.has(name),
    /* a fresh copy you can move/animate (geometry + materials are shared) */
    make(name) { const src = real.get(name) || standIns.get(name); return src ? src.clone(true) : new THREE.Group(); },
    dispose() {
      for (const m of [real, standIns]) for (const r of m.values()) r.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        for (const mm of (Array.isArray(o.material) ? o.material : [o.material])) { if (!mm) continue; for (const k in mm) if (mm[k] && mm[k].isTexture) mm[k].dispose(); mm.dispose(); }
      });
      real.clear(); standIns.clear();
    },
  };
}
