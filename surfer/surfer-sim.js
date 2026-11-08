/* ============================================================
   surfer/surfer-sim.js   |   KNOWLEDGE SURFER 3D — game rules

   Pure game logic: NO drawing, NO browser code. It decides where
   everything is, what you hit, and how much XP you earn.
   (Kept separate so it can be tested on its own.)

   World layout:  the runner stands still at z = 0.
                  The world slides toward the camera (+z).
                  Lane 0/1/2 = left/centre/right.  y = height above ground.
   ============================================================ */
import { GAME, BIOMES, biomeIndexAt } from './surfer-config.js';

export function laneX(lane) { return (lane - (GAME.laneCount - 1) / 2) * GAME.laneWidth; }

const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
export function createSim(rng = Math.random, opts = {}) {
  const s = {
    time: 0, scroll: 0, distance: 0, speedLevel: 0, origSpeed: GAME.baseSpeed, speedMul: 1, caughtT: 0, policeMeters: 42, worldSpeed: GAME.baseSpeed * GAME.speedScale,
    lives: GAME.lives, score: 0, xp: 0, combo: 0, bestCombo: 0,
    ride: null, rideXp: 0, smashed: 0, pitEnabled: !!opts.pitEnabled, nextPitAt: GAME.pitEvery, pitVisits: 0,
    gameOver: false, spawnTimer: 0.6, nextId: 1,
    inspectorGap: GAME.inspectorStartGap,
    player: {
      lane: 1, x: laneX(1), y: 0, vy: 0, jumping: false,
      sliding: false, slideT: 0, slideQueued: false,
      invincible: 0, stumble: 0,
    },
    objects: [],
    events: [],          // the renderer reads & clears this every frame
  };

  const emit = (type, data) => s.events.push({ type, ...(data || {}) });

  /* ── player actions ── */
  function jump() {
    const p = s.player;
    if (s.gameOver || p.jumping) return;
    if (s.ride && !s.ride.def.canJump) return;          // cars, trucks, trains and helicopters cannot hop
    p.slideQueued = false;
    p.sliding = false; p.slideT = 0;
    p.jumping = true; p.vy = GAME.jumpVelocity;
    emit('jump');
  }
  function slide() {
    const p = s.player;
    if (s.gameOver) return;
    if (s.ride && !s.ride.def.canSlide) return;
    if (p.jumping) { p.vy = Math.min(p.vy, -18); p.slideQueued = true; return; }   // fast-fall, then slide
    if (!p.sliding) { p.sliding = true; p.slideT = GAME.slideSeconds; emit('slide'); }
  }
  function changeLane(dir) {
    const p = s.player;
    if (s.gameOver) return;
    const n = Math.max(0, Math.min(GAME.laneCount - 1, p.lane + dir));
    if (n === p.lane) return;
    p.lane = n;
    emit('lane', { dir });
  }

  /* ── vehicles ── rideState = { id, def, fuel, hp } (the engine keeps one per owned ride so fuel and armour survive swapping) */
  function dismount(reason) {
    const r = s.ride; if (!r) return;
    s.ride = null; s.player.sliding = false; s.player.slideT = 0;
    if (r.def.fly) s.player.invincible = Math.max(s.player.invincible, 1.6);   // land safely even if an obstacle is below
    emit('dismount', { id: r.id, reason: reason || 'manual' });
  }
  function mount(rs) {
    if (s.gameOver || !rs || rs.fuel <= 0) return false;
    if (rs.def.hp > 0 && rs.hp <= 0) return false;       // wrecked: needs the pit stop
    if (s.ride) dismount('swap');
    s.ride = rs; s.player.sliding = false; s.player.slideT = 0; s.player.slideQueued = false;
    emit('mount', { id: rs.id });
    return true;
  }

  /* ── spawning (one "wave" = a coin lane + obstacles in the other lanes) ── */
  function spawnWave() {
    const coinLane = Math.floor(rng() * GAME.laneCount);     // this lane is ALWAYS left free, so every wave can be survived
    const ws = s.worldSpeed;
    for (let lane = 0; lane < GAME.laneCount; lane++) {
      const baseZ = -GAME.spawnAhead - lane * GAME.waveStagger;
      const zone = biomeIndexAt(s.scroll - baseZ);            // which zone this will be in when it reaches the runner
      if (lane === coinLane) {
        for (let c = 0; c < GAME.coinsPerRow; c++) {
          s.objects.push({ id: s.nextId++, type: 'coin', lane, x: laneX(lane), z: baseZ - c * GAME.coinSpacing, pz: baseZ - c * GAME.coinSpacing, vz: 0, hit: false, phase: rng() * 6.28, zone });
        }
      } else {
        const r = rng();
        const kind = r < GAME.trainChance ? 'train' : (r < GAME.trainChance + GAME.jumpChance ? 'jump' : 'slide');
        let z = baseZ, vz = 0;
        if (kind === 'train') {
          /* the train rushes toward you: start it farther away so it still arrives at the same moment as the rest of the wave */
          vz = GAME.trainSpeed;
          z = -Math.min(Math.abs(baseZ) * (ws + vz) / ws, GAME.trainMaxSpawn + lane * GAME.waveStagger);
        }
        s.objects.push({ id: s.nextId++, type: 'obstacle', kind, lane, x: laneX(lane), z, pz: z, vz, hit: false, look: Math.floor(rng() * 8), zone });
      }
    }
    const [a, b] = GAME.waveGapSeconds;
    s.spawnTimer = a + rng() * (b - a);
  }

  /* ── one tick ── */
  function step(dt) {
    if (s.gameOver) return;
    dt = Math.min(dt, 0.05);
    const p = s.player;
    s.time += dt;

    /* speed + distance (distance uses the ORIGINAL 2D formula so XP/titles stay balanced) */
    const level = Math.floor(s.distance / GAME.speedStepEvery);
    if (level > s.speedLevel) { s.speedLevel = level; emit('speedup'); }
    s.origSpeed = Math.min(GAME.maxSpeed, GAME.baseSpeed + s.speedLevel * GAME.speedStep);
    s.worldSpeed = s.origSpeed * GAME.speedScale * s.speedMul;      // speedMul = the driver's pedals / gear (1 = normal pace)
    s.distance += s.origSpeed * 0.022 * 60 * dt * s.speedMul;

    /* fuel burns while riding */
    if (s.ride) { s.ride.fuel = Math.max(0, s.ride.fuel - dt); if (s.ride.fuel <= 0) dismount('fuel'); }

    /* pit stop: a roadside station appears every GAME.pitEvery metres (only if the player owns a ride, never on the river) */
    if (s.pitEnabled && s.distance >= s.nextPitAt && !s.objects.some(o => o.type === 'pit')) {
      const z = -GAME.spawnAhead;
      if (BIOMES[biomeIndexAt(s.scroll - z)].water) s.nextPitAt += 40;
      else { s.objects.push({ id: s.nextId++, type: 'pit', lane: -1, x: -4.5, z, pz: z, vz: 0, hit: false, trig: false }); s.nextPitAt += GAME.pitEvery; }
    }

    /* sideways glide */
    const tx = laneX(p.lane);
    p.x += (tx - p.x) * (1 - Math.exp(-GAME.laneChangeSpeed * dt));

    /* jump physics */
    if (p.jumping) {
      p.vy -= GAME.gravity * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) {
        p.y = 0; p.vy = 0; p.jumping = false;
        emit('land');
        if (p.slideQueued) { p.slideQueued = false; p.sliding = true; p.slideT = GAME.slideSeconds; emit('slide'); }
      }
    }
    if (p.sliding) { p.slideT -= dt; if (p.slideT <= 0) { p.sliding = false; p.slideT = 0; } }
    if (p.invincible > 0) p.invincible = Math.max(0, p.invincible - dt);
    if (p.stumble > 0)    p.stumble    = Math.max(0, p.stumble - dt);

    /* inspector: closes in when you stumble OR slow down, falls back when you drive fast. Reach him for 2.5 s and you are caught. */
    if (p.stumble > 0) s.inspectorGap = Math.max(GAME.inspectorMinGap, s.inspectorGap - 1.2 * 60 * dt);
    else s.inspectorGap = clampN(s.inspectorGap + (s.speedMul - 0.78) * 0.5 * 60 * dt, GAME.inspectorMinGap, GAME.inspectorMaxGap);
    s.policeMeters = 6 + (s.inspectorGap - GAME.inspectorMinGap) / (GAME.inspectorMaxGap - GAME.inspectorMinGap) * 54;     // 6 m … 60 m, shown on the HUD
    if (s.inspectorGap <= GAME.inspectorMinGap + 0.5 && p.invincible <= 0) {
      s.caughtT += dt;
      if (s.caughtT > 2.5) {
        s.caughtT = 0; s.combo = 0; s.lives--; s.inspectorGap = 150;
        p.invincible = GAME.graceSeconds; p.stumble = GAME.stumbleSeconds;
        emit('hit', { kind: 'police', z: 0, x: p.x, zone: 0 });
        if (s.lives <= 0) { s.gameOver = true; emit('gameover'); return; }
      }
    } else s.caughtT = 0;

    /* move world */
    const dz = s.worldSpeed * dt;
    s.scroll += dz;
    for (const o of s.objects) { o.pz = o.z; o.z += dz + o.vz * dt; }
    s.objects = s.objects.filter(o => !o.hit && o.z < GAME.despawnBehind);

    s.spawnTimer -= dt * Math.max(0.4, s.speedMul);          // slow driving = fewer waves, never a pile-up
    if (s.spawnTimer <= 0) spawnWave();

    /* collisions  (swept: we test the whole stretch an object travelled this frame, so fast trains / low fps can never skip through the runner) */
    const h = p.sliding ? GAME.slideHeight : GAME.standHeight;
    const pTop = p.y + h;
    const crosses = (o, lim) => Math.min(o.pz, o.z) < lim && Math.max(o.pz, o.z) > -lim;
    for (const o of s.objects) {
      if (o.hit) continue;
      if (o.type === 'pit') { if (!o.trig && o.z > -2) { o.trig = true; s.pitVisits++; emit('pit'); } continue; }
      const rr = s.ride, fly = !!(rr && rr.def.fly);
      if (o.type === 'coin') {
        if (!crosses(o, 0.75) || Math.abs(o.x - p.x) > (fly ? 2.7 : 0.7)) continue;          // helicopter pulls coins from every lane
        if (!fly && (GAME.coinHeight < p.y - 0.4 || GAME.coinHeight > Math.max(pTop, 1.2) + 0.4)) continue;
        o.hit = true;
        s.score++; s.combo++;
        if (s.combo > s.bestCombo) s.bestCombo = s.combo;
        const base = GAME.xpPerCoin + (s.combo >= 3 ? GAME.xpComboBonus : 0), gain = Math.round(base * (rr ? rr.def.xpMult : 1));
        s.xp += gain; s.rideXp += gain - base;
        emit('coin', { x: o.x, y: GAME.coinHeight, combo: s.combo });
        if (!s.objects.some(c => c !== o && c.type === 'coin' && !c.hit)) s.spawnTimer = Math.min(s.spawnTimer, 1.5);
      } else if (p.invincible <= 0) {
        if (fly) continue;                                                       // airborne: nothing on the ground can touch you
        const hd = o.kind === 'train' ? GAME.train : o.kind === 'jump' ? GAME.hurdle : GAME.beam;
        if (!crosses(o, hd.halfDepth + (rr ? rr.def.halfD : GAME.playerHalfDepth))) continue;
        if (Math.abs(o.x - p.x) > hd.halfWidth + (rr ? rr.def.halfW : GAME.playerHalfWidth)) continue;
        let blocked;
        if (o.kind === 'train')     blocked = p.y < hd.height;                   // can't hop a train
        else if (o.kind === 'jump') blocked = p.y < hd.height - 0.08;            // feet must clear the top
        else                        blocked = pTop > hd.clearance && p.y < hd.top; // must be low enough to fit under
        if (!blocked) continue;
        if (rr) {                                                                // armour soaks the hit
          const cost = o.kind === 'train' ? rr.def.trainCost : 1;
          if (rr.hp >= cost) {
            rr.hp -= cost; o.hit = true; s.smashed++; p.invincible = 0.35;
            emit('smash', { kind: o.kind, x: o.x, z: o.z });
            if (rr.def.hp > 0 && rr.def.hp < 99 && rr.hp <= 0) dismount('wrecked');
            continue;
          }
          dismount('crash');                                                     // too light to survive it: you come off and take the hit
        }
        o.hit = true;
        s.combo = 0; s.lives--;
        p.invincible = GAME.graceSeconds; p.stumble = GAME.stumbleSeconds;
        s.inspectorGap = Math.max(GAME.inspectorMinGap, s.inspectorGap - 45);
        emit('hit', { kind: o.kind, z: o.z, x: o.x, zone: o.zone });
        if (s.lives <= 0) { s.gameOver = true; emit('gameover'); return; }
      }
    }
  }

  return { state: s, step, jump, slide, changeLane, spawnWave, mount, dismount };
}
