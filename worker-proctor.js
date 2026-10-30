/* worker-proctor.js — proctoring media API (Backblaze B2 + Firestore index)
   POST /proctor/upload?sid&kind&seq&t&type  (student, raw body)
   POST /proctor/list   {sid}                (teacher)
   POST /proctor/media  {id}                 (teacher, streams the object) */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Type' };
const J = { ...CORS, 'Content-Type': 'application/json' };
const out = (d, s) => new Response(JSON.stringify(d), { status: s || 200, headers: J });
const MAX_VIDEO = 40 * 1024 * 1024, MAX_PHOTO = 600 * 1024, MAX_SEQ = 4000;
const TYPES = { 'video/webm': 'webm', 'video/mp4': 'mp4', 'image/jpeg': 'jpg' };

export async function handleProctor(request, url, env, h, verifyIdToken) {
  const user = await verifyIdToken(request);
  if (!user) return out({ error: 'Please sign in again.' }, 401);
  if (!env.B2_KEY_ID || !env.B2_APP_KEY || !env.B2_BUCKET || !env.B2_ENDPOINT || !env.B2_REGION) return out({ error: 'File storage is not configured.' }, 500);
  const isTeacher = !!env.TEACHER_UID && user.uid === env.TEACHER_UID;
  const fsTok = await h.getFirebaseToken(env);
  if (!fsTok) return out({ error: 'Server database access is not configured.' }, 500);
  const FS = 'https://firestore.googleapis.com/v1/projects/excellencecbt/databases/(default)/documents';
  const auth = { Authorization: 'Bearer ' + fsTok, 'Content-Type': 'application/json' };

  try {
    if (url.pathname === '/proctor/upload') {
      const sid = url.searchParams.get('sid') || '';
      const kind = url.searchParams.get('kind');
      const seq = parseInt(url.searchParams.get('seq'), 10);
      const t = parseInt(url.searchParams.get('t'), 10) || Date.now();
      const type = (url.searchParams.get('type') || '').split(';')[0];
      if (!/^[A-Za-z0-9_-]{6,160}$/.test(sid) || sid.indexOf(user.uid + '_') !== 0) return out({ error: 'Invalid session.' }, 403);
      if (kind !== 'video' && kind !== 'photo') return out({ error: 'Invalid kind.' }, 400);
      if (!(seq >= 0 && seq < MAX_SEQ)) return out({ error: 'Invalid sequence.' }, 400);
      const ext = TYPES[type];
      if (!ext || (kind === 'photo') !== (ext === 'jpg')) return out({ error: 'Invalid media type.' }, 400);
      const buf = await request.arrayBuffer();
      if (!buf.byteLength || buf.byteLength > (kind === 'video' ? MAX_VIDEO : MAX_PHOTO)) return out({ error: 'Invalid size.' }, 413);
      const key = 'proctor/' + user.uid + '/' + sid + '/' + kind + '-' + String(seq).padStart(5, '0') + '.' + ext;
      const put = await fetch(await h.b2PresignPut(key, type, env), { method: 'PUT', headers: { 'Content-Type': type }, body: buf });
      if (!put.ok) return out({ error: 'Storage error (' + put.status + ').' }, 502);
      const id = sid + '_' + kind + '_' + seq;
      const fields = { sid: { stringValue: sid }, uid: { stringValue: user.uid }, kind: { stringValue: kind },
        seq: { integerValue: String(seq) }, t: { integerValue: String(t) }, objectKey: { stringValue: key },
        contentType: { stringValue: type }, size: { integerValue: String(buf.byteLength) } };
      const r = await fetch(FS + '/proctorMedia/' + encodeURIComponent(id), { method: 'PATCH', headers: auth, body: JSON.stringify({ fields }) });
      if (!r.ok) return out({ error: 'Could not save record.' }, 500);
      return out({ ok: true });
    }

    if (!isTeacher) return out({ error: 'Teacher access only.' }, 403);
    let body; try { body = await request.json(); } catch (e) { return out({ error: 'Invalid JSON.' }, 400); }

    if (url.pathname === '/proctor/list') {
      const sid = String(body.sid || '');
      if (!/^[A-Za-z0-9_-]{6,160}$/.test(sid)) return out({ error: 'Invalid session.' }, 400);
      const q = { structuredQuery: { from: [{ collectionId: 'proctorMedia' }], where: { fieldFilter: { field: { fieldPath: 'sid' }, op: 'EQUAL', value: { stringValue: sid } } } } };
      const r = await fetch(FS + ':runQuery', { method: 'POST', headers: auth, body: JSON.stringify(q) });
      if (!r.ok) return out({ error: 'Query failed.' }, 500);
      const items = (await r.json()).filter(x => x.document).map(x => {
        const f = x.document.fields || {};
        return { id: x.document.name.split('/').pop(), kind: f.kind && f.kind.stringValue, seq: parseInt(f.seq && f.seq.integerValue || '0', 10), t: parseInt(f.t && f.t.integerValue || '0', 10) };
      }).sort((a, b) => a.t - b.t || a.seq - b.seq);
      return out({ items });
    }

    if (url.pathname === '/proctor/media') {
      const id = String(body.id || '');
      if (!/^[A-Za-z0-9_-]{6,200}$/.test(id)) return out({ error: 'Invalid id.' }, 400);
      const r = await fetch(FS + '/proctorMedia/' + encodeURIComponent(id), { headers: auth });
      if (!r.ok) return out({ error: 'Not found.' }, 404);
      const f = (await r.json()).fields || {};
      const key = f.objectKey && f.objectKey.stringValue;
      if (!key || key.indexOf('proctor/') !== 0) return out({ error: 'Not found.' }, 404);
      const up = await fetch(await h.b2PresignGet(key, env));
      if (!up.ok) return out({ error: 'Missing from storage.' }, 404);
      return new Response(up.body, { headers: { ...CORS, 'Content-Type': (f.contentType && f.contentType.stringValue) || 'application/octet-stream', 'Cache-Control': 'private, no-store' } });
    }
    return out({ error: 'Not found.' }, 404);
  } catch (e) { return out({ error: e.message || 'Request failed.' }, 500); }
}
