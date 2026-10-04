/* ============================================================
   vector/icons.js  |  One icon language for the whole interface.
   24x24 grid, 2px round strokes, currentColor. Nothing here loads
   from the network, so icons work offline and never flash in.
   ============================================================ */
const P = {
  fire: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>',
  aim: '<circle cx="12" cy="12" r="7"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/>',
  reload: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
  jump: '<path d="M6 11l6-6 6 6"/><path d="M6 18l6-6 6 6"/>',
  crouch: '<path d="M6 6l6 6 6-6"/><path d="M6 13l6 6 6-6"/>',
  interact: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10V8.5a1.5 1.5 0 0 1 3 0V11"/><path d="M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.9-2.5L4.5 15a1.5 1.5 0 0 1 2.4-1.8L9 15"/>',
  grenade: '<circle cx="12" cy="14.5" r="6"/><path d="M10 4.5h4M12 4.5v4M15 8l2.5-2.5"/>',
  medical: '<path d="M9 3.5h6v5.5h5.5v6H15v5.5H9V15H3.5V9H9z"/>',
  swap: '<path d="M4 8h14l-3.5-3.5"/><path d="M20 16H6l3.5 3.5"/>',
  pause: '<path d="M8.5 5v14M15.5 5v14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  map: '<path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>',
  target: '<path d="M12 3l9 9-9 9-9-9z"/>',
  fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  windowed: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
};
export const icon = (name, cls = '') => `<svg class="vb-ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
