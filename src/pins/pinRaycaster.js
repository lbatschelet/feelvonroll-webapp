/**
 * Pin raycasting — handles pointer interactions with the 3D scene.
 * Exports: setupPinRaycaster.
 */
import * as THREE from 'three'
import { getFloorSlabTopY } from '../floors'

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
}
