/**
 * Pin clustering based on screen-space proximity.
 * Groups nearby pins into clusters for the current camera view.
 */
import * as THREE from 'three'

/**
 * Builds screen-space clusters from a list of pins.
 * @param {Array} pins - Array of pin data objects.
 * @param {THREE.Camera} camera - The scene camera.
 * @param {THREE.OrbitControls} controls - The orbit controls (used for distance calculation).
 * @param {HTMLElement} domElement - The renderer's DOM element (used for screen projection).
 * @returns {Array} Array of cluster objects { pins, screen, worldSum, worldPosition }.
 */
export function buildClusters(pins, camera, controls, domElement) {
  const rect = domElement.getBoundingClientRect()
  const distance = camera.position.distanceTo(controls.target)
  const t = Math.min(Math.max((distance - 10) / 30, 0), 1)
  const threshold = 14 + t * 24
  const clusters = []

  pins.forEach((pin) => {
    const world = new THREE.Vector3(pin.position_x, pin.position_y + 0.2, pin.position_z)
    const projected = world.clone().project(camera)
    const screen = {
      x: (projected.x * 0.5 + 0.5) * rect.width,
      y: (-projected.y * 0.5 + 0.5) * rect.height,
    }

    let targetCluster = null
    for (const cluster of clusters) {
      const dx = cluster.screen.x - screen.x
      const dy = cluster.screen.y - screen.y
      if (Math.hypot(dx, dy) < threshold) {
        targetCluster = cluster
        break
      }
    }

    if (!targetCluster) {
      clusters.push({
        pins: [pin],
        screen,
        worldSum: world.clone(),
        worldPosition: world.clone(),
      })
    } else {
      targetCluster.pins.push(pin)
      targetCluster.screen.x =
        (targetCluster.screen.x * (targetCluster.pins.length - 1) + screen.x) /
        targetCluster.pins.length
      targetCluster.screen.y =
        (targetCluster.screen.y * (targetCluster.pins.length - 1) + screen.y) /
        targetCluster.pins.length
      targetCluster.worldSum.add(world)
      targetCluster.worldPosition
        .copy(targetCluster.worldSum)
        .multiplyScalar(1 / targetCluster.pins.length)
    }
  })

  return clusters
}
