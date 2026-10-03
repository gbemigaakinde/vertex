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
import { GAME, CAMERA, LOOK, OBSTACLE_LOOKS } from './surfer-config.js';
import { createSim, laneX } from './surfer-sim.js';

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
.sf-flash{inset:0;background:radial-gradient(ellipse at center,#ef444400 40%,#ef4444aa);opacity:0;transition:opacity .35s}
.sf-center{inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.5rem;background:#000b;color:#38bdf8;text-align:center;pointer-events:auto}
.sf-center small{color:#94a3b8;font-weight:500;font-size:.8rem;text-shadow:none}
.sf-bar{width:60%;height:6px;border-radius:6px;background:#1e293b;overflow:hidden}
.sf-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#38bdf8,#a78bfa);transition:width .15s}
.sf-hint{margin-top:.5rem;font-size:.6rem;color:#475569;text-align:center;line-height:1.8}
.sf-btns{text-align:center;margin-top:.625rem;display:flex;gap:.5rem;justify-content:center}
.sf-debug{bottom:4px;left:6px;font:600 9px/1.3 monospace;color:#86efac;text-shadow:0 1px 2px #000;white-space:pre}
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
      <div class="sf-ov sf-combo" data-sf="combo"></div>
      <div class="sf-ov sf-warn" data-sf="warn" style="display:none">⚠ INSPECTOR CLOSE!</div>
      <div class="sf-ov sf-speed" data-sf="speed">⚡ SPEED UP!</div>
      <div class="sf-ov sf-debug" data-sf="debug"></div>
      <div class="sf-ov sf-center" data-sf="center"><div style="font-size:1.1rem">Loading 3D world…</div><div class="sf-bar"><i data-sf="bar"></i></div><small data-sf="loadtxt"></small></div>
    </div>
    <div class="sf-hint">← → / swipe sideways: change lane &nbsp;|&nbsp; ↑ / swipe up: jump &nbsp;|&nbsp; ↓ / swipe down: slide &nbsp;|&nbsp; P: pause</div>
    <div class="sf-btns">
      <button data-sf="pauseBtn" class="btn bg-gray-500" style="font-size:.8125rem;">⏸ Pause</button>
      <button data-sf="quitBtn"  class="btn bg-gray-500" style="font-size:.8125rem;">✕ Quit</button>
    </div>
  </div>`;
  const $ = k => container.querySelector(`[data-sf="${k}"]`);
  const ui = { lives: $('lives'), score: $('score'), xp: $('xp'), dist: $('dist'), stage: $('stage'), canvas: $('canvas'),
    flash: $('flash'), combo: $('combo'), warn: $('warn'), speed: $('speed'), debug: $('debug'), center: $('center'),
    bar: $('bar'), loadtxt: $('loadtxt'), pauseBtn: $('pauseBtn'), quitBtn: $('quitBtn') };

  let destroyed = false, rafId = 0, assets = null, renderer = null, ro = null, envTex = null;
  let paused = false, ending = false, endT = 0, finished = false;
  const disposables = [];
  const listeners = [];
  const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); listeners.push([t, ev, fn, opt]); };

  function destroy() {
    if (destroyed) return; destroyed = true;
    cancelAnimationFrame(rafId);
    listeners.forEach(([t, ev, fn, opt]) => t.removeEventListener(ev, fn, opt));
    if (ro) ro.disconnect();
    disposables.forEach(d => { try { d.dispose(); } catch (e) {} });
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
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x1b2230, 0.75));
  const key = new THREE.DirectionalLight(0xfff0dd, 1.7); key.position.set(-4, 9, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7aa7ff, 0.5); rim.position.set(5, 4, -8); scene.add(rim);

  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 0.64, 0.1, 160);
  let baseFov = CAMERA.fov, fovKick = 0;
  function resize() {
    const w = Math.max(2, ui.stage.clientWidth), h = Math.max(2, ui.stage.clientHeight);
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
  for (let i = 0; i < tileCount; i++) {
    const g = new THREE.Group();
    g.add(assets.make('track_segment'));
    const wl = assets.make('tunnel_wall'); wl.position.x = -wallX; g.add(wl);
    const wr = assets.make('tunnel_wall'); wr.position.x = wallX; wr.scale.x = -1; g.add(wr);   // mirrored
    const arch = assets.make('tunnel_arch'); arch.position.z = -tileLen / 2; g.add(arch);
    const lamp = assets.make('ceiling_lamp'); lamp.position.set(0, LOOK.lampHeight, 0); g.add(lamp);
    const sig = assets.make('signal_light'); g.add(sig);
    g.userData = { arch, lamp, sig };
    scene.add(g); tiles.push(g);
  }
  function placeTile(g, z) {
    g.position.z = z; const n = serial++, u = g.userData;
    u.arch.visible = n % LOOK.archEveryTiles === 0;
    u.lamp.visible = n % LOOK.lampEveryTiles === 0;
    u.sig.visible  = n % LOOK.signalEveryTiles === 0;
    u.sig.position.set(((n / LOOK.signalEveryTiles) % 2 < 1 ? -1 : 1) * 3.55, 0, 2);
  }
  tiles.forEach((g, i) => placeTile(g, tileLen * (1 - i)));          // one tile behind the runner, the rest ahead

  /* ============================================================
     CHARACTERS
     ============================================================ */
  const sim = createSim();
  const S = sim.state, P = S.player;

  /* runner: all 5 poses live in the group; we show exactly one */
  const runner = new THREE.Group();
  const poses = {};
  for (const k of ['run_a', 'run_b', 'jump', 'slide', 'stumble']) { poses[k] = assets.make('player_' + k); poses[k].visible = false; runner.add(poses[k]); }
  const runnerBlob = makeBlob(1.0, 1.0); runner.add(runnerBlob);
  scene.add(runner);

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
    if (o.type === 'coin') {
      name = 'coin';
      const m = take(name); root.add(m); root.userData.model = m;
      const glow = new THREE.Sprite(glowMat); glow.scale.set(1.5, 1.5, 1); root.add(glow);
    } else {
      const looks = OBSTACLE_LOOKS[o.kind];
      name = looks[o.look % looks.length];
      root.add(take(name));
      const lab = new THREE.Sprite(o.kind === 'jump' ? jumpLabelMat : slideLabelMat);
      lab.scale.set(1.5, 0.56, 1); lab.position.y = o.kind === 'jump' ? 1.55 : 2.05; root.add(lab);
    }
    scene.add(root);
    live.set(o.id, { root, name, o });
  }
  function removeObject(id) {
    const e = live.get(id); if (!e) return;
    scene.remove(e.root);
    if (e.name !== 'coin') give(e.name, e.root.children[0]);
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
  const pauseOv = () => {
    ui.center.style.display = paused ? 'flex' : 'none';
    ui.center.innerHTML = paused ? '<div style="font-size:1.6rem">⏸ PAUSED</div><small>Tap the screen or press P to resume</small>' : '';
    ui.pauseBtn.textContent = paused ? '▶ Resume' : '⏸ Pause';
  };
  function togglePause() { if (ending || destroyed) return; paused = !paused; lastT = performance.now(); pauseOv(); }
  api.togglePause = togglePause;
  ui.center.style.display = 'none'; ui.center.innerHTML = '';

  on(document, 'keydown', e => {
    if (destroyed) return;
    const c = e.code;
    if (['ArrowLeft', 'KeyA'].includes(c))  { e.preventDefault(); if (!paused) sim.changeLane(-1); }
    else if (['ArrowRight', 'KeyD'].includes(c)) { e.preventDefault(); if (!paused) sim.changeLane(1); }
    else if (['ArrowUp', 'KeyW', 'Space'].includes(c)) { e.preventDefault(); if (!paused) sim.jump(); }
    else if (['ArrowDown', 'KeyS'].includes(c)) { e.preventDefault(); if (!paused) sim.slide(); }
    else if (c === 'KeyP') { e.preventDefault(); togglePause(); }
  });
  on(document, 'visibilitychange', () => { if (document.hidden && !paused) togglePause(); });

  let sw = null;
  const swipeAction = (dx, dy) => {
    if (Math.abs(dx) > Math.abs(dy)) sim.changeLane(dx < 0 ? -1 : 1); else if (dy < 0) sim.jump(); else sim.slide();
  };
  on(ui.stage, 'touchstart', e => { e.preventDefault(); const t = e.touches[0]; sw = { x: t.clientX, y: t.clientY, done: false }; }, { passive: false });
  on(ui.stage, 'touchmove', e => {
    e.preventDefault(); if (!sw || sw.done || paused) return;
    const t = e.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
    if (Math.hypot(dx, dy) > 26) { sw.done = true; swipeAction(dx, dy); }       // reacts mid-swipe → feels snappy
  }, { passive: false });
  on(ui.stage, 'touchend', e => {
    e.preventDefault(); if (!sw) return;
    const wasDone = sw.done; sw = null;
    if (paused) { togglePause(); return; }
    if (!wasDone) sim.jump();                                                     // plain tap = jump
  }, { passive: false });
  on(ui.stage, 'click', e => { if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return; if (paused) togglePause(); else sim.jump(); });
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

  function setText(k, v, el) { if (hudCache[k] !== v) { hudCache[k] = v; el.textContent = v; } }

  function handleEvents() {
    for (const e of S.events) {
      if (e.type === 'coin') {
        burst(e.x, e.y, 0, 16, 0xffd24a, 5, 4);
        if (sound.coin) try { sound.coin(); } catch (x) {}
      } else if (e.type === 'hit') {
        burst(P.x, 0.9, 0, 22, 0xff4d4d, 7, 5, 0.7);
        shake = CAMERA.shakeOnHit;
        ui.flash.style.opacity = '1'; setTimeout(() => { ui.flash.style.opacity = '0'; }, 120);
        if (sound.hit) try { sound.hit(); } catch (x) {}
      } else if (e.type === 'jump' || e.type === 'land') {
        burst(P.x, 0.08, 0, 7, 0xb7c3d6, 2.4, 1.2, 0.4);
      } else if (e.type === 'slide') {
        burst(P.x, 0.08, 0.2, 10, 0xb7c3d6, 2.6, 0.8, 0.45);
      } else if (e.type === 'lane') {
        burst(P.x, 0.5, 0, 5, 0x38bdf8, 2, 1, 0.3);
      } else if (e.type === 'speedup') {
        speedToast = 1.6; fovKick = 5;
        if (sound.speedUp) try { sound.speedUp(); } catch (x) {}
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
    else sim.step(dt);
    handleEvents();

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
    if (P.stumble > 0 || ending) pose = 'stumble'; else if (P.sliding) pose = 'slide'; else if (P.jumping) pose = 'jump';
    for (const k in poses) poses[k].visible = (k === pose);
    const tx = laneX(P.lane), lateral = tx - P.x;
    const bob = (pose === 'run_a' || pose === 'run_b') ? Math.abs(Math.sin(runClock * Math.PI / stridePeriod)) * 0.05 : 0;
    runner.position.set(P.x, P.y + bob, 0);
    runner.rotation.z = -lateral * 0.10; runner.rotation.y = -lateral * 0.16;
    runner.visible = !(P.invincible > 0 && !ending && Math.floor(now / 70) % 2 === 0);
    const sh = 1 - clamp(P.y / 2.2, 0, 0.6);                              // blob shrinks while airborne
    runnerBlob.position.y = 0.03 - (P.y + bob); runnerBlob.scale.set(sh * (pose === 'slide' ? 1.2 : 1), 1, sh * (pose === 'slide' ? 1.8 : 1));
    runnerBlob.rotation.set(-runner.rotation.x, 0, -runner.rotation.z);

    /* ── inspector + dog ── */
    const gap = ending ? GAME.inspectorMinGap : S.inspectorGap;
    const iz = 3.0 + (gap - GAME.inspectorMinGap) * 0.02;
    inspX += (P.x - inspX) * (1 - Math.exp(-5 * dt));
    const showInsp = iz < 8.5;
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

    /* ── camera ── */
    camX += (P.x * CAMERA.followX - camX) * (1 - Math.exp(-8 * dt));
    shake = Math.max(0, shake - dt * 0.9);
    const sa = shake * shake * 1.6;
    camera.position.set(camBase.x + camX + (Math.random() - 0.5) * sa, camBase.y + (Math.random() - 0.5) * sa + P.y * 0.18, camBase.z);
    look.set(lookBase.x + camX * 0.9, lookBase.y, lookBase.z); camera.lookAt(look);
    if (fovKick > 0.01) { fovKick *= Math.exp(-3 * dt); camera.fov = baseFov + fovKick; camera.updateProjectionMatrix(); }

    updateParticles(dt);

    /* ── HUD ── */
    setText('lives', '❤️'.repeat(Math.max(0, S.lives)) + '🖤'.repeat(Math.max(0, GAME.lives - S.lives)), ui.lives);
    setText('score', String(S.score), ui.score);
    setText('xp', String(S.xp), ui.xp);
    setText('dist', String(Math.floor(S.distance)), ui.dist);
    if (S.combo >= 3) { if (comboShown !== S.combo) { comboShown = S.combo; ui.combo.textContent = `🔥 x${S.combo}`; ui.combo.style.fontSize = Math.min(1.5, 0.9 + S.combo * 0.04) + 'rem'; } }
    else if (comboShown) { comboShown = 0; ui.combo.textContent = ''; }
    const close = !ending && S.inspectorGap < GAME.inspectorCloseWarn;
    if (close !== warnShown) { warnShown = close; ui.warn.style.display = close ? 'block' : 'none'; }
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
      const stats = { score: S.score, distance: S.distance, xpEarned: S.xp, bestCombo: S.bestCombo };
      destroy();
      if (host.onGameOver) host.onGameOver(stats);
    }
  }

  /* go! */
  lastT = performance.now();
  rafId = requestAnimationFrame(frame);
  api.debug = { sim, scene, camera, renderer, assets };       // handy for testing in the browser console
}
