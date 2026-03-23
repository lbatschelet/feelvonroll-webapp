Model pipeline (SweetHome/SketchUp -> Three.js)

This folder is served directly by Vite. Files are available at `/models/<file>`.

Recommended naming for multi-floor exports:
- `floor_-2.glb`, `floor_-1.glb`, `floor_0.glb`, `floor_1.glb`, ... (optional for future)
- OR a single combined model where floor groups are named `floor_<index>` (e.g. `floor_0`).

For the current prototype, the webapp tries to load:
- `/models/floor_0.glb`

Each floor group should be aligned so the slab top plane sits at Y=0 (first iteration).
If you want accurate pin placement later, include a marker node named `slabTop` inside the floor group.
