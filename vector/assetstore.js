/* ============================================================
   vector/assetstore.js  |  Downloads .glb files ONE AT A TIME, ON DEMAND,
   checks that each one is a real model, and remembers it in the browser.

   There is no Three.js in this file, so it can be tested in Node
   (vector/tests/assets.test.mjs).

   What it does for you
   - Only fetches a model when the game asks for it. Nothing is bulk-downloaded.
   - At most a few downloads run at the same time (priority first).
   - Keeps every downloaded model in the browser's Cache Storage, filed under
     the model's content hash from vector-3dassets/manifest.json. Next visit:
     no network request at all. When you change a model the hash changes, so
     players get the new file automatically and the old copy is deleted.
   - Refuses files that are not really models (an HTML error page, a Git LFS
     stub, a half-finished download, a file needing a decoder we don't ship).
   - Works when Cache Storage is missing or full (private mode, quota): it just
     skips the remembering and carries on.
   ============================================================ */

export const GLB_MAGIC = 0x46546c67;      // "glTF"
const CHUNK_JSON = 0x4e4f534a;            // "JSON"

/* glTF extensions the game's loader can read. A file that REQUIRES anything
   else (Draco, KTX2 ...) would load as a broken model, so it is refused up
   front and the stand-in is used instead. */
export const SUPPORTED_EXTENSIONS = new Set([
  'KHR_materials_unlit', 'KHR_materials_emissive_strength', 'KHR_materials_clearcoat', 'KHR_materials_ior',
  'KHR_materials_sheen', 'KHR_materials_specular', 'KHR_materials_transmission', 'KHR_materials_iridescence',
  'KHR_materials_anisotropy', 'KHR_materials_volume', 'KHR_texture_transform', 'KHR_mesh_quantization',
  'KHR_lights_punctual', 'EXT_materials_bump', 'EXT_texture_webp', 'EXT_texture_avif',
  'EXT_meshopt_compression', 'EXT_mesh_gpu_instancing',
]);

export class AssetError extends Error {
  /* code: missing | invalid | unsupported | toolarge | network | timeout | aborted */
  constructor(code, message) { super(message); this.name = 'AssetError'; this.code = code; }
}

/* Looks at the first bytes of a download and says whether it is a usable .glb.
   Returns { ok:true, json } or { ok:false, reason }. Never throws. */
export function inspectGlb(buffer) {
  try {
    if (!buffer || typeof buffer.byteLength !== 'number') return { ok: false, reason: 'empty' };
    const n = buffer.byteLength;
    if (n < 20) return { ok: false, reason: 'too-small' };
    const dv = new DataView(buffer);
    if (dv.getUint32(0, true) !== GLB_MAGIC) {
      const head = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(n, 64))).trimStart().toLowerCase();
      if (head.startsWith('version https://git-lfs')) return { ok: false, reason: 'lfs-pointer' };
      if (head.startsWith('<!doctype') || head.startsWith('<html')) return { ok: false, reason: 'html-page' };
      return { ok: false, reason: 'not-glb' };
    }
    if (dv.getUint32(4, true) !== 2) return { ok: false, reason: 'bad-version' };
    if (dv.getUint32(8, true) !== n) return { ok: false, reason: 'truncated' };
    const jsonLen = dv.getUint32(12, true);
    if (dv.getUint32(16, true) !== CHUNK_JSON || 20 + jsonLen > n) return { ok: false, reason: 'bad-chunk' };
    let json;
    try { json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLen))); } catch { return { ok: false, reason: 'bad-json' }; }
    if (!json || typeof json !== 'object' || !json.asset) return { ok: false, reason: 'bad-json' };
    for (const ext of json.extensionsRequired || []) {
      if (!SUPPORTED_EXTENSIONS.has(ext)) return { ok: false, reason: 'unsupported-extension:' + ext };
    }
    return { ok: true, json };
  } catch (e) { return { ok: false, reason: 'error:' + (e && e.message) }; }
}

/* How much should this device be spared? */
export function detectProfile(nav = globalThis.navigator) {
  const c = (nav && (nav.connection || nav.mozConnection || nav.webkitConnection)) || null;
  const slow = !!(c && /(^|-)2g$/.test(c.effectiveType || ''));
  const lowData = !!(c && c.saveData) || slow;
  const lowMemory = !!(nav && typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2);
  return { lowData, lowMemory, prefersLow: lowData || lowMemory };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripExt = (f) => f.replace(/\.glb$/i, '');

export class ModelStore {
  /* opts: base (absolute folder URL ending in /), fetchFn, cacheStorage, cacheName,
           concurrency, retries, timeoutMs, stallMs, maxBytes, warn(msg) */
  constructor(opts = {}) {
    this.base = opts.base;
    this.fetchFn = opts.fetchFn || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    this.cacheStorage = 'cacheStorage' in opts ? opts.cacheStorage : (globalThis.caches || null);
    this.cacheName = opts.cacheName || 'vb-models-v1';
    this.concurrency = Math.max(1, opts.concurrency || 3);
    this.retries = opts.retries ?? 2;
    this.timeoutMs = opts.timeoutMs || 45000;
    this.stallMs = opts.stallMs || 20000;
    this.maxBytes = opts.maxBytes || 40 * 1024 * 1024;
    this.backoffMs = opts.backoffMs ?? 400;
    this.warn = opts.warn || ((m) => { try { console.warn('[vector assets] ' + m); } catch { /* ignore */ } });
    this.profile = opts.profile || detectProfile();
    this.entries = new Map();      // "characters/enemy_scout" -> manifest entry
    this.version = null;
    this.manifest = null;
    this.persist = false;          // only remember files when we know their content hash
    this.dead = false;
    this.queue = [];
    this.active = 0;
    this._seq = 0;
    this.inflight = new Map();     // path -> Promise (one download per file, ever)
    this.ac = new AbortController();
    this.stats = { network: 0, cache: 0, bytesNet: 0, failed: 0, evicted: 0 };
    this._cachePromise = null;
    this.ready = null;
  }

  /* ---------- manifest ---------- */
  init() {
    if (!this.ready) this.ready = this._loadManifest().catch((e) => { this.warn('manifest unavailable: ' + (e && e.message)); });
    return this.ready;
  }

  async _loadManifest() {
    const url = new URL('manifest.json', this.base).href;
    let m = null;
    try {
      const res = await this._fetchWithTimeout(url, { cache: 'no-cache' }, 8000);
      if (!res.ok) throw new AssetError('missing', 'manifest HTTP ' + res.status);
      m = await res.json();
      this._remember('__manifest.json', JSON.stringify(m));
    } catch (e) {
      m = await this._recall('__manifest.json');          // offline / server hiccup: last good copy
      if (!m) throw e;
    }
    if (!m || !Array.isArray(m.assets)) throw new AssetError('invalid', 'manifest has no assets list');
    this.manifest = m;
    this.version = m.version ? String(m.version) : null;
    for (const a of m.assets) { if (a && a.file) this.entries.set(stripExt(a.file), a); }
    this.persist = !!this.version;
    this.purgeStale().catch(() => {});
  }

  /* Which file should be fetched for this model on this device? */
  resolve(path) {
    const e = this.entries.get(path) || null;
    if (e && e.lo && this.profile.prefersLow) return { file: e.lo.file, entry: e.lo, lo: true };
    return { file: e ? e.file : path + '.glb', entry: e, lo: false };
  }

  info(path) { return this.entries.get(path) || null; }
  has(path) { return this.entries.size === 0 || this.entries.has(path); }

  urlFor(file, entry) {
    const u = new URL(file, this.base);
    if (entry && entry.hash) u.searchParams.set('v', entry.hash);
    return u.href;
  }

  /* ---------- public: get the raw bytes of one model ---------- */
  /* Resolves { buffer, source, json, lo }. Rejects with AssetError. Never starts
     a second download for a file that is already coming. */
  fetchModel(path, { priority = 0, signal = null, onProgress = null } = {}) {
    if (this.dead) return Promise.reject(new AssetError('aborted', 'store disposed'));
    const key = path;
    let p = this.inflight.get(key);
    if (!p) {
      p = this._schedule(priority, key, () => this._get(path)).finally(() => this.inflight.delete(key));
      this.inflight.set(key, p);
    } else {
      // someone already asked for it: if this caller is more urgent, move it up
      for (const t of this.queue) if (t.key === key && priority > t.priority) { t.priority = priority; this._sort(); }
    }
    if (onProgress) p.then(() => onProgress(1), () => {});
    if (signal) {
      return Promise.race([p, new Promise((_, rej) => { if (signal.aborted) rej(new AssetError('aborted', 'cancelled')); else signal.addEventListener('abort', () => rej(new AssetError('aborted', 'cancelled')), { once: true }); })]);
    }
    return p;
  }

  /* Download into the cache only (idle time, nothing is parsed). Errors are ignored. */
  prefetch(paths) {
    if (this.dead || this.profile.lowData || (typeof navigator !== 'undefined' && navigator.onLine === false)) return Promise.resolve();
    return Promise.all(paths.map((p) => this.fetchModel(p, { priority: -10 }).catch(() => null))).then(() => {});
  }

  /* ---------- queue ---------- */
  _sort() { this.queue.sort((a, b) => b.priority - a.priority || a.seq - b.seq); }
  _schedule(priority, key, fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ priority, seq: ++this._seq, key, run: fn, resolve, reject });
      this._sort(); this._pump();
    });
  }
  _pump() {
    while (!this.dead && this.active < this.concurrency && this.queue.length) {
      const t = this.queue.shift(); this.active++;
      Promise.resolve().then(t.run).then(t.resolve, t.reject).finally(() => { this.active--; this._pump(); });
    }
  }

  /* ---------- one model: cache first, then network ---------- */
  async _get(path) {
    await this.init();
    if (this.dead) throw new AssetError('aborted', 'store disposed');
    const { file, entry, lo } = this.resolve(path);
    const url = this.urlFor(file, entry);
    const canKeep = this.persist && !!(entry && entry.hash);

    if (canKeep) {
      const hit = await this._cacheGet(url);
      if (hit) {
        const check = inspectGlb(hit);
        if (check.ok && (!entry.bytes || entry.bytes === hit.byteLength)) { this.stats.cache++; return { buffer: hit, source: 'cache', json: check.json, lo }; }
        await this._cacheDelete(url);                       // damaged copy: forget it and download again
      }
    }

    const buffer = await this._download(url);
    const check = inspectGlb(buffer);
    if (!check.ok) {
      const unsupported = check.reason.startsWith('unsupported');
      throw new AssetError(unsupported ? 'unsupported' : check.reason === 'truncated' ? 'network' : 'invalid', `${file}: ${check.reason}`);
    }
    this.stats.network++; this.stats.bytesNet += buffer.byteLength;
    if (canKeep && (!entry.bytes || entry.bytes === buffer.byteLength)) this._cachePut(url, buffer);   // not awaited: never delays the game
    else if (canKeep) this.warn(`${file}: size differs from manifest.json (re-run tools/build-manifest.mjs); not cached`);
    return { buffer, source: 'network', json: check.json, lo };
  }

  /* ---------- network ---------- */
  async _fetchWithTimeout(url, init, ms) {
    if (!this.fetchFn) throw new AssetError('network', 'fetch is not available');
    const ac = new AbortController();
    const onAbort = () => ac.abort();
    this.ac.signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => ac.abort(), ms);
    try { return await this.fetchFn(url, { ...init, signal: ac.signal }); }
    catch (e) { throw this.dead ? new AssetError('aborted', 'store disposed') : new AssetError(ac.signal.aborted ? 'timeout' : 'network', (e && e.message) || 'network error'); }
    finally { clearTimeout(timer); this.ac.signal.removeEventListener('abort', onAbort); }
  }

  async _download(url) {
    let lastErr = null;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (this.dead) throw new AssetError('aborted', 'store disposed');
      if (attempt > 0) await sleep(this.backoffMs * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5));
      try { return await this._downloadOnce(url); }
      catch (e) {
        lastErr = e;
        if (!(e instanceof AssetError) || e.code === 'missing' || e.code === 'toolarge' || e.code === 'aborted') break;   // retrying will not help
      }
    }
    this.stats.failed++;
    throw lastErr;
  }

  async _downloadOnce(url) {
    const ac = new AbortController();
    const onAbort = () => ac.abort();
    this.ac.signal.addEventListener('abort', onAbort, { once: true });
    let stall = null, total = null;
    const poke = () => { clearTimeout(stall); stall = setTimeout(() => ac.abort(), this.stallMs); };
    const hard = setTimeout(() => ac.abort(), this.timeoutMs);
    try {
      poke();
      let res;
      try { res = await this.fetchFn(url, { signal: ac.signal }); }
      catch (e) { throw this.dead ? new AssetError('aborted', 'store disposed') : new AssetError(ac.signal.aborted ? 'timeout' : 'network', (e && e.message) || 'network error'); }
      if (!res.ok) throw new AssetError(res.status >= 500 || res.status === 429 ? 'network' : 'missing', 'HTTP ' + res.status);
      const len = Number(res.headers && res.headers.get && res.headers.get('content-length'));
      if (len > this.maxBytes) throw new AssetError('toolarge', `file is ${len} bytes (limit ${this.maxBytes})`);
      let buf;
      try {
        if (res.body && res.body.getReader) {
          const reader = res.body.getReader(), parts = []; let got = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            parts.push(value); got += value.byteLength; poke();
            if (got > this.maxBytes) { try { reader.cancel(); } catch { /* ignore */ } throw new AssetError('toolarge', 'download exceeded limit'); }
          }
          const out = new Uint8Array(got); let off = 0;
          for (const p of parts) { out.set(p, off); off += p.byteLength; }
          buf = out.buffer;
        } else buf = await res.arrayBuffer();
      } catch (e) {
        if (e instanceof AssetError) throw e;
        throw this.dead ? new AssetError('aborted', 'store disposed') : new AssetError(ac.signal.aborted ? 'timeout' : 'network', (e && e.message) || 'download interrupted');
      }
      total = buf.byteLength;
      if (Number.isFinite(len) && len > 0 && total !== len) throw new AssetError('network', `truncated (${total}/${len})`);
      return buf;
    } finally { clearTimeout(stall); clearTimeout(hard); this.ac.signal.removeEventListener('abort', onAbort); void total; }
  }

  /* ---------- Cache Storage (every call is allowed to fail quietly) ---------- */
  _cache() {
    if (!this.cacheStorage) return Promise.resolve(null);
    if (!this._cachePromise) this._cachePromise = Promise.resolve().then(() => this.cacheStorage.open(this.cacheName)).catch(() => null);
    return this._cachePromise;
  }
  async _cacheGet(url) {
    try { const c = await this._cache(); if (!c) return null; const r = await c.match(url); return r ? await r.arrayBuffer() : null; } catch { return null; }
  }
  async _cacheDelete(url) { try { const c = await this._cache(); if (c) await c.delete(url); } catch { /* ignore */ } }
  async _cachePut(url, buffer) {
    const c = await this._cache(); if (!c) return;
    const make = () => new Response(buffer.slice(0), { headers: { 'content-type': 'model/gltf-binary', 'content-length': String(buffer.byteLength), 'x-vb-stored': String(Date.now()) } });
    try { await c.put(url, make()); return; } catch { /* usually: quota full */ }
    try { await this._evictOldest(Math.max(2, Math.ceil(buffer.byteLength / (1024 * 1024)))); await c.put(url, make()); }
    catch { this.warn('browser storage is full; models will be downloaded again next time'); }
  }
  async _remember(name, text) {
    try { const c = await this._cache(); if (c) await c.put(new URL(name, this.base).href, new Response(text, { headers: { 'content-type': 'application/json' } })); } catch { /* ignore */ }
  }
  async _recall(name) {
    try { const c = await this._cache(); if (!c) return null; const r = await c.match(new URL(name, this.base).href); return r ? await r.json() : null; } catch { return null; }
  }
  /* Oldest stored models go first (Cache Storage lists entries oldest-first). */
  async _evictOldest(count) {
    const c = await this._cache(); if (!c) return;
    const keep = new URL('__manifest.json', this.base).href;
    const keys = await c.keys(); let n = 0;
    for (const r of keys) { if (r.url === keep) continue; if (await c.delete(r)) { this.stats.evicted++; if (++n >= count) break; } }
  }
  /* After a model changes (new hash) or is removed, delete the old copies. */
  async purgeStale() {
    const c = await this._cache(); if (!c || !this.version) return 0;
    const live = new Set();
    for (const [, e] of this.entries) {
      live.add(this.urlFor(e.file, e));
      if (e.lo) live.add(this.urlFor(e.lo.file, e.lo));
    }
    live.add(new URL('__manifest.json', this.base).href);
    let n = 0;
    for (const r of await c.keys()) {
      if (r.url.startsWith(this.base) && !live.has(r.url)) { if (await c.delete(r)) { n++; this.stats.evicted++; } }
    }
    return n;
  }
  async clear() { try { if (this.cacheStorage) await this.cacheStorage.delete(this.cacheName); } catch { /* ignore */ } this._cachePromise = null; }

  dispose() {
    this.dead = true;
    try { this.ac.abort(); } catch { /* ignore */ }
    for (const t of this.queue) t.reject(new AssetError('aborted', 'store disposed'));
    this.queue.length = 0;
  }
}
