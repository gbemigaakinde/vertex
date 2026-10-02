/* Node tests for the multiplayer host logic (no Cloudflare runtime needed).
   Run: node vector/tests/server.test.mjs                                   */
import assert from 'node:assert/strict';
import { Lobby, makeCode, normaliseCode } from '../server/lobby.js';
import { dirFromAngles } from '../combat.js';

let t = 1e6; const clock = () => t;
const mkConn = () => { const c = { got: [], closed: null, send(s) { c.got.push(JSON.parse(s)); }, close(code, why) { c.closed = { code, why }; } }; return c; };
const last = (c, type) => [...c.got].reverse().find((m) => m.t === type);
let passed = 0; const ok = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };
const run = (l, sec) => { for (let i = 0; i < sec * 20; i++) { t += 50; l.tick(0.05); } };

ok('lobby codes', () => { assert.match(makeCode(), /^BLK-[A-Z2-9]{4}$/); assert.equal(normaliseCode('blk7f2k'), 'BLK-7F2K'); assert.equal(normaliseCode('xx'), null); });

const l = new Lobby('BLK-TEST', { now: clock });
const A = mkConn(), B = mkConn(), C = mkConn();
ok('join + host', () => {
  assert.ok(l.join(A, { uid: 'a', name: 'Alpha', level: 10 }).ok);
  assert.ok(l.join(B, { uid: 'b', name: 'Bravo', level: 1 }).ok);
  assert.equal(l.hostUid, 'a'); assert.equal(l.publicState().members.length, 2);
});
ok('only host configures and starts', () => {
  l.handle('b', { t: 'config', config: { mode: 'tdm' } }); assert.equal(l.config.mode, 'ffa');
  l.handle('b', { t: 'start' }); assert.equal(last(B, 'error').code, 'not_host');
  l.handle('a', { t: 'config', config: { mode: 'ffa', mapId: 'urban' } }); assert.equal(l.config.mapId, 'urban');
});
ok('cannot start until ready, states WAITING->READY', () => {
  l.handle('a', { t: 'start' }); assert.equal(last(A, 'error').code, 'not_ready');
  l.handle('b', { t: 'ready', ready: true }); assert.equal(l.state, 'READY');
});
ok('illegal loadout is sanitised by the server', () => {
  l.handle('b', { t: 'loadout', loadout: { primary: 'sn_aegis', secondary: 'ar_vanguard', armor: 'godmode', tactical: 'medkit' } });
  const m = l.member('b'); assert.equal(m.loadout.primary, 'ar_vanguard'); assert.equal(m.loadout.armor, 'medium'); assert.equal(m.loadout.secondary, 'pistol_sparrow');
});
ok('countdown then IN_MATCH', () => {
  l.handle('a', { t: 'start' }); assert.equal(l.state, 'STARTING');
  run(l, 5.5); assert.equal(l.state, 'IN_MATCH'); assert.ok(last(A, 'match')); assert.ok(last(A, 's'));
});
ok('late joiner is refused mid-match', () => { assert.equal(l.join(C, { uid: 'c', name: 'C' }).ok, false); });

const simA = () => l.sim.players.get('a'), simB = () => l.sim.players.get('b');
let seqA = 0, seqB = 0;
const inputA = (o) => l.handle('a', { t: 'input', c: [{ seq: ++seqA, dt: 1 / 30, yaw: simA().yaw, pitch: 0, ...o }] });
ok('snapshot hides enemy-only data and contains your ammo', () => {
  const s = last(A, 's').s; assert.ok(s.players.find((p) => p.id === 'a').me.slots[0].m > 0);
  assert.equal(s.players.find((p) => p.id === 'b').me, undefined);
});
ok('speed hack (huge dt) is clamped by server budget', () => {
  const p = simA(); const x0 = p.x, z0 = p.z;
  for (let i = 0; i < 40; i++) l.handle('a', { t: 'input', c: [{ seq: ++seqA, dt: 5, mz: -1, yaw: 0, pitch: 0, sprint: true }] });
  const d = Math.hypot(p.x - x0, p.z - z0);
  assert.ok(d < 14, 'moved ' + d.toFixed(1) + 'm with absurd dt'); assert.ok(p.violations > 0);
});
ok('client cannot claim a kill or set hp/score', () => {
  const before = simB().hp;
  l.handle('a', { t: 'input', c: [{ seq: ++seqA, dt: 0.03, kill: 'b', hp: 9999, score: 99, victim: 'b' }] });
  l.handle('a', { t: 'kill', victim: 'b' }); l.handle('a', { t: 'score', v: 99 });
  assert.equal(simB().hp, before); assert.equal(simA().score, 0);
});
ok('replayed / out-of-order input sequence ignored', () => {
  const p = simA(); const z = p.z;
  l.handle('a', { t: 'input', c: [{ seq: 1, dt: 0.03, mz: -1, yaw: 0, pitch: 0 }] });
  assert.equal(p.z, z);
});
ok('real kill via server-side hitscan and score', () => {
  const a = simA(), b = simB();
  a.x = 0; a.z = 10; b.x = 0; b.z = 0; a.y = b.y = 0; b.invuln = 0; a.invuln = 0;
  l.sim.map.boxes.filter((x) => x.kind !== 'boundary').forEach((x) => l.sim.map.removeBox(x));
  const eye = 1.62, dy = 1.3 - eye; const pitch = Math.atan2(dy, 10);
  let shots = 0;
  for (let i = 0; i < 400 && b.alive; i++) {
    l.handle('a', { t: 'input', c: [{ seq: ++seqA, dt: 0.02, yaw: 0, pitch, fire: (i % 10) < 5, ads: true }] });
    t += 50; l.tick(0.05); shots++;
  }
  assert.equal(b.alive, false, 'target should die'); assert.equal(a.stats.kills, 1); assert.equal(a.score, 1);
  assert.ok(a.slots[0].mag < 30, 'ammo consumed on server');
});
ok('dead player respawns with fresh ammo and invulnerability', () => { run(l, 5); assert.equal(simB().alive, true); assert.ok(simB().invuln >= 0); });
ok('disconnect keeps seat, reconnect resumes and duplicate session kicks old socket', () => {
  l.disconnect(B); assert.equal(l.publicState().members.find((m) => m.uid === 'b').presence, 'OFFLINE'); assert.equal(simB().connected, false);
  const B2 = mkConn(); assert.ok(l.join(B2, { uid: 'b', name: 'Bravo' }).ok); assert.equal(simB().connected, true); assert.ok(last(B2, 'match'));
  const B3 = mkConn(); l.join(B3, { uid: 'b', name: 'Bravo' }); assert.equal(B2.closed.code, 4001);
});
ok('match completes at score limit and reports results', () => {
  simA().score = 19; l.sim.modeDef = { ...l.sim.modeDef, scoreLimit: 20 };
  const b = simB(); b.alive = true; b.hp = 100; b.invuln = 0; const a = simA(); a.x = 0; a.z = 10; b.x = 0; b.z = 0;
  for (let i = 0; i < 400 && l.state === 'IN_MATCH'; i++) { l.handle('a', { t: 'input', c: [{ seq: ++seqA, dt: 0.02, yaw: 0, pitch: Math.atan2(1.3 - 1.62, 10), fire: (i % 10) < 5, ads: true }] }); t += 50; l.tick(0.05); }
  assert.equal(l.state, 'FINISHED'); const e = last(A, 'end'); assert.ok(e.result.players.length === 2); assert.equal(e.result.winnerId, 'a');
});
ok('host returns everyone to the lobby', () => { l.handle('a', { t: 'backToLobby' }); assert.equal(l.state, 'WAITING'); assert.equal(l.sim, null); });

/* ---- disconnect grace + abort ---- */
ok('player who never returns is removed; match with one player left ends (no stuck match)', () => {
  const L = new Lobby('BLK-GONE', { now: clock }); const X = mkConn(), Y = mkConn();
  L.join(X, { uid: 'x', name: 'X' }); L.join(Y, { uid: 'y', name: 'Y' }); L.handle('y', { t: 'ready', ready: true }); L.handle('x', { t: 'start' }); run(L, 6);
  assert.equal(L.state, 'IN_MATCH'); L.disconnect(Y.__c = Y);
  run(L, 35); assert.equal(L.state, 'FINISHED'); assert.ok(last(X, 'end'));
});
ok('everyone disconnected -> lobby expires', () => {
  const L = new Lobby('BLK-EMPT', { now: clock }); const X = mkConn(); L.join(X, { uid: 'x', name: 'X' }); L.disconnect(X); run(L, 40); assert.equal(L.expired(), true);
});
ok('freshly created lobby (REST done, socket not open yet) is NOT expired', () => {
  const L = new Lobby('BLK-NEWB', { now: clock }); assert.equal(L.expired(), false); run(L, 10); assert.equal(L.expired(), false); run(L, 25); assert.equal(L.expired(), true, 'but it does expire if nobody ever connects');
});
ok('host leaves -> host transfers', () => {
  const L = new Lobby('BLK-HOST', { now: clock }); const X = mkConn(), Y = mkConn(); L.join(X, { uid: 'x', name: 'X' }); L.join(Y, { uid: 'y', name: 'Y' }); L.leave('x'); assert.equal(L.hostUid, 'y');
});
ok('countdown cancelled when a player leaves', () => {
  const L = new Lobby('BLK-CNCL', { now: clock }); const X = mkConn(), Y = mkConn(); L.join(X, { uid: 'x', name: 'X' }); L.join(Y, { uid: 'y', name: 'Y' }); L.handle('y', { t: 'ready', ready: true }); L.handle('x', { t: 'start' }); assert.equal(L.state, 'STARTING'); L.leave('y'); assert.equal(L.state, 'WAITING');
});
ok('lobby capacity (co-op = 4) and kick', () => {
  const L = new Lobby('BLK-CAPS', { now: clock }); L.config.mode = 'coop';
  const cs = [1, 2, 3, 4].map((i) => { const c = mkConn(); assert.ok(L.join(c, { uid: 'u' + i, name: 'U' + i }).ok); return c; });
  assert.equal(L.join(mkConn(), { uid: 'u5', name: 'U5' }).ok, false);
  L.handle('u1', { t: 'kick', uid: 'u4' }); assert.equal(L.members.size, 3); assert.equal(cs[3].closed.code, 4003);
});
ok('co-op: 2 players, shared mission objectives, downed + revive', () => {
  const L = new Lobby('BLK-COOP', { now: clock }); const X = mkConn(), Y = mkConn(); L.join(X, { uid: 'x', name: 'X' }); L.join(Y, { uid: 'y', name: 'Y' });
  L.handle('x', { t: 'config', config: { mode: 'coop', mission: 'm01' } }); L.handle('y', { t: 'ready', ready: true }); L.handle('x', { t: 'start' }); run(L, 6);
  assert.equal(L.state, 'IN_MATCH'); const s = last(X, 's').s; assert.ok(s.mission && s.mission.id === 'reach'); assert.ok(s.enemies.length > 0);
  const p = L.sim.players.get('x'); L.sim.hurtPlayer(p, 500, { eid: 'e1' }); assert.equal(p.downed, true);
  const q = L.sim.players.get('y'); q.x = p.x + 1; q.z = p.z; let sq = 0;
  for (let i = 0; i < 200 && p.downed; i++) { L.handle('y', { t: 'input', c: [{ seq: ++sq, dt: 0.02, yaw: 0, pitch: 0, interact: true }] }); t += 50; L.tick(0.05); }
  assert.equal(p.downed, false, 'revived'); assert.ok(p.hp > 0);
});
ok('team skirmish assigns two teams and needs both', () => {
  const L = new Lobby('BLK-TEAM', { now: clock }); const cs = ['a', 'b', 'c', 'd'].map((u) => { const c = mkConn(); L.join(c, { uid: u, name: u }); return c; });
  L.handle('a', { t: 'config', config: { mode: 'tdm' } }); const teams = [...L.members.values()].map((m) => m.team); assert.deepEqual(teams.sort(), [0, 0, 1, 1]);
  ['b', 'c', 'd'].forEach((u) => L.handle(u, { t: 'ready', ready: true })); L.handle('a', { t: 'start' }); run(L, 6); assert.equal(L.state, 'IN_MATCH');
  const sp = [...L.sim.players.values()]; assert.equal(sp.filter((p) => p.team === 0).length, 2);
});
ok('message flood is dropped, malformed messages ignored', () => {
  const L = new Lobby('BLK-FLOD', { now: clock }); const X = mkConn(); L.join(X, { uid: 'x', name: 'X' });
  for (let i = 0; i < 1000; i++) L.handle('x', { t: 'ping', c: i }); assert.ok(X.got.filter((m) => m.t === 'pong').length <= 200);
  L.handle('x', null); L.handle('x', 'lol'); L.handle('nobody', { t: 'ready' });
});
console.log(`\n${passed} server tests passed`);
