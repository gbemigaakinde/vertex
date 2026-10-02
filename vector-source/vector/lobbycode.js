/* vector/lobbycode.js | Lobby code helpers shared by the browser and the server. No DOM, no Cloudflare APIs. */

/* Short lobby codes like BLK-7F2K. No 0/O/1/I so they are hard to misread. */
export function makeCode(rand = Math.random) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(rand() * chars.length)];
  return 'BLK-' + s;
}

/* Accepts "blk7f2k", "BLK-7F2K" or "7f2k". Returns "BLK-7F2K" or null. */
export function normaliseCode(c) {
  const s = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = s.startsWith('BLK') ? s.slice(3) : s;
  return body.length === 4 ? 'BLK-' + body : null;
}
