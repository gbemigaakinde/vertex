/* ============================================================
   worker-files.js — authenticated file API for Vertex
   Imported by worker.js. Handles:
     /storage/quota            daily upload status
     /storage/presign-upload   batch presign + atomic daily quota
     /storage/commit           verify object, write metadata
     /storage/release          release quota for failed uploads
     /storage/presign-download authorised download URL
   /storage/view             authorised in-app streaming (viewer)
   file.info / review.set / comment.*  viewer metadata + feedback threads
     /storage/delete           authorised delete (ref-count safe)
     /files/op                 folders, collections, moves
   Every route requires a Firebase ID token. Role is derived from
   the verified uid (env.TEACHER_UID), never from the client.
   ============================================================ */

const FS = 'https://firestore.googleapis.com/v1/projects/excellencecbt/databases/(default)/documents';
const PROJECT_ID = 'excellencecbt';

const STUDENT_DAILY_LIMIT = 50;
const STUDENT_MAX_FILE_MB = 20;
const STUDENT_MAX_VIDEO_MB = 30;
const STUDENT_BATCH_MAX = 50;
const TEACHER_BATCH_MAX = 200;
const MAX_FOLDER_DEPTH = 50;

const STUDENT_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'mkv', 'avi'];
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'mkv', 'avi'];

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: CORS });
}
function fail(message, status) {
  return json({ error: message }, status || 400);
}

/* ── Firebase ID token verification (RS256 via Google JWKS) ── */
let _jwks = null;
let _jwksAt = 0;

function _b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function _getJwks() {
  if (_jwks && Date.now() - _jwksAt < 3600 * 1000) return _jwks;
  const res = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!res.ok) throw new Error('Could not load signing keys.');
  _jwks = (await res.json()).keys || [];
  _jwksAt = Date.now();
  return _jwks;
}

async function verifyIdToken(request) {
  const h = request.headers.get('Authorization') || '';
  const token = h.indexOf('Bearer ') === 0 ? h.slice(7) : '';
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const dec = new TextDecoder();
    const header = JSON.parse(dec.decode(_b64urlToBytes(parts[0])));
    const payload = JSON.parse(dec.decode(_b64urlToBytes(parts[1])));
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'RS256') return null;
    if (payload.aud !== PROJECT_ID) return null;
    if (payload.iss !== 'https://securetoken.google.com/' + PROJECT_ID) return null;
    if (!payload.sub || payload.exp < now || payload.iat > now + 300) return null;
    const keys = await _getJwks();
    const jwk = keys.find(function (k) { return k.kid === header.kid; });
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key,
      _b64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    return ok ? { uid: payload.sub } : null;
  } catch (e) {
    return null;
  }
}

/* ── Firestore REST (service account token supplied by worker.js) ── */
function _enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(_enc) } };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  return { mapValue: { fields: _encFields(v) } };
}
function _encFields(obj) {
  const out = {};
  Object.keys(obj).forEach(function (k) { out[k] = _enc(obj[k]); });
  return out;
}

function makeDb(token, decodeFields) {
  const auth = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
  return {
    async get(path) {
      const res = await fetch(FS + '/' + path, { headers: auth });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Database read failed.');
      const j = await res.json();
      return Object.assign({ _id: path.split('/').pop() }, decodeFields(j.fields || {}));
    },
    async create(col, id, data) {
      const res = await fetch(FS + '/' + col + (id ? '?documentId=' + encodeURIComponent(id) : ''), {
        method: 'POST', headers: auth, body: JSON.stringify({ fields: _encFields(data) }),
      });
      if (res.status === 409) return { exists: true, id: id };
      if (!res.ok) throw new Error('Database write failed.');
      const j = await res.json();
      return { exists: false, id: j.name.split('/').pop() };
    },
    async patch(path, data) {
      const mask = Object.keys(data).map(function (k) { return 'updateMask.fieldPaths=' + encodeURIComponent(k); }).join('&');
      const res = await fetch(FS + '/' + path + '?' + mask, {
        method: 'PATCH', headers: auth, body: JSON.stringify({ fields: _encFields(data) }),
      });
      if (!res.ok) throw new Error('Database update failed.');
    },
    async del(path) {
      const res = await fetch(FS + '/' + path, { method: 'DELETE', headers: auth });
      if (!res.ok && res.status !== 404) throw new Error('Database delete failed.');
    },
    async where(col, field, value, selectFields) {
      const sq = {
        from: [{ collectionId: col }],
        where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: _enc(value) } },
      };
      if (selectFields) sq.select = { fields: selectFields.map(function (f) { return { fieldPath: f }; }) };
      const res = await fetch(FS + ':runQuery', { method: 'POST', headers: auth, body: JSON.stringify({ structuredQuery: sq }) });
      if (!res.ok) throw new Error('Database query failed.');
      const rows = await res.json();
      const out = [];
      rows.forEach(function (r) {
        if (!r.document) return;
        out.push(Object.assign({ _id: r.document.name.split('/').pop() }, decodeFields(r.document.fields || {})));
      });
      return out;
    },
    async all(col, selectFields) {
      const sq = { from: [{ collectionId: col }] };
      if (selectFields) sq.select = { fields: selectFields.map(function (f) { return { fieldPath: f }; }) };
      const res = await fetch(FS + ':runQuery', { method: 'POST', headers: auth, body: JSON.stringify({ structuredQuery: sq }) });
      if (!res.ok) throw new Error('Database query failed.');
      const rows = await res.json();
      const out = [];
      rows.forEach(function (r) {
        if (!r.document) return;
        out.push(Object.assign({ _id: r.document.name.split('/').pop() }, decodeFields(r.document.fields || {})));
      });
      return out;
    },
  };
}

/* ── Atomic daily quota (Durable Object, one per student) ── */
export class UploadQuota {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const b = await request.json();
    let rec = (await this.state.storage.get('rec')) || { day: b.day, keys: [] };
    if (rec.day !== b.day) rec = { day: b.day, keys: [] };
    const keys = b.keys || [];
    if (b.action === 'status') {
      return new Response(JSON.stringify({ ok: true, used: rec.keys.length }));
    }
    if (b.action === 'release') {
      rec.keys = rec.keys.filter(function (k) { return keys.indexOf(k) === -1; });
      await this.state.storage.put('rec', rec);
      return new Response(JSON.stringify({ ok: true, used: rec.keys.length }));
    }
    const have = new Set(rec.keys);
    const fresh = keys.filter(function (k) { return !have.has(k); });
    if (rec.keys.length + fresh.length > b.limit) {
      return new Response(JSON.stringify({ ok: false, used: rec.keys.length }));
    }
    rec.keys = rec.keys.concat(fresh);
    await this.state.storage.put('rec', rec);
    return new Response(JSON.stringify({ ok: true, used: rec.keys.length }));
  }
}

function _today() {
  // Africa/Lagos is UTC+1 year-round
  return new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 10);
}

async function _quota(env, uid, action, keys) {
  if (!env.UPLOAD_QUOTA) throw new Error('Upload quota service is not configured.');
  const stub = env.UPLOAD_QUOTA.get(env.UPLOAD_QUOTA.idFromName(uid));
  const res = await stub.fetch('https://quota/', {
    method: 'POST',
    body: JSON.stringify({ action: action, day: _today(), limit: STUDENT_DAILY_LIMIT, keys: keys || [] }),
  });
  return res.json();
}

/* ── Helpers ── */
function _ext(name) { return (String(name || '').split('.').pop() || '').toLowerCase(); }
function _cleanName(s, max) { return String(s || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max || 120); }
function _keyOk(uid, key) {
  return typeof key === 'string' && key.indexOf('uploads/' + uid + '/') === 0 &&
    /^uploads\/[A-Za-z0-9]+\/[A-Za-z0-9._-]{1,200}$/.test(key) && key.indexOf('..') === -1;
}
function _studentFileError(name, size) {
  const ext = _ext(name);
  if (STUDENT_EXTS.indexOf(ext) === -1) return '"' + name + '": file type not allowed.';
  const isVideo = VIDEO_EXTS.indexOf(ext) !== -1;
  const cap = (isVideo ? STUDENT_MAX_VIDEO_MB : STUDENT_MAX_FILE_MB) * 1024 * 1024;
  if (size > cap) return '"' + name + '" is too large. Maximum is ' + (isVideo ? STUDENT_MAX_VIDEO_MB : STUDENT_MAX_FILE_MB) + ' MB.';
  return null;
}

async function _objectSize(key, helpers, env) {
  const url = await helpers.b2PresignGet(key, env);
  const res = await fetch(url, { headers: { Range: 'bytes=0-0' } });
  if (res.status !== 206 && res.status !== 200) return null;
  const cr = res.headers.get('Content-Range');
  if (cr && cr.indexOf('/') !== -1) return parseInt(cr.split('/')[1], 10);
  const cl = res.headers.get('Content-Length');
  return cl ? parseInt(cl, 10) : null;
}

async function _knownClasses(db) {
  const rows = await db.all('students', ['class']);
  const set = new Set();
  rows.forEach(function (r) { if (r.class) set.add(r.class); });
  return set;
}

function _canSeeFile(d, uid, isTeacher, studentClass) {
  if (isTeacher || d.uploaderUid === uid) return true;
  if (d.expiresAt) {
    const t = Date.parse(d.expiresAt);
    if (!isNaN(t) && t <= Date.now()) return false;
  }
  if (d.sharedWith === 'all') return true;
  if (d.sharedWith === 'student') return d.targetStudentUid === uid;
  if (d.sharedWith === 'class') {
    const cls = (Array.isArray(d.targetClasses) && d.targetClasses.length)
      ? d.targetClasses : [d.targetClass || d.uploaderClass || ''];
    return !!studentClass && cls.indexOf(studentClass) !== -1;
  }
  return false;
}

/* ══════════════════════════════════════════════════════════
   Router
══════════════════════════════════════════════════════════ */
export async function handleFilesApi(request, url, env, helpers) {
  const user = await verifyIdToken(request);
  if (!user) return fail('Please sign in again.', 401);

  let body;
  try { body = await request.json(); } catch (e) { return fail('Invalid JSON.', 400); }

  const isTeacher = !!env.TEACHER_UID && user.uid === env.TEACHER_UID;
  const needsB2 = url.pathname.indexOf('/storage/') === 0 && url.pathname !== '/storage/quota' && url.pathname !== '/storage/release';
  if (needsB2 && (!env.B2_KEY_ID || !env.B2_APP_KEY || !env.B2_BUCKET || !env.B2_ENDPOINT || !env.B2_REGION)) {
    return fail('File storage is not configured.', 500);
  }

  try {
    const token = await helpers.getFirebaseToken(env);
    if (!token) return fail('Server database access is not configured.', 500);
    const db = makeDb(token, helpers.fsDecodeFields);
    const ctx = { uid: user.uid, isTeacher: isTeacher, db: db, env: env, helpers: helpers };

    switch (url.pathname) {
      case '/storage/quota':             return await routeQuota(ctx);
      case '/storage/presign-upload':    return await routePresignUpload(ctx, body);
      case '/storage/commit':            return await routeCommit(ctx, body);
      case '/storage/release':           return await routeRelease(ctx, body);
      case '/storage/presign-download':  return await routePresignDownload(ctx, body);
      case '/storage/view':              return await routeView(ctx, body, request);
      case '/storage/delete':            return await routeDelete(ctx, body);
      case '/files/op':                  return await routeOp(ctx, body);
    }
    return fail('Not found.', 404);
  } catch (e) {
    return fail(e.message || 'Request failed.', 500);
  }
}

async function routeQuota(ctx) {
  if (ctx.isTeacher) return json({ role: 'teacher', unlimited: true, used: 0, limit: null });
  const q = await _quota(ctx.env, ctx.uid, 'status');
  return json({ role: 'student', unlimited: false, used: q.used, limit: STUDENT_DAILY_LIMIT,
    maxFileMB: STUDENT_MAX_FILE_MB, maxVideoMB: STUDENT_MAX_VIDEO_MB });
}

async function routePresignUpload(ctx, body) {
  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length) return fail('No files to upload.');
  const batchMax = ctx.isTeacher ? TEACHER_BATCH_MAX : STUDENT_BATCH_MAX;
  if (files.length > batchMax) return fail('Too many files in one batch. Maximum is ' + batchMax + '.');

  const seen = new Set();
  for (const f of files) {
    if (!_keyOk(ctx.uid, f.key) || seen.has(f.key)) return fail('Invalid upload key.');
    seen.add(f.key);
    if (typeof f.size !== 'number' || f.size < 0) return fail('Invalid file size.');
    if (!ctx.isTeacher) {
      const err = _studentFileError(_cleanName(f.name, 200), f.size);
      if (err) return fail(err, 413);
    }
  }

  let used = 0;
  if (!ctx.isTeacher) {
    const q = await _quota(ctx.env, ctx.uid, 'reserve', files.map(function (f) { return f.key; }));
    used = q.used;
    if (!q.ok) {
      const left = Math.max(0, STUDENT_DAILY_LIMIT - q.used);
      return json({ error: 'Daily limit reached. You can upload ' + STUDENT_DAILY_LIMIT + ' files per day and have ' + left + ' left today.',
        code: 'daily_limit', used: q.used, limit: STUDENT_DAILY_LIMIT }, 429);
    }
  }

  const items = [];
  for (const f of files) {
    const ct = typeof f.type === 'string' && f.type ? f.type.slice(0, 120) : 'application/octet-stream';
    items.push({ key: f.key, url: await ctx.helpers.b2PresignPut(f.key, ct, ctx.env) });
  }
  return json({ items: items, used: used, limit: ctx.isTeacher ? null : STUDENT_DAILY_LIMIT });
}

async function routeRelease(ctx, body) {
  if (ctx.isTeacher) return json({ ok: true });
  const keys = (Array.isArray(body.keys) ? body.keys : []).filter(function (k) { return _keyOk(ctx.uid, k); }).slice(0, 200);
  // Never release keys that already have committed metadata
  const free = [];
  for (const k of keys) {
    const existing = await ctx.db.get('uploads/' + k.split('/').pop());
    if (!existing) free.push(k);
  }
  const q = await _quota(ctx.env, ctx.uid, 'release', free);
  return json({ ok: true, used: q.used });
}

async function _validFolder(ctx, id) {
  if (!id) return null;
  const f = await ctx.db.get('userFolders/' + id);
  if (!f || f.ownerUid !== ctx.uid) throw new Error('That folder was not found.');
  return f;
}
async function _validCollection(ctx, id) {
  if (!id) return null;
  const c = await ctx.db.get('userCollections/' + id);
  if (!c || c.ownerUid !== ctx.uid) throw new Error('That collection was not found.');
  return c;
}

async function routeCommit(ctx, b) {
  const key = b.key;
  if (!_keyOk(ctx.uid, key)) return fail('Invalid upload key.');
  const docId = key.split('/').pop();
  const name = _cleanName(b.name, 200);
  if (!name) return fail('Missing file name.');

  const size = await _objectSize(key, ctx.helpers, ctx.env);
  if (size === null) return fail('The file did not finish uploading. Please retry.', 409);

  if (!ctx.isTeacher) {
    const err = _studentFileError(name, size);
    if (err) {
      try { await ctx.helpers.b2Delete(key, ctx.env); } catch (e) { /* ignore */ }
      await _quota(ctx.env, ctx.uid, 'release', [key]);
      return fail(err, 413);
    }
    const q = await _quota(ctx.env, ctx.uid, 'reserve', [key]);
    if (!q.ok) {
      try { await ctx.helpers.b2Delete(key, ctx.env); } catch (e) { /* ignore */ }
      return json({ error: 'Daily upload limit reached.', code: 'daily_limit' }, 429);
    }
  }

  let profile = null;
  if (!ctx.isTeacher) profile = await ctx.db.get('students/' + ctx.uid);
  const studentClass = profile && profile.class ? profile.class : '';

  const allowedShares = ctx.isTeacher ? ['all', 'class', 'student', 'private'] : ['teacher', 'class', 'private'];
  const sharedWith = allowedShares.indexOf(b.sharedWith) !== -1 ? b.sharedWith : (ctx.isTeacher ? 'private' : 'teacher');

  let targetClasses = [];
  let targetStudentUid = null;
  let targetStudentName = null;
  if (sharedWith === 'class') {
    if (ctx.isTeacher) {
      const req = Array.isArray(b.targetClasses) ? b.targetClasses.map(function (c) { return String(c); }) : [];
      if (!req.length) return fail('Choose at least one class.');
      const known = await _knownClasses(ctx.db);
      for (const c of req) { if (!known.has(c)) return fail('You cannot upload to the class "' + c + '".', 403); }
      targetClasses = Array.from(new Set(req));
    } else {
      if (!studentClass) return fail('Your class is not set, so you cannot share with it.');
      targetClasses = [studentClass];
    }
  }
  if (sharedWith === 'student') {
    const sid = String(b.targetStudentUid || '');
    const s = sid ? await ctx.db.get('students/' + sid) : null;
    if (!s) return fail('Choose a valid student.');
    targetStudentUid = sid;
    targetStudentName = s.name || null;
  }

  const folderId = b.folderId || null;
  const collectionId = b.collectionId || null;
  const _fo = await _validFolder(ctx, folderId);
  await _validCollection(ctx, collectionId);

  let expiresAt = null;
  if (ctx.isTeacher && b.expiresAt && typeof b.expiresAt === 'number') expiresAt = new Date(b.expiresAt);

  const ext = _ext(name);
  const data = {
    objectKey: key,
    fileName: name,
    fileSize: size,
    fileType: String(b.type || 'application/octet-stream').slice(0, 120),
    fileExt: ext,
    isVideo: VIDEO_EXTS.indexOf(ext) !== -1,
    uploaderUid: ctx.uid,
    uploaderName: ctx.isTeacher ? 'Master Timothy' : ((profile && profile.name) || 'Student'),
    uploaderRole: ctx.isTeacher ? 'teacher' : 'student',
    uploaderClass: studentClass,
    context: ctx.isTeacher ? 'teacher' : 'dashboard',
    description: _cleanName(b.description, 300),
    sharedWith: sharedWith,
    targetStudentUid: targetStudentUid,
    targetStudentName: targetStudentName,
    targetClass: targetClasses.length ? targetClasses[0] : null,
    targetClasses: targetClasses,
    expiresAt: expiresAt,
    folderId: folderId,
    folderName: (sharedWith !== 'private' && _fo && _fo.name) ? String(_fo.name).slice(0, 80) : null,
    collectionId: collectionId,
    reviewStatus: ctx.isTeacher ? null : 'pending',
    createdAt: new Date(),
  };
  const r = await ctx.db.create('uploads', docId, data);
  return json({ ok: true, id: r.id, size: size });
}

async function _findUpload(ctx, body) {
  if (body.docId) return ctx.db.get('uploads/' + String(body.docId));
  if (body.objectKey) {
    const rows = await ctx.db.where('uploads', 'objectKey', String(body.objectKey));
    return rows[0] || null;
  }
  return null;
}

async function routePresignDownload(ctx, body) {
  const d = await _findUpload(ctx, body);
  if (!d) return fail('File not found.', 404);
  let cls = '';
  if (!ctx.isTeacher && d.uploaderUid !== ctx.uid) {
    const p = await ctx.db.get('students/' + ctx.uid);
    cls = p && p.class ? p.class : '';
  }
  if (!_canSeeFile(d, ctx.uid, ctx.isTeacher, cls)) return fail('You do not have access to this file.', 403);
  const url = await ctx.helpers.b2PresignGet(d.objectKey, ctx.env);
  return json({ url: url });
}


/* ══════════════════════════════════════════════════════════
   In-app viewer: access, streaming, feedback threads
══════════════════════════════════════════════════════════ */
const MIME = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml', txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8', json: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav',
  ogg: 'audio/ogg', m4a: 'audio/mp4',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const MAX_VIEW_BYTES = 150 * 1024 * 1024;
const COMMENT_MAX = 2000;
const REVIEW_STATES = ['pending', 'reviewed', 'needs_revision', 'approved'];

async function _loadAccessible(ctx, body) {
  const d = await _findUpload(ctx, body);
  if (!d) return { err: fail('This file no longer exists.', 404) };
  let cls = '';
  if (!ctx.isTeacher && d.uploaderUid !== ctx.uid) {
    const p = await ctx.db.get('students/' + ctx.uid);
    cls = p && p.class ? p.class : '';
  }
  if (!_canSeeFile(d, ctx.uid, ctx.isTeacher, cls)) {
    const expired = d.expiresAt && Date.parse(d.expiresAt) <= Date.now();
    return { err: fail(expired ? 'This file has expired.' : 'You do not have access to this file.', expired ? 410 : 403) };
  }
  return { d: d };
}

function _iso(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (v.toDate) return v.toDate().toISOString();
  return String(v);
}

// Feedback exists on student submissions: between the uploader and the teacher.
function _feedbackAllowed(d, ctx) {
  return d.uploaderRole === 'student' && (ctx.isTeacher || d.uploaderUid === ctx.uid);
}

async function routeView(ctx, body, request) {
  const a = await _loadAccessible(ctx, body);
  if (a.err) return a.err;
  const d = a.d;
  const url = await ctx.helpers.b2PresignGet(d.objectKey, ctx.env);
  const headers = {};
  const range = request.headers.get('Range');
  if (range && /^bytes=\d*-\d*$/.test(range)) headers.Range = range;
  const up = await fetch(url, { headers: headers });
  if (up.status === 404) return fail('The file is missing from storage.', 404);
  if (up.status !== 200 && up.status !== 206) return fail('Could not read this file from storage.', 502);
  const len = parseInt(up.headers.get('Content-Length') || '0', 10);
  if (len > MAX_VIEW_BYTES) return fail('This file is too large to preview. Please download it.', 413);
  const e = d.fileExt || _ext(d.fileName);
  const h = new Headers({
    'Content-Type': MIME[e] || up.headers.get('Content-Type') || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type, Accept-Ranges',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': 'inline',
  });
  if (up.headers.get('Content-Length')) h.set('Content-Length', up.headers.get('Content-Length'));
  if (up.headers.get('Content-Range')) h.set('Content-Range', up.headers.get('Content-Range'));
  return new Response(up.body, { status: up.status, headers: h });
}

async function _comments(ctx, docId) {
  const rows = await ctx.db.where('fileComments', 'docId', docId);
  rows.sort(function (x, y) { return Date.parse(_iso(x.createdAt) || 0) - Date.parse(_iso(y.createdAt) || 0); });
  return rows;
}

function _commentOut(c, uid) {
  return {
    id: c._id, parentId: c.parentId || null, text: c.deleted ? '' : (c.text || ''),
    authorName: c.authorName || 'User', authorRole: c.authorRole || 'student',
    createdAt: _iso(c.createdAt), editedAt: _iso(c.editedAt), deleted: !!c.deleted, mine: c.authorUid === uid,
  };
}

async function _feedbackOp(ctx, b) {
  const uid = ctx.uid;
  if (b.action === 'file.info') {
    const a = await _loadAccessible(ctx, b);
    if (a.err) return a.err;
    const d = a.d;
    const canFeedback = _feedbackAllowed(d, ctx);
    let count = 0;
    if (canFeedback) count = (await _comments(ctx, d._id)).filter(function (c) { return !c.deleted; }).length;
    return json({
      id: d._id, fileName: d.fileName, fileExt: d.fileExt || _ext(d.fileName), fileSize: d.fileSize || 0,
      uploaderName: d.uploaderName || '', uploaderRole: d.uploaderRole || '', createdAt: _iso(d.createdAt),
      role: ctx.isTeacher ? 'teacher' : 'student', canFeedback: canFeedback,
      canReview: canFeedback && ctx.isTeacher,
      reviewStatus: d.uploaderRole === 'student' ? (d.reviewStatus || 'pending') : null,
      feedbackCount: count,
    });
  }
  const a = await _loadAccessible(ctx, b);
  if (a.err) return a.err;
  const d = a.d;
  if (!_feedbackAllowed(d, ctx)) return fail('Feedback is only available on student submissions.', 403);

  if (b.action === 'comment.list') {
    const list = await _comments(ctx, d._id);
    return json({ comments: list.map(function (c) { return _commentOut(c, uid); }), reviewStatus: d.reviewStatus || 'pending' });
  }
  if (b.action === 'review.set') {
    if (!ctx.isTeacher) return fail('Only the teacher can set the review status.', 403);
    if (REVIEW_STATES.indexOf(b.status) === -1) return fail('Invalid status.');
    await ctx.db.patch('uploads/' + d._id, { reviewStatus: b.status, reviewedAt: new Date() });
    return json({ ok: true, reviewStatus: b.status });
  }
  if (b.action === 'comment.add') {
    const text = String(b.text || '').replace(/\u0000/g, '').trim();
    if (!text) return fail('A comment cannot be empty.');
    if (text.length > COMMENT_MAX) return fail('Comments can be at most ' + COMMENT_MAX + ' characters.');
    let parentId = null;
    if (b.parentId) {
      const par = await ctx.db.get('fileComments/' + String(b.parentId));
      if (!par || par.docId !== d._id) return fail('The comment you are replying to no longer exists.', 404);
      parentId = par._id;
    }
    const recent = (await _comments(ctx, d._id)).filter(function (c) { return c.authorUid === uid && Date.now() - Date.parse(_iso(c.createdAt) || 0) < 3000; });
    if (recent.length >= 3) return fail('You are sending comments too quickly. Wait a moment.', 429);
    let name = ctx.isTeacher ? 'Master Timothy' : 'Student';
    if (!ctx.isTeacher) { const p = await ctx.db.get('students/' + uid); if (p && p.name) name = String(p.name).slice(0, 80); }
    const r = await ctx.db.create('fileComments', null, {
      docId: d._id, parentId: parentId, text: text, authorUid: uid, authorName: name,
      authorRole: ctx.isTeacher ? 'teacher' : 'student', deleted: false, createdAt: new Date(),
    });
    // Keep the review state meaningful without extra clicks.
    const cur = d.reviewStatus || 'pending';
    if (ctx.isTeacher && cur === 'pending') await ctx.db.patch('uploads/' + d._id, { reviewStatus: 'reviewed', reviewedAt: new Date() });
    if (!ctx.isTeacher && (cur === 'needs_revision' || cur === 'reviewed')) await ctx.db.patch('uploads/' + d._id, { reviewStatus: 'pending' });
    try { await _notifyFeedback(ctx, d, name, text); } catch (e) { /* notification must never block feedback */ }
    return json({ ok: true, id: r.id });
  }
  if (b.action === 'comment.edit' || b.action === 'comment.delete') {
    const c = await ctx.db.get('fileComments/' + String(b.commentId || ''));
    if (!c || c.docId !== d._id) return fail('That comment no longer exists.', 404);
    if (c.deleted) return fail('That comment was already deleted.', 410);
    if (b.action === 'comment.edit') {
      if (c.authorUid !== uid) return fail('You can only edit your own comments.', 403);
      const text = String(b.text || '').trim();
      if (!text) return fail('A comment cannot be empty.');
      if (text.length > COMMENT_MAX) return fail('Comments can be at most ' + COMMENT_MAX + ' characters.');
      await ctx.db.patch('fileComments/' + c._id, { text: text, editedAt: new Date() });
      return json({ ok: true });
    }
    if (c.authorUid !== uid && !ctx.isTeacher) return fail('You can only delete your own comments.', 403);
    await ctx.db.patch('fileComments/' + c._id, { deleted: true, text: '' });
    return json({ ok: true });
  }
  return fail('Unknown action.');
}

async function routeDelete(ctx, body) {
  const d = await _findUpload(ctx, body);
  if (!d) return json({ ok: true });
  if (!ctx.isTeacher && d.uploaderUid !== ctx.uid) return fail('You can only delete your own files.', 403);
  await ctx.db.del('uploads/' + d._id);
  try {
    const cms = await ctx.db.where('fileComments', 'docId', d._id, ['docId']);
    for (const c of cms) await ctx.db.del('fileComments/' + c._id);
  } catch (e) { /* orphan comments are unreachable anyway */ }
  try {
    const ns = await ctx.db.where('fileFeedbackNotifs', 'docId', d._id, ['docId']);
    for (const n of ns) await ctx.db.del('fileFeedbackNotifs/' + n._id);
  } catch (e) { /* ignore */ }
  const others = await ctx.db.where('uploads', 'objectKey', d.objectKey, ['objectKey']);
  if (!others.length) {
    try { await ctx.helpers.b2Delete(d.objectKey, ctx.env); } catch (e) { /* metadata already gone */ }
  }
  return json({ ok: true });
}

/* ── Folder / collection / file organisation ── */
function _validName(name) {
  const n = _cleanName(name, 80);
  if (!n) throw new Error('Please enter a name.');
  if (/[\/\\]/.test(n)) throw new Error('Names cannot contain slashes.');
  return n;
}

async function _siblings(ctx, parentId) {
  const rows = await ctx.db.where('userFolders', 'ownerUid', ctx.uid);
  return { all: rows, sibs: rows.filter(function (r) { return (r.parentId || null) === (parentId || null); }) };
}

function _descendants(all, id) {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    all.forEach(function (f) {
      if (f.parentId && out.has(f.parentId) && !out.has(f._id)) { out.add(f._id); grew = true; }
    });
  }
  return out;
}

function _depth(all, id) {
  const byId = {};
  all.forEach(function (f) { byId[f._id] = f; });
  let d = 0; let cur = id;
  while (cur && byId[cur] && d <= MAX_FOLDER_DEPTH + 1) { d++; cur = byId[cur].parentId; }
  return d;
}

/* ── Feedback notifications ──
   Student gets in-app + push. Teacher gets in-app only (never push). */
async function _notifyFeedback(ctx, d, authorName, text) {
  const toStudent = ctx.isTeacher;
  const recipientUid = toStudent ? d.uploaderUid : ctx.env.TEACHER_UID;
  if (!recipientUid || recipientUid === ctx.uid) return;
  const preview = String(text).replace(/\s+/g, ' ').slice(0, 120);
  await ctx.db.create('fileFeedbackNotifs', null, {
    recipientUid: recipientUid, docId: d._id, fileName: d.fileName || 'a file',
    authorName: authorName, authorRole: toStudent ? 'teacher' : 'student',
    preview: preview, read: false, createdAt: new Date(),
  });
  if (toStudent && ctx.helpers.pushToUid) {
    await ctx.helpers.pushToUid(recipientUid, {
      title: 'New feedback on your file',
      body: authorName + ' commented on ' + (d.fileName || 'your file') + ': ' + preview,
      url: '/', tag: 'fb-' + d._id,
    }, ctx.env);
  }
}

async function _notifOp(ctx, b) {
  const rows = (await ctx.db.where('fileFeedbackNotifs', 'recipientUid', ctx.uid)).filter(function (n) { return n.read !== true; });
  if (b.action === 'notif.list') {
    const byDoc = {};
    rows.forEach(function (n) { byDoc[n.docId] = (byDoc[n.docId] || 0) + 1; });
    const latest = rows.slice().sort(function (x, y) { return Date.parse(_iso(y.createdAt) || 0) - Date.parse(_iso(x.createdAt) || 0); })[0] || null;
    return json({ total: rows.length, byDoc: byDoc, latest: latest ? { id: latest._id, docId: latest.docId, fileName: latest.fileName, authorName: latest.authorName, preview: latest.preview } : null });
  }
  const docId = String(b.docId || '');
  for (const n of rows) { if (n.docId === docId) await ctx.db.patch('fileFeedbackNotifs/' + n._id, { read: true }); }
  return json({ ok: true });
}

async function routeOp(ctx, b) {
  if (b.action === 'notif.list' || b.action === 'notif.read') return _notifOp(ctx, b);
  if (b.action === 'file.info' || b.action === 'review.set' || String(b.action).indexOf('comment.') === 0) return _feedbackOp(ctx, b);
  const db = ctx.db;
  const uid = ctx.uid;
  switch (b.action) {
    case 'folder.create': {
      const name = _validName(b.name);
      const parentId = b.parentId || null;
      await _validFolder(ctx, parentId);
      const s = await _siblings(ctx, parentId);
      if (parentId && _depth(s.all, parentId) >= MAX_FOLDER_DEPTH) return fail('Folders cannot be nested this deeply.');
      if (s.sibs.some(function (f) { return f.name.toLowerCase() === name.toLowerCase(); })) return fail('A folder named "' + name + '" already exists here.', 409);
      const r = await db.create('userFolders', null, { ownerUid: uid, name: name, parentId: parentId, createdAt: new Date() });
      return json({ ok: true, id: r.id });
    }
    case 'folder.rename': {
      const f = await _validFolder(ctx, b.id);
      if (!f) return fail('Folder not found.', 404);
      const name = _validName(b.name);
      const s = await _siblings(ctx, f.parentId || null);
      if (s.sibs.some(function (x) { return x._id !== f._id && x.name.toLowerCase() === name.toLowerCase(); })) return fail('A folder named "' + name + '" already exists here.', 409);
      await db.patch('userFolders/' + f._id, { name: name });
      return json({ ok: true });
    }
    case 'folder.move': {
      const f = await _validFolder(ctx, b.id);
      if (!f) return fail('Folder not found.', 404);
      const parentId = b.parentId || null;
      await _validFolder(ctx, parentId);
      const s = await _siblings(ctx, parentId);
      const desc = _descendants(s.all, f._id);
      if (parentId && desc.has(parentId)) return fail('You cannot move a folder into itself or one of its subfolders.');
      if (s.sibs.some(function (x) { return x._id !== f._id && x.name.toLowerCase() === f.name.toLowerCase(); })) return fail('A folder named "' + f.name + '" already exists in that location.', 409);
      if (parentId && _depth(s.all, parentId) + 1 > MAX_FOLDER_DEPTH) return fail('Folders cannot be nested this deeply.');
      await db.patch('userFolders/' + f._id, { parentId: parentId });
      return json({ ok: true });
    }
    case 'folder.delete': {
      const f = await _validFolder(ctx, b.id);
      if (!f) return json({ ok: true });
      const s = await _siblings(ctx, null);
      const desc = _descendants(s.all, f._id);
      const target = f.parentId || null;
      // Files are never destroyed by a folder delete: they move up to the parent.
      const files = await db.where('uploads', 'uploaderUid', uid, ['folderId']);
      let moved = 0;
      for (const file of files) {
        if (file.folderId && desc.has(file.folderId)) {
          await db.patch('uploads/' + file._id, { folderId: target });
          moved++;
        }
      }
      for (const id of desc) await db.del('userFolders/' + id);
      return json({ ok: true, movedFiles: moved });
    }
    case 'collection.create': {
      const name = _validName(b.name);
      const rows = await db.where('userCollections', 'ownerUid', uid);
      if (rows.some(function (c) { return c.name.toLowerCase() === name.toLowerCase(); })) return fail('A collection named "' + name + '" already exists.', 409);
      if (rows.length >= 200) return fail('You have reached the collection limit.');
      const r = await db.create('userCollections', null, { ownerUid: uid, name: name, createdAt: new Date() });
      return json({ ok: true, id: r.id });
    }
    case 'collection.rename': {
      const c = await _validCollection(ctx, b.id);
      if (!c) return fail('Collection not found.', 404);
      const name = _validName(b.name);
      const rows = await db.where('userCollections', 'ownerUid', uid);
      if (rows.some(function (x) { return x._id !== c._id && x.name.toLowerCase() === name.toLowerCase(); })) return fail('A collection named "' + name + '" already exists.', 409);
      await db.patch('userCollections/' + c._id, { name: name });
      return json({ ok: true });
    }
    case 'collection.delete': {
      const c = await _validCollection(ctx, b.id);
      if (!c) return json({ ok: true });
      const files = await db.where('uploads', 'uploaderUid', uid, ['collectionId']);
      for (const file of files) {
        if (file.collectionId === c._id) await db.patch('uploads/' + file._id, { collectionId: null });
      }
      await db.del('userCollections/' + c._id);
      return json({ ok: true });
    }
    case 'file.move':
    case 'file.setCollection': {
      const ids = (Array.isArray(b.ids) ? b.ids : []).slice(0, 200);
      if (!ids.length) return fail('No files selected.');
      const isMove = b.action === 'file.move';
      const dest = isMove ? (b.folderId || null) : (b.collectionId || null);
      if (isMove) await _validFolder(ctx, dest); else await _validCollection(ctx, dest);
      for (const id of ids) {
        const d = await db.get('uploads/' + String(id));
        if (!d || d.uploaderUid !== uid) return fail('You can only organise your own files.', 403);
        await db.patch('uploads/' + d._id, isMove ? { folderId: dest } : { collectionId: dest });
      }
      return json({ ok: true, count: ids.length });
    }
    case 'classes': {
      if (!ctx.isTeacher) return fail('Teachers only.', 403);
      const set = await _knownClasses(db);
      return json({ classes: Array.from(set).sort() });
    }
  }
  return fail('Unknown action.');
}
