/* ============================================================
   vector/enemies.js  |  Enemy archetypes + AI state machine.
   Pure logic. The simulation (sim.js) supplies the world, targets,
   noises and a fire callback, so the same AI runs in the browser
   (single player) and on the server (co-op).

   States: IDLE -> PATROL -> SUSPICIOUS -> ALERT -> COMBAT -> SEARCH
           -> REPOSITION (cover / flank / retreat) -> DEAD
   ============================================================ */

export const ARCHETYPES = {
  scout: {
    id: 'scout', name: 'Scout', hp: 60, armor: 0, armorType: 'none', radius: 0.4, height: 1.75,
    patrolSpeed: 2.3, chaseSpeed: 5.8, turn: 8,
    vision: { range: 60, fov: 140 }, hearing: 26, alertRadius: 48,
    weapon: { damage: 11, rpm: 480, accuracy: 0.55, range: 38, burst: [2, 4], pause: [0.5, 1.0] },
    pref: { min: 14, max: 30 }, useCover: true, kite: true,
    model: 'characters/enemy_scout', fallback: 'characters/enemy_sniper', tint: '#7d8f6a',
    reward: 20,
  },
  rifleman: {
    id: 'rifleman', name: 'Rifleman', hp: 100, armor: 30, armorType: 'light', radius: 0.4, height: 1.8,
    patrolSpeed: 2.0, chaseSpeed: 4.6, turn: 6,
    vision: { range: 45, fov: 110 }, hearing: 20, alertRadius: 22,
    weapon: { damage: 14, rpm: 540, accuracy: 0.6, range: 45, burst: [3, 6], pause: [0.6, 1.3] },
    pref: { min: 10, max: 26 }, useCover: true,
    model: 'characters/enemy_rifleman', fallback: null, tint: null, reward: 30,
  },
  heavy: {
    id: 'heavy', name: 'Heavy', hp: 230, armor: 100, armorType: 'heavy', radius: 0.5, height: 1.9,
    patrolSpeed: 1.5, chaseSpeed: 2.6, turn: 3.5,
    vision: { range: 38, fov: 100 }, hearing: 16, alertRadius: 18,
    weapon: { damage: 18, rpm: 420, accuracy: 0.48, range: 40, burst: [6, 10], pause: [0.3, 0.7] },
    pref: { min: 6, max: 18 }, useCover: false, advance: true,
    model: 'characters/enemy_heavy', fallback: null, tint: null, reward: 60,
  },
  support: {
    id: 'support', name: 'Support', hp: 90, armor: 20, armorType: 'light', radius: 0.4, height: 1.8,
    patrolSpeed: 2.0, chaseSpeed: 4.4, turn: 6,
    vision: { range: 42, fov: 110 }, hearing: 22, alertRadius: 24,
    weapon: { damage: 10, rpm: 500, accuracy: 0.5, range: 38, burst: [2, 4], pause: [0.8, 1.6] },
    pref: { min: 14, max: 28 }, useCover: true, healer: { range: 14, amount: 35, every: 6 },
    model: 'characters/enemy_specialist', fallback: null, tint: null, reward: 40,
  },
  commander: {
    id: 'commander', name: 'Commander', hp: 150, armor: 60, armorType: 'medium', radius: 0.42, height: 1.85,
    patrolSpeed: 1.9, chaseSpeed: 4.0, turn: 5,
    vision: { range: 55, fov: 120 }, hearing: 24, alertRadius: 40,
    weapon: { damage: 16, rpm: 500, accuracy: 0.66, range: 48, burst: [3, 5], pause: [0.6, 1.1] },
    pref: { min: 12, max: 28 }, useCover: true, commander: { aura: 26, accuracyBonus: 0.12 },
    model: 'characters/enemy_commander', fallback: 'characters/enemy_specialist', tint: '#8a5a3a', reward: 80,
  },
};

const rr = (rnd, a, b) => a + (b - a) * rnd();
const TAU = Math.PI * 2;
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function dist2d(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

export function createEnemy(id, type, x, z, opts = {}) {
  const a = ARCHETYPES[type];
  return {
    id, type, x, y: 0, z, yaw: opts.yaw || 0, vx: 0, vz: 0,
    hp: a.hp, maxHp: a.hp, armor: a.armor, armorType: a.armorType,
    alive: true, state: opts.patrol && opts.patrol.length > 1 ? 'PATROL' : 'IDLE', stateT: 0, prevState: null,
    home: { x, z }, patrol: opts.patrol || [], patrolI: 0, waitT: 0,
    awareness: 0, lastSeen: null, lastSeenT: -99, target: null,
    path: null, pathI: 0, pathT: 0, pathGoal: null,
    cover: null, mode: 'cover', peekT: 0, strafeDir: 1, strafeT: 0,
    fireCd: 0, burstLeft: 0, pauseT: 0, reactT: 0,
    stun: 0, hitT: 99, healCd: a.healer ? a.healer.every : 0, searchPts: 0, searchT: 0,
    alertDelay: 0, group: opts.group || null, speedNow: 0, flanker: false,
    boost: 0,
  };
}

/* ---------- perception ---------- */
function eyePos(e) { return { x: e.x, y: e.y + ARCHETYPES[e.type].height - 0.15, z: e.z }; }
function targetPoint(t) { return { x: t.x, y: (t.y || 0) + (t.crouched ? 0.75 : 1.15), z: t.z }; }

function smokeBlocks(sim, a, b) {
  for (const s of sim.smokes) {
    // distance from segment a-b to smoke centre in 3D
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const l2 = abx * abx + aby * aby + abz * abz || 1;
    let t = ((s.x - a.x) * abx + (s.y - a.y) * aby + (s.z - a.z) * abz) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + abx * t - s.x, py = a.y + aby * t - s.y, pz = a.z + abz * t - s.z;
    if (px * px + py * py + pz * pz < s.r * s.r) return true;
  }
  return false;
}

export function hasLineOfSight(sim, from, to) {
  return sim.map.clearLine(from, to) && !smokeBlocks(sim, from, to);
}

function visibility(e, t, sim, alertLevel) {
  const a = ARCHETYPES[e.type];
  const d = dist2d(e, t);
  let range = a.vision.range * (t.crouched ? 0.7 : 1) * (sim.map.env.indoor ? 0.75 : 1);
  if (e.stun > 0) return 0;
  if (t.blind === undefined) { /* npc */ }
  if (d > range) return 0;
  const bearing = Math.atan2(-(t.x - e.x), -(t.z - e.z));
  const fov = alertLevel ? Math.PI * 1.7 : (a.vision.fov * Math.PI) / 180;
  if (Math.abs(angDiff(e.yaw, bearing)) > fov / 2 && d > 3.5) return 0;
  if (!hasLineOfSight(sim, eyePos(e), targetPoint(t))) return 0;
  return Math.max(0.05, 1 - d / range);
}

function pickTarget(e, sim) {
  let best = null, bestScore = Infinity;
  for (const t of sim.enemyTargets(e)) {
    const d = dist2d(e, t);
    const s = d + (t.downed ? 30 : 0) + (t.isNpc ? 8 : 0);
    if (s < bestScore) { best = t; bestScore = s; }
  }
  return best;
}

/* ---------- state helpers ---------- */
function setState(e, s, sim) {
  if (e.state === s) return;
  e.prevState = e.state; e.state = s; e.stateT = 0;
  e.path = null;
  sim.emit({ t: 'ai', id: e.id, state: s });
}

function faceToward(e, tx, tz, dt, rate) {
  const want = Math.atan2(-(tx - e.x), -(tz - e.z));
  const d = angDiff(e.yaw, want);
  const step = Math.min(Math.abs(d), rate * dt);
  e.yaw += Math.sign(d) * step;
}

/* Follow (or compute) a path to a goal. Returns true when arrived. */
function moveTo(e, sim, gx, gz, speed, dt, arriveR = 0.7) {
  const a = ARCHETYPES[e.type];
  const dGoal = Math.hypot(gx - e.x, gz - e.z);
  if (dGoal < arriveR) { e.vx = e.vz = 0; e.speedNow = 0; return true; }
  e.pathT -= dt;
  const goalMoved = !e.pathGoal || Math.hypot(e.pathGoal.x - gx, e.pathGoal.z - gz) > 2.5;
  if (!e.path || (goalMoved && e.pathT <= 0) || e.pathT < -2.5) {
    if (sim.pathBudget > 0) {
      sim.pathBudget--;
      e.path = sim.map.findPath(e, { x: gx, z: gz }) || [{ x: gx, z: gz }];
      e.pathI = 0; e.pathGoal = { x: gx, z: gz }; e.pathT = 0.8;
    } else if (!e.path) { e.vx = e.vz = 0; return false; }
  }
  let wp = e.path[e.pathI];
  while (wp && Math.hypot(wp.x - e.x, wp.z - e.z) < 0.6 && e.pathI < e.path.length - 1) { e.pathI++; wp = e.path[e.pathI]; }
  if (!wp) { e.path = null; return false; }
  const dx = wp.x - e.x, dz = wp.z - e.z, dl = Math.hypot(dx, dz) || 1;
  const sp = speed * (e.boost > 0 ? 1.15 : 1);
  e.vx = (dx / dl) * sp; e.vz = (dz / dl) * sp; e.speedNow = sp;
  return false;
}

function integrate(e, sim, dt) {
  const a = ARCHETYPES[e.type];
  if (e.stun > 0) { e.vx *= 0.2; e.vz *= 0.2; }
  const nx = e.x + e.vx * dt, nz = e.z + e.vz * dt;
  // open doors that are in the way
  for (const b of sim.map.query(nx - 1.3, nz - 1.3, nx + 1.3, nz + 1.3)) {
    if (b.door && !b.open) sim.setDoor(b, true, e.id);
  }
  e.x = nx; e.z = nz;
  sim.map.resolveCircle(e, a.radius, a.height, 0.5);
  // soft separation from friends
  for (const o of sim.enemies) {
    if (o === e || !o.alive) continue;
    const dx = e.x - o.x, dz = e.z - o.z, d = Math.hypot(dx, dz);
    if (d > 0 && d < 0.85) { const p = (0.85 - d) * 0.5; e.x += (dx / d) * p; e.z += (dz / d) * p; }
  }
  if (Math.hypot(e.vx, e.vz) > 0.2 && e.state !== 'COMBAT') faceToward(e, e.x + e.vx, e.z + e.vz, dt, a.turn);
}

/* ---------- cover search ---------- */
function findCover(e, sim, threat) {
  const a = ARCHETYPES[e.type];
  const rnd = sim.rnd;
  let best = null, bestScore = Infinity;
  const tp = targetPoint(threat);
  for (let i = 0; i < 18; i++) {
    const ang = rnd() * TAU, r = 3 + rnd() * 8;
    const x = e.x + Math.cos(ang) * r, z = e.z + Math.sin(ang) * r;
    if (!sim.map.isWalkable(x, z)) continue;
    const dt_ = Math.hypot(x - threat.x, z - threat.z);
    if (dt_ < a.pref.min * 0.6 || dt_ > a.weapon.range) continue;
    const from = { x, y: 1.1, z };
    if (sim.map.clearLine(from, tp)) continue;               // must be hidden from the threat
    // Prefer positions right behind an obstacle
    const near = sim.map.query(x - 1.2, z - 1.2, x + 1.2, z + 1.2).some((b) => b.solid && b.maxY > 0.6 && b.minY < 1.2);
    let score = r + (near ? 0 : 6) + Math.abs(dt_ - (a.pref.min + a.pref.max) / 2) * 0.3;
    for (const o of sim.enemies) if (o !== e && o.alive && o.cover && Math.hypot(o.cover.x - x, o.cover.z - z) < 2) score += 8;
    if (score < bestScore) { bestScore = score; best = { x, z }; }
  }
  return best;
}

/* A point near `from` that has line of sight to the threat (used to peek/flank). */
function findFiringSpot(e, sim, threat, around, radius) {
  const tp = targetPoint(threat);
  let best = null, bs = Infinity;
  for (let i = 0; i < 14; i++) {
    const ang = sim.rnd() * TAU, r = 1.5 + sim.rnd() * radius;
    const x = around.x + Math.cos(ang) * r, z = around.z + Math.sin(ang) * r;
    if (!sim.map.isWalkable(x, z)) continue;
    if (!sim.map.clearLine({ x, y: 1.5, z }, tp)) continue;
    const d = Math.hypot(x - threat.x, z - threat.z);
    const s = Math.hypot(x - e.x, z - e.z) + Math.abs(d - 16) * 0.2;
    if (s < bs) { bs = s; best = { x, z }; }
  }
  return best;
}

/* ---------- alert sharing ---------- */
export function raiseAlert(sim, source, point, radius, force = false) {
  for (const o of sim.enemies) {
    if (o === source || !o.alive) continue;
    if (Math.hypot(o.x - source.x, o.z - source.z) > radius) continue;
    if (o.state === 'COMBAT' || o.state === 'ALERT') continue;
    if (o.state === 'PATROL' || o.state === 'IDLE' || o.state === 'SUSPICIOUS' || o.state === 'SEARCH' || force) {
      o.lastSeen = { x: point.x, z: point.z }; o.lastSeenT = sim.time;
      o.alertDelay = 0.6 + sim.rnd() * 0.8;   // radio delay
      o.pendingAlert = true;
    }
  }
}

/* ---------- main update ---------- */
export function updateEnemy(e, sim, dt) {
  if (!e.alive) return;
  const a = ARCHETYPES[e.type];
  e.stateT += dt; e.hitT += dt;
  e.fireCd = Math.max(0, e.fireCd - dt);
  e.boost = Math.max(0, e.boost - dt);
  if (e.stun > 0) { e.stun -= dt; e.vx = e.vz = 0; integrate(e, sim, dt); return; }

  // delayed radio alert
  if (e.pendingAlert) {
    e.alertDelay -= dt;
    if (e.alertDelay <= 0) { e.pendingAlert = false; if (e.state !== 'COMBAT') setState(e, 'ALERT', sim); }
  }

  // Commander aura: nearby friends move slightly faster and shoot better; shares sightings.
  if (a.commander) commanderTick(e, sim);
  // Support: heal a hurt friend
  if (a.healer) supportTick(e, sim, dt);

  // Perception -----------------------------------------------------------
  const inAlert = e.state === 'ALERT' || e.state === 'COMBAT' || e.state === 'REPOSITION' || e.state === 'SEARCH';
  let seen = null, seenVis = 0;
  for (const t of sim.enemyTargets(e)) {
    const v = visibility(e, t, sim, inAlert);
    if (v > seenVis) { seenVis = v; seen = t; }
  }
  if (seen) {
    const d = dist2d(e, seen);
    const rate = (d < 6 ? 4 : 0.8 + seenVis * 2.4) * (a.vision.range > 50 ? 1.2 : 1);
    e.awareness = Math.min(1, e.awareness + rate * dt);
    if (e.awareness > 0.05) { e.lastSeen = { x: seen.x, z: seen.z }; e.lastSeenT = sim.time; e.target = seen; }
  } else {
    e.awareness = Math.max(0, e.awareness - 0.22 * dt);
  }
  // Hearing
  for (const n of sim.noises) {
    if (n.source === e.id || sim.time - n.t > 0.3) continue;
    const d = Math.hypot(n.x - e.x, n.z - e.z);
    if (d <= Math.min(n.r, n.r * (a.hearing / 20))) {
      if (e.state === 'IDLE' || e.state === 'PATROL') { e.investigate = { x: n.x, z: n.z }; setState(e, 'SUSPICIOUS', sim); e.awareness = Math.max(e.awareness, 0.35); }
      else if (e.state === 'SEARCH') { e.lastSeen = { x: n.x, z: n.z }; e.searchT = 0; }
    }
  }

  switch (e.state) {
    case 'IDLE': {
      e.vx = e.vz = 0;
      e.yaw += Math.sin(sim.time * 0.4 + e.home.x) * dt * 0.4;   // slow scan
      if (e.awareness > 0.3) { e.investigate = e.lastSeen; setState(e, 'SUSPICIOUS', sim); }
      else if (e.patrol.length > 1) setState(e, 'PATROL', sim);
      break;
    }
    case 'PATROL': {
      if (e.awareness > 0.3) { e.investigate = e.lastSeen; setState(e, 'SUSPICIOUS', sim); break; }
      if (e.waitT > 0) { e.waitT -= dt; e.vx = e.vz = 0; e.yaw += Math.sin(sim.time + e.stateT) * dt * 0.6; break; }
      const wp = e.patrol[e.patrolI % e.patrol.length];
      if (!wp) { setState(e, 'IDLE', sim); break; }
      if (moveTo(e, sim, wp.x, wp.z, a.patrolSpeed, dt, 1.0)) { e.patrolI++; e.waitT = 1 + sim.rnd() * 2; e.path = null; }
      break;
    }
    case 'SUSPICIOUS': {
      const p = e.investigate || e.lastSeen;
      if (e.awareness >= 1) { beginCombat(e, sim); break; }
      if (p) {
        faceToward(e, p.x, p.z, dt, a.turn);
        // creep toward the disturbance slowly, but stop to look when we can see the target
        if (seen) { e.vx = e.vz = 0; }
        else if (moveTo(e, sim, p.x, p.z, a.patrolSpeed * 0.75, dt, 1.5)) { e.vx = e.vz = 0; }
      }
      if (e.stateT > 7 && e.awareness < 0.3) { e.awareness = 0; setState(e, e.patrol.length > 1 ? 'PATROL' : 'IDLE', sim); }
      break;
    }
    case 'ALERT': {
      // We know roughly where the enemy is. Move there with weapon ready.
      if (seen && e.awareness > 0.5) { beginCombat(e, sim); break; }
      const p = e.lastSeen;
      if (!p) { setState(e, 'SEARCH', sim); break; }
      const arrived = moveTo(e, sim, p.x, p.z, a.chaseSpeed * 0.85, dt, 2.0);
      if (arrived || e.stateT > 14) { e.searchPts = 0; e.searchT = 0; setState(e, 'SEARCH', sim); }
      break;
    }
    case 'COMBAT': combatTick(e, sim, dt, seen, a); break;
    case 'REPOSITION': repositionTick(e, sim, dt, seen, a); break;
    case 'SEARCH': {
      if (seen && e.awareness > 0.6) { beginCombat(e, sim); break; }
      e.searchT += dt;
      const p = e.lastSeen || e.home;
      if (!e.searchTarget) e.searchTarget = { x: p.x, z: p.z };
      if (moveTo(e, sim, e.searchTarget.x, e.searchTarget.z, a.patrolSpeed * 1.3, dt, 1.2)) {
        e.searchPts++;
        e.searchTarget = sim.map.randomWalkable(p.x, p.z, 9, sim.rnd) || p;
        e.path = null;
        e.yaw += 1.2;
      }
      if (e.searchPts >= 4 || e.searchT > 20) {
        e.searchTarget = null; e.awareness = 0;
        setState(e, e.patrol.length > 1 ? 'PATROL' : 'IDLE', sim);
      }
      break;
    }
  }
  integrate(e, sim, dt);
}

function beginCombat(e, sim) {
  const wasCalm = e.state === 'IDLE' || e.state === 'PATROL' || e.state === 'SUSPICIOUS';
  setState(e, 'COMBAT', sim);
  e.reactT = 0.35 + sim.rnd() * 0.5;
  e.burstLeft = 0; e.pauseT = 0.3;
  e.searchTarget = null;
  if (wasCalm) {
    const a = ARCHETYPES[e.type];
    if (e.lastSeen) raiseAlert(sim, e, e.lastSeen, a.alertRadius);
    sim.emit({ t: 'alert', id: e.id, x: e.x, z: e.z });
  }
}

function combatTick(e, sim, dt, seen, a) {
  const tgt = seen || e.target;
  if (!tgt || !e.lastSeen) { setState(e, 'SEARCH', sim); return; }
  e.reactT -= dt;
  const d = dist2d(e, tgt);
  const visible = !!seen && e.awareness > 0.3;

  // Lost sight: go look, or peek.
  if (!visible) {
    e.vx *= 0.5; e.vz *= 0.5;
    if (sim.time - e.lastSeenT > 2.2) { e.searchPts = 0; e.searchT = 0; setState(e, 'ALERT', sim); }
    else moveTo(e, sim, e.lastSeen.x, e.lastSeen.z, a.chaseSpeed * 0.8, dt, 1.5);
    return;
  }
  faceToward(e, tgt.x, tgt.z, dt, a.turn * 1.6);

  // Decide movement: retreat if badly hurt, take cover when hit, close/open distance
  const hurt = e.hp / e.maxHp;
  if (hurt < 0.25 && !a.advance && !a.commander) { toReposition(e, sim, tgt, 'retreat'); return; }
  if (a.useCover && e.hitT < 1.2 && sim.rnd() < 0.5 * dt * 4 && d > 6) { toReposition(e, sim, tgt, 'cover'); return; }
  if (a.commander && sim.rnd() < 0.15 * dt) orderFlank(e, sim, tgt);
  if (e.flanker && e.stateT > 1 && sim.rnd() < 0.3 * dt * 3) { e.flanker = false; toReposition(e, sim, tgt, 'flank'); return; }

  // Strafe / distance keeping
  e.strafeT -= dt;
  if (e.strafeT <= 0) { e.strafeT = 0.8 + sim.rnd() * 1.6; e.strafeDir = sim.rnd() < 0.5 ? -1 : 1; }
  const dx = tgt.x - e.x, dz = tgt.z - e.z, dl = Math.hypot(dx, dz) || 1;
  let mvx = 0, mvz = 0;
  if (d > a.pref.max) { mvx = dx / dl; mvz = dz / dl; }
  else if (d < a.pref.min && !a.advance) { mvx = -dx / dl; mvz = -dz / dl; if (a.kite) { mvx *= 1.2; mvz *= 1.2; } }
  else if (a.advance) { mvx = dx / dl * 0.6; mvz = dz / dl * 0.6; }
  const sx = -dz / dl * e.strafeDir * 0.55, sz = dx / dl * e.strafeDir * 0.55;
  const sp = a.chaseSpeed * 0.6;
  const tx = e.x + (mvx + sx) * 2, tz = e.z + (mvz + sz) * 2;
  if (sim.map.isWalkable(tx, tz)) { e.vx = (mvx + sx) * sp; e.vz = (mvz + sz) * sp; }
  else { e.vx = mvx * sp; e.vz = mvz * sp; }

  // Fire in bursts
  if (e.reactT > 0) return;
  if (e.pauseT > 0) { e.pauseT -= dt; return; }
  if (e.fireCd <= 0 && d <= a.weapon.range) {
    if (e.burstLeft <= 0) e.burstLeft = Math.round(rr(sim.rnd, a.weapon.burst[0], a.weapon.burst[1]));
    sim.enemyFire(e, tgt);
    e.fireCd = 60 / a.weapon.rpm;
    e.burstLeft--;
    if (e.burstLeft <= 0) e.pauseT = rr(sim.rnd, a.weapon.pause[0], a.weapon.pause[1]);
  }
}

function toReposition(e, sim, tgt, mode) {
  const a = ARCHETYPES[e.type];
  let spot = null;
  if (mode === 'cover' || mode === 'retreat') {
    spot = findCover(e, sim, tgt);
    if (mode === 'retreat' && !spot) {
      const dx = e.x - tgt.x, dz = e.z - tgt.z, dl = Math.hypot(dx, dz) || 1;
      spot = sim.map.snapWalkable(e.x + (dx / dl) * 14, e.z + (dz / dl) * 14, 6);
    }
    if (mode === 'retreat') raiseAlert(sim, e, { x: tgt.x, z: tgt.z }, a.alertRadius * 1.3, true);
  } else {
    // flank: pick a firing spot 90 degrees around the target
    const ang = Math.atan2(e.z - tgt.z, e.x - tgt.x) + (sim.rnd() < 0.5 ? 1 : -1) * (1.1 + sim.rnd() * 0.5);
    const r = clamp((a.pref.min + a.pref.max) / 2, 8, 20);
    const p = sim.map.snapWalkable(tgt.x + Math.cos(ang) * r, tgt.z + Math.sin(ang) * r, 5);
    spot = p;
  }
  if (!spot) return;
  e.cover = spot; e.mode = mode; e.peekT = 1 + sim.rnd() * 1.8;
  setState(e, 'REPOSITION', sim);
}

function repositionTick(e, sim, dt, seen, a) {
  const c = e.cover;
  if (!c) { setState(e, 'COMBAT', sim); return; }
  const arrived = moveTo(e, sim, c.x, c.z, a.chaseSpeed, dt, 0.9);
  if (seen && e.awareness > 0.4 && e.mode === 'flank' && e.stateT > 1.5) {
    // got a shot while moving: go back to fighting
    e.lastSeen = { x: seen.x, z: seen.z }; setState(e, 'COMBAT', sim); return;
  }
  if (e.stateT > 9) { setState(e, e.lastSeen ? 'ALERT' : 'SEARCH', sim); return; }
  if (!arrived) return;
  if (e.mode === 'retreat') {
    // Reached safety. Hold, heal, then re-engage from cover.
    e.peekT -= dt;
    if (e.peekT <= 0 || seen) setState(e, seen ? 'COMBAT' : 'ALERT', sim);
    return;
  }
  // in cover: wait, then peek out to a spot with line of sight
  if (seen) { setState(e, 'COMBAT', sim); return; }
  e.peekT -= dt;
  if (e.peekT <= 0) {
    const t = e.target || pickTarget(e, sim);
    if (t) {
      const spot = findFiringSpot(e, sim, t, e, 4.5);
      if (spot) { e.cover = spot; e.mode = 'flank'; e.stateT = 0; e.path = null; e.peekT = 1.5; return; }
    }
    setState(e, 'ALERT', sim);
  }
}

function orderFlank(cmdr, sim, tgt) {
  const a = ARCHETYPES[cmdr.type].commander;
  for (const o of sim.enemies) {
    if (o === cmdr || !o.alive || o.state !== 'COMBAT') continue;
    if (dist2d(o, cmdr) > a.aura) continue;
    const t = ARCHETYPES[o.type];
    if (t.advance) continue;
    o.flanker = true;
    return;
  }
}

function commanderTick(e, sim) {
  const a = ARCHETYPES[e.type].commander;
  const fighting = e.state === 'COMBAT' && e.target && e.lastSeen;
  for (const o of sim.enemies) {
    if (o === e || !o.alive) continue;
    if (dist2d(o, e) > a.aura) continue;
    o.boost = Math.max(o.boost, 0.25);
    o.commanded = 0.25;
    if (fighting && (o.state === 'PATROL' || o.state === 'IDLE' || o.state === 'SUSPICIOUS')) {
      o.lastSeen = { x: e.lastSeen.x, z: e.lastSeen.z }; o.lastSeenT = sim.time; o.pendingAlert = true; o.alertDelay = 0.4;
    }
  }
}

function supportTick(e, sim, dt) {
  const h = ARCHETYPES[e.type].healer;
  e.healCd -= dt;
  if (e.healCd > 0 || e.stun > 0) return;
  let best = null, bd = Infinity;
  for (const o of sim.enemies) {
    if (o === e || !o.alive || o.hp >= o.maxHp * 0.75) continue;
    const d = dist2d(o, e);
    if (d < h.range && d < bd) { bd = d; best = o; }
  }
  if (best) {
    best.hp = Math.min(best.maxHp, best.hp + h.amount);
    e.healCd = h.every;
    sim.emit({ t: 'heal', id: best.id, by: e.id });
  } else e.healCd = 1;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

/* Called by the sim when an enemy takes damage. */
export function onEnemyHurt(e, sim, attacker) {
  e.hitT = 0;
  if (attacker) {
    e.lastSeen = { x: attacker.x, z: attacker.z }; e.lastSeenT = sim.time; e.target = attacker; e.awareness = 1;
    if (e.state !== 'COMBAT' && e.state !== 'REPOSITION') beginCombat(e, sim);
  }
}
