# VECTOR: BLACKLINE

A standalone third-person action game that lives in its own folder. It does not touch the Vertex educational games or anything in `js/`.

Open it at `/vector/index.html`. It reuses the Vertex Firebase sign-in because it loads `../js/config.js` on the same site.

## Folder map

| Path | What it is |
|---|---|
| `vector/index.html` | The page. Loads Firebase (same project as Vertex) and starts the game |
| `vector/index.js` | Starts, opens and closes the game. Exposes `window.VectorBlackline = { init, open, close, destroy }` |
| `vector/sim.js` and friends | The game rules: `player.js`, `weapons.js`, `combat.js`, `enemies.js`, `missions.js`, `world.js`. No browser code, so the same files run in the browser and on the server |
| `vector/engine.js`, `renderer.js`, `characters.js`, `ui.js`, `input.js`, `audio.js`, `storage.js` | Browser only: loop, 3D, models, menus and HUD, controls, sound, saves |
| `vector/platform.js` | What device this is and how it is being used: input mode (touch / keyboard+mouse / controller, switches live), visible viewport size, fullscreen and landscape lock |
| `vector/prompts.js` | The one table that says how each action is shown per device (`E` / `A` / `USE`), plus key bindings |
| `vector/assetstore.js` | Downloads models on demand, validates them, caches them in the browser |
| `vector/icons.js` | The single icon set used by HUD and touch controls |
| `vector/entry.js` | Entry point the bundle is built from |
| `vector/game.bundle.js` | **Built file. This is what the page actually loads.** Rebuild it after any change (see Build) |
| `vector/multiplayer.js` | Browser side of online play |
| `vector/server/` | The multiplayer service (its own Cloudflare Worker) |
| `vector/lib/` | Three.js r160, copied in so nothing loads from a CDN |
| `vector/tests/` | Node tests |
| `css/vector-blackline.css` | All styling, scoped under `.vector-blackline` |

## Build (required after editing any file in `vector/`)

`index.html` loads `vector/game.bundle.js`, not the individual files. Editing `ui.js`, `input.js` and so on changes nothing on the site until you rebuild:

```
npm i -D esbuild
npx esbuild vector/entry.js --bundle --minify --format=esm --outfile=vector/game.bundle.js
```

Then change the `?v=` on the stylesheet and script tags in `vector/index.html` so browsers fetch the new files.

## Devices and input

`platform.js` decides what the player is using **right now** and writes it on the game root as `data-input="touch|kbm|pad"`. It follows the player: touch the screen and touch controls appear, move the mouse or press a key and they are removed, press a controller button and prompts become controller prompts. The touch layer only exists in the DOM while touch is active.

The stylesheet sizes everything from `--vw` / `--vh` (1% of the **visible** area, written by `platform.js`, because `100vh` is wrong on iOS Safari) and one touch-button unit `--tb`. Layers use one z-index scale (`--z-*` at the top of `css/vector-blackline.css`). Touch button positions are a table in `input.js` (`TOUCH_BUTTONS`).

Fullscreen and landscape lock are requested from a tap (Deploy, Join, Resume) and are allowed to fail. iPhone Safari has no fullscreen API; the game says so once and suggests Add to Home Screen.



Serve the repo root with any static server and open `/vector/index.html`.

Testing without Vertex sign-in: add `?guest=1&name=Alex` to the address. This works for single player only and is meant for testing.

## Deploy the multiplayer server

Campaign works without this. Online play needs it.

1. `cd vector/server`
2. `npx wrangler login`, then `npx wrangler deploy`
3. Copy the address Wrangler prints (like `https://vector-blackline.YOURNAME.workers.dev`).
4. Paste it into `API_BASE` in `vector/config.js`.
5. Optional: in `wrangler.jsonc`, set `ALLOWED_ORIGINS` to your Vertex domain.

The server checks every player's Firebase sign-in token. It never trusts the browser for hits, damage, ammo or score. Clients only send inputs.

To try it locally: `npx wrangler dev --var VECTOR_DEV_GUEST:true`, then open the game with `?guest=1&api=http://localhost:8787&name=Alex`.

## Your 3D models

Models load from `vector-3dassets/`. Missing or broken ones fall back to simple stand-ins, so the game never stops.

**How they are downloaded.** One at a time, only when the game needs them (the menu needs your operator and rifle; a mission needs its own enemies and props). Nothing is bulk-downloaded. Each file is then kept in the browser's Cache Storage under its fingerprint from `vector-3dassets/manifest.json`, so the next visit makes **no** model requests. Replace a model, run the manifest tool (below), and players automatically get the new file; the old copy is deleted. Phones on Data Saver / 2G skip background pre-downloading, and low-memory phones use a `name.lo.glb` copy if you made one. Code: `vector/assetstore.js`.

**Three kinds of character are understood** (worked out automatically):

| Kind | What it is | Animation |
|---|---|---|
| legacy | Your original part-built characters (parts named `legL`, `legR`, `armL`, `armR`, `head` ...) | Parts pivot: walk, aim, fall. Colour customisation works |
| rigged | Any model with a skeleton | Real clips: idle, walk, run, sprint, crouch, crouch_walk, death |
| static | A detailed single mesh with no skeleton | Whole-body only: bob, sway, lean, crouch, fall. **No arm/leg movement** |

A detailed model keeps its own textures; cosmetic recolouring (outfit, hair, face) only exists for legacy characters. Y-up files (what Blender, Mixamo and most generators export) and your Z-up originals both work.

**Adding a high-fidelity character**

1. Rig it (Mixamo is free: upload the mesh, pick Idle / Walking / Running / Crouch Idle / Crouched Walking / Dying, download as glTF Binary `.glb`). Keep clip names like those words. Either leave the clips inside the character file, or put them once in `vector-3dassets/animations/humanoid.glb` and every rigged character shares them.
2. Shrink it: `node tools/optimize-model.mjs my-model.glb characters/enemy_rifleman.glb --lo` (needs a one-time `npm install --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp`).
3. Register it: `node tools/build-manifest.mjs` (prints a report with warnings, rewrites `manifest.json`).
4. If it faces the wrong way, add `"override": { "up": "Y", "front": "-Z" }` to its entry in `manifest.json` (the override survives re-running the tool).
5. Deploy. Targets: characters under about 40,000 triangles and 6 MB, weapons/props under 15,000.

The game refuses files that need Draco or KTX2 compression (it cannot decode them) and uses the stand-in instead; export with Meshopt or no compression.

## Tests

`node vector/tests/server.test.mjs`, `node vector/tests/assets.test.mjs`, `node vector/tests/characters.test.mjs`

## Known limitations

- Player level and unlocks are claimed by the client. There is no server-side profile store yet.
- Server anti-cheat limits how fast a client's clock can run. It does not check positions against walls.
- Not tested on real phones, real GPUs, or iOS Safari orientation behaviour.
