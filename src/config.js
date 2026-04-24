import * as THREE from 'three'

export const VIEW = {
  // CSS-style string so THREE.Color applies proper sRGB→linear conversion,
  // keeping the canvas background identical to the CSS background.
  background: '#f3f4f6',
  // Default: camera from the opposite corner than before.
  cameraPosition: new THREE.Vector3(12, 14, -12),
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
 * Zoom für importierte glTF-Modelle (main.js).
 * D = building.suggestedCameraDistance (Skalierung der Szene, grob „Modellgrösse“).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  NUR DIESE ZWEI WERTE MUSST DU ANPASSEN:
 *
 *  closestZoom  —  Wie NAH darf die Kamera maximal zum Zielpunkt (Orbit-Zentrum)?
 *                 minDistance = D × closestZoom, eingegrenzt nur relativ zu D (kein festes „75“).
 *                 Merke: kleinere Zahl = ein Stück näher reinzoomen (z. B. 0.10 etwas näher als 0.11).
 *                 Zum Testen: Mausrad nach vorn bis zum Anschlag.
 *
 *  farthestZoom —  Wie WEIT darf die Kamera maximal weg?
 *                 maxDistance hängt von D × farthestZoom ab (plus kleine Sicherheit).
 *                 Grösser = mehr Überblick / weiter rauszoomen.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const ORBIT_GLTF_ZOOM = {
  closestZoom: 0.09,
  farthestZoom: 1,

  /** Relativ zu D — verhindert nur Extremfälle; vorher haben feste 4…75 closestZoom oft ignoriert */
  closestRelativeMin: 0.02,
  closestRelativeMax: 0.5,
  farthestFloor: 140,
  farthestMinOverClosest: 5,
  /** Start nach Laden: mindestens D × dieser Faktor (wenn du zu nah startest) */
  defaultViewMult: 0.3,
}

/**
 * Pan-Begrenzung: Orbit-Target (und Kamera) bleiben in X/Z in der Nähe der Modell-Box.
 * Padding = max(horizontaler Modell-Durchmesser) × panPaddingFactor
 */
export const ORBIT_NAVIGATION = {
  panPaddingFactor: 0.1,
}

/**
 * Graue Bodenfläche unter dem Modell (glTF): Vielfaches von suggestedGroundSize,
 * damit die Plane-Kante beim Rauszoomen nicht sichtbar wird.
 */
export const ORBIT_GROUND = {
  groundPlaneMult: 120,
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
