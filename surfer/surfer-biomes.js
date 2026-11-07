/* ============================================================
   surfer/surfer-biomes.js   |   KNOWLEDGE SURFER 3D — zone scenery

   Builds the look of every zone (desert, forest, river, snow).
   Each zone has 3 hand-built "tile variants" (12 m long). The engine
   picks one per tile, so the scenery never looks copy-pasted.
   Everything is baked into a handful of meshes (cheap on phones).

   Rail zones  (desert / forest / snow): ground + telegraph poles + scenery,
                                         the rails themselves come from track_segment.
   River zone  : animated water, banks, reeds, lily pads. NO rails: the runner
                 rides a boat.
   The tunnel ("station") look is built in surfer-engine.js from the tunnel models.
   ============================================================ */
import * as THREE from '../vector/lib/three.module.js';
import { bake } from './surfer-assets.js';

const TILE = 12;
const VARIANTS = 3;

const seeded = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

function canvasTex(size, draw, repeatX, repeatY) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatX, repeatY); t.anisotropy = 4;
  return t;
}
/* draw something so it wraps around the texture edges (tileable) */
function wrapDraw(g, size, x, y, r, fn) {
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
    if (x + ox + r < 0 || x + ox - r > size || y + oy + r < 0 || y + oy - r > size) continue;
    fn(x + ox, y + oy);
  }
}
function noiseTex(base, specks, repeatX, repeatY, count = 900, rmax = 3) {
  const rnd = seeded(11);
  return canvasTex(256, (g, S) => {
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    for (let i = 0; i < count; i++) {
      const x = rnd() * S, y = rnd() * S, r = 0.6 + rnd() * rmax, col = specks[Math.floor(rnd() * specks.length)];
      wrapDraw(g, S, x, y, r, (px, py) => { g.fillStyle = col; g.beginPath(); g.arc(px, py, r, 0, 6.3); g.fill(); });
    }
  }, repeatX, repeatY);
}
function sandTex() {
  const rnd = seeded(5);
  return canvasTex(256, (g, S) => {
    g.fillStyle = '#d9b876'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 700; i++) {
      const x = rnd() * S, y = rnd() * S, r = 0.5 + rnd() * 1.8;
      wrapDraw(g, S, x, y, r, (px, py) => { g.fillStyle = rnd() < 0.5 ? '#c9a45f' : '#ebcf94'; g.beginPath(); g.arc(px, py, r, 0, 6.3); g.fill(); });
    }
    g.lineWidth = 2;
    for (let i = 0; i < 14; i++) {                                  // wind ripples
      const y = (i / 14) * S + rnd() * 10, a = 3 + rnd() * 3, ph = rnd() * 6;
      g.strokeStyle = i % 2 ? 'rgba(140,100,45,.28)' : 'rgba(255,240,200,.3)';
      g.beginPath(); for (let x = 0; x <= S; x += 8) { const yy = y + Math.sin(x / S * 6.28 * 2 + ph) * a; if (x) g.lineTo(x, yy); else g.moveTo(x, yy); } g.stroke();
    }
  }, 5, 2);
}
function waterTex() {
  const rnd = seeded(9);
  return canvasTex(256, (g, S) => {
    const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, '#2a85ad'); gr.addColorStop(1, '#2377a0');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 46; i++) {
      const x = rnd() * S, y = rnd() * S, w = 18 + rnd() * 38, light = rnd() < 0.6;
      g.strokeStyle = light ? 'rgba(210,240,255,.34)' : 'rgba(10,50,90,.28)'; g.lineWidth = 1.5 + rnd() * 1.5;
      wrapDraw(g, S, x, y, w, (px, py) => { g.beginPath(); g.moveTo(px - w / 2, py); g.quadraticCurveTo(px, py - 4 - rnd() * 3, px + w / 2, py); g.stroke(); });
    }
  }, 4, 3);
}

export function createBiomeKit() {
  const textures = [], geos = new Set();
  const track = t => { textures.push(t); return t; };
  const mcache = new Map();
  const M = (color, o = {}) => {
    const k = color + JSON.stringify(o);
    if (!mcache.has(k)) mcache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.02, flatShading: true, ...o }));
    return mcache.get(k);
  };
  const add = (g, geo, m, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
    const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); k.scale.set(sx, sy, sz); k.rotation.set(rx, ry, rz); g.add(k); return k;
  };
  const G = {
    cone: n => new THREE.ConeGeometry(1, 1, n),
    cyl: (n = 8) => new THREE.CylinderGeometry(1, 1, 1, n),
    ico: new THREE.IcosahedronGeometry(1, 0),
    sph: new THREE.SphereGeometry(1, 10, 8),
    box: new THREE.BoxGeometry(1, 1, 1),
  };

  /* ground slab: made OUTSIDE bake() because it carries a texture */
  const sandMap = track(sandTex());
  const grassMap = track(noiseTex('#3d6b34', ['#2f5a2b', '#4d8040', '#365f30', '#5b8f46'], 6, 2, 1100, 2.4));
  const snowMap = track(noiseTex('#eef4fa', ['#dbe7f3', '#ffffff', '#cfdceb'], 5, 2, 800, 2.6));
  const bankMap = track(noiseTex('#6f9a52', ['#5b8744', '#82ac60', '#8a7a4e'], 4, 2, 800, 2.4));
  const waterMap = track(waterTex());
  const groundMats = {
    desert: new THREE.MeshStandardMaterial({ map: sandMap, roughness: 1 }),
    forest: new THREE.MeshStandardMaterial({ map: grassMap, roughness: 1 }),
    snow:   new THREE.MeshStandardMaterial({ map: snowMap, roughness: 0.85 }),
    bank:   new THREE.MeshStandardMaterial({ map: bankMap, roughness: 1 }),
    water:  new THREE.MeshStandardMaterial({ map: waterMap, color: 0xffffff, roughness: 0.16, metalness: 0.15, transparent: true, opacity: 0.94 }),
  };
  const groundGeo = new THREE.PlaneGeometry(46, TILE); groundGeo.rotateX(-Math.PI / 2);
  const bankGeo = new THREE.PlaneGeometry(20, TILE); bankGeo.rotateX(-Math.PI / 2);
  const waterGeo = new THREE.PlaneGeometry(15, TILE); waterGeo.rotateX(-Math.PI / 2);
  geos.add(groundGeo); geos.add(bankGeo); geos.add(waterGeo);
  const slab = (geo, mat, x, y) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, 0); m.receiveShadow = false; return m; };

  /* ───── props ───── */
  const rnd01 = (r, a, b) => a + (b - a) * r();
  const pick = (r, a) => a[Math.floor(r() * a.length)];

  function pole(g, x, z) {                                       // telegraph / power pole beside the track
    const wood = M(0x5a4030), dark = M(0x2b2f36);
    add(g, G.cyl(6), wood, x, 2.6, z, 0.07, 5.2, 0.07);
    add(g, G.box, wood, x, 4.85, z, 0.08, 0.08, 1.0, 0, 0, 0).scale.set(1.1, 0.08, 0.08);
    for (const dx of [-0.45, 0.45]) add(g, G.cyl(6), M(0xbfe3e0, { roughness: 0.3 }), x + dx, 4.98, z, 0.035, 0.12, 0.035);
    add(g, G.box, dark, x, 4.4, z, 0.5, 0.05, 0.05);
  }
  function cactus(g, r, x, z) {
    const gm = M(pick(r, [0x4f8a3a, 0x5a9440, 0x467f35])), h = rnd01(r, 1.6, 3.0);
    add(g, G.cyl(8), gm, x, h / 2, z, 0.22, h, 0.22);
    add(g, G.sph, gm, x, h, z, 0.22, 0.22, 0.22);
    for (const s of [-1, 1]) if (r() < 0.75) {
      const ah = rnd01(r, 0.5, 1.0), ay = h * rnd01(r, 0.35, 0.6);
      add(g, G.cyl(8), gm, x + s * 0.4, ay, z, 0.4, 0.12, 0.12).rotation.z = Math.PI / 2;
      add(g, G.cyl(8), gm, x + s * 0.6, ay + ah / 2, z, 0.12, ah, 0.12);
      add(g, G.sph, gm, x + s * 0.6, ay + ah, z, 0.12, 0.12, 0.12);
    }
  }
  function rock(g, r, x, z, col, big = 1) {
    const s = rnd01(r, 0.4, 1.3) * big;
    add(g, G.ico, M(col), x, s * 0.35, z, s * rnd01(r, 0.9, 1.6), s * rnd01(r, 0.6, 1.0), s * rnd01(r, 0.9, 1.4), r() * 3, r() * 3, r() * 3);
  }
  function pine(g, r, x, z, snowy) {
    const h = rnd01(r, 3.0, 6.5), tr = M(0x5b3d26), leaf = M(pick(r, snowy ? [0x2f5d46, 0x35684e] : [0x2b5a2f, 0x2f6633, 0x25502b, 0x356d36]));
    add(g, G.cyl(6), tr, x, 0.6, z, 0.16, 1.2, 0.16);
    const layers = 4;
    for (let i = 0; i < layers; i++) {
      const t = i / layers, rad = (1.25 - t * 0.85) * (h / 5.2), ly = 0.9 + t * h * 0.78, lh = h * 0.36;
      add(g, G.cone(8), leaf, x, ly + lh / 2, z, rad, lh, rad, 0, i * 0.7, 0);
      if (snowy) add(g, G.cone(8), M(0xf3f8fc, { roughness: 0.7 }), x, ly + lh * 0.62, z, rad * 0.8, lh * 0.55, rad * 0.8, 0, i * 0.7, 0);
    }
  }
  function broadleaf(g, r, x, z, col) {
    const h = rnd01(r, 2.0, 3.6), c = M(col ?? pick(r, [0x3f7d3a, 0x4a8c3f, 0x5a9a44, 0x35702f]));
    add(g, G.cyl(7), M(0x5b3d26), x, h / 2, z, 0.2, h, 0.2);
    for (let i = 0; i < 4; i++) { const s = rnd01(r, 1.1, 1.9); add(g, G.ico, c, x + rnd01(r, -0.9, 0.9), h + rnd01(r, 0.1, 1.2), z + rnd01(r, -0.9, 0.9), s, s * 0.85, s, r(), r(), r()); }
  }
  function bush(g, r, x, z, col) { const s = rnd01(r, 0.45, 0.9); add(g, G.ico, M(col), x, s * 0.5, z, s * 1.3, s, s * 1.1, r(), r(), r()); }
  function mountain(g, r, x, z, col, snowCap) {
    const h = rnd01(r, 9, 20), rad = rnd01(r, 8, 15);
    add(g, G.cone(6), M(col), x, h / 2 - 0.5, z, rad, h, rad, 0, r() * 3, 0);
    if (snowCap) add(g, G.cone(6), M(0xf2f6fb, { roughness: 0.7 }), x, h * 0.82 - 0.5, z, rad * 0.36, h * 0.38, rad * 0.36, 0, 0, 0);
  }
  function mesa(g, r, x, z) {
    const h = rnd01(r, 6, 12), w = rnd01(r, 5, 8);
    add(g, new THREE.CylinderGeometry(0.8, 1, 1, 7), M(0xb9633a), x, h / 2 - 0.4, z, w, h, w * 0.9, 0, r() * 3, 0);
    add(g, new THREE.CylinderGeometry(0.82, 0.82, 1, 7), M(0xd08a55), x, h * 0.7, z, w * 0.88, h * 0.12, w * 0.8, 0, 0, 0);
    add(g, new THREE.CylinderGeometry(0.8, 0.8, 1, 7), M(0x9d4f2f), x, h * 0.35, z, w * 0.93, h * 0.1, w * 0.84, 0, 0, 0);
  }
  function reeds(g, r, x, z) {
    for (let i = 0; i < 9; i++) {
      const h = rnd01(r, 0.8, 1.7), rx = x + rnd01(r, -0.45, 0.45), rz = z + rnd01(r, -0.45, 0.45);
      add(g, G.cyl(4), M(0x7a9a3a), rx, h / 2, rz, 0.025, h, 0.025, rnd01(r, -0.15, 0.15), 0, rnd01(r, -0.15, 0.15));
      if (r() < 0.5) add(g, G.cyl(5), M(0x6b4423), rx, h + 0.08, rz, 0.05, 0.28, 0.05);       // cattail
    }
  }
  function lily(g, r, x, z) {
    add(g, new THREE.CylinderGeometry(1, 1, 1, 12), M(0x3f8a45, { side: THREE.DoubleSide }), x, 0.075, z, 0.34, 0.02, 0.34);
    if (r() < 0.45) add(g, G.sph, M(pick(r, [0xf9a8d4, 0xffffff, 0xfde68a])), x, 0.13, z, 0.1, 0.07, 0.1);
  }
  function dockPost(g, x, z) {
    add(g, G.cyl(7), M(0x5b4028), x, 0.5, z, 0.11, 1.5, 0.11);
    add(g, G.cyl(7), M(0x2b2f36), x, 1.28, z, 0.12, 0.05, 0.12);
  }
  function drift(g, r, x, z) {                                      // snow drift
    const s = rnd01(r, 0.8, 2.0); add(g, G.sph, M(0xffffff, { roughness: 0.9 }), x, 0.0, z, s * 1.6, s * 0.45, s, 0, r() * 3, 0);
  }
  function log(g, r, x, z) {
    add(g, G.cyl(8), M(0x6b4423), x, 0.22, z, 0.22, rnd01(r, 1.6, 2.8), 0.22, 0, 0, 0).rotation.set(Math.PI / 2, 0, r() * 2.5);
  }

  /* ───── tile builders ───── */
  const sideX = (r, a, b) => (r() < 0.5 ? -1 : 1) * rnd01(r, a, b);

  const builders = {
    desert(r) {
      const g = new THREE.Group(), deco = new THREE.Group();
      for (let i = 0; i < 5; i++) cactus(deco, r, sideX(r, 6, 17), rnd01(r, -5.5, 5.5));
      for (let i = 0; i < 7; i++) rock(deco, r, sideX(r, 5.6, 22), rnd01(r, -6, 6), pick(r, [0xb07848, 0xa06a3e, 0xc08a58, 0x8f5e38]), r() < 0.2 ? 2.2 : 1);
      for (let i = 0; i < 5; i++) bush(deco, r, sideX(r, 5.8, 20), rnd01(r, -6, 6), pick(r, [0x8a8a4a, 0x7a7a3c, 0x9a8a4e]));
      for (const s of [-1, 1]) add(deco, G.sph, M(0xe0be7c, { flatShading: false }), s * rnd01(r, 18, 28), -2.0, rnd01(r, -4, 4), rnd01(r, 9, 14), rnd01(r, 3.2, 5), rnd01(r, 6, 9));
      for (const s of [-1, 1]) if (r() < 0.45) mesa(deco, r, s * rnd01(r, 30, 44), rnd01(r, -4, 4));
      if (r() < 0.8) pole(deco, r() < 0.5 ? -4.7 : 4.7, rnd01(r, -3, 3));
      g.add(slab(groundGeo, groundMats.desert, 0, -0.012)); g.add(bake(deco)); return g;
    },
    forest(r) {
      const g = new THREE.Group(), deco = new THREE.Group();
      for (let i = 0; i < 8; i++) pine(deco, r, sideX(r, 5.9, 20), rnd01(r, -6, 6), false);
      for (let i = 0; i < 3; i++) broadleaf(deco, r, sideX(r, 6.2, 16), rnd01(r, -6, 6));
      for (let i = 0; i < 7; i++) bush(deco, r, sideX(r, 5.5, 14), rnd01(r, -6, 6), pick(r, [0x2f6a30, 0x3d7a37, 0x4a6e2c]));
      for (let i = 0; i < 3; i++) rock(deco, r, sideX(r, 5.8, 16), rnd01(r, -6, 6), pick(r, [0x6b7a68, 0x7a8576]));
      if (r() < 0.5) log(deco, r, sideX(r, 6, 10), rnd01(r, -4, 4));
      for (const s of [-1, 1]) mountain(deco, r, s * rnd01(r, 30, 46), rnd01(r, -4, 4), pick(r, [0x35553a, 0x2f4e3a, 0x3c5c40]), false);
      if (r() < 0.6) pole(deco, r() < 0.5 ? -4.7 : 4.7, rnd01(r, -3, 3));
      g.add(slab(groundGeo, groundMats.forest, 0, -0.012)); g.add(bake(deco)); return g;
    },
    snow(r) {
      const g = new THREE.Group(), deco = new THREE.Group();
      for (let i = 0; i < 7; i++) pine(deco, r, sideX(r, 5.9, 19), rnd01(r, -6, 6), true);
      for (let i = 0; i < 5; i++) drift(deco, r, sideX(r, 5.4, 15), rnd01(r, -6, 6));
      for (let i = 0; i < 4; i++) rock(deco, r, sideX(r, 6, 18), rnd01(r, -6, 6), pick(r, [0x9fb0c4, 0xb4c3d4, 0x8797ab]));
      for (const s of [-1, 1]) mountain(deco, r, s * rnd01(r, 28, 44), rnd01(r, -4, 4), pick(r, [0x8da0b6, 0x7b8fa8, 0x9aaec4]), true);
      if (r() < 0.6) pole(deco, r() < 0.5 ? -4.7 : 4.7, rnd01(r, -3, 3));
      g.add(slab(groundGeo, groundMats.snow, 0, -0.012)); g.add(bake(deco)); return g;
    },
    river(r) {
      const g = new THREE.Group(), deco = new THREE.Group();
      g.add(slab(waterGeo, groundMats.water, 0, 0.06));
      for (const s of [-1, 1]) g.add(slab(bankGeo, groundMats.bank, s * (7.5 + 10), 0.2));
      for (const s of [-1, 1]) add(deco, G.box, M(0x8a7a52, { flatShading: false }), s * 7.55, 0.1, 0, 0.5, 0.26, TILE);           // muddy bank edge
      for (let i = 0; i < 4; i++) reeds(deco, r, sideX(r, 6.6, 7.6), rnd01(r, -5.5, 5.5));
      for (let i = 0; i < 4; i++) broadleaf(deco, r, sideX(r, 9, 20), rnd01(r, -6, 6), pick(r, [0x3f7d3a, 0x5a9a44, 0x6aa84a]));
      for (let i = 0; i < 3; i++) pine(deco, r, sideX(r, 11, 24), rnd01(r, -6, 6), false);
      for (let i = 0; i < 5; i++) bush(deco, r, sideX(r, 8.2, 16), rnd01(r, -6, 6), pick(r, [0x3d7a37, 0x4a8a3e]));
      for (let i = 0; i < 3; i++) rock(deco, r, sideX(r, 6.3, 7.4), rnd01(r, -6, 6), pick(r, [0x7a8576, 0x8c9487]), 0.9);
      for (let i = 0; i < 9; i++) lily(deco, r, sideX(r, 3.4, 6.2), rnd01(r, -5.5, 5.5));
      if (r() < 0.7) for (const s of [-1, 1]) dockPost(deco, s * 6.4, rnd01(r, -4, 4));
      for (const s of [-1, 1]) mountain(deco, r, s * rnd01(r, 32, 46), rnd01(r, -4, 4), pick(r, [0x4d6f5a, 0x56786a, 0x44655a]), false);
      /* faint foam dashes that mark the three lanes */
      const foam = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, roughness: 1 });
      for (const x of [-3.6, -1.2, 1.2, 3.6]) for (let z = -5.4; z < 6; z += 1.8) add(deco, G.box, foam, x, 0.085, z, 0.07, 0.01, 0.8);
      g.add(bake(deco)); return g;
    },
  };

  const protos = {};
  for (const id of Object.keys(builders)) {
    protos[id] = [];
    for (let v = 0; v < VARIANTS; v++) {
      const grp = builders[id](seeded(1000 + v * 77 + id.length * 13));
      grp.traverse(o => { if (o.geometry) geos.add(o.geometry); });
      protos[id].push(grp);
    }
  }

  return {
    /** a fresh copy of a variant (geometry + materials are shared, so this is nearly free) */
    make(id, n) { const list = protos[id]; return list ? list[Math.abs(n) % list.length].clone(true) : new THREE.Group(); },
    /** slow river flow */
    update(dt) { waterMap.offset.y -= dt * 0.06; waterMap.offset.x += dt * 0.012; },
    dispose() {
      textures.forEach(t => t.dispose());
      geos.forEach(g => g.dispose());
      mcache.forEach(m => m.dispose());
      Object.values(groundMats).forEach(m => m.dispose());
    },
  };
}
