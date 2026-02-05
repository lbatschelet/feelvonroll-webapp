# feelvonroll-webapp

## Install & Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Tests

```bash
npm test
```

## API

- Default expects the API at `/api`
- Custom: set `VITE_API_BASE` at build time, e.g.
  - `VITE_API_BASE=https://your-domain.tld/api npm run build`

## Floors Implementation

- Each floor is a dedicated `THREE.Group` in `floorGroups`.
- The groups contain a slab and walls.

## Next Steps (glTF)

- Replace the box geometries in `createFloor()` with loaded glTF.
- Use `GLTFLoader` from `three/examples/jsm/loaders/GLTFLoader.js`.
- Attach loaded meshes to the respective `THREE.Group` entries.
- Optional: one glTF per floor, or a single glTF with named nodes.
