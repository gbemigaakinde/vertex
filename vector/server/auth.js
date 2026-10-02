/* ============================================================
   vector/server/auth.js  |  Verify a Firebase ID token inside a Worker.
   Uses WebCrypto and Google's public signing keys, so no secrets and no
   Firebase Admin SDK are needed. Same Firebase project as Vertex.
   ============================================================ */
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let keyCache = { at: 0, keys: null };

const b64uToBytes = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
const b64uJson = (s) => JSON.parse(new TextDecoder().decode(b64uToBytes(s)));

async function getKeys(fetchFn) {
  if (keyCache.keys && Date.now() - keyCache.at < 3600e3) return keyCache.keys;
  const res = await fetchFn(JWKS_URL);
  if (!res.ok) throw new Error('Could not load signing keys');
  const { keys } = await res.json();
  keyCache = { at: Date.now(), keys };
  return keys;
}

/* Returns { uid, name, email } or throws. */
export async function verifyFirebaseToken(token, projectId, fetchFn = fetch) {
  if (!token || typeof token !== 'string') throw new Error('Missing token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const header = b64uJson(parts[0]), payload = b64uJson(parts[1]);
  if (header.alg !== 'RS256') throw new Error('Bad algorithm');
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new Error('Wrong audience');
  if (payload.iss !== 'https://securetoken.google.com/' + projectId) throw new Error('Wrong issuer');
  if (!payload.sub) throw new Error('No subject');
  if (payload.exp < now - 30) throw new Error('Token expired');
  if (payload.iat > now + 300) throw new Error('Token issued in the future');
  const keys = await getKeys(fetchFn);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) { keyCache.at = 0; throw new Error('Unknown signing key'); }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64uToBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new Error('Bad signature');
  return { uid: payload.sub, name: payload.name || (payload.email ? payload.email.split('@')[0] : 'Operative'), email: payload.email || null };
}
