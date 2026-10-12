#!/usr/bin/env node
/* ============================================================
   tools/rig-soldier.mjs

   Turns a detailed, UNRIGGED humanoid (a .obj + texture, or a .glb with no skeleton)
   into a game-ready character, with no Mixamo, Blender or laptop app:

     1. normalises it (1.8 m tall, feet on the floor, centred, facing +Z, Y-up)
     2. reduces triangles, keeping the texture layout (UV-aware)
     3. builds a Mixamo-named skeleton and skin weights from the shape
     4. adds animation clips: idle, walk, run, sprint, crouch, crouch_walk, death
     5. shrinks the texture to WebP and compresses the mesh (Meshopt)

   The result is a normal "rigged" character for the game (see vector/README.md).

   Usage
       node tools/rig-soldier.mjs <input.obj|input.glb> <output.glb> [options]

       node tools/rig-soldier.mjs soldier_a.obj characters/enemy_heavy.glb --lo

   Input
       .obj  needs its .jpg/.png texture next to it (read from the .mtl "map_Kd" line,
             or the same name as the .obj)
       .glb  a single mesh with one base-colour texture and no skeleton

   Options
       --tris N       triangle target                  (default 20000)
       --tex N        longest texture side in pixels   (default 1024)
       --lo           also write <output>.lo.glb       (5000 triangles, 512 px)
       --lo-tris N / --lo-tex N
       --quality N    WebP quality 1-100               (default 82)
       --rot-y DEG    spin the model before rigging, if it does not face +Z (try 180)
       --double       render both sides of every triangle (for thin, open surfaces)

   The model must stand upright in an A-pose or T-pose (arms out, legs apart). Arms
   and legs are found automatically from the shape.

   One-time setup (only needed to RUN this tool, not by the game):
       npm install --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp

   Afterwards:  node tools/build-manifest.mjs
   ============================================================ */
import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const VAL = /^--(tris|tex|lo-tris|lo-tex|quality|rot-y)$/;
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VAL.test(args[i - 1])));
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : d; };
if (positional.length < 2) { console.log('Usage: node tools/rig-soldier.mjs <input.obj|input.glb> <output.glb> [--tris 20000] [--tex 1024] [--lo] [--rot-y 180]'); process.exit(1); }
const [input, output] = positional;

let core, ext, fn, mo, sharp;
try {
  core = await import('@gltf-transform/core'); ext = await import('@gltf-transform/extensions'); fn = await import('@gltf-transform/functions');
  mo = await import('meshoptimizer'); sharp = (await import('sharp')).default;
} catch (e) {
  console.error('Missing tools. Run this once, then try again:\n\n  npm install --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp\n\n(' + e.message + ')');
  process.exit(1);
}
const { Document, NodeIO } = core, { ALL_EXTENSIONS, EXTTextureWebP } = ext, { meshopt } = fn;
const { MeshoptEncoder, MeshoptSimplifier, MeshoptDecoder } = mo;
await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const HEIGHT = 1.8;   // metres; the game rescales characters anyway, this just keeps the numbers readable

/* ---------------------------------------------------------------- 1. read the source */
function readObj(path) {
  const P = [], T = [], N = [], key = new Map(), pos = [], uv = [], nrm = [], idx = [];
  let tex = null;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p[0] === 'v') P.push(+p[1], +p[2], +p[3]);
    else if (p[0] === 'vt') T.push(+p[1], +p[2]);
    else if (p[0] === 'vn') N.push(+p[1], +p[2], +p[3]);
    else if (p[0] === 'mtllib' && !tex) {
      const mtl = join(dirname(path), p.slice(1).join(' '));
      if (existsSync(mtl)) { const m = /map_Kd\s+(.+)/.exec(readFileSync(mtl, 'utf8')); if (m) tex = join(dirname(path), m[1].trim()); }
    } else if (p[0] === 'f') {
      const ids = [];
      for (let k = 1; k < p.length; k++) {
        let id = key.get(p[k]);
        if (id === undefined) {
          const [a, b, c] = p[k].split('/').map((s) => (s ? parseInt(s, 10) : 0));
          const vi = (a < 0 ? P.length / 3 + a : a - 1) * 3;
          pos.push(P[vi], P[vi + 1], P[vi + 2]);
          if (b) { const ti = (b < 0 ? T.length / 2 + b : b - 1) * 2; uv.push(T[ti], 1 - T[ti + 1]); } else uv.push(0, 0);   // OBJ v points up, glTF v points down
          if (c) { const ni = (c < 0 ? N.length / 3 + c : c - 1) * 3; nrm.push(N[ni], N[ni + 1], N[ni + 2]); } else nrm.push(0, 0, 0);
          id = pos.length / 3 - 1; key.set(p[k], id);
        }
        ids.push(id);
      }
      for (let k = 1; k < ids.length - 1; k++) idx.push(ids[0], ids[k], ids[k + 1]);
    }
  }
  if (!tex) { for (const e of ['.jpg', '.jpeg', '.png']) { const c = path.replace(/\.obj$/i, e); if (existsSync(c)) { tex = c; break; } } }
  if (!tex || !existsSync(tex)) throw new Error('no texture found next to ' + path + ' (expected the map_Kd file from the .mtl, or a .jpg/.png with the same name)');
  return { pos: Float32Array.from(pos), uv: Float32Array.from(uv), nrm: Float32Array.from(nrm), idx: Uint32Array.from(idx), image: readFileSync(tex) };
}

async function readGlb(path) {
  const doc = await io.read(path), root = doc.getRoot();
  if (root.listSkins().length) throw new Error(path + ' already has a skeleton: use tools/optimize-model.mjs instead');
  const prims = []; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) prims.push(p);
  if (!prims.length) throw new Error('no mesh in ' + path);
  if (prims.length > 1) console.log(`  note: ${prims.length} mesh parts; only the biggest is used`);
  prims.sort((a, b) => b.getAttribute('POSITION').getCount() - a.getAttribute('POSITION').getCount());
  const p = prims[0], A = (n) => p.getAttribute(n);
  const count = A('POSITION').getCount();
  const pos = new Float32Array(count * 3), uv = new Float32Array(count * 2), nrm = new Float32Array(count * 3), tmp = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    A('POSITION').getElement(i, tmp); pos.set(tmp, i * 3);
    if (A('TEXCOORD_0')) { A('TEXCOORD_0').getElement(i, tmp); uv[i * 2] = tmp[0]; uv[i * 2 + 1] = tmp[1]; }
    if (A('NORMAL')) { A('NORMAL').getElement(i, tmp); nrm.set(tmp, i * 3); }
  }
  const ia = p.getIndices(); const idx = ia ? Uint32Array.from(ia.getArray()) : Uint32Array.from({ length: count }, (_, i) => i);
  const tex = p.getMaterial() && p.getMaterial().getBaseColorTexture();
  if (!tex) throw new Error('the mesh has no base colour texture');
  return { pos, uv, nrm, idx, image: Buffer.from(tex.getImage()) };
}

/* ---------------------------------------------------------------- 2. normalise + reduce */
function normalise(m, rotY) {
  const { pos, nrm } = m;
  if (rotY) { const c = Math.cos(rotY * Math.PI / 180), s = Math.sin(rotY * Math.PI / 180); for (const a of [pos, nrm]) for (let i = 0; i < a.length; i += 3) { const x = a[i], z = a[i + 2]; a[i] = x * c + z * s; a[i + 2] = -x * s + z * c; } }
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i + k]); mx[k] = Math.max(mx[k], pos[i + k]); }
  const h = mx[1] - mn[1];
  if (!(h > 0)) throw new Error('empty model');
  const wide = Math.max(mx[0] - mn[0], mx[2] - mn[2]);
  if (h < wide * 0.9) throw new Error(`the model is lying down or Z-up (height ${h.toFixed(2)}, width ${wide.toFixed(2)}). It must be Y-up and standing.`);
  const s = HEIGHT / h, cx = (mx[0] + mn[0]) / 2, cz = (mx[2] + mn[2]) / 2;
  for (let i = 0; i < pos.length; i += 3) { pos[i] = (pos[i] - cx) * s; pos[i + 1] = (pos[i + 1] - mn[1]) * s; pos[i + 2] = (pos[i + 2] - cz) * s; }
  for (let i = 0; i < nrm.length; i += 3) { const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]); if (l > 0) { nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l; } }
}

/* Reduce to about `tris` triangles, then rebuild the texture.

   Why not just simplify the original? Generated models come with thousands of tiny texture
   islands (12,000+ on these soldiers). The reducer must not move an island's edge, so it stalls
   near the original size, and forcing it smears the texture ("dark blotches").
   Instead: (1) weld the surface by POSITION and reduce it freely, (2) unwrap the reduced mesh
   into a clean new texture layout (xatlas), (3) paint the new texture by looking up the colour
   of the closest point on the ORIGINAL surface for every texel. Detail is kept where it matters
   and the file is small. */
async function reduce(m, tris, tex) {
  const { pos, nrm } = m, n = pos.length / 3;
  // 1. weld by position only
  const map = new Int32Array(n), seen = new Map(), keep = [];
  let u = 0;
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos[i * 3] * 1e5)},${Math.round(pos[i * 3 + 1] * 1e5)},${Math.round(pos[i * 3 + 2] * 1e5)}`;
    let j = seen.get(k); if (j === undefined) { j = u++; seen.set(k, j); keep.push(i); }
    map[i] = j;
  }
  let idx = new Uint32Array(m.idx.length), w = 0;
  for (let i = 0; i < m.idx.length; i += 3) { const a = map[m.idx[i]], b = map[m.idx[i + 1]], c = map[m.idx[i + 2]]; if (a !== b && b !== c && a !== c) { idx[w++] = a; idx[w++] = b; idx[w++] = c; } }
  idx = idx.slice(0, w);
  const P = new Float32Array(u * 3), N = new Float32Array(u * 3);
  for (let i = 0; i < n; i++) { const j = map[i]; N[j * 3] += nrm[i * 3]; N[j * 3 + 1] += nrm[i * 3 + 1]; N[j * 3 + 2] += nrm[i * 3 + 2]; }
  keep.forEach((o, j) => { P.set(pos.subarray(o * 3, o * 3 + 3), j * 3); const l = Math.hypot(N[j * 3], N[j * 3 + 1], N[j * 3 + 2]) || 1; N[j * 3] /= l; N[j * 3 + 1] /= l; N[j * 3 + 2] /= l; });
  const before = m.idx.length / 3;

  // 2. reduce (position + normal)
  let out = idx;
  if (idx.length / 3 > tris) {
    const target = tris * 3;
    for (const e of [0.01, 0.02, 0.04, 0.08, 0.15, 0.3]) {
      [out] = MeshoptSimplifier.simplifyWithAttributes(idx, P, 3, N, 3, [0.6, 0.6, 0.6], null, target, e, ['Sparse']);
      if (out.length <= target * 1.08) break;
    }
  }
  const remap = new Int32Array(u).fill(-1); let c = 0;
  for (const i of out) if (remap[i] < 0) remap[i] = c++;
  const rp = new Float32Array(c * 3), rn = new Float32Array(c * 3), ri = new Uint32Array(out.length);
  for (let i = 0; i < u; i++) { const j = remap[i]; if (j < 0) continue; rp.set(P.subarray(i * 3, i * 3 + 3), j * 3); rn.set(N.subarray(i * 3, i * 3 + 3), j * 3); }
  for (let i = 0; i < out.length; i++) ri[i] = remap[out[i]];

  // 3. new texture layout
  const atlas = await unwrap(rp, rn, ri, tex);
  // 4. paint it from the original
  const rgb = await bake(m, atlas, tex);
  return { pos: atlas.pos, nrm: atlas.nrm, uv: atlas.uv, idx: atlas.idx, rgb, tex, stats: { before, after: atlas.idx.length / 3, verts: atlas.pos.length / 3 } };
}

let xatlasApi = null;
async function unwrap(pos, nrm, idx, tex) {
  const { createRequire } = await import('node:module');
  if (!xatlasApi) {
    let Api, create;
    try {
      ({ Api } = await import('xatlasjs/dist/node/api.mjs')); create = createRequire(import.meta.url)('xatlasjs/dist/node/xatlas.js');
    } catch (e) { throw new Error('xatlasjs is missing. Run: npm install --no-save xatlasjs\n(' + e.message + ')'); }
    const X = Api(create); xatlasApi = new X(() => {}, null, null);
    while (!xatlasApi.loaded) await new Promise((r) => setTimeout(r, 20));
  }
  if (pos.length / 3 > 65000) throw new Error('too many vertices for the unwrapper; lower --tris');
  xatlasApi.createAtlas();
  xatlasApi.addMesh(Uint16Array.from(idx), pos, nrm, null, 'm', false, false);
  const res = xatlasApi.generateAtlas({ maxIterations: 2, normalSeamWeight: 6 }, { resolution: tex, padding: 4, bilinear: true, rotateCharts: true, texelsPerUnit: 0 }, true);
  const mesh = res.meshes[0], vc = mesh.vertexCount, W = res.width, H = res.height;
  const out = { pos: new Float32Array(vc * 3), nrm: new Float32Array(vc * 3), uv: new Float32Array(vc * 2), idx: Uint32Array.from(mesh.index), W, H };
  for (let i = 0; i < vc; i++) {
    const o = mesh.oldIndexes[i];
    out.pos.set(pos.subarray(o * 3, o * 3 + 3), i * 3); out.nrm.set(nrm.subarray(o * 3, o * 3 + 3), i * 3);
    out.uv[i * 2] = mesh.vertex.coords1[i * 2]; out.uv[i * 2 + 1] = mesh.vertex.coords1[i * 2 + 1];
  }
  xatlasApi.destroyAtlas();
  return out;
}

/* closest point on triangle (Ericson); returns squared distance and barycentric weights */
function closest(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz, o) {
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let u, v, w;
  if (d1 <= 0 && d2 <= 0) { u = 1; v = 0; w = 0; }
  else {
    const bpx = px - bx, bpy = py - by, bpz = pz - bz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { u = 0; v = 1; w = 0; }
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { v = d1 / (d1 - d3); u = 1 - v; w = 0; }
      else {
        const cpx = px - cx, cpy = py - cy, cpz = pz - cz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) { u = 0; v = 0; w = 1; }
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { w = d2 / (d2 - d6); u = 1 - w; v = 0; }
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); u = 0; v = 1 - w; }
            else { const den = 1 / (va + vb + vc); v = vb * den; w = vc * den; u = 1 - v - w; }
          }
        }
      }
    }
  }
  const qx = u * ax + v * bx + w * cx - px, qy = u * ay + v * by + w * cy - py, qz = u * az + v * bz + w * cz - pz;
  o[0] = u; o[1] = v; o[2] = w; return qx * qx + qy * qy + qz * qz;
}

async function bake(m, atlas, tex) {
  const { data, info } = await sharp(m.image).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const IW = info.width, IH = info.height;
  const sample = (u, v, out) => {            // bilinear, repeat
    const x = u * IW - 0.5, y = v * IH - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    for (let ch = 0; ch < 3; ch++) {
      const g = (xx, yy) => data[(((yy % IH) + IH) % IH * IW + ((xx % IW) + IW) % IW) * 3 + ch];
      out[ch] = (g(x0, y0) * (1 - fx) + g(x0 + 1, y0) * fx) * (1 - fy) + (g(x0, y0 + 1) * (1 - fx) + g(x0 + 1, y0 + 1) * fx) * fy;
    }
  };
  // spatial grid over the original triangles
  const { pos, uv, idx } = m, nt = idx.length / 3, CELL = 0.025;
  const grid = new Map(), key = (x, y, z) => (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  const cells = new Map();
  for (let t = 0; t < nt; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const lo = [0, 1, 2].map((k) => Math.floor(Math.min(pos[a + k], pos[b + k], pos[c + k]) / CELL)), hi = [0, 1, 2].map((k) => Math.floor(Math.max(pos[a + k], pos[b + k], pos[c + k]) / CELL));
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = `${x},${y},${z}`; let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(t); }
  }
  const tn = new Float32Array(nt * 3);       // original triangle normals
  for (let t = 0; t < nt; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0], l = Math.hypot(nx, ny, nz) || 1;
    tn[t * 3] = nx / l; tn[t * 3 + 1] = ny / l; tn[t * 3 + 2] = nz / l;
  }
  const img = new Uint8Array(tex * tex * 3), done = new Uint8Array(tex * tex), bary = [0, 0, 0], col = [0, 0, 0];
  const nearest = (px, py, pz, nx, ny, nz) => {
    const cx = Math.floor(px / CELL), cy = Math.floor(py / CELL), cz = Math.floor(pz / CELL);
    let best = -1, bestS = 1e9, bu = 0, bv = 0, bw = 0;
    for (let ring = 0; ring < 6 && best < 0; ring++) {
      for (let x = cx - ring; x <= cx + ring; x++) for (let y = cy - ring; y <= cy + ring; y++) for (let z = cz - ring; z <= cz + ring; z++) {
        if (ring && Math.max(Math.abs(x - cx), Math.abs(y - cy), Math.abs(z - cz)) !== ring) continue;
        const l = cells.get(`${x},${y},${z}`); if (!l) continue;
        for (const t of l) {
          const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
          const d = closest(px, py, pz, pos[a], pos[a + 1], pos[a + 2], pos[b], pos[b + 1], pos[b + 2], pos[c], pos[c + 1], pos[c + 2], bary);
          const s = d + 0.0006 * (1 - (tn[t * 3] * nx + tn[t * 3 + 1] * ny + tn[t * 3 + 2] * nz));   // prefer a surface facing the same way
          if (s < bestS) { bestS = s; best = t; bu = bary[0]; bv = bary[1]; bw = bary[2]; }
        }
      }
    }
    if (best < 0) return false;
    const a = idx[best * 3], b = idx[best * 3 + 1], c = idx[best * 3 + 2];
    sample(bu * uv[a * 2] + bv * uv[b * 2] + bw * uv[c * 2], bu * uv[a * 2 + 1] + bv * uv[b * 2 + 1] + bw * uv[c * 2 + 1], col);
    return true;
  };
  // rasterise every new triangle into the texture
  const { pos: np, nrm: nn, uv: nuv, idx: ni } = atlas, W = atlas.W, H = atlas.H;
  for (let t = 0; t < ni.length; t += 3) {
    const v = [ni[t], ni[t + 1], ni[t + 2]], X = v.map((i) => nuv[i * 2] * tex), Y = v.map((i) => nuv[i * 2 + 1] * tex);
    const x0 = Math.max(0, Math.floor(Math.min(...X) - 1)), x1 = Math.min(tex - 1, Math.ceil(Math.max(...X) + 1)), y0 = Math.max(0, Math.floor(Math.min(...Y) - 1)), y1 = Math.min(tex - 1, Math.ceil(Math.max(...Y) + 1));
    const den = (Y[1] - Y[2]) * (X[0] - X[2]) + (X[2] - X[1]) * (Y[0] - Y[2]);
    if (Math.abs(den) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5, qy = y + 0.5;
      let l0 = ((Y[1] - Y[2]) * (qx - X[2]) + (X[2] - X[1]) * (qy - Y[2])) / den, l1 = ((Y[2] - Y[0]) * (qx - X[2]) + (X[0] - X[2]) * (qy - Y[2])) / den, l2 = 1 - l0 - l1;
      const eps = -0.02;                                      // a hair outside counts, so edges are covered
      if (l0 < eps || l1 < eps || l2 < eps) continue;
      l0 = Math.max(0, l0); l1 = Math.max(0, l1); l2 = Math.max(0, l2); const s = l0 + l1 + l2; l0 /= s; l1 /= s; l2 /= s;
      const o = y * tex + x; if (done[o] === 1) continue;
      const px = l0 * np[v[0] * 3] + l1 * np[v[1] * 3] + l2 * np[v[2] * 3], py = l0 * np[v[0] * 3 + 1] + l1 * np[v[1] * 3 + 1] + l2 * np[v[2] * 3 + 1], pz = l0 * np[v[0] * 3 + 2] + l1 * np[v[1] * 3 + 2] + l2 * np[v[2] * 3 + 2];
      const nx = l0 * nn[v[0] * 3] + l1 * nn[v[1] * 3] + l2 * nn[v[2] * 3], ny = l0 * nn[v[0] * 3 + 1] + l1 * nn[v[1] * 3 + 1] + l2 * nn[v[2] * 3 + 1], nz = l0 * nn[v[0] * 3 + 2] + l1 * nn[v[1] * 3 + 2] + l2 * nn[v[2] * 3 + 2];
      if (!nearest(px, py, pz, nx, ny, nz)) continue;
      img[o * 3] = col[0]; img[o * 3 + 1] = col[1]; img[o * 3 + 2] = col[2]; done[o] = 1;
    }
  }
  // pad the edges of every island (so filtering and mip-maps never pull in empty pixels)
  for (let pass = 0; pass < 6; pass++) {
    const add = [];
    for (let y = 0; y < tex; y++) for (let x = 0; x < tex; x++) {
      const o = y * tex + x; if (done[o]) continue;
      let r = 0, g = 0, b = 0, k = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= tex || yy >= tex) continue; const p = yy * tex + xx; if (done[p]) { r += img[p * 3]; g += img[p * 3 + 1]; b += img[p * 3 + 2]; k++; } }
      if (k) add.push(o, r / k, g / k, b / k);
    }
    for (let i = 0; i < add.length; i += 4) { const o = add[i]; img[o * 3] = add[i + 1]; img[o * 3 + 1] = add[i + 2]; img[o * 3 + 2] = add[i + 3]; done[o] = 1; }
  }
  return img;
}

/* ---------------------------------------------------------------- 3. skeleton */
/* Mixamo bone names so clips and tools that expect them just work.
   Character's left is +X (the model faces +Z, Y is up). All bones have identity rotation
   at rest, so a clip made for one character plays on any other. */
const PREFIX = 'mixamorig';

function measure(pos) {
  // arm reach: where the hands are (the furthest points sideways, between hip and shoulder height)
  const xs = []; let n = 0;
  for (let i = 0; i < pos.length; i += 3) if (pos[i + 1] > 0.55 && pos[i + 1] < 1.6) xs.push(Math.abs(pos[i]));
  xs.sort((a, b) => a - b);
  const xmax = xs[Math.floor(xs.length * 0.9975)] || 0.6;
  let sy = 0; n = 0;
  for (let i = 0; i < pos.length; i += 3) if (pos[i + 1] > 0.55 && pos[i + 1] < 1.6 && Math.abs(pos[i]) > xmax * 0.93) { sy += pos[i + 1]; n++; }
  const tipY = n ? sy / n : 0.95;
  // feet: how far forward the toes reach
  let toeZ = 0.12; for (let i = 0; i < pos.length; i += 3) if (pos[i + 1] < 0.08) toeZ = Math.max(toeZ, pos[i + 2]);
  // leg centres (x) around the knees
  const lx = []; for (let i = 0; i < pos.length; i += 3) if (pos[i + 1] > 0.4 && pos[i + 1] < 0.6 && Math.abs(pos[i]) < 0.4 && pos[i] > 0) lx.push(pos[i]);
  lx.sort((a, b) => a - b);
  const legX = lx.length > 50 ? lx[Math.floor(lx.length / 2)] : 0.17;
  return { xmax: Math.max(0.35, xmax), tipY: Math.min(1.5, Math.max(0.6, tipY)), toeZ: Math.min(0.35, toeZ), legX: Math.min(0.28, Math.max(0.1, legX)) };
}

/* bones: name, parent, joint position (head), tail position (for the skin capsule), radius */
function buildSkeleton(pos) {
  const m = measure(pos), S = [0.2, 1.42, 0], T = [m.xmax * 0.88, m.tipY + 0.03, 0];
  const E = [(S[0] + T[0]) / 2, (S[1] + T[1]) / 2 + 0.01, 0], tip = [m.xmax, m.tipY, 0];
  const L = (s) => s;                    // left = +X
  const bones = [
    ['Hips', null, [0, 0.95, 0], [0, 1.05, 0], 0.2],
    ['Spine', 'Hips', [0, 1.05, 0], [0, 1.22, 0], 0.2],
    ['Spine1', 'Spine', [0, 1.22, 0], [0, 1.38, 0], 0.21],
    ['Spine2', 'Spine1', [0, 1.38, 0], [0, 1.52, 0], 0.21],
    ['Neck', 'Spine2', [0, 1.52, 0], [0, 1.62, 0], 0.07],
    ['Head', 'Neck', [0, 1.62, 0], [0, 1.8, 0], 0.13],
  ];
  for (const [side, sg] of [['Left', 1], ['Right', -1]]) {
    const X = (p) => [p[0] * sg, p[1], p[2]];
    bones.push(
      [side + 'Shoulder', 'Spine2', [0.05 * sg, 1.42, 0], X(S), 0.07],
      [side + 'Arm', side + 'Shoulder', X(S), X(E), 0.07],
      [side + 'ForeArm', side + 'Arm', X(E), X(T), 0.055],
      [side + 'Hand', side + 'ForeArm', X(T), X(tip), 0.08],
      [side + 'UpLeg', 'Hips', [m.legX * 0.9 * sg, 0.93, 0], [m.legX * sg, 0.5, 0], 0.11],
      [side + 'Leg', side + 'UpLeg', [m.legX * sg, 0.5, 0], [m.legX * 1.05 * sg, 0.09, 0], 0.085],
      [side + 'Foot', side + 'Leg', [m.legX * 1.05 * sg, 0.09, 0], [m.legX * 1.05 * sg, 0.03, m.toeZ], 0.09],
    );
  }
  return { bones: bones.map(([n, p, a, b, r]) => ({ name: PREFIX + n, short: n, parent: p ? PREFIX + p : null, head: a, tail: b, radius: r })), m };
}

const segDist = (p, a, b) => {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], l2 = abx * abx + aby * aby + abz * abz || 1e-9;
  let t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby + (p[2] - a[2]) * abz) / l2; t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + abx * t), p[1] - (a[1] + aby * t), p[2] - (a[2] + abz * t));
};

/* Each vertex follows the nearest bone capsules (inverse-distance), at most 4 of them. */
function skin(pos, bones) {
  const n = pos.length / 3, J = new Uint8Array(n * 4), W = new Float32Array(n * 4), p = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    p[0] = pos[i * 3]; p[1] = pos[i * 3 + 1]; p[2] = pos[i * 3 + 2];
    const c = bones.map((b, k) => { const d = Math.max(0, segDist(p, b.head, b.tail) - b.radius); return [k, 1 / Math.pow(d + 0.025, 3)]; });
    c.sort((a, b) => b[1] - a[1]);
    const top = c.slice(0, 4); let s = 0; for (const t of top) s += t[1];
    // ignore bones that matter very little (keeps hard parts, like boots and helmets, rigid)
    let kept = top.filter((t) => t[1] / s > 0.04); if (!kept.length) kept = [top[0]];
    s = 0; for (const t of kept) s += t[1];
    kept.forEach((t, k) => { J[i * 4 + k] = t[0]; W[i * 4 + k] = t[1] / s; });
  }
  return { J, W };
}

/* ---------------------------------------------------------------- 4. animation */
const D2R = Math.PI / 180;
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qaxis = (x, y, z, deg) => { const h = deg * D2R / 2, s = Math.sin(h); return [x * s, y * s, z * s, Math.cos(h)]; };
const euler = (rx = 0, ry = 0, rz = 0) => qmul(qaxis(0, 0, 1, rz), qmul(qaxis(0, 1, 0, ry), qaxis(1, 0, 0, rx)));   // X first, then Y, then Z
/* + X rotation swings a hanging limb BACKWARD (toward -Z); - X swings it forward. */

const sm = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));


/* Lowest point of the skinned mesh in a given pose (forward kinematics + linear blend skinning).
   Used so that the death clip ends with the body lying ON the floor, not in it. */
function posedMinY(sk, J, Wt, pos, rot, hipsPos) {
  const mulT = (a, b) => { const o = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
  const fromQT = (q, t) => { const [x, y, z, w] = q; return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, t[0], t[1], t[2], 1]; };
  const world = {};
  sk.bones.forEach((b) => {
    const par = b.parent ? sk.bones.find((x) => x.name === b.parent) : null;
    const lt = b.short === 'Hips' ? hipsPos : par ? b.head.map((v, i) => v - par.head[i]) : b.head;
    const q = rot[b.short] ? euler(...rot[b.short]) : [0, 0, 0, 1], local = fromQT(q, lt);
    world[b.name] = par ? mulT(world[par.name], local) : local;
  });
  const M = sk.bones.map((b) => mulT(world[b.name], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -b.head[0], -b.head[1], -b.head[2], 1]));
  let minY = 1e9;
  for (let i = 0; i < pos.length / 3; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; let py = 0;
    for (let k = 0; k < 4; k++) { const w = Wt[i * 4 + k]; if (w) { const m = M[J[i * 4 + k]]; py += w * (m[1] * x + m[5] * y + m[9] * z + m[13]); } }
    if (py < minY) minY = py;
  }
  return minY;
}

function makeClips(sk, pos, J, Wt) {
  const L = (name) => sk.bones.find((b) => b.short === name);
  const thigh = Math.hypot(...L('LeftUpLeg').head.map((v, i) => v - L('LeftLeg').head[i]));
  const shin = Math.hypot(...L('LeftLeg').head.map((v, i) => v - L('LeftFoot').head[i]));
  const ankleY = L('LeftFoot').head[1], hipY = L('Hips').head[1];
  const hipsAt = (alpha, beta) => {            // hips height and fore/aft offset that keep the feet planted for a given thigh/knee bend
    const a = alpha * D2R, b = (beta - alpha) * D2R;
    return { y: ankleY + shin * Math.cos(b) + thigh * Math.cos(a) + (hipY - L('LeftUpLeg').head[1]), z: -(thigh * Math.sin(a) - shin * Math.sin(b)) };
  };
  const clips = [];
  const add = (name, dur, keys, fn) => {
    const rot = {}, hips = [], times = [];
    for (let k = 0; k <= keys; k++) {
      const u = k / keys, pose = fn(u); times.push(u * dur);
      for (const [b, r] of Object.entries(pose.rot)) (rot[b] = rot[b] || []).push(...euler(...r));
      hips.push(...pose.hips);
    }
    clips.push({ name, times, rot, hips });
  };
  const idlePose = {};   // legs straight, arms in the model's own rest pose

  /* walk / run share one gait generator */
  const gait = (o) => (u) => {
    const rot = {}; let hy = hipY, hz = 0;
    for (const [side, ph] of [['Left', 0], ['Right', Math.PI]]) {
      const f = 2 * Math.PI * u + ph, s = Math.sin(f), c = Math.cos(f);
      const fwd = o.stride * s + (o.base || 0);                     // thigh forward angle (deg)
      const knee = o.knee * Math.max(0, c) + (o.stance || 6) + (o.kneeBase || 0);
      rot[side + 'UpLeg'] = [-fwd, 0, 0]; rot[side + 'Leg'] = [knee, 0, 0]; rot[side + 'Foot'] = [0.6 * (fwd - knee) + (o.footBase || 0), 0, 0];
      rot[side + 'Arm'] = [o.arm * s * (side === 'Left' ? 1 : 1) + (o.armBase || 0), 0, 0];
      rot[side + 'ForeArm'] = [-(o.elbow + o.elbowSwing * Math.max(0, -s)), 0, 0];
    }
    const twist = o.twist * Math.sin(2 * Math.PI * u);
    rot.Spine = [o.lean * 0.4, twist, 0]; rot.Spine1 = [o.lean * 0.3, twist * 0.6, 0]; rot.Spine2 = [o.lean * 0.3, twist * 0.4, 0]; rot.Head = [-o.lean * 0.6, -twist, 0];
    rot.Hips = [0, -twist * 0.5, 0];
    hy += o.bob * Math.cos(4 * Math.PI * u) + (o.drop || 0); hz += (o.hipZ || 0);
    return { rot, hips: [0, hy, hz] };
  };
  add('idle', 3, 24, (u) => {
    const b = Math.sin(2 * Math.PI * u), rot = {
      Spine: [1.2 * b, 0, 0], Spine1: [1.0 * b, 0, 0], Spine2: [1.0 * b, 0, 0], Head: [-0.8 * b, 2 * Math.sin(4 * Math.PI * u), 0],
      LeftArm: [3 + 1.5 * b, 0, 0], RightArm: [3 + 1.5 * b, 0, 0], LeftForeArm: [-8, 0, 0], RightForeArm: [-8, 0, 0],
      LeftLeg: [3, 0, 0], RightLeg: [3, 0, 0], LeftUpLeg: [-1.5, 0, 0], RightUpLeg: [-1.5, 0, 0],
    };
    return { rot, hips: [0, hipY - 0.006 + 0.006 * b, 0] };
  });
  add('walk', 1.05, 24, gait({ stride: 26, knee: 38, arm: 20, elbow: 14, elbowSwing: 10, lean: 3, twist: 4, bob: 0.018 }));
  add('run', 0.64, 24, gait({ stride: 46, knee: 78, arm: 48, elbow: 70, elbowSwing: 18, lean: 10, twist: 7, bob: 0.045, stance: 10 }));
  add('sprint', 0.5, 24, gait({ stride: 54, knee: 90, arm: 58, elbow: 78, elbowSwing: 20, lean: 17, twist: 9, bob: 0.055, stance: 12 }));
  const cr = hipsAt(62, 108), crLean = 24;
  const crouchBase = { base: 62, kneeBase: 102, stance: 0, footBase: 0, lean: crLean, drop: cr.y - hipY, hipZ: cr.z, elbow: 40, elbowSwing: 0, twist: 0, bob: 0 };
  add('crouch', 3, 24, (u) => {
    const b = Math.sin(2 * Math.PI * u), p = gait({ ...crouchBase, stride: 0, knee: 0, arm: 0, armBase: -10 })(0);
    p.rot.Spine[0] += 1.5 * b; p.rot.Head[0] += 1.2 * Math.sin(4 * Math.PI * u) - crLean * 0.2; p.hips[1] += 0.006 * b;
    p.rot.LeftFoot = [0.9 * (62 - 108 - 0), 0, 0]; p.rot.RightFoot = [0.9 * (62 - 108), 0, 0];
    return p;
  });
  add('crouch_walk', 1.3, 24, (u) => {
    const p = gait({ ...crouchBase, stride: 20, knee: 28, arm: 12, armBase: -10, bob: 0.012 })(u);
    for (const side of ['Left', 'Right']) p.rot[side + 'Foot'][0] += 0.3 * (62 - 108);
    return p;
  });
  // the death pose (written once, used for the clip and for finding where the floor is)
  const deathRot = (f, hit) => ({
    Hips: [-88 * f, 0, 0], Spine: [8 * hit - 6 * f, 0, 0], Spine1: [4 * hit, 0, 0], Head: [-14 * f + 10 * hit, 8 * f, 0],
    LeftUpLeg: [-18 * f, 0, -4 * f], RightUpLeg: [10 * f, 0, 4 * f], LeftLeg: [34 * f, 0, 0], RightLeg: [14 * f, 0, 0],
    LeftArm: [-30 * f, 0, 40 * f], RightArm: [-10 * f, 0, -40 * f], LeftForeArm: [-30 * f, 0, 0], RightForeArm: [-20 * f, 0, 0],
  });
  const lieY = 0.3 + 0.01 - posedMinY(sk, J, Wt, pos, deathRot(1, 0), [0, 0.3, 0]);   // lowest point of the body ends 1 cm above the floor
  add('death', 1.7, 34, (u) => {
    const t = u * 1.7, f = sm(clamp01((t - 0.12) / 0.8)), hit = sm(clamp01(t / 0.12)) * (1 - sm(clamp01((t - 0.12) / 0.2)));
    const rot = deathRot(f, hit);
    return { rot, hips: [0, hipY + (lieY - hipY) * f, 0] };
  });
  return clips;
}

/* ---------------------------------------------------------------- 5. build the glTF */
async function build(src, o) {
  const doc = new Document(), buf = doc.createBuffer(), scene = doc.createScene('Scene');
  doc.createExtension(EXTTextureWebP).setRequired(true);
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);

  // texture: baked RGB -> WebP
  const webp = await sharp(Buffer.from(src.rgb), { raw: { width: src.tex, height: src.tex, channels: 3 } }).webp({ quality: o.quality }).toBuffer();
  const tex = doc.createTexture('baseColor').setImage(new Uint8Array(webp)).setMimeType('image/webp');
  const mat = doc.createMaterial('body').setBaseColorTexture(tex).setMetallicFactor(0).setRoughnessFactor(0.9).setDoubleSided(!!o.double);

  const sk = buildSkeleton(src.pos), { J, W } = skin(src.pos, sk.bones);

  // bones
  const nodes = {};
  for (const b of sk.bones) {
    const node = doc.createNode(b.name), par = b.parent ? sk.bones.find((x) => x.name === b.parent) : null;
    node.setTranslation(par ? b.head.map((v, i) => v - par.head[i]) : b.head);
    nodes[b.name] = node; if (par) nodes[par.name].addChild(node); else scene.addChild(node);
  }
  const ibm = new Float32Array(sk.bones.length * 16);
  sk.bones.forEach((b, i) => { ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -b.head[0], -b.head[1], -b.head[2], 1], i * 16); });
  const skinObj = doc.createSkin('skin').setInverseBindMatrices(acc('MAT4', ibm)).setSkeleton(nodes[PREFIX + 'Hips']);
  for (const b of sk.bones) skinObj.addJoint(nodes[b.name]);

  // mesh
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', src.pos)).setAttribute('NORMAL', acc('VEC3', src.nrm)).setAttribute('TEXCOORD_0', acc('VEC2', src.uv))
    .setAttribute('JOINTS_0', acc('VEC4', J)).setAttribute('WEIGHTS_0', acc('VEC4', W))
    .setIndices(acc('SCALAR', src.idx)).setMaterial(mat);
  const meshNode = doc.createNode('soldier').setMesh(doc.createMesh('soldier').addPrimitive(prim)).setSkin(skinObj);
  scene.addChild(meshNode);

  // clips
  for (const c of makeClips(sk, src.pos, J, W)) {
    const anim = doc.createAnimation(c.name), input = acc('SCALAR', Float32Array.from(c.times));
    const ch = (node, path, type, arr) => {
      const s = doc.createAnimationSampler().setInput(input).setOutput(acc(type, Float32Array.from(arr))).setInterpolation('LINEAR');
      anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(s));
    };
    ch(nodes[PREFIX + 'Hips'], 'translation', 'VEC3', c.hips);
    for (const [b, q] of Object.entries(c.rot)) ch(nodes[PREFIX + b], 'rotation', 'VEC4', q);
  }
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  return { doc, sk };
}

/* ---------------------------------------------------------------- main */
const quality = opt('--quality', 82), rotY = opt('--rot-y', 0), double = args.includes('--double');
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
const t0 = Date.now();
const lowerInput = input.toLowerCase();
const source = lowerInput.endsWith('.obj') ? readObj(input) : await readGlb(input);
console.log(`${input}: ${(source.pos.length / 3).toLocaleString()} vertices, ${(source.idx.length / 3).toLocaleString()} triangles, ${mb(statSync(input).size)}`);
normalise(source, rotY);

async function make(outPath, tris, tex, q) {
  const src = await reduce(source, tris, tex);
  const { doc, sk } = await build(src, { tex, quality: q, double });
  await io.write(outPath, doc);
  console.log(`${outPath}\n  triangles ${src.stats.before.toLocaleString()} -> ${src.stats.after.toLocaleString()}   vertices ${src.stats.verts.toLocaleString()}   size ${mb(statSync(outPath).size)}   bones ${sk.bones.length}   clips ${doc.getRoot().listAnimations().map((a) => a.getName()).join(', ')}`);
  if (src.stats.after > tris * 1.25) console.log(`  NOTE: stopped at ${src.stats.after.toLocaleString()} triangles (target ${tris.toLocaleString()}). The mesh could not be reduced further without breaking its shape.`);
  return { bytes: statSync(outPath).size, tris: src.stats.after };
}

await make(resolve(output), opt('--tris', 20000), opt('--tex', 1024), quality);
if (args.includes('--lo')) await make(resolve(output.replace(/\.glb$/i, '') + '.lo.glb'), opt('--lo-tris', 5000), opt('--lo-tex', 512), Math.min(quality, 75));
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s\n\nNext: node tools/build-manifest.mjs`);
