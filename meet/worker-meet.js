/* ============================================================
   meet/worker-meet.js — Vertex Live Meetings API (LiveKit)
   POST /meet/op  { action, ... }   (Firebase ID token required)

   POST /meet/upload?id&seq   raw video chunk from the teacher's browser (recording)
   GET  /meet/stream?id&e&s   signed, streams the recorded chunks as one video (replay)
   Recording is done in the teacher's browser and saved to B2, so it does NOT use
   LiveKit's recording quota.
   Teacher only : audience, create, update, cancel, start, end, rec-start,
                  rec-stop, mute-all, kick, code, allow
   Everyone     : list, join, replay, replays, find-code (join with a meeting code)
   Access is decided server-side from the verified uid:
     - teacher = env.TEACHER_UID
     - student sees a meeting only if it targets "all", their class, or their uid

   Secrets (wrangler secret put): LIVEKIT_API_KEY, LIVEKIT_API_SECRET
                                  LIVEKIT_URL  e.g. wss://xxxx.livekit.cloud (also a Secret)
   Recordings go to the existing B2 bucket (B2_* secrets) under meetings/.
   ============================================================ */

const FS = 'https://firestore.googleapis.com/v1/projects/excellencecbt/databases/(default)/documents';
const H = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
const out = (d, s) => new Response(JSON.stringify(d), { status: s || 200, headers: H });

/* ── Firestore encode helpers ── */
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  const f = {}; Object.keys(v).forEach(k => { f[k] = enc(v[k]); });
  return { mapValue: { fields: f } };
}
const encFields = o => { const f = {}; Object.keys(o).forEach(k => { f[k] = enc(o[k]); }); return f; };

function makeDb(token, decode) {
  const a = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  return {
    async get(path) {
      const r = await fetch(FS + '/' + path, { headers: a });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('Database read failed.');
      const j = await r.json();
      return Object.assign({ _id: path.split('/').pop() }, decode(j.fields || {}));
    },
    async list(col, max) {
      const rows = []; let page = '';
      do {
        const r = await fetch(FS + '/' + col + '?pageSize=300' + (page ? '&pageToken=' + page : ''), { headers: a });
        if (!r.ok) throw new Error('Database list failed.');
        const j = await r.json();
        (j.documents || []).forEach(d => rows.push(Object.assign({ _id: d.name.split('/').pop() }, decode(d.fields || {}))));
        page = j.nextPageToken || '';
      } while (page && rows.length < (max || 1500));
      return rows;
    },
    async create(col, id, data) {
      const r = await fetch(FS + '/' + col + '?documentId=' + encodeURIComponent(id), { method: 'POST', headers: a, body: JSON.stringify({ fields: encFields(data) }) });
      if (!r.ok) throw new Error('Database write failed.');
    },
    async patch(path, data) {
      const mask = Object.keys(data).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
      const r = await fetch(FS + '/' + path + '?' + mask, { method: 'PATCH', headers: a, body: JSON.stringify({ fields: encFields(data) }) });
      if (!r.ok) throw new Error('Database update failed.');
    },
  };
}

/* ── LiveKit JWT (HS256) and server API ── */
const b64u = b => btoa(String.fromCharCode.apply(null, new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64s = s => b64u(new TextEncoder().encode(s));

async function lkToken(env, claims, ttl) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64s(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64s(JSON.stringify(Object.assign({ iss: env.LIVEKIT_API_KEY, nbf: now, exp: now + (ttl || 3600) }, claims)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.LIVEKIT_API_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(head + '.' + body));
  return head + '.' + body + '.' + b64u(sig);
}

async function lkApi(env, svc, method, payload, grant) {
  const tok = await lkToken(env, { video: grant }, 300);
  const base = env.LIVEKIT_URL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/$/, '');
  const r = await fetch(base + '/twirp/livekit.' + svc + '/' + method, {
    method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const t = await r.text();
  if (!r.ok) throw new Error('Meeting server error (' + r.status + ').');
  try { return JSON.parse(t); } catch (e) { return {}; }
}

/* ── Access rules ── */
const clsKey = s => String(s || '').replace(/\s+/g, '').toLowerCase();

function canAccess(m, uid, isTeacher, cls) {
  if (isTeacher) return true;
  const a = m.audience || {};
  if (a.type === 'all') return true;
  if (a.type === 'classes') return (a.classes || []).map(clsKey).indexOf(clsKey(cls)) !== -1 && !!cls;
  if (a.type === 'students') return (a.students || []).indexOf(uid) !== -1;
  return false;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
function newCode() {
  const a = new Uint8Array(8); crypto.getRandomValues(a);
  return Array.from(a).map(n => CODE_CHARS[n % CODE_CHARS.length]).join('');
}

function pub(m, isTeacher) {
  const o = { id: m._id, title: m.title, description: m.description || '', startsAt: m.startsAt, durationMin: m.durationMin,
    status: m.status, audience: m.audience || {}, recordingEnabled: !!m.recordingEnabled,
    recording: m.recStatus || 'none', hasReplay: !!(m.replayKey && m.recChunks > 0), endedAt: m.endedAt || null };
  if (!isTeacher) o.audience = { type: o.audience.type }; else o.code = m.code || '';
  return o;
}

const MAX_CHUNKS = 40; // 40 x 4 min = 160 min per meeting (keeps replay under Worker subrequest limits)
async function sign(env, id, exp) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('vtx-meet:' + env.LIVEKIT_API_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(id + '.' + exp)));
}
const EXTS = { webm: 'video/webm', mp4: 'video/mp4' };
const chunkKey = (id, i, ext) => 'meetings/' + id + '/rec/' + String(i).padStart(5, '0') + '.' + (EXTS[ext] ? ext : 'webm');
const parseSizes = s => String(s || '').split(',').map(x => parseInt(x, 10) || 0);

/* HTTP Range planning. iPhones/Safari will not play a video unless the server answers byte-range requests. */
export function planRange(total, header) {
  const full = { status: 200, start: 0, end: total - 1 };
  const mm = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim());
  if (!mm || (mm[1] === '' && mm[2] === '')) return full;
  let start, end;
  if (mm[1] === '') { start = Math.max(0, total - parseInt(mm[2], 10)); end = total - 1; }
  else { start = parseInt(mm[1], 10); end = mm[2] === '' ? total - 1 : Math.min(parseInt(mm[2], 10), total - 1); }
  if (!(start < total) || start > end) return { status: 416 };
  return { status: 206, start: start, end: end };
}

/* Streams bytes [start..end] of the virtual file made of all chunks back-to-back.
   fetchChunk(i, rangeHeaderOrNull) must return a fetch Response for that chunk. */
export function serveRange(sizes, ext, rangeHeader, fetchChunk) {
  const total = sizes.reduce((a, b) => a + b, 0);
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges' };
  const plan = planRange(total, rangeHeader);
  if (plan.status === 416) return new Response('Range not satisfiable', { status: 416, headers: Object.assign({ 'Content-Range': 'bytes */' + total }, cors) });
  const len = plan.end - plan.start + 1;
  const headers = Object.assign({ 'Content-Type': EXTS[ext] || 'video/webm', 'Accept-Ranges': 'bytes', 'Content-Length': String(len), 'Cache-Control': 'private, max-age=3600' }, cors);
  if (plan.status === 206) headers['Content-Range'] = 'bytes ' + plan.start + '-' + plan.end + '/' + total;
  const ts = (typeof FixedLengthStream !== 'undefined') ? new FixedLengthStream(len) : new TransformStream();
  (async () => {
    const w = ts.writable.getWriter();
    try {
      let off = 0;
      for (let i = 0; i < sizes.length && off <= plan.end; i++) {
        const a = off, b = off + sizes[i] - 1; off += sizes[i];
        if (!sizes[i] || b < plan.start) continue;
        const s0 = Math.max(plan.start, a) - a, e0 = Math.min(plan.end, b) - a, whole = s0 === 0 && e0 === sizes[i] - 1;
        const r = await fetchChunk(i, whole ? null : 'bytes=' + s0 + '-' + e0);
        if (!r.ok || !r.body) throw new Error('chunk ' + i);
        if (!whole && r.status === 200) { const buf = new Uint8Array(await r.arrayBuffer()); await w.write(buf.slice(s0, e0 + 1)); }
        else { const rd = r.body.getReader(); for (;;) { const x = await rd.read(); if (x.done) break; await w.write(x.value); } }
      }
      await w.close();
    } catch (err) { try { await w.abort(err); } catch (e2) { /* client went away */ } }
  })();
  return new Response(ts.readable, { status: plan.status, headers: headers });
}

/* Chunk sizes are saved on upload. Older recordings don't have them: ask storage once, then save. */
async function chunkSizes(m, id, n, ext, env, h, db) {
  const sizes = parseSizes(m.recSizes).slice(0, n); while (sizes.length < n) sizes.push(0);
  let fixed = false;
  for (let i = 0; i < n; i++) {
    if (sizes[i]) continue;
    try {
      const r = await fetch(await h.b2PresignGet(chunkKey(id, i, ext), env), { headers: { Range: 'bytes=0-0' } });
      const cr = r.headers.get('Content-Range'), t = cr ? parseInt(cr.split('/')[1], 10) : parseInt(r.headers.get('Content-Length'), 10);
      try { await r.body.cancel(); } catch (e) { /* ignore */ }
      if (r.ok && t > 0) { sizes[i] = t; fixed = true; }
    } catch (e) { /* missing chunk: skipped */ }
  }
  if (fixed) { try { await db.patch('meetings/' + id, { recSizes: sizes.join(',') }); } catch (e) { /* ignore */ } }
  return sizes;
}

/* GET /meet/stream — all chunks back-to-back as one video, with Range support (needed by iPhone) */
export async function handleMeetStream(request, url, env, h) {
  const bad = (m, st) => new Response(m, { status: st, headers: { 'Access-Control-Allow-Origin': '*' } });
  const id = url.searchParams.get('id') || '', e = parseInt(url.searchParams.get('e'), 10) || 0, sg = url.searchParams.get('s') || '';
  if (!/^[A-Za-z0-9]{6,40}$/.test(id) || e < Date.now() || !env.LIVEKIT_API_SECRET) return bad('Link expired.', 403);
  if ((await sign(env, id, e)) !== sg) return bad('Invalid link.', 403);
  const tok = await h.getFirebaseToken(env), db = makeDb(tok, h.fsDecodeFields);
  const m = await db.get('meetings/' + id);
  const n = m ? Math.min(m.recChunks || 0, MAX_CHUNKS) : 0;
  if (!n) return bad('No recording.', 404);
  const ext = EXTS[m.recExt] ? m.recExt : 'webm';
  const sizes = await chunkSizes(m, id, n, ext, env, h, db);
  if (!sizes.some(x => x > 0)) return bad('No recording.', 404);
  return serveRange(sizes, ext, request.headers.get('Range'), async (i, range) => fetch(await h.b2PresignGet(chunkKey(id, i, ext), env), range ? { headers: { Range: range } } : undefined));
}

const cleanStr = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

export async function handleMeet(request, env, h, verifyIdToken) {
  const user = await verifyIdToken(request);
  if (!user) return out({ error: 'Please sign in again.' }, 401);
  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) return out({ error: 'Live meetings are not configured yet (LiveKit keys missing).' }, 503);
  const url = new URL(request.url);
  const isUpload = url.pathname === '/meet/upload';
  let b = {};
  if (!isUpload) { try { b = await request.json(); } catch (e) { return out({ error: 'Invalid request.' }, 400); } }
  const isTeacher = !!env.TEACHER_UID && user.uid === env.TEACHER_UID;
  const tok = await h.getFirebaseToken(env);
  if (!tok) return out({ error: 'Database access is not configured.' }, 500);
  const db = makeDb(tok, h.fsDecodeFields);
  if (isUpload) {
    if (!isTeacher) return out({ error: 'Only the teacher can upload recordings.' }, 403);
    const uid = url.searchParams.get('id') || '', seq = parseInt(url.searchParams.get('seq'), 10);
    if (!/^[A-Za-z0-9]{6,40}$/.test(uid) || !(seq >= 0 && seq < MAX_CHUNKS)) return out({ error: 'Invalid chunk.' }, 400);
    const mt = await db.get('meetings/' + uid);
    if (!mt || mt.status !== 'live') return out({ error: 'Meeting is not live.' }, 400);
    const wantExt = url.searchParams.get('ext') === 'mp4' ? 'mp4' : 'webm';
    if (mt.recExt && mt.recChunks > 0 && mt.recExt !== wantExt) return out({ error: 'Recording format cannot change mid-meeting.' }, 409);
    const ext = wantExt;
    const buf = await request.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 40 * 1024 * 1024) return out({ error: 'Invalid size.' }, 413);
    const put = await fetch(await h.b2PresignPut(chunkKey(uid, seq, ext), EXTS[ext], env), { method: 'PUT', headers: { 'Content-Type': EXTS[ext] }, body: buf });
    if (!put.ok) return out({ error: 'Storage error (' + put.status + ').' }, 502);
    const szs = parseSizes(mt.recSizes); while (szs.length <= seq) szs.push(0); szs[seq] = buf.byteLength;
    await db.patch('meetings/' + uid, { replayKey: 'meetings/' + uid + '/rec/', recChunks: Math.max(mt.recChunks || 0, seq + 1), recStatus: 'recording', recExt: ext, recSizes: szs.join(',') });
    return out({ ok: true });
  }
  const act = String(b.action || '');
  const TEACHER_ONLY = ['audience', 'create', 'update', 'cancel', 'start', 'end', 'rec-start', 'rec-stop', 'mute-all', 'kick', 'code', 'allow'];
  if (TEACHER_ONLY.indexOf(act) !== -1 && !isTeacher) return out({ error: 'Only the teacher can do that.' }, 403);

  try {
    let profile = null;
    if (!isTeacher) profile = await db.get('students/' + user.uid);
    const cls = profile && profile.class || '';
    const name = isTeacher ? 'Master Timothy' : cleanStr(profile && profile.name || 'Student', 60);

    if (act === 'audience') {
      const rows = await db.list('students', 2000);
      const classes = {}; const students = [];
      rows.forEach(s => { if (s.class) classes[s.class] = (classes[s.class] || 0) + 1; students.push({ uid: s._id, name: s.name || 'Student', class: s.class || '' }); });
      students.sort((a, c) => String(a.name).localeCompare(String(c.name)));
      return out({ classes: Object.keys(classes).sort().map(k => ({ name: k, count: classes[k] })), students: students });
    }

    if (act === 'create' || act === 'update') {
      const title = cleanStr(b.title, 120);
      const startsAt = Number(b.startsAt);
      const aud = b.audience || {};
      if (!title) return out({ error: 'Give the meeting a title.' }, 400);
      if (!startsAt || isNaN(startsAt)) return out({ error: 'Pick a start time.' }, 400);
      const audience = { type: ['all', 'classes', 'students'].indexOf(aud.type) !== -1 ? aud.type : 'classes', classes: [], students: [] };
      if (audience.type === 'classes') audience.classes = (aud.classes || []).slice(0, 40).map(x => cleanStr(x, 40)).filter(Boolean);
      if (audience.type === 'students') audience.students = (aud.students || []).slice(0, 500).map(x => cleanStr(x, 80)).filter(Boolean);
      if (audience.type === 'classes' && !audience.classes.length) return out({ error: 'Select at least one class.' }, 400);
      if (audience.type === 'students' && !audience.students.length) return out({ error: 'Select at least one student.' }, 400);
      const data = { title: title, description: cleanStr(b.description, 500), startsAt: startsAt,
        durationMin: Math.max(5, Math.min(480, parseInt(b.durationMin, 10) || 60)), audience: audience, recordingEnabled: b.recordingEnabled !== false };
      if (act === 'create') {
        const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const code = newCode();
        await db.create('meetings', id, Object.assign(data, { code: code, teacherUid: user.uid, status: 'scheduled', roomName: 'vtx-' + id, createdAt: new Date() }));
        return out({ ok: true, id: id, code: code });
      }
      const m = await db.get('meetings/' + b.id); if (!m) return out({ error: 'Meeting not found.' }, 404);
      if (m.status === 'ended' || m.status === 'cancelled') return out({ error: 'This meeting is already over.' }, 400);
      await db.patch('meetings/' + b.id, data);
      return out({ ok: true });
    }

    if (act === 'list') {
      const rows = await db.list('meetings', 500);
      const mine = rows.filter(m => m.status !== 'cancelled' && canAccess(m, user.uid, isTeacher, cls))
        .sort((a, c) => (c.startsAt || 0) - (a.startsAt || 0)).map(m => pub(m, isTeacher));
      return out({ meetings: mine, role: isTeacher ? 'teacher' : 'student' });
    }

    if (act === 'replays') {
      const rows = await db.list('meetings', 500);
      const list = rows.filter(x => x.replayKey && x.recChunks > 0 && (x.status === 'ended') && canAccess(x, user.uid, isTeacher, cls))
        .sort((a, c) => (c.startsAt || 0) - (a.startsAt || 0)).map(x => pub(x, isTeacher));
      return out({ replays: list });
    }

    if (act === 'find-code') {
      const code = normCode(b.code);
      if (code.length < 6) return out({ error: 'Enter the full meeting code.' }, 400);
      const rows = await db.list('meetings', 500);
      const hit = rows.filter(x => x.code === code && x.status !== 'cancelled')[0];
      if (!hit) return out({ error: 'No meeting found with that code. Check it and try again.' }, 404);
      if (hit.status === 'ended') return out({ error: 'That meeting has already ended.' }, 400);
      return out({ meeting: pub(hit, false) });
    }

    if (!b.id) return out({ error: 'Missing meeting.' }, 400);
    const m = await db.get('meetings/' + cleanStr(b.id, 80));
    if (!m) return out({ error: 'Meeting not found.' }, 404);
    const viaCode = act === 'join' && !!m.code && normCode(b.code) === m.code;
    if (!viaCode && !canAccess(m, user.uid, isTeacher, cls)) return out({ error: 'You are not invited to this meeting. Ask your teacher for the meeting code.' }, 403);

    if (act === 'code') {
      let c = m.code;
      if (!c) { c = newCode(); await db.patch('meetings/' + m._id, { code: c }); }
      return out({ code: c });
    }

    if (act === 'cancel') { await db.patch('meetings/' + m._id, { status: 'cancelled' }); return out({ ok: true }); }

    if (act === 'start') {
      if (m.status === 'ended' || m.status === 'cancelled') return out({ error: 'This meeting is over.' }, 400);
      if (m.status !== 'live') await db.patch('meetings/' + m._id, { status: 'live', startedAt: new Date() });
      return out({ ok: true });
    }

    if (act === 'join') {
      if (m.status === 'cancelled' || m.status === 'ended') return out({ error: 'This meeting has ended.' }, 400);
      if (!isTeacher && m.status !== 'live') return out({ error: 'waiting', message: 'The teacher has not started the meeting yet.' }, 409);
      // Classroom mode: only the teacher sends video/audio. Students just watch (one stream each),
      // chat and raise a hand; the teacher can allow a student to speak with the 'allow' action.
      const grant = { room: m.roomName, roomJoin: true, canSubscribe: true, canPublish: !!isTeacher, canPublishData: true };
      if (isTeacher) { grant.roomAdmin = true; grant.roomRecord = true; }
      const token = await lkToken(env, { sub: user.uid, name: name, metadata: JSON.stringify({ role: isTeacher ? 'teacher' : 'student', cls: cls }), video: grant }, 4 * 3600);
      return out({ token: token, url: env.LIVEKIT_URL, room: m.roomName, name: name, role: isTeacher ? 'teacher' : 'student', canPublish: !!isTeacher,
        recording: m.recStatus === 'recording', title: m.title });
    }

    if (act === 'rec-start') {
      if (m.status !== 'live') return out({ error: 'Start the meeting first.' }, 400);
      await db.patch('meetings/' + m._id, { recStatus: 'recording' });
      return out({ ok: true });
    }

    if (act === 'rec-stop') {
      await db.patch('meetings/' + m._id, { recStatus: m.recChunks > 0 ? 'ready' : 'none' });
      return out({ ok: true });
    }

    if (act === 'end') {
      try { await lkApi(env, 'RoomService', 'DeleteRoom', { room: m.roomName }, { roomCreate: true }); } catch (e) { /* room may be empty */ }
      await db.patch('meetings/' + m._id, { status: 'ended', endedAt: new Date(), recStatus: m.recChunks > 0 ? 'ready' : 'none' });
      return out({ ok: true });
    }

    if (act === 'mute-all') {
      const ps = await lkApi(env, 'RoomService', 'ListParticipants', { room: m.roomName }, { roomAdmin: true, room: m.roomName });
      let n = 0;
      for (const p of (ps.participants || [])) {
        if (p.identity === user.uid) continue;
        for (const t of (p.tracks || [])) {
          if (t.type === 'AUDIO' || t.type === 0) { await lkApi(env, 'RoomService', 'MutePublishedTrack', { room: m.roomName, identity: p.identity, track_sid: t.sid, muted: true }, { roomAdmin: true, room: m.roomName }); n++; }
        }
      }
      return out({ ok: true, muted: n });
    }

    if (act === 'allow') {
      const id = cleanStr(b.identity, 128);
      if (!id || id === user.uid) return out({ error: 'Invalid participant.' }, 400);
      await lkApi(env, 'RoomService', 'UpdateParticipant', { room: m.roomName, identity: id, permission: { can_subscribe: true, can_publish: !!b.on, can_publish_data: true } }, { roomAdmin: true, room: m.roomName });
      return out({ ok: true });
    }

    if (act === 'kick') {
      const id = cleanStr(b.identity, 128);
      if (!id || id === user.uid) return out({ error: 'Invalid participant.' }, 400);
      await lkApi(env, 'RoomService', 'RemoveParticipant', { room: m.roomName, identity: id }, { roomAdmin: true, room: m.roomName });
      return out({ ok: true });
    }

    if (act === 'replay') {
      if (!m.replayKey || !(m.recChunks > 0)) return out({ error: 'No recording for this meeting.' }, 404);
      const exp = Date.now() + 6 * 3600 * 1000;
      return out({ url: url.origin + '/meet/stream?id=' + encodeURIComponent(m._id) + '&e=' + exp + '&s=' + (await sign(env, m._id, exp)), title: m.title, mime: EXTS[m.recExt] || 'video/webm' });
    }

    return out({ error: 'Unknown action.' }, 400);
  } catch (e) {
    return out({ error: (e && e.message) || 'Something went wrong.' }, 500);
  }
}
