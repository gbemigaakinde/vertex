/* ============================================================
   vector/server/worker.js  |  VECTOR: BLACKLINE multiplayer service.
   A SEPARATE Cloudflare Worker from Vertex's own worker.js, so nothing
   here can break existing Vertex routes.

     POST /api/vector/lobby/create   { mode, mapId, mission, difficulty }
     POST /api/vector/lobby/join     { code }
     POST /api/vector/lobby/leave    { code }
     GET  /api/vector/lobby/state?code=BLK-XXXX
     POST /api/vector/match/start    { code }   (host only)
     GET  /api/vector/match/state?code=BLK-XXXX
     GET  /api/vector/profile        PUT /api/vector/profile
     GET  /api/vector/ws?code=BLK-XXXX          (WebSocket, realtime play)

   Every call (except health) needs a Firebase ID token from the same
   Firebase project Vertex already uses: Authorization: Bearer <token>
   (for the WebSocket the token is sent as the first message, never in
   the URL).
   ============================================================ */
import { Lobby } from './lobby.js';
import { makeCode, normaliseCode } from '../lobbycode.js';
import { verifyFirebaseToken } from './auth.js';
import { NET } from '../config.js';
import { sanitizeLoadout } from '../weapons.js';
import { sanitizeLook } from '../cosmetics.js';

const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = !allowed.length || allowed.includes(origin) || allowed.includes('*');
  return ok && origin ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS', vary: 'Origin' } : {};
}

async function authenticate(request, env, tokenOverride) {
  const h = request.headers.get('Authorization') || '';
  const token = tokenOverride || (h.startsWith('Bearer ') ? h.slice(7) : '');
  if (env.VECTOR_DEV_GUEST === 'true' && token.startsWith('guest:')) {
    const name = token.slice(6, 24) || 'Guest';
    return { uid: 'guest-' + name.toLowerCase().replace(/[^a-z0-9]/g, ''), name, email: null };
  }
  return verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const reply = (obj, status = 200) => json(obj, status, cors);
    const path = url.pathname;
    try {
      if (path === '/api/vector/health') return reply({ ok: true, service: 'vector-blackline', v: 1 });
      if (!path.startsWith('/api/vector/')) return reply({ error: 'Not found' }, 404);
      if (!env.LOBBY) return reply({ error: 'Multiplayer is not configured on this server.' }, 503);

      // WebSocket: auth happens on the first message inside the Durable Object.
      if (path === '/api/vector/ws') {
        if (request.headers.get('Upgrade') !== 'websocket') return reply({ error: 'Expected a WebSocket' }, 426);
        const origin = request.headers.get('Origin') || '';
        const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
        if (allowed.length && !allowed.includes('*') && !allowed.includes(origin)) return reply({ error: 'Origin not allowed' }, 403);
        const code = normaliseCode(url.searchParams.get('code'));
        if (!code) return reply({ error: 'Bad lobby code' }, 400);
        return env.LOBBY.get(env.LOBBY.idFromName(code)).fetch(new Request('https://do/ws?code=' + code, request));
      }

      let user;
      try { user = await authenticate(request, env); } catch (e) { return reply({ error: 'Please sign in again.', detail: String(e.message || e) }, 401); }

      if (path === '/api/vector/profile') {
        if (!env.PROFILES) return reply({ error: 'Cloud profiles are not enabled on this server.' }, 501);
        const key = 'profile:' + user.uid;
        if (request.method === 'GET') { const v = await env.PROFILES.get(key); return reply({ profile: v ? JSON.parse(v) : null }); }
        if (request.method === 'PUT') {
          const body = await request.json().catch(() => null);
          if (!body || typeof body !== 'object') return reply({ error: 'Bad profile' }, 400);
          const clean = sanitizeProfile(body);
          const raw = JSON.stringify(clean);
          if (raw.length > 20000) return reply({ error: 'Profile too large' }, 413);
          await env.PROFILES.put(key, raw);
          return reply({ ok: true });
        }
        return reply({ error: 'Method not allowed' }, 405);
      }

      const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
      const call = (code, sub, payload) => env.LOBBY.get(env.LOBBY.idFromName(code)).fetch('https://do/' + sub, {
        method: 'POST', body: JSON.stringify({ ...payload, user }), headers: { 'content-type': 'application/json' } });
      const pass = async (res) => new Response(res.body, { status: res.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors } });

      if (path === '/api/vector/lobby/create' && request.method === 'POST') {
        for (let i = 0; i < 6; i++) {
          const code = makeCode();
          const res = await call(code, 'init', { code, config: body, profile: sanitizeProfile(body.profile || {}) });
          if (res.status !== 409) return pass(res);
        }
        return reply({ error: 'Could not allocate a lobby code. Try again.' }, 503);
      }
      const code = normaliseCode(body.code || url.searchParams.get('code'));
      if (!code) return reply({ error: 'Enter a lobby code like BLK-7F2K.' }, 400);
      if (path === '/api/vector/lobby/join' && request.method === 'POST') return pass(await call(code, 'peek', {}));
      if (path === '/api/vector/lobby/leave' && request.method === 'POST') return pass(await call(code, 'leave', {}));
      if (path === '/api/vector/lobby/state') return pass(await call(code, 'peek', {}));
      if (path === '/api/vector/match/start' && request.method === 'POST') return pass(await call(code, 'start', {}));
      if (path === '/api/vector/match/state') return pass(await call(code, 'matchstate', {}));
      return reply({ error: 'Not found' }, 404);
    } catch (e) {
      return json({ error: 'Server error' }, 500, cors);
    }
  },
};

/* Keep only the fields we know about. */
export function sanitizeProfile(p) {
  const level = Math.max(1, Math.min(99, (p.level | 0) || 1));
  return { level, loadout: sanitizeLoadout(p.loadout, level), look: sanitizeLook(p.look, level), name: String(p.name || '').slice(0, 18) };
}

/* ---------------------------------------------------------------
   Durable Object: one instance per lobby code.
   --------------------------------------------------------------- */
export class VectorLobby {
  constructor(state, env) {
    this.state = state; this.env = env;
    this.lobby = null;
    this.timer = null;
    this.last = Date.now();
  }

  startLoop() {
    if (this.timer) return;
    this.last = Date.now();
    this.timer = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      try { this.lobby.tick(dt); } catch (e) { try { this.lobby.abortMatch('Server error'); } catch { /* ignore */ } }
      if (this.lobby.expired()) this.shutdown();
    }, 1000 / NET.tickHz);
  }

  shutdown() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.lobby) { this.lobby.closed = true; for (const m of this.lobby.members.values()) { try { m.conn && m.conn.close(1001, 'Lobby closed'); } catch { /* ignore */ } } }
    this.lobby = null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const r = (obj, s = 200) => json(obj, s);
    if (url.pathname === '/ws') return this.acceptSocket(request, url);
    const body = await request.json().catch(() => ({}));
    const user = body.user;
    if (url.pathname === '/init') {
      if (this.lobby) return r({ error: 'exists' }, 409);
      this.lobby = new Lobby(body.code);
      this.startLoop();
      const c = body.config || {};
      this.lobby.hostUid = user.uid;
      this.lobby.onConfig({ uid: user.uid }, { mode: c.mode, mapId: c.mapId, mission: c.mission, difficulty: c.difficulty });
      return r({ code: body.code, lobby: this.lobby.publicState(), wsPath: '/api/vector/ws?code=' + body.code });
    }
    if (!this.lobby) return r({ error: 'That lobby does not exist or has expired.' }, 404);
    if (url.pathname === '/peek') {
      const l = this.lobby;
      if (!l.members.has(user.uid) && (l.state === 'IN_MATCH' || l.state === 'STARTING')) return r({ error: 'A match is already in progress.' }, 409);
      if (!l.members.has(user.uid) && l.members.size >= l.maxPlayers()) return r({ error: 'This lobby is full.' }, 409);
      return r({ code: l.code, lobby: l.publicState(), wsPath: '/api/vector/ws?code=' + l.code });
    }
    if (url.pathname === '/leave') { this.lobby.leave(user.uid, true); return r({ ok: true }); }
    if (url.pathname === '/start') { this.lobby.handle(user.uid, { t: 'start' }); return r({ lobby: this.lobby.publicState() }); }
    if (url.pathname === '/matchstate') {
      const l = this.lobby;
      return r({ state: l.state, result: l.sim ? l.sim.result : null, time: l.sim ? Math.round(l.sim.time) : 0, teamScore: l.sim ? l.sim.teamScore.slice(0, 2) : [0, 0] });
    }
    return r({ error: 'Not found' }, 404);
  }

  acceptSocket(request) {
    if (!this.lobby) return new Response('Lobby not found', { status: 404 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    let uid = null;
    const conn = { send: (s) => server.send(s), close: (c, why) => { try { server.close(c, why); } catch { /* ignore */ } } };
    const kill = setTimeout(() => { if (!uid) conn.close(4401, 'Auth timeout'); }, 8000);
    server.addEventListener('message', async (ev) => {
      let msg;
      try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ''); } catch { return; }
      if (!uid) {
        if (msg.t !== 'auth') return;
        let user;
        try { user = await authenticate({ headers: new Headers() }, this.env, msg.token); } catch { conn.close(4401, 'Sign in required'); return; }
        clearTimeout(kill);
        if (!this.lobby) { conn.close(4404, 'Lobby closed'); return; }
        const prof = sanitizeProfile(msg.profile || {});
        const res = this.lobby.join(conn, { uid: user.uid, name: user.name || prof.name, level: prof.level, loadout: prof.loadout, look: prof.look });
        if (!res.ok) { conn.send(JSON.stringify({ t: 'error', code: 'join', msg: res.error })); conn.close(4409, res.error); return; }
        uid = user.uid;
        return;
      }
      if (this.lobby) this.lobby.handle(uid, msg);
    });
    const gone = () => { clearTimeout(kill); if (this.lobby && uid) this.lobby.disconnect(conn); };
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }
}
