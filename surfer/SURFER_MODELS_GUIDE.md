# Knowledge Surfer 3D — Model Building Guide

You build **19 models**. The game already works without them (it draws simple stand-ins), so you can add them **one at a time** and refresh to see each one appear.

---

## 1. How it all fits together

**Where files go in your repo**

```
vertex/
├─ js/game.js                      ← replace (2 small edits, already done)
├─ sw.js                           ← replace (1 line version bump + 1 rule)
└─ surfer/                         ← NEW folder (copy all 4 files in)
   ├─ surfer-config.js             ← the only file you'll ever edit
   ├─ surfer-sim.js
   ├─ surfer-assets.js
   ├─ surfer-engine.js
   └─ assets/                      ← put your .glb files here
      ├─ characters/   (9 files)
      ├─ obstacles/    (4 files)
      ├─ props/        (1 file)
      └─ environment/  (5 files)
```

**You do not need to match any scale.** The game measures every model and resizes it. The only thing that matters is that it **looks right and is the right proportions** (the "game size" column below is what it will be stretched to).

**The camera sees everything from BEHIND the runner.** So characters and obstacles are shown from behind / the front of the obstacle (the side the player approaches).

**If a model is missing**, you'll see a plain stand-in. Add `?surferdebug=1` to your site's URL (e.g. `https://yoursite.com/?surferdebug=1`) and a green text overlay in the game lists exactly which models are still stand-ins, plus FPS and draw calls.

---

## 2. Universal rules for ALL images (so Trellis succeeds)

Trellis turns **one image of one object** into a 3D model. It fails or gives messy results when the image has multiple objects, a busy background, hard shadows, or a cropped object.

Put this at the **end of every prompt** below (the "TRELLIS SUFFIX"):

> **TRELLIS SUFFIX:** *Single isolated subject, perfectly centered, entire object fully visible with margin around it, nothing cropped. Pure plain white seamless background. Soft even studio lighting, no cast shadows, no ground shadow, no reflections on the floor. Sharp focus, photorealistic, physically-based materials, ultra detailed textures, 1:1 square image, 2K.*

**Tips**
- Use Nano Banana at 1:1 square, highest resolution.
- **Same character in several poses:** generate the first pose (`player_run_a`), then for every other pose upload that image to Nano Banana and say *"Same character, same outfit, same colours, same camera angle and framing. Change only the pose to: …"* followed by the TRELLIS SUFFIX. This keeps the look consistent.
- Don't ask for motion blur, speed lines, dust or effects. The game adds those.

---

## 3. THE CHARACTERS  (folder: `surfer/assets/characters/`)

### Player — 5 poses of the SAME student

Look (matches the original game's colours): teenage Nigerian secondary-school student, indigo-blue zip jacket, navy trousers, violet backpack, white sneakers with red stripe, indigo baseball cap. Realistic proportions, not cartoon.

**Camera for all 5:** *seen from behind at a three-quarter rear angle (about 25° off straight-behind), camera at chest height.*

| # | File | Game size | Prompt (add the TRELLIS SUFFIX) |
|---|------|-----------|-----|
| 1 | `player_run_a.glb` | 1.75 m tall | *Photorealistic full-body teenage Nigerian secondary-school student running away from the camera, seen from behind at a three-quarter rear angle. Indigo-blue zip-up jacket, navy trousers, large violet backpack with a visible pocket, white sneakers with red stripes, indigo baseball cap. Mid-stride: **right leg stretched forward, left leg back, left arm forward, right arm back**, slight forward lean, athletic running form.* |
| 2 | `player_run_b.glb` | 1.75 m | *(Reference: player_run_a image.) Same character, outfit, colours, camera angle and framing. Change only the pose: mid-stride with **left leg stretched forward, right leg back, right arm forward, left arm back** (the exact mirror of the reference stride).* |
| 3 | `player_jump.glb` | 1.60 m | *(Reference: player_run_a.) Same character… Change only the pose: **jumping in the air, both knees pulled up toward the chest, both arms raised and slightly out for balance**, body upright, feet off the ground.* |
| 4 | `player_slide.glb` | 0.70 m | *(Reference: player_run_a.) Same character… Change only the pose: **sliding feet-first low along the ground**, body leaning far back almost lying down, one arm trailing behind, legs extended forward, seen from behind and slightly above.* |
| 5 | `player_stumble.glb` | 1.70 m | *(Reference: player_run_a.) Same character… Change only the pose: **stumbling off-balance after tripping**, torso pitched forward, arms flung out wide, one foot dragging, mid-fall but still upright.* |

### Inspector and dog (they chase you from behind)

| # | File | Game size | Prompt |
|---|------|-----------|-----|
| 6 | `inspector_run_a.glb` | 1.85 m | *Photorealistic full-body adult male transport ticket inspector running away from the camera, seen from behind at a three-quarter rear angle. Navy-blue uniform jacket and trousers, navy peaked cap with a gold badge, reflective yellow collar patch, gold shoulder badge, black shoes, holding a short wooden baton in his right hand. Mid-stride: **right leg forward, left leg back, left arm forward, right arm back**, determined angry posture.* |
| 7 | `inspector_run_b.glb` | 1.85 m | *(Reference: inspector_run_a.) Same character… Change only the pose: **left leg forward, right leg back, right arm forward (baton hand), left arm back** — the exact mirror stride.* |
| 8 | `dog_run_a.glb` | 0.70 m | *Photorealistic tan-and-amber Labrador-type dog running away from the camera, seen from behind at a three-quarter rear angle, wearing a plain brown leather collar. Mid-gallop: **front legs reaching forward, back legs pushed back**, tail raised, ears flapping up.* |
| 9 | `dog_run_b.glb` | 0.70 m | *(Reference: dog_run_a.) Same dog… Change only the pose: **gallop phase with all four paws tucked under the body**, tail raised.* |

> The game alternates `_a` and `_b` very fast to animate the run. They only need to be the **same character** in **different leg positions**.

---

## 4. THE OBSTACLES  (folder: `surfer/assets/obstacles/`)

Each obstacle has **two different looks** (`_a`, `_b`), and the game picks randomly. You can add `_c`, `_d`… later by adding a line in `surfer-config.js`.

**Camera for obstacles:** *straight-on front view, camera slightly above, so the whole front face is visible.*

### Low obstacle → the player must JUMP over it

| # | File | Game size (W × H × D) | Prompt |
|---|------|------|-----|
| 10 | `obstacle_trolley_a.glb` | 1.7 × 0.8 × 1.5 m | *Photorealistic low rusty red metal luggage cart / mine trolley, flat-topped, about knee-to-hip height, wide, dented panels, chipped red paint, four small black wheels, a bold white hand-painted "✗" mark on the front face. Straight-on front view from slightly above.* |
| 11 | `obstacle_trolley_b.glb` | 1.7 × 0.8 × 1.5 m | *Photorealistic low concrete-and-steel subway track barrier block, flat-topped, wide, hip height, worn grey concrete with orange-and-white diagonal hazard stripes on the front face and a small red warning lamp on top. Straight-on front view from slightly above.* |

### High obstacle → the player must SLIDE under it

**Important:** there must be a **clear open gap underneath** for the runner (about half the height).

| # | File | Game size (W × H × D) | Prompt |
|---|------|------|-----|
| 12 | `obstacle_beam_a.glb` | 2.1 × 1.3 × 0.7 m | *Photorealistic overhead hazard gantry: two short thick steel posts supporting a heavy horizontal crossbar painted with yellow-and-black diagonal warning stripes, **open empty space between the posts under the bar**, bolted base plates. Straight-on front view.* |
| 13 | `obstacle_beam_b.glb` | 2.1 × 1.3 × 0.7 m | *Photorealistic low-hanging pipe-and-cable barrier: two steel brackets holding a thick horizontal industrial pipe wrapped with red-and-white striped tape and a dangling chain, **open empty space under the pipe**. Straight-on front view.* |

> The red **JUMP** / yellow **SLIDE** labels floating above obstacles are added by the game. Don't paint text on the models other than the "✗" suggestion.

---

## 5. THE COIN  (folder: `surfer/assets/props/`)

| # | File | Game size | Prompt |
|---|------|------|-----|
| 14 | `coin.glb` | 0.62 m wide | *Photorealistic shiny polished gold coin, **standing upright facing the camera**, thick rounded rim, a bold embossed check-mark "✓" in the centre, subtle engraved laurel ring, warm metallic gold with soft reflections. Straight-on front view.* |

The game spins it. **If it appears lying flat or edge-on**, open `surfer-config.js` and set `pitch: 90` (or `-90`) on the `coin` line.

---

## 6. THE ENVIRONMENT  (folder: `surfer/assets/environment/`)

These are **tiles joined end to end** (each 12 m long) and **recycled forever**. Rules:
- Keep them **plain and repeatable**: the same cross-section along the whole length, **no one-off details in the middle** (no unique posters, signs or damage), otherwise you'll see the pattern repeat.
- The game places a **tunnel arch at every joint**, which hides the seam. That is why the arch matters.
- Long pieces: generate the image so the **long side runs left-to-right** (the config already turns them 90°).

| # | File | Game size (W × H × D) | Prompt |
|---|------|------|-----|
| 15 | `track_segment.glb` | 7.8 × 0.35 × 12 m | *Photorealistic straight section of subway railway floor, **long and flat**, lying horizontally across the image, three parallel pairs of steel rails evenly spaced on dark gravel ballast with wooden sleepers, flat concrete edge strips on both sides, identical repeating pattern end to end, no objects, no signs. Three-quarter view from above, long side left-to-right.* |
| 16 | `tunnel_wall.glb` | 2.2 × 7 × 12 m | *Photorealistic long straight subway-tunnel wall slab, **very long and tall, thin**, long side left-to-right. Dark glazed ceramic tiles with a yellow safety stripe along the bottom, two horizontal cable trays with black cables and a row of evenly spaced rusty pipe brackets, **identical repeating pattern along the whole length**, detailed face toward the camera, plain rough concrete on the back. Three-quarter front view.* |
| 17 | `tunnel_arch.glb` | 9.6 × 7.2 × 1.2 m | *Photorealistic subway-tunnel portal frame: a thick reinforced concrete and steel archway, flat top beam and two vertical side columns, **large empty opening in the middle (see-through)**, riveted steel plates, subtle yellow safety markings, sturdy and symmetrical. Straight-on front view.* |
| 18 | `ceiling_lamp.glb` | 0.7 × 0.5 × 2.2 m | *Photorealistic long industrial subway ceiling light fixture, **long thin rectangle lying left-to-right**, rugged steel housing with a glowing warm-white diffuser strip, mounting brackets on top. Three-quarter view from below.* |
| 19 | `signal_light.glb` | 2.8 m tall | *Photorealistic tall slim subway trackside signal post, dark steel pole on a small concrete base, a round signal head at the top with one glowing red lamp and a sun-hood, a thin cable running down the pole. Straight-on front view, full pole visible.* |

---

## 7. Optimise every model before uploading  (important for phones)

Trellis models are big. Run each file through this one command (needs Node installed; nothing else to install):

```
npx @gltf-transform/cli optimize INPUT.glb OUTPUT.glb --compress quantize --texture-compress webp --texture-size 1024
```

- Use `--texture-size 2048` only for `player_*` and `inspector_*` if you want extra-sharp characters.
- **Do NOT use `--compress draco` or `--compress meshopt`.** The game's loader in your repo doesn't include those decoders, and the model would fail to load. `quantize` is safe.
- Targets per file: characters **≤ 25k triangles, ≤ 2 MB**; obstacles **≤ 12k, ≤ 1.2 MB**; coin **≤ 3k**; tiles **≤ 20k, ≤ 2 MB**. Check with `npx @gltf-transform/cli inspect FILE.glb`. If a Trellis export is too heavy, run `npx @gltf-transform/cli simplify IN.glb OUT.glb --ratio 0.4` first.
- Total download for all 19 should stay **under about 25 MB**.

---

## 8. Test checklist (3 minutes per batch)

1. Copy your `.glb` files into the matching `surfer/assets/...` folder with the **exact names** above and push.
2. Open the game with `?surferdebug=1` on the end of the URL. Hard-refresh (Ctrl+Shift+R, or clear site data on phone).
3. The green text lists remaining stand-ins. Your new file should vanish from the list.
4. Check, in this order:
   - **Runner faces away from camera** (you see his back). If you see the face → open `surfer-config.js`, set `yaw: 180` on that model.
   - **Left wall detailed side faces the track.** If it faces away, try `yaw: -90` on `tunnel_wall`.
   - **Tracks run straight into the distance.** If the track runs sideways, try `yaw: 0` or `yaw: -90` on `track_segment`.
   - **Feet touch the ground** (nothing floating). If the whole model floats a bit, use `yOffset: -0.05`.
   - **Model too big or small by feel?** Use `scaleMul: 1.1` (10 % bigger) or `0.9`.
   - **Obstacles match the hit-box:** you must really hit it when you don't jump or slide. If the visible model is much wider or shorter than the invisible hit-box, change the size in `surfer-config.js` (the `width / height / depth` line for that model).
5. Play one full run. The fps/draw-call overlay (`?surferdebug=1`) should show **≥ 30 fps** on a mid-range phone. If lower, reduce texture size to 512 for environment pieces first.

---

## 9. Quick fixes table

| Problem | Fix (in `surfer-config.js`) |
|---------|------|
| Character shows its face | `yaw: 180` on that model |
| Model lies on its back | `zUp: true` |
| Coin flat / edge-on | `pitch: 90` (or `-90`) |
| Wall faces wrong way | `yaw: -90` on `tunnel_wall` |
| Pose flicker looks jumpy | Make `_a` / `_b` legs differ **less**, and keep identical size and position |
| Character feels too slow / fast | `speedScale` in `GAME` |
| Camera too close/far | `CAMERA.position` |

Nothing else needs to change. The 2D version is kept inside `game.js` as an **automatic fallback** for phones that can't run 3D.
