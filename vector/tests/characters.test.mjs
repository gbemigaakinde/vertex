/* node vector/tests/characters.test.mjs — rigged / static / legacy characters (no browser needed) */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../lib/three.module.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { AssetLoader, Character, getModelMeta, mapClips, stripRootMotion } from '../characters.js';


/* Node has no image decoder. Textures are not needed to test skeletons and clips, so fake the two browser
   pieces GLTFLoader asks for (WebP support check and image decoding). */
globalThis.self = globalThis;
globalThis.Image = class { constructor() { this.height = 1; this.width = 1; } set src(_) { queueMicrotask(() => this.onload && this.onload()); } };
globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });

let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };
const root = new URL('../../vector-3dassets/', import.meta.url);

/* an AssetLoader whose store reads files from disk */
function diskLoader(extra = {}) {
  const store = {
    stats: {}, info: (p) => extra[p] || null, has: () => true, init: async () => {}, dispose() {},
    async fetchModel(p) { const b = readFileSync(new URL(p + '.glb', root)); return { buffer: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), source: 'disk' }; },
  };
  return new AssetLoader({ store });
}
/* a tiny Y-up skinned humanoid with named bones and clips, as GLTFLoader would return it */
function riggedGltf(clipNames) {
  const hips = new THREE.Bone(); hips.name = 'mixamorigHips'; const spine = new THREE.Bone(); spine.name = 'mixamorigSpine'; spine.position.y = 1; hips.add(spine); hips.position.y = 0.9;
  const geo = new THREE.BoxGeometry(0.5, 1.8, 0.3); geo.translate(0, 0.9, 0);
  const idx = [], w = []; for (let i = 0; i < geo.attributes.position.count; i++) { idx.push(0, 0, 0, 0); w.push(1, 0, 0, 0); }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial()); const scene = new THREE.Group();
  scene.add(mesh, hips); mesh.bind(new THREE.Skeleton([hips, spine]));
  const clip = (name) => new THREE.AnimationClip(name, 1, [new THREE.VectorKeyframeTrack('mixamorigHips.position', [0, 1], [0, 0.9, 0, 5, 0.95, 5]), new THREE.QuaternionKeyframeTrack('mixamorigSpine.quaternion', [0, 1], [0, 0, 0, 1, 0, 0.1, 0, 0.99])]);
  return { scene, animations: clipNames.map(clip) };
}
const prepare = (L, path, g) => L._prepare(path, g);

await t('mapClips understands Mixamo-style names', () => {
  const c = mapClips(['Idle', 'Walking', 'Running', 'Crouch Idle', 'Crouched Walking', 'Dying'].map((x) => riggedGltf([x]).animations[0]));
  assert.equal(c.idle.name, 'Idle'); assert.equal(c.walk.name, 'Walking'); assert.equal(c.run.name, 'Running');
  assert.equal(c.crouch.name, 'Crouch Idle'); assert.equal(c.crouchWalk.name, 'Crouched Walking'); assert.equal(c.death.name, 'Dying');
});
await t('root motion is stripped (hips do not travel)', () => {
  const c = stripRootMotion(riggedGltf(['walk']).animations[0]); const v = c.tracks[0].values; assert.equal(v[3], 0); assert.equal(v[5], 0); assert.ok(Math.abs(v[4] - 0.95) < 1e-5);
});
await t('rigged: classified, scaled to 1.85 m, plays idle/walk/run/sprint/crouch/death', () => {
  const L = diskLoader(); const m = prepare(L, 'characters/hero', riggedGltf(['Idle', 'Walk', 'Run', 'Crouch Idle', 'Crouch Walk', 'Death']));
  const meta = getModelMeta(m); assert.equal(meta.mode, 'rigged'); assert.ok(Math.abs(meta.height - 1.8) < 0.05, 'h ' + meta.height);
  const c = new Character(m); c.setLook(null, { outfit: '#ff0000' });
  const seq = [[0, {}, 'idle'], [3.0, {}, 'walk'], [4.8, {}, 'run'], [6.6, { sprinting: true }, 'sprint'], [0, { crouched: true }, 'crouch'], [1.9, { crouched: true }, 'crouchWalk'], [0, { alive: false }, 'death']];
  for (const [sp, extra, want] of seq) { for (let i = 0; i < 60; i++) c.update(1 / 30, { speed: sp, alive: true, ...extra }); assert.equal(c.curKey, want, `${want} got ${c.curKey}`); }
  c.dispose();
});
await t('rigged without clips borrows the shared set; foreign clips are ignored', () => {
  const L = diskLoader(); const m = prepare(L, 'characters/hero', riggedGltf([])); const c = new Character(m); assert.ok(c.needsClips());
  const foreign = riggedGltf(['Idle']).animations[0]; foreign.tracks.forEach((tr) => { tr.name = 'Other_' + tr.name; });
  assert.equal(c.setClips([foreign]), false); assert.ok(c.needsClips());
  assert.equal(c.setClips(riggedGltf(['Idle', 'Walk']).animations), true); assert.ok(!c.needsClips());
  for (let i = 0; i < 20; i++) c.update(0.05, { speed: 3, alive: true }); assert.equal(c.curKey, 'walk');
});
await t('rigged with no clips anywhere: no crash, whole-body motion', () => {
  const c = new Character(prepare(diskLoader(), 'characters/hero', riggedGltf([]))); for (let i = 0; i < 30; i++) c.update(1 / 30, { speed: 4, alive: true }); c.update(0.5, { speed: 0, alive: false }); assert.ok(c.dead > 0.1); c.dispose();
});
await t('static Y-up detailed mesh: stands on floor, 1.85 m, sways, falls', () => {
  const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.25), new THREE.MeshStandardMaterial()));   // like the sample: tall axis = Y
  const m = prepare(diskLoader(), 'characters/hero', { scene: g, animations: [] }); assert.equal(getModelMeta(m).mode, 'static');
  const c = new Character(m); assert.ok(c.hifi); for (let i = 0; i < 20; i++) c.update(1 / 30, { speed: 4, alive: true }); assert.notEqual(c.body.rotation.z, 0);
  const box = new THREE.Box3().setFromObject(c.group); c.group.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(c.group);
  assert.ok(Math.abs(b2.getSize(new THREE.Vector3()).y - 1.85) < 0.1, 'size ' + b2.getSize(new THREE.Vector3()).y); assert.ok(Math.abs(b2.min.y) < 0.05); void box;
  c.update(1, { speed: 0, alive: false }); assert.ok(c.dead > 0.5); c.dispose();
});
await t('your existing characters are untouched: legacy mode, limbs swing', async () => {
  const L = diskLoader(); for (const f of ['player_operative', 'enemy_rifleman', 'enemy_sniper']) {
    const m = await L.load('characters/' + f); assert.ok(m, f); assert.equal(getModelMeta(m).mode, 'legacy');
    const c = new Character(m); c.setLook(null, { outfit: '#335577' }); for (let i = 0; i < 10; i++) c.update(1 / 30, { speed: 4, alive: true });
    assert.ok(c.pv.legL && Math.abs(c.pv.legL.rotation.x) > 0.01, f); c.dispose();
  }
});
await t('older-style models without part names (scout) still load and animate as a whole', async () => {
  const m = await diskLoader().load('characters/enemy_scout'); assert.ok(m); const c = new Character(m); c.setLook(null, null); c.update(0.1, { speed: 4, alive: true }); c.dispose();
});
await t('missing / broken file => null and a stand-in character, no throw', async () => {
  const L = diskLoader(); assert.equal(await L.load('characters/does_not_exist'), null); assert.ok(L.missing.has('characters/does_not_exist'));
  const c = new Character(null); assert.ok(c.usedPlaceholder); c.update(0.1, { speed: 2, alive: true });
});
await t('weapons / props / environment load through the new loader', async () => {
  const L = diskLoader(); for (const p of ['weapons/assault_rifle', 'props/medkit', 'environment/tree', 'vehicles/tank']) assert.ok(await L.load(p), p);
});
await t('beginSession frees models unused for two missions', async () => {
  const L = diskLoader(); await L.load('props/medkit'); L.beginSession(); assert.ok(L.models.has('props/medkit')); L.beginSession(); L.beginSession(); assert.ok(!L.models.has('props/medkit'));
});
console.log(`\n${n} passed`);
