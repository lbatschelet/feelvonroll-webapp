/**
 * Building provider factory.
 * Returns a building provider based on the given type.
 *
 * Provider interface:
 *   - floorGroups: THREE.Group[]       -- all floor group meshes
 *   - maxBasements: number             -- for floor selector range
 *   - maxAboveGroundFloors: number     -- for floor selector range
 *   - setFloorWallMode(group, useLow)  -- toggle wall visibility
 *   - getFloorSlabTopY(floorIndex)     -- for pin placement
 *   - getTargetYForFloor(floorIndex)   -- for camera targeting
 *
 * Supported types:
 *   - 'procedural' (default): generates geometry from config parameters
 *   - 'gltf': (future) loads a glTF model
 */
import { createProceduralBuilding } from './proceduralBuilding'

/**
 * Creates a building provider.
 * @param {THREE.Scene} scene - The THREE.js scene.
 * @param {string} [type='procedural'] - Provider type.
 * @returns {object} Building provider conforming to the interface above.
 */
export function createBuildingProvider(scene, type = 'procedural') {
  switch (type) {
    case 'procedural':
      return createProceduralBuilding(scene)
    // case 'gltf':
    //   return createGltfBuilding(scene, modelUrl)
    default:
      throw new Error(`Unknown building provider type: ${type}`)
  }
}
