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

Models load from `vector-3dassets/`. Missing ones fall back to simple stand-ins. Add a file at the path below and it is used automatically:

`characters/enemy_scout`, `characters/enemy_commander`, `characters/ally_civilian`, `environment/tree`, `environment/server_rack`, `environment/door`, `environment/fence_section`, `environment/wall_module`, `environment/stairs_module`, `environment/intel_case`, `environment/terminal_console`, `props/ammo_box`, `props/armor_vest` (all `.glb`).

Your current models are authored Z-up and face -Y. The loader handles that. Part names (`legL`, `armR`, `head`, `vest` and so on) are used for walking, aiming and colour customisation, so keep them if you edit the characters.

## Tests

`node vector/tests/server.test.mjs`

## Known limitations

- Player level and unlocks are claimed by the client. There is no server-side profile store yet.
- Server anti-cheat limits how fast a client's clock can run. It does not check positions against walls.
- Not tested on real phones, real GPUs, or iOS Safari orientation behaviour.
