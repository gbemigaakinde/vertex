/* ============================================================
   js/game.js — Vertex Tutorial Game Engine v4
*/

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     ICONS
  ══════════════════════════════════════════════════════════════ */

  const _ICONS = {
    trophy:         'M12 2a1 1 0 0 1 1 1v1h5a1 1 0 0 1 1 1v4c0 2.76-1.86 5.08-4.38 5.8A6.002 6.002 0 0 1 13 17.92V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.08A6.002 6.002 0 0 1 6.38 13.8C3.86 13.08 2 10.76 2 8V5a1 1 0 0 1 1-1h5V3a1 1 0 0 1 1-1h3Zm-6 4H4v2c0 1.65 1.02 3.07 2.47 3.65A6.03 6.03 0 0 1 6 10V6Zm12 0h-2v4c0 .68-.1 1.33-.47 1.65C17.98 11.07 19 9.65 19 8V6Z',
    lightning:      'M13 2 4.5 13.5H11L10 22l9.5-13H13L13 2Z',
    calculator:     'M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 2v16h12V4H6Zm2 2h2v2H8V6Zm3 0h2v2h-2V6Zm3 0h2v2h-2V6ZM8 10h8v2H8v-2Zm0 4h8v2H8v-2Zm0 4h4v2H8v-2Z',
    textT:          'M5 4h14a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0V6h-5v13h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2V6H6v2a1 1 0 0 1-2 0V5a1 1 0 0 1 1-1Z',
    swords:         'M6.5 1 1 6.5l5.5 5.5 1.5-1.5-4-4 3-3 4 4L12.5 6.5 6.5 1Zm11 0 5.5 5.5-5.5 5.5-1.5-1.5 4-4-3-3-4 4L11.5 6.5 17.5 1ZM3 15l-2 2 2 2h16l2-2-2-2H3Z',
    medal:          'M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-5 9-3 9h16l-3-9a7 7 0 0 1-10 0Z',
    star:           'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z',
    flame:          'M12 1c0 0 4 4 4 9a4 4 0 0 1-8 0c0-1.5.5-3 1.5-4.5C9.5 7 10 9 10 9s2-2.5 2-8Zm-4 10a4 4 0 1 0 8 0c0 2-4 7-4 7s-4-5-4-7Z',
    shield:         'M12 1 3 5v7c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V5l-9-4Zm0 2.18 7 3.11V12c0 4.1-2.97 8.06-7 9.23C7.97 20.06 5 16.1 5 12V6.29l7-3.11Z',
    chartBar:       'M3 3h2v18H3V3Zm4 6h2v12H7V9Zm4-4h2v16h-2V5Zm4 2h2v14h-2V7Zm4 4h2v10h-2v-10Z',
    arrowLeft:      'M19 12H5m7-7-7 7 7 7',
    arrowRight:     'M5 12h14m-7-7 7 7-7 7',
    house:          'M3 12l9-9 9 9M5 10v9a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1v-9',
    users:          'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    clock:          'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm0 2a8 8 0 1 1 0 16A8 8 0 0 1 12 4Zm0 2v6l4 2-1 1.73-5-2.5V6H12Z',
    shuffle:        'M16 3h5v5l-1.5-1.5-4.5 4.5-4-4L5 13.5 3.5 12 9 6.5l4 4 3.5-3.5L16 3Zm5 13-1.5-1.5-4.5-4.5-4 4-5.5-5.5L4 10l5.5 5.5 4-4 3.5 3.5L16 17h5v-1Z',
    checkCircle:    'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
    xCircle:        'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm3 7-6 6m0-6 6 6',
    warning:        'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4m0 4h.01',
    hourglass:      'M5 2h14M5 22h14M17 2v4l-5 4 5 4v4M7 2v4l5 4-5 4v4',
    gameController: 'M6 12h4m-2-2v4M15 12h.01M18 12h.01M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z',
    crown:          'M2 20h20M5 20 3 8l5 5 4-8 4 8 5-5-2 12H5Z',
    person:         'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    sparkle:        'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83',
    skipForward:    'M5 4l10 8-10 8V4ZM19 5v14',
    x:              'M18 6 6 18M6 6l12 12',
    info:           'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm0 9v5m0-8h.01',
    play:           'M5 3l14 9-14 9V3Z',
    handWaving:     'M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8M6 14v-3a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4c0 3.31 2.69 6 6 6h4c2.67 0 4.94-1.7 5.72-4.07',
    close:          'M18 6 6 18M6 6l12 12',
    infinity:       'M12 12c-2-2.5-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.5 6-4Zm0 0c2 2.5 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.5-6 4Z',
    zap:            'M13 2 4.5 13.5H11L10 22l9.5-13H13L13 2Z',
    gift:           'M20 12v10H4V12M22 7H2v5h20V7ZM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7ZM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z',
    award:          'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0 0v7M8.5 18.5l7 3M15.5 18.5l-7 3',
    diamond:        'M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0L2.7 10.3Z',
    // New icons for new games
    checkSquare:    'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    alertTriangle: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4m0 4h.01',
    skull:          'M12 2a9 9 0 0 1 9 9c0 3.18-1.65 5.97-4.14 7.62L16 21H8l-.86-2.38A9 9 0 0 1 3 11a9 9 0 0 1 9-9ZM9 17h6M9 14h.01M15 14h.01',
    target:         'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-6a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
    bolt:           'M13 2 4.5 13.5H11L10 22l9.5-13H13L13 2Z',
    heartPulse:     'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7ZM3.22 12H9.5l1.5-3 2 4.5 1.5-3h3.27',
    zeroOneBit:     'M9 8h1v8H9zM14 8c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2h-1V8h1z',
  };

  function _icon(name, size = 20, opts = {}) {
    const pathData    = _ICONS[name] || _ICONS.sparkle;
    const color       = opts.color || 'currentColor';
    const cls         = opts.class ? ` class="${opts.class}"` : '';
    const strokeIcons = new Set([
      'arrowLeft','arrowRight','house','users','clock','shuffle','checkCircle','xCircle',
      'warning','hourglass','gameController','crown','sparkle','skipForward','x','info',
      'play','handWaving','close','person','shield','swords','lightning','trophy','medal',
      'flame','star','chartBar','textT','calculator','trophy','infinity','zap','gift',
      'award','diamond','checkSquare','alertTriangle','skull','target','bolt','heartPulse',
      'zeroOneBit',
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
     2GO-STYLE LEVEL SYSTEM
  ══════════════════════════════════════════════════════════════ */

  const LEVELS = [
    { name: 'Newbie',      minXP: 0,       icon: 'person',    color: '#9ca3af', rank: 1  },
    { name: 'Learner',     minXP: 150,     icon: 'textT',     color: '#6b7280', rank: 2  },
    { name: 'Curious',     minXP: 400,     icon: 'sparkle',   color: '#60a5fa', rank: 3  },
    { name: 'Scholar',     minXP: 900,     icon: 'award',     color: '#3b82f6', rank: 4  },
    { name: 'Apprentice',  minXP: 1_800,   icon: 'star',      color: '#818cf8', rank: 5  },
    { name: 'Achiever',    minXP: 3_200,   icon: 'chartBar',  color: '#a78bfa', rank: 6  },
    { name: 'Challenger',  minXP: 5_500,   icon: 'swords',    color: '#7c3aed', rank: 7  },
    { name: 'Expert',      minXP: 9_000,   icon: 'flame',     color: '#f59e0b', rank: 8  },
    { name: 'Specialist',  minXP: 14_000,  icon: 'shield',    color: '#f97316', rank: 9  },
    { name: 'Prodigy',     minXP: 21_000,  icon: 'lightning', color: '#ef4444', rank: 10 },
    { name: 'Elite',       minXP: 30_000,  icon: 'medal',     color: '#e11d48', rank: 11 },
    { name: 'Veteran',     minXP: 42_000,  icon: 'crown',     color: '#ec4899', rank: 12 },
    { name: 'Master',      minXP: 58_000,  icon: 'trophy',    color: '#d946ef', rank: 13 },
    { name: 'Grandmaster', minXP: 80_000,  icon: 'diamond',   color: '#a855f7', rank: 14 },
    { name: 'Champion',    minXP: 110_000, icon: 'zap',       color: '#0ea5e9', rank: 15 },
    { name: 'Legend',      minXP: 150_000, icon: 'star',      color: '#06b6d4', rank: 16 },
    { name: 'Mythic',      minXP: 200_000, icon: 'flame',     color: '#10b981', rank: 17 },
    { name: 'Titan',       minXP: 260_000, icon: 'shield',    color: '#84cc16', rank: 18 },
    { name: 'Immortal',    minXP: 330_000, icon: 'infinity',  color: '#eab308', rank: 19 },
    { name: 'Absolute',    minXP: 420_000, icon: 'sparkle',   color: '#f43f5e', rank: 20 },
  ];

  /* ══════════════════════════════════════════════════════════════
     BADGES
  ══════════════════════════════════════════════════════════════ */

  const BADGES = [
  { id: 'first_game',        name: 'First Steps',        desc: 'Play your first game',                         icon: 'gameController', xp: 0 },
  { id: 'perfect_quiz',      name: 'Perfect Score',       desc: 'Get 100% on any quiz',                         icon: 'checkCircle',    xp: 0 },
  { id: 'streak_5',          name: 'On Fire',             desc: 'Win 5 games in a row',                         icon: 'flame',          xp: 0 },
  { id: 'streak_10',         name: 'Unstoppable',         desc: 'Win 10 games in a row',                        icon: 'zap',            xp: 0 },
  { id: 'streak_20',         name: 'Legend Streak',       desc: 'Win 20 games in a row',                        icon: 'crown',          xp: 0 },
  { id: 'challenge_win',     name: 'Duelist',             desc: 'Win your first challenge',                     icon: 'swords',         xp: 0 },
  { id: 'challenge_5',       name: 'Champion Duelist',    desc: 'Win 5 challenges against classmates',          icon: 'swords',         xp: 0 },
  { id: 'challenge_10',      name: 'Gladiator',           desc: 'Win 10 challenges',                            icon: 'trophy',         xp: 0 },
  { id: 'games_5',           name: 'Getting Started',     desc: 'Play 5 games total',                           icon: 'play',           xp: 0 },
  { id: 'games_10',          name: 'Dedicated',           desc: 'Play 10 games total',                          icon: 'medal',          xp: 0 },
  { id: 'games_25',          name: 'Regular Player',      desc: 'Play 25 games total',                          icon: 'star',           xp: 0 },
  { id: 'games_50',          name: 'Veteran',             desc: 'Play 50 games total',                          icon: 'shield',         xp: 0 },
  { id: 'games_100',         name: 'Centurion',           desc: 'Play 100 games total',                         icon: 'award',          xp: 0 },
  { id: 'games_250',         name: 'Iron Will',           desc: 'Play 250 games total',                         icon: 'diamond',        xp: 0 },
  { id: 'xp_100',            name: 'Spark',               desc: 'Earn 100 XP',                                  icon: 'sparkle',        xp: 0 },
  { id: 'xp_500',            name: 'Rising Star',         desc: 'Earn 500 XP',                                  icon: 'star',           xp: 0 },
  { id: 'xp_1000',           name: 'Power Up',            desc: 'Earn 1,000 XP',                                icon: 'lightning',      xp: 0 },
  { id: 'xp_2500',           name: 'Committed',           desc: 'Earn 2,500 XP',                                icon: 'chartBar',       xp: 0 },
  { id: 'xp_5000',           name: 'High Scorer',         desc: 'Earn 5,000 XP',                                icon: 'chartBar',       xp: 0 },
  { id: 'xp_10000',          name: 'Elite Scholar',       desc: 'Earn 10,000 XP',                               icon: 'medal',          xp: 0 },
  { id: 'xp_25000',          name: 'XP Hoarder',          desc: 'Earn 25,000 XP',                               icon: 'trophy',         xp: 0 },
  { id: 'xp_50000',          name: 'Hall of Fame',        desc: 'Earn 50,000 XP',                               icon: 'crown',          xp: 0 },
  { id: 'xp_100000',         name: 'Mythic Scholar',      desc: 'Earn 100,000 XP',                              icon: 'infinity',       xp: 0 },
  { id: 'speed_demon',       name: 'Speed Demon',         desc: 'Answer 10 questions in under 5 seconds each',  icon: 'lightning',      xp: 0 },
  { id: 'speed_demon_pro',   name: 'Flash Mind',          desc: 'Answer 30 questions in under 5 seconds each',  icon: 'zap',            xp: 0 },
  { id: 'math_master',       name: 'Math Wizard',         desc: 'Complete Speed Math on Hard difficulty',        icon: 'calculator',     xp: 0 },
  { id: 'math_perfect',      name: 'Perfect Calculator',  desc: 'Score 100% on Speed Math (Hard, 10+ problems)',icon: 'calculator',     xp: 0 },
  { id: 'word_wizard',       name: 'Word Wizard',         desc: 'Unscramble 10 words correctly',                icon: 'textT',          xp: 0 },
  { id: 'word_master',       name: 'Lexicon Master',      desc: 'Unscramble 50 words correctly across games',   icon: 'textT',          xp: 0 },
  { id: 'tf_streak_5',       name: 'True Believer',       desc: 'Get a 5-answer streak in True or False',       icon: 'checkSquare',    xp: 0 },
  { id: 'tf_streak_10',      name: 'Truth Seeker',        desc: 'Get a 10-answer streak in True or False',      icon: 'checkSquare',    xp: 0 },
  { id: 'tf_streak_20',      name: 'Oracle',              desc: 'Get a 20-answer streak in True or False',      icon: 'target',         xp: 0 },
  { id: 'sudden_death_5',    name: 'Survivor',            desc: 'Survive 5 questions in Perfect Run',           icon: 'skull',          xp: 0 },
  { id: 'sudden_death_10',   name: 'Tough Cookie',        desc: 'Survive 10 questions in Perfect Run',          icon: 'skull',          xp: 0 },
  { id: 'sudden_death_15',   name: 'Untouchable',         desc: 'Survive 15 questions in Perfect Run',          icon: 'skull',          xp: 0 },
  { id: 'sudden_death_25',   name: 'Iron Mind',           desc: 'Survive 25 questions in Perfect Run',          icon: 'shield',         xp: 0 },
  { id: 'sudden_death_30',   name: 'Immortal Run',        desc: 'Survive 30 questions in Perfect Run',          icon: 'infinity',       xp: 0 },
  { id: 'sudden_death_50',   name: 'Absolute Survivor',   desc: 'Survive all 50 questions in Perfect Run',      icon: 'diamond',        xp: 0 },
  { id: 'perfect_tf',        name: 'Binary Genius',       desc: 'Get 100% in True or False Blitz',              icon: 'checkCircle',    xp: 0 },
  { id: 'perfect_scramble',  name: 'Spelling Bee',        desc: 'Get 100% in Word Scramble',                    icon: 'textT',          xp: 0 },
  { id: 'perfect_blitz',     name: 'Blitz Master',        desc: 'Get 100% in Quiz Blitz',                       icon: 'lightning',      xp: 0 },
  { id: 'early_bird',        name: 'Early Bird',          desc: 'Play a game before 7 AM',                      icon: 'clock',          xp: 0 },
  { id: 'night_owl',         name: 'Night Owl',           desc: 'Play a game after 10 PM',                      icon: 'clock',          xp: 0 },
  { id: 'weekend_warrior',   name: 'Weekend Warrior',     desc: 'Play 5 games on a Saturday or Sunday',         icon: 'star',           xp: 0 },
  { id: 'daily_player_3',    name: 'Consistent',          desc: 'Play at least one game for 3 days in a row',   icon: 'flame',          xp: 0 },
  { id: 'daily_player_7',    name: 'Devoted',             desc: 'Play at least one game for 7 days in a row',   icon: 'award',          xp: 0 },
  { id: 'first_challenge',   name: 'Challenger',          desc: 'Send your first challenge to a classmate',     icon: 'swords',         xp: 0 },
  { id: 'wins_5',            name: 'Victor',              desc: 'Win 5 games total',                            icon: 'trophy',         xp: 0 },
  { id: 'wins_25',           name: 'Champion',            desc: 'Win 25 games total',                           icon: 'crown',          xp: 0 },
  { id: 'wins_50',           name: 'Dominator',           desc: 'Win 50 games total',                           icon: 'diamond',        xp: 0 },
  { id: 'rank_5',            name: 'Apprentice Achieved', desc: 'Reach Rank 5 (Apprentice)',                    icon: 'star',           xp: 0 },
  { id: 'rank_10',           name: 'Prodigy Achieved',    desc: 'Reach Rank 10 (Prodigy)',                      icon: 'lightning',      xp: 0 },
  { id: 'rank_15',           name: 'Champion Achieved',   desc: 'Reach Rank 15 (Champion)',                     icon: 'trophy',         xp: 0 },
  { id: 'max_level',         name: 'Absolute Power',      desc: 'Reach the highest rank: Absolute',             icon: 'sparkle',        xp: 0 },
];

  /* ══════════════════════════════════════════════════════════════
     CONSTANTS
  ══════════════════════════════════════════════════════════════ */

  const XP_PER_CORRECT    = 10;
  const XP_PER_PERFECT    = 50;
  const XP_SPEED_BONUS    = 5;
  const XP_CHALLENGE_WIN  = 30;
  const MAX_SHUFFLES      = 3;

  const QUIZ_BLITZ_QUESTIONS     = 10;
  const QUIZ_BLITZ_TIME          = 15;
  const SPEED_MATH_TIME          = 8;
  const WORD_SCRAMBLE_TIME       = 20;
  const CHALLENGE_EXPIRE_MS      = 24 * 60 * 60 * 1000;

  // True or False constants
  const TF_TIME_PER_QUESTION     = 15; // seconds — tight but fair
  const TF_XP_PER_CORRECT        = 8;
  const TF_XP_STREAK_BONUS       = 4;  // bonus per question when streak >= 3
  const TF_STREAK_THRESHOLD      = 3;

  // Perfect Run constants
  const SD_TIME_PER_QUESTION     = 12; // seconds
  const SD_XP_BASE               = 5;
  const SD_XP_INCREMENT          = 2;  // extra XP per question (compounds)
  const SD_MAX_QUESTIONS         = 50; // safety ceiling

/* ══════════════════════════════════════════════════════════════
   WORD SCRABBLE CONSTANTS
══════════════════════════════════════════════════════════════ */

const WS_BOARD_SIZE   = 15;
const WS_RACK_SIZE    = 7;
const WS_BINGO_BONUS  = 50;
const WS_TURN_MS      = 3 * 60 * 1000; // 3 minutes per turn

// Official English Scrabble tile distribution
// [letter, count, points]
const WS_TILES = [
  ['A',9,1],['B',2,3],['C',2,3],['D',4,2],['E',12,1],
  ['F',2,4],['G',3,2],['H',2,4],['I',9,1],['J',1,8],
  ['K',1,5],['L',4,1],['M',2,3],['N',6,1],['O',8,1],
  ['P',2,3],['Q',1,10],['R',6,1],['S',4,1],['T',6,1],
  ['U',4,1],['V',2,4],['W',2,4],['X',1,8],['Y',2,4],
  ['Z',1,10],['?',2,0], // ? = blank
];

// Premium square layout for 15×15 board
// TW=triple word, DW=double word, TL=triple letter, DL=double letter, ST=start
const WS_PREMIUM = (function() {
  const B = Array.from({ length: 15 }, () => Array(15).fill(''));

  // Triple Word
  [[0,0],[0,7],[0,14],[7,0],[7,14],[14,0],[14,7],[14,14]].forEach(([r,c]) => B[r][c] = 'TW');

  // Double Word (includes centre diagonals)
  [[1,1],[2,2],[3,3],[4,4],[7,7],
   [1,13],[2,12],[3,11],[4,10],
   [10,4],[11,3],[12,2],[13,1],
   [10,10],[11,11],[12,12],[13,13]].forEach(([r,c]) => B[r][c] = 'DW');

  // Triple Letter
  [[1,5],[1,9],[5,1],[5,5],[5,9],[5,13],
   [9,1],[9,5],[9,9],[9,13],[13,5],[13,9]].forEach(([r,c]) => B[r][c] = 'TL');

  // Double Letter
  [[0,3],[0,11],[2,6],[2,8],[3,0],[3,7],[3,14],
   [6,2],[6,6],[6,8],[6,12],[7,3],[7,11],
   [8,2],[8,6],[8,8],[8,12],[11,0],[11,7],[11,14],
   [12,6],[12,8],[14,3],[14,11]].forEach(([r,c]) => B[r][c] = 'DL');

  B[7][7] = 'ST'; // centre star
  return B;
})();

// Compact but solid word list for secondary school Scrabble
// ~500 common valid words — enough for fair gameplay
const WS_WORDLIST = new Set([
  // 2-letter words (essential for adjacency plays)
  'AA','AB','AD','AE','AG','AH','AI','AL','AM','AN','AR','AS','AT','AW','AX','AY',
  'BA','BE','BI','BO','BY',
  'DA','DE','DO',
  'ED','EF','EH','EL','EM','EN','ER','ES','ET','EX',
  'FA','FE',
  'GI','GO',
  'HA','HE','HI','HM','HO',
  'ID','IF','IN','IS','IT',
  'JO',
  'KA','KI',
  'LA','LI','LO',
  'MA','ME','MI','MM','MO','MU','MY',
  'NA','NE','NO','NU',
  'OD','OE','OF','OH','OI','OM','ON','OP','OR','OS','OW','OX','OY',
  'PA','PE','PI',
  'QI',
  'RE',
  'SH','SI','SO',
  'TA','TI','TO',
  'UH','UM','UN','UP','UR','US','UT',
  'WE','WO',
  'XI','XU',
  'YA','YE','YO',
  'ZA',
  // 3-letter words
  'ACE','ACT','ADD','AGE','AGO','AID','AIM','AIR','ALL','AND','ANT','ANY','APE',
  'APP','APT','ARC','ARE','ARK','ARM','ART','ASH','ASK','ATE','AXE',
  'BAD','BAG','BAN','BAR','BAT','BAY','BED','BEG','BET','BIG','BIT','BOW','BOX','BOY','BUD','BUG','BUN','BUS','BUT','BUY',
  'CAB','CAN','CAP','CAR','CAT','COP','COT','COW','CRY','CUB','CUP','CUT',
  'DAD','DAM','DAY','DEN','DEW','DID','DIG','DIM','DIP','DOE','DOG','DOT','DRY','DUG','DUO','DYE',
  'EAR','EAT','EEL','EGG','ELM','EMU','END','ERA','EVE','EWE','EYE',
  'FAD','FAN','FAR','FAT','FAX','FED','FEW','FIG','FIN','FIT','FLY','FOE','FOG','FUN','FUR',
  'GAP','GAS','GAY','GEL','GEM','GET','GOD','GOT','GUM','GUN','GUT','GUY','GYM',
  'HAD','HAM','HAS','HAT','HAY','HEN','HER','HIM','HIS','HIT','HOG','HOP','HOT','HOW','HUB','HUG','HUM',
  'ICE','ILL','INN','ION','IRE','IRK',
  'JAB','JAM','JAR','JAW','JAY','JET','JOB','JOG','JOT','JOY','JUG','JUT',
  'KEG','KEN','KIT',
  'LAB','LAD','LAG','LAP','LAW','LAX','LAY','LEA','LED','LEG','LET','LID','LIP','LIT','LOG','LOT','LOW',
  'MAD','MAN','MAP','MAR','MAT','MAW','MAY','MEN','MET','MID','MIX','MOB','MOD','MOM','MOP','MUD','MUG',
  'NAB','NAG','NAP','NAY','NET','NEW','NIL','NIT','NOB','NOD','NOR','NOT','NOW','NUN','NUT',
  'OAK','OAR','OAT','ODD','ODE','OFF','OFT','OHM','OIL','OLD','ONE','OPT','ORB','ORE','OWE','OWL','OWN',
  'PAD','PAL','PAN','PAP','PAR','PAT','PAW','PAY','PEA','PEG','PEN','PEP','PER','PET','PEW','PIE','PIG','PIN','PIT','PIX','PLY','POD','POP','POT','POW','PRY','PUB','PUN','PUP','PUS','PUT',
  'RAG','RAM','RAN','RAP','RAT','RAW','RAY','RED','REF','RIB','RID','RIG','RIM','RIP','ROB','ROD','ROT','ROW','RUB','RUG','RUN','RUT','RYE',
  'SAC','SAD','SAG','SAP','SAT','SAW','SAY','SEA','SET','SEW','SIP','SIR','SIT','SIX','SKI','SKY','SLY','SOB','SOD','SON','SOP','SOT','SOW','SOY','SPA','SPY','STY','SUB','SUM','SUN','SUP',
  'TAB','TAD','TAN','TAP','TAR','TAT','TAX','TEA','TEN','THE','TIE','TIN','TIP','TOE','TON','TOO','TOP','TOW','TOY','TUB','TUG','TUN','TWO',
  'URN','USE',
  'VAN','VAR','VAT','VET','VIA','VIE','VOW',
  'WAD','WAR','WAS','WAX','WAY','WEB','WED','WET','WHO','WHY','WIG','WIN','WIT','WOE','WOK','WON','WOO','WOW',
  'YAK','YAM','YAP','YAW','YEA','YEP','YET','YEW',
  'ZAP','ZED','ZEN','ZIG','ZIP','ZIT',
  // 4-letter words
  'ABLE','ACHE','ACID','ACNE','ACRE','ACTS','AGED','AGES','AIDE','AIDS','AIMS','AIRS','AJAR','AKIN','ALOE','ALSO','ALTO','ALUM','AMEN','AMID','AMOK','AMPS','ANTE','ANTI','ANTS','APES','APEX','ARCH','AREA','ARKS','ARMS','ARMY','ARTS','ASHY',
  'ATOM','ATOP','AUNT','AUTO','AVID','AWAY','AWED','AWRY',
  'BABY','BACK','BADE','BAIT','BALD','BALE','BALL','BAND','BANE','BANG','BANK','BARE','BARK','BARN','BASE','BASH','BASK','BASS','BAST','BATH','BATS','BEAD','BEAK','BEAM','BEAN','BEAR','BEAT','BEES','BEET','BELL','BELT','BEND','BEST','BIAS','BIKE','BILE','BILL','BIND','BIRD','BITE','BLOT','BLOW','BLUE','BLUR','BOAR','BOAT','BODY','BOLD','BOLT','BONE','BOOK','BOOM','BOOT','BORE','BORN','BOSS','BOTH','BOUT','BOWL','BRAG','BRAN','BRAT','BRAY','BRED','BREW','BROW','BUCK','BUFF','BULK','BULL','BUMP','BUNK','BURN','BURP','BURR','BUST','BUZZ',
  'CAFE','CAGE','CAKE','CALF','CALL','CALM','CAME','CAMP','CANE','CAPE','CARD','CARE','CARP','CART','CASE','CASH','CAST','CAVE','CENT','CHAD','CHAP','CHAT','CHEW','CHIP','CHOP','CLAD','CLAM','CLAP','CLAW','CLAY','CLIP','CLOD','CLOP','CLOT','CLUB','CLUE','COAT','CODE','COIL','COIN','COKE','COLD','COLE','COLT','COMA','COME','CONE','COOK','COOL','COPE','CORD','CORE','CORN','COST','COUP','COVE','COZY','CRAB','CREW','CROP','CROW','CUBE','CURB','CURE','CURL','CUSP',
  'DABS','DADS','DAMP','DARE','DARK','DART','DASH','DATA','DATE','DAZE','DEAD','DEAL','DEAR','DEBT','DECK','DEED','DEEM','DEEP','DEER','DEFT','DELI','DELL','DEMO','DENY','DESK','DIAL','DICE','DIET','DIRE','DIRK','DISC','DISH','DISK','DIVE','DOCK','DOLE','DOME','DONE','DOOM','DOOR','DOSE','DOTE','DOVE','DOWN','DRAB','DRAG','DRAW','DRIP','DROP','DRUM','DUAL','DUEL','DULY','DUMB','DUNE','DUNK','DUPE','DUSK','DUST',
  'EACH','EARL','EARN','EASE','EAST','EASY','EDGE','ELSE','EMIT','ENVY','EPIC','EVEN','EVER','EVIL','EXAM',
  'FACE','FACT','FAIL','FAIR','FAKE','FALL','FAME','FARE','FARM','FAST','FATE','FAWN','FEAT','FEEL','FEET','FELL','FELT','FEND','FERN','FILE','FILL','FILM','FIND','FIRE','FIRM','FISH','FIST','FIZZ','FLAG','FLAP','FLAT','FLAW','FLEA','FLEX','FLIP','FLIT','FLOG','FLOP','FLOW','FOAM','FOIL','FOLD','FOLK','FOND','FOOD','FOOL','FORD','FORE','FORK','FORM','FORT','FOUL','FOUR','FOWL','FREE','FROM','FUEL','FULL','FUME','FUND','FUSE','FUSS',
  'GALE','GAME','GANG','GAPE','GARB','GASH','GAVE','GAZE','GEAR','GERM','GIFT','GILD','GILT','GIVE','GLAD','GLEE','GLOB','GLOW','GLUE','GNAW','GOAL','GOAT','GOLD','GOLF','GONE','GONG','GOOD','GOOF','GORE','GOWN','GRAB','GRAM','GRAY','GREW','GREY','GRIM','GRIP','GRIT','GUST','GUTS',
  'HACK','HAIL','HAIR','HALF','HALL','HALT','HAND','HANG','HARD','HARE','HARM','HARP','HASH','HASTE','HATE','HAUL','HEAL','HEAP','HEAT','HEEL','HELD','HELM','HELP','HEMP','HERB','HERD','HERE','HERO','HIDE','HIGH','HIKE','HILL','HINT','HIRE','HISS','HIVE','HOAX','HOLD','HOLE','HOME','HOOK','HOPE','HORN','HOST','HOUR','HUGE','HULL','HUNG','HUNT','HURL','HYMN',
  'IDEA','IDLE','INCH','IRIS','IRON',
  'JACK','JADE','JAIL','JEST','JOLT','JUMP','JUNK','JURY','JUST',
  'KEEN','KEEP','KELP','KICK','KIND','KING','KNOB','KNOT','KNOW',
  'LACE','LACK','LAKE','LAMP','LAND','LANE','LARK','LASH','LAST','LATE','LAUD','LAWN','LAZY','LEAD','LEAF','LEAK','LEAN','LEAP','LEND','LENS','LESS','LICK','LIED','LIFE','LIFT','LIKE','LIME','LIMP','LINE','LINK','LION','LIST','LIVE','LOAD','LOAF','LOAN','LOCK','LOFT','LONE','LONG','LOOK','LOOM','LOOP','LORE','LOSE','LOSS','LOST','LOUD','LOUT','LOVE','LULL','LURE','LUST',
  'MADE','MAID','MAIL','MAIN','MAKE','MALL','MANE','MANY','MARE','MARK','MASK','MASS','MAST','MATE','MATH','MAZE','MEAL','MEAN','MEAT','MELT','MEMO','MERE','MESH','MESS','MILD','MILE','MILK','MILL','MIME','MIND','MINE','MINT','MISS','MIST','MODE','MOLD','MONK','MOON','MOOR','MORE','MOTE','MUCK','MULE','MUSE','MUSK','MUST',
  'NAIL','NAME','NAPE','NAVY','NEAR','NECK','NEED','NEWS','NEXT','NICE','NINE','NODE','NONE','NOON','NORM','NOSE','NOTE','NULL',
  'OATH','OBOE','ODDS','OKAY','OMEN','ONCE','ONLY','OPEN','ORAL','ORCA','OVAL','OVEN','OVER','OXEN',
  'PACE','PACK','PAGE','PAIN','PAIR','PALE','PALM','PANE','PARK','PART','PASS','PAST','PATH','PAVE','PAWN','PEAK','PEAL','PEAR','PEEL','PEEL','PEER','PEST','PICK','PILE','PINK','PIPE','PLAN','PLAY','PLEA','PLOW','PLOY','PLUG','PLUM','PLUS','POEM','POET','POKE','POLE','POLL','POND','PONY','POOL','POOR','POPE','PORE','PORT','POSE','POUR','PREY','PRIM','PROD','PROP','PULL','PULP','PUMP','PURE','PUSH',
  'QUIP','QUIZ',
  'RACE','RACK','RAGE','RAID','RAIL','RAIN','RAKE','RAMP','RANG','RANK','RANT','RASH','RATE','RAVE','RAYS','RAZZ','READ','REAL','REAP','REEL','RELY','REND','RENT','RICE','RICH','RIDE','RIND','RING','RINK','RIOT','RISE','RISK','ROAM','ROAR','ROBE','ROCK','ROLE','ROLL','ROOF','ROOK','ROOM','ROOT','ROSE','ROUT','RUDE','RUIN','RULE','RUSH','RUST',
  'SAFE','SAGE','SAID','SAIL','SAKE','SALT','SAME','SAND','SANE','SANG','SASH','SAVE','SCAM','SCAN','SCAR','SEAM','SEAT','SEED','SEEK','SEEM','SEEN','SELF','SELL','SEND','SENT','SHED','SHIN','SHIP','SHOE','SHOP','SHOT','SHOW','SHUT','SICK','SIDE','SIFT','SIGN','SILK','SING','SINK','SIZE','SKIP','SLAB','SLAP','SLIM','SLIP','SLOT','SLOW','SLUG','SNAP','SNOB','SNOW','SOAK','SOAP','SOAR','SOCK','SOIL','SOLD','SOLE','SOME','SONG','SORT','SOUL','SOUP','SOUR','SPAN','SPIN','SPIT','SPOT','SPUR','STAR','STAY','STEM','STEP','STEW','STIR','STOP','STUB','STUN','SUCH','SUIT','SULK','SURF','SWAP','SWIM',
  'TACK','TALE','TALK','TALL','TAME','TANK','TAPE','TASK','TEAR','TEAT','TELL','TEND','TENT','TEST','TEXT','THAW','THEM','THEN','THIN','THIS','THUD','THUS','TICK','TIDE','TIED','TILE','TILL','TILT','TINT','TIRE','TOAD','TOLL','TOMB','TOME','TONE','TOOL','TORE','TORN','TOSS','TOTE','TOUR','TOWN','TRAP','TRAY','TREE','TRIM','TRIP','TROD','TRUE','TUBE','TUCK','TUFT','TUNE','TURF','TUSK','TWIN',
  'UGLY','UNDO','UNIT','UPON','USER',
  'VALE','VANE','VARY','VASE','VAST','VEIL','VEIN','VENT','VERY','VIEW','VINE','VOID',
  'WADE','WAGE','WAIL','WAKE','WAND','WANE','WARP','WARY','WASH','WASP','WAVE','WAYS','WEAK','WEAL','WEAN','WEED','WEEK','WELD','WELL','WENT','WEST','WHIM','WHIP','WHIT','WHOM','WICK','WIDE','WILE','WILL','WILT','WIND','WINE','WING','WIRE','WISE','WISH','WITH','WOKE','WOLF','WOOD','WOOL','WORD','WORE','WORK','WORM','WORN','WREN','WRIT',
  'YARD','YARN','YAWN','YEAR','YELL','YOGA','YORE','YOUR',
  'ZEAL','ZERO','ZEST','ZINC','ZONE','ZOOM',
  // 5-letter words (selection)
  'ABBEY','ABIDE','ABORT','ABOUT','ABOVE','ABUSE','ABYSS','ACIDS','ACHED','ACRES','ACUTE','ADULT','AFTER','AGAIN','AGATE','AGENT','AGILE','AGREE','AHEAD','AIDED','AISLE','ALARM','ALERT','ALIKE','ALIVE','ALLAY','ALOFT','ALONE','ALOUD','ANGEL','ANGER','ANGLE','ANGRY','ANIME','ANNEX','ANVIL','APART','APPLE','APPLY','ARENA','ARGUE','ARISE','ARMOR','AROSE','ARROW','ASIDE','ASKEW','ATTIC','AUDIT','AVAIL','AVOID','AWAIT','AWAKE','AWARD','AWARE','AWFUL',
  'BADGE','BADLY','BAKER','BASIC','BASIS','BATCH','BEACH','BEAST','BEGIN','BEING','BELOW','BENCH','BLACK','BLADE','BLAME','BLAND','BLANK','BLAZE','BLEAK','BLEED','BLEND','BLESS','BLIND','BLOCK','BLOOD','BLOOM','BLOWN','BLUNT','BLURB','BOARD','BONUS','BOOST','BOUND','BRACE','BRAID','BRAKE','BRAVE','BREAD','BREAK','BREED','BRIBE','BRIDE','BRIEF','BRING','BROAD','BROKE','BROOK','BROOM','BROTH','BROWN','BRUNT','BRUSH','BUILD','BUILT','BULGE','BUNCH','BURNS','BURST',
  'CAMEL','CANDY','CARGO','CARRY','CATCH','CAUSE','CHAIR','CHAOS','CHARM','CHASE','CHEAP','CHECK','CHEEK','CHEER','CHESS','CHEST','CHIEF','CHILD','CHILL','CHOSE','CIVIC','CIVIL','CLAIM','CLASS','CLEAN','CLEAR','CLIMB','CLING','CLOCK','CLOSE','CLOUD','CLOWN','COAST','COMET','COMIC','COMMA','COUCH','COULD','COUNT','COURT','COVER','CRACK','CRAFT','CRANE','CRASH','CRAZY','CREAM','CREEK','CRIME','CRISP','CROSS','CROWD','CROWN','CRUEL','CRUSH','CURVE',
  'DAILY','DAIRY','DANCE','DATUM','DEALS','DEALT','DECAY','DECOY','DEFER','DELAY','DEPOT','DEPTH','DERBY','DEVIL','DIRTY','DISCO','DIZZY','DOZEN','DRAFT','DRAIN','DRAMA','DRANK','DRAPE','DRAWL','DREAM','DRESS','DRIFT','DRILL','DRINK','DRIVE','DROVE','DYING',
  'EAGER','EARLY','EARTH','EIGHT','ELITE','EMBER','EMERY','EMPTY','ENEMY','ENJOY','ENTER','EQUAL','ERROR','ERUPT','ESSAY','ETHER','EVERY','EXACT','EXCEL','EXIST','EXTRA',
  'FABLE','FACET','FAITH','FALSE','FANCY','FEAST','FERRY','FEVER','FIBER','FIELD','FIGHT','FINAL','FIRST','FIXED','FLANK','FLASH','FLESH','FLICK','FLING','FLOOD','FLOOR','FLOSS','FLOUR','FLUID','FLUSH','FOCUS','FOGGY','FORGE','FORTH','FOUND','FRAME','FRANK','FRAUD','FRESH','FRONT','FROST','FROWN','FROZE','FRUIT','FULLY',
  'GHOST','GIVEN','GLARE','GLIDE','GLINT','GLOBE','GLOSS','GLOVE','GOING','GRACE','GRADE','GRAND','GRANT','GRASP','GRASS','GRAVE','GRAZE','GREAT','GREEN','GREET','GRIEF','GRILL','GRIND','GROAN','GROUP','GROVE','GROWL','GROWN','GRUEL','GUARD','GUEST','GUIDE','GUILD','GUILE','GUISE','GULCH','GULLY',
  'HABIT','HAPPY','HARSH','HASTY','HAUNT','HEART','HEAVE','HEAVY','HEDGE','HELIX','HENCE','HINGE','HOBBY','HOLLY','HOMER','HONEY','HONOR','HORSE','HOTEL','HOUSE','HUMAN','HUMID','HUMOR','HURRY',
  'IMAGE','IMPEL','INDEX','INFER','INNER','INPUT','INTER','INTRO','ISSUE',
  'JEWEL','JOUST','JUDGE','JUICE','JUICY','JUMBO','JUROR',
  'KNEEL','KNIFE','KNOCK','KNOLL',
  'LABEL','LANCE','LARGE','LASER','LATER','LATTE','LAUGH','LAYER','LEARN','LEASE','LEAST','LEAVE','LEDGE','LEGAL','LEMON','LEVEL','LIGHT','LINEN','LIVER','LOCAL','LODGE','LOGIC','LOOSE','LOWER','LUCID','LUCKY','LUNAR','LUNCH','LUSTY',
  'MAGIC','MAJOR','MAKER','MANOR','MAPLE','MARCH','MARSH','MATCH','MAVEN','MAYOR','MEANS','MEDAL','MEDIA','MERIT','MIGHT','MINOR','MINUS','MIRTH','MISER','MIXED','MODEL','MONEY','MONTH','MORAL','MOTOR','MOTTO','MOUNT','MOURN','MOUTH','MOVIE','MUCKY','MUDDY','MUSIC',
  'NAIVE','NASTY','NIGHT','NIFTY','NOBLE','NOISY','NORTH','NUDGE','NURSE',
  'OCCUR','OCEAN','OFFER','OFTEN','OLIVE','ONSET','OPTIC','ORBIT','ORDER','OTHER','OUGHT','OUTER','OUTDO','OVARY','OXIDE',
  'PANDA','PANIC','PANEL','PAPER','PARTY','PASTA','PATCH','PAUSE','PEACE','PEACH','PEARL','PEDAL','PENNY','PHASE','PHONE','PIANO','PIECE','PILOT','PINCH','PITCH','PIXEL','PLACE','PLAIN','PLANT','PLATE','PLAZA','PLEAD','PLUCK','PLUME','POINT','POLAR','POSIT','POUCH','PRANK','PRESS','PRICE','PRIDE','PRIME','PRIOR','PRISM','PRIZE','PROBE','PRONE','PROOF','PROSE','PROUD','PROVE','PSALM','PULSE',
  'QUERY','QUEEN','QUEST','QUEUE','QUOTA','QUOTE',
  'RADAR','RADIO','RAISE','RALLY','RANCH','RANGE','RAPID','RATIO','REACH','READY','REALM','REBEL','REFER','REIGN','RELAX','REPAY','REPLY','RIDER','RIDGE','RISKY','RIVAL','RIVER','ROBIN','ROBOT','ROCKY','ROUGE','ROUGH','ROUND','ROUTE','ROVER','ROYAL','RUGBY','RULER',
  'SADLY','SAINT','SALAD','SAUCE','SCALD','SCALE','SCALP','SCENE','SCENT','SCORE','SCORN','SCOUT','SENSE','SERVE','SEVEN','SHADE','SHAFT','SHAKE','SHALL','SHAME','SHAPE','SHARE','SHARK','SHARP','SHAVE','SHEEP','SHEET','SHELF','SHELL','SHIFT','SHOAL','SHOCK','SHORE','SHORT','SHOUT','SKILL','SKULL','SKUNK','SLATE','SLAVE','SLEEP','SLEEK','SLEET','SLICE','SLIDE','SLIME','SLING','SLOPE','SMART','SMELL','SMILE','SMOKE','SNARE','SOLID','SOLVE','SOUTH','SPACE','SPARE','SPARK','SPEAK','SPEAR','SPEED','SPELL','SPEND','SPILL','SPOKE','SPOON','SPRAY','SQUAD','SQUAT','SQUID','STACK','STAFF','STAGE','STAIN','STAIR','STAKE','STALE','STALL','STAMP','STAND','STANK','STARK','START','STATE','STAVE','STEAL','STEAM','STEEL','STEEP','STERN','STICK','STIFF','STILL','STOCK','STOLE','STONE','STORM','STORY','STOVE','STRAP','STRAW','STRAY','STRIP','STRUT','STUCK','STUDY','STYLE','SUPER','SURGE','SWAMP','SWEAR','SWEEP','SWEET','SWELL','SWEPT','SWIFT','SWIRL',
  'TABLE','TAUNT','TEACH','TEASE','TEMPO','TENSE','THANK','THEIR','THERE','THESE','THICK','THING','THINK','THORN','THOSE','THREE','THROW','TIGHT','TIMER','TIRED','TITLE','TOAST','TODAY','TOPIC','TORCH','TOTAL','TOUCH','TOUGH','TOWEL','TRACE','TRACK','TRADE','TRAIL','TRAIN','TREAT','TRIBE','TRICK','TROOP','TRUCK','TRULY','TRUNK','TRUST','TRUTH','TUMOR','TUTOR','TWICE','TWIST','TYING',
  'ULCER','ULTRA','UNCLE','UNDER','UNIFY','UNION','UNITY','UNTIL','UPPER','UPSET','URBAN','USAGE','USUAL',
  'VAGUE','VALID','VALVE','VALUE','VAPOR','VAULT','VERSE','VIGOR','VIRAL','VISIT','VISTA','VOICE','VOTED',
  'WAFER','WAGER','WALTZ','WASTE','WATCH','WATER','WEARY','WEAVE','WEIGH','WEIRD','WHALE','WHEAT','WHEEL','WHERE','WHILE','WHIRL','WHOSE','WITCH','WOMAN','WOMEN','WORLD','WORRY','WORSE','WORST','WORTH','WOULD','WOUND','WRECK','WRIST','WROTE',
  'YACHT','YIELD','YOUNG','YOUTH',
  'ZONAL',
]);

function _showBadgeDetails(badgeId) {
  const badge = BADGES.find(b => b.id === badgeId);
  if (!badge) return;

  const rarityMap = {
    'max_level': { label: '⭐ Legendary', color: '#f43f5e' },
    'sudden_death_50': { label: '⭐ Legendary', color: '#f43f5e' },
    'immortal': { label: '⭐ Legendary', color: '#f43f5e' },
    'titan': { label: '⭐ Legendary', color: '#f43f5e' },
    'absolute': { label: '⭐ Legendary', color: '#f43f5e' },
    'rank_15': { label: '⭐⭐ Epic', color: '#8b5cf6' },
    'rank_10': { label: '⭐⭐ Epic', color: '#8b5cf6' },
    'xp_100000': { label: '⭐⭐ Epic', color: '#8b5cf6' },
    'mythic_scholar': { label: '⭐⭐ Epic', color: '#8b5cf6' },
    'hall_of_fame': { label: '⭐⭐ Epic', color: '#8b5cf6' },
    'perfect_quiz': { label: '⭐⭐⭐ Rare', color: '#06b6d4' },
    'perfect_scramble': { label: '⭐⭐⭐ Rare', color: '#06b6d4' },
    'perfect_blitz': { label: '⭐⭐⭐ Rare', color: '#06b6d4' },
    'perfect_tf': { label: '⭐⭐⭐ Rare', color: '#06b6d4' },
    'math_perfect': { label: '⭐⭐⭐ Rare', color: '#06b6d4' },
    'streak_20': { label: '⭐⭐⭐ Rare', color: '#06b6d4' },
    'streak_10': { label: '⭐⭐⭐ Rare', color: '#06b6d4' },
    'challenge_10': { label: '⭐⭐⭐ Rare', color: '#06b6d4' },
    'sudden_death_30': { label: '⭐⭐⭐ Rare', color: '#06b6d4' },
    'sudden_death_25': { label: '⭐⭐⭐ Rare', color: '#06b6d4' },
  };

  const rarity = rarityMap[badgeId] || { label: 'Common', color: '#22c55e' };

  _showModal(`
    <div style="text-align:center;margin-bottom:1.5rem;">
      <div style="margin-bottom:1rem;padding:1rem;background:${rarity.color}22;border-radius:16px;display:inline-block;">
        ${_icon(badge.icon, 64, { color: rarity.color })}
      </div>
      <h2 style="font-size:1.375rem;font-weight:800;color:var(--text-1);margin-bottom:.5rem;">
        ${_esc(badge.name)}
      </h2>
      <p style="font-size:.875rem;color:var(--text-3);line-height:1.6;margin:0;">
        ${_esc(badge.desc)}
      </p>
    </div>

    <div style="background:var(--bg-subtle);border:2px solid var(--border);border-radius:12px;
                padding:1.125rem;margin-bottom:1rem;">
      <p style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
                color:var(--text-3);margin-bottom:.75rem;">How to Earn</p>
      <p style="font-size:.9375rem;color:var(--text-2);line-height:1.7;margin:0;">
        ${_esc(badge.desc)}
      </p>
    </div>

    <div style="background:var(--success-subtle);border:2px solid var(--success-border);border-radius:12px;
                padding:1.125rem;margin-bottom:1rem;text-align:center;">
      <p style="font-size:.6875rem;font-weight:700;color:var(--success);text-transform:uppercase;
                letter-spacing:.08em;margin-bottom:.625rem;">Badge Status</p>
      <div style="display:flex;align-items:center;justify-content:center;gap:.625rem;">
        <span style="font-size:1.5rem;color:var(--success);">✓</span>
        <span style="font-size:.9375rem;font-weight:700;color:var(--text-1);">Earned & Unlocked</span>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1rem;">
      <div style="background:var(--bg-subtle);border:1px solid var(--border);border-radius:10px;
                  padding:.875rem;text-align:center;">
        <div style="font-size:.6875rem;font-weight:700;color:var(--text-3);text-transform:uppercase;
                    letter-spacing:.06em;margin-bottom:.375rem;">Badge ID</div>
        <div style="font-size:.8125rem;color:var(--text-1);font-family:var(--font-mono);word-break:break-all;">
          ${_esc(badge.id)}
        </div>
      </div>
      <div style="background:var(--bg-subtle);border:1px solid var(--border);border-radius:10px;
                  padding:.875rem;text-align:center;">
        <div style="font-size:.6875rem;font-weight:700;color:var(--text-3);text-transform:uppercase;
                    letter-spacing:.06em;margin-bottom:.375rem;">Rarity</div>
        <div style="font-size:.9375rem;font-weight:800;color:${rarity.color};">
          ${rarity.label}
        </div>
      </div>
    </div>

    <div style="padding:1rem;background:linear-gradient(135deg,${rarity.color}15,${rarity.color}08);
                border:1px solid ${rarity.color}40;border-radius:10px;margin-bottom:1.25rem;">
      <p style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
                color:${rarity.color};margin-bottom:.5rem;display:flex;align-items:center;gap:.375rem;">
        ${_icon('star', 13, { color: rarity.color })} Achievement Unlocked!
      </p>
      <p style="font-size:.8125rem;color:var(--text-2);line-height:1.6;margin:0;">
        You've proven your dedication by earning this badge. Keep playing to unlock more badges and climb the ranks towards the top!
      </p>
    </div>

    <button onclick="Game._closeModal()" class="btn w-full" style="background:var(--accent);color:#fff;font-weight:700;">
      Close
    </button>
  `);
}

/* ══════════════════════════════════════════════════════════════
   WORD SCRABBLE — HELPERS
══════════════════════════════════════════════════════════════ */

/** Build a fresh shuffled bag of 100 tiles */
function _wsBuildBag() {
  const bag = [];
  WS_TILES.forEach(([letter, count, points]) => {
    for (let i = 0; i < count; i++) bag.push({ letter, points, id: `${letter}_${i}_${Math.random()}` });
  });
  return _shuffleArray(bag);
}

/** Draw n tiles from bag (mutates bag array), returns drawn tiles */
function _wsDraw(bag, n) {
  return bag.splice(0, Math.min(n, bag.length));
}

/** Refill rack from bag up to WS_RACK_SIZE, returns new rack */
function _wsRefillRack(rack, bag) {
  const needed = WS_RACK_SIZE - rack.length;
  if (needed > 0) rack.push(..._wsDraw(bag, needed));
  return rack;
}

/** Return letter point value */
function _wsPoints(letter) {
  const entry = WS_TILES.find(([l]) => l === letter);
  return entry ? entry[2] : 0;
}

/** Get premium type for cell */
function _wsPremium(row, col) {
  return (WS_PREMIUM[row] && WS_PREMIUM[row][col]) || '';
}

/** Check whether a word is valid */
function _wsValidWord(word) {
  return WS_WORDLIST.has(word.toUpperCase());
}

/** 
 * Given the board (15x15 array of {letter,points,blank} or null)
 * and a set of newly placed cells [{row,col,letter,points,blank}],
 * collect ALL words formed (the main word + any cross words).
 * Returns [{word, cells, score}] or null if placement is invalid.
 */
function _wsCollectWords(board, newCells) {
  if (newCells.length === 0) return null;

  const rows = [...new Set(newCells.map(c => c.row))];
  const cols = [...new Set(newCells.map(c => c.col))];
  if (rows.length > 1 && cols.length > 1) return null;

  const horizontal = rows.length === 1;

  // Merge new cells into a copy of the board for scanning
  const tempBoard = board.map(row => row.map(cell => cell ? { ...cell } : null));
  newCells.forEach(({ row, col, letter, points, blank }) => {
    tempBoard[row][col] = { letter, points, blank: !!blank };
  });

  const newCellSet = new Set(newCells.map(c => `${c.row},${c.col}`));

  // Scan using tempBoard so newly placed tiles are visible
  function scanWord(r, c, isHorizontal) {
    let sr = r, sc = c;
    if (isHorizontal) { while (sc > 0 && tempBoard[sr][sc - 1]) sc--; }
    else              { while (sr > 0 && tempBoard[sr - 1][sc]) sr--; }

    const cells = [];
    let cr = sr, cc = sc;
    while (cr < WS_BOARD_SIZE && cc < WS_BOARD_SIZE && tempBoard[cr][cc]) {
      cells.push({ row: cr, col: cc, ...tempBoard[cr][cc] });
      if (isHorizontal) cc++; else cr++;
    }
    return cells;
  }

  const words = [];

  if (newCells.length === 1) {
    // Single tile: check both directions
    const hCells = scanWord(newCells[0].row, newCells[0].col, true);
    const vCells = scanWord(newCells[0].row, newCells[0].col, false);
    if (hCells.length >= 2) words.push({ word: hCells.map(c => c.letter).join(''), cells: hCells, score: _wsScoreWord(hCells, newCellSet) });
    if (vCells.length >= 2) words.push({ word: vCells.map(c => c.letter).join(''), cells: vCells, score: _wsScoreWord(vCells, newCellSet) });
  } else {
    // Main word along the primary direction
    const mainCells = scanWord(newCells[0].row, newCells[0].col, horizontal);
    if (mainCells.length >= 2) {
      const word = mainCells.map(c => c.letter).join('');
      const score = _wsScoreWord(mainCells, newCellSet);
      words.push({ word, cells: mainCells, score });
    }

    // Cross words: each newly placed tile may form a perpendicular word
    newCells.forEach(nc => {
      const crossCells = scanWord(nc.row, nc.col, !horizontal);
      if (crossCells.length >= 2) {
        const word = crossCells.map(c => c.letter).join('');
        const score = _wsScoreWord(crossCells, newCellSet);
        words.push({ word, cells: crossCells, score });
      }
    });
  }

  return words.length > 0 ? words : null;
}

/**
 * Score a word given its cells and the set of newly placed cell keys.
 * Premium squares only apply to newly placed tiles.
 */
function _wsScoreWord(cells, newCellSet) {
  let wordScore = 0;
  let wordMult  = 1;

  cells.forEach(({ row, col, letter, points, blank }) => {
    const key  = `${row},${col}`;
    const prem = newCellSet.has(key) ? _wsPremium(row, col) : '';
    let lp     = blank ? 0 : (points || _wsPoints(letter));

    if (prem === 'DL') lp *= 2;
    if (prem === 'TL') lp *= 3;
    if (prem === 'DW' || prem === 'ST') wordMult *= 2;
    if (prem === 'TW') wordMult *= 3;

    wordScore += lp;
  });

  return wordScore * wordMult;
}

/**
 * Validate a full move:
 * - All new cells connected
 * - First move must cover centre (7,7)
 * - Non-first move must connect to existing tiles
 * - All words formed are valid
 * Returns { valid, words, totalScore, error }
 */
function _wsValidateMove(board, newCells, isFirstMove) {
  if (newCells.length === 0) return { valid: false, error: 'No tiles placed.' };

  const rows = [...new Set(newCells.map(c => c.row))];
  const cols = [...new Set(newCells.map(c => c.col))];
  if (rows.length > 1 && cols.length > 1) {
    return { valid: false, error: 'All tiles must be in the same row or column.' };
  }

  // Check no gaps between placed tiles
  if (newCells.length > 1) {
    const horizontal = rows.length === 1;
    const sorted = [...newCells].sort((a, b) => horizontal ? a.col - b.col : a.row - b.row);
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i], next = sorted[i + 1];
      const diff = horizontal ? next.col - curr.col : next.row - curr.row;
      if (diff > 1) {
        // Gap only valid if filled by existing board tile
        const gapFilled = horizontal
          ? Array.from({ length: diff - 1 }, (_, k) => board[curr.row][curr.col + k + 1]).every(Boolean)
          : Array.from({ length: diff - 1 }, (_, k) => board[curr.row + k + 1][curr.col]).every(Boolean);
        if (!gapFilled) return { valid: false, error: 'Tiles must be placed continuously (no gaps).' };
      }
    }
  }

  if (isFirstMove) {
    const coversCentre = newCells.some(c => c.row === 7 && c.col === 7);
    if (!coversCentre) return { valid: false, error: 'First word must cover the centre square (★).' };
    if (newCells.length < 2) return { valid: false, error: 'First word must be at least 2 letters.' };
  } else {
    // Must touch at least one existing tile
    const tempBoard = board.map(row => row.map(cell => cell ? { ...cell } : null));
    newCells.forEach(({ row, col, letter, points }) => { tempBoard[row][col] = { letter, points }; });
    const adjacent = newCells.some(({ row, col }) => {
      return (row > 0 && board[row-1][col]) ||
             (row < 14 && board[row+1][col]) ||
             (col > 0 && board[row][col-1]) ||
             (col < 14 && board[row][col+1]);
    });
    if (!adjacent) return { valid: false, error: 'Word must connect to an existing tile on the board.' };
  }

  const words = _wsCollectWords(board, newCells);
  if (!words || words.length === 0) return { valid: false, error: 'No valid word formed.' };

  const invalidWords = words.filter(w => !_wsValidWord(w.word));
  if (invalidWords.length > 0) {
    return { valid: false, error: `"${invalidWords[0].word}" is not a valid word.` };
  }

  let totalScore = words.reduce((s, w) => s + w.score, 0);
  if (newCells.length === 7) totalScore += WS_BINGO_BONUS; // Bingo!

  return { valid: true, words, totalScore };
}

/** Blank board — 15×15 of nulls */
function _wsBlankBoard() {
  return Array.from({ length: WS_BOARD_SIZE }, () => Array(WS_BOARD_SIZE).fill(null));
}

/** Serialise board for Firestore (null → 0, cell → {l,p,b}) */
function _wsSerialiseBoard(board) {
  const flat = [];
  for (let r = 0; r < WS_BOARD_SIZE; r++) {
    for (let c = 0; c < WS_BOARD_SIZE; c++) {
      const cell = board[r][c];
      flat.push(cell ? { l: cell.letter, p: cell.points, b: cell.blank ? 1 : 0 } : 0);
    }
  }
  return flat;
}

function _wsDeserialiseBoard(raw) {
  const board = Array.from({ length: WS_BOARD_SIZE }, () => Array(WS_BOARD_SIZE).fill(null));
  for (let r = 0; r < WS_BOARD_SIZE; r++) {
    for (let c = 0; c < WS_BOARD_SIZE; c++) {
      const cell = raw[r * WS_BOARD_SIZE + c];
      board[r][c] = (cell === 0 || cell === null)
        ? null
        : { letter: cell.l, points: cell.p, blank: !!cell.b };
    }
  }
  return board;
}

/* ══════════════════════════════════════════════════════════════
   WORD SCRABBLE — GAME FLOW
══════════════════════════════════════════════════════════════ */

let _wsState = null; // active local scrabble game state

// ── Setup modal ──────────────────────────────────────────────
async function _showScrabbleSetup() {
  const myClass = _student().class || '';
  if (!myClass) { window.UI.toast('Your class is not set. Contact your teacher.', 'error'); return; }

  let classmates = [];
  if (_isOnline()) {
    try {
      const snap = await _db().collection('students').where('class', '==', myClass).get();
      snap.forEach(doc => {
        if (doc.id !== _uid()) classmates.push({ id: doc.id, name: doc.data().name || 'Unknown' });
      });
    } catch (e) {
      window.UI.toast('Could not load classmates. Please check your connection.', 'error');
      return;
    }
  } else {
    window.UI.toast('Word Scrabble requires an internet connection to challenge a classmate.', 'warning');
    return;
  }

  if (classmates.length === 0) {
    window.UI.toast("No classmates found — you're the only one in your class!", 'info');
    return;
  }

  const classmateOptions = classmates
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => `<option value="${_esc(c.id)}">${_esc(c.name)}</option>`)
    .join('');

  _showModal(`
    <div style="text-align:center;margin-bottom:1.25rem;">
      <div style="margin-bottom:.5rem;font-size:2.5rem;">🔤</div>
      <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">Word Scrabble</h2>
      <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;line-height:1.6;">
        Classic Scrabble against a classmate. Place words on the 15×15 board,
        score points with premium squares, and race to empty your rack.
      </p>
    </div>

    <div style="margin-bottom:1rem;padding:.875rem 1rem;background:var(--accent-subtle);
                border:1px solid var(--accent-border);border-radius:8px;
                font-size:.8125rem;color:var(--text-2);line-height:1.8;">
      <strong style="display:block;margin-bottom:.375rem;">Quick Rules</strong>
      • Each player draws 7 tiles. Take turns placing words.<br>
      • Every new word must connect to an existing word on the board.<br>
      • Premium squares (DL, TL, DW, TW) multiply your score.<br>
      • Use all 7 tiles in one turn for a <strong>+50 BINGO bonus</strong>.<br>
      • You can swap tiles instead of playing (costs your turn).<br>
      • Game ends when the tile bag is empty and one player uses their last tile.
    </div>

    <div style="margin-bottom:1.25rem;">
      <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.375rem;">
        Challenge Who?
      </label>
      <select id="scrabbleTarget" style="width:100%;">${classmateOptions}</select>
    </div>

    <button onclick="Game._sendScrabbleChallenge()" class="btn btn-lg w-full"
            style="background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;">
      🔤 Send Scrabble Challenge
    </button>
    <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Cancel</button>
  `);
}

// ── Send challenge ───────────────────────────────────────────
async function _sendScrabbleChallenge() {
  const targetSel = document.getElementById('scrabbleTarget');
  const targetUid = targetSel ? targetSel.value : null;
  if (!targetUid) { window.UI.toast('Please select a classmate.', 'warning'); return; }
  const targetName = targetSel.options[targetSel.selectedIndex]?.text || 'Unknown';

  const sendBtn = document.querySelector('#gameModal .btn:not(.bg-gray-500)');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Sending…'; }

  const bag   = _wsBuildBag();
  const rack1 = _wsDraw(bag, WS_RACK_SIZE);
  const rack2 = _wsDraw(bag, WS_RACK_SIZE);
  const board = _wsBlankBoard();

  const _serialiseTiles = (tiles) => tiles.map(t => ({ l: t.letter, p: t.points }));
  const _serialiseBag   = (tiles) => tiles.map(t => ({ l: t.letter, p: t.points }));

  try {
    await _db().collection('scrabbleGames').add({
      player1Uid:   _uid(),
      player1Name:  _student().name  || '',
      player2Uid:   targetUid,
      player2Name:  targetName,
      class:        _student().class  || '',
      school:       _student().school || '',
      status:       'pending',
      // First turn goes to player2 (challenged student) so they play immediately after accepting
      turn:         targetUid,
      board:        _wsSerialiseBoard(board),
      bag:          _serialiseBag(bag),
      rack1:        _serialiseTiles(rack1),
      rack2:        _serialiseTiles(rack2),
      score1:       0,
      score2:       0,
      passCount:    0,
      moveLog:      [],
      createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
      lastMoveAt:   firebase.firestore.FieldValue.serverTimestamp(),
    });
    _closeModal();
    window.UI.toast(`Scrabble challenge sent to ${targetName}! Waiting for them to accept.`, 'success', 5000);
  } catch (e) {
    console.error('[scrabble] _sendScrabbleChallenge error:', e.code, e.message, e);
    window.UI.toast('Could not send challenge. Please try again.', 'error');
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '🔤 Send Scrabble Challenge'; }
  }
}

// ── Show pending scrabble games ──────────────────────────────
async function _showScrabblePending() {
  const uid = _uid();
  let pendingGames = [];
  let activeGames  = [];

  try {
    const snap = await _db().collection('scrabbleGames')
      .where('player2Uid', '==', uid)
      .where('status', '==', 'pending')
      .get();
    snap.docs.forEach(doc => pendingGames.push({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.error('[scrabble] pending fetch error:', e.code, e.message);
    window.UI.toast('Could not load Scrabble invitations.', 'error');
    return;
  }

  try {
    const [snap1, snap2] = await Promise.all([
      _db().collection('scrabbleGames').where('player1Uid', '==', uid).where('status', '==', 'active').get(),
      _db().collection('scrabbleGames').where('player2Uid', '==', uid).where('status', '==', 'active').get(),
    ]);
    const seen = new Set();
    [...snap1.docs, ...snap2.docs].forEach(doc => {
      if (seen.has(doc.id)) return;
      seen.add(doc.id);
      activeGames.push({ id: doc.id, ...doc.data() });
    });
  } catch (e) {
    console.warn('[scrabble] active fetch error:', e.code, e.message);
  }

  if (pendingGames.length === 0 && activeGames.length === 0) {
    window.UI.toast('No Scrabble games right now.', 'info');
    return;
  }

  const pendingHtml = pendingGames.map(g => `
    <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:8px;
                padding:.75rem 1rem;margin-bottom:.5rem;">
      <p style="font-size:.9375rem;font-weight:700;color:var(--text-1);">
        🔤 ${_esc(g.player1Name)} challenged you to Scrabble!
      </p>
      <div style="display:flex;gap:.375rem;margin-top:.5rem;">
        <button onclick="Game._acceptScrabble('${_esc(g.id)}')"
                class="btn" style="flex:1;font-size:.8125rem;">Accept &amp; Play</button>
        <button onclick="Game._declineScrabble('${_esc(g.id)}')"
                class="btn bg-gray-500" style="flex:1;font-size:.8125rem;">Decline</button>
      </div>
    </div>`).join('');

  const activeHtml = activeGames.map(g => {
    const isP1     = g.player1Uid === uid;
    const oppName  = isP1 ? g.player2Name : g.player1Name;
    const myScore  = isP1 ? g.score1 : g.score2;
    const oppScore = isP1 ? g.score2 : g.score1;
    const isMyTurn = g.turn === uid;
    return `
    <div style="background:${isMyTurn ? 'var(--accent-subtle)' : 'var(--bg-subtle)'};
                border:1.5px solid ${isMyTurn ? 'var(--accent-border)' : 'var(--border)'};
                border-radius:8px;padding:.75rem 1rem;margin-bottom:.5rem;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.375rem;">
        <p style="font-size:.9375rem;font-weight:700;
                  color:${isMyTurn ? 'var(--accent-text)' : 'var(--text-2)'};">
          ${isMyTurn ? '⚡ Your turn' : '⏳ Their turn'} vs ${_esc(oppName)}
        </p>
        <span style="font-size:.8125rem;font-weight:700;color:var(--text-3);">
          ${myScore} – ${oppScore}
        </span>
      </div>
      <p style="font-size:.75rem;color:var(--text-3);margin-bottom:.5rem;">
        ${isMyTurn
          ? 'It\'s your move — open the board and place a word.'
          : `Waiting for ${_esc(oppName)} to play.`}
      </p>
      <button onclick="Game._openScrabbleGame('${_esc(g.id)}')"
              class="btn w-full"
              style="font-size:.8125rem;${isMyTurn ? 'background:var(--accent);color:#fff;' : ''}">
        Open Board
      </button>
    </div>`;
  }).join('');

  _showModal(`
    <div style="margin-bottom:1rem;">
      <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">
        🔤 Scrabble Games
      </h2>
    </div>
    ${pendingHtml}
    ${activeHtml}
    <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Close</button>
    <button onclick="Game._closeModal();Game.openGameLobby();" class="btn bg-gray-500 w-full" style="margin-top:.375rem;">
      ← Back to Games Lobby
    </button>
  `);
}

async function _acceptScrabble(gameId) {
  try {
    // Set status to active. Turn is already set to player2 from _sendScrabbleChallenge.
    await _db().collection('scrabbleGames').doc(gameId).update({ status: 'active' });
    _closeModal();
    await _openScrabbleGame(gameId);
  } catch (e) {
    console.error('[scrabble] _acceptScrabble error:', e);
    window.UI.toast('Could not accept game.', 'error');
  }
}

async function _declineScrabble(gameId) {
  try {
    await _db().collection('scrabbleGames').doc(gameId).update({ status: 'declined' });
    _closeModal();
    window.UI.toast('Scrabble game declined.', 'info');
  } catch (e) {
    window.UI.toast('Could not decline game.', 'error');
  }
}

// ── Open and render the Scrabble board ───────────────────────
let _wsListener = null;

async function _openScrabbleGame(gameId) {
  _closeModal();
  if (_wsListener) { _wsListener(); _wsListener = null; }

  window.UI.mount(`
    <div style="text-align:center;padding:3rem;color:var(--text-3);">
      Loading Scrabble board…
    </div>`);

  _wsListener = _db().collection('scrabbleGames').doc(gameId)
    .onSnapshot(snap => {
      if (!snap.exists) { window.UI.toast('This game no longer exists.', 'error'); return; }
      _wsRenderGame(gameId, snap.data());
    }, err => {
      console.error('[scrabble] listener error:', err);
      window.UI.toast('Lost connection to the game. Please refresh.', 'error');
    });
}

// ── Render the full Scrabble game UI ────────────────────────
function _wsRenderGame(gameId, data) {
  const uid      = _uid();
  const isP1     = data.player1Uid === uid;
  const myRack   = isP1
    ? (data.rack1 || []).map(t => ({ letter: t.l, points: t.p }))
    : (data.rack2 || []).map(t => ({ letter: t.l, points: t.p }));
  const myScore  = isP1 ? data.score1 : data.score2;
  const oppScore = isP1 ? data.score2 : data.score1;
  const oppName  = isP1 ? data.player2Name : data.player1Name;
  const myName   = isP1 ? data.player1Name : data.player2Name;
  const isMyTurn = data.turn === uid;
  const board    = _wsDeserialiseBoard(data.board);
  const bagLeft  = (data.bag || []).length;
  const finished = data.status === 'finished';

  // Build local game state for tile placement
  if (!_wsState || _wsState.gameId !== gameId) {
    _wsState = {
      gameId,
      isP1,
      placed:     [],     // tiles placed this turn [{row,col,letter,points,blank,rackIdx}]
      selected:   null,   // index of selected rack tile
      blankLetter: null,  // letter chosen for blank tile being placed
    };
  }
  // Don't reset placed tiles if we're just re-rendering from a snapshot
  // but DO reset if it's not our turn (opponent just moved)
  if (!isMyTurn) {
    _wsState.placed   = [];
    _wsState.selected = null;
  }

  // Premium square colours
  const premColour = { TW:'#ef4444', DW:'#f9a8d4', TL:'#3b82f6', DL:'#93c5fd', ST:'#fbbf24', '':'transparent' };
  const premLabel  = { TW:'TW', DW:'DW', TL:'TL', DL:'DL', ST:'★', '':'' };

  // Build board HTML — each cell is clickable
  let boardHtml = '';
  for (let r = 0; r < WS_BOARD_SIZE; r++) {
    for (let c = 0; c < WS_BOARD_SIZE; c++) {
      const cell    = board[r][c];
      const prem    = _wsPremium(r, c);
      const placed  = _wsState.placed.find(p => p.row === r && p.col === c);
      const bgColor = premColour[prem] || 'transparent';
      const onclick = isMyTurn && !finished ? `Game._wsCellClick(${r},${c})` : '';

      let cellContent = '';
      let cellStyle   = `background:${bgColor};`;

      if (cell) {
        // Permanent tile
        cellStyle += 'background:#d4b483;border:1px solid #a0845c;';
        cellContent = `
          <span style="font-size:clamp(7px,1.8vw,12px);font-weight:800;color:#1a0a00;line-height:1;">${_esc(cell.letter)}</span>
          <span style="font-size:clamp(4px,1vw,7px);color:#5a3000;font-weight:600;position:absolute;bottom:1px;right:2px;">${cell.blank ? '' : cell.points}</span>`;
      } else if (placed) {
        // Freshly placed tile this turn
        cellStyle += 'background:#fde68a;border:2px solid #f59e0b;';
        cellContent = `
          <span style="font-size:clamp(7px,1.8vw,12px);font-weight:800;color:#78350f;line-height:1;">${_esc(placed.letter)}</span>
          <span style="font-size:clamp(4px,1vw,7px);color:#92400e;font-weight:600;position:absolute;bottom:1px;right:2px;">${placed.blank ? '' : placed.points}</span>`;
      } else {
        // Empty cell
        if (prem) {
          cellContent = `<span style="font-size:clamp(4px,1vw,7px);font-weight:700;color:${prem==='TW'||prem==='TL'?'#fff':'#1e3a8a'};opacity:.9;">${premLabel[prem]}</span>`;
        }
      }

      boardHtml += `
        <div onclick="${onclick}"
             style="position:relative;width:100%;padding-bottom:100%;border:1px solid rgba(0,0,0,0.12);
                    box-sizing:border-box;${cellStyle}cursor:${onclick?'pointer':'default'};
                    display:flex;align-items:center;justify-content:center;overflow:hidden;
                    ${placed ? 'box-shadow:inset 0 0 0 2px #f59e0b;' : ''}">
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;
                      align-items:center;justify-content:center;">
            ${cellContent}
          </div>
        </div>`;
    }
  }

  // Rack HTML
  const rackHtml = myRack.map((tile, idx) => {
    const isSelected = _wsState.selected === idx;
    const isPlaced   = _wsState.placed.some(p => p.rackIdx === idx);
    return `
      <button onclick="Game._wsRackClick(${idx})"
              ${isPlaced ? 'disabled' : ''}
              style="width:clamp(32px,9vw,44px);height:clamp(38px,10vw,50px);
                     border-radius:6px;font-weight:800;
                     font-size:clamp(12px,3vw,18px);
                     border:2px solid ${isSelected ? '#7c3aed' : '#a0845c'};
                     background:${isPlaced ? '#e5e7eb' : isSelected ? '#ede9fe' : '#f5deb3'};
                     color:${isPlaced ? '#9ca3af' : isSelected ? '#7c3aed' : '#1a0a00'};
                     cursor:${isPlaced ? 'not-allowed' : 'pointer'};
                     position:relative;box-shadow:${isSelected ? '0 0 0 3px #c4b5fd' : '0 2px 4px rgba(0,0,0,.15)'};
                     transition:all .12s;font-family:var(--font);
                     display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:0;">
        ${_esc(tile.letter === '?' ? '★' : tile.letter)}
        <span style="font-size:clamp(6px,1.5vw,9px);font-weight:600;color:${isPlaced?'#9ca3af':isSelected?'#7c3aed':'#5a3000'};">
          ${tile.letter === '?' ? '0' : tile.points}
        </span>
      </button>`;
  }).join('');

  // Move log (last 5 moves)
  const log = (data.moveLog || []).slice(-5).reverse();
  const logHtml = log.length > 0
    ? log.map(m => `
        <div style="font-size:.75rem;color:var(--text-3);padding:.25rem 0;border-bottom:1px solid var(--border);">
          <span style="font-weight:700;color:var(--text-2);">${_esc(m.name)}</span>
          ${m.type === 'play'
            ? ` played <strong>${_esc(m.word)}</strong> for <strong style="color:var(--accent);">+${m.score} pts</strong>`
            : m.type === 'swap'
            ? ' swapped tiles'
            : ' passed'}
        </div>`).join('')
    : '<div style="font-size:.75rem;color:var(--text-4);font-style:italic;">No moves yet.</div>';

  const turnBanner = finished
    ? `<div style="text-align:center;padding:.625rem 1rem;border-radius:8px;margin-bottom:.75rem;
                   background:var(--success-subtle);border:1px solid var(--success-border);">
         <span style="font-size:.9375rem;font-weight:700;color:var(--success);">🏁 Game Over!</span>
       </div>`
    : isMyTurn
    ? `<div style="text-align:center;padding:.625rem 1rem;border-radius:8px;margin-bottom:.75rem;
                   background:var(--accent-subtle);border:1px solid var(--accent-border);
                   animation:gameChallengePopIn .3s ease both;">
         <span style="font-size:.875rem;font-weight:700;color:var(--accent-text);">⚡ Your turn — place a word!</span>
       </div>`
    : `<div style="text-align:center;padding:.625rem 1rem;border-radius:8px;margin-bottom:.75rem;
                   background:var(--bg-subtle);border:1px solid var(--border);">
         <span style="font-size:.875rem;color:var(--text-3);">⏳ Waiting for ${_esc(oppName)}…</span>
       </div>`;
      
      // Cache for lightweight re-renders
  _wsCachedData   = data;
  _wsCachedBoard  = board;
  _wsCachedMyRack = myRack;

  window.UI.mount(`
    <div class="max-w-2xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">

      <!-- Header -->
      <div class="glass" style="padding:.875rem 1.125rem;margin-bottom:.625rem;border-radius:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;">
          <div style="text-align:center;flex:1;">
            <div style="font-size:.75rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;">${_esc(myName)} (You)</div>
            <div style="font-size:1.75rem;font-weight:900;color:var(--accent);font-family:var(--font-mono);">${myScore}</div>
          </div>
          <div style="text-align:center;flex-shrink:0;padding:0 .75rem;">
            <div style="font-size:.625rem;color:var(--text-4);text-transform:uppercase;letter-spacing:.06em;">Tiles left</div>
            <div style="font-size:1.125rem;font-weight:700;color:var(--text-2);">${bagLeft}</div>
            <div style="font-size:.5625rem;color:var(--text-4);">in bag</div>
          </div>
          <div style="text-align:center;flex:1;">
            <div style="font-size:.75rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;">${_esc(oppName)}</div>
            <div style="font-size:1.75rem;font-weight:900;color:var(--danger);font-family:var(--font-mono);">${oppScore}</div>
          </div>
        </div>
      </div>

      ${turnBanner}

      <!-- Board -->
      <div id="wsBoard" style="display:grid;grid-template-columns:repeat(15,1fr);
                  background:#5c8a3e;padding:4px;border-radius:8px;
                  box-shadow:0 4px 16px rgba(0,0,0,.25);margin-bottom:.75rem;
                  border:3px solid #4a7032;">
        ${boardHtml}
      </div>

      <!-- Premium square legend -->
      <div style="display:flex;gap:.375rem;flex-wrap:wrap;justify-content:center;margin-bottom:.75rem;">
        ${Object.entries({TW:'Triple Word',DW:'Double Word',TL:'Triple Letter',DL:'Double Letter'}).map(([k,v])=>`
          <span style="font-size:.625rem;font-weight:700;padding:2px 7px;border-radius:4px;
                       background:${premColour[k]};color:${k==='DW'||k==='DL'?'#1e3a8a':'#fff'};">${k} = ${v}</span>
        `).join('')}
      </div>

      ${isMyTurn && !finished ? `
      <!-- Rack -->
      <div class="glass" style="padding:.875rem;border-radius:10px;margin-bottom:.625rem;text-align:center;">
        <p style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
                  color:var(--text-3);margin-bottom:.625rem;">Your Tiles — Tap a tile, then tap a board square</p>
        <div style="display:flex;gap:.375rem;justify-content:center;flex-wrap:wrap;" id="wsRack">
          ${rackHtml}
        </div>
      </div>

      <!-- Action buttons -->
      <div id="wsWordPreview" style="min-height:2rem;text-align:center;margin-bottom:.375rem;font-size:.875rem;font-weight:700;color:var(--accent);"></div>

      <div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center;margin-bottom:.75rem;">
        <button onclick="Game._wsConfirmPlay('${_esc(gameId)}')"
                id="wsPlayBtn"
                class="btn" style="background:#16a34a;color:#fff;display:flex;align-items:center;gap:.375rem;">
          ✓ Play Word
        </button>
        <button onclick="Game._wsRecall()"
                class="btn bg-gray-500" style="display:flex;align-items:center;gap:.375rem;">
          ↩ Recall
        </button>
        <button onclick="Game._wsSwapTiles('${_esc(gameId)}')"
                class="btn bg-gray-500" style="display:flex;align-items:center;gap:.375rem;"
                ${bagLeft < 1 ? 'disabled' : ''}>
          ⇄ Swap
        </button>
        <button onclick="Game._wsPass('${_esc(gameId)}')"
                class="btn bg-gray-500" style="display:flex;align-items:center;gap:.375rem;">
          ⏭ Pass
        </button>
      </div>
      ` : ''}

      ${finished ? `
      <!-- Final result -->
      <div class="glass" style="padding:1.25rem;border-radius:10px;text-align:center;margin-bottom:.75rem;">
        ${myScore > oppScore
          ? `<p style="font-size:1.125rem;font-weight:800;color:var(--success);">🏆 You Win!</p>`
          : myScore < oppScore
          ? `<p style="font-size:1.125rem;font-weight:800;color:var(--danger);">You Lost. Better luck next time!</p>`
          : `<p style="font-size:1.125rem;font-weight:800;color:var(--warning);">It's a Tie!</p>`}
        <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;">
          ${_esc(myName)}: ${myScore} pts &nbsp;|&nbsp; ${_esc(oppName)}: ${oppScore} pts
        </p>
        <button onclick="Game._wsLeave()" class="btn bg-gray-500" style="margin-top:.875rem;">Back to Games</button>
      </div>
      ` : `
      <!-- Move log -->
      <div class="glass-dark" style="padding:.875rem;border-radius:10px;margin-bottom:.75rem;">
        <p style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
                  color:var(--text-3);margin-bottom:.5rem;">Recent Moves</p>
        ${logHtml}
      </div>
      <div style="text-align:center;">
        <button onclick="Game._wsLeave()" class="btn bg-gray-500" style="font-size:.8125rem;">
          ← Back to Games
        </button>
      </div>
      `}
    </div>
  `);

  // Update word preview if tiles already placed
  if (_wsState.placed.length > 0) _wsUpdatePreview(board);
}

// ── Tile interaction ─────────────────────────────────────────

function _wsRackClick(idx) {
  if (!_wsState) return;
  if (_wsState.placed.some(p => p.rackIdx === idx)) return; // already placed
  _wsState.selected = _wsState.selected === idx ? null : idx;
  // Re-render rack only (cheap)
  _wsRefreshRack();
}

function _wsCellClick(row, col) {
  if (!_wsState) return;
  const gameId = _wsState.gameId;

  // If clicking a placed tile — recall just that tile
  const placedIdx = _wsState.placed.findIndex(p => p.row === row && p.col === col);
  if (placedIdx !== -1) {
    _wsState.placed.splice(placedIdx, 1);
    _wsState.selected = null;
    _wsRefreshBoard();
    _wsRefreshRack();
    // Rebuild preview
    const data = _wsCachedData;
    if (data) _wsUpdatePreview(_wsDeserialiseBoard(data.board));
    return;
  }

  // No tile selected
  if (_wsState.selected === null) {
    window.UI.toast('Tap a tile from your rack first.', 'info', 1800);
    return;
  }

  // Cell already has a permanent tile
  if (_wsCachedBoard && _wsCachedBoard[row] && _wsCachedBoard[row][col]) {
    window.UI.toast('That square is already occupied.', 'warning', 1800);
    return;
  }

  // Another placed tile here
  if (_wsState.placed.some(p => p.row === row && p.col === col)) {
    window.UI.toast('You already placed a tile there.', 'warning', 1800);
    return;
  }

  // Handle blank tile
  const myRack = _wsCachedMyRack;
  const tile   = myRack && myRack[_wsState.selected];
  if (!tile) return;

  if (tile.letter === '?') {
    // Prompt for letter choice
    _wsChooseBlankLetter(row, col, _wsState.selected);
    return;
  }

  _wsState.placed.push({
    row, col,
    letter:   tile.letter,
    points:   tile.points,
    blank:    false,
    rackIdx:  _wsState.selected,
  });
  _wsState.selected = null;
  _wsRefreshBoard();
  _wsRefreshRack();
  if (_wsCachedBoard) _wsUpdatePreview(_wsCachedBoard);
}

function _wsChooseBlankLetter(row, col, rackIdx) {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  _showModal(`
    <div style="text-align:center;margin-bottom:1rem;">
      <h2 style="font-size:1rem;font-weight:700;">Choose a letter for the blank tile</h2>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:.375rem;justify-content:center;margin-bottom:1rem;">
      ${alpha.map(l => `
        <button onclick="Game._wsPlaceBlank(${row},${col},${rackIdx},'${l}')"
                class="game-option-btn"
                style="width:2.25rem;height:2.25rem;padding:0;justify-content:center;font-size:.9375rem;font-weight:800;">
          ${l}
        </button>`).join('')}
    </div>
    <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full">Cancel</button>
  `);
}

function _wsPlaceBlank(row, col, rackIdx, letter) {
  _closeModal();
  _wsState.placed.push({ row, col, letter, points: 0, blank: true, rackIdx });
  _wsState.selected = null;
  _wsRefreshBoard();
  _wsRefreshRack();
  if (_wsCachedBoard) _wsUpdatePreview(_wsCachedBoard);
}

// Cached references for lightweight re-renders
let _wsCachedData    = null;
let _wsCachedBoard   = null;
let _wsCachedMyRack  = null;

// Intercept onSnapshot to cache data
const _wsOrigRender = _wsRenderGame;

// Lightweight rack refresh (no full re-render)
function _wsRefreshRack() {
  const rack    = document.getElementById('wsRack');
  if (!rack || !_wsCachedMyRack) return;
  const myRack  = _wsCachedMyRack;
  rack.innerHTML = myRack.map((tile, idx) => {
    const isSelected = _wsState.selected === idx;
    const isPlaced   = _wsState.placed.some(p => p.rackIdx === idx);
    return `
      <button onclick="Game._wsRackClick(${idx})"
              ${isPlaced ? 'disabled' : ''}
              style="width:clamp(32px,9vw,44px);height:clamp(38px,10vw,50px);
                     border-radius:6px;font-weight:800;
                     font-size:clamp(12px,3vw,18px);
                     border:2px solid ${isSelected ? '#7c3aed' : '#a0845c'};
                     background:${isPlaced ? '#e5e7eb' : isSelected ? '#ede9fe' : '#f5deb3'};
                     color:${isPlaced ? '#9ca3af' : isSelected ? '#7c3aed' : '#1a0a00'};
                     cursor:${isPlaced ? 'not-allowed' : 'pointer'};
                     position:relative;box-shadow:${isSelected ? '0 0 0 3px #c4b5fd' : '0 2px 4px rgba(0,0,0,.15)'};
                     transition:all .12s;font-family:var(--font);
                     display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:0;">
        ${_esc(tile.letter === '?' ? '★' : tile.letter)}
        <span style="font-size:clamp(6px,1.5vw,9px);font-weight:600;color:${isPlaced?'#9ca3af':isSelected?'#7c3aed':'#5a3000'};">
          ${tile.letter === '?' ? '0' : tile.points}
        </span>
      </button>`;
  }).join('');
}

function _wsRefreshBoard() {
  // Only repaint the cells that changed (placed tiles)
  if (!_wsCachedBoard) return;
  const board = _wsCachedBoard;
  const premColour = { TW:'#ef4444', DW:'#f9a8d4', TL:'#3b82f6', DL:'#93c5fd', ST:'#fbbf24' };
  const premLabel  = { TW:'TW', DW:'DW', TL:'TL', DL:'DL', ST:'★' };
  const boardEl    = document.getElementById('wsBoard');
  if (!boardEl) return;

  const cells = boardEl.children;
  for (let r = 0; r < WS_BOARD_SIZE; r++) {
    for (let c = 0; c < WS_BOARD_SIZE; c++) {
      const cellEl = cells[r * WS_BOARD_SIZE + c];
      if (!cellEl) continue;
      const existing = board[r][c];
      if (existing) continue; // permanent tiles never change visually

      const placed  = _wsState.placed.find(p => p.row === r && p.col === c);
      const prem    = _wsPremium(r, c);
      const inner   = cellEl.querySelector('div');
      if (!inner) continue;

      if (placed) {
        cellEl.style.background = '#fde68a';
        cellEl.style.border     = '2px solid #f59e0b';
        inner.innerHTML = `
          <span style="font-size:clamp(7px,1.8vw,12px);font-weight:800;color:#78350f;line-height:1;">${_esc(placed.letter)}</span>
          <span style="font-size:clamp(4px,1vw,7px);color:#92400e;font-weight:600;position:absolute;bottom:1px;right:2px;">${placed.blank ? '' : placed.points}</span>`;
      } else {
        cellEl.style.background = premColour[prem] || 'transparent';
        cellEl.style.border     = '1px solid rgba(0,0,0,0.12)';
        inner.innerHTML = prem
          ? `<span style="font-size:clamp(4px,1vw,7px);font-weight:700;color:${prem==='TW'||prem==='TL'?'#fff':'#1e3a8a'};opacity:.9;">${premLabel[prem]||''}</span>`
          : '';
      }
    }
  }
}

function _wsUpdatePreview(board) {
  const el = document.getElementById('wsWordPreview');
  if (!el || _wsState.placed.length === 0) { if (el) el.textContent = ''; return; }
  const result = _wsValidateMove(board, _wsState.placed, _wsIsFirstMove(board));
  if (result.valid) {
    const wordList = result.words.map(w => w.word).join(', ');
    const bingo    = _wsState.placed.length === 7 ? ' ⚡ BINGO +50!' : '';
    el.innerHTML   = `<span style="color:var(--success);">✓ ${wordList}</span> <span style="color:var(--accent);font-weight:800;">+${result.totalScore} pts${bingo}</span>`;
  } else {
    el.innerHTML = `<span style="color:var(--danger);font-size:.8125rem;">${_esc(result.error)}</span>`;
  }
}

function _wsIsFirstMove(board) {
  return !board.some(row => row.some(cell => cell !== null));
}

// ── Game actions ─────────────────────────────────────────────

async function _wsConfirmPlay(gameId) {
  if (!_wsState || _wsState.placed.length === 0) {
    window.UI.toast('Place at least one tile on the board first.', 'warning');
    return;
  }

  if (!_wsCachedData) return;
  const data  = _wsCachedData;
  const board = _wsDeserialiseBoard(data.board);

  const result = _wsValidateMove(board, _wsState.placed, _wsIsFirstMove(board));
  if (!result.valid) {
    window.UI.toast(result.error, 'error', 4000);
    return;
  }

  const btn = document.getElementById('wsPlayBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  // Commit placed tiles to board
  _wsState.placed.forEach(({ row, col, letter, points, blank }) => {
    board[row][col] = { letter, points, blank: !!blank };
  });

  const uid     = _uid();
  const isP1    = data.player1Uid === uid;
  const myScore = (isP1 ? data.score1 : data.score2) + result.totalScore;

  // Refill rack from bag
  const bag      = (data.bag || []).map(t => ({ letter: t.l, points: t.p, id: `${t.l}_${Math.random()}` }));
  const usedIdxs = new Set(_wsState.placed.map(p => p.rackIdx));
  const myRackRaw = isP1 ? data.rack1 : data.rack2;
  let newRack     = myRackRaw
    .filter((_, i) => !usedIdxs.has(i))
    .map(t => ({ letter: t.l, points: t.p }));
  const drawn     = _wsDraw(bag, WS_RACK_SIZE - newRack.length);
  newRack         = [...newRack, ...drawn];

  // Check game-end: player emptied rack AND bag is also empty
  const opponentRack = isP1 ? data.rack2 : data.rack1;
  const gameOver     = newRack.length === 0 && bag.length === 0;

  let finalScore1 = isP1 ? myScore : data.score1;
  let finalScore2 = isP1 ? data.score2 : myScore;

  if (gameOver) {
    // Deduct opponent's unplayed tile values from their score, add to ours
    const oppUnplayed = opponentRack.reduce((s, t) => s + (t.p || 0), 0);
    if (isP1) { finalScore1 += oppUnplayed; }
    else       { finalScore2 += oppUnplayed; }
  }

  const wordStr = result.words.map(w => w.word).join('/');
  const newLog  = [...(data.moveLog || []).slice(-29), {
    name:  _student().name || '',
    type:  'play',
    word:  wordStr,
    score: result.totalScore,
  }];

  // Pass turn to the OTHER player
  const nextTurn = isP1 ? data.player2Uid : data.player1Uid;

  try {
    const update = {
      board:      _wsSerialiseBoard(board),
      bag:        bag.map(t => ({ l: t.letter, p: t.points })),
      passCount:  0,
      moveLog:    newLog,
      lastMoveAt: firebase.firestore.FieldValue.serverTimestamp(),
      status:     gameOver ? 'finished' : 'active',
    };

    // Only set turn if game is not over
    if (!gameOver) {
      update.turn = nextTurn;
    } else {
      update.turn = null;
    }

    if (isP1) {
      update.rack1  = newRack.map(t => ({ l: t.letter, p: t.points }));
      update.score1 = gameOver ? finalScore1 : myScore;
      if (gameOver) update.score2 = finalScore2;
    } else {
      update.rack2  = newRack.map(t => ({ l: t.letter, p: t.points }));
      update.score2 = gameOver ? finalScore2 : myScore;
      if (gameOver) update.score1 = finalScore1;
    }

    await _db().collection('scrabbleGames').doc(gameId).update(update);
    _wsState.placed   = [];
    _wsState.selected = null;

    if (gameOver) {
      const winner = finalScore1 > finalScore2
        ? data.player1Name
        : finalScore2 > finalScore1
          ? data.player2Name
          : null;
      window.UI.toast(winner ? `Game over! ${winner} wins! 🏆` : "Game over! It's a tie!", 'success', 6000);
      const win    = (isP1 && finalScore1 > finalScore2) || (!isP1 && finalScore2 > finalScore1);
      const xpGain = Math.min(200, Math.max(20, myScore));
      await _awardXP(xpGain, 'wordScrabble', { win });
    }
  } catch (e) {
    console.error('[scrabble] _wsConfirmPlay error:', e);
    window.UI.toast('Could not submit move. Please try again.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '✓ Play Word'; }
  }
}

function _wsRecall() {
  if (!_wsState) return;
  _wsState.placed   = [];
  _wsState.selected = null;
  _wsRefreshBoard();
  _wsRefreshRack();
  const el = document.getElementById('wsWordPreview');
  if (el) el.textContent = '';
}

async function _wsSwapTiles(gameId) {
  if (!_wsCachedMyRack || _wsCachedMyRack.length === 0) return;
  const myRack = _wsCachedMyRack;

  _showModal(`
    <div style="text-align:center;margin-bottom:1rem;">
      <h2 style="font-size:1rem;font-weight:700;">Swap Tiles</h2>
      <p style="font-size:.8125rem;color:var(--text-3);">Tap the tiles you want to swap, then confirm.</p>
    </div>
    <div id="swapRackPicker" style="display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap;margin-bottom:1.25rem;">
      ${myRack.map((tile, idx) => `
        <button id="swapTile${idx}" onclick="Game._wsToggleSwap(${idx})"
                style="width:44px;height:50px;border-radius:6px;font-weight:800;font-size:1.125rem;
                       border:2px solid #a0845c;background:#f5deb3;color:#1a0a00;cursor:pointer;
                       font-family:var(--font);display:inline-flex;flex-direction:column;
                       align-items:center;justify-content:center;transition:all .12s;">
          ${_esc(tile.letter === '?' ? '★' : tile.letter)}
          <span style="font-size:7px;color:#5a3000;">${tile.letter === '?' ? 0 : tile.points}</span>
        </button>`).join('')}
    </div>
    <button onclick="Game._wsConfirmSwap('${_esc(gameId)}')"
            class="btn w-full" style="background:#7c3aed;color:#fff;">Swap Selected</button>
    <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Cancel</button>
  `);
  _wsState._swapSelected = new Set();
}

function _wsToggleSwap(idx) {
  if (!_wsState) return;
  if (!_wsState._swapSelected) _wsState._swapSelected = new Set();
  const btn = document.getElementById(`swapTile${idx}`);
  if (_wsState._swapSelected.has(idx)) {
    _wsState._swapSelected.delete(idx);
    if (btn) { btn.style.background = '#f5deb3'; btn.style.borderColor = '#a0845c'; }
  } else {
    _wsState._swapSelected.add(idx);
    if (btn) { btn.style.background = '#ede9fe'; btn.style.borderColor = '#7c3aed'; }
  }
}

async function _wsConfirmSwap(gameId) {
  if (!_wsState || !_wsState._swapSelected || _wsState._swapSelected.size === 0) {
    window.UI.toast('Select at least one tile to swap.', 'warning');
    return;
  }
  if (!_wsCachedData) return;
  const data   = _wsCachedData;
  const uid    = _uid();
  const isP1   = data.player1Uid === uid;
  const myRack = _wsCachedMyRack;
  const bag    = (data.bag || []).map(t => ({ letter: t.l, points: t.p }));

  if (bag.length < 1) {
    window.UI.toast('Not enough tiles in the bag to swap.', 'warning');
    _closeModal();
    return;
  }

  const swapIdxs  = [..._wsState._swapSelected];
  const returning = swapIdxs.map(i => myRack[i]);
  const drawn     = _wsDraw(bag, returning.length);

  // Shuffle returning tiles back into random positions in the bag
  returning.forEach(t => {
    const pos = Math.floor(Math.random() * (bag.length + 1));
    bag.splice(pos, 0, t);
  });

  let newRack = myRack.filter((_, i) => !_wsState._swapSelected.has(i));
  newRack     = [...newRack, ...drawn];

  // Pass turn to the other player
  const nextTurn = isP1 ? data.player2Uid : data.player1Uid;
  const newLog   = [...(data.moveLog || []).slice(-29), {
    name: _student().name || '', type: 'swap',
  }];

  const update = {
    bag:        bag.map(t => ({ l: t.letter, p: t.points })),
    turn:       nextTurn,
    passCount:  (data.passCount || 0) + 1,
    moveLog:    newLog,
    lastMoveAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (isP1) update.rack1 = newRack.map(t => ({ l: t.letter, p: t.points }));
  else       update.rack2 = newRack.map(t => ({ l: t.letter, p: t.points }));

  try {
    await _db().collection('scrabbleGames').doc(gameId).update(update);
    _wsState._swapSelected = new Set();
    _closeModal();
    window.UI.toast("Tiles swapped. Opponent's turn.", 'info', 3000);
  } catch (e) {
    console.error('[scrabble] _wsConfirmSwap error:', e);
    window.UI.toast('Could not swap tiles.', 'error');
  }
}

async function _wsPass(gameId) {
  if (!_wsCachedData) return;
  const data     = _wsCachedData;
  const uid      = _uid();
  const isP1     = data.player1Uid === uid;
  const nextTurn = isP1 ? data.player2Uid : data.player1Uid;
  const newPass  = (data.passCount || 0) + 1;
  const gameOver = newPass >= 6;
  const newLog   = [...(data.moveLog || []).slice(-29), {
    name: _student().name || '', type: 'pass',
  }];

  try {
    await _db().collection('scrabbleGames').doc(gameId).update({
      turn:       gameOver ? null : nextTurn,
      passCount:  newPass,
      status:     gameOver ? 'finished' : 'active',
      moveLog:    newLog,
      lastMoveAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    if (gameOver) {
      window.UI.toast('Game ended after 6 consecutive passes.', 'info', 4000);
      await _awardXP(10, 'wordScrabble', { win: false });
    } else {
      window.UI.toast("Passed. Opponent's turn.", 'info', 2500);
    }
  } catch (e) {
    console.error('[scrabble] _wsPass error:', e);
    window.UI.toast('Could not pass.', 'error');
  }
}

function _wsLeave() {
  if (_wsListener) { _wsListener(); _wsListener = null; }
  _wsState      = null;
  _wsCachedData = null;
  // Return to the Scrabble games list, not the lobby root,
  // so both players can always re-enter their active game.
  _showScrabblePending();
}

  /* ══════════════════════════════════════════════════════════════
     STATE
  ══════════════════════════════════════════════════════════════ */

  let _gameState          = null;
  let _profile            = null;
  let _timerEl            = null;
  let _timerInt           = null;
  let _timerSecs          = 0;
  let _questionStartTime  = 0;
  let _speedDemonCount    = 0;

  let _challengeListener  = null;
  let _notifiedChallenges = new Set();

  /* ══════════════════════════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════════════════════════ */

  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _safeQ(str) {
    if (str == null) return '';
    const processed = (window.Exam && typeof window.Exam.preprocessLatex === 'function')
      ? window.Exam.preprocessLatex(str)
      : str;
    return _esc(processed);
  }

  function _renderKatex() {
    requestAnimationFrame(function () {
      if (window._katexAutoRenderReady && window.renderMathInElement) {
        try {
          renderMathInElement(document.getElementById('app') || document.body, {
            delimiters: [
              { left: '$$', right: '$$', display: true  },
              { left: '$',  right: '$',  display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '\\[', right: '\\]', display: true  },
            ],
            throwOnError: false,
            errorColor:   '#cc0000',
          });
        } catch (err) { console.warn('[game KaTeX]', err); }
      } else {
        setTimeout(_renderKatex, 150);
      }
    });
  }

  function _db()       { return window.fbDb; }
  function _uid()      { return window.AppState && window.AppState.userId; }
  function _student()  { return (window.AppState && window.AppState.studentData) || {}; }
  function _isOnline() { return navigator.onLine !== false; }

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

  function _isMaxLevel(xp)  { return xp >= LEVELS[LEVELS.length - 1].minXP; }

  
  /* ══════════════════════════════════════════════════════════════
   KNOWLEDGE SURFER PLAY LIMIT  (leisure cap)
   ─────────────────────────────────────────────────────────────
   Students may play Knowledge Surfer up to KR_MAX_PLAYS times
   within KR_COOLDOWN_MS. After that, a countdown is shown and
   the game is locked until the window resets.
══════════════════════════════════════════════════════════════ */

const KR_MAX_PLAYS    = 3;
const KR_COOLDOWN_MS  = 8 * 60 * 60 * 1000; // 8 hours in ms
const KR_STORAGE_KEY  = () => 'kr_plays_' + (_uid() || 'guest');

/** Return the array of timestamps (ms) of recent plays, pruned to the cooldown window. */
function _krGetRecentPlays() {
  try {
    const raw  = localStorage.getItem(KR_STORAGE_KEY());
    const list = raw ? JSON.parse(raw) : [];
    const now  = Date.now();
    // Keep only plays within the last KR_COOLDOWN_MS
    return list.filter(ts => now - ts < KR_COOLDOWN_MS);
  } catch (e) {
    return [];
  }
}

/** Record a new play session now. */
function _krRecordPlay() {
  try {
    const plays = _krGetRecentPlays();
    plays.push(Date.now());
    localStorage.setItem(KR_STORAGE_KEY(), JSON.stringify(plays));
  } catch (e) {
    console.warn('[game] _krRecordPlay: localStorage write failed:', e);
  }
}

/** Returns true if the student has hit the play limit. */
function _krIsLimitReached() {
  return _krGetRecentPlays().length >= KR_MAX_PLAYS;
}

/**
 * Returns a human-readable countdown string (H:MM:SS or MM:SS)
 * showing how long until the earliest play expires and frees a slot.
 * Returns '' if not currently limited.
 */
function _krCooldownLabel() {
  const plays = _krGetRecentPlays();
  if (plays.length < KR_MAX_PLAYS) return '';
  const oldest   = Math.min(...plays);
  const unlockAt = oldest + KR_COOLDOWN_MS;
  const msLeft   = Math.max(0, unlockAt - Date.now());
  if (msLeft <= 0) return '';
  const h   = Math.floor(msLeft / 3_600_000);
  const m   = Math.floor((msLeft % 3_600_000) / 60_000);
  const s   = Math.floor((msLeft % 60_000) / 1_000);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Start a 1-second interval that keeps a DOM element's text updated with
 *  the cooldown countdown. Clears itself when the element leaves the DOM
 *  or the limit is no longer active. Returns the interval ID. */
function _krStartCountdownTick(getEl) {
  const id = setInterval(() => {
    const el = typeof getEl === 'function' ? getEl() : getEl;
    if (!el || !document.body.contains(el)) { clearInterval(id); return; }
    const label = _krCooldownLabel();
    if (!label) { clearInterval(id); el.textContent = ''; return; }
    el.textContent = label;
  }, 1_000);
  return id;
}

  function _xpProgressPct(xp) {
    if (_isMaxLevel(xp)) return 100;
    const current = _getLevelForXP(xp);
    const next    = _getNextLevel(xp);
    if (!next) return 100;
    return Math.min(100, Math.round(((xp - current.minXP) / (next.minXP - current.minXP)) * 100));
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
     OFFLINE-FIRST PROFILE MANAGEMENT
  ══════════════════════════════════════════════════════════════ */

  const _PROFILE_CACHE_KEY = 'gameProfile';

  async function _saveProfileLocally(profileData) {
    if (!window.LocalDB) return;
    try {
      await LocalDB.put(LocalDB.STORES.APP_METADATA, {
        key:   _PROFILE_CACHE_KEY + '_' + _uid(),
        value: JSON.stringify(profileData),
      });
    } catch (e) { console.warn('[game] Local profile save failed:', e); }
  }

  async function _loadProfileFromCache() {
    if (!window.LocalDB) return null;
    try {
      const rec = await LocalDB.getMeta(_PROFILE_CACHE_KEY + '_' + _uid());
      return rec ? JSON.parse(rec) : null;
    } catch (e) { return null; }
  }

  async function _loadProfile() {
    const uid = _uid();
    if (!uid) return null;
    const cached = await _loadProfileFromCache();
    if (cached) _profile = cached;
    if (_isOnline()) {
      try {
        const snap = await _db().collection('gameProfiles').doc(uid).get();
        if (snap.exists) {
          _profile = snap.data();
        } else {
          _profile = _blankProfile(uid);
          await _db().collection('gameProfiles').doc(uid).set(_profile);
        }
        await _saveProfileLocally(_profile);
      } catch (e) {
        console.warn('[game] _loadProfile Firebase failed, using cache:', e);
        if (!_profile) _profile = _blankProfile(uid);
      }
    } else {
      if (!_profile) _profile = _blankProfile(uid);
    }
    return _profile;
  }

  function _blankProfile(uid) {
    return {
      uid,
      name:       _student().name   || '',
      class:      _student().class  || '',
      school:     _student().school || '',
      xp:         0,
      totalGames: 0,
      totalWins:  0,
      streak:     0,
      badges:     [],
      stats:      { quizBlitz: 0, speedMath: 0, wordScramble: 0, challenges: 0, trueOrFalse: 0, suddenDeath: 0 },
      createdAt:  new Date().toISOString(),
    };
  }

  async function _awardXP(xpAmount, gameType, extraData) {
  const uid    = _uid();
  const oldXP  = (_profile && _profile.xp) || 0;
  const newXP  = Math.max(0, oldXP + (xpAmount || 0));

  const newBadges  = [...((_profile && _profile.badges) || [])];
  const totalGames = ((_profile && _profile.totalGames) || 0) + 1;
  const isWin      = extraData && extraData.win;
  const totalWins  = ((_profile && _profile.totalWins) || 0) + (isWin ? 1 : 0);
  const newStreak  = isWin ? ((_profile && _profile.streak) || 0) + 1 : 0;

  const earnedBadges = [];
  const _has = (id) => newBadges.includes(id);
  const _earn = (id) => { if (!_has(id)) { newBadges.push(id); earnedBadges.push(id); } };

  const hour = new Date().getHours();
  const day  = new Date().getDay();

  _earn('first_game');
  if (totalGames >= 5)   _earn('games_5');
  if (totalGames >= 10)  _earn('games_10');
  if (totalGames >= 25)  _earn('games_25');
  if (totalGames >= 50)  _earn('games_50');
  if (totalGames >= 100) _earn('games_100');
  if (totalGames >= 250) _earn('games_250');

  if (isWin && totalWins >= 5)  _earn('wins_5');
  if (isWin && totalWins >= 25) _earn('wins_25');
  if (isWin && totalWins >= 50) _earn('wins_50');

  if (newStreak >= 5)  _earn('streak_5');
  if (newStreak >= 10) _earn('streak_10');
  if (newStreak >= 20) _earn('streak_20');

  if (newXP >= 100)    _earn('xp_100');
  if (newXP >= 500)    _earn('xp_500');
  if (newXP >= 1000)   _earn('xp_1000');
  if (newXP >= 2500)   _earn('xp_2500');
  if (newXP >= 5000)   _earn('xp_5000');
  if (newXP >= 10000)  _earn('xp_10000');
  if (newXP >= 25000)  _earn('xp_25000');
  if (newXP >= 50000)  _earn('xp_50000');
  if (newXP >= 100000) _earn('xp_100000');

  if (extraData && extraData.perfect)           _earn('perfect_quiz');
  if (extraData && extraData.challengeWin)      _earn('challenge_win');
  if (extraData && extraData.challengeWin && ((_profile && _profile.challengeWins) || 0) + 1 >= 5)  _earn('challenge_5');
  if (extraData && extraData.challengeWin && ((_profile && _profile.challengeWins) || 0) + 1 >= 10) _earn('challenge_10');
  if (extraData && extraData.sentChallenge)     _earn('first_challenge');

  if (extraData && extraData.speedDemonCount >= 10) _earn('speed_demon');
  if (extraData && extraData.speedDemonCount >= 30) _earn('speed_demon_pro');

  if (gameType === 'speedMath' && extraData && extraData.difficulty === 'hard')                                  _earn('math_master');
  if (gameType === 'speedMath' && extraData && extraData.difficulty === 'hard' && extraData.perfect)            _earn('math_perfect');
  if (gameType === 'wordScramble' && extraData && extraData.wordCorrect >= 10)                                   _earn('word_wizard');
  if (gameType === 'wordScramble' && extraData && extraData.perfect)                                             _earn('perfect_scramble');
  if (gameType === 'quizBlitz'   && extraData && extraData.perfect)                                              _earn('perfect_blitz');
  if (gameType === 'trueOrFalse' && extraData && extraData.perfect)                                              _earn('perfect_tf');

  if (extraData && extraData.tfBestStreak >= 5)  _earn('tf_streak_5');
  if (extraData && extraData.tfBestStreak >= 10) _earn('tf_streak_10');
  if (extraData && extraData.tfBestStreak >= 20) _earn('tf_streak_20');

  if (extraData && extraData.sdSurvived >= 5)  _earn('sudden_death_5');
  if (extraData && extraData.sdSurvived >= 10) _earn('sudden_death_10');
  if (extraData && extraData.sdSurvived >= 15) _earn('sudden_death_15');
  if (extraData && extraData.sdSurvived >= 25) _earn('sudden_death_25');
  if (extraData && extraData.sdSurvived >= 30) _earn('sudden_death_30');
  if (extraData && extraData.sdSurvived >= 50) _earn('sudden_death_50');

  if (gameType === 'wordScramble') {
    const cumWords = ((_profile && _profile.cumWordCorrect) || 0) + (extraData && extraData.wordCorrect || 0);
    if (cumWords >= 50) _earn('word_master');
    if (_profile) _profile.cumWordCorrect = cumWords;
  }

  if (hour < 7)  _earn('early_bird');
  if (hour >= 22) _earn('night_owl');
  if (day === 0 || day === 6) {
    const weekendGames = ((_profile && _profile.weekendGames) || 0) + 1;
    if (_profile) _profile.weekendGames = weekendGames;
    if (weekendGames >= 5) _earn('weekend_warrior');
  }

  const levelData = _getLevelForXP(newXP);
  if (levelData.rank >= 5)  _earn('rank_5');
  if (levelData.rank >= 10) _earn('rank_10');
  if (levelData.rank >= 15) _earn('rank_15');
  if (_isMaxLevel(newXP))   _earn('max_level');

  if (_profile) {
    _profile.xp         = newXP;
    _profile.totalGames = totalGames;
    _profile.totalWins  = totalWins;
    _profile.streak     = newStreak;
    _profile.badges     = newBadges;
    if (!_profile.stats) _profile.stats = {};
    _profile.stats[gameType] = (_profile.stats[gameType] || 0) + 1;
  }
  await _saveProfileLocally(_profile);

  if (_isOnline()) {
    try {
      const updateData = {
        xp:         firebase.firestore.FieldValue.increment(xpAmount || 0),
        totalGames: firebase.firestore.FieldValue.increment(1),
        totalWins:  firebase.firestore.FieldValue.increment(isWin ? 1 : 0),
        streak:     newStreak,
        badges:     newBadges,
        name:       _student().name   || '',
        class:      _student().class  || '',
        school:     _student().school || '',
        [`stats.${gameType}`]: firebase.firestore.FieldValue.increment(1),
      };
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
    } catch (e) {
      console.warn('[game] _awardXP Firebase failed (local saved):', e);
    }
  }

  return { xpAwarded: xpAmount || 0, earnedBadges, newXP, newLevel: levelData };
}

  /* ══════════════════════════════════════════════════════════════
     CHALLENGE NOTIFICATION LISTENER
  ══════════════════════════════════════════════════════════════ */

  function _startChallengeListener() {
  const uid = _uid();
  if (!uid || _challengeListener) return;

  if (!document.getElementById('_gameChallengePopupStyles')) {
    const style = document.createElement('style');
    style.id = '_gameChallengePopupStyles';
    style.textContent = `
      @keyframes gameChallengePopIn {
        from { opacity:0; transform:translateX(110%) scale(.9); }
        to   { opacity:1; transform:translateX(0) scale(1); }
      }
      @keyframes gameChallengePopOut {
        from { opacity:1; transform:translateX(0) scale(1); max-height:300px; }
        to   { opacity:0; transform:translateX(110%) scale(.9); max-height:0; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Existing quiz challenge listener ──
  _db()
    .collection('gameChallenges')
    .where('challengedUid', '==', uid)
    .where('status', '==', 'pending')
    .get()
    .then(function(existingSnap) {
      existingSnap.forEach(function(doc) { _notifiedChallenges.add(doc.id); });
      _challengeListener = _db()
        .collection('gameChallenges')
        .where('challengedUid', '==', uid)
        .where('status', '==', 'pending')
        .onSnapshot(function(snap) {
          snap.docChanges().forEach(function(change) {
            if (change.type !== 'added' && change.type !== 'modified') return;
            const doc  = change.doc;
            const data = doc.data();
            if (_notifiedChallenges.has(doc.id)) return;
            _notifiedChallenges.add(doc.id);
            _showChallengePopup(doc.id, data);
          });
        }, function(err) { console.warn('[game] challenge listener error:', err); });
    })
    .catch(function(err) {
      console.warn('[game] challenge baseline fetch error:', err);
      _challengeListener = _db()
        .collection('gameChallenges')
        .where('challengedUid', '==', uid)
        .where('status', '==', 'pending')
        .onSnapshot(function(snap) {
          snap.docChanges().forEach(function(change) {
            if (change.type !== 'added' && change.type !== 'modified') return;
            const doc  = change.doc;
            const data = doc.data();
            if (_notifiedChallenges.has(doc.id)) return;
            _notifiedChallenges.add(doc.id);
            _showChallengePopup(doc.id, data);
          });
        }, function(err) { console.warn('[game] challenge listener error:', err); });
    });

  // ── NEW: Scrabble challenge listener ──
  _db()
    .collection('scrabbleGames')
    .where('player2Uid', '==', uid)
    .where('status', '==', 'pending')
    .get()
    .then(function(existingSnap) {
      existingSnap.forEach(function(doc) { _notifiedChallenges.add('scrabble_' + doc.id); });
      _db()
        .collection('scrabbleGames')
        .where('player2Uid', '==', uid)
        .where('status', '==', 'pending')
        .onSnapshot(function(snap) {
          snap.docChanges().forEach(function(change) {
            if (change.type !== 'added' && change.type !== 'modified') return;
            const doc  = change.doc;
            const data = doc.data();
            const key  = 'scrabble_' + doc.id;
            if (_notifiedChallenges.has(key)) return;
            _notifiedChallenges.add(key);
            _showScrabbleChallengePopup(doc.id, data);
          });
        }, function(err) { console.warn('[game] scrabble listener error:', err); });
    })
    .catch(function(err) {
      console.warn('[game] scrabble baseline fetch error:', err);
    });
}

  function _stopChallengeListener() {
    if (_challengeListener) { _challengeListener(); _challengeListener = null; }
  }

  function _showChallengePopup(challengeId, data) {
    if (window.AppState && window.AppState.exam && window.AppState.exam.step === 'exam') return;
    const existing = document.getElementById('gameChallengePopup_' + challengeId);
    if (existing) return;

    const subject = data.subject === 'random' ? 'Mixed Subjects' : _esc(data.subject || 'Unknown');
    const from    = _esc(data.challengerName || 'A classmate');

    const popup = document.createElement('div');
    popup.id    = 'gameChallengePopup_' + challengeId;
    popup.style.cssText = [
      'position:fixed', 'bottom:5rem', 'right:1.25rem',
      'z-index:9500', 'max-width:320px', 'width:calc(100vw - 2.5rem)',
      'background:var(--bg-base)', 'border:2px solid var(--danger)',
      'border-radius:14px', 'padding:1rem 1.125rem',
      'box-shadow:0 8px 32px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.1)',
      'animation:gameChallengePopIn .35s cubic-bezier(.34,1.45,.64,1) both',
      'pointer-events:auto',
    ].join(';');

    popup.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:.625rem;">
        <div style="width:38px;height:38px;border-radius:50%;background:var(--danger-subtle);
                    border:2px solid var(--danger-border);display:flex;align-items:center;
                    justify-content:center;flex-shrink:0;">
          ${_icon('swords', 18, { color: 'var(--danger)' })}
        </div>
        <div style="flex:1;min-width:0;">
          <p style="font-size:.8125rem;font-weight:800;color:var(--text-1);margin:0 0 2px;">
            Challenge Received!
          </p>
          <p style="font-size:.75rem;color:var(--text-2);margin:0 0 3px;line-height:1.4;">
            <strong>${from}</strong> challenged you to a quiz!
          </p>
          <p style="font-size:.6875rem;color:var(--text-3);margin:0;">
            Subject: ${subject} &middot; Open until accepted or declined
          </p>
        </div>
        <button id="gameChallengePopupDismiss_${challengeId}"
                style="background:none;border:none;cursor:pointer;color:var(--text-4);font-size:1rem;
                       line-height:1;padding:2px;flex-shrink:0;"
                aria-label="Dismiss">&#x2715;</button>
      </div>
      <div style="display:flex;gap:.5rem;margin-top:.875rem;">
        <button id="gameChallengeAcceptBtn_${challengeId}"
                style="flex:1;padding:.5rem;border-radius:8px;font-size:.8125rem;font-weight:700;
                       background:var(--danger);color:#fff;border:none;cursor:pointer;font-family:var(--font);">
          Accept &amp; Play
        </button>
        <button id="gameChallengeDeclineBtn_${challengeId}"
                style="flex:1;padding:.5rem;border-radius:8px;font-size:.8125rem;font-weight:600;
                       background:var(--bg-subtle);color:var(--text-2);border:1px solid var(--border);
                       cursor:pointer;font-family:var(--font);">
          Decline
        </button>
      </div>`;

    document.body.appendChild(popup);
    const autoTimer = setTimeout(() => _dismissChallengePopup(challengeId), 30_000);

    function _dismiss() { clearTimeout(autoTimer); _dismissChallengePopup(challengeId); }

    document.getElementById('gameChallengePopupDismiss_' + challengeId).addEventListener('click', _dismiss);
    document.getElementById('gameChallengeAcceptBtn_' + challengeId).addEventListener('click', async () => {
      _dismiss();
      await _loadProfile();
      await _acceptChallenge(challengeId);
    });
    document.getElementById('gameChallengeDeclineBtn_' + challengeId).addEventListener('click', async () => {
      _dismiss();
      try {
        await _db().collection('gameChallenges').doc(challengeId).update({ status: 'declined' });
        window.UI && window.UI.toast('Challenge declined.', 'info', 3000);
      } catch (e) { console.warn('[game] decline challenge error:', e); }
    });
  }

  function _dismissChallengePopup(challengeId) {
    const popup = document.getElementById('gameChallengePopup_' + challengeId);
    if (!popup) return;
    popup.style.animation = 'gameChallengePopOut .25s ease-in both';
    popup.addEventListener('animationend', () => popup.remove(), { once: true });
  }

function _showScrabbleChallengePopup(gameId, data) {
  if (window.AppState && window.AppState.exam && window.AppState.exam.step === 'exam') return;
  const existing = document.getElementById('scrabbleChallengePopup_' + gameId);
  if (existing) return;

  const from = _esc(data.player1Name || 'A classmate');

  const popup = document.createElement('div');
  popup.id    = 'scrabbleChallengePopup_' + gameId;
  popup.style.cssText = [
    'position:fixed', 'bottom:5rem', 'right:1.25rem',
    'z-index:9500', 'max-width:320px', 'width:calc(100vw - 2.5rem)',
    'background:var(--bg-base)', 'border:2px solid #7c3aed',
    'border-radius:14px', 'padding:1rem 1.125rem',
    'box-shadow:0 8px 32px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.1)',
    'animation:gameChallengePopIn .35s cubic-bezier(.34,1.45,.64,1) both',
    'pointer-events:auto',
  ].join(';');

  popup.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:.625rem;">
      <div style="width:38px;height:38px;border-radius:50%;background:#ede9fe;
                  border:2px solid #c4b5fd;display:flex;align-items:center;
                  justify-content:center;flex-shrink:0;font-size:1.25rem;">
        🔤
      </div>
      <div style="flex:1;min-width:0;">
        <p style="font-size:.8125rem;font-weight:800;color:var(--text-1);margin:0 0 2px;">
          Scrabble Challenge!
        </p>
        <p style="font-size:.75rem;color:var(--text-2);margin:0 0 3px;line-height:1.4;">
          <strong>${from}</strong> challenged you to Word Scrabble!
        </p>
        <p style="font-size:.6875rem;color:var(--text-3);margin:0;">
          Classic board game — place words, score points
        </p>
      </div>
      <button id="scrabblePopupDismiss_${gameId}"
              style="background:none;border:none;cursor:pointer;color:var(--text-4);font-size:1rem;
                     line-height:1;padding:2px;flex-shrink:0;"
              aria-label="Dismiss">&#x2715;</button>
    </div>
    <div style="display:flex;gap:.5rem;margin-top:.875rem;">
      <button id="scrabblePopupAccept_${gameId}"
              style="flex:1;padding:.5rem;border-radius:8px;font-size:.8125rem;font-weight:700;
                     background:#7c3aed;color:#fff;border:none;cursor:pointer;font-family:var(--font);">
        Accept &amp; Play
      </button>
      <button id="scrabblePopupDecline_${gameId}"
              style="flex:1;padding:.5rem;border-radius:8px;font-size:.8125rem;font-weight:600;
                     background:var(--bg-subtle);color:var(--text-2);border:1px solid var(--border);
                     cursor:pointer;font-family:var(--font);">
        Decline
      </button>
    </div>`;

  document.body.appendChild(popup);
  const autoTimer = setTimeout(() => _dismissScrabblePopup(gameId), 30_000);

  function _dismiss() { clearTimeout(autoTimer); _dismissScrabblePopup(gameId); }

  document.getElementById('scrabblePopupDismiss_' + gameId).addEventListener('click', _dismiss);

  document.getElementById('scrabblePopupAccept_' + gameId).addEventListener('click', async () => {
    _dismiss();
    await _acceptScrabble(gameId);
  });

  document.getElementById('scrabblePopupDecline_' + gameId).addEventListener('click', async () => {
    _dismiss();
    try {
      await _db().collection('scrabbleGames').doc(gameId).update({ status: 'declined' });
      window.UI && window.UI.toast('Scrabble challenge declined.', 'info', 3000);
    } catch (e) {
      console.warn('[scrabble] decline error:', e);
    }
  });
}

function _dismissScrabblePopup(gameId) {
  const popup = document.getElementById('scrabbleChallengePopup_' + gameId);
  if (!popup) return;
  popup.style.animation = 'gameChallengePopOut .25s ease-in both';
  popup.addEventListener('animationend', () => popup.remove(), { once: true });
}

  /* ══════════════════════════════════════════════════════════════
     LOBBY
  ══════════════════════════════════════════════════════════════ */

  async function openGameLobby() {
    try {
    _injectStyles();
    const uid = _uid();
    if (!uid) { window.UI.toast('Please sign in to play games.', 'error'); return; }

    await _loadProfile();
    _startChallengeListener();

    const level     = _getLevelForXP(_profile.xp || 0);
    const nextLevel = _getNextLevel(_profile.xp || 0);
    const xpPct     = _xpProgressPct(_profile.xp || 0);
    const maxed     = _isMaxLevel(_profile.xp || 0);

    let pendingChallenges = [];
    let awaitingPlay      = [];
    let pendingScrabble   = [];
    let activeScrabble    = [];

    if (_isOnline()) {
      try {
        const [challengeSnap, sentSnap, scrabblePendingSnap, scrabbleActive1Snap, scrabbleActive2Snap] = await Promise.all([
          _db().collection('gameChallenges')
               .where('challengedUid', '==', uid)
               .where('status', '==', 'pending').get(),
          _db().collection('gameChallenges')
               .where('challengerUid', '==', uid)
               .where('status', '==', 'awaiting_challenger').get(),
          _db().collection('scrabbleGames')
               .where('player2Uid', '==', uid)
               .where('status', '==', 'pending').get(),
          _db().collection('scrabbleGames')
               .where('player1Uid', '==', uid)
               .where('status', '==', 'active').get(),
          _db().collection('scrabbleGames')
               .where('player2Uid', '==', uid)
               .where('status', '==', 'active').get(),
        ]);

        if (!challengeSnap.empty)
          challengeSnap.docs.forEach(doc => pendingChallenges.push({ id: doc.id, ...doc.data() }));
        if (!sentSnap.empty)
          sentSnap.docs.forEach(doc => awaitingPlay.push({ id: doc.id, ...doc.data() }));
        if (!scrabblePendingSnap.empty)
          scrabblePendingSnap.docs.forEach(doc => pendingScrabble.push({ id: doc.id, ...doc.data() }));

        // Merge active scrabble games (deduplicate)
        const seen = new Set();
        [...scrabbleActive1Snap.docs, ...scrabbleActive2Snap.docs].forEach(doc => {
          if (seen.has(doc.id)) return;
          seen.add(doc.id);
          activeScrabble.push({ id: doc.id, ...doc.data() });
        });

      } catch (e) { console.warn('[game] lobby fetch error:', e); }
    }

    const offlineBanner = !_isOnline()
      ? `<div style="display:flex;align-items:center;gap:.5rem;margin:.5rem 0;
                     padding:.625rem 1rem;border-radius:8px;
                     background:var(--warning-subtle);border:1px solid var(--warning-border);">
           ${_icon('warning', 14, { color: 'var(--warning)' })}
           <span style="font-size:.8125rem;color:var(--warning-text);font-weight:600;">
             Offline mode — scores will sync when you reconnect.
           </span>
         </div>`
      : '';

    const challengeNotif = pendingChallenges.length > 0 ? `
  <div class="game-challenge-alert" onclick="Game._showPendingChallenges()">
    <span class="game-challenge-alert__icon">${_icon('swords', 20)}</span>
    <span>${pendingChallenges.length} pending challenge${pendingChallenges.length > 1 ? 's' : ''} — tap to view.</span>
    <span class="game-challenge-alert__arrow">${_icon('arrowRight', 16)}</span>
  </div>` : '';

    const scrabbleNotif = pendingScrabble.length > 0 ? `
  <div class="game-challenge-alert" onclick="Game._showScrabblePending()"
       style="border-color:#7c3aed;background:linear-gradient(135deg,#ede9fe,#ddd6fe);">
    <span class="game-challenge-alert__icon">🔤</span>
    <span style="color:#5b21b6;">${pendingScrabble.length} pending Scrabble challenge${pendingScrabble.length > 1 ? 's' : ''} — tap to view.</span>
    <span class="game-challenge-alert__arrow">${_icon('arrowRight', 16)}</span>
  </div>` : '';

    // Active scrabble games notification
    const myTurnScrabble  = activeScrabble.filter(g => g.turn === uid);
    const theirTurnScrabble = activeScrabble.filter(g => g.turn !== uid);

    const activeScrabbleNotif = activeScrabble.length > 0 ? `
  <div class="game-challenge-alert" onclick="Game._showScrabblePending()"
       style="border-color:${myTurnScrabble.length > 0 ? '#7c3aed' : '#6b7280'};
              background:${myTurnScrabble.length > 0
                ? 'linear-gradient(135deg,#ede9fe,#ddd6fe)'
                : 'linear-gradient(135deg,#f3f4f6,#e5e7eb)'
              };">
    <span class="game-challenge-alert__icon">🔤</span>
    <span style="color:${myTurnScrabble.length > 0 ? '#5b21b6' : '#374151'};">
      ${myTurnScrabble.length > 0
        ? `⚡ ${myTurnScrabble.length} Scrabble game${myTurnScrabble.length > 1 ? 's' : ''} waiting for YOUR move!`
        : `${theirTurnScrabble.length} Scrabble game${theirTurnScrabble.length > 1 ? 's' : ''} — waiting for opponent.`
      }
    </span>
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
          return b ? `<button onclick="Game._showBadgeDetails('${_esc(bid)}')" 
                               style="background:var(--accent-subtle);border:1px solid var(--accent-border);
                                       color:var(--accent-text);border-radius:99px;padding:2px 9px;
                                       font-size:.6875rem;font-weight:600;transition:all .15s;
                                       font-family:var(--font);display:inline-flex;align-items:center;gap:.3125rem;
                                       cursor:pointer;padding:4px 12px;margin-bottom:.375rem;"
                               title="Click to view badge details"
                               onmouseover="this.style.transform='scale(1.08)';this.style.boxShadow='0 4px 12px rgba(79,110,247,0.25)'"
                               onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'">
                       ${_icon(b.icon, 13)} ${_esc(b.name)}
                     </button>` : '';
        }).join('')
      : `<span style="font-size:.8125rem;color:var(--text-4);font-style:italic;">No badges yet — play games to earn them.</span>`;

    const currentRank    = level.rank;
    const levelStripHtml = _renderLevelStrip(currentRank, _profile.xp || 0);

    const _krLimited   = _krIsLimitReached();
    const _krPlaysUsed = _krGetRecentPlays().length;
    const _krPlaysLeft = Math.max(0, KR_MAX_PLAYS - _krPlaysUsed);
    const _krCountdown = _krCooldownLabel();
    const _krCardId    = 'krLobbyCountdown';

    const knowledgeSurferCard = `
      <div class="game-card game-card--runner${_krLimited ? ' game-card--locked' : ''}"
           onclick="Game._selectGame('knowledgeRunner')"
           style="${_krLimited ? 'opacity:.7;cursor:pointer;' : ''}">
        <div class="game-card__icon">
          ${_krLimited ? '🔒' : _icon('bolt', 32, { color: '#06b6d4' })}
        </div>
        <div class="game-card__title">
          Knowledge Surfer
          ${_krLimited
            ? `<span style="font-size:.625rem;background:#ef4444;color:#fff;
                           border-radius:4px;padding:1px 6px;font-weight:700;
                           margin-left:.375rem;vertical-align:middle;">COOLDOWN</span>`
            : ''}
        </div>
        <div class="game-card__desc">
          ${_krLimited
            ? `On a break! Back in&nbsp;<strong id="${_krCardId}" style="color:#ef4444;font-family:var(--font-mono);">${_krCountdown}</strong>.
               Try Quiz Blitz or Word Scramble in the meantime.`
            : 'Subway Surfers-style! Swipe across 3 lanes. Collect correct answer coins. Dodge wrong-answer trains &amp; barriers. Inspector chases you!'}
        </div>
        <div class="game-card__meta">
          <span class="game-card__tag">Action</span>
          <span class="game-card__tag">Endless Runner</span>
          ${_krLimited
            ? `<span class="game-card__tag" style="background:rgba(239,68,68,0.1);color:#ef4444;border-color:rgba(239,68,68,0.3);">
                 ${_krPlaysUsed}/${KR_MAX_PLAYS} plays used
               </span>`
            : `<span class="game-card__tag game-card__tag--xp">
                 ${_krPlaysLeft} play${_krPlaysLeft !== 1 ? 's' : ''} left
               </span>`}
        </div>
      </div>`;

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
              <span style="font-size:.6875rem;background:var(--bg-muted);color:var(--text-3);
                           border-radius:4px;padding:1px 5px;margin-left:2px;">Rank ${currentRank}</span>
            </span>
            ${!maxed
              ? `<span style="font-size:.75rem;color:var(--text-3);">${(_profile.xp || 0).toLocaleString()} / ${nextLevel.minXP.toLocaleString()} XP &rarr; ${_esc(nextLevel.name)}</span>`
              : `<span style="font-size:.75rem;font-weight:800;color:#f43f5e;">✦ Absolute — MAX LEVEL</span>`}
          </div>
          <div class="game-xp-track">
            <div class="game-xp-fill" style="width:${xpPct}%;"></div>
          </div>
          ${maxed ? `<p style="font-size:.6875rem;color:var(--text-3);margin-top:.375rem;text-align:center;">
            You have reached the highest rank. Your legacy is permanent.</p>` : ''}
        </div>

        ${levelStripHtml}
        ${offlineBanner}
        ${challengeNotif}
        ${awaitingNotif}
        ${scrabbleNotif}
        ${activeScrabbleNotif}

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
            <div class="game-card__desc">Answer MCQ questions against the clock. Fast answers earn bonus XP.</div>
            <div class="game-card__meta">
              <span class="game-card__tag">MCQ</span>
              <span class="game-card__tag">15s / question</span>
              <span class="game-card__tag game-card__tag--xp">+${XP_PER_CORRECT * QUIZ_BLITZ_QUESTIONS} XP max</span>
            </div>
          </div>
          <div class="game-card" onclick="Game._selectGame('trueOrFalse')">
            <div class="game-card__icon">${_icon('checkSquare', 32, { color: '#10b981' })}</div>
            <div class="game-card__title">True or False Blitz</div>
            <div class="game-card__desc">Rapid-fire T/F statements from your subjects. Build streaks for bonus XP.</div>
            <div class="game-card__meta">
              <span class="game-card__tag">T/F</span>
              <span class="game-card__tag">10s / question</span>
              <span class="game-card__tag game-card__tag--xp">+streak multiplier</span>
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
            <div class="game-card__desc">Unscramble subject vocabulary words before time runs out.</div>
            <div class="game-card__meta">
              <span class="game-card__tag">Vocabulary</span>
              <span class="game-card__tag">20s / word</span>
              <span class="game-card__tag game-card__tag--xp">+${XP_PER_CORRECT} XP per word</span>
            </div>
          </div>
          <div class="game-card game-card--sudden-death" onclick="Game._selectGame('suddenDeath')">
            <div class="game-card__icon">${_icon('skull', 32, { color: '#e11d48' })}</div>
            <div class="game-card__title">Perfect Run</div>
            <div class="game-card__desc">One wrong answer and it's over. Survive as long as possible for compounding XP.</div>
            <div class="game-card__meta">
              <span class="game-card__tag">High Risk</span>
              <span class="game-card__tag">12s / question</span>
              <span class="game-card__tag game-card__tag--xp">XP compounds</span>
            </div>
          </div>
          <div class="game-card game-card--challenge" onclick="Game._selectGame('challenge')">
            <div class="game-card__icon">${_icon('swords', 32, { color: 'var(--danger)' })}</div>
            <div class="game-card__title">Challenge a Classmate</div>
            <div class="game-card__desc">Send a quiz challenge to someone in your class. Beat their score to win.</div>
            <div class="game-card__meta">
              <span class="game-card__tag">PvP</span>
              <span class="game-card__tag">1v1</span>
              <span class="game-card__tag game-card__tag--xp">+${XP_CHALLENGE_WIN} bonus XP</span>
            </div>
          </div>
          <div class="game-card game-card--scrabble" onclick="Game._selectGame('wordScrabble')">
            <div class="game-card__icon">🔤</div>
            <div class="game-card__title">Word Scrabble</div>
            <div class="game-card__desc">
              Classic Scrabble vs a classmate. Place words on the 15×15 board,
              hit premium squares, and outscore your opponent.
            </div>
            <div class="game-card__meta">
              <span class="game-card__tag">1v1</span>
              <span class="game-card__tag">Turn-based</span>
              <span class="game-card__tag game-card__tag--xp">Up to +200 XP</span>
            </div>
          </div>
          ${knowledgeSurferCard}
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

    // ── Scroll back to the top of the page ──
    requestAnimationFrame(function () {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      const appEl = document.getElementById('app');
      if (appEl && typeof appEl.scrollTo === 'function') {
        appEl.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      } else if (appEl) {
        appEl.scrollTop = 0;
      }
    });

    _updateGameNavBadge(pendingChallenges.length + awaitingPlay.length + pendingScrabble.length + myTurnScrabble.length);

    if (_krLimited) {
      _krStartCountdownTick(() => document.getElementById(_krCardId));
    }
    } catch (err) {
      console.error('[game] openGameLobby crashed:', err);
      if (window.UI && window.UI.toast) {
        window.UI.toast('Games failed to load. Please try again.', 'error', 4000);
      }
    }
  }

  function _renderLevelStrip(currentRank, xp) {
  const start = Math.max(0, currentRank - 3);
  const end   = Math.min(LEVELS.length - 1, currentRank + 2);
  const slice = LEVELS.slice(start, end + 1);

  const items = slice.map(l => {
    const isCurrent  = l.rank === currentRank;
    const isUnlocked = xp >= l.minXP;
    return `
      <div style="text-align:center;flex:1;min-width:0;padding:.25rem .125rem;
                  opacity:${isUnlocked ? '1' : '0.35'};
                  ${isCurrent ? 'transform:scale(1.12);' : ''}">
        <div style="width:30px;height:30px;border-radius:50%;margin:0 auto;
                    background:${isCurrent ? l.color : 'var(--bg-muted)'};
                    border:2px solid ${isCurrent ? l.color : 'var(--border)'};
                    display:flex;align-items:center;justify-content:center;
                    box-shadow:${isCurrent ? '0 0 12px ' + l.color + '55' : 'none'};">
          ${_icon(l.icon, 15, { color: isCurrent ? '#fff' : (isUnlocked ? l.color : 'var(--text-4)') })}
        </div>
        <p style="font-size:.5625rem;font-weight:${isCurrent ? '800' : '500'};
                  color:${isCurrent ? l.color : 'var(--text-3)'};
                  margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${_esc(l.name)}
        </p>
        <p style="font-size:.5rem;color:var(--text-4);margin-top:1px;">${l.minXP.toLocaleString()}</p>
      </div>`;
  }).join('');

  return `
    <div class="glass-dark" style="padding:.625rem .875rem;border-radius:var(--r-lg);margin:.5rem 0;cursor:pointer;"
         onclick="Game._showAllLevelsModal(${xp})" title="Click to see all ranks">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;">
        <p style="font-size:.625rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin:0;">
          Level Progression
        </p>
        <span style="font-size:.625rem;color:var(--accent);font-weight:600;display:flex;align-items:center;gap:.2rem;">
          ${_icon('arrowRight', 11)} View all ${LEVELS.length} ranks
        </span>
      </div>
      <div style="display:flex;align-items:flex-end;gap:.25rem;overflow-x:auto;">${items}</div>
    </div>`;
}

function _showAllLevelsModal(currentXP) {
  const rows = LEVELS.map(l => {
    const isUnlocked = currentXP >= l.minXP;
    const isCurrent  = currentXP >= l.minXP && (
      LEVELS.indexOf(l) === LEVELS.length - 1 || currentXP < LEVELS[LEVELS.indexOf(l) + 1].minXP
    );
    const nextL      = LEVELS[LEVELS.indexOf(l) + 1];
    const xpNeeded   = isUnlocked ? 0 : l.minXP - currentXP;

    return `
      <div style="display:flex;align-items:center;gap:.75rem;padding:.625rem .875rem;
                  border-radius:8px;margin-bottom:.375rem;
                  background:${isCurrent ? l.color + '18' : 'var(--bg-subtle)'};
                  border:1.5px solid ${isCurrent ? l.color : 'var(--border)'};
                  opacity:${isUnlocked ? '1' : '0.55'};">
        <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;
                    background:${isUnlocked ? l.color : 'var(--bg-muted)'};
                    border:2px solid ${isUnlocked ? l.color : 'var(--border)'};
                    display:flex;align-items:center;justify-content:center;">
          ${_icon(l.icon, 18, { color: isUnlocked ? '#fff' : 'var(--text-4)' })}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:.375rem;flex-wrap:wrap;">
            <span style="font-size:.9375rem;font-weight:700;color:${isCurrent ? l.color : 'var(--text-1)'};">
              ${_esc(l.name)}
            </span>
            <span style="font-size:.625rem;background:var(--bg-muted);color:var(--text-3);
                          border-radius:4px;padding:1px 5px;">Rank ${l.rank}</span>
            ${isCurrent ? `<span style="font-size:.625rem;background:${l.color};color:#fff;
                            border-radius:4px;padding:1px 6px;font-weight:700;">YOU ARE HERE</span>` : ''}
          </div>
          <div style="font-size:.75rem;color:var(--text-3);margin-top:2px;">
            ${isUnlocked
              ? `${_icon('checkCircle', 11, { color: 'var(--success)' })} Unlocked at ${l.minXP.toLocaleString()} XP`
              : `${_icon('hourglass', 11)} Need ${xpNeeded.toLocaleString()} more XP`}
          </div>
          ${isCurrent && nextL
            ? `<div style="margin-top:.375rem;">
                 <div style="width:100%;height:4px;background:var(--bg-muted);border-radius:99px;overflow:hidden;">
                   <div style="height:100%;border-radius:99px;background:${l.color};
                               width:${Math.min(100, Math.round(((currentXP - l.minXP) / (nextL.minXP - l.minXP)) * 100))}%;
                               transition:width .6s ease;"></div>
                 </div>
                 <div style="font-size:.5625rem;color:var(--text-4);margin-top:2px;">
                   ${currentXP.toLocaleString()} / ${nextL.minXP.toLocaleString()} XP to ${_esc(nextL.name)}
                 </div>
               </div>`
            : ''}
        </div>
      </div>`;
  }).join('');

  _showModal(`
    <div style="text-align:center;margin-bottom:1rem;">
      <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">
        ${_icon('chartBar', 20)} All Ranks
      </h2>
      <p style="font-size:.8125rem;color:var(--text-3);margin-top:.25rem;">
        ${LEVELS.length} ranks total. Keep earning XP to climb higher.
      </p>
    </div>
    <div style="max-height:65vh;overflow-y:auto;padding-right:.25rem;">
      ${rows}
    </div>
    <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.75rem;">Close</button>
  `);
}

  /* ══════════════════════════════════════════════════════════════
     GAME SELECTION
  ══════════════════════════════════════════════════════════════ */

  function _selectGame(type) {
  if      (type === 'quizBlitz')       _showQuizBlitzSetup();
  else if (type === 'speedMath')       _showSpeedMathSetup();
  else if (type === 'wordScramble')    _showWordScrambleSetup();
  else if (type === 'trueOrFalse')     _showTrueOrFalseSetup();
  else if (type === 'suddenDeath')     _showSuddenDeathSetup();
  else if (type === 'challenge')       _showChallengeSetup();
  else if (type === 'knowledgeRunner') _showKnowledgeRunnerSetup();
  else if (type === 'wordScrabble')    _showScrabbleSetup();     // ← NEW
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
    const subjectOptions = subjects.map(s => `<option value="${_esc(s)}">${_esc(s)}</option>`).join('');
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
      <button onclick="Game._startQuizBlitz()" class="btn btn-lg w-full" style="background:var(--accent);">Start Quiz Blitz</button>
      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Cancel</button>
    `);
  }

// ── Game Session Tracker ─────────────────────────────────────
// Creates a Firestore doc at game start, updates it at game end.
// Returns the session doc ID so _awardXP can close it.

let _currentSessionId = null;
let _sessionHeartbeatInt = null;
let _sessionUnloadHandlerAttached = false;

const SESSION_HEARTBEAT_MS = 20_000;   // update every 20s
const SESSION_STALE_MS     = 90_000;   // teacher dashboard treats >90s silence as dead

function _stopSessionHeartbeat() {
  if (_sessionHeartbeatInt) { clearInterval(_sessionHeartbeatInt); _sessionHeartbeatInt = null; }
}

function _startSessionHeartbeat(sessionId) {
  _stopSessionHeartbeat();
  if (!sessionId || !_isOnline()) return;
  _sessionHeartbeatInt = setInterval(() => {
    if (!sessionId || !_isOnline()) return;
    _db().collection('gameSessions').doc(sessionId).update({
      lastHeartbeat: firebase.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {}); // non-fatal — connection hiccups shouldn't spam errors
  }, SESSION_HEARTBEAT_MS);
}

function _attachSessionUnloadHandler() {
  if (_sessionUnloadHandlerAttached) return;
  _sessionUnloadHandlerAttached = true;
  window.addEventListener('pagehide', () => {
    if (!_currentSessionId) return;
    try {
      // Best-effort: mark abandoned so it stops showing as "live".
      // Not guaranteed to complete, but works for normal tab closes.
      _db().collection('gameSessions').doc(_currentSessionId).update({
        status:  'abandoned',
        endedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
    } catch (e) { /* non-fatal */ }
  });
}

async function _startGameSession(gameType, extraMeta) {
  const uid = _uid();
  if (!uid || !_isOnline()) return null;
  try {
    const ref = await _db().collection('gameSessions').add({
      uid,
      name:      _student().name   || '',
      class:     _student().class  || '',
      school:    _student().school || '',
      gameType,
      status:        'playing',
      startedAt:     firebase.firestore.FieldValue.serverTimestamp(),
      lastHeartbeat: firebase.firestore.FieldValue.serverTimestamp(),
      endedAt:   null,
      xpEarned:  0,
      score:     null,
      pct:       null,
      win:       null,
      meta:      extraMeta || {},
    });
    _currentSessionId = ref.id;
    _startSessionHeartbeat(ref.id);
    _attachSessionUnloadHandler();
    return ref.id;
  } catch (e) {
    console.warn('[game] _startGameSession error (non-fatal):', e);
    return null;
  }
}

async function _endGameSession(sessionId, resultData) {
  _stopSessionHeartbeat();
  if (_currentSessionId === sessionId) _currentSessionId = null;
  if (!sessionId || !_isOnline()) return;
  try {
    await _db().collection('gameSessions').doc(sessionId).update({
      status:   'finished',
      endedAt:  firebase.firestore.FieldValue.serverTimestamp(),
      xpEarned: resultData.xpEarned  || 0,
      score:    resultData.score      ?? null,
      pct:      resultData.pct        ?? null,
      win:      resultData.win        ?? null,
      grade:    resultData.grade      || null,
      meta:     resultData.meta       || {},
    });
  } catch (e) {
    console.warn('[game] _endGameSession error (non-fatal):', e);
  }
}

  function _startQuizBlitz() {
    const subject = document.getElementById('quizBlitzSubject')?.value || 'random';
    const count   = parseInt(document.getElementById('quizBlitzCount')?.value || '10', 10);
    let questions = [];
    if (subject === 'random') {
      const subjects = _getSubjectsForStudent();
      if (subjects.length === 0) { window.UI.toast('No subjects found.', 'error'); return; }
      const perSubj = Math.ceil(count / subjects.length);
      subjects.forEach(s => { questions = questions.concat(_getQuestionsForSubject(s, perSubj).map(q => ({ ...q, subject: s }))); });
      questions = _shuffleArray(questions).slice(0, count);
    } else {
      questions = _getQuestionsForSubject(subject, count).map(q => ({ ...q, subject }));
    }
    if (questions.length === 0) { window.UI.toast('No questions available for that subject.', 'error'); return; }
    _gameState = { type: 'quizBlitz', questions, currentIndex: 0, answers: [], score: 0, xpEarned: 0, speedBonuses: 0, startedAt: Date.now(), _sessionId: null };
    _startGameSession('quizBlitz', { subject, count }).then(id => {
      if (_gameState && _gameState.type === 'quizBlitz') _gameState._sessionId = id;
    });
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
              <div style="font-size:.875rem;color:var(--text-2);margin-top:1px;">${_esc(q.subject || '')} &middot; Q${progress} of ${total}</div>
            </div>
            <div style="text-align:right;">
              <div id="quizTimer" class="game-timer timer-green">${QUIZ_BLITZ_TIME}</div>
              <div style="font-size:.6875rem;color:var(--text-4);">seconds left</div>
            </div>
          </div>
          <div class="game-progress-track"><div class="game-progress-fill" style="width:${pctWidth}%;"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:.375rem;">
            <span style="font-size:.6875rem;color:var(--text-4);">${correct} correct</span>
            <span style="font-size:.6875rem;color:var(--accent);font-weight:700;">${gs.xpEarned} XP earned</span>
          </div>
        </div>

        <div class="glass" style="padding:1.25rem 1.5rem;margin:.75rem 0;">
          <p style="font-size:1.0625rem;font-weight:500;line-height:1.65;margin-bottom:1.25rem;" id="quizQuestionText">
            ${_safeQ(q.q)}
          </p>
          <div id="quizOptions">
            ${q.opts.map((opt, idx) => `
              <button class="game-option-btn" id="quizOpt${idx}" onclick="Game._answerQuizBlitz(${idx})">
                <span class="game-option-btn__letter">${String.fromCharCode(65 + idx)}</span>
                <span id="quizOptText${idx}">${_safeQ(opt)}</span>
              </button>`).join('')}
          </div>
        </div>

        <div style="text-align:center;">
          <button onclick="Game._abandonGame()" class="btn bg-gray-500" style="font-size:.8125rem;display:inline-flex;align-items:center;gap:.3rem;">
            ${_icon('x', 13)} Quit Game
          </button>
        </div>
      </div>`);

    _renderKatex();
    _timerEl = document.getElementById('quizTimer');
    _startTimer(QUIZ_BLITZ_TIME,
      (s) => { if (_timerEl) { _timerEl.textContent = s; _timerEl.className = 'game-timer ' + (s <= 5 ? 'timer-red' : s <= 10 ? 'timer-yellow' : 'timer-green'); } },
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
      if (gs.currentIndex >= gs.questions.length) _finishQuizBlitz();
      else _renderQuizBlitzQuestion();
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
    let xpFinal   = gs.xpEarned;
    if (perfect) xpFinal += XP_PER_PERFECT;
    const result = await _awardXP(xpFinal, 'quizBlitz', { win, perfect, speedDemonCount: _speedDemonCount });
    await _saveGameResult('quizBlitz', { correct, total, pct, xpEarned: xpFinal, perfect });
    await _endGameSession(gs._sessionId, { xpEarned: xpFinal, score: correct, pct, win, meta: { total, perfect } });
    _renderGameResult({ gameIcon: 'lightning', gameName: 'Quiz Blitz', score: `${correct} / ${total}`, pct, xpEarned: xpFinal, perfect, win, result, extras: [{ label: 'Speed Bonuses', value: `+${gs.speedBonuses * XP_SPEED_BONUS} XP` }, { label: 'Perfect Bonus', value: perfect ? `+${XP_PER_PERFECT} XP` : '—' }], onPlayAgainKey: 'quizBlitz' });
  }

  /* ══════════════════════════════════════════════════════════════
     SPEED MATH
  ══════════════════════════════════════════════════════════════ */

  const _mathProblems = {
    easy:   () => { const ops = ['+','-']; const op = ops[Math.floor(Math.random()*ops.length)]; if (op==='+'){const a=_rnd(1,50),b=_rnd(1,50);return{q:`${a} + ${b} = ?`,ans:a+b};}else{const a=_rnd(10,99),b=_rnd(1,a);return{q:`${a} − ${b} = ?`,ans:a-b};} },
    medium: () => { const ops=['+','-','×'];const op=ops[Math.floor(Math.random()*ops.length)];if(op==='+'){const a=_rnd(20,200),b=_rnd(20,200);return{q:`${a} + ${b} = ?`,ans:a+b};}if(op==='-'){const a=_rnd(50,300),b=_rnd(1,a);return{q:`${a} − ${b} = ?`,ans:a-b};}const a=_rnd(2,12),b=_rnd(2,12);return{q:`${a} × ${b} = ?`,ans:a*b}; },
    hard:   () => { const ops=['×','÷','sq','mixed'];const op=ops[Math.floor(Math.random()*ops.length)];if(op==='×'){const a=_rnd(13,25),b=_rnd(13,25);return{q:`${a} × ${b} = ?`,ans:a*b};}if(op==='÷'){const b=_rnd(2,12),a=b*_rnd(2,12);return{q:`${a} ÷ ${b} = ?`,ans:a/b};}if(op==='sq'){const a=_rnd(5,20);return{q:`${a}² = ?`,ans:a*a};}const a=_rnd(10,50),b=_rnd(2,12),c=_rnd(1,20);return{q:`(${a} × ${b}) + ${c} = ?`,ans:(a*b)+c}; },
  };
  function _rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function _showSpeedMathSetup() {
    _showModal(`
      <div style="text-align:center;margin-bottom:1.25rem;">
        <div style="margin-bottom:.5rem;">${_icon('calculator', 40, { color: '#f59e0b' })}</div>
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">Speed Math Setup</h2>
        <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;">Solve as many problems as you can in 90 seconds!</p>
      </div>
      <div style="margin-bottom:1.5rem;">
        <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.5rem;">Difficulty</label>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;" id="diffGrid">
          <label class="game-diff-option selected" data-diff="easy">
            <input type="radio" name="mathDiff" value="easy" checked style="display:none;" />
            <span class="game-diff-option__icon" style="color:#22c55e;">${_icon('checkCircle', 20, { color: '#22c55e' })}</span>
            <span class="game-diff-option__name">Easy</span><span class="game-diff-option__desc">+, − only</span>
          </label>
          <label class="game-diff-option" data-diff="medium">
            <input type="radio" name="mathDiff" value="medium" style="display:none;" />
            <span class="game-diff-option__icon">${_icon('warning', 20, { color: '#f59e0b' })}</span>
            <span class="game-diff-option__name">Medium</span><span class="game-diff-option__desc">+, −, ×</span>
          </label>
          <label class="game-diff-option" data-diff="hard">
            <input type="radio" name="mathDiff" value="hard" style="display:none;" />
            <span class="game-diff-option__icon">${_icon('flame', 20, { color: '#ef4444' })}</span>
            <span class="game-diff-option__name">Hard</span><span class="game-diff-option__desc">All ops + squares</span>
          </label>
        </div>
      </div>
      <button onclick="Game._startSpeedMath()" class="btn btn-lg w-full" style="background:var(--warning);color:#fff;">Start Speed Math</button>
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
    _gameState = { type: 'speedMath', difficulty: diff, totalTime: 90, score: 0, attempted: 0, xpEarned: 0, startedAt: Date.now(), currentProblem: _mathProblems[diff](), _sessionId: null };
    _startGameSession('speedMath', { difficulty: diff }).then(id => {
      if (_gameState && _gameState.type === 'speedMath') _gameState._sessionId = id;
    });
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
            <span style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${diffColor};">
              ${_icon('calculator', 13)} Speed Math &middot; ${_esc(diffLabel)}
            </span>
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
          <p id="mathProblem" style="font-size:2.25rem;font-weight:800;color:var(--text-1);font-family:var(--font-mono);letter-spacing:-.02em;margin-bottom:1.5rem;">${_esc(p.q)}</p>
          <input id="mathAnswer" type="number" inputmode="numeric" placeholder="Your answer"
                 style="font-size:1.5rem;text-align:center;max-width:200px;width:100%;padding:.625rem 1rem;border-radius:10px;"
                 autofocus onkeydown="if(event.key==='Enter')Game._submitMathAnswer()" />
          <div style="margin-top:1rem;">
            <button onclick="Game._submitMathAnswer()" class="btn btn-lg" style="background:${diffColor};color:#fff;min-width:120px;">Submit</button>
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
      (s) => { if (_timerEl) { _timerEl.textContent = s; _timerEl.className = 'game-timer ' + (s <= 10 ? 'timer-red' : s <= 30 ? 'timer-yellow' : 'timer-green'); } },
      () => { _finishSpeedMath(); }
    );
    document.getElementById('mathAnswer')?.focus();
  }

  function _submitMathAnswer() {
    const gs  = _gameState;
    if (!gs || gs.type !== 'speedMath') return;
    const input = document.getElementById('mathAnswer');
    if (!input) return;
    const val = parseInt(input.value, 10);
    if (isNaN(val)) { window.UI.toast('Please enter a number.', 'warning'); return; }
    const correct = val === gs.currentProblem.ans;
    const prevAns = gs.currentProblem.ans;
    gs.attempted++;
    if (correct) { gs.score++; gs.xpEarned += XP_PER_CORRECT; }
    const fb = document.getElementById('mathFeedback');
    if (fb) { fb.style.color = correct ? 'var(--success)' : 'var(--danger)'; fb.textContent = correct ? `Correct! +${XP_PER_CORRECT} XP` : `Wrong. Answer was ${prevAns}`; }
    gs.currentProblem = _mathProblems[gs.difficulty]();
    const problemEl = document.getElementById('mathProblem');
    if (problemEl) problemEl.textContent = gs.currentProblem.q;
    const scoreEl = document.getElementById('mathScoreDisplay');
    if (scoreEl) scoreEl.textContent = `${gs.score} correct · ${gs.attempted} attempted`;
    const xpEl = document.getElementById('mathXpDisplay');
    if (xpEl) xpEl.textContent = `${gs.xpEarned} XP`;
    input.value = '';
    input.focus();
    setTimeout(() => { if (fb) fb.textContent = ''; }, 900);
  }

  async function _finishSpeedMath() {
    const gs = _gameState;
    _stopTimer();
    _gameState = null;
    const pct    = gs.attempted > 0 ? Math.round((gs.score / gs.attempted) * 100) : 0;
    const perfect = gs.score === gs.attempted && gs.attempted >= 5;
    const win    = pct >= 60 && gs.score >= 5;
    const result = await _awardXP(gs.xpEarned, 'speedMath', { win, perfect, difficulty: gs.difficulty });
    await _saveGameResult('speedMath', { score: gs.score, attempted: gs.attempted, pct, xpEarned: gs.xpEarned, difficulty: gs.difficulty });
    await _endGameSession(gs._sessionId, { xpEarned: gs.xpEarned, score: gs.score, pct, win, meta: { attempted: gs.attempted, difficulty: gs.difficulty, perfect } });
    _renderGameResult({ gameIcon: 'calculator', gameName: 'Speed Math', score: `${gs.score} / ${gs.attempted}`, pct, xpEarned: gs.xpEarned, perfect, win, result, extras: [{ label: 'Difficulty', value: gs.difficulty.charAt(0).toUpperCase() + gs.difficulty.slice(1) }, { label: 'Accuracy', value: pct + '%' }], onPlayAgainKey: 'speedMath' });
  }

  /* ══════════════════════════════════════════════════════════════
     WORD SCRAMBLE
  ══════════════════════════════════════════════════════════════ */

  const _wordBank = [
  // Biology
  { word: 'NUCLEUS',    hint: 'Control centre of a cell' },
  { word: 'MEMBRANE',   hint: 'Thin layer surrounding a cell' },
  { word: 'PROTEIN',    hint: 'Large molecule made of amino acids' },
  { word: 'FUNGUS',     hint: 'Organism like mushroom or mould' },
  { word: 'TISSUE',     hint: 'Group of similar cells working together' },
  { word: 'ORGAN',      hint: 'Body part with a specific function' },
  { word: 'POLLEN',     hint: 'Fine powder produced by flowers' },
  { word: 'GERMINATE',  hint: 'When a seed begins to sprout and grow' },
  { word: 'HABITAT',    hint: 'Natural home of an animal or plant' },
  { word: 'FEEDING',    hint: 'Obtaining food for energy' },
  { word: 'DIGESTION',  hint: 'Breaking down food in the body' },
  { word: 'SKELETON',   hint: 'Framework of bones in the body' },
  { word: 'BACTERIA',   hint: 'Tiny single-celled microorganisms' },
  { word: 'VITAMIN',    hint: 'Nutrient needed in small amounts for health' },
  { word: 'MINERAL',    hint: 'Inorganic nutrient the body needs' },
  { word: 'HORMONE',    hint: 'Chemical messenger produced by glands' },
  { word: 'VACCINE',    hint: 'Injection that protects against disease' },
  { word: 'PARASITE',   hint: 'Organism that lives on and harms a host' },
  { word: 'SPECIES',    hint: 'Group of organisms that can breed together' },
  { word: 'INHERIT',    hint: 'To receive traits from your parents' },
  { word: 'MUTATION',   hint: 'A change in the DNA of an organism' },
  { word: 'EXCRETE',    hint: 'To remove waste products from the body' },
  { word: 'OVARY',      hint: 'Female organ that produces eggs' },
  { word: 'EMBRYO',     hint: 'Early stage of development after fertilisation' },
  { word: 'SYMBIOSIS',  hint: 'Close relationship between two different organisms' },
  { word: 'PREDATOR',   hint: 'Animal that hunts and eats other animals' },
  { word: 'GLUCOSE',    hint: 'Simple sugar used by cells for energy' },
  { word: 'OXYGEN',     hint: 'Gas needed for respiration' },
  { word: 'CARBON',     hint: 'Element found in all living things' },
  { word: 'ENZYME',     hint: 'Biological catalyst that speeds up reactions' },

  // Chemistry
  { word: 'ELEMENT',    hint: 'Pure substance that cannot be broken down further' },
  { word: 'COMPOUND',   hint: 'Substance made of two or more elements chemically joined' },
  { word: 'MIXTURE',    hint: 'Two or more substances combined but not chemically joined' },
  { word: 'SOLVENT',    hint: 'Liquid that dissolves a solute' },
  { word: 'SOLUTE',     hint: 'Substance that is dissolved in a solvent' },
  { word: 'SOLUTION',   hint: 'Mixture of a solute dissolved in a solvent' },
  { word: 'ACID',       hint: 'Substance with a pH below 7' },
  { word: 'ALKALI',     hint: 'Substance with a pH above 7' },
  { word: 'ATOM',       hint: 'Smallest unit of an element' },
  { word: 'BONDING',    hint: 'How atoms join together' },
  { word: 'REACTION',   hint: 'Process where substances change into new substances' },
  { word: 'CATALYST',   hint: 'Substance that speeds up a reaction without being used up' },
  { word: 'OXIDISE',    hint: 'To combine with oxygen or lose electrons' },
  { word: 'REDUCE',     hint: 'To gain electrons in a chemical reaction' },
  { word: 'ELECTRON',   hint: 'Negatively charged particle in an atom' },
  { word: 'PROTON',     hint: 'Positively charged particle in the nucleus of an atom' },
  { word: 'NEUTRON',    hint: 'Particle in the nucleus with no charge' },
  { word: 'POLYMER',    hint: 'Large molecule made of repeating units' },
  { word: 'CRYSTAL',    hint: 'Solid with a regular geometric arrangement of atoms' },
  { word: 'FILTER',     hint: 'Method used to separate solid from liquid' },
  { word: 'DISTIL',     hint: 'To purify a liquid by heating and cooling' },
  { word: 'BURNING',    hint: 'Rapid reaction with oxygen that releases heat and light' },
  { word: 'RUSTING',    hint: 'Oxidation of iron in the presence of water and air' },
  { word: 'DENSITY',    hint: 'Mass per unit volume of a substance' },

  // Physics
  { word: 'ENERGY',     hint: 'Ability to do work' },
  { word: 'FORCE',      hint: 'Push or pull acting on an object' },
  { word: 'MOTION',     hint: 'Change in position of an object over time' },
  { word: 'GRAVITY',    hint: 'Force that pulls objects toward the Earth' },
  { word: 'FRICTION',   hint: 'Force that opposes motion between surfaces' },
  { word: 'CURRENT',    hint: 'Flow of electric charge' },
  { word: 'VOLTAGE',    hint: 'Potential difference that drives electric current' },
  { word: 'CIRCUIT',    hint: 'Closed path through which electric current flows' },
  { word: 'MAGNET',     hint: 'Object that attracts iron and steel' },
  { word: 'REFLECT',    hint: 'When light bounces off a surface' },
  { word: 'REFRACT',    hint: 'When light bends as it enters a new medium' },
  { word: 'ABSORB',     hint: 'To take in energy rather than reflect it' },
  { word: 'CONDUCT',    hint: 'To allow heat or electricity to pass through' },
  { word: 'INSULATE',   hint: 'To prevent transfer of heat or electricity' },
  { word: 'PRESSURE',   hint: 'Force applied per unit area' },
  { word: 'POWER',      hint: 'Rate at which energy is transferred' },
  { word: 'WEIGHT',     hint: 'Gravitational force acting on a mass' },
  { word: 'INERTIA',    hint: 'Tendency of an object to resist changes in motion' },
  { word: 'NUCLEAR',    hint: 'Relating to the nucleus of an atom' },
  { word: 'RADIATION',  hint: 'Energy emitted as waves or particles' },
  { word: 'SPECTRUM',   hint: 'Range of colours produced when light is split' },
  { word: 'MOMENTUM',   hint: 'Product of an object\'s mass and velocity' },
  { word: 'SOUND',      hint: 'Vibration that travels through a medium as a wave' },
  { word: 'ECHO',       hint: 'Reflected sound heard after a delay' },

  // Geography
  { word: 'CLIMATE',    hint: 'Typical weather conditions of a region over time' },
  { word: 'EROSION',    hint: 'Wearing away of land by water, wind or ice' },
  { word: 'VOLCANO',    hint: 'Mountain that erupts lava and ash' },
  { word: 'PLATEAU',    hint: 'Large flat area of high ground' },
  { word: 'DELTA',      hint: 'Fan-shaped deposit at the mouth of a river' },
  { word: 'VALLEY',     hint: 'Low area of land between hills or mountains' },
  { word: 'CANYON',     hint: 'Deep gorge carved by a river' },
  { word: 'GLACIER',    hint: 'Large slow-moving mass of ice' },
  { word: 'RAINFALL',   hint: 'Amount of rain that falls in an area' },
  { word: 'DROUGHT',    hint: 'Long period with little or no rainfall' },
  { word: 'FARMING',    hint: 'Growing crops and rearing animals for food' },
  { word: 'MINING',     hint: 'Extracting minerals and ores from the ground' },
  { word: 'EXPORT',     hint: 'Goods sent out of a country for sale' },
  { word: 'IMPORT',     hint: 'Goods brought into a country for sale' },
  { word: 'CAPITAL',    hint: 'City that is the seat of government' },
  { word: 'EQUATOR',    hint: 'Imaginary line dividing Earth into north and south' },
  { word: 'LATITUDE',   hint: 'Distance north or south of the equator' },
  { word: 'ISLAND',     hint: 'Land completely surrounded by water' },
  { word: 'COASTAL',    hint: 'Relating to the area near the sea' },
  { word: 'SAVANNA',    hint: 'Tropical grassland with scattered trees' },

  // Government / Civic Education
  { word: 'CITIZEN',    hint: 'Legal member of a country' },
  { word: 'ELECTION',   hint: 'Process of voting to choose leaders' },
  { word: 'VOTING',     hint: 'Casting a ballot to choose a candidate' },
  { word: 'CABINET',    hint: 'Group of senior government ministers' },
  { word: 'SENATE',     hint: 'Upper chamber of a legislature' },
  { word: 'FEDERAL',    hint: 'Relating to a system of shared government' },
  { word: 'POLICY',     hint: 'Plan of action adopted by a government' },
  { word: 'TREATY',     hint: 'Formal agreement between countries' },
  { word: 'JUSTICE',    hint: 'Fairness in the way people are treated' },
  { word: 'RIGHTS',     hint: 'Freedoms people are entitled to by law' },
  { word: 'FREEDOM',    hint: 'Power to act or speak without restraint' },
  { word: 'MILITARY',   hint: 'Armed forces of a country' },
  { word: 'CENSUS',     hint: 'Official count of the population' },
  { word: 'REVENUE',    hint: 'Income collected by the government' },
  { word: 'BUDGET',     hint: 'Plan for how money will be spent' },

  // English Language
  { word: 'SYNONYM',    hint: 'Word with the same meaning as another' },
  { word: 'ANTONYM',    hint: 'Word with the opposite meaning of another' },
  { word: 'PRONOUN',    hint: 'Word used in place of a noun' },
  { word: 'ADVERB',     hint: 'Word that modifies a verb, adjective or other adverb' },
  { word: 'SIMILE',     hint: 'Comparison using "like" or "as"' },
  { word: 'METAPHOR',   hint: 'Direct comparison saying something is something else' },
  { word: 'STANZA',     hint: 'Group of lines forming a unit in a poem' },
  { word: 'CHAPTER',    hint: 'Main division of a book' },
  { word: 'SUFFIX',     hint: 'Letters added to the end of a word to change its meaning' },
  { word: 'PREFIX',     hint: 'Letters added to the start of a word to change its meaning' },
  { word: 'SUBJECT',    hint: 'Who or what a sentence is about' },
  { word: 'OBJECT',     hint: 'Noun that receives the action of a verb' },
  { word: 'TENSE',      hint: 'Form of a verb that shows time' },
  { word: 'CLAUSE',     hint: 'Group of words containing a subject and verb' },
  { word: 'PHRASE',     hint: 'Group of words that does not contain a verb' },
  { word: 'SPEECH',     hint: 'Spoken communication or a formal talk' },
  { word: 'RHYME',      hint: 'Words that have the same ending sound' },
  { word: 'FICTION',    hint: 'Writing about imaginary events and people' },

  // Mathematics
  { word: 'FRACTION',   hint: 'Number representing part of a whole' },
  { word: 'DECIMAL',    hint: 'Number written with a decimal point' },
  { word: 'PERCENT',    hint: 'Amount expressed as parts per hundred' },
  { word: 'AVERAGE',    hint: 'Sum of values divided by the number of values' },
  { word: 'RATIO',      hint: 'Comparison of two quantities' },
  { word: 'FACTOR',     hint: 'Number that divides exactly into another number' },
  { word: 'PRIME',      hint: 'Number divisible only by 1 and itself' },
  { word: 'SQUARE',     hint: 'Shape with four equal sides and right angles' },
  { word: 'TRIANGLE',   hint: 'Shape with three sides and three angles' },
  { word: 'CIRCLE',     hint: 'Round shape where all points are equal distance from centre' },
  { word: 'RADIUS',     hint: 'Distance from the centre to the edge of a circle' },
  { word: 'DIAMETER',   hint: 'Straight line passing through the centre of a circle' },
  { word: 'ANGLE',      hint: 'Space between two lines that meet at a point' },
  { word: 'VOLUME',     hint: 'Amount of space a 3D object occupies' },
  { word: 'MATRIX',     hint: 'Rectangular arrangement of numbers in rows and columns' },
  { word: 'ALGEBRA',    hint: 'Branch of maths using letters to represent numbers' },
  { word: 'INTEGER',    hint: 'Whole number, positive, negative or zero' },
  { word: 'EQUATION',   hint: 'Mathematical statement showing two things are equal' },
  { word: 'GRAPH',      hint: 'Visual representation of data or a function' },
  { word: 'MEDIAN',     hint: 'Middle value in an ordered set of numbers' },
  { word: 'MODE',       hint: 'Most frequently occurring value in a data set' },
  { word: 'RANGE',      hint: 'Difference between the highest and lowest values' },
];

function _buildWordPoolForStudent() {
  const qBank    = window.questions || {};
  const classKey = (_student().class || '').replace(/\s+/g, '').toLowerCase();
  const classQs  = qBank[classKey] || {};
  const extracted = [];

  for (const subj of Object.keys(classQs)) {
    const questions = classQs[subj] || [];
    for (const q of questions) {
      const allText = [q.q || '', ...(q.opts || []), q.exp || ''];
      for (const text of allText) {
        const words = text.replace(/[^a-zA-Z\s]/g, ' ').split(/\s+/);
        for (const raw of words) {
          const w = raw.toUpperCase().trim();
          if (w.length >= 6 && w.length <= 14 && /^[A-Z]+$/.test(w)) {
            extracted.push({ word: w, hint: 'From your ' + subj + ' syllabus' });
          }
        }
      }
    }
  }

  const seen = new Set();
  const unique = [];
  for (const item of extracted) {
    if (!seen.has(item.word)) {
      seen.add(item.word);
      unique.push(item);
    }
  }

  const combined = _shuffleArray([...unique, ..._wordBank]);
  const deduped  = [];
  const deduped_set = new Set();
  for (const item of combined) {
    if (!deduped_set.has(item.word)) {
      deduped_set.add(item.word);
      deduped.push(item);
    }
  }
  return deduped;
}

  function _scrambleWord(word) {
    const letters = word.split('');
    const allSame = letters.every(l => l === letters[0]);
    if (allSame) return word;
    let scrambled = word, attempts = 0;
    while (scrambled === word && attempts < 50) { scrambled = _shuffleArray(letters).join(''); attempts++; }
    return scrambled;
  }

  function _showWordScrambleSetup() {
    _showModal(`
      <div style="text-align:center;margin-bottom:1.25rem;">
        <div style="margin-bottom:.5rem;">${_icon('textT', 40, { color: '#7c3aed' })}</div>
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">Word Scramble Setup</h2>
        <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;">Unscramble vocabulary words before time runs out. Up to ${MAX_SHUFFLES} reshuffles per word.</p>
      </div>
      <div style="margin-bottom:1.5rem;">
        <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.375rem;">Number of Words</label>
        <select id="scrambleCount" style="width:100%;">
          <option value="10">10 words</option><option value="15">15 words</option><option value="20">20 words</option>
        </select>
      </div>
      <button onclick="Game._startWordScramble()" class="btn btn-lg w-full" style="background:#7c3aed;color:#fff;">Start Word Scramble</button>
      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Cancel</button>
    `);
  }

  function _startWordScramble() {
  const count    = parseInt(document.getElementById('scrambleCount')?.value || '10', 10);
  const fullPool = _buildWordPoolForStudent();
  const words    = _shuffleArray(fullPool).slice(0, count);
  _closeModal();
  _gameState = {
    type:           'wordScramble',
    words,
    currentIndex:   0,
    score:          0,
    xpEarned:       0,
    wordCorrect:    0,
    startedAt:      Date.now(),
    shufflesLeft:   MAX_SHUFFLES,
    currentScramble: '',
    _sessionId:     null,
  };
  _startGameSession('wordScramble', { count }).then(id => {
    if (_gameState && _gameState.type === 'wordScramble') _gameState._sessionId = id;
  });
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
              <span style="font-size:.75rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;">${_icon('textT', 13)} Word Scramble</span>
              <div style="font-size:.875rem;color:var(--text-2);margin-top:1px;">Word ${progress} of ${total}</div>
            </div>
            <div style="text-align:right;">
              <div id="scrambleTimer" class="game-timer timer-green">${WORD_SCRAMBLE_TIME}</div>
              <div style="font-size:.6875rem;color:var(--text-4);">seconds</div>
            </div>
          </div>
          <div class="game-progress-track"><div class="game-progress-fill" style="width:${pctWidth}%;background:#7c3aed;"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:.375rem;">
            <span style="font-size:.6875rem;color:var(--text-4);">${gs.score} correct</span>
            <span style="font-size:.6875rem;color:var(--accent);font-weight:700;">${gs.xpEarned} XP</span>
          </div>
        </div>

        <div class="glass" style="padding:1.75rem 1.5rem;margin:.75rem 0;text-align:center;">
          <!-- HINT: Prominently displayed -->
          <div style="background:linear-gradient(135deg,rgba(124,58,237,0.15),rgba(107,135,248,0.10));
                      border:2px solid rgba(124,58,237,0.4);border-radius:12px;
                      padding:1rem;margin-bottom:1.25rem;box-shadow:0 2px 8px rgba(124,58,237,0.08);">
            <p style="font-size:.75rem;font-weight:700;text-transform:uppercase;
                      letter-spacing:.08em;color:#7c3aed;margin-bottom:.375rem;display:flex;align-items:center;gap:.375rem;justify-content:center;">
              ${_icon('lightbulb', 14, { color: '#7c3aed' })} Hint
            </p>
            <p style="font-size:1rem;font-weight:600;color:var(--text-1);
                      line-height:1.5;margin:0;">
              ${_esc(entry.hint || 'Related to your subjects')}
            </p>
          </div>

          <div class="game-scrambled-letters" id="scrambleLetters">
            ${scramble.split('').map(l => `<span class="game-letter-tile">${_esc(l)}</span>`).join('')}
          </div>
          <div style="display:flex;align-items:center;justify-content:center;gap:.5rem;margin:.25rem 0 .75rem;">
            <p style="font-size:.75rem;color:var(--text-4);margin:0;">${entry.word.length} letters</p>
            <button id="shuffleBtn" onclick="Game._reshuffleWord()"
                    class="game-shuffle-btn ${gs.shufflesLeft <= 0 ? 'game-shuffle-btn--disabled' : ''}"
                    ${gs.shufflesLeft <= 0 ? 'disabled' : ''} title="Reshuffle letters (${gs.shufflesLeft} left)">
              ${_icon('shuffle', 14)} Reshuffle <span class="game-shuffle-count">${gs.shufflesLeft}</span>
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
          <button onclick="Game._abandonGame()" class="btn bg-gray-500" style="font-size:.8125rem;display:inline-flex;align-items:center;gap:.3rem;">${_icon('x', 13)} Quit Game</button>
        </div>
      </div>`);

    _timerEl = document.getElementById('scrambleTimer');
    _startTimer(WORD_SCRAMBLE_TIME,
      (s) => { if (_timerEl) { _timerEl.textContent = s; _timerEl.className = 'game-timer ' + (s <= 5 ? 'timer-red' : s <= 10 ? 'timer-yellow' : 'timer-green'); } },
      () => { _skipScramble(); }
    );
    document.getElementById('scrambleInput')?.focus();
  }

  function _reshuffleWord() {
    const gs = _gameState;
    if (!gs || gs.type !== 'wordScramble' || gs.shufflesLeft <= 0) return;
    const entry  = gs.words[gs.currentIndex];
    let newScram = gs.currentScramble, attempts = 0;
    while (newScram === gs.currentScramble && attempts < 30) { newScram = _scrambleWord(entry.word); attempts++; }
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
    if (gs.shufflesLeft <= 0 && shuffleBtn) { shuffleBtn.disabled = true; shuffleBtn.classList.add('game-shuffle-btn--disabled'); }
    document.getElementById('scrambleInput')?.focus();
  }

  function _submitScrambleAnswer() {
    const gs = _gameState;
    if (!gs || gs.type !== 'wordScramble') return;
    _stopTimer();
    const input   = document.getElementById('scrambleInput');
    const val     = (input ? input.value : '').trim().toUpperCase();
    const correct = val === gs.words[gs.currentIndex].word;
    const fb      = document.getElementById('scrambleFeedback');
    if (fb) { fb.style.color = correct ? 'var(--success)' : 'var(--danger)'; fb.textContent = correct ? `Correct! +${XP_PER_CORRECT} XP` : `Wrong. The word was ${gs.words[gs.currentIndex].word}`; }
    if (correct) { gs.score++; gs.xpEarned += XP_PER_CORRECT; gs.wordCorrect++; }
    setTimeout(() => {
      gs.currentIndex++;
      if (gs.currentIndex >= gs.words.length) _finishWordScramble();
      else { gs.shufflesLeft = MAX_SHUFFLES; gs.currentScramble = _scrambleWord(gs.words[gs.currentIndex].word); _renderWordScrambleQuestion(); }
    }, 1200);
  }

  function _skipScramble() {
    _stopTimer();
    const gs = _gameState;
    if (!gs || gs.type !== 'wordScramble') return;
    const fb = document.getElementById('scrambleFeedback');
    if (fb) { fb.style.color = 'var(--text-3)'; fb.textContent = `Skipped. The word was ${gs.words[gs.currentIndex].word}`; }
    setTimeout(() => {
      gs.currentIndex++;
      if (gs.currentIndex >= gs.words.length) _finishWordScramble();
      else { gs.shufflesLeft = MAX_SHUFFLES; gs.currentScramble = _scrambleWord(gs.words[gs.currentIndex].word); _renderWordScrambleQuestion(); }
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
    const result  = await _awardXP(gs.xpEarned, 'wordScramble', { win, perfect, wordCorrect: gs.wordCorrect });
    await _saveGameResult('wordScramble', { correct, total, pct, xpEarned: gs.xpEarned });
    await _endGameSession(gs._sessionId, { xpEarned: gs.xpEarned, score: correct, pct, win, meta: { total, perfect } });
    _renderGameResult({ gameIcon: 'textT', gameName: 'Word Scramble', score: `${correct} / ${total}`, pct, xpEarned: gs.xpEarned, perfect, win, result, extras: [], onPlayAgainKey: 'wordScramble' });
  }

  /* ══════════════════════════════════════════════════════════════
     TRUE OR FALSE BLITZ  (NEW)
     ─────────────────────────────────────────────────────────────
     Each round presents a statement drawn from the MCQ bank.
     The statement is either the question + the CORRECT option
     (label = TRUE) or the question + a WRONG option (label = FALSE).
     Students tap TRUE or FALSE. Streaks of 3+ earn a bonus per Q.
  ══════════════════════════════════════════════════════════════ */

  /**
   * Build a pool of T/F items from the MCQ question bank.
   * Each item:  { statement, isTrue, subject, explanation }
   */
  function _buildTFPool(subjects, maxPerSubject) {
    const qBank    = window.questions || {};
    const classKey = (_student().class || '').replace(/\s+/g, '').toLowerCase();
    const pool     = [];

    for (const subj of subjects) {
      const all = (qBank[classKey] || {})[subj] || [];
      const sample = _shuffleArray(all).slice(0, maxPerSubject);
      for (const q of sample) {
        if (!q.opts || q.opts.length < 2 || q.ans == null) continue;

        // TRUE item: correct answer presented as a completion of the question
        pool.push({
          statement:   q.q,
          candidate:   q.opts[q.ans],
          isTrue:      true,
          subject:     subj,
          explanation: q.exp || '',
        });

        // FALSE item: a random wrong option
        const wrongOpts = q.opts.filter((_, i) => i !== q.ans);
        if (wrongOpts.length > 0) {
          const wrongOpt = wrongOpts[Math.floor(Math.random() * wrongOpts.length)];
          pool.push({
            statement:   q.q,
            candidate:   wrongOpt,
            isTrue:      false,
            subject:     subj,
            correctAns:  q.opts[q.ans],
            explanation: q.exp || '',
          });
        }
      }
    }
    return _shuffleArray(pool);
  }

  function _showTrueOrFalseSetup() {
    const subjects = _getSubjectsForStudent();
    if (subjects.length === 0) {
      window.UI.toast('No subjects found for your class. Contact your teacher.', 'error');
      return;
    }
    const subjectOptions = subjects.map(s => `<option value="${_esc(s)}">${_esc(s)}</option>`).join('');

    _showModal(`
      <div style="text-align:center;margin-bottom:1.25rem;">
        <div style="margin-bottom:.5rem;">${_icon('checkSquare', 40, { color: '#10b981' })}</div>
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">True or False Blitz</h2>
        <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;">
          ${TF_TIME_PER_QUESTION}s per statement &middot; build streaks for bonus XP &middot; +${TF_XP_STREAK_BONUS} XP per answer on a streak of ${TF_STREAK_THRESHOLD}+
        </p>
      </div>
      <div style="margin-bottom:1rem;">
        <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.375rem;">Subject</label>
        <select id="tfSubject" style="width:100%;">
          <option value="random">Random Mix (all subjects)</option>
          ${subjectOptions}
        </select>
      </div>
      <div style="margin-bottom:1.5rem;">
        <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.375rem;">Number of Statements</label>
        <select id="tfCount" style="width:100%;">
          <option value="10">10 statements</option>
          <option value="15">15 statements</option>
          <option value="20">20 statements</option>
        </select>
      </div>
      <button onclick="Game._startTrueOrFalse()" class="btn btn-lg w-full" style="background:#10b981;color:#fff;">Start True or False</button>
      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Cancel</button>
    `);
  }

  function _startTrueOrFalse() {
    const subjectSel = document.getElementById('tfSubject')?.value || 'random';
    const count      = parseInt(document.getElementById('tfCount')?.value || '10', 10);
    let subjects     = [];

    if (subjectSel === 'random') {
      subjects = _getSubjectsForStudent();
    } else {
      subjects = [subjectSel];
    }

    if (subjects.length === 0) { window.UI.toast('No subjects found.', 'error'); return; }

    const perSubj = Math.max(5, Math.ceil(count / subjects.length) + 2);
    const pool    = _buildTFPool(subjects, perSubj);

    if (pool.length === 0) { window.UI.toast('Not enough questions to build T/F statements.', 'error'); return; }

    const items = pool.slice(0, count);

    _closeModal();
    _gameState = {
      type:        'trueOrFalse',
      items,
      currentIndex: 0,
      score:        0,
      streak:       0,
      bestStreak:   0,
      xpEarned:     0,
      lastWasCorrect: false,
      startedAt:    Date.now(),
      _sessionId:   null,
    };
    _startGameSession('trueOrFalse', { subject: subjectSel, count }).then(id => {
      if (_gameState && _gameState.type === 'trueOrFalse') _gameState._sessionId = id;
    });
    _renderTFQuestion();
  }

  function _renderTFQuestion() {
    const gs = _gameState;
    if (!gs || gs.type !== 'trueOrFalse') return;

    const item     = gs.items[gs.currentIndex];
    const progress = gs.currentIndex + 1;
    const total    = gs.items.length;
    const pctWidth = Math.round((progress / total) * 100);
    const streakOn = gs.streak >= TF_STREAK_THRESHOLD;

    _questionStartTime = Date.now();

    window.UI.mount(`
      <div class="max-w-xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">

        <div class="glass game-quiz-header" style="border-top:3px solid #10b981;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;">
            <div>
              <span style="font-size:.75rem;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.05em;">
                ${_icon('checkSquare', 13, { color: '#10b981' })} True or False
              </span>
              <div style="font-size:.875rem;color:var(--text-2);margin-top:1px;">${_esc(item.subject)} &middot; ${progress} of ${total}</div>
            </div>
            <div style="text-align:right;">
              <div id="tfTimer" class="game-timer timer-green">${TF_TIME_PER_QUESTION}</div>
              <div style="font-size:.6875rem;color:var(--text-4);">seconds</div>
            </div>
          </div>
          <div class="game-progress-track"><div class="game-progress-fill" style="width:${pctWidth}%;background:#10b981;"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:.375rem;align-items:center;">
            <span style="font-size:.6875rem;color:var(--text-4);">${gs.score} correct</span>
            ${streakOn
              ? `<span style="font-size:.6875rem;font-weight:800;color:#f59e0b;display:flex;align-items:center;gap:.25rem;">
                   ${_icon('flame', 12, { color: '#f59e0b' })} Streak x${gs.streak} &middot; +${TF_XP_STREAK_BONUS} XP bonus
                 </span>`
              : `<span style="font-size:.6875rem;color:var(--text-4);">Streak: ${gs.streak}</span>`}
            <span style="font-size:.6875rem;color:var(--accent);font-weight:700;">${gs.xpEarned} XP</span>
          </div>
        </div>

        <div class="glass" style="padding:1.5rem;margin:.75rem 0;text-align:center;">
          <p style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
                    color:var(--text-3);margin-bottom:.625rem;">Is this statement TRUE or FALSE?</p>

          <!-- The question stem -->
          <div style="background:var(--bg-subtle);border:1px solid var(--border);border-radius:10px;
                      padding:1rem 1.125rem;margin-bottom:.875rem;text-align:left;">
            <p style="font-size:.6875rem;font-weight:700;color:var(--text-3);margin-bottom:.375rem;text-transform:uppercase;letter-spacing:.06em;">
              Question
            </p>
            <p style="font-size:.9375rem;font-weight:500;line-height:1.65;color:var(--text-1);">
              ${_safeQ(item.statement)}
            </p>
          </div>

          <!-- The candidate answer -->
          <div style="background:var(--accent-subtle);border:2px solid var(--accent-border);border-radius:10px;
                      padding:.875rem 1.125rem;margin-bottom:1.25rem;text-align:left;">
            <p style="font-size:.6875rem;font-weight:700;color:var(--text-3);margin-bottom:.375rem;text-transform:uppercase;letter-spacing:.06em;">
              Proposed Answer
            </p>
            <p style="font-size:1.0625rem;font-weight:700;color:var(--accent-text);line-height:1.5;" id="tfCandidateText">
              ${_safeQ(item.candidate)}
            </p>
          </div>

          <!-- TRUE / FALSE buttons -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
            <button id="tfTrueBtn" onclick="Game._answerTF(true)"
                    class="game-tf-btn game-tf-btn--true">
              ${_icon('checkCircle', 22, { color: '#fff' })}
              TRUE
            </button>
            <button id="tfFalseBtn" onclick="Game._answerTF(false)"
                    class="game-tf-btn game-tf-btn--false">
              ${_icon('xCircle', 22, { color: '#fff' })}
              FALSE
            </button>
          </div>
        </div>

        <div id="tfFeedback" style="min-height:3rem;"></div>

        <div style="text-align:center;margin-top:.5rem;">
          <button onclick="Game._abandonGame()" class="btn bg-gray-500" style="font-size:.8125rem;display:inline-flex;align-items:center;gap:.3rem;">
            ${_icon('x', 13)} Quit Game
          </button>
        </div>
      </div>`);

    _renderKatex();
    _timerEl = document.getElementById('tfTimer');
    _startTimer(TF_TIME_PER_QUESTION,
      (s) => {
        if (_timerEl) {
          _timerEl.textContent = s;
          _timerEl.className = 'game-timer ' + (s <= 3 ? 'timer-red' : s <= 6 ? 'timer-yellow' : 'timer-green');
        }
      },
      () => { _answerTF(null); }
    );
  }

  function _answerTF(chosenTrue) {
    _stopTimer();
    const gs = _gameState;
    if (!gs || gs.type !== 'trueOrFalse') return;
    if (gs._answered) return;
    gs._answered = true;

    const item    = gs.items[gs.currentIndex];
    const correct = chosenTrue !== null && (chosenTrue === item.isTrue);
    const timedOut = chosenTrue === null;

    // Visual feedback on buttons
    const trueBtn  = document.getElementById('tfTrueBtn');
    const falseBtn = document.getElementById('tfFalseBtn');
    if (trueBtn)  { trueBtn.disabled  = true; }
    if (falseBtn) { falseBtn.disabled = true; }

    if (item.isTrue) {
      if (trueBtn)  trueBtn.classList.add('game-tf-btn--revealed-correct');
      if (falseBtn) falseBtn.classList.add('game-tf-btn--revealed-wrong');
    } else {
      if (falseBtn) falseBtn.classList.add('game-tf-btn--revealed-correct');
      if (trueBtn)  trueBtn.classList.add('game-tf-btn--revealed-wrong');
    }

    // Highlight which button the student pressed
    if (!timedOut) {
      const pressedBtn = chosenTrue ? trueBtn : falseBtn;
      if (pressedBtn && correct)  pressedBtn.classList.add('game-tf-btn--pressed-correct');
      if (pressedBtn && !correct) pressedBtn.classList.add('game-tf-btn--pressed-wrong');
    }

    // XP & streak logic
    let xpThis = 0;
    if (correct) {
      xpThis += TF_XP_PER_CORRECT;
      gs.streak++;
      if (gs.streak > gs.bestStreak) gs.bestStreak = gs.streak;
      if (gs.streak >= TF_STREAK_THRESHOLD) xpThis += TF_XP_STREAK_BONUS;
      gs.score++;
    } else {
      gs.streak = 0;
    }
    gs.xpEarned += xpThis;
    gs._answered = false;

    // Inline feedback
    const feedbackEl = document.getElementById('tfFeedback');
    if (feedbackEl) {
      if (timedOut) {
        const correctLabel = item.isTrue ? 'TRUE' : 'FALSE';
        feedbackEl.innerHTML = `
          <div style="background:var(--danger-subtle);border:1px solid var(--danger-border);border-radius:8px;
                      padding:.625rem 1rem;text-align:center;font-size:.875rem;font-weight:700;color:var(--danger);">
            ${_icon('hourglass', 14, { color: 'var(--danger)' })} Time up! Answer was <strong>${correctLabel}</strong>
            ${item.explanation ? `<div style="font-size:.75rem;font-weight:400;color:var(--text-2);margin-top:.25rem;">${_safeQ(item.explanation)}</div>` : ''}
          </div>`;
      } else if (correct) {
        feedbackEl.innerHTML = `
          <div style="background:var(--success-subtle);border:1px solid var(--success-border);border-radius:8px;
                      padding:.625rem 1rem;text-align:center;font-size:.875rem;font-weight:700;color:var(--success);">
            ${_icon('checkCircle', 14, { color: 'var(--success)' })} Correct! +${xpThis} XP
            ${gs.streak >= TF_STREAK_THRESHOLD ? `<span style="margin-left:.375rem;font-size:.75rem;color:#f59e0b;">(streak bonus included)</span>` : ''}
          </div>`;
      } else {
        const correctLabel = item.isTrue ? 'TRUE' : 'FALSE';
        const correctAns   = item.isTrue ? item.candidate : (item.correctAns || '');
        feedbackEl.innerHTML = `
          <div style="background:var(--danger-subtle);border:1px solid var(--danger-border);border-radius:8px;
                      padding:.625rem 1rem;text-align:center;font-size:.875rem;font-weight:700;color:var(--danger);">
            ${_icon('xCircle', 14, { color: 'var(--danger)' })} Wrong! It was <strong>${correctLabel}</strong>
            ${correctAns ? `<div style="font-size:.75rem;font-weight:400;color:var(--text-2);margin-top:.25rem;">Correct answer: ${_safeQ(correctAns)}</div>` : ''}
            ${item.explanation ? `<div style="font-size:.75rem;font-weight:400;color:var(--text-2);margin-top:.25rem;">${_safeQ(item.explanation)}</div>` : ''}
          </div>`;
      }
    }

    setTimeout(() => {
      gs.currentIndex++;
      if (gs.currentIndex >= gs.items.length) _finishTrueOrFalse();
      else _renderTFQuestion();
    }, 1600);
  }

  async function _finishTrueOrFalse() {
    const gs = _gameState;
    _stopTimer();
    _gameState = null;

    const total   = gs.items.length;
    const correct = gs.score;
    const pct     = Math.round((correct / total) * 100);
    const perfect = correct === total;
    const win     = pct >= 60;
    let xpFinal   = gs.xpEarned;
    if (perfect) xpFinal += XP_PER_PERFECT;

    const result = await _awardXP(xpFinal, 'trueOrFalse', { win, perfect, tfBestStreak: gs.bestStreak });
    await _saveGameResult('trueOrFalse', { correct, total, pct, xpEarned: xpFinal, bestStreak: gs.bestStreak });
    await _endGameSession(gs._sessionId, { xpEarned: xpFinal, score: correct, pct, win, meta: { total, perfect, bestStreak: gs.bestStreak } });

    _renderGameResult({
      gameIcon:      'checkSquare',
      gameName:      'True or False Blitz',
      score:         `${correct} / ${total}`,
      pct,
      xpEarned:      xpFinal,
      perfect,
      win,
      result,
      extras: [
        { label: 'Best Streak',   value: `${gs.bestStreak} in a row` },
        { label: 'Perfect Bonus', value: perfect ? `+${XP_PER_PERFECT} XP` : '—' },
      ],
      onPlayAgainKey: 'trueOrFalse',
    });
  }

  /* ══════════════════════════════════════════════════════════════
     PERFECT RUN  (NEW)
     ─────────────────────────────────────────────────────────────
     Standard MCQ format, but ONE wrong answer ends the game.
     XP per correct answer starts at SD_XP_BASE and increases by
     SD_XP_INCREMENT for every subsequent correct answer, so
     surviving longer is exponentially more rewarding.
     A 12-second timer per question adds pressure.
  ══════════════════════════════════════════════════════════════ */

  function _showSuddenDeathSetup() {
    const subjects = _getSubjectsForStudent();
    if (subjects.length === 0) {
      window.UI.toast('No subjects found for your class. Contact your teacher.', 'error');
      return;
    }
    const subjectOptions = subjects.map(s => `<option value="${_esc(s)}">${_esc(s)}</option>`).join('');

    _showModal(`
      <div style="text-align:center;margin-bottom:1.25rem;">
        <div style="margin-bottom:.5rem;">${_icon('skull', 40, { color: '#e11d48' })}</div>
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">Perfect Run</h2>
        <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;">
          One wrong answer ends everything. XP compounds with every correct answer. How far can you go?
        </p>
      </div>
      <div style="margin-bottom:1rem;padding:.75rem 1rem;background:var(--danger-subtle);border:1px solid var(--danger-border);border-radius:8px;">
        <p style="font-size:.8125rem;font-weight:700;color:var(--danger);margin-bottom:.375rem;display:flex;align-items:center;gap:.375rem;">
          ${_icon('alertTriangle', 14, { color: 'var(--danger)' })} Rules
        </p>
        <ul style="font-size:.8125rem;color:var(--text-2);padding-left:1rem;margin:0;line-height:1.9;">
          <li>One wrong answer = game over immediately</li>
          <li>Running out of time = game over</li>
          <li>XP per correct answer starts at ${SD_XP_BASE} and grows by +${SD_XP_INCREMENT} each round</li>
          <li>${SD_TIME_PER_QUESTION} seconds per question</li>
        </ul>
      </div>
      <div style="margin-bottom:1rem;">
        <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.375rem;">Subject</label>
        <select id="sdSubject" style="width:100%;">
          <option value="random">Random Mix (all subjects)</option>
          ${subjectOptions}
        </select>
      </div>
      <button onclick="Game._startSuddenDeath()" class="btn btn-lg w-full" style="background:#e11d48;color:#fff;">
        ${_icon('skull', 16, { color: '#fff' })} Accept the Challenge
      </button>
      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Cancel</button>
    `);
  }

  function _startSuddenDeath() {
    const subjectSel = document.getElementById('sdSubject')?.value || 'random';
    let pool         = [];

    if (subjectSel === 'random') {
      const subjects = _getSubjectsForStudent();
      if (subjects.length === 0) { window.UI.toast('No subjects found.', 'error'); return; }
      subjects.forEach(s => {
        pool = pool.concat(_getQuestionsForSubject(s, 20).map(q => ({ ...q, subject: s })));
      });
    } else {
      pool = _getQuestionsForSubject(subjectSel, SD_MAX_QUESTIONS).map(q => ({ ...q, subject: subjectSel }));
    }

    pool = _shuffleArray(pool).slice(0, SD_MAX_QUESTIONS);
    if (pool.length === 0) { window.UI.toast('Not enough questions available.', 'error'); return; }

    _closeModal();
    _gameState = {
      type:        'suddenDeath',
      pool,
      currentIndex: 0,
      survived:    0,
      xpEarned:    0,
      dead:        false,
      currentXPValue: SD_XP_BASE,
      startedAt:   Date.now(),
      _sessionId:  null,
    };
    _startGameSession('suddenDeath', { subject: subjectSel }).then(id => {
      if (_gameState && _gameState.type === 'suddenDeath') _gameState._sessionId = id;
    });
    _renderSDQuestion();
  }

  function _renderSDQuestion() {
    const gs = _gameState;
    if (!gs || gs.type !== 'suddenDeath') return;

    const q        = gs.pool[gs.currentIndex];
    const survived = gs.survived;
    const nextXP   = gs.currentXPValue;

    _questionStartTime = Date.now();

    // Colour shifts more intense as you survive more
    const dangerLevel = Math.min(survived / 20, 1); // 0 → 1
    const accentColor = dangerLevel < 0.3
      ? '#f59e0b'
      : dangerLevel < 0.6
        ? '#f97316'
        : '#e11d48';

    window.UI.mount(`
      <div class="max-w-2xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">

        <div class="glass game-quiz-header" style="border-top:3px solid ${accentColor};">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;">
            <div>
              <span style="font-size:.75rem;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;gap:.25rem;">
                ${_icon('skull', 13, { color: accentColor })} Perfect Run
              </span>
              <div style="font-size:.875rem;color:var(--text-2);margin-top:1px;">
                ${_esc(q.subject || '')} &middot; Question ${gs.currentIndex + 1}
              </div>
            </div>
            <div style="text-align:right;">
              <div id="sdTimer" class="game-timer timer-green">${SD_TIME_PER_QUESTION}</div>
              <div style="font-size:.6875rem;color:var(--text-4);">seconds</div>
            </div>
          </div>

          <!-- Survival counter -->
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:.625rem;">
              <div style="display:flex;align-items:center;gap:.25rem;">
                <span style="font-size:.75rem;color:var(--text-3);">Survived:</span>
                <span style="font-size:1rem;font-weight:800;color:${accentColor};font-family:var(--font-mono);">${survived}</span>
              </div>
              <div style="width:1px;height:16px;background:var(--border);"></div>
              <div style="display:flex;align-items:center;gap:.25rem;">
                <span style="font-size:.75rem;color:var(--text-3);">XP banked:</span>
                <span style="font-size:.9375rem;font-weight:700;color:var(--accent);">${gs.xpEarned}</span>
              </div>
            </div>
            <div style="text-align:right;">
              <span style="font-size:.6875rem;color:var(--text-3);">Next correct worth:</span>
              <span style="font-size:.875rem;font-weight:800;color:${accentColor};margin-left:.25rem;">+${nextXP} XP</span>
            </div>
          </div>
        </div>

        <div class="glass" style="padding:1.25rem 1.5rem;margin:.75rem 0;">
          <p style="font-size:1.0625rem;font-weight:500;line-height:1.65;margin-bottom:1.25rem;">
            ${_safeQ(q.q)}
          </p>
          <div id="sdOptions">
            ${q.opts.map((opt, idx) => `
              <button class="game-option-btn" id="sdOpt${idx}" onclick="Game._answerSD(${idx})">
                <span class="game-option-btn__letter">${String.fromCharCode(65 + idx)}</span>
                <span>${_safeQ(opt)}</span>
              </button>`).join('')}
          </div>
        </div>

        <div id="sdFeedback" style="min-height:3rem;"></div>

        <div style="text-align:center;margin-top:.5rem;">
          <button onclick="Game._abandonGame()" class="btn bg-gray-500" style="font-size:.8125rem;display:inline-flex;align-items:center;gap:.3rem;">
            ${_icon('x', 13)} Quit Game
          </button>
        </div>
      </div>`);

    _renderKatex();
    _timerEl = document.getElementById('sdTimer');
    _startTimer(SD_TIME_PER_QUESTION,
      (s) => {
        if (_timerEl) {
          _timerEl.textContent = s;
          _timerEl.className = 'game-timer ' + (s <= 4 ? 'timer-red' : s <= 8 ? 'timer-yellow' : 'timer-green');
        }
      },
      () => { _answerSD(null); }          // timeout = death
    );
  }

  function _answerSD(chosenIdx) {
    _stopTimer();
    const gs = _gameState;
    if (!gs || gs.type !== 'suddenDeath') return;
    if (gs._answering) return;
    gs._answering = true;

    const q       = gs.pool[gs.currentIndex];
    const correct = chosenIdx !== null && chosenIdx === q.ans;
    const timedOut = chosenIdx === null;

    // Reveal correct/wrong states
    document.querySelectorAll('.game-option-btn').forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.ans)          btn.classList.add('game-option-btn--correct');
      else if (i === chosenIdx) btn.classList.add('game-option-btn--wrong');
    });

    const feedbackEl = document.getElementById('sdFeedback');

    if (correct) {
      const earned = gs.currentXPValue;
      gs.xpEarned      += earned;
      gs.survived++;
      gs.currentXPValue = gs.currentXPValue + SD_XP_INCREMENT;
      gs._answering     = false;

      if (feedbackEl) {
        feedbackEl.innerHTML = `
          <div style="background:var(--success-subtle);border:1px solid var(--success-border);border-radius:8px;
                      padding:.625rem 1rem;text-align:center;font-size:.875rem;font-weight:700;color:var(--success);">
            ${_icon('checkCircle', 14, { color: 'var(--success)' })} Correct! +${earned} XP &mdash; next question worth +${gs.currentXPValue} XP
          </div>`;
      }

      // Check if pool is exhausted — treat as victory
      if (gs.currentIndex + 1 >= gs.pool.length) {
        setTimeout(() => _finishSuddenDeath(false), 1400);
        return;
      }

      setTimeout(() => {
        gs.currentIndex++;
        _renderSDQuestion();
      }, 1400);

    } else {
      // DEAD
      gs.dead      = true;
      gs._answering = false;

      if (feedbackEl) {
        const deathMsg = timedOut ? 'Time ran out!' : 'Wrong answer!';
        const correct_text = timedOut ? _safeQ(q.opts[q.ans]) : null;
        feedbackEl.innerHTML = `
          <div style="background:var(--danger-subtle);border:2px solid var(--danger-border);border-radius:8px;
                      padding:.75rem 1rem;text-align:center;">
            <p style="font-size:1rem;font-weight:800;color:var(--danger);margin-bottom:.25rem;">
              ${_icon('skull', 18, { color: 'var(--danger)' })} ${deathMsg} — Game Over!
            </p>
            ${correct_text ? `<p style="font-size:.8125rem;color:var(--text-2);">Correct answer: ${correct_text}</p>` : ''}
            <p style="font-size:.8125rem;color:var(--text-2);margin-top:.25rem;">You survived <strong>${gs.survived}</strong> question${gs.survived !== 1 ? 's' : ''}.</p>
          </div>`;
      }

      setTimeout(() => _finishSuddenDeath(true), 2200);
    }
  }

  async function _finishSuddenDeath(died) {
    const gs = _gameState;
    _stopTimer();
    _gameState = null;

    const survived    = gs.survived;
    const total       = gs.pool.length;
    const xpFinal     = gs.xpEarned;
    const questionsAttempted = gs.currentIndex + (died ? 1 : 0);
    const pct         = questionsAttempted > 0 ? Math.round((survived / questionsAttempted) * 100) : 0;
    const win         = survived >= 5;
    const perfect     = !died && survived === total;

    const result = await _awardXP(xpFinal, 'suddenDeath', {
      win,
      perfect,
      sdSurvived: survived,
    });
    await _saveGameResult('suddenDeath', {
      survived,
      total: questionsAttempted,
      pct,
      xpEarned: xpFinal,
      died,
    });
    await _endGameSession(gs._sessionId, { xpEarned: xpFinal, score: survived, pct, win, meta: { questionsAttempted, died, perfect } });

    const survivalColor = survived >= 20 ? 'var(--success)'
                        : survived >= 10 ? 'var(--warning)'
                        : survived >= 5  ? '#f97316'
                        : 'var(--danger)';

    const survivalTitle = survived >= 30 ? 'Legendary Run!'
                        : survived >= 20 ? 'Incredible!'
                        : survived >= 15 ? 'Outstanding!'
                        : survived >= 10 ? 'Impressive!'
                        : survived >= 5  ? 'Not bad!'
                        : 'Better luck next time!';

    const extraHtml = `
      <div style="margin:.75rem 0;padding:1.25rem;border-radius:10px;text-align:center;
                  background:var(--bg-subtle);border:2px solid ${survivalColor}30;">
        <div style="font-size:2.5rem;font-weight:900;color:${survivalColor};font-family:var(--font-mono);line-height:1;">
          ${survived}
        </div>
        <p style="font-size:.875rem;font-weight:700;color:${survivalColor};margin:.25rem 0;">
          Questions Survived
        </p>
        <p style="font-size:1rem;font-weight:800;color:var(--text-1);margin-top:.5rem;">${survivalTitle}</p>
        ${died
          ? `<p style="font-size:.8125rem;color:var(--text-3);margin-top:.375rem;">
               Eliminated on question ${questionsAttempted}
             </p>`
          : `<p style="font-size:.8125rem;color:var(--success);font-weight:700;margin-top:.375rem;">
               You survived the entire pool — flawless!
             </p>`}
      </div>`;

    _renderGameResult({
      gameIcon:      'skull',
      gameName:      'Perfect Run',
      score:         `${survived} survived`,
      pct,
      xpEarned:      xpFinal,
      perfect,
      win,
      result,
      extras: [
        { label: 'Questions Attempted', value: String(questionsAttempted) },
        { label: 'Final XP per Question', value: `${gs.currentXPValue - SD_XP_INCREMENT} XP` },
      ],
      extraHtml,
      onPlayAgainKey: 'suddenDeath',
    });
  }

  /* ══════════════════════════════════════════════════════════════
     CHALLENGE SYSTEM  (unchanged)
  ══════════════════════════════════════════════════════════════ */

  async function _showChallengeSetup() {
    const myClass = _student().class || '';
    if (!myClass) { window.UI.toast('Your class is not set. Contact your teacher.', 'error'); return; }
    let classmates = [];
    try {
      const snap = await _db().collection('students').where('class', '==', myClass).get();
      snap.forEach(doc => { if (doc.id !== _uid()) classmates.push({ id: doc.id, name: doc.data().name || 'Unknown' }); });
    } catch (e) {
      console.error('[game] _showChallengeSetup error:', e);
      window.UI.toast('Could not load classmates. Please try again.', 'error'); return;
    }
    if (classmates.length === 0) { window.UI.toast("No classmates found — you're the only one in your class!", 'info'); return; }

    const subjects       = _getSubjectsForStudent();
    const subjectOptions = subjects.map(s => `<option value="${_esc(s)}">${_esc(s)}</option>`).join('');
    const classmateOptions = classmates.sort((a, b) => a.name.localeCompare(b.name))
      .map(c => `<option value="${_esc(c.id)}">${_esc(c.name)}</option>`).join('');

    _showModal(`
      <div style="text-align:center;margin-bottom:1.25rem;">
        <div style="margin-bottom:.5rem;">${_icon('swords', 40, { color: 'var(--danger)' })}</div>
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">Challenge a Classmate</h2>
        <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;">Both of you answer the same 10 questions. Highest score wins.</p>
      </div>
      <div style="margin-bottom:.875rem;">
        <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.375rem;">Challenge Who?</label>
        <select id="challengeTarget" style="width:100%;">${classmateOptions}</select>
      </div>
      <div style="margin-bottom:1.5rem;">
        <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.375rem;">Subject</label>
        <select id="challengeSubject" style="width:100%;">
          <option value="random">Random Mix</option>${subjectOptions}
        </select>
      </div>
      <button onclick="Game._sendChallenge()" class="btn btn-lg w-full" style="background:var(--danger);color:#fff;">
        ${_icon('swords', 16)} Send Challenge
      </button>
      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Cancel</button>
    `);
  }

  async function _sendChallenge() {
    const targetSel    = document.getElementById('challengeTarget');
    const targetUid    = targetSel ? targetSel.value : null;
    const subject      = document.getElementById('challengeSubject')?.value || 'random';
    if (!targetUid) { window.UI.toast('Please select a classmate.', 'warning'); return; }
    const selectedOption = targetSel.options[targetSel.selectedIndex];
    const targetName     = selectedOption ? selectedOption.text : 'Unknown';

    const sendBtn = document.querySelector('#gameModal .btn:not(.bg-gray-500)');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Sending…'; }

    let questions = [];
    if (subject === 'random') {
      const subjects = _getSubjectsForStudent();
      if (subjects.length === 0) { window.UI.toast('No questions available.', 'error'); if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = `${_icon('swords', 16)} Send Challenge`; } return; }
      const perSubj = Math.ceil(10 / subjects.length);
      subjects.forEach(s => { questions = questions.concat(_getQuestionsForSubject(s, perSubj).map(q => ({ ...q, subject: s }))); });
      questions = _shuffleArray(questions).slice(0, 10);
    } else {
      questions = _getQuestionsForSubject(subject, 10).map(q => ({ ...q, subject }));
    }
    if (questions.length === 0) { window.UI.toast('No questions available.', 'error'); if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = `${_icon('swords', 16)} Send Challenge`; } return; }

    const questionData = questions.map(q => ({ q: q.q, opts: q.opts, ans: q.ans, exp: q.exp || '', subject: q.subject }));
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
        expiresAt:       null,
      });
      _closeModal();
      window.UI.toast(`Challenge sent to ${targetName}! It will remain open until they respond.`, 'success', 5000);
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
        challenges.push({ id: doc.id, ...doc.data() });
      });
    } catch (e) { window.UI.toast('Could not load challenges.', 'error'); return; }

    if (challenges.length === 0) { window.UI.toast('No pending challenges right now.', 'info'); return; }

    const listHtml = challenges.map(c => {
      const createdAt = c.createdAt && c.createdAt.toDate ? c.createdAt.toDate() : null;
      const sentStr   = createdAt
        ? createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : '—';
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;
                    background:var(--bg-base);border:1px solid var(--border);border-radius:8px;
                    padding:.75rem 1rem;margin-bottom:.5rem;">
          <div>
            <p style="font-size:.9375rem;font-weight:700;color:var(--text-1);">
              ${_icon('swords', 15)} ${_esc(c.challengerName)} challenged you!
            </p>
            <p style="font-size:.8125rem;color:var(--text-3);">
              Subject: ${_esc(c.subject === 'random' ? 'Mixed' : c.subject)}
              &middot; Sent: ${_esc(sentStr)}
            </p>
          </div>
          <div style="display:flex;gap:.375rem;flex-shrink:0;">
            <button onclick="Game._acceptChallenge('${_esc(c.id)}')" class="btn" style="white-space:nowrap;">Accept</button>
            <button onclick="Game._declineChallenge('${_esc(c.id)}')" class="btn bg-gray-500" style="white-space:nowrap;">Decline</button>
          </div>
        </div>`;
    }).join('');

    _showModal(`
      <div style="margin-bottom:1rem;">
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">
          ${_icon('swords', 18)} Pending Challenges
        </h2>
        <p style="font-size:.8125rem;color:var(--text-3);margin-top:.25rem;">
          Accept to play the same quiz and see who scores higher.
          Challenges remain open until you respond.
        </p>
      </div>
      <div>${listHtml}</div>
      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Close</button>
    `);
  }

  async function _declineChallenge(challengeId) {
    try {
      await _db().collection('gameChallenges').doc(challengeId).update({ status: 'declined' });
      _notifiedChallenges.add(challengeId);
      _closeModal();
      window.UI.toast('Challenge declined.', 'info', 3000);
    } catch (e) {
      console.warn('[game] _declineChallenge error:', e);
      window.UI.toast('Could not decline challenge.', 'error');
    }
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
        challenges.push({ id: doc.id, ...doc.data() });
      });
    } catch (e) { window.UI.toast('Could not load challenges.', 'error'); return; }

    if (challenges.length === 0) { window.UI.toast('No challenges waiting for your play.', 'info'); return; }

    const listHtml = challenges.map(c => {
      const createdAt = c.createdAt && c.createdAt.toDate ? c.createdAt.toDate() : null;
      const sentStr   = createdAt
        ? createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : '—';
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;
                    background:var(--bg-base);border:1px solid var(--border);border-radius:8px;
                    padding:.75rem 1rem;margin-bottom:.5rem;">
          <div>
            <p style="font-size:.9375rem;font-weight:700;color:var(--text-1);">
              ${_icon('hourglass', 15)} ${_esc(c.challengedName)} responded!
            </p>
            <p style="font-size:.8125rem;color:var(--text-3);">
              Subject: ${_esc(c.subject === 'random' ? 'Mixed' : c.subject)}
              &middot; Sent: ${_esc(sentStr)}
            </p>
          </div>
          <button onclick="Game._playChallengerTurn('${_esc(c.id)}')"
                  class="btn" style="white-space:nowrap;flex-shrink:0;background:var(--danger);color:#fff;">
            Play Now
          </button>
        </div>`;
    }).join('');

    _showModal(`
      <div style="margin-bottom:1rem;">
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">
          ${_icon('hourglass', 18)} Your Turn to Play
        </h2>
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
    } catch (e) { window.UI.toast('Could not load challenge.', 'error'); return; }
    if (challengeData.challengerScore !== null && challengeData.challengerScore !== undefined) { window.UI.toast("You've already played this challenge.", 'info'); return; }
    _gameState = { type: 'challenge', challengeId, isChallengerTurn: true, questions: challengeData.questions || [], currentIndex: 0, answers: [], score: 0, xpEarned: 0, opponentName: challengeData.challengedName, opponentScore: challengeData.challengedScore, startedAt: Date.now(), _sessionId: null };
    _startGameSession('challenge', { opponentName: challengeData.challengerName || challengeData.challengedName }).then(id => {
      if (_gameState && _gameState.type === 'challenge') _gameState._sessionId = id;
    });
    _renderChallengeQuestion();
  }

  async function _acceptChallenge(challengeId) {
    _closeModal();
    _dismissChallengePopup(challengeId);
    let challengeData;
    try {
      const snap = await _db().collection('gameChallenges').doc(challengeId).get();
      if (!snap.exists) { window.UI.toast('Challenge no longer available.', 'error'); return; }
      challengeData = { id: snap.id, ...snap.data() };
    } catch (e) { window.UI.toast('Could not load challenge.', 'error'); return; }
    if (challengeData.challengedScore !== null && challengeData.challengedScore !== undefined) { window.UI.toast("You've already played this challenge.", 'info'); return; }
    _gameState = { type: 'challenge', challengeId, isChallengerTurn: false, questions: challengeData.questions || [], currentIndex: 0, answers: [], score: 0, xpEarned: 0, opponentName: challengeData.challengerName, opponentScore: challengeData.challengerScore, startedAt: Date.now(), _sessionId: null };
    _startGameSession('challenge', { opponentName: challengeData.challengerName || challengeData.challengedName }).then(id => {
      if (_gameState && _gameState.type === 'challenge') _gameState._sessionId = id;
    });
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
          <div class="game-progress-track"><div class="game-progress-fill" style="width:${pctWidth}%;background:var(--danger);"></div></div>
        </div>

        <div class="glass" style="padding:1.25rem 1.5rem;margin:.75rem 0;">
          <p style="font-size:1.0625rem;font-weight:500;line-height:1.65;margin-bottom:1.25rem;">
            ${_safeQ(q.q)}
          </p>
          <div id="challengeOptions">
            ${q.opts.map((opt, idx) => `
              <button class="game-option-btn" id="chOpt${idx}" onclick="Game._answerChallenge(${idx})">
                <span class="game-option-btn__letter">${String.fromCharCode(65 + idx)}</span>
                <span>${_safeQ(opt)}</span>
              </button>`).join('')}
          </div>
        </div>

        <div style="text-align:center;">
          <button onclick="Game._abandonGame()" class="btn bg-gray-500" style="font-size:.8125rem;display:inline-flex;align-items:center;gap:.3rem;">
            ${_icon('x', 13)} Quit
          </button>
        </div>
      </div>`);

    _renderKatex();
    _timerEl = document.getElementById('challengeTimer');
    _startTimer(QUIZ_BLITZ_TIME,
      (s) => { if (_timerEl) { _timerEl.textContent = s; _timerEl.className = 'game-timer ' + (s <= 5 ? 'timer-red' : s <= 10 ? 'timer-yellow' : 'timer-green'); } },
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
    const total             = gs.questions.length;
    const myScore           = gs.score;
    const myPct             = Math.round((myScore / total) * 100);
    const opponentScore     = gs.opponentScore;
    const isChallengerTurn  = gs.isChallengerTurn;
    let win = false, challengeWin = false;
    if (opponentScore !== null && opponentScore !== undefined) {
      win          = myScore > opponentScore;
      challengeWin = win;
      if (win) gs.xpEarned += XP_CHALLENGE_WIN;
    }

    try {
      const updatePayload = {
        [`result_${_uid()}`]: {
          score: myScore,
          pct: myPct,
          completedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
      };

      if (isChallengerTurn) {
        // Challenger just played — game is now complete
        updatePayload.challengerScore = myScore;
        updatePayload.status = 'completed';

        // Determine winner and write final result fields so the challenged
        // player can read them when they check back
        const theirScore = opponentScore; // challenged player's score
        const challengerWon  = myScore > theirScore;
        const challengedWon  = theirScore > myScore;
        const tied           = myScore === theirScore;

        updatePayload.finalChallengerScore = myScore;
        updatePayload.finalChallengedScore = theirScore;
        updatePayload.finalWinnerUid = challengerWon
          ? _uid()
          : challengedWon
            ? gs.challengedUid || null
            : null;
        updatePayload.finalTied = tied;

      } else {
        // Challenged player just played
        updatePayload.challengedScore = myScore;
        updatePayload.challengedUid   = _uid();

        const challengerAlreadyPlayed =
          opponentScore !== null && opponentScore !== undefined;

        if (challengerAlreadyPlayed) {
          // Challenger already played before us — resolve now
          updatePayload.status = 'completed';
          const challengerWon = opponentScore > myScore;
          const challengedWon = myScore > opponentScore;
          const tied          = myScore === opponentScore;

          updatePayload.finalChallengerScore = opponentScore;
          updatePayload.finalChallengedScore = myScore;
          updatePayload.finalWinnerUid = challengedWon
            ? _uid()
            : challengerWon
              ? null   // we don't store challenger UID here but null signals challenger won
              : null;
          updatePayload.finalTied = tied;
        } else {
          // Challenger hasn't played yet — wait for them
          updatePayload.status = 'awaiting_challenger';
        }
      }

      await _db().collection('gameChallenges').doc(gs.challengeId).update(updatePayload);
    } catch (e) {
      console.warn('[game] _finishChallenge update error:', e);
    }

    await _endGameSession(gs._sessionId, {
      xpEarned: gs.xpEarned,
      score: myScore,
      pct: myPct,
      win,
      meta: {
        opponentName: gs.opponentName,
        opponentScore,
        challengeId: gs.challengeId,
      },
    });

    const result = await _awardXP(gs.xpEarned, 'challenge', { win, challengeWin });
    await _saveGameResult('challenge', {
      score: myScore,
      total,
      pct: myPct,
      xpEarned: gs.xpEarned,
      challengeId: gs.challengeId,
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
          <div style="margin-bottom:.25rem;">
            ${_icon(win ? 'trophy' : tied ? 'handWaving' : 'xCircle', 32, {
              color: win ? 'var(--success)' : tied ? 'var(--warning)' : 'var(--danger)',
            })}
          </div>
          <p style="font-weight:700;font-size:1rem;margin:.25rem 0;color:var(--text-1);">
            ${win ? 'You Won!' : tied ? "It's a Tie!" : 'You Lost!'}
          </p>
          <p style="font-size:.875rem;color:var(--text-2);">
            You: ${myScore}/${total} (${myPct}%) vs ${_esc(gs.opponentName)}: ${opponentScore}/${total} (${theirPct}%)
          </p>
          ${challengeWin
            ? `<p style="font-size:.875rem;font-weight:700;color:var(--success);">+${XP_CHALLENGE_WIN} bonus XP for winning!</p>`
            : ''}
        </div>`;
    } else {
      // Opponent hasn't played yet — we are the challenged player waiting for challenger
      outcomeHtml = `
        <div style="margin:.75rem 0;padding:.875rem 1rem;border-radius:10px;text-align:center;
                    background:var(--info-subtle);border:1px solid var(--info-border);">
          <div style="margin-bottom:.25rem;">${_icon('hourglass', 32, { color: 'var(--accent)' })}</div>
          <p style="font-weight:700;font-size:1rem;margin:.25rem 0;color:var(--text-1);">
            Waiting for ${_esc(gs.opponentName)}!
          </p>
          <p style="font-size:.875rem;color:var(--text-2);">
            Your score: ${myScore}/${total} (${myPct}%). They'll be notified to play — check back later to see the final result.
          </p>
          <button onclick="Game._watchChallengeResult('${_esc(gs.challengeId)}', '${_esc(gs.opponentName)}', ${total})"
                  class="btn" style="margin-top:.75rem;font-size:.875rem;">
            ${_icon('clock', 14)} Watch for Result
          </button>
        </div>`;
    }

    _renderGameResult({
      gameIcon:      'swords',
      gameName:      'Challenge',
      score:         `${myScore} / ${total}`,
      pct:           myPct,
      xpEarned:      gs.xpEarned,
      perfect:       false,
      win,
      result,
      extras:        [],
      extraHtml:     outcomeHtml,
      onPlayAgainKey: 'challenge',
    });
  }
  
  function _watchChallengeResult(challengeId, opponentName, total) {
    _showModal(`
      <div style="text-align:center;margin-bottom:1.25rem;">
        <div style="margin-bottom:.5rem;">${_icon('hourglass', 40, { color: 'var(--accent)' })}</div>
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">Waiting for Result</h2>
        <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;line-height:1.6;">
          Checking if <strong>${_esc(opponentName)}</strong> has played yet…
        </p>
        <div id="watchResultContent" style="margin-top:1rem;">
          <div style="font-size:.875rem;color:var(--text-3);">Checking…</div>
        </div>
      </div>
      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.75rem;">Close</button>
    `);

    _db().collection('gameChallenges').doc(challengeId).get().then(snap => {
      const el = document.getElementById('watchResultContent');
      if (!el) return;

      if (!snap.exists) {
        el.innerHTML = `<p style="color:var(--danger);font-size:.875rem;">Challenge not found.</p>`;
        return;
      }

      const data = snap.data();

      if (data.status === 'completed' && data.finalChallengerScore !== undefined && data.finalChallengedScore !== undefined) {
        const myUid        = _uid();
        const isChallenged = data.challengedUid === myUid;
        const myScore      = isChallenged ? data.finalChallengedScore : data.finalChallengerScore;
        const oppScore     = isChallenged ? data.finalChallengerScore : data.finalChallengedScore;
        const myPct        = Math.round((myScore / total) * 100);
        const oppPct       = Math.round((oppScore / total) * 100);
        const tied         = data.finalTied;
        const win          = myScore > oppScore;

        el.innerHTML = `
          <div style="padding:.875rem;border-radius:10px;
                      background:${win ? 'var(--success-subtle)' : tied ? 'var(--warning-subtle)' : 'var(--danger-subtle)'};
                      border:2px solid ${win ? 'var(--success-border)' : tied ? 'var(--warning-border)' : 'var(--danger-border)'};
                      text-align:center;">
            <div style="margin-bottom:.5rem;">
              ${_icon(win ? 'trophy' : tied ? 'handWaving' : 'xCircle', 32, {
                color: win ? 'var(--success)' : tied ? 'var(--warning)' : 'var(--danger)',
              })}
            </div>
            <p style="font-size:1rem;font-weight:800;color:var(--text-1);margin:.25rem 0;">
              ${win ? '🏆 You Won!' : tied ? "🤝 It's a Tie!" : '😔 You Lost!'}
            </p>
            <p style="font-size:.875rem;color:var(--text-2);margin-top:.375rem;">
              You: ${myScore}/${total} (${myPct}%) vs ${_esc(opponentName)}: ${oppScore}/${total} (${oppPct}%)
            </p>
          </div>`;
      } else if (data.status === 'awaiting_challenger' || data.status === 'pending') {
        el.innerHTML = `
          <div style="padding:.875rem;border-radius:10px;background:var(--bg-subtle);
                      border:1px solid var(--border);text-align:center;">
            <p style="font-size:.875rem;color:var(--text-2);margin:0;">
              ${_esc(opponentName)} hasn't played yet. Check back later!
            </p>
          </div>`;
      } else {
        el.innerHTML = `
          <div style="padding:.875rem;border-radius:10px;background:var(--bg-subtle);
                      border:1px solid var(--border);text-align:center;">
            <p style="font-size:.875rem;color:var(--text-3);margin:0;">
              Status: ${_esc(data.status || 'unknown')}
            </p>
          </div>`;
      }
    }).catch(e => {
      const el = document.getElementById('watchResultContent');
      if (el) el.innerHTML = `<p style="color:var(--danger);font-size:.875rem;">Could not load result. Please try again.</p>`;
      console.warn('[game] _watchChallengeResult error:', e);
    });
  }

  /* ══════════════════════════════════════════════════════════════
     GAME RESULT SCREEN
  ══════════════════════════════════════════════════════════════ */

  function _renderGameResult({ gameIcon, gameName, score, pct, xpEarned, perfect, win, result, extras, extraHtml, onPlayAgainKey }) {
    _stopTimer();

    const xp          = (_profile && _profile.xp) || 0;
    const level       = result ? result.newLevel : _getLevelForXP(xp);
    const xpPct       = _xpProgressPct(xp);
    const nextLvl     = _getNextLevel(xp);
    const maxed       = _isMaxLevel(xp);
    const gradeColor  = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';

    let levelUpHtml = '';
    if (result && result.newLevel) {
      const prevXP    = xp - (xpEarned || 0);
      const prevLevel = _getLevelForXP(prevXP);
      if (result.newLevel.rank > prevLevel.rank) {
        levelUpHtml = `
          <div style="margin:.75rem 0;padding:1rem;border-radius:10px;text-align:center;
                      background:linear-gradient(135deg,${result.newLevel.color}22,${result.newLevel.color}11);
                      border:2px solid ${result.newLevel.color}55;
                      animation:gameChallengePopIn .4s ease both;">
            ${_icon(result.newLevel.icon, 36, { color: result.newLevel.color })}
            <p style="font-weight:800;font-size:1.125rem;margin:.5rem 0 .25rem;color:${result.newLevel.color};">
              Level Up! You are now ${_esc(result.newLevel.name)}
            </p>
            <p style="font-size:.8125rem;color:var(--text-3);">Rank ${result.newLevel.rank} of ${LEVELS.length}</p>
          </div>`;
      }
    }

    const badgeHtml = result && result.earnedBadges && result.earnedBadges.length > 0
      ? `<div class="game-badges-earned">
           <p style="font-size:.875rem;font-weight:700;color:var(--text-2);margin-bottom:.5rem;">New Badges Earned!</p>
           ${result.earnedBadges.map(bid => { const b = BADGES.find(x => x.id === bid); return b ? `<div class="game-badge-pop">${_icon(b.icon, 16)} <strong>${_esc(b.name)}</strong> — ${_esc(b.desc)}</div>` : ''; }).join('')}
         </div>` : '';

    const extrasHtml = extras && extras.length > 0
      ? extras.map(e => `<div style="display:flex;justify-content:space-between;padding:.375rem 0;border-bottom:1px solid var(--border);font-size:.875rem;"><span style="color:var(--text-3);">${_esc(e.label)}</span><span style="font-weight:600;color:var(--text-1);">${_esc(String(e.value))}</span></div>`).join('')
      : '';

    const playAgainAttrib = onPlayAgainKey ? `onclick="Game._playAgain('${_esc(onPlayAgainKey)}')"` : '';

    window.UI.mount(`
      <div class="max-w-xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">
        <div class="glass game-result-card">
          <div style="text-align:center;margin-bottom:1.5rem;">
            <div style="margin-bottom:.375rem;">${_icon(gameIcon, 48, { color: 'var(--accent)' })}</div>
            <h2 style="font-size:1.25rem;font-weight:700;color:var(--text-1);">${_esc(gameName)} Complete</h2>
          </div>

          <div style="display:flex;align-items:center;justify-content:center;gap:1.5rem;background:var(--bg-subtle);border-radius:10px;padding:1.25rem;margin-bottom:1.25rem;">
            <div style="text-align:center;">
              <div style="font-size:2.5rem;font-weight:800;color:${gradeColor};line-height:1;">${pct}%</div>
              <div style="font-size:.75rem;color:var(--text-3);margin-top:.25rem;">Score</div>
            </div>
            <div style="width:1px;height:40px;background:var(--border);"></div>
            <div style="text-align:center;">
              <div style="font-size:1.5rem;font-weight:700;color:var(--text-1);">${_esc(score)}</div>
              <div style="font-size:.75rem;color:var(--text-3);margin-top:.25rem;">Result</div>
            </div>
            <div style="width:1px;height:40px;background:var(--border);"></div>
            <div style="text-align:center;">
              <div style="font-size:1.5rem;font-weight:700;color:var(--accent);">+${xpEarned}</div>
              <div style="font-size:.75rem;color:var(--text-3);margin-top:.25rem;">XP Earned</div>
            </div>
          </div>

          ${extraHtml || ''}
          ${levelUpHtml}
          ${extrasHtml ? `<div style="margin-bottom:1rem;">${extrasHtml}</div>` : ''}

          <div class="glass-dark" style="padding:.875rem 1rem;border-radius:8px;margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
              <span style="font-size:.875rem;font-weight:700;color:var(--text-2);display:flex;align-items:center;gap:.3rem;">
                ${_icon(level.icon, 14, { color: level.color })} ${_esc(level.name)}
                <span style="font-size:.625rem;background:var(--bg-muted);padding:1px 5px;border-radius:4px;color:var(--text-3);">Rank ${level.rank}</span>
              </span>
              ${!maxed
                ? `<span style="font-size:.75rem;color:var(--text-3);">${xp.toLocaleString()} / ${nextLvl.minXP.toLocaleString()} XP</span>`
                : `<span style="font-size:.75rem;color:#f43f5e;font-weight:800;">✦ MAX LEVEL</span>`}
            </div>
            <div class="game-xp-track"><div class="game-xp-fill" style="width:${xpPct}%;"></div></div>
            ${maxed ? `<p style="font-size:.6875rem;color:var(--text-3);margin-top:.375rem;text-align:center;">Your rank is permanent — you are Absolute.</p>` : ''}
          </div>

          ${perfect ? `<div class="game-perfect-banner">${_icon('sparkle', 16)} Perfect Score! +${XP_PER_PERFECT} bonus XP</div>` : ''}
          ${badgeHtml}

          <div style="display:flex;gap:.625rem;flex-wrap:wrap;justify-content:center;margin-top:1.25rem;">
            <button onclick="Game.openGameLobby()" class="btn bg-gray-500" style="display:inline-flex;align-items:center;gap:.3rem;">${_icon('house', 15)} Back to Games</button>
            <button ${playAgainAttrib} class="btn" style="display:inline-flex;align-items:center;gap:.3rem;">${_icon('play', 15)} Play Again</button>
            <button onclick="Game.openLeaderboard()" class="btn bg-gray-500" style="display:inline-flex;align-items:center;gap:.3rem;">${_icon('trophy', 15)} Leaderboard</button>
            <button onclick="Game._showScrabblePending()" class="btn bg-gray-500" style="display:flex;align-items:center;gap:.375rem;">
            🔤 Scrabble Games
          </button>
          </div>
        </div>
      </div>`);
  }

  function _playAgain(key) {
  if      (key === 'quizBlitz')       _showQuizBlitzSetup();
  else if (key === 'speedMath')       _showSpeedMathSetup();
  else if (key === 'wordScramble')    _showWordScrambleSetup();
  else if (key === 'trueOrFalse')     _showTrueOrFalseSetup();
  else if (key === 'suddenDeath')     _showSuddenDeathSetup();
  else if (key === 'challenge')       _showChallengeSetup();
  else if (key === 'knowledgeRunner') _showKnowledgeRunnerSetup();
  else if (key === 'wordScrabble')    _showScrabbleSetup();      // ← NEW
  else openGameLobby();
}

/* ══════════════════════════════════════════════════════════════
     KNOWLEDGE RUNNER  — Endless runner with subject Q&A
     ─────────────────────────────────────────────────────────────
     The player runs automatically. Questions appear on screen.
     Correct answer tokens float above; wrong answer tokens roll
     on the ground as obstacles. Tap / Space / Click to jump.
     Collect correct = +XP. Hit wrong = stumble (3 lives).
     Game ends when all lives are lost.
  ══════════════════════════════════════════════════════════════ */

  const KR_XP_PER_CORRECT  = 12;
const KR_XP_SPEED_BONUS  = 5;
const KR_LIVES           = 3;
const KR_CANVAS_W        = 360;   // portrait width
const KR_CANVAS_H        = 560;   // portrait height
const KR_LANE_COUNT      = 3;
const KR_LANE_X          = [60, 180, 300];  // centre X of each vertical lane
const KR_PLAYER_Y        = 460;             // player's fixed Y (near bottom)
const KR_GRAVITY         = 0.65;
const KR_JUMP_FORCE      = -14;            // upward impulse (negative Y = up)
const KR_ROLL_DURATION   = 45;
const KR_BASE_SPEED      = 3.5;            // pixels per frame (objects fall down)
const KR_SPEED_INCREMENT = 0.0003;
const KR_PLAYER_W        = 30;             // player hitbox width
const KR_PLAYER_H        = 50;             // player hitbox height (standing)
const KR_PLAYER_H_ROLL   = 24;             // player hitbox height (rolling)
const KR_COIN_SPACING    = 28;             // vertical gap between coins in a row
const KR_INSPECTOR_START = KR_CANVAS_H + 120;  // inspector starts well below

  let _krState     = null;
  let _krAnimFrame = null;
  let _krCanvas    = null;
  let _krCtx       = null;
  let _krLastTime  = 0;
  let _krKeys      = { left: false, right: false, up: false, down: false };
  let _krSwipe     = { startX: 0, startY: 0, active: false };

  // ── Build Q&A pool for runner ──
  function _buildKRPool(subjects) {
    const qBank    = window.questions || {};
    const classKey = (_student().class || '').replace(/\s+/g, '').toLowerCase();
    const pool     = [];

    for (const subj of subjects) {
      const all = (qBank[classKey] || {})[subj] || [];
      for (const q of _shuffleArray(all).slice(0, 30)) {
        if (!q.opts || q.opts.length < 2 || q.ans == null) continue;
        const wrongOpts = q.opts.filter((_, i) => i !== q.ans);
        pool.push({
          question:   q.q,
          correct:    String(q.opts[q.ans]).substring(0, 28),
          wrongs:     wrongOpts.map(w => String(w).substring(0, 28)),
          subject:    subj,
        });
      }
    }
    return _shuffleArray(pool);
  }

  function _showKnowledgeRunnerSetup() {
  const subjects = _getSubjectsForStudent();
  if (subjects.length === 0) {
    window.UI.toast('No subjects found for your class.', 'error');
    return;
  }

  const limited     = _krIsLimitReached();
  const playsLeft   = Math.max(0, KR_MAX_PLAYS - _krGetRecentPlays().length);
  const subjectOptions = subjects.map(s => `<option value="${_esc(s)}">${_esc(s)}</option>`).join('');

  if (limited) {
    // ── BLOCKED: show a locked modal with live countdown ──────
    _showModal(`
      <div style="text-align:center;margin-bottom:1.25rem;">
        <div style="margin-bottom:.5rem;font-size:2.5rem;">🔒</div>
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">Knowledge Surfer — Taking a Break</h2>
        <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;line-height:1.6;">
          You've played <strong>${KR_MAX_PLAYS} times</strong> in the last 8 hours.
          This game is for leisure — come back after a short break!
        </p>
      </div>

      <div style="margin:.75rem 0 1.25rem;padding:1.25rem 1rem;
                  background:linear-gradient(135deg,rgba(239,68,68,0.08),rgba(239,68,68,0.04));
                  border:2px solid rgba(239,68,68,0.25);border-radius:12px;text-align:center;">
        <p style="font-size:.6875rem;font-weight:700;text-transform:uppercase;
                  letter-spacing:.08em;color:var(--text-3);margin-bottom:.5rem;">
          Available again in
        </p>
        <div id="krModalCountdown"
             style="font-size:2.25rem;font-weight:900;color:#ef4444;
                    font-family:var(--font-mono);line-height:1;letter-spacing:.04em;">
          ${_krCooldownLabel()}
        </div>
        <p style="font-size:.75rem;color:var(--text-3);margin-top:.5rem;">
          ${KR_MAX_PLAYS} plays used &middot; resets 8 hours after your first play
        </p>
      </div>

      <div style="margin-bottom:1rem;padding:.75rem 1rem;
                  background:var(--accent-subtle);border:1px solid var(--accent-border);
                  border-radius:8px;text-align:left;font-size:.8125rem;color:var(--text-2);
                  line-height:1.6;">
        While you wait, try <strong>Quiz Blitz</strong>, <strong>True or False Blitz</strong>,
        or <strong>Word Scramble</strong> — they count towards your XP and badges!
      </div>

      <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full">Back to Games</button>
    `);

    // Tick the countdown inside the modal every second
    _krStartCountdownTick(() => document.getElementById('krModalCountdown'));
    return;
  }

  // ── NOT LIMITED: show normal setup ────────────────────────────
  _showModal(`
    <div style="text-align:center;margin-bottom:1.25rem;">
      <div style="margin-bottom:.5rem;font-size:2.5rem;">🏄</div>
      <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">Knowledge Surfer</h2>
      <p style="font-size:.875rem;color:var(--text-3);margin-top:.375rem;">
        Run through 3 lanes! Swipe into the correct answer lane. Dodge wrong answers. 3 lives per run.
      </p>
    </div>
    <div style="margin-bottom:1rem;padding:.75rem 1rem;background:var(--accent-subtle);border:1px solid var(--accent-border);border-radius:8px;text-align:left;font-size:.8125rem;color:var(--text-2);">
      <strong style="display:block;margin-bottom:.375rem;">Controls:</strong>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.375rem .75rem;line-height:1.8;">
        <span>⬅️ / ➡️ Arrow</span><span>Change lane</span>
        <span>⬆️ Swipe Up / Space</span><span>Jump</span>
        <span>⬇️ Swipe Down</span><span>Roll / Slide</span>
        <span>📱 Swipe left/right</span><span>Change lane</span>
      </div>
      <div style="margin-top:.5rem;padding:.375rem .5rem;background:var(--bg-subtle);border-radius:6px;font-size:.75rem;color:var(--text-3);">
        🟡 Gold coins = correct answer lane &mdash; steer into them!<br>
        🚂 Trains / barriers = wrong answers &mdash; dodge or jump over them!
      </div>
    </div>

    <!-- Play limit indicator -->
    <div style="margin-bottom:1rem;padding:.5rem .875rem;
                background:${playsLeft === 1 ? 'rgba(245,158,11,0.10)' : 'var(--bg-subtle)'};
                border:1px solid ${playsLeft === 1 ? 'rgba(245,158,11,0.35)' : 'var(--border)'};
                border-radius:8px;display:flex;align-items:center;justify-content:space-between;
                font-size:.8125rem;">
      <span style="color:var(--text-2);">
        ${_icon(playsLeft === 1 ? 'warning' : 'info', 13, { color: playsLeft === 1 ? '#f59e0b' : 'var(--text-3)' })}
        &nbsp;Leisure plays used today:
        <strong style="color:${playsLeft === 1 ? '#f59e0b' : 'var(--text-1)'};">
          ${_krGetRecentPlays().length} / ${KR_MAX_PLAYS}
        </strong>
      </span>
      <span style="font-size:.75rem;color:var(--text-3);">${playsLeft} left (8hr window)</span>
    </div>

    <div style="margin-bottom:1.25rem;">
      <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-2);margin-bottom:.375rem;">Subject</label>
      <select id="krSubject" style="width:100%;">
        <option value="random">Random Mix (all subjects)</option>
        ${subjectOptions}
      </select>
    </div>
    <button onclick="Game._startKnowledgeRunner()" class="btn btn-lg w-full"
            style="background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;font-weight:800;font-size:1rem;">
      🏄 Start Surfing!
    </button>
    <button onclick="Game._closeModal()" class="btn bg-gray-500 w-full" style="margin-top:.5rem;">Cancel</button>
  `);
}

  function _startKnowledgeRunner() {
  // ── Leisure limit: double-check before launching ──
  if (_krIsLimitReached()) {
    _closeModal();
    _showKnowledgeRunnerSetup(); // shows the locked modal with countdown
    return;
  }

  const subjectSel = document.getElementById('krSubject')?.value || 'random';
  let subjects = subjectSel === 'random' ? _getSubjectsForStudent() : [subjectSel];
  if (subjects.length === 0) { window.UI.toast('No subjects found.', 'error'); return; }

  const pool = _buildKRPool(subjects);
  if (pool.length < 3) { window.UI.toast('Not enough questions for this subject.', 'error'); return; }

  // Record this play session now (after all checks pass)
  _krRecordPlay();

  _closeModal();

  window.UI.mount(`
    <div class="max-w-2xl mx-auto animate-fadeIn" style="padding-bottom:1rem;">
      <div id="krWrapper" style="position:relative;width:100%;max-width:${KR_CANVAS_W}px;margin:0 auto;">

        <!-- HUD bar above canvas -->
        <div id="krHUD" style="display:flex;align-items:center;justify-content:space-between;
                                padding:.5rem .75rem;margin-bottom:.375rem;
                                background:linear-gradient(135deg,#1e293b,#0f172a);
                                border-radius:10px;border:1px solid #334155;">
          <div>
            <div style="font-size:.5rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;">Lives</div>
            <div id="krLives" style="font-size:.9rem;letter-spacing:.05em;line-height:1.2;"></div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:.5rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;">Score</div>
            <div id="krScore" style="font-size:1.5rem;font-weight:900;color:#fbbf24;font-family:var(--font-mono);line-height:1;">0</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:.5rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;">XP / Dist</div>
            <div style="line-height:1.3;">
              <span id="krXP" style="font-size:.8rem;font-weight:700;color:#38bdf8;">0</span>
              <span style="font-size:.65rem;color:#64748b;"> xp · </span>
              <span id="krDistVal" style="font-size:.8rem;font-weight:700;color:#a78bfa;">0</span>
              <span style="font-size:.65rem;color:#64748b;">m</span>
            </div>
          </div>
        </div>

        <!-- Portrait canvas — objects fall from top, player at bottom -->
        <canvas id="krCanvas" width="${KR_CANVAS_W}" height="${KR_CANVAS_H}"
          style="width:100%;border-radius:12px;border:2px solid #334155;
                 display:block;cursor:pointer;touch-action:none;
                 background:#0f172a;">
        </canvas>

        <!-- Current question panel -->
        <div id="krQuestionPanel" style="margin-top:.5rem;padding:.625rem 1rem;
             background:linear-gradient(135deg,#1e293b,#0f172a);
             border:1px solid #334155;border-radius:10px;">
          <div style="font-size:.5rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;
                      color:#94a3b8;margin-bottom:.25rem;">Current Question</div>
          <div id="krQuestion" style="font-size:.875rem;font-weight:600;color:#f1f5f9;
                                       line-height:1.5;min-height:2.25rem;"></div>
        </div>

        <!-- Lane labels: 3 columns matching the 3 canvas lanes -->
        <div id="krLaneLabels" style="margin-top:.375rem;display:grid;grid-template-columns:1fr 1fr 1fr;gap:.375rem;text-align:center;">
          <div id="krLabel0" style="font-size:.6875rem;font-weight:700;padding:.375rem .5rem;
                                     border-radius:6px;background:#1e293b;border:1.5px solid #334155;
                                     color:#94a3b8;min-height:2.5rem;display:flex;align-items:center;
                                     justify-content:center;line-height:1.3;transition:all .2s;"></div>
          <div id="krLabel1" style="font-size:.6875rem;font-weight:700;padding:.375rem .5rem;
                                     border-radius:6px;background:#1e293b;border:1.5px solid #334155;
                                     color:#94a3b8;min-height:2.5rem;display:flex;align-items:center;
                                     justify-content:center;line-height:1.3;transition:all .2s;"></div>
          <div id="krLabel2" style="font-size:.6875rem;font-weight:700;padding:.375rem .5rem;
                                     border-radius:6px;background:#1e293b;border:1.5px solid #334155;
                                     color:#94a3b8;min-height:2.5rem;display:flex;align-items:center;
                                     justify-content:center;line-height:1.3;transition:all .2s;"></div>
        </div>

        <!-- Controls hint -->
        <div style="margin-top:.375rem;font-size:.6rem;color:#475569;text-align:center;line-height:1.8;">
          ← → arrows / swipe left·right to change lane &nbsp;|&nbsp; ↑ / swipe up to jump &nbsp;|&nbsp; ↓ / swipe down to roll
        </div>

        <div style="text-align:center;margin-top:.625rem;">
          <button onclick="Game._krQuit()" class="btn bg-gray-500" style="font-size:.8125rem;">✕ Quit</button>
        </div>
      </div>
    </div>`);

  _krCanvas = document.getElementById('krCanvas');
  _krCtx    = _krCanvas.getContext('2d');

  /* ── Keyboard ── */
  _krKeys = { left: false, right: false, up: false, down: false };
  const _krKeyDown = (e) => {
    if (e.code === 'ArrowLeft')  { e.preventDefault(); if (!_krKeys.left)  { _krKeys.left  = true; _krChangeLane(-1); } }
    if (e.code === 'ArrowRight') { e.preventDefault(); if (!_krKeys.right) { _krKeys.right = true; _krChangeLane(1);  } }
    if (e.code === 'ArrowUp' || e.code === 'Space') { e.preventDefault(); _krJump(); }
    if (e.code === 'ArrowDown') { e.preventDefault(); _krRoll(); }
  };
  const _krKeyUp = (e) => {
    if (e.code === 'ArrowLeft')  _krKeys.left  = false;
    if (e.code === 'ArrowRight') _krKeys.right = false;
  };
  document.addEventListener('keydown', _krKeyDown);
  document.addEventListener('keyup',   _krKeyUp);

  /* ── Touch swipe ── */
  _krCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    _krSwipe = { startX: t.clientX, startY: t.clientY, active: true };
  }, { passive: false });
  _krCanvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (!_krSwipe.active) return;
    const t   = e.changedTouches[0];
    const dx  = t.clientX - _krSwipe.startX;
    const dy  = t.clientY - _krSwipe.startY;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    _krSwipe.active = false;
    if (adx < 10 && ady < 10) { _krJump(); return; }
    if (adx > ady) {
      if (dx < 0) _krChangeLane(-1);
      else         _krChangeLane(1);
    } else {
      if (dy < 0) _krJump();
      else         _krRoll();
    }
  }, { passive: false });

  /* ── Mouse click = jump ── */
  _krCanvas.addEventListener('click', (e) => {
    e.preventDefault();
    if (_krState && _krState.gameOver) { _krRestart(); return; }
    _krJump();
  });

  /* ── Initial game state ── */
  _krState = {
    pool,
    poolIndex:       0,
    lives:           KR_LIVES,
    score:           0,
    xpEarned:        0,
    distance:        0,
    speed:           KR_BASE_SPEED,
    gameOver:        false,
    combo:           0,
    /* Player — x = lane centre, y = near bottom, vy = vertical velocity */
    player: {
      lane:          1,           // 0=left, 1=centre, 2=right
      x:             KR_LANE_X[1],
      y:             KR_PLAYER_Y,
      vy:            0,
      jumping:       false,
      rolling:       false,
      rollTimer:     0,
      invincible:    0,
      stumble:       0,
      frame:         0,
      frameTimer:    0,
      /* smooth horizontal lane slide */
      targetX:       KR_LANE_X[1],
    },
    objects:         [],
    spawnTimer:      80,
    currentQ:        null,
    correctLane:     -1,
    laneOptions:     null,
    /* Scrolling scenery */
    bgOffset:        0,
    particles:       [],
    /* Inspector rises from below */
    inspector: {
      y:    KR_INSPECTOR_START,  // starts far below the canvas
      gap:  220,                 // vertical distance below player
    },
    _keyDown: _krKeyDown,
    _keyUp:   _krKeyUp,
    _sessionId: null
  };
  
  _startGameSession('knowledgeRunner', { subject: subjectSel }).then(id => {
    if (_krState) _krState._sessionId = id;
  });
  _krNextQuestion();
  _krLastTime = performance.now();
  _krLoop(_krLastTime);
}

  function _krJump() {
    if (!_krState) return;
    if (_krState.gameOver) { _krRestart(); return; }
    const p = _krState.player;
    if (!p.jumping && !p.rolling) {
      p.vy      = KR_JUMP_FORCE;
      p.jumping = true;
      // Dust particles
      for (let i = 0; i < 8; i++) {
        _krState.particles.push({
          x: p.x + 10, y: p.y + 30,
          vx: (Math.random() - 0.5) * 3,
          vy: -(Math.random() * 2 + 0.5),
          life: 18, maxLife: 18, color: '#fbbf24', size: 3,
        });
      }
    }
  }
  
  function _krRoll() {
    if (!_krState) return;
    const p = _krState.player;
    if (!p.jumping && !p.rolling) {
      p.rolling   = true;
      p.rollTimer = KR_ROLL_DURATION;
    }
  }

  function _krChangeLane(dir) {
    if (!_krState || _krState.gameOver) return;
    const p       = _krState.player;
    const newLane = Math.max(0, Math.min(KR_LANE_COUNT - 1, p.lane + dir));
    if (newLane === p.lane) return;
    p.lane       = newLane;
    p.targetLane = newLane;
    // Brief lane-change particles
    for (let i = 0; i < 5; i++) {
      _krState.particles.push({
        x: p.x + 10, y: p.y,
        vx: dir * (Math.random() * 3 + 1),
        vy: (Math.random() - 0.5) * 2,
        life: 14, maxLife: 14, color: '#38bdf8', size: 2,
      });
    }
  }

  function _krNextQuestion() {
  const s = _krState;
  if (s.poolIndex >= s.pool.length) {
    s.pool      = _shuffleArray(s.pool);
    s.poolIndex = 0;
  }
  s.currentQ    = s.pool[s.poolIndex++];
  s.correctLane = Math.floor(Math.random() * KR_LANE_COUNT);

  const qEl = document.getElementById('krQuestion');
  if (qEl) {
    const subj = s.currentQ.subject ? `[${s.currentQ.subject}] ` : '';
    qEl.textContent = subj + s.currentQ.question.substring(0, 130);
  }

  const wrongs  = _shuffleArray(s.currentQ.wrongs);
  const options = [];
  let wrongIdx  = 0;
  for (let lane = 0; lane < KR_LANE_COUNT; lane++) {
    if (lane === s.correctLane) {
      options.push({ text: s.currentQ.correct, isCorrect: true });
    } else {
      options.push({ text: (wrongs[wrongIdx] || 'Wrong'), isCorrect: false });
      wrongIdx++;
    }
  }
  s.laneOptions = options;

  for (let lane = 0; lane < KR_LANE_COUNT; lane++) {
    const el  = document.getElementById('krLabel' + lane);
    if (!el) continue;
    const opt = options[lane];
    el.style.background  = opt.isCorrect ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.10)';
    el.style.borderColor = opt.isCorrect ? '#fbbf24'               : '#ef4444';
    el.style.color       = opt.isCorrect ? '#fbbf24'               : '#f87171';
    el.style.fontWeight  = '700';
    el.textContent       = opt.text.substring(0, 36);
  }

  s.spawnTimer = 90;
}

  function _krSpawnWave() {
  const s = _krState;
  if (!s.currentQ || !s.laneOptions) return;

  for (let lane = 0; lane < KR_LANE_COUNT; lane++) {
    const opt  = s.laneOptions[lane];
    const cx   = KR_LANE_X[lane]; // centre X of this vertical lane
    const baseY = -60 - lane * 20; // slight vertical stagger per lane

    if (opt.isCorrect) {
      /* 5 coins stacked vertically (they'll fall as a column) */
      for (let c = 0; c < 5; c++) {
        s.objects.push({
          type:      'coin',
          lane,
          x:         cx,
          y:         baseY - c * KR_COIN_SPACING,  // stacked above each other
          w:         18,
          h:         18,
          hit:       false,
          bobPhase:  Math.random() * Math.PI * 2,
          isCorrect: true,
        });
      }
    } else {
      const kind = Math.random() < 0.55 ? 'train' : 'barrier';
      s.objects.push({
        type:      'obstacle',
        kind,
        lane,
        x:         cx,
        y:         baseY,
        w:         kind === 'train' ? 52 : 44,
        h:         kind === 'train' ? 60 : 22,
        hit:       false,
        isCorrect: false,
        label:     opt.text.substring(0, 22),
      });
    }
  }

  s.spawnTimer = 170 + Math.floor(Math.random() * 60);
}

  function _krLoop(timestamp) {
  if (!_krState || _krState.gameOver) return;
  _krAnimFrame = requestAnimationFrame(_krLoop);

  const dt = Math.min(timestamp - _krLastTime, 50);
  _krLastTime = timestamp;
  const s  = _krState;
  const p  = s.player;

  /* ── Speed & distance ── */
  s.speed    = KR_BASE_SPEED + s.distance * KR_SPEED_INCREMENT;
  s.distance += s.speed * 0.022;

  /* ── Background scroll (downward) ── */
  s.bgOffset = (s.bgOffset + s.speed) % 80;

  /* ── Smooth horizontal lane slide ── */
  const targetX = KR_LANE_X[p.lane];
  p.x += (targetX - p.x) * 0.18;

  /* ── Vertical jump physics ──
       Jump moves player UP (y decreases). Gravity pulls y back to KR_PLAYER_Y. */
  if (p.jumping) {
    p.vy += KR_GRAVITY;
    p.y  += p.vy;
    if (p.y >= KR_PLAYER_Y) {
      p.y       = KR_PLAYER_Y;
      p.vy      = 0;
      p.jumping = false;
    }
  } else {
    p.y = KR_PLAYER_Y;
  }

  /* ── Roll timer ── */
  if (p.rolling) {
    p.rollTimer--;
    if (p.rollTimer <= 0) p.rolling = false;
  }

  /* ── Invincibility / stumble countdown ── */
  if (p.invincible > 0) p.invincible--;
  if (p.stumble    > 0) p.stumble--;

  /* ── Running frame animation ── */
  p.frameTimer++;
  if (p.frameTimer > 5) { p.frame = (p.frame + 1) % 6; p.frameTimer = 0; }

  /* ── Inspector: rises from below (y decreases) when gap closes ──
       Normal: gap grows slightly (player pulling away).
       Stumble: gap shrinks fast (inspector catches up). */
  if (p.stumble > 0) {
    s.inspector.gap = Math.max(60, s.inspector.gap - 1.2);
  } else {
    s.inspector.gap = Math.min(260, s.inspector.gap + 0.12);
  }
  s.inspector.y = KR_PLAYER_Y + s.inspector.gap;

  /* ── Move objects downward ── */
  s.objects.forEach(o => { o.y += s.speed; });
  /* Remove objects that have fallen off the bottom */
  s.objects = s.objects.filter(o => !o.hit && o.y < KR_CANVAS_H + 100);

  /* ── Spawn timer ── */
  s.spawnTimer--;
  if (s.spawnTimer <= 0) _krSpawnWave();

  /* ── Collision detection ──
       Player hitbox: centred on p.x, top = p.y - height, bottom = p.y */
  if (p.invincible === 0) {
    const ph = p.rolling ? KR_PLAYER_H_ROLL : KR_PLAYER_H;
    const pLeft   = p.x - KR_PLAYER_W / 2;
    const pRight  = p.x + KR_PLAYER_W / 2;
    const pTop    = p.y - (p.jumping ? KR_PLAYER_H : ph);
    const pBottom = p.y;

    s.objects.forEach(obj => {
      if (obj.hit) return;
      if (obj.lane !== p.lane) return; // different column — safe

      let oLeft, oRight, oTop, oBottom;

      if (obj.type === 'coin') {
        oLeft   = obj.x - obj.w / 2;
        oRight  = obj.x + obj.w / 2;
        oTop    = obj.y - obj.h / 2;
        oBottom = obj.y + obj.h / 2;
      } else {
        /* Obstacles: centred on obj.x, height extends UPWARD from obj.y */
        oLeft   = obj.x - obj.w / 2;
        oRight  = obj.x + obj.w / 2;
        oTop    = obj.y - obj.h;
        oBottom = obj.y;
      }

      const hit = pLeft < oRight && pRight > oLeft && pTop < oBottom && pBottom > oTop;
      if (!hit) return;

      obj.hit = true;

      if (obj.type === 'coin') {
        /* ── Correct coin collected ── */
        s.score++;
        s.combo++;
        const xp = KR_XP_PER_CORRECT + (s.combo >= 3 ? KR_XP_SPEED_BONUS : 0);
        s.xpEarned += xp;
        /* Gold burst particles */
        for (let i = 0; i < 14; i++) {
          s.particles.push({
            x: obj.x, y: obj.y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 28, maxLife: 28, color: '#fbbf24', size: 4,
          });
        }
        /* All correct coins collected → advance to next question */
        const coinsLeft = s.objects.filter(o => !o.hit && o.type === 'coin');
        if (coinsLeft.length === 0) _krNextQuestion();

      } else {
        /* ── Obstacle collision ──
             Barrier (low): player can ROLL under it.
             Train  (tall): player can JUMP over it. */
        if (obj.kind === 'barrier' && p.rolling)                           { obj.hit = true; return; }
        if (obj.kind === 'train'   && p.jumping && p.y < oTop + 10)       { obj.hit = true; return; }

        /* HIT */
        s.combo = 0;
        s.lives--;
        p.invincible = 110;
        p.stumble    = 55;
        s.inspector.gap = Math.max(60, s.inspector.gap - 45);

        for (let i = 0; i < 12; i++) {
          s.particles.push({
            x: p.x, y: p.y - 20,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 26, maxLife: 26, color: '#ef4444', size: 4,
          });
        }

        if (s.lives <= 0) {
          s.gameOver = true;
          _krEndGame();
        }
      }
    });
  }

  /* ── Particles ── */
  s.particles.forEach(pt => {
    pt.x  += pt.vx;
    pt.y  += pt.vy;
    pt.vy += 0.15;
    pt.life--;
  });
  s.particles = s.particles.filter(pt => pt.life > 0);

  /* ── HUD update ── */
  const livesEl = document.getElementById('krLives');
  const scoreEl = document.getElementById('krScore');
  const xpEl    = document.getElementById('krXP');
  const distEl  = document.getElementById('krDistVal');
  if (livesEl) livesEl.textContent = '❤️'.repeat(Math.max(0, s.lives)) + '🖤'.repeat(Math.max(0, KR_LIVES - s.lives));
  if (scoreEl) scoreEl.textContent = s.score;
  if (xpEl)    xpEl.textContent    = s.xpEarned;
  if (distEl)  distEl.textContent  = Math.floor(s.distance);

  _krDraw(timestamp);
}

  function _krDraw(timestamp) {
  const ctx = _krCtx;
  const s   = _krState;
  const p   = s.player;
  const W   = KR_CANVAS_W;
  const H   = KR_CANVAS_H;

  /* ── Background (deep tunnel, vertical perspective) ── */
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0,    '#060d1a');
  bgGrad.addColorStop(0.55, '#0f172a');
  bgGrad.addColorStop(1,    '#1e293b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  /* ── Tunnel vanishing-point rings ── (top = vanishing point) */
  const VP = { x: W / 2, y: 40 };
  for (let ring = 0; ring < 9; ring++) {
    const t     = ((ring / 9) + (s.bgOffset / 80)) % 1;
    const scale = 0.08 + t * 0.92;
    const rw    = W * 0.5 * scale;
    const rh    = H * 0.48 * scale;
    const cy    = VP.y + (H - VP.y) * scale;
    const alpha = t * 0.4;
    ctx.strokeStyle = `rgba(56,189,248,${alpha})`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.ellipse(VP.x, cy, rw, rh * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* ── Overhead lights scrolling downward ── */
  const lightSpacing = 110;
  const lightCount   = Math.ceil(H / lightSpacing) + 2;
  const lightOff     = s.bgOffset % lightSpacing;
  for (let i = 0; i < lightCount; i++) {
    const ly   = i * lightSpacing - lightOff;
    const glow = ctx.createRadialGradient(W / 2, ly, 0, W / 2, ly, 30);
    glow.addColorStop(0, 'rgba(251,191,36,0.45)');
    glow.addColorStop(1, 'rgba(251,191,36,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(W / 2 - 30, ly - 10, 60, 40);
    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.ellipse(W / 2, ly, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ── 3 vertical lane tracks ──
       Each lane is a vertical strip with two rails running top-to-bottom. */
  const laneColors  = ['#6366f1', '#22c55e', '#f59e0b'];
  const laneNames   = ['LEFT', 'CENTRE', 'RIGHT'];
  const laneWidth   = W / KR_LANE_COUNT;  // 120 px per lane

  for (let lane = 0; lane < KR_LANE_COUNT; lane++) {
    const cx       = KR_LANE_X[lane];
    const isActive = lane === p.lane;
    const lx       = lane * laneWidth;

    /* Lane background glow for active lane */
    if (isActive) {
      const laneGlow = ctx.createLinearGradient(lx, 0, lx + laneWidth, 0);
      laneGlow.addColorStop(0,   'rgba(0,0,0,0)');
      laneGlow.addColorStop(0.5, laneColors[lane] + '18');
      laneGlow.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = laneGlow;
      ctx.fillRect(lx, 0, laneWidth, H);
    }

    /* Vertical divider lines between lanes */
    if (lane > 0) {
      ctx.strokeStyle = 'rgba(51,65,85,0.7)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, H);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    /* Left and right rail lines for this lane */
    const railAlpha = isActive ? 0.85 : 0.3;
    const railL     = cx - 18;
    const railR     = cx + 18;

    ctx.strokeStyle = `rgba(148,163,184,${railAlpha})`;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(railL, 0);
    ctx.lineTo(railL, H);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(railR, 0);
    ctx.lineTo(railR, H);
    ctx.stroke();

    /* Rail cross-ties (horizontal, scrolling downward) */
    const tieSpacing = 30;
    const tieCount   = Math.ceil(H / tieSpacing) + 2;
    const tieOff     = s.bgOffset % tieSpacing;
    ctx.fillStyle    = `rgba(51,65,85,${isActive ? 0.8 : 0.4})`;
    for (let t = 0; t < tieCount; t++) {
      const ty = t * tieSpacing - tieOff;
      ctx.fillRect(railL - 2, ty, railR - railL + 4, 5);
    }

    /* Lane name label near the top (subtle) */
    ctx.fillStyle    = isActive ? laneColors[lane] + 'bb' : '#1e293b99';
    ctx.font         = 'bold 8px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(laneNames[lane], cx, 8);
  }

  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';

  /* ── Objects (coins & obstacles) ──
       All objects fall downward. Coins appear as gold circles.
       Trains (tall) and barriers (low) appear as obstacles. */
  s.objects.forEach(obj => {
    if (obj.hit) return;
    const cx = KR_LANE_X[obj.lane];

    if (obj.type === 'coin') {
      const bob = Math.sin(timestamp / 300 + obj.bobPhase) * 2;
      const ox  = cx;
      const oy  = obj.y + bob;

      /* Outer glow */
      const coinGlow = ctx.createRadialGradient(ox, oy, 0, ox, oy, 16);
      coinGlow.addColorStop(0, 'rgba(251,191,36,0.5)');
      coinGlow.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.fillStyle = coinGlow;
      ctx.beginPath();
      ctx.arc(ox, oy, 16, 0, Math.PI * 2);
      ctx.fill();

      /* Coin body */
      const coinBody = ctx.createRadialGradient(ox - 2, oy - 2, 1, ox, oy, 9);
      coinBody.addColorStop(0, '#fef3c7');
      coinBody.addColorStop(0.5, '#fbbf24');
      coinBody.addColorStop(1, '#b45309');
      ctx.fillStyle = coinBody;
      ctx.beginPath();
      ctx.arc(ox, oy, 9, 0, Math.PI * 2);
      ctx.fill();

      /* Rim */
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(ox, oy, 9, 0, Math.PI * 2);
      ctx.stroke();

      /* Check mark */
      ctx.fillStyle    = '#92400e';
      ctx.font         = 'bold 8px sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', ox, oy);

    } else {
      /* ── Obstacles — centred on lane X, bottom at obj.y ── */
      const ow = obj.w;
      const oh = obj.h;
      const ox = cx - ow / 2;
      const oy = obj.y - oh;       // top of obstacle

      if (obj.kind === 'train') {
        /* ── TRAIN (tall — jump over it) ── */
        /* Shadow */
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(ox + 4, oy + 4, ow, oh);

        /* Body gradient */
        const trainGrad = ctx.createLinearGradient(ox, oy, ox + ow, oy);
        trainGrad.addColorStop(0, '#991b1b');
        trainGrad.addColorStop(0.35, '#ef4444');
        trainGrad.addColorStop(0.65, '#dc2626');
        trainGrad.addColorStop(1, '#7f1d1d');
        ctx.fillStyle = trainGrad;
        _krRoundRect(ctx, ox, oy, ow, oh, 6);
        ctx.fill();

        /* Windows */
        ctx.fillStyle = 'rgba(186,230,253,0.85)';
        _krRoundRect(ctx, ox + 5, oy + 8, 16, 10, 3); ctx.fill();
        _krRoundRect(ctx, ox + ow - 21, oy + 8, 16, 10, 3); ctx.fill();

        /* Window reflection */
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(ox + 6, oy + 9, 4, 3);
        ctx.fillRect(ox + ow - 20, oy + 9, 4, 3);

        /* Bottom strip "WRONG" */
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(ox, oy + oh - 14, ow, 14);
        ctx.fillStyle    = '#fca5a5';
        ctx.font         = 'bold 7px sans-serif';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✗ WRONG', cx, oy + oh - 7);

        /* ↑ JUMP label above */
        ctx.fillStyle = '#ef4444';
        ctx.font      = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('↑ JUMP', cx, oy - 4);

        /* Answer label */
        const lbl = obj.label.length > 14 ? obj.label.substring(0, 12) + '…' : obj.label;
        ctx.fillStyle = 'rgba(15,23,42,0.8)';
        const lw = Math.max(50, lbl.length * 5 + 10);
        _krRoundRect(ctx, cx - lw / 2, oy - 28, lw, 15, 3); ctx.fill();
        ctx.fillStyle    = '#f87171';
        ctx.font         = 'bold 8px sans-serif';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lbl, cx, oy - 20);

        /* Border */
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth   = 1.5;
        _krRoundRect(ctx, ox, oy, ow, oh, 6);
        ctx.stroke();

      } else {
        /* ── BARRIER (low — roll/slide under it) ── */
        /* Shadow */
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(ox + 3, oy + 3, ow, oh);

        /* Yellow/black striped barrier */
        const barGrad = ctx.createLinearGradient(ox, oy, ox, oy + oh);
        barGrad.addColorStop(0, '#fbbf24');
        barGrad.addColorStop(0.5, '#f59e0b');
        barGrad.addColorStop(1, '#fbbf24');
        ctx.fillStyle = barGrad;
        _krRoundRect(ctx, ox, oy, ow, oh, 4); ctx.fill();

        /* Black warning stripes */
        ctx.save();
        ctx.beginPath();
        _krRoundRect(ctx, ox, oy, ow, oh, 4);
        ctx.clip();
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        for (let stripe = 0; stripe < 8; stripe++) {
          ctx.fillRect(ox - 4 + stripe * 7, oy, 3.5, oh);
        }
        ctx.restore();

        /* Border */
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth   = 1.5;
        _krRoundRect(ctx, ox, oy, ow, oh, 4);
        ctx.stroke();

        /* ↓ ROLL hint */
        ctx.fillStyle    = '#78350f';
        ctx.font         = 'bold 7px sans-serif';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↓ ROLL', cx, oy + oh / 2);

        /* Answer label above */
        const lbl2 = obj.label.length > 14 ? obj.label.substring(0, 12) + '…' : obj.label;
        ctx.fillStyle = 'rgba(15,23,42,0.8)';
        const lw2 = Math.max(48, lbl2.length * 5 + 10);
        _krRoundRect(ctx, cx - lw2 / 2, oy - 22, lw2, 15, 3); ctx.fill();
        ctx.fillStyle    = '#fbbf24';
        ctx.font         = 'bold 8px sans-serif';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lbl2, cx, oy - 14);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth   = 1;
        _krRoundRect(ctx, cx - lw2 / 2, oy - 22, lw2, 15, 3);
        ctx.stroke();
      }
    }
  });

  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';

  /* ── Particles ── */
  s.particles.forEach(pt => {
    const alpha = pt.life / pt.maxLife;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * alpha, 0, Math.PI * 2);
    ctx.fillStyle = pt.color;
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  /* ── Inspector (rises from bottom of canvas) ── */
  _krDrawInspector(ctx, s, timestamp);

  /* ── Player (at bottom of canvas) ── */
  _krDrawPlayer(ctx, p, timestamp);

  /* ── Speed indicator (left edge bar, fills upward as speed increases) ── */
  const speedPct = Math.min((s.speed - KR_BASE_SPEED) / 5, 1);
  const barH     = H * speedPct;
  ctx.fillStyle  = '#38bdf844';
  ctx.fillRect(0, H - barH, 3, barH);
  ctx.fillStyle  = '#38bdf8';
  ctx.fillRect(0, H - barH, 3, 3);

  /* ── Combo display (top-right) ── */
  if (s.combo >= 3) {
    ctx.save();
    const comboAlpha = Math.min(1, s.combo / 10);
    ctx.fillStyle    = `rgba(251,191,36,${comboAlpha})`;
    ctx.font         = `bold ${Math.min(18, 10 + s.combo)}px sans-serif`;
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`🔥 x${s.combo}`, W - 8, 6);
    ctx.restore();
  }

  /* ── Stumble flash overlay ── */
  if (p.stumble > 0 && p.stumble % 6 < 3) {
    ctx.fillStyle = 'rgba(239,68,68,0.1)';
    ctx.fillRect(0, 0, W, H);
  }

  /* ── Inspector-close warning (top strip) ── */
  if (s.inspector.gap < 150) {
    const warnAlpha = Math.sin(timestamp / 100) * 0.5 + 0.5;
    ctx.save();
    ctx.globalAlpha  = warnAlpha * 0.85;
    ctx.fillStyle    = '#ef4444';
    ctx.font         = 'bold 9px sans-serif';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('⚠ INSPECTOR CLOSE!', 8, 6);
    ctx.restore();
  }

  /* ── Game over overlay ── */
  if (s.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#ef4444';
    ctx.font         = 'bold 28px sans-serif';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 28);

    ctx.fillStyle = '#fbbf24';
    ctx.font      = 'bold 18px sans-serif';
    ctx.fillText(`Score: ${s.score}`, W / 2, H / 2 + 4);

    ctx.fillStyle = '#94a3b8';
    ctx.font      = '12px sans-serif';
    ctx.fillText('Tap or ↑ to play again', W / 2, H / 2 + 28);

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

  function _krDrawPlayer(ctx, p, timestamp) {
  const x          = p.x;
  const y          = p.y;        // foot position
  const stumbling  = p.stumble    > 0;
  const rolling    = p.rolling;
  const invincible = p.invincible > 0;
  const alpha      = invincible ? (Math.sin(timestamp / 65) > 0 ? 0.3 : 1) : 1;

  ctx.globalAlpha = alpha;
  ctx.save();
  ctx.translate(x, y);

  /* ── Shadow on ground ── */
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0, rolling ? 18 : 12, rolling ? 6 : 4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (rolling) {
    /* ── ROLL: player is a flat spinning disc seen from above ── */
    ctx.save();
    ctx.rotate(timestamp / 150);    // spinning animation
    /* Body disc */
    ctx.fillStyle = '#4f46e5';
    ctx.beginPath();
    ctx.ellipse(0, -8, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    /* Face on disc */
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, -10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* Speed streak lines */
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(99,102,241,${0.55 - i * 0.15})`;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(-6 - i * 8, 4 + i * 3);
      ctx.lineTo(6  + i * 8, 4 + i * 3);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }

  /* ── Standing / jumping: seen from behind (3/4 top-down view) ── */
  const legPhase  = (p.frame / 6) * Math.PI * 2;
  const leg1      = Math.sin(legPhase)  * (stumbling ? 8 : 5);
  const leg2      = -Math.sin(legPhase) * (stumbling ? 8 : 5);
  const bodyBob   = p.jumping ? 0 : Math.abs(Math.sin(legPhase)) * 1.5;
  const bodyTilt  = stumbling ? Math.sin(timestamp / 80) * 12 : (p.jumping ? -5 : 0);

  ctx.rotate((bodyTilt * Math.PI) / 180);
  ctx.translate(0, -bodyBob);

  /* ── Legs (visible at bottom, moving outward/inward as player runs) ── */
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth   = 7;
  ctx.lineCap     = 'round';
  /* Left leg */
  ctx.beginPath();
  ctx.moveTo(-6, -5);
  ctx.lineTo(-8 + leg1, 14);
  ctx.stroke();
  /* Right leg */
  ctx.beginPath();
  ctx.moveTo(6, -5);
  ctx.lineTo(8 + leg2, 14);
  ctx.stroke();

  /* ── Shoes ── */
  ctx.fillStyle = '#0f172a';
  ctx.beginPath(); ctx.ellipse(-8 + leg1, 16, 7, 4, 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(8  + leg2, 16, 7, 4, -0.15, 0, Math.PI * 2); ctx.fill();
  /* Shoe stripe */
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-13 + leg1, 15, 9, 2);
  ctx.fillRect(3   + leg2, 15, 9, 2);

  /* ── Backpack (visible from behind) ── */
  ctx.fillStyle = '#7c3aed';
  _krRoundRect(ctx, -8, -40, 16, 22, 4);
  ctx.fill();
  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth   = 1;
  _krRoundRect(ctx, -8, -40, 16, 22, 4);
  ctx.stroke();
  /* Backpack pocket */
  ctx.fillStyle = '#6d28d9';
  _krRoundRect(ctx, -5, -33, 10, 9, 2);
  ctx.fill();

  /* ── Body / jacket (seen from behind) ── */
  ctx.fillStyle = stumbling ? '#dc2626' : '#4f46e5';
  _krRoundRect(ctx, -10, -18, 20, 22, 5);
  ctx.fill();
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth   = 1;
  _krRoundRect(ctx, -10, -18, 20, 22, 5);
  ctx.stroke();
  /* Jacket collar */
  ctx.fillStyle = '#818cf8';
  ctx.beginPath();
  ctx.moveTo(-4, -18);
  ctx.lineTo(0, -14);
  ctx.lineTo(4, -18);
  ctx.closePath();
  ctx.fill();

  /* ── Arms (swinging as player runs) ── */
  const arm1 = -Math.sin(legPhase) * 8;
  const arm2 =  Math.sin(legPhase) * 8;
  ctx.strokeStyle = '#4f46e5';
  ctx.lineWidth   = 5;
  ctx.lineCap     = 'round';
  ctx.beginPath(); ctx.moveTo(-9, -14); ctx.lineTo(-14 + arm1, -2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(9,  -14); ctx.lineTo(14  + arm2, -2); ctx.stroke();
  /* Hands */
  ctx.fillStyle = '#fde68a';
  ctx.beginPath(); ctx.arc(-14 + arm1, -1, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(14  + arm2, -1, 3.5, 0, Math.PI * 2); ctx.fill();

  /* ── Head (seen from behind) ── */
  /* Neck */
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(-3.5, -26, 7, 9);
  /* Head shape */
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(0, -34, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth   = 1;
  ctx.stroke();

  /* ── Cap / hair seen from behind ── */
  ctx.fillStyle = stumbling ? '#dc2626' : '#4f46e5';
  ctx.beginPath();
  ctx.ellipse(0, -34, 13, 8, 0, 0, Math.PI);   // top of head
  ctx.fill();
  /* Cap brim at the back (just a strip) */
  ctx.fillStyle = stumbling ? '#991b1b' : '#312e81';
  ctx.fillRect(-13, -30, 26, 4);

  /* ── Ear details ── */
  ctx.fillStyle = '#fde68a';
  ctx.beginPath(); ctx.ellipse(-12, -34, 3, 4.5, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(12,  -34, 3, 4.5, -0.3, 0, Math.PI * 2); ctx.fill();

  /* ── Jump dust cloud if airborne ── */
  if (p.jumping) {
    const dustAlpha = Math.max(0, 0.6 - (KR_PLAYER_Y - p.y) / 100);
    ctx.fillStyle = `rgba(99,102,241,${dustAlpha})`;
    ctx.beginPath(); ctx.ellipse(-8 + leg1, 16, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8  + leg2, 16, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  }

  /* ── Stumble stars ── */
  if (stumbling) {
    for (let i = 0; i < 3; i++) {
      const angle = timestamp / 200 + (i * Math.PI * 2) / 3;
      const sx    = Math.cos(angle) * 18;
      const sy    = Math.sin(angle) * 10 - 42;
      ctx.fillStyle = '#fbbf24';
      ctx.font      = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', sx, sy);
    }
  }

  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
  ctx.globalAlpha = 1;
}
  
  function _krDrawInspector(ctx, s, timestamp) {
  const p      = s.player;
  const inspX  = p.x;          // same horizontal lane as player
  const inspY  = s.inspector.y; // large = far below; shrinks when stumbling

  /* Only draw if inspector is within canvas bounds */
  if (inspY - 100 > KR_CANVAS_H + 10) return;

  const legPhase = (timestamp / 140) % (Math.PI * 2);
  const leg1     = Math.sin(legPhase)  * 5;
  const leg2     = -Math.sin(legPhase) * 5;
  const arm1     = -Math.sin(legPhase) * 8;
  const arm2     =  Math.sin(legPhase) * 8;
  const angry    = s.inspector.gap < 120;
  const bobY     = Math.abs(Math.sin(legPhase)) * 1.5;

  ctx.save();
  ctx.translate(inspX, inspY - bobY);

  /* ── Inspector shadow ── */
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  /* ── Legs ── */
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth   = 7;
  ctx.lineCap     = 'round';
  ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(-7 + leg1, 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(5,  -5); ctx.lineTo(7  + leg2, 14); ctx.stroke();

  /* Shoes */
  ctx.fillStyle = '#0f172a';
  ctx.beginPath(); ctx.ellipse(-7 + leg1, 16, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(7  + leg2, 16, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();

  /* ── Body — blue inspector uniform ── */
  ctx.fillStyle = angry ? '#1e3a8a' : '#1d4ed8';
  _krRoundRect(ctx, -10, -18, 20, 22, 4);
  ctx.fill();
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth   = 1;
  _krRoundRect(ctx, -10, -18, 20, 22, 4);
  ctx.stroke();

  /* Badge */
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(-3, -13, 6, 5);
  ctx.fillStyle = '#92400e';
  ctx.font      = '4px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('★', 0, -10.5);

  /* ── Arms ── */
  ctx.strokeStyle = angry ? '#1e3a8a' : '#1d4ed8';
  ctx.lineWidth   = 5;
  ctx.lineCap     = 'round';
  ctx.beginPath(); ctx.moveTo(-9, -12); ctx.lineTo(-13 + arm1, -2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(9,  -12); ctx.lineTo(13  + arm2, -2); ctx.stroke();

  /* Hands */
  ctx.fillStyle = '#fde68a';
  ctx.beginPath(); ctx.arc(-13 + arm1, -1, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(13  + arm2, -1, 3, 0, Math.PI * 2); ctx.fill();

  /* Baton in right hand */
  ctx.save();
  ctx.translate(13 + arm2, -1);
  ctx.rotate(-0.4 + Math.sin(legPhase) * 0.25);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-1.5, -12, 3, 12);
  ctx.fillStyle = '#92400e';
  ctx.beginPath(); ctx.arc(0, -13, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  /* ── Head ── */
  ctx.fillStyle = '#fde68a';
  ctx.beginPath(); ctx.arc(0, -26, 11, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1; ctx.stroke();

  /* Cap */
  ctx.fillStyle = angry ? '#0c2461' : '#1e3a8a';
  ctx.beginPath(); ctx.ellipse(0, -34, 12, 6, 0, Math.PI, 0); ctx.fill();
  ctx.fillRect(-13, -31, 26, 4);
  /* Cap badge */
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.arc(0, -33, 3, 0, Math.PI * 2); ctx.fill();

  /* Face */
  ctx.fillStyle = '#92400e';
  if (angry) {
    ctx.beginPath(); ctx.arc(-4, -28, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3,  -28, 2.5, 0, Math.PI * 2); ctx.fill();
    /* Angry brows */
    ctx.strokeStyle = '#78350f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-7, -32); ctx.lineTo(-2, -30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6,  -32); ctx.lineTo(1,  -30); ctx.stroke();
    /* Gritted teeth */
    ctx.fillStyle = '#fff'; ctx.fillRect(-4, -24, 8, 4);
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 0.8;
    for (let t = 0; t < 4; t++) {
      ctx.beginPath(); ctx.moveTo(-4 + t * 2.7, -24); ctx.lineTo(-4 + t * 2.7, -20); ctx.stroke();
    }
  } else {
    ctx.beginPath(); ctx.arc(-4, -28, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3,  -28, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, -23, 3, 0, Math.PI); ctx.stroke();
  }

  /* ── Dog on leash (to the side) ── */
  const dogOff = 28 + Math.sin(legPhase * 0.8) * 5;
  const dogX   = dogOff;   // to the right of inspector
  const dogY   = -2;

  /* Leash */
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(13 + arm2, -1);
  ctx.quadraticCurveTo(dogX - 5, dogY - 8, dogX, dogY);
  ctx.stroke();

  /* Dog body */
  ctx.fillStyle = '#d97706';
  ctx.beginPath(); ctx.ellipse(dogX + 8, dogY, 10, 6, -0.15, 0, Math.PI * 2); ctx.fill();
  /* Dog head */
  ctx.beginPath(); ctx.arc(dogX + 17, dogY - 3, 6, 0, Math.PI * 2); ctx.fill();
  /* Ears */
  ctx.fillStyle = '#b45309';
  ctx.beginPath(); ctx.ellipse(dogX + 14, dogY - 9, 3.5, 5, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(dogX + 21, dogY - 9, 3.5, 5, 0.4, 0, Math.PI * 2); ctx.fill();
  /* Eye / tongue */
  ctx.fillStyle = '#0f172a';
  ctx.beginPath(); ctx.arc(dogX + 20, dogY - 4, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath(); ctx.ellipse(dogX + 21, dogY + 1, 2.5, 3.5, 0.3, 0, Math.PI); ctx.fill();
  /* Dog legs */
  ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2.5;
  const dleg = Math.sin(legPhase * 1.6) * 6;
  [[dogX + 3, dogY + 4], [dogX + 7, dogY + 4], [dogX + 12, dogY + 4], [dogX + 16, dogY + 4]].forEach(([lx, ly], i) => {
    const sw = (i % 2 === 0) ? dleg : -dleg;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + sw * 0.3, ly + 9); ctx.stroke();
  });
  /* Tail */
  ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dogX - 2, dogY - 1);
  ctx.quadraticCurveTo(dogX - 12, dogY - 14, dogX - 7, dogY - 18);
  ctx.stroke();

  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

  function _krRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  async function _krEndGame() {
    if (_krAnimFrame) { cancelAnimationFrame(_krAnimFrame); _krAnimFrame = null; }
    if (_krState && _krState._keyDown) document.removeEventListener('keydown', _krState._keyDown);
    if (_krState && _krState._keyUp)   document.removeEventListener('keyup',   _krState._keyUp);

    const s = _krState;
    _krState = null;

    const pct    = s.score > 0 ? Math.min(100, Math.round((s.score / Math.max(s.score + 3, 10)) * 100)) : 0;
    const win    = s.score >= 5;
    const result = await _awardXP(s.xpEarned, 'knowledgeRunner', { win, perfect: false, sdSurvived: s.score });
    await _saveGameResult('knowledgeRunner', {
      score: s.score, distance: Math.floor(s.distance),
      xpEarned: s.xpEarned, pct,
    });
    await _endGameSession(s._sessionId, { xpEarned: s.xpEarned, score: s.score, pct, win, meta: { distance: Math.floor(s.distance) } });

    const distanceTitle = s.distance >= 500 ? 'Legend Surfer!'
                        : s.distance >= 300 ? 'Master Surfer!'
                        : s.distance >= 150 ? 'Great Run!'
                        : s.distance >= 80  ? 'Good Effort!'
                        : 'Keep Practising!';

    const extraHtml = `
      <div style="margin:.75rem 0;padding:1.25rem;border-radius:10px;text-align:center;
                  background:linear-gradient(135deg,rgba(251,191,36,0.12),rgba(99,102,241,0.12));
                  border:2px solid rgba(251,191,36,0.3);">
        <div style="font-size:2rem;font-weight:900;color:#fbbf24;font-family:var(--font-mono);line-height:1;">
          ${Math.floor(s.distance)}m
        </div>
        <p style="font-size:.875rem;font-weight:700;color:#f1f5f9;margin:.25rem 0;">${distanceTitle}</p>
        <p style="font-size:.8125rem;color:var(--text-3);margin-top:.375rem;">
          🏄 ${s.score} correct coins collected &nbsp;|&nbsp; 🔥 Best combo: ${s.combo > 0 ? s.combo : 1}x
        </p>
      </div>`;

    _renderGameResult({
      gameIcon:      'bolt',
      gameName:      'Knowledge Surfer',
      score:         `${s.score} coins collected`,
      pct,
      xpEarned:      s.xpEarned,
      perfect:       false,
      win,
      result,
      extras: [
        { label: 'Distance Run',   value: `${Math.floor(s.distance)}m` },
        { label: 'Combo Bonus XP', value: s.xpEarned > s.score * KR_XP_PER_CORRECT ? `+${s.xpEarned - s.score * KR_XP_PER_CORRECT} XP` : '—' },
      ],
      extraHtml,
      onPlayAgainKey: 'knowledgeRunner',
    });
  }

  function _krRestart() {
    if (_krAnimFrame) { cancelAnimationFrame(_krAnimFrame); _krAnimFrame = null; }
    if (_krState && _krState._keyDown) document.removeEventListener('keydown', _krState._keyDown);
    if (_krState && _krState._keyUp)   document.removeEventListener('keyup',   _krState._keyUp);
    _krState = null;
    _showKnowledgeRunnerSetup();
  }

  function _krQuit() {
    if (_krAnimFrame) { cancelAnimationFrame(_krAnimFrame); _krAnimFrame = null; }
    if (_krState && _krState._keyDown) document.removeEventListener('keydown', _krState._keyDown);
    if (_krState && _krState._keyUp)   document.removeEventListener('keyup',   _krState._keyUp);
    _krState = null;
    openGameLobby();
  }
  
  /* ══════════════════════════════════════════════════════════════
     LEADERBOARD
  ══════════════════════════════════════════════════════════════ */

  async function openLeaderboard() {
    window.UI.mount(`
      <div class="max-w-2xl mx-auto animate-fadeIn" style="padding-bottom:2rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <h2 style="font-size:1.25rem;font-weight:700;color:var(--text-1);display:flex;align-items:center;gap:.375rem;">${_icon('trophy', 20)} Leaderboard</h2>
          <button onclick="Game.openGameLobby()" class="btn bg-gray-500" style="display:inline-flex;align-items:center;gap:.3rem;">${_icon('arrowLeft', 14)} Back</button>
        </div>
        <div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap;">
          <button id="lbTabClass"  onclick="Game._showLeaderboardTab('class')"  class="btn"           style="font-size:.8125rem;">My Class</button>
          <button id="lbTabSchool" onclick="Game._showLeaderboardTab('school')" class="btn bg-gray-500" style="font-size:.8125rem;">My School</button>
          <button id="lbTabAll"    onclick="Game._showLeaderboardTab('all')"    class="btn bg-gray-500" style="font-size:.8125rem;">All Students</button>
        </div>
        <div id="lbContent"><div style="text-align:center;padding:2rem;color:var(--text-3);">Loading leaderboard&hellip;</div></div>
      </div>`);
    _showLeaderboardTab('class');
  }

  async function _showLeaderboardTab(tab) {
    ['class','school','all'].forEach(t => {
      const id  = `lbTab${t.charAt(0).toUpperCase() + t.slice(1)}`;
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.className = t === tab ? 'btn' : 'btn bg-gray-500';
      btn.style.fontSize = '.8125rem';
    });
    const container = document.getElementById('lbContent');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-3);">Loading&hellip;</div>';
    if (!_isOnline()) { container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-3);">Leaderboard requires an internet connection.</div>'; return; }
    try {
      let query = _db().collection('gameLeaderboard').orderBy('xp', 'desc').limit(50);
      if (tab === 'class')  query = _db().collection('gameLeaderboard').where('class',  '==', _student().class  || '').orderBy('xp', 'desc').limit(50);
      if (tab === 'school') query = _db().collection('gameLeaderboard').where('school', '==', _student().school || '').orderBy('xp', 'desc').limit(50);
      const snap = await query.get();
      const entries = [];
      snap.forEach(doc => entries.push({ id: doc.id, ...doc.data() }));
      if (entries.length === 0) { container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-3);">No players yet. Be the first!</div>`; return; }
      const myUid = _uid();
      container.innerHTML = `
        <div class="glass-dark" style="border-radius:10px;overflow:hidden;">
          <div style="display:grid;grid-template-columns:2.5rem 1fr auto auto;gap:.5rem;padding:.5rem 1rem;border-bottom:1px solid var(--border);background:var(--bg-subtle);font-size:.75rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;">
            <span>#</span><span>Player</span><span>Level</span><span>XP</span>
          </div>
          ${entries.map((e, i) => {
            const isMe  = e.id === myUid || e.uid === myUid;
            const medal = i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}`;
            const lv    = _getLevelForXP(e.xp || 0);
            return `
              <div style="display:grid;grid-template-columns:2.5rem 1fr auto auto;gap:.5rem;align-items:center;padding:.625rem 1rem;
                          ${isMe ? 'background:var(--accent-subtle);border-left:3px solid var(--accent);' : 'border-left:3px solid transparent;'}
                          ${i < entries.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
                <span style="font-size:${i < 3 ? '.875rem' : '.8125rem'};font-weight:800;text-align:center;color:${i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--text-3)'};">${medal}</span>
                <div>
                  <div style="font-size:.9rem;font-weight:${isMe ? '800' : '600'};color:var(--text-1);display:flex;align-items:center;gap:.375rem;">
                    ${_esc(e.name || '—')}
                    ${isMe ? '<span style="font-size:.6rem;background:var(--accent);color:#fff;padding:1px 5px;border-radius:4px;font-weight:700;">YOU</span>' : ''}
                  </div>
                  <div style="font-size:.7rem;color:var(--text-3);">${_esc(e.class || '')}</div>
                </div>
                <span style="font-size:.875rem;display:flex;align-items:center;gap:.25rem;">
                  ${_icon(lv.icon, 14, { color: lv.color })}
                  <span style="font-size:.75rem;color:var(--text-3);">${_esc(lv.name)}</span>
                </span>
                <span style="font-size:.9rem;font-weight:700;color:var(--accent);font-family:var(--font-mono);">${(e.xp || 0).toLocaleString()}</span>
              </div>`;
          }).join('')}
        </div>`;
    } catch (e) {
      console.error('[game] openLeaderboard error:', e);
      container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--danger);">Could not load leaderboard. Please try again.</div>`;
    }
  }

  /* ══════════════════════════════════════════════════════════════
     SAVE GAME RESULT (offline-first)
  ══════════════════════════════════════════════════════════════ */

  async function _saveGameResult(gameType, data) {
    if (!_isOnline()) {
      if (window.LocalDB) {
        LocalDB.enqueue('add', 'gameResults', null, {
          uid: _uid(), name: _student().name || '', class: _student().class || '',
          school: _student().school || '', gameType, ...data, playedAt: new Date().toISOString(),
        }, 4).catch(() => {});
      }
      return;
    }
    try {
      await _db().collection('gameResults').add({
        uid: _uid(), name: _student().name || '', class: _student().class || '',
        school: _student().school || '', gameType, ...data,
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
      _stopTimer(); _gameState = null; openGameLobby(); return;
    }
    window.UI.confirmAction('Quit this game? Your progress will not be saved.').then(ok => {
      if (!ok) return;
      _stopTimer(); _gameState = null; openGameLobby();
    });
  }

  /* ══════════════════════════════════════════════════════════════
     NAV BADGE
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
    if (window.Exam && typeof window.Exam.renderSubjectSelection === 'function') window.Exam.renderSubjectSelection();
    else if (window.UI && typeof window.UI.home === 'function') window.UI.home();
    else console.warn('[game] _backToHome: no navigation handler found.');
  }

  /* ══════════════════════════════════════════════════════════════
     CSS INJECTION
  ══════════════════════════════════════════════════════════════ */

  function _injectStyles() {
    if (document.getElementById('_gameStyles')) return;
    const s = document.createElement('style');
    s.id = '_gameStyles';
    s.textContent = `
      .game-timer { display:block;font-family:var(--font-mono);font-size:1.875rem;font-weight:700;letter-spacing:.04em;line-height:1;transition:color .3s; }
      .timer-green  { color:var(--success,#22c55e); }
      .timer-yellow { color:var(--warning,#f59e0b); }
      .timer-red    { color:var(--danger,#ef4444);animation:game-pulse-red .5s ease-in-out infinite alternate; }
      @keyframes game-pulse-red { from{opacity:1}to{opacity:.55} }

      .game-lobby-header { display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem;margin-bottom:.75rem;flex-wrap:wrap;gap:1rem;border-radius:var(--r-xl) !important; }
      .game-lobby-header__left  { display:flex;align-items:center;gap:.875rem;min-width:0; }
      .game-lobby-header__avatar { width:48px;height:48px;border-radius:50%;flex-shrink:0;background:var(--accent-subtle);border:2px solid var(--accent-border);display:flex;align-items:center;justify-content:center;font-size:1.375rem;font-weight:800;color:var(--accent-text); }
      .game-lobby-header__name  { font-size:1.125rem;font-weight:700;color:var(--text-1);line-height:1.2; }
      .game-lobby-header__meta  { font-size:.8125rem;color:var(--text-3);margin-top:2px; }
      .game-lobby-header__right { flex-shrink:0; }

      .game-level-badge { display:flex;align-items:center;gap:.625rem;background:var(--bg-base);border:2px solid var(--lvl-color,var(--accent));border-radius:99px;padding:.375rem .875rem; }
      .game-level-badge__icon { line-height:1; }
      .game-level-badge__name { font-size:.875rem;font-weight:700;color:var(--lvl-color,var(--accent)); }
      .game-level-badge__xp   { font-size:.6875rem;color:var(--text-3);font-family:var(--font-mono); }

      .game-xp-bar-wrap { padding:.875rem 1rem;border-radius:var(--r-lg) !important;margin-bottom:.75rem; }
      .game-xp-track    { width:100%;height:8px;background:var(--bg-muted);border-radius:99px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.08); }
      .game-xp-fill     { height:100%;border-radius:99px;background:linear-gradient(90deg,var(--accent),#7c3aed);transition:width .8s cubic-bezier(0.4,0,0.2,1);box-shadow:0 0 8px rgba(79,110,247,.35); }

      .game-challenge-alert { display:flex;align-items:center;gap:.625rem;background:linear-gradient(135deg,#fef3c7,#fde68a);border:2px solid #f59e0b;border-radius:10px;padding:.75rem 1rem;margin:.625rem 0;cursor:pointer;font-size:.9rem;font-weight:700;color:#92400e;transition:transform .15s; }
      .game-challenge-alert--info { background:linear-gradient(135deg,#dbeafe,#bfdbfe);border-color:#3b82f6;color:#1e40af; }
      .game-challenge-alert:hover { transform:translateY(-2px); }
      .game-challenge-alert__icon { font-size:1.25rem;flex-shrink:0;display:flex;align-items:center; }
      .game-challenge-alert__arrow { margin-left:auto;display:flex;align-items:center; }

      .game-section-title { font-size:1rem;font-weight:700;color:var(--text-1);margin:.25rem 0 .75rem;letter-spacing:-.01em; }

      /* Grid: 3-col on desktop (6 cards) → 2-col on tablet → 1-col on small mobile */
      .game-cards-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem; }
      @media (max-width:720px) { .game-cards-grid { grid-template-columns:1fr 1fr; } }
      @media (max-width:420px) { .game-cards-grid { grid-template-columns:1fr; } }

      .game-card { background:var(--glass-bg);backdrop-filter:blur(var(--glass-blur)) saturate(var(--glass-saturate));-webkit-backdrop-filter:blur(var(--glass-blur)) saturate(var(--glass-saturate));border:1px solid var(--glass-border-outer);border-radius:var(--r-xl);padding:1.125rem;cursor:pointer;transition:transform .18s var(--ease),box-shadow .18s var(--ease),border-color .18s;position:relative;overflow:hidden; }
      .game-card::before { content:'';position:absolute;inset:0;border-radius:inherit;border:1px solid var(--glass-border);pointer-events:none; }
      .game-card > * { position:relative;z-index:1; }
      .game-card:hover { transform:translateY(-4px);box-shadow:var(--shadow-lg);border-color:var(--accent-border) !important; }
      .game-card--challenge:hover    { border-color:rgba(224,49,49,.4) !important; }
      .game-card--sudden-death:hover { border-color:rgba(225,29,72,.45) !important; }
      .game-card__icon  { margin-bottom:.5rem;line-height:1;display:flex;align-items:center; }
      .game-card__title { font-size:1rem;font-weight:700;color:var(--text-1);margin-bottom:.375rem;letter-spacing:-.01em; }
      .game-card__desc  { font-size:.8125rem;color:var(--text-3);line-height:1.55;margin-bottom:.75rem; }
      .game-card__meta  { display:flex;flex-wrap:wrap;gap:.3125rem; }
      .game-card__tag   { font-size:.625rem;font-weight:600;padding:2px 7px;border-radius:4px;background:var(--bg-subtle);color:var(--text-3);border:1px solid var(--border);text-transform:uppercase;letter-spacing:.03em; }
      .game-card__tag--xp { background:var(--accent-subtle);color:var(--accent-text);border-color:var(--accent-border); }

      .game-stats-row { display:grid;grid-template-columns:repeat(4,1fr);padding:.875rem;border-radius:var(--r-lg) !important;text-align:center; }
      @media (max-width:400px) { .game-stats-row { grid-template-columns:repeat(2,1fr);gap:.5rem; } }
      .game-stat-cell__value { font-size:1.5rem;font-weight:800;color:var(--text-1);font-family:var(--font-mono);line-height:1;margin-bottom:.25rem; }
      .game-stat-cell__label { font-size:.6875rem;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em; }

      .game-quiz-header { padding:1rem 1.25rem !important;border-radius:var(--r-xl) !important; }
      .game-progress-track { width:100%;height:5px;background:var(--bg-muted);border-radius:99px;overflow:hidden; }
      .game-progress-fill  { height:100%;border-radius:99px;background:var(--accent);transition:width .4s ease; }

      .game-option-btn { display:flex;align-items:flex-start;gap:.875rem;width:100%;padding:.75rem 1rem;background:var(--bg-base);border:2px solid var(--border);border-radius:var(--r-lg);cursor:pointer;font-family:var(--font);font-size:var(--text-base);color:var(--text-1);text-align:left;transition:border-color .12s,background .12s,transform .1s;margin-bottom:.5rem; }
      .game-option-btn:last-child { margin-bottom:0; }
      .game-option-btn:hover:not(:disabled) { border-color:var(--accent-border);background:var(--accent-subtle);transform:translateX(3px); }
      .game-option-btn__letter { width:1.75rem;height:1.75rem;border-radius:50%;flex-shrink:0;background:var(--bg-subtle);border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:var(--text-2);transition:background .12s,color .12s,border-color .12s; }
      .game-option-btn:hover:not(:disabled) .game-option-btn__letter { background:var(--accent);color:#fff;border-color:var(--accent); }
      .game-option-btn--correct { border-color:var(--success) !important;background:var(--success-subtle) !important; }
      .game-option-btn--correct .game-option-btn__letter { background:var(--success) !important;color:#fff !important;border-color:var(--success) !important; }
      .game-option-btn--wrong   { border-color:var(--danger)  !important;background:var(--danger-subtle)  !important; }
      .game-option-btn--wrong   .game-option-btn__letter { background:var(--danger) !important;color:#fff !important;border-color:var(--danger) !important; }

      .game-card--scrabble:hover { border-color:rgba(124,58,237,.4) !important; }

      /* ── True or False buttons ── */
      .game-tf-btn {
        display:inline-flex;align-items:center;justify-content:center;gap:.625rem;
        padding:1rem;border-radius:var(--r-lg);font-size:1.125rem;font-weight:800;
        border:none;cursor:pointer;font-family:var(--font);letter-spacing:.02em;
        transition:transform .12s,opacity .12s,box-shadow .12s;
      }
      .game-tf-btn:hover:not(:disabled) { transform:translateY(-3px);box-shadow:0 6px 20px rgba(0,0,0,.15); }
      .game-tf-btn:active:not(:disabled) { transform:translateY(0); }
      .game-tf-btn--true  { background:#10b981;color:#fff; }
      .game-tf-btn--false { background:#e11d48;color:#fff; }
      .game-tf-btn--true:hover:not(:disabled)  { background:#059669; }
      .game-tf-btn--false:hover:not(:disabled) { background:#be123c; }
      .game-tf-btn:disabled { opacity:.6;cursor:default; }
      /* Post-answer reveals */
      .game-tf-btn--revealed-correct { outline:3px solid var(--success);box-shadow:0 0 0 5px rgba(34,197,94,.18) !important; }
      .game-tf-btn--revealed-wrong   { opacity:.5; }
      .game-tf-btn--pressed-correct  { animation:game-tf-pop-correct .35s ease both; }
      .game-tf-btn--pressed-wrong    { animation:game-tf-shake .35s ease both; }
      @keyframes game-tf-pop-correct { 0%{transform:scale(1)}40%{transform:scale(1.08)}100%{transform:scale(1)} }
      @keyframes game-tf-shake { 0%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}100%{transform:translateX(0)} }

      .game-diff-option { display:flex;flex-direction:column;align-items:center;justify-content:center;padding:.75rem .5rem;border-radius:var(--r-lg);border:2px solid var(--border);background:var(--bg-base);cursor:pointer;transition:border-color .15s,background .15s;gap:.25rem;text-align:center; }
      .game-diff-option.selected { border-color:var(--accent);background:var(--accent-subtle); }
      .game-diff-option__icon { display:flex;align-items:center;justify-content:center; }
      .game-diff-option__name { font-size:.875rem;font-weight:700;color:var(--text-1); }
      .game-diff-option__desc { font-size:.625rem;color:var(--text-3);margin-top:1px; }

      .game-scrambled-letters { display:flex;flex-wrap:wrap;justify-content:center;gap:.375rem;margin-bottom:.5rem;padding:.75rem; }
      .game-letter-tile { width:2.25rem;height:2.25rem;border-radius:6px;background:linear-gradient(145deg,var(--accent-subtle),var(--bg-subtle));border:2px solid var(--accent-border);display:inline-flex;align-items:center;justify-content:center;font-size:1rem;font-weight:800;color:var(--accent-text);font-family:var(--font-mono);box-shadow:0 2px 4px rgba(0,0,0,.06);transition:transform .15s; }
      @keyframes game-tile-bounce { 0%{transform:translateY(0)}30%{transform:translateY(-6px) scale(1.08)}60%{transform:translateY(2px)}100%{transform:translateY(0)} }
      .game-tiles-bounce .game-letter-tile { animation:game-tile-bounce .35s ease both; }
      .game-tiles-bounce .game-letter-tile:nth-child(odd)  { animation-delay:.04s; }
      .game-tiles-bounce .game-letter-tile:nth-child(even) { animation-delay:.08s; }

      .game-shuffle-btn { display:inline-flex;align-items:center;gap:.3rem;font-size:.75rem;font-weight:600;padding:3px 10px;border-radius:99px;background:var(--accent-subtle);color:var(--accent-text);border:1.5px solid var(--accent-border);cursor:pointer;transition:background .15s,opacity .15s;font-family:var(--font); }
      .game-shuffle-btn:hover:not(:disabled) { background:var(--accent);color:#fff; }
      .game-shuffle-btn--disabled { opacity:.4;cursor:not-allowed; }
      .game-shuffle-count { display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;background:var(--accent);color:#fff;border-radius:99px;font-size:.625rem;font-weight:800;padding:0 3px; }
      .game-shuffle-btn--disabled .game-shuffle-count { background:var(--text-4); }

      .game-result-card { padding:1.5rem !important; }
      .game-perfect-banner { text-align:center;padding:.625rem 1rem;border-radius:8px;background:linear-gradient(135deg,#fef3c7,#fde68a);border:2px solid #f59e0b;font-weight:800;color:#92400e;font-size:.9375rem;margin-bottom:.75rem;display:flex;align-items:center;justify-content:center;gap:.375rem; }
      .game-badges-earned { background:var(--warning-subtle);border:1px solid var(--warning-border);border-radius:8px;padding:.875rem 1rem;margin-bottom:.75rem; }
      .game-badge-pop { background:var(--bg-base);border:1px solid var(--border);border-radius:6px;padding:.375rem .75rem;margin-bottom:.375rem;font-size:.875rem;color:var(--text-1);display:flex;align-items:center;gap:.5rem; }
      .game-badge-pop:last-child { margin-bottom:0; }

      .game-badge-chip { display:inline-flex;align-items:center;gap:.3125rem;background:var(--accent-subtle);border:1px solid var(--accent-border);color:var(--accent-text);border-radius:99px;padding:2px 9px;font-size:.6875rem;font-weight:600;transition:transform .1s;cursor:default; }
      .game-badge-chip:hover { transform:scale(1.05); }
      
      .game-badge-chip { display:inline-flex;align-items:center;gap:.3125rem;background:var(--accent-subtle);border:1px solid var(--accent-border);color:var(--accent-text);border-radius:99px;padding:2px 9px;font-size:.6875rem;font-weight:600;transition:transform .1s,box-shadow .15s;cursor:pointer;font-family:var(--font); }
      .game-badge-chip:hover { transform:scale(1.08);box-shadow:0 4px 12px rgba(79,110,247,0.25); }

      [data-theme="dark"] .game-card       { border-color:var(--glass-border-outer) !important; }
      [data-theme="dark"] .game-option-btn { background:var(--bg-subtle);border-color:var(--border); }
      [data-theme="dark"] .game-letter-tile { background:linear-gradient(145deg,rgba(107,135,248,.15),rgba(24,24,28,.8));border-color:var(--accent-border); }
    `;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════════════
     TEACHER: GAME STATS PANEL
  ══════════════════════════════════════════════════════════════ */

  async function renderTeacherGameStats(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // ── GAME TYPE LABELS ─────────────────────────────────────
    const GAME_LABELS = {
      quizBlitz:      'Quiz Blitz',
      speedMath:      'Speed Math',
      wordScramble:   'Word Scramble',
      trueOrFalse:    'True or False',
      suddenDeath:    'Perfect Run',
      challenge:      'Challenge',
      knowledgeRunner:'Knowledge Surfer',
      wordScrabble:   'Word Scrabble',
    };

    const GAME_ICONS = {
      quizBlitz:      '⚡',
      speedMath:      '🧮',
      wordScramble:   '🔡',
      trueOrFalse:    '✅',
      suddenDeath:    '💀',
      challenge:      '⚔️',
      knowledgeRunner:'🏄',
      wordScrabble:   '🔤',
    };

    function gameLabel(type) { return GAME_LABELS[type] || type || '—'; }
    function gameIcon(type)  { return GAME_ICONS[type]  || '🎮'; }

    function _esc2(str) {
      return String(str == null ? '' : str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function _fmtTime(firestoreTs) {
      if (!firestoreTs) return '—';
      const d = firestoreTs.toDate ? firestoreTs.toDate() : new Date(firestoreTs);
      return d.toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    }

    function _duration(start, end) {
      if (!start || !end) return '—';
      const s = start.toDate ? start.toDate() : new Date(start);
      const e = end.toDate   ? end.toDate()   : new Date(end);
      const ms = e - s;
      if (ms < 0) return '—';
      const m = Math.floor(ms / 60000);
      const sec = Math.floor((ms % 60000) / 1000);
      if (m === 0) return sec + 's';
      return m + 'm ' + sec + 's';
    }

    function _pctColor(pct) {
      if (pct == null) return 'var(--text-3)';
      if (pct >= 70) return 'var(--success)';
      if (pct >= 50) return 'var(--warning)';
      return 'var(--danger)';
    }

    // ── STALE SESSION DETECTION ──────────────────────────────
    // A session is considered stale (no longer actually live) if its
    // most recent heartbeat (or startedAt, for older docs with no
    // heartbeat field) is older than this threshold. This protects
    // against sessions that never got a 'finished' write because the
    // student closed the tab, lost connection, or force-quit the app.
    const SESSION_STALE_MS = 90_000; // 90 seconds

    function _isSessionStale(d) {
      const ref = d.lastHeartbeat || d.startedAt;
      if (!ref) return true;
      const refMs = ref.toDate ? ref.toDate().getTime() : new Date(ref).getTime();
      return (Date.now() - refMs) > SESSION_STALE_MS;
    }

    // ── INITIAL RENDER WITH LOADING STATE ────────────────────
    container.innerHTML = `
      <div style="margin-bottom:1rem;">
        <h2 style="font-size:var(--text-md);font-weight:600;color:var(--text-1);letter-spacing:-0.015em;">
          Student Game Activity
        </h2>
        <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:2px;">
          Live tracking — updates in real time as students play
        </p>
      </div>

      <!-- CURRENTLY PLAYING (live) -->
      <div class="glass-dark" style="padding:1rem;border-radius:var(--r-lg);margin-bottom:1rem;">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem;">
          <span style="width:8px;height:8px;border-radius:50%;background:#22c55e;
                       display:inline-block;animation:cbt-pulse .9s ease-in-out infinite;"></span>
          <h3 style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);">Currently Playing</h3>
        </div>
        <div id="teacherLiveGames" style="font-size:var(--text-sm);color:var(--text-3);font-style:italic;">
          Checking for active players…
        </div>
      </div>

      <!-- TABS -->
      <div style="display:flex;gap:.375rem;margin-bottom:1rem;flex-wrap:wrap;">
        <button id="gTabHistory" onclick="Game._teacherGameTab('history')"
                class="btn" style="font-size:var(--text-xs);">Recent Activity</button>
        <button id="gTabLeaderboard" onclick="Game._teacherGameTab('leaderboard')"
                class="btn bg-gray-500" style="font-size:var(--text-xs);">Leaderboard</button>
        <button id="gTabStats" onclick="Game._teacherGameTab('stats')"
                class="btn bg-gray-500" style="font-size:var(--text-xs);">Game Stats</button>
      </div>

      <!-- TAB CONTENT -->
      <div id="gTabContent">
        <div style="text-align:center;padding:2rem;color:var(--text-3);">Loading…</div>
      </div>
    `;

    // ── LIVE LISTENER STATE ───────────────────────────────────
    let _liveUnsub         = null;
    let _historyUnsub      = null;
    let _liveStaleCheckInt = null;
    let _latestLiveSnapDocs = [];

    function _stopTeacherListeners() {
      if (_liveUnsub)    { _liveUnsub();    _liveUnsub    = null; }
      if (_historyUnsub) { _historyUnsub(); _historyUnsub = null; }
      if (_liveStaleCheckInt) { clearInterval(_liveStaleCheckInt); _liveStaleCheckInt = null; }
    }

    // Expose cleanup so showTab() can call it when switching away
    window._teacherGameStatsCleanup = _stopTeacherListeners;

    function _renderLiveGamesList() {
      const liveEl = document.getElementById('teacherLiveGames');
      if (!liveEl) { _stopTeacherListeners(); return; }

      const docs = (_latestLiveSnapDocs || []).filter(doc => !_isSessionStale(doc.data()));

      if (docs.length === 0) {
        liveEl.innerHTML = `<p style="font-size:var(--text-sm);color:var(--text-3);font-style:italic;margin:0;">
          No students are playing right now.</p>`;
        return;
      }

      const rows = docs.map(doc => {
        const d = doc.data();
        const startedAt = d.startedAt;
        let elapsed = '—';
        if (startedAt) {
          const s = startedAt.toDate ? startedAt.toDate() : new Date(startedAt);
          const ms = Date.now() - s.getTime();
          const m  = Math.floor(ms / 60000);
          const sec = Math.floor((ms % 60000) / 1000);
          elapsed = m > 0 ? m + 'm ' + sec + 's' : sec + 's';
        }
        return `
          <div style="display:flex;align-items:center;gap:.75rem;padding:.5rem .75rem;
                      background:var(--bg-base);border:1px solid var(--success-border);
                      border-left:3px solid var(--success);border-radius:8px;margin-bottom:.375rem;">
            <span style="font-size:1.125rem;flex-shrink:0;">${gameIcon(d.gameType)}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);
                          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${_esc2(d.name || '—')}
              </div>
              <div style="font-size:var(--text-xs);color:var(--text-3);">
                ${_esc2(d.class || '')} · ${gameLabel(d.gameType)}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:var(--text-xs);font-weight:700;color:var(--success);">● LIVE</div>
              <div style="font-size:var(--text-xs);color:var(--text-4);">${_esc2(elapsed)}</div>
            </div>
          </div>`;
      }).join('');

      liveEl.innerHTML = rows || `<p style="font-size:var(--text-sm);color:var(--text-3);font-style:italic;margin:0;">
        No students are playing right now.</p>`;
    }

    // ── LIVE LISTENER: currently playing ─────────────────────
    _liveUnsub = _db().collection('gameSessions')
      .where('status', '==', 'playing')
      .onSnapshot(snap => {
        _latestLiveSnapDocs = snap.docs;
        _renderLiveGamesList();
      }, err => {
        console.warn('[teacher] live games listener error:', err);
      });

    // Re-render every 15s even without new snapshot data, so sessions
    // that go stale (no heartbeat, tab closed, connection lost) drop
    // off the "Currently Playing" list without needing a new write.
    _liveStaleCheckInt = setInterval(_renderLiveGamesList, 15_000);

    // ── TAB SWITCHING ─────────────────────────────────────────
    window._teacherGameTab = function(tab) {
      ['history','leaderboard','stats'].forEach(t => {
        const btn = document.getElementById('gTab' + t.charAt(0).toUpperCase() + t.slice(1));
        if (btn) {
          btn.className = t === tab ? 'btn' : 'btn bg-gray-500';
          btn.style.fontSize = 'var(--text-xs)';
        }
      });

      if (_historyUnsub) { _historyUnsub(); _historyUnsub = null; }

      if (tab === 'history')     _loadHistoryTab();
      if (tab === 'leaderboard') _loadLeaderboardTab();
      if (tab === 'stats')       _loadStatsTab();
    };

    // ── HISTORY TAB (live, last 100 sessions) ─────────────────
    function _loadHistoryTab() {
      const content = document.getElementById('gTabContent');
      if (!content) return;
      content.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--text-3);">Loading activity…</div>`;

      _historyUnsub = _db().collection('gameSessions')
        .orderBy('startedAt', 'desc')
        .limit(100)
        .onSnapshot(snap => {
          const content2 = document.getElementById('gTabContent');
          if (!content2) { if (_historyUnsub) { _historyUnsub(); _historyUnsub = null; } return; }

          if (snap.empty) {
            content2.innerHTML = `<p style="text-align:center;padding:2rem;color:var(--text-3);font-size:var(--text-sm);">
              No game sessions recorded yet. Students need to play games first.</p>`;
            return;
          }

          const rows = snap.docs.map(doc => {
            const d         = doc.data();
            const stillLive = d.status === 'playing' && !_isSessionStale(d);
            const pct    = d.pct ?? null;
            const score  = d.score ?? null;
            const dur    = _duration(d.startedAt, d.endedAt);
            const when   = _fmtTime(d.startedAt);

            return `
              <div style="display:flex;align-items:center;gap:.625rem;padding:.5625rem .875rem;
                          border-bottom:1px solid var(--border);
                          ${stillLive ? 'background:rgba(34,197,94,0.04);' : ''}">
                <span style="font-size:1rem;flex-shrink:0;width:1.5rem;text-align:center;">${gameIcon(d.gameType)}</span>
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap;">
                    <span style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);">${_esc2(d.name || '—')}</span>
                    <span style="font-size:var(--text-xs);color:var(--text-3);">${_esc2(d.class || '')}</span>
                  </div>
                  <div style="font-size:var(--text-xs);color:var(--text-3);margin-top:1px;">
                    ${gameLabel(d.gameType)}
                    ${d.meta && d.meta.difficulty ? ' · ' + _esc2(d.meta.difficulty) : ''}
                    ${d.meta && d.meta.subject && d.meta.subject !== 'random' ? ' · ' + _esc2(d.meta.subject) : ''}
                  </div>
                </div>
                <div style="text-align:right;flex-shrink:0;min-width:80px;">
                  ${stillLive
                    ? `<div style="font-size:var(--text-xs);font-weight:700;color:var(--success);">● Playing now</div>`
                    : d.status === 'playing'
                    ? `<div style="font-size:var(--text-xs);font-weight:700;color:var(--text-4);">⚠ Disconnected</div>`
                    : `<div style="font-size:var(--text-sm);font-weight:700;color:${_pctColor(pct)};">
                         ${pct !== null ? pct + '%' : score !== null ? score + ' pts' : '—'}
                       </div>`}
                  <div style="font-size:var(--text-xs);color:var(--text-4);">
                    ${stillLive ? '' : dur + ' · '}${when}
                  </div>
                  ${!stillLive && d.status !== 'playing' && d.xpEarned ? `<div style="font-size:var(--text-xs);font-weight:600;color:var(--accent);">+${d.xpEarned} XP</div>` : ''}
                </div>
              </div>`;
          }).join('');

          content2.innerHTML = `
            <div class="glass-dark" style="border-radius:var(--r-lg);overflow:hidden;padding:0;">
              <div style="padding:.625rem 1rem;border-bottom:1px solid var(--border);
                          background:var(--bg-subtle);display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:var(--text-xs);font-weight:700;color:var(--text-2);">
                  Recent Game Sessions (last 100)
                </span>
                <span style="font-size:var(--text-xs);color:var(--text-4);">Updates live ●</span>
              </div>
              ${rows}
            </div>`;
        }, err => {
          console.warn('[teacher] history tab error:', err);
        });
    }

    // ── LEADERBOARD TAB ──────────────────────────────────────
    async function _loadLeaderboardTab() {
      const content = document.getElementById('gTabContent');
      if (!content) return;
      content.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--text-3);">Loading leaderboard…</div>`;

      if (!_isOnline()) {
        content.innerHTML = `<p style="text-align:center;padding:2rem;color:var(--text-3);">Leaderboard requires an internet connection.</p>`;
        return;
      }

      try {
        const snap = await _db().collection('gameLeaderboard').orderBy('xp', 'desc').limit(50).get();
        if (snap.empty) {
          content.innerHTML = `<p style="text-align:center;padding:2rem;color:var(--text-3);">No leaderboard data yet.</p>`;
          return;
        }
        const rows = snap.docs.map((doc, i) => {
          const e      = doc.data();
          const lv     = _getLevelForXP(e.xp || 0);
          const medal  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
          return `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:.4375rem .75rem;text-align:center;font-weight:700;font-size:var(--text-sm);">${medal}</td>
              <td style="padding:.4375rem .75rem;font-weight:600;font-size:var(--text-sm);">${_esc2(e.name || '—')}</td>
              <td style="padding:.4375rem .75rem;color:var(--text-3);font-size:var(--text-xs);">${_esc2(e.class || '—')}</td>
              <td style="padding:.4375rem .75rem;font-size:var(--text-xs);white-space:nowrap;">
                ${_icon(lv.icon, 12, { color: lv.color })} ${_esc2(lv.name)}
              </td>
              <td style="padding:.4375rem .75rem;font-weight:700;color:var(--accent);font-family:var(--font-mono);font-size:var(--text-sm);">${(e.xp || 0).toLocaleString()}</td>
              <td style="padding:.4375rem .75rem;text-align:center;font-size:var(--text-xs);">${e.totalGames || 0}</td>
              <td style="padding:.4375rem .75rem;text-align:center;font-size:var(--text-xs);">${e.totalWins || 0}</td>
            </tr>`;
        }).join('');

        content.innerHTML = `
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm);">
              <thead>
                <tr style="background:var(--bg-subtle);border-bottom:1.5px solid var(--border);">
                  <th style="text-align:center;padding:.5rem .75rem;font-size:var(--text-xs);font-weight:700;color:var(--text-3);">#</th>
                  <th style="text-align:left;padding:.5rem .75rem;font-size:var(--text-xs);font-weight:700;color:var(--text-3);">Student</th>
                  <th style="text-align:left;padding:.5rem .75rem;font-size:var(--text-xs);font-weight:700;color:var(--text-3);">Class</th>
                  <th style="text-align:left;padding:.5rem .75rem;font-size:var(--text-xs);font-weight:700;color:var(--text-3);">Level</th>
                  <th style="text-align:left;padding:.5rem .75rem;font-size:var(--text-xs);font-weight:700;color:var(--text-3);">XP</th>
                  <th style="text-align:center;padding:.5rem .75rem;font-size:var(--text-xs);font-weight:700;color:var(--text-3);">Games</th>
                  <th style="text-align:center;padding:.5rem .75rem;font-size:var(--text-xs);font-weight:700;color:var(--text-3);">Wins</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
      } catch (e) {
        console.error('[teacher] leaderboard tab error:', e);
        content.innerHTML = `<p style="text-align:center;padding:2rem;color:var(--danger);">Could not load leaderboard.</p>`;
      }
    }

    // ── STATS TAB (aggregate counts per game type) ────────────
    async function _loadStatsTab() {
      const content = document.getElementById('gTabContent');
      if (!content) return;
      content.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--text-3);">Loading stats…</div>`;

      try {
        const snap = await _db().collection('gameSessions')
          .where('status', '==', 'finished')
          .orderBy('startedAt', 'desc')
          .limit(500)
          .get();

        if (snap.empty) {
          content.innerHTML = `<p style="text-align:center;padding:2rem;color:var(--text-3);">No completed sessions yet.</p>`;
          return;
        }

        const byType = {};
        const byStudent = {};

        snap.docs.forEach(doc => {
          const d = doc.data();
          const type = d.gameType || 'unknown';
          if (!byType[type]) byType[type] = { count: 0, totalXP: 0, wins: 0, totalPct: 0, pctCount: 0 };
          byType[type].count++;
          byType[type].totalXP += d.xpEarned || 0;
          if (d.win) byType[type].wins++;
          if (d.pct != null) { byType[type].totalPct += d.pct; byType[type].pctCount++; }

          const uid = d.uid || d.name;
          if (!byStudent[uid]) byStudent[uid] = { name: d.name || '—', class: d.class || '—', count: 0, xp: 0, wins: 0 };
          byStudent[uid].count++;
          byStudent[uid].xp    += d.xpEarned || 0;
          if (d.win) byStudent[uid].wins++;
        });

        const typeRows = Object.entries(byType)
          .sort((a, b) => b[1].count - a[1].count)
          .map(([type, s]) => {
            const avgPct = s.pctCount > 0 ? Math.round(s.totalPct / s.pctCount) : null;
            const winRate = s.count > 0 ? Math.round((s.wins / s.count) * 100) : 0;
            return `
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:.4375rem .875rem;">
                  <span style="font-size:1rem;">${gameIcon(type)}</span>
                  <span style="font-size:var(--text-sm);font-weight:600;margin-left:.375rem;">${_esc2(gameLabel(type))}</span>
                </td>
                <td style="padding:.4375rem .875rem;text-align:center;font-size:var(--text-sm);font-weight:700;">${s.count}</td>
                <td style="padding:.4375rem .875rem;text-align:center;font-size:var(--text-sm);font-weight:700;color:var(--accent);">${s.totalXP.toLocaleString()}</td>
                <td style="padding:.4375rem .875rem;text-align:center;font-size:var(--text-sm);font-weight:700;color:${_pctColor(avgPct)}">${avgPct !== null ? avgPct + '%' : '—'}</td>
                <td style="padding:.4375rem .875rem;text-align:center;font-size:var(--text-sm);">${winRate}%</td>
              </tr>`;
          }).join('');

        const topStudents = Object.entries(byStudent)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 10)
          .map(([, s], i) => `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:.375rem .75rem;text-align:center;font-weight:700;font-size:var(--text-xs);">${i + 1}</td>
              <td style="padding:.375rem .75rem;font-weight:600;font-size:var(--text-sm);">${_esc2(s.name)}</td>
              <td style="padding:.375rem .75rem;color:var(--text-3);font-size:var(--text-xs);">${_esc2(s.class)}</td>
              <td style="padding:.375rem .75rem;text-align:center;font-weight:700;font-size:var(--text-sm);">${s.count}</td>
              <td style="padding:.375rem .75rem;text-align:center;font-weight:700;color:var(--accent);font-size:var(--text-sm);">${s.xp.toLocaleString()}</td>
            </tr>`).join('');

        content.innerHTML = `
          <div style="margin-bottom:1.25rem;">
            <h3 style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);margin-bottom:.75rem;">Plays by Game Type</h3>
            <div style="overflow-x:auto;">
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:var(--bg-subtle);border-bottom:1.5px solid var(--border);">
                    <th style="text-align:left;padding:.5rem .875rem;font-size:var(--text-xs);font-weight:700;color:var(--text-3);">Game</th>
                    <th style="text-align:center;padding:.5rem .875rem;font-size:var(--text-xs);font-weight:700;color:var(--text-3);">Plays</th>
                    <th style="text-align:center;padding:.5rem .875rem;font-size:var(--text-xs);font-weight:700;color:var(--text-3);">Total XP Earned</th>
                    <th style="text-align:center;padding:.5rem .875rem;font-size:var(--text-xs);font-weight:700;color:var(--text-3);">Avg Score</th>
                    <th style="text-align:center;padding:.5rem .875rem;font-size:var(--text-xs);font-weight:700;color:var(--text-3);">Win Rate</th>
                  </tr>
                </thead>
                <tbody>${typeRows}</tbody>
              </table>
            </div>
          </div>
          <div>
            <h3 style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);margin-bottom:.75rem;">Most Active Students (Top 10)</h3>
            <div style="overflow-x:auto;">
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:var(--bg-subtle);border-bottom:1.5px solid var(--border);">
                    <th style="text-align:center;padding:.5rem .75rem;font-size:var(--text-xs);font-weight:700;color:var(--text-3);">#</th>
                    <th style="text-align:left;padding:.5rem .75rem;font-size:var(--text-xs);font-weight:700;color:var(--text-3);">Student</th>
                    <th style="text-align:left;padding:.5rem .75rem;font-size:var(--text-xs);font-weight:700;color:var(--text-3);">Class</th>
                    <th style="text-align:center;padding:.5rem .75rem;font-size:var(--text-xs);font-weight:700;color:var(--text-3);">Total Plays</th>
                    <th style="text-align:center;padding:.5rem .75rem;font-size:var(--text-xs);font-weight:700;color:var(--text-3);">XP Earned</th>
                  </tr>
                </thead>
                <tbody>${topStudents}</tbody>
              </table>
            </div>
          </div>`;
      } catch (e) {
        console.error('[teacher] stats tab error:', e);
        content.innerHTML = `<p style="text-align:center;padding:2rem;color:var(--danger);">Could not load stats.</p>`;
      }
    }

    // ── LOAD DEFAULT TAB ─────────────────────────────────────
    window._teacherGameTab('history');
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
    // True or False
    _showTrueOrFalseSetup,
    _startTrueOrFalse,
    _answerTF,
    // Perfect Run
    _showSuddenDeathSetup,
    _startSuddenDeath,
    _answerSD,
    // Challenge
    _showChallengeSetup,
    _sendChallenge,
    _showPendingChallenges,
    _declineChallenge,
    _showAwaitingChallenges,
    _acceptChallenge,
    _playChallengerTurn,
    _answerChallenge,
    _watchChallengeResult,
    // Shared
    _abandonGame,
    _closeModal,
    _showLeaderboardTab,
    _playAgain,
    _backToHome,
    _showAllLevelsModal,
    _showBadgeDetails,
    _buildWordPoolForStudent,
    _startChallengeListener,
    _stopChallengeListener,
    renderTeacherGameStats,
    _showKnowledgeRunnerSetup,
    _startKnowledgeRunner,
    _krChangeLane,
    _krRoll,
    _krQuit,
    _krRestart,
    _showScrabbleSetup,
    _sendScrabbleChallenge,
    _showScrabblePending,
    _acceptScrabble,
    _declineScrabble,
    _openScrabbleGame,
    _wsCellClick,
    _wsRackClick,
    _wsPlaceBlank,
    _wsToggleSwap,
    _wsConfirmSwap,
    _wsConfirmPlay,
    _wsRecall,
    _wsSwapTiles,
    _wsPass,
    _wsLeave,
    _wsChooseBlankLetter,
    _teacherGameTab: function(tab) { if (typeof window._teacherGameTab === 'function') window._teacherGameTab(tab); },
  };

})();
