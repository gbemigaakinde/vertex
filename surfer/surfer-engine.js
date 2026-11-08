/* ============================================================
   surfer/surfer-engine.js   |   KNOWLEDGE SURFER 3D — the game screen

   Draws the 3D world (Three.js), the HUD, handles touch/keyboard,
   and talks to the rest of the Vertex app through a small "host"
   object that js/game.js hands over.

   Entry point:   startSurfer({ container, host })

   host = {
     sound:      { coin(), hit(), speedUp() },     (all optional)
     onGameOver: (stats) => {...},                 stats = { score, distance, xpEarned, bestCombo }
     onQuit:     () => {...},                      player pressed Quit
     onFatal:    (error) => {...},                 3D could not start → host falls back to 2D game
   }
   ============================================================ */
import * as THREE from '../vector/lib/three.module.js';
import { loadAssets } from './surfer-assets.js';
import { GAME, CAMERA, LOOK, OBSTACLE_LOOKS, BIOMES, biomeAt, biomeIndexAt } from './surfer-config.js';
import { createBiomeKit } from './surfer-biomes.js';
import { createSim, laneX } from './surfer-sim.js';
import { createDrive } from './surfer-drive.js';
import { VEHICLE_BY_ID, buildVehicle, buildPitStop, disposeObject } from './surfer-vehicles.js';

/* ───────────── styles (injected once) ───────────── */
const CSS = `
.sf-wrap{position:relative;width:100%;max-width:420px;margin:0 auto;font-family:inherit}
.sf-hud{display:flex;align-items:center;justify-content:space-between;padding:.5rem .75rem;margin-bottom:.375rem;
  background:linear-gradient(135deg,#1e293b,#0f172a);border-radius:10px;border:1px solid #334155}
.sf-cap{font-size:.5rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em}
.sf-lives{font-size:.9rem;letter-spacing:.05em;line-height:1.2;min-height:1.1rem}
.sf-score{font-size:1.5rem;font-weight:900;color:#fbbf24;font-family:var(--font-mono,monospace);line-height:1;text-align:center}
.sf-xp{font-size:.8rem;font-weight:700;color:#38bdf8}.sf-dist{font-size:.8rem;font-weight:700;color:#a78bfa}
.sf-unit{font-size:.65rem;color:#64748b}
.sf-stage{position:relative;width:100%;aspect-ratio:9/14;max-height:calc(100dvh - 205px);min-height:300px;border-radius:12px;
  border:2px solid #334155;background:#0b1220;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
.sf-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.sf-ov{position:absolute;pointer-events:none;font-weight:800;text-shadow:0 1px 4px #000a}
.sf-combo{top:8px;right:10px;font-size:1.05rem;color:#fbbf24}
.sf-warn{top:8px;left:10px;font-size:.62rem;color:#ef4444;animation:sfBlink .35s infinite alternate}
.sf-speed{top:30px;left:0;right:0;text-align:center;font-size:1rem;color:#38bdf8;opacity:0;transition:opacity .25s}
.sf-zone{top:54px;left:50%;transform:translateX(-50%) translateY(-8px);padding:.3rem .8rem;border-radius:999px;background:#0b1220cc;border:1px solid #38bdf8;color:#e0f2fe;font-size:.78rem;text-align:center;white-space:nowrap;opacity:0;transition:opacity .4s,transform .4s}
.sf-zone.on{opacity:1;transform:translateX(-50%) translateY(0)}
.sf-zone small{display:block;font-weight:600;font-size:.6rem;color:#7dd3fc;text-shadow:none}
.sf-flash{inset:0;background:radial-gradient(ellipse at center,#ef444400 40%,#ef4444aa);opacity:0;transition:opacity .35s}
.sf-center{z-index:9;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.5rem;background:#000b;color:#38bdf8;text-align:center;pointer-events:auto}
.sf-center small{color:#94a3b8;font-weight:500;font-size:.8rem;text-shadow:none}
.sf-bar{width:60%;height:6px;border-radius:6px;background:#1e293b;overflow:hidden}
.sf-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#38bdf8,#a78bfa);transition:width .15s}
.sf-hint{margin-top:.5rem;font-size:.6rem;color:#475569;text-align:center;line-height:1.8}
.sf-btns{text-align:center;margin-top:.625rem;display:flex;gap:.5rem;justify-content:center}
.sf-debug{bottom:4px;left:6px;font:600 9px/1.3 monospace;color:#86efac;text-shadow:0 1px 2px #000;white-space:pre}
/* ride dock + pit stop */
.sf-dock{position:absolute;left:6px;right:6px;bottom:6px;z-index:6;display:flex;gap:4px;justify-content:center;flex-wrap:nowrap;pointer-events:none}
.sf-ride{pointer-events:auto;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1 1 0;min-width:0;max-width:74px;padding:.3rem .08rem .26rem;border-radius:12px;border:1px solid #334155;background:linear-gradient(160deg,#0f172acc,#1e293bcc);color:#cbd5e1;font-family:inherit;font-size:.7rem;font-weight:700;line-height:1;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);transition:transform .12s,border-color .15s,background .15s}
.sf-ride i.ph{font-size:1.25rem;line-height:1}
.sf-ride:active{transform:scale(.94)}
.sf-ride.on{border-color:#38bdf8;background:linear-gradient(160deg,#075985dd,#0c4a6edd);color:#e0f2fe;box-shadow:0 0 0 1px #38bdf855,0 4px 16px #0ea5e944}
.sf-ride.dead{opacity:.5;border-style:dashed}
.sf-fuel{display:block;width:100%;height:4px;border-radius:4px;background:#0b1220;overflow:hidden}
.sf-fuel b{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#22c55e,#a3e635)}
.sf-fuel.low b{background:linear-gradient(90deg,#ef4444,#f59e0b)}
.sf-toast{left:0;right:0;top:78px;text-align:center;font-size:.8rem;color:#fde68a;opacity:0;transition:opacity .25s}
.sf-pit{width:min(92%,330px);max-height:94%;overflow:auto;touch-action:pan-y;overscroll-behavior:contain;padding:.75rem .7rem;border-radius:16px;background:linear-gradient(170deg,#0f172af2,#1e293bf2);border:1px solid #38bdf8aa;color:#e2e8f0;text-shadow:none;text-align:left;box-shadow:0 20px 60px #000a}
.sf-pit h3{margin:0;font-size:1.05rem;font-weight:900;color:#38bdf8;display:flex;align-items:center;gap:.4rem}
.sf-pit p{margin:.15rem 0 .65rem;font-size:.72rem;color:#94a3b8;font-weight:600}
.sf-prow{display:flex;align-items:center;gap:.5rem;padding:.38rem .5rem;margin-bottom:.3rem;border-radius:12px;background:#0b1220aa;border:1px solid #334155}
.sf-prow.on{border-color:#38bdf8;background:#0c4a6e66}
.sf-prow .ic{font-size:1.5rem;color:#7dd3fc;width:2rem;text-align:center}
.sf-prow .nm{flex:1;min-width:0;font-size:.8rem;font-weight:800;line-height:1.2}
.sf-prow .nm small{display:block;font-size:.62rem;font-weight:600;color:#86efac}
.sf-pbtn{border:0;border-radius:10px;padding:.45rem .8rem;font:800 .72rem/1 inherit;cursor:pointer;color:#0b1220;background:#38bdf8}
.sf-pbtn.ghost{background:#334155;color:#e2e8f0}
.sf-pbtn.go{position:sticky;bottom:-.75rem;display:block;width:100%;margin-top:.6rem;padding:.75rem;font-size:.85rem;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff}
@keyframes sfBlink{from{opacity:1}to{opacity:.25}}
`;
function injectCss() {
  if (document.getElementById('sf-css')) return;
  const st = document.createElement('style'); st.id = 'sf-css'; st.textContent = CSS; document.head.appendChild(st);
}

/* ───────────── small helpers ───────────── */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function radialTexture(stops, size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([t, col]) => r.addColorStop(t, col));
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function labelTexture(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#0b1220cc'; g.strokeStyle = color; g.lineWidth = 6;
  g.beginPath(); if (g.roundRect) g.roundRect(6, 6, 244, 84, 22); else g.rect(6, 6, 244, 84); g.fill(); g.stroke();
  g.fillStyle = color; g.font = '800 46px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/* a tiny "studio" so shiny gold / metal looks right without any HDRI file */
function buildEnvironment(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 14, 30), new THREE.MeshBasicMaterial({ color: 0x1b2433, side: THREE.BackSide })));
  const panel = (w, h, x, y, z, rx, ry, c) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(6), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m);
  };
  panel(12, 3, 0, 6.5, 0, Math.PI / 2, 0, 0xfff1d6);
  panel(4, 6, -10, 3, 2, 0, Math.PI / 2, 0xbcd4ff);
  panel(4, 6, 10, 3, -3, 0, -Math.PI / 2, 0xffe0b0);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.03).texture;
  pm.dispose(); env.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return tex;
}

/* ============================================================
   MAIN ENTRY
   ============================================================ */
export function startSurfer({ container, host = {} }) {
  const api = { destroy() {}, togglePause() {}, ready: null };
  api.ready = init(container, host, api);
  return api;
}

async function init(container, host, api) {
  injectCss();
  const sound = host.sound || {};
  const debugOn = /surferdebug/i.test(location.search) || localStorage.getItem('surferDebug') === '1';

  /* ── screen markup ── */
  container.innerHTML = `
  <div class="sf-wrap">
    <div class="sf-hud">
      <div><div class="sf-cap">Lives</div><div class="sf-lives" data-sf="lives"></div></div>
      <div><div class="sf-cap" style="text-align:center">Score</div><div class="sf-score" data-sf="score">0</div></div>
      <div style="text-align:right"><div class="sf-cap">XP / Dist</div>
        <div><span class="sf-xp" data-sf="xp">0</span><span class="sf-unit"> xp · </span><span class="sf-dist" data-sf="dist">0</span><span class="sf-unit">m</span></div></div>
    </div>
    <div class="sf-stage" data-sf="stage">
      <canvas class="sf-canvas" data-sf="canvas"></canvas>
      <div class="sf-ov sf-flash" data-sf="flash"></div>
      <div class="sf-ov sf-zone" data-sf="zone"></div>
      <div class="sf-ov sf-combo" data-sf="combo"></div>
      <div class="sf-ov sf-warn" data-sf="warn" style="display:none"><i class="ph ph-warning"></i> INSPECTOR CLOSE!</div>
      <div class="sf-ov sf-speed" data-sf="speed"><i class="ph ph-lightning"></i> SPEED UP!</div>
      <div class="sf-ov sf-toast" data-sf="toast"></div>
      <div class="sf-dock" data-sf="dock"></div>
      <div class="sf-ov sf-debug" data-sf="debug"></div>
      <div class="sf-ov sf-center" data-sf="center"><div style="font-size:1.1rem">Loading 3D world…</div><div class="sf-bar"><i data-sf="bar"></i></div><small data-sf="loadtxt"></small></div>
    </div>
    <div class="sf-hint">← → / swipe sideways: change lane &nbsp;|&nbsp; ↑ / swipe up: jump &nbsp;|&nbsp; ↓ / swipe down: slide &nbsp;|&nbsp; P: pause</div>
    <div class="sf-hint" data-sf="ridehint" style="display:none;margin-top:0">Tap a ride below the track (or number keys 1-7) to get on or off. Fuel is refilled at every Pit Stop.</div>
    <div class="sf-btns">
      <button data-sf="pauseBtn" class="btn bg-gray-500" style="font-size:.8125rem;"><i class="ph ph-pause"></i> Pause</button>
      <button data-sf="quitBtn"  class="btn bg-gray-500" style="font-size:.8125rem;"><i class="ph ph-x"></i> Quit</button>
    </div>
  </div>`;
  const $ = k => container.querySelector(`[data-sf="${k}"]`);
  const ui = { lives: $('lives'), score: $('score'), xp: $('xp'), dist: $('dist'), stage: $('stage'), canvas: $('canvas'),
    flash: $('flash'), zone: $('zone'), combo: $('combo'), warn: $('warn'), speed: $('speed'), debug: $('debug'), center: $('center'),
    bar: $('bar'), loadtxt: $('loadtxt'), toast: $('toast'), dock: $('dock'), pauseBtn: $('pauseBtn'), quitBtn: $('quitBtn') };

  let destroyed = false, rafId = 0, assets = null, renderer = null, ro = null, envTex = null;
  let stageW = 0;                  // current width of the game stage in px (kept up to date by resize())
  let paused = false, ending = false, endT = 0, finished = false, pitOpen = false, toastTimer = 0;
  const disposables = [];
  const rideModels = {};           // id → built 3D ride (created the first time it is used)
  const listeners = [];
  let drive = null;                // the driving engine (surfer-drive.js), created once the scene exists
  const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); listeners.push([t, ev, fn, opt]); };

  function destroy() {
    if (destroyed) return; destroyed = true;
    cancelAnimationFrame(rafId);
    listeners.forEach(([t, ev, fn, opt]) => t.removeEventListener(ev, fn, opt));
    if (ro) ro.disconnect();
    if (drive) { try { drive.destroy(); } catch (e) {} }
    disposables.forEach(d => { try { d.dispose(); } catch (e) {} });
    Object.values(rideModels).forEach(m => disposeObject(m.group));
    clearTimeout(toastTimer);
    if (envTex) envTex.dispose();
    if (assets) assets.dispose();
    if (renderer) { renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {} }
  }
  api.destroy = destroy;

  /* ── renderer (throws if WebGL is unavailable → host falls back to the 2D game) ── */
  const lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const maxDpr = lowEnd ? 1.25 : 2;
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  try {
    renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: !lowEnd, powerPreference: 'high-performance' });
  } catch (e) { destroy(); throw e; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = LOOK.exposure;
  renderer.setPixelRatio(dpr);
  on(ui.canvas, 'webglcontextlost', e => { e.preventDefault(); destroy(); if (host.onFatal) host.onFatal(new Error('WebGL context lost')); });

  /* ── load models (with progress) ── */
  assets = await loadAssets((f, name) => {
    ui.bar.style.width = Math.round(f * 100) + '%';
    ui.loadtxt.textContent = name.replace(/_/g, ' ');
  });
  if (destroyed) { return; }
  if (assets.missing.length) console.info(`[surfer] ${assets.realCount}/${assets.total} models loaded. Using stand-ins for:`, assets.missing.join(', '));

  /* ── scene, lights, camera ── */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(LOOK.fogColor);
  scene.fog = new THREE.Fog(LOOK.fogColor, LOOK.fogNear, LOOK.fogFar);
  if (!lowEnd) { envTex = buildEnvironment(renderer); scene.environment = envTex; }   // shiny reflections; auto-dropped below if the device is slow
  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x1b2230, 0.75); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0dd, 1.7); key.position.set(-4, 9, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7aa7ff, 0.5); rim.position.set(5, 4, -8); scene.add(rim);

  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 0.64, 0.1, 160);
  let baseFov = CAMERA.fov, fovKick = 0;
  function resize() {
    const w = Math.max(2, ui.stage.clientWidth), h = Math.max(2, ui.stage.clientHeight); stageW = w;
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    camera.aspect = w / h;
    /* make sure all 3 lanes always fit, even on a narrow phone */
    const need = Math.tan(Math.atan((8.6 / 2) / 9.0));            // half-width wanted at 9 m
    baseFov = clamp(Math.max(CAMERA.fov, 2 * Math.atan(need / camera.aspect) * 180 / Math.PI), 40, 88);
    camera.fov = baseFov + fovKick; camera.updateProjectionMatrix();
    if (paused) renderer.render(scene, camera);          // resizing clears the canvas, so redraw once
  }
  ro = new ResizeObserver(resize); ro.observe(ui.stage);
  resize();

  /* ── shared little textures ── */
  const blobTex = radialTexture([[0, 'rgba(0,0,0,0.55)'], [0.6, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]);
  const glowTex = radialTexture([[0, 'rgba(255,220,110,0.9)'], [0.4, 'rgba(255,190,60,0.35)'], [1, 'rgba(255,170,0,0)']]);
  const dotTex  = radialTexture([[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']], 32);
  const jumpLabel = labelTexture('▲ JUMP', '#f87171'), slideLabel = labelTexture('▼ SLIDE', '#fbbf24');
  disposables.push(blobTex, glowTex, dotTex, jumpLabel, slideLabel);
  const sunTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.16, 'rgba(255,255,235,0.95)'], [0.21, 'rgba(255,235,170,0.5)'], [0.5, 'rgba(255,215,130,0.18)'], [1, 'rgba(255,200,100,0)']], 128);
  const trainLabel = labelTexture('◀ DODGE ▶', '#60a5fa');
  disposables.push(sunTex, trainLabel);
  const sunMat = new THREE.SpriteMaterial({ map: sunTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 });
  const sun = new THREE.Sprite(sunMat); sun.scale.set(46, 46, 1); sun.position.set(20, 36, -128); scene.add(sun);
  const lampMat = new THREE.SpriteMaterial({ map: dotTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xfff1c0, opacity: 0.8 });
  const trainLabelMat = new THREE.SpriteMaterial({ map: trainLabel, depthWrite: false, transparent: true });
  disposables.push(sunMat, lampMat, trainLabelMat);
  const kit = createBiomeKit(); disposables.push(kit);
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const jumpLabelMat = new THREE.SpriteMaterial({ map: jumpLabel, depthWrite: false, transparent: true });
  const slideLabelMat = new THREE.SpriteMaterial({ map: slideLabel, depthWrite: false, transparent: true });
  const blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
  disposables.push(blobMat, glowMat, jumpLabelMat, slideLabelMat, blobGeo);
  const makeBlob = (sx, sz) => { const m = new THREE.Mesh(blobGeo, blobMat); m.scale.set(sx, 1, sz); m.position.y = 0.03; return m; };

  /* ============================================================
     WORLD TILES  (track + walls + arch + lamp, recycled forever)
     ============================================================ */
  const tileLen = LOOK.tileLength, tileCount = LOOK.tilesAhead + 3;
  const tiles = [];
  let serial = 0;
  const wallX = 3.9 + 1.1;
  /* the player's garage: only rides they actually own can ever appear */
  const garageIn = host.garage || {};
  const owned = (Array.isArray(garageIn.owned) ? garageIn.owned : []).filter((id, i, a) => VEHICLE_BY_ID[id] && a.indexOf(id) === i);
  const rideStates = {};
  for (const id of owned) { const d = VEHICLE_BY_ID[id]; rideStates[id] = { id, def: d, fuel: d.fuel, hp: d.hp }; }
  const sim = createSim(Math.random, { pitEnabled: owned.length > 0 });
  const S = sim.state, P = S.player;
  let usedRide = false;
  for (let i = 0; i < tileCount; i++) {
    const g = new THREE.Group();
    const core = assets.make('track_segment'); g.add(core);
    const wl = assets.make('tunnel_wall'); wl.position.x = -wallX; g.add(wl);
    const wr = assets.make('tunnel_wall'); wr.position.x = wallX; wr.scale.x = -1; g.add(wr);   // mirrored
    const arch = assets.make('tunnel_arch'); arch.position.z = -tileLen / 2; g.add(arch);
    const lamp = assets.make('ceiling_lamp'); lamp.position.set(0, LOOK.lampHeight, 0); g.add(lamp);
    const sig = assets.make('signal_light'); g.add(sig);
    g.userData = { arch, lamp, sig, core, walls: [wl, wr], deco: null };
    scene.add(g); tiles.push(g);
  }
  /* a tile takes the look of the zone it sits in (zone = metres scrolled / zone length) */
  function placeTile(g, z) {
    g.position.z = z; const n = serial++, u = g.userData;
    const zone = BIOMES[biomeIndexAt(S.scroll - z)];
    const tunnel = zone.id === 'station';
    u.walls.forEach(w => { w.visible = tunnel; });
    u.arch.visible = tunnel && n % LOOK.archEveryTiles === 0;
    u.lamp.visible = tunnel && n % LOOK.lampEveryTiles === 0;
    u.sig.visible  = tunnel && n % LOOK.signalEveryTiles === 0;
    u.sig.position.set(((n / LOOK.signalEveryTiles) % 2 < 1 ? -1 : 1) * 3.55, 0, 2);
    u.core.visible = !zone.water;                                  // no rails on the river
    if (u.deco) { g.remove(u.deco); u.deco = null; }
    if (!tunnel) { u.deco = kit.make(zone.id, n); g.add(u.deco); }
  }
  tiles.forEach((g, i) => placeTile(g, tileLen * (1 - i)));          // one tile behind the runner, the rest ahead

  /* ============================================================
     CHARACTERS
     ============================================================ */
  /* runner: all 5 poses live in the group; we show exactly one */
  const runner = new THREE.Group();
  const poses = {};
  for (const k of ['run_a', 'run_b', 'jump', 'slide', 'stumble']) { poses[k] = assets.make('player_' + k); poses[k].visible = false; runner.add(poses[k]); }
  const runnerBlob = makeBlob(1.0, 1.0); runner.add(runnerBlob);
  const rideBlob = makeBlob(1, 1); rideBlob.visible = false; scene.add(rideBlob);
  scene.add(runner);
  const boat = assets.make('player_boat'); boat.visible = false; scene.add(boat);
  let boatT = 0, wakeT = 0;

  /* inspector + dog + leash */
  const insp = new THREE.Group(), inspPoses = { a: assets.make('inspector_run_a'), b: assets.make('inspector_run_b') };
  inspPoses.b.visible = false; insp.add(inspPoses.a, inspPoses.b); insp.add(makeBlob(1.1, 1.1));
  const dogG = new THREE.Group(), dogPoses = { a: assets.make('dog_run_a'), b: assets.make('dog_run_b') };
  dogPoses.b.visible = false; dogG.add(dogPoses.a, dogPoses.b); dogG.add(makeBlob(0.8, 1.1));
  const leashGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  const leash = new THREE.Line(leashGeo, new THREE.LineBasicMaterial({ color: 0x6b3f1d }));
  leash.frustumCulled = false; disposables.push(leashGeo, leash.material);
  scene.add(insp, dogG, leash);

  /* ============================================================
     OBSTACLES + COINS  (created/removed to match the simulation)
     ============================================================ */
  const live = new Map();              // sim object id → { root, name }
  const pool = new Map();              // model name → spare copies
  const take = name => { const a = pool.get(name); return a && a.length ? a.pop() : assets.make(name); };
  const give = (name, o) => { if (!pool.has(name)) pool.set(name, []); pool.get(name).push(o); };

  function addObject(o) {
    const root = new THREE.Group();
    let name;
    if (o.type === 'pit') {
      name = 'pit';
      const st = buildPitStop(); st.scale.setScalar(0.85); st.rotation.y = 0.18; root.add(st);
    } else if (o.type === 'coin') {
      name = 'coin';
      const m = take(name); root.add(m); root.userData.model = m;
      const glow = new THREE.Sprite(glowMat); glow.scale.set(1.5, 1.5, 1); root.add(glow);
    } else {
      const looks = OBSTACLE_LOOKS[o.kind][BIOMES[o.zone].water ? 'water' : 'land'];
      name = looks[o.look % looks.length];
      root.add(take(name));
      const mat = o.kind === 'jump' ? jumpLabelMat : o.kind === 'slide' ? slideLabelMat : trainLabelMat;
      const lab = new THREE.Sprite(mat);
      if (o.kind === 'train') {
        lab.scale.set(1.45, 0.54, 1); lab.position.set(0, 4.0, 3.6);
        const water = BIOMES[o.zone].water;
        const lamps = water ? [[0, 1.6, 4.5]] : [[-0.66, 1.18, 4.7], [0.66, 1.18, 4.7]];      // headlights shine through haze
        for (const [lx, ly, lz] of lamps) { const gl = new THREE.Sprite(lampMat); gl.scale.set(0.8, 0.8, 1); gl.position.set(lx, ly, lz); root.add(gl); }
      } else { lab.scale.set(1.5, 0.56, 1); lab.position.y = o.kind === 'jump' ? 1.55 : 2.2; }
      root.add(lab);
    }
    scene.add(root);
    live.set(o.id, { root, name, o });
  }
  function removeObject(id) {
    const e = live.get(id); if (!e) return;
    scene.remove(e.root);
    if (e.name === 'pit') disposeObject(e.root);
    else if (e.name !== 'coin') give(e.name, e.root.children[0]);
    else give('coin', e.root.userData.model);
    live.delete(id);
  }

  /* ── particles (one draw call) ── */
  const MAXP = 260;
  const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3);
  const pVel = new Float32Array(MAXP * 3), pLife = new Float32Array(MAXP), pMax = new Float32Array(MAXP);
  const pBase = new Float32Array(MAXP * 3);
  let pHead = 0;
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.2, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; scene.add(points);
  disposables.push(pGeo, pMat);
  function burst(x, y, z, n, color, spread, up, life = 0.55) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const k = pHead; pHead = (pHead + 1) % MAXP;
      pPos[k * 3] = x; pPos[k * 3 + 1] = y; pPos[k * 3 + 2] = z;
      pVel[k * 3] = (Math.random() - 0.5) * spread; pVel[k * 3 + 1] = Math.random() * up; pVel[k * 3 + 2] = (Math.random() - 0.5) * spread;
      pBase[k * 3] = c.r; pBase[k * 3 + 1] = c.g; pBase[k * 3 + 2] = c.b;
      pLife[k] = pMax[k] = life * (0.6 + Math.random() * 0.6);
    }
  }
  function updateParticles(dt) {
    for (let k = 0; k < MAXP; k++) {
      if (pLife[k] <= 0) { pCol[k * 3] = pCol[k * 3 + 1] = pCol[k * 3 + 2] = 0; continue; }
      pLife[k] -= dt;
      pVel[k * 3 + 1] -= 9 * dt;
      pPos[k * 3] += pVel[k * 3] * dt; pPos[k * 3 + 1] += pVel[k * 3 + 1] * dt; pPos[k * 3 + 2] += pVel[k * 3 + 2] * dt + S.worldSpeed * dt * 0.6;
      const a = Math.max(0, pLife[k] / pMax[k]);
      pCol[k * 3] = pBase[k * 3] * a; pCol[k * 3 + 1] = pBase[k * 3 + 1] * a; pCol[k * 3 + 2] = pBase[k * 3 + 2] * a;
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  }

  /* ============================================================
     INPUT
     ============================================================ */
  /* ── ride helpers: toast, dock, mount, pit stop ── */
  function toast(txt) {
    ui.toast.textContent = txt; ui.toast.style.opacity = '1';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { ui.toast.style.opacity = '0'; }, 1700);
  }
  function tryMount(id) {
    if (paused || ending || destroyed) return;
    const rs = rideStates[id]; if (!rs) return;
    if (S.ride && S.ride.id === id) { sim.dismount('manual'); return; }
    if (rs.def.water && !biomeAt(S.scroll).water) { toast('The boat only works in the River Crossing'); return; }
    if (rs.fuel <= 0) { toast('Out of fuel. Refuel at the next pit stop'); return; }
    if (rs.def.hp > 0 && rs.hp <= 0) { toast('Wrecked. Repair at the next pit stop'); return; }
    if (sim.mount(rs)) usedRide = true;
  }
  const isolate = el => ['touchstart', 'touchmove', 'touchend', 'mousedown', 'pointerdown'].forEach(t => on(el, t, e => e.stopPropagation()));
  isolate(ui.dock); isolate(ui.center);
  on(ui.dock, 'click', e => { e.stopPropagation(); const b = e.target.closest('[data-ride]'); if (b) tryMount(b.dataset.ride); });
  ui.dock.style.display = owned.length ? 'flex' : 'none';
  const rh = $('ridehint'); if (rh && owned.length) rh.style.display = 'block';
  /* Long names ("Motorbike", "Helicopter") do not fit 7 buttons on a narrow phone, so the dock switches to short names
     (Bike / Moto / Heli) whenever a full name would be cut off. The text is measured with the real font, and the answer is
     only recalculated when the screen width or the number of rides changes. The full name stays in the aria-label. */
  const DOCK_ABBR = { bicycle: 'Bike', motorbike: 'Moto', helicopter: 'Heli' };
  const measureCtx = document.createElement('canvas').getContext('2d');
  let dockShort = false, dockKey = '';
  function dockHtml() {
    const n = owned.length, key = stageW + '|' + n;
    if (key !== dockKey && stageW > 0) {
      dockKey = key;
      const btnW = Math.min((stageW - 12 - 4 * (n - 1)) / Math.max(1, n), 74);                  // width of one button (max-width is 74px)
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      measureCtx.font = `700 ${rem * 0.7}px ${getComputedStyle(ui.dock).fontFamily}`;     // same size / weight as .sf-ride in the CSS
      dockShort = owned.some(id => DOCK_ABBR[id] && measureCtx.measureText(rideStates[id].def.short).width > btnW - 7);   // 7px = padding + border
    }
    return owned.map(id => {
      const r = rideStates[id], d = r.def, on_ = S.ride && S.ride.id === id, pct = Math.round(r.fuel / d.fuel * 100);
      const dead = r.fuel <= 0 || (d.hp > 0 && r.hp <= 0);
      const label = dockShort && DOCK_ABBR[id] ? DOCK_ABBR[id] : d.short;
      return `<button type="button" class="sf-ride${on_ ? ' on' : ''}${dead ? ' dead' : ''}" data-ride="${id}" aria-label="${on_ ? 'Get off ' : 'Ride '}${d.name}"><i class="ph ph-${d.icon}"></i>${label}<span class="sf-fuel${pct < 25 ? ' low' : ''}"><b style="width:${pct}%"></b></span></button>`;
    }).join('');
  }
  function pitHtml() {
    const rows = owned.map(id => {
      const d = rideStates[id].def, on_ = S.ride && S.ride.id === id;
      return `<div class="sf-prow${on_ ? ' on' : ''}"><i class="ph ph-${d.icon} ic"></i><div class="nm">${d.name}<small>Fuel full${d.hp > 0 && d.hp < 99 ? ' · armour ' + d.hp : ''}</small></div>${on_ ? '<button class="sf-pbtn ghost" data-take="">Park it</button>' : `<button class="sf-pbtn" data-take="${id}">Take</button>`}</div>`;
    }).join('');
    return `<div class="sf-pit"><h3><i class="ph ph-gas-pump"></i> PIT STOP</h3><p>Tanks filled and repairs done. Pick your ride for the next stretch.</p>${rows}<button class="sf-pbtn go" data-go="1">Back on the track</button></div>`;
  }
  function openPit() {
    if (ending || destroyed || pitOpen) return;
    for (const id of owned) { const r = rideStates[id]; r.fuel = r.def.fuel; r.hp = r.def.hp; }    // free refuel + repair
    pitOpen = true; paused = true; ui.pauseBtn.disabled = true; ui.dock.style.visibility = 'hidden';
    ui.center.innerHTML = pitHtml(); ui.center.style.display = 'flex';
  }
  function closePit() {
    if (!pitOpen) return;
    pitOpen = false; paused = false; ui.pauseBtn.disabled = false; ui.dock.style.visibility = '';
    ui.center.style.display = 'none'; ui.center.innerHTML = '';
    lastT = performance.now(); P.invincible = Math.max(P.invincible, 1.4);
  }
  on(ui.center, 'click', e => {
    if (!pitOpen) return; e.stopPropagation();
    const t = e.target.closest('[data-take]'), g = e.target.closest('[data-go]');
    if (t) {
      const id = t.dataset.take;
      if (!id) sim.dismount('manual'); else if (sim.mount(rideStates[id])) usedRide = true;
      ui.center.innerHTML = pitHtml();
    } else if (g) closePit();
  });

  const pauseOv = () => {
    ui.center.style.display = paused ? 'flex' : 'none';
    ui.center.innerHTML = paused ? '<div style="font-size:1.6rem"><i class="ph ph-pause"></i> PAUSED</div><small>Tap the screen or press P to resume</small>' : '';
    ui.pauseBtn.innerHTML = paused ? '<i class="ph ph-play"></i> Resume' : '<i class="ph ph-pause"></i> Pause';
  };
  function togglePause() { if (ending || destroyed || pitOpen) return; paused = !paused; lastT = performance.now(); pauseOv(); }
  api.togglePause = togglePause;
  ui.center.style.display = 'none'; ui.center.innerHTML = '';

  on(document, 'keydown', e => {
    if (destroyed) return;
    const c = e.code;
    if (drive && !paused && drive.key(e, true)) { e.preventDefault(); return; }
    if (c === 'KeyC' && drive) { e.preventDefault(); drive.key(e, true); return; }
    if (['ArrowLeft', 'KeyA'].includes(c))  { e.preventDefault(); if (!paused) sim.changeLane(-1); }
    else if (['ArrowRight', 'KeyD'].includes(c)) { e.preventDefault(); if (!paused) sim.changeLane(1); }
    else if (['ArrowUp', 'KeyW', 'Space'].includes(c)) { e.preventDefault(); if (!paused) sim.jump(); }
    else if (['ArrowDown', 'KeyS'].includes(c)) { e.preventDefault(); if (!paused) sim.slide(); }
    else if (c === 'KeyP') { e.preventDefault(); togglePause(); }
    else if (/^Digit[1-9]$/.test(c) && owned[+c.slice(5) - 1]) { tryMount(owned[+c.slice(5) - 1]); }
  });
  on(document, 'keyup', e => { if (drive) drive.key(e, false); });
  on(document, 'visibilitychange', () => { if (document.hidden && !paused) togglePause(); });

  let sw = null;
  const swipeAction = (dx, dy) => {
    if (Math.abs(dx) > Math.abs(dy)) sim.changeLane(dx < 0 ? -1 : 1); else if (dy < 0) sim.jump(); else sim.slide();
  };
  on(ui.stage, 'touchstart', e => { e.preventDefault(); const t = e.touches[0]; sw = { x: t.clientX, y: t.clientY, done: false }; }, { passive: false });
  on(ui.stage, 'touchmove', e => {
    e.preventDefault(); if (!sw || sw.done || paused || (drive && drive.isOrbit())) return;
    const t = e.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
    if (Math.hypot(dx, dy) > 26) { sw.done = true; swipeAction(dx, dy); }       // reacts mid-swipe → feels snappy
  }, { passive: false });
  on(ui.stage, 'touchend', e => {
    e.preventDefault(); if (!sw) return;
    const wasDone = sw.done; sw = null;
    if (paused) { togglePause(); return; }
    if (drive && drive.isOrbit()) return;
    if (!wasDone) sim.jump();                                                     // plain tap = jump
  }, { passive: false });
  on(ui.stage, 'click', e => { if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return; if (paused) togglePause(); else if (!(drive && drive.isOrbit())) sim.jump(); });
  on(ui.pauseBtn, 'click', togglePause);
  on(ui.quitBtn, 'click', () => { destroy(); if (host.onQuit) host.onQuit(); });

  /* ============================================================
     PER-FRAME
     ============================================================ */
  let lastT = performance.now(), runClock = 0, stride = 0, shake = 0, camX = 0, inspX = 0;
  let hudCache = {}, comboShown = 0, speedToast = 0, warnShown = false;
  let frames = 0, accDt = 0, dbgT = 0;
  const camBase = new THREE.Vector3(...CAMERA.position), lookBase = new THREE.Vector3(...CAMERA.lookAt);
  const look = new THREE.Vector3();
  const camOff = new THREE.Vector3();
  scene.add(camera);
  drive = createDrive({ stage: ui.stage, sim, camera, scene, on, toast });
  const rideHint = $('ridehint'); let hintShownFor = '#';
  let rideShown = null, rideT = 1;
  const ease = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const getRide = id => { if (!rideModels[id]) { const m = buildVehicle(id); m.def = VEHICLE_BY_ID[id]; m.group.visible = false; scene.add(m.group); rideModels[id] = m; } return rideModels[id]; };

  function setText(k, v, el) { if (hudCache[k] !== v) { hudCache[k] = v; el.textContent = v; } }
  function setHTML(k, v, el) { if (hudCache[k] !== v) { hudCache[k] = v; el.innerHTML = v; } }

  function handleEvents() {
    for (const e of S.events) {
      if (e.type === 'coin') {
        burst(e.x, e.y, 0, 16, 0xffd24a, 5, 4);
        if (sound.coin) try { sound.coin(); } catch (x) {}
      } else if (e.type === 'hit') {
        burst(P.x, 0.9, 0, 22, 0xff4d4d, 7, 5, 0.7);
        shake = e.kind === 'train' ? CAMERA.shakeOnHit * 1.5 : CAMERA.shakeOnHit;
        if (e.kind === 'police') toast('Caught by the inspector! Keep your speed up');
        if (drive) drive.impact();
        if (e.kind === 'train') burst(P.x, 1.1, 0.4, 34, 0xffa83a, 9, 6, 0.8);
        ui.flash.style.opacity = '1'; setTimeout(() => { ui.flash.style.opacity = '0'; }, 120);
        if (sound.hit) try { sound.hit(); } catch (x) {}
      } else if (e.type === 'jump' || e.type === 'land') {
        burst(P.x, 0.08, 0, 7, 0xb7c3d6, 2.4, 1.2, 0.4);
      } else if (e.type === 'slide') {
        burst(P.x, 0.08, 0.2, 10, 0xb7c3d6, 2.6, 0.8, 0.45);
      } else if (e.type === 'lane') {
        if (drive) drive.kick(e.dir);
        burst(P.x, 0.5, 0, 5, 0x38bdf8, 2, 1, 0.3);
      } else if (e.type === 'speedup') {
        speedToast = 1.6; fovKick = 5;
        if (sound.speedUp) try { sound.speedUp(); } catch (x) {}
      } else if (e.type === 'mount') {
        burst(P.x, 0.2, 0.2, 14, 0xb7c3d6, 3, 1.4, 0.5); toast(VEHICLE_BY_ID[e.id].name + ' ready');
      } else if (e.type === 'dismount') {
        burst(P.x, 0.3, 0.2, 12, 0xb7c3d6, 3, 1.4, 0.5);
        if (e.reason === 'fuel') toast('Out of fuel. Refuel at the next pit stop');
        else if (e.reason === 'wrecked') { toast('Wrecked! Repair at the next pit stop'); shake = CAMERA.shakeOnHit; }
        else if (e.reason === 'crash') toast('You came off!');
      } else if (e.type === 'smash') {
        burst(e.x, 0.8, 0, 26, 0xffb347, 8, 5, 0.7); burst(e.x, 0.5, 0, 12, 0xcbd5e1, 5, 3, 0.6); shake = 0.22;
        if (sound.hit) try { sound.hit(); } catch (x) {}
      } else if (e.type === 'pit') {
        openPit();
      } else if (e.type === 'gameover') {
        ending = true; endT = 0;
      }
    }
    S.events.length = 0;
  }

  function syncObjects(dt) {
    const seen = new Set();
    for (const o of S.objects) {
      seen.add(o.id);
      let e = live.get(o.id);
      if (!e) { addObject(o); e = live.get(o.id); }
      const r = e.root;
      if (o.type === 'coin') {
        const m = r.userData.model;
        m.rotation.y = S.time * 3.2 + o.phase;
        r.position.set(o.x, GAME.coinHeight + Math.sin(S.time * 4 + o.phase) * 0.06, o.z);
      } else r.position.set(o.x, 0, o.z);
    }
    for (const id of [...live.keys()]) if (!seen.has(id)) removeObject(id);
  }

  /* ── zones: sky, fog and light blend smoothly as the next zone approaches ── */
  const ZONE_ICON = { station: 'train', desert: 'sun', forest: 'tree-evergreen', river: 'waves', snow: 'snowflake' };
  const ZONE_HINT = { station: 'Back in the rail tunnel', desert: 'Hot rails and fast trains', forest: 'Pine forest ahead', river: 'Hop in the boat!', snow: 'Icy mountain pass' };
  const cur = { fog: new THREE.Color(LOOK.fogColor), hemiS: new THREE.Color(0xcfe0ff), hemiG: new THREE.Color(0x1b2230), key: new THREE.Color(0xfff0dd), sun: new THREE.Color(0xffffff), tmp: new THREE.Color() };
  let announced = 'station', zoneToast = 0, zoneTimer = 0;
  function applyZone(dt, snap) {
    const b = biomeAt(S.scroll + 26), k = snap ? 1 : 1 - Math.exp(-1.7 * dt);
    cur.fog.lerp(cur.tmp.set(b.fog), k); scene.fog.color.copy(cur.fog); scene.background.copy(cur.fog);
    scene.fog.near += (b.fogNear - scene.fog.near) * k; scene.fog.far += (b.fogFar - scene.fog.far) * k;
    cur.hemiS.lerp(cur.tmp.set(b.hemi[0]), k); cur.hemiG.lerp(cur.tmp.set(b.hemi[1]), k);
    hemi.color.copy(cur.hemiS); hemi.groundColor.copy(cur.hemiG); hemi.intensity += (b.hemiI - hemi.intensity) * k;
    cur.key.lerp(cur.tmp.set(b.key), k); key.color.copy(cur.key); key.intensity += (b.keyI - key.intensity) * k;
    renderer.toneMappingExposure += (b.exposure - renderer.toneMappingExposure) * k;
    if (b.sun) cur.sun.lerp(cur.tmp.set(b.sun), k);
    sunMat.color.copy(cur.sun); sunMat.opacity += ((b.sun ? 0.95 : 0) - sunMat.opacity) * k;
    if (b.id !== announced) {
      announced = b.id;
      ui.zone.innerHTML = `<i class="ph ph-${ZONE_ICON[b.id] || 'map-pin'}"></i> ${b.name}<small>${ZONE_HINT[b.id] || ''}</small>`;
      ui.zone.classList.add('on'); zoneToast = 3.2;
    }
    if (zoneToast > 0) { zoneToast -= dt; if (zoneToast <= 0) ui.zone.classList.remove('on'); }
  }
  function updateBoat(dt, bobBase) {
    const inRiver = biomeAt(S.scroll).water && !ending && !(S.ride && (S.ride.def.fly || S.ride.def.water));
    const prev = boatT;
    boatT += ((inRiver ? 1 : 0) - boatT) * (1 - Math.exp(-6 * dt));
    if (Math.abs(boatT - (inRiver ? 1 : 0)) < 0.01) boatT = inRiver ? 1 : 0;
    if ((prev === 0) !== (boatT === 0) || (prev < 0.5) !== (boatT < 0.5)) burst(P.x, 0.2, 0.3, 18, 0xd8f1ff, 4, 3.5, 0.6);       // splash when you get in / out
    boat.visible = boatT > 0.01;
    if (boat.visible) {
      const lat = laneX(P.lane) - P.x, t = S.time;
      boat.position.set(P.x, -0.12 - (1 - boatT) * 0.75 + Math.sin(t * 3.1) * 0.025, 0.1);
      boat.rotation.set(Math.sin(t * 1.9) * 0.02 + (P.jumping ? -0.04 : 0), -lat * 0.12, -lat * 0.12 + Math.sin(t * 2.4) * 0.025);
      const pad = boat.getObjectByName('paddle'); if (pad) { pad.rotation.x = Math.sin(t * 3.4) * 0.28; pad.rotation.y = Math.sin(t * 1.7) * 0.12; }
      wakeT -= dt;
      if (wakeT <= 0 && !ending) { wakeT = 0.07; burst(P.x + (Math.random() - 0.5) * 0.9, 0.1, 1.3, 2, 0xd8f1ff, 1.6, 1.4, 0.5); }
    }
    return boatT;
  }

  function frame(now) {
    if (destroyed) return;
    rafId = requestAnimationFrame(frame);
    if (!container.isConnected) { destroy(); return; }                // screen was replaced → clean up

    let dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
    if (paused) return;                                              // nothing to draw while paused (saves battery)

    /* adaptive quality: if the phone is struggling, first drop the shiny
       reflections, then lower the resolution. Checked about once a second. */
    frames++; accDt += dt;
    if (accDt >= 1.0 && frames >= 4) {
      const avg = accDt / frames, top = Math.min(window.devicePixelRatio || 1, maxDpr);
      if (avg > 0.034) {                                           // slower than ~30 fps
        if (scene.environment) { scene.environment = null; if (envTex) { envTex.dispose(); envTex = null; } }
        else if (dpr > 0.8) { dpr = Math.max(0.8, dpr * 0.8); resize(); }
      } else if (avg < 0.0145 && dpr < top) { dpr = Math.min(top, dpr * 1.1); resize(); }
      frames = 0; accDt = 0;
    }

    /* world speed eases to zero once you've lost your last life */
    let worldMul = 1;
    if (ending) { endT += dt; worldMul = Math.max(0, 1 - endT / 0.9); }
    else { drive.update(dt, false); sim.step(dt); }
    handleEvents();
    applyZone(dt, false); kit.update(dt);

    const speed = S.worldSpeed * worldMul, dz = speed * dt;

    /* scroll tiles */
    for (const g of tiles) {
      g.position.z += dz;
      if (g.position.z > tileLen * 1.5) placeTile(g, g.position.z - tileCount * tileLen);
    }
    syncObjects(dt);

    /* ── runner ── */
    const stridePeriod = clamp(0.16 * (GAME.baseSpeed / S.origSpeed) ** 0.6, 0.08, 0.16);
    runClock += dt * worldMul; stride = Math.floor(runClock / stridePeriod) % 2;
    let pose = stride ? 'run_b' : 'run_a';
    const inBoat = updateBoat(dt) > 0.5;
    if (inBoat && pose !== 'run_b') pose = 'run_a'; else if (inBoat) pose = 'run_a';          // no leg swing while sitting in the boat
    if (P.stumble > 0 || ending) pose = 'stumble'; else if (P.sliding) pose = 'slide'; else if (P.jumping) pose = 'jump';
    const rs = S.ride, rdef = rs ? rs.def : null;
    const onBoat = boatT > 0.5 && !(rdef && rdef.fly);                       // in the river everyone rides the boat instead
    const seated = !!(rdef && rdef.rider && !onBoat);
    if (seated && pose !== 'stumble') pose = 'jump';                          // knees bent on the saddle
    for (const k in poses) poses[k].visible = (k === pose);
    const tx = laneX(P.lane), lateral = tx - P.x;
    const bob = !inBoat && !rs && (pose === 'run_a' || pose === 'run_b') ? Math.abs(Math.sin(runClock * Math.PI / stridePeriod)) * 0.05 : 0;
    const lift = boatT * (0.14 + Math.sin(S.time * 3.1) * 0.025);
    runner.position.set(P.x, P.y + bob + (P.jumping ? 0 : lift) + (seated ? rdef.seat : 0), 0);
    runner.rotation.z = -lateral * 0.10; runner.rotation.y = -lateral * 0.16;
    const blink = P.invincible > 0 && !ending && Math.floor(now / 70) % 2 === 0;
    const hideRunner = !!(rdef && !rdef.rider && !onBoat);                    // inside a cab / cockpit
    runner.visible = !blink && !hideRunner && !(drive && drive.hideRunner());
    const sh = 1 - clamp(P.y / 2.2, 0, 0.6);                                  // blob shrinks while airborne
    runnerBlob.visible = boatT < 0.5 && !rs; runnerBlob.position.y = 0.03 - (P.y + bob); runnerBlob.scale.set(sh * (pose === 'slide' ? 1.2 : 1), 1, sh * (pose === 'slide' ? 1.8 : 1));
    runnerBlob.rotation.set(-runner.rotation.x, 0, -runner.rotation.z);

    /* ── the ride itself ── */
    const wantId = rs && !onBoat ? rs.id : null;
    if (wantId !== rideShown) {
      if (rideShown && rideModels[rideShown]) rideModels[rideShown].group.visible = false;
      rideShown = wantId; rideT = 0;
      if (wantId) getRide(wantId).group.visible = true;
    }
    rideT = Math.min(1, rideT + dt * 2.6);
    rideBlob.visible = !!rideShown && !blink;
    if (rideShown) {
      const m = rideModels[rideShown], d = m.def, e = ease(rideT), fl = d.fly ? d.flyHeight * e + Math.sin(S.time * 2.4) * 0.05 : (d.water ? -0.12 + Math.sin(S.time * 3.1) * 0.03 : 0);
      if (d.water && !(biomeAt(S.scroll).water) && !ending) { sim.dismount('land'); toast('Boats only float in the river'); }
      if (d.water && !ending) { wakeT -= dt; if (wakeT <= 0) { wakeT = 0.05; burst(P.x + (Math.random() - 0.5) * 0.9, 0.1, 1.9, 3, 0xd8f1ff, 2.2, 1.8, 0.55); } }
      m.group.visible = !blink && drive.mode !== 'cockpit';        // in the Driver view you sit inside: only the 3D dashboard is drawn
      m.group.position.set(P.x, P.y + fl, 0);
      m.group.scale.setScalar(0.72 + 0.28 * Math.min(1, e));
      m.group.rotation.set(d.fly ? -0.1 * Math.min(1, e) - (P.jumping ? 0 : 0) : (P.jumping ? -0.08 : 0), -lateral * 0.16 - drive.vs * 0.14, -lateral * (d.fly ? 0.3 : 0.10) - (d.rider ? drive.vs * 0.18 : 0));
      m.update(dt, speed);
      const hs = d.fly ? clamp(1.05 - fl * 0.14, 0.35, 1) : sh;
      rideBlob.position.set(P.x, 0.03, 0); rideBlob.scale.set(d.blob[0] * hs, 1, d.blob[1] * hs);
    }
    camOff.x += ((rdef ? rdef.cam[0] : 0) - camOff.x) * (1 - Math.exp(-4 * dt));
    camOff.y += ((rdef ? rdef.cam[1] : 0) - camOff.y) * (1 - Math.exp(-4 * dt));
    camOff.z += ((rdef ? rdef.cam[2] : 0) - camOff.z) * (1 - Math.exp(-4 * dt));

    /* ── inspector + dog ── */
    const gap = ending ? GAME.inspectorMinGap : S.inspectorGap;
    const iz = 3.0 + (gap - GAME.inspectorMinGap) * 0.05;
    inspX += (P.x - inspX) * (1 - Math.exp(-5 * dt));
    const showInsp = iz < 12.5 && !(drive.mode === 'cockpit' || drive.mode === 'hood');
    insp.visible = dogG.visible = leash.visible = showInsp;
    if (showInsp) {
      const ib = Math.abs(Math.sin(runClock * Math.PI / (stridePeriod * 1.05))) * 0.05;
      insp.position.set(inspX, ib, iz);
      inspPoses.a.visible = !!stride; inspPoses.b.visible = !stride;
      const dx = inspX + 1.05 + Math.sin(S.time * 2.1) * 0.12, dzp = iz - 0.7;
      dogG.position.set(dx, Math.abs(Math.sin(runClock * Math.PI / (stridePeriod * 0.8))) * 0.06, dzp);
      dogPoses.a.visible = !stride; dogPoses.b.visible = !!stride;
      const lp = leashGeo.attributes.position.array;
      lp[0] = inspX + 0.4; lp[1] = 0.95 + ib; lp[2] = iz - 0.25;
      lp[3] = (lp[0] + dx) / 2; lp[4] = 0.55; lp[5] = (lp[2] + dzp) / 2;
      lp[6] = dx - 0.05; lp[7] = 0.6; lp[8] = dzp + 0.1;
      leashGeo.attributes.position.needsUpdate = true;
    }

    /* ── camera (the driving engine moves it; the player picks the view) ── */
    camX += (P.x * CAMERA.followX - camX) * (1 - Math.exp(-8 * dt));
    shake = Math.max(0, shake - dt * 0.9);
    const fk = drive.camera(dt, { camBase, lookBase, camOff, camX, sa: shake * shake * 1.6, camDef: rdef });
    const wantFov = baseFov * fk + fovKick; fovKick *= Math.exp(-3 * dt); if (fovKick < 0.01) fovKick = 0;
    if (Math.abs(camera.fov - wantFov) > 0.02) { camera.fov = wantFov; camera.updateProjectionMatrix(); }
    drive.setRide(rdef);
    drive.hud();
    if (rideHint) { const hk = rdef ? rdef.id : '-'; if (hk !== hintShownFor) { hintShownFor = hk; rideHint.innerHTML = drive.hintHtml(rdef); rideHint.style.display = 'block'; } }

    updateParticles(dt);

    /* ── HUD ── */
    setHTML('lives',
      '<i class="ph ph-heart" style="color:#ef4444;font-size:1.2em;margin-right:2px;"></i>'.repeat(Math.max(0, S.lives)) +
      '<i class="ph ph-heart" style="opacity:.35;font-size:1.2em;margin-right:2px;"></i>'.repeat(Math.max(0, GAME.lives - S.lives)), ui.lives);
    setText('score', String(S.score), ui.score);
    setText('xp', String(S.xp), ui.xp);
    setText('dist', String(Math.floor(S.distance)), ui.dist);
    if (S.combo >= 3) { if (comboShown !== S.combo) { comboShown = S.combo; ui.combo.innerHTML = `<i class="ph ph-fire"></i> x${S.combo}`; ui.combo.style.fontSize = Math.min(1.5, 0.9 + S.combo * 0.04) + 'rem'; } }
    else if (comboShown) { comboShown = 0; ui.combo.textContent = ''; }
    const close = !ending && S.inspectorGap < GAME.inspectorCloseWarn;
    if (close !== warnShown) { warnShown = close; ui.warn.style.display = close ? 'block' : 'none'; }
    if (owned.length) setHTML('dock', dockHtml(), ui.dock);
    if (speedToast > 0) { speedToast -= dt; ui.speed.style.opacity = speedToast > 0 ? '1' : '0'; }

    renderer.render(scene, camera);

    if (debugOn) {
      dbgT += dt;
      if (dbgT > 0.5) {
        dbgT = 0; const i = renderer.info.render;
        ui.debug.textContent = `${Math.round(1 / Math.max(dt, 0.001))} fps | dpr ${dpr.toFixed(2)} | calls ${i.calls} | tris ${(i.triangles / 1000).toFixed(0)}k\nmodels: ${assets.realCount}/${assets.total} real` + (assets.missing.length ? `\nstand-ins: ${assets.missing.join(', ')}` : '');
      }
    }

    /* hand the result to the app after a short "caught!" moment */
    if (ending && !finished && endT > 1.3) {
      finished = true;
      const stats = { score: S.score, distance: S.distance, xpEarned: S.xp, bestCombo: S.bestCombo, rideXp: S.rideXp, smashed: S.smashed, usedRide, pitStops: S.pitVisits };
      destroy();
      if (host.onGameOver) host.onGameOver(stats);
    }
  }

  /* go! */
  if (garageIn.selected && rideStates[garageIn.selected]) { if (sim.mount(rideStates[garageIn.selected])) usedRide = true; }
  lastT = performance.now();
  rafId = requestAnimationFrame(frame);
  applyZone(0, true);
  /* test helper: jump the world to a given scroll distance (metres) */
  function debugScroll(m) {
    S.scroll = m; S.objects.length = 0; for (const id of [...live.keys()]) removeObject(id);
    tiles.forEach((g, i) => placeTile(g, tileLen * (1 - i)));
    announced = biomeAt(m + 26).id; applyZone(0, true); boatT = biomeAt(m).water ? 1 : 0;
  }
  api.debug = { sim, scene, camera, renderer, assets, debugScroll, rideStates, tryMount, openPit, closePit };       // handy for testing in the browser console
}
