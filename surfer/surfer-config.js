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

/* Every character / obstacle is shown from BEHIND (the camera follows
   the runner), so create these models from the REAR view (see prompts). */

export const MODELS = {

  /* ── PLAYER (5 poses of the SAME character; the game swaps between them) ── */
  player_run_a:   { file: 'characters/player_run_a.glb',   height: 1.75, yaw: 0 },
  player_run_b:   { file: 'characters/player_run_b.glb',   height: 1.75, yaw: 0 },
  player_jump:    { file: 'characters/player_jump.glb',    height: 1.60, yaw: 0 },
  player_slide:   { file: 'characters/player_slide.glb',   height: 0.70, yaw: 0 },
  player_stumble: { file: 'characters/player_stumble.glb', height: 1.70, yaw: 0 },

  /* ── INSPECTOR + DOG (chase you from behind) ── */
  inspector_run_a: { file: 'characters/inspector_run_a.glb', height: 1.85, yaw: 0 },
  inspector_run_b: { file: 'characters/inspector_run_b.glb', height: 1.85, yaw: 0 },
  dog_run_a:       { file: 'characters/dog_run_a.glb',       height: 0.70, yaw: 0 },
  dog_run_b:       { file: 'characters/dog_run_b.glb',       height: 0.70, yaw: 0 },

  /* ── OBSTACLES (each has 2 looks; the game picks randomly. Add _c, _d… freely) ── */
  obstacle_trolley_a: { file: 'obstacles/obstacle_trolley_a.glb', width: 1.7, height: 0.80, depth: 1.5, yaw: 0, mode: 'box' },
  obstacle_trolley_b: { file: 'obstacles/obstacle_trolley_b.glb', width: 1.7, height: 0.80, depth: 1.5, yaw: 0, mode: 'box' },
  obstacle_beam_a:    { file: 'obstacles/obstacle_beam_a.glb',    width: 2.1, height: 1.30, depth: 0.7, yaw: 0, mode: 'box' },
  obstacle_beam_b:    { file: 'obstacles/obstacle_beam_b.glb',    width: 2.1, height: 1.30, depth: 0.7, yaw: 0, mode: 'box' },

  /* ── PICKUP ── */
  coin: { file: 'props/coin.glb', max: 0.62, yaw: 0, pitch: 0, center: true },

  /* ── ENVIRONMENT (tiles joined end to end; each exactly 'depth' long) ── */
  track_segment:     { file: 'environment/track_segment.glb',     width: 7.8, height: 0.35, depth: 12, yaw: 90, mode: 'box' },
  tunnel_wall:       { file: 'environment/tunnel_wall.glb',       width: 2.2, height: 7.0,  depth: 12, yaw: 90, mode: 'box' },
  tunnel_arch:       { file: 'environment/tunnel_arch.glb',       width: 9.6, height: 7.2,  depth: 1.2, yaw: 0, mode: 'box' },
  ceiling_lamp:      { file: 'environment/ceiling_lamp.glb',      width: 0.7, height: 0.5,  depth: 2.2, yaw: 90, mode: 'box' },
  signal_light:      { file: 'environment/signal_light.glb',      height: 2.8, yaw: 0 },
};

/* Which model names make up the random choices for each obstacle type */
export const OBSTACLE_LOOKS = {
  jump:  ['obstacle_trolley_a', 'obstacle_trolley_b'],   // low  → JUMP over it
  slide: ['obstacle_beam_a',    'obstacle_beam_b'],      // high → SLIDE under it
};

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
  trolley: { halfWidth: 0.82, halfDepth: 0.60, height: 0.80 },    // must be jumped
  beam:    { halfWidth: 0.95, halfDepth: 0.30, clearance: 0.78, top: 1.6 }, // must be slid under (opening height; 'top' stops people hopping over)

  spawnAhead: 95,             // metres in front where new waves appear
  despawnBehind: 12,
  waveGapSeconds: [2.8, 3.8], // original: 170-230 frames at 60fps
  waveStagger: 2.2,           // metres of z-offset between lanes in a wave
  coinSpacing: 1.7,
  coinHeight: 0.95,
  trolleyChance: 0.55,

  /* Inspector (same idea as original: gap in "px" → metres on screen) */
  inspectorStartGap: 220,
  inspectorMinGap: 60,
  inspectorMaxGap: 260,
  inspectorCloseWarn: 150,

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
