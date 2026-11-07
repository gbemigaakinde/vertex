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
import { MeshoptDecoder } from '../vector/lib/meshopt_decoder.module.js';
import { MODELS, ASSET_BASE, ASSET_VERSION } from './surfer-config.js';

export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...o });
export const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.set(x, y, z); return k; };
export const cyl = (rt, rb, h, m, x = 0, y = 0, z = 0, seg = 14) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); k.position.set(x, y, z); return k; };
export const ball = (r, m, x = 0, y = 0, z = 0) => { const k = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); k.position.set(x, y, z); return k; };

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
export function bake(group) {
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
  if (name === 'player_boat') return boatModel();
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
  if (name.startsWith('obstacle_train')) return trainModel(name.endsWith('_a') ? { body: 0x1f4f94, stripe: 0xf3f4f6, nose: 0xf5b800 } : { body: 0xa8232c, stripe: 0xf1e6cf, nose: 0x2b2f36 });
  if (name.startsWith('obstacle_hurdle')) return hurdleModel(name.endsWith('_a') ? [0xd9232b, 0xf5f5f5] : [0xf08a12, 0xf5f5f5]);
  if (name.startsWith('obstacle_gate')) return gateModel(name.endsWith('_a') ? [0xf5c400, 0x15181d] : [0xd9232b, 0xf5f5f5]);
  if (name.startsWith('obstacle_barge')) return bargeModel(name.endsWith('_a'));
  if (name.startsWith('obstacle_log')) return logModel(name.endsWith('_a'));
  if (name.startsWith('obstacle_bridge')) return bridgeModel(name.endsWith('_a'));
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


/* ───────────── realistic obstacle stand-ins ─────────────
   All are drawn FACING +z (toward the camera), because everything comes at the runner. */
const glowMat = (c, i = 2) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.4 });
const rot = (m, x = 0, y = 0, z = 0) => { m.rotation.set(x, y, z); return m; };

function trainModel({ body, stripe, nose }) {
  const g = new THREE.Group();
  const paint = mat(body, { roughness: 0.38, metalness: 0.35 }), white = mat(stripe, { roughness: 0.5 });
  const noseM = mat(nose, { roughness: 0.45, metalness: 0.2 }), dark = mat(0x14171c, { roughness: 0.55, metalness: 0.4 });
  const glass = mat(0x0a1824, { roughness: 0.08, metalness: 0.85 }), steel = mat(0x8b95a3, { roughness: 0.35, metalness: 0.85 });
  const L = 9, W = 1.9, F = L / 2;
  /* undercarriage + bogies */
  g.add(box(W - 0.2, 0.34, L - 0.3, dark, 0, 0.5, 0));
  for (const bz of [-2.9, 2.9]) {
    g.add(box(1.5, 0.22, 1.9, dark, 0, 0.36, bz));
    for (const ax of [-0.7, 0.7]) for (const sx of [-1, 1]) {
      const w = cyl(0.3, 0.3, 0.12, steel, sx * 0.72, 0.3, bz + ax, 20); w.rotation.z = Math.PI / 2; g.add(w);
      const hub = cyl(0.13, 0.13, 0.14, dark, sx * 0.72, 0.3, bz + ax, 10); hub.rotation.z = Math.PI / 2; g.add(hub);
    }
  }
  /* lower skirt, main shell, roof dome */
  g.add(box(W, 0.62, L, paint, 0, 0.98, 0));
  g.add(box(W, 1.75, L, paint, 0, 2.17, 0));
  g.add(box(W + 0.02, 0.1, L, white, 0, 1.33, 0));                       // belt line
  g.add(box(W - 0.2, 0.2, L, paint, 0, 3.12, 0));
  /* simpler roof: a flattened cylinder lying along z */
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, L, 24), white); roof.rotation.x = Math.PI / 2; roof.scale.set(1, 1, 0.22); roof.position.set(0, 3.2, 0); g.add(roof);
  /* side window band with pillars, doors */
  for (const sx of [-1, 1]) {
    g.add(box(0.03, 0.78, L - 0.8, glass, sx * (W / 2 + 0.005), 2.35, 0));
    for (let z = -F + 0.9; z < F - 0.6; z += 1.5) g.add(box(0.05, 0.84, 0.1, white, sx * (W / 2 + 0.01), 2.35, z));
    g.add(box(0.05, 1.5, 0.9, white, sx * (W / 2 + 0.01), 1.85, 0.0));
    g.add(box(0.06, 0.9, 0.84, glass, sx * (W / 2 + 0.02), 2.2, 0.0));
    g.add(box(0.04, 0.12, L - 0.2, white, sx * (W / 2 + 0.008), 1.62, 0));
  }
  /* FRONT FACE (what the player sees): cab, windscreen, lights, coupler */
  g.add(box(W, 1.75, 0.18, noseM, 0, 2.17, F));                           // front mask
  g.add(box(W, 0.62, 0.22, noseM, 0, 0.98, F + 0.02));
  g.add(box(W - 0.3, 0.72, 0.1, glass, 0, 2.55, F + 0.1));                // windscreen
  g.add(box(0.1, 0.78, 0.14, dark, 0, 2.55, F + 0.12));                   // centre pillar
  g.add(box(W - 0.2, 0.06, 0.14, dark, 0, 2.93, F + 0.1));
  g.add(box(W - 0.2, 0.06, 0.14, dark, 0, 2.18, F + 0.1));
  for (const sx of [-1, 1]) {
    g.add(rot(box(0.42, 0.04, 0.05, dark, sx * 0.4, 2.35, F + 0.19), 0, 0, sx * -0.55));   // wipers
    g.add(box(0.3, 0.22, 0.1, glowMat(0xfff4cc, 3), sx * 0.66, 1.18, F + 0.14));           // headlights
    g.add(box(0.14, 0.12, 0.08, glowMat(0xff2a1a, 2), sx * 0.34, 1.18, F + 0.14));         // marker lights
    g.add(box(0.2, 0.28, 0.5, steel, sx * 0.55, 0.62, F + 0.36)); g.add(rot(cyl(0.12, 0.12, 0.06, steel, sx * 0.55, 0.62, F + 0.64, 14), Math.PI / 2));   // buffers
  }
  g.add(box(0.44, 0.22, 0.04, mat(0xf2f2f2), 0, 1.5, F + 0.13));          // number plate
  g.add(box(0.36, 0.14, 0.05, dark, 0, 1.5, F + 0.15));
  g.add(box(1.5, 0.12, 0.34, dark, 0, 0.42, F + 0.3));                    // cow-catcher
  g.add(rot(cyl(0.07, 0.07, 0.45, steel, 0, 0.55, F + 0.45, 10), Math.PI / 2));   // coupler
  for (let i = 0; i < 7; i++) g.add(box(0.2, 0.05, 0.05, i % 2 ? white : glowMat(0xffd400, 0.6), -0.6 + i * 0.2, 0.78, F + 0.16));   // hazard stripe
  /* roof gear */
  for (const z of [-2.4, 0.6, 3.0]) g.add(box(0.9, 0.22, 1.1, mat(0xaeb6c2, { metalness: 0.5 }), 0, 3.4, z));
  g.add(box(0.06, 0.06, 1.6, dark, 0, 3.35, -0.9));
  g.add(rot(box(0.05, 0.6, 0.05, dark, 0, 3.55, -1.1), 0.5, 0, 0)); g.add(rot(box(0.05, 0.6, 0.05, dark, 0, 3.55, -1.7), -0.5, 0, 0));
  g.add(box(1.1, 0.05, 0.12, dark, 0, 3.82, -1.4));
  return g;
}

function stripedBoard(w, h, d, colors, bands, x, y, z, vertical = false) {
  const g = new THREE.Group(); const n = bands;
  for (let i = 0; i < n; i++) {
    const m = mat(colors[i % 2], { roughness: 0.55 });
    g.add(vertical ? box(w / n, h, d, m, x - w / 2 + (i + 0.5) * w / n, y, z) : box(w, h / n, d, m, x, y - h / 2 + (i + 0.5) * h / n, z));
  }
  return g;
}
function hurdleModel([c1, c2]) {
  const g = new THREE.Group(), leg = mat(0x2a2f38, { metalness: 0.5, roughness: 0.5 });
  for (const sx of [-1, 1]) {
    g.add(rot(box(0.07, 0.86, 0.07, leg, sx * 0.78, 0.4, 0.28), -0.32, 0, 0));
    g.add(rot(box(0.07, 0.86, 0.07, leg, sx * 0.78, 0.4, -0.28), 0.32, 0, 0));
    g.add(box(0.12, 0.05, 0.9, leg, sx * 0.78, 0.03, 0));
    g.add(ball(0.09, glowMat(0xffa200, 2.4), sx * 0.78, 0.86, 0));                     // amber warning lamp
  }
  for (const y of [0.3, 0.52, 0.74]) g.add(stripedBoard(1.8, 0.16, 0.05, [c1, c2], 8, 0, y, 0, true));
  g.add(box(1.82, 0.03, 0.07, mat(0xffffff), 0, 0.22, 0)); 
  return g;
}
function gateModel([c1, c2]) {
  const g = new THREE.Group(), steel = mat(0x4d5662, { metalness: 0.7, roughness: 0.4 }), dark = mat(0x1a1d22, { metalness: 0.4 });
  for (const sx of [-1, 1]) {
    g.add(box(0.14, 1.7, 0.2, steel, sx * 1.0, 0.85, 0));
    g.add(box(0.3, 0.06, 0.4, dark, sx * 1.0, 0.03, 0));
    g.add(box(0.18, 0.18, 0.22, glowMat(0xff2a1a, 2.4), sx * 1.0, 1.78 - 0.09, 0.0));   // red beacons
    g.add(rot(box(0.05, 0.35, 0.05, steel, sx * 0.9, 0.3, 0), 0, 0, sx * 0.7));         // braces
  }
  g.add(box(2.1, 0.14, 0.24, steel, 0, 1.6, 0));                                         // top girder
  g.add(box(1.84, 0.74, 0.07, mat(0x101216), 0, 1.17, 0));                               // sign backing
  g.add(stripedBoard(1.76, 0.66, 0.08, [c1, c2], 8, 0, 1.17, 0.02));                     // hazard bands
  g.add(box(1.86, 0.06, 0.1, mat(0xe8eaee, { metalness: 0.3 }), 0, 0.82, 0.02));         // reflective lower edge
  for (const sx of [-1, 1]) { g.add(cyl(0.012, 0.012, 0.3, steel, sx * 0.9, 1.42, 0.0, 6)); }
  return g;
}
function bargeModel(containers) {
  const g = new THREE.Group(), hull = mat(containers ? 0x2b3a4a : 0x9c2a22, { roughness: 0.5, metalness: 0.4 }), dark = mat(0x15181d), deck = mat(0x59626e, { roughness: 0.7 });
  const L = 9, F = L / 2;
  g.add(box(2.0, 0.9, L - 1.2, hull, 0, 0.45, -0.6));
  const bow = box(2.0, 0.9, 1.7, hull, 0, 0.45, F - 0.85); g.add(bow);                    // blunt, raked bow
  g.add(rot(box(1.9, 0.9, 1.5, hull, 0, 0.5, F - 0.15), -0.55, 0, 0));
  g.add(box(2.02, 0.12, L, mat(0xf4f4f4), 0, 0.95, 0));                                   // gunwale
  g.add(box(2.02, 0.16, L, mat(0x101216), 0, 0.12, 0));                                   // waterline
  g.add(box(1.8, 0.04, L - 0.3, deck, 0, 1.02, 0));
  if (containers) {
    const cols = [0xc2410c, 0x1d6fb8, 0xfacc15, 0x15803d, 0xb91c1c, 0x7c3aed];
    let k = 0;
    for (const z of [2.2, -0.2, -2.6]) { for (const y of [0, 1]) {
      const m = mat(cols[(k++) % cols.length], { roughness: 0.6 });
      g.add(box(1.7, 0.62, 2.1, m, 0, 1.36 + y * 0.64, z));
      for (let i = 0; i < 6; i++) g.add(box(0.03, 0.6, 2.1, mat(0x000000, { roughness: 0.9 }), -0.8 + i * 0.32, 1.36 + y * 0.64, z));
    } }
  } else {
    g.add(box(1.5, 1.0, 2.2, mat(0xf3f4f6), 0, 1.55, -3.0));                              // wheelhouse
    g.add(box(1.52, 0.34, 1.6, mat(0x0a1824, { metalness: 0.8, roughness: 0.1 }), 0, 1.72, -2.9));
    g.add(box(1.7, 0.1, 2.4, mat(0xd9232b), 0, 2.1, -3.0));
    g.add(cyl(0.2, 0.24, 0.8, mat(0xd9232b), 0, 2.2, -3.8, 14));
    g.add(cyl(0.25, 0.25, 0.1, dark, 0, 2.62, -3.8, 14));
    for (let i = 0; i < 5; i++) g.add(box(1.3, 0.5, 0.5, mat(0x8a5a2b), -0.0, 1.3 + (i % 2) * 0.5, 2.6 - i * 0.7));    // timber crates
  }
  g.add(ball(0.12, glowMat(0xffffff, 3), 0, 1.6, F - 0.4));    // bow lamp
  g.add(ball(0.1, glowMat(0xff3b30, 2.4), -0.8, 1.15, F - 0.2)); g.add(ball(0.1, glowMat(0x38e060, 2.4), 0.8, 1.15, F - 0.2));
  for (const z of [3.4, 1.0, -1.4]) for (const sx of [-1, 1]) g.add(cyl(0.07, 0.09, 0.22, dark, sx * 0.9, 1.1, z, 8));
  return g;
}
function logModel(logs) {
  const g = new THREE.Group(), bark = mat(0x6b4423, { roughness: 0.95 }), cut = mat(0xc9a06a, { roughness: 0.8 }), rope = mat(0xd8c9a3, { roughness: 0.9 });
  if (logs) {
    for (const [y, z] of [[0.24, 0.22], [0.24, -0.22], [0.64, 0]]) {
      const l = cyl(0.23, 0.23, 2.0, bark, 0, y, z, 12); l.rotation.z = Math.PI / 2; g.add(l);
      for (const sx of [-1, 1]) { const e = cyl(0.2, 0.2, 0.02, cut, sx * 1.01, y, z, 12); e.rotation.z = Math.PI / 2; g.add(e); }
    }
    for (const x of [-0.6, 0.6]) g.add(box(0.07, 0.95, 0.74, rope, x, 0.45, 0));
  } else {
    g.add(box(1.9, 0.1, 0.9, mat(0x8a5a2b, { roughness: 0.9 }), 0, 0.12, 0));
    for (let i = 0; i < 6; i++) g.add(box(0.3, 0.04, 0.9, mat(0x6e4520), -0.8 + i * 0.32, 0.18, 0));
    for (const [x, z] of [[-0.55, 0], [0.0, 0.0], [0.55, 0]]) {
      g.add(cyl(0.26, 0.26, 0.72, mat(x === 0 ? 0xd9232b : 0x1d6fb8, { metalness: 0.4, roughness: 0.5 }), x, 0.56, z, 16));
      g.add(cyl(0.27, 0.27, 0.05, mat(0xe5e7eb, { metalness: 0.7 }), x, 0.94, z, 16));
    }
    g.add(ball(0.09, glowMat(0xffa200, 2.4), 0.8, 1.02, 0.3));
  }
  return g;
}
function bridgeModel(wood) {
  const g = new THREE.Group(), post = mat(wood ? 0x6b4423 : 0x58606c, { roughness: 0.9 }), plank = mat(wood ? 0x9a6b3a : 0x7b8594, { roughness: 0.85 }), rail = mat(wood ? 0x7a5128 : 0x4b5563, { roughness: 0.8 });
  for (const sx of [-1, 1]) for (const sz of [-0.25, 0.25]) g.add(box(0.16, 1.7, 0.16, post, sx * 1.02, 0.85, sz));
  g.add(box(2.2, 0.12, 0.7, plank, 0, 0.84, 0));                                          // underside of the deck (what you slide under)
  g.add(box(2.2, 0.06, 0.7, rail, 0, 0.93, 0));
  for (const sz of [-0.3, 0.3]) { g.add(box(2.2, 0.08, 0.07, rail, 0, 1.62, sz)); g.add(box(2.2, 0.06, 0.06, rail, 0, 1.2, sz)); }
  for (let x = -0.85; x <= 0.86; x += 0.34) for (const sz of [-0.3, 0.3]) g.add(box(0.06, 0.7, 0.06, rail, x, 1.28, sz));
  for (const sx of [-1, 1]) g.add(ball(0.1, glowMat(wood ? 0xffa200 : 0xff2a1a, 2.4), sx * 1.02, 1.74, 0.0));
  return g;
}
function boatModel() {
  const g = new THREE.Group();
  const hullM = mat(0x8a4b22, { roughness: 0.7, side: THREE.DoubleSide }), inner = mat(0xc79a62, { roughness: 0.8 }), rim = mat(0xe8c48a, { roughness: 0.6 }), stripe = mat(0x1d6fb8, { roughness: 0.5 });
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), hullM); hull.scale.set(0.62, 0.5, 1.4); hull.position.y = 0.5; g.add(hull);
  const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 8, 44), rim); r.rotation.x = Math.PI / 2; r.scale.set(0.62, 1.4, 1); r.position.y = 0.5; g.add(r);
  const st = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 44), stripe); st.rotation.x = Math.PI / 2; st.scale.set(0.595, 1.34, 1); st.position.y = 0.4; g.add(st);
  g.add(box(0.8, 0.04, 1.6, inner, 0, 0.18, 0));
  g.add(box(1.0, 0.05, 0.22, rim, 0, 0.42, 0.45)); g.add(box(1.0, 0.05, 0.22, rim, 0, 0.42, -0.5));
  g.add(rot(box(0.05, 0.05, 1.5, rim, 0.5, 0.62, -0.1), 0.0, 0.18, 0));      // paddle shaft
  g.add(rot(box(0.18, 0.02, 0.34, rim, 0.54, 0.62, -0.85), 0, 0.18, 0));
  return g;
}

/* ───────────── sizing: any model scale → the size in the config ───────────── */
function normalise(src, cfg) {
  const inner = src.clone(true);
  if (cfg.zUp) inner.rotation.x = -Math.PI / 2;
  else if (cfg.pitch) inner.rotation.x = THREE.MathUtils.degToRad(cfg.pitch);
  if (cfg.roll) inner.rotation.z = THREE.MathUtils.degToRad(cfg.roll);
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

/* ───────────── downloading + caching ─────────────
   Each .glb is fetched ONE time, then kept in the browser's Cache Storage.
   Next visit: no network request at all. The cache name starts with "vb-models-"
   so sw.js never deletes it when Vertex updates. If the browser has no Cache
   Storage (private mode, full disk) the game still works, it just downloads again. */
const CACHE_NAME = 'vb-models-surfer-v1';
const GLB_MAGIC = 0x46546c67;                       // "glTF"

async function openCache() { try { return globalThis.caches ? await caches.open(CACHE_NAME) : null; } catch { return null; } }

/* delete copies of models saved under an older ASSET_VERSION */
async function purgeOld(cache, keepUrls) {
  try { for (const req of await cache.keys()) if (!keepUrls.has(req.url)) await cache.delete(req); } catch { /* ignore */ }
}

async function fetchModel(file, cache) {
  const url = new URL(ASSET_BASE + file + '?v=' + ASSET_VERSION, location.href).href;
  if (cache) {
    try {
      const hit = await cache.match(url);
      if (hit) { const buf = await hit.arrayBuffer(); if (isGlb(buf)) return { buf, url, cached: true }; await cache.delete(url); }
    } catch { /* fall through to network */ }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = await res.arrayBuffer();
  if (!isGlb(buf)) throw new Error('not a .glb (the site returned a web page instead)');
  if (cache) { try { await cache.put(url, new Response(buf.slice(0), { headers: { 'content-type': 'model/gltf-binary' } })); } catch { /* storage full: fine */ } }
  return { buf, url, cached: false };
}
function isGlb(buf) { return buf && buf.byteLength > 20 && new DataView(buf).getUint32(0, true) === GLB_MAGIC; }

/* ───────────── public: load everything ───────────── */
export async function loadAssets(onProgress) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);          // models are meshopt-compressed (tiny files)
  const cache = await openCache();
  const names = Object.keys(MODELS);
  const real = new Map(), standIns = new Map(), missing = [];
  const stats = { fromCache: 0, fromNetwork: 0, bytesDownloaded: 0 };
  let done = 0;

  /* several poses can share ONE file: download/parse each file only once */
  const files = new Map();
  const getFile = file => {
    if (!files.has(file)) files.set(file, fetchModel(file, cache).then(async r => {
      const gltf = await loader.parseAsync(r.buf, '');
      if (r.cached) stats.fromCache++; else { stats.fromNetwork++; stats.bytesDownloaded += r.buf.byteLength; }
      return { gltf, url: r.url };
    }));
    return files.get(file);
  };

  await Promise.all(names.map(async name => {
    const cfg = MODELS[name];
    try { const { gltf } = await getFile(cfg.file); const r = normalise(gltf.scene, cfg); tuneMaterials(r); real.set(name, r); }
    catch (e) { missing.push(name); }
    done++; if (onProgress) onProgress(done / names.length, name);
  }));

  if (cache) {
    const keep = new Set();
    for (const f of new Set(names.map(n => MODELS[n].file))) keep.add(new URL(ASSET_BASE + f + '?v=' + ASSET_VERSION, location.href).href);
    purgeOld(cache, keep);
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { /* optional */ }

  for (const name of missing) {
    const cfg = { ...MODELS[name], yaw: 0, roll: 0, pitch: 0, scaleMul: 1, yOffset: 0, zUp: false };
    const r = normalise(standIn(name), cfg); tuneMaterials(r); standIns.set(name, r);
  }

  return {
    realCount: real.size, total: names.length, missing, stats,
    isReal: name => real.has(name),
    /* a fresh copy you can move/animate (geometry + materials are shared) */
    make(name) { const src = real.get(name) || standIns.get(name); return src ? src.clone(true) : new THREE.Group(); },
    dispose() {
      /* geometry/materials are shared between poses, so dispose each only once */
      const seen = new Set();
      for (const m of [real, standIns]) for (const r of m.values()) r.traverse(o => {
        if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
        for (const mm of (Array.isArray(o.material) ? o.material : [o.material])) {
          if (!mm || seen.has(mm)) continue; seen.add(mm);
          for (const k in mm) if (mm[k] && mm[k].isTexture) mm[k].dispose();
          mm.dispose();
        }
      });
      real.clear(); standIns.clear();
    },
  };
}
