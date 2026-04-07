import * as THREE from 'three'

export const VIEW = {
  // CSS-style string so THREE.Color applies proper sRGB→linear conversion,
  // keeping the canvas background identical to the CSS background.
  background: '#f3f4f6',
  // Default: camera from the opposite corner than before.
  cameraPosition: new THREE.Vector3(14, 16, -14),
  polarAngle: THREE.MathUtils.degToRad(50),
  minDistance: 6,
  maxDistance: 40,
}

/**
 * OrbitControls „Bremsen“ nach Loslassen (Pan/Rotate) und Zoom-Raster.
 * Höheres dampingFactor = schnellerer Stillstand (Three.js Default 0.05).
 * Niedrigeres zoomSpeed = weniger Zoom pro Rad-Impuls.
 */
export const ORBIT_FEEL = {
  dampingFactor: 0.22,
  zoomSpeed: 0.65,
}

/**
 * Zoom-Grenzen für importierte glTF-Modelle (main.js → applyImportedModelCameraLimits).
 * D = building.suggestedCameraDistance (aus Bounding-Box).
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ① NAH-GRENZE (stärkstes „Reinzoomen“) → OrbitControls.minDistance         │
 * │    Größer = weiter weg vom Ziel am nächsten erlaubten Punkt               │
 * └──────────────────────────────────────────────────────────────────────────┘
 * minDistance = clamp(D * minDistMult, minDistClampMin, minDistClampMax)
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ② WEIT-GRENZE (stärkstes „Rauszoomen“) → OrbitControls.maxDistance        │
 * │    Größer = mehr Überblick                                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 * maxDistance = max(D * maxDistMult, minDistance * maxDistMinOverMin, maxDistFloor)
 *
 * Startansicht: mindestens D * defaultViewMult (wenn Kamera näher wäre, nach außen)
 */
export const ORBIT_GLTF_ZOOM = {
  minDistMult: 0.11,
  minDistClampMin: 4,
  minDistClampMax: 75,
  maxDistMult: 6.8,
  maxDistMinOverMin: 5,
  maxDistFloor: 140,
  defaultViewMult: 1.12,
}

export const FLOOR = {
  width: 12,
  depth: 10,
  height: 2.5,
  slabThickness: 0.12,
  wallThickness: 0.22,
  wallHeight: 1.7,
  courtyardWidth: 4,
  courtyardDepth: 3.5,
  belowGroundOffset: -0.9,
}

export const WALL = {
  lowRatio: 0.1,
}

export const BUILDINGS = [
  { name: 'A', floors: 5, basements: 2, offset: new THREE.Vector3(-7, 0, -4) },
  { name: 'B', floors: 3, basements: 2, offset: new THREE.Vector3(8, 0, 2) },
  { name: 'C', floors: 4, basements: 2, offset: new THREE.Vector3(-6, 0, 7) },
]
