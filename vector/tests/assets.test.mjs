/* node vector/tests/assets.test.mjs  — download/cache layer + character model kinds */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ModelStore, inspectGlb, AssetError } from '../assetstore.js';

const root = new URL('../../vector-3dassets/', import.meta.url);
const real = readFileSync(new URL('props/medkit.glb', root));
const ab = real.buffer.slice(real.byteOffset, real.byteOffset + real.byteLength);
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };

class FakeCaches { constructor() { this.s = new Map(); } async open(name) { if (!this.s.has(name)) this.s.set(name, new Map()); const m = this.s.get(name); return { match: async (u) => m.get(u)?.clone(), put: async (u, r) => { if (this.full) throw new Error('quota'); m.set(u, r); }, delete: async (u) => m.delete(u.url ?? u), keys: async () => [...m.keys()].map((url) => ({ url })) }; } async delete(n) { return this.s.delete(n); } }
const manifest = (hash = 'aaaa', bytes = ab.byteLength) => JSON.stringify({ version: 'v1', assets: [{ file: 'props/medkit.glb', hash, bytes }] });
const mkFetch = (log, over = {}) => async (url) => {
  log.push(url);
  if (url.includes('manifest.json')) return new Response(over.manifest ?? manifest());
  if (over.fail?.(url, log)) return over.fail(url, log);
  return new Response(ab.slice(0), { headers: { 'content-length': String(ab.byteLength) } });
};
const mk = (o = {}) => new ModelStore({ base: 'http://x/a/', backoffMs: 1, warn: () => {}, profile: { lowData: false, prefersLow: false }, ...o });

await t('inspect: accepts real glb, rejects junk', () => {
  assert.ok(inspectGlb(ab).ok);
  assert.equal(inspectGlb(new TextEncoder().encode('<!doctype html><p>404').buffer).reason, 'html-page');
  assert.equal(inspectGlb(new TextEncoder().encode('version https://git-lfs.github.com/spec/v1\noid').buffer).reason, 'lfs-pointer');
  assert.equal(inspectGlb(ab.slice(0, 100)).reason, 'truncated');
  assert.equal(inspectGlb(new ArrayBuffer(4)).reason, 'too-small');
});
await t('unsupported required extension is refused', () => {
  const j = JSON.stringify({ asset: { version: '2.0' }, extensionsRequired: ['KHR_draco_mesh_compression'] }); const pad = j + ' '.repeat((4 - j.length % 4) % 4);
  const b = new Uint8Array(20 + pad.length); const dv = new DataView(b.buffer); dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, b.length, true); dv.setUint32(12, pad.length, true); dv.setUint32(16, 0x4e4f534a, true); b.set(new TextEncoder().encode(pad), 20);
  assert.match(inspectGlb(b.buffer).reason, /unsupported-extension/);
});
await t('downloads once, then serves from cache with zero requests', async () => {
  const log = [], caches = new FakeCaches();
  const a = mk({ fetchFn: mkFetch(log), cacheStorage: caches });
  assert.equal((await a.fetchModel('props/medkit')).source, 'network');
  await new Promise((r) => setTimeout(r, 20));
  const b = mk({ fetchFn: mkFetch(log), cacheStorage: caches }); const before = log.length;
  const r = await b.fetchModel('props/medkit');
  assert.equal(r.source, 'cache'); assert.equal(log.slice(before).filter((u) => u.includes('.glb')).length, 0);
});
await t('same file requested 5x at once = 1 download', async () => {
  const log = []; const s = mk({ fetchFn: mkFetch(log), cacheStorage: null });
  await Promise.all([1, 2, 3, 4, 5].map(() => s.fetchModel('props/medkit')));
  assert.equal(log.filter((u) => u.includes('.glb')).length, 1);
});
await t('changed hash => old copy purged and new one fetched', async () => {
  const log = [], caches = new FakeCaches();
  const a = mk({ fetchFn: mkFetch(log), cacheStorage: caches }); await a.fetchModel('props/medkit'); await new Promise((r) => setTimeout(r, 20));
  const b = mk({ fetchFn: mkFetch(log, { manifest: manifest('bbbb') }), cacheStorage: caches });
  assert.equal((await b.fetchModel('props/medkit')).source, 'network'); await b.purgeStale();
  const keys = [...(await caches.open('vb-models-v1') && caches.s.get('vb-models-v1')).keys()].filter((k) => k.includes('.glb'));
  assert.equal(keys.length, 1); assert.ok(keys[0].includes('v=bbbb'));
});
await t('corrupt cached copy is discarded and re-downloaded', async () => {
  const log = [], caches = new FakeCaches(); const s0 = mk({ fetchFn: mkFetch(log), cacheStorage: caches }); await s0.fetchModel('props/medkit'); await new Promise((r) => setTimeout(r, 20));
  const m = caches.s.get('vb-models-v1'); const k = [...m.keys()].find((x) => x.includes('.glb')); m.set(k, new Response('garbage'));
  assert.equal((await mk({ fetchFn: mkFetch(log), cacheStorage: caches }).fetchModel('props/medkit')).source, 'network');
});
await t('retries a flaky network, then succeeds', async () => {
  let fails = 2; const log = [];
  const s = mk({ fetchFn: mkFetch(log, { fail: (u) => (fails-- > 0 ? new Response('x', { status: 503 }) : null) }), cacheStorage: null });
  assert.equal((await s.fetchModel('props/medkit')).source, 'network');
});
await t('404 is "missing" and is not retried', async () => {
  const log = []; const s = mk({ fetchFn: mkFetch(log, { fail: () => new Response('', { status: 404 }) }), cacheStorage: null });
  await assert.rejects(s.fetchModel('props/medkit'), (e) => e.code === 'missing'); assert.equal(log.filter((u) => u.includes('.glb')).length, 1);
});
await t('HTML error page served with 200 is rejected', async () => {
  const s = mk({ fetchFn: mkFetch([], { fail: () => new Response('<!doctype html><h1>oops</h1>') }), cacheStorage: null, retries: 0 });
  await assert.rejects(s.fetchModel('props/medkit'), (e) => e.code === 'invalid');
});
await t('oversized file refused', async () => {
  const s = mk({ fetchFn: mkFetch([]), cacheStorage: null, maxBytes: 100 });
  await assert.rejects(s.fetchModel('props/medkit'), (e) => e.code === 'toolarge');
});
await t('stalled download times out', async () => {
  const f = async (url, init) => { if (url.includes('manifest')) return new Response(manifest()); return new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))); };
  const s = mk({ fetchFn: f, cacheStorage: null, retries: 0, stallMs: 30 });
  await assert.rejects(s.fetchModel('props/medkit'), (e) => e.code === 'timeout');
});
await t('at most N downloads at once', async () => {
  let cur = 0, peak = 0; const man = JSON.stringify({ version: 'v', assets: Array.from({ length: 8 }, (_, i) => ({ file: `props/p${i}.glb`, hash: 'h' + i })) });
  const f = async (url) => { if (url.includes('manifest')) return new Response(man); cur++; peak = Math.max(peak, cur); await new Promise((r) => setTimeout(r, 15)); cur--; return new Response(ab.slice(0)); };
  const s = mk({ fetchFn: f, cacheStorage: null, concurrency: 2 });
  await Promise.all(Array.from({ length: 8 }, (_, i) => s.fetchModel('props/p' + i))); assert.ok(peak <= 2, 'peak ' + peak);
});
await t('full browser storage does not break loading', async () => {
  const caches = new FakeCaches(); caches.full = true; const s = mk({ fetchFn: mkFetch([]), cacheStorage: caches });
  assert.equal((await s.fetchModel('props/medkit')).source, 'network');
});
await t('no Cache Storage at all still works', async () => {
  assert.equal((await mk({ fetchFn: mkFetch([]), cacheStorage: null }).fetchModel('props/medkit')).source, 'network');
});
await t('manifest down + offline: last good manifest and cached model are used', async () => {
  const log = [], caches = new FakeCaches(); const a = mk({ fetchFn: mkFetch(log), cacheStorage: caches }); await a.fetchModel('props/medkit'); await new Promise((r) => setTimeout(r, 30));
  const off = async () => { throw new Error('offline'); };
  assert.equal((await mk({ fetchFn: off, cacheStorage: caches }).fetchModel('props/medkit')).source, 'cache');
});
await t('manifest missing entirely: still loads by path, nothing cached', async () => {
  const f = async (u) => (u.includes('manifest') ? new Response('', { status: 404 }) : new Response(ab.slice(0)));
  const s = mk({ fetchFn: f, cacheStorage: new FakeCaches() }); assert.equal((await s.fetchModel('props/medkit')).source, 'network'); assert.equal(s.persist, false);
});
await t('dispose rejects waiting work', async () => {
  const s = mk({ fetchFn: mkFetch([]), cacheStorage: null }); s.dispose(); await assert.rejects(s.fetchModel('props/medkit'), (e) => e.code === 'aborted');
});
console.log(`\n${n} passed`);
