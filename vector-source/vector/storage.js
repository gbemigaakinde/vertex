/* ============================================================
   vector/storage.js  |  Namespaced save data for VECTOR: BLACKLINE.
   Everything lives under the key prefix "vectorBlackline:" so it can
   never collide with Vertex keys. Progress is stored per Vertex user.
   Optional cloud copy of the small multiplayer profile (loadout, look,
   level) goes through the VECTOR Worker if one is configured.
   ============================================================ */
import { STORAGE_NS, XP } from './config.js';
import { LOADOUTS, sanitizeLoadout } from './weapons.js';
import { DEFAULT_LOOK, sanitizeLook } from './cosmetics.js';
import { CAMPAIGN } from './missions.js';

export const DEFAULT_SETTINGS = {
  quality: 'auto', masterVol: 0.8, sfxVol: 0.9, musicVol: 0.5, voiceVol: 0.9,
  sens: 1.0, aimSens: 0.6, touchSens: 1.0, camDist: 3.6, invertY: false,
  vibration: true, motionFx: true, reducedMotion: false, hudScale: 1.0, subtitles: true, shoulder: 1, colorblind: false,
};

export function defaultProfile() {
  return {
    v: 1, level: 1, xp: 0, name: '',
    completed: {}, unlocked: ['m01'], difficulty: 'standard',
    loadouts: { CUSTOM: { ...LOADOUTS.CUSTOM } }, activeLoadout: 'ASSAULT', look: { ...DEFAULT_LOOK },
    stats: { kills: 0, deaths: 0, assists: 0, shots: 0, hits: 0, headshots: 0, dist: 0, objectives: 0, wins: 0, matches: 0, missions: 0, playtime: 0 },
    settings: { ...DEFAULT_SETTINGS }, save: null,
  };
}

export function levelFromXp(xp) {
  let lvl = 1, need = XP.perLevel(1), left = xp;
  while (left >= need && lvl < 99) { left -= need; lvl++; need = XP.perLevel(lvl); }
  return { level: lvl, into: left, need };
}

function ls() { try { const k = '__vb_test'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch { return null; } }

export class Store {
  constructor(uid, getToken, apiBase) {
    this.uid = uid || 'guest';
    this.getToken = getToken || null;
    this.apiBase = apiBase || '';
    this.key = `${STORAGE_NS}:v1:${this.uid}`;
    this.mem = null;
    this.ok = !!ls();
    this.profile = this.load();
    this._dirty = false; this._t = null;
  }

  load() {
    let p = null;
    if (this.ok) {
      try { const raw = localStorage.getItem(this.key); if (raw) p = JSON.parse(raw); } catch { p = null; }
    }
    const d = defaultProfile();
    if (!p || typeof p !== 'object') return d;
    // merge defensively so a corrupted or older save never crashes the game
    const out = { ...d, ...p, stats: { ...d.stats, ...(p.stats || {}) }, settings: { ...d.settings, ...(p.settings || {}) } };
    out.completed = p.completed && typeof p.completed === 'object' ? p.completed : {};
    out.unlocked = Array.isArray(p.unlocked) && p.unlocked.length ? p.unlocked.filter((x) => CAMPAIGN.some((m) => m.id === x)) : ['m01'];
    if (!out.unlocked.includes('m01')) out.unlocked.unshift('m01');
    out.level = levelFromXp(Math.max(0, +out.xp || 0)).level;
    out.loadouts = { CUSTOM: sanitizeLoadout(p.loadouts && p.loadouts.CUSTOM, out.level) };
    if (!LOADOUTS[out.activeLoadout]) out.activeLoadout = 'ASSAULT';
    out.look = sanitizeLook(p.look, out.level);
    return out;
  }

  save() {
    this.profile.level = levelFromXp(this.profile.xp).level;
    if (!this.ok) { this.mem = JSON.stringify(this.profile); return true; }
    try { localStorage.setItem(this.key, JSON.stringify(this.profile)); return true; } catch { return false; }
  }

  /* batch saves so dragging a slider does not thrash storage */
  touch() { this._dirty = true; if (this._t) return; this._t = setTimeout(() => { this._t = null; if (this._dirty) { this._dirty = false; this.save(); } }, 400); }
  flush() { if (this._t) { clearTimeout(this._t); this._t = null; } this.save(); this._dirty = false; }

  get settings() { return this.profile.settings; }
  setSetting(k, v) { this.profile.settings[k] = v; this.touch(); }

  activeLoadout() {
    const id = this.profile.activeLoadout;
    return sanitizeLoadout(id === 'CUSTOM' ? this.profile.loadouts.CUSTOM : LOADOUTS[id], this.profile.level);
  }
  setLoadout(id, custom) {
    this.profile.activeLoadout = LOADOUTS[id] ? id : 'ASSAULT';
    if (custom) this.profile.loadouts.CUSTOM = sanitizeLoadout(custom, this.profile.level);
    this.flush();
  }

  saveCheckpoint(cp, missionId) { this.profile.save = cp ? { missionId, cp, at: Date.now() } : null; this.touch(); }
  getCheckpoint() { return this.profile.save; }

  /* Apply a finished match or mission result for this player. Returns a summary. */
  applyResult(result, myId) {
    const mine = result.players.find((p) => p.id === myId);
    if (!mine) return null;
    const pr = this.profile, before = levelFromXp(pr.xp).level;
    const s = pr.stats;
    s.kills += mine.stats.kills; s.deaths += mine.stats.deaths; s.assists += mine.stats.assists; s.shots += mine.stats.shots;
    s.hits += mine.stats.hits; s.headshots += mine.stats.headshots; s.dist += mine.stats.dist; s.objectives += mine.stats.objectives;
    s.matches++; if (mine.win) s.wins++;
    s.playtime += result.time;
    let unlockedNext = null;
    if (result.mission && result.outcome === 'SUCCESS') {
      const m = CAMPAIGN.find((x) => x.id === result.mission);
      const first = !pr.completed[result.mission];
      pr.completed[result.mission] = { best: Math.min(result.time, (pr.completed[result.mission] || {}).best || 1e9), at: Date.now() };
      if (first) s.missions++;
      if (m && m.reward.unlock && !pr.unlocked.includes(m.reward.unlock)) { pr.unlocked.push(m.reward.unlock); unlockedNext = m.reward.unlock; }
      pr.save = null;
    }
    const xp = mine.xp;
    pr.xp += xp;
    const after = levelFromXp(pr.xp);
    pr.level = after.level;
    this.flush();
    return { xp, levelBefore: before, levelAfter: after.level, unlockedNext, into: after.into, need: after.need };
  }

  reset() { this.profile = defaultProfile(); this.flush(); }

  /* ---- optional cloud profile (multiplayer identity only) ---- */
  async pullCloud() {
    if (!this.apiBase || !this.getToken) return false;
    try {
      const token = await this.getToken();
      const res = await fetch(this.apiBase + '/api/vector/profile', { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) return false;
      const { profile } = await res.json();
      if (profile && profile.level > this.profile.level) { this.profile.xp = Math.max(this.profile.xp, XP.perLevel(1) * (profile.level - 1)); }
      return true;
    } catch { return false; }
  }
  async pushCloud() {
    if (!this.apiBase || !this.getToken) return false;
    try {
      const token = await this.getToken();
      const res = await fetch(this.apiBase + '/api/vector/profile', { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ level: this.profile.level, loadout: this.activeLoadout(), look: this.profile.look, name: this.profile.name }) });
      return res.ok;
    } catch { return false; }
  }
}
