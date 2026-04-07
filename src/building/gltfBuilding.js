/**
 * glTF building provider.
 *
 * Loads a glTF/GLB model and exposes it through the same interface the
 * procedural building uses:
 *   - floorGroups: THREE.Object3D[] (each with userData.floorIndex)
 *   - maxBasements / maxAboveGroundFloors
 *   - setFloorWallMode(group, useLow)
 *   - getFloorSlabTopY(floorIndex)
 *   - getTargetYForFloor(floorIndex)
 *
 * Naming conventions (first iteration):
 * - If the glTF contains objects named `floor_<index>` they are treated as
 *   separate floor groups.
 * - Otherwise the whole model becomes `floor_0`.
 *
 * Slab Y placement:
 * - First iteration returns slab top at Y=0 unless a marker node named
 *   `slabTop` (or `floor_slabTop`) is present inside the floor group.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { FLOOR } from '../config'

/** Nur bei sichtbaren Ausblendern: ?noFrustumCull=1 (Standard: Culling an = weniger Draw) */
function disableFrustumCullForDebug(root) {
  if (typeof window === 'undefined') return
  if (new URLSearchParams(window.location.search).get('noFrustumCull') !== '1') return
  root.traverse((obj) => {
    if (obj && obj.isMesh) obj.frustumCulled = false
  })
}

function getFloorIndexFromName(name) {
  const match = /^floor_(-?\d+)$/.exec(name)
  if (!match) return null
  return Number(match[1])
}

function findSlabTopWorldY(floorGroup, { unitScale = 1 } = {}) {
  const slabMarker =
    floorGroup.getObjectByName?.('slabTop') ||
    floorGroup.getObjectByName?.('floor_slabTop') ||
    floorGroup.getObjectByName?.('floor_slab_top')

  if (slabMarker) {
    const v = new THREE.Vector3()
    slabMarker.getWorldPosition(v)
    return v.y
  }

  // Fallback: use the group's world-space bounding box.
  // This is more robust than returning 0, especially for debug multi-floor simulation.
  const box = new THREE.Box3().setFromObject(floorGroup)
  // Sweet Home exports often include a thin baseplate (e.g. 12cm). If we
  // don't have an explicit marker, treat slab top as "base + slabThickness".
  const slabThickness = (FLOOR.slabThickness || 0) * (Number.isFinite(unitScale) ? unitScale : 1)
  return box.min.y + slabThickness
}

function hideBasePlanesForFloorGroups({ floorGroups }) {
  // Heuristic: base planes are usually very thin but cover a large area.
  // Important: keep thresholds narrow so we don't hide walls/markings.
  const minThicknessY = 0.06 // only extremely flat meshes
  const epsilonMinY = 0.03 // hide only meshes that sit at/near the base level (local to each floor)

  floorGroups.forEach((floorGroup) => {
    const groupBox = new THREE.Box3().setFromObject(floorGroup)
    const groupSize = groupBox.getSize(new THREE.Vector3())
    const groupArea = groupSize.x * groupSize.z
    if (!groupArea || !Number.isFinite(groupArea) || groupArea <= 0) return

    const minFootprint = groupArea * 0.35 // only very large footprints
    const baseY = groupBox.min.y

    floorGroup.traverse((obj) => {
      if (!obj || !obj.isMesh) return
      const name = (obj.name || '').toLowerCase()
      if (name.includes('slabtop') || name.includes('slab_top') || name.includes('slab')) return

      const box = new THREE.Box3().setFromObject(obj)
      const size = box.getSize(new THREE.Vector3())
      const thicknessY = size.y
      const footprint = size.x * size.z
      const meshBottomFromBase = box.min.y - baseY

      if (thicknessY < minThicknessY && footprint > minFootprint && meshBottomFromBase <= epsilonMinY) {
        obj.visible = false
        obj.castShadow = false
        obj.receiveShadow = false
      }
    })
  })
}

export async function createGltfBuilding(scene, { modelUrl, debugSimulateFloors } = {}) {
  const loader = new GLTFLoader()
  const gltf = await loader.loadAsync(modelUrl)

  const root = gltf.scene || gltf.scenes?.[0]
  if (!root) throw new Error(`No scene found in model: ${modelUrl}`)

  // Prototype quality-of-life:
  // Keep meter-scale (no arbitrary scaling). Sweet Home can be calibrated
  // in meters already.
  // Instead:
  // - center in X/Z
  // - move lowest point to Y=0
  // - disable frustum culling for meshes
  // Additionally, we return camera-range hints so huge models are not
  // clipped by the camera far plane.
  const box = new THREE.Box3().setFromObject(root)
  const center = box.getCenter(new THREE.Vector3())
  const minY = box.min.y

  root.position.x -= center.x
  root.position.z -= center.z
  root.position.y -= minY

  const boundsAfter = new THREE.Box3().setFromObject(root)
  const sizeAfterBounds = boundsAfter.getSize(new THREE.Vector3())
  const groundPad = 1.4
  const suggestedGroundSize = Math.max(sizeAfterBounds.x, sizeAfterBounds.z) * groundPad

  const centeredBox = new THREE.Box3().setFromObject(root)
  const sizeAfterCentered = centeredBox.getSize(new THREE.Vector3())
  const radius = sizeAfterCentered.length() / 2
  const suggestedCameraDistance = Math.max(radius * 2.5, 40)
  const suggestedCameraFar = suggestedCameraDistance * 6

  scene.add(root)
  disableFrustumCullForDebug(root)

  // Collect floor groups by name.
  const floorEntries = []
  root.traverse((obj) => {
    if (!obj?.name) return
    const floorIndex = getFloorIndexFromName(obj.name)
    if (floorIndex === null) return
    floorEntries.push({ floorIndex, obj })
  })

  const floorGroups = floorEntries.length
    ? floorEntries.sort((a, b) => a.floorIndex - b.floorIndex).map((e) => {
        e.obj.userData.floorIndex = e.floorIndex
        return e.obj
      })
    : (() => {
        root.userData.floorIndex = 0
        return [root]
      })()

  // Debug / prototype helper:
  // If the model only contains `floor_0` (typical for per-floor exports),
  // optionally simulate floors by cloning the detected floor group and
  // offsetting it vertically so the floor selector shows -1 / 1 as well.
  if (Array.isArray(debugSimulateFloors) && floorGroups.length === 1) {
    const baseGroup = floorGroups[0]
    const baseIndex = Number(baseGroup.userData.floorIndex) || 0
    // Derive vertical floor step from the imported geometry itself.
    // This avoids overlaps for models not using procedural scale.
    const baseBox = new THREE.Box3().setFromObject(baseGroup)
    const baseSize = baseBox.getSize(new THREE.Vector3())
    const floorStepY = Math.max(baseSize.y, FLOOR.height + FLOOR.slabThickness)

    const already = new Set(debugSimulateFloors.map((i) => Number(i)))
    // Ensure baseIndex is included.
    already.add(baseIndex)

    // Clone and add additional floor groups.
    const newGroups = []
    Array.from(already)
      .sort((a, b) => a - b)
      .forEach((idx) => {
        if (idx === baseIndex) return
        const clone = baseGroup.clone(true)
        clone.userData.floorIndex = idx
        // Important:
        // clones are always attached to `root`, not to the original parent of
        // baseGroup. Therefore we must reset X/Z to avoid double-applying the
        // centered root transform (which causes the horizontal shift you saw).
        clone.position.set(0, 0, 0)
        clone.position.y = (idx - baseIndex) * floorStepY
        root.add(clone)
        newGroups.push(clone)
      })

    if (newGroups.length) {
      floorGroups.push(...newGroups)
    }
  }

  const floorIndices = floorGroups.map((g) => Number(g.userData.floorIndex))
  const minFloor = Math.min(...floorIndices)
  const maxFloor = Math.max(...floorIndices)

  const maxBasements = minFloor < 0 ? Math.abs(minFloor) : 0
  // Note: floorSelector uses an exclusive upper bound.
  const maxAboveGroundFloors = maxFloor + 1

  const slabTopByFloorIndex = new Map()
  floorGroups.forEach((group) => {
    const idx = Number(group.userData.floorIndex)
    const groupBox = new THREE.Box3().setFromObject(group)
    const groupSize = groupBox.getSize(new THREE.Vector3())
    const footprint = Math.max(groupSize.x, groupSize.z)
    const unitScale = footprint > 2000 ? 100 : 1
    slabTopByFloorIndex.set(idx, findSlabTopWorldY(group, { unitScale }))
  })

  // Baseplane removal is handled in the model pipeline (offline).

  const navigationBounds = new THREE.Box3().setFromObject(root)

  return {
    source: 'gltf',
    floorGroups,
    maxBasements,
    maxAboveGroundFloors,
    setFloorWallMode: () => {
      // Prototype: leave walls as-is.
      // Later we can toggle `walls_low` vs `walls_full` layers using naming conventions.
    },
    getFloorSlabTopY: (floorIndex) => slabTopByFloorIndex.get(Number(floorIndex)) ?? 0,
    getTargetYForFloor: (floorIndex) => {
      const slabTopY = slabTopByFloorIndex.get(Number(floorIndex)) ?? 0
      return slabTopY + FLOOR.wallHeight * 0.55
    },
    suggestedCameraDistance,
    suggestedCameraFar,
    suggestedGroundSize,
    navigationBounds,
  }
}

/**
 * Stacked multi-floor loader for per-floor glTF exports.
 *
 * Assumption for the prototype:
 * - Each floor glb is aligned so its local "min Y" is near the slab/base level.
 * - We then stack floors vertically based on procedural floor step.
 */
export async function createStackedGltfBuilding(scene, { modelUrlsByFloorIndex } = {}) {
  const debugStack = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('debugStack') === '1'
  const debugFloorMarkers = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('debugFloorMarkers') === '1'

  const entries = Object.entries(modelUrlsByFloorIndex || {})
    .map(([k, v]) => ({ floorIndex: Number(k), modelUrl: v }))
    .filter((e) => Number.isFinite(e.floorIndex) && typeof e.modelUrl === 'string')

  if (!entries.length) {
    throw new Error('Missing modelUrlsByFloorIndex')
  }

  const loader = new GLTFLoader()
  const loaded = (
    await Promise.all(
      entries.map(async (entry) => {
        try {
          const gltf = await loader.loadAsync(entry.modelUrl)
          return { floorIndex: entry.floorIndex, gltf }
        } catch {
          return null
        }
      })
    )
  ).filter(Boolean)

  if (!loaded.length) {
    throw new Error('No glTF floors could be loaded')
  }

  const floorGroups = []
  const slabTopByFloorIndex = new Map()

  // Stack floors robustly even if the GLBs are exact copies:
  // - normalize each loaded root so its `minY` is at Y=0
  // - then shift by a model-space floor step (unit-aware)
  const proceduralFloorStepY = FLOOR.height + FLOOR.slabThickness

  const itemsMeta = []
  for (const item of loaded) {
    const root = item.gltf.scene || item.gltf.scenes?.[0]
    if (!root) continue

    const box = new THREE.Box3().setFromObject(root)
    const center = box.getCenter(new THREE.Vector3())
    const minY = box.min.y
    const size = box.getSize(new THREE.Vector3())
    itemsMeta.push({ floorIndex: item.floorIndex, root, center, minY, size })
  }

  const floorIndices = itemsMeta.map((m) => m.floorIndex)
  const refIndex = itemsMeta.find((m) => m.floorIndex === 0)?.floorIndex ?? Math.min(...floorIndices)
  // Unit-aware step without being affected by tall objects (e.g. trees).
  // Sweet Home exports are often in meters, but can also end up in centimeters.
  // We infer the scale from the overall footprint size.
  const sampleSize = itemsMeta.find((m) => m.floorIndex === refIndex)?.size
    || itemsMeta[0]?.size
    || new THREE.Vector3(1, 1, 1)
  const footprint = Math.max(sampleSize.x, sampleSize.z)
  const unitScale = footprint > 2000 ? 100 : 1
  const floorStepY = proceduralFloorStepY * unitScale

  // Use a shared X/Z centering based on the reference floor so mixed
  // versions (e.g. trees added) don't shift relative to each other.
  const refMeta = itemsMeta.find((m) => m.floorIndex === refIndex) || itemsMeta[0]
  const refCenter = refMeta?.center || new THREE.Vector3()

  // Normalize + add each floor root.
  for (const meta of itemsMeta) {
    const { floorIndex, root, center, minY, size } = meta

    // Shared center in X/Z.
    root.position.x -= refCenter.x
    root.position.z -= refCenter.z

    // Normalize base: lowest point to Y=0.
    root.position.y -= minY

    // Stack by floor index relative to the chosen reference floor.
    root.position.y += (floorIndex - refIndex) * floorStepY

    disableFrustumCullForDebug(root)

    // Create a per-floor group marker.
    root.userData.floorIndex = floorIndex
    floorGroups.push(root)

    slabTopByFloorIndex.set(floorIndex, findSlabTopWorldY(root, { unitScale }))
    scene.add(root)

    if (debugStack) {
      // Shows whether stacking actually moved floors.
      const slabTopY = slabTopByFloorIndex.get(floorIndex)
      const afterBox = new THREE.Box3().setFromObject(root)
      const afterSize = afterBox.getSize(new THREE.Vector3())
      console.debug('[gltfStack]', {
        floorIndex,
        floorStepY,
        sizeY: size.y,
        rootY: root.position.y,
        slabTopY,
        afterMinY: afterBox.min.y,
        afterMaxY: afterBox.max.y,
        afterSizeY: afterSize.y,
      })
    }

    if (debugFloorMarkers) {
      // Always-visible marker to confirm floor stacking in screen space.
      const markerColor =
        floorIndex === 0 ? 0x2b6cff
        : floorIndex === 1 ? 0x22c55e
        : floorIndex === -1 ? 0xef4444
        : 0xf59e0b

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 12),
        new THREE.MeshBasicMaterial({ color: markerColor })
      )
      marker.name = `floorMarker_${floorIndex}`
      marker.position.set(0, 0, 0)
      if ('depthTest' in marker.material) marker.material.depthTest = false
      root.add(marker)
    }
  }

  // Baseplane removal is handled in the model pipeline (offline).

  const minFloor = Math.min(...floorIndices)
  const maxFloor = Math.max(...floorIndices)
  const maxBasements = minFloor < 0 ? Math.abs(minFloor) : 0
  const maxAboveGroundFloors = maxFloor + 1

  // Suggested camera bounds based on combined model size.
  const globalBox = new THREE.Box3()
  floorGroups.forEach((g) => globalBox.union(new THREE.Box3().setFromObject(g)))
  const size = globalBox.getSize(new THREE.Vector3())
  const radius = size.length() / 2
  const suggestedCameraDistance = Math.max(radius * 2.5, 40)
  const suggestedCameraFar = suggestedCameraDistance * 6

  const suggestedGroundSize = Math.max(size.x, size.z) * 1.4

  return {
    source: 'gltf',
    floorGroups,
    maxBasements,
    maxAboveGroundFloors,
    setFloorWallMode: () => {},
    getFloorSlabTopY: (floorIndex) => slabTopByFloorIndex.get(Number(floorIndex)) ?? 0,
    getTargetYForFloor: (floorIndex) => {
      const slabTopY = slabTopByFloorIndex.get(Number(floorIndex)) ?? 0
      return slabTopY + FLOOR.wallHeight * 0.55
    },
    suggestedCameraDistance,
    suggestedCameraFar,
    suggestedGroundSize,
    navigationBounds: globalBox.clone(),
  }
}

