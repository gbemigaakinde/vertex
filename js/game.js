/* ============================================================
   js/game.js — Vertex Tutorial Game Engine v1
   Educational games with XP, levels, badges, leaderboard,
   and student-vs-student challenges.
   ============================================================ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     CONSTANTS
  ══════════════════════════════════════════════════════════════ */

  const XP_PER_CORRECT    = 10;
  const XP_PER_PERFECT    = 50;   // bonus for 100% score
  const XP_SPEED_BONUS    = 5;    // bonus per question answered fast (< 5s)
  const XP_CHALLENGE_WIN  = 30;   // bonus for winning a duel

  const LEVELS = [
    { name: 'Rookie',    minXP: 0,    icon: '🌱', color: '#6b7280' },
    { name: 'Scholar',   minXP: 100,  icon: '📚', color: '#3b82f6' },
    { name: 'Expert',    minXP: 300,  icon: '🔥', color: '#f59e0b' },
    { name: 'Master',    minXP: 700,  icon: '⚡', color: '#8b5cf6' },
    { name: 'Champion',  minXP: 1500, icon: '👑', color: '#f59e0b' },
  ];

  const BADGES = [
    { id: 'first_game',    name: 'First Steps',     desc: 'Play your first game',         icon: '🎮', xp: 0    },
    { id: 'perfect_quiz',  name: 'Perfect Score',   desc: 'Get 100% on any quiz',          icon: '💯', xp: 0    },
    { id: 'streak_5',      name: 'On Fire',         desc: 'Win 5 games in a row',          icon: '🔥', xp: 0    },
    { id: 'challenge_win', name: 'Duelist',         desc: 'Win your first challenge',      icon: '⚔️', xp: 0    },
    { id: 'games_10',      name: 'Dedicated',       desc: 'Play 10 games total',           icon: '🏅', xp: 0    },
    { id: 'games_50',      name: 'Veteran',         desc: 'Play 50 games total',           icon: '🎖️', xp: 0    },
    { id: 'xp_500',        name: 'Rising Star',     desc: 'Earn 500 XP',                   icon: '⭐', xp: 0    },
    { id: 'speed_demon',   name: 'Speed Demon',     desc: 'Answer 10 questions in < 5s each', icon: '💨', xp: 0 },
    { id: 'math_master',   name: 'Math Wizard',     desc: 'Complete Speed Math on Hard',   icon: '🧮', xp: 0    },
    { id: 'word_wizard',   name: 'Word Wizard',     desc: 'Unscramble 10 words correctly', icon: '📝', xp: 0    },
  ];

  const QUIZ_BLITZ_QUESTIONS = 10;
  const QUIZ_BLITZ_TIME      = 15;   // seconds per question
  const SPEED_MATH_TIME      = 8;    // seconds per problem
  const WORD_SCRAMBLE_TIME   = 20;   // seconds per word
  const CHALLENGE_EXPIRE_MS  = 24 * 60 * 60 * 1000; // 24 hours

  /* ══════════════════════════════════════════════════════════════
     STATE
  ══════════════════════════════════════════════════════════════ */

  let _gameState = null;   // current active game session
  let _profile   = null;   // current player's game profile
  let _timerEl   = null;   // DOM reference for timer display
  let _timerInt  = null;   // setInterval handle
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

  function _db()  { return window.fbDb; }
  function _uid() { return window.AppState.userId; }
  function _student() { return window.AppState.studentData || {}; }

  function _getLevelForXP(xp) {
    let level = LEVELS[0];
    for (const l of LEVELS) {
      if (xp >= l.minXP) level = l;
    }
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
    const base    = current.minXP;
    const target  = next.minXP;
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
          name:       _student().name || '',
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
      _profile = { uid, name: _student().name || '', class: _student().class || '', xp: 0, totalGames: 0, totalWins: 0, streak: 0, badges: [], stats: {} };
    }
    return _profile;
  }

  async function _awardXP(xpAmount, gameType, extraData) {
    if (!_uid() || xpAmount <= 0) return;
    const uid     = _uid();
    const oldXP   = (_profile && _profile.xp) || 0;
    const newXP   = oldXP + xpAmount;
    const newBadges = [...((_profile && _profile.badges) || [])];

    // Badge checks
    const totalGames = ((_profile && _profile.totalGames) || 0) + 1;
    const totalWins  = ((_profile && _profile.totalWins) || 0) + (extraData && extraData.win ? 1 : 0);
    const newStreak  = extraData && extraData.win
      ? ((_profile && _profile.streak) || 0) + 1
      : 0;

    const earnedBadges = [];
    const _hasBadge = (id) => newBadges.includes(id);

    if (!_hasBadge('first_game') && totalGames >= 1) { newBadges.push('first_game'); earnedBadges.push('first_game'); }
    if (!_hasBadge('perfect_quiz') && extraData && extraData.perfect) { newBadges.push('perfect_quiz'); earnedBadges.push('perfect_quiz'); }
    if (!_hasBadge('streak_5') && newStreak >= 5) { newBadges.push('streak_5'); earnedBadges.push('streak_5'); }
    if (!_hasBadge('challenge_win') && extraData && extraData.challengeWin) { newBadges.push('challenge_win'); earnedBadges.push('challenge_win'); }
    if (!_hasBadge('games_10') && totalGames >= 10) { newBadges.push('games_10'); earnedBadges.push('games_10'); }
    if (!_hasBadge('games_50') && totalGames >= 50) { newBadges.push('games_50'); earnedBadges.push('games_50'); }
    if (!_hasBadge('xp_500') && newXP >= 500) { newBadges.push('xp_500'); earnedBadges.push('xp_500'); }
    if (!_hasBadge('speed_demon') && extraData && extraData.speedDemonCount >= 10) { newBadges.push('speed_demon'); earnedBadges.push('speed_demon'); }
    if (!_hasBadge('math_master') && gameType === 'speedMath' && extraData && extraData.difficulty === 'hard') { newBadges.push('math_master'); earnedBadges.push('math_master'); }
    if (!_hasBadge('word_wizard') && extraData && extraData.wordCorrect >= 10) { newBadges.push('word_wizard'); earnedBadges.push('word_wizard'); }

    const updateData = {
      xp:         firebase.firestore.FieldValue.increment(xpAmount),
      totalGames: firebase.firestore.FieldValue.increment(1),
      totalWins:  firebase.firestore.FieldValue.increment(extraData && extraData.win ? 1 : 0),
      streak:     newStreak,
      badges:     newBadges,
      name:       _student().name || '',
      class:      _student().class || '',
      school:     _student().school || '',
      [`stats.${gameType}`]: firebase.firestore.FieldValue.increment(1),
    };

    try {
      const batch = _db().batch();
      batch.set(_db().collection('gameProfiles').doc(uid), updateData, { merge: true });
      batch.set(_db().collection('gameLeaderboard').doc(uid), {
        uid,
        name:       _student().name || '',
        class:      _student().class || '',
        school:     _student().school || '',
        xp:         newXP,
        totalGames,
        totalWins,
        level:      _getLevelForXP(newXP).name,
        levelIcon:  _getLevelForXP(newXP).icon,
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

    return { xpAwarded: xpAmount, earnedBadges, newXP, newLevel: _getLevelForXP(newXP) };
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

    const level      = _getLevelForXP(_profile.xp || 0);
    const nextLevel  = _getNextLevel(_profile.xp || 0);
    const xpPct      = _xpProgressPct(_profile.xp || 0);

    const challengeNotif = pendingChallenges.length > 0 ? `
      <div class="game-challenge-alert" onclick="Game._showPendingChallenges()">
        <span class="game-challenge-alert__icon">⚔️</span>
        <span>${pendingChallenges.length} pending challenge${pendingChallenges.length > 1 ? 's' : ''}! Tap to view.</span>
        <span class="game-challenge-alert__arrow">›</span>
      </div>` : '';

    const badgesHtml = (_profile.badges || []).length > 0
      ? (_profile.badges || []).map(bid => {
          const b = BADGES.find(x => x.id === bid);
          return b ? `<span class="game-badge-chip" title="${_esc(b.name)}: ${_esc(b.desc)}">${b.icon} ${_esc(b.name)}</span>` : '';
        }).join('')
      : `<span style="font-size:.8125rem;color:var(--text-4);font-style:italic;">No badges yet — play games to earn them!</span>`;

    window.UI.mount(`
      <div class="max-w-4xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">

        <div class="game-lobby-header glass">
          <div class="game-lobby-header__left">
            <div class="game-lobby-header__avatar">
              ${_esc((_student().name || '?').charAt(0).toUpperCase())}
            </div>
            <div>
              <h1 class="game-lobby-header__name">${_esc(_student().name || '')}</h1>
              <div class="game-lobby-header__meta">${_esc(_student().class || '')} · ${_esc(_student().school || '')}</div>
            </div>
          </div>
          <div class="game-lobby-header__right">
            <div class="game-level-badge" style="--lvl-color:${level.color};">
              <span class="game-level-badge__icon">${level.icon}</span>
              <div>
                <div class="game-level-badge__name">${_esc(level.name)}</div>
                <div class="game-level-badge__xp">${(_profile.xp || 0).toLocaleString()} XP</div>
              </div>
            </div>
          </div>
        </div>

        <div class="glass-dark game-xp-bar-wrap">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
            <span style="font-size:.8125rem;font-weight:700;color:var(--text-2);">
              ${level.icon} ${_esc(level.name)}
            </span>
            ${nextLevel
              ? `<span style="font-size:.75rem;color:var(--text-3);">
                   ${(_profile.xp || 0)} / ${nextLevel.minXP} XP → ${nextLevel.icon} ${nextLevel.name}
                 </span>`
              : `<span style="font-size:.75rem;color:var(--text-3);font-weight:700;">👑 Max Level!</span>`}
          </div>
          <div class="game-xp-track">
            <div class="game-xp-fill" style="width:${xpPct}%;"></div>
          </div>
        </div>

        ${challengeNotif}

        <div style="display:flex;gap:.625rem;flex-wrap:wrap;justify-content:center;margin:.75rem 0;">
          <button onclick="Game.openLeaderboard()" class="btn bg-gray-500">🏆 Leaderboard</button>
          <button onclick="Game._backToHome()" class="btn bg-gray-500">← Back</button>
        </div>

        <h2 class="game-section-title">🎮 Choose a Game</h2>

        <div class="game-cards-grid">

          <div class="game-card" onclick="Game._selectGame('quizBlitz')">
            <div class="game-card__icon">⚡</div>
            <div class="game-card__title">Quiz Blitz</div>
            <div class="game-card__desc">Answer 10 MCQ questions against the clock. Fast answers = bonus XP!</div>
            <div class="game-card__meta">
              <span class="game-card__tag">MCQ</span>
              <span class="game-card__tag">15s/question</span>
              <span class="game-card__tag game-card__tag--xp">+${XP_PER_CORRECT * QUIZ_BLITZ_QUESTIONS} XP max</span>
            </div>
          </div>

          <div class="game-card" onclick="Game._selectGame('speedMath')">
            <div class="game-card__icon">🧮</div>
            <div class="game-card__title">Speed Math</div>
            <div class="game-card__desc">Solve arithmetic problems as fast as you can. Choose Easy, Medium, or Hard!</div>
            <div class="game-card__meta">
              <span class="game-card__tag">Arithmetic</span>
              <span class="game-card__tag">8s/problem</span>
              <span class="game-card__tag game-card__tag--xp">+XP per correct</span>
            </div>
          </div>

          <div class="game-card" onclick="Game._selectGame('wordScramble')">
            <div class="game-card__icon">🔤</div>
            <div class="game-card__title">Word Scramble</div>
            <div class="game-card__desc">Unscramble subject vocabulary words before time runs out!</div>
            <div class="game-card__meta">
              <span class="game-card__tag">Vocabulary</span>
              <span class="game-card__tag">20s/word</span>
              <span class="game-card__tag game-card__tag--xp">+${XP_PER_CORRECT} XP per word</span>
            </div>
          </div>

          <div class="game-card game-card--challenge" onclick="Game._selectGame('challenge')">
            <div class="game-card__icon">⚔️</div>
            <div class="game-card__title">Challenge a Classmate</div>
            <div class="game-card__desc">Send a quiz challenge to someone in your class. Beat their score to win!</div>
            <div class="game-card__meta">
              <span class="game-card__tag">PvP</span>
              <span class="game-card__tag">1v1</span>
              <span class="game-card__tag game-card__tag--xp">+${XP_CHALLENGE_WIN} bonus XP for winning</span>
            </div>
          </div>

        </div>

        <h2 class="game-section-title" style="margin-top:1.5rem;">🎖️ Your Badges</h2>
        <div class="glass-dark" style="padding:1rem;border-radius:10px;display:flex;flex-wrap:wrap;gap:.5rem;">
          ${badgesHtml}
        </div>

        <h2 class="game-section-title" style="margin-top:1.5rem;">📊 Your Stats</h2>
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

    // Refresh challenge badge on DM-style button if applicable
    _updateGameNavBadge(pendingChallenges.length);
  }

  /* ══════════════════════════════════════════════════════════════
     GAME SELECTION MODAL
  ══════════════════════════════════════════════════════════════ */

  function _selectGame(type) {
    if (type === 'quizBlitz')    _showQuizBlitzSetup();
    else if (type === 'speedMath')  _showSpeedMathSetup();
    else if (type === 'wordScramble') _showWordScrambleSetup();
    else if (type === 'challenge')  _showChallengeSetup();
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
        <div style="font-size:2.5rem;margin-bottom:.5rem;">⚡</div>
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">Quiz Blitz Setup</h2>
        <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;">
          ${QUIZ_BLITZ_QUESTIONS} questions · ${QUIZ_BLITZ_TIME}s each · Speed bonus XP!
        </p>
      </div>
      <div style="margin-bottom:1rem;">
        <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.375rem;">Choose Subject</label>
        <select id="quizBlitzSubject" style="width:100%;">
          <option value="random">🎲 Random Mix (all subjects)</option>
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
        ⚡ Start Quiz Blitz
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

    const q         = gs.questions[gs.currentIndex];
    const progress  = gs.currentIndex + 1;
    const total     = gs.questions.length;
    const pctWidth  = Math.round((progress / total) * 100);
    const answered  = gs.answers.filter(a => a !== null).length;
    const correct   = gs.answers.filter((a, i) => a === gs.questions[i].ans).length;

    _questionStartTime = Date.now();

    window.UI.mount(`
      <div class="max-w-2xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">

        <div class="glass game-quiz-header">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;">
            <div>
              <span style="font-size:.75rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;">⚡ Quiz Blitz</span>
              <div style="font-size:.875rem;color:var(--text-2);margin-top:1px;">
                ${_esc(q.subject || '')} · Q${progress} of ${total}
              </div>
            </div>
            <div style="text-align:right;">
              <div id="quizTimer" class="game-timer timer-green">15</div>
              <div style="font-size:.6875rem;color:var(--text-4);">seconds left</div>
            </div>
          </div>
          <div class="game-progress-track">
            <div class="game-progress-fill" style="width:${pctWidth}%;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:.375rem;">
            <span style="font-size:.6875rem;color:var(--text-4);">✓ ${correct} correct</span>
            <span style="font-size:.6875rem;color:var(--accent);font-weight:700;">🔥 ${gs.xpEarned} XP earned</span>
          </div>
        </div>

        <div class="glass" style="padding:1.25rem 1.5rem;margin:.75rem 0;">
          <p style="font-size:1.0625rem;font-weight:500;line-height:1.65;margin-bottom:1.25rem;">
            ${_esc(q.q)}
          </p>
          <div class="space-y-2" id="quizOptions">
            ${q.opts.map((opt, idx) => `
              <button class="game-option-btn" id="quizOpt${idx}"
                      onclick="Game._answerQuizBlitz(${idx})">
                <span class="game-option-btn__letter">${String.fromCharCode(65 + idx)}</span>
                <span>${_esc(opt)}</span>
              </button>`).join('')}
          </div>
        </div>

        <div style="text-align:center;">
          <button onclick="Game._abandonGame()" class="btn bg-gray-500" style="font-size:.8125rem;">
            ✗ Quit Game
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
      () => { _answerQuizBlitz(null); } // time expired = no answer
    );
  }

  function _answerQuizBlitz(chosenIdx) {
    _stopTimer();
    const gs      = _gameState;
    if (!gs || gs.type !== 'quizBlitz') return;
    const q       = gs.questions[gs.currentIndex];
    const correct = chosenIdx === q.ans;
    const elapsed = (Date.now() - _questionStartTime) / 1000;

    // Highlight answer
    document.querySelectorAll('.game-option-btn').forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.ans) btn.classList.add('game-option-btn--correct');
      else if (i === chosenIdx) btn.classList.add('game-option-btn--wrong');
    });

    // XP
    let xpThis = 0;
    if (correct) {
      xpThis += XP_PER_CORRECT;
      if (elapsed < 5) { xpThis += XP_SPEED_BONUS; gs.speedBonuses++; _speedDemonCount++; }
    }
    gs.xpEarned += xpThis;
    gs.answers.push(chosenIdx);
    if (correct) gs.score++;

    // Show feedback briefly then advance
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

    const total   = gs.questions.length;
    const correct = gs.score;
    const pct     = Math.round((correct / total) * 100);
    const perfect = correct === total;
    const win     = pct >= 60;

    let xpFinal = gs.xpEarned;
    if (perfect) xpFinal += XP_PER_PERFECT;

    const result = await _awardXP(xpFinal, 'quizBlitz', {
      win, perfect,
      speedDemonCount: _speedDemonCount,
    });

    // Save result
    _saveGameResult('quizBlitz', { correct, total, pct, xpEarned: xpFinal, perfect });

    _renderGameResult({
      gameIcon:   '⚡',
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
      onPlayAgain: () => _showQuizBlitzSetup(),
    });
  }

  /* ══════════════════════════════════════════════════════════════
     SPEED MATH
  ══════════════════════════════════════════════════════════════ */

  const _mathProblems = {
    easy: () => {
      const ops = ['+', '-'];
      const op  = ops[Math.floor(Math.random() * ops.length)];
      let a, b;
      if (op === '+') { a = _rnd(1, 50); b = _rnd(1, 50); return { q: `${a} + ${b} = ?`, ans: a + b }; }
      else             { a = _rnd(10, 99); b = _rnd(1, a); return { q: `${a} − ${b} = ?`, ans: a - b }; }
    },
    medium: () => {
      const ops = ['+', '-', '×'];
      const op  = ops[Math.floor(Math.random() * ops.length)];
      if (op === '+') { const a = _rnd(20, 200), b = _rnd(20, 200); return { q: `${a} + ${b} = ?`, ans: a + b }; }
      if (op === '-') { const a = _rnd(50, 300), b = _rnd(1, a);    return { q: `${a} − ${b} = ?`, ans: a - b }; }
      const a = _rnd(2, 12), b = _rnd(2, 12); return { q: `${a} × ${b} = ?`, ans: a * b };
    },
    hard: () => {
      const ops = ['×', '÷', 'sq', 'mixed'];
      const op  = ops[Math.floor(Math.random() * ops.length)];
      if (op === '×') { const a = _rnd(13, 25), b = _rnd(13, 25); return { q: `${a} × ${b} = ?`, ans: a * b }; }
      if (op === '÷') { const b = _rnd(2, 12), a = b * _rnd(2, 12); return { q: `${a} ÷ ${b} = ?`, ans: a / b }; }
      if (op === 'sq') { const a = _rnd(5, 20); return { q: `${a}² = ?`, ans: a * a }; }
      const a = _rnd(10, 50), b = _rnd(2, 12), c = _rnd(1, 20);
      return { q: `(${a} × ${b}) + ${c} = ?`, ans: (a * b) + c };
    },
  };

  function _rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function _showSpeedMathSetup() {
    _showModal(`
      <div style="text-align:center;margin-bottom:1.25rem;">
        <div style="font-size:2.5rem;margin-bottom:.5rem;">🧮</div>
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">Speed Math Setup</h2>
        <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;">
          Solve as many problems as you can in 90 seconds!
        </p>
      </div>
      <div style="margin-bottom:1.5rem;">
        <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.5rem;">Difficulty</label>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;">
          <label class="game-diff-option" id="diffEasy">
            <input type="radio" name="mathDiff" value="easy" checked style="display:none;" />
            <span class="game-diff-option__icon">🟢</span>
            <span class="game-diff-option__name">Easy</span>
            <span class="game-diff-option__desc">+, − only</span>
          </label>
          <label class="game-diff-option" id="diffMedium">
            <input type="radio" name="mathDiff" value="medium" style="display:none;" />
            <span class="game-diff-option__icon">🟡</span>
            <span class="game-diff-option__name">Medium</span>
            <span class="game-diff-option__desc">+, −, ×</span>
          </label>
          <label class="game-diff-option" id="diffHard">
            <input type="radio" name="mathDiff" value="hard" style="display:none;" />
            <span class="game-diff-option__icon">🔴</span>
            <span class="game-diff-option__name">Hard</span>
            <span class="game-diff-option__desc">All ops + squares</span>
          </label>
        </div>
      </div>
      <button onclick="Game._startSpeedMath()" class="btn btn-lg w-full" style="background:var(--warning);color:#fff;">
        🧮 Start Speed Math
      </button>
      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Cancel</button>
    `);

    // Highlight selected difficulty
    document.querySelectorAll('.game-diff-option').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.game-diff-option').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
      });
    });
    document.getElementById('diffEasy').classList.add('selected');
  }

  function _startSpeedMath() {
    const radio = document.querySelector('input[name="mathDiff"]:checked');
    const diff  = radio ? radio.value : 'easy';
    _closeModal();

    _gameState = {
      type:        'speedMath',
      difficulty:  diff,
      totalTime:   90,
      score:       0,
      attempted:   0,
      xpEarned:    0,
      startedAt:   Date.now(),
      currentProblem: _mathProblems[diff](),
    };

    _renderSpeedMathQuestion();
  }

  function _renderSpeedMathQuestion() {
    const gs = _gameState;
    if (!gs || gs.type !== 'speedMath') return;

    const p = gs.currentProblem;
    const diffColor = gs.difficulty === 'hard' ? 'var(--danger)' : gs.difficulty === 'medium' ? 'var(--warning)' : 'var(--success)';
    const diffLabel = gs.difficulty.charAt(0).toUpperCase() + gs.difficulty.slice(1);

    window.UI.mount(`
      <div class="max-w-xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">

        <div class="glass game-quiz-header">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
            <div>
              <span style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${diffColor};">
                🧮 Speed Math · ${_esc(diffLabel)}
              </span>
            </div>
            <div style="text-align:right;">
              <div id="mathTimer" class="game-timer timer-green">${gs.totalTime}</div>
              <div style="font-size:.6875rem;color:var(--text-4);">total time</div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:.25rem;">
            <span style="font-size:.875rem;color:var(--text-2);">✓ ${gs.score} correct · ${gs.attempted} attempted</span>
            <span style="font-size:.875rem;color:var(--accent);font-weight:700;">🔥 ${gs.xpEarned} XP</span>
          </div>
        </div>

        <div class="glass" style="padding:2rem 1.5rem;margin:.75rem 0;text-align:center;">
          <p style="font-size:2.25rem;font-weight:800;color:var(--text-1);font-family:var(--font-mono);letter-spacing:-.02em;margin-bottom:1.5rem;">
            ${_esc(p.q)}
          </p>
          <input id="mathAnswer" type="number" inputmode="numeric" placeholder="Your answer"
                 style="font-size:1.5rem;text-align:center;max-width:200px;width:100%;
                        padding:.625rem 1rem;border-radius:10px;"
                 autofocus onkeydown="if(event.key==='Enter')Game._submitMathAnswer()" />
          <div style="margin-top:1rem;">
            <button onclick="Game._submitMathAnswer()" class="btn btn-lg" style="background:${diffColor};color:#fff;min-width:120px;">
              Submit →
            </button>
          </div>
        </div>

        <div id="mathFeedback" style="text-align:center;min-height:1.5rem;font-size:.9375rem;font-weight:700;"></div>

        <div style="text-align:center;margin-top:1rem;">
          <button onclick="Game._abandonGame()" class="btn bg-gray-500" style="font-size:.8125rem;">✗ Quit Game</button>
        </div>

      </div>`);

    // Run the 90-second countdown
    _timerEl = document.getElementById('mathTimer');

    // Use the remaining time if mid-game
    const elapsed    = Math.floor((Date.now() - gs.startedAt) / 1000);
    const remaining  = Math.max(1, gs.totalTime - elapsed);

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
    const val   = parseInt(input ? input.value : '', 10);
    if (isNaN(val)) { window.UI.toast('Please enter a number!', 'warning'); return; }

    const correct = val === gs.currentProblem.ans;
    gs.attempted++;
    if (correct) {
      gs.score++;
      gs.xpEarned += XP_PER_CORRECT;
    }

    const fb = document.getElementById('mathFeedback');
    if (fb) {
      fb.style.color   = correct ? 'var(--success)' : 'var(--danger)';
      fb.textContent   = correct ? '✓ Correct! +' + XP_PER_CORRECT + ' XP' : '✗ Wrong! Answer was ' + gs.currentProblem.ans;
    }

    gs.currentProblem = _mathProblems[gs.difficulty]();

    setTimeout(() => {
      // Update the problem display without re-mounting to preserve timer
      const problemEl = document.querySelector('.glass p[style*="font-mono"]') ||
                        document.querySelector('.glass p');
      if (problemEl) problemEl.textContent = gs.currentProblem.q;

      const xpEl = document.querySelector('#quizTimer, #mathTimer')?.closest('.glass')?.querySelector('[style*="accent"]');

      // Re-render the question area
      const container = document.querySelector('.max-w-xl .glass:nth-child(2)') ||
                        document.querySelector('.max-w-xl .glass + .glass');
      if (container) {
        const pEl = container.querySelector('p');
        if (pEl) pEl.textContent = gs.currentProblem.q;
      }
      if (fb) fb.textContent = '';
      if (input) { input.value = ''; input.focus(); }

      // Update score display
      const scoreEl = document.querySelector('.game-quiz-header span:first-child');
      if (scoreEl) scoreEl.textContent = `✓ ${gs.score} correct · ${gs.attempted} attempted`;
      const xpDisplay = document.querySelectorAll('.game-quiz-header span');
      xpDisplay.forEach(el => {
        if (el.textContent.includes('XP')) el.textContent = `🔥 ${gs.xpEarned} XP`;
      });
    }, 600);
  }

  async function _finishSpeedMath() {
    const gs = _gameState;
    _stopTimer();

    const pct    = gs.attempted > 0 ? Math.round((gs.score / gs.attempted) * 100) : 0;
    const perfect = gs.score === gs.attempted && gs.attempted >= 5;
    const win    = pct >= 60 && gs.score >= 5;

    const result = await _awardXP(gs.xpEarned, 'speedMath', {
      win, perfect, difficulty: gs.difficulty,
    });

    _saveGameResult('speedMath', { score: gs.score, attempted: gs.attempted, pct, xpEarned: gs.xpEarned, difficulty: gs.difficulty });

    _renderGameResult({
      gameIcon:   '🧮',
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
      onPlayAgain: () => _showSpeedMathSetup(),
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
    let scrambled;
    let attempts = 0;
    do {
      scrambled = _shuffleArray(letters).join('');
      attempts++;
    } while (scrambled === word && attempts < 10);
    return scrambled;
  }

  function _showWordScrambleSetup() {
    _showModal(`
      <div style="text-align:center;margin-bottom:1.25rem;">
        <div style="font-size:2.5rem;margin-bottom:.5rem;">🔤</div>
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">Word Scramble Setup</h2>
        <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;">
          Unscramble subject vocabulary words before time runs out!
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
        🔤 Start Word Scramble
      </button>
      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Cancel</button>
    `);
  }

  function _startWordScramble() {
    const count     = parseInt(document.getElementById('scrambleCount')?.value || '10', 10);
    const words     = _shuffleArray([..._wordBank]).slice(0, count);
    _closeModal();

    _gameState = {
      type:         'wordScramble',
      words,
      currentIndex: 0,
      score:        0,
      xpEarned:     0,
      wordCorrect:  0,
      startedAt:    Date.now(),
    };

    _renderWordScrambleQuestion();
  }

  function _renderWordScrambleQuestion() {
    const gs = _gameState;
    if (!gs || gs.type !== 'wordScramble') return;

    const entry     = gs.words[gs.currentIndex];
    const scrambled = _scrambleWord(entry.word);
    const progress  = gs.currentIndex + 1;
    const total     = gs.words.length;
    const pctWidth  = Math.round((progress / total) * 100);

    window.UI.mount(`
      <div class="max-w-xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">

        <div class="glass game-quiz-header">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;">
            <div>
              <span style="font-size:.75rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;">🔤 Word Scramble</span>
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
            <span style="font-size:.6875rem;color:var(--text-4);">✓ ${gs.score} correct</span>
            <span style="font-size:.6875rem;color:var(--accent);font-weight:700;">🔥 ${gs.xpEarned} XP</span>
          </div>
        </div>

        <div class="glass" style="padding:1.75rem 1.5rem;margin:.75rem 0;text-align:center;">
          <p style="font-size:.8125rem;color:var(--text-3);margin-bottom:.625rem;font-style:italic;">
            💡 ${_esc(entry.hint)}
          </p>
          <div class="game-scrambled-letters">
            ${scrambled.split('').map(l => `<span class="game-letter-tile">${_esc(l)}</span>`).join('')}
          </div>
          <p style="font-size:.75rem;color:var(--text-4);margin:.75rem 0;">${entry.word.length} letters</p>
          <input id="scrambleInput" type="text" placeholder="Type the word here..."
                 style="font-size:1.125rem;text-align:center;text-transform:uppercase;max-width:280px;width:100%;letter-spacing:.1em;"
                 autofocus maxlength="${entry.word.length + 2}"
                 onkeydown="if(event.key==='Enter')Game._submitScrambleAnswer()" />
          <div style="margin-top:1rem;display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap;">
            <button onclick="Game._submitScrambleAnswer()" class="btn" style="background:#7c3aed;color:#fff;">Submit</button>
            <button onclick="Game._skipScramble()" class="btn bg-gray-500">Skip →</button>
          </div>
        </div>

        <div id="scrambleFeedback" style="text-align:center;min-height:1.5rem;font-size:.9375rem;font-weight:700;"></div>

        <div style="text-align:center;margin-top:1rem;">
          <button onclick="Game._abandonGame()" class="btn bg-gray-500" style="font-size:.8125rem;">✗ Quit Game</button>
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
      () => { _skipScramble(); } // time out = skip
    );

    document.getElementById('scrambleInput')?.focus();
  }

  function _submitScrambleAnswer() {
    const gs    = _gameState;
    if (!gs || gs.type !== 'wordScramble') return;
    _stopTimer();

    const input   = document.getElementById('scrambleInput');
    const val     = (input ? input.value : '').trim().toUpperCase();
    const correct = val === gs.words[gs.currentIndex].word;

    const fb = document.getElementById('scrambleFeedback');
    if (fb) {
      fb.style.color = correct ? 'var(--success)' : 'var(--danger)';
      fb.textContent = correct
        ? '✓ Correct! +' + XP_PER_CORRECT + ' XP'
        : '✗ Wrong! The word was ' + gs.words[gs.currentIndex].word;
    }

    if (correct) { gs.score++; gs.xpEarned += XP_PER_CORRECT; gs.wordCorrect++; }

    setTimeout(() => {
      gs.currentIndex++;
      if (gs.currentIndex >= gs.words.length) _finishWordScramble();
      else _renderWordScrambleQuestion();
    }, 1200);
  }

  function _skipScramble() {
    _stopTimer();
    const gs = _gameState;
    if (!gs || gs.type !== 'wordScramble') return;
    const fb = document.getElementById('scrambleFeedback');
    if (fb) {
      fb.style.color = 'var(--text-3)';
      fb.textContent = '→ Skipped. The word was ' + gs.words[gs.currentIndex].word;
    }
    setTimeout(() => {
      gs.currentIndex++;
      if (gs.currentIndex >= gs.words.length) _finishWordScramble();
      else _renderWordScrambleQuestion();
    }, 1200);
  }

  async function _finishWordScramble() {
    const gs = _gameState;
    _stopTimer();

    const total   = gs.words.length;
    const correct = gs.score;
    const pct     = Math.round((correct / total) * 100);
    const perfect = correct === total;
    const win     = pct >= 60;

    const result = await _awardXP(gs.xpEarned, 'wordScramble', {
      win, perfect, wordCorrect: gs.wordCorrect,
    });

    _saveGameResult('wordScramble', { correct, total, pct, xpEarned: gs.xpEarned });

    _renderGameResult({
      gameIcon:   '🔤',
      gameName:   'Word Scramble',
      score:      `${correct} / ${total}`,
      pct,
      xpEarned:   gs.xpEarned,
      perfect,
      win,
      result,
      extras: [],
      onPlayAgain: () => _showWordScrambleSetup(),
    });
  }

  /* ══════════════════════════════════════════════════════════════
     CHALLENGE SYSTEM
  ══════════════════════════════════════════════════════════════ */

  async function _showChallengeSetup() {
    // Get classmates
    const myClass = _student().class || '';
    if (!myClass) { window.UI.toast('Your class is not set. Contact your teacher.', 'error'); return; }

    let classmates = [];
    try {
      const snap = await _db().collection('students')
        .where('class', '==', myClass)
        .get();
      snap.forEach(doc => {
        if (doc.id !== _uid()) {
          classmates.push({ id: doc.id, name: doc.data().name || 'Unknown' });
        }
      });
    } catch (e) {
      window.UI.toast('Could not load classmates. Please try again.', 'error');
      return;
    }

    if (classmates.length === 0) {
      window.UI.toast('No classmates found to challenge. You\'re the only one in your class!', 'info');
      return;
    }

    const subjects      = _getSubjectsForStudent();
    const subjectOptions = subjects.map(s =>
      `<option value="${_esc(s)}">${_esc(s)}</option>`
    ).join('');

    const classmateOptions = classmates
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(c => `<option value="${_esc(c.id)}">${_esc(c.name)}</option>`)
      .join('');

    _showModal(`
      <div style="text-align:center;margin-bottom:1.25rem;">
        <div style="font-size:2.5rem;margin-bottom:.5rem;">⚔️</div>
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">Challenge a Classmate</h2>
        <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;">
          Both of you answer the same 10 questions. Highest score wins!
        </p>
      </div>
      <div style="margin-bottom:.875rem;">
        <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.375rem;">Challenge Who?</label>
        <select id="challengeTarget" style="width:100%;">
          ${classmateOptions}
        </select>
      </div>
      <div style="margin-bottom:1.5rem;">
        <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.375rem;">Subject</label>
        <select id="challengeSubject" style="width:100%;">
          <option value="random">🎲 Random Mix</option>
          ${subjectOptions}
        </select>
      </div>
      <button onclick="Game._sendChallenge()" class="btn btn-lg w-full" style="background:var(--danger);color:#fff;">
        ⚔️ Send Challenge
      </button>
      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Cancel</button>
    `);
  }

  async function _sendChallenge() {
    const targetUid = document.getElementById('challengeTarget')?.value;
    const subject   = document.getElementById('challengeSubject')?.value || 'random';

    if (!targetUid) { window.UI.toast('Please select a classmate.', 'warning'); return; }

    const sendBtn = document.querySelector('.modal-box button:not(.bg-gray-500)');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Sending…'; }

    // Generate the question set
    let questions = [];
    if (subject === 'random') {
      const subjects = _getSubjectsForStudent();
      const perSubj  = Math.ceil(10 / subjects.length);
      subjects.forEach(s => {
        questions = questions.concat(_getQuestionsForSubject(s, perSubj).map(q => ({ ...q, subject: s })));
      });
      questions = _shuffleArray(questions).slice(0, 10);
    } else {
      questions = _getQuestionsForSubject(subject, 10).map(q => ({ ...q, subject }));
    }

    if (questions.length === 0) {
      window.UI.toast('No questions available.', 'error');
      if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '⚔️ Send Challenge'; }
      return;
    }

    // Strip question data to only what we need (no answer field for now — added on result)
    const questionData = questions.map(q => ({
      q:       q.q,
      opts:    q.opts,
      ans:     q.ans,
      exp:     q.exp || '',
      subject: q.subject,
    }));

    try {
      const targetSnap = await _db().collection('students').doc(targetUid).get();
      const targetName = targetSnap.exists ? (targetSnap.data().name || 'Unknown') : 'Unknown';

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
      window.UI.toast(`Challenge sent to ${targetName}! They have 24 hours to accept.`, 'success', 5000);
    } catch (e) {
      console.error('[game] _sendChallenge error:', e);
      window.UI.toast('Could not send challenge. Please try again.', 'error');
      if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '⚔️ Send Challenge'; }
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
        const d = doc.data();
        const exp = d.expiresAt && d.expiresAt.toDate ? d.expiresAt.toDate() : null;
        if (!exp || exp > new Date()) challenges.push({ id: doc.id, ...d });
      });
    } catch (e) { window.UI.toast('Could not load challenges.', 'error'); return; }

    if (challenges.length === 0) {
      window.UI.toast('No pending challenges right now!', 'info');
      return;
    }

    const listHtml = challenges.map(c => {
      const exp     = c.expiresAt && c.expiresAt.toDate ? c.expiresAt.toDate() : null;
      const expStr  = exp ? exp.toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;
                    background:var(--bg-base);border:1px solid var(--border);border-radius:8px;
                    padding:.75rem 1rem;margin-bottom:.5rem;">
          <div>
            <p style="font-size:.9375rem;font-weight:700;color:var(--text-1);">
              ⚔️ ${_esc(c.challengerName)} challenged you!
            </p>
            <p style="font-size:.8125rem;color:var(--text-3);">
              Subject: ${_esc(c.subject === 'random' ? 'Mixed' : c.subject)} · Expires ${_esc(expStr)}
            </p>
          </div>
          <button onclick="Game._acceptChallenge('${_esc(c.id)}')" class="btn" style="white-space:nowrap;flex-shrink:0;">
            Accept →
          </button>
        </div>`;
    }).join('');

    _showModal(`
      <div style="margin-bottom:1rem;">
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">⚔️ Pending Challenges</h2>
        <p style="font-size:.8125rem;color:var(--text-3);margin-top:.25rem;">
          Accept a challenge to play the quiz and see who scores higher!
        </p>
      </div>
      <div>${listHtml}</div>
      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Close</button>
    `);
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

    _gameState = {
      type:         'challenge',
      challengeId,
      questions:    challengeData.questions || [],
      currentIndex: 0,
      answers:      [],
      score:        0,
      xpEarned:     0,
      challengerName: challengeData.challengerName,
      challengerScore: challengeData.challengerScore,
      startedAt:    Date.now(),
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
                ⚔️ Challenge vs ${_esc(gs.challengerName)}
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
          <div class="space-y-2" id="challengeOptions">
            ${q.opts.map((opt, idx) => `
              <button class="game-option-btn" id="chOpt${idx}" onclick="Game._answerChallenge(${idx})">
                <span class="game-option-btn__letter">${String.fromCharCode(65 + idx)}</span>
                <span>${_esc(opt)}</span>
              </button>`).join('')}
          </div>
        </div>

        <div style="text-align:center;">
          <button onclick="Game._abandonGame()" class="btn bg-gray-500" style="font-size:.8125rem;">✗ Quit</button>
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

    const q       = gs.questions[gs.currentIndex];
    const correct = chosenIdx === q.ans;

    document.querySelectorAll('.game-option-btn').forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.ans)     btn.classList.add('game-option-btn--correct');
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
    const gs    = _gameState;
    _stopTimer();

    const total     = gs.questions.length;
    const myScore   = gs.score;
    const myPct     = Math.round((myScore / total) * 100);
    const theirScore = gs.challengerScore; // null if challenger hasn't played yet

    // Determine win — if challenger already played, compare
    let win = false;
    let challengeWin = false;

    if (theirScore !== null && theirScore !== undefined) {
      win = myScore > theirScore;
      challengeWin = win;
      if (win) gs.xpEarned += XP_CHALLENGE_WIN;
    }

    // Update Firestore challenge doc
    try {
      await _db().collection('gameChallenges').doc(gs.challengeId).update({
        challengedScore: myScore,
        status: theirScore !== null ? 'completed' : 'awaiting_challenger',
        [`result_${_uid()}`]: { score: myScore, pct: myPct, completedAt: firebase.firestore.FieldValue.serverTimestamp() },
      });
    } catch (e) { console.warn('[game] _finishChallenge update error:', e); }

    const result = await _awardXP(gs.xpEarned, 'challenge', { win, challengeWin });

    _saveGameResult('challenge', {
      score: myScore, total, pct: myPct, xpEarned: gs.xpEarned,
      challengeId: gs.challengeId, challengerName: gs.challengerName,
    });

    let outcomeHtml = '';
    if (theirScore !== null) {
      const theirPct = Math.round((theirScore / total) * 100);
      const icon = win ? '🏆' : myScore === theirScore ? '🤝' : '😔';
      outcomeHtml = `
        <div style="margin:.75rem 0;padding:.875rem 1rem;border-radius:10px;text-align:center;
                    background:${win ? 'var(--success-subtle)' : myScore === theirScore ? 'var(--warning-subtle)' : 'var(--danger-subtle)'};
                    border:2px solid ${win ? 'var(--success-border)' : myScore === theirScore ? 'var(--warning-border)' : 'var(--danger-border)'};">
          <div style="font-size:2rem;">${icon}</div>
          <p style="font-weight:700;font-size:1rem;margin:.25rem 0;color:var(--text-1);">
            ${win ? 'You Won!' : myScore === theirScore ? 'It\'s a Tie!' : 'You Lost!'}
          </p>
          <p style="font-size:.875rem;color:var(--text-2);">
            You: ${myScore}/${total} (${myPct}%) vs ${_esc(gs.challengerName)}: ${theirScore}/${total} (${theirPct}%)
          </p>
          ${challengeWin ? `<p style="font-size:.875rem;font-weight:700;color:var(--success);">+${XP_CHALLENGE_WIN} bonus XP for winning! ⚔️</p>` : ''}
        </div>`;
    } else {
      outcomeHtml = `
        <div style="margin:.75rem 0;padding:.875rem 1rem;border-radius:10px;text-align:center;
                    background:var(--info-subtle);border:1px solid var(--info-border);">
          <div style="font-size:2rem;">⏳</div>
          <p style="font-weight:700;font-size:1rem;margin:.25rem 0;color:var(--text-1);">Waiting for ${_esc(gs.challengerName)}!</p>
          <p style="font-size:.875rem;color:var(--text-2);">
            Your score: ${myScore}/${total} (${myPct}%). Check back after they play to see the winner!
          </p>
        </div>`;
    }

    _renderGameResult({
      gameIcon:    '⚔️',
      gameName:    'Challenge',
      score:       `${myScore} / ${total}`,
      pct:         myPct,
      xpEarned:    gs.xpEarned,
      perfect:     false,
      win,
      result,
      extras:      [],
      extraHtml:   outcomeHtml,
      onPlayAgain: () => _showChallengeSetup(),
    });
  }

  /* ══════════════════════════════════════════════════════════════
     GAME RESULT SCREEN
  ══════════════════════════════════════════════════════════════ */

  function _renderGameResult({ gameIcon, gameName, score, pct, xpEarned, perfect, win, result, extras, extraHtml, onPlayAgain }) {
    _stopTimer();
    _gameState = null;

    const level   = result ? result.newLevel : _getLevelForXP((_profile && _profile.xp) || 0);
    const xpPct   = _profile ? _xpProgressPct(_profile.xp || 0) : 0;
    const nextLvl = _profile ? _getNextLevel(_profile.xp || 0) : null;

    const gradeColor = pct >= 80 ? 'var(--success)'
                     : pct >= 60 ? 'var(--warning)'
                     : 'var(--danger)';

    const badgeHtml = result && result.earnedBadges && result.earnedBadges.length > 0
      ? `<div class="game-badges-earned">
           <p style="font-size:.875rem;font-weight:700;color:var(--text-2);margin-bottom:.5rem;">🎖️ New Badges Earned!</p>
           ${result.earnedBadges.map(bid => {
             const b = BADGES.find(x => x.id === bid);
             return b ? `<div class="game-badge-pop">${b.icon} <strong>${b.name}</strong> — ${b.desc}</div>` : '';
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

    window.UI.mount(`
      <div class="max-w-xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">

        <div class="glass game-result-card">
          <div style="text-align:center;margin-bottom:1.5rem;">
            <div style="font-size:3rem;margin-bottom:.375rem;">${gameIcon}</div>
            <h2 style="font-size:1.25rem;font-weight:700;color:var(--text-1);">${_esc(gameName)} Complete!</h2>
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
              <span style="font-size:.875rem;font-weight:700;color:var(--text-2);">
                ${level.icon} ${_esc(level.name)} — ${(_profile && _profile.xp || 0).toLocaleString()} XP
              </span>
              ${nextLvl
                ? `<span style="font-size:.75rem;color:var(--text-3);">Next: ${nextLvl.icon} ${nextLvl.name}</span>`
                : `<span style="font-size:.75rem;color:var(--warning);font-weight:700;">👑 Max Level!</span>`}
            </div>
            <div class="game-xp-track">
              <div class="game-xp-fill" style="width:${xpPct}%;"></div>
            </div>
          </div>

          ${perfect ? `<div class="game-perfect-banner">💯 PERFECT SCORE! +${XP_PER_PERFECT} bonus XP!</div>` : ''}
          ${badgeHtml}

          <div style="display:flex;gap:.625rem;flex-wrap:wrap;justify-content:center;margin-top:1.25rem;">
            <button onclick="Game.openGameLobby()" class="btn bg-gray-500">🏠 Back to Games</button>
            <button onclick="(${onPlayAgain.toString()})()" class="btn">▶ Play Again</button>
            <button onclick="Game.openLeaderboard()" class="btn bg-gray-500">🏆 Leaderboard</button>
          </div>
        </div>

      </div>`);
  }

  /* ══════════════════════════════════════════════════════════════
     LEADERBOARD
  ══════════════════════════════════════════════════════════════ */

  async function openLeaderboard() {
    const myClass  = _student().class || '';
    const mySchool = _student().school || '';

    window.UI.mount(`
      <div class="max-w-2xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <h2 style="font-size:1.25rem;font-weight:700;color:var(--text-1);">🏆 Leaderboard</h2>
          <button onclick="Game.openGameLobby()" class="btn bg-gray-500">← Back</button>
        </div>
        <div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap;">
          <button id="lbTabClass" onclick="Game._showLeaderboardTab('class')"
                  class="btn" style="font-size:.8125rem;">📚 My Class</button>
          <button id="lbTabSchool" onclick="Game._showLeaderboardTab('school')"
                  class="btn bg-gray-500" style="font-size:.8125rem;">🏫 My School</button>
          <button id="lbTabAll" onclick="Game._showLeaderboardTab('all')"
                  class="btn bg-gray-500" style="font-size:.8125rem;">🌍 All Students</button>
        </div>
        <div id="lbContent">
          <div style="text-align:center;padding:2rem;color:var(--text-3);">Loading leaderboard…</div>
        </div>
      </div>`);

    _showLeaderboardTab('class');
  }

  async function _showLeaderboardTab(tab) {
    ['class', 'school', 'all'].forEach(t => {
      const btn = document.getElementById(`lbTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (btn) {
        btn.className = t === tab
          ? 'btn'
          : 'btn bg-gray-500';
        btn.style.fontSize = '.8125rem';
      }
    });

    const container = document.getElementById('lbContent');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-3);">Loading…</div>';

    try {
      let query = _db().collection('gameLeaderboard').orderBy('xp', 'desc').limit(50);
      if (tab === 'class')  query = _db().collection('gameLeaderboard').where('class', '==', _student().class || '').orderBy('xp', 'desc').limit(50);
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
            const isMe    = e.id === myUid || e.uid === myUid;
            const medal   = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
            const level   = _getLevelForXP(e.xp || 0);
            return `
              <div style="display:grid;grid-template-columns:2.5rem 1fr auto auto;gap:.5rem;
                          align-items:center;padding:.625rem 1rem;
                          ${isMe ? 'background:var(--accent-subtle);border-left:3px solid var(--accent);' : 'border-left:3px solid transparent;'}
                          ${i < entries.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
                <span style="font-size:${i < 3 ? '1rem' : '.875rem'};font-weight:700;text-align:center;">${medal}</span>
                <div>
                  <div style="font-size:.9rem;font-weight:${isMe ? '800' : '600'};color:var(--text-1);
                               display:flex;align-items:center;gap:.375rem;">
                    ${_esc(e.name || '—')}
                    ${isMe ? '<span style="font-size:.6rem;background:var(--accent);color:#fff;padding:1px 5px;border-radius:4px;font-weight:700;">YOU</span>' : ''}
                  </div>
                  <div style="font-size:.7rem;color:var(--text-3);">${_esc(e.class || '')}</div>
                </div>
                <span style="font-size:.875rem;">${level.icon} <span style="font-size:.75rem;color:var(--text-3);">${_esc(level.name)}</span></span>
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
        uid:     _uid(),
        name:    _student().name  || '',
        class:   _student().class || '',
        school:  _student().school || '',
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
      badge.style.cssText = 'position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;background:var(--danger,#e03131);color:#fff;font-size:.625rem;font-weight:700;border-radius:99px;display:flex;align-items:center;justify-content:center;padding:0 4px;pointer-events:none;border:2px solid var(--surface,#fff);line-height:1;';
      btn.style.position = 'relative';
      btn.appendChild(badge);
    }
  }

  function _backToHome() {
    if (window.Exam && window.Exam.renderSubjectSelection) {
      window.Exam.renderSubjectSelection();
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
      /* ── LOBBY ── */
      .game-lobby-header {
        display:flex;align-items:center;justify-content:space-between;
        padding:1.25rem 1.5rem;margin-bottom:.75rem;flex-wrap:wrap;gap:1rem;
        border-radius:var(--r-xl) !important;
      }
      .game-lobby-header__left { display:flex;align-items:center;gap:.875rem;min-width:0; }
      .game-lobby-header__avatar {
        width:48px;height:48px;border-radius:50%;flex-shrink:0;
        background:var(--accent-subtle);border:2px solid var(--accent-border);
        display:flex;align-items:center;justify-content:center;
        font-size:1.375rem;font-weight:800;color:var(--accent-text);
      }
      .game-lobby-header__name { font-size:1.125rem;font-weight:700;color:var(--text-1);line-height:1.2; }
      .game-lobby-header__meta { font-size:.8125rem;color:var(--text-3);margin-top:2px; }
      .game-lobby-header__right { flex-shrink:0; }

      .game-level-badge {
        display:flex;align-items:center;gap:.625rem;
        background:var(--bg-base);border:2px solid var(--lvl-color,var(--accent));
        border-radius:99px;padding:.375rem .875rem;
      }
      .game-level-badge__icon { font-size:1.125rem; }
      .game-level-badge__name { font-size:.875rem;font-weight:700;color:var(--lvl-color,var(--accent)); }
      .game-level-badge__xp   { font-size:.6875rem;color:var(--text-3);font-family:var(--font-mono); }

      .game-xp-bar-wrap { padding:.875rem 1rem;border-radius:var(--r-lg) !important;margin-bottom:.75rem; }
      .game-xp-track {
        width:100%;height:8px;background:var(--bg-muted);border-radius:99px;overflow:hidden;
        box-shadow:inset 0 1px 2px rgba(0,0,0,.08);
      }
      .game-xp-fill {
        height:100%;border-radius:99px;
        background:linear-gradient(90deg,var(--accent),#7c3aed);
        transition:width .8s cubic-bezier(0.4,0,0.2,1);
        box-shadow:0 0 8px rgba(79,110,247,.35);
      }

      .game-challenge-alert {
        display:flex;align-items:center;gap:.625rem;
        background:linear-gradient(135deg,#fef3c7,#fde68a);
        border:2px solid #f59e0b;border-radius:10px;
        padding:.75rem 1rem;margin:.75rem 0;
        cursor:pointer;font-size:.9rem;font-weight:700;color:#92400e;
        transition:transform .15s;
      }
      .game-challenge-alert:hover { transform:translateY(-2px); }
      .game-challenge-alert__icon { font-size:1.25rem;flex-shrink:0; }
      .game-challenge-alert__arrow { margin-left:auto;font-size:1.125rem; }

      /* ── CARDS ── */
      .game-section-title {
        font-size:1rem;font-weight:700;color:var(--text-1);
        margin:.25rem 0 .75rem;letter-spacing:-.01em;
      }
      .game-cards-grid {
        display:grid;grid-template-columns:1fr 1fr;gap:.75rem;
      }
      @media (max-width:480px) { .game-cards-grid { grid-template-columns:1fr; } }

      .game-card {
        background:var(--glass-bg);
        backdrop-filter:blur(var(--glass-blur)) saturate(var(--glass-saturate));
        -webkit-backdrop-filter:blur(var(--glass-blur)) saturate(var(--glass-saturate));
        border:1px solid var(--glass-border-outer);
        border-radius:var(--r-xl);
        padding:1.125rem;
        cursor:pointer;
        transition:transform .18s var(--ease), box-shadow .18s var(--ease), border-color .18s;
        position:relative;overflow:hidden;
      }
      .game-card::before {
        content:'';position:absolute;inset:0;border-radius:inherit;
        border:1px solid var(--glass-border);pointer-events:none;
      }
      .game-card > * { position:relative;z-index:1; }
      .game-card:hover {
        transform:translateY(-4px);
        box-shadow:var(--shadow-lg);
        border-color:var(--accent-border) !important;
      }
      .game-card--challenge:hover { border-color:rgba(224,49,49,.4) !important; }
      .game-card__icon { font-size:2rem;margin-bottom:.5rem; }
      .game-card__title {
        font-size:1rem;font-weight:700;color:var(--text-1);margin-bottom:.375rem;
        letter-spacing:-.01em;
      }
      .game-card__desc { font-size:.8125rem;color:var(--text-3);line-height:1.55;margin-bottom:.75rem; }
      .game-card__meta { display:flex;flex-wrap:wrap;gap:.3125rem; }
      .game-card__tag {
        font-size:.625rem;font-weight:600;padding:2px 7px;border-radius:4px;
        background:var(--bg-subtle);color:var(--text-3);border:1px solid var(--border);
        text-transform:uppercase;letter-spacing:.03em;
      }
      .game-card__tag--xp {
        background:var(--accent-subtle);color:var(--accent-text);border-color:var(--accent-border);
      }

      /* ── GAME STATS ── */
      .game-stats-row {
        display:grid;grid-template-columns:repeat(4,1fr);
        padding:.875rem;border-radius:var(--r-lg) !important;text-align:center;
      }
      @media (max-width:400px) { .game-stats-row { grid-template-columns:repeat(2,1fr);gap:.5rem; } }
      .game-stat-cell__value {
        font-size:1.5rem;font-weight:800;color:var(--text-1);
        font-family:var(--font-mono);line-height:1;margin-bottom:.25rem;
      }
      .game-stat-cell__label { font-size:.6875rem;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em; }

      /* ── QUIZ ── */
      .game-quiz-header {
        padding:1rem 1.25rem !important;border-radius:var(--r-xl) !important;
      }
      .game-timer {
        font-family:var(--font-mono);font-size:1.875rem;font-weight:700;
        letter-spacing:.04em;line-height:1;display:block;
        transition:color .3s;
      }
      .game-progress-track {
        width:100%;height:5px;background:var(--bg-muted);border-radius:99px;overflow:hidden;
      }
      .game-progress-fill {
        height:100%;border-radius:99px;
        background:var(--accent);
        transition:width .4s ease;
      }

      /* ── OPTIONS ── */
      .game-option-btn {
        display:flex;align-items:flex-start;gap:.875rem;
        width:100%;padding:.75rem 1rem;
        background:var(--bg-base);border:2px solid var(--border);border-radius:var(--r-lg);
        cursor:pointer;font-family:var(--font);font-size:var(--text-base);
        color:var(--text-1);text-align:left;
        transition:border-color .12s,background .12s,transform .1s;
        margin-bottom:.5rem;
      }
      .game-option-btn:last-child { margin-bottom:0; }
      .game-option-btn:hover:not(:disabled) {
        border-color:var(--accent-border);background:var(--accent-subtle);
        transform:translateX(3px);
      }
      .game-option-btn__letter {
        width:1.75rem;height:1.75rem;border-radius:50%;flex-shrink:0;
        background:var(--bg-subtle);border:1.5px solid var(--border);
        display:flex;align-items:center;justify-content:center;
        font-size:.75rem;font-weight:700;color:var(--text-2);
        transition:background .12s,color .12s,border-color .12s;
      }
      .game-option-btn:hover:not(:disabled) .game-option-btn__letter {
        background:var(--accent);color:#fff;border-color:var(--accent);
      }
      .game-option-btn--correct {
        border-color:var(--success) !important;background:var(--success-subtle) !important;
      }
      .game-option-btn--correct .game-option-btn__letter {
        background:var(--success) !important;color:#fff !important;border-color:var(--success) !important;
      }
      .game-option-btn--wrong {
        border-color:var(--danger) !important;background:var(--danger-subtle) !important;
      }
      .game-option-btn--wrong .game-option-btn__letter {
        background:var(--danger) !important;color:#fff !important;border-color:var(--danger) !important;
      }

      /* ── DIFFICULTY ── */
      .game-diff-option {
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        padding:.75rem .5rem;border-radius:var(--r-lg);border:2px solid var(--border);
        background:var(--bg-base);cursor:pointer;transition:border-color .15s,background .15s;
        gap:.25rem;text-align:center;
      }
      .game-diff-option.selected { border-color:var(--accent);background:var(--accent-subtle); }
      .game-diff-option__icon  { font-size:1.25rem; }
      .game-diff-option__name  { font-size:.875rem;font-weight:700;color:var(--text-1); }
      .game-diff-option__desc  { font-size:.625rem;color:var(--text-3);margin-top:1px; }

      /* ── WORD SCRAMBLE ── */
      .game-scrambled-letters {
        display:flex;flex-wrap:wrap;justify-content:center;gap:.375rem;
        margin-bottom:.75rem;padding:.75rem;
      }
      .game-letter-tile {
        width:2.25rem;height:2.25rem;border-radius:6px;
        background:linear-gradient(145deg,var(--accent-subtle),var(--bg-subtle));
        border:2px solid var(--accent-border);
        display:inline-flex;align-items:center;justify-content:center;
        font-size:1rem;font-weight:800;color:var(--accent-text);
        font-family:var(--font-mono);
        box-shadow:0 2px 4px rgba(0,0,0,.06);
      }

      /* ── RESULT ── */
      .game-result-card { padding:1.5rem !important; }
      .game-perfect-banner {
        text-align:center;padding:.625rem 1rem;border-radius:8px;
        background:linear-gradient(135deg,#fef3c7,#fde68a);
        border:2px solid #f59e0b;font-weight:800;color:#92400e;
        font-size:.9375rem;margin-bottom:.75rem;
      }
      .game-badges-earned {
        background:var(--warning-subtle);border:1px solid var(--warning-border);
        border-radius:8px;padding:.875rem 1rem;margin-bottom:.75rem;
      }
      .game-badge-pop {
        background:var(--bg-base);border:1px solid var(--border);border-radius:6px;
        padding:.375rem .75rem;margin-bottom:.375rem;font-size:.875rem;color:var(--text-1);
      }
      .game-badge-pop:last-child { margin-bottom:0; }

      /* ── BADGE CHIPS ── */
      .game-badge-chip {
        display:inline-flex;align-items:center;gap:.3125rem;
        background:var(--accent-subtle);border:1px solid var(--accent-border);
        color:var(--accent-text);border-radius:99px;
        padding:2px 9px;font-size:.6875rem;font-weight:600;
        transition:transform .1s;cursor:default;
      }
      .game-badge-chip:hover { transform:scale(1.05); }

      /* ── DARK MODE ── */
      [data-theme="dark"] .game-card {
        border-color:var(--glass-border-outer) !important;
      }
      [data-theme="dark"] .game-option-btn {
        background:var(--bg-subtle);border-color:var(--border);
      }
      [data-theme="dark"] .game-letter-tile {
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
    container.innerHTML = '<p style="color:var(--text-3);font-size:var(--text-sm);">Loading game stats…</p>';

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
                const level  = _getLevelForXP(e.xp || 0);
                const medal  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
                return `
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:.4375rem .75rem;font-weight:700;">${medal}</td>
                    <td style="padding:.4375rem .75rem;font-weight:600;">${_esc(e.name || '—')}</td>
                    <td style="padding:.4375rem .75rem;color:var(--text-3);">${_esc(e.class || '—')}</td>
                    <td style="padding:.4375rem .75rem;text-align:center;">${level.icon} <span style="font-size:.75rem;">${_esc(level.name)}</span></td>
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
    _submitScrambleAnswer,
    _skipScramble,
    _showChallengeSetup,
    _sendChallenge,
    _showPendingChallenges,
    _acceptChallenge,
    _answerChallenge,
    _abandonGame,
    _closeModal,
    _showLeaderboardTab,
    _backToHome,
    renderTeacherGameStats,
  };

})();
