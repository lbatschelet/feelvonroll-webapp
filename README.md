# feelvonroll-webapp

## Installieren & Starten

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## API

- Standard: erwartet API unter `/api`
- Custom: setze `VITE_API_BASE` beim Build, z. B.:
  - `VITE_API_BASE=https://your-domain.tld/api npm run build`

## Floors-Implementierung

- Jede Etage ist ein eigener `THREE.Group` in `floorGroups`.
- Die Gruppen enthalten eine Bodenplatte und Wände.

## Nächste Schritte (glTF)

- Ersetze die Box-Geometrien in `createFloor()` durch ein geladenes glTF.
- Verwende `GLTFLoader` aus `three/examples/jsm/loaders/GLTFLoader.js`.
- Lege die geladenen Meshes in die jeweiligen `THREE.Group`-Einträge.
- Optional: pro Etage eine separate glTF oder eine glTF mit benannten Nodes.
