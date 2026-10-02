/* Test helper: a scripted "player" that drives a MatchSim through the same
   applyInput() path a real client uses. Used only by the Node tests. */
import { makeCmd } from '../player.js';
import { hasLineOfSight } from '../enemies.js';

export function makeBot(sim, id, opts = {}) {
  const st = { seq: 0, path: null, pathI: 0, pathT: 0, goal: null, burst: 0 };
  return function tick(dt) {
    const p = sim.players.get(id);
    if (!p || !p.alive) return;
    if (opts.god) { p.hp = p.maxHp; p.armor = p.armorMax; }
    const cmd = makeCmd({ seq: ++st.seq, dt, yaw: p.yaw, pitch: p.pitch });
    // choose an enemy to shoot
    let tgt = null, bd = 45;
    for (const e of sim.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d < bd && hasLineOfSight(sim, { x: p.x, y: 1.6, z: p.z }, { x: e.x, y: 1.4, z: e.z })) { bd = d; tgt = e; }
    }
    // navigation goal
    const m = sim.runner ? sim.runner.view() : null;
    let goal = null, wantInteract = false;
    if (opts.goal) goal = opts.goal;
    else if (m && !m.done) {
      const near = sim.interactables.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      const tg = sim.damageable ? [...sim.damageable.values()].find((d) => d.type === 'target') : null;
      if (near) { goal = near; wantInteract = Math.hypot(near.x - p.x, near.z - p.z) < 1.6; }
      else if (tg) goal = tg.box;
      else if (m.type === 'escort') goal = sim.map.zones[sim.runner.current.to];
      else if (m.zone) goal = sim.map.zones[m.zone];
      if (m.type === 'survive' || (m.type === 'secure' && m.contested)) { const z = sim.map.zones[m.zone]; if (z) goal = z; }
    }
    // fall back to the sidearm when the primary is completely dry
    const cur = p.slots[p.cur];
    if (cur.mag <= 0 && cur.reserve <= 0) { const other = 1 - p.cur; if (p.slots[other].mag + p.slots[other].reserve > 0) cmd.sw = other; }
    else if (p.cur === 1 && p.slots[0].mag + p.slots[0].reserve > 0 && cur.mag + cur.reserve < 6) cmd.sw = 0;
    // walk over supplies when low
    const ammoLow = p.slots[0].mag + p.slots[0].reserve < 40;
    if (ammoLow && !tgt) { const pk = sim.pickups.find((q) => !q.taken && q.type === 'ammo' && Math.hypot(q.x - p.x, q.z - p.z) < 30); if (pk) goal = pk; }
    if (tgt) {
      const dx = tgt.x - p.x, dz = tgt.z - p.z, dy = 1.25 - 1.6;
      cmd.yaw = Math.atan2(-dx, -dz); cmd.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      st.burst = (st.burst + 1) % 40;
      cmd.fire = st.burst < 24;
      cmd.ads = bd > 18;
      const w = p.slots[p.cur]; if (w.mag < 5) cmd.reload = true;
      if (bd > 14 && goal) { /* keep moving slowly toward goal while shooting */ }
    }
    // tgt is a target box? shoot it too when near
    const tbox = sim.damageable ? [...sim.damageable.values()].find((d) => d.type === 'target') : null;
    if (!tgt && tbox && Math.hypot(tbox.box.x - p.x, tbox.box.z - p.z) < 14) {
      const dx = tbox.box.x - p.x, dz = tbox.box.z - p.z;
      cmd.yaw = Math.atan2(-dx, -dz); cmd.pitch = Math.atan2(0.65 - 1.6, Math.hypot(dx, dz)); cmd.fire = (st.burst++ % 30) < 12;
      if (p.slots[p.cur].mag < 5) cmd.reload = true;
    }
    if (goal && !(tgt && bd < 25)) {
      st.pathT -= dt;
      if (!st.path || st.pathT <= 0 || !st.goal || Math.hypot(st.goal.x - goal.x, st.goal.z - goal.z) > 2) {
        st.path = sim.map.findPath(p, goal); st.pathI = 0; st.pathT = 1.5; st.goal = { x: goal.x, z: goal.z };
      }
      if (st.path) {
        let wp = st.path[st.pathI];
        while (wp && Math.hypot(wp.x - p.x, wp.z - p.z) < 0.7 && st.pathI < st.path.length - 1) { st.pathI++; wp = st.path[st.pathI]; }
        if (wp && Math.hypot(goal.x - p.x, goal.z - p.z) > (wantInteract ? 0.5 : 1.0)) {
          const dx = wp.x - p.x, dz = wp.z - p.z;
          if (!cmd.fire) { cmd.yaw = Math.atan2(-dx, -dz); }
          // convert world heading into local move axes
          const ang = Math.atan2(-dx, -dz) - cmd.yaw;
          cmd.mz = -Math.cos(ang); cmd.mx = -Math.sin(ang) * -1;
          cmd.mx = Math.sin(-ang) * -1;
          cmd.sprint = !tgt;
        }
      }
    }
    if (wantInteract || (goal && Math.hypot(goal.x - p.x, goal.z - p.z) < 2.2 && sim.interactables.length)) cmd.interact = true;
    // doors: press interact briefly if blocked (enemies open them; player just taps)
    if (!cmd.interact && (sim.tick % 45) < 3) cmd.interact = true;
    sim.applyInput(id, cmd);
  };
}
