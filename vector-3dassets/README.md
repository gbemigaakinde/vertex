# VECTOR: BLACKLINE — 3D Asset Pack

GLB models used by the game in `vector/`.

- `manifest.json` is generated: **run `node tools/build-manifest.mjs` after adding, replacing or removing any model.** It gives every file a fingerprint; players' browsers use it to keep or refresh their saved copy.
- Folders: `characters/ weapons/ props/ vehicles/ environment/ animations/`. A file directly in this folder is ignored.
- `animations/humanoid.glb` (optional): shared idle/walk/run/sprint/crouch/death clips for rigged characters.
- `name.lo.glb` (optional): lighter copy used on low-memory or Data Saver devices.
- The original procedural characters are part-built (no skeleton). High-fidelity rigged characters are supported; see "Your 3D models" in `vector/README.md`.
