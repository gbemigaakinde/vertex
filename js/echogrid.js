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
    abandonOnline();
    if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
    clearTimeout(botTimer);
    const el = document.getElementById('egRoot');
    if (el) el.remove();
    document.body.style.overflow = '';
    S = null;
  }


  /* Icons: ECHO matches the app-wide "echo" icon in js/game.js (_LI.echo) */
  const ECHO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="3"/><circle cx="8.25" cy="8.25" r="1.75" fill="currentColor" stroke="none"/><path d="M14 14l3.5 3.5m0-3.5L14 17.5"/><path d="M11 11l2 2" opacity=".5"/></svg>';
  const IC = {
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    go: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z"/></svg>',
    bars: (n) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M6 18v-3" ' + (n >= 1 ? '' : 'opacity=".25"') + '/><path d="M12 18v-7" ' + (n >= 2 ? '' : 'opacity=".25"') + '/><path d="M18 18V6" ' + (n >= 3 ? '' : 'opacity=".25"') + '/></svg>'
  };
  const row = (fn, ico, t, d, xp) => `<button class="eg-row" onclick="${fn}"><span class="eg-row__ico">${ico}</span><span class="eg-row__txt"><b>${t}</b><small>${d}</small></span>${xp ? `<span class="eg-xp">${xp}</span>` : ''}<span class="eg-row__go">${IC.go}</span></button>`;

  /* cells that belong to at least one scoring line of p */
  function scoringCells(board, p) {
    const set = new Set();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of DIRS) {
      const er = r + dr * 2, ec = c + dc * 2;
      if (er < 0 || er >= N || ec < 0 || ec >= N) continue;
      const a = r * N + c, b = (r + dr) * N + c + dc, z = er * N + ec;
      if (board[a] === p && board[b] === p && board[z] === p) { set.add(a); set.add(b); set.add(z); }
    }
    return set;
  }

  /* ───────── menu ───────── */
  function open() {
    clearTimeout(botTimer);
    if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
    S = null;
    const el = root();
    el.innerHTML = `
      <div class="eg-sheet">
        <div class="eg-head">
          <span class="eg-brand">${ECHO}</span>
          <div class="eg-head__t"><h2>Echo Grid</h2><p>Claim a tile. Its mirror dies. Outscore your rival.</p></div>
          <button class="eg-icobtn" aria-label="Close" onclick="EchoGrid.close()">${IC.x}</button>
        </div>
        <div class="eg-label eg-label--first">Play solo</div>
        <div class="eg-group">
          ${row("EchoGrid.startBot('easy')", IC.bars(1), 'Rookie', 'Relaxed bot, good for learning', '+10 XP')}
          ${row("EchoGrid.startBot('medium')", IC.bars(2), 'Tactician', 'Plays sharp and plans one move ahead', '+20 XP')}
          ${row("EchoGrid.startBot('hard')", IC.bars(3), 'Mastermind', 'Looks two moves ahead. Good luck.', '+35 XP')}
        </div>
        <div class="eg-label">Play with others</div>
        <div class="eg-group">
          ${row('EchoGrid.startLocal()', IC.users, 'Pass &amp; Play', 'Two players, one device')}
          ${row('EchoGrid.showOnline()', IC.globe, 'Online Duel', 'Create or join a room with a code', '+30 XP')}
        </div>
        <details class="eg-how"><summary>How to play</summary>
          <ol>
            <li>Take turns claiming one empty cell.</li>
            <li>The cell directly opposite (rotated 180 degrees through the centre) becomes a <b>Void</b> and cannot be used.</li>
            <li>Every straight line of 3 of your tiles (across, down or diagonal) scores 1 point. A line of 4 scores 2.</li>
            <li>When no empty cells remain, the highest score wins.</li>
          </ol>
        </details>
        <details class="eg-how"><summary>How to play online</summary>
          <h4>Player 1 (the host)</h4>
          <ol>
            <li>Tap <b>Online Duel</b>, then <b>Create a room</b>.</li>
            <li>A 6-letter code appears at the top of the board. Send it to your friend by WhatsApp, text or just say it out loud.</li>
            <li>Wait on the board. The game starts the moment your friend joins. You play the blue circles and move first.</li>
          </ol>
          <h4>Player 2 (the guest)</h4>
          <ol>
            <li>Open Echo Grid on your own phone or computer and tap <b>Online Duel</b>.</li>
            <li>Type the 6-letter code you were sent in the box. Capital or small letters both work.</li>
            <li>Tap <b>Join</b>. You play the orange diamonds and move second.</li>
          </ol>
          <h4>Good to know</h4>
          <ol>
            <li>Both players must be signed in and connected to the internet.</li>
            <li>You can only tap the board on your turn. The top of the screen tells you whose move it is.</li>
            <li>If you leave the room, the game ends for both players, so stay on the board until it finishes.</li>
            <li>"Room not found"? Check the code for typos. "Room is full"? Ask your friend to create a new room.</li>
            <li>Playing in the same room? Use <b>Pass &amp; Play</b> instead and share one device.</li>
          </ol>
        </details>
      </div>`;
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
    if (S.mode === 'online') S.prev = { board: S.board, turn: S.turn, last: S.last, lastVoid: S.lastVoid };
    S.board = applyMove(S.board, i, p);
    S.last = i; S.lastVoid = (mirror(i) !== i && S.board[mirror(i)] === VOID) ? mirror(i) : -1;
    S.turn = p === P1 ? P2 : P1;
    /* Online games are finished only after the server confirms the last move,
       so BOTH players end the game from the same shared room state. */
    if (S.mode !== 'online' && !emptyCells(S.board).length) finish();
    render();
    if (S.mode === 'online') pushOnline();
    else maybeBot();
  }

  function scores() { return { 1: lineScore(S.board, P1), 2: lineScore(S.board, P2) }; }

  function finish() {
    S.over = true;
    const sc = scores();
    S.winner = sc[1] > sc[2] ? P1 : sc[2] > sc[1] ? P2 : 0;
    settle(null);
  }

  /* Pays XP and writes the History entry exactly once per player per game.
     Everything the async part needs is captured up front, because S may be
     cleared (menu / close) before the writes complete. */
  async function settle(reason) {
    if (!S || S.xpGiven || S.mode === 'local') return;
    S.xpGiven = true;
    const mode = S.mode, level = S.level, ref = S.ref;
    const side = S.mySide, oppSide = side === P1 ? P2 : P1;
    const sc = scores();
    const win = S.winner === side, draw = S.winner === 0;
    let xp;
    if (mode === 'bot') {
      const base = { easy: 10, medium: 20, hard: 35 }[level];
      xp = win ? base : draw ? Math.round(base / 2) : 3;
    } else xp = win ? 30 : draw ? 15 : 5;
    S.xpEarned = xp;
    const rec = {
      mode, result: win ? 'win' : draw ? 'draw' : 'loss',
      myScore: sc[side], oppScore: sc[oppSide],
      opponentName: String(S.names[oppSide] || ''), xpEarned: xp
    };
    if (level) rec.level = level;
    if (reason) rec.reason = reason;
    await award(xp, win);
    await saveHistory(rec);
    if (mode === 'online' && ref && uid()) {
      try { await ref.update({ ['xpAwarded.' + uid()]: true }); } catch (e) { console.warn('Echo Grid xpAwarded', e); }
    }
  }

  async function saveHistory(rec) {
    try { if (window.Game && window.Game._saveGameResult) await window.Game._saveGameResult('echoGrid', rec); }
    catch (e) { console.warn('Echo Grid history', e); }
  }

  async function award(xp, win) {
    try { if (window.Game && window.Game._awardXP) await window.Game._awardXP(xp, 'echoGrid', { win }); } catch (e) { console.warn('Echo Grid XP', e); }
  }

  /* ───────── render ───────── */
  function cellSvg(v) {
    if (v === P1) return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>';
    if (v === P2) return '<svg viewBox="0 0 24 24"><rect x="4.5" y="4.5" width="15" height="15" rx="3" transform="rotate(45 12 12)" fill="currentColor"/></svg>';
    if (v === VOID) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>';
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

    const sc1 = scoringCells(S.board, P1), sc2 = scoringCells(S.board, P2);
    const tap_ = canTap();
    const cells = S.board.map((v, i) => {
      const cls = ['eg-cell'];
      if (v === P1) cls.push('eg-p1'); else if (v === P2) cls.push('eg-p2'); else if (v === VOID) cls.push('eg-void');
      else if (tap_) cls.push('eg-open');
      if (i === S.last) cls.push('eg-last');
      if (i === S.lastVoid) cls.push('eg-lastvoid');
      if (i === CENTER) cls.push('eg-center');
      if (sc1.has(i) || sc2.has(i)) cls.push('eg-scored');
      const r = Math.floor(i / N) + 1, c = (i % N) + 1;
      const label = `Row ${r} column ${c}` + (v === P1 ? ', player 1' : v === P2 ? ', player 2' : v === VOID ? ', void' : '');
      return `<button class="${cls.join(' ')}" aria-label="${label}" ${v !== EMPTY || !tap_ ? 'tabindex="-1"' : ''} onclick="EchoGrid.tap(${i})">${cellSvg(v)}</button>`;
    }).join('');

    el.innerHTML = `
      <div class="eg-sheet eg-sheet--game">
        <div class="eg-top">
          <button class="eg-icobtn" aria-label="Back to menu" onclick="EchoGrid.leave()">${IC.back}</button>
          <div class="eg-status ${S.over ? 'eg-status--over' : ''}" aria-live="polite">${status}</div>
          <button class="eg-icobtn" aria-label="Close" onclick="EchoGrid.close()">${IC.x}</button>
        </div>
        <div class="eg-score">
          <div class="eg-pl eg-pl--1 ${!S.over && S.turn === P1 ? 'is-turn' : ''}"><span class="eg-tok">${cellSvg(P1)}</span><span class="eg-pl__m"><span class="eg-pl__n">${esc(S.names[1])}</span><span class="eg-pl__s">${sc[1]}</span></span></div>
          <div class="eg-left"><b>${left}</b><span>left</span></div>
          <div class="eg-pl eg-pl--2 ${!S.over && S.turn === P2 ? 'is-turn' : ''}"><span class="eg-tok">${cellSvg(P2)}</span><span class="eg-pl__m"><span class="eg-pl__n">${esc(S.names[2])}</span><span class="eg-pl__s">${sc[2]}</span></span></div>
        </div>
        ${S.mode === 'online' && S.code ? `<div class="eg-room">Room code <b>${esc(S.code)}</b></div>` : ''}
        ${S.mode === 'online' && S.status === 'waiting' && !S.over ? '<div class="eg-wait">Share this code with your friend. The game starts as soon as they join.</div>' : ''}
        <div class="eg-board" role="grid" aria-label="Echo Grid board">${cells}</div>
        ${S.over ? `<div class="eg-end">
            <div class="eg-end__t">${S.winner === 0 ? 'A perfect stalemate' : esc(S.names[S.winner]) + ' takes it'}</div>
            <div class="eg-end__s">${sc[1]} - ${sc[2]}${S.xpEarned ? ` &middot; +${S.xpEarned} XP` : ''}</div>
            <div class="eg-end__b">
              ${S.mode === 'online' ? '' : '<button class="eg-btn" onclick="EchoGrid.rematch()">Play again</button>'}
              <button class="eg-btn eg-btn--ghost" onclick="EchoGrid.leave()">Menu</button>
            </div></div>` : `<div class="eg-hint">Claim a cell: its mirror cell dies. Three in a row scores.</div>
            <div class="eg-legend"><span><i></i>Scoring line</span></div>`}
      </div>`;
  }

  /* Leaving a live online game = forfeit. The leaver is credited a loss here;
     the opponent is credited the win when they see status 'abandoned'. */
  function abandonOnline() {
    if (!S || S.mode !== 'online' || S.over || !S.ref) return;
    if (S.status === 'playing') {
      S.over = true;
      S.winner = S.mySide === P1 ? P2 : P1;
      settle('forfeit');
    }
    try { S.ref.update({ status: 'abandoned', leftBy: uid() }).catch(() => {}); } catch (e) {}
  }
  function leave() {
    abandonOnline();
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
      <div class="eg-sheet">
        <div class="eg-head">
          <button class="eg-icobtn" aria-label="Back" onclick="EchoGrid.open()">${IC.back}</button>
          <div class="eg-head__t"><h2>Online Duel</h2><p>Play a friend in real time.</p></div>
          <button class="eg-icobtn" aria-label="Close" onclick="EchoGrid.close()">${IC.x}</button>
        </div>
        <div class="eg-group">
          ${row('EchoGrid.createRoom()', IC.globe, 'Create a room', 'You get a 6-letter code to share')}
        </div>
        <div class="eg-label">Or join with a code</div>
        <div class="eg-join">
          <input id="egCode" maxlength="6" placeholder="ENTER CODE" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-label="Room code" />
          <button class="eg-btn" onclick="EchoGrid.joinRoom()">Join</button>
        </div>
        <div id="egErr" class="eg-err" role="alert"></div>
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
      if (d.game && d.game !== 'echo') { err('That code is for a different game.'); return; }
      if (d.status === 'abandoned') { err('That room was closed.'); return; }
      if (d.p1 === uid()) { attach(ref, P1, code); return; }
      if (d.p2 === uid()) { attach(ref, P2, code); return; }
      if (d.p2) { err('That room is already full.'); return; }
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
      const pending = !!(snap.metadata && snap.metadata.hasPendingWrites);
      S.board = String(d.board).split('').map(Number);
      S.turn = d.turn; S.last = d.last; S.lastVoid = d.lastVoid; S.status = d.status; S.pendingWrite = pending;
      S.names = { 1: d.p1Name || 'Player 1', 2: d.p2Name || 'Waiting...' };
      if (d.xpAwarded && d.xpAwarded[uid()]) S.xpGiven = true;   // already paid (e.g. re-opened room)
      if (!S.over) {
        if (d.status === 'abandoned') {
          S.over = true;
          if (d.p2 && d.leftBy !== uid()) {
            toast('Your opponent left the room. You win by forfeit.', 'info');
            S.winner = S.mySide;
            settle('forfeit');
          } else S.winner = S.mySide;
        } else if (!pending && !emptyCells(S.board).length && d.p2) finish();   // 'finished' or full board
      }
      render();
    }, e => { console.warn(e); toast('Connection lost.', 'error'); });
  }

  async function pushOnline() {
    if (!S || !S.ref) return;
    const mySide = S.mySide;
    S.pendingWrite = true;
    try {
      await S.ref.update({ board: S.board.join(''), turn: S.turn, last: S.last, lastVoid: S.lastVoid, status: emptyCells(S.board).length ? 'playing' : 'finished' });
      if (S && S.mode === 'online' && !S.over && !emptyCells(S.board).length) { finish(); render(); }
    } catch (e) {
      console.warn(e); toast('Move not saved. Try again.', 'error');
      if (S && S.mode === 'online' && S.mySide === mySide) {
        S.pendingWrite = false;
        if (S.prev && !S.over) { Object.assign(S, S.prev); }   // roll back the unsaved move
        render();
      }
    }
  }

  function err(m) { const e = document.getElementById('egErr'); if (e) e.textContent = m; }
  function toast(m, t) { if (window.UI && window.UI.toast) window.UI.toast(m, t); }

  window.EchoGrid = { open, close, tap, startBot, startLocal, showOnline, createRoom, joinRoom, leave, rematch };
})();
