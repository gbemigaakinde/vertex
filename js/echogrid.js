/* ============================================================
   js/echogrid.js - Echo Grid (Vertex Tutorial lobby game)

   A 7x7 strategy duel. Claim a cell and its mirror cell (180 degrees across
   the centre) is struck dead - a Void. Make straight lines of 3 of your
   own tiles to score. Every move shapes the board for BOTH players.

   Modes: vs Bot (3 levels) - Pass & Play (same device) -
          Online room (6-letter code, Firestore realtime, 2 players)
   ============================================================ */
(function () {
  'use strict';

  const N = 7, TOTAL = N * N, CENTER = 24;
  const EMPTY = 0, P1 = 1, P2 = 2, VOID = 3;
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const mirror = (i) => TOTAL - 1 - i;

  /* ───────── pure game logic ───────── */
  function newBoard() { return new Array(TOTAL).fill(EMPTY); }

  function applyMove(board, i, p) {
    const b = board.slice();
    b[i] = p;
    const m = mirror(i);
    if (m !== i && b[m] === EMPTY) b[m] = VOID;
    return b;
  }

  function lineScore(board, p) {
    let s = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      for (const [dr, dc] of DIRS) {
        const er = r + dr * 2, ec = c + dc * 2;
        if (er < 0 || er >= N || ec < 0 || ec >= N) continue;
        if (board[r * N + c] === p && board[(r + dr) * N + c + dc] === p && board[er * N + ec] === p) s++;
      }
    }
    return s;
  }

  /* potential: open pairs that can still become a 3 */
  function potential(board, p) {
    let s = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      for (const [dr, dc] of DIRS) {
        const er = r + dr * 2, ec = c + dc * 2;
        if (er < 0 || er >= N || ec < 0 || ec >= N) continue;
        const a = board[r * N + c], m = board[(r + dr) * N + c + dc], z = board[er * N + ec];
        const vals = [a, m, z];
        if (vals.includes(VOID) || vals.some(v => v !== EMPTY && v !== p)) continue;
        const mine = vals.filter(v => v === p).length;
        if (mine === 2) s += 1;
        else if (mine === 1) s += 0.15;
      }
    }
    return s;
  }

  const emptyCells = (b) => { const o = []; for (let i = 0; i < TOTAL; i++) if (b[i] === EMPTY) o.push(i); return o; };

  function evalFor(board, me) {
    const opp = me === P1 ? P2 : P1;
    return (lineScore(board, me) - lineScore(board, opp)) * 3 + (potential(board, me) - potential(board, opp)) * 1.2;
  }

  function botMove(board, me, level) {
    const cells = emptyCells(board);
    if (!cells.length) return -1;
    if (level === 'easy') {
      if (Math.random() < 0.55) return cells[Math.floor(Math.random() * cells.length)];
    }
    const opp = me === P1 ? P2 : P1;
    let best = -Infinity, bestMoves = [];
    for (const i of cells) {
      const b1 = applyMove(board, i, me);
      let val;
      if (level === 'hard') {
        const reply = emptyCells(b1);
        if (!reply.length) val = evalFor(b1, me) * 1;
        else {
          let worst = Infinity;
          for (const j of reply) {
            const b2 = applyMove(b1, j, opp);
            const v = evalFor(b2, me);
            if (v < worst) worst = v;
          }
          val = worst + evalFor(b1, me) * 0.4;
        }
      } else val = evalFor(b1, me);
      val += Math.random() * 0.05;
      if (val > best + 1e-9) { best = val; bestMoves = [i]; }
      else if (Math.abs(val - best) <= 1e-9) bestMoves.push(i);
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  /* ───────── state ───────── */
  let S = null;         // active game
  let unsub = null;     // firestore listener
  let botTimer = null;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const db = () => window.fbDb;
  const uid = () => window.AppState && window.AppState.userId;
  const me = () => (window.AppState && window.AppState.studentData) || {};
  const myName = () => me().name || 'You';

  function root() {
    let el = document.getElementById('egRoot');
    if (!el) {
      el = document.createElement('div');
      el.id = 'egRoot';
      el.className = 'eg-overlay';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      document.body.appendChild(el);
      document.body.style.overflow = 'hidden';
    }
    return el;
  }

  function close() {
    if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
    clearTimeout(botTimer);
    const el = document.getElementById('egRoot');
    if (el) el.remove();
    document.body.style.overflow = '';
    S = null;
  }

  /* ───────── menu ───────── */
  function open() {
    clearTimeout(botTimer);
    if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
    S = null;
    const el = root();
    el.innerHTML = `
      <div class="eg-panel">
        <button class="eg-x" aria-label="Close" onclick="EchoGrid.close()">&times;</button>
        <div class="eg-hero">
          <div class="eg-logo" aria-hidden="true">${logoSvg()}</div>
          <h2>Echo Grid</h2>
          <p>Every tile you claim <b>echoes</b> across the board and kills its mirror cell.
             Build lines of three - but remember, your moves shape your rival's board too.</p>
        </div>
        <div class="eg-modes">
          <button class="eg-mode" onclick="EchoGrid.startBot('easy')"><span class="eg-mode__t">Solo - Rookie</span><span class="eg-mode__d">Relaxed bot, good for learning</span></button>
          <button class="eg-mode" onclick="EchoGrid.startBot('medium')"><span class="eg-mode__t">Solo - Tactician</span><span class="eg-mode__d">Plays sharp, thinks one move ahead</span></button>
          <button class="eg-mode" onclick="EchoGrid.startBot('hard')"><span class="eg-mode__t">Solo - Mastermind</span><span class="eg-mode__d">Looks two moves ahead. Good luck.</span></button>
          <button class="eg-mode eg-mode--mp" onclick="EchoGrid.startLocal()"><span class="eg-mode__t">Pass &amp; Play</span><span class="eg-mode__d">Two players, one device</span></button>
          <button class="eg-mode eg-mode--mp" onclick="EchoGrid.showOnline()"><span class="eg-mode__t">Online Duel</span><span class="eg-mode__d">Create or join a room with a code</span></button>
        </div>
        <details class="eg-how"><summary>How to play</summary>
          <ol>
            <li>Take turns claiming one empty cell.</li>
            <li>The cell directly opposite (180 degrees through the centre) turns into a <b>Void</b> and can't be used.</li>
            <li>Every straight line of 3 of your tiles (across, down, diagonal) scores 1 point. A line of 4 scores 2.</li>
            <li>The game ends when no empty cells remain. Highest score wins.</li>
          </ol>
        </details>
      </div>`;
  }

  function logoSvg() {
    return `<svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="6" y="6" width="14" height="14" rx="3" fill="currentColor" fill-opacity=".25"/><rect x="28" y="28" width="14" height="14" rx="3" stroke-dasharray="3 4"/><path d="M24 24l-3 3m6-6l3-3"/></svg>`;
  }

  /* ───────── starting games ───────── */
  function begin(cfg) {
    S = Object.assign({ board: newBoard(), turn: P1, over: false, last: -1, lastVoid: -1, names: { 1: 'Player 1', 2: 'Player 2' }, xpGiven: false }, cfg);
    render();
    maybeBot();
  }
  function startBot(level) { begin({ mode: 'bot', level, names: { 1: myName(), 2: 'Bot - ' + ({ easy: 'Rookie', medium: 'Tactician', hard: 'Mastermind' }[level]) }, mySide: P1 }); }
  function startLocal() { begin({ mode: 'local', names: { 1: 'Player 1', 2: 'Player 2' } }); }

  function maybeBot() {
    if (!S || S.mode !== 'bot' || S.over || S.turn !== P2) return;
    clearTimeout(botTimer);
    botTimer = setTimeout(() => {
      if (!S || S.over) return;
      const i = botMove(S.board, P2, S.level);
      if (i >= 0) play(i, true);
    }, 650);
  }

  /* ───────── playing ───────── */
  function canTap() {
    if (!S || S.over) return false;
    if (S.mode === 'bot') return S.turn === S.mySide;
    if (S.mode === 'online') return S.turn === S.mySide && !S.pendingWrite && S.status === 'playing';
    return true;
  }

  function tap(i) {
    if (!canTap() || S.board[i] !== EMPTY) return;
    play(i, false);
  }

  function play(i, fromBot) {
    if (!S || S.over || S.board[i] !== EMPTY) return;
    const p = S.turn;
    S.board = applyMove(S.board, i, p);
    S.last = i; S.lastVoid = (mirror(i) !== i && S.board[mirror(i)] === VOID) ? mirror(i) : -1;
    S.turn = p === P1 ? P2 : P1;
    if (!emptyCells(S.board).length) finish();
    render();
    if (S.mode === 'online') pushOnline();
    else maybeBot();
  }

  function scores() { return { 1: lineScore(S.board, P1), 2: lineScore(S.board, P2) }; }

  function finish() {
    S.over = true;
    const sc = scores();
    S.winner = sc[1] > sc[2] ? P1 : sc[2] > sc[1] ? P2 : 0;
    if (S.mode === 'bot' && !S.xpGiven) {
      S.xpGiven = true;
      const win = S.winner === S.mySide;
      const base = { easy: 10, medium: 20, hard: 35 }[S.level];
      const xp = win ? base : S.winner === 0 ? Math.round(base / 2) : 3;
      S.xpEarned = xp;
      award(xp, win);
    }
    if (S.mode === 'online' && !S.xpGiven) {
      S.xpGiven = true;
      const win = S.winner === S.mySide;
      const xp = win ? 30 : S.winner === 0 ? 15 : 5;
      S.xpEarned = xp;
      award(xp, win);
    }
  }

  function award(xp, win) {
    try { if (window.Game && window.Game._awardXP) window.Game._awardXP(xp, 'echoGrid', { win }); } catch (e) { console.warn('Echo Grid XP', e); }
  }

  /* ───────── render ───────── */
  function cellSvg(v) {
    if (v === P1) return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" fill="currentColor"/></svg>';
    if (v === P2) return '<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="3.5" transform="rotate(45 12 12)" fill="currentColor"/></svg>';
    if (v === VOID) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>';
    return '';
  }

  function render() {
    if (!S) return;
    const el = root();
    const sc = scores();
    const left = emptyCells(S.board).length;
    const turnName = S.names[S.turn];
    let status;
    if (S.over) status = S.winner === 0 ? 'Draw!' : `${esc(S.names[S.winner])} wins!`;
    else if (S.mode === 'online' && S.status === 'waiting') status = 'Waiting for opponent...';
    else if (S.mode === 'online') status = S.turn === S.mySide ? 'Your move' : `${esc(turnName)} is thinking...`;
    else if (S.mode === 'bot') status = S.turn === S.mySide ? 'Your move' : 'Bot is thinking...';
    else status = `${esc(turnName)}'s move`;

    const cells = S.board.map((v, i) => {
      const cls = ['eg-cell'];
      if (v === P1) cls.push('eg-p1'); else if (v === P2) cls.push('eg-p2'); else if (v === VOID) cls.push('eg-void');
      else if (canTap()) cls.push('eg-open');
      if (i === S.last) cls.push('eg-last');
      if (i === S.lastVoid) cls.push('eg-lastvoid');
      if (i === CENTER) cls.push('eg-center');
      const r = Math.floor(i / N) + 1, c = (i % N) + 1;
      return `<button class="${cls.join(' ')}" data-i="${i}" aria-label="Row ${r} column ${c}${v === P1 ? ', player 1' : v === P2 ? ', player 2' : v === VOID ? ', void' : ''}" ${v !== EMPTY || !canTap() ? 'tabindex="-1"' : ''} onclick="EchoGrid.tap(${i})">${cellSvg(v)}</button>`;
    }).join('');

    el.innerHTML = `
      <div class="eg-panel eg-panel--game">
        <div class="eg-top">
          <button class="eg-back" onclick="EchoGrid.leave()">&larr; Menu</button>
          <div class="eg-status ${S.over ? 'eg-status--over' : ''}" aria-live="polite">${status}</div>
          <button class="eg-x eg-x--inline" aria-label="Close" onclick="EchoGrid.close()">&times;</button>
        </div>
        <div class="eg-score">
          <div class="eg-pl eg-pl--1 ${!S.over && S.turn === P1 ? 'is-turn' : ''}"><span class="eg-tok">${cellSvg(P1)}</span><span class="eg-pl__n">${esc(S.names[1])}</span><span class="eg-pl__s">${sc[1]}</span></div>
          <div class="eg-left"><b>${left}</b><span>cells left</span></div>
          <div class="eg-pl eg-pl--2 ${!S.over && S.turn === P2 ? 'is-turn' : ''}"><span class="eg-pl__s">${sc[2]}</span><span class="eg-pl__n">${esc(S.names[2])}</span><span class="eg-tok">${cellSvg(P2)}</span></div>
        </div>
        ${S.mode === 'online' && S.code ? `<div class="eg-room">Room code <b>${esc(S.code)}</b></div>` : ''}
        <div class="eg-board" role="grid">${cells}</div>
        ${S.over ? `<div class="eg-end">
            <div class="eg-end__t">${S.winner === 0 ? 'A perfect stalemate' : esc(S.names[S.winner]) + ' takes it'}</div>
            <div class="eg-end__s">${sc[1]} - ${sc[2]}${S.xpEarned ? ` &middot; +${S.xpEarned} XP` : ''}</div>
            <div class="eg-end__b">
              ${S.mode === 'online' ? '' : '<button class="eg-btn" onclick="EchoGrid.rematch()">Play again</button>'}
              <button class="eg-btn eg-btn--ghost" onclick="EchoGrid.leave()">Menu</button>
            </div></div>` : '<div class="eg-hint">Claim a cell: its mirror cell dies. Three in a row scores.</div>'}
      </div>`;
  }

  function leave() {
    if (S && S.mode === 'online' && !S.over && S.ref) { try { S.ref.update({ status: 'abandoned' }); } catch (e) {} }
    open();
  }
  function rematch() {
    if (!S) return;
    if (S.mode === 'bot') startBot(S.level); else startLocal();
  }

  /* ───────── online (Firestore: echoRooms/{code}) ───────── */
  function showOnline() {
    if (!db() || !uid()) { toast('Sign in to play online.', 'warning'); return; }
    if (navigator.onLine === false) { toast('Online duels need an internet connection.', 'warning'); return; }
    root().innerHTML = `
      <div class="eg-panel">
        <button class="eg-x" aria-label="Close" onclick="EchoGrid.close()">&times;</button>
        <div class="eg-hero"><h2>Online Duel</h2><p>Create a room and share the code, or enter a friend's code to join.</p></div>
        <div class="eg-modes">
          <button class="eg-mode eg-mode--mp" onclick="EchoGrid.createRoom()"><span class="eg-mode__t">Create a room</span><span class="eg-mode__d">You'll get a 6-letter code</span></button>
          <div class="eg-join">
            <input id="egCode" maxlength="6" placeholder="ENTER CODE" autocapitalize="characters" autocomplete="off" spellcheck="false" />
            <button class="eg-btn" onclick="EchoGrid.joinRoom()">Join</button>
          </div>
          <div id="egErr" class="eg-err" role="alert"></div>
        </div>
        <button class="eg-btn eg-btn--ghost eg-wide" onclick="EchoGrid.open()">&larr; Back</button>
      </div>`;
  }

  const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const newCode = () => Array.from({ length: 6 }, () => CODE_CH[Math.floor(Math.random() * CODE_CH.length)]).join('');

  async function createRoom() {
    try {
      const code = newCode();
      const ref = db().collection('echoRooms').doc(code);
      await ref.set({ code, board: newBoard().join(''), turn: 1, status: 'waiting', p1: uid(), p1Name: myName(), p2: null, p2Name: '', last: -1, lastVoid: -1, created: Date.now() });
      attach(ref, P1, code);
    } catch (e) { console.warn(e); err('Could not create a room. Check your connection.'); }
  }

  async function joinRoom() {
    const code = ((document.getElementById('egCode') || {}).value || '').trim().toUpperCase();
    if (code.length !== 6) { err('Enter the 6-letter code.'); return; }
    try {
      const ref = db().collection('echoRooms').doc(code);
      const snap = await ref.get();
      if (!snap.exists) { err('Room not found.'); return; }
      const d = snap.data();
      if (d.p1 === uid()) { attach(ref, P1, code); return; }
      if (d.p2 && d.p2 !== uid()) { err('That room is already full.'); return; }
      if (d.status === 'abandoned') { err('That room was closed.'); return; }
      await ref.update({ p2: uid(), p2Name: myName(), status: 'playing' });
      attach(ref, P2, code);
    } catch (e) { console.warn(e); err('Could not join. Check the code and your connection.'); }
  }

  function attach(ref, side, code) {
    S = { mode: 'online', ref, mySide: side, code, board: newBoard(), turn: P1, over: false, last: -1, lastVoid: -1, names: { 1: 'Player 1', 2: 'Player 2' }, status: 'waiting', xpGiven: false };
    render();
    unsub = ref.onSnapshot(snap => {
      if (!S || !snap.exists) return;
      const d = snap.data();
      S.board = String(d.board).split('').map(Number);
      S.turn = d.turn; S.last = d.last; S.lastVoid = d.lastVoid; S.status = d.status; S.pendingWrite = false;
      S.names = { 1: d.p1Name || 'Player 1', 2: d.p2Name || 'Waiting...' };
      if (d.status === 'abandoned' && !S.over) { toast('Your opponent left the room.', 'info'); S.over = true; S.winner = S.mySide; S.xpGiven = true; }
      else if (d.status === 'playing' && !emptyCells(S.board).length && !S.over) finish();
      render();
    }, e => { console.warn(e); toast('Connection lost.', 'error'); });
  }

  async function pushOnline() {
    if (!S || !S.ref) return;
    S.pendingWrite = true;
    try {
      await S.ref.update({ board: S.board.join(''), turn: S.turn, last: S.last, lastVoid: S.lastVoid, status: emptyCells(S.board).length ? 'playing' : 'finished' });
    } catch (e) { console.warn(e); toast('Move not saved. Try again.', 'error'); S.pendingWrite = false; }
  }

  function err(m) { const e = document.getElementById('egErr'); if (e) e.textContent = m; }
  function toast(m, t) { if (window.UI && window.UI.toast) window.UI.toast(m, t); }

  window.EchoGrid = { open, close, tap, startBot, startLocal, showOnline, createRoom, joinRoom, leave, rematch };
})();
