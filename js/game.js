/* ============================================================
   js/game.js — Vertex Tutorial Game Engine v2
   Educational games with XP, levels, badges, leaderboard,
   and student-vs-student challenges.
   ============================================================ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     ICONS — clean, correct inline SVG paths (24×24 viewBox)
     Each path is tested and renders correctly.
  ══════════════════════════════════════════════════════════════ */

  const _ICONS = {
    trophy:        'M12 2a1 1 0 0 1 1 1v1h5a1 1 0 0 1 1 1v4c0 2.76-1.86 5.08-4.38 5.8A6.002 6.002 0 0 1 13 17.92V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.08A6.002 6.002 0 0 1 6.38 13.8C3.86 13.08 2 10.76 2 8V5a1 1 0 0 1 1-1h5V3a1 1 0 0 1 1-1h3Zm-6 4H4v2c0 1.65 1.02 3.07 2.47 3.65A6.03 6.03 0 0 1 6 10V6Zm12 0h-2v4c0 .68-.1 1.33-.47 1.65C17.98 11.07 19 9.65 19 8V6Z',
    lightning:     'M13 2 4.5 13.5H11L10 22l9.5-13H13L13 2Z',
    calculator:    'M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 2v16h12V4H6Zm2 2h2v2H8V6Zm3 0h2v2h-2V6Zm3 0h2v2h-2V6ZM8 10h8v2H8v-2Zm0 4h8v2H8v-2Zm0 4h4v2H8v-2Z',
    textT:         'M5 4h14a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0V6h-5v13h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2V6H6v2a1 1 0 0 1-2 0V5a1 1 0 0 1 1-1Z',
    swords:        'M6.5 1 1 6.5l5.5 5.5 1.5-1.5-4-4 3-3 4 4L12.5 6.5 6.5 1Zm11 0 5.5 5.5-5.5 5.5-1.5-1.5 4-4-3-3-4 4L11.5 6.5 17.5 1ZM3 15l-2 2 2 2h16l2-2-2-2H3Z',
    medal:         'M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-5 9-3 9h16l-3-9a7 7 0 0 1-10 0Z',
    star:          'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z',
    flame:         'M12 1c0 0 4 4 4 9a4 4 0 0 1-8 0c0-1.5.5-3 1.5-4.5C9.5 7 10 9 10 9s2-2.5 2-8Zm-4 10a4 4 0 1 0 8 0c0 2-4 7-4 7s-4-5-4-7Z',
    shield:        'M12 1 3 5v7c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V5l-9-4Zm0 2.18 7 3.11V12c0 4.1-2.97 8.06-7 9.23C7.97 20.06 5 16.1 5 12V6.29l7-3.11Z',
    chartBar:      'M3 3h2v18H3V3Zm4 6h2v12H7V9Zm4-4h2v16h-2V5Zm4 2h2v14h-2V7Zm4 4h2v10h-2v-10Z',
    arrowLeft:     'M19 12H5m7-7-7 7 7 7',
    arrowRight:    'M5 12h14m-7-7 7 7-7 7',
    house:         'M3 12l9-9 9 9M5 10v9a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1v-9',
    users:         'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    clock:         'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm0 2a8 8 0 1 1 0 16A8 8 0 0 1 12 4Zm0 2v6l4 2-1 1.73-5-2.5V6H12Z',
    shuffle:       'M16 3h5v5l-1.5-1.5-4.5 4.5-4-4L5 13.5 3.5 12 9 6.5l4 4 3.5-3.5L16 3Zm5 13-1.5-1.5-4.5-4.5-4 4-5.5-5.5L4 10l5.5 5.5 4-4 3.5 3.5L16 17h5v-1Z',
    checkCircle:   'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
    xCircle:       'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm3 7-6 6m0-6 6 6',
    warning:       'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4m0 4h.01',
    hourglass:     'M5 2h14M5 22h14M17 2v4l-5 4 5 4v4M7 2v4l5 4-5 4v4',
    gameController:'M6 12h4m-2-2v4M15 12h.01M18 12h.01M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z',
    crown:         'M2 20h20M5 20 3 8l5 5 4-8 4 8 5-5-2 12H5Z',
    person:        'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    sparkle:       'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83',
    skipForward:   'M5 4l10 8-10 8V4ZM19 5v14',
    x:             'M18 6 6 18M6 6l12 12',
    info:          'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm0 9v5m0-8h.01',
    play:          'M5 3l14 9-14 9V3Z',
    handWaving:    'M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8M6 14v-3a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4c0 3.31 2.69 6 6 6h4c2.67 0 4.94-1.7 5.72-4.07',
    close:         'M18 6 6 18M6 6l12 12',
  };

  function _icon(name, size = 20, opts = {}) {
    const pathData = _ICONS[name] || _ICONS.sparkle;
    const color    = opts.color || 'currentColor';
    const cls      = opts.class ? ` class="${opts.class}"` : '';

    // Determine if path is fill-only (no M...Z with stroke-like data) or stroke
    // We use stroke for the new clean paths; fill for star/flame etc
    const strokeIcons = new Set([
      'arrowLeft','arrowRight','house','users','clock','shuffle','checkCircle','xCircle',
      'warning','hourglass','gameController','crown','sparkle','skipForward','x','info',
      'play','handWaving','close','person','shield','swords','lightning','trophy','medal',
      'flame','star','chartBar','textT','calculator','trophy'
    ]);

    const useStroke = strokeIcons.has(name);

    if (useStroke) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
        fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        ${cls} aria-hidden="true" style="display:inline-block;vertical-align:middle;flex-shrink:0;">
        <path d="${pathData}"/>
      </svg>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
      fill="${color}" ${cls} aria-hidden="true" style="display:inline-block;vertical-align:middle;flex-shrink:0;">
      <path d="${pathData}"/>
    </svg>`;
  }

  /* ══════════════════════════════════════════════════════════════
     CONSTANTS
  ══════════════════════════════════════════════════════════════ */

  const XP_PER_CORRECT    = 10;
  const XP_PER_PERFECT    = 50;
  const XP_SPEED_BONUS    = 5;
  const XP_CHALLENGE_WIN  = 30;
  const MAX_SHUFFLES      = 3;

  const LEVELS = [
    { name: 'Rookie',    minXP: 0,    icon: 'person',    color: '#6b7280' },
    { name: 'Scholar',   minXP: 100,  icon: 'textT',     color: '#3b82f6' },
    { name: 'Expert',    minXP: 300,  icon: 'flame',     color: '#f59e0b' },
    { name: 'Master',    minXP: 700,  icon: 'lightning', color: '#8b5cf6' },
    { name: 'Champion',  minXP: 1500, icon: 'crown',     color: '#f59e0b' },
  ];

  const BADGES = [
    { id: 'first_game',    name: 'First Steps',     desc: 'Play your first game',                icon: 'gameController', xp: 0 },
    { id: 'perfect_quiz',  name: 'Perfect Score',   desc: 'Get 100% on any quiz',                icon: 'checkCircle',    xp: 0 },
    { id: 'streak_5',      name: 'On Fire',         desc: 'Win 5 games in a row',                icon: 'flame',          xp: 0 },
    { id: 'challenge_win', name: 'Duelist',         desc: 'Win your first challenge',            icon: 'swords',         xp: 0 },
    { id: 'games_10',      name: 'Dedicated',       desc: 'Play 10 games total',                 icon: 'medal',          xp: 0 },
    { id: 'games_50',      name: 'Veteran',         desc: 'Play 50 games total',                 icon: 'shield',         xp: 0 },
    { id: 'xp_500',        name: 'Rising Star',     desc: 'Earn 500 XP',                         icon: 'star',           xp: 0 },
    { id: 'speed_demon',   name: 'Speed Demon',     desc: 'Answer 10 questions in < 5s each',   icon: 'lightning',      xp: 0 },
    { id: 'math_master',   name: 'Math Wizard',     desc: 'Complete Speed Math on Hard',         icon: 'calculator',     xp: 0 },
    { id: 'word_wizard',   name: 'Word Wizard',     desc: 'Unscramble 10 words correctly',       icon: 'textT',          xp: 0 },
  ];

  const QUIZ_BLITZ_QUESTIONS = 10;
  const QUIZ_BLITZ_TIME      = 15;
  const SPEED_MATH_TIME      = 8;
  const WORD_SCRAMBLE_TIME   = 20;
  const CHALLENGE_EXPIRE_MS  = 24 * 60 * 60 * 1000;

  /* ══════════════════════════════════════════════════════════════
     STATE
  ══════════════════════════════════════════════════════════════ */

  let _gameState = null;
  let _profile   = null;
  let _timerEl   = null;
  let _timerInt  = null;
  let _timerSecs = 0;
  let _questionStartTime = 0;
  let _speedDemonCount   = 0;

  /* ══════════════════════════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════════════════════════ */

  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _db()      { return window.fbDb; }
  function _uid()     { return window.AppState && window.AppState.userId; }
  function _student() { return (window.AppState && window.AppState.studentData) || {}; }

  function _getLevelForXP(xp) {
    let level = LEVELS[0];
    for (const l of LEVELS) { if (xp >= l.minXP) level = l; }
    return level;
  }

  function _getNextLevel(xp) {
    for (let i = 0; i < LEVELS.length - 1; i++) {
      if (xp < LEVELS[i + 1].minXP) return LEVELS[i + 1];
    }
    return null;
  }

  function _xpProgressPct(xp) {
    const current = _getLevelForXP(xp);
    const next    = _getNextLevel(xp);
    if (!next) return 100;
    const base   = current.minXP;
    const target = next.minXP;
    return Math.min(100, Math.round(((xp - base) / (target - base)) * 100));
  }

  function _shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function _stopTimer() {
    if (_timerInt) { clearInterval(_timerInt); _timerInt = null; }
  }

  function _startTimer(seconds, onTick, onExpire) {
    _stopTimer();
    _timerSecs = seconds;
    onTick(_timerSecs);
    _timerInt = setInterval(() => {
      _timerSecs--;
      onTick(_timerSecs);
      if (_timerSecs <= 0) { _stopTimer(); onExpire(); }
    }, 1000);
  }

  function _getSubjectsForStudent() {
    const qBank    = window.questions || {};
    const classKey = (_student().class || '').replace(/\s+/g, '').toLowerCase();
    return Object.keys(qBank[classKey] || {});
  }

  function _getQuestionsForSubject(subject, count) {
    const qBank    = window.questions || {};
    const classKey = (_student().class || '').replace(/\s+/g, '').toLowerCase();
    const all      = (qBank[classKey] || {})[subject] || [];
    return _shuffleArray(all).slice(0, count);
  }

  /* ══════════════════════════════════════════════════════════════
     PROFILE MANAGEMENT
  ══════════════════════════════════════════════════════════════ */

  async function _loadProfile() {
    const uid = _uid();
    if (!uid) return null;
    try {
      const snap = await _db().collection('gameProfiles').doc(uid).get();
      if (snap.exists) {
        _profile = snap.data();
      } else {
        _profile = {
          uid,
          name:       _student().name  || '',
          class:      _student().class || '',
          school:     _student().school || '',
          xp:         0,
          totalGames: 0,
          totalWins:  0,
          streak:     0,
          badges:     [],
          stats:      { quizBlitz: 0, speedMath: 0, wordScramble: 0, challenges: 0 },
          createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
        };
        await _db().collection('gameProfiles').doc(uid).set(_profile);
      }
    } catch (e) {
      console.warn('[game] _loadProfile error:', e);
      _profile = {
        uid,
        name:       _student().name  || '',
        class:      _student().class || '',
        xp:         0,
        totalGames: 0,
        totalWins:  0,
        streak:     0,
        badges:     [],
        stats:      {},
      };
    }
    return _profile;
  }

  async function _awardXP(xpAmount, gameType, extraData) {
    if (!_uid() || xpAmount < 0) return {
      xpAwarded: 0,
      earnedBadges: [],
      newXP: (_profile && _profile.xp) || 0,
      newLevel: _getLevelForXP((_profile && _profile.xp) || 0)
    };

    const uid       = _uid();
    const oldXP     = (_profile && _profile.xp) || 0;
    const newXP     = oldXP + xpAmount;
    const newBadges = [...((_profile && _profile.badges) || [])];

    const totalGames = ((_profile && _profile.totalGames) || 0) + 1;
    const isWin      = extraData && extraData.win;
    const totalWins  = ((_profile && _profile.totalWins) || 0) + (isWin ? 1 : 0);
    const newStreak  = isWin ? ((_profile && _profile.streak) || 0) + 1 : 0;

    const earnedBadges = [];
    const _hasBadge = (id) => newBadges.includes(id);

    if (!_hasBadge('first_game')    && totalGames >= 1)                                                       { newBadges.push('first_game');    earnedBadges.push('first_game');    }
    if (!_hasBadge('perfect_quiz')  && extraData && extraData.perfect)                                        { newBadges.push('perfect_quiz');   earnedBadges.push('perfect_quiz');   }
    if (!_hasBadge('streak_5')      && newStreak >= 5)                                                        { newBadges.push('streak_5');       earnedBadges.push('streak_5');       }
    if (!_hasBadge('challenge_win') && extraData && extraData.challengeWin)                                   { newBadges.push('challenge_win');  earnedBadges.push('challenge_win');  }
    if (!_hasBadge('games_10')      && totalGames >= 10)                                                      { newBadges.push('games_10');       earnedBadges.push('games_10');       }
    if (!_hasBadge('games_50')      && totalGames >= 50)                                                      { newBadges.push('games_50');       earnedBadges.push('games_50');       }
    if (!_hasBadge('xp_500')        && newXP >= 500)                                                          { newBadges.push('xp_500');         earnedBadges.push('xp_500');         }
    if (!_hasBadge('speed_demon')   && extraData && extraData.speedDemonCount >= 10)                          { newBadges.push('speed_demon');    earnedBadges.push('speed_demon');    }
    if (!_hasBadge('math_master')   && gameType === 'speedMath' && extraData && extraData.difficulty === 'hard') { newBadges.push('math_master'); earnedBadges.push('math_master');    }
    if (!_hasBadge('word_wizard')   && extraData && extraData.wordCorrect >= 10)                              { newBadges.push('word_wizard');    earnedBadges.push('word_wizard');    }

    const updateData = {
      xp:         firebase.firestore.FieldValue.increment(xpAmount),
      totalGames: firebase.firestore.FieldValue.increment(1),
      totalWins:  firebase.firestore.FieldValue.increment(isWin ? 1 : 0),
      streak:     newStreak,
      badges:     newBadges,
      name:       _student().name   || '',
      class:      _student().class  || '',
      school:     _student().school || '',
      [`stats.${gameType}`]: firebase.firestore.FieldValue.increment(1),
    };

    const levelData = _getLevelForXP(newXP);

    try {
      const batch = _db().batch();
      batch.set(_db().collection('gameProfiles').doc(uid), updateData, { merge: true });
      batch.set(_db().collection('gameLeaderboard').doc(uid), {
        uid,
        name:       _student().name   || '',
        class:      _student().class  || '',
        school:     _student().school || '',
        xp:         newXP,
        totalGames,
        totalWins,
        level:      levelData.name,
        levelIcon:  levelData.icon,
        updatedAt:  firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: false });
      await batch.commit();

      if (_profile) {
        _profile.xp         = newXP;
        _profile.totalGames = totalGames;
        _profile.totalWins  = totalWins;
        _profile.streak     = newStreak;
        _profile.badges     = newBadges;
      }
    } catch (e) {
      console.warn('[game] _awardXP error:', e);
    }

    return { xpAwarded: xpAmount, earnedBadges, newXP, newLevel: levelData };
  }

  /* ══════════════════════════════════════════════════════════════
     LOBBY — MAIN GAME SCREEN
  ══════════════════════════════════════════════════════════════ */

  async function openGameLobby() {
    _injectStyles();
    const uid = _uid();
    if (!uid) { window.UI.toast('Please sign in to play games.', 'error'); return; }

    await _loadProfile();

    const challengeSnap = await _db().collection('gameChallenges')
      .where('challengedUid', '==', uid)
      .where('status', '==', 'pending')
      .get().catch(() => ({ empty: true, docs: [] }));

    const pendingChallenges = [];
    if (!challengeSnap.empty) {
      challengeSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d.expiresAt && d.expiresAt.toDate && d.expiresAt.toDate() > new Date()) {
          pendingChallenges.push({ id: doc.id, ...d });
        }
      });
    }

    const sentSnap = await _db().collection('gameChallenges')
      .where('challengerUid', '==', uid)
      .where('status', '==', 'awaiting_challenger')
      .get().catch(() => ({ empty: true, docs: [] }));

    const awaitingPlay = [];
    if (!sentSnap.empty) {
      sentSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d.expiresAt && d.expiresAt.toDate && d.expiresAt.toDate() > new Date()) {
          awaitingPlay.push({ id: doc.id, ...d });
        }
      });
    }

    const level     = _getLevelForXP(_profile.xp || 0);
    const nextLevel = _getNextLevel(_profile.xp || 0);
    const xpPct     = _xpProgressPct(_profile.xp || 0);

    const challengeNotif = pendingChallenges.length > 0 ? `
      <div class="game-challenge-alert" onclick="Game._showPendingChallenges()">
        <span class="game-challenge-alert__icon">${_icon('swords', 20)}</span>
        <span>${pendingChallenges.length} pending challenge${pendingChallenges.length > 1 ? 's' : ''} — tap to view.</span>
        <span class="game-challenge-alert__arrow">${_icon('arrowRight', 16)}</span>
      </div>` : '';

    const awaitingNotif = awaitingPlay.length > 0 ? `
      <div class="game-challenge-alert game-challenge-alert--info" onclick="Game._showAwaitingChallenges()">
        <span class="game-challenge-alert__icon">${_icon('hourglass', 20)}</span>
        <span>${awaitingPlay.length} challenge${awaitingPlay.length > 1 ? 's' : ''} waiting for your response — tap to play!</span>
        <span class="game-challenge-alert__arrow">${_icon('arrowRight', 16)}</span>
      </div>` : '';

    const badgesHtml = (_profile.badges || []).length > 0
      ? (_profile.badges || []).map(bid => {
          const b = BADGES.find(x => x.id === bid);
          return b
            ? `<span class="game-badge-chip" title="${_esc(b.name)}: ${_esc(b.desc)}">${_icon(b.icon, 13)} ${_esc(b.name)}</span>`
            : '';
        }).join('')
      : `<span style="font-size:.8125rem;color:var(--text-4);font-style:italic;">No badges yet — play games to earn them.</span>`;

    window.UI.mount(`
      <div class="max-w-4xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">

        <div class="game-lobby-header glass">
          <div class="game-lobby-header__left">
            <div class="game-lobby-header__avatar">
              ${_esc((_student().name || '?').charAt(0).toUpperCase())}
            </div>
            <div>
              <h1 class="game-lobby-header__name">${_esc(_student().name || '')}</h1>
              <div class="game-lobby-header__meta">${_esc(_student().class || '')}${_student().school ? ' · ' + _esc(_student().school) : ''}</div>
            </div>
          </div>
          <div class="game-lobby-header__right">
            <div class="game-level-badge" style="--lvl-color:${level.color};">
              <span class="game-level-badge__icon">${_icon(level.icon, 20, { color: level.color })}</span>
              <div>
                <div class="game-level-badge__name">${_esc(level.name)}</div>
                <div class="game-level-badge__xp">${(_profile.xp || 0).toLocaleString()} XP</div>
              </div>
            </div>
          </div>
        </div>

        <div class="glass-dark game-xp-bar-wrap">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
            <span style="font-size:.8125rem;font-weight:700;color:var(--text-2);display:flex;align-items:center;gap:.3rem;">
              ${_icon(level.icon, 14, { color: level.color })} ${_esc(level.name)}
            </span>
            ${nextLevel
              ? `<span style="font-size:.75rem;color:var(--text-3);">${(_profile.xp || 0)} / ${nextLevel.minXP} XP &rarr; ${_esc(nextLevel.name)}</span>`
              : `<span style="font-size:.75rem;color:var(--text-3);font-weight:700;">Max Level</span>`}
          </div>
          <div class="game-xp-track">
            <div class="game-xp-fill" style="width:${xpPct}%;"></div>
          </div>
        </div>

        ${challengeNotif}
        ${awaitingNotif}

        <div style="display:flex;gap:.625rem;flex-wrap:wrap;justify-content:center;margin:.75rem 0;">
          <button onclick="Game.openLeaderboard()" class="btn bg-gray-500" style="display:flex;align-items:center;gap:.375rem;">
            ${_icon('trophy', 15)} Leaderboard
          </button>
          <button onclick="Game._backToHome()" class="btn bg-gray-500" style="display:flex;align-items:center;gap:.375rem;">
            ${_icon('arrowLeft', 15)} Back
          </button>
        </div>

        <h2 class="game-section-title">Choose a Game</h2>

        <div class="game-cards-grid">

          <div class="game-card" onclick="Game._selectGame('quizBlitz')">
            <div class="game-card__icon">${_icon('lightning', 32, { color: 'var(--accent)' })}</div>
            <div class="game-card__title">Quiz Blitz</div>
            <div class="game-card__desc">Answer 10 MCQ questions against the clock. Fast answers earn bonus XP.</div>
            <div class="game-card__meta">
              <span class="game-card__tag">MCQ</span>
              <span class="game-card__tag">15s / question</span>
              <span class="game-card__tag game-card__tag--xp">+${XP_PER_CORRECT * QUIZ_BLITZ_QUESTIONS} XP max</span>
            </div>
          </div>

          <div class="game-card" onclick="Game._selectGame('speedMath')">
            <div class="game-card__icon">${_icon('calculator', 32, { color: '#f59e0b' })}</div>
            <div class="game-card__title">Speed Math</div>
            <div class="game-card__desc">Solve arithmetic problems as fast as you can. Choose Easy, Medium, or Hard.</div>
            <div class="game-card__meta">
              <span class="game-card__tag">Arithmetic</span>
              <span class="game-card__tag">90s total</span>
              <span class="game-card__tag game-card__tag--xp">+XP per correct</span>
            </div>
          </div>

          <div class="game-card" onclick="Game._selectGame('wordScramble')">
            <div class="game-card__icon">${_icon('textT', 32, { color: '#7c3aed' })}</div>
            <div class="game-card__title">Word Scramble</div>
            <div class="game-card__desc">Unscramble subject vocabulary words before time runs out. Up to 3 reshuffles per word.</div>
            <div class="game-card__meta">
              <span class="game-card__tag">Vocabulary</span>
              <span class="game-card__tag">20s / word</span>
              <span class="game-card__tag game-card__tag--xp">+${XP_PER_CORRECT} XP per word</span>
            </div>
          </div>

          <div class="game-card game-card--challenge" onclick="Game._selectGame('challenge')">
            <div class="game-card__icon">${_icon('swords', 32, { color: 'var(--danger)' })}</div>
            <div class="game-card__title">Challenge a Classmate</div>
            <div class="game-card__desc">Send a quiz challenge to someone in your class. Beat their score to win.</div>
            <div class="game-card__meta">
              <span class="game-card__tag">PvP</span>
              <span class="game-card__tag">1v1</span>
              <span class="game-card__tag game-card__tag--xp">+${XP_CHALLENGE_WIN} bonus XP for winning</span>
            </div>
          </div>

        </div>

        <h2 class="game-section-title" style="margin-top:1.5rem;">Your Badges</h2>
        <div class="glass-dark" style="padding:1rem;border-radius:10px;display:flex;flex-wrap:wrap;gap:.5rem;">
          ${badgesHtml}
        </div>

        <h2 class="game-section-title" style="margin-top:1.5rem;">Your Stats</h2>
        <div class="game-stats-row glass-dark">
          <div class="game-stat-cell">
            <div class="game-stat-cell__value">${(_profile.totalGames || 0)}</div>
            <div class="game-stat-cell__label">Games Played</div>
          </div>
          <div class="game-stat-cell">
            <div class="game-stat-cell__value">${(_profile.totalWins || 0)}</div>
            <div class="game-stat-cell__label">Games Won</div>
          </div>
          <div class="game-stat-cell">
            <div class="game-stat-cell__value">${(_profile.streak || 0)}</div>
            <div class="game-stat-cell__label">Win Streak</div>
          </div>
          <div class="game-stat-cell">
            <div class="game-stat-cell__value" style="color:var(--accent);">${(_profile.xp || 0).toLocaleString()}</div>
            <div class="game-stat-cell__label">Total XP</div>
          </div>
        </div>

      </div>`);

    _updateGameNavBadge(pendingChallenges.length + awaitingPlay.length);
  }

  /* ══════════════════════════════════════════════════════════════
     GAME SELECTION
  ══════════════════════════════════════════════════════════════ */

  function _selectGame(type) {
    if      (type === 'quizBlitz')    _showQuizBlitzSetup();
    else if (type === 'speedMath')    _showSpeedMathSetup();
    else if (type === 'wordScramble') _showWordScrambleSetup();
    else if (type === 'challenge')    _showChallengeSetup();
  }

  /* ══════════════════════════════════════════════════════════════
     QUIZ BLITZ
  ══════════════════════════════════════════════════════════════ */

  function _showQuizBlitzSetup() {
    const subjects = _getSubjectsForStudent();
    if (subjects.length === 0) {
      window.UI.toast('No subjects found for your class. Contact your teacher.', 'error');
      return;
    }

    const subjectOptions = subjects.map(s =>
      `<option value="${_esc(s)}">${_esc(s)}</option>`
    ).join('');

    _showModal(`
      <div style="text-align:center;margin-bottom:1.25rem;">
        <div style="margin-bottom:.5rem;">${_icon('lightning', 40, { color: 'var(--accent)' })}</div>
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">Quiz Blitz Setup</h2>
        <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;">
          ${QUIZ_BLITZ_QUESTIONS} questions &middot; ${QUIZ_BLITZ_TIME}s each &middot; Speed bonus XP
        </p>
      </div>
      <div style="margin-bottom:1rem;">
        <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.375rem;">Choose Subject</label>
        <select id="quizBlitzSubject" style="width:100%;">
          <option value="random">Random Mix (all subjects)</option>
          ${subjectOptions}
        </select>
      </div>
      <div style="margin-bottom:1.5rem;">
        <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.375rem;">Number of Questions</label>
        <select id="quizBlitzCount" style="width:100%;">
          <option value="10">10 questions</option>
          <option value="20">20 questions</option>
          <option value="30">30 questions</option>
        </select>
      </div>
      <button onclick="Game._startQuizBlitz()" class="btn btn-lg w-full" style="background:var(--accent);">
        Start Quiz Blitz
      </button>
      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Cancel</button>
    `);
  }

  function _startQuizBlitz() {
    const subject = document.getElementById('quizBlitzSubject')?.value || 'random';
    const count   = parseInt(document.getElementById('quizBlitzCount')?.value || '10', 10);

    let questions = [];
    if (subject === 'random') {
      const subjects = _getSubjectsForStudent();
      if (subjects.length === 0) { window.UI.toast('No subjects found.', 'error'); return; }
      const perSubj  = Math.ceil(count / subjects.length);
      subjects.forEach(s => {
        questions = questions.concat(_getQuestionsForSubject(s, perSubj).map(q => ({ ...q, subject: s })));
      });
      questions = _shuffleArray(questions).slice(0, count);
    } else {
      questions = _getQuestionsForSubject(subject, count).map(q => ({ ...q, subject }));
    }

    if (questions.length === 0) {
      window.UI.toast('No questions available for that subject.', 'error');
      return;
    }

    _gameState = {
      type:         'quizBlitz',
      questions,
      currentIndex: 0,
      answers:      [],
      score:        0,
      xpEarned:     0,
      speedBonuses: 0,
      startedAt:    Date.now(),
    };

    _closeModal();
    _speedDemonCount = 0;
    _renderQuizBlitzQuestion();
  }

  function _renderQuizBlitzQuestion() {
    const gs = _gameState;
    if (!gs || gs.type !== 'quizBlitz') return;

    const q        = gs.questions[gs.currentIndex];
    const progress = gs.currentIndex + 1;
    const total    = gs.questions.length;
    const pctWidth = Math.round((progress / total) * 100);
    const correct  = gs.answers.filter((a, i) => a !== null && a === gs.questions[i]?.ans).length;

    _questionStartTime = Date.now();

    window.UI.mount(`
      <div class="max-w-2xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">

        <div class="glass game-quiz-header">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;">
            <div>
              <span style="font-size:.75rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;">
                ${_icon('lightning', 13)} Quiz Blitz
              </span>
              <div style="font-size:.875rem;color:var(--text-2);margin-top:1px;">
                ${_esc(q.subject || '')} &middot; Q${progress} of ${total}
              </div>
            </div>
            <div style="text-align:right;">
              <div id="quizTimer" class="game-timer timer-green">${QUIZ_BLITZ_TIME}</div>
              <div style="font-size:.6875rem;color:var(--text-4);">seconds left</div>
            </div>
          </div>
          <div class="game-progress-track">
            <div class="game-progress-fill" style="width:${pctWidth}%;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:.375rem;">
            <span style="font-size:.6875rem;color:var(--text-4);">${correct} correct</span>
            <span style="font-size:.6875rem;color:var(--accent);font-weight:700;">${gs.xpEarned} XP earned</span>
          </div>
        </div>

        <div class="glass" style="padding:1.25rem 1.5rem;margin:.75rem 0;">
          <p style="font-size:1.0625rem;font-weight:500;line-height:1.65;margin-bottom:1.25rem;">
            ${_esc(q.q)}
          </p>
          <div id="quizOptions">
            ${q.opts.map((opt, idx) => `
              <button class="game-option-btn" id="quizOpt${idx}"
                      onclick="Game._answerQuizBlitz(${idx})">
                <span class="game-option-btn__letter">${String.fromCharCode(65 + idx)}</span>
                <span>${_esc(opt)}</span>
              </button>`).join('')}
          </div>
        </div>

        <div style="text-align:center;">
          <button onclick="Game._abandonGame()" class="btn bg-gray-500" style="font-size:.8125rem;display:inline-flex;align-items:center;gap:.3rem;">
            ${_icon('x', 13)} Quit Game
          </button>
        </div>

      </div>`);

    _timerEl = document.getElementById('quizTimer');
    _startTimer(QUIZ_BLITZ_TIME,
      (s) => {
        if (_timerEl) {
          _timerEl.textContent = s;
          _timerEl.className   = 'game-timer ' + (s <= 5 ? 'timer-red' : s <= 10 ? 'timer-yellow' : 'timer-green');
        }
      },
      () => { _answerQuizBlitz(null); }
    );
  }

  function _answerQuizBlitz(chosenIdx) {
    _stopTimer();
    const gs = _gameState;
    if (!gs || gs.type !== 'quizBlitz') return;
    if (gs.answers.length > gs.currentIndex) return;

    const q       = gs.questions[gs.currentIndex];
    const correct = chosenIdx !== null && chosenIdx === q.ans;
    const elapsed = (Date.now() - _questionStartTime) / 1000;

    document.querySelectorAll('.game-option-btn').forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.ans)          btn.classList.add('game-option-btn--correct');
      else if (i === chosenIdx) btn.classList.add('game-option-btn--wrong');
    });

    let xpThis = 0;
    if (correct) {
      xpThis += XP_PER_CORRECT;
      if (elapsed < 5) { xpThis += XP_SPEED_BONUS; gs.speedBonuses++; _speedDemonCount++; }
    }
    gs.xpEarned += xpThis;
    gs.answers.push(chosenIdx);
    if (correct) gs.score++;

    setTimeout(() => {
      gs.currentIndex++;
      if (gs.currentIndex >= gs.questions.length) {
        _finishQuizBlitz();
      } else {
        _renderQuizBlitzQuestion();
      }
    }, 1200);
  }

  async function _finishQuizBlitz() {
    const gs = _gameState;
    _stopTimer();
    _gameState = null;

    const total   = gs.questions.length;
    const correct = gs.score;
    const pct     = Math.round((correct / total) * 100);
    const perfect = correct === total;
    const win     = pct >= 60;

    let xpFinal = gs.xpEarned;
    if (perfect) xpFinal += XP_PER_PERFECT;

    const result = await _awardXP(xpFinal, 'quizBlitz', {
      win, perfect, speedDemonCount: _speedDemonCount,
    });

    await _saveGameResult('quizBlitz', { correct, total, pct, xpEarned: xpFinal, perfect });

    _renderGameResult({
      gameIcon:   'lightning',
      gameName:   'Quiz Blitz',
      score:      `${correct} / ${total}`,
      pct,
      xpEarned:   xpFinal,
      perfect,
      win,
      result,
      extras: [
        { label: 'Speed Bonuses', value: `+${gs.speedBonuses * XP_SPEED_BONUS} XP` },
        { label: 'Perfect Bonus', value: perfect ? `+${XP_PER_PERFECT} XP` : '—' },
      ],
      onPlayAgainKey: 'quizBlitz',
    });
  }

  /* ══════════════════════════════════════════════════════════════
     SPEED MATH
  ══════════════════════════════════════════════════════════════ */

  const _mathProblems = {
    easy: () => {
      const ops = ['+', '-'];
      const op  = ops[Math.floor(Math.random() * ops.length)];
      if (op === '+') { const a = _rnd(1, 50),  b = _rnd(1, 50);  return { q: `${a} + ${b} = ?`,  ans: a + b }; }
      else             { const a = _rnd(10, 99), b = _rnd(1, a);   return { q: `${a} − ${b} = ?`, ans: a - b }; }
    },
    medium: () => {
      const ops = ['+', '-', '×'];
      const op  = ops[Math.floor(Math.random() * ops.length)];
      if (op === '+') { const a = _rnd(20, 200), b = _rnd(20, 200); return { q: `${a} + ${b} = ?`,   ans: a + b }; }
      if (op === '-') { const a = _rnd(50, 300), b = _rnd(1, a);    return { q: `${a} − ${b} = ?`,   ans: a - b }; }
                        const a = _rnd(2, 12),   b = _rnd(2, 12);   return { q: `${a} × ${b} = ?`,   ans: a * b };
    },
    hard: () => {
      const ops = ['×', '÷', 'sq', 'mixed'];
      const op  = ops[Math.floor(Math.random() * ops.length)];
      if (op === '×')     { const a = _rnd(13, 25), b = _rnd(13, 25);      return { q: `${a} × ${b} = ?`,        ans: a * b };  }
      if (op === '÷')     { const b = _rnd(2, 12),  a = b * _rnd(2, 12);   return { q: `${a} ÷ ${b} = ?`,        ans: a / b };  }
      if (op === 'sq')    { const a = _rnd(5, 20);                          return { q: `${a}² = ?`,              ans: a * a };  }
      /* mixed */           const a = _rnd(10, 50), b = _rnd(2, 12), c = _rnd(1, 20);
                            return { q: `(${a} × ${b}) + ${c} = ?`,         ans: (a * b) + c };
    },
  };

  function _rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function _showSpeedMathSetup() {
    _showModal(`
      <div style="text-align:center;margin-bottom:1.25rem;">
        <div style="margin-bottom:.5rem;">${_icon('calculator', 40, { color: '#f59e0b' })}</div>
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">Speed Math Setup</h2>
        <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;">
          Solve as many problems as you can in 90 seconds!
        </p>
      </div>
      <div style="margin-bottom:1.5rem;">
        <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.5rem;">Difficulty</label>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;" id="diffGrid">
          <label class="game-diff-option selected" data-diff="easy">
            <input type="radio" name="mathDiff" value="easy" checked style="display:none;" />
            <span class="game-diff-option__icon" style="color:#22c55e;">${_icon('checkCircle', 20, { color: '#22c55e' })}</span>
            <span class="game-diff-option__name">Easy</span>
            <span class="game-diff-option__desc">+, − only</span>
          </label>
          <label class="game-diff-option" data-diff="medium">
            <input type="radio" name="mathDiff" value="medium" style="display:none;" />
            <span class="game-diff-option__icon">${_icon('warning', 20, { color: '#f59e0b' })}</span>
            <span class="game-diff-option__name">Medium</span>
            <span class="game-diff-option__desc">+, −, ×</span>
          </label>
          <label class="game-diff-option" data-diff="hard">
            <input type="radio" name="mathDiff" value="hard" style="display:none;" />
            <span class="game-diff-option__icon">${_icon('flame', 20, { color: '#ef4444' })}</span>
            <span class="game-diff-option__name">Hard</span>
            <span class="game-diff-option__desc">All ops + squares</span>
          </label>
        </div>
      </div>
      <button onclick="Game._startSpeedMath()" class="btn btn-lg w-full" style="background:var(--warning);color:#fff;">
        Start Speed Math
      </button>
      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Cancel</button>
    `);

    document.getElementById('diffGrid').addEventListener('change', (e) => {
      document.querySelectorAll('.game-diff-option').forEach(x => x.classList.remove('selected'));
      e.target.closest('.game-diff-option')?.classList.add('selected');
    });
  }

  function _startSpeedMath() {
    const radio = document.querySelector('input[name="mathDiff"]:checked');
    const diff  = radio ? radio.value : 'easy';
    _closeModal();

    _gameState = {
      type:           'speedMath',
      difficulty:     diff,
      totalTime:      90,
      score:          0,
      attempted:      0,
      xpEarned:       0,
      startedAt:      Date.now(),
      currentProblem: _mathProblems[diff](),
    };

    _renderSpeedMathQuestion();
  }

  function _renderSpeedMathQuestion() {
    const gs = _gameState;
    if (!gs || gs.type !== 'speedMath') return;

    const p         = gs.currentProblem;
    const diffColor = gs.difficulty === 'hard' ? 'var(--danger)' : gs.difficulty === 'medium' ? 'var(--warning)' : 'var(--success)';
    const diffLabel = gs.difficulty.charAt(0).toUpperCase() + gs.difficulty.slice(1);
    const elapsed   = Math.floor((Date.now() - gs.startedAt) / 1000);
    const remaining = Math.max(0, gs.totalTime - elapsed);

    window.UI.mount(`
      <div class="max-w-xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">

        <div class="glass game-quiz-header">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
            <div>
              <span style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${diffColor};">
                ${_icon('calculator', 13)} Speed Math &middot; ${_esc(diffLabel)}
              </span>
            </div>
            <div style="text-align:right;">
              <div id="mathTimer" class="game-timer timer-green">${remaining}</div>
              <div style="font-size:.6875rem;color:var(--text-4);">total time</div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:.25rem;">
            <span style="font-size:.875rem;color:var(--text-2);" id="mathScoreDisplay">${gs.score} correct &middot; ${gs.attempted} attempted</span>
            <span style="font-size:.875rem;color:var(--accent);font-weight:700;" id="mathXpDisplay">${gs.xpEarned} XP</span>
          </div>
        </div>

        <div class="glass" style="padding:2rem 1.5rem;margin:.75rem 0;text-align:center;">
          <p id="mathProblem" style="font-size:2.25rem;font-weight:800;color:var(--text-1);font-family:var(--font-mono);letter-spacing:-.02em;margin-bottom:1.5rem;">
            ${_esc(p.q)}
          </p>
          <input id="mathAnswer" type="number" inputmode="numeric" placeholder="Your answer"
                 style="font-size:1.5rem;text-align:center;max-width:200px;width:100%;
                        padding:.625rem 1rem;border-radius:10px;"
                 autofocus onkeydown="if(event.key==='Enter')Game._submitMathAnswer()" />
          <div style="margin-top:1rem;">
            <button onclick="Game._submitMathAnswer()" class="btn btn-lg" style="background:${diffColor};color:#fff;min-width:120px;">
              Submit
            </button>
          </div>
        </div>

        <div id="mathFeedback" style="text-align:center;min-height:1.5rem;font-size:.9375rem;font-weight:700;transition:opacity .3s;"></div>

        <div style="text-align:center;margin-top:1rem;">
          <button onclick="Game._abandonGame()" class="btn bg-gray-500" style="font-size:.8125rem;display:inline-flex;align-items:center;gap:.3rem;">
            ${_icon('x', 13)} Quit Game
          </button>
        </div>

      </div>`);

    _timerEl = document.getElementById('mathTimer');

    _startTimer(remaining,
      (s) => {
        if (_timerEl) {
          _timerEl.textContent = s;
          _timerEl.className   = 'game-timer ' + (s <= 10 ? 'timer-red' : s <= 30 ? 'timer-yellow' : 'timer-green');
        }
      },
      () => { _finishSpeedMath(); }
    );

    document.getElementById('mathAnswer')?.focus();
  }

  function _submitMathAnswer() {
    const gs  = _gameState;
    if (!gs || gs.type !== 'speedMath') return;

    const input = document.getElementById('mathAnswer');
    if (!input) return;
    const val   = parseInt(input.value, 10);
    if (isNaN(val)) { window.UI.toast('Please enter a number.', 'warning'); return; }

    const correct = val === gs.currentProblem.ans;
    const prevAns = gs.currentProblem.ans;
    gs.attempted++;
    if (correct) {
      gs.score++;
      gs.xpEarned += XP_PER_CORRECT;
    }

    const fb = document.getElementById('mathFeedback');
    if (fb) {
      fb.style.color  = correct ? 'var(--success)' : 'var(--danger)';
      fb.textContent  = correct ? `Correct! +${XP_PER_CORRECT} XP` : `Wrong. Answer was ${prevAns}`;
    }

    gs.currentProblem = _mathProblems[gs.difficulty]();

    const problemEl = document.getElementById('mathProblem');
    if (problemEl) problemEl.textContent = gs.currentProblem.q;

    const scoreEl = document.getElementById('mathScoreDisplay');
    if (scoreEl) scoreEl.textContent = `${gs.score} correct · ${gs.attempted} attempted`;

    const xpEl = document.getElementById('mathXpDisplay');
    if (xpEl) xpEl.textContent = `${gs.xpEarned} XP`;

    input.value = '';
    input.focus();

    setTimeout(() => {
      if (fb) fb.textContent = '';
    }, 900);
  }

  async function _finishSpeedMath() {
    const gs = _gameState;
    _stopTimer();
    _gameState = null;

    const pct    = gs.attempted > 0 ? Math.round((gs.score / gs.attempted) * 100) : 0;
    const perfect = gs.score === gs.attempted && gs.attempted >= 5;
    const win    = pct >= 60 && gs.score >= 5;

    const result = await _awardXP(gs.xpEarned, 'speedMath', {
      win, perfect, difficulty: gs.difficulty,
    });

    await _saveGameResult('speedMath', {
      score:      gs.score,
      attempted:  gs.attempted,
      pct,
      xpEarned:   gs.xpEarned,
      difficulty: gs.difficulty,
    });

    _renderGameResult({
      gameIcon:   'calculator',
      gameName:   'Speed Math',
      score:      `${gs.score} / ${gs.attempted}`,
      pct,
      xpEarned:   gs.xpEarned,
      perfect,
      win,
      result,
      extras: [
        { label: 'Difficulty', value: gs.difficulty.charAt(0).toUpperCase() + gs.difficulty.slice(1) },
        { label: 'Accuracy',   value: pct + '%' },
      ],
      onPlayAgainKey: 'speedMath',
    });
  }

  /* ══════════════════════════════════════════════════════════════
     WORD SCRAMBLE
  ══════════════════════════════════════════════════════════════ */

  const _wordBank = [
    { word: 'PHOTOSYNTHESIS', hint: 'Process plants use to make food from sunlight' },
    { word: 'MITOSIS',        hint: 'Cell division that produces identical cells' },
    { word: 'OSMOSIS',        hint: 'Movement of water across a membrane' },
    { word: 'VELOCITY',       hint: 'Speed in a given direction' },
    { word: 'ACCELERATION',   hint: 'Rate of change of velocity' },
    { word: 'REFRACTION',     hint: 'Bending of light as it passes between media' },
    { word: 'CHROMOSOMES',    hint: 'Structures in cells that carry genes' },
    { word: 'EVOLUTION',      hint: 'Change in species over time by natural selection' },
    { word: 'PERIODIC',       hint: 'Arranged in a recurring pattern (as the elements)' },
    { word: 'NEUTRALIZATION', hint: 'Acid + base reaction to form salt and water' },
    { word: 'ELECTROMAGNET',  hint: 'Magnet created by electric current' },
    { word: 'HYPOTHESIS',     hint: 'A testable explanation for an observation' },
    { word: 'DIFFUSION',      hint: 'Spreading of particles from high to low concentration' },
    { word: 'RESPIRATION',    hint: 'Process of releasing energy from glucose in cells' },
    { word: 'GRAVITATIONAL',  hint: 'Force of attraction between masses' },
    { word: 'POLYNOMIAL',     hint: 'Mathematical expression with many terms' },
    { word: 'QUADRATIC',      hint: 'Equation involving a variable to the power of 2' },
    { word: 'PERPENDICULAR',  hint: 'Lines that meet at a right angle' },
    { word: 'EQUIVALENT',     hint: 'Having the same value or effect' },
    { word: 'METABOLISM',     hint: 'All chemical reactions in a living organism' },
    { word: 'DEMOCRACY',      hint: 'System of government by the people' },
    { word: 'PARLIAMENT',     hint: 'Legislative body of a country' },
    { word: 'JUDICIARY',      hint: 'Branch of government that interprets laws' },
    { word: 'CONSTITUTION',   hint: 'Fundamental law of a country' },
    { word: 'SOVEREIGNTY',    hint: 'Supreme authority of a state over itself' },
  ];

  function _scrambleWord(word) {
    const letters = word.split('');
    const allSame = letters.every(l => l === letters[0]);
    if (allSame) return word;
    let scrambled = word;
    let attempts  = 0;
    while (scrambled === word && attempts < 50) {
      scrambled = _shuffleArray(letters).join('');
      attempts++;
    }
    return scrambled;
  }

  function _showWordScrambleSetup() {
    _showModal(`
      <div style="text-align:center;margin-bottom:1.25rem;">
        <div style="margin-bottom:.5rem;">${_icon('textT', 40, { color: '#7c3aed' })}</div>
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">Word Scramble Setup</h2>
        <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;">
          Unscramble vocabulary words before time runs out. Up to ${MAX_SHUFFLES} reshuffles per word.
        </p>
      </div>
      <div style="margin-bottom:1.5rem;">
        <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.375rem;">Number of Words</label>
        <select id="scrambleCount" style="width:100%;">
          <option value="10">10 words</option>
          <option value="15">15 words</option>
          <option value="20">20 words</option>
        </select>
      </div>
      <button onclick="Game._startWordScramble()" class="btn btn-lg w-full" style="background:#7c3aed;color:#fff;">
        Start Word Scramble
      </button>
      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Cancel</button>
    `);
  }

  function _startWordScramble() {
    const count = parseInt(document.getElementById('scrambleCount')?.value || '10', 10);
    const words = _shuffleArray([..._wordBank]).slice(0, count);
    _closeModal();

    _gameState = {
      type:            'wordScramble',
      words,
      currentIndex:    0,
      score:           0,
      xpEarned:        0,
      wordCorrect:     0,
      startedAt:       Date.now(),
      shufflesLeft:    MAX_SHUFFLES,
      currentScramble: '',
    };

    _gameState.currentScramble = _scrambleWord(words[0].word);
    _renderWordScrambleQuestion();
  }

  function _renderWordScrambleQuestion() {
    const gs = _gameState;
    if (!gs || gs.type !== 'wordScramble') return;

    const entry    = gs.words[gs.currentIndex];
    const scramble = gs.currentScramble || _scrambleWord(entry.word);
    gs.currentScramble = scramble;

    const progress = gs.currentIndex + 1;
    const total    = gs.words.length;
    const pctWidth = Math.round((progress / total) * 100);

    window.UI.mount(`
      <div class="max-w-xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">

        <div class="glass game-quiz-header">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;">
            <div>
              <span style="font-size:.75rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;">
                ${_icon('textT', 13)} Word Scramble
              </span>
              <div style="font-size:.875rem;color:var(--text-2);margin-top:1px;">Word ${progress} of ${total}</div>
            </div>
            <div style="text-align:right;">
              <div id="scrambleTimer" class="game-timer timer-green">${WORD_SCRAMBLE_TIME}</div>
              <div style="font-size:.6875rem;color:var(--text-4);">seconds</div>
            </div>
          </div>
          <div class="game-progress-track">
            <div class="game-progress-fill" style="width:${pctWidth}%;background:#7c3aed;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:.375rem;">
            <span style="font-size:.6875rem;color:var(--text-4);">${gs.score} correct</span>
            <span style="font-size:.6875rem;color:var(--accent);font-weight:700;">${gs.xpEarned} XP</span>
          </div>
        </div>

        <div class="glass" style="padding:1.75rem 1.5rem;margin:.75rem 0;text-align:center;">
          <p style="font-size:.8125rem;color:var(--text-3);margin-bottom:.625rem;font-style:italic;">
            ${_icon('info', 13)} ${_esc(entry.hint)}
          </p>
          <div class="game-scrambled-letters" id="scrambleLetters">
            ${scramble.split('').map(l => `<span class="game-letter-tile">${_esc(l)}</span>`).join('')}
          </div>
          <div style="display:flex;align-items:center;justify-content:center;gap:.5rem;margin:.25rem 0 .75rem;">
            <p style="font-size:.75rem;color:var(--text-4);margin:0;">${entry.word.length} letters</p>
            <button id="shuffleBtn" onclick="Game._reshuffleWord()"
                    class="game-shuffle-btn ${gs.shufflesLeft <= 0 ? 'game-shuffle-btn--disabled' : ''}"
                    ${gs.shufflesLeft <= 0 ? 'disabled' : ''}
                    title="Reshuffle letters (${gs.shufflesLeft} left)">
              ${_icon('shuffle', 14)} Reshuffle
              <span class="game-shuffle-count">${gs.shufflesLeft}</span>
            </button>
          </div>
          <input id="scrambleInput" type="text" placeholder="Type the word here..."
                 style="font-size:1.125rem;text-align:center;text-transform:uppercase;max-width:280px;width:100%;letter-spacing:.1em;"
                 autofocus maxlength="${entry.word.length + 2}"
                 onkeydown="if(event.key==='Enter')Game._submitScrambleAnswer()" />
          <div style="margin-top:1rem;display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap;">
            <button onclick="Game._submitScrambleAnswer()" class="btn" style="background:#7c3aed;color:#fff;">Submit</button>
            <button onclick="Game._skipScramble()" class="btn bg-gray-500" style="display:inline-flex;align-items:center;gap:.3rem;">
              ${_icon('skipForward', 13)} Skip
            </button>
          </div>
        </div>

        <div id="scrambleFeedback" style="text-align:center;min-height:1.5rem;font-size:.9375rem;font-weight:700;"></div>

        <div style="text-align:center;margin-top:1rem;">
          <button onclick="Game._abandonGame()" class="btn bg-gray-500" style="font-size:.8125rem;display:inline-flex;align-items:center;gap:.3rem;">
            ${_icon('x', 13)} Quit Game
          </button>
        </div>

      </div>`);

    _timerEl = document.getElementById('scrambleTimer');
    _startTimer(WORD_SCRAMBLE_TIME,
      (s) => {
        if (_timerEl) {
          _timerEl.textContent = s;
          _timerEl.className   = 'game-timer ' + (s <= 5 ? 'timer-red' : s <= 10 ? 'timer-yellow' : 'timer-green');
        }
      },
      () => { _skipScramble(); }
    );

    document.getElementById('scrambleInput')?.focus();
  }

  function _reshuffleWord() {
    const gs = _gameState;
    if (!gs || gs.type !== 'wordScramble') return;
    if (gs.shufflesLeft <= 0) return;

    const entry   = gs.words[gs.currentIndex];
    let newScram  = gs.currentScramble;
    let attempts  = 0;

    while (newScram === gs.currentScramble && attempts < 30) {
      newScram = _scrambleWord(entry.word);
      attempts++;
    }

    gs.currentScramble = newScram;
    gs.shufflesLeft--;

    const tilesEl = document.getElementById('scrambleLetters');
    if (tilesEl) {
      tilesEl.innerHTML = newScram.split('').map(l => `<span class="game-letter-tile">${_esc(l)}</span>`).join('');
      tilesEl.classList.remove('game-tiles-bounce');
      void tilesEl.offsetWidth;
      tilesEl.classList.add('game-tiles-bounce');
    }

    const shuffleBtn = document.getElementById('shuffleBtn');
    const countEl    = shuffleBtn?.querySelector('.game-shuffle-count');
    if (countEl) countEl.textContent = gs.shufflesLeft;
    if (gs.shufflesLeft <= 0 && shuffleBtn) {
      shuffleBtn.disabled = true;
      shuffleBtn.classList.add('game-shuffle-btn--disabled');
    }

    document.getElementById('scrambleInput')?.focus();
  }

  function _submitScrambleAnswer() {
    const gs = _gameState;
    if (!gs || gs.type !== 'wordScramble') return;
    _stopTimer();

    const input   = document.getElementById('scrambleInput');
    const val     = (input ? input.value : '').trim().toUpperCase();
    const correct = val === gs.words[gs.currentIndex].word;

    const fb = document.getElementById('scrambleFeedback');
    if (fb) {
      fb.style.color = correct ? 'var(--success)' : 'var(--danger)';
      fb.textContent = correct
        ? `Correct! +${XP_PER_CORRECT} XP`
        : `Wrong. The word was ${gs.words[gs.currentIndex].word}`;
    }

    if (correct) { gs.score++; gs.xpEarned += XP_PER_CORRECT; gs.wordCorrect++; }

    setTimeout(() => {
      gs.currentIndex++;
      if (gs.currentIndex >= gs.words.length) {
        _finishWordScramble();
      } else {
        gs.shufflesLeft    = MAX_SHUFFLES;
        gs.currentScramble = _scrambleWord(gs.words[gs.currentIndex].word);
        _renderWordScrambleQuestion();
      }
    }, 1200);
  }

  function _skipScramble() {
    _stopTimer();
    const gs = _gameState;
    if (!gs || gs.type !== 'wordScramble') return;

    const fb = document.getElementById('scrambleFeedback');
    if (fb) {
      fb.style.color = 'var(--text-3)';
      fb.textContent = `Skipped. The word was ${gs.words[gs.currentIndex].word}`;
    }

    setTimeout(() => {
      gs.currentIndex++;
      if (gs.currentIndex >= gs.words.length) {
        _finishWordScramble();
      } else {
        gs.shufflesLeft    = MAX_SHUFFLES;
        gs.currentScramble = _scrambleWord(gs.words[gs.currentIndex].word);
        _renderWordScrambleQuestion();
      }
    }, 1200);
  }

  async function _finishWordScramble() {
    const gs = _gameState;
    _stopTimer();
    _gameState = null;

    const total   = gs.words.length;
    const correct = gs.score;
    const pct     = Math.round((correct / total) * 100);
    const perfect = correct === total;
    const win     = pct >= 60;

    const result = await _awardXP(gs.xpEarned, 'wordScramble', {
      win, perfect, wordCorrect: gs.wordCorrect,
    });

    await _saveGameResult('wordScramble', { correct, total, pct, xpEarned: gs.xpEarned });

    _renderGameResult({
      gameIcon:   'textT',
      gameName:   'Word Scramble',
      score:      `${correct} / ${total}`,
      pct,
      xpEarned:   gs.xpEarned,
      perfect,
      win,
      result,
      extras:     [],
      onPlayAgainKey: 'wordScramble',
    });
  }

  /* ══════════════════════════════════════════════════════════════
     CHALLENGE SYSTEM
     
     FIX: The original code tried to fetch the target student's
     doc to get their name, but Firestore rules only allow a
     student to read their own doc. This caused a permission-denied
     error and the "Could not send challenge" message.
     
     Solution: We now read the target name directly from the
     select element's option text — the classmates list was already
     loaded and their names are in the <option> labels. No extra
     Firestore read needed.
  ══════════════════════════════════════════════════════════════ */

  async function _showChallengeSetup() {
    const myClass = _student().class || '';
    if (!myClass) { window.UI.toast('Your class is not set. Contact your teacher.', 'error'); return; }

    let classmates = [];
    try {
      // Use the shared student cache from Teacher module if available (avoids a re-query)
      // Otherwise query the students collection — students are allowed to list() per Firestore rules
      const snap = await _db().collection('students').where('class', '==', myClass).get();
      snap.forEach(doc => {
        if (doc.id !== _uid()) {
          classmates.push({ id: doc.id, name: doc.data().name || 'Unknown' });
        }
      });
    } catch (e) {
      console.error('[game] _showChallengeSetup error loading classmates:', e);
      window.UI.toast('Could not load classmates. Please try again.', 'error');
      return;
    }

    if (classmates.length === 0) {
      window.UI.toast("No classmates found — you're the only one in your class!", 'info');
      return;
    }

    const subjects       = _getSubjectsForStudent();
    const subjectOptions = subjects.map(s => `<option value="${_esc(s)}">${_esc(s)}</option>`).join('');
    const classmateOptions = classmates
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(c => `<option value="${_esc(c.id)}">${_esc(c.name)}</option>`)
      .join('');

    _showModal(`
      <div style="text-align:center;margin-bottom:1.25rem;">
        <div style="margin-bottom:.5rem;">${_icon('swords', 40, { color: 'var(--danger)' })}</div>
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">Challenge a Classmate</h2>
        <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;">
          Both of you answer the same 10 questions. Highest score wins.
        </p>
      </div>
      <div style="margin-bottom:.875rem;">
        <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.375rem;">Challenge Who?</label>
        <select id="challengeTarget" style="width:100%;">${classmateOptions}</select>
      </div>
      <div style="margin-bottom:1.5rem;">
        <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.375rem;">Subject</label>
        <select id="challengeSubject" style="width:100%;">
          <option value="random">Random Mix</option>
          ${subjectOptions}
        </select>
      </div>
      <button onclick="Game._sendChallenge()" class="btn btn-lg w-full" style="background:var(--danger);color:#fff;">
        ${_icon('swords', 16)} Send Challenge
      </button>
      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Cancel</button>
    `);
  }

  async function _sendChallenge() {
    const targetSel = document.getElementById('challengeTarget');
    const targetUid = targetSel ? targetSel.value : null;
    const subject   = document.getElementById('challengeSubject')?.value || 'random';

    if (!targetUid) { window.UI.toast('Please select a classmate.', 'warning'); return; }

    // FIX: Read the target name from the option label — no Firestore read needed.
    // This avoids the permission-denied error (students can only read their own doc).
    const selectedOption = targetSel.options[targetSel.selectedIndex];
    const targetName     = selectedOption ? selectedOption.text : 'Unknown';

    const sendBtn = document.querySelector('#gameModal .btn:not(.bg-gray-500)');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Sending…'; }

    let questions = [];
    if (subject === 'random') {
      const subjects = _getSubjectsForStudent();
      if (subjects.length === 0) {
        window.UI.toast('No questions available.', 'error');
        if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = `${_icon('swords', 16)} Send Challenge`; }
        return;
      }
      const perSubj = Math.ceil(10 / subjects.length);
      subjects.forEach(s => {
        questions = questions.concat(_getQuestionsForSubject(s, perSubj).map(q => ({ ...q, subject: s })));
      });
      questions = _shuffleArray(questions).slice(0, 10);
    } else {
      questions = _getQuestionsForSubject(subject, 10).map(q => ({ ...q, subject }));
    }

    if (questions.length === 0) {
      window.UI.toast('No questions available.', 'error');
      if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = `${_icon('swords', 16)} Send Challenge`; }
      return;
    }

    const questionData = questions.map(q => ({
      q:       q.q,
      opts:    q.opts,
      ans:     q.ans,
      exp:     q.exp || '',
      subject: q.subject,
    }));

    try {
      await _db().collection('gameChallenges').add({
        challengerUid:   _uid(),
        challengerName:  _student().name || '',
        challengedUid:   targetUid,
        challengedName:  targetName,
        subject,
        questions:       questionData,
        status:          'pending',
        challengerScore: null,
        challengedScore: null,
        createdAt:       firebase.firestore.FieldValue.serverTimestamp(),
        expiresAt:       new Date(Date.now() + CHALLENGE_EXPIRE_MS),
      });

      _closeModal();
      window.UI.toast(`Challenge sent to ${targetName}! They have 24 hours to respond.`, 'success', 5000);
    } catch (e) {
      console.error('[game] _sendChallenge error:', e);
      window.UI.toast('Could not send challenge. Please try again.', 'error');
      if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = `${_icon('swords', 16)} Send Challenge`; }
    }
  }

  async function _showPendingChallenges() {
    const uid = _uid();
    let challenges = [];
    try {
      const snap = await _db().collection('gameChallenges')
        .where('challengedUid', '==', uid)
        .where('status', '==', 'pending')
        .get();
      snap.docs.forEach(doc => {
        const d   = doc.data();
        const exp = d.expiresAt && d.expiresAt.toDate ? d.expiresAt.toDate() : null;
        if (!exp || exp > new Date()) challenges.push({ id: doc.id, ...d });
      });
    } catch (e) { window.UI.toast('Could not load challenges.', 'error'); return; }

    if (challenges.length === 0) {
      window.UI.toast('No pending challenges right now.', 'info');
      return;
    }

    const listHtml = challenges.map(c => {
      const exp    = c.expiresAt && c.expiresAt.toDate ? c.expiresAt.toDate() : null;
      const expStr = exp ? exp.toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;
                    background:var(--bg-base);border:1px solid var(--border);border-radius:8px;
                    padding:.75rem 1rem;margin-bottom:.5rem;">
          <div>
            <p style="font-size:.9375rem;font-weight:700;color:var(--text-1);">
              ${_icon('swords', 15)} ${_esc(c.challengerName)} challenged you!
            </p>
            <p style="font-size:.8125rem;color:var(--text-3);">
              Subject: ${_esc(c.subject === 'random' ? 'Mixed' : c.subject)} &middot; Expires ${_esc(expStr)}
            </p>
          </div>
          <button onclick="Game._acceptChallenge('${_esc(c.id)}')" class="btn" style="white-space:nowrap;flex-shrink:0;">
            Accept
          </button>
        </div>`;
    }).join('');

    _showModal(`
      <div style="margin-bottom:1rem;">
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">${_icon('swords', 18)} Pending Challenges</h2>
        <p style="font-size:.8125rem;color:var(--text-3);margin-top:.25rem;">
          Accept to play the same quiz and see who scores higher.
        </p>
      </div>
      <div>${listHtml}</div>
      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Close</button>
    `);
  }

  async function _showAwaitingChallenges() {
    const uid = _uid();
    let challenges = [];
    try {
      const snap = await _db().collection('gameChallenges')
        .where('challengerUid', '==', uid)
        .where('status', '==', 'awaiting_challenger')
        .get();
      snap.docs.forEach(doc => {
        const d   = doc.data();
        const exp = d.expiresAt && d.expiresAt.toDate ? d.expiresAt.toDate() : null;
        if (!exp || exp > new Date()) challenges.push({ id: doc.id, ...d });
      });
    } catch (e) { window.UI.toast('Could not load challenges.', 'error'); return; }

    if (challenges.length === 0) {
      window.UI.toast('No challenges waiting for your play.', 'info');
      return;
    }

    const listHtml = challenges.map(c => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;
                  background:var(--bg-base);border:1px solid var(--border);border-radius:8px;
                  padding:.75rem 1rem;margin-bottom:.5rem;">
        <div>
          <p style="font-size:.9375rem;font-weight:700;color:var(--text-1);">
            ${_icon('hourglass', 15)} ${_esc(c.challengedName)} responded!
          </p>
          <p style="font-size:.8125rem;color:var(--text-3);">
            Subject: ${_esc(c.subject === 'random' ? 'Mixed' : c.subject)} &middot; Your turn to play!
          </p>
        </div>
        <button onclick="Game._playChallengerTurn('${_esc(c.id)}')" class="btn" style="white-space:nowrap;flex-shrink:0;background:var(--danger);color:#fff;">
          Play Now
        </button>
      </div>`
    ).join('');

    _showModal(`
      <div style="margin-bottom:1rem;">
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">${_icon('hourglass', 18)} Your Turn to Play</h2>
        <p style="font-size:.8125rem;color:var(--text-3);margin-top:.25rem;">
          Your classmate already played. Play now to determine the winner.
        </p>
      </div>
      <div>${listHtml}</div>
      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Close</button>
    `);
  }

  async function _playChallengerTurn(challengeId) {
    _closeModal();
    let challengeData;
    try {
      const snap = await _db().collection('gameChallenges').doc(challengeId).get();
      if (!snap.exists) { window.UI.toast('Challenge no longer available.', 'error'); return; }
      challengeData = { id: snap.id, ...snap.data() };
    } catch (e) {
      window.UI.toast('Could not load challenge.', 'error');
      return;
    }

    // Guard: challenger already played
    if (challengeData.challengerScore !== null && challengeData.challengerScore !== undefined) {
      window.UI.toast("You've already played this challenge.", 'info');
      return;
    }

    _gameState = {
      type:             'challenge',
      challengeId,
      isChallengerTurn: true,
      questions:        challengeData.questions || [],
      currentIndex:     0,
      answers:          [],
      score:            0,
      xpEarned:         0,
      opponentName:     challengeData.challengedName,
      opponentScore:    challengeData.challengedScore,
      startedAt:        Date.now(),
    };

    _renderChallengeQuestion();
  }

  async function _acceptChallenge(challengeId) {
    _closeModal();
    let challengeData;
    try {
      const snap = await _db().collection('gameChallenges').doc(challengeId).get();
      if (!snap.exists) { window.UI.toast('Challenge no longer available.', 'error'); return; }
      challengeData = { id: snap.id, ...snap.data() };
    } catch (e) {
      window.UI.toast('Could not load challenge.', 'error');
      return;
    }

    // Guard: challenged player already played
    if (challengeData.challengedScore !== null && challengeData.challengedScore !== undefined) {
      window.UI.toast("You've already played this challenge.", 'info');
      return;
    }

    _gameState = {
      type:             'challenge',
      challengeId,
      isChallengerTurn: false,
      questions:        challengeData.questions || [],
      currentIndex:     0,
      answers:          [],
      score:            0,
      xpEarned:         0,
      opponentName:     challengeData.challengerName,
      opponentScore:    challengeData.challengerScore,
      startedAt:        Date.now(),
    };

    _renderChallengeQuestion();
  }

  function _renderChallengeQuestion() {
    const gs = _gameState;
    if (!gs || gs.type !== 'challenge') return;

    const q        = gs.questions[gs.currentIndex];
    const progress = gs.currentIndex + 1;
    const total    = gs.questions.length;
    const pctWidth = Math.round((progress / total) * 100);

    _questionStartTime = Date.now();

    window.UI.mount(`
      <div class="max-w-2xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">

        <div class="glass game-quiz-header" style="border-top:3px solid var(--danger);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;">
            <div>
              <span style="font-size:.75rem;font-weight:700;color:var(--danger);text-transform:uppercase;letter-spacing:.05em;">
                ${_icon('swords', 13)} Challenge vs ${_esc(gs.opponentName)}
              </span>
              <div style="font-size:.875rem;color:var(--text-2);margin-top:1px;">Q${progress} of ${total}</div>
            </div>
            <div style="text-align:right;">
              <div id="challengeTimer" class="game-timer timer-green">${QUIZ_BLITZ_TIME}</div>
              <div style="font-size:.6875rem;color:var(--text-4);">seconds</div>
            </div>
          </div>
          <div class="game-progress-track">
            <div class="game-progress-fill" style="width:${pctWidth}%;background:var(--danger);"></div>
          </div>
        </div>

        <div class="glass" style="padding:1.25rem 1.5rem;margin:.75rem 0;">
          <p style="font-size:1.0625rem;font-weight:500;line-height:1.65;margin-bottom:1.25rem;">
            ${_esc(q.q)}
          </p>
          <div id="challengeOptions">
            ${q.opts.map((opt, idx) => `
              <button class="game-option-btn" id="chOpt${idx}" onclick="Game._answerChallenge(${idx})">
                <span class="game-option-btn__letter">${String.fromCharCode(65 + idx)}</span>
                <span>${_esc(opt)}</span>
              </button>`).join('')}
          </div>
        </div>

        <div style="text-align:center;">
          <button onclick="Game._abandonGame()" class="btn bg-gray-500" style="font-size:.8125rem;display:inline-flex;align-items:center;gap:.3rem;">
            ${_icon('x', 13)} Quit
          </button>
        </div>

      </div>`);

    _timerEl = document.getElementById('challengeTimer');
    _startTimer(QUIZ_BLITZ_TIME,
      (s) => {
        if (_timerEl) {
          _timerEl.textContent = s;
          _timerEl.className   = 'game-timer ' + (s <= 5 ? 'timer-red' : s <= 10 ? 'timer-yellow' : 'timer-green');
        }
      },
      () => _answerChallenge(null)
    );
  }

  function _answerChallenge(chosenIdx) {
    _stopTimer();
    const gs = _gameState;
    if (!gs || gs.type !== 'challenge') return;
    if (gs.answers.length > gs.currentIndex) return;

    const q       = gs.questions[gs.currentIndex];
    const correct = chosenIdx !== null && chosenIdx === q.ans;

    document.querySelectorAll('.game-option-btn').forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.ans)          btn.classList.add('game-option-btn--correct');
      else if (i === chosenIdx) btn.classList.add('game-option-btn--wrong');
    });

    if (correct) { gs.score++; gs.xpEarned += XP_PER_CORRECT; }
    gs.answers.push(chosenIdx);

    setTimeout(() => {
      gs.currentIndex++;
      if (gs.currentIndex >= gs.questions.length) _finishChallenge();
      else _renderChallengeQuestion();
    }, 1200);
  }

  async function _finishChallenge() {
    const gs = _gameState;
    _stopTimer();
    _gameState = null;

    const total           = gs.questions.length;
    const myScore         = gs.score;
    const myPct           = Math.round((myScore / total) * 100);
    const opponentScore   = gs.opponentScore;
    const isChallengerTurn = gs.isChallengerTurn;

    let win          = false;
    let challengeWin = false;

    if (opponentScore !== null && opponentScore !== undefined) {
      win          = myScore > opponentScore;
      challengeWin = win;
      if (win) gs.xpEarned += XP_CHALLENGE_WIN;
    }

    try {
      const updatePayload = {
        [`result_${_uid()}`]: {
          score:       myScore,
          pct:         myPct,
          completedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
      };

      if (isChallengerTurn) {
        updatePayload.challengerScore = myScore;
        updatePayload.status          = 'completed';
      } else {
        updatePayload.challengedScore = myScore;
        updatePayload.status = (opponentScore !== null && opponentScore !== undefined) ? 'completed' : 'awaiting_challenger';
      }

      await _db().collection('gameChallenges').doc(gs.challengeId).update(updatePayload);
    } catch (e) { console.warn('[game] _finishChallenge update error:', e); }

    const result = await _awardXP(gs.xpEarned, 'challenge', { win, challengeWin });

    await _saveGameResult('challenge', {
      score:        myScore,
      total,
      pct:          myPct,
      xpEarned:     gs.xpEarned,
      challengeId:  gs.challengeId,
      opponentName: gs.opponentName,
    });

    let outcomeHtml = '';
    if (opponentScore !== null && opponentScore !== undefined) {
      const theirPct = Math.round((opponentScore / total) * 100);
      const tied     = myScore === opponentScore;
      outcomeHtml = `
        <div style="margin:.75rem 0;padding:.875rem 1rem;border-radius:10px;text-align:center;
                    background:${win ? 'var(--success-subtle)' : tied ? 'var(--warning-subtle)' : 'var(--danger-subtle)'};
                    border:2px solid ${win ? 'var(--success-border)' : tied ? 'var(--warning-border)' : 'var(--danger-border)'};">
          <div style="margin-bottom:.25rem;">${_icon(win ? 'trophy' : tied ? 'handWaving' : 'xCircle', 32, { color: win ? 'var(--success)' : tied ? 'var(--warning)' : 'var(--danger)' })}</div>
          <p style="font-weight:700;font-size:1rem;margin:.25rem 0;color:var(--text-1);">
            ${win ? 'You Won!' : tied ? "It's a Tie!" : 'You Lost!'}
          </p>
          <p style="font-size:.875rem;color:var(--text-2);">
            You: ${myScore}/${total} (${myPct}%) vs ${_esc(gs.opponentName)}: ${opponentScore}/${total} (${theirPct}%)
          </p>
          ${challengeWin ? `<p style="font-size:.875rem;font-weight:700;color:var(--success);">+${XP_CHALLENGE_WIN} bonus XP for winning!</p>` : ''}
        </div>`;
    } else {
      outcomeHtml = `
        <div style="margin:.75rem 0;padding:.875rem 1rem;border-radius:10px;text-align:center;
                    background:var(--info-subtle);border:1px solid var(--info-border);">
          <div style="margin-bottom:.25rem;">${_icon('hourglass', 32, { color: 'var(--accent)' })}</div>
          <p style="font-weight:700;font-size:1rem;margin:.25rem 0;color:var(--text-1);">Waiting for ${_esc(gs.opponentName)}!</p>
          <p style="font-size:.875rem;color:var(--text-2);">
            Your score: ${myScore}/${total} (${myPct}%). They'll be notified to play — check back later to see who won.
          </p>
        </div>`;
    }

    _renderGameResult({
      gameIcon:       'swords',
      gameName:       'Challenge',
      score:          `${myScore} / ${total}`,
      pct:            myPct,
      xpEarned:       gs.xpEarned,
      perfect:        false,
      win,
      result,
      extras:         [],
      extraHtml:      outcomeHtml,
      onPlayAgainKey: 'challenge',
    });
  }

  /* ══════════════════════════════════════════════════════════════
     GAME RESULT SCREEN
  ══════════════════════════════════════════════════════════════ */

  function _renderGameResult({ gameIcon, gameName, score, pct, xpEarned, perfect, win, result, extras, extraHtml, onPlayAgainKey }) {
    _stopTimer();

    const level   = result ? result.newLevel : _getLevelForXP((_profile && _profile.xp) || 0);
    const xpPct   = _profile ? _xpProgressPct(_profile.xp || 0) : 0;
    const nextLvl = _profile ? _getNextLevel(_profile.xp || 0) : null;

    const gradeColor = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';

    const badgeHtml = result && result.earnedBadges && result.earnedBadges.length > 0
      ? `<div class="game-badges-earned">
           <p style="font-size:.875rem;font-weight:700;color:var(--text-2);margin-bottom:.5rem;">New Badges Earned!</p>
           ${result.earnedBadges.map(bid => {
             const b = BADGES.find(x => x.id === bid);
             return b ? `<div class="game-badge-pop">${_icon(b.icon, 16)} <strong>${_esc(b.name)}</strong> — ${_esc(b.desc)}</div>` : '';
           }).join('')}
         </div>`
      : '';

    const extrasHtml = extras && extras.length > 0
      ? extras.map(e => `
          <div style="display:flex;justify-content:space-between;padding:.375rem 0;
                      border-bottom:1px solid var(--border);font-size:.875rem;">
            <span style="color:var(--text-3);">${_esc(e.label)}</span>
            <span style="font-weight:600;color:var(--text-1);">${_esc(String(e.value))}</span>
          </div>`).join('')
      : '';

    const playAgainAttrib = onPlayAgainKey ? `onclick="Game._playAgain('${_esc(onPlayAgainKey)}')"` : '';

    window.UI.mount(`
      <div class="max-w-xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">

        <div class="glass game-result-card">
          <div style="text-align:center;margin-bottom:1.5rem;">
            <div style="margin-bottom:.375rem;">${_icon(gameIcon, 48, { color: 'var(--accent)' })}</div>
            <h2 style="font-size:1.25rem;font-weight:700;color:var(--text-1);">${_esc(gameName)} Complete</h2>
          </div>

          <div style="display:flex;align-items:center;justify-content:center;gap:1.5rem;
                      background:var(--bg-subtle);border-radius:10px;padding:1.25rem;
                      margin-bottom:1.25rem;">
            <div style="text-align:center;">
              <div style="font-size:2.5rem;font-weight:800;color:${gradeColor};line-height:1;">${pct}%</div>
              <div style="font-size:.75rem;color:var(--text-3);margin-top:.25rem;">Score</div>
            </div>
            <div style="width:1px;height:40px;background:var(--border);"></div>
            <div style="text-align:center;">
              <div style="font-size:1.5rem;font-weight:700;color:var(--text-1);">${_esc(score)}</div>
              <div style="font-size:.75rem;color:var(--text-3);margin-top:.25rem;">Correct</div>
            </div>
            <div style="width:1px;height:40px;background:var(--border);"></div>
            <div style="text-align:center;">
              <div style="font-size:1.5rem;font-weight:700;color:var(--accent);">+${xpEarned}</div>
              <div style="font-size:.75rem;color:var(--text-3);margin-top:.25rem;">XP Earned</div>
            </div>
          </div>

          ${extraHtml || ''}

          ${extrasHtml ? `<div style="margin-bottom:1rem;">${extrasHtml}</div>` : ''}

          <div class="glass-dark" style="padding:.875rem 1rem;border-radius:8px;margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
              <span style="font-size:.875rem;font-weight:700;color:var(--text-2);display:flex;align-items:center;gap:.3rem;">
                ${_icon(level.icon, 14, { color: level.color })} ${_esc(level.name)} &mdash; ${((_profile && _profile.xp) || 0).toLocaleString()} XP
              </span>
              ${nextLvl
                ? `<span style="font-size:.75rem;color:var(--text-3);">Next: ${_esc(nextLvl.name)}</span>`
                : `<span style="font-size:.75rem;color:var(--warning);font-weight:700;">Max Level</span>`}
            </div>
            <div class="game-xp-track">
              <div class="game-xp-fill" style="width:${xpPct}%;"></div>
            </div>
          </div>

          ${perfect ? `<div class="game-perfect-banner">${_icon('sparkle', 16)} Perfect Score! +${XP_PER_PERFECT} bonus XP</div>` : ''}
          ${badgeHtml}

          <div style="display:flex;gap:.625rem;flex-wrap:wrap;justify-content:center;margin-top:1.25rem;">
            <button onclick="Game.openGameLobby()" class="btn bg-gray-500" style="display:inline-flex;align-items:center;gap:.3rem;">
              ${_icon('house', 15)} Back to Games
            </button>
            <button ${playAgainAttrib} class="btn" style="display:inline-flex;align-items:center;gap:.3rem;">
              ${_icon('play', 15)} Play Again
            </button>
            <button onclick="Game.openLeaderboard()" class="btn bg-gray-500" style="display:inline-flex;align-items:center;gap:.3rem;">
              ${_icon('trophy', 15)} Leaderboard
            </button>
          </div>
        </div>

      </div>`);
  }

  function _playAgain(key) {
    if      (key === 'quizBlitz')    _showQuizBlitzSetup();
    else if (key === 'speedMath')    _showSpeedMathSetup();
    else if (key === 'wordScramble') _showWordScrambleSetup();
    else if (key === 'challenge')    _showChallengeSetup();
    else openGameLobby();
  }

  /* ══════════════════════════════════════════════════════════════
     LEADERBOARD
  ══════════════════════════════════════════════════════════════ */

  async function openLeaderboard() {
    window.UI.mount(`
      <div class="max-w-2xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <h2 style="font-size:1.25rem;font-weight:700;color:var(--text-1);display:flex;align-items:center;gap:.375rem;">
            ${_icon('trophy', 20)} Leaderboard
          </h2>
          <button onclick="Game.openGameLobby()" class="btn bg-gray-500" style="display:inline-flex;align-items:center;gap:.3rem;">
            ${_icon('arrowLeft', 14)} Back
          </button>
        </div>
        <div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap;">
          <button id="lbTabClass"  onclick="Game._showLeaderboardTab('class')"  class="btn"          style="font-size:.8125rem;">My Class</button>
          <button id="lbTabSchool" onclick="Game._showLeaderboardTab('school')" class="btn bg-gray-500" style="font-size:.8125rem;">My School</button>
          <button id="lbTabAll"    onclick="Game._showLeaderboardTab('all')"    class="btn bg-gray-500" style="font-size:.8125rem;">All Students</button>
        </div>
        <div id="lbContent">
          <div style="text-align:center;padding:2rem;color:var(--text-3);">Loading leaderboard&hellip;</div>
        </div>
      </div>`);

    _showLeaderboardTab('class');
  }

  async function _showLeaderboardTab(tab) {
    ['class', 'school', 'all'].forEach(t => {
      const id  = `lbTab${t.charAt(0).toUpperCase() + t.slice(1)}`;
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.className = t === tab ? 'btn' : 'btn bg-gray-500';
      btn.style.fontSize = '.8125rem';
    });

    const container = document.getElementById('lbContent');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-3);">Loading&hellip;</div>';

    try {
      let query = _db().collection('gameLeaderboard').orderBy('xp', 'desc').limit(50);
      if (tab === 'class')  query = _db().collection('gameLeaderboard').where('class',  '==', _student().class  || '').orderBy('xp', 'desc').limit(50);
      if (tab === 'school') query = _db().collection('gameLeaderboard').where('school', '==', _student().school || '').orderBy('xp', 'desc').limit(50);

      const snap = await query.get();
      const entries = [];
      snap.forEach(doc => entries.push({ id: doc.id, ...doc.data() }));

      if (entries.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-3);">No players yet. Be the first!</div>`;
        return;
      }

      const myUid = _uid();
      container.innerHTML = `
        <div class="glass-dark" style="border-radius:10px;overflow:hidden;">
          <div style="display:grid;grid-template-columns:2.5rem 1fr auto auto;gap:.5rem;
                      padding:.5rem 1rem;border-bottom:1px solid var(--border);
                      background:var(--bg-subtle);font-size:.75rem;font-weight:700;color:var(--text-3);
                      text-transform:uppercase;letter-spacing:.04em;">
            <span>#</span><span>Player</span><span>Level</span><span>XP</span>
          </div>
          ${entries.map((e, i) => {
            const isMe   = e.id === myUid || e.uid === myUid;
            const medal  = i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}`;
            const lv     = _getLevelForXP(e.xp || 0);
            return `
              <div style="display:grid;grid-template-columns:2.5rem 1fr auto auto;gap:.5rem;
                          align-items:center;padding:.625rem 1rem;
                          ${isMe ? 'background:var(--accent-subtle);border-left:3px solid var(--accent);' : 'border-left:3px solid transparent;'}
                          ${i < entries.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
                <span style="font-size:${i < 3 ? '.875rem' : '.8125rem'};font-weight:800;text-align:center;color:${i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--text-3)'};">${medal}</span>
                <div>
                  <div style="font-size:.9rem;font-weight:${isMe ? '800' : '600'};color:var(--text-1);
                               display:flex;align-items:center;gap:.375rem;">
                    ${_esc(e.name || '—')}
                    ${isMe ? '<span style="font-size:.6rem;background:var(--accent);color:#fff;padding:1px 5px;border-radius:4px;font-weight:700;">YOU</span>' : ''}
                  </div>
                  <div style="font-size:.7rem;color:var(--text-3);">${_esc(e.class || '')}</div>
                </div>
                <span style="font-size:.875rem;display:flex;align-items:center;gap:.25rem;">
                  ${_icon(lv.icon, 14, { color: lv.color })}
                  <span style="font-size:.75rem;color:var(--text-3);">${_esc(lv.name)}</span>
                </span>
                <span style="font-size:.9rem;font-weight:700;color:var(--accent);font-family:var(--font-mono);">
                  ${(e.xp || 0).toLocaleString()}
                </span>
              </div>`;
          }).join('')}
        </div>`;

    } catch (e) {
      console.error('[game] openLeaderboard error:', e);
      container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--danger);">Could not load leaderboard. Please try again.</div>`;
    }
  }

  /* ══════════════════════════════════════════════════════════════
     SAVE GAME RESULT
  ══════════════════════════════════════════════════════════════ */

  async function _saveGameResult(gameType, data) {
    try {
      await _db().collection('gameResults').add({
        uid:      _uid(),
        name:     _student().name   || '',
        class:    _student().class  || '',
        school:   _student().school || '',
        gameType,
        ...data,
        playedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) { console.warn('[game] _saveGameResult error:', e); }
  }

  /* ══════════════════════════════════════════════════════════════
     MODAL HELPERS
  ══════════════════════════════════════════════════════════════ */

  function _showModal(html) {
    _closeModal();
    const overlay = document.createElement('div');
    overlay.id        = 'gameModal';
    overlay.className = 'cbt-overlay';
    overlay.innerHTML = `<div class="cbt-modal modal-box" style="max-width:440px;">${html}</div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) _closeModal(); });
    document.body.appendChild(overlay);
  }

  function _closeModal() {
    const m = document.getElementById('gameModal');
    if (m) m.remove();
  }

  function _abandonGame() {
    if (!window.UI || !window.UI.confirmAction) {
      _stopTimer();
      _gameState = null;
      openGameLobby();
      return;
    }
    window.UI.confirmAction('Quit this game? Your progress will not be saved.').then(ok => {
      if (!ok) return;
      _stopTimer();
      _gameState = null;
      openGameLobby();
    });
  }

  /* ══════════════════════════════════════════════════════════════
     NAVIGATION BADGE
  ══════════════════════════════════════════════════════════════ */

  function _updateGameNavBadge(count) {
    const btn = document.getElementById('gameOpenBtn');
    if (!btn) return;
    const existing = btn.querySelector('.game-notif-badge');
    if (existing) existing.remove();
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className   = 'game-notif-badge';
      badge.textContent = count > 9 ? '9+' : String(count);
      badge.style.cssText = [
        'position:absolute', 'top:-6px', 'right:-6px', 'min-width:18px', 'height:18px',
        'background:var(--danger,#e03131)', 'color:#fff', 'font-size:.625rem', 'font-weight:700',
        'border-radius:99px', 'display:flex', 'align-items:center', 'justify-content:center',
        'padding:0 4px', 'pointer-events:none', 'border:2px solid var(--surface,#fff)', 'line-height:1',
      ].join(';');
      btn.style.position = 'relative';
      btn.appendChild(badge);
    }
  }

  function _backToHome() {
    if (window.Exam && typeof window.Exam.renderSubjectSelection === 'function') {
      window.Exam.renderSubjectSelection();
    } else if (window.UI && typeof window.UI.home === 'function') {
      window.UI.home();
    } else {
      console.warn('[game] _backToHome: no navigation handler found.');
    }
  }

  /* ══════════════════════════════════════════════════════════════
     CSS INJECTION
  ══════════════════════════════════════════════════════════════ */

  function _injectStyles() {
    if (document.getElementById('_gameStyles')) return;
    const s = document.createElement('style');
    s.id = '_gameStyles';
    s.textContent = `
      /* ── TIMER COLOURS ── */
      .game-timer { display:block; font-family:var(--font-mono); font-size:1.875rem; font-weight:700; letter-spacing:.04em; line-height:1; transition:color .3s; }
      .timer-green  { color:var(--success,#22c55e); }
      .timer-yellow { color:var(--warning,#f59e0b); }
      .timer-red    { color:var(--danger,#ef4444); animation:game-pulse-red .5s ease-in-out infinite alternate; }
      @keyframes game-pulse-red { from { opacity:1; } to { opacity:.55; } }

      /* ── LOBBY ── */
      .game-lobby-header {
        display:flex; align-items:center; justify-content:space-between;
        padding:1.25rem 1.5rem; margin-bottom:.75rem; flex-wrap:wrap; gap:1rem;
        border-radius:var(--r-xl) !important;
      }
      .game-lobby-header__left  { display:flex; align-items:center; gap:.875rem; min-width:0; }
      .game-lobby-header__avatar {
        width:48px; height:48px; border-radius:50%; flex-shrink:0;
        background:var(--accent-subtle); border:2px solid var(--accent-border);
        display:flex; align-items:center; justify-content:center;
        font-size:1.375rem; font-weight:800; color:var(--accent-text);
      }
      .game-lobby-header__name  { font-size:1.125rem; font-weight:700; color:var(--text-1); line-height:1.2; }
      .game-lobby-header__meta  { font-size:.8125rem; color:var(--text-3); margin-top:2px; }
      .game-lobby-header__right { flex-shrink:0; }

      .game-level-badge {
        display:flex; align-items:center; gap:.625rem;
        background:var(--bg-base); border:2px solid var(--lvl-color,var(--accent));
        border-radius:99px; padding:.375rem .875rem;
      }
      .game-level-badge__icon { line-height:1; }
      .game-level-badge__name { font-size:.875rem; font-weight:700; color:var(--lvl-color,var(--accent)); }
      .game-level-badge__xp   { font-size:.6875rem; color:var(--text-3); font-family:var(--font-mono); }

      .game-xp-bar-wrap { padding:.875rem 1rem; border-radius:var(--r-lg) !important; margin-bottom:.75rem; }
      .game-xp-track    { width:100%; height:8px; background:var(--bg-muted); border-radius:99px; overflow:hidden; box-shadow:inset 0 1px 2px rgba(0,0,0,.08); }
      .game-xp-fill     {
        height:100%; border-radius:99px;
        background:linear-gradient(90deg,var(--accent),#7c3aed);
        transition:width .8s cubic-bezier(0.4,0,0.2,1);
        box-shadow:0 0 8px rgba(79,110,247,.35);
      }

      .game-challenge-alert {
        display:flex; align-items:center; gap:.625rem;
        background:linear-gradient(135deg,#fef3c7,#fde68a);
        border:2px solid #f59e0b; border-radius:10px;
        padding:.75rem 1rem; margin:.625rem 0;
        cursor:pointer; font-size:.9rem; font-weight:700; color:#92400e;
        transition:transform .15s;
      }
      .game-challenge-alert--info {
        background:linear-gradient(135deg,#dbeafe,#bfdbfe);
        border-color:#3b82f6; color:#1e40af;
      }
      .game-challenge-alert:hover           { transform:translateY(-2px); }
      .game-challenge-alert__icon           { font-size:1.25rem; flex-shrink:0; display:flex; align-items:center; }
      .game-challenge-alert__arrow          { margin-left:auto; display:flex; align-items:center; }

      /* ── SECTION TITLE ── */
      .game-section-title { font-size:1rem; font-weight:700; color:var(--text-1); margin:.25rem 0 .75rem; letter-spacing:-.01em; }

      /* ── CARDS ── */
      .game-cards-grid { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
      @media (max-width:480px) { .game-cards-grid { grid-template-columns:1fr; } }

      .game-card {
        background:var(--glass-bg);
        backdrop-filter:blur(var(--glass-blur)) saturate(var(--glass-saturate));
        -webkit-backdrop-filter:blur(var(--glass-blur)) saturate(var(--glass-saturate));
        border:1px solid var(--glass-border-outer);
        border-radius:var(--r-xl); padding:1.125rem; cursor:pointer;
        transition:transform .18s var(--ease), box-shadow .18s var(--ease), border-color .18s;
        position:relative; overflow:hidden;
      }
      .game-card::before {
        content:''; position:absolute; inset:0; border-radius:inherit;
        border:1px solid var(--glass-border); pointer-events:none;
      }
      .game-card > * { position:relative; z-index:1; }
      .game-card:hover {
        transform:translateY(-4px); box-shadow:var(--shadow-lg);
        border-color:var(--accent-border) !important;
      }
      .game-card--challenge:hover { border-color:rgba(224,49,49,.4) !important; }
      .game-card__icon  { margin-bottom:.5rem; line-height:1; display:flex; align-items:center; }
      .game-card__title { font-size:1rem; font-weight:700; color:var(--text-1); margin-bottom:.375rem; letter-spacing:-.01em; }
      .game-card__desc  { font-size:.8125rem; color:var(--text-3); line-height:1.55; margin-bottom:.75rem; }
      .game-card__meta  { display:flex; flex-wrap:wrap; gap:.3125rem; }
      .game-card__tag   {
        font-size:.625rem; font-weight:600; padding:2px 7px; border-radius:4px;
        background:var(--bg-subtle); color:var(--text-3); border:1px solid var(--border);
        text-transform:uppercase; letter-spacing:.03em;
      }
      .game-card__tag--xp { background:var(--accent-subtle); color:var(--accent-text); border-color:var(--accent-border); }

      /* ── STATS ── */
      .game-stats-row {
        display:grid; grid-template-columns:repeat(4,1fr);
        padding:.875rem; border-radius:var(--r-lg) !important; text-align:center;
      }
      @media (max-width:400px) { .game-stats-row { grid-template-columns:repeat(2,1fr); gap:.5rem; } }
      .game-stat-cell__value { font-size:1.5rem; font-weight:800; color:var(--text-1); font-family:var(--font-mono); line-height:1; margin-bottom:.25rem; }
      .game-stat-cell__label { font-size:.6875rem; color:var(--text-3); text-transform:uppercase; letter-spacing:.04em; }

      /* ── QUIZ HEADER ── */
      .game-quiz-header { padding:1rem 1.25rem !important; border-radius:var(--r-xl) !important; }
      .game-progress-track { width:100%; height:5px; background:var(--bg-muted); border-radius:99px; overflow:hidden; }
      .game-progress-fill  { height:100%; border-radius:99px; background:var(--accent); transition:width .4s ease; }

      /* ── OPTIONS ── */
      .game-option-btn {
        display:flex; align-items:flex-start; gap:.875rem;
        width:100%; padding:.75rem 1rem;
        background:var(--bg-base); border:2px solid var(--border); border-radius:var(--r-lg);
        cursor:pointer; font-family:var(--font); font-size:var(--text-base);
        color:var(--text-1); text-align:left;
        transition:border-color .12s, background .12s, transform .1s;
        margin-bottom:.5rem;
      }
      .game-option-btn:last-child { margin-bottom:0; }
      .game-option-btn:hover:not(:disabled) {
        border-color:var(--accent-border); background:var(--accent-subtle); transform:translateX(3px);
      }
      .game-option-btn__letter {
        width:1.75rem; height:1.75rem; border-radius:50%; flex-shrink:0;
        background:var(--bg-subtle); border:1.5px solid var(--border);
        display:flex; align-items:center; justify-content:center;
        font-size:.75rem; font-weight:700; color:var(--text-2);
        transition:background .12s, color .12s, border-color .12s;
      }
      .game-option-btn:hover:not(:disabled) .game-option-btn__letter {
        background:var(--accent); color:#fff; border-color:var(--accent);
      }
      .game-option-btn--correct                           { border-color:var(--success)  !important; background:var(--success-subtle)  !important; }
      .game-option-btn--correct .game-option-btn__letter  { background:var(--success)  !important; color:#fff !important; border-color:var(--success)  !important; }
      .game-option-btn--wrong                             { border-color:var(--danger)   !important; background:var(--danger-subtle)   !important; }
      .game-option-btn--wrong   .game-option-btn__letter  { background:var(--danger)   !important; color:#fff !important; border-color:var(--danger)   !important; }

      /* ── DIFFICULTY ── */
      .game-diff-option {
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        padding:.75rem .5rem; border-radius:var(--r-lg); border:2px solid var(--border);
        background:var(--bg-base); cursor:pointer;
        transition:border-color .15s, background .15s; gap:.25rem; text-align:center;
      }
      .game-diff-option.selected { border-color:var(--accent); background:var(--accent-subtle); }
      .game-diff-option__icon { display:flex; align-items:center; justify-content:center; }
      .game-diff-option__name { font-size:.875rem; font-weight:700; color:var(--text-1); }
      .game-diff-option__desc { font-size:.625rem; color:var(--text-3); margin-top:1px; }

      /* ── WORD SCRAMBLE ── */
      .game-scrambled-letters {
        display:flex; flex-wrap:wrap; justify-content:center; gap:.375rem;
        margin-bottom:.5rem; padding:.75rem;
      }
      .game-letter-tile {
        width:2.25rem; height:2.25rem; border-radius:6px;
        background:linear-gradient(145deg,var(--accent-subtle),var(--bg-subtle));
        border:2px solid var(--accent-border);
        display:inline-flex; align-items:center; justify-content:center;
        font-size:1rem; font-weight:800; color:var(--accent-text);
        font-family:var(--font-mono);
        box-shadow:0 2px 4px rgba(0,0,0,.06);
        transition:transform .15s;
      }
      @keyframes game-tile-bounce {
        0%   { transform:translateY(0); }
        30%  { transform:translateY(-6px) scale(1.08); }
        60%  { transform:translateY(2px); }
        100% { transform:translateY(0); }
      }
      .game-tiles-bounce .game-letter-tile {
        animation:game-tile-bounce .35s ease both;
      }
      .game-tiles-bounce .game-letter-tile:nth-child(odd)  { animation-delay:.04s; }
      .game-tiles-bounce .game-letter-tile:nth-child(even) { animation-delay:.08s; }

      /* ── SHUFFLE BUTTON ── */
      .game-shuffle-btn {
        display:inline-flex; align-items:center; gap:.3rem;
        font-size:.75rem; font-weight:600; padding:3px 10px; border-radius:99px;
        background:var(--accent-subtle); color:var(--accent-text); border:1.5px solid var(--accent-border);
        cursor:pointer; transition:background .15s, opacity .15s;
        font-family:var(--font);
      }
      .game-shuffle-btn:hover:not(:disabled) { background:var(--accent); color:#fff; }
      .game-shuffle-btn--disabled { opacity:.4; cursor:not-allowed; }
      .game-shuffle-count {
        display:inline-flex; align-items:center; justify-content:center;
        min-width:16px; height:16px; background:var(--accent); color:#fff;
        border-radius:99px; font-size:.625rem; font-weight:800; padding:0 3px;
      }
      .game-shuffle-btn--disabled .game-shuffle-count { background:var(--text-4); }

      /* ── RESULT ── */
      .game-result-card { padding:1.5rem !important; }
      .game-perfect-banner {
        text-align:center; padding:.625rem 1rem; border-radius:8px;
        background:linear-gradient(135deg,#fef3c7,#fde68a);
        border:2px solid #f59e0b; font-weight:800; color:#92400e;
        font-size:.9375rem; margin-bottom:.75rem;
        display:flex; align-items:center; justify-content:center; gap:.375rem;
      }
      .game-badges-earned {
        background:var(--warning-subtle); border:1px solid var(--warning-border);
        border-radius:8px; padding:.875rem 1rem; margin-bottom:.75rem;
      }
      .game-badge-pop {
        background:var(--bg-base); border:1px solid var(--border); border-radius:6px;
        padding:.375rem .75rem; margin-bottom:.375rem; font-size:.875rem; color:var(--text-1);
        display:flex; align-items:center; gap:.5rem;
      }
      .game-badge-pop:last-child { margin-bottom:0; }

      /* ── BADGE CHIPS ── */
      .game-badge-chip {
        display:inline-flex; align-items:center; gap:.3125rem;
        background:var(--accent-subtle); border:1px solid var(--accent-border);
        color:var(--accent-text); border-radius:99px;
        padding:2px 9px; font-size:.6875rem; font-weight:600;
        transition:transform .1s; cursor:default;
      }
      .game-badge-chip:hover { transform:scale(1.05); }

      /* ── DARK MODE ── */
      [data-theme="dark"] .game-card         { border-color:var(--glass-border-outer) !important; }
      [data-theme="dark"] .game-option-btn   { background:var(--bg-subtle); border-color:var(--border); }
      [data-theme="dark"] .game-letter-tile  {
        background:linear-gradient(145deg,rgba(107,135,248,.15),rgba(24,24,28,.8));
        border-color:var(--accent-border);
      }
    `;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════════════
     TEACHER: GAME STATS PANEL
  ══════════════════════════════════════════════════════════════ */

  async function renderTeacherGameStats(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<p style="color:var(--text-3);font-size:var(--text-sm);">Loading game stats&hellip;</p>';

    try {
      const snap = await _db().collection('gameLeaderboard').orderBy('xp', 'desc').limit(100).get();
      const entries = [];
      snap.forEach(doc => entries.push({ id: doc.id, ...doc.data() }));

      if (entries.length === 0) {
        container.innerHTML = '<p style="color:var(--text-3);font-size:var(--text-sm);">No game activity yet.</p>';
        return;
      }

      container.innerHTML = `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm);">
            <thead>
              <tr style="background:var(--bg-subtle);border-bottom:1.5px solid var(--border);">
                <th style="text-align:left;padding:.5rem .75rem;font-size:.75rem;font-weight:700;color:var(--text-3);">#</th>
                <th style="text-align:left;padding:.5rem .75rem;font-size:.75rem;font-weight:700;color:var(--text-3);">Student</th>
                <th style="text-align:left;padding:.5rem .75rem;font-size:.75rem;font-weight:700;color:var(--text-3);">Class</th>
                <th style="text-align:center;padding:.5rem .75rem;font-size:.75rem;font-weight:700;color:var(--text-3);">Level</th>
                <th style="text-align:center;padding:.5rem .75rem;font-size:.75rem;font-weight:700;color:var(--text-3);">XP</th>
                <th style="text-align:center;padding:.5rem .75rem;font-size:.75rem;font-weight:700;color:var(--text-3);">Games</th>
                <th style="text-align:center;padding:.5rem .75rem;font-size:.75rem;font-weight:700;color:var(--text-3);">Wins</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map((e, i) => {
                const lv    = _getLevelForXP(e.xp || 0);
                const medal = i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : (i + 1);
                return `
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:.4375rem .75rem;font-weight:700;">${medal}</td>
                    <td style="padding:.4375rem .75rem;font-weight:600;">${_esc(e.name || '—')}</td>
                    <td style="padding:.4375rem .75rem;color:var(--text-3);">${_esc(e.class || '—')}</td>
                    <td style="padding:.4375rem .75rem;text-align:center;">
                      <div style="display:flex;align-items:center;gap:.25rem;justify-content:center;">
                        ${_icon(lv.icon, 14, { color: lv.color })}
                        <span style="font-size:.75rem;">${_esc(lv.name)}</span>
                      </div>
                    </td>
                    <td style="padding:.4375rem .75rem;text-align:center;font-weight:700;color:var(--accent);font-family:var(--font-mono);">${(e.xp || 0).toLocaleString()}</td>
                    <td style="padding:.4375rem .75rem;text-align:center;">${e.totalGames || 0}</td>
                    <td style="padding:.4375rem .75rem;text-align:center;">${e.totalWins || 0}</td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;

    } catch (e) {
      console.error('[game] renderTeacherGameStats error:', e);
      container.innerHTML = '<p style="color:var(--danger);font-size:var(--text-sm);">Could not load game stats.</p>';
    }
  }

  /* ══════════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════════ */

  window.Game = {
    openGameLobby,
    openLeaderboard,
    _selectGame,
    _showQuizBlitzSetup,
    _startQuizBlitz,
    _answerQuizBlitz,
    _showSpeedMathSetup,
    _startSpeedMath,
    _submitMathAnswer,
    _showWordScrambleSetup,
    _startWordScramble,
    _reshuffleWord,
    _submitScrambleAnswer,
    _skipScramble,
    _showChallengeSetup,
    _sendChallenge,
    _showPendingChallenges,
    _showAwaitingChallenges,
    _acceptChallenge,
    _playChallengerTurn,
    _answerChallenge,
    _abandonGame,
    _closeModal,
    _showLeaderboardTab,
    _playAgain,
    _backToHome,
    renderTeacherGameStats,
  };

})();
