import * as THREE from 'three'

export const VIEW = {
  // CSS-style string so THREE.Color applies proper sRGB→linear conversion,
  // keeping the canvas background identical to the CSS background.
  background: '#f3f4f6',
  cameraPosition: new THREE.Vector3(-14, 16, 14),
  polarAngle: THREE.MathUtils.degToRad(50),
  minDistance: 6,
  maxDistance: 40,
}

export const FLOOR = {
  width: 12,
  depth: 10,
  height: 2.6,
  slabThickness: 0.22,
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
