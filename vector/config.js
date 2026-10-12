/* ============================================================
   VECTOR: BLACKLINE  |  vector/config.js
   Pure constants. No DOM, no Three.js: this file is also imported
   by the multiplayer server, so keep it free of browser APIs.
   ============================================================ */

export const VERSION = '0.1.0';

/* Where the multiplayer Worker lives. Leave empty until you deploy
   vector/server (see vector/README.md). You can also test with
   /vector/index.html?api=https://your-worker.workers.dev            */
export const API_BASE = '';

/* Folder that holds your .glb files (repo root). */
export const ASSET_BASE = '../vector-3dassets/';

/* How models are downloaded and remembered (see vector/assetstore.js).
   - cacheName: players keep downloaded models under this name. Change the
     number (v1 -> v2) to make EVERY player download everything again.
   - Files are normally refreshed on their own: each model is stored under its
     content hash from vector-3dassets/manifest.json, so replacing a .glb and
     re-running tools/build-manifest.mjs is enough.                           */
export const MODELS = {
  cacheName: 'vb-models-v1',
  concurrency: 3,              // downloads at the same time
  retries: 2,                  // extra tries after a network error
  timeoutMs: 45000,            // give up on one file after this long in total
  stallMs: 20000,              // ...or if no data arrives for this long
  maxBytes: 40 * 1024 * 1024,  // refuse any single model bigger than this
  maxMetalness: 0.45,          // the game has no reflection map; fully metal models would look black
  prefetchIdle: true,          // quietly pre-download the next mission's models while the player is in menus
  highFidelityHeight: 1.85,    // detailed characters are scaled to this height in metres
};

/* Shared animation clips for rigged characters (optional). One file, loaded once. */
export const ANIMATION_LIBRARY = 'animations/humanoid';

export const STORAGE_NS = 'vectorBlackline';

export const PLAYER = {
  radius: 0.4,
  height: 1.8,
  crouchHeight: 1.25,
  eye: 1.62,
  crouchEye: 1.12,
  walk: 3.0,
  run: 4.8,
  sprint: 6.6,
  crouch: 1.9,
  jump: 7.0,
  gravity: 22,
  stepUp: 0.55,
  maxHp: 100,
  accel: 38,
  airControl: 0.35,
};

export const NET = {
  tickHz: 20,
  inputHz: 30,
  maxDt: 0.05,
  maxPlayers: { coop: 4, tdm: 8, ffa: 8 },
  minPlayers: { coop: 1, tdm: 2, ffa: 2 },
  reconnectGraceMs: 30000,
  idleLobbyMs: 15 * 60 * 1000,
  emptyMatchMs: 60 * 1000,
  countdownMs: 5000,
};

export const MODES = {
  campaign: { id: 'campaign', name: 'Campaign', mission: true, teams: false },
  coop: { id: 'coop', name: 'Co-op Operations', mission: true, teams: false },
  tdm: { id: 'tdm', name: 'Team Skirmish', mission: false, teams: true, scoreLimit: 30, timeLimit: 480 },
  ffa: { id: 'ffa', name: 'Free-For-All', mission: false, teams: false, scoreLimit: 20, timeLimit: 480 },
};

export const LOBBY_STATES = ['WAITING', 'READY', 'STARTING', 'IN_MATCH', 'FINISHED'];
export const PRESENCE = ['OFFLINE', 'ONLINE', 'IN_LOBBY', 'IN_MATCH'];

export const XP = {
  perLevel: (lvl) => 250 + lvl * 150,
  kill: 25, assist: 10, objective: 100, missionBase: 300, win: 150,
};
