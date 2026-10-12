#!/usr/bin/env node
/* ============================================================
   tools/build-manifest.mjs

   Checks every .glb in vector-3dassets/ and rewrites
   vector-3dassets/manifest.json. Run it every time you add, replace or
   remove a model:

       node tools/build-manifest.mjs

   Why it matters: the game stores each downloaded model under the "hash"
   written here. Change a model and the hash changes, so players get the new
   file automatically and their old copy is thrown away. Forget to run it and
   players keep seeing the OLD model.

   It also tells you, for each file: is it a valid GLB, does it have a skeleton
   and animation clips, how many triangles and how many bytes, and which way
   is up. Problems are printed as WARN lines.

   Options
       --check      do not write anything; exit with code 1 if manifest.json is out of date (good for CI)
       --dir <path> assets folder (default: vector-3dassets next to this tools folder)

   Optional hand-written settings per model live in manifest.json under
   "override" and are kept every time you re-run this tool, for example:
       { "file": "characters/boss.glb", "override": { "up": "Y", "front": "-Z" } }
   kind  "legacy" or "static" to force how a character is handled (normally worked out for you)
   up    "Y" (glTF standard, what Blender/Mixamo/most generators export) or "Z" (the original pack)
   front "-Z" if a Y-up model faces away from the camera, "+Y" for a Z-up model that does
   ============================================================ */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectGlb } from '../vector/assetstore.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const DIR = opt('--dir', join(HERE, '..', 'vector-3dassets'));
const OUT = join(DIR, 'manifest.json');

/* triangle limits before a model is called "heavy" (the game may show several copies at once) */
const LIMITS = { characters: 40000, weapons: 15000, props: 15000, vehicles: 40000, environment: 30000, animations: Infinity };
const BYTE_WARN = 6 * 1024 * 1024;

/* ---- tiny 4x4 matrix helpers (column-major, like glTF) ---- */
const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
function trs(n) {
  if (n.matrix) return n.matrix.slice();
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [(1 - 2 * (yy + zz)) * sx, (2 * (xy + wz)) * sx, (2 * (xz - wy)) * sx, 0,
    (2 * (xy - wz)) * sy, (1 - 2 * (xx + zz)) * sy, (2 * (yz + wx)) * sy, 0,
    (2 * (xz + wy)) * sz, (2 * (yz - wx)) * sz, (1 - 2 * (xx + yy)) * sz, 0, tx, ty, tz, 1];
}
const xf = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];

function analyse(json) {
  const nodes = json.nodes || [], meshes = json.meshes || [], acc = json.accessors || [];
  const names = [...nodes.map((n) => n.name || ''), ...meshes.map((m) => m.name || '')].join('|').toLowerCase();
  let verts = 0, tris = 0; const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const visit = (i, parent, seen) => {
    if (seen.has(i)) return; seen.add(i);
    const n = nodes[i]; if (!n) return;
    const m = mul(parent, trs(n));
    if (n.mesh !== undefined && meshes[n.mesh]) {
      for (const pr of meshes[n.mesh].primitives || []) {
        const pa = acc[pr.attributes && pr.attributes.POSITION]; if (!pa) continue;
        verts += pa.count; const ic = pr.indices !== undefined ? acc[pr.indices].count : pa.count; tris += Math.floor(ic / 3);
        if (pa.min && pa.max) for (let c = 0; c < 8; c++) {
          const p = xf(m, [c & 1 ? pa.max[0] : pa.min[0], c & 2 ? pa.max[1] : pa.min[1], c & 4 ? pa.max[2] : pa.min[2]]);
          for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
        }
      }
    }
    for (const c of n.children || []) visit(c, m, seen);
  };
  const roots = (json.scenes && json.scenes[json.scene || 0] && json.scenes[json.scene || 0].nodes) || nodes.map((_, i) => i);
  for (const r of roots) visit(r, I4(), new Set());
  const size = max[0] === Infinity ? [0, 0, 0] : [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  let texBytes = 0;
  for (const im of json.images || []) if (im.bufferView !== undefined) texBytes += json.bufferViews[im.bufferView].byteLength;
  return {
    verts, tris, size,
    parts: ['legl', 'legr', 'arml', 'armr'].every((k) => names.includes(k)),
    skins: (json.skins || []).length, joints: (json.skins || []).reduce((a, s) => a + s.joints.length, 0),
    animations: (json.animations || []).map((a, i) => a.name || 'clip' + i),
    textures: (json.images || []).length, texBytes,
    extensions: json.extensionsUsed || [],
  };
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name), st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p)); else if (/\.glb$/i.test(name)) out.push(p);
  }
  return out;
}

const fmtKB = (n) => (n / 1024).toFixed(n > 102400 ? 0 : 1) + ' KB';
let previous = null;
if (existsSync(OUT)) { try { previous = JSON.parse(readFileSync(OUT, 'utf8')); } catch { /* start fresh */ } }
const oldBy = new Map(((previous && previous.assets) || []).map((a) => [a.file, a]));

const warnings = []; const errors = [];
const files = walk(DIR).map((p) => ({ abs: p, rel: relative(DIR, p).split(sep).join('/') }));
const inRoot = files.filter((f) => !f.rel.includes('/'));
const models = files.filter((f) => f.rel.includes('/'));
const lo = new Map();          // "characters/x.glb" -> variant entry
const assets = [];

const describe = (f) => {
  const buf = readFileSync(f.abs);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const chk = inspectGlb(ab);
  const hash = createHash('sha1').update(buf).digest('hex').slice(0, 10);
  return { buf, chk, hash, bytes: buf.length };
};

for (const f of models) {
  if (/\.lo\.glb$/i.test(f.rel)) {
    const d = describe(f);
    if (!d.chk.ok) { errors.push(`${f.rel}: ${d.chk.reason}`); continue; }
    lo.set(f.rel.replace(/\.lo\.glb$/i, '.glb'), { file: f.rel, bytes: d.bytes, hash: d.hash });
  }
}

for (const f of models) {
  if (/\.lo\.glb$/i.test(f.rel)) continue;
  const d = describe(f);
  if (!d.chk.ok) { errors.push(`${f.rel}: not usable (${d.chk.reason}) and will be skipped by the game`); continue; }
  const a = analyse(d.chk.json);
  const cat = f.rel.split('/')[0];
  const old = oldBy.get(f.rel) || {};
  const override = old.override || undefined;
  let up = (override && override.up) || null;
  // characters that are not part-built: whichever of Y or Z is the tall axis is "up". Everything else follows the original pack (Z) unless overridden.
  if (!up) up = cat === 'characters' && !a.parts && !(a.size[2] > a.size[1] * 1.15) ? 'Y' : 'Z';
  // kind (characters only): rigged = has a skeleton; static = detailed single mesh (Y-up); legacy = the original Z-up pack
  const kind = cat !== 'characters' ? 'prop' : (override && override.kind) || (a.skins > 0 ? 'rigged' : (a.parts || up === 'Z') ? 'legacy' : 'static');
  const e = { file: f.rel, bytes: d.bytes, hash: d.hash, kind, up, verts: a.verts, tris: a.tris };
  if (a.skins) e.joints = a.joints;
  if (a.animations.length) e.animations = a.animations;
  if (a.textures) e.textures = a.textures;
  if (override) e.override = override;
  if (lo.has(f.rel)) e.lo = lo.get(f.rel);
  assets.push(e);

  // ---- advice ----
  const lim = LIMITS[cat] ?? 30000;
  if (a.tris > lim) warnings.push(`${f.rel}: ${a.tris.toLocaleString()} triangles is heavy for the game (aim for under ${lim.toLocaleString()}). Shrink it: node tools/optimize-model.mjs ${f.rel}`);
  if (d.bytes > BYTE_WARN) warnings.push(`${f.rel}: ${fmtKB(d.bytes)} is a big download on mobile data (aim for under ${fmtKB(BYTE_WARN)}). Run tools/optimize-model.mjs`);
  if (kind === 'static') warnings.push(`${f.rel}: no skeleton, so it can only bob and sway (no leg/arm animation). Rig it (for example with Mixamo) to get real walk/run/aim animation.`);
  if (kind === 'legacy' && !a.parts) warnings.push(`${f.rel}: its parts are not named legL / legR / armL / armR, so the limbs will not swing (the whole body still bobs and falls).`);
  if (kind === 'rigged' && !a.animations.length) warnings.push(`${f.rel}: has a skeleton but no animation clips inside. Add vector-3dassets/animations/humanoid.glb with idle/walk/run clips that use the same bone names.`);
  for (const x of a.extensions) if (x === 'KHR_draco_mesh_compression' || x === 'KHR_texture_basisu') errors.push(`${f.rel}: uses ${x}, which the game cannot read`);
}

assets.sort((x, y) => x.file.localeCompare(y.file));
const version = createHash('sha1').update(assets.map((x) => x.file + ':' + x.hash + (x.lo ? ':' + x.lo.hash : '') + ':' + JSON.stringify(x.override || null)).join('\n')).digest('hex').slice(0, 10);
const manifest = {
  name: (previous && previous.name) || 'VECTOR: BLACKLINE — 3D Asset Pack',
  format: 'GLB 2.0',
  coordinate_system: (previous && previous.coordinate_system) || 'Z-up, forward=-Y (original pack). Per-file "up" below says how each file is authored.',
  schema: 2,
  version,
  generated: new Date().toISOString().slice(0, 10),
  asset_count: assets.length,
  assets,
};
const text = JSON.stringify(manifest, null, 2) + '\n';

// ---- report ----
console.log(`\n${'file'.padEnd(36)} ${'kind'.padEnd(7)} up  ${'tris'.padStart(9)} ${'size'.padStart(9)}  notes`);
for (const e of assets) console.log(`${e.file.padEnd(36)} ${e.kind.padEnd(7)} ${e.up}   ${String(e.tris).padStart(9)} ${fmtKB(e.bytes).padStart(9)}  ${[e.animations ? e.animations.length + ' clips' : '', e.lo ? 'lo variant' : '', e.override ? 'override' : ''].filter(Boolean).join(', ')}`);
for (const f of inRoot) console.log(`\nNOTE ${f.rel}: sits directly in the assets folder, so it is ignored. Put models in characters/, weapons/, props/, vehicles/, environment/ or animations/.`);
for (const w of warnings) console.log('\nWARN ' + w);
for (const e of errors) console.log('\nERROR ' + e);
console.log(`\n${assets.length} models, version ${version}`);

const same = existsSync(OUT) && (() => { try { const o = JSON.parse(readFileSync(OUT, 'utf8')); return o.version === version && o.asset_count === assets.length && JSON.stringify(o.assets) === JSON.stringify(assets); } catch { return false; } })();
if (flag('--check')) {
  if (!same) { console.error('manifest.json is out of date. Run: node tools/build-manifest.mjs'); process.exit(1); }
  console.log('manifest.json is up to date.'); process.exit(errors.length ? 1 : 0);
}
if (!same) { writeFileSync(OUT, text); console.log('Wrote ' + relative(process.cwd(), OUT)); } else console.log('manifest.json already up to date.');
process.exit(errors.length ? 1 : 0);
