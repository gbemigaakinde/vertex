/* vector/entry.js | Starts the game. Bundled with everything else into game.bundle.js.
   The multiplayer server address is NOT in here. It is set in vector/index.html
   (window.VECTOR_API_BASE) so it can be changed without rebuilding anything. */
import VectorBlackline from './index.js';

VectorBlackline.init({ vertexUrl: '../index.html', keepRoot: true, apiBase: window.VECTOR_API_BASE || '' });
VectorBlackline.open();
