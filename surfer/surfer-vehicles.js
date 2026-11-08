/* ============================================================
   surfer/surfer-vehicles.js   |   KNOWLEDGE SURFER 3D - the garage

   Everything about the rides lives here:
     • VEHICLES            the catalogue (price, perks, fuel, size)
     • buildVehicle(id)    a finished 3D model, front of the ride points to -z
     • buildPitStop()      the roadside refuel station
     • createViewer(host)  the turntable used inside the Garage screen
     • disposeObject(o)    frees GPU memory

   Prices are in XP. 1 XP = 1 coin, so spending coins removes the same
   amount of XP from the player's total (that is what the rankings use).
   ============================================================ */
import * as THREE from '../vector/lib/three.module.js';

/* ───────────── catalogue ───────────── */
export const VEHICLES = [
  { id: 'bicycle',    name: 'Trail Bicycle',   short: 'Bicycle',    icon: 'bicycle',       cost: 15000,  fuel: 55, hp: 0,  trainCost: 99, xpMult: 1.10, canJump: true,  canSlide: true,  fly: false, halfW: 0.30, halfD: 0.30, seat: 0.30, rider: true, kind: 'bike', topMul: 0.85, eye: [0, 1.38, 0.12],
    cam: [0, 0, 0], blob: [0.7, 1.9], tag: 'Light and quick', perks: ['+10% XP on coins', 'Can still jump and slide', 'No armour'] },
  { id: 'motorbike',  name: 'Street Motorbike', short: 'Motorbike', icon: 'motorcycle',    cost: 40000,  fuel: 45, hp: 1,  trainCost: 99, xpMult: 1.25, canJump: true,  canSlide: true,  fly: false, halfW: 0.34, halfD: 0.38, seat: 0.40, rider: true, kind: 'bike', topMul: 1.1, eye: [0, 1.5, 0.22],
    cam: [0, 0.1, 0.2], blob: [0.8, 2.2], tag: 'Fast and nimble', perks: ['+25% XP on coins', 'Absorbs 1 crash', 'Can jump and slide'] },
  { id: 'car',        name: 'Rosso Coupe',     short: 'Car',        icon: 'car',           cost: 85000,  fuel: 40, hp: 3,  trainCost: 3,  xpMult: 1.50, canJump: false, canSlide: false, fly: false, halfW: 0.86, halfD: 1.4,  seat: 0,    rider: false, kind: 'car', topMul: 1.0, eye: [0, 1.12, 0.15],
    cam: [0, 0.35, 0.6], blob: [1.8, 4.2], tag: 'Smashes barriers', perks: ['+50% XP on coins', 'Smashes hurdles and gates', 'Armour for 3 hits'] },
  { id: 'truck',      name: 'Ridge Pickup',    short: 'Truck',      icon: 'truck',         cost: 130000, fuel: 40, hp: 4,  trainCost: 2,  xpMult: 1.75, canJump: false, canSlide: false, fly: false, halfW: 0.94, halfD: 1.7,  seat: 0,    rider: false, kind: 'truck', topMul: 0.92, eye: [0, 1.75, 0.3],
    cam: [0, 0.55, 1.0], blob: [2.0, 4.8], tag: 'Heavy hitter', perks: ['+75% XP on coins', 'Shrugs off a train (2 armour)', 'Armour for 4 hits'] },
  { id: 'train',      name: 'Vertex Express',  short: 'Train',      icon: 'train',         cost: 185000, fuel: 30, hp: 99, trainCost: 0,  xpMult: 2.00, canJump: false, canSlide: false, fly: false, halfW: 1.0,  halfD: 2.6,  seat: 0,    rider: false, kind: 'train', topMul: 1.12, eye: [0, 2.9, -0.9],
    cam: [0, 0.9, 1.9], blob: [2.1, 6.4], tag: 'Unstoppable', perks: ['2x XP on coins', 'Plows through everything', 'Never takes damage'] },
  { id: 'boat',       name: 'Tidewave Speedboat', short: 'Boat',    icon: 'sailboat',      cost: 220000, fuel: 35, hp: 4,  trainCost: 2,  xpMult: 2.25, canJump: false, canSlide: false, fly: false, halfW: 0.8,  halfD: 1.6,  seat: 0,    rider: false, kind: 'boat', topMul: 1.15, eye: [0, 1.05, 0.25], water: true,
    cam: [0, 0.45, 0.9], blob: [1.5, 3.8], tag: 'Master of the river', perks: ['2.25x XP on coins', 'River Crossing only: replaces the canoe', 'Armour for 4 hits, shrugs off barges'] },
  { id: 'helicopter', name: 'Skyhawk Chopper', short: 'Helicopter', icon: 'airplane-tilt', cost: 270000, fuel: 25, hp: 0,  trainCost: 0,  xpMult: 2.50, canJump: false, canSlide: false, fly: true,  halfW: 0.7,  halfD: 1.2,  seat: 0,    rider: false, kind: 'heli', topMul: 1.25, eye: [0, 1.45, -0.55],
    cam: [0, 2.0, 1.8], blob: [1.4, 2.4], flyHeight: 2.3, tag: 'Rules the air', perks: ['2.5x XP on coins', 'Flies over every obstacle', 'Pulls in nearby coins'] },
];
export const VEHICLE_BY_ID = Object.fromEntries(VEHICLES.map(v => [v.id, v]));

/* ───────────── materials ───────────── */
const paint = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2, ...o });
const std = (c, metalness, roughness, o = {}) => new THREE.MeshStandardMaterial({ color: c, metalness, roughness, ...o });
const glow = (c, i = 1.8) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 });
const mats = () => ({
  chrome: std(0xdfe6ee, 1, 0.16), steel: std(0x7b8794, 0.9, 0.38), dark: std(0x15181d, 0.4, 0.55), rubber: std(0x0c0e12, 0, 0.92),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x0a1624, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.74, clearcoat: 1, envMapIntensity: 1.6 }),
  white: glow(0xfff3d1, 2.2), red: glow(0xff2a2a, 1.6), amber: glow(0xffa21a, 1.4),
});

/* ───────────── geometry helpers ───────────── */
function rrectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
/* rounded box: w (x) · h (y) · d (z), corner radius r */
function rbox(w, h, d, r, m, x = 0, y = 0, z = 0) {
  const bv = Math.min(r * 0.6, 0.05, w / 4, h / 4, d / 4);
  const g = new THREE.ExtrudeGeometry(rrectShape(w - bv * 2, h - bv * 2, Math.max(r - bv, 0.002)), { depth: Math.max(d - bv * 2, 0.002), bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -(d - bv * 2) / 2);
  const k = new THREE.Mesh(g, m); k.position.set(x, y, z); return k;
}
/* side profile (x = length, +x is the FRONT, y = up) extruded across the width, centred */
function profile(shape, width, m, bev = 0.05) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 14 });
  g.translate(0, 0, -(width - bev * 2) / 2); g.rotateY(Math.PI / 2);          // shape +x → world -z (front)
  return new THREE.Mesh(g, m);
}
const cyl = (rt, rb, h, m, x = 0, y = 0, z = 0, seg = 20) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); k.position.set(x, y, z); return k; };
const ball = (r, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const k = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18), m); k.position.set(x, y, z); k.scale.set(sx, sy, sz); return k; };
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.set(x, y, z); return k; };
function tube(a, b, r, m, seg = 10) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const k = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, seg), m);
  k.position.copy(A).addScaledVector(d, 0.5); k.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return k;
}
/* a wheel whose axle is the X axis. spin = rotate the returned group around x */
function wheel(R, tubeR, width, M, o = {}) {
  const g = new THREE.Group(), spokes = o.spokes || 5;
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(R - tubeR, tubeR, 16, 40), M.rubber);
  tyre.rotation.y = Math.PI / 2; tyre.scale.z = Math.max(0.4, width / (tubeR * 2)); g.add(tyre);
  if (o.wire) {
    for (let i = 0; i < 18; i++) { const s = box(0.006, R * 1.78, 0.006, M.chrome); s.rotation.x = (i / 18) * Math.PI; s.rotation.y = (i % 2 ? 0.07 : -0.07); g.add(s); }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R - tubeR * 1.7, 0.012, 8, 40), M.chrome); rim.rotation.y = Math.PI / 2; g.add(rim);
    g.add(cyl(0.03, 0.03, 0.09, M.chrome, 0, 0, 0, 12).rotateZ(Math.PI / 2));
    return g;
  }
  const rimR = R - tubeR * 1.5;
  const disc = cyl(rimR, rimR, width * 0.62, o.rimMat || M.chrome, 0, 0, 0, 36); disc.rotation.z = Math.PI / 2; g.add(disc);
  const brake = cyl(rimR * 0.78, rimR * 0.78, width * 0.7, M.dark, 0, 0, 0, 28); brake.rotation.z = Math.PI / 2; g.add(brake);
  for (let i = 0; i < spokes; i++) { const s = box(width * 0.66, rimR * 0.2, rimR * 1.7, o.rimMat || M.chrome); s.rotation.x = (i / spokes) * Math.PI; g.add(s); }
  const hub = cyl(rimR * 0.22, rimR * 0.22, width * 0.78, M.steel, 0, 0, 0, 16); hub.rotation.z = Math.PI / 2; g.add(hub);
  return g;
}
const pair = (fn, x) => { const a = fn(-1), b = fn(1); a.position.x = -x; b.position.x = x; return [a, b]; };

/* ============================================================
   BICYCLE
   ============================================================ */
function bicycle() {
  const M = mats(), root = new THREE.Group(), wheels = [], extra = [];
  const frame = paint(0x0ea5e9, { metalness: 0.7, roughness: 0.25 }), acc = paint(0x111827);
  const fw = wheel(0.36, 0.028, 0.05, M, { wire: true }), rw = wheel(0.36, 0.028, 0.05, M, { wire: true });
  fw.position.set(0, 0.36, -0.62); rw.position.set(0, 0.36, 0.62); wheels.push(fw, rw); root.add(fw, rw);
  const BB = [0, 0.34, 0.06], ST = [0, 0.84, 0.16], HT = [0, 0.9, -0.5], HB = [0, 0.78, -0.53], RA = [0, 0.36, 0.62], FA = [0, 0.36, -0.62];
  [[BB, ST, 0.024], [ST, HT, 0.024], [BB, HB, 0.03], [ST, RA, 0.014], [BB, RA, 0.014]].forEach(([a, b, r]) => root.add(tube(a, b, r, frame)));
  root.add(tube(HB, FA, 0.017, M.chrome), tube([0, 0.78, -0.53], [0, 0.97, -0.5], 0.02, M.chrome));       // fork + steerer
  root.add(tube([-0.3, 1.0, -0.47], [0.3, 1.0, -0.47], 0.014, M.chrome));                                    // bars
  [-0.3, 0.3].forEach(x => { const g = cyl(0.02, 0.02, 0.1, M.rubber, x, 1.0, -0.47, 10); g.rotation.z = Math.PI / 2; root.add(g); });
  root.add(tube(ST, [0, 0.98, 0.2], 0.012, M.chrome));
  const sad = rbox(0.14, 0.05, 0.3, 0.025, acc, 0, 0.99, 0.2); root.add(sad);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 28), M.chrome); ring.rotation.y = Math.PI / 2; ring.position.set(0.045, 0.34, 0.06); root.add(ring);
  const crank = new THREE.Group(); crank.position.set(0, 0.34, 0.06); crank.add(tube([0.06, 0, 0], [0.06, -0.17, 0], 0.012, M.chrome), tube([-0.06, 0, 0], [-0.06, 0.17, 0], 0.012, M.chrome));
  crank.add(box(0.1, 0.02, 0.06, M.dark, 0.1, -0.17, 0), box(0.1, 0.02, 0.06, M.dark, -0.1, 0.17, 0)); root.add(crank); extra.push({ o: crank, axis: 'x', k: 1 });
  root.add(tube([0, 0.34, 0.06], [0.05, 0.34, 0.62], 0.01, M.dark));                                        // chain
  const lamp = cyl(0.035, 0.04, 0.05, M.white, 0, 1.02, -0.55, 12); lamp.rotation.x = Math.PI / 2; root.add(lamp);
  [-1, 1].forEach(s => root.add(box(0.012, 0.012, 0.3, M.chrome, s * 0.04, 0.5, -0.62)));                     // fenders cue
  return { group: root, wheels, spin: extra, wheelR: [0.36] };
}

/* ============================================================
   MOTORBIKE
   ============================================================ */
function motorbike() {
  const M = mats(), root = new THREE.Group(), wheels = [];
  const body = paint(0xf59e0b, { metalness: 0.5 }), blk = paint(0x0b0d12, { metalness: 0.3, roughness: 0.4 });
  const fw = wheel(0.4, 0.085, 0.16, M, { spokes: 6 }), rw = wheel(0.4, 0.095, 0.2, M, { spokes: 6 });
  fw.position.set(0, 0.4, -0.82); rw.position.set(0, 0.4, 0.78); wheels.push(fw, rw); root.add(fw, rw);
  root.add(rbox(0.34, 0.34, 0.62, 0.08, M.steel, 0, 0.48, 0.0));                                              // engine block
  root.add(rbox(0.3, 0.2, 0.3, 0.05, M.dark, 0, 0.32, 0.12));
  root.add(ball(0.2, body, 0, 0.88, -0.22, 0.95, 0.85, 1.55));                                                // tank
  root.add(rbox(0.3, 0.12, 0.62, 0.05, blk, 0, 0.88, 0.42));                                                  // seat
  const tail = rbox(0.26, 0.14, 0.5, 0.06, body, 0, 0.92, 0.82); tail.rotation.x = -0.12; root.add(tail);
  [-1, 1].forEach(s => { root.add(tube([s * 0.11, 0.98, -0.62], [s * 0.07, 0.42, -0.82], 0.028, M.chrome)); });  // forks
  root.add(tube([-0.34, 1.07, -0.5], [0.34, 1.07, -0.5], 0.016, M.chrome));
  [-0.34, 0.34].forEach(x => { const g = cyl(0.026, 0.026, 0.13, M.rubber, x, 1.07, -0.5, 10); g.rotation.z = Math.PI / 2; root.add(g); });
  const fair = rbox(0.42, 0.3, 0.2, 0.09, body, 0, 0.98, -0.66); fair.rotation.x = 0.22; root.add(fair);
  const scr = rbox(0.3, 0.2, 0.02, 0.04, M.glass, 0, 1.14, -0.7); scr.rotation.x = -0.55; root.add(scr);
  const hl = cyl(0.075, 0.085, 0.07, M.white, 0, 0.98, -0.78, 18); hl.rotation.x = Math.PI / 2; root.add(hl);
  root.add(box(0.1, 0.04, 0.02, M.red, 0, 0.93, 1.07));
  const fen = rbox(0.18, 0.04, 0.5, 0.02, body, 0, 0.62, -0.84); fen.rotation.x = 0.12; root.add(fen);
  const ex = cyl(0.05, 0.065, 0.8, M.chrome, 0.2, 0.36, 0.55, 16); ex.rotation.x = Math.PI / 2 - 0.05; root.add(ex);
  root.add(cyl(0.062, 0.062, 0.03, M.dark, 0.2, 0.37, 0.95, 16).rotateX(Math.PI / 2));
  root.add(tube([0.0, 0.5, 0.15], [0.0, 0.42, 0.78], 0.022, M.steel));                                       // swing arm
  return { group: root, wheels, wheelR: [0.4] };
}

/* ============================================================
   CAR  - low coupe, built from a real side profile
   ============================================================ */
function car() {
  const M = mats(), root = new THREE.Group(), wheels = [];
  const body = paint(0xb91c1c, { metalness: 0.62, roughness: 0.26 });
  const sh = new THREE.Shape();
  sh.moveTo(-1.9, 0.3); sh.lineTo(1.82, 0.3); sh.quadraticCurveTo(2.04, 0.34, 2.05, 0.56); sh.quadraticCurveTo(2.05, 0.7, 1.72, 0.8);
  sh.lineTo(0.78, 0.92); sh.lineTo(-1.5, 0.94); sh.quadraticCurveTo(-1.98, 0.94, -2.03, 0.62); sh.quadraticCurveTo(-2.05, 0.4, -1.9, 0.3);
  root.add(profile(sh, 1.74, body, 0.07));
  const cab = new THREE.Shape();
  cab.moveTo(0.82, 0.9); cab.lineTo(0.3, 1.4); cab.quadraticCurveTo(0.15, 1.47, -0.2, 1.47); cab.lineTo(-0.66, 1.45); cab.quadraticCurveTo(-1.12, 1.4, -1.5, 0.9); cab.closePath();
  root.add(profile(cab, 1.5, M.glass, 0.04));
  const roof = new THREE.Shape();
  roof.moveTo(0.3, 1.405); roof.quadraticCurveTo(0.15, 1.5, -0.2, 1.5); roof.lineTo(-0.66, 1.485); roof.quadraticCurveTo(-1.0, 1.45, -1.16, 1.33); roof.lineTo(-0.9, 1.33); roof.lineTo(0.28, 1.33); roof.closePath();
  root.add(profile(roof, 1.52, body, 0.03));
  [-1, 1].forEach(s => root.add(box(0.05, 0.5, 0.06, body, s * 0.77, 1.16, -0.32).rotateZ(s * -0.06)));      // B pillars
  const stripe = rbox(0.34, 0.012, 3.0, 0.004, paint(0xf8fafc, { metalness: 0.2 }), 0, 0.945, -0.1); root.add(stripe);
  const [fl, fr] = pair(() => wheel(0.34, 0.085, 0.22, M, { spokes: 6 }), 0.8), [rl, rr] = pair(() => wheel(0.34, 0.085, 0.22, M, { spokes: 6 }), 0.8);
  [fl, fr].forEach(w => w.position.set(w.position.x, 0.34, -1.28)); [rl, rr].forEach(w => w.position.set(w.position.x, 0.34, 1.2));
  root.add(fl, fr, rl, rr); wheels.push(fl, fr, rl, rr);
  [[-1.28], [1.2]].forEach(([z]) => [-1, 1].forEach(s => { const a = cyl(0.4, 0.4, 0.1, M.dark, s * 0.84, 0.36, z, 24); a.rotation.z = Math.PI / 2; root.add(a); }));
  [-1, 1].forEach(s => {
    const hl = rbox(0.34, 0.09, 0.05, 0.03, M.white, s * 0.56, 0.7, -2.04); hl.rotation.y = s * 0.2; root.add(hl);
    root.add(rbox(0.4, 0.07, 0.05, 0.03, M.red, s * 0.56, 0.78, 2.0));
    root.add(rbox(0.12, 0.1, 0.12, 0.04, body, s * 0.92, 1.02, -0.55));                                         // mirrors
    root.add(cyl(0.05, 0.05, 0.1, M.chrome, s * 0.4, 0.4, 2.0, 14).rotateX(Math.PI / 2));                      // exhausts
    root.add(box(0.012, 0.08, 1.15, M.dark, s * 0.876, 0.62, 0.0));                                              // door shut line
  });
  root.add(rbox(0.8, 0.14, 0.04, 0.04, M.dark, 0, 0.55, -2.05));                                                // grille
  root.add(rbox(1.5, 0.05, 0.12, 0.02, M.dark, 0, 0.34, -2.0), rbox(1.5, 0.05, 0.1, 0.02, M.dark, 0, 0.36, 2.0));
  root.add(rbox(1.46, 0.04, 0.28, 0.02, body, 0, 1.08, 1.84));                                                   // ducktail
  return { group: root, wheels, wheelR: [0.34] };
}

/* ============================================================
   PICKUP TRUCK
   ============================================================ */
function truck() {
  const M = mats(), root = new THREE.Group(), wheels = [];
  const body = paint(0xd97706, { metalness: 0.5, roughness: 0.34 }), blk = paint(0x0e1116, { metalness: 0.3, roughness: 0.5 });
  const sh = new THREE.Shape();
  sh.moveTo(-2.15, 0.45); sh.lineTo(2.0, 0.45); sh.quadraticCurveTo(2.2, 0.48, 2.2, 0.72); sh.lineTo(2.18, 1.02); sh.quadraticCurveTo(2.1, 1.1, 1.82, 1.12);
  sh.lineTo(0.95, 1.16); sh.lineTo(0.95, 1.2); sh.lineTo(-0.15, 1.2); sh.lineTo(-0.15, 1.1); sh.lineTo(-2.1, 1.1); sh.quadraticCurveTo(-2.18, 1.1, -2.18, 1.0); sh.lineTo(-2.18, 0.55); sh.quadraticCurveTo(-2.18, 0.45, -2.15, 0.45);
  root.add(profile(sh, 1.9, body, 0.07));
  root.add(rbox(1.62, 0.07, 1.35, 0.03, blk, 0, 1.095, 1.45).translateY(0.0));                                    // bed liner
  [-1, 1].forEach(s => { root.add(rbox(0.07, 0.34, 1.5, 0.03, body, s * 0.92, 1.28, 1.42)); });
  root.add(rbox(1.9, 0.34, 0.07, 0.03, body, 0, 1.28, 2.1));
  const cab = new THREE.Shape();
  cab.moveTo(0.98, 1.1); cab.lineTo(0.42, 1.78); cab.quadraticCurveTo(0.32, 1.86, 0.1, 1.86); cab.lineTo(-0.5, 1.86); cab.quadraticCurveTo(-0.62, 1.86, -0.66, 1.76); cab.lineTo(-0.68, 1.1); cab.closePath();
  root.add(profile(cab, 1.72, M.glass, 0.04));
  const roof = new THREE.Shape(); roof.moveTo(0.4, 1.8); roof.quadraticCurveTo(0.3, 1.9, 0.1, 1.9); roof.lineTo(-0.5, 1.9); roof.quadraticCurveTo(-0.66, 1.9, -0.7, 1.78); roof.lineTo(-0.7, 1.7); roof.lineTo(0.4, 1.7); roof.closePath();
  root.add(profile(roof, 1.74, body, 0.04));
  const [fl, fr] = pair(() => wheel(0.43, 0.12, 0.26, M, { spokes: 7, rimMat: M.steel }), 0.9), [rl, rr] = pair(() => wheel(0.43, 0.12, 0.26, M, { spokes: 7, rimMat: M.steel }), 0.9);
  [fl, fr].forEach(w => w.position.set(w.position.x, 0.43, -1.35)); [rl, rr].forEach(w => w.position.set(w.position.x, 0.43, 1.35));
  root.add(fl, fr, rl, rr); wheels.push(fl, fr, rl, rr);
  [[-1.35], [1.35]].forEach(([z]) => [-1, 1].forEach(s => { const a = cyl(0.5, 0.5, 0.12, M.dark, s * 0.94, 0.46, z, 24); a.rotation.z = Math.PI / 2; root.add(a); }));
  [-1, 1].forEach(s => {
    root.add(rbox(0.38, 0.14, 0.06, 0.03, M.white, s * 0.68, 0.92, -2.2));
    root.add(rbox(0.16, 0.34, 0.06, 0.03, M.red, s * 0.86, 0.92, 2.14));
    root.add(rbox(0.12, 0.12, 0.16, 0.04, blk, s * 1.0, 1.4, -0.3));
    root.add(tube([s * 0.82, 0.5, -2.18], [s * 0.82, 1.0, -2.2], 0.035, M.chrome));
  });
  root.add(tube([-0.82, 0.78, -2.22], [0.82, 0.78, -2.22], 0.035, M.chrome));                                    // bull bar
  root.add(rbox(1.1, 0.22, 0.05, 0.03, M.dark, 0, 0.9, -2.21), rbox(1.0, 0.07, 0.07, 0.03, M.white, 0, 1.98, -0.1));
  root.add(rbox(1.9, 0.14, 0.14, 0.05, blk, 0, 0.5, 2.18), rbox(1.9, 0.14, 0.14, 0.05, blk, 0, 0.5, -2.2));
  root.add(tube([-0.84, 1.5, 0.8], [-0.84, 1.95, 0.8], 0.03, M.dark), tube([0.84, 1.5, 0.8], [0.84, 1.95, 0.8], 0.03, M.dark), tube([-0.84, 1.95, 0.8], [0.84, 1.95, 0.8], 0.03, M.dark));
  return { group: root, wheels, wheelR: [0.43] };
}

/* ============================================================
   LOCOMOTIVE
   ============================================================ */
function locomotive() {
  const M = mats(), root = new THREE.Group(), wheels = [];
  const body = paint(0x1d4ed8, { metalness: 0.5, roughness: 0.34 }), nose = paint(0xfacc15, { metalness: 0.4, roughness: 0.36 }), under = paint(0x1e293b, { metalness: 0.5, roughness: 0.5 });
  const sh = new THREE.Shape();
  sh.moveTo(-2.7, 0.5); sh.lineTo(2.6, 0.5); sh.lineTo(2.7, 1.1); sh.quadraticCurveTo(2.7, 1.55, 2.3, 1.7); sh.lineTo(1.2, 2.5); sh.lineTo(-2.55, 2.6); sh.quadraticCurveTo(-2.7, 2.6, -2.7, 2.45); sh.closePath();
  root.add(profile(sh, 1.96, body, 0.08));
  const ns = new THREE.Shape(); ns.moveTo(2.62, 0.5); ns.lineTo(2.7, 1.1); ns.quadraticCurveTo(2.7, 1.55, 2.3, 1.7); ns.lineTo(1.9, 1.98); ns.lineTo(1.9, 0.5); ns.closePath();
  root.add(profile(ns, 1.98, nose, 0.08));
  root.add(profile((() => { const s = new THREE.Shape(); s.moveTo(-2.72, 0.32); s.lineTo(2.72, 0.32); s.lineTo(2.68, 0.62); s.lineTo(-2.7, 0.62); s.closePath(); return s; })(), 1.9, under, 0.04));
  const ws = new THREE.Shape(); ws.moveTo(2.08, 1.62); ws.lineTo(1.5, 2.28); ws.lineTo(1.16, 2.28); ws.lineTo(1.14, 1.62); ws.closePath();
  root.add(profile(ws, 1.7, M.glass, 0.03));
  [-1, 1].forEach(s => { root.add(rbox(0.02, 0.5, 0.7, 0.03, M.glass, s * 1.0, 1.95, 0.55), rbox(0.02, 0.5, 0.9, 0.03, M.glass, s * 1.0, 1.95, -0.65).translateY(0)); });
  root.add(rbox(1.98, 0.14, 4.6, 0.02, paint(0xf8fafc, { metalness: 0.2 }), 0, 1.15, 0.1));                      // stripe
  root.add(rbox(1.7, 0.18, 4.0, 0.06, M.steel, 0, 2.66, 0.35));                                                   // roof module
  for (let i = 0; i < 3; i++) root.add(cyl(0.36, 0.36, 0.08, M.dark, 0, 2.78, 0.0 + i * 1.1 - 0.3, 24), cyl(0.3, 0.3, 0.02, M.steel, 0, 2.83, i * 1.1 - 0.3, 24));
  [-1, 1].forEach(s => {
    root.add(rbox(0.5, 0.3, 0.06, 0.04, M.white, s * 0.6, 1.32, -2.72).translateY(0));
    const hl = cyl(0.16, 0.16, 0.06, M.white, s * 0.62, 1.32, -2.74, 22); hl.rotation.x = Math.PI / 2; root.add(hl);
    root.add(cyl(0.09, 0.09, 0.4, M.chrome, s * 0.8, 0.52, -2.88, 14).rotateX(Math.PI / 2), cyl(0.15, 0.15, 0.05, M.dark, s * 0.8, 0.52, -3.08, 16).rotateX(Math.PI / 2));   // buffers
    root.add(rbox(0.44, 0.34, 0.04, 0.04, M.red, s * 0.55, 0.9, 2.74));
  });
  root.add(rbox(0.36, 0.2, 0.05, 0.03, M.amber, 0, 2.3, -1.3));                                                   // headcode board
  const bog = (z) => { for (const s of [-1, 1]) for (const dz of [-0.55, 0, 0.55]) { const w = wheel(0.36, 0.045, 0.1, M, { spokes: 8, rimMat: M.steel }); w.position.set(s * 0.82, 0.4, z + dz); root.add(w); wheels.push(w); } root.add(rbox(1.9, 0.12, 1.8, 0.04, M.dark, 0, 0.42, z).translateY(0)); };
  bog(-1.4); bog(1.4);
  return { group: root, wheels, wheelR: [0.36] };
}

/* ============================================================
   HELICOPTER   (skids rest on y = 0; the game lifts it)
   ============================================================ */
function helicopter() {
  const M = mats(), root = new THREE.Group(), spin = [];
  const body = paint(0xe6ebf2, { metalness: 0.45, roughness: 0.24 }), gold = paint(0xf59e0b, { metalness: 0.8, roughness: 0.25 });
  const hull = ball(1, body, 0, 1.0, 0, 0.62, 0.62, 1.22); root.add(hull);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 20, Math.PI + 0.32, Math.PI - 0.64, 0.28, 1.3), M.glass); glass.scale.set(0.635, 0.635, 1.24); glass.position.set(0, 1.02, 0); root.add(glass);
  root.add(ball(1, gold, 0, 0.98, 0.3, 0.64, 0.13, 0.9).translateY(-0.1));                                         // belt line
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.07, 2.3, 18), body); boom.rotation.x = Math.PI / 2; boom.position.set(0, 1.12, 2.0); boom.rotation.x = Math.PI / 2 + 0.04; root.add(boom);
  root.add(rbox(0.07, 0.62, 0.5, 0.03, body, 0, 1.46, 3.0).translateY(0), rbox(0.2, 0.05, 0.4, 0.02, gold, 0, 1.18, 3.05));
  const mast = cyl(0.1, 0.13, 0.4, M.steel, 0, 1.78, 0.1, 14); root.add(mast, cyl(0.07, 0.07, 0.12, M.chrome, 0, 2.02, 0.1, 14));
  root.add(rbox(0.9, 0.22, 1.0, 0.1, body, 0, 1.68, 0.2));                                                         // engine cowl
  const rotor = new THREE.Group(); rotor.position.set(0, 2.1, 0.1);
  for (let i = 0; i < 4; i++) { const b = rbox(2.5, 0.025, 0.17, 0.02, M.dark); b.position.x = 1.25; const pv = new THREE.Group(); pv.rotation.y = (i * Math.PI) / 2; pv.add(b); b.rotation.z = 0.04; rotor.add(pv); }
  rotor.add(cyl(0.12, 0.12, 0.09, M.chrome, 0, 0, 0, 14));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.55, 48), new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide })); disc.rotation.x = -Math.PI / 2; disc.userData.keepVisible = true; rotor.add(disc);
  root.add(rotor); spin.push({ o: rotor, axis: 'y', k: 38 });
  const trot = new THREE.Group(); trot.position.set(0.1, 1.5, 3.05);
  [0, Math.PI / 2].forEach(a => { const b = rbox(0.03, 0.62, 0.07, 0.015, M.dark); b.rotation.x = a; trot.add(b); }); root.add(trot); spin.push({ o: trot, axis: 'x', k: 44 });
  [-1, 1].forEach(s => {
    root.add(tube([s * 0.62, 0.14, -1.05], [s * 0.62, 0.14, 0.9], 0.04, M.steel).translateY(0));
    root.add(ball(0.045, M.steel, s * 0.62, 0.14, -1.05));
    root.add(tube([s * 0.62, 0.14, -0.5], [s * 0.34, 0.62, -0.5], 0.03, M.steel), tube([s * 0.62, 0.14, 0.5], [s * 0.34, 0.62, 0.5], 0.03, M.steel));
    root.add(rbox(0.02, 0.5, 0.8, 0.03, M.glass, s * 0.4, 1.12, -0.4).translateY(0));
    root.add(ball(0.05, glow(s < 0 ? 0xff3030 : 0x32e068, 2.2), s * 0.62, 1.0, 0.4));
  });
  root.add(ball(0.07, M.white, 0, 0.55, -1.05).translateX(0), ball(0.05, M.red, 0, 1.78, 3.05));
  return { group: root, wheels: [], spin, wheelR: [] };
}

/* ───────────── public: build one ride ───────────── */

/* ============================================================
   SPEEDBOAT - deep-V hull, windscreen, driver seat, outboard
   ============================================================ */
function speedboat() {
  const M = mats(), root = new THREE.Group();
  const hullM = paint(0x0b5fa5, { metalness: 0.55, roughness: 0.28, side: THREE.DoubleSide }), white = paint(0xf4f7fb, { metalness: 0.3, roughness: 0.3, side: THREE.DoubleSide });
  const seatM = std(0x1b2230, 0.1, 0.7), deckM = std(0xc9b48a, 0.1, 0.8);
  /* side profile: +x is the FRONT. Sharp raised bow, flat stern. */
  const sh = new THREE.Shape();
  sh.moveTo(-1.55, 0.18); sh.lineTo(1.0, 0.1); sh.quadraticCurveTo(1.7, 0.2, 2.05, 0.72);
  sh.lineTo(1.2, 0.7); sh.lineTo(-0.2, 0.62); sh.lineTo(-1.55, 0.62); sh.lineTo(-1.55, 0.18);
  const hull = profile(sh, 1.3, hullM, 0.06); root.add(hull);
  const hullTop = profile((() => { const t = new THREE.Shape(); t.moveTo(-1.55, 0.6); t.lineTo(1.2, 0.68); t.lineTo(2.0, 0.7); t.lineTo(2.05, 0.72); t.lineTo(1.2, 0.73); t.lineTo(-1.55, 0.66); t.lineTo(-1.55, 0.6); return t; })(), 1.38, white, 0.02); root.add(hullTop);
  /* inner cockpit floor + deck */
  root.add(rbox(1.0, 0.04, 2.1, 0.02, deckM, 0, 0.32, 0.25));
  root.add(rbox(1.18, 0.05, 1.4, 0.03, white, 0, 0.7, -1.2));                       // foredeck
  /* windscreen + frame */
  const scr = rbox(1.02, 0.42, 0.03, 0.04, M.glass, 0, 0.98, -0.52); scr.rotation.x = -0.42; root.add(scr);
  root.add(tube([-0.53, 0.76, -0.4], [-0.5, 1.15, -0.6], 0.02, M.chrome), tube([0.53, 0.76, -0.4], [0.5, 1.15, -0.6], 0.02, M.chrome), tube([-0.5, 1.15, -0.6], [0.5, 1.15, -0.6], 0.018, M.chrome));
  /* dash + helm */
  root.add(rbox(1.0, 0.3, 0.3, 0.06, M.dark, 0, 0.86, -0.38));
  const wheelG = new THREE.Group(); wheelG.position.set(-0.22, 0.98, -0.28); wheelG.rotation.x = 0.7;
  wheelG.add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.016, 8, 24), M.dark));
  for (let i = 0; i < 3; i++) { const sp = box(0.3, 0.014, 0.014, M.chrome); sp.rotation.z = (i * Math.PI) / 3; wheelG.add(sp); } root.add(wheelG);
  /* seats */
  root.add(rbox(0.46, 0.14, 0.42, 0.05, seatM, -0.26, 0.5, 0.35), rbox(0.46, 0.4, 0.1, 0.05, seatM, -0.26, 0.72, 0.58));
  root.add(rbox(0.46, 0.14, 0.42, 0.05, seatM, 0.26, 0.5, 0.35), rbox(0.46, 0.4, 0.1, 0.05, seatM, 0.26, 0.72, 0.58));
  root.add(rbox(1.0, 0.16, 0.5, 0.06, seatM, 0, 0.5, 1.12));
  /* stripe + rails + lights */
  root.add(profile((() => { const t = new THREE.Shape(); t.moveTo(-1.5, 0.4); t.lineTo(1.5, 0.42); t.lineTo(1.7, 0.5); t.lineTo(-1.5, 0.48); t.lineTo(-1.5, 0.4); return t; })(), 1.34, glow(0xfacc15, 0.6), 0.01));
  [-1, 1].forEach(sx => { root.add(tube([sx * 0.62, 0.78, 1.45], [sx * 0.62, 0.78, -0.2], 0.014, M.chrome)); [1.45, 0.6, -0.2].forEach(z => root.add(tube([sx * 0.62, 0.7, z], [sx * 0.62, 0.8, z], 0.014, M.chrome))); });
  root.add(ball(0.05, glow(0xff3030, 2.2), -0.6, 0.76, -1.42), ball(0.05, glow(0x32e068, 2.2), 0.6, 0.76, -1.42));
  /* outboard motor */
  const mot = new THREE.Group(); mot.position.set(0, 0.5, 1.72);
  mot.add(rbox(0.34, 0.4, 0.3, 0.07, white, 0, 0.12, 0), cyl(0.05, 0.06, 0.5, M.steel, 0, -0.18, 0.04, 12), rbox(0.2, 0.16, 0.3, 0.05, M.steel, 0, -0.44, 0.04));
  const prop = new THREE.Group(); prop.position.set(0, -0.44, 0.22);
  for (let i = 0; i < 3; i++) { const bl = box(0.04, 0.2, 0.012, M.chrome, 0, 0.1, 0); const pv = new THREE.Group(); pv.rotation.z = (i * Math.PI * 2) / 3; pv.add(bl); bl.rotation.x = 0.4; prop.add(pv); }
  mot.add(prop); root.add(mot);
  return { group: root, wheels: [], spin: [{ o: prop, axis: 'z', k: 40 }], wheelR: [0.4] };
}

const BUILDERS = { bicycle, motorbike, car, truck, train: locomotive, boat: speedboat, helicopter };
export function buildVehicle(id) {
  const b = BUILDERS[id]; if (!b) throw new Error('Unknown vehicle ' + id);
  const r = b(), R = r.wheelR[0] || 0.4, spinners = r.spin || [];
  r.group.traverse(o => { if (o.isMesh && !o.userData.keepVisible) { o.castShadow = false; } });
  /* speed in m/s → wheels roll forward, rotors spin */
  r.update = (dt, speed) => {
    for (const w of r.wheels) w.rotation.x -= (speed / R) * dt;
    for (const s of spinners) s.o.rotation[s.axis] += s.k * dt * (s.axis === 'x' && s.k === 1 ? Math.max(0.2, speed / 6) : 1);
  };
  return r;
}

/* ============================================================
   PIT STOP station  (stands left of the track)
   ============================================================ */
export function buildPitStop() {
  const M = mats(), g = new THREE.Group();
  const roofM = paint(0xf8fafc, { metalness: 0.2, roughness: 0.4 }), pillar = std(0x2b3544, 0.8, 0.35), accent = paint(0xef4444);
  g.add(rbox(3.6, 0.12, 2.8, 0.05, roofM, 0, 3.2, 0), rbox(3.62, 0.2, 0.06, 0.02, accent, 0, 3.08, 1.4), rbox(3.62, 0.2, 0.06, 0.02, accent, 0, 3.08, -1.4));
  [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]].forEach(([x, z]) => g.add(cyl(0.07, 0.08, 3.1, pillar, x, 1.55, z, 12)));
  g.add(rbox(3.6, 0.1, 2.8, 0.03, std(0x1a1f29, 0.2, 0.8), 0, 0.05, 0));
  [-0.9, 0.9].forEach(x => {
    g.add(rbox(0.5, 1.45, 0.4, 0.08, paint(0xef4444, { metalness: 0.35 }), x, 0.82, 0));
    g.add(rbox(0.36, 0.36, 0.02, 0.04, M.glass, x, 1.2, 0.21), rbox(0.2, 0.08, 0.02, 0.02, glow(0x34d399, 1.6), x, 1.2, 0.225));
    g.add(tube([x + 0.25, 1.1, 0.1], [x + 0.5, 0.45, 0.25], 0.025, M.dark));
  });
  g.add(rbox(2.4, 0.5, 0.06, 0.05, glow(0x0ea5e9, 1.2), 0, 2.78, 1.43));
  const c = document.createElement('canvas'); c.width = 512; c.height = 112; const x = c.getContext('2d');
  x.fillStyle = '#082032'; x.fillRect(0, 0, 512, 112); x.fillStyle = '#e0f2fe'; x.font = '800 62px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('PIT STOP', 256, 58);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.5), new THREE.MeshBasicMaterial({ map: tex })); label.position.set(0, 2.78, 1.47); g.add(label);
  /* overhead gantry: stretches across the track so the stop is easy to spot even inside the tunnel */
  const gan = new THREE.Group(); gan.position.set(5.3, 0, 0);
  gan.add(rbox(8.4, 0.14, 0.16, 0.04, pillar, 0, 4.5, 0));
  [-0.9, 0.9].forEach(x => gan.add(cyl(0.025, 0.025, 0.55, M.steel, x, 4.2, 0.02, 8)));
  gan.add(rbox(3.3, 0.8, 0.07, 0.06, std(0x082032, 0.3, 0.5), 0, 3.7, 0.04));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.68), new THREE.MeshBasicMaterial({ map: tex })); sign.position.set(0, 3.7, 0.085); gan.add(sign);
  gan.add(box(2.9, 0.04, 0.02, glow(0x38bdf8, 2.2), 0, 3.27, 0.09));
  g.add(gan);
  g.userData.tex = tex;
  return g;
}

/* ───────────── memory clean-up ───────────── */
export function disposeObject(o) {
  if (!o) return;
  o.traverse(c => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
  });
  if (o.userData && o.userData.tex) o.userData.tex.dispose();
}

/* ============================================================
   GARAGE VIEWER  - a studio turntable for one ride at a time
   ============================================================ */
export function createViewer(host) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y';
  host.appendChild(canvas);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { canvas.remove(); return null; }
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  /* studio reflections */
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 14, 30), new THREE.MeshBasicMaterial({ color: 0x1b2433, side: THREE.BackSide })));
  [[12, 3, 0, 6.5, 0, Math.PI / 2, 0, 0xfff1d6], [4, 6, -10, 3, 2, 0, Math.PI / 2, 0xbcd4ff], [4, 6, 10, 3, -3, 0, -Math.PI / 2, 0xffe0b0]].forEach(([w, h, x, y, z, rx, ry, c]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(6), side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m);
  });
  const pm = new THREE.PMREMGenerator(renderer); const envTex = pm.fromScene(env, 0.03).texture; pm.dispose(); scene.environment = envTex;
  scene.add(new THREE.HemisphereLight(0xdbe8ff, 0x1a2030, 0.55));
  const key = new THREE.DirectionalLight(0xfff0dd, 2.0); key.position.set(-4, 7, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7aa7ff, 1.1); rim.position.set(5, 3, -6); scene.add(rim);
  /* floor + soft shadow disc */
  const fc = document.createElement('canvas'); fc.width = fc.height = 256; const fx = fc.getContext('2d');
  const gr = fx.createRadialGradient(128, 128, 8, 128, 128, 126); gr.addColorStop(0, 'rgba(56,189,248,0.30)'); gr.addColorStop(0.5, 'rgba(30,41,59,0.55)'); gr.addColorStop(1, 'rgba(15,23,42,0)');
  fx.fillStyle = gr; fx.fillRect(0, 0, 256, 256);
  const floorTex = new THREE.CanvasTexture(fc); floorTex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; scene.add(floor);
  const stage = new THREE.Group(); scene.add(stage);
  let current = null, curDef = null, t0 = performance.now(), raf = 0, dead = false, drag = null, yaw = -0.6, auto = true, lift = 0, fitR = 3, fitH = 2;

  function fit() {
    const w = Math.max(2, host.clientWidth), h = Math.max(2, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vfov = camera.fov * Math.PI / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const distV = ((fitH * 0.5 + 0.35) / Math.tan(vfov / 2)) * 1.45, distH = (fitR / Math.tan(hfov / 2)) * 1.12;
    const dist = Math.max(distV, distH);
    camera.position.set(0, fitH * 0.42 + lift * 0.4 + dist * 0.14, dist); camera.near = 0.1; camera.far = dist * 6;
    camera.lookAt(0, fitH * 0.4 + lift * 0.2, 0); camera.updateProjectionMatrix();
    floor.scale.setScalar(fitR * 1.15);
  }
  function show(id, locked) {
    if (current) { stage.remove(current.group); disposeObject(current.group); current = null; }
    curDef = VEHICLE_BY_ID[id]; if (!curDef) return;
    current = buildVehicle(id); stage.add(current.group);
    if (locked) current.group.traverse(o => { if (o.isMesh && o.material && o.material.color && !o.userData.keepVisible) { o.material.color.multiplyScalar(0.28); if (o.material.emissive) o.material.emissiveIntensity *= 0.2; } });
    const box = new THREE.Box3().setFromObject(current.group), sz = box.getSize(new THREE.Vector3());
    lift = curDef.fly ? 0.9 : 0; current.group.position.y = lift;
    fitR = Math.hypot(sz.x, sz.z) * 0.5; fitH = sz.y + lift;
    fit();
  }
  function loop(now) {
    if (dead) return; raf = requestAnimationFrame(loop);
    const dt = Math.min((now - t0) / 1000, 0.05); t0 = now;
    if (!host.isConnected) { destroy(); return; }
    if (auto && !drag) yaw += dt * 0.45;
    stage.rotation.y = yaw;
    if (current) { current.update(dt, curDef && curDef.fly ? 6 : 1.2); if (curDef.fly) current.group.position.y = lift + Math.sin(now / 700) * 0.06; }
    renderer.render(scene, camera);
  }
  const down = e => { drag = { x: e.clientX, y: yaw }; auto = false; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); };
  const move = e => { if (drag) yaw = drag.y + (e.clientX - drag.x) * 0.012; };
  const up = () => { drag = null; clearTimeout(up.t); up.t = setTimeout(() => { auto = true; }, 2500); };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  const ro = new ResizeObserver(fit); ro.observe(host);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); });
  function destroy() {
    if (dead) return; dead = true; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(up.t);
    if (current) disposeObject(current.group); disposeObject(floor); envTex.dispose(); floorTex.dispose();
    renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {} canvas.remove();
  }
  raf = requestAnimationFrame(loop);
  return { show, destroy, resize: fit, setYaw(y) { yaw = y; auto = false; } };
}
