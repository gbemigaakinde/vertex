/* ============================================================
   vector/engine.js  |  Game loop + session control.

   Two kinds of session share one code path for rendering:
     LOCAL  : Campaign. A MatchSim runs in this browser.
     NET    : Co-op / Team Skirmish / FFA. The server owns the MatchSim;
              this client sends inputs, predicts its own movement and
              reconciles against server snapshots.
   Everything the player sees is drawn from snapshots (interpolated),
   except the player's own movement which is predicted.
   ============================================================ */
import { PLAYER, NET } from './config.js';
import { WEAPONS, EQUIPMENT } from './weapons.js';
import { MatchSim } from './sim.js';
import { buildMap } from './world.js';
import { createPlayer, stepPlayer, makeCmd, currentWeapon } from './player.js';
import { ARCHETYPES } from './enemies.js';
import { dirFromAngles } from './combat.js';
import { getMission } from './missions.js';

const FIXED = 1 / 60;
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAng = (a, b, t) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
const ENEMY_TINT = {
  scout: { outfit: '#56624a', vest: '#2a3024', helmet: '#1f251c' }, rifleman: { outfit: '#4c3a30', vest: '#241b16', helmet: '#151110' },
  heavy: { outfit: '#3a3f46', vest: '#1c2024', helmet: '#0f1215' }, support: { outfit: '#3c4f55', vest: '#1a2529', helmet: '#22393f' },
  commander: { outfit: '#5a2f2b', vest: '#1d1211', helmet: '#120b0a', hair: '#ccc' },
};
const ENEMY_WEAPON = { scout: 'mr_longbow', rifleman: 'ar_vanguard', heavy: 'sg_breaker', support: 'smg_hornet', commander: 'cb_kestrel' };
const TEAM_TINT = [{ outfit: '#2c4f7a', vest: '#14263d' }, { outfit: '#7a3030', vest: '#3d1414' }];

export class Engine {
  constructor({ renderer, audio, input, store, hooks }) {
    this.r = renderer; this.audio = audio; this.input = input; this.store = store; this.h = hooks || {};
    this.mode = null; this.kind = null;            // kind: 'local' | 'net'
    this.sim = null; this.map = null; this.meId = null; this.me = null;
    this.running = false; this.paused = false; this.pauseReason = null; this.raf = 0; this.last = 0; this.acc = 0;
    this.aim = { yaw: 0, pitch: 0 }; this.recoil = { accum: 0 };
    this.snaps = []; this.hud = this.blankHud(); this.lastSnap = null; this.seq = 0; this.pending = []; this.outbox = []; this.sendT = 0;
    this.net = null; this.cine = null; this.killfeed = []; this.frameMs = 16; this.localFireCd = 0; this.ended = null; this.stepAcc = 0;
    this.prev = new Map(); this.stepT = 0; this.lastDoors = ''; this.tgtBoxes = new Map(); this.coverBoxes = new Map(); this.barrelsGone = new Set();
    this.objMarkers = []; this.nameTags = []; this.playTime = 0; this.scoreboard = []; this.dirHits = []; this.lastSound = {}; this.intWas = new Set();
    this.loop = this.loop.bind(this);
  }

  blankHud() {
    return { hp: 100, maxHp: 100, armor: 0, armorMax: 0, slots: [], cur: 0, eq: null, eqn: 0, heal: 0, healT: 0, reload: 0, alive: true, downed: false, ads: false, zoom: 1, blind: 0,
      mission: null, interact: null, time: 0, ts: [0, 0], tl: null, mode: null, rtt: 0, crouched: false, sprint: false, bloom: 0, vignette: 0, respawn: 0, reviveP: 0, downT: 0, squad: [], compass: 0, item: null };
  }

  /* ================= sessions ================= */
  async startLocal({ missionId, loadout, look, name, difficulty, checkpoint }) {
    this.stop(); this.reset();
    const mission = getMission(missionId);
    this.kind = 'local'; this.mode = 'campaign'; this.missionId = missionId;
    this.sim = new MatchSim({ mode: 'campaign', mission: missionId, difficulty: difficulty || 'standard' });
    this.map = this.sim.map; this.meId = 'me';
    this.sim.addPlayer('me', name || 'Echo', loadout, { level: this.store.profile.level, look, trusted: true });
    this.sim.start();
    if (checkpoint) this.sim.restoreCheckpoint(checkpoint);
    this.me = this.sim.players.get('me');
    this.lookSelf = look; this.nameSelf = name || 'Echo'; this.loadout = loadout; this.difficulty = difficulty;
    await this.r.buildWorld(this.map, (p) => this.h.onLoad && this.h.onLoad(p));
    this.aim.yaw = this.me.yaw; this.aim.pitch = 0;
    this.lastDoors = '';
    this.primeEntities();
    // two snapshots right away so the HUD, interpolation and objective markers are ready on the very first frame
    this.ingest(this.sim.snapshot(this.meId), this.sim.drainEvents()); this.ingest(this.sim.snapshot(this.meId), []);
    if (mission.intro && mission.intro.length && !checkpoint) this.cine = { i: 0, t: 0, list: mission.intro };
    this.audio.startAmbience(this.map.env.indoor);
    this.h.onLoad && this.h.onLoad(1);
  }

  async startNet(msg, net, { look, name, loadout, uid }) {
    this.stop(); this.reset();
    this.kind = 'net'; this.mode = msg.mode; this.net = net; this.meId = uid; this.nameSelf = name; this.lookSelf = look; this.loadout = loadout;
    this.map = buildMap(msg.mapId); this.mapId = msg.mapId;
    this.me = createPlayer(uid, name, loadout, this.store.profile.level); this.me.look = look;
    const sp = this.map.spawns.players[0] || this.map.spawns.ffa[0]; this.me.x = sp.x; this.me.z = sp.z; this.me.synced = false;
    await this.r.buildWorld(this.map, (p) => this.h.onLoad && this.h.onLoad(p));
    this.audio.startAmbience(this.map.env.indoor);
    this.h.onLoad && this.h.onLoad(1);
  }

  reset() {
    this.snaps = []; this.pending = []; this.outbox = []; this.seq = 0; this.cine = null; this.ended = null; this.killfeed.length = 0; this.tgtBoxes.clear(); this.coverBoxes.clear(); this.barrelsGone.clear();
    this.hud = this.blankHud(); this.recoil.accum = 0; this.prev.clear(); this.playTime = 0; this.lastSnap = null; this.paused = false; this.stepAcc = 0; this.intWas.clear();
  }

  primeEntities() {
    // spawn the local player's character immediately so the first frame has a body
    this.ensureChar(this.meId, 'player', this.lookSelf, null, 'ar_vanguard');
  }

  /* ================= loop ================= */
  start() { if (this.running) return; this.running = true; this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); }
  stop() { this.running = false; if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
  setPaused(p, reason) { this.paused = !!p; this.pauseReason = p ? reason || 'menu' : null; if (p) { this.audio.suspend(); this.input.resetLatches(); } else { this.audio.resume(); this.last = performance.now(); } }

  loop(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    this.frameMs = dt * 1000;
    if (this.paused) { this.renderFrame(0); return; }
    this.stepAcc += dt;
    let guard = 0;
    const intent = this.input.poll();
    if (intent.pause && this.h.onPause) { this.h.onPause(); return; }
    let first = true;
    while (this.stepAcc >= FIXED && guard++ < 5) {
      this.fixedStep(first ? intent : this.carry(intent), FIXED); first = false; this.stepAcc -= FIXED;
    }
    if (this.kind === 'net') this.flushNet(dt);
    this.renderFrame(dt, intent);
    const q = this.r.adapt(this.frameMs, this.store.settings.quality === 'auto', this.h.qualityCeiling || 'HIGH');
    if (q && this.h.onQuality) this.h.onQuality(q);
  }
  /* The one-shot edges (jump, reload...) only belong to the first step of a frame. */
  carry(i) { return { ...i, jump: false, reload: false, equip: false, heal: false, sw: -1, swap: false, dyaw: 0, dpitch: 0 }; }

  /* ================= one fixed simulation step ================= */
  fixedStep(intent, dt) {
    if (this.cine) { this.updateCine(intent, dt); if (this.kind === 'local') { /* world keeps idle while cinematic plays */ } return; }
    const me = this.me; if (!me) return;
    const s = this.store.settings;
    // look
    if (me.alive && !me.downed) {
      this.aim.yaw += intent.dyaw; this.aim.pitch = Math.max(-1.3, Math.min(1.3, this.aim.pitch + intent.dpitch));
    }
    const w = WEAPONS[this.curWeaponId()];
    if (intent.shoulder) this.shoulderSide = -(this.shoulderSide || 1);
    const cmd = makeCmd({
      seq: ++this.seq, dt, mx: intent.mx, mz: intent.mz, yaw: this.aim.yaw, pitch: this.aim.pitch, sprint: intent.sprint, crouch: intent.crouch,
      jump: intent.jump, ads: intent.ads && !intent.sprint, fire: intent.fire && this.canFire(), reload: intent.reload, interact: intent.interact,
    });
    cmd.sw = intent.sw >= 0 ? intent.sw : (intent.swap ? 1 - this.curSlot() : -1); cmd.equip = intent.equip; cmd.heal = intent.heal;
    this.lastIntent = intent;
    // client-side feel: recoil, muzzle kick and sound for my own shots happen immediately
    this.predictFire(cmd, w, dt);
    if (this.kind === 'local') {
      this.sim.applyInput(this.meId, cmd);
      this.sim.step(dt);
      this.playTime += dt;
      this.pullLocalSnapshot(dt);
    } else {
      this.playTime += dt;
      if (this.me.alive && !this.me.downed && this.me.synced) {
        stepPlayer(this.map, this.me, { ...cmd, crouch: cmd.crouch }, dt);
      }
      this.pending.push(cmd); if (this.pending.length > 120) this.pending.shift();
      this.outbox.push({ seq: cmd.seq, dt, mx: cmd.mx, mz: cmd.mz, yaw: +cmd.yaw.toFixed(4), pitch: +cmd.pitch.toFixed(4), sprint: cmd.sprint, crouch: cmd.crouch, jump: cmd.jump, ads: cmd.ads, fire: cmd.fire, reload: cmd.reload, interact: cmd.interact, sw: cmd.sw, equip: cmd.equip, heal: cmd.heal });
    }
    // recoil recovery
    if (!cmd.fire && this.recoil.accum > 0) { const rec = Math.min(this.recoil.accum, 0.9 * dt); this.recoil.accum -= rec; this.aim.pitch -= rec * 0.6; }
    if (this.localFireCd > 0) this.localFireCd -= dt;
  }

  curSlot() { return this.kind === 'local' ? this.me.cur : (this.hud.cur || 0); }
  curWeaponId() {
    if (this.kind === 'local') return this.me.slots[this.me.cur].id;
    return (this.hud.slots[this.hud.cur] && this.hud.slots[this.hud.cur].id) || this.me.slots[0].id;
  }
  canFire() { return !!(this.me && this.me.alive && !this.me.downed && !this.paused && !this.cine); }

  predictFire(cmd, w, dt) {
    if (!cmd.fire || this.localFireCd > 0 || !w) return;
    const h = this.hud;
    const mag = this.kind === 'local' ? this.me.slots[this.me.cur].mag : (h.slots[h.cur] ? h.slots[h.cur].m : 0);
    const reloading = this.kind === 'local' ? this.me.reloadT > 0 : h.reload > 0;
    const swapping = this.kind === 'local' && this.me.swapTo >= 0;
    if (mag <= 0) { if (!this.emptyT || performance.now() - this.emptyT > 400) { this.emptyT = performance.now(); this.audio.play('empty'); } return; }
    if (reloading || swapping || cmd.sprint || (this.me.healT > 0)) return;
    if (this.kind === 'local' && !this.localSemiOK(w, cmd)) return;
    this.localFireCd = 60 / w.rpm;
    this.recoilKick(w);
    this.fireFx(this.meId, w.id, true);
    this.wasFire = true;
  }
  localSemiOK(w, cmd) { if (w.auto) return true; const ok = !this.prevFireHeld; this.prevFireHeld = true; return ok; }
  recoilKick(w) {
    const s = this.store.settings; const mult = this.lastIntent && this.lastIntent.ads ? 0.6 : 1;
    const v = (w.recoil.v * (0.8 + Math.random() * 0.4)) * Math.PI / 180 * mult, hz = (Math.random() - 0.5) * 2 * w.recoil.h * Math.PI / 180 * mult;
    this.aim.pitch = Math.min(1.3, this.aim.pitch + v); this.aim.yaw += hz; this.recoil.accum += v;
    this.r.shake(Math.min(0.5, 0.06 + w.recoil.v * 0.05) * (s.reducedMotion ? 0 : 1) * (s.motionFx ? 1 : 0.4));
    const c = this.r.chars.get(this.meId); if (c && c.c) c.c.kick();
  }

  /* ================= snapshots ================= */
  pullLocalSnapshot(dt) {
    this.stepT += dt;
    if (this.stepT < 0.05) return;
    this.stepT = 0;
    const snap = this.sim.snapshot(this.meId);
    this.ingest(snap, this.sim.drainEvents());
  }

  /* Network snapshot from the server. */
  onNetSnapshot(msg) { this.ingest(msg.s, msg.ev || []); this.reconcile(msg.s); }

  ingest(s, events) {
    const now = performance.now() / 1000;
    s._t = now; this.snaps.push(s); if (this.snaps.length > 8) this.snaps.shift();
    this.lastSnap = s;
    for (const e of events || []) this.onEvent(e);
    // mirror world state that affects collision into the local map (net mode)
    if (this.kind === 'net') this.syncMapState(s);
    const me = s.players.find((p) => p.id === this.meId);
    if (me) this.applyMeState(me, s);
    if (s.end && !this.ended) { this.ended = s.end; this.h.onEnd && this.h.onEnd(s.end); }
    this.scoreboard = s.players.map((p) => ({ id: p.id, n: p.n, tm: p.tm, sc: p.sc, k: p.k, d: p.d, a: p.a, cn: p.cn, me: p.id === this.meId }));
    this.buildSnapIndex(s);
  }
  buildSnapIndex(s) { s.ix = { p: new Map(s.players.map((p) => [p.id, p])), e: new Map(s.enemies.map((e) => [e.id, e])), n: new Map(s.npcs.map((n) => [n.id, n])) }; }

  syncMapState(s) {
    const open = new Set(s.doors);
    for (const d of this.map.boxes) if (d.door) d.open = open.has(d.id);
    for (const id of s.bars || []) { const b = this.map.boxes.find((x) => x.id === id); if (b) { this.map.removeBox(b); this.barrelsGone.add(id); } }
    const seen = new Set();
    for (const t of s.tgts) { seen.add(t.id); if (!this.tgtBoxes.has(t.id)) this.tgtBoxes.set(t.id, this.map.addBox({ id: t.id, x: t.x, z: t.z, w: 1, d: 1, y: 0, h: 1.3, kind: 'target' })); }
    for (const [id, b] of this.tgtBoxes) if (!seen.has(id)) { this.map.removeBox(b); this.tgtBoxes.delete(id); }
  }

  /* Re-run unacknowledged inputs on top of the server's authoritative state. */
  reconcile(s) {
    const sp = s.players.find((p) => p.id === this.meId); if (!sp || !sp.me) return;
    const me = this.me, ack = sp.me.ack;
    const dx = sp.x - me.x, dz = sp.z - me.z, err = Math.hypot(dx, dz);
    if (!me.synced || err > 4) { me.x = sp.x; me.y = sp.y; me.z = sp.z; me.synced = true; }
    me.vx = sp.me.vx; me.vz = sp.me.vz; me.vy = sp.me.vy; me.onGround = !!sp.me.og; me.crouched = !!sp.cr; me.armorType = sp.me.armorType;
    me.alive = !!sp.al; me.downed = !!sp.dn; me.slots = sp.me.slots.map((x) => ({ id: x.id, mag: x.m, reserve: x.r })); me.cur = sp.me.cur; me.healT = sp.me.healT;
    this.pending = this.pending.filter((c) => c.seq > ack);
    if (err > 0.03 || !me.alive) {
      me.x = sp.x; me.y = sp.y; me.z = sp.z;
      if (me.alive && !me.downed) for (const c of this.pending) stepPlayer(this.map, me, c, c.dt);
    }
    if (!me.alive || me.downed) { me.x = sp.x; me.y = sp.y; me.z = sp.z; }
  }

  applyMeState(sp, s) {
    const h = this.hud, m = sp.me || {};
    h.hp = sp.hp; h.armor = sp.ar; h.alive = !!sp.al; h.downed = !!sp.dn; h.crouched = !!sp.cr; h.sprint = !!sp.sp; h.name = sp.n; h.team = sp.tm;
    h.downT = sp.dt || 0; h.reviveP = sp.rv || 0;
    if (m.slots) { h.slots = m.slots; h.cur = m.cur; h.eq = m.eq; h.eqn = m.eqn; h.heal = m.heal; h.healT = m.healT; h.reload = m.reload; h.armorMax = m.armorMax; h.blind = m.blind; h.recon = m.recon; h.item = m.item; h.respawn = m.resp; h.bloom = m.bloom; }
    h.mission = s.mission; h.time = s.time; h.ts = s.ts; h.tl = s.tl; h.mode = s.mode;
    if (this.kind === 'local') { const me = this.me; h.hp = Math.round(me.hp); h.armor = Math.round(me.armor); h.slots = me.slots.map((x) => ({ id: x.id, m: x.mag, r: x.reserve })); h.cur = me.cur; h.reload = me.reloadT; h.eqn = me.equip.count; h.heal = me.heal; h.healT = me.healT; h.blind = me.blind; }
    // interaction prompt: nearest interactable in reach
    let best = null, bd = 2.3;
    for (const i of s.ints) { const d = Math.hypot(i.x - this.me.x, i.z - this.me.z); if (d < bd) { bd = d; best = i; } }
    if (!best && this.kind === 'net' && this.mode === 'coop') for (const p of s.players) if (p.id !== this.meId && p.dn) { const d = Math.hypot(p.x - this.me.x, p.z - this.me.z); if (d < 2.3) best = { l: 'Revive ' + p.n, p: p.rv || 0 }; }
    if (!best) { for (const d of this.map.boxes) if (d.door && Math.hypot(d.x - this.me.x, d.z - this.me.z) < 2.6) { best = { l: d.open ? 'Close door' : 'Open door', p: 0, door: true }; break; } }
    h.interact = best ? { label: best.l, p: best.p || 0, door: !!best.door } : null;
  }

  /* ================= events -> effects ================= */
  onEvent(e) {
    const r = this.r, a = this.audio, me = e.by === this.meId;
    switch (e.t) {
      case 'shot': {
        const ent = this.posOf(e.by);
        if (!ent) break;
        // my own shots already played their sound, flash and recoil the moment I pressed fire
        if (!me) this.fireFx(e.by, e.w, false);
        if (e.ex !== undefined) {
          const mp = this.muzzleWorld(e.by, ent);
          r.tracer(mp.x, mp.y, mp.z, e.ex, e.ey, e.ez, e.w && e.w.startsWith('enemy') ? '#ff9a7a' : '#ffe3a8');
        }
        break;
      }
      case 'hit': {
        r.spark(e.x, e.y, e.z, 4, 0, 0.5, 0, e.head ? [1, 0.9, 0.5] : [0.9, 0.9, 0.95]);
        if (me) { a.play(e.head ? 'headshot' : 'hitmarker'); this.h.onHitMarker && this.h.onHitMarker(e.head); }
        else a.play('hit_flesh', e.x, e.z);
        break;
      }
      case 'impact': { r.spark(e.x, e.y, e.z, 5); r.dust(e.x, e.y, e.z, 2); a.play('impact', e.x, e.z, { maxD: 40 }); break; }
      case 'explosion': { r.explosion(e.x, e.y, e.z, e.r); a.play('explosion', e.x, e.z, { maxD: 140 }); const d = Math.hypot(e.x - this.me.x, e.z - this.me.z); r.shake(Math.max(0, 1 - d / 30) * 0.9); this.haptic(Math.max(0, 1 - d / 25) * 120); break; }
      case 'hurt': {
        if (e.id === this.meId) { this.h.onHurt && this.h.onHurt(e); a.play('hurt'); this.haptic(45); r.shake(Math.min(0.4, e.dmg / 90)); this.hud.vignette = Math.min(1, this.hud.vignette + e.dmg / 50); this.dirHits.push({ ang: e.ang, t: 1.2 }); const c = r.chars.get(this.meId); if (c && c.c) c.c.hit(); }
        else { const c = r.chars.get(e.id); if (c && c.c) c.c.hit(); }
        break;
      }
      case 'kill': {
        this.killfeed.push({ t: 6, victim: this.nameOf(e.victim), killer: e.killer ? this.nameOf(e.killer) : 'Environment', head: e.head, w: e.w, me: e.killer === this.meId, dead: e.victim === this.meId });
        if (this.killfeed.length > 5) this.killfeed.shift();
        if (e.killer === this.meId) a.play('kill'); if (e.victim === this.meId) { a.play('down'); this.haptic(200); }
        break;
      }
      case 'down': if (e.id === this.meId) a.play('down'); break;
      case 'revived': a.play('heal'); break;
      case 'door': { const d = this.map.boxes.find((b) => b.id === e.id); if (d && this.kind === 'local') d.open = e.open; if (d) a.play('door', d.x, d.z, { maxD: 40 }); break; }
      case 'dialogue': this.h.onDialogue && this.h.onDialogue(e); a.play('radio'); break;
      case 'objective': this.h.onObjective && this.h.onObjective(e); a.play('objective'); break;
      case 'objectiveDone': this.h.onObjectiveDone && this.h.onObjectiveDone(e); a.play('objective'); break;
      case 'checkpoint': if (this.kind === 'local' && this.sim.checkpoint) { this.store.saveCheckpoint(JSON.parse(JSON.stringify(this.sim.checkpoint)), this.missionId); this.h.onToast && this.h.onToast('Checkpoint saved'); } break;
      case 'wave': a.play('alarm'); this.h.onToast && this.h.onToast('Reinforcements incoming'); break;
      case 'alert': { a.play('alert', e.x, e.z, { maxD: 50 }); break; }
      case 'pickup': if (e.by === this.meId) { a.play('pickup'); this.h.onToast && this.h.onToast(e.k === 'ammo' ? 'Ammo collected' : e.k === 'health' ? 'Health restored' : 'Armour restored'); } break;
      case 'reload': { const ent = this.posOf(e.by); if (ent) a.play('reload', ent.x, ent.z, { maxD: 40 }); break; }
      case 'throw': { const ent = this.posOf(e.by); if (ent) a.play('throw', ent.x, ent.z, { maxD: 40 }); break; }
      case 'flash': { r.flash(e.x, e.y, e.z, 4); r.pointLight(e.x, e.y, e.z, 12, 0.2, '#ffffff'); a.play('flash', e.x, e.z, { maxD: 60 }); break; }
      case 'smoke': { r.smokeCloud(e.x, e.y, e.z, e.r, e.ttl); a.play('smoke', e.x, e.z, { maxD: 40 }); break; }
      case 'cover': r.addCover(e); if (this.kind === 'net') this.coverBoxes.set(e.id, this.map.addBox({ id: e.id, x: e.x, z: e.z, w: e.w, d: e.d, y: 0, h: e.h, kind: 'cover' })); break;
      case 'coverGone': r.removeCover(e.id); if (this.kind === 'net') { const b = this.coverBoxes.get(e.id); if (b) { this.map.removeBox(b); this.coverBoxes.delete(e.id); } } break;
      case 'barrel': { const b = this.map.boxes.find((x) => x.id === e.id); void b; break; }
      case 'targetDown': a.play('impact', e.x, e.z); break;
      case 'healed': if (e.by === this.meId) a.play('heal'); break;
      case 'heal': break;
      case 'collected': a.play('pickup', e.x, e.z); this.haptic(30); break;
      case 'device': a.play('objective'); break;
      case 'recon': if (e.by === this.meId) a.play('radio'); break;
      case 'respawn': if (e.id === this.meId) { this.hud.vignette = 0; this.aim.pitch = 0; } break;
      case 'end': a.play(e.outcome === 'SUCCESS' ? 'complete' : e.outcome === 'FAILED' ? 'fail' : 'objective'); break;
      case 'restored': this.h.onToast && this.h.onToast('Checkpoint restored'); break;
      case 'matchStart': break;
      default: break;
    }
  }

  haptic(ms) { const s = this.store.settings; if (!s.vibration || ms <= 5) return; if (this.input.rumble) this.input.rumble(ms); if (navigator.vibrate && this.input.mode === 'touch') { try { navigator.vibrate(Math.min(250, ms)); } catch { /* ignore */ } } }
  nameOf(id) {
    if (!id) return '';
    const s = this.lastSnap; if (!s) return id;
    const p = s.ix && s.ix.p.get(id); if (p) return p.n; const e = s.ix && s.ix.e.get(id); if (e) return (ARCHETYPES[e.ty] || {}).name || 'Hostile';
    return id.startsWith('e') ? 'Hostile' : id;
  }
  posOf(id) {
    if (id === this.meId && this.me) return this.me;
    const s = this.lastSnap; if (!s || !s.ix) return null;
    return s.ix.p.get(id) || s.ix.e.get(id) || s.ix.n.get(id) || null;
  }
  muzzleWorld(id, ent) {
    return this.r.muzzlePos(id) || { x: ent.x, y: (ent.y || 0) + 1.4, z: ent.z };
  }

  fireFx(id, wid, mine) {
    const w = WEAPONS[wid] || null; const a = this.audio, r = this.r;
    const ent = this.posOf(id); if (!ent) return;
    const cat = w ? w.cat : 'Enemy';
    const snd = !w ? 'shot_enemy' : cat === 'SMG' ? 'shot_smg' : cat === 'Sidearm' ? 'shot_pistol' : cat === 'Shotgun' ? 'shot_shotgun' : cat === 'Sniper Rifle' || cat === 'Marksman Rifle' ? 'shot_sniper' : cat === 'Launcher' ? 'rocket' : 'shot_ar';
    a.play(snd, mine ? undefined : ent.x, mine ? undefined : ent.z, { maxD: 120 });
    const mp = this.muzzleWorld(id, ent);
    r.flash(mp.x, mp.y, mp.z, w && w.cat === 'Shotgun' ? 0.9 : 0.55);
    if (mine || Math.hypot(ent.x - this.me.x, ent.z - this.me.z) < 25) r.pointLight(mp.x, mp.y, mp.z, 2.5, 0.06);
    const c = r.chars.get(id); if (c && c.c && !mine) c.c.kick();
  }

  /* ================= cinematic ================= */
  updateCine(intent, dt) {
    const c = this.cine, step = c.list[c.i];
    c.t += dt;
    if (c.t === dt) this.h.onSubtitle && this.h.onSubtitle(step.text, step.dur);
    const skip = intent.jump || intent.fire || intent.interact || intent.pause;
    if (skip && c.t > 0.4) c.t = step.dur;
    if (c.t >= step.dur) { c.i++; c.t = 0; if (c.i >= c.list.length) { this.cine = null; this.h.onCineEnd && this.h.onCineEnd(); this.r.camState.init = false; } }
  }

  /* ================= rendering ================= */
  renderFrame(dt, intent) {
    const r = this.r, me = this.me; if (!me || !this.map) { return; }
    const s = this.store.settings;
    const snap = this.lastSnap;
    // interpolated view time
    const delay = this.kind === 'net' ? 0.1 : 0.06;
    const rt = performance.now() / 1000 - delay;
    let a = null, b = null;
    for (let i = this.snaps.length - 1; i >= 0; i--) { if (this.snaps[i]._t <= rt) { a = this.snaps[i]; b = this.snaps[i + 1] || null; break; } }
    if (!a) { a = this.snaps[0] || null; b = this.snaps[1] || null; }
    const k = a && b ? Math.max(0, Math.min(1, (rt - a._t) / Math.max(1e-3, b._t - a._t))) : 1;
    const other = b || a;
    if (a) this.syncView(a, other, k, dt);
    // own character
    const myEntry = r.chars.get(this.meId);
    const mePos = me;
    if (myEntry && myEntry.c) {
      const c = myEntry.c; c.group.visible = true;
      c.group.position.set(mePos.x, mePos.y, mePos.z); c.group.rotation.y = this.aim.yaw;
      const sp = Math.hypot(me.vx || 0, me.vz || 0);
      c.update(dt, { speed: sp, crouched: me.crouched, sprinting: me.sprinting || (this.kind === 'net' && this.hud.sprint), pitch: this.aim.pitch, ads: this.lastIntent && this.lastIntent.ads, alive: me.alive, downed: me.downed });
      r.giveWeapon(myEntry, this.curWeaponId(), this.weaponSkin());
      if (sp > 1 && me.onGround && me.alive) this.audio.footstep(me.x, me.z, sp > 5.5);
    }
    // camera
    const w = WEAPONS[this.curWeaponId()];
    if (this.cine) this.cineCamera();
    else {
      const ads = !!(this.lastIntent && this.lastIntent.ads) && me.alive;
      r.updateCamera(dt, { x: mePos.x, y: mePos.y, z: mePos.z, crouched: me.crouched }, this.aim, { ads, zoom: w ? w.adsZoom : 1, dist: s.camDist, shoulder: (this.shoulderSide || 1) * (s.shoulder || 1), reducedMotion: s.reducedMotion, sprint: this.lastIntent && this.lastIntent.sprint });
      this.hud.ads = ads; this.hud.zoom = w ? w.adsZoom : 1;
    }
    this.audio.setListener(me.x, me.z, this.aim.yaw);
    if (snap) this.updateMarkers(snap);
    this.hud.vignette = Math.max(0, this.hud.vignette - dt * 0.6);
    this.dirHits = this.dirHits.filter((d) => (d.t -= dt) > 0);
    for (const f of this.killfeed) f.t -= dt; this.killfeed = this.killfeed.filter((f) => f.t > 0);
    this.hud.rtt = this.net ? this.net.rtt : 0; this.hud.cine = !!this.cine; this.hud.aim = this.aim;
    r.render(dt);
    if (this.h.onFrame) this.h.onFrame(this);
  }

  weaponSkin() { const l = this.lookSelf; if (!l) return null; const skins = { w_sand: '#9b8455', w_ember: '#a4482c', w_frost: '#8fa4b5' }; return skins[l.weaponSkin] || null; }

  cineCamera() {
    const c = this.cine, step = c.list[c.i], z = this.map.zones[step.focus]; if (!z) return;
    const ang = c.t * 0.25 + c.i * 1.7, R = step.radius || 18, H = step.height || 10;
    this.r.cam.position.set(z.x + Math.cos(ang) * R, H, z.z + Math.sin(ang) * R);
    this.r.cam.lookAt(z.x, 1.5, z.z); this.r.cam.fov = 55; this.r.cam.updateProjectionMatrix(); this.r.camState.init = false;
  }

  ensureChar(id, kind, look, tint, weapon) {
    let e = this.r.chars.get(id);
    if (!e) { this.r.spawnChar(id, kind, look, tint).then((en) => { if (en && en.c && weapon) this.r.giveWeapon(en, weapon); }); e = this.r.chars.get(id); }
    return e;
  }

  /* Apply interpolated positions from two snapshots to every character. */
  syncView(a, b, k, dt) {
    const r = this.r;
    if (!a.ix) this.buildSnapIndex(a); if (!b.ix) this.buildSnapIndex(b);
    const seen = new Set();
    // other players
    for (const pa of a.players) {
      if (pa.id === this.meId) continue; seen.add(pa.id);
      const pb = b.ix.p.get(pa.id) || pa;
      const tint = this.mode === 'tdm' ? TEAM_TINT[pa.tm] : null;
      let e = r.chars.get(pa.id); if (!e) e = this.ensureChar(pa.id, 'player', pa.lk, tint);
      if (!e || !e.c) { continue; }
      const c = e.c; c.group.visible = !!pa.cn || true;
      const x = lerp(pa.x, pb.x, k), z = lerp(pa.z, pb.z, k), y = lerp(pa.y, pb.y, k);
      const pv = this.prev.get(pa.id) || { x, z }; const sp = dt > 0 ? Math.hypot(x - pv.x, z - pv.z) / dt : 0; this.prev.set(pa.id, { x, z });
      c.group.position.set(x, y, z); c.group.rotation.y = lerpAng(pa.yw, pb.yw, k);
      c.update(dt, { speed: Math.min(8, sp), crouched: !!pa.cr, sprinting: !!pa.sp, pitch: pa.pt, ads: !!pa.ads, alive: !!pa.al, downed: !!pa.dn });
      r.giveWeapon(e, pa.w);
      if (sp > 1.5 && pa.al) { const d = Math.hypot(x - this.me.x, z - this.me.z); if (d < 28) this.audio.footstepOther(x, z, sp, this, pa.id); }
    }
    // enemies
    for (const ea of a.enemies) {
      seen.add(ea.id);
      const eb = b.ix.e.get(ea.id) || ea;
      let en = r.chars.get(ea.id); if (!en) en = this.ensureChar(ea.id, ea.ty, null, ENEMY_TINT[ea.ty], ENEMY_WEAPON[ea.ty]);
      if (!en || !en.c) continue;
      const c = en.c; c.group.visible = true;
      const x = lerp(ea.x, eb.x, k), z = lerp(ea.z, eb.z, k);
      const pv = this.prev.get(ea.id) || { x, z }; const sp = dt > 0 ? Math.hypot(x - pv.x, z - pv.z) / dt : 0; this.prev.set(ea.id, { x, z });
      c.group.position.set(x, 0, z); c.group.rotation.y = lerpAng(ea.yw, eb.yw, k);
      c.update(dt, { speed: Math.min(7, sp), crouched: ea.st === 'REPOSITION' && false, sprinting: sp > 4.5, pitch: 0, ads: ea.st === 'COMBAT', alive: ea.st !== 'DEAD', downed: false });
      en.state = ea.st; en.hp = ea.hp; en.mh = ea.mh; en.aw = ea.aw; en.ty = ea.ty; en.rv = ea.rv; en.stn = ea.stn; en.sp = ea.sp;
    }
    // npcs (captive / ally)
    for (const na of a.npcs) {
      seen.add(na.id);
      const nb = b.ix.n.get(na.id) || na;
      let en = r.chars.get(na.id); if (!en) { this.ensureChar(na.id, 'player', { outfit: 'o_sand', helmet: 'h_none', hair: 'crop', face: 'f2', skin: 's2', vest: 'v_coyote' }, null); continue; }
      if (!en.c) continue;
      const x = lerp(na.x, nb.x, k), z = lerp(na.z, nb.z, k);
      const pv = this.prev.get(na.id) || { x, z }; const sp = dt > 0 ? Math.hypot(x - pv.x, z - pv.z) / dt : 0; this.prev.set(na.id, { x, z });
      en.c.group.visible = true; en.c.group.position.set(x, 0, z); en.c.group.rotation.y = lerpAng(na.yw, nb.yw, k);
      en.c.update(dt, { speed: Math.min(6, sp), crouched: na.st === 'captive', sprinting: false, pitch: 0, alive: !!na.al, downed: false });
      en.npc = true; en.state = na.st;
    }
    for (const id of [...r.chars.keys()]) if (!seen.has(id) && id !== this.meId) { const en = r.chars.get(id); if (en && !en.pending) { r.removeChar(id); this.prev.delete(id); } }
    // static/dynamic world objects
    const s = b;
    if (this.kind === 'local') { const doors = this.map.boxes.filter((x) => x.door && x.open).map((x) => x.id); r.setDoors(doors); } else r.setDoors(s.doors);
    r.syncPickups(s.pk); r.syncInteractables(s.ints, s.tgts); r.syncProjectiles(s.proj); r.setBarrels(s.bars || []);
    if (this.kind === 'local') this.localBarrels();
  }
  localBarrels() { const gone = []; for (const bd of this.map.barrels) if (!this.map.boxes.some((x) => x.id === bd.id)) gone.push(bd.id); this.r.setBarrels(gone); }

  /* World markers and minimap data, updated once per frame. */
  updateMarkers(snap) {
    const m = snap.mission; const r = this.r, map = this.map;
    const pts = [];
    if (m && !m.done && !m.failed) {
      const col = '#ffd45a';
      if (snap.ints.length) for (const i of snap.ints) pts.push({ x: i.x, z: i.z, label: i.l, color: col });
      else if (snap.tgts.length) for (const t of snap.tgts) pts.push({ x: t.x, z: t.z, label: t.l || 'Target', color: '#ff6a4a' });
      else if (m.zone && map.zones[m.zone]) { const z = map.zones[m.zone]; pts.push({ x: z.x, z: z.z, label: m.type === 'extract' ? 'Extraction' : 'Objective', color: m.type === 'extract' ? '#4fe3a0' : col, r: z.r }); }
    }
    const key = pts.map((p) => p.x.toFixed(0) + p.z.toFixed(0)).join('|');
    if (key !== this._beaconKey) { this._beaconKey = key; r.setBeacons(pts); }
    this.objMarkers = pts;
  }

  /* ================= queries for the UI ================= */
  getMinimap() {
    const s = this.lastSnap; if (!s) return null;
    const hostile = [];
    for (const e of s.enemies) if (e.st !== 'DEAD' && (e.rv || (e.st === 'COMBAT' && e.sp) )) hostile.push({ x: e.x, z: e.z, state: e.st, rv: e.rv });
    const mates = [];
    for (const p of s.players) if (p.id !== this.meId && p.al && (this.mode === 'coop' || (this.mode === 'tdm' && p.tm === this.hud.team))) mates.push({ x: p.x, z: p.z, dn: p.dn });
    for (const n of s.npcs) if (n.al) mates.push({ x: n.x, z: n.z, npc: true });
    const foes = [];
    if (this.mode === 'tdm') for (const p of s.players) if (p.id !== this.meId && p.al && p.tm !== this.hud.team && p.sp) foes.push({ x: p.x, z: p.z });
    return { me: { x: this.me.x, z: this.me.z, yaw: this.aim.yaw }, half: this.map.half, objectives: this.objMarkers, hostile, mates, foes, zones: { extract: this.map.zones.EXTRACT, start: this.map.zones.START }, walls: this.map };
  }

  /* Screen-space tags (names, health) for the HUD overlay. */
  getTags() {
    const out = []; const r = this.r, s = this.lastSnap; if (!s) return out;
    for (const [id, e] of r.chars) {
      if (id === this.meId || !e.c || !e.c.group.visible) continue;
      const pos = e.c.group.position; const d = Math.hypot(pos.x - this.me.x, pos.z - this.me.z);
      if (d > 45) continue;
      const pl = s.ix && s.ix.p.get(id);
      if (pl) {
        if (!pl.al) continue; const friendly = this.mode === 'coop' || (this.mode === 'tdm' && pl.tm === this.hud.team); if (!friendly && d > 25) continue;
        const sp = r.project(pos.x, pos.y + 2.1, pos.z); if (sp) out.push({ x: sp.x, y: sp.y, label: pl.n, hp: pl.hp / 100, kind: friendly ? 'friend' : 'foe', dn: pl.dn });
      } else if (e.ty && e.state !== 'DEAD') {
        const seen = e.rv || e.aw > 0.15; if (!seen) continue;
        const sp = r.project(pos.x, pos.y + 2.1, pos.z); if (sp) out.push({ x: sp.x, y: sp.y, label: (ARCHETYPES[e.ty] || {}).name, hp: e.hp / e.mh, aw: e.aw, state: e.state, kind: 'enemy', stn: e.stn });
      }
    }
    return out;
  }
  getWaypoints() {
    const out = [];
    for (const p of this.objMarkers) { const sp = this.r.project(p.x, 2.5, p.z); out.push({ label: p.label, color: p.color, dist: Math.round(Math.hypot(p.x - this.me.x, p.z - this.me.z)), sp, ang: Math.atan2(-(p.x - this.me.x), -(p.z - this.me.z)) - this.aim.yaw }); }
    return out;
  }

  /* ================= flush network input ================= */
  flushNet(dt) {
    this.sendT += dt;
    if (this.sendT < 1 / NET.inputHz) return;
    this.sendT = 0;
    if (!this.outbox.length) return;
    const batch = this.outbox.splice(0, 8);
    if (this.outbox.length > 24) this.outbox.length = 0;
    if (this.net) this.net.sendInput(batch);
  }

  /* ================= teardown ================= */
  dispose() {
    this.stop(); this.sim = null; this.snaps.length = 0; this.map = null; this.me = null; this.net = null; this.prev.clear();
    this.h = {}; this.lastSnap = null;
  }
}
