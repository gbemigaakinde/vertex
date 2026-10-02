/* ============================================================
   vector/sim.js  |  MatchSim: the one authoritative simulation.
   - Single player / campaign: runs locally in the browser.
   - Co-op, Team Skirmish, Free-For-All: runs on the multiplayer
     server. Clients send inputs only; they never report kills,
     damage, ammo or positions.
   Pure logic: no DOM, no Three.js, no timers.
   ============================================================ */
import { PLAYER, NET, MODES, XP } from './config.js';
import { WEAPONS, EQUIPMENT, ARMOR, sanitizeLoadout } from './weapons.js';
import { falloffDamage, applyDamage, spreadDir, dirFromAngles, rayHumanoid, rayBox } from './combat.js';
import { buildMap, makeRng, hashStr } from './world.js';
import { createPlayer, stepPlayer, currentWeapon, eyeHeight, bodyHeight, makeCmd } from './player.js';
import { ARCHETYPES, createEnemy, updateEnemy, onEnemyHurt, raiseAlert } from './enemies.js';
import { MissionRunner, getMission } from './missions.js';

const DIFFICULTY = {
  recruit: { acc: 0.75, dmg: 0.7 },
  standard: { acc: 1, dmg: 1 },
  veteran: { acc: 1.2, dmg: 1.25 },
};
const r2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d = 0) => (Number.isFinite(v) ? v : d);

export class MatchSim {
  constructor(opts = {}) {
    this.mode = MODES[opts.mode] ? opts.mode : 'campaign';
    this.modeDef = MODES[this.mode];
    this.mission = null;
    if (this.modeDef.mission) {
      this.mission = typeof opts.mission === 'string' ? getMission(opts.mission) : opts.mission;
      if (!this.mission) throw new Error('Mission not found: ' + opts.mission);
    }
    this.mapId = this.mission ? this.mission.map : (opts.mapId || 'industrial');
    this.map = buildMap(this.mapId);
    this.seed = opts.seed || hashStr(this.mapId + (this.mission ? this.mission.id : this.mode));
    this.rnd = makeRng(this.seed ^ 0x9e3779b9);
    this.rndSpawn = makeRng(this.seed);
    this.diff = DIFFICULTY[opts.difficulty] || DIFFICULTY.standard;
    this.time = 0;
    this.tick = 0;
    this.state = 'PENDING';           // PENDING -> RUNNING -> SUCCESS | FAILED | FINISHED
    this.result = null;
    this.players = new Map();
    this.enemies = [];
    this.npcs = [];
    this.projectiles = [];
    this.smokes = [];
    this.interactables = [];
    this.pickups = this.map.pickups.map((p, i) => ({ id: 'p' + i, type: p.type, x: p.x, z: p.z, taken: false, respawn: 0, drop: false }));
    this.doors = this.map.boxes.filter((b) => b.door);
    this.damageable = new Map();      // box id -> { box, type, ref }
    this.events = [];
    this.noises = [];
    this.pathBudget = 0;
    this._eid = 1; this._iid = 1; this._nid = 1; this._pid = 1000; this._prid = 1;
    this.teamScore = [0, 0, 0];
    this.checkpoint = null;
    this.stepNoise = 0;
    this.runner = this.mission ? new MissionRunner(this.mission, this) : null;
    this.firstAlert = false;
    for (const bd of this.map.barrels) {
      const box = this.map.boxes.find((b) => b.id === bd.id);
      if (box) this.damageable.set(box.id, { box, type: 'barrel', hp: box.hp || 30 });
    }
  }

  emit(ev) { ev.tm = r2(this.time); this.events.push(ev); if (this.events.length > 400) this.events.shift(); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  /* ---------------- players ---------------- */
  addPlayer(id, name, loadout, o = {}) {
    if (this.players.has(id)) return this.players.get(id);
    const level = o.level || 1;
    const p = createPlayer(id, name, loadout, level);
    p.trusted = o.trusted !== false;
    p.look = o.look || null;
    p.level = level;
    p.connected = true;
    p.violations = 0;
    p.invuln = 0;
    if (this.mode === 'tdm') {
      const counts = [0, 0];
      for (const q of this.players.values()) counts[q.team] = (counts[q.team] || 0) + 1;
      p.team = o.team === 0 || o.team === 1 ? o.team : (counts[0] <= counts[1] ? 0 : 1);
    } else p.team = this.mode === 'ffa' ? 0 : 0;
    this.players.set(id, p);
    this.placeAtSpawn(p, true);
    return p;
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  placeAtSpawn(p, first = false) {
    let sp;
    const n = this.players.size;
    if (this.modeDef.mission) {
      const list = this.map.spawns.players;
      sp = list[(n - 1 + list.length) % list.length];
    } else {
      const pool = this.mode === 'tdm' ? (p.team === 0 ? this.map.spawns.teamA : this.map.spawns.teamB) : this.map.spawns.ffa;
      let best = null, bd = -1;
      for (const s of pool) {
        let md = Infinity;
        for (const q of this.players.values()) {
          if (q === p || !q.alive) continue;
          const hostile = this.mode === 'ffa' ? true : q.team !== p.team;
          if (!hostile) continue;
          md = Math.min(md, Math.hypot(q.x - s.x, q.z - s.z));
        }
        const score = md === Infinity ? this.rnd() * 10 : md + this.rnd() * 3;
        if (score > bd) { bd = score; best = s; }
      }
      sp = best || pool[0] || this.map.spawns.ffa[0];
    }
    p.x = sp.x; p.z = sp.z; p.y = 0; p.yaw = sp.yaw || 0; p.vx = p.vz = p.vy = 0; p.onGround = true;
    if (!first) p.invuln = 2;
  }

  activePlayers() {
    const out = [];
    for (const p of this.players.values()) if (p.alive && !p.downed && p.connected !== false) out.push(p);
    return out;
  }
  firstPlayerPos() { const p = this.players.values().next().value; return p ? { x: p.x, z: p.z } : { x: 0, z: 0 }; }

  isHostile(a, b) {
    if (a === b) return false;
    if (this.mode === 'tdm') return a.team !== b.team;
    if (this.mode === 'ffa') return true;
    return false;
  }

  /* Apply one client input command. This is the only way a client moves. */
  applyInput(id, cmd) {
    const p = this.players.get(id);
    if (!p || this.state !== 'RUNNING' || !cmd) return false;
    const seq = cmd.seq | 0;
    if (seq && seq <= p.lastSeq) return false;
    let dt = clamp(num(cmd.dt, 1 / 60), 0, NET.maxDt);
    if (!p.trusted) {
      if (dt > p.budget + 1e-4) { p.violations++; dt = Math.max(0, p.budget); }
      p.budget -= dt;
    }
    const c = {
      seq, dt,
      mx: clamp(num(cmd.mx), -1, 1), mz: clamp(num(cmd.mz), -1, 1),
      yaw: num(cmd.yaw, p.yaw), pitch: clamp(num(cmd.pitch, p.pitch), -1.45, 1.45),
      sprint: !!cmd.sprint, crouch: !!cmd.crouch, jump: !!cmd.jump, ads: !!cmd.ads,
      fire: !!cmd.fire, reload: !!cmd.reload, interact: !!cmd.interact,
      sw: cmd.sw === 0 || cmd.sw === 1 ? cmd.sw : -1, equip: !!cmd.equip, heal: !!cmd.heal,
    };
    p.lastSeq = seq || p.lastSeq;
    p.ctl = c;
    // Quick taps between two server ticks must not be lost: remember them until the next tick.
    const A = p.acc || (p.acc = {});
    A.fire = A.fire || c.fire; A.reload = A.reload || c.reload; A.equip = A.equip || c.equip; A.heal = A.heal || c.heal; A.interact = A.interact || c.interact;
    if (c.sw >= 0) A.sw = c.sw;
    if (p.alive && !p.downed) stepPlayer(this.map, p, c, dt);
    return true;
  }

  /* ---------------- start / finish ---------------- */
  start() {
    if (this.state !== 'PENDING') return;
    this.state = 'RUNNING';
    if (this.runner) {
      for (const g of this.mission.enemies || []) this.spawnGroup(g);
      this.runner.start(0);
      this.markCheckpoint(0);
    } else {
      this.emit({ t: 'matchStart', mode: this.mode });
    }
  }

  finish(outcome, reason) {
    if (this.result) return;
    this.state = outcome;
    const players = [];
    let winnerTeam = null, winnerId = null;
    if (this.mode === 'tdm') winnerTeam = this.teamScore[0] === this.teamScore[1] ? -1 : (this.teamScore[0] > this.teamScore[1] ? 0 : 1);
    if (this.mode === 'ffa') {
      let top = null;
      for (const p of this.players.values()) if (!top || p.score > top.score) top = p;
      winnerId = top ? top.id : null;
    }
    for (const p of this.players.values()) {
      const win = outcome === 'SUCCESS' || (this.mode === 'tdm' && p.team === winnerTeam) || (this.mode === 'ffa' && p.id === winnerId);
      const xp = p.stats.kills * XP.kill + p.stats.assists * XP.assist + p.stats.objectives * XP.objective + (win ? XP.win : 0) +
        (outcome === 'SUCCESS' && this.mission ? (this.mission.reward.xp || XP.missionBase) : 0);
      players.push({ id: p.id, name: p.name, team: p.team, score: p.score, win, xp,
        stats: { ...p.stats, dist: Math.round(p.stats.dist) } });
    }
    this.result = { outcome, reason, mode: this.mode, mission: this.mission ? this.mission.id : null, time: Math.round(this.time), teamScore: this.teamScore.slice(0, 2), winnerTeam, winnerId, players };
    this.emit({ t: 'end', outcome, reason });
  }
  fail(reason) { if (this.runner) this.runner.fail(reason); else this.finish('FAILED', reason); }
  creditObjective() { for (const p of this.activePlayers()) p.stats.objectives++; }

  /* ---------------- checkpoints (single player) ---------------- */
  markCheckpoint(index) {
    if (this.mode !== 'campaign') return;
    const players = {};
    for (const p of this.players.values()) {
      players[p.id] = { x: p.x, z: p.z, hp: Math.max(60, p.hp), armor: p.armor, slots: p.slots.map((s) => ({ ...s })), cur: p.cur, equip: { ...p.equip }, heal: p.heal, missionItem: p.missionItem };
    }
    this.checkpoint = {
      mission: this.mission.id, index, time: this.time,
      deadEnemies: this.enemies.filter((e) => !e.alive).map((e) => e.id),
      taken: this.pickups.filter((p) => p.taken && !p.drop).map((p) => p.id),
      doors: this.doors.filter((d) => d.open).map((d) => d.id),
      players, timeLeft: this.runner ? this.runner.timeLeft : null,
    };
    if (index > 0) this.emit({ t: 'checkpoint', index });
  }

  restoreCheckpoint(cp) {
    if (!cp || !this.runner || cp.mission !== this.mission.id) return false;
    this.enemies = this.enemies.filter((e) => !cp.deadEnemies.includes(e.id));
    for (const p of this.pickups) if (cp.taken.includes(p.id)) p.taken = true;
    for (const d of this.doors) if (cp.doors.includes(d.id)) d.open = true;
    // clear objective-0 entities that start() created, then begin the saved objective
    this.clearObjectiveEntities();
    for (const p of this.players.values()) {
      const s = cp.players[p.id]; if (!s) continue;
      Object.assign(p, { x: s.x, z: s.z, y: 0, hp: s.hp, armor: s.armor, cur: s.cur, heal: s.heal, missionItem: s.missionItem, alive: true, downed: false });
      p.slots = s.slots.map((x) => ({ ...x })); p.equip = { ...s.equip };
      p.invuln = 3;
    }
    this.runner.timeLeft = cp.timeLeft;
    this.runner.spoken = new Set(this.runner.spoken);
    this.runner.begin(cp.index);
    if (this.mission.objectives.slice(0, cp.index).some((o) => o.type === 'rescue')) {
      const pp = this.firstPlayerPos();
      this.addNpc({ x: pp.x + 1.5, z: pp.z, name: 'Ally', state: 'follow' });
    }
    this.state = 'RUNNING'; this.result = null; this.runner.done = false; this.runner.failed = false;
    this.emit({ t: 'restored', index: cp.index });
    return true;
  }

  clearObjectiveEntities() {
    this.interactables = [];
    for (const [id, d] of [...this.damageable]) if (d.type === 'target') { this.map.removeBox(d.box); this.damageable.delete(id); }
    this.npcs = [];
  }

  /* ---------------- mission helpers ---------------- */
  addInteractable(spec) {
    const it = { id: 'i' + this._iid++, progress: 0, touched: -1, ...spec };
    this.interactables.push(it);
    return it;
  }
  removeInteractable(id) { this.interactables = this.interactables.filter((i) => i.id !== id); }

  addPickup(type, x, z) {
    const p = this.map.snapWalkable(x, z, 6) || { x, z };
    const pk = { id: 'p' + (this._pid++), type, x: p.x, z: p.z, taken: false, respawn: 0, drop: true, ttl: 600 };
    this.pickups.push(pk);
    return pk;
  }

  addNpc(o) {
    const n = { id: 'n' + this._nid++, x: o.x, y: 0, z: o.z, yaw: 0, hp: 120, maxHp: 120, armor: 0, armorType: 'none', alive: true, isNpc: true, crouched: false, name: o.name || 'Ally', state: o.state || 'follow', path: null, pathI: 0, pathT: 0 };
    this.npcs.push(n);
    return n;
  }

  spawnTarget(o) {
    const box = this.map.addBox({ x: o.x, z: o.z, w: 1.0, d: 1.0, y: 0, h: 1.3, kind: 'target', color: '#a53a2a', hp: o.hp, label: o.label });
    const t = { id: box.id, x: o.x, z: o.z, hp: o.hp, maxHp: o.hp, label: o.label, obj: o.obj };
    this.damageable.set(box.id, { box, type: 'target', hp: o.hp, ref: t });
    return t;
  }

  spawnGroup(g) {
    const z = this.map.zones[g.zone];
    if (!z) throw new Error('Unknown zone in enemy group: ' + g.zone);
    const out = [];
    for (let i = 0; i < (g.n || 1); i++) {
      const p = this.map.randomWalkable(z.x, z.z, z.r + 3, this.rndSpawn);
      if (!p) continue;
      let patrol = [];
      if (g.patrol) {
        for (let k = 0; k < 3; k++) { const w = this.map.randomWalkable(z.x, z.z, z.r + 10, this.rndSpawn); if (w) patrol.push(w); }
        patrol.unshift({ x: p.x, z: p.z });
      }
      const e = createEnemy('e' + this._eid++, g.type, p.x, p.z, { patrol, yaw: this.rndSpawn() * 6.28, group: g.zone });
      if (g.alert) {
        const tp = this.nearestPlayer(p.x, p.z);
        if (tp) { e.lastSeen = { x: tp.x, z: tp.z }; e.lastSeenT = this.time; e.state = 'ALERT'; e.awareness = 1; }
      }
      this.enemies.push(e); out.push(e);
    }
    return out;
  }

  nearestPlayer(x, z) {
    let best = null, bd = Infinity;
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  enemyTargets() {
    const out = [];
    for (const p of this.players.values()) if (p.alive && p.connected !== false) out.push(p);
    for (const n of this.npcs) if (n.alive && n.state === 'follow') out.push(n);
    return out;
  }

  setDoor(b, open, by) {
    if (b.open === open) return;
    b.open = open;
    this.emit({ t: 'door', id: b.id, open, by });
  }

  /* ---------------- damage helpers ---------------- */
  hurtPlayer(p, amount, src = {}) {
    if (!p.alive || p.downed || p.invuln > 0 || amount <= 0) return;
    const r = applyDamage(p, amount, { ignoreArmor: src.ignoreArmor });
    p.healT = 0;
    if (src.pid && src.pid !== p.id) p.assistMap[src.pid] = (p.assistMap[src.pid] || 0) + r.dealt;
    let ang = 0;
    if (src.x !== undefined) ang = Math.atan2(-(src.x - p.x), -(src.z - p.z)) - p.yaw;
    this.emit({ t: 'hurt', id: p.id, dmg: Math.round(r.dealt + r.absorbed), ang: r2(ang) });
    if (p.hp <= 0) this.playerDown(p, src);
  }

  playerDown(p, src) {
    if (this.mode === 'coop') {
      const others = [...this.players.values()].some((q) => q !== p && q.alive && !q.downed && q.connected !== false);
      if (others) { p.downed = true; p.downTimer = 30; p.reviveProgress = 0; p.hp = 0; this.emit({ t: 'down', id: p.id }); return; }
    }
    this.killPlayer(p, src);
  }

  killPlayer(p, src = {}) {
    if (!p.alive) return;
    p.alive = false; p.downed = false; p.hp = 0; p.stats.deaths++;
    p.respawnT = this.modeDef.mission ? 0 : 4;
    const killer = src.pid ? this.players.get(src.pid) : null;
    if (killer && killer !== p && this.isHostile(killer, p)) {
      killer.stats.kills++; killer.score += 1;
      if (this.mode === 'tdm') this.teamScore[killer.team]++;
    } else if (!killer && this.mode === 'ffa') { p.score = Math.max(0, p.score - 1); }
    for (const [pid, dmg] of Object.entries(p.assistMap)) {
      const a = this.players.get(pid);
      if (a && a !== killer && dmg >= 25) a.stats.assists++;
    }
    p.assistMap = {};
    this.emit({ t: 'kill', victim: p.id, killer: killer ? killer.id : (src.eid || null), w: src.w || null, head: !!src.head });
    if (this.mode === 'campaign' && this.state === 'RUNNING') this.finish('FAILED', 'Operative down');
  }

  damageEnemy(e, amount, src = {}) {
    if (!e.alive) return;
    const r = applyDamage(e, amount);
    if (src.pid) { const p = this.players.get(src.pid); if (p) { p.stats.hits++; p.stats.damage += r.dealt; if (src.head) p.stats.headshots++; } }
    const attacker = src.pid ? this.players.get(src.pid) : null;
    onEnemyHurt(e, this, attacker);
    if (e.hp <= 0) {
      e.alive = false; e.state = 'DEAD';
      if (attacker) { attacker.stats.kills++; attacker.score += 1; }
      this.emit({ t: 'kill', victim: e.id, killer: src.pid || null, w: src.w || null, head: !!src.head, enemy: e.type });
      if (this.rnd() < 0.3) this.pickups.push({ id: 'd' + this._prid++, type: 'ammo', x: e.x, z: e.z, taken: false, respawn: 0, drop: true, ttl: 60 });
      raiseAlert(this, e, { x: e.x, z: e.z }, 14);
    }
  }

  damageBox(box, amount, ownerId) {
    const d = this.damageable.get(box.id);
    if (!d) return;
    d.hp -= amount; box.hp = d.hp;
    if (d.ref) d.ref.hp = Math.max(0, d.hp);
    if (d.hp > 0) return;
    this.map.removeBox(box);
    this.damageable.delete(box.id);
    if (d.type === 'barrel') {
      this.emit({ t: 'barrel', id: box.id });
      this.explode(box.x, 0.6, box.z, 5.0, 95, ownerId);
    } else if (d.type === 'target') {
      this.emit({ t: 'targetDown', id: box.id, x: box.x, z: box.z });
      this.explode(box.x, 0.8, box.z, 3.0, 40, ownerId, true);
      if (this.runner) this.runner.onTargetDestroyed(d.ref);
    } else if (d.type === 'cover') {
      this.emit({ t: 'coverGone', id: box.id });
    }
  }

  explode(x, y, z, radius, damage, ownerId, quiet = false) {
    this.emit({ t: 'explosion', x: r2(x), y: r2(y), z: r2(z), r: radius });
    this.noises.push({ x, z, r: 60, t: this.time, source: ownerId || 'env' });
    const c = { x, y: y + 0.4, z };
    const falloff = (d) => Math.pow(clamp(1 - d / radius, 0, 1), 0.8);
    for (const p of this.players.values()) {
      if (!p.alive || p.downed) continue;
      const d = Math.hypot(p.x - x, p.y + 0.9 - y, p.z - z);
      if (d > radius) continue;
      if (!this.map.clearLine(c, { x: p.x, y: p.y + 0.9, z: p.z })) continue;
      const own = ownerId === p.id;
      const attacker = ownerId ? this.players.get(ownerId) : null;
      if (!own && attacker && !this.isHostile(attacker, p) && this.modeDef.mission) continue;
      this.hurtPlayer(p, damage * falloff(d) * (own ? 0.5 : 1), { pid: ownerId, x, z, w: 'explosive' });
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - x, 0.9 - y, e.z - z);
      if (d > radius) continue;
      if (!this.map.clearLine(c, { x: e.x, y: 0.9, z: e.z })) continue;
      this.damageEnemy(e, damage * falloff(d), { pid: ownerId, w: 'explosive' });
    }
    for (const n of this.npcs) {
      if (!n.alive) continue;
      const d = Math.hypot(n.x - x, n.z - z);
      if (d <= radius) this.hurtNpc(n, damage * 0.6 * falloff(d));
    }
    for (const [id, dm] of [...this.damageable]) {
      const b = dm.box; const d = Math.hypot(b.x - x, b.z - z);
      if (d <= radius + 0.5 && (dm.type !== 'cover')) this.damageBox(b, damage * falloff(d) * 1.1, ownerId);
    }
  }

  hurtNpc(n, amount) {
    if (!n.alive) return;
    n.hp -= amount;
    if (n.hp <= 0) { n.alive = false; this.emit({ t: 'npcDown', id: n.id }); if (this.runner) this.runner.onNpcDead(n); }
  }

  /* ---------------- shooting ---------------- */
  hitscan(shooter, origin, dir, w, wid) {
    const range = w.range;
    const wall = this.map.raycast(origin, dir, range);
    const tmax = wall ? wall.t : range;
    let best = null;
    const test = (obj, kind, h, rad, ref) => {
      const hit = rayHumanoid(origin, dir, obj.x, obj.y || 0, obj.z, h, rad, tmax);
      if (hit && (!best || hit.t < best.t)) best = { ...hit, kind, ref };
    };
    for (const p of this.players.values()) {
      if (p === shooter || !p.alive || p.downed || p.invuln > 0 || !this.isHostile(shooter, p)) continue;
      test(p, 'player', bodyHeight(p), PLAYER.radius, p);
    }
    for (const e of this.enemies) if (e.alive) test(e, 'enemy', ARCHETYPES[e.type].height, ARCHETYPES[e.type].radius, e);
    const endT = best ? best.t : tmax;
    const end = { x: origin.x + dir.x * endT, y: origin.y + dir.y * endT, z: origin.z + dir.z * endT };
    return { best, wall, endT, end };
  }

  fireWeapon(p) {
    const wid = p.slots[p.cur].id;
    const w = WEAPONS[wid];
    const slot = p.slots[p.cur];
    slot.mag--;
    p.stats.shots++;
    const eye = { x: p.x, y: p.y + eyeHeight(p), z: p.z };
    const base = dirFromAngles(p.yaw, p.pitch);
    const moving = Math.hypot(p.vx, p.vz);
    let spread = (p.ads ? w.spread.ads : w.spread.hip) * (1 + moving * 0.07) * (p.crouched ? 0.8 : 1) + (p.bloom || 0);
    p.bloom = Math.min(3, (p.bloom || 0) + 0.12 + w.recoil.v * 0.05);
    this.noises.push({ x: p.x, z: p.z, r: 45, t: this.time, source: p.id });
    if (w.projectile) {
      const pr = w.projectile;
      this.projectiles.push({ id: 'r' + this._prid++, kind: 'rocket', x: eye.x + base.x * 0.6, y: eye.y + base.y * 0.6 - 0.15, z: eye.z + base.z * 0.6, vx: base.x * pr.speed, vy: base.y * pr.speed, vz: base.z * pr.speed, ttl: 5, owner: p.id, dmg: w.damage, radius: pr.radius, grav: pr.gravity });
      this.emit({ t: 'shot', by: p.id, w: wid, rocket: 1 });
      return;
    }
    let first = null;
    for (let i = 0; i < w.pellets; i++) {
      const dir = spreadDir(base, spread, this.rnd);
      const { best, wall, endT, end } = this.hitscan(p, eye, dir, w, wid);
      if (!first) first = end;
      if (best) {
        const dist = best.t;
        const dmg = falloffDamage(w, dist) * (best.head ? w.headMult : 1);
        p.stats.hits += 0;   // counted once per shot below
        if (best.kind === 'enemy') this.damageEnemy(best.ref, dmg, { pid: p.id, head: best.head, w: wid });
        else {
          this.hurtPlayer(best.ref, dmg, { pid: p.id, x: p.x, z: p.z, w: wid, head: best.head });
          p.stats.hits++; p.stats.damage += dmg; if (best.head) p.stats.headshots++;
        }
        this.emit({ t: 'hit', by: p.id, kind: best.kind, head: !!best.head, x: r2(end.x), y: r2(end.y), z: r2(end.z) });
      } else if (wall) {
        const b = wall.box;
        if (this.damageable.has(b.id)) { this.damageBox(b, falloffDamage(w, wall.t), p.id); p.stats.hits++; }
        this.emit({ t: 'impact', x: r2(end.x), y: r2(end.y), z: r2(end.z), k: b.kind });
      }
    }
    this.emit({ t: 'shot', by: p.id, w: wid, ex: r2(first.x), ey: r2(first.y), ez: r2(first.z) });
  }

  enemyFire(e, tgt) {
    const a = ARCHETYPES[e.type], w = a.weapon;
    const origin = { x: e.x, y: e.y + 1.5, z: e.z };
    const tp = { x: tgt.x, y: (tgt.y || 0) + (tgt.crouched ? 0.8 : 1.2), z: tgt.z };
    const dx = tp.x - origin.x, dy = tp.y - origin.y, dz = tp.z - origin.z;
    const dist = Math.hypot(dx, dy, dz) || 1;
    const dir = { x: dx / dist, y: dy / dist, z: dz / dist };
    let acc = clamp(w.accuracy * this.diff.acc + (e.commanded > 0 ? 0.12 : 0), 0.1, 0.95);
    e.commanded = Math.max(0, (e.commanded || 0) - 0.05);
    let err = (1 - acc) * 6 + dist * 0.05;
    if (tgt.sprinting) err *= 1.25;
    if (tgt.crouched) err *= 0.9;
    const d = spreadDir(dir, err, this.rnd);
    const wall = this.map.raycast(origin, d, w.range);
    const tmax = wall ? wall.t : w.range;
    let best = null;
    for (const t of this.enemyTargets(e)) {
      const h = t.isNpc ? 1.75 : bodyHeight(t);
      const hit = rayHumanoid(origin, d, t.x, t.y || 0, t.z, h, 0.4, tmax);
      if (hit && (!best || hit.t < best.t)) best = { ...hit, t2: t };
    }
    const endT = best ? best.t : tmax;
    this.emit({ t: 'shot', by: e.id, w: 'enemy_' + a.id, ox: r2(origin.x), oy: r2(origin.y), oz: r2(origin.z),
      ex: r2(origin.x + d.x * endT), ey: r2(origin.y + d.y * endT), ez: r2(origin.z + d.z * endT) });
    this.noises.push({ x: e.x, z: e.z, r: 30, t: this.time, source: e.id });
    if (best) {
      const dmg = w.damage * this.diff.dmg * (best.head ? 1.4 : 1);
      if (best.t2.isNpc) this.hurtNpc(best.t2, dmg);
      else this.hurtPlayer(best.t2, dmg, { eid: e.id, x: e.x, z: e.z, w: 'enemy' });
    } else if (wall && this.damageable.has(wall.box.id)) this.damageBox(wall.box, w.damage, null);
  }

  /* ---------------- per-step logic ---------------- */
  step(dt) {
    if (this.state !== 'RUNNING') return;
    dt = Math.min(dt, 0.1);
    this.time += dt; this.tick++;
    this.pathBudget = 8;
    this.noises = this.noises.filter((n) => this.time - n.t < 0.35);
    for (const p of this.players.values()) this.tickPlayer(p, dt);
    for (const e of this.enemies) if (e.alive) { updateEnemy(e, this, dt); }
    for (const n of this.npcs) if (n.alive) this.tickNpc(n, dt);
    this.tickProjectiles(dt);
    for (const s of this.smokes) s.ttl -= dt;
    this.smokes = this.smokes.filter((s) => s.ttl > 0);
    for (const [id, d] of [...this.damageable]) {
      if (d.type === 'cover') { d.ttl -= dt; if (d.ttl <= 0) { this.map.removeBox(d.box); this.damageable.delete(id); this.emit({ t: 'coverGone', id }); } }
    }
    this.tickPickups(dt);
    this.tickInteractables(dt);
    for (const p of this.players.values()) p.acc = {};
    if (this.runner) {
      this.runner.update(dt);
      // Alert dialogue trigger
      if (!this.firstAlert && this.enemies.some((e) => e.alive && (e.state === 'COMBAT' || e.state === 'ALERT'))) { this.firstAlert = true; this.runner.onAlert(); }
      this.checkMissionFail();
    } else this.tickModeRules(dt);
    // remove dead enemies from processing lists lazily
    if (this.tick % 200 === 0) this.enemies = this.enemies.filter((e) => e.alive || this.time - (e.diedAt || (e.diedAt = this.time)) < 30);
  }

  checkMissionFail() {
    if (this.state !== 'RUNNING') return;
    const anyUp = [...this.players.values()].some((p) => p.connected !== false && p.alive);
    if (!anyUp && this.players.size) this.finish('FAILED', 'All operatives are down');
  }

  tickPlayer(p, dt) {
    p.invuln = Math.max(0, p.invuln - dt);
    if (!p.trusted) p.budget = Math.min(0.4, p.budget + dt);
    p.bloom = Math.max(0, (p.bloom || 0) - 2.2 * dt);
    p.blind = Math.max(0, p.blind - dt);
    p.recon = Math.max(0, p.recon - dt);
    if (p.noise > 0 && this.tick % 10 === 0) this.noises.push({ x: p.x, z: p.z, r: p.noise, t: this.time, source: p.id });
    const c = p.ctl, A = p.acc || {};
    const inFire = !!(A.fire || c.fire), inReload = !!(A.reload || c.reload), inEquip = !!(A.equip || c.equip), inHeal = !!(A.heal || c.heal);
    const inSw = A.sw !== undefined ? A.sw : c.sw;
    if (!p.alive) {
      if (!this.modeDef.mission && p.connected !== false) {
        p.respawnT -= dt;
        if (p.respawnT <= 0) this.respawn(p);
      }
      p.prevFire = inFire; p.prevInteract = c.interact; p.prevReload = inReload; p.prevEquip = inEquip; p.prevHeal = inHeal;
      return;
    }
    if (p.downed) {
      p.downTimer -= dt;
      if (p.downTimer <= 0) this.killPlayer(p, {});
      return;
    }
    // regen-free: hazards
    for (const h of this.map.hazards) {
      if (Math.abs(p.x - h.x) < h.w / 2 && Math.abs(p.z - h.z) < h.d / 2 && p.y < 0.5) this.hurtPlayer(p, h.dps * dt, { ignoreArmor: true, w: 'hazard' });
    }
    const w = currentWeapon(p);
    const slot = p.slots[p.cur];
    // weapon switch
    if (p.swapTo >= 0) {
      p.switchT -= dt;
      if (p.switchT <= 0) { p.cur = p.swapTo; p.swapTo = -1; p.reloadT = 0; }
    } else if (inSw >= 0 && inSw !== p.cur) { p.swapTo = inSw; p.switchT = 0.35; p.reloadT = 0; }
    // reload
    const wantReload = inReload && !p.prevReload;
    if (p.swapTo < 0 && p.reloadT <= 0 && ((wantReload && slot.mag < w.mag) || (slot.mag <= 0 && inFire && !p.prevFire)) && slot.reserve > 0 && slot.mag < w.mag) {
      p.reloadT = w.reload / 1000; this.emit({ t: 'reload', by: p.id, w: w.id });
    }
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) {
        const need = w.mag - slot.mag, take = Math.min(need, slot.reserve);
        slot.mag += take; slot.reserve -= take; p.reloadT = 0;
      }
    }
    // fire
    p.fireCd = Math.max(0, p.fireCd - dt);
    const interval = 60 / w.rpm;
    const trigger = w.auto ? inFire : (inFire && !p.prevFire);
    let guard = 0;
    while (trigger && p.fireCd <= 0 && p.swapTo < 0 && p.reloadT <= 0 && slot.mag > 0 && !p.sprinting && p.healT <= 0 && guard++ < 2) {
      this.fireWeapon(p);
      p.fireCd += interval;
      if (!w.auto) break;
    }
    if (p.fireCd < 0) p.fireCd = 0;
    // equipment
    if (inEquip && !p.prevEquip) this.useEquipment(p);
    // healing
    if (inHeal && !p.prevHeal && p.healT <= 0 && p.heal > 0 && p.hp < p.maxHp) { p.healT = EQUIPMENT.medkit.useTime; this.emit({ t: 'healStart', by: p.id }); }
    if (p.healT > 0) {
      p.healT -= dt;
      if (p.healT <= 0) { p.hp = Math.min(p.maxHp, p.hp + EQUIPMENT.medkit.heal); p.heal--; this.emit({ t: 'healed', by: p.id }); }
    }
    p.prevFire = inFire; p.prevReload = inReload; p.prevEquip = inEquip; p.prevHeal = inHeal;
    // interaction is handled in tickInteractables (needs edge state kept there)
  }

  respawn(p) {
    const lo = sanitizeLoadout(p.loadout, p.level || 1);
    const fresh = createPlayer(p.id, p.name, lo, p.level || 1);
    p.hp = fresh.hp; p.armor = fresh.armor; p.armorType = fresh.armorType; p.armorMax = fresh.armorMax;
    p.slots = fresh.slots; p.cur = 0; p.equip = fresh.equip; p.heal = fresh.heal;
    p.alive = true; p.downed = false; p.reloadT = 0; p.healT = 0; p.swapTo = -1; p.crouched = false;
    this.placeAtSpawn(p);
    this.emit({ t: 'respawn', id: p.id });
  }

  useEquipment(p) {
    if (p.equip.count <= 0) return;
    const eq = EQUIPMENT[p.equip.id];
    const eye = { x: p.x, y: p.y + eyeHeight(p), z: p.z };
    const dir = dirFromAngles(p.yaw, p.pitch);
    if (eq.kind === 'throw') {
      p.equip.count--;
      this.projectiles.push({ id: 'g' + this._prid++, kind: eq.id, x: eye.x + dir.x * 0.5, y: eye.y - 0.1, z: eye.z + dir.z * 0.5, vx: dir.x * eq.throwSpeed, vy: dir.y * eq.throwSpeed + 3.2, vz: dir.z * eq.throwSpeed, ttl: eq.fuse, owner: p.id, eq: eq.id });
      this.emit({ t: 'throw', by: p.id, eq: eq.id });
    } else if (eq.kind === 'pulse') {
      p.equip.count--; p.recon = eq.duration;
      this.emit({ t: 'recon', by: p.id, r: eq.radius });
    } else if (eq.kind === 'deploy') {
      const facingX = Math.abs(Math.sin(p.yaw)) > Math.abs(Math.cos(p.yaw));
      const cx = p.x + dir.x * 2.3, cz = p.z + dir.z * 2.3;
      const w = facingX ? eq.size[2] : eq.size[0], d = facingX ? eq.size[0] : eq.size[2];
      if (this.map.query(cx - w / 2 - 0.1, cz - d / 2 - 0.1, cx + w / 2 + 0.1, cz + d / 2 + 0.1).some((b) => this.map.isBlockingBox(b))) return;
      p.equip.count--;
      const box = this.map.addBox({ x: cx, z: cz, w, d, y: 0, h: eq.size[1], kind: 'cover', model: eq.model, color: '#5b6b7a', hp: eq.hp, rotated: !facingX });
      this.damageable.set(box.id, { box, type: 'cover', hp: eq.hp, ttl: eq.lifetime });
      this.emit({ t: 'cover', id: box.id, x: r2(cx), z: r2(cz), w: r2(w), d: r2(d), h: eq.size[1] });
    }
  }

  tickProjectiles(dt) {
    for (const pr of this.projectiles) {
      pr.ttl -= dt;
      if (pr.kind !== 'rocket') pr.vy -= 14 * dt;
      const ox = pr.x, oy = pr.y, oz = pr.z;
      const nx = pr.x + pr.vx * dt, ny = pr.y + pr.vy * dt, nz = pr.z + pr.vz * dt;
      const dx = nx - ox, dy = ny - oy, dz = nz - oz;
      const len = Math.hypot(dx, dy, dz);
      let hit = null;
      if (len > 1e-6) {
        const d = { x: dx / len, y: dy / len, z: dz / len };
        hit = this.map.raycast({ x: ox, y: oy, z: oz }, d, len + 0.08);
      }
      if (pr.kind === 'rocket') {
        let boom = !!hit || ny <= 0 || pr.ttl <= 0;
        if (!boom) {
          for (const e of this.enemies) if (e.alive && Math.hypot(e.x - nx, e.z - nz) < 0.7 && ny < 2.1) boom = true;
          for (const q of this.players.values()) if (q.id !== pr.owner && q.alive && Math.hypot(q.x - nx, q.z - nz) < 0.7 && ny < 2.1 && this.isHostile(this.players.get(pr.owner) || q, q)) boom = true;
        }
        pr.x = nx; pr.y = ny; pr.z = nz;
        if (boom) { pr.dead = true; this.explode(nx, Math.max(0.2, ny), nz, pr.radius, pr.dmg, pr.owner); }
        continue;
      }
      // grenades bounce
      if (hit) {
        const t = Math.max(0, hit.t - 0.02);
        const b = hit.box;
        const hx = ox + (dx / len) * t, hy = oy + (dy / len) * t, hz = oz + (dz / len) * t;
        const faces = [[Math.abs(hx - b.minX), -1, 0, 0], [Math.abs(hx - b.maxX), 1, 0, 0], [Math.abs(hz - b.minZ), 0, 0, -1], [Math.abs(hz - b.maxZ), 0, 0, 1], [Math.abs(hy - b.maxY), 0, 1, 0]];
        faces.sort((a, c) => a[0] - c[0]);
        const [, fx, fy, fz] = faces[0];
        const vn = pr.vx * fx + pr.vy * fy + pr.vz * fz;
        pr.vx = (pr.vx - 1.7 * vn * fx) * 0.55; pr.vy = (pr.vy - 1.7 * vn * fy) * 0.55; pr.vz = (pr.vz - 1.7 * vn * fz) * 0.55;
        pr.x = hx + fx * 0.05; pr.y = hy + fy * 0.05; pr.z = hz + fz * 0.05;
      } else {
        pr.x = nx; pr.y = ny; pr.z = nz;
        if (pr.y < 0.12) { pr.y = 0.12; pr.vy = Math.abs(pr.vy) * 0.35; pr.vx *= 0.7; pr.vz *= 0.7; }
      }
      if (pr.ttl <= 0) {
        pr.dead = true;
        this.detonate(pr);
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  detonate(pr) {
    const eq = EQUIPMENT[pr.eq];
    if (pr.eq === 'frag') this.explode(pr.x, pr.y, pr.z, eq.radius, eq.damage, pr.owner);
    else if (pr.eq === 'flash') {
      this.emit({ t: 'flash', x: r2(pr.x), y: r2(pr.y), z: r2(pr.z), r: eq.radius });
      const c = { x: pr.x, y: pr.y + 0.2, z: pr.z };
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        const d = Math.hypot(p.x - pr.x, p.z - pr.z);
        if (d > eq.radius || !this.map.clearLine(c, { x: p.x, y: p.y + 1.5, z: p.z })) continue;
        const view = dirFromAngles(p.yaw, p.pitch);
        const to = { x: pr.x - p.x, y: pr.y - (p.y + 1.5), z: pr.z - p.z }; const tl = Math.hypot(to.x, to.y, to.z) || 1;
        const facing = (view.x * to.x + view.y * to.y + view.z * to.z) / tl;
        p.blind = Math.max(p.blind, eq.blind * (0.4 + 0.6 * Math.max(0, facing)) * (1 - d / eq.radius * 0.6));
      }
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.x - pr.x, e.z - pr.z) <= eq.radius && this.map.clearLine(c, { x: e.x, y: 1.4, z: e.z })) e.stun = Math.max(e.stun, eq.blind + 0.8);
      }
      this.noises.push({ x: pr.x, z: pr.z, r: 35, t: this.time, source: pr.owner });
    } else if (pr.eq === 'smoke') {
      this.smokes.push({ x: pr.x, y: Math.max(1.4, pr.y + 1), z: pr.z, r: eq.radius * 0.75, ttl: eq.duration });
      this.emit({ t: 'smoke', x: r2(pr.x), y: r2(pr.y), z: r2(pr.z), r: eq.radius, ttl: eq.duration });
    }
  }

  tickNpc(n, dt) {
    if (n.state !== 'follow') return;
    const p = this.nearestPlayer(n.x, n.z);
    if (!p) return;
    const d = Math.hypot(p.x - n.x, p.z - n.z);
    if (d < 3.2) return;
    n.pathT -= dt;
    if (!n.path || n.pathT <= 0) {
      if (this.pathBudget > 0) { this.pathBudget--; n.path = this.map.findPath(n, p) || [{ x: p.x, z: p.z }]; n.pathI = 0; n.pathT = 1; }
    }
    if (!n.path) return;
    let wp = n.path[n.pathI];
    while (wp && Math.hypot(wp.x - n.x, wp.z - n.z) < 0.6 && n.pathI < n.path.length - 1) { n.pathI++; wp = n.path[n.pathI]; }
    if (!wp) return;
    const dx = wp.x - n.x, dz = wp.z - n.z, dl = Math.hypot(dx, dz) || 1;
    const sp = d > 8 ? 5.2 : 3.6;
    n.x += (dx / dl) * sp * dt; n.z += (dz / dl) * sp * dt; n.yaw = Math.atan2(-dx, -dz);
    for (const b of this.map.query(n.x - 1.2, n.z - 1.2, n.x + 1.2, n.z + 1.2)) if (b.door && !b.open) this.setDoor(b, true, n.id);
    this.map.resolveCircle(n, 0.4, 1.8, 0.5);
  }

  tickPickups(dt) {
    for (const pk of this.pickups) {
      if (pk.drop) { pk.ttl -= dt; if (pk.ttl <= 0) pk.taken = true; }
      if (pk.taken) {
        if (!pk.drop && !this.modeDef.mission) { pk.respawn -= dt; if (pk.respawn <= 0) pk.taken = false; }
        continue;
      }
      for (const p of this.players.values()) {
        if (!p.alive || p.downed) continue;
        if (Math.hypot(p.x - pk.x, p.z - pk.z) > 1.3) continue;
        if (this.applyPickup(p, pk)) { pk.taken = true; pk.respawn = 30; this.emit({ t: 'pickup', by: p.id, k: pk.type, id: pk.id }); break; }
      }
    }
    this.pickups = this.pickups.filter((p) => !(p.drop && p.taken));
  }

  applyPickup(p, pk) {
    if (pk.type === 'ammo') {
      let any = false;
      for (const s of p.slots) {
        const w = WEAPONS[s.id]; const cap = w.reserve * 2;
        if (s.reserve < cap) { s.reserve = Math.min(cap, s.reserve + w.pickupAmmo * 2); any = true; }
      }
      const eq = EQUIPMENT[p.equip.id];
      if (p.equip.count < eq.count + 1 && this.rnd() < 0.5) { p.equip.count++; any = true; }
      return any;
    }
    if (pk.type === 'health') {
      if (p.hp >= p.maxHp) return false;
      p.hp = Math.min(p.maxHp, p.hp + 40); return true;
    }
    if (pk.type === 'armor') {
      if (p.armorType === 'none') { p.armorType = 'light'; p.armorMax = ARMOR.light.points; }
      if (p.armor >= p.armorMax) return false;
      p.armor = Math.min(p.armorMax, p.armor + 40); return true;
    }
    return false;
  }

  tickInteractables(dt) {
    for (const p of this.players.values()) {
      if (!p.alive || p.downed) { p.prevInteract = p.ctl.interact; continue; }
      const held = !!((p.acc && p.acc.interact) || p.ctl.interact);
      const edge = held && !p.prevInteract;
      p.prevInteract = held;
      if (!held) { p.reviveProgress = 0; continue; }
      // 1) revive a downed teammate
      let target = null, bd = 2.3;
      if (this.mode === 'coop') for (const q of this.players.values()) {
        if (q === p || !q.downed) continue;
        const d = Math.hypot(q.x - p.x, q.z - p.z);
        if (d < bd) { bd = d; target = q; }
      }
      if (target) {
        target.reviveProgress += dt;
        if (target.reviveProgress >= 3) {
          target.downed = false; target.hp = 35; target.reviveProgress = 0; target.invuln = 2;
          this.emit({ t: 'revived', id: target.id, by: p.id });
        }
        continue;
      }
      // 2) mission interactables
      let it = null; bd = 2.3;
      for (const i of this.interactables) {
        const d = Math.hypot(i.x - p.x, i.z - p.z);
        if (d < bd) { bd = d; it = i; }
      }
      if (it) {
        it.progress += dt; it.touched = this.time;
        if (it.progress >= it.hold) { it.progress = it.hold; if (this.runner) this.runner.onInteract(it, p); }
        continue;
      }
      // 3) doors
      if (edge) {
        let door = null; bd = 2.6;
        for (const dbox of this.doors) {
          const d = Math.hypot(dbox.x - p.x, dbox.z - p.z);
          if (d < bd) { bd = d; door = dbox; }
        }
        if (door) this.setDoor(door, !door.open, p.id);
      }
    }
    for (const i of this.interactables) if (i.touched !== this.time) i.progress = Math.max(0, i.progress - dt * 2);
  }

  tickModeRules() {
    if (this.state !== 'RUNNING') return;
    const lim = this.modeDef;
    if (this.mode === 'tdm' && Math.max(this.teamScore[0], this.teamScore[1]) >= lim.scoreLimit) this.finish('FINISHED', 'Score limit reached');
    else if (this.mode === 'ffa') { for (const p of this.players.values()) if (p.score >= lim.scoreLimit) { this.finish('FINISHED', 'Score limit reached'); return; } }
    if (this.state === 'RUNNING' && this.time >= lim.timeLimit) this.finish('FINISHED', 'Time limit reached');
  }

  /* ---------------- snapshots ---------------- */
  snapshot(forId) {
    const you = forId ? this.players.get(forId) : null;
    const players = [];
    for (const p of this.players.values()) {
      const o = { id: p.id, n: p.name, tm: p.team, x: r2(p.x), y: r2(p.y), z: r2(p.z), yw: r2(p.yaw), pt: r2(p.pitch),
        hp: Math.round(p.hp), ar: Math.round(p.armor), al: p.alive ? 1 : 0, dn: p.downed ? 1 : 0, cr: p.crouched ? 1 : 0, ads: p.ads ? 1 : 0,
        sp: p.sprinting ? 1 : 0, w: p.slots[p.cur].id, rl: p.reloadT > 0 ? 1 : 0, sc: p.score, k: p.stats.kills, d: p.stats.deaths, a: p.stats.assists,
        cn: p.connected === false ? 0 : 1, rv: p.reviveProgress > 0 ? r2(p.reviveProgress / 3) : 0, dt: p.downed ? Math.round(p.downTimer) : 0, lk: p.look };
      if (p === you) {
        o.me = {
          ack: p.lastSeq, slots: p.slots.map((s) => ({ id: s.id, m: s.mag, r: s.reserve })), cur: p.cur, eq: p.equip.id, eqn: p.equip.count, heal: p.heal, healT: r2(p.healT),
          reload: r2(p.reloadT), armorType: p.armorType, armorMax: p.armorMax, blind: r2(p.blind), recon: r2(p.recon), item: p.missionItem, vx: r2(p.vx), vz: r2(p.vz), vy: r2(p.vy), og: p.onGround ? 1 : 0,
          resp: r2(Math.max(0, p.respawnT)), bloom: r2(p.bloom || 0),
        };
      }
      players.push(o);
    }
    const revealed = you && you.recon > 0 ? EQUIPMENT.recon.radius : 0;
    const enemies = [];
    for (const e of this.enemies) {
      if (!e.alive) { if (this.time - (e.diedAt || (e.diedAt = this.time)) < 6) enemies.push({ id: e.id, ty: e.type, x: r2(e.x), z: r2(e.z), yw: r2(e.yaw), hp: 0, st: 'DEAD' }); continue; }
      let near = Infinity, seenBy = false;
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        const d = Math.hypot(p.x - e.x, p.z - e.z);
        if (d < near) near = d;
        if (d < 50 && e.state !== 'IDLE' && this.map.clearLine({ x: p.x, y: p.y + 1.5, z: p.z }, { x: e.x, y: 1.4, z: e.z })) seenBy = true;
      }
      if (near > 110) continue;
      const rv = revealed && you && Math.hypot(you.x - e.x, you.z - e.z) <= revealed ? 1 : 0;
      enemies.push({ id: e.id, ty: e.type, x: r2(e.x), z: r2(e.z), yw: r2(e.yaw), hp: Math.round(e.hp), mh: e.maxHp, st: e.state, sp: seenBy ? 1 : 0, rv, aw: r2(e.awareness), stn: e.stun > 0 ? 1 : 0 });
    }
    return {
      tick: this.tick, time: r2(this.time), state: this.state, mode: this.mode,
      players, enemies,
      npcs: this.npcs.map((n) => ({ id: n.id, x: r2(n.x), z: r2(n.z), yw: r2(n.yaw), hp: Math.round(n.hp), al: n.alive ? 1 : 0, st: n.state })),
      proj: this.projectiles.map((p) => ({ id: p.id, k: p.kind, x: r2(p.x), y: r2(p.y), z: r2(p.z) })),
      smokes: this.smokes.map((s) => ({ x: r2(s.x), y: r2(s.y), z: r2(s.z), r: r2(s.r) })),
      ints: this.interactables.map((i) => ({ id: i.id, k: i.kind, x: r2(i.x), z: r2(i.z), l: i.label, p: r2(i.progress / i.hold) })),
      pk: this.pickups.filter((p) => !p.taken).map((p) => ({ id: p.id, k: p.type, x: r2(p.x), z: r2(p.z) })),
      doors: this.doors.filter((d) => d.open).map((d) => d.id),
      bars: [...this.map.barrels].filter((b) => !this.damageable.has(b.id)).map((b) => b.id),
      tgts: [...this.damageable.values()].filter((d) => d.type === 'target').map((d) => ({ id: d.box.id, x: r2(d.box.x), z: r2(d.box.z), hp: Math.round(d.hp), mh: d.ref ? d.ref.maxHp : 0, l: d.ref ? d.ref.label : '' })),
      mission: this.runner ? this.runner.view() : null,
      ts: this.teamScore.slice(0, 2),
      tl: this.modeDef.timeLimit ? Math.max(0, Math.round(this.modeDef.timeLimit - this.time)) : null,
      end: this.result,
    };
  }
}
