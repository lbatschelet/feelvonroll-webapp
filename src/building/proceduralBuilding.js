/**
 * Procedural building provider.
 * Creates buildings from config parameters using THREE.js geometry.
 * This is the default provider; a glTF-based provider can replace it.
 */
import * as THREE from 'three'
import { BUILDINGS, FLOOR } from '../config'
import { createFloorGroup, setFloorWallMode, getFloorSlabTopY } from '../floors'

/**
 * Creates the procedural building scene objects.
 * @param {THREE.Scene} scene - The scene to add buildings to.
 * @returns {object} Building provider interface.
 */
export function createProceduralBuilding(scene) {
  const floorGroups = []
  const maxAboveGroundFloors = Math.max(...BUILDINGS.map((b) => b.floors))
  const maxBasements = Math.max(...BUILDINGS.map((b) => b.basements))

  BUILDINGS.forEach((building, buildingIndex) => {
    const buildingGroup = new THREE.Group()
    buildingGroup.position.copy(building.offset)
    buildingGroup.userData.buildingIndex = buildingIndex

    for (let floorIndex = -building.basements; floorIndex < building.floors; floorIndex += 1) {
      const floorGroup = createFloorGroup(floorIndex)
      floorGroup.userData.buildingIndex = buildingIndex
      floorGroups.push(floorGroup)
      buildingGroup.add(floorGroup)
    }

    scene.add(buildingGroup)
  })

  return {
    floorGroups,
    maxBasements,
    maxAboveGroundFloors,
    setFloorWallMode,
    getFloorSlabTopY,
    getTargetYForFloor: (floorIndex) => {
      return (
        floorIndex * (FLOOR.height + FLOOR.slabThickness) +
        FLOOR.slabThickness +
        FLOOR.wallHeight * 0.55
      )
    },
  }
}
