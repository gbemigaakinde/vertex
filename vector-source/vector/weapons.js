/* ============================================================
   vector/weapons.js  |  Data-driven weapons, equipment, loadouts.
   Gameplay numbers only. Nothing here describes real-world
   construction of anything.
   Angles (spread, recoil) are in degrees, times in milliseconds.
   ============================================================ */

export const WEAPONS = {
  ar_vanguard: {
    id: 'ar_vanguard', name: 'VG-26 Vanguard', cat: 'Assault Rifle', slot: 'primary',
    model: 'weapons/assault_rifle', modelScale: 1.0, unlock: 1,
    damage: 26, rpm: 620, auto: true, mag: 30, reserve: 120, reload: 1900,
    recoil: { v: 0.85, h: 0.3 }, spread: { hip: 3.0, ads: 0.7 }, range: 75, falloff: 35,
    headMult: 2.0, moveMult: 0.94, adsTime: 220, adsZoom: 1.35, pellets: 1, pickupAmmo: 30,
  },
  cb_kestrel: {
    id: 'cb_kestrel', name: 'KS-9 Kestrel', cat: 'Carbine', slot: 'primary',
    model: 'weapons/assault_rifle', modelScale: 0.85, unlock: 2,
    damage: 22, rpm: 720, auto: true, mag: 30, reserve: 150, reload: 1700,
    recoil: { v: 0.7, h: 0.35 }, spread: { hip: 3.4, ads: 0.9 }, range: 60, falloff: 28,
    headMult: 2.0, moveMult: 0.98, adsTime: 180, adsZoom: 1.3, pellets: 1, pickupAmmo: 30,
  },
  smg_hornet: {
    id: 'smg_hornet', name: 'HN-4 Hornet', cat: 'SMG', slot: 'primary',
    model: 'weapons/smg', modelScale: 1.0, unlock: 1,
    damage: 17, rpm: 900, auto: true, mag: 32, reserve: 160, reload: 1500,
    recoil: { v: 0.55, h: 0.45 }, spread: { hip: 4.0, ads: 1.4 }, range: 40, falloff: 18,
    headMult: 1.7, moveMult: 1.02, adsTime: 150, adsZoom: 1.25, pellets: 1, pickupAmmo: 32,
  },
  sg_breaker: {
    id: 'sg_breaker', name: 'BR-12 Breaker', cat: 'Shotgun', slot: 'primary',
    model: 'weapons/shotgun', modelScale: 1.0, unlock: 3,
    damage: 12, rpm: 75, auto: false, mag: 6, reserve: 30, reload: 2400,
    recoil: { v: 4.5, h: 1.0 }, spread: { hip: 5.5, ads: 4.2 }, range: 22, falloff: 8,
    headMult: 1.4, moveMult: 0.96, adsTime: 200, adsZoom: 1.2, pellets: 9, pickupAmmo: 6,
  },
  mr_longbow: {
    id: 'mr_longbow', name: 'LB-7 Longbow', cat: 'Marksman Rifle', slot: 'primary',
    model: 'weapons/sniper_rifle', modelScale: 0.9, unlock: 4,
    damage: 55, rpm: 210, auto: false, mag: 10, reserve: 50, reload: 2200,
    recoil: { v: 2.0, h: 0.4 }, spread: { hip: 3.0, ads: 0.15 }, range: 130, falloff: 80,
    headMult: 2.2, moveMult: 0.9, adsTime: 320, adsZoom: 2.6, pellets: 1, pickupAmmo: 10,
  },
  sn_aegis: {
    id: 'sn_aegis', name: 'AG-50 Aegis', cat: 'Sniper Rifle', slot: 'primary',
    model: 'weapons/sniper_rifle', modelScale: 1.0, unlock: 6,
    damage: 105, rpm: 52, auto: false, mag: 5, reserve: 20, reload: 3000,
    recoil: { v: 4.0, h: 0.6 }, spread: { hip: 6.0, ads: 0.03 }, range: 200, falloff: 150,
    headMult: 2.5, moveMult: 0.85, adsTime: 420, adsZoom: 4.0, pellets: 1, pickupAmmo: 5,
  },
  pistol_sparrow: {
    id: 'pistol_sparrow', name: 'SP-1 Sparrow', cat: 'Sidearm', slot: 'secondary',
    model: 'weapons/pistol', modelScale: 1.0, unlock: 1,
    damage: 24, rpm: 400, auto: false, mag: 12, reserve: 60, reload: 1300,
    recoil: { v: 1.1, h: 0.25 }, spread: { hip: 2.6, ads: 0.9 }, range: 45, falloff: 20,
    headMult: 2.0, moveMult: 1.05, adsTime: 120, adsZoom: 1.15, pellets: 1, pickupAmmo: 12,
  },
  rl_ember: {
    id: 'rl_ember', name: 'EM-1 Ember Launcher', cat: 'Launcher', slot: 'primary',
    model: 'weapons/rocket_launcher', modelScale: 1.0, unlock: 5,
    damage: 140, rpm: 30, auto: false, mag: 1, reserve: 4, reload: 3200,
    recoil: { v: 3.0, h: 0.5 }, spread: { hip: 1.5, ads: 0.4 }, range: 120, falloff: 999,
    headMult: 1, moveMult: 0.8, adsTime: 380, adsZoom: 1.4, pellets: 1, pickupAmmo: 1,
    projectile: { speed: 42, gravity: 0, radius: 4.2, splash: true },
  },
};

export const EQUIPMENT = {
  frag: {
    id: 'frag', name: 'Frag Charge', model: 'props/frag_grenade', kind: 'throw',
    fuse: 2.4, radius: 5.0, damage: 120, count: 2, throwSpeed: 15, desc: 'Explodes after a short fuse.',
  },
  flash: {
    id: 'flash', name: 'Flash Charge', model: 'props/flashbang', kind: 'throw',
    fuse: 1.6, radius: 9.0, blind: 3.2, count: 2, throwSpeed: 15, desc: 'Blinds and disorients everything nearby.',
  },
  smoke: {
    id: 'smoke', name: 'Smoke Canister', model: 'props/smoke_grenade', kind: 'throw',
    fuse: 1.2, radius: 5.5, duration: 14, count: 2, throwSpeed: 14, desc: 'Blocks line of sight for about 14 seconds.',
  },
  recon: {
    id: 'recon', name: 'Recon Pulse', model: 'props/flashbang', kind: 'pulse',
    radius: 32, duration: 7, count: 2, desc: 'Briefly marks enemies on the radar and in the world.',
  },
  cover: {
    id: 'cover', name: 'Deployable Cover', model: 'environment/barrier', kind: 'deploy',
    hp: 260, lifetime: 70, size: [2.2, 1.2, 0.5], count: 2, desc: 'Places a barrier in front of you.',
  },
  medkit: {
    id: 'medkit', name: 'Medkit', model: 'props/medkit', kind: 'heal',
    heal: 45, useTime: 2.2, count: 2, desc: 'Restores health after a short use time.',
  },
};

export const ARMOR = {
  none:   { id: 'none',   name: 'No Armour',    absorb: 0,    points: 0,   speed: 1.0,  aim: 1.0 },
  light:  { id: 'light',  name: 'Light Armour', absorb: 0.30, points: 40,  speed: 0.98, aim: 0.97 },
  medium: { id: 'medium', name: 'Medium Armour', absorb: 0.45, points: 70, speed: 0.93, aim: 0.9 },
  heavy:  { id: 'heavy',  name: 'Heavy Armour', absorb: 0.60, points: 100, speed: 0.84, aim: 0.75 },
};

/* Preset loadouts. The player can also edit a CUSTOM loadout. */
export const LOADOUTS = {
  ASSAULT: {
    id: 'ASSAULT', name: 'Assault', desc: 'Balanced weapons and equipment.',
    primary: 'ar_vanguard', secondary: 'pistol_sparrow', tactical: 'frag', armor: 'medium', heal: 1,
  },
  SCOUT: {
    id: 'SCOUT', name: 'Scout', desc: 'Mobility, reconnaissance and precision.',
    primary: 'smg_hornet', secondary: 'pistol_sparrow', tactical: 'recon', armor: 'light', heal: 1,
  },
  SUPPORT: {
    id: 'SUPPORT', name: 'Support', desc: 'Heavy protection, cover and healing.',
    primary: 'cb_kestrel', secondary: 'pistol_sparrow', tactical: 'cover', armor: 'heavy', heal: 3,
  },
  CUSTOM: {
    id: 'CUSTOM', name: 'Custom', desc: 'Your own build from unlocked gear.',
    primary: 'ar_vanguard', secondary: 'pistol_sparrow', tactical: 'smoke', armor: 'medium', heal: 2,
  },
};

/* Make sure a loadout is legal for a given level. Used on client AND server. */
export function sanitizeLoadout(lo, level = 1) {
  const src = lo && typeof lo === 'object' ? lo : LOADOUTS.ASSAULT;
  const ok = (id, slot) => WEAPONS[id] && WEAPONS[id].slot === slot && WEAPONS[id].unlock <= level;
  const out = {
    id: LOADOUTS[src.id] ? src.id : 'CUSTOM',
    primary: ok(src.primary, 'primary') ? src.primary : 'ar_vanguard',
    secondary: ok(src.secondary, 'secondary') ? src.secondary : 'pistol_sparrow',
    tactical: EQUIPMENT[src.tactical] && src.tactical !== 'medkit' ? src.tactical : 'smoke',
    armor: ARMOR[src.armor] ? src.armor : 'medium',
    heal: Math.max(0, Math.min(3, src.heal | 0)),
  };
  return out;
}

export function fireIntervalMs(w) { return 60000 / w.rpm; }
