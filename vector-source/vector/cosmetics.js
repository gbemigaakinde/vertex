/* vector/cosmetics.js | Cosmetic-only options. None of these change gameplay stats. */
export const COSMETICS = {
  face:   [{ id: 'f1', name: 'Face A' }, { id: 'f2', name: 'Face B' }, { id: 'f3', name: 'Face C' }, { id: 'f4', name: 'Face D' }],
  skin:   [
    { id: 's1', name: 'Tone 1', color: '#f1c9a5' }, { id: 's2', name: 'Tone 2', color: '#d9a273' },
    { id: 's3', name: 'Tone 3', color: '#b57a4a' }, { id: 's4', name: 'Tone 4', color: '#80472e' },
    { id: 's5', name: 'Tone 5', color: '#5a3221' }, { id: 's6', name: 'Tone 6', color: '#3b2118' },
  ],
  hair:   [{ id: 'none', name: 'Shaved' }, { id: 'crop', name: 'Short crop' }, { id: 'afro', name: 'Natural' }, { id: 'braids', name: 'Braids' }, { id: 'wrap', name: 'Head wrap' }],
  outfit: [
    { id: 'o_black', name: 'Blackline Standard', color: '#2a2b2a', unlock: 1 },
    { id: 'o_olive', name: 'Field Olive', color: '#3f4a2c', unlock: 2 },
    { id: 'o_sand', name: 'Desert Sand', color: '#8a7650', unlock: 4 },
    { id: 'o_slate', name: 'Slate Grey', color: '#4a525a', unlock: 6 },
    { id: 'o_ember', name: 'Ember Trim', color: '#5a2a1e', unlock: 9 },
  ],
  vest:   [
    { id: 'v_charcoal', name: 'Charcoal', color: '#1a1f24', unlock: 1 },
    { id: 'v_navy', name: 'Navy', color: '#1c2a44', unlock: 2 },
    { id: 'v_coyote', name: 'Coyote', color: '#6d5a3a', unlock: 5 },
  ],
  helmet: [
    { id: 'h_black', name: 'Matte Black', color: '#0b0e11', unlock: 1 },
    { id: 'h_grey', name: 'Ash Grey', color: '#565c62', unlock: 3 },
    { id: 'h_none', name: 'No Helmet', color: null, unlock: 1 },
    { id: 'h_sand', name: 'Sand', color: '#8a7650', unlock: 7 },
  ],
  gloves: [
    { id: 'g_black', name: 'Black', color: '#111', unlock: 1 },
    { id: 'g_tan', name: 'Tan', color: '#8a6d46', unlock: 3 },
  ],
  backpack: [{ id: 'b_on', name: 'Backpack', unlock: 1 }, { id: 'b_off', name: 'No backpack', unlock: 1 }],
  weaponSkin: [
    { id: 'w_default', name: 'Standard Issue', tint: null, unlock: 1 },
    { id: 'w_sand', name: 'Dune', tint: '#9b8455', unlock: 3 },
    { id: 'w_ember', name: 'Ember', tint: '#a4482c', unlock: 8 },
    { id: 'w_frost', name: 'Frost', tint: '#8fa4b5', unlock: 10 },
  ],
  emblem: [
    { id: 'e_bl', name: 'Blackline', glyph: 'BL', unlock: 1 }, { id: 'e_vec', name: 'Vector', glyph: 'V', unlock: 2 },
    { id: 'e_star', name: 'Northstar', glyph: '*', unlock: 5 }, { id: 'e_hex', name: 'Hex', glyph: 'HX', unlock: 8 },
  ],
  banner: [
    { id: 'n_steel', name: 'Steel', color: '#3c4650', unlock: 1 }, { id: 'n_rust', name: 'Rust', color: '#7a3a25', unlock: 4 },
    { id: 'n_pine', name: 'Pine', color: '#2d4a37', unlock: 7 },
  ],
};

export const DEFAULT_LOOK = {
  face: 'f1', skin: 's3', hair: 'crop', outfit: 'o_black', vest: 'v_charcoal',
  helmet: 'h_black', gloves: 'g_black', backpack: 'b_on', weaponSkin: 'w_default', emblem: 'e_bl', banner: 'n_steel',
};

export function sanitizeLook(look, level = 99) {
  const out = { ...DEFAULT_LOOK };
  if (!look || typeof look !== 'object') return out;
  for (const key of Object.keys(DEFAULT_LOOK)) {
    const list = COSMETICS[key === 'weaponSkin' ? 'weaponSkin' : key];
    const hit = list && list.find((o) => o.id === look[key]);
    if (hit && (hit.unlock || 1) <= level) out[key] = hit.id;
  }
  return out;
}
