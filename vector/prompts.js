/* ============================================================
   vector/prompts.js  |  The one place that knows how an action is
   shown on each kind of device. Everything that prints a key, a
   button or a hint (interaction prompt, equipment chips, controls
   screen) goes through here. To rebind a hint, change this table.
   Modes: 'kbm' keyboard + mouse, 'pad' controller, 'touch'.
   ============================================================ */
export const ACTIONS = {
  MOVE:     { label: 'Move',               kbm: 'W A S D',  pad: 'Left stick',  touch: 'Left stick' },
  LOOK:     { label: 'Look',               kbm: 'Mouse',    pad: 'Right stick', touch: 'Drag right side' },
  FIRE:     { label: 'Fire',               kbm: 'LMB',      pad: 'RT',          touch: 'FIRE' },
  AIM:      { label: 'Aim',                kbm: 'RMB',      pad: 'LT',          touch: 'AIM' },
  SPRINT:   { label: 'Sprint',             kbm: 'Shift',    pad: 'L3',          touch: 'Push stick fully' },
  JUMP:     { label: 'Jump',               kbm: 'Space',    pad: 'A',           touch: 'JUMP' },
  CROUCH:   { label: 'Crouch',             kbm: 'C',        pad: 'B',           touch: 'CROUCH' },
  RELOAD:   { label: 'Reload',             kbm: 'R',        pad: 'X',           touch: 'RELOAD' },
  INTERACT: { label: 'Interact / Revive',  kbm: 'E',        pad: 'A',           touch: 'USE' },
  EQUIP:    { label: 'Equipment',          kbm: 'G',        pad: 'RB',          touch: 'Equip chip' },
  HEAL:     { label: 'Medkit',             kbm: 'H',        pad: 'LB',          touch: 'Medkit chip' },
  SWAP:     { label: 'Switch weapon',      kbm: 'Q',        pad: 'Y',           touch: 'Swap chip' },
  SLOTS:    { label: 'Weapon slot',        kbm: '1 / 2',    pad: 'D-pad ← →',   touch: 'Swap chip' },
  SHOULDER: { label: 'Swap shoulder',      kbm: 'V',        pad: 'D-pad ↑',     touch: null },
  SCORES:   { label: 'Scoreboard',         kbm: 'Tab',      pad: 'Back',        touch: null },
  PAUSE:    { label: 'Pause',              kbm: 'Esc',      pad: 'Start',       touch: 'Pause button' },
};

/* Plain text for a key or button, e.g. 'E', 'A', 'USE'. */
export const glyph = (action, mode) => { const a = ACTIONS[action]; return a ? (a[mode] || '') : ''; };

/* Small HTML chip. Touch shows the on-screen button's name, not a keyboard key. */
export const promptHtml = (action, mode) => {
  const g = glyph(action, mode); if (!g) return '';
  return `<kbd class="vb-key vb-key-${mode}">${g}</kbd>`;
};

/* Rows for the Controls screen. Only actions that exist on that device appear. */
const ORDER = {
  kbm: ['MOVE', 'LOOK', 'FIRE', 'AIM', 'SPRINT', 'CROUCH', 'JUMP', 'RELOAD', 'INTERACT', 'SLOTS', 'SWAP', 'EQUIP', 'HEAL', 'SHOULDER', 'SCORES', 'PAUSE'],
  pad: ['MOVE', 'LOOK', 'FIRE', 'AIM', 'SPRINT', 'JUMP', 'CROUCH', 'RELOAD', 'INTERACT', 'SWAP', 'SLOTS', 'EQUIP', 'HEAL', 'SHOULDER', 'SCORES', 'PAUSE'],
  touch: ['MOVE', 'LOOK', 'FIRE', 'AIM', 'SPRINT', 'JUMP', 'CROUCH', 'RELOAD', 'INTERACT', 'SWAP', 'EQUIP', 'HEAL', 'PAUSE'],
};
export const controlsTable = (mode) => (ORDER[mode] || ORDER.kbm).map((k) => [ACTIONS[k].label, glyph(k, mode)]).filter((r) => r[1]);
export const MODE_TITLE = { kbm: 'Keyboard and mouse', pad: 'Controller', touch: 'Touch (landscape)' };

/* ---------------- keyboard bindings ---------------- */
/* Movement (W A S D / arrows) is fixed. These are the actions a player can rebind. */
export const DEFAULT_KEYS = { interact: 'KeyE', reload: 'KeyR', jump: 'Space', crouch: 'KeyC', equip: 'KeyG', heal: 'KeyH', swap: 'KeyQ', shoulder: 'KeyV', sprint: 'ShiftLeft', slot1: 'Digit1', slot2: 'Digit2', scoreboard: 'Tab' };
export const REBINDABLE = [['interact', 'Interact / Revive'], ['reload', 'Reload'], ['jump', 'Jump'], ['crouch', 'Crouch (toggle)'], ['sprint', 'Sprint'], ['swap', 'Switch weapon'], ['slot1', 'Weapon slot 1'], ['slot2', 'Weapon slot 2'], ['equip', 'Equipment'], ['heal', 'Medkit'], ['shoulder', 'Swap shoulder'], ['scoreboard', 'Scoreboard']];
export const keyName = (code) => {
  if (!code) return '—';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  const m = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', AltLeft: 'Alt', Tab: 'Tab', Backquote: '`', Enter: 'Enter', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  return m[code] || code.replace(/^Numpad/, 'Num ');
};
/* Keeps every on-screen hint in step with the player's own bindings. */
export function applyKeyLabels(overrides) {
  const K = { ...DEFAULT_KEYS, ...(overrides || {}) };
  const map = { INTERACT: 'interact', RELOAD: 'reload', JUMP: 'jump', CROUCH: 'crouch', EQUIP: 'equip', HEAL: 'heal', SWAP: 'swap', SHOULDER: 'shoulder', SPRINT: 'sprint', SCORES: 'scoreboard' };
  for (const a in map) ACTIONS[a].kbm = keyName(K[map[a]]);
  ACTIONS.SLOTS.kbm = keyName(K.slot1) + ' / ' + keyName(K.slot2);
}
