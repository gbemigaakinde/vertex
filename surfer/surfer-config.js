/* ============================================================
   surfer/surfer-config.js   |   KNOWLEDGE SURFER 3D — settings

   THIS IS THE ONLY FILE YOU SHOULD NEED TO EDIT when your models
   arrive. It has two parts:
     1. MODELS  — the exact .glb file names the game looks for
     2. GAME    — speed, lane width, camera, etc.

   HOW MODELS ARE FOUND
     Every model is loaded from:  surfer/assets/<file>
     If a file is MISSING the game automatically draws a simple
     coloured stand-in, so the game always works while you build
     your models one by one.

   HOW MODELS ARE SIZED
     You do NOT need to match any scale when making a model. The
     game measures each model and resizes it to the size below.
       height : model is scaled (keeping its shape) to this height in metres
       width / depth / height together ("box"): the model is stretched
                to fill exactly that box (used for tiles that must join up)
       max    : model is scaled so its biggest side equals this
     Every model is automatically placed with its feet / bottom
     centred on the ground.

   IF A MODEL FACES THE WRONG WAY
     Change its  yaw  value (in degrees). 180 = turn around.
   LONG PIECES (track_segment, tunnel_wall, ceiling_lamp) are turned 90°
     by default because an image of a long object puts its length
     sideways. If one looks wrong, try yaw 0, 90, -90 or 180.
   OTHER OPTIONAL TWEAKS PER MODEL
     scaleMul : 1.1 makes it 10% bigger, 0.9 makes it 10% smaller
     yOffset  : raise (+) or sink (-) the model, in metres
     zUp      : true only if a model lies on its back when it loads
     pitch    : tilt the model forward/back in degrees (e.g. 90 if a coin loads lying flat)
   ============================================================ */

export const ASSET_BASE = '/surfer/assets/';

/* CACHING: every model is downloaded ONCE and kept in the browser (Cache Storage).
   When you replace a .glb file with a new one, change this number (e.g. '2')
   and every player will download the new file one time, then keep it again. */
export const ASSET_VERSION = '1';

/* Every character / obstacle is shown from BEHIND (the camera follows
   the runner), so create these models from the REAR view (see prompts). */

export const MODELS = {

  /* ── PLAYER: ONE model (characters/runner.glb) used for all 5 poses.
       The game bends/tilts it for each pose, so you only download one file.
       yaw 180 = the model was made facing the camera, the game wants its back to us.
       roll   = small side-to-side lean so run_a / run_b look like alternating steps.
       mirror = flips the model left-to-right. run_b is a mirrored copy of run_a, so the OTHER leg
       is the one that trails and both legs take turns. ── */
  player_run_a:   { file: 'characters/runner.glb', height: 1.75, yaw: 180, roll:  5 },
  player_run_b:   { file: 'characters/runner.glb', height: 1.75, yaw: 180, roll: -5, mirror: true },
  player_jump:    { file: 'characters/runner.glb', height: 1.70, yaw: 180, pitch: -8 },
  player_slide:   { file: 'characters/runner.glb', height: 0.75, yaw: 180, pitch: -78 },
  player_stumble: { file: 'characters/runner.glb', height: 1.65, yaw: 180, pitch: 22 },

  /* ── INSPECTOR (police): ONE model (characters/police.glb) for both steps ── */
  inspector_run_a: { file: 'characters/police.glb', height: 1.85, yaw: 180, roll:  5 },
  inspector_run_b: { file: 'characters/police.glb', height: 1.85, yaw: 180, roll: -5, mirror: true },

  /* ── DOG: not ready yet, the game draws its simple stand-in dog until you add these ── */
  dog_run_a:       { file: 'characters/dog_run_a.glb',       height: 0.70, yaw: 0 },
  dog_run_b:       { file: 'characters/dog_run_b.glb',       height: 0.70, yaw: 0 },

  /* ── OBSTACLES (3 kinds x 2 looks, plus river versions used in the boat zone) ──
       train  : tall, moves TOWARD you, switch lane to dodge
       hurdle : low,  JUMP over it
       gate   : low-clearance gantry, SLIDE under it ── */
  obstacle_train_a:  { file: 'obstacles/obstacle_train_a.glb',  width: 1.9, height: 3.4, depth: 9,   yaw: 0, mode: 'box' },
  obstacle_train_b:  { file: 'obstacles/obstacle_train_b.glb',  width: 1.9, height: 3.4, depth: 9,   yaw: 0, mode: 'box' },
  obstacle_hurdle_a: { file: 'obstacles/obstacle_hurdle_a.glb', width: 1.9, height: 0.85, depth: 0.9, yaw: 0, mode: 'box' },
  obstacle_hurdle_b: { file: 'obstacles/obstacle_hurdle_b.glb', width: 1.9, height: 0.85, depth: 0.9, yaw: 0, mode: 'box' },
  obstacle_gate_a:   { file: 'obstacles/obstacle_gate_a.glb',   width: 2.1, height: 1.7,  depth: 0.5, yaw: 0, mode: 'box' },
  obstacle_gate_b:   { file: 'obstacles/obstacle_gate_b.glb',   width: 2.1, height: 1.7,  depth: 0.5, yaw: 0, mode: 'box' },
  obstacle_barge_a:  { file: 'obstacles/obstacle_barge_a.glb',  width: 2.0, height: 2.3,  depth: 9,   yaw: 0, mode: 'box' },
  obstacle_barge_b:  { file: 'obstacles/obstacle_barge_b.glb',  width: 2.0, height: 2.3,  depth: 9,   yaw: 0, mode: 'box' },
  obstacle_log_a:    { file: 'obstacles/obstacle_log_a.glb',    width: 2.0, height: 0.85, depth: 0.9, yaw: 0, mode: 'box' },
  obstacle_log_b:    { file: 'obstacles/obstacle_log_b.glb',    width: 2.0, height: 0.85, depth: 0.9, yaw: 0, mode: 'box' },
  obstacle_bridge_a: { file: 'obstacles/obstacle_bridge_a.glb', width: 2.2, height: 1.7,  depth: 0.7, yaw: 0, mode: 'box' },
  obstacle_bridge_b: { file: 'obstacles/obstacle_bridge_b.glb', width: 2.2, height: 1.7,  depth: 0.7, yaw: 0, mode: 'box' },

  /* ── PLAYER BOAT (river zone) ── */
  player_boat: { file: 'props/boat.glb', width: 1.25, height: 0.62, depth: 2.9, yaw: 0, mode: 'box' },

  /* ── PICKUP ── */
  coin: { file: 'props/coin.glb', max: 0.62, yaw: 0, pitch: 0, center: true },

  /* ── ENVIRONMENT (tiles joined end to end; each exactly 'depth' long) ── */
  track_segment:     { file: 'environment/track_segment.glb',     width: 7.8, height: 0.35, depth: 12, yaw: 90, mode: 'box' },
  tunnel_wall:       { file: 'environment/tunnel_wall.glb',       width: 2.2, height: 7.0,  depth: 12, yaw: 90, mode: 'box' },
  tunnel_arch:       { file: 'environment/tunnel_arch.glb',       width: 9.6, height: 7.2,  depth: 1.2, yaw: 0, mode: 'box' },
  ceiling_lamp:      { file: 'environment/ceiling_lamp.glb',      width: 0.7, height: 0.5,  depth: 2.2, yaw: 90, mode: 'box' },
  signal_light:      { file: 'environment/signal_light.glb',      height: 2.8, yaw: 0 },
};

/* Which model names make up the random choices for each obstacle type.
   'water' looks are used while the runner is in the river (boat) zone. */
export const OBSTACLE_LOOKS = {
  train: { land: ['obstacle_train_a',  'obstacle_train_b'],  water: ['obstacle_barge_a',  'obstacle_barge_b']  },  // dodge (lane change)
  jump:  { land: ['obstacle_hurdle_a', 'obstacle_hurdle_b'], water: ['obstacle_log_a',    'obstacle_log_b']    },  // JUMP over it
  slide: { land: ['obstacle_gate_a',   'obstacle_gate_b'],   water: ['obstacle_bridge_a', 'obstacle_bridge_b'] },  // SLIDE under it
};

/* ── ENVIRONMENT ZONES ("biomes") ──
   The world changes every  zoneLength  metres of scrolling. Order repeats forever.
   fog = sky/haze colour, hemi = [sky, ground] light colours, sun = sun glow colour (or null) */
export const ZONE_LENGTH = 264;   // 22 tiles
export const BIOMES = [
  { id: 'station', name: 'Rail Tunnel',    water: false, fog: 0x0b1220, fogNear: 28, fogFar: 92,  hemi: [0xcfe0ff, 0x1b2230], hemiI: 0.75, key: 0xfff0dd, keyI: 1.7, sun: null,     exposure: 1.05 },
  { id: 'desert',  name: 'Desert Line',    water: false, fog: 0xf0cf98, fogNear: 38, fogFar: 105, hemi: [0xffe6c0, 0x9a7646], hemiI: 0.95, key: 0xffe2b0, keyI: 2.3, sun: 0xffd890, exposure: 1.05 },
  { id: 'forest',  name: 'Pine Forest',    water: false, fog: 0xa6c4b0, fogNear: 30, fogFar: 88,  hemi: [0xd8f2d8, 0x2f4a2c], hemiI: 0.85, key: 0xf4ffdc, keyI: 1.6, sun: 0xeaffc0, exposure: 1.0  },
  { id: 'river',   name: 'River Crossing', water: true,  fog: 0xa9d6ee, fogNear: 38, fogFar: 105, hemi: [0xd4ecff, 0x2a5a78], hemiI: 0.95, key: 0xfff6e0, keyI: 2.0, sun: 0xfff0b8, exposure: 1.05 },
  { id: 'snow',    name: 'Snow Pass',      water: false, fog: 0xe4eef8, fogNear: 28, fogFar: 78,  hemi: [0xf0f7ff, 0x9fb0c4], hemiI: 1.0,  key: 0xeaf2ff, keyI: 1.8, sun: 0xffffff, exposure: 1.0  },
];
export function biomeIndexAt(scroll) {
  const n = Math.floor(Math.max(0, scroll) / ZONE_LENGTH);
  return n % BIOMES.length;
}
export function biomeAt(scroll) { return BIOMES[biomeIndexAt(scroll)]; }

/* ── GAMEPLAY (same rules & XP as the original 2D game) ── */
export const GAME = {
  lives: 3,
  xpPerCoin: 12,
  xpComboBonus: 5,            // extra XP per coin once combo >= 3
  coinsPerRow: 5,

  laneCount: 3,
  laneWidth: 2.4,             // metres between lane centres

  /* Speed. "base/step/max" are the ORIGINAL 2D numbers so distance (m),
     XP and the Legend/Master titles stay balanced. worldSpeed = that × speedScale. */
  baseSpeed: 3.5,
  speedStepEvery: 500,        // metres of distance per speed-up
  speedStep: 0.45,
  maxSpeed: 9,
  speedScale: 3.0,            // metres per second of world movement per original unit

  jumpVelocity: 9.4,          // m/s
  gravity: 30,                // m/s²
  slideSeconds: 0.75,
  laneChangeSpeed: 14,        // how fast the runner glides sideways

  standHeight: 1.75,          // collision heights (metres)
  slideHeight: 0.65,
  playerHalfWidth: 0.32,
  playerHalfDepth: 0.25,

  /* Obstacle collision sizes (the model is only for looks) */
  train:   { halfWidth: 0.95, halfDepth: 4.5,  height: 3.4 },     // tall: cannot be jumped, switch lane
  hurdle:  { halfWidth: 0.95, halfDepth: 0.45, height: 0.85 },    // must be jumped
  beam:    { halfWidth: 0.98, halfDepth: 0.25, clearance: 0.78, top: 1.6 }, // gate: slide under (opening height; 'top' = hanging sign stops hopping over)
  trainSpeed: 6.5,            // extra m/s the train/barge rushes toward you on top of the world speed
  trainChance: 0.30, jumpChance: 0.35,   // remaining 35% = slide gates
  trainMaxSpawn: 118,         // never spawn farther than this (stays hidden in the fog)

  spawnAhead: 95,             // metres in front where new waves appear
  despawnBehind: 12,
  waveGapSeconds: [2.8, 3.8], // original: 170-230 frames at 60fps
  waveStagger: 2.2,           // metres of z-offset between lanes in a wave
  coinSpacing: 1.7,
  coinHeight: 0.95,

  /* Inspector (same idea as original: gap in "px" → metres on screen) */
  inspectorStartGap: 220,
  inspectorMinGap: 60,
  inspectorMaxGap: 260,
  inspectorCloseWarn: 150,

  pitEvery: 320,              // distance between pit stops (only appear when the player owns a ride)
  graceSeconds: 1.8,          // invincibility after a hit
  stumbleSeconds: 0.9,
};

/* ── CAMERA ── */
export const CAMERA = {
  fov: 58,
  position: [0, 3.9, 7.6],
  lookAt:   [0, 1.1, -6],
  followX: 0.55,              // camera slides sideways this fraction of the runner's x
  shakeOnHit: 0.35,
};

/* ── LOOK ── */
export const LOOK = {
  fogColor: 0x0b1220,
  fogNear: 28,
  fogFar: 92,
  exposure: 1.05,
  tileLength: 12,
  lampHeight: 6.55,           // lamps hang up high so they never pass right in front of the camera
  tilesAhead: 9,
  archEveryTiles: 1,
  lampEveryTiles: 1,
  signalEveryTiles: 3,
};
