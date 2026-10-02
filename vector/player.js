/* ============================================================
   vector/player.js  |  Pure player state + movement physics.
   The exact same stepPlayer() runs in the browser (prediction)
   and on the server (authority).
   ============================================================ */
import { PLAYER } from './config.js';
import { ARMOR, WEAPONS, EQUIPMENT, LOADOUTS, sanitizeLoadout } from './weapons.js';

export function makeCmd(over = {}) {
  return { seq: 0, dt: 1 / 60, mx: 0, mz: 0, yaw: 0, pitch: 0, sprint: false, crouch: false, jump: false, ads: false, fire: false, reload: false, interact: false, ...over };
}

/* Build a fresh player from a (sanitised) loadout. */
export function createPlayer(id, name, loadout, level = 1) {
  const lo = sanitizeLoadout(loadout || LOADOUTS.ASSAULT, level);
  const primary = WEAPONS[lo.primary], secondary = WEAPONS[lo.secondary];
  const armor = ARMOR[lo.armor];
  const eq = EQUIPMENT[lo.tactical];
  return {
    id, name, team: 0, isBot: false,
    x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: 0,
    onGround: true, crouched: false, sprinting: false, ads: false,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
    armor: armor.points, armorType: lo.armor, armorMax: armor.points,
    alive: true, downed: false, downTimer: 0, reviveProgress: 0, respawnT: 0,
    loadout: lo,
    slots: [
      { id: primary.id, mag: primary.mag, reserve: primary.reserve },
      { id: secondary.id, mag: secondary.mag, reserve: secondary.reserve },
    ],
    cur: 0,
    reloadT: 0, fireCd: 0, switchT: 0, swapTo: -1,
    equip: { id: eq.id, count: eq.count }, heal: lo.heal, healT: 0,
    missionItem: null,
    blind: 0, noise: 0, recon: 0,
    lastSeq: 0, budget: 0.25, trusted: true,
    ctl: makeCmd(), prevFire: false, prevInteract: false, prevReload: false,
    stats: { kills: 0, deaths: 0, assists: 0, shots: 0, hits: 0, headshots: 0, dist: 0, objectives: 0, damage: 0 },
    assistMap: {},
    score: 0,
    look: null,
  };
}

export function eyeHeight(p) { return p.crouched ? PLAYER.crouchEye : PLAYER.eye; }
export function bodyHeight(p) { return p.crouched ? PLAYER.crouchHeight : PLAYER.height; }
export function currentWeapon(p) { return WEAPONS[p.slots[p.cur].id]; }

/* Movement speed after stance, weapon, armour and ADS penalties. */
export function moveSpeed(p, cmd) {
  const w = currentWeapon(p);
  const a = ARMOR[p.armorType] || ARMOR.none;
  let s = PLAYER.run;
  if (cmd.crouch) s = PLAYER.crouch;
  else if (cmd.sprint && cmd.mz < -0.1 && !cmd.ads) s = PLAYER.sprint;
  else if (cmd.ads) s = PLAYER.walk;
  return s * w.moveMult * a.speed * (p.healT > 0 ? 0.6 : 1);
}

/* Advance one player's movement by one input command. Mutates p. */
export function stepPlayer(map, p, cmd, dt) {
  dt = Math.min(Math.max(dt, 0), 0.05);
  if (!p.alive || p.downed) { p.vx = p.vz = 0; return; }
  p.yaw = cmd.yaw; p.pitch = Math.max(-1.45, Math.min(1.45, cmd.pitch));
  // stance (cannot stand up under a low ceiling)
  const wantCrouch = !!cmd.crouch;
  if (wantCrouch !== p.crouched) {
    if (wantCrouch) p.crouched = true;
    else {
      const ceil = map.ceilingAt(p.x, p.z, PLAYER.radius, p.y + PLAYER.crouchHeight);
      if (ceil - p.y > PLAYER.height + 0.05) p.crouched = false;
    }
  }
  p.ads = !!cmd.ads;
  // wish direction in world space (yaw 0 faces -Z; mz<0 means forward)
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  let wx = cmd.mx * cos + cmd.mz * sin;
  let wz = -cmd.mx * sin + cmd.mz * cos;
  const wl = Math.hypot(wx, wz);
  if (wl > 1) { wx /= wl; wz /= wl; }
  const speed = moveSpeed(p, { ...cmd, crouch: p.crouched });
  p.sprinting = speed > PLAYER.run * 0.95 && wl > 0.1 && !p.crouched && cmd.sprint && !cmd.ads;
  const tvx = wx * speed, tvz = wz * speed;
  const accel = (p.onGround ? PLAYER.accel : PLAYER.accel * PLAYER.airControl) * dt;
  const dvx = tvx - p.vx, dvz = tvz - p.vz, dl = Math.hypot(dvx, dvz);
  if (dl <= accel || dl < 1e-6) { p.vx = tvx; p.vz = tvz; } else { p.vx += (dvx / dl) * accel; p.vz += (dvz / dl) * accel; }
  // jump
  if (cmd.jump && p.onGround && !p.crouched) { p.vy = PLAYER.jump; p.onGround = false; }
  // integrate horizontally in sub-steps so we never tunnel through thin walls
  const ox = p.x, oz = p.z;
  const mvx = p.vx * dt, mvz = p.vz * dt;
  const sub = Math.max(1, Math.ceil(Math.hypot(mvx, mvz) / 0.25));
  const h = bodyHeight(p);
  for (let i = 0; i < sub; i++) {
    p.x += mvx / sub; p.z += mvz / sub;
    map.resolveCircle(p, PLAYER.radius, h, PLAYER.stepUp);
    // climb small steps while grounded
    if (p.onGround) {
      const g = map.groundAt(p.x, p.z, PLAYER.radius, p.y, PLAYER.stepUp);
      if (g > p.y) p.y = g;
    }
  }
  // vertical
  p.vy -= PLAYER.gravity * dt;
  let ny = p.y + p.vy * dt;
  const reach = p.onGround ? PLAYER.stepUp : 0.05;
  const floorY = map.groundAt(p.x, p.z, PLAYER.radius, p.y, reach);
  if (p.vy > 0) {
    const ceil = map.ceilingAt(p.x, p.z, PLAYER.radius, p.y + h);
    if (ny + h > ceil) { ny = ceil - h; p.vy = 0; }
  }
  if (p.vy <= 0 && ny <= floorY + 1e-4) { ny = floorY; p.vy = 0; p.onGround = true; }
  else if (p.onGround && p.vy <= 0 && p.y - floorY < 0.08) { ny = floorY; p.vy = 0; }
  else p.onGround = false;
  p.y = Math.max(0, ny);
  p.stats.dist += Math.hypot(p.x - ox, p.z - oz);
  // noise emitted for AI hearing
  const moving = Math.hypot(p.vx, p.vz);
  p.noise = p.crouched ? 0 : p.sprinting ? 14 : moving > 3.5 ? 8 : 0;
}
