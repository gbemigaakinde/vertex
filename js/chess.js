/* ============================================================
   js/chess.js - Vertex Chess (lobby game)

   Modes: vs Bot (3 levels) - Challenge a classmate (existing async
   challenge flow in game.js) - Pass & Play - Play with a code
   (6-letter room, Firestore realtime, shares the echoRooms collection).

   Also exposes ChessArt, the standard piece set + board markup used by
   the classmate challenge board in game.js so every board looks the same.
   Pieces: Cburnett set (BSD / GPL / GFDL tri-licence).
   ============================================================ */
(function () {
  'use strict';

  /* ───────── standard piece artwork ───────── */
  const PIECES = {"wK": "<g fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path stroke-linejoin=\"miter\" d=\"M22.5 11.63V6M20 8h5\"/><path fill=\"#fff\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" d=\"M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5\"/><path fill=\"#fff\" d=\"M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10z\"/><path d=\"M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0\"/></g>", "wQ": "<g fill=\"#fff\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path d=\"M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0m16.5-4.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0M41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0M16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0M33 9a2 2 0 1 1-4 0 2 2 0 1 1 4 0\"/><path stroke-linecap=\"butt\" d=\"M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14z\"/><path stroke-linecap=\"butt\" d=\"M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z\"/><path fill=\"none\" d=\"M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0\"/></g>", "wR": "<g fill=\"#fff\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path stroke-linecap=\"butt\" d=\"M9 39h27v-3H9zm3-3v-4h21v4zm-1-22V9h4v2h5V9h5v2h5V9h4v5\"/><path d=\"m34 14-3 3H14l-3-3\"/><path stroke-linecap=\"butt\" stroke-linejoin=\"miter\" d=\"M31 17v12.5H14V17\"/><path d=\"m31 29.5 1.5 2.5h-20l1.5-2.5\"/><path fill=\"none\" stroke-linejoin=\"miter\" d=\"M11 14h23\"/></g>", "wB": "<g fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><g fill=\"#fff\" stroke-linecap=\"butt\"><path d=\"M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.94 3-2 3-2z\"/><path d=\"M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z\"/><path d=\"M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z\"/></g><path stroke-linejoin=\"miter\" d=\"M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5\"/></g>", "wN": "<g fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path fill=\"#fff\" d=\"M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21\"/><path fill=\"#fff\" d=\"M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3\"/><path fill=\"#000\" d=\"M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0m5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5\"/></g>", "wP": "<path fill=\"#fff\" stroke=\"#000\" stroke-linecap=\"round\" stroke-width=\"1.5\" d=\"M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z\"/>", "bK": "<g fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path stroke-linejoin=\"miter\" d=\"M22.5 11.6V6\"/><path fill=\"#000\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" d=\"M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5\"/><path fill=\"#000\" d=\"M11.5 37a22.3 22.3 0 0 0 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10z\"/><path stroke-linejoin=\"miter\" d=\"M20 8h5\"/><path stroke=\"#ececec\" d=\"M32 29.5s8.5-4 6-9.7C34.1 14 25 18 22.5 24.6v2.1-2.1C20 18 9.9 14 7 19.9c-2.5 5.6 4.8 9 4.8 9\"/><path stroke=\"#ececec\" d=\"M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0\"/></g>", "bQ": "<g fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><g stroke=\"none\"><circle cx=\"6\" cy=\"12\" r=\"2.75\"/><circle cx=\"14\" cy=\"9\" r=\"2.75\"/><circle cx=\"22.5\" cy=\"8\" r=\"2.75\"/><circle cx=\"31\" cy=\"9\" r=\"2.75\"/><circle cx=\"39\" cy=\"12\" r=\"2.75\"/></g><path stroke-linecap=\"butt\" d=\"M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5z\"/><path stroke-linecap=\"butt\" d=\"M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z\"/><path fill=\"none\" stroke-linecap=\"butt\" d=\"M11 38.5a35 35 1 0 0 23 0\"/><path fill=\"none\" stroke=\"#ececec\" d=\"M11 29a35 35 1 0 1 23 0m-21.5 2.5h20m-21 3a35 35 1 0 0 22 0m-23 3a35 35 1 0 0 24 0\"/></g>", "bR": "<g fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path stroke-linecap=\"butt\" d=\"M9 39h27v-3H9zm3.5-7 1.5-2.5h17l1.5 2.5zm-.5 4v-4h21v4z\"/><path stroke-linecap=\"butt\" stroke-linejoin=\"miter\" d=\"M14 29.5v-13h17v13z\"/><path stroke-linecap=\"butt\" d=\"M14 16.5 11 14h23l-3 2.5zM11 14V9h4v2h5V9h5v2h5V9h4v5z\"/><path fill=\"none\" stroke=\"#ececec\" stroke-linejoin=\"miter\" stroke-width=\"1\" d=\"M12 35.5h21m-20-4h19m-18-2h17m-17-13h17M11 14h23\"/></g>", "bB": "<g fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><g fill=\"#000\" stroke-linecap=\"butt\"><path d=\"M9 36c3.4-1 10.1.4 13.5-2 3.4 2.4 10.1 1 13.5 2 0 0 1.6.5 3 2-.7 1-1.6 1-3 .5-3.4-1-10.1.5-13.5-1-3.4 1.5-10.1 0-13.5 1-1.4.5-2.3.5-3-.5 1.4-2 3-2 3-2z\"/><path d=\"M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z\"/><path d=\"M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z\"/></g><path stroke=\"#ececec\" stroke-linejoin=\"miter\" d=\"M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5\"/></g>", "bN": "<g fill=\"none\" fill-rule=\"evenodd\" stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path fill=\"#000\" d=\"M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21\"/><path fill=\"#000\" d=\"M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.04-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-1-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-2 2.5-3c1 0 1 3 1 3\"/><path fill=\"#ececec\" stroke=\"#ececec\" d=\"M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0m5.43-9.75a.5 1.5 30 1 1-.86-.5.5 1.5 30 1 1 .86.5\"/><path fill=\"#ececec\" stroke=\"none\" d=\"m24.55 10.4-.45 1.45.5.15c3.15 1 5.65 2.49 7.9 6.75S35.75 29.06 35.25 39l-.05.5h2.25l.05-.5c.5-10.06-.88-16.85-3.25-21.34s-5.79-6.64-9.19-7.16z\"/></g>", "bP": "<path stroke=\"#000\" stroke-linecap=\"round\" stroke-width=\"1.5\" d=\"M22.5 9a4 4 0 0 0-3.22 6.38 6.48 6.48 0 0 0-.87 10.65c-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47a6.46 6.46 0 0 0-.87-10.65A4.01 4.01 0 0 0 22.5 9z\"/>"};
  function ensureSprite() {
    if (document.getElementById('vcSprite')) return;
    const s = Object.keys(PIECES).map(k => `<symbol id="vc-${k}" viewBox="0 0 45 45">${PIECES[k]}</symbol>`).join('');
    const d = document.createElement('div');
    d.id = 'vcSprite';
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML = `<svg width="0" height="0" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
    document.body.appendChild(d);
  }
  const NAMES = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };
  function pieceSvg(code) {
    ensureSprite();
    return `<svg class="vc-pc" viewBox="0 0 45 45" role="img" aria-label="${code[0] === 'w' ? 'white' : 'black'} ${NAMES[code[1]]}"><use href="#vc-${code}"/></svg>`;
  }
  /* One square, used by BOTH this file and the classmate board in game.js */
  function squareHtml(o) {
    const cls = ['vc-sq', (o.r + o.c) % 2 === 0 ? 'vc-l' : 'vc-d'];
    if (o.sel) cls.push('vc-sel');
    if (o.last) cls.push('vc-last');
    if (o.check) cls.push('vc-check');
    if (o.target) cls.push(o.piece ? 'vc-cap' : 'vc-mv');
    if (o.click) cls.push('vc-click');
    const rank = o.showRank ? `<i class="vc-rk">${8 - o.r}</i>` : '';
    const file = o.showFile ? `<i class="vc-fl">${'abcdefgh'[o.c]}</i>` : '';
    const lab = `${'abcdefgh'[o.c]}${8 - o.r}${o.piece ? ', ' + (o.piece[0] === 'w' ? 'white ' : 'black ') + NAMES[o.piece[1]] : ''}`;
    return `<button type="button" class="${cls.join(' ')}" aria-label="${lab}" ${o.click ? `onclick="${o.click}"` : 'tabindex="-1"'}>${rank}${file}${o.piece ? pieceSvg(o.piece) : ''}</button>`;
  }
  window.ChessArt = { pieceSvg, squareHtml, ensureSprite };

  /* ───────── rules engine ───────── */
  const inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
  const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const OR = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function startBoard() {
    const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    const b = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let c = 0; c < 8; c++) { b[0][c] = 'b' + back[c]; b[1][c] = 'bP'; b[6][c] = 'wP'; b[7][c] = 'w' + back[c]; }
    return b;
  }
  function newState() { return { board: startBoard(), turn: 'w', castling: { wK: 1, wQ: 1, bK: 1, bQ: 1 }, ep: null, half: 0 }; }
  const opp = (c) => (c === 'w' ? 'b' : 'w');

  function attacked(b, r, c, by) {
    const pr = by === 'w' ? r + 1 : r - 1;
    for (const dc of [-1, 1]) if (inb(pr, c + dc) && b[pr][c + dc] === by + 'P') return true;
    for (const [dr, dc] of KN) { const rr = r + dr, cc = c + dc; if (inb(rr, cc) && b[rr][cc] === by + 'N') return true; }
    for (const [dr, dc] of KG) { const rr = r + dr, cc = c + dc; if (inb(rr, cc) && b[rr][cc] === by + 'K') return true; }
    for (const [dr, dc] of DG) {
      let rr = r + dr, cc = c + dc;
      while (inb(rr, cc)) { const p = b[rr][cc]; if (p) { if (p[0] === by && (p[1] === 'B' || p[1] === 'Q')) return true; break; } rr += dr; cc += dc; }
    }
    for (const [dr, dc] of OR) {
      let rr = r + dr, cc = c + dc;
      while (inb(rr, cc)) { const p = b[rr][cc]; if (p) { if (p[0] === by && (p[1] === 'R' || p[1] === 'Q')) return true; break; } rr += dr; cc += dc; }
    }
    return false;
  }
  function findKing(b, col) { for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c] === col + 'K') return { r, c }; return null; }
  function inCheck(b, col) { const k = findKing(b, col); return !!k && attacked(b, k.r, k.c, opp(col)); }

  function pseudo(st, r, c) {
    const b = st.board, p = b[r][c], col = p[0], t = p[1], out = [];
    const add = (rr, cc, extra) => out.push(Object.assign({ fr: r, fc: c, tr: rr, tc: cc }, extra));
    if (t === 'P') {
      const dir = col === 'w' ? -1 : 1, start = col === 'w' ? 6 : 1, last = col === 'w' ? 0 : 7;
      const push = (rr, cc) => { if (rr === last) for (const pr of ['Q', 'R', 'B', 'N']) add(rr, cc, { promo: pr }); else add(rr, cc); };
      if (inb(r + dir, c) && !b[r + dir][c]) {
        push(r + dir, c);
        if (r === start && !b[r + 2 * dir][c]) add(r + 2 * dir, c, { dbl: true });
      }
      for (const dc of [-1, 1]) {
        const rr = r + dir, cc = c + dc;
        if (!inb(rr, cc)) continue;
        if (b[rr][cc] && b[rr][cc][0] !== col) push(rr, cc);
        else if (!b[rr][cc] && st.ep && st.ep.r === rr && st.ep.c === cc) add(rr, cc, { ep: true });
      }
    } else if (t === 'N' || t === 'K') {
      for (const [dr, dc] of (t === 'N' ? KN : KG)) { const rr = r + dr, cc = c + dc; if (inb(rr, cc) && (!b[rr][cc] || b[rr][cc][0] !== col)) add(rr, cc); }
      if (t === 'K') {
        const row = col === 'w' ? 7 : 0;
        if (r === row && c === 4 && !attacked(b, row, 4, opp(col))) {
          if (st.castling[col + 'K'] && b[row][7] === col + 'R' && !b[row][5] && !b[row][6] && !attacked(b, row, 5, opp(col)) && !attacked(b, row, 6, opp(col))) add(row, 6, { castle: 'K' });
          if (st.castling[col + 'Q'] && b[row][0] === col + 'R' && !b[row][1] && !b[row][2] && !b[row][3] && !attacked(b, row, 3, opp(col)) && !attacked(b, row, 2, opp(col))) add(row, 2, { castle: 'Q' });
        }
      }
    } else {
      const dirs = t === 'B' ? DG : t === 'R' ? OR : DG.concat(OR);
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (inb(rr, cc)) {
          if (!b[rr][cc]) add(rr, cc);
          else { if (b[rr][cc][0] !== col) add(rr, cc); break; }
          rr += dr; cc += dc;
        }
      }
    }
    return out;
  }

  function make(st, m) {
    const b = st.board.map(r => r.slice());
    const p = b[m.fr][m.fc], col = p[0], t = p[1];
    const captured = m.ep ? b[m.fr][m.tc] : b[m.tr][m.tc];
    if (m.ep) b[m.fr][m.tc] = null;
    b[m.tr][m.tc] = m.promo ? col + m.promo : p;
    b[m.fr][m.fc] = null;
    if (m.castle) {
      const row = m.tr;
      if (m.castle === 'K') { b[row][5] = b[row][7]; b[row][7] = null; } else { b[row][3] = b[row][0]; b[row][0] = null; }
    }
    const cs = Object.assign({}, st.castling);
    if (t === 'K') { cs[col + 'K'] = 0; cs[col + 'Q'] = 0; }
    const corner = (r, c) => {
      if (r === 7 && c === 0) cs.wQ = 0; if (r === 7 && c === 7) cs.wK = 0;
      if (r === 0 && c === 0) cs.bQ = 0; if (r === 0 && c === 7) cs.bK = 0;
    };
    corner(m.fr, m.fc); corner(m.tr, m.tc);
    return {
      board: b, turn: opp(col), castling: cs,
      ep: m.dbl ? { r: (m.fr + m.tr) / 2, c: m.fc } : null,
      half: (t === 'P' || captured) ? 0 : st.half + 1,
      captured: captured || null
    };
  }

  function legal(st, r, c) {
    const p = st.board[r][c];
    if (!p || p[0] !== st.turn) return [];
    return pseudo(st, r, c).filter(m => !inCheck(make(st, m).board, st.turn));
  }
  function allLegal(st) {
    const out = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = st.board[r][c];
      if (p && p[0] === st.turn) for (const m of legal(st, r, c)) out.push(m);
    }
    return out;
  }
  function insufficient(b) {
    const minors = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = b[r][c]; if (!p || p[1] === 'K') continue;
      if (p[1] === 'P' || p[1] === 'R' || p[1] === 'Q') return false;
      minors.push({ t: p[1], col: p[0], sq: (r + c) % 2 });
    }
    if (minors.length <= 1) return true;
    if (minors.every(m => m.t === 'B') && minors.every(m => m.sq === minors[0].sq)) return true;
    return false;
  }
  /* returns { state: 'ok'|'check'|'checkmate'|'stalemate'|'insufficient'|'fifty', moves } */
  function status(st) {
    const moves = allLegal(st), chk = inCheck(st.board, st.turn);
    if (!moves.length) return { state: chk ? 'checkmate' : 'stalemate', moves };
    if (insufficient(st.board)) return { state: 'insufficient', moves };
    if (st.half >= 100) return { state: 'fifty', moves };
    return { state: chk ? 'check' : 'ok', moves };
  }
  function posKey(st) {
    let s = st.turn + (st.castling.wK ? 'K' : '') + (st.castling.wQ ? 'Q' : '') + (st.castling.bK ? 'k' : '') + (st.castling.bQ ? 'q' : '') + (st.ep ? 'e' + st.ep.c : '') + '|';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) s += st.board[r][c] ? st.board[r][c] : '--';
    return s;
  }
  function san(st, m, after, stat) {
    const p = st.board[m.fr][m.fc], t = p[1], sq = (r, c) => 'abcdefgh'[c] + (8 - r);
    let s;
    if (m.castle) s = m.castle === 'K' ? 'O-O' : 'O-O-O';
    else {
      const cap = !!st.board[m.tr][m.tc] || m.ep;
      if (t === 'P') s = (cap ? 'abcdefgh'[m.fc] + 'x' : '') + sq(m.tr, m.tc) + (m.promo ? '=' + m.promo : '');
      else {
        let dis = '';
        const others = allLegal(st).filter(o => (o.fr !== m.fr || o.fc !== m.fc) && o.tr === m.tr && o.tc === m.tc && st.board[o.fr][o.fc][1] === t);
        if (others.length) {
          if (others.every(o => o.fc !== m.fc)) dis = 'abcdefgh'[m.fc];
          else if (others.every(o => o.fr !== m.fr)) dis = String(8 - m.fr);
          else dis = sq(m.fr, m.fc);
        }
        s = t + dis + (cap ? 'x' : '') + sq(m.tr, m.tc);
      }
    }
    return s + (stat.state === 'checkmate' ? '#' : stat.state === 'check' ? '+' : '');
  }

  /* ───────── engine (bot) ───────── */
  const PST_P = [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0];
  const PST_N = [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50];
  const PST_B = [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20];
  const PST_K = [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20];
  const PST = { P: PST_P, N: PST_N, B: PST_B, K: PST_K };
  function evalFor(b, col) {
    let s = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = b[r][c]; if (!p) continue;
      const t = p[1], tbl = PST[t];
      const idx = p[0] === 'w' ? r * 8 + c : (7 - r) * 8 + c;
      const v = VAL[t] + (tbl ? tbl[idx] : 0);
      s += p[0] === col ? v : -v;
    }
    return s;
  }
  const MATE = 100000;
  function ordered(st, moves) {
    return moves.map(m => {
      const tgt = st.board[m.tr][m.tc];
      let sc = 0;
      if (tgt) sc += 10 * VAL[tgt[1]] - VAL[st.board[m.fr][m.fc][1]] / 10 + 1000;
      if (m.ep) sc += 1000;
      if (m.promo) sc += 800;
      return { m, sc };
    }).sort((a, b) => b.sc - a.sc).map(x => x.m);
  }
  function qsearch(st, alpha, beta, depth) {
    const stand = evalFor(st.board, st.turn);
    if (depth <= 0) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const caps = ordered(st, allLegal(st).filter(m => st.board[m.tr][m.tc] || m.ep || m.promo));
    for (const m of caps) {
      const v = -qsearch(make(st, m), -beta, -alpha, depth - 1);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }
  function negamax(st, depth, alpha, beta, q) {
    const moves = allLegal(st);
    if (!moves.length) return inCheck(st.board, st.turn) ? -MATE - depth : 0;
    if (st.half >= 100 || insufficient(st.board)) return 0;
    if (depth <= 0) return q ? qsearch(st, alpha, beta, q) : evalFor(st.board, st.turn);
    let best = -Infinity;
    for (const m of ordered(st, moves)) {
      const v = -negamax(make(st, m), depth - 1, -beta, -alpha, q);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  const LEVELS = {
    easy:   { name: 'Rookie',      depth: 1, q: 0, rnd: 0.35, noise: 60, xp: 10 },
    medium: { name: 'Club Player', depth: 2, q: 2, rnd: 0,    noise: 12, xp: 20 },
    hard:   { name: 'Master',      depth: 3, q: 4, rnd: 0,    noise: 0,  xp: 35 }
  };
  function botMove(st, level) {
    const L = LEVELS[level], moves = allLegal(st);
    if (!moves.length) return null;
    if (Math.random() < L.rnd) return moves[Math.floor(Math.random() * moves.length)];
    let best = -Infinity, pick = [];
    for (const m of ordered(st, moves)) {
      const v = -negamax(make(st, m), L.depth - 1, -Infinity, Infinity, L.q) + Math.random() * L.noise;
      if (v > best + 1e-9) { best = v; pick = [m]; } else if (Math.abs(v - best) <= 1e-9) pick.push(m);
    }
    return pick[Math.floor(Math.random() * pick.length)];
  }

  /* ───────── helpers ───────── */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const db = () => window.fbDb;
  const uid = () => window.AppState && window.AppState.userId;
  const meData = () => (window.AppState && window.AppState.studentData) || {};
  const myName = () => meData().name || 'You';
  const toast = (m, t) => { if (window.UI && window.UI.toast) window.UI.toast(m, t); };
  const sfx = (n) => { try { if (window.VtxSound && window.VtxSound[n]) window.VtxSound[n](); } catch (e) {} };

  let S = null, unsub = null, botTimer = null;

  function root() {
    let el = document.getElementById('vcRoot');
    if (!el) {
      el = document.createElement('div');
      el.id = 'vcRoot';
      el.className = 'eg-overlay vc-overlay';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      document.body.appendChild(el);
      document.body.style.overflow = 'hidden';
    }
    return el;
  }
  function close() {
    abandonOnline();
    if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
    clearTimeout(botTimer);
    const el = document.getElementById('vcRoot');
    if (el) el.remove();
    document.body.style.overflow = '';
    S = null;
  }

  const I = (d, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra || ''}>${d}</svg>`;
  const IC = {
    x: I('<path d="M18 6 6 18M6 6l12 12"/>'),
    back: I('<path d="M15 18l-6-6 6-6"/>'),
    go: I('<path d="M9 18l6-6-6-6"/>'),
    users: I('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
    school: I('<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>'),
    code: I('<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>'),
    flag: I('<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>'),
    list: I('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    bars: (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M6 18v-3" ${n >= 1 ? '' : 'opacity=".25"'}/><path d="M12 18v-7" ${n >= 2 ? '' : 'opacity=".25"'}/><path d="M18 18V6" ${n >= 3 ? '' : 'opacity=".25"'}/></svg>`,
    brand: '<svg viewBox="0 0 45 45" aria-hidden="true"><use href="#vc-wN" style="color:#fff"/></svg>'
  };
  const row = (fn, ico, t, d, xp) => `<button class="eg-row" onclick="${fn}"><span class="eg-row__ico">${ico}</span><span class="eg-row__txt"><b>${t}</b><small>${d}</small></span>${xp ? `<span class="eg-xp">${xp}</span>` : ''}<span class="eg-row__go">${IC.go}</span></button>`;

  /* ───────── menu ───────── */
  function open() {
    ensureSprite();
    clearTimeout(botTimer);
    if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
    S = null;
    root().innerHTML = `
      <div class="eg-sheet">
        <div class="eg-head">
          <span class="eg-brand vc-brand">${IC.brand}</span>
          <div class="eg-head__t"><h2>Chess</h2><p>Full rules. Play the engine, a classmate or a friend.</p></div>
          <button class="eg-icobtn" aria-label="Close" onclick="Chess.close()">${IC.x}</button>
        </div>
        <div class="eg-label eg-label--first">Play the engine</div>
        <div class="eg-group">
          ${row("Chess.startBot('easy')", IC.bars(1), 'Rookie', 'Makes mistakes. Good for learning', '+10 XP')}
          ${row("Chess.startBot('medium')", IC.bars(2), 'Club Player', 'Thinks two moves ahead', '+20 XP')}
          ${row("Chess.startBot('hard')", IC.bars(3), 'Master', 'Calculates tactics. Very tough', '+35 XP')}
        </div>
        <div class="eg-label">Play with others</div>
        <div class="eg-group">
          ${row('Chess.classmate()', IC.school, 'Challenge a classmate', 'Send a challenge and play at your own pace', '+40 XP')}
          ${row('Chess.myGames()', IC.list, 'My classmate games', 'Invitations and games in progress')}
          ${row('Chess.showOnline()', IC.code, 'Play with a code', 'Create a room and share the code with anyone', '+30 XP')}
          ${row('Chess.startLocal()', IC.users, 'Pass &amp; Play', 'Two players, one device')}
        </div>
        <details class="eg-how"><summary>How to play online with a code</summary>
          <h4>Player 1 (the host)</h4>
          <ol>
            <li>Tap <b>Play with a code</b>, then <b>Create a room</b>.</li>
            <li>A 6-letter code appears above the board. Send it to anyone by WhatsApp, text or say it out loud.</li>
            <li>Wait on the board. You play White and move first once they join.</li>
          </ol>
          <h4>Player 2 (the guest)</h4>
          <ol>
            <li>Open Chess, tap <b>Play with a code</b> and type the code.</li>
            <li>Tap <b>Join</b>. You play Black.</li>
          </ol>
          <h4>Good to know</h4>
          <ol>
            <li>Both players must be signed in and online.</li>
            <li>Leaving a live room counts as resigning.</li>
          </ol>
        </details>
        <details class="eg-how"><summary>Rules in brief</summary>
          <ol>
            <li>Checkmate the enemy king to win. Tap a piece to see where it can go.</li>
            <li>Castling, en passant and pawn promotion are all supported.</li>
            <li>Draws: stalemate, threefold repetition, the 50-move rule and not enough material.</li>
          </ol>
        </details>
      </div>`;
  }

  function classmate() { close(); if (window.Game && window.Game._showChessSetup) window.Game._showChessSetup(); }
  function myGames() { close(); if (window.Game && window.Game._showChessPending) window.Game._showChessPending(); }

  /* ───────── starting games ───────── */
  function begin(cfg) {
    ensureSprite();
    const st = newState();
    S = Object.assign({
      st, keys: [posKey(st)], moves: [], sel: null, targets: [], last: null, over: false, result: null, reason: null,
      names: { w: 'White', b: 'Black' }, mySide: 'w', xpGiven: false, promo: null, thinking: false, stat: { state: 'ok' }
    }, cfg);
    render();
    maybeBot();
  }
  function startBot(level) {
    const side = Math.random() < 0.5 ? 'w' : 'b';
    const bot = 'Bot - ' + LEVELS[level].name;
    begin({ mode: 'bot', level, mySide: side, names: side === 'w' ? { w: myName(), b: bot } : { w: bot, b: myName() } });
  }
  function startLocal() { begin({ mode: 'local', names: { w: 'White', b: 'Black' } }); }

  function maybeBot() {
    if (!S || S.mode !== 'bot' || S.over || S.st.turn === S.mySide) return;
    S.thinking = true; render();
    clearTimeout(botTimer);
    botTimer = setTimeout(() => {
      if (!S || S.over) return;
      const m = botMove(S.st, S.level);
      S.thinking = false;
      if (m) play(m);
    }, 450);
  }

  /* ───────── playing ───────── */
  function canTap() {
    if (!S || S.over || S.promo) return false;
    if (S.mode === 'bot') return S.st.turn === S.mySide && !S.thinking;
    if (S.mode === 'online') return S.status === 'playing' && S.st.turn === S.mySide && !S.pendingWrite;
    return true;
  }
  function tap(r, c) {
    if (!canTap()) return;
    const st = S.st, p = st.board[r][c];
    if (S.sel) {
      const mv = S.targets.filter(m => m.tr === r && m.tc === c);
      if (mv.length) {
        if (mv[0].promo) { S.promo = mv; render(); return; }
        play(mv[0]); return;
      }
    }
    if (p && p[0] === st.turn && (S.mode !== 'bot' && S.mode !== 'online' || p[0] === S.mySide)) {
      if (S.sel && S.sel.r === r && S.sel.c === c) { S.sel = null; S.targets = []; }
      else { S.sel = { r, c }; S.targets = legal(st, r, c); }
    } else { S.sel = null; S.targets = []; }
    render();
  }
  function promote(pc) {
    if (!S || !S.promo) return;
    const m = S.promo.find(x => x.promo === pc);
    S.promo = null;
    if (m) play(m); else render();
  }

  function cancelPromo() { if (S && S.promo) { S.promo = null; S.sel = null; S.targets = []; render(); } }

  function play(m) {
    if (!S || S.over) return;
    const before = S.st;
    if (S.mode === 'online') S.prev = { st: S.st, keys: S.keys.slice(), moves: S.moves.slice(), last: S.last };
    const after = make(before, m);
    const stat = status(after);
    S.moves.push(san(before, m, after, stat));
    S.st = { board: after.board, turn: after.turn, castling: after.castling, ep: after.ep, half: after.half };
    S.keys.push(posKey(S.st));
    S.last = { fr: m.fr, fc: m.fc, tr: m.tr, tc: m.tc };
    S.sel = null; S.targets = []; S.stat = stat;
    sfx(stat.state === 'check' || stat.state === 'checkmate' ? 'gameChessCheck' : after.captured ? 'gameChessCapture' : 'gameChessMove');
    const key = S.keys[S.keys.length - 1];
    const reps = S.keys.filter(k => k === key).length;
    if (S.mode !== 'online') {
      if (stat.state === 'checkmate') finish(before.turn === 'w' ? 'white' : 'black', 'checkmate');
      else if (stat.state === 'stalemate') finish('draw', 'stalemate');
      else if (stat.state === 'insufficient') finish('draw', 'insufficient material');
      else if (stat.state === 'fifty') finish('draw', '50-move rule');
      else if (reps >= 3) finish('draw', 'repetition');
    }
    render();
    if (S.mode === 'online') pushOnline(stat, reps);
    else maybeBot();
  }

  function finish(result, reason) {
    S.over = true; S.result = result; S.reason = reason; S.thinking = false;
    settle();
  }

  async function settle() {
    if (!S || S.xpGiven || S.mode === 'local') return;
    S.xpGiven = true;
    const mode = S.mode, level = S.level, ref = S.ref, side = S.mySide, result = S.result, reason = S.reason;
    const oppSide = opp(side);
    const win = (result === 'white' && side === 'w') || (result === 'black' && side === 'b');
    const draw = result === 'draw';
    let xp;
    if (mode === 'bot') { const base = LEVELS[level].xp; xp = win ? base : draw ? Math.round(base / 2) : 3; }
    else xp = win ? 30 : draw ? 15 : 5;
    S.xpEarned = xp;
    const rec = { result, reason: reason || '', mode, xpEarned: xp, opponentName: String(S.names[oppSide] || '') };
    if (level) rec.level = level;
    try { if (window.Game && window.Game._awardXP) await window.Game._awardXP(xp, 'chess', { win }); } catch (e) { console.warn('Chess XP', e); }
    try { if (window.Game && window.Game._saveGameResult) await window.Game._saveGameResult('chess', rec); } catch (e) { console.warn('Chess history', e); }
    if (mode === 'online' && ref && uid()) { try { await ref.update({ ['xpAwarded.' + uid()]: true }); } catch (e) {} }
    if (S) render();
  }

  /* ───────── render ───────── */
  function captured(board) {
    const start = { P: 8, N: 2, B: 2, R: 2, Q: 1 }, have = { w: { P: 0, N: 0, B: 0, R: 0, Q: 0 }, b: { P: 0, N: 0, B: 0, R: 0, Q: 0 } };
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = board[r][c]; if (p && p[1] !== 'K') have[p[0]][p[1]]++; }
    const lost = { w: [], b: [] };
    for (const col of ['w', 'b']) for (const t of ['Q', 'R', 'B', 'N', 'P']) {
      const n = Math.max(0, start[t] - have[col][t]);
      for (let i = 0; i < n; i++) lost[col].push(col + t);
    }
    const PTS = { P: 1, N: 3, B: 3, R: 5, Q: 9 };
    const mat = (col) => ['P', 'N', 'B', 'R', 'Q'].reduce((s, t) => s + have[col][t] * PTS[t], 0);
    return { lost, diff: mat('w') - mat('b') };
  }
  function playerBar(col, cap) {
    const stolen = cap.lost[opp(col)];           /* enemy pieces this side has taken */
    const adv = col === 'w' ? cap.diff : -cap.diff;
    return `<div class="vc-pl ${S.st.turn === col && !S.over ? 'is-turn' : ''}">
      <span class="vc-dot vc-dot--${col}"></span>
      <span class="vc-pl__n">${esc(S.names[col])}</span>
      <span class="vc-cap-row">${stolen.map(p => `<span class="vc-mini">${pieceSvg(p)}</span>`).join('')}${adv > 0 ? `<b class="vc-adv">+${adv}</b>` : ''}</span>
    </div>`;
  }

  function render() {
    if (!S) return;
    const st = S.st, flipped = S.mode === 'online' || S.mode === 'bot' ? S.mySide === 'b' : false;
    const tapOk = canTap();
    const kingPos = (S.stat.state === 'check' || S.stat.state === 'checkmate') ? findKing(st.board, st.turn) : null;
    let sq = '';
    for (let dr = 0; dr < 8; dr++) for (let dc = 0; dc < 8; dc++) {
      const r = flipped ? 7 - dr : dr, c = flipped ? 7 - dc : dc;
      const p = st.board[r][c];
      const isTarget = S.targets.some(m => m.tr === r && m.tc === c);
      const mine = p && p[0] === st.turn && (S.mode === 'local' || p[0] === S.mySide);
      sq += squareHtml({
        r, c, piece: p,
        sel: S.sel && S.sel.r === r && S.sel.c === c,
        last: S.last && ((S.last.fr === r && S.last.fc === c) || (S.last.tr === r && S.last.tc === c)),
        check: kingPos && kingPos.r === r && kingPos.c === c,
        target: isTarget,
        showRank: dc === 0, showFile: dr === 7,
        click: tapOk && (isTarget || mine || S.sel) ? `Chess.tap(${r},${c})` : ''
      });
    }
    const cap = captured(st.board);
    const topCol = flipped ? 'w' : 'b', botCol = flipped ? 'b' : 'w';

    let status;
    if (S.over) status = S.result === 'draw' ? 'Draw' : `${esc(S.names[S.result === 'white' ? 'w' : 'b'])} wins`;
    else if (S.mode === 'online' && S.status === 'waiting') status = 'Waiting for opponent...';
    else if (S.mode === 'bot') status = S.thinking ? 'Bot is thinking...' : (S.stat.state === 'check' ? 'Check! Your move' : 'Your move');
    else if (S.mode === 'online') status = st.turn === S.mySide ? (S.stat.state === 'check' ? 'Check! Your move' : 'Your move') : `${esc(S.names[st.turn])} is thinking...`;
    else status = `${st.turn === 'w' ? 'White' : 'Black'} to move${S.stat.state === 'check' ? ' - check' : ''}`;

    const promoHtml = S.promo ? `<div class="vc-promo" role="dialog" aria-label="Choose promotion piece" onclick="Chess.cancelPromo()">
        <div class="vc-promo__box" onclick="event.stopPropagation()"><p>Promote to</p><div>${['Q', 'R', 'B', 'N'].map(t => `<button type="button" aria-label="${NAMES[t]}" onclick="Chess.promote('${t}')">${pieceSvg(st.turn + t)}</button>`).join('')}</div></div></div>` : '';

    const reasonTxt = { checkmate: 'by checkmate', stalemate: 'by stalemate', repetition: 'by repetition', resign: 'by resignation', 'insufficient material': 'insufficient material', '50-move rule': '50-move rule', abandoned: 'opponent left' }[S.reason] || '';
    const myWin = (S.result === 'white' && S.mySide === 'w') || (S.result === 'black' && S.mySide === 'b');
    const endTitle = S.result === 'draw' ? 'Drawn game' : (S.mode === 'local' ? esc(S.names[S.result === 'white' ? 'w' : 'b']) + ' wins' : myWin ? 'You win' : 'You lost');

    /* move list as numbered pairs */
    let ml = '';
    for (let i = 0; i < S.moves.length; i += 2) ml += `<span class="vc-mv-n">${i / 2 + 1}.</span><span class="vc-mv-m">${esc(S.moves[i])}</span><span class="vc-mv-m">${esc(S.moves[i + 1] || '')}</span>`;

    root().innerHTML = `
      <div class="eg-sheet eg-sheet--game vc-sheet">
        <div class="eg-top">
          <button class="eg-icobtn" aria-label="Back to menu" onclick="Chess.leave()">${IC.back}</button>
          <div class="eg-status ${S.over ? 'eg-status--over' : ''}" aria-live="polite">${status}</div>
          <button class="eg-icobtn" aria-label="Close" onclick="Chess.close()">${IC.x}</button>
        </div>
        ${S.mode === 'online' && S.code ? `<div class="eg-room">Room code <b>${esc(S.code)}</b></div>` : ''}
        ${S.mode === 'online' && S.status === 'waiting' && !S.over ? '<div class="eg-wait">Share this code with your opponent. The game starts as soon as they join.</div>' : ''}
        ${playerBar(topCol, cap)}
        <div class="vc-boardwrap"><div class="vc-board" role="grid" aria-label="Chess board">${sq}</div>${promoHtml}</div>
        ${playerBar(botCol, cap)}
        ${S.over ? `<div class="eg-end">
            <div class="eg-end__t">${endTitle}</div>
            <div class="eg-end__s">${esc(reasonTxt)}${S.xpEarned ? ` &middot; +${S.xpEarned} XP` : ''}</div>
            <div class="eg-end__b">
              ${S.mode === 'online' ? '' : '<button class="eg-btn" onclick="Chess.rematch()">Play again</button>'}
              <button class="eg-btn eg-btn--ghost" onclick="Chess.leave()">Menu</button>
            </div></div>` : `<div class="vc-actions">
            ${S.mode === 'local' ? '' : `<button class="eg-btn eg-btn--ghost vc-resign" onclick="Chess.resign()">${IC.flag} Resign</button>`}
          </div>`}
        <div class="vc-moves" aria-label="Move list">${ml || '<span class="vc-none">No moves yet.</span>'}</div>
      </div>`;
    const mv = document.querySelector('#vcRoot .vc-moves'); if (mv) mv.scrollTop = mv.scrollHeight;
  }

  function resign() {
    if (!S || S.over) return;
    if (!window.confirm('Resign this game?')) return;
    const loser = S.mode === 'local' ? S.st.turn : S.mySide;
    const result = loser === 'w' ? 'black' : 'white';
    if (S.mode === 'online') { S.over = true; S.result = result; S.reason = 'resign'; settle(); render(); pushResult(result, 'resign'); return; }
    finish(result, 'resign'); render();
  }

  function abandonOnline() {
    if (!S || S.mode !== 'online' || S.over || !S.ref) return;
    if (S.status === 'playing') {
      S.over = true; S.result = S.mySide === 'w' ? 'black' : 'white'; S.reason = 'resign';
      settle();
      try { S.ref.update({ status: 'abandoned', leftBy: uid(), result: S.result, resultReason: 'abandoned' }).catch(() => {}); } catch (e) {}
    } else {
      try { S.ref.update({ status: 'abandoned', leftBy: uid() }).catch(() => {}); } catch (e) {}
    }
  }
  function leave() { abandonOnline(); open(); }
  function rematch() { if (!S) return; if (S.mode === 'bot') startBot(S.level); else startLocal(); }

  /* ───────── online (Firestore: echoRooms/{code}, game:'chess') ───────── */
  function showOnline() {
    if (!db() || !uid()) { toast('Sign in to play online.', 'warning'); return; }
    if (navigator.onLine === false) { toast('Online play needs an internet connection.', 'warning'); return; }
    root().innerHTML = `
      <div class="eg-sheet">
        <div class="eg-head">
          <button class="eg-icobtn" aria-label="Back" onclick="Chess.open()">${IC.back}</button>
          <div class="eg-head__t"><h2>Play with a code</h2><p>Play anyone, anywhere, in real time.</p></div>
          <button class="eg-icobtn" aria-label="Close" onclick="Chess.close()">${IC.x}</button>
        </div>
        <div class="eg-group">${row('Chess.createRoom()', IC.code, 'Create a room', 'You play White and get a 6-letter code to share')}</div>
        <div class="eg-label">Or join with a code</div>
        <div class="eg-join">
          <input id="vcCode" maxlength="6" placeholder="ENTER CODE" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-label="Room code" />
          <button class="eg-btn" onclick="Chess.joinRoom()">Join</button>
        </div>
        <div id="vcErr" class="eg-err" role="alert"></div>
      </div>`;
  }
  const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const newCode = () => Array.from({ length: 6 }, () => CODE_CH[Math.floor(Math.random() * CODE_CH.length)]).join('');
  const err = (m) => { const e = document.getElementById('vcErr'); if (e) e.textContent = m; };

  function pack(st) { return JSON.stringify({ b: st.board.map(r => r.map(p => p || '--').join('')).join('/'), t: st.turn, c: st.castling, e: st.ep, h: st.half }); }
  function unpack(s) {
    const d = JSON.parse(s);
    return { board: d.b.split('/').map(r => r.match(/../g).map(p => (p === '--' ? null : p))), turn: d.t, castling: d.c, ep: d.e, half: d.h };
  }

  async function createRoom() {
    try {
      const code = newCode(), st = newState();
      const ref = db().collection('echoRooms').doc(code);
      await ref.set({ game: 'chess', code, state: pack(st), keys: [posKey(st)], moves: [], last: null, status: 'waiting', p1: uid(), p1Name: myName(), p2: null, p2Name: '', created: Date.now() });
      attach(ref, 'w', code);
    } catch (e) { console.warn(e); err('Could not create a room. Check your connection.'); }
  }
  async function joinRoom() {
    const code = ((document.getElementById('vcCode') || {}).value || '').trim().toUpperCase();
    if (code.length !== 6) { err('Enter the 6-letter code.'); return; }
    try {
      const ref = db().collection('echoRooms').doc(code), snap = await ref.get();
      if (!snap.exists) { err('Room not found.'); return; }
      const d = snap.data();
      if (d.game !== 'chess') { err('That code is not a chess room.'); return; }
      if (d.status === 'abandoned' || d.status === 'finished') { err('That room was closed.'); return; }
      if (d.p1 === uid()) { attach(ref, 'w', code); return; }
      if (d.p2 === uid()) { attach(ref, 'b', code); return; }
      if (d.p2) { err('That room is already full.'); return; }
      await ref.update({ p2: uid(), p2Name: myName(), status: 'playing' });
      attach(ref, 'b', code);
    } catch (e) { console.warn(e); err('Could not join. Check the code and your connection.'); }
  }
  function attach(ref, side, code) {
    ensureSprite();
    const st = newState();
    S = { mode: 'online', ref, mySide: side, code, st, keys: [posKey(st)], moves: [], sel: null, targets: [], last: null, over: false, result: null, reason: null, names: { w: 'White', b: 'Black' }, status: 'waiting', xpGiven: false, promo: null, stat: { state: 'ok' } };
    render();
    unsub = ref.onSnapshot(snap => {
      if (!S || !snap.exists) return;
      const d = snap.data();
      S.pendingWrite = !!(snap.metadata && snap.metadata.hasPendingWrites);
      S.st = unpack(d.state); S.keys = d.keys || []; S.moves = d.moves || []; S.last = d.last || null; S.status = d.status;
      S.names = { w: d.p1Name || 'White', b: d.p2Name || 'Waiting...' };
      S.stat = status(S.st);
      S.sel = null; S.targets = [];
      if (d.xpAwarded && d.xpAwarded[uid()]) S.xpGiven = true;
      if (!S.over) {
        if (d.result && !S.pendingWrite) { S.over = true; S.result = d.result; S.reason = d.resultReason; if (d.status === 'abandoned' && d.leftBy !== uid()) toast('Your opponent left. You win.', 'info'); settle(); }
      }
      render();
    }, e => { console.warn(e); toast('Connection lost.', 'error'); });
  }
  async function pushOnline(stat, reps) {
    if (!S || !S.ref) return;
    let result = null, reason = null;
    const mover = S.st.turn === 'w' ? 'black' : 'white';
    if (stat.state === 'checkmate') { result = mover; reason = 'checkmate'; }
    else if (stat.state === 'stalemate') { result = 'draw'; reason = 'stalemate'; }
    else if (stat.state === 'insufficient') { result = 'draw'; reason = 'insufficient material'; }
    else if (stat.state === 'fifty') { result = 'draw'; reason = '50-move rule'; }
    else if (reps >= 3) { result = 'draw'; reason = 'repetition'; }
    const mySide = S.mySide;
    S.pendingWrite = true;
    const upd = { state: pack(S.st), keys: S.keys, moves: S.moves, last: S.last, status: result ? 'finished' : 'playing' };
    if (result) { upd.result = result; upd.resultReason = reason; }
    try {
      await S.ref.update(upd);
      if (S && S.mode === 'online' && result && !S.over) { S.over = true; S.result = result; S.reason = reason; settle(); }
      if (S) { S.pendingWrite = false; render(); }
    } catch (e) {
      console.warn(e); toast('Move not saved. Try again.', 'error');
      if (S && S.mode === 'online' && S.mySide === mySide) {
        S.pendingWrite = false;
        if (S.prev) { Object.assign(S, S.prev); S.stat = status(S.st); }
        render();
      }
    }
  }
  async function pushResult(result, reason) {
    try { await S.ref.update({ status: 'finished', result, resultReason: reason }); } catch (e) { console.warn(e); }
  }

  window.Chess = { open, close, tap, promote, cancelPromo, startBot, startLocal, startOnline: showOnline, showOnline, createRoom, joinRoom, leave, rematch, resign, classmate, myGames };
  window.ChessEngine = { newState, legal, allLegal, make, status, botMove };
})();
