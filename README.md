# feelvonroll-webapp

Public-facing 3D web application for the [feelvonRoll](https://github.com/lbatschelet/feelvonroll) project. Users navigate a Three.js model of the vonRoll building and place pins to share how they feel in different spaces.

> [!NOTE]
> Part of the [feelvonRoll](https://github.com/lbatschelet/feelvonroll) project, developed for [PHBern](https://www.phbern.ch) within [RealTransform](https://sustainability.uzh.ch/de/forschung-lehre/forschung/realtransform.html). See the [main repository](https://github.com/lbatschelet/feelvonroll) for full documentation and project context.

## Features

- **3D building model** rendered with Three.js, with multiple navigable floors
- **Interactive pin placement**: click a location on any floor to start the questionnaire
- **Dynamic questionnaire**: fetched from the API, supports sliders, multi-choice, and free text
- **Station mode**: QR code links pre-position the camera and load a station-specific questionnaire
- **Pin coloring**: pins are colored by a configurable slider (e.g. wellbeing), with a gradient legend
- **Multi-language support**: language switcher with translations loaded from the API
- **About overlay**: markdown content page with auto-show on update

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

- `src/main.js` -- Entry point: scene setup, station/capture mode routing, floor visibility
- `src/building/` -- Procedural building geometry (floors, walls)
- `src/pins.js` -- Pin system orchestrator (state, rendering, raycasting, colors)
- `src/pins/` -- Pin subsystems: color mode, clustering, form, mesh, raycaster, translations
- `src/ui/` -- UI overlays: floor selector, language switcher, about overlay, title bar
- `src/api.js` -- API client (pins, questions, questionnaires, stations, content, languages)
- `src/i18n.js` -- Internationalization with translation loading

## License

[AGPL-3.0](../LICENSE) -- [Lukas Batschelet](https://lukasbatschelet.ch) for [PHBern](https://www.phbern.ch)
