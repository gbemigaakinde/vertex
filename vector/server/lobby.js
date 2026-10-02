/* ============================================================
   vector/server/lobby.js  |  Lobby + match host logic (server side).
   No Cloudflare APIs in here: connections are plain objects with
   send(string) and close(code, reason). worker.js wires them to real
   WebSockets inside a Durable Object; tests/server.test.mjs wires them
   to fakes.

   Server authority: clients send INPUT COMMANDS only. Positions, hits,
   damage, ammo, score and objectives are all computed here by MatchSim.
   ============================================================ */
import { MatchSim } from '../sim.js';
import { NET, MODES, LOBBY_STATES } from '../config.js';
import { sanitizeLoadout } from '../weapons.js';
import { sanitizeLook } from '../cosmetics.js';
import { MAP_LIST } from '../world.js';
import { CAMPAIGN, getMission } from '../missions.js';

const MAP_IDS = MAP_LIST.map((m) => m.id);
const clampStr = (s, n) => String(s == null ? '' : s).replace(/[^\p{L}\p{N} _\-.]/gu, '').slice(0, n);

export class Lobby {
  constructor(code, opts = {}) {
    this.code = code;
    this.now = opts.now || (() => Date.now());
    this.state = 'WAITING';
    this.hostUid = null;
    this.config = { mode: 'ffa', mapId: 'industrial', mission: 'm01', difficulty: 'standard' };
    this.members = new Map();       // uid -> member
    this.sim = null;
    this.createdAt = this.now();
    this.lastActivity = this.createdAt;
    this.countdownAt = 0;
    this.emptySince = 0;
    this.finishedAt = 0;
    this.closed = false; this.everJoined = false;
    this.lastSnap = 0;
    this.events = [];
  }

  /* ---------- helpers ---------- */
  maxPlayers() { return NET.maxPlayers[this.config.mode] || 4; }
  member(uid) { return this.members.get(uid); }
  connectedCount() { let n = 0; for (const m of this.members.values()) if (m.conn) n++; return n; }

  publicState() {
    return {
      code: this.code, state: this.state, host: this.hostUid, config: this.config, max: this.maxPlayers(),
      countdown: this.state === 'STARTING' ? Math.max(0, Math.ceil((this.countdownAt - this.now()) / 1000)) : 0,
      members: [...this.members.values()].map((m) => ({
        uid: m.uid, name: m.name, ready: m.ready, team: m.team, level: m.level, loadout: m.loadout.id,
        presence: !m.conn ? 'OFFLINE' : (this.state === 'IN_MATCH' ? 'IN_MATCH' : 'IN_LOBBY'), isHost: m.uid === this.hostUid,
      })),
    };
  }

  send(conn, obj) { if (!conn) return; try { conn.send(JSON.stringify(obj)); } catch { /* socket gone */ } }
  broadcast(obj) { const s = JSON.stringify(obj); for (const m of this.members.values()) if (m.conn) { try { m.conn.send(s); } catch { /* ignore */ } } }
  pushLobby() { this.broadcast({ t: 'lobby', lobby: this.publicState() }); }

  /* ---------- joining ---------- */
  /* identity = { uid, name, level?, loadout?, look? }. Returns { ok, error }. */
  join(conn, identity) {
    if (this.closed) return { ok: false, error: 'This lobby has closed.' };
    const uid = identity.uid;
    let m = this.members.get(uid);
    if (m) {
      // Duplicate session or reconnect: newest connection wins.
      if (m.conn && m.conn !== conn) { const old = m.conn; m.conn = null; try { old.close(4001, 'Signed in somewhere else'); } catch { /* ignore */ } }
      m.conn = conn; m.lastSeen = this.now(); m.dropAt = 0;
      if (this.sim) { const p = this.sim.players.get(uid); if (p) p.connected = true; }
    } else {
      if (this.state === 'IN_MATCH' || this.state === 'STARTING') return { ok: false, error: 'A match is already in progress.' };
      if (this.members.size >= this.maxPlayers()) return { ok: false, error: 'This lobby is full.' };
      const level = Math.max(1, Math.min(99, identity.level | 0 || 1));
      m = {
        uid, name: clampStr(identity.name, 18) || 'Operative', conn, ready: false, team: 0, level,
        loadout: sanitizeLoadout(identity.loadout, level), look: sanitizeLook(identity.look, level), lastSeen: this.now(), dropAt: 0, ackSeq: 0, msgCount: 0, msgWin: this.now(),
      };
      this.members.set(uid, m); this.everJoined = true;
      if (!this.hostUid) this.hostUid = uid;
      this.rebalanceTeams();
    }
    this.emptySince = 0; this.lastActivity = this.now();
    this.send(conn, { t: 'joined', uid, code: this.code, lobby: this.publicState(), rejoin: !!this.sim && this.state === 'IN_MATCH' });
    if (this.sim && this.state === 'IN_MATCH') this.send(conn, { t: 'match', mode: this.sim.mode, mapId: this.sim.mapId, mission: this.sim.mission ? this.sim.mission.id : null, seed: this.sim.seed, you: uid });
    this.pushLobby();
    return { ok: true };
  }

  rebalanceTeams() {
    if (this.config.mode !== 'tdm') { for (const m of this.members.values()) m.team = 0; return; }
    let i = 0;
    for (const m of this.members.values()) m.team = i++ % 2;
  }

  /* ---------- leaving / dropping ---------- */
  leave(uid, voluntary = true) {
    const m = this.members.get(uid);
    if (!m) return;
    if (m.conn && voluntary) { try { m.conn.close(1000, 'left'); } catch { /* ignore */ } }
    m.conn = null;
    this.members.delete(uid);
    if (this.sim) this.sim.removePlayer(uid);
    if (this.hostUid === uid) this.hostUid = this.members.keys().next().value || null;
    if (this.state === 'STARTING' && this.members.size < this.minPlayers()) this.cancelCountdown('A player left.');
    this.checkMatchViability();
    this.pushLobby();
    if (!this.members.size) this.emptySince = this.now();
  }

  /* Socket closed without an explicit leave. Keep the seat for a grace period. */
  disconnect(conn) {
    for (const m of this.members.values()) {
      if (m.conn !== conn) continue;
      m.conn = null; m.dropAt = this.now();
      if (this.sim) { const p = this.sim.players.get(m.uid); if (p) { p.connected = false; p.ctl = { ...p.ctl, fire: false, interact: false, mx: 0, mz: 0 }; } }
      if (this.state === 'WAITING' || this.state === 'READY' || this.state === 'FINISHED') {
        // in the lobby a dropped seat is cheap: free it after a short grace
      }
      if (!this.connectedCount()) this.emptySince = this.now();
      this.pushLobby();
    }
  }

  minPlayers() { return NET.minPlayers[this.config.mode] || 1; }

  /* ---------- messages ---------- */
  handle(uid, msg) {
    const m = this.members.get(uid);
    if (!m || !msg || typeof msg !== 'object') return;
    const now = this.now();
    // flood control: 200 messages per second is far more than a real client sends
    if (now - m.msgWin > 1000) { m.msgWin = now; m.msgCount = 0; }
    if (++m.msgCount > 200) return;
    m.lastSeen = now;
    switch (msg.t) {
      case 'input': return this.onInput(m, msg);
      case 'ping': return this.send(m.conn, { t: 'pong', c: msg.c, s: now });
      case 'ready': return this.onReady(m, !!msg.ready);
      case 'loadout': if (this.state === 'WAITING' || this.state === 'READY') { m.loadout = sanitizeLoadout(msg.loadout, m.level); m.look = sanitizeLook(msg.look, m.level); this.pushLobby(); } return;
      case 'config': return this.onConfig(m, msg.config);
      case 'team': if (this.config.mode === 'tdm' && (this.state === 'WAITING' || this.state === 'READY') && (msg.team === 0 || msg.team === 1)) { m.team = msg.team; m.ready = false; this.pushLobby(); } return;
      case 'start': return this.onStart(m);
      case 'kick': return this.onKick(m, msg.uid);
      case 'backToLobby': return this.onBackToLobby(m);
      case 'leave': return this.leave(m.uid, true);
      default: return;
    }
  }

  onReady(m, ready) {
    if (this.state !== 'WAITING' && this.state !== 'READY') return;
    m.ready = ready;
    this.updateReadyState();
    this.pushLobby();
  }

  updateReadyState() {
    if (this.state !== 'WAITING' && this.state !== 'READY') return;
    const all = this.members.size >= this.minPlayers() && [...this.members.values()].every((x) => x.ready || x.uid === this.hostUid);
    this.state = all ? 'READY' : 'WAITING';
  }

  onConfig(m, cfg) {
    if (m.uid !== this.hostUid || (this.state !== 'WAITING' && this.state !== 'READY') || !cfg) return;
    const c = { ...this.config };
    if (MODES[cfg.mode] && cfg.mode !== 'campaign') {
      // the new mode must still fit the people already inside
      if (this.members.size <= (NET.maxPlayers[cfg.mode] || 4)) c.mode = cfg.mode;
    }
    if (MAP_IDS.includes(cfg.mapId)) c.mapId = cfg.mapId;
    if (cfg.mission && getMission(cfg.mission)) c.mission = cfg.mission;
    if (['recruit', 'standard', 'veteran'].includes(cfg.difficulty)) c.difficulty = cfg.difficulty;
    this.config = c;
    this.rebalanceTeams();
    for (const x of this.members.values()) x.ready = false;
    this.state = 'WAITING';
    this.pushLobby();
  }

  onKick(m, uid) {
    if (m.uid !== this.hostUid || uid === m.uid || (this.state !== 'WAITING' && this.state !== 'READY')) return;
    const t = this.members.get(uid);
    if (!t) return;
    if (t.conn) { this.send(t.conn, { t: 'kicked' }); try { t.conn.close(4003, 'Removed by host'); } catch { /* ignore */ } }
    this.leave(uid, false);
  }

  onStart(m) {
    if (m.uid !== this.hostUid) return this.send(m.conn, { t: 'error', code: 'not_host', msg: 'Only the host can start the match.' });
    if (this.state !== 'WAITING' && this.state !== 'READY') return;
    if (this.members.size < this.minPlayers()) return this.send(m.conn, { t: 'error', code: 'few_players', msg: `This mode needs at least ${this.minPlayers()} players.` });
    if (this.config.mode === 'tdm') {
      const a = [...this.members.values()].filter((x) => x.team === 0).length, b = this.members.size - a;
      if (!a || !b) return this.send(m.conn, { t: 'error', code: 'teams', msg: 'Both teams need at least one player.' });
    }
    const notReady = [...this.members.values()].filter((x) => !x.ready && x.uid !== this.hostUid);
    if (notReady.length) return this.send(m.conn, { t: 'error', code: 'not_ready', msg: 'Everyone must be ready first.' });
    this.state = 'STARTING';
    this.countdownAt = this.now() + NET.countdownMs;
    this.pushLobby();
  }

  cancelCountdown(why) {
    if (this.state !== 'STARTING') return;
    this.state = 'WAITING';
    for (const x of this.members.values()) x.ready = false;
    this.broadcast({ t: 'notice', msg: why || 'Start cancelled.' });
    this.pushLobby();
  }

  onBackToLobby(m) {
    if (m.uid !== this.hostUid || (this.state !== 'FINISHED' && this.state !== 'IN_MATCH')) return;
    this.resetToLobby();
  }

  resetToLobby() {
    this.sim = null; this.state = 'WAITING';
    for (const [uid, x] of [...this.members]) { x.ready = false; if (!x.conn) this.members.delete(uid); }
    if (!this.members.has(this.hostUid)) this.hostUid = this.members.keys().next().value || null;
    this.broadcast({ t: 'lobbyReset' });
    this.pushLobby();
  }

  /* ---------- match ---------- */
  beginMatch() {
    const cfg = this.config;
    this.sim = new MatchSim({ mode: cfg.mode, mapId: cfg.mapId, mission: cfg.mode === 'coop' ? cfg.mission : null, difficulty: cfg.difficulty, seed: (this.now() & 0xffffff) + 1 });
    if (this.config.mode === 'tdm') this.rebalanceTeams();
    for (const m of this.members.values()) {
      const p = this.sim.addPlayer(m.uid, m.name, m.loadout, { level: m.level, look: m.look, team: m.team, trusted: false });
      p.connected = !!m.conn;
    }
    this.sim.start();
    this.state = 'IN_MATCH';
    this.lastSnap = 0;
    this.broadcast({ t: 'match', mode: this.sim.mode, mapId: this.sim.mapId, mission: this.sim.mission ? this.sim.mission.id : null, seed: this.sim.seed });
    this.pushLobby();
  }

  onInput(m, msg) {
    if (this.state !== 'IN_MATCH' || !this.sim) return;
    const cmds = Array.isArray(msg.c) ? msg.c.slice(0, 8) : [];
    for (const c of cmds) this.sim.applyInput(m.uid, c);
  }

  /* Called by the host loop at NET.tickHz. */
  tick(dt) {
    const now = this.now();
    if (this.closed) return;
    // dropped players: release seats after the grace period
    for (const m of [...this.members.values()]) {
      if (!m.conn && m.dropAt && now - m.dropAt > NET.reconnectGraceMs) {
        this.broadcast({ t: 'notice', msg: `${m.name} disconnected.` });
        this.leave(m.uid, false);
      }
    }
    if (this.state === 'STARTING') {
      if (this.members.size < this.minPlayers() || !this.connectedCount()) this.cancelCountdown('Not enough players.');
      else if (now >= this.countdownAt) this.beginMatch();
      else if (Math.floor((this.countdownAt - now) / 1000) !== this._lastCd) { this._lastCd = Math.floor((this.countdownAt - now) / 1000); this.pushLobby(); }
    }
    if (this.state === 'IN_MATCH' && this.sim) {
      this.sim.step(dt);
      const evs = this.sim.drainEvents();
      for (const m of this.members.values()) {
        if (!m.conn) continue;
        this.send(m.conn, { t: 's', s: this.sim.snapshot(m.uid), ev: evs });
      }
      if (this.sim.result) this.endMatch();
      else this.checkMatchViability();
    }
  }

  checkMatchViability() {
    if (this.state !== 'IN_MATCH' || !this.sim || this.sim.result) return;
    const mode = this.config.mode;
    const present = [...this.sim.players.values()].length;
    if (mode === 'ffa' && present < 2) return this.abortMatch('Not enough players to continue.');
    if (mode === 'tdm') {
      const t = [0, 0];
      for (const p of this.sim.players.values()) t[p.team]++;
      if (!t[0] || !t[1]) return this.abortMatch('A team has no players left.');
    }
    if (mode === 'coop' && !present) return this.abortMatch('All players left.');
    if (!this.connectedCount() && this.emptySince && this.now() - this.emptySince > NET.emptyMatchMs) this.abortMatch('Everyone disconnected.');
  }

  abortMatch(reason) {
    if (this.state !== 'IN_MATCH') return;
    if (this.sim && !this.sim.result) this.sim.finish('FINISHED', reason);
    this.endMatch(reason);
  }

  endMatch(reason) {
    this.state = 'FINISHED';
    this.finishedAt = this.now();
    const result = this.sim ? this.sim.result : null;
    this.broadcast({ t: 'end', result, reason: reason || (result && result.reason) || '' });
    this.pushLobby();
  }

  /* True when this lobby can be deleted. */
  expired() {
    const now = this.now();
    // A lobby is created over REST first and its host opens the WebSocket a moment later,
    // so "no members yet" must not count as dead until a grace period has passed.
    if (!this.members.size) return this.everJoined ? true : now - this.createdAt > NET.reconnectGraceMs;
    if (!this.connectedCount() && this.emptySince && now - this.emptySince > NET.reconnectGraceMs + 5000) return true;
    if (this.state !== 'IN_MATCH' && now - this.lastActivity > NET.idleLobbyMs) return true;
    return false;
  }
}

export { makeCode, normaliseCode } from '../lobbycode.js';
export { CAMPAIGN, LOBBY_STATES };
