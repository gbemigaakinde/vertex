#!/usr/bin/env node
/* ============================================================
   tools/optimize-model.mjs

   Shrinks a detailed .glb so it is practical to ship in a browser game:
     - fewer triangles (keeps the shape, drops invisible detail)
     - smaller textures, saved as WebP
     - compressed geometry (the game already reads this format)
     - works on models with a skeleton and animations too

   Example (a 11 MB, 280,000-triangle model becomes roughly 1 MB and 25,000 triangles):

       node tools/optimize-model.mjs my-soldier.glb characters/enemy_rifleman.glb --tris 25000 --tex 1024

   Add --lo to also write a lighter copy (name.lo.glb). The game uses it
   automatically on phones with little memory or with Data Saver turned on.

       node tools/optimize-model.mjs my-soldier.glb characters/enemy_rifleman.glb --lo

   Options
       --tris N      target triangle count            (default 25000)
       --tex N       longest texture side in pixels   (default 1024)
       --lo          also write <output>.lo.glb       (6000 triangles, 512 px textures)
       --lo-tris N   triangles for the lo copy
       --lo-tex N    texture size for the lo copy
       --quality N   WebP quality 1-100               (default 82)

   One-time setup (these are only needed to RUN this tool, not by the game):

       npm install --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp

   After optimizing, run:  node tools/build-manifest.mjs
   ============================================================ */
import { statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const args = process.argv.slice(2);
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && /^--(tris|tex|lo-tris|lo-tex|quality)$/.test(args[i - 1])));
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? Number(args[i + 1]) : d; };
if (!positional.length) { console.log('Usage: node tools/optimize-model.mjs <input.glb> [output.glb] [--tris 25000] [--tex 1024] [--lo]'); process.exit(1); }

const input = positional[0];
const output = positional[1] || join(dirname(input), basename(input).replace(/\.glb$/i, '') + '.optimized.glb');

let core, ext, fn, mo, sharp;
try {
  core = await import('@gltf-transform/core'); ext = await import('@gltf-transform/extensions'); fn = await import('@gltf-transform/functions');
  mo = await import('meshoptimizer'); sharp = (await import('sharp')).default;
} catch (e) {
  console.error('Missing tools. Run this once, then try again:\n\n  npm install --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp\n\n(' + e.message + ')');
  process.exit(1);
}
const { NodeIO } = core, { ALL_EXTENSIONS } = ext;
const { weld, simplify, prune, dedup, textureCompress, meshopt } = fn;
const { MeshoptEncoder, MeshoptSimplifier, MeshoptDecoder } = mo;
await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready, MeshoptDecoder.ready]);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

function triangles(doc) {
  let t = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) { const i = p.getIndices(); t += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; }
  return Math.round(t);
}
function vertices(doc) {
  let v = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) v += p.getAttribute('POSITION').getCount();
  return v;
}
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';

async function make(outPath, tris, tex, quality) {
  const doc = await io.read(input);
  const before = triangles(doc), verts = vertices(doc);
  const steps = [weld()];
  if (before > tris) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: tris / before, error: 0.05 }));
  steps.push(dedup(), prune());
  if (doc.getRoot().listTextures().length) steps.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality }));
  steps.push(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await doc.transform(...steps);
  await io.write(outPath, doc);
  const skins = doc.getRoot().listSkins().length, anims = doc.getRoot().listAnimations().length;
  const after = triangles(doc), bytes = statSync(outPath).size;
  console.log(`${outPath}\n  triangles ${before.toLocaleString()} -> ${triangles(doc).toLocaleString()}   vertices ${verts.toLocaleString()} -> ${vertices(doc).toLocaleString()}\n  size      ${mb(statSync(input).size)} -> ${mb(statSync(outPath).size)}\n  skeleton  ${skins ? 'yes (kept)' : 'none'}   animation clips ${anims}`);
  if (after > tris * 1.15) console.log(`  NOTE: stopped at ${after.toLocaleString()} triangles, not ${tris.toLocaleString()}. The model's texture layout (many small UV islands) stops it going lower without smearing the texture. For a lighter mesh, reduce it in Blender (Decimate, with UV seams kept) and run this tool again.`);
  return { after, bytes };
}

const quality = opt('--quality', 82);
const main = await make(output, opt('--tris', 25000), opt('--tex', 1024), quality);
if (args.includes('--lo')) {
  const loPath = output.replace(/\.glb$/i, '') + '.lo.glb';
  const lo = await make(loPath, opt('--lo-tris', 6000), opt('--lo-tex', 512), Math.min(quality, 75));
  if (lo.after > main.after * 0.7 && lo.bytes > main.bytes * 0.6) {
    const { unlinkSync } = await import('node:fs');
    unlinkSync(loPath);
    console.log('  The lo copy was not noticeably lighter than the main file, so it was not kept (the game would gain nothing from it).');
  }
}
console.log('\nNext: node tools/build-manifest.mjs');
