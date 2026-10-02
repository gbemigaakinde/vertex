/* ============================================================
   vector/combat.js  |  Pure combat maths: damage, armour, falloff,
   spread, ray/capsule tests. Used by the simulation on both the
   client (single player) and the server (multiplayer).
   ============================================================ */
import { ARMOR } from './weapons.js';

const DEG = Math.PI / 180;

/* Damage after distance falloff. Full damage until `falloff` metres,
   then it fades to 55% at max range. */
export function falloffDamage(w, dist) {
  if (dist <= w.falloff) return w.damage;
  const t = Math.min(1, (dist - w.falloff) / Math.max(1, w.range - w.falloff));
  return w.damage * (1 - 0.45 * t);
}

/* Apply damage to anything that has hp / armor / armorType. Returns
   { dealt, absorbed, killed }.                                    */
export function applyDamage(target, amount, opts = {}) {
  if (!target || target.hp <= 0 || amount <= 0) return { dealt: 0, absorbed: 0, killed: false };
  const a = ARMOR[target.armorType || 'none'] || ARMOR.none;
  let absorbed = 0;
  if (!opts.ignoreArmor && target.armor > 0 && a.absorb > 0) {
    absorbed = Math.min(target.armor, amount * a.absorb);
    target.armor -= absorbed;
  }
  const dealt = amount - absorbed;
  target.hp = Math.max(0, target.hp - dealt);
  return { dealt, absorbed, killed: target.hp <= 0 };
}

/* Random point inside a cone: returns a unit vector near `dir`. */
export function spreadDir(dir, spreadDeg, rnd) {
  if (spreadDeg <= 0) return { x: dir.x, y: dir.y, z: dir.z };
  const ang = spreadDeg * DEG * Math.sqrt(rnd());
  const rot = rnd() * Math.PI * 2;
  // Build an orthonormal basis around dir.
  let ux = 0, uy = 1, uz = 0;
  if (Math.abs(dir.y) > 0.98) { ux = 1; uy = 0; }
  let rx = dir.y * uz - dir.z * uy, ry = dir.z * ux - dir.x * uz, rz = dir.x * uy - dir.y * ux;
  const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
  const vx = dir.y * rz - dir.z * ry, vy = dir.z * rx - dir.x * rz, vz = dir.x * ry - dir.y * rx;
  const s = Math.sin(ang), c = Math.cos(ang), cr = Math.cos(rot) * s, sr = Math.sin(rot) * s;
  const x = dir.x * c + rx * cr + vx * sr, y = dir.y * c + ry * cr + vy * sr, z = dir.z * c + rz * cr + vz * sr;
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
}

/* View direction from yaw/pitch. yaw 0 looks toward -Z, positive yaw turns left. */
export function dirFromAngles(yaw, pitch) {
  const cp = Math.cos(pitch);
  return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
}

/* Ray vs axis-aligned box (slab test). Returns t or -1. */
export function rayBox(o, d, minX, minY, minZ, maxX, maxY, maxZ, maxT = Infinity) {
  let t0 = 0, t1 = maxT;
  const ox = [o.x, o.y, o.z], dv = [d.x, d.y, d.z], mn = [minX, minY, minZ], mx = [maxX, maxY, maxZ];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dv[i]) < 1e-9) { if (ox[i] < mn[i] || ox[i] > mx[i]) return -1; continue; }
    const inv = 1 / dv[i];
    let a = (mn[i] - ox[i]) * inv, b = (mx[i] - ox[i]) * inv;
    if (a > b) { const t = a; a = b; b = t; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return -1;
  }
  return t0;
}

/* Ray vs sphere. Returns t or -1. */
export function raySphere(o, d, cx, cy, cz, r, maxT = Infinity) {
  const lx = cx - o.x, ly = cy - o.y, lz = cz - o.z;
  const tca = lx * d.x + ly * d.y + lz * d.z;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return -1;
  const thc = Math.sqrt(r * r - d2);
  let t = tca - thc;
  if (t < 0) t = tca + thc;
  return t >= 0 && t <= maxT ? t : -1;
}

/* Ray vs upright capsule body (approximated as a vertical cylinder from
   y0 to y1) plus a head sphere. Returns { t, head } or null.        */
export function rayHumanoid(o, d, px, py, pz, height, radius, maxT = Infinity) {
  const headR = 0.16;
  const headY = py + height - headR - 0.02;
  const th = raySphere(o, d, px, headY, pz, headR + 0.03, maxT);
  // Cylinder from py to headY - headR, 2D ray-circle then y check.
  let best = null;
  const dx = d.x, dz = d.z, ex = o.x - px, ez = o.z - pz;
  const a = dx * dx + dz * dz;
  if (a > 1e-9) {
    const b = 2 * (ex * dx + ez * dz), c = ex * ex + ez * ez - radius * radius;
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
        if (t < 0 || t > maxT) continue;
        const y = o.y + d.y * t;
        if (y >= py && y <= py + height - 0.28) { best = t; break; }
      }
    }
  }
  if (th >= 0 && (best === null || th <= best + 0.05)) return { t: th, head: true };
  if (best !== null) return { t: best, head: false };
  return null;
}
