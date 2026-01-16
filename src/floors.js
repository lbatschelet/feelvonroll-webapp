import * as THREE from 'three'
import { FLOOR, WALL } from './config'

export function createFloorGroup(index) {
  const group = new THREE.Group()
  const materials = createFloorMaterials(index)
  const baseY =
    index * (FLOOR.height + FLOOR.slabThickness) + (index < 0 ? FLOOR.belowGroundOffset : 0)

  addSlabsWithCourtyard(group, materials.slab, baseY)
  addExteriorWalls(group, materials.wall, baseY)
  addCourtyardWalls(group, materials.wall, baseY)
  addInteriorWalls(group, materials.wall, baseY)

  group.userData.floorIndex = index
  return group
}

export function getFloorSlabTopY(floorIndex) {
  const baseY =
    floorIndex * (FLOOR.height + FLOOR.slabThickness) +
    (floorIndex < 0 ? FLOOR.belowGroundOffset : 0)
  return baseY + FLOOR.slabThickness
}

function createFloorMaterials(index) {
  const baseHue = 200 + index * 18
  return {
    slab: new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.6, transparent: true }),
    wall: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7, transparent: true }),
    accent: new THREE.MeshStandardMaterial({
      color: new THREE.Color(`hsl(${baseHue}, 60%, 70%)`),
      transparent: true,
    }),
  }
}

function createWall({ width, depth, fullHeight, lowHeight, material, x, slabTopY, z, canLow }) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(width, fullHeight, depth), material)
  wall.position.set(x, slabTopY + fullHeight / 2, z)
  wall.userData.fullHeight = fullHeight
  wall.userData.lowHeight = lowHeight
  wall.userData.slabTopY = slabTopY
  wall.userData.canLow = canLow
  return wall
}

export function setFloorWallMode(group, useLow) {
  group.traverse((child) => {
    if (!child.userData || !child.userData.fullHeight) return
    const { fullHeight, lowHeight, slabTopY, canLow } = child.userData
    const nextHeight = useLow && canLow ? lowHeight : fullHeight
    child.scale.y = nextHeight / fullHeight
    child.position.y = slabTopY + nextHeight / 2
  })
}

function addSlabsWithCourtyard(group, material, baseY) {
  const slabY = baseY + FLOOR.slabThickness / 2
  const courtyardFits =
    FLOOR.courtyardWidth < FLOOR.width - FLOOR.wallThickness * 2 &&
    FLOOR.courtyardDepth < FLOOR.depth - FLOOR.wallThickness * 2

  const addSlab = (width, depth, x, z) => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(width, FLOOR.slabThickness, depth), material)
    slab.position.set(x, slabY, z)
    group.add(slab)
  }

  if (FLOOR.courtyardWidth > 0 && FLOOR.courtyardDepth > 0 && courtyardFits) {
    const sideWidth = (FLOOR.width - FLOOR.courtyardWidth) / 2
    const sideDepth = (FLOOR.depth - FLOOR.courtyardDepth) / 2
    addSlab(sideWidth, FLOOR.depth, -(FLOOR.courtyardWidth / 2 + sideWidth / 2), 0)
    addSlab(sideWidth, FLOOR.depth, FLOOR.courtyardWidth / 2 + sideWidth / 2, 0)
    addSlab(FLOOR.courtyardWidth, sideDepth, 0, -(FLOOR.courtyardDepth / 2 + sideDepth / 2))
    addSlab(FLOOR.courtyardWidth, sideDepth, 0, FLOOR.courtyardDepth / 2 + sideDepth / 2)
  } else {
    addSlab(FLOOR.width, FLOOR.depth, 0, 0)
  }
}

function addExteriorWalls(group, material, baseY) {
  const outerWallX = (FLOOR.width - FLOOR.wallThickness) / 2
  const outerWallZ = (FLOOR.depth - FLOOR.wallThickness) / 2
  const slabTopY = baseY + FLOOR.slabThickness
  const lowHeight = FLOOR.wallHeight * WALL.lowRatio

  group.add(
    createWall({
      width: FLOOR.width,
      depth: FLOOR.wallThickness,
      fullHeight: FLOOR.wallHeight,
      lowHeight,
      material,
      x: 0,
      slabTopY,
      z: -outerWallZ,
      canLow: false,
    })
  )
  group.add(
    createWall({
      width: FLOOR.width,
      depth: FLOOR.wallThickness,
      fullHeight: FLOOR.wallHeight,
      lowHeight,
      material,
      x: 0,
      slabTopY,
      z: outerWallZ,
      canLow: true,
    })
  )
  group.add(
    createWall({
      width: FLOOR.wallThickness,
      depth: FLOOR.depth,
      fullHeight: FLOOR.wallHeight,
      lowHeight,
      material,
      x: -outerWallX,
      slabTopY,
      z: 0,
      canLow: true,
    })
  )
  group.add(
    createWall({
      width: FLOOR.wallThickness,
      depth: FLOOR.depth,
      fullHeight: FLOOR.wallHeight,
      lowHeight,
      material,
      x: outerWallX,
      slabTopY,
      z: 0,
      canLow: false,
    })
  )
}

function addCourtyardWalls(group, material, baseY) {
  if (FLOOR.courtyardWidth <= 0 || FLOOR.courtyardDepth <= 0) return
  const innerX = (FLOOR.courtyardWidth - FLOOR.wallThickness) / 2
  const innerZ = (FLOOR.courtyardDepth - FLOOR.wallThickness) / 2
  const slabTopY = baseY + FLOOR.slabThickness
  const lowHeight = FLOOR.wallHeight * WALL.lowRatio

  group.add(
    createWall({
      width: FLOOR.courtyardWidth,
      depth: FLOOR.wallThickness,
      fullHeight: FLOOR.wallHeight,
      lowHeight,
      material,
      x: 0,
      slabTopY,
      z: -innerZ,
      canLow: true,
    })
  )
  group.add(
    createWall({
      width: FLOOR.courtyardWidth,
      depth: FLOOR.wallThickness,
      fullHeight: FLOOR.wallHeight,
      lowHeight,
      material,
      x: 0,
      slabTopY,
      z: innerZ,
      canLow: true,
    })
  )
  group.add(
    createWall({
      width: FLOOR.wallThickness,
      depth: FLOOR.courtyardDepth,
      fullHeight: FLOOR.wallHeight,
      lowHeight,
      material,
      x: -innerX,
      slabTopY,
      z: 0,
      canLow: true,
    })
  )
  group.add(
    createWall({
      width: FLOOR.wallThickness,
      depth: FLOOR.courtyardDepth,
      fullHeight: FLOOR.wallHeight,
      lowHeight,
      material,
      x: innerX,
      slabTopY,
      z: 0,
      canLow: true,
    })
  )
}

function addInteriorWalls(group, material, baseY) {
  const roomDepth = (FLOOR.depth - FLOOR.courtyardDepth) / 2 - 0.3
  const roomWidth = (FLOOR.width - FLOOR.courtyardWidth) / 2 - 0.4
  const slabTopY = baseY + FLOOR.slabThickness
  const lowHeight = FLOOR.wallHeight * WALL.lowRatio

  group.add(
    createWall({
      width: roomWidth,
      depth: FLOOR.wallThickness,
      fullHeight: FLOOR.wallHeight,
      lowHeight,
      material,
      x: -FLOOR.courtyardWidth / 2 - roomWidth / 2,
      slabTopY,
      z: 0,
      canLow: true,
    })
  )
  group.add(
    createWall({
      width: roomWidth,
      depth: FLOOR.wallThickness,
      fullHeight: FLOOR.wallHeight,
      lowHeight,
      material,
      x: FLOOR.courtyardWidth / 2 + roomWidth / 2,
      slabTopY,
      z: 0,
      canLow: true,
    })
  )
  group.add(
    createWall({
      width: FLOOR.wallThickness,
      depth: roomDepth,
      fullHeight: FLOOR.wallHeight,
      lowHeight,
      material,
      x: 0,
      slabTopY,
      z: FLOOR.courtyardDepth / 2 + roomDepth / 2,
      canLow: true,
    })
  )
  group.add(
    createWall({
      width: FLOOR.wallThickness,
      depth: roomDepth,
      fullHeight: FLOOR.wallHeight,
      lowHeight,
      material,
      x: 0,
      slabTopY,
      z: -FLOOR.courtyardDepth / 2 - roomDepth / 2,
      canLow: true,
    })
  )
}
