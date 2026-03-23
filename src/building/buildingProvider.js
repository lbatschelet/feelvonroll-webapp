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
import { createGltfBuilding } from './gltfBuilding'
import { createStackedGltfBuilding } from './gltfBuilding'

/**
 * Creates a building provider.
 * @param {THREE.Scene} scene - The THREE.js scene.
 * @param {string} [type='procedural'] - Provider type.
 * @returns {object} Building provider conforming to the interface above.
 */
export async function createBuildingProvider(scene, type = 'procedural', options = {}) {
  switch (type) {
    case 'procedural':
      return createProceduralBuilding(scene)
    case 'gltf':
      if (options?.modelUrlsByFloorIndex) {
        return createStackedGltfBuilding(scene, options)
      }
      return createGltfBuilding(scene, options)
    default:
      throw new Error(`Unknown building provider type: ${type}`)
  }
}
