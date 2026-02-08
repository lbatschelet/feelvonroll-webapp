# feelvonroll-webapp

Public-facing 3D web application for the [feelvonRoll](https://github.com/lbatschelet/feelvonroll) project. Users navigate a Three.js model of the Von Roll building and place pins to share how they feel in different spaces.

> [!NOTE]
> Part of the feelvonRoll project. See the [main repository](https://github.com/lbatschelet/feelvonroll) for full documentation.

## Features

- **3D building model** rendered with Three.js, with multiple navigable floors
- **Interactive pin placement**: click a location on any floor to start the questionnaire
- **Dynamic questionnaire**: fetched from the API, supports sliders, multi-choice, and free text
- **Multi-language support**: language switcher with translations loaded from the API

## Install & Run

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

## Configuration

The webapp connects to the [feelvonroll-api](../feelvonroll-api/). By default it expects the API at `/api`.

To point to a different API during development, create a `.env.local` file:

```
VITE_API_BASE=http://localhost:8080
```

## Build

```bash
npm run build
```

The production build is output to `dist/`. Set `VITE_API_BASE` at build time if the API is served from a different origin:

```bash
VITE_API_BASE=https://api.example.com npm run build
```

## Tests

```bash
npm test
```

## Architecture

- `src/main.js` -- Entry point: initializes the Three.js scene, camera, controls, floors, and pin system
- `src/floors.js` -- Floor geometry creation and floor switching
- `src/pins.js` -- Pin placement, raycasting, and visualization
- `src/ui/` -- Questionnaire UI components rendered as HTML overlays

### Floors

Each floor is a dedicated `THREE.Group`. The groups contain slab and wall geometry. Future work: replace box geometries with loaded glTF models using `GLTFLoader`.

## License

[AGPL-3.0](../LICENSE)
