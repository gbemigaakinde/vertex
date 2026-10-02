/* ============================================================
   vector/multiplayer.js  |  Browser side of multiplayer.
   REST for create/join/state, WebSocket for realtime play.
   The client only ever sends INPUT and lobby requests. The server owns
   positions, damage, ammo, score and objectives.
   ============================================================ */
import { normaliseCode } from './lobbycode.js';

const FATAL = new Set([1000, 4001, 4003, 4401, 4404, 4409]);

export class NetClient {
  constructor({ apiBase, getToken, getProfile, onMessage, onState }) {
    this.apiBase = (apiBase || '').replace(/\/$/, '');
    this.getToken = getToken; this.getProfile = getProfile || (() => ({}));
    this.onMessage = onMessage || (() => {}); this.onState = onState || (() => {});
    this.ws = null; this.code = null; this.want = false; this.retry = 0; this.timers = new Set();
    this.rtt = 0; this.status = 'idle'; this.authed = false; this.pingT = null; this.lastMsg = 0; this.dead = false;
  }

  get configured() { return !!this.apiBase; }
  _set(s, extra) { this.status = s; this.onState(s, extra); }
  _timer(fn, ms) { const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms); this.timers.add(t); return t; }

  async api(path, method = 'GET', body) {
    if (!this.configured) throw new Error('Multiplayer server is not set up yet. Add its address in vector/config.js (API_BASE).');
    let token;
    try { token = await this.getToken(); } catch { throw new Error('Please sign in to Vertex to play online.'); }
    if (!token) throw new Error('Please sign in to Vertex to play online.');
    let res;
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 10000);
    try {
      res = await fetch(this.apiBase + path, { method, headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal });
    } catch (e) { throw new Error(e && e.name === 'AbortError' ? 'The server took too long to answer.' : 'Could not reach the multiplayer server. Check your connection.'); }
    finally { clearTimeout(to); }
    let data = {}; try { data = await res.json(); } catch { /* non json */ }
    if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
    return data;
  }

  async create(cfg) { const d = await this.api('/api/vector/lobby/create', 'POST', { ...cfg, profile: this.getProfile() }); await this.connect(d.code); return d; }
  async join(codeRaw) {
    const code = normaliseCode(codeRaw); if (!code) throw new Error('Enter a lobby code like BLK-7F2K.');
    const d = await this.api('/api/vector/lobby/join', 'POST', { code }); await this.connect(code); return d;
  }

  /* Open the socket and resolve when the server accepts us. */
  connect(code) {
    this.code = code; this.want = true; this.retry = 0;
    return new Promise((resolve, reject) => { this._open(resolve, reject); });
  }

  _open(resolve, reject) {
    this._set(this.retry ? 'reconnecting' : 'connecting');
    const url = this.apiBase.replace(/^http/, 'ws') + '/api/vector/ws?code=' + encodeURIComponent(this.code);
    let ws;
    try { ws = new WebSocket(url); } catch (e) { return reject && reject(new Error('Could not open a connection.')); }
    this.ws = ws; this.authed = false;
    let settled = false;
    const done = (err) => { if (settled) return; settled = true; if (err) reject && reject(err); else resolve && resolve(); };
    const guard = this._timer(() => { if (!this.authed) { try { ws.close(); } catch { /* ignore */ } done(new Error('Connection timed out.')); } }, 10000);
    ws.onopen = async () => {
      try { const token = await this.getToken(); ws.send(JSON.stringify({ t: 'auth', token, profile: this.getProfile() })); }
      catch { try { ws.close(4401); } catch { /* ignore */ } done(new Error('Please sign in to play online.')); }
    };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      this.lastMsg = performance.now();
      if (m.t === 'joined') { this.authed = true; this.retry = 0; this._set('online'); this._startPing(); clearTimeout(guard); done(); }
      if (m.t === 'pong') { this.rtt = Math.round(performance.now() - m.c); return; }
      if (m.t === 'error' && !this.authed) { done(new Error(m.msg || 'Could not join.')); }
      this.onMessage(m);
    };
    ws.onclose = (ev) => {
      clearTimeout(guard); this._stopPing(); this.authed = false;
      if (ws !== this.ws) return;
      if (!settled) { done(new Error(ev.reason || 'Could not join this lobby.')); }
      if (!this.want) { this._set('idle'); return; }
      if (FATAL.has(ev.code) || this.retry >= 8) {
        this.want = false; this._set('closed', { code: ev.code, reason: ev.reason });
        this.onMessage({ t: 'closed', code: ev.code, reason: ev.reason || (ev.code === 4001 ? 'You signed in from another place.' : 'Connection lost.') });
        return;
      }
      this.retry++;
      this._timer(() => { if (this.want) this._open(null, null); }, Math.min(6000, 400 * 2 ** this.retry));
    };
    ws.onerror = () => { /* onclose follows */ };
  }

  _startPing() { this._stopPing(); this.pingT = setInterval(() => { this.send({ t: 'ping', c: performance.now() }); if (performance.now() - this.lastMsg > 8000 && this.ws) { try { this.ws.close(4000, 'stale'); } catch { /* ignore */ } } }, 2000); }
  _stopPing() { if (this.pingT) { clearInterval(this.pingT); this.pingT = null; } }

  send(msg) { if (this.ws && this.ws.readyState === 1 && this.authed) { this.ws.send(JSON.stringify(msg)); return true; } return false; }
  sendInput(cmds) { return this.send({ t: 'input', c: cmds }); }

  async leave() {
    const code = this.code; this.want = false;
    this.send({ t: 'leave' });
    this.close();
    void code;
  }

  close() {
    this.want = false; this._stopPing();
    for (const t of this.timers) clearTimeout(t); this.timers.clear();
    if (this.ws) { const w = this.ws; this.ws = null; w.onclose = null; w.onmessage = null; w.onerror = null; w.onopen = null; try { w.close(1000, 'bye'); } catch { /* ignore */ } }
    this.authed = false; this._set('idle');
  }
  dispose() { this.dead = true; this.close(); }
}
