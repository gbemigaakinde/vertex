/* ============================================================
   surfer/surfer-drive.js   |   KNOWLEDGE SURFER 3D - the driving engine

   Everything about FEELING like you are driving lives here:
     • steering wheel / handlebar / cyclic   (drag it, or A / D, ← / →)
     • gas + brake pedals                     (hold them, or W / S)
     • gear stick with AUTO mode              (tap ▲ ▼, or E / Q, G = auto)
     • cruise control                         (holds your speed hands-free)
     • speedometer + police radar             (how far is the inspector?)
     • 6 camera views the player controls     (C cycles, or tap the camera button)
         Chase · High · Hood · Driver (first person, with a 3D dashboard) · Top · Free (drag to orbit)

   It does NOT draw the world or decide collisions. It only
     1. writes the player's speed into  sim.state.speedMul  every frame
     2. turns the steering into lane changes (sim.changeLane)
     3. moves the three.js camera
   so surfer-engine.js stays small and surfer-sim.js stays pure logic.
   ============================================================ */
import * as THREE from '../vector/lib/three.module.js';

export const CAM_MODES = [
  { id: 'chase',   name: 'Chase',  icon: 'video-camera' },
  { id: 'far',     name: 'High',   icon: 'binoculars' },
  { id: 'hood',    name: 'Hood',   icon: 'car-profile' },
  { id: 'cockpit', name: 'Driver', icon: 'steering-wheel' },
  { id: 'top',     name: 'Top',    icon: 'map-trifold' },
  { id: 'orbit',   name: 'Free',   icon: 'arrows-out-cardinal' },
];
const FOV_K = { chase: 1, far: 1.05, hood: 1.22, cockpit: 1.32, top: 0.92, orbit: 1 };
const GEAR_TOP = [0.42, 0.64, 0.86, 1.1, 1.4];        // top speed of gears 1-5 (× the vehicle's topMul), 1 = the normal running pace
const ACCEL = { bike: 0.62, car: 0.8, truck: 0.55, train: 0.42, boat: 0.7, heli: 0.85 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpK = (rate, dt) => 1 - Math.exp(-rate * dt);

const CSS = `
.dv-ui{position:absolute;inset:0;pointer-events:none;z-index:5;font-family:inherit}
.dv-ui *{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
.dv-ui .dv-b{pointer-events:auto}
.dv-radar{position:absolute;left:6px;top:8px;display:flex;align-items:center;gap:6px;padding:4px 8px 4px 6px;border-radius:12px;border:1px solid #334155;background:#0f172acc;color:#e2e8f0;font:800 .66rem/1 inherit;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.dv-radar i.ph{font-size:1.05rem;color:#60a5fa}
.dv-radar .m{min-width:2.9em;text-align:right;font-family:var(--font-mono,monospace)}
.dv-radar .bar{position:relative;width:70px;height:8px;border-radius:99px;background:#1e293b;overflow:hidden}
.dv-radar .bar b{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:#22c55e;transition:background .2s}
.dv-radar.warn{border-color:#ef4444;animation:dvp .6s infinite alternate}.dv-radar.warn i.ph{color:#ef4444}
.dv-radar.mid .bar b{background:#f59e0b}.dv-radar.warn .bar b{background:#ef4444}
@keyframes dvp{to{box-shadow:0 0 14px #ef444488}}
.dv-speedo{position:absolute;right:6px;top:8px;padding:4px 9px;border-radius:12px;border:1px solid #334155;background:#0f172acc;color:#38bdf8;text-align:right;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.dv-speedo b{font:900 1.2rem/1 var(--font-mono,monospace)}.dv-speedo small{display:block;font:700 .5rem/1.1 inherit;color:#94a3b8;letter-spacing:.06em}
.dv-camw{position:absolute;right:6px;top:58px;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.dv-cambtn,.dv-chip,.dv-cruise{border:1px solid #334155;background:#0f172add;color:#cbd5e1;border-radius:11px;font:800 .58rem/1 inherit;cursor:pointer;display:flex;align-items:center;gap:4px;padding:6px 8px}
.dv-cambtn i.ph{font-size:1rem}
.dv-chips{display:none;flex-direction:column;gap:3px}.dv-camw.open .dv-chips{display:flex}
.dv-chip.on{border-color:#38bdf8;background:#075985dd;color:#e0f2fe}
.dv-wheel{position:absolute;left:8px;bottom:60px;width:104px;height:104px;transform-origin:0 100%;transform:scale(var(--dvs,1));border-radius:50%;cursor:grab;filter:drop-shadow(0 4px 10px #000a)}
.dv-wheel svg{width:100%;height:100%;display:block}
.dv-wheel .rot{transform-origin:50% 50%}
.dv-gear{position:absolute;left:50%;bottom:60px;transform-origin:50% 100%;transform:translateX(calc(-50% - 8px)) scale(var(--dvs,1));width:50px;display:flex;flex-direction:column;align-items:stretch;gap:3px}
.dv-gear button{border:1px solid #475569;background:linear-gradient(160deg,#1e293bee,#0f172aee);color:#e2e8f0;border-radius:9px;font:900 .8rem/1 inherit;height:26px;cursor:pointer;padding:0}
.dv-gear button:active{background:#075985}
.dv-gear .g{height:40px;border-radius:12px;border:2px solid #38bdf8;background:radial-gradient(circle at 35% 30%,#334155,#0b1220);color:#7dd3fc;display:flex;align-items:center;justify-content:center;font:900 1.35rem/1 var(--font-mono,monospace);box-shadow:inset 0 0 10px #000a}
.dv-gear .a{height:20px;font-size:.55rem;letter-spacing:.06em}
.dv-gear .a.on{border-color:#22c55e;color:#bbf7d0;background:#14532dcc}
.dv-pedals{position:absolute;right:8px;bottom:60px;display:flex;align-items:flex-end;gap:8px;transform-origin:100% 100%;transform:scale(var(--dvs,1))}
.dv-pedal{width:56px;overflow:hidden;border-radius:12px;border:2px solid #475569;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font:900 .5rem/1 inherit;letter-spacing:0;box-shadow:0 4px 0 #0008,inset 0 0 12px #0006;cursor:pointer}
.dv-pedal i.ph{font-size:1.2rem}
.dv-pedal.gas{height:92px;background:repeating-linear-gradient(0deg,#14532d 0 6px,#166534 6px 12px);border-color:#22c55e}
.dv-pedal.brk{height:64px;background:repeating-linear-gradient(0deg,#7f1d1d 0 6px,#991b1b 6px 12px);border-color:#ef4444}
.dv-pedal.down{transform:translateY(3px) scale(.97);box-shadow:0 1px 0 #0008,inset 0 0 18px #000a;filter:brightness(1.35)}
.dv-cruise{position:absolute;right:8px;bottom:calc(60px + 104px * var(--dvs,1));transform-origin:100% 100%;transform:scale(var(--dvs,1))}
.dv-cruise.on{border-color:#22c55e;background:#14532dcc;color:#bbf7d0}
.dv-cruise i.ph{font-size:.95rem}
`;
let cssDone = false;
function injectCss() { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }

const WHEEL_SVG = `<svg viewBox="0 0 100 100"><g class="rot"><circle cx="50" cy="50" r="42" fill="none" stroke="#0b0d12" stroke-width="10"/><circle cx="50" cy="50" r="42" fill="none" stroke="#475569" stroke-width="7"/><circle cx="50" cy="50" r="42" fill="none" stroke="#94a3b8" stroke-width="1.2" opacity=".6"/>
<path d="M12 56 Q50 70 88 56 L88 47 Q50 58 12 47 Z" fill="#334155" stroke="#0b0d12" stroke-width="2"/><rect x="45" y="55" width="10" height="34" rx="3" fill="#334155" stroke="#0b0d12" stroke-width="2"/>
<circle cx="50" cy="50" r="11" fill="#1e293b" stroke="#38bdf8" stroke-width="2.5"/><rect x="48" y="3" width="4" height="10" rx="2" fill="#ef4444"/></g></svg>`;
const BAR_SVG = `<svg viewBox="0 0 100 100"><g class="rot"><rect x="4" y="44" width="92" height="9" rx="4.5" fill="#94a3b8" stroke="#0b0d12" stroke-width="2"/><rect x="0" y="38" width="20" height="21" rx="8" fill="#0b0d12"/><rect x="80" y="38" width="20" height="21" rx="8" fill="#0b0d12"/><rect x="44" y="40" width="12" height="46" rx="4" fill="#475569" stroke="#0b0d12" stroke-width="2"/><circle cx="50" cy="48" r="8" fill="#1e293b" stroke="#38bdf8" stroke-width="2.5"/><rect x="48" y="16" width="4" height="22" fill="#ef4444"/></g></svg>`;
const STICK_SVG = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#0f172a" stroke="#475569" stroke-width="4"/><g class="rot"><rect x="46" y="12" width="8" height="42" rx="4" fill="#94a3b8" stroke="#0b0d12" stroke-width="2"/><circle cx="50" cy="14" r="11" fill="#ef4444" stroke="#0b0d12" stroke-width="2.5"/></g></svg>`;
const KIND_UI = {
  bike:  { svg: BAR_SVG,   gear: 'GEAR' }, car: { svg: WHEEL_SVG, gear: 'GEAR' }, truck: { svg: WHEEL_SVG, gear: 'GEAR' },
  train: { svg: WHEEL_SVG, gear: 'NOTCH' }, boat: { svg: WHEEL_SVG, gear: 'THROTTLE' }, heli: { svg: STICK_SVG, gear: 'LIFT' },
};

/* ───────────── 3D dashboard shown only in the Driver view ───────────── */
function buildCockpit(kind) {
  const g = new THREE.Group(), steer = new THREE.Group(), lever = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x10141b, roughness: 0.7, metalness: 0.2 });
  const mid = new THREE.MeshStandardMaterial({ color: 0x232a35, roughness: 0.55, metalness: 0.4 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd5dde8, roughness: 0.2, metalness: 1 });
  const red = new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.4 });
  const lit = c => new THREE.MeshBasicMaterial({ color: c });
  const box = (w, h, d, m, x, y, z) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.set(x, y, z); return k; };
  const cyl = (r, h, m, x, y, z) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), m); k.position.set(x, y, z); return k; };
  if (kind === 'bike') {
    steer.position.set(0, -0.33, -0.72);
    const bar = cyl(0.014, 0.74, chrome, 0, 0, 0); bar.rotation.z = Math.PI / 2; steer.add(bar);
    for (const s of [-1, 1]) { const grip = cyl(0.022, 0.13, dark, s * 0.3, 0, 0); grip.rotation.z = Math.PI / 2; steer.add(grip); const lev = box(0.1, 0.012, 0.02, chrome, s * 0.3, 0.025, -0.05); steer.add(lev); const mir = box(0.1, 0.07, 0.01, mid, s * 0.34, 0.14, -0.02); mir.rotation.z = s * -0.25; steer.add(mir, cyl(0.007, 0.14, chrome, s * 0.32, 0.07, -0.02)); }
    steer.add(box(0.2, 0.09, 0.07, dark, 0, 0.05, -0.08), box(0.17, 0.04, 0.005, lit(0x38bdf8), 0, 0.06, -0.117), cyl(0.012, 0.12, chrome, 0, -0.07, 0.0));
    g.add(steer);
  } else if (kind === 'heli') {
    g.add(box(1.5, 0.3, 0.55, dark, 0, -0.55, -0.95), box(0.16, 0.07, 0.02, lit(0x0e7490), -0.3, -0.5, -0.67), box(0.12, 0.07, 0.02, lit(0x166534), -0.1, -0.5, -0.67), box(0.1, 0.07, 0.02, lit(0x7c2d12), 0.08, -0.5, -0.67));
    steer.position.set(0.0, -0.74, -0.66); steer.add(cyl(0.018, 0.3, chrome, 0, 0.17, 0), (() => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), red); b.position.y = 0.36; return b; })()); g.add(steer);
    lever.position.set(-0.62, -0.66, -0.45); lever.add(cyl(0.014, 0.3, chrome, 0, 0.15, 0), cyl(0.03, 0.14, dark, 0, 0.32, 0)); g.add(lever);
  } else {
    /* car / truck / train / boat */
    const w = kind === 'train' ? 1.9 : 1.55;
    g.add(box(w, 0.26, 0.55, dark, 0, -0.56, -0.95), box(w, 0.07, 0.3, mid, 0, -0.41, -0.9));
    if (kind !== 'train') {
      steer.position.set(-0.0, -0.33, -0.9); steer.rotation.x = -0.62;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 10, 30), dark); steer.add(rim);
      for (let i = 0; i < 3; i++) { const sp = box(0.26, 0.018, 0.018, mid, 0, 0, 0); sp.rotation.z = (i * Math.PI) / 3 + Math.PI / 6; steer.add(sp); }
      steer.add(cyl(0.05, 0.03, chrome, 0, 0, 0.0).rotateX(Math.PI / 2)); g.add(steer);
      g.add(box(0.28, 0.1, 0.02, lit(0x0e7490), 0, -0.4, -0.99));          // cluster glow
    } else {
      for (const x of [-0.5, 0.5]) { const l = new THREE.Group(); l.position.set(x, -0.46, -0.8); l.add(cyl(0.014, 0.28, chrome, 0, 0.14, 0), cyl(0.04, 0.1, x < 0 ? red : dark, 0, 0.3, 0)); g.add(l); if (x > 0) lever.add(l); }
      g.add(box(0.5, 0.12, 0.02, lit(0x0e7490), 0, -0.38, -1.0));
    }
    if (kind !== 'train') {
      lever.position.set(0.5, -0.5, -0.6); lever.add(cyl(0.014, 0.22, chrome, 0, 0.11, 0)); const kn = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), kind === 'boat' ? red : dark); kn.position.y = 0.23; lever.add(kn); g.add(lever);
    }
    if (kind === 'car' || kind === 'truck') g.add(box(0.22, 0.06, 0.03, mid, 0, 0.4, -0.75));        // rear-view mirror
    if (kind !== 'boat') for (const s of [-1, 1]) g.add(box(0.07, 1.05, 0.05, dark, s * (w / 2 + 0.05), 0.05, -0.85));       // A-pillars
  }
  g.userData = { steer, lever, kind };
  return g;
}

/* ============================================================ */
export function createDrive({ stage, sim, camera, scene, on, toast }) {
  injectCss();
  const S = sim.state, P = S.player;
  const d = {
    mode: (() => { try { const m = localStorage.getItem('surferCam'); return CAM_MODES.some(c => c.id === m) ? m : 'chase'; } catch (e) { return 'chase'; } })(),
    def: undefined, v: 1, gear: 3, auto: true, cruise: true, cruiseV: 1,
    padGas: 0, padBrk: 0, keyGas: 0, keyBrk: 0,
    steerTarget: 0, vs: 0, kickV: 0, dragging: false, armed: true,
    orbit: { yaw: 0.5, pitch: 0.35, dist: 7.5 }, orbitDrag: null,
  };
  const cam = { pos: new THREE.Vector3(0, 4, 8), look: new THREE.Vector3(0, 1, -6), init: false };
  let cockpit = null, cockpitKind = '', kindShown = '';

  /* ── DOM ── */
  const ui = document.createElement('div'); ui.className = 'dv-ui';
  ui.innerHTML = `
    <div class="dv-radar" data-d="radar"><i class="ph ph-siren"></i><div class="bar"><b data-d="rbar"></b></div><span class="m" data-d="rm">42 m</span></div>
    <div class="dv-speedo dv-ride" data-d="speedo"><b data-d="spd">0</b><small>KM/H · <span data-d="gl">D</span></small></div>
    <div class="dv-camw" data-d="camw"><button type="button" class="dv-cambtn dv-b" data-d="cambtn"><i class="ph ph-video-camera"></i><span data-d="camname">Chase</span></button>
      <div class="dv-chips">${CAM_MODES.map(c => `<button type="button" class="dv-chip dv-b" data-cam="${c.id}"><i class="ph ph-${c.icon}"></i>${c.name}</button>`).join('')}</div></div>
    <div class="dv-wheel dv-b dv-ride" data-d="wheel" aria-label="Steering"></div>
    <div class="dv-gear dv-ride" data-d="gearbox"><button type="button" class="dv-b" data-g="up" aria-label="Shift up">▲</button><div class="g" data-d="gnum">D</div><button type="button" class="dv-b" data-g="down" aria-label="Shift down">▼</button><button type="button" class="dv-b a on" data-g="auto">AUTO</button></div>
    <button type="button" class="dv-cruise dv-b dv-ride on" data-d="cruise"><i class="ph ph-gauge"></i>CRUISE</button>
    <div class="dv-pedals dv-ride"><div class="dv-pedal brk dv-b" data-d="brk"><i class="ph ph-hand-palm"></i>BRAKE</div><div class="dv-pedal gas dv-b" data-d="gas"><i class="ph ph-arrow-fat-lines-up"></i>GAS</div></div>`;
  stage.appendChild(ui);
  const fit = () => { const r = stage.getBoundingClientRect(); ui.style.setProperty('--dvs', clamp(Math.min(r.width / 420, r.height / 640), 0.55, 1).toFixed(3)); };
  fit(); let ro = null; if (window.ResizeObserver) { ro = new ResizeObserver(fit); ro.observe(stage); } else on(window, 'resize', fit);
  const q = k => ui.querySelector(`[data-d="${k}"]`);
  const el = { radar: q('radar'), rbar: q('rbar'), rm: q('rm'), speedo: q('speedo'), spd: q('spd'), gl: q('gl'), camw: q('camw'), camname: q('camname'), wheel: q('wheel'), gnum: q('gnum'), cruise: q('cruise'), gas: q('gas'), brk: q('brk'), gearbox: q('gearbox') };
  const rideEls = ui.querySelectorAll('.dv-ride');
  for (const t of ['touchstart', 'touchmove', 'touchend', 'mousedown', 'pointerdown', 'click']) on(ui, t, e => { if (e.target.closest('.dv-b')) { e.stopPropagation(); if (t === 'touchstart' && e.cancelable) e.preventDefault(); } });

  /* ── pedals ── */
  const hold = (node, key) => {
    const set = v => { d[key] = v; node.classList.toggle('down', v > 0); };
    on(node, 'pointerdown', e => { e.preventDefault(); try { node.setPointerCapture(e.pointerId); } catch (x) {} set(1); });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) on(node, t, () => set(0));
  };
  hold(el.gas, 'padGas'); hold(el.brk, 'padBrk');

  /* ── steering wheel ── */
  let wheelA0 = 0, wheelS0 = 0, rotEl = null, lastKind = '';
  const ang = e => { const r = el.wheel.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  on(el.wheel, 'pointerdown', e => { e.preventDefault(); try { el.wheel.setPointerCapture(e.pointerId); } catch (x) {} d.dragging = true; wheelA0 = ang(e); wheelS0 = d.vs; });
  on(el.wheel, 'pointermove', e => {
    if (!d.dragging) return;
    let a = ang(e) - wheelA0; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
    d.steerTarget = clamp(wheelS0 + a / 1.0, -1, 1);
  });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) on(el.wheel, t, () => { d.dragging = false; d.steerTarget = 0; });

  /* ── gear stick, cruise, camera buttons ── */
  const shift = dir => { d.auto = false; d.cruise = false; d.gear = clamp((d.auto ? d.gear : d.gear) + dir, 0, 5); toast && toast(d.gear === 0 ? 'Neutral: no drive' : 'Gear ' + d.gear); };
  const setAuto = v => { d.auto = v; if (v) d.cruise = false; };
  on(ui.querySelector('.dv-gear'), 'click', e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    if (b.dataset.g === 'up') { if (d.auto) { d.auto = false; d.gear = clamp(Math.round(d.gear) , 1, 5); } shift(1); }
    else if (b.dataset.g === 'down') { if (d.auto) { d.auto = false; } shift(-1); }
    else setAuto(!d.auto);
  });
  on(el.cruise, 'click', () => { d.cruise = !d.cruise; d.cruiseV = d.v; });
  on(q('cambtn'), 'click', () => el.camw.classList.toggle('open'));
  on(ui.querySelector('.dv-chips'), 'click', e => { const b = e.target.closest('[data-cam]'); if (b) { setMode(b.dataset.cam); el.camw.classList.remove('open'); } });
  function setMode(m) {
    d.mode = m; try { localStorage.setItem('surferCam', m); } catch (e) {}
    const c = CAM_MODES.find(x => x.id === m); el.camname.textContent = c.name;
    ui.querySelectorAll('[data-cam]').forEach(b => b.classList.toggle('on', b.dataset.cam === m));
    q('cambtn').querySelector('i').className = 'ph ph-' + c.icon;
    if (m === 'orbit') toast && toast('Free camera: drag to look around, wheel or pinch to zoom');
  }
  setMode(d.mode);

  /* ── orbit camera drag / wheel / pinch (only in Free view) ── */
  const pts = new Map(); let pinch0 = 0, dist0 = 0;
  on(stage, 'pointerdown', e => { if (d.mode !== 'orbit' || e.target.closest('.dv-b')) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = d.orbit.dist; } });
  on(stage, 'pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 2) { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); const [a, b] = [...pts.values()]; d.orbit.dist = clamp(dist0 * pinch0 / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), 2.5, 22); return; }
    d.orbit.yaw -= (e.clientX - p.x) * 0.012; d.orbit.pitch = clamp(d.orbit.pitch + (e.clientY - p.y) * 0.008, -0.1, 1.45); p.x = e.clientX; p.y = e.clientY;
  });
  for (const t of ['pointerup', 'pointercancel']) on(stage, t, e => pts.delete(e.pointerId));
  on(stage, 'wheel', e => { if (d.mode !== 'orbit') return; e.preventDefault(); d.orbit.dist = clamp(d.orbit.dist * (1 + Math.sign(e.deltaY) * 0.1), 2.5, 22); }, { passive: false });

  /* ── keyboard ── (returns true when the key was used) ── */
  d.key = (e, down) => {
    const c = e.code, riding = !!d.def, jumper = !!(d.def && (d.def.canJump));
    if (down && c === 'KeyC') { const i = CAM_MODES.findIndex(m => m.id === d.mode); setMode(CAM_MODES[(i + 1) % CAM_MODES.length].id); return true; }
    if (!riding) return false;
    if (c === 'KeyW' || (!jumper && c === 'ArrowUp')) { d.keyGas = down ? 1 : 0; return true; }
    if (c === 'KeyS' || (!jumper && c === 'ArrowDown')) { d.keyBrk = down ? 1 : 0; return true; }
    if (!down) return false;
    if (c === 'KeyE') { if (d.auto) d.auto = false; shift(1); return true; }
    if (c === 'KeyQ') { if (d.auto) d.auto = false; shift(-1); return true; }
    if (c === 'KeyG') { setAuto(!d.auto); return true; }
    if (c === 'KeyF') { d.cruise = !d.cruise; d.cruiseV = d.v; return true; }
    if (jumper && c === 'KeyX') { sim.slide(); return true; }
    return false;
  };
  d.kick = dir => { if (!d.dragging) d.kickV = dir; };
  d.impact = () => { d.v = Math.max(0.12, d.v * 0.72); d.cruiseV = d.v; };
  d.isOrbit = () => d.mode === 'orbit';
  d.hideRunner = () => d.mode === 'hood' || d.mode === 'cockpit';
  d.hintHtml = def => def
    ? `Drive: <b>W</b> gas · <b>S</b> brake · <b>A / D</b> steer · <b>Q / E</b> gear · <b>G</b> auto · <b>F</b> cruise · <b>C</b> camera${def.canJump ? ' · <b>Space</b> jump' : ''}`
    : 'Press <b>C</b> to change the camera view';

  /* ── ride changes ── */
  d.setRide = def => {
    if (def === d.def) return; d.def = def;
    rideEls.forEach(n => { n.style.display = def ? '' : 'none'; });
    if (def) {
      const k = KIND_UI[def.kind] || KIND_UI.car;
      el.wheel.innerHTML = k.svg; rotEl = el.wheel.querySelector('.rot');
      d.v = clamp(S.speedMul || 1, 0.2, 1.4); d.cruise = true; d.cruiseV = 1; d.auto = true; d.gear = 3; d.steerTarget = 0;
      cockpitKind = def.kind || 'car';
    } else { d.padGas = d.padBrk = d.keyGas = d.keyBrk = 0; }
  };
  d.setRide(null);

  /* ── physics: runs before sim.step every frame ── */
  d.update = (dt, ending) => {
    const def = d.def, k = lerpK(6, dt);
    /* steering → lane changes. The wheel springs back to centre. */
    if (!d.dragging) { d.kickV *= Math.exp(-5 * dt); d.steerTarget = d.kickV; }
    d.vs += (d.steerTarget - d.vs) * lerpK(d.dragging ? 22 : 11, dt);
    if (d.armed && Math.abs(d.vs) > 0.62 && d.dragging && !ending) { d.armed = false; sim.changeLane(d.vs < 0 ? -1 : 1); }
    if (Math.abs(d.vs) < 0.2) d.armed = true;
    if (!def || ending) { S.speedMul += (1 - S.speedMul) * k; return; }

    const top = def.topMul || 1, kind = def.kind || 'car';
    const gas = Math.max(d.padGas, d.keyGas), brk = Math.max(d.padBrk, d.keyBrk);
    if (gas > 0 || brk > 0) d.cruise = false;
    if (d.auto && d.gear !== 0) d.gear = clamp(Math.floor(d.v / (top * 0.27)) + 1, 1, 5);
    const g = Math.max(1, d.gear), gearMax = GEAR_TOP[g - 1] * top;
    if (d.cruise) { d.v += (d.cruiseV - d.v) * lerpK(2.5, dt); }
    else {
      let a = 0;
      if (d.gear !== 0 && gas > 0) a += gas * (ACCEL[kind] || 0.7) * (1.55 - 0.22 * (g - 1)) * clamp(1 - d.v / gearMax, -0.8, 1);
      a -= (gas > 0 ? 0.03 : 0.16) * (d.v > 0.1 ? 1 : 0.2);
      a -= brk * 1.7;
      d.v += a * dt;
    }
    d.v = clamp(d.v, 0.05, 1.45 * top);
    S.speedMul = d.v;
  };

  /* ── per-frame visuals: HUD + 3D dashboard ── */
  let cache = {};
  const set = (key, v, fn) => { if (cache[key] !== v) { cache[key] = v; fn(v); } };
  d.hud = () => {
    const pm = Math.round(S.policeMeters);
    set('rm', pm, v => { el.rm.textContent = v + ' m'; el.rbar.style.width = Math.round((v - 6) / 54 * 100) + '%'; el.radar.className = 'dv-radar' + (v < 14 ? ' warn' : v < 28 ? ' mid' : ''); });
    set('spd', Math.round(S.worldSpeed * 3.6), v => { el.spd.textContent = v; });
    const gl = d.gear === 0 ? 'N' : String(Math.max(1, d.gear)); set('gl', gl + (d.auto ? 'A' : ''), () => { q('gl').textContent = gl; el.gnum.textContent = gl; });
    set('auto', d.auto, v => { ui.querySelector('[data-g="auto"]').classList.toggle('on', v); });
    set('cr', d.cruise, v => { el.cruise.classList.toggle('on', v); });
    if (rotEl) rotEl.style.transform = `rotate(${(d.vs * (d.def && d.def.kind === 'bike' ? 28 : d.def && d.def.kind === 'heli' ? 22 : 100)).toFixed(1)}deg)`;
    /* 3D dashboard */
    const show = d.mode === 'cockpit' && !!d.def;
    if (show && (!cockpit || kindShown !== cockpitKind)) {
      if (cockpit) { camera.remove(cockpit); }
      cockpit = buildCockpit(cockpitKind); kindShown = cockpitKind; camera.add(cockpit);
    }
    if (cockpit) {
      cockpit.visible = show;
      if (show) {
        const u = cockpit.userData, kd = u.kind;
        if (kd === 'bike') { u.steer.rotation.y = -d.vs * 0.5; u.steer.rotation.z = d.vs * 0.12; }
        else if (kd === 'heli') { u.steer.rotation.z = -d.vs * 0.5; u.steer.rotation.x = -(d.keyGas || d.padGas) * 0.3 + (d.keyBrk || d.padBrk) * 0.3; u.lever.rotation.x = -(d.v - 1) * 0.5; }
        else { u.steer.rotation.z = -d.vs * 1.6; if (u.lever) u.lever.rotation.x = kd === 'train' ? -d.v * 0.6 : (3 - Math.max(0, d.gear)) * 0.09; }
      }
    }
  };

  /* ── camera ── returns the fov multiplier for the engine ── */
  const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();
  d.camera = (dt, c) => {
    const { camBase, lookBase, camOff, camX, sa, camDef } = c, def = camDef;
    const m = d.mode; let rate = 7;
    const rx = () => (Math.random() - 0.5) * sa, ry = () => (Math.random() - 0.5) * sa;
    if (m === 'chase') {
      tmpP.set(camBase.x + camX + rx(), camBase.y + camOff.y + ry() + P.y * 0.18, camBase.z + camOff.z);
      tmpL.set(lookBase.x + camX * 0.9, lookBase.y + camOff.y * 0.3, lookBase.z); rate = 60;
    } else if (m === 'far') {
      tmpP.set(P.x * 0.45 + rx(), 6.1 + camOff.y * 0.9 + P.y * 0.2, 10.8 + camOff.z + ry()); tmpL.set(P.x * 0.4, 0.6, -9); rate = 6;
    } else if (m === 'top') {
      tmpP.set(P.x * 0.55, 17.5, 4.5); tmpL.set(P.x * 0.55, 0, -4.5); rate = 6;
    } else if (m === 'hood') {
      const e = def ? def.eye : [0, 1.7, 0.4], fz = def ? -def.halfD * 0.9 : 0.8;
      tmpP.set(P.x + rx() * 0.4, (def ? e[1] + 0.12 : 1.95) + P.y + ry() * 0.4, def && def.fly ? -0.9 : fz);
      tmpL.set(P.x + d.vs * 2.4, tmpP.y - 0.28, -22); rate = 16;
    } else if (m === 'cockpit') {
      const e = def ? def.eye : [0, 1.62, 0.0], fl = def && def.fly ? def.flyHeight : 0;
      tmpP.set(P.x + e[0] + rx() * 0.4, e[1] + P.y + fl + ry() * 0.4 + Math.sin(performance.now() * 0.02) * 0.004 * S.speedMul, e[2]);
      tmpL.set(P.x + d.vs * 3.2, tmpP.y - 0.12, -22); rate = 18;
    } else {
      const o = d.orbit, cy = 1.0 + P.y + (def && def.fly ? def.flyHeight : 0);
      tmpP.set(P.x + Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist, cy + Math.sin(o.pitch) * o.dist, Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist);
      tmpL.set(P.x, cy, 0); rate = 12;
    }
    if (!cam.init) { cam.pos.copy(tmpP); cam.look.copy(tmpL); cam.init = true; }
    const kk = lerpK(rate, dt); cam.pos.lerp(tmpP, kk); cam.look.lerp(tmpL, kk);
    camera.position.copy(cam.pos); camera.lookAt(cam.look);
    return FOV_K[m] || 1;
  };

  d.destroy = () => { if (ro) ro.disconnect(); if (cockpit) camera.remove(cockpit); ui.remove(); };
  return d;
}
