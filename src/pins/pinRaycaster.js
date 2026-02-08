/**
 * Pin raycasting — handles pointer interactions with the 3D scene.
 * Exports: setupPinRaycaster.
 */
import * as THREE from 'three'
import { getFloorSlabTopY } from '../floors'

/**
 * Collect all hit-sphere meshes from a pin group (for hover raycasting).
 * @param {THREE.Group} pinGroup
 * @returns {THREE.Mesh[]}
 */
function getHitSpheres(pinGroup) {
  const spheres = []
  pinGroup.children.forEach((group) => {
    if (!group.children) return
    group.children.forEach((child) => {
      if (child.userData.isHitSphere) spheres.push(child)
    })
  })
  return spheres
}

/**
 * Sets up raycaster-based pointer interaction.
 * @param {object} deps - Dependencies.
 * @param {THREE.Camera} deps.camera
 * @param {HTMLElement} deps.domElement
 * @param {THREE.Group} deps.pinGroup
 * @param {Function} deps.getState - Returns current pin state.
 * @param {Function} deps.getSelectedFloor - Returns the current floor index.
 * @param {Function} deps.onPinClick - Called when an existing pin is clicked.
 * @param {Function} deps.onFloorClick - Called when the floor is clicked in pin mode.
 */
export function setupPinRaycaster({ camera, domElement, pinGroup, getState, getSelectedFloor, onPinClick, onFloorClick }) {
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  // ── Click handling ─────────────────────────────────────────────
  domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    if (event.target.closest('.ui')) return

    const rect = domElement.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)

    const state = getState()

    if (!state.pinMode) {
      const hits = raycaster.intersectObjects(pinGroup.children, true)
      if (hits.length) {
        const pin = hits[0].object.userData.pinData
        if (pin) {
          onPinClick(pin)
        }
      }
      return
    }

    const floorIndex = getSelectedFloor()
    const planeY = getFloorSlabTopY(floorIndex)

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY)
    const point = new THREE.Vector3()
    if (!raycaster.ray.intersectPlane(plane, point)) return

    onFloorClick({ floorIndex, position: point })
  })

  // ── Hover detection (desktop only, throttled via rAF) ──────────
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  if (!isTouch) {
    let hoverPending = false
    let _prevHovered = null

    domElement.addEventListener('pointermove', (event) => {
      if (hoverPending) return
      hoverPending = true

      requestAnimationFrame(() => {
        hoverPending = false

        const rect = domElement.getBoundingClientRect()
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
        raycaster.setFromCamera(pointer, camera)

        const hitSpheres = getHitSpheres(pinGroup)
        const hits = raycaster.intersectObjects(hitSpheres, false)

        let hitGroup = null
        if (hits.length) {
          const hitObj = hits[0].object
          hitGroup = hitObj.parent
        }

        // Un-hover previous
        if (_prevHovered && _prevHovered !== hitGroup) {
          _prevHovered.userData.hovered = false
        }

        if (hitGroup) {
          hitGroup.userData.hovered = true
          domElement.style.cursor = 'pointer'
        } else {
          domElement.style.cursor = ''
        }

        _prevHovered = hitGroup
      })
    })
  }
}
