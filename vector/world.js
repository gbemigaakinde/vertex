/* ============================================================
   vector/world.js  |  Pure world data + spatial queries + navigation.
   Maps are generated deterministically from code, so the browser and
   the multiplayer server always build the exact same world.
   Units are metres. +Y is up. Doors open on interact.
   ============================================================ */
import { rayBox } from './combat.js';

/* ---------- small deterministic RNG ---------- */
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function rnd() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ---------- GameMap: boxes + broadphase + nav ---------- */
const CELL = 8;

export class GameMap {
  constructor(id, name, half) {
    this.id = id; this.name = name; this.half = half;
    this.boxes = [];
    this.decor = [];            // non-colliding visuals
    this.zones = {};            // named circles {x,z,r}
    this.spawns = { players: [], ffa: [], teamA: [], teamB: [] };
    this.pickups = [];          // {type,x,z}
    this.barrels = [];          // explosive hazards {x,z}
    this.hazards = [];          // {type,x,z,w,d,dps}
    this.env = { sky: '#8fa3b5', fog: 0.012, sun: 1.0, ambient: 0.55, indoor: false, ground: '#4a4d47' };
    this._grid = new Map();
    this._nextId = 1;
    this._stamp = 0;
    this.nav = null;
  }

  addBox(b) {
    b.id = b.id || 'b' + (this._nextId++);
    b.minX = b.x - b.w / 2; b.maxX = b.x + b.w / 2;
    b.minZ = b.z - b.d / 2; b.maxZ = b.z + b.d / 2;
    b.minY = b.y; b.maxY = b.y + b.h;
    b.solid = b.solid !== false;
    b._stamp = 0;
    this.boxes.push(b);
    this._index(b);
    return b;
  }

  removeBox(b) {
    const i = this.boxes.indexOf(b);
    if (i >= 0) this.boxes.splice(i, 1);
    for (const list of this._grid.values()) {
      const k = list.indexOf(b);
      if (k >= 0) list.splice(k, 1);
    }
  }

  _key(cx, cz) { return cx * 4096 + cz; }
  _index(b) {
    const x0 = Math.floor(b.minX / CELL), x1 = Math.floor(b.maxX / CELL);
    const z0 = Math.floor(b.minZ / CELL), z1 = Math.floor(b.maxZ / CELL);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const k = this._key(x, z);
      let l = this._grid.get(k);
      if (!l) { l = []; this._grid.set(k, l); }
      l.push(b);
    }
  }

  /* Boxes overlapping an XZ rectangle. */
  query(minX, minZ, maxX, maxZ) {
    const out = [];
    const st = ++this._stamp;
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const l = this._grid.get(this._key(x, z));
      if (!l) continue;
      for (const b of l) {
        if (b._stamp === st) continue;
        b._stamp = st;
        if (b.maxX < minX || b.minX > maxX || b.maxZ < minZ || b.minZ > maxZ) continue;
        out.push(b);
      }
    }
    return out;
  }

  isBlockingBox(b) { return b.solid && !(b.door && b.open); }

  /* First solid thing along a ray. Returns { t, box } or null. */
  raycast(o, d, maxT = 100, opts = {}) {
    let best = null;
    const st = ++this._stamp;
    const steps = Math.ceil(maxT / (CELL * 0.5));
    for (let i = 0; i <= steps; i++) {
      const t = Math.min(maxT, i * CELL * 0.5);
      const cx = Math.floor((o.x + d.x * t) / CELL), cz = Math.floor((o.z + d.z * t) / CELL);
      // check the cell and its neighbours so a ray skimming a boundary is safe
      for (let ax = -1; ax <= 1; ax++) for (let az = -1; az <= 1; az++) {
        const l = this._grid.get(this._key(cx + ax, cz + az));
        if (!l) continue;
        for (const b of l) {
          if (b._stamp === st) continue;
          b._stamp = st;
          if (!this.isBlockingBox(b)) continue;
          if (opts.ignore && opts.ignore === b) continue;
          const tt = rayBox(o, d, b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ, best ? best.t : maxT);
          if (tt >= 0 && (!best || tt < best.t)) best = { t: tt, box: b };
        }
      }
      if (best && best.t <= t) break;
    }
    return best;
  }

  /* Line of sight between two 3D points (walls only). */
  clearLine(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.01) return true;
    const d = { x: dx / len, y: dy / len, z: dz / len };
    const hit = this.raycast(a, d, len - 0.05);
    return !hit;
  }

  /* Highest walkable surface under a circle that the player can step onto. */
  groundAt(x, z, r, yRef, stepUp) {
    let g = 0;
    for (const b of this.query(x - r, z - r, x + r, z + r)) {
      if (!this.isBlockingBox(b)) continue;
      if (b.maxY <= yRef + stepUp + 1e-4 && b.maxY > g) {
        // circle vs rect
        const cx = Math.max(b.minX, Math.min(x, b.maxX)), cz = Math.max(b.minZ, Math.min(z, b.maxZ));
        if ((cx - x) * (cx - x) + (cz - z) * (cz - z) <= r * r * 0.8) g = b.maxY;
      }
    }
    return g;
  }

  /* Lowest ceiling above a head. */
  ceilingAt(x, z, r, yTop) {
    let c = Infinity;
    for (const b of this.query(x - r, z - r, x + r, z + r)) {
      if (!this.isBlockingBox(b)) continue;
      if (b.minY >= yTop - 0.15 && b.minY < c) c = b.minY;
    }
    return c;
  }

  /* Push a circle out of any obstacle box it overlaps. Mutates p.x/p.z. */
  resolveCircle(p, r, height, stepUp) {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const b of this.query(p.x - r, p.z - r, p.x + r, p.z + r)) {
        if (!this.isBlockingBox(b)) continue;
        if (b.maxY <= p.y + stepUp + 1e-4) continue;   // walkable, not an obstacle
        if (b.minY >= p.y + height - 0.05) continue;    // above our head
        const cx = Math.max(b.minX, Math.min(p.x, b.maxX)), cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
        let dx = p.x - cx, dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = r - d;
          p.x += (dx / d) * push; p.z += (dz / d) * push;
        } else {
          // centre inside box: push along smallest penetration axis
          const l = p.x - b.minX, rr = b.maxX - p.x, u = p.z - b.minZ, dn = b.maxZ - p.z;
          const m = Math.min(l, rr, u, dn);
          if (m === l) p.x = b.minX - r; else if (m === rr) p.x = b.maxX + r;
          else if (m === u) p.z = b.minZ - r; else p.z = b.maxZ + r;
        }
        moved = true;
      }
      if (!moved) break;
    }
    const lim = this.half - r;
    p.x = Math.max(-lim, Math.min(lim, p.x));
    p.z = Math.max(-lim, Math.min(lim, p.z));
  }

  /* ---------- navigation grid ---------- */
  buildNav() {
    const n = Math.ceil(this.half * 2);
    const nav = { n, size: 1, origin: -this.half, blocked: new Uint8Array(n * n) };
    for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
      const x = nav.origin + ix + 0.5, z = nav.origin + iz + 0.5;
      let blocked = 0;
      for (const b of this.query(x - 0.6, z - 0.6, x + 0.6, z + 0.6)) {
        if (!b.solid || b.door) continue;         // doors are passable for AI (opened on approach)
        if (b.maxY <= 0.6 || b.minY >= 2.0) continue;
        if (x > b.minX - 0.45 && x < b.maxX + 0.45 && z > b.minZ - 0.45 && z < b.maxZ + 0.45) { blocked = 1; break; }
      }
      nav.blocked[iz * n + ix] = blocked;
    }
    this.nav = nav;
    return nav;
  }

  cellOf(x, z) {
    const nav = this.nav;
    return { ix: Math.floor(x - nav.origin), iz: Math.floor(z - nav.origin) };
  }
  cellCenter(ix, iz) { return { x: this.nav.origin + ix + 0.5, z: this.nav.origin + iz + 0.5 }; }
  walkable(ix, iz) {
    const n = this.nav.n;
    return ix >= 0 && iz >= 0 && ix < n && iz < n && !this.nav.blocked[iz * n + ix];
  }
  isWalkable(x, z) { const c = this.cellOf(x, z); return this.walkable(c.ix, c.iz); }

  /* Closest walkable cell centre to (x,z). */
  snapWalkable(x, z, maxR = 8) {
    const c = this.cellOf(x, z);
    if (this.walkable(c.ix, c.iz)) return this.cellCenter(c.ix, c.iz);
    for (let r = 1; r <= maxR; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (this.walkable(c.ix + dx, c.iz + dz)) return this.cellCenter(c.ix + dx, c.iz + dz);
      }
    }
    return null;
  }

  /* A* path on the nav grid. Returns array of {x,z} or null. */
  findPath(from, to, maxNodes = 4000) {
    if (!this.nav) this.buildNav();
    const s = this.cellOf(from.x, from.z);
    let g = this.cellOf(to.x, to.z);
    const n = this.nav.n;
    if (!this.walkable(g.ix, g.iz)) {
      const sn = this.snapWalkable(to.x, to.z, 6);
      if (!sn) return null;
      g = this.cellOf(sn.x, sn.z);
    }
    if (!this.walkable(s.ix, s.iz)) {
      const sn = this.snapWalkable(from.x, from.z, 4);
      if (!sn) return null;
      const c = this.cellOf(sn.x, sn.z); s.ix = c.ix; s.iz = c.iz;
    }
    const idx = (ix, iz) => iz * n + ix;
    const start = idx(s.ix, s.iz), goal = idx(g.ix, g.iz);
    if (start === goal) return [this.cellCenter(g.ix, g.iz)];
    const gScore = new Map([[start, 0]]);
    const came = new Map();
    const heap = [[0, start]];
    const push = (item) => { heap.push(item); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const closed = new Set();
    let expanded = 0;
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
    while (heap.length && expanded < maxNodes) {
      const [, cur] = pop();
      if (cur === goal) {
        const path = [];
        let c = cur;
        while (c !== start) { const ix = c % n, iz = (c / n) | 0; path.push(this.cellCenter(ix, iz)); c = came.get(c); }
        path.reverse();
        return this._smooth(from, path);
      }
      if (closed.has(cur)) continue;
      closed.add(cur); expanded++;
      const cx = cur % n, cz = (cur / n) | 0;
      for (const [dx, dz, cost] of DIRS) {
        const nx = cx + dx, nz = cz + dz;
        if (!this.walkable(nx, nz)) continue;
        if (dx && dz && (!this.walkable(cx + dx, cz) || !this.walkable(cx, cz + dz))) continue;
        const ni = idx(nx, nz);
        if (closed.has(ni)) continue;
        const ng = gScore.get(cur) + cost;
        if (ng < (gScore.get(ni) ?? Infinity)) {
          gScore.set(ni, ng); came.set(ni, cur);
          const h = Math.hypot(g.ix - nx, g.iz - nz);
          push([ng + h, ni]);
        }
      }
    }
    return null;
  }

  /* Remove waypoints that are not needed (grid line of sight). */
  _smooth(from, path) {
    if (path.length < 3) return path;
    const out = [];
    let anchor = from;
    let i = 0;
    while (i < path.length) {
      let j = path.length - 1;
      while (j > i && !this._gridLine(anchor, path[j])) j--;
      out.push(path[j]);
      anchor = path[j];
      i = j + 1;
    }
    return out;
  }
  _gridLine(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / 0.5);
    for (let i = 1; i < steps; i++) {
      const x = a.x + (dx * i) / steps, z = a.z + (dz * i) / steps;
      if (!this.isWalkable(x, z)) return false;
      // widen check by sampling either side
      const nx = -dz / len * 0.35, nz = dx / len * 0.35;
      if (!this.isWalkable(x + nx, z + nz) || !this.isWalkable(x - nx, z - nz)) return false;
    }
    return true;
  }

  /* Random walkable point within radius of a centre. */
  randomWalkable(cx, cz, r, rnd, tries = 30) {
    for (let i = 0; i < tries; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (this.isWalkable(x, z)) return { x, z };
    }
    return this.snapWalkable(cx, cz, 6);
  }
}

/* ============================================================
   Map building helpers
   ============================================================ */
const T = 0.4; // wall thickness

function room(map, cx, cz, w, d, o = {}) {
  const h = o.h ?? 3.2, doorW = o.doorW ?? 2.4, kind = o.kind || 'building';
  const doors = Array.isArray(o.door) ? o.door : (o.door ? [o.door] : []);
  const color = o.color || '#6b6f72';
  const seg = (x, z, sw, sd, extra = {}) => {
    if (sw <= 0.05 || sd <= 0.05) return;
    map.addBox({ x, z, w: sw, d: sd, y: 0, h, kind, color, ...extra });
  };
  const sides = {
    n: { horizontal: true, z: cz - d / 2, len: w, cx },
    s: { horizontal: true, z: cz + d / 2, len: w, cx },
    w: { horizontal: false, x: cx - w / 2, len: d, cz },
    e: { horizontal: false, x: cx + w / 2, len: d, cz },
  };
  for (const key of ['n', 's', 'w', 'e']) {
    const s = sides[key];
    const hasDoor = doors.includes(key);
    if (s.horizontal) {
      if (!hasDoor) { seg(s.cx, s.z, s.len + T, T); continue; }
      const half = (s.len - doorW) / 2;
      seg(s.cx - (doorW / 2 + half / 2), s.z, half, T);
      seg(s.cx + (doorW / 2 + half / 2), s.z, half, T);
      map.addBox({ x: s.cx, z: s.z, w: doorW, d: 0.25, y: 0, h: 2.6, kind: 'door', door: true, open: false, color: '#4d3f2f' });
      map.addBox({ x: s.cx, z: s.z, w: doorW, d: T, y: 2.6, h: h - 2.6, kind, color, solid: true });
    } else {
      if (!hasDoor) { seg(s.x, s.cz, T, s.len - T); continue; }
      const half = (s.len - doorW) / 2;
      seg(s.x, s.cz - (doorW / 2 + half / 2), T, half);
      seg(s.x, s.cz + (doorW / 2 + half / 2), T, half);
      map.addBox({ x: s.x, z: s.cz, w: 0.25, d: doorW, y: 0, h: 2.6, kind: 'door', door: true, open: false, color: '#4d3f2f' });
      map.addBox({ x: s.x, z: s.cz, w: T, d: doorW, y: 2.6, h: h - 2.6, kind, color, solid: true });
    }
  }
  if (o.roof !== false) map.addBox({ x: cx, z: cz, w: w + T, d: d + T, y: h, h: 0.3, kind: 'roof', color: '#3f4346' });
  map.decor.push({ type: 'floor', x: cx, z: cz, w, d, color: o.floor || '#55585a' });
  return { cx, cz, w, d, h };
}

/* Stairs rising along +x/-x/+z/-z from (x,z) start. */
function stairs(map, x, z, dir, steps, width = 2.0, rise = 0.44, run = 0.9, color = '#5c5f61') {
  for (let i = 0; i < steps; i++) {
    const off = i * run + run / 2;
    const sx = dir === 'e' ? x + off : dir === 'w' ? x - off : x;
    const sz = dir === 's' ? z + off : dir === 'n' ? z - off : z;
    const bw = dir === 'e' || dir === 'w' ? run : width, bd = dir === 'e' || dir === 'w' ? width : run;
    map.addBox({ x: sx, z: sz, w: bw, d: bd, y: 0, h: rise * (i + 1), kind: 'stairs', color });
  }
}

function prop(map, model, x, z, w, d, h, kind = 'cover', o = {}) {
  return map.addBox({ x, z, w, d, y: o.y || 0, h, kind, model, color: o.color, ...o.extra });
}

/* Scatter cover with rejection sampling. */
function scatter(map, rnd, count, kinds, keepClear) {
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 30) {
    tries++;
    const k = kinds[Math.floor(rnd() * kinds.length)];
    const x = (rnd() * 2 - 1) * (map.half - 4), z = (rnd() * 2 - 1) * (map.half - 4);
    const w = k.w, d = k.d;
    const flip = k.rot && rnd() < 0.5;
    const bw = flip ? d : w, bd = flip ? w : d;
    let bad = false;
    for (const c of keepClear) if (Math.hypot(x - c.x, z - c.z) < (c.r + Math.max(bw, bd) / 2)) { bad = true; break; }
    if (bad) continue;
    if (map.query(x - bw / 2 - 1.4, z - bd / 2 - 1.4, x + bw / 2 + 1.4, z + bd / 2 + 1.4).length) continue;
    const b = prop(map, k.model, x, z, bw, bd, k.h, 'cover', { color: k.color, extra: { rotated: flip } });
    if (k.explosive) { b.explosive = true; b.hp = 30; map.barrels.push({ x, z, id: b.id }); }
    placed++;
  }
}

function perimeter(map, h = 4.5, color = '#3a3d40') {
  const H = map.half;
  map.addBox({ x: 0, z: -H, w: H * 2 + 2, d: 1, y: 0, h, kind: 'boundary', color });
  map.addBox({ x: 0, z: H, w: H * 2 + 2, d: 1, y: 0, h, kind: 'boundary', color });
  map.addBox({ x: -H, z: 0, w: 1, d: H * 2, y: 0, h, kind: 'boundary', color });
  map.addBox({ x: H, z: 0, w: 1, d: H * 2, y: 0, h, kind: 'boundary', color });
}

function finalize(map, seed, cfg) {
  const rnd = makeRng(seed);
  // Zones and required clear areas
  const keep = [];
  for (const [k, z] of Object.entries(map.zones)) keep.push({ x: z.x, z: z.z, r: k === 'START' || k === 'EXTRACT' ? 7 : 3.5 });
  for (const b of cfg.rooms || []) keep.push({ x: b.cx, z: b.cz, r: 0 });
  // Reserve a clear apron in front of every door so nothing blocks it
  for (const b of map.boxes) if (b.door) keep.push({ x: b.x, z: b.z, r: 3.6 });
  scatter(map, rnd, cfg.cover, cfg.kinds, keep);
  map.buildNav();
  // Supplies
  const supply = ['ammo', 'health', 'ammo', 'armor', 'ammo', 'health'];
  let i = 0;
  for (const zk of ['A', 'B', 'C', 'D', 'E', 'F']) {
    const z = map.zones[zk]; if (!z) continue;
    const p = map.randomWalkable(z.x, z.z, Math.max(2, z.r * 0.7), rnd);
    if (p) map.pickups.push({ type: supply[i++ % supply.length], x: p.x, z: p.z });
  }
  for (let n = 0; n < 8; n++) {
    const p = map.randomWalkable((rnd() * 2 - 1) * map.half * 0.8, (rnd() * 2 - 1) * map.half * 0.8, 6, rnd);
    if (p) map.pickups.push({ type: supply[(i++) % supply.length], x: p.x, z: p.z });
  }
  // Deathmatch spawns spread around walkable open ground
  const ring = 12;
  for (let n = 0; n < ring; n++) {
    const a = (n / ring) * Math.PI * 2, rad = map.half * (0.35 + 0.35 * ((n * 7) % 3) / 2);
    const p = map.snapWalkable(Math.cos(a) * rad, Math.sin(a) * rad, 10);
    if (p) map.spawns.ffa.push({ x: p.x, z: p.z, yaw: Math.atan2(p.x, p.z) });
  }
  const half = Math.floor(map.spawns.ffa.length / 2);
  map.spawns.teamA = map.spawns.ffa.filter((s) => s.x + s.z < 0).slice(0, 8);
  map.spawns.teamB = map.spawns.ffa.filter((s) => s.x + s.z >= 0).slice(0, 8);
  if (map.spawns.teamA.length < 2) map.spawns.teamA = map.spawns.ffa.slice(0, half);
  if (map.spawns.teamB.length < 2) map.spawns.teamB = map.spawns.ffa.slice(half);
  const st = map.zones.START;
  for (let n = 0; n < 4; n++) {
    const p = map.snapWalkable(st.x + (n - 1.5) * 1.6, st.z + (n % 2) * 1.2, 6);
    map.spawns.players.push({ x: p.x, z: p.z, yaw: st.yaw || 0 });
  }
  return map;
}

const CRATE = { model: 'environment/crate', w: 1.1, d: 1.1, h: 1.1 };
const CRATE_BIG = { model: 'environment/crate', w: 1.8, d: 1.8, h: 1.6, rot: false };
const CONTAINER = { model: 'environment/container', w: 6.0, d: 2.5, h: 2.6, rot: true };
const BARRIER = { model: 'environment/barrier', w: 2.2, d: 0.7, h: 0.95, rot: true };
const SANDBAGS = { model: 'environment/sandbags', w: 2.2, d: 0.7, h: 1.05, rot: true };
const BARRELS = { model: 'environment/barrels', w: 1.6, d: 0.9, h: 1.0, rot: true };
const BARREL_X = { model: 'environment/barrels', w: 0.8, d: 0.8, h: 1.0, explosive: true, color: '#a5462e' };
const LIGHT = { model: 'environment/light_post', w: 0.35, d: 0.35, h: 5.5 };
const TENT = { model: 'environment/tent', w: 3.2, d: 2.4, h: 1.9, rot: true };
const JEEP = { model: 'vehicles/jeep_4x4', w: 4.4, d: 2.1, h: 1.8, rot: true };
const TREE = { model: null, w: 0.7, d: 0.7, h: 7, color: '#4a3a2a', tree: true };
const RACK = { model: null, w: 1.0, d: 2.4, h: 2.2, color: '#22272b', rack: true, rot: true };

/* ---------- 1. Industrial District ---------- */
function industrial() {
  const m = new GameMap('industrial', 'Industrial District', 48);
  m.env = { sky: '#a5b0b8', fog: 0.010, sun: 1.0, ambient: 0.6, indoor: false, ground: '#54574f' };
  perimeter(m);
  const r1 = room(m, -12, 18, 20, 14, { door: 's' });
  const r2 = room(m, 22, 12, 18, 16, { door: 'w' });
  const r3 = room(m, -30, -8, 14, 22, { door: 'e' });
  const r4 = room(m, 28, -26, 24, 16, { door: 's' });
  const r5 = room(m, -8, -30, 16, 12, { door: 'e', h: 3.0 });
  // roof access on warehouse 2 (east side): 8 steps
  stairs(m, r2.cx + r2.w / 2 + 0.2, r2.cz - 4, 'e', 8, 2.2);
  m.zones = {
    START: { x: -40, z: 38, r: 6, yaw: -0.6 },
    A: { x: r1.cx, z: r1.cz, r: 5 }, B: { x: r2.cx, z: r2.cz, r: 5 }, C: { x: r3.cx, z: r3.cz, r: 5 },
    D: { x: r4.cx, z: r4.cz, r: 6 }, E: { x: r5.cx, z: r5.cz, r: 4 }, F: { x: 2, z: 0, r: 5 },
    EXTRACT: { x: 40, z: 40, r: 5 },
  };
  m.decor.push({ type: 'road', x: 0, z: 0, w: 6, d: 96, color: '#2f3235' }, { type: 'road', x: 0, z: 2, w: 96, d: 6, color: '#2f3235' });
  for (const b of [r1, r2, r3, r4, r5]) m.decor.push({ type: 'floor', x: b.cx, z: b.cz, w: b.w, d: b.d, color: '#5a5c5b' });
  return finalize(m, 1101, { rooms: [r1, r2, r3, r4, r5], cover: 60, kinds: [CRATE, CRATE_BIG, CONTAINER, CONTAINER, BARRIER, BARRELS, BARREL_X, BARREL_X, SANDBAGS, LIGHT] });
}

/* ---------- 2. Urban Block ---------- */
function urban() {
  const m = new GameMap('urban', 'Urban Block', 42);
  m.env = { sky: '#b6a58f', fog: 0.014, sun: 0.9, ambient: 0.55, indoor: false, ground: '#4c4b48' };
  perimeter(m, 5.5, '#4a4642');
  const a = room(m, -22, -20, 16, 14, { door: 's', h: 4.0, color: '#8a7a68' });
  const b = room(m, 0, -22, 14, 12, { door: 'e', h: 3.6, color: '#77706a' });
  const c = room(m, 22, -18, 16, 16, { door: 'w', h: 4.2, color: '#807565' });
  const d = room(m, -24, 14, 14, 16, { door: 'n', h: 3.6, color: '#6f6b66' });
  const e = room(m, 2, 12, 16, 14, { door: ['s', 'w'], h: 3.6, color: '#8c7f6d' });
  const f = room(m, 26, 20, 14, 12, { door: 'n', h: 3.2, color: '#75706a' });
  stairs(m, a.cx - a.w / 2 - 0.2, a.cz - 3, 'w', 9, 2.0);
  stairs(m, e.cx + e.w / 2 + 0.2, e.cz + 2, 'e', 8, 2.0);
  m.zones = {
    START: { x: -36, z: 36, r: 5, yaw: -0.5 },
    A: { x: a.cx, z: a.cz, r: 4.5 }, B: { x: b.cx, z: b.cz, r: 4 }, C: { x: c.cx, z: c.cz, r: 5 },
    D: { x: d.cx, z: d.cz, r: 4.5 }, E: { x: e.cx, z: e.cz, r: 5 }, F: { x: f.cx, z: f.cz, r: 4 },
    EXTRACT: { x: 36, z: 36, r: 4.5 },
  };
  m.decor.push({ type: 'road', x: 0, z: -4, w: 84, d: 6, color: '#2d2f31' }, { type: 'road', x: -10, z: 0, w: 5, d: 84, color: '#2d2f31' }, { type: 'road', x: 14, z: 0, w: 5, d: 84, color: '#2d2f31' });
  for (const r of [a, b, c, d, e, f]) m.decor.push({ type: 'floor', x: r.cx, z: r.cz, w: r.w, d: r.d, color: '#5f5c58' });
  return finalize(m, 2202, { rooms: [a, b, c, d, e, f], cover: 48, kinds: [JEEP, BARRIER, CRATE, SANDBAGS, BARRELS, LIGHT, CRATE_BIG] });
}

/* ---------- 3. Research Compound (forest) ---------- */
function research() {
  const m = new GameMap('research', 'Research Compound', 55);
  m.env = { sky: '#7d9483', fog: 0.02, sun: 0.85, ambient: 0.5, indoor: false, ground: '#31402c' };
  perimeter(m, 5, '#26301f');
  // Fenced compound in the centre
  const fence = (x1, z1, x2, z2) => {
    const horiz = z1 === z2;
    m.addBox({ x: (x1 + x2) / 2, z: (z1 + z2) / 2, w: horiz ? Math.abs(x2 - x1) : 0.3, d: horiz ? 0.3 : Math.abs(z2 - z1), y: 0, h: 2.6, kind: 'fence', color: '#59605a' });
  };
  // north wall with a gate gap, others solid with a west gate
  fence(-16, -16, -3, -16); fence(3, -16, 16, -16);
  fence(-16, 16, 16, 16);
  fence(16, -16, 16, 16);
  fence(-16, -16, -16, -3); fence(-16, 3, -16, 16);
  const lab = room(m, 4, -2, 14, 12, { door: 'w', h: 3.4, color: '#8a9096' });
  const annex = room(m, -8, 8, 9, 8, { door: 'n', h: 3.0, color: '#7c8388' });
  const gen = room(m, 8, 9, 8, 6, { door: 'w', h: 3.0, color: '#6f767b' });
  const outpost = room(m, -38, -30, 10, 9, { door: 'e', h: 3.0, color: '#6d7568' });
  const lodge = room(m, 36, -34, 12, 10, { door: 's', h: 3.2, color: '#77685a' });
  const tower = room(m, 38, 30, 6, 6, { door: 'w', h: 4.5, color: '#66605a' });
  m.zones = {
    START: { x: -46, z: 44, r: 6, yaw: -0.5 },
    A: { x: outpost.cx, z: outpost.cz, r: 4 }, B: { x: lab.cx, z: lab.cz, r: 4.5 }, C: { x: annex.cx, z: annex.cz, r: 3.5 },
    D: { x: lodge.cx, z: lodge.cz, r: 4.5 }, E: { x: gen.cx, z: gen.cz, r: 3 }, F: { x: tower.cx, z: tower.cz, r: 2.5 },
    EXTRACT: { x: 46, z: 46, r: 5 },
  };
  m.decor.push({ type: 'road', x: 0, z: 0, w: 34, d: 34, color: '#454a44' });
  for (const r of [lab, annex, gen, outpost, lodge, tower]) m.decor.push({ type: 'floor', x: r.cx, z: r.cz, w: r.w, d: r.d, color: '#666c6d' });
  return finalize(m, 3303, { rooms: [lab, annex, gen, outpost, lodge, tower], cover: 110, kinds: [TREE, TREE, TREE, TREE, TREE, TREE, CRATE, SANDBAGS, TENT, BARREL_X] });
}

/* ---------- 4. Coastal Facility ---------- */
function coastal() {
  const m = new GameMap('coastal', 'Coastal Facility', 48);
  m.env = { sky: '#8aa6b8', fog: 0.013, sun: 1.0, ambient: 0.58, indoor: false, ground: '#585a56' };
  perimeter(m, 5);
  // Sea along the north edge, with a dock projecting into it
  m.hazards.push({ type: 'water', x: 0, z: -40, w: 96, d: 16, dps: 12 });
  m.decor.push({ type: 'water', x: 0, z: -40, w: 96, d: 16, color: '#1f4a63' });
  m.decor.push({ type: 'dock', x: -20, z: -36, w: 5, d: 20, color: '#6b5a44' }, { type: 'dock', x: 20, z: -36, w: 5, d: 20, color: '#6b5a44' });
  m.addBox({ x: 0, z: -32, w: 96, d: 0.6, y: 0, h: 0.9, kind: 'seawall', color: '#666a6c' });
  const plant = room(m, -18, -6, 22, 16, { door: ['s', 'e'], h: 4.0, color: '#767c80' });
  const pump = room(m, 18, -10, 14, 12, { door: 'w', h: 3.4, color: '#6f7579' });
  const ctrl = room(m, 30, 14, 12, 12, { door: 'n', h: 3.4, color: '#7d8488' });
  const store = room(m, -30, 22, 16, 14, { door: 'e', h: 3.6, color: '#6b7176' });
  const hall = room(m, 0, 26, 18, 12, { door: 'n', h: 3.4, color: '#727a7f' });
  const lab = room(m, 0, 4, 10, 10, { door: ['n', 's'], h: 3.2, color: '#808a90' });
  stairs(m, plant.cx - plant.w / 2 - 0.2, plant.cz + 2, 'w', 9, 2.0);
  m.zones = {
    START: { x: -40, z: 40, r: 6, yaw: -0.5 },
    A: { x: plant.cx, z: plant.cz, r: 5 }, B: { x: pump.cx, z: pump.cz, r: 4.5 }, C: { x: ctrl.cx, z: ctrl.cz, r: 4 },
    D: { x: store.cx, z: store.cz, r: 5 }, E: { x: hall.cx, z: hall.cz, r: 5 }, F: { x: lab.cx, z: lab.cz, r: 3.5 },
    EXTRACT: { x: 40, z: 40, r: 5 },
  };
  m.decor.push({ type: 'road', x: 0, z: 14, w: 96, d: 6, color: '#33363a' });
  for (const r of [plant, pump, ctrl, store, hall, lab]) m.decor.push({ type: 'floor', x: r.cx, z: r.cz, w: r.w, d: r.d, color: '#5c6062' });
  return finalize(m, 4404, { rooms: [plant, pump, ctrl, store, hall, lab], cover: 55, kinds: [CONTAINER, CONTAINER, CRATE, CRATE_BIG, BARREL_X, BARRELS, BARRIER, LIGHT] });
}

/* ---------- 5. Underground Communications Station ---------- */
function comms() {
  const m = new GameMap('comms', 'Underground Communications Station', 36);
  m.env = { sky: '#0c1014', fog: 0.05, sun: 0.0, ambient: 0.22, indoor: true, ground: '#2b2f33' };
  perimeter(m, 4.2, '#2a2f33');
  const H = 4.0;
  const wall = (x1, z1, x2, z2, gap) => {
    const horiz = z1 === z2;
    const len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const mid = horiz ? (x1 + x2) / 2 : (z1 + z2) / 2;
    const add = (c0, c1) => {
      const l = c1 - c0; if (l <= 0.05) return;
      const c = (c0 + c1) / 2;
      m.addBox({ x: horiz ? c : x1, z: horiz ? z1 : c, w: horiz ? l : T, d: horiz ? T : l, y: 0, h: H, kind: 'building', color: '#565c60' });
    };
    const lo = horiz ? Math.min(x1, x2) : Math.min(z1, z2), hi = lo + len;
    if (!gap) { add(lo, hi); return; }
    add(lo, mid - gap / 2); add(mid + gap / 2, hi);
  };
  // Corridor grid with door gaps
  wall(-34, -12, -6, -12, 3); wall(6, -12, 34, -12, 3);
  wall(-34, 12, -6, 12, 3); wall(6, 12, 34, 12, 3);
  wall(-12, -34, -12, -12, 3); wall(12, -34, 12, -12, 3);
  wall(-12, 12, -12, 34, 3); wall(12, 12, 12, 34, 3);
  wall(-12, -12, -12, 12, 3); wall(12, -12, 12, 12, 3);
  // Slab over everything
  m.addBox({ x: 0, z: 0, w: 74, d: 74, y: H, h: 0.4, kind: 'roof', color: '#1c2024' });
  m.decor.push({ type: 'floor', x: 0, z: 0, w: 72, d: 72, color: '#34393d' });
  m.zones = {
    START: { x: -30, z: 30, r: 4.5, yaw: -0.6 },
    A: { x: -24, z: -24, r: 4.5 }, B: { x: 0, z: -24, r: 4 }, C: { x: 24, z: -24, r: 4.5 },
    D: { x: 0, z: 0, r: 5 }, E: { x: -24, z: 0, r: 4 }, F: { x: 24, z: 24, r: 4.5 },
    EXTRACT: { x: 30, z: 30, r: 4.5 },
  };
  return finalize(m, 5505, { rooms: [], cover: 70, kinds: [RACK, RACK, RACK, CRATE, BARRIER, SANDBAGS, BARRELS] });
}

const BUILDERS = { industrial, urban, research, coastal, comms };
const _cache = new Map();
export function getMap(id) {
  if (!BUILDERS[id]) throw new Error('Unknown map: ' + id);
  if (!_cache.has(id)) _cache.set(id, BUILDERS[id]());
  return _cache.get(id);
}
/* A fresh copy (needed when a simulation mutates doors or adds cover). */
export function buildMap(id) {
  if (!BUILDERS[id]) throw new Error('Unknown map: ' + id);
  return BUILDERS[id]();
}
export const MAP_LIST = [
  { id: 'industrial', name: 'Industrial District', blurb: 'Warehouses, container yards and loading roads.' },
  { id: 'urban', name: 'Urban Block', blurb: 'Streets, alleys, interiors and rooftops.' },
  { id: 'research', name: 'Research Compound', blurb: 'Forest around a fenced research facility.' },
  { id: 'coastal', name: 'Coastal Facility', blurb: 'Docks, pump houses and an inland plant.' },
  { id: 'comms', name: 'Underground Comms Station', blurb: 'Tight corridors, server halls and low light.' },
];
