/**
 * Long-press gesture detection for mobile pin creation.
 * Allows placing pins by holding a finger on the canvas without
 * entering pin mode first.
 *
 * Exports: setupLongPress.
 */
import * as THREE from 'three'
import { getFloorSlabTopY } from '../floors'

const HOLD_MS = 600
const MOVE_THRESHOLD = 10 // px

/**
 * @param {object} deps
 * @param {THREE.Camera} deps.camera
 * @param {HTMLElement} deps.domElement
 * @param {Function} deps.getState — returns current pin state
 * @param {Function} deps.getSelectedFloor — returns current floor index
 * @param {object} deps.controls — OrbitControls instance
 * @param {Function} deps.onFloorClick — called with { floorIndex, position }
 */
export function setupLongPress({ camera, domElement, getState, getSelectedFloor, controls, onFloorClick }) {
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  let timer = null
  let startX = 0
  let startY = 0
  let ripple = null
  let activePointerId = null

  // Suppress context menu during / right after long-press
  let suppressContextMenu = false
  domElement.addEventListener('contextmenu', (event) => {
    if (activePointerId !== null || suppressContextMenu) {
      event.preventDefault()
    }
  })

  function cancel() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    removeRipple()
    activePointerId = null
  }

  // ── Ripple feedback ──────────────────────────────────────────

  function showRipple(clientX, clientY) {
    removeRipple()
    ripple = document.createElement('div')
    ripple.className = 'longpress-ripple'
    ripple.style.left = clientX + 'px'
    ripple.style.top = clientY + 'px'
    document.body.appendChild(ripple)
  }

  function removeRipple() {
    if (ripple) {
      ripple.remove()
      ripple = null
    }
  }

  // ── Raycast to floor plane ───────────────────────────────────

  function raycastToFloor(clientX, clientY) {
    const rect = domElement.getBoundingClientRect()
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)

    const floorIndex = getSelectedFloor()
    const planeY = getFloorSlabTopY(floorIndex)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY)
    const point = new THREE.Vector3()

    if (!raycaster.ray.intersectPlane(plane, point)) return null
    return { floorIndex, position: point }
  }

  // ── Pointer events ───────────────────────────────────────────

  domElement.addEventListener('pointerdown', (event) => {
    // Only touch input
    if (event.pointerType !== 'touch') return
    // Only primary finger
    if (activePointerId !== null) return
    // Skip taps on UI elements
    if (event.target.closest('.ui')) return

    const state = getState()
    // Skip if pin mode is already active (single tap works there)
    if (state.pinMode) return
    // Skip if form/backdrop is open
    if (document.querySelector('.ui-form-backdrop.is-visible')) return

    activePointerId = event.pointerId
    startX = event.clientX
    startY = event.clientY

    showRipple(startX, startY)

    timer = setTimeout(() => {
      timer = null

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }

      // Briefly suppress context menu that some browsers fire after long-press
      suppressContextMenu = true
      setTimeout(() => { suppressContextMenu = false }, 200)

      removeRipple()

      // Prevent OrbitControls from finishing any in-progress pan
      controls.enabled = false
      requestAnimationFrame(() => {
        controls.enabled = true
      })

      // Set up grow-from-point animation on the modal
      const backdrop = document.querySelector('.ui-modal-backdrop')
      if (backdrop) {
        backdrop.style.setProperty('--longpress-x', startX + 'px')
        backdrop.style.setProperty('--longpress-y', startY + 'px')
        backdrop.classList.add('is-longpress')
      }

      const hit = raycastToFloor(startX, startY)
      if (hit) {
        onFloorClick(hit)
      }

      activePointerId = null
    }, HOLD_MS)
  })

  domElement.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointerId) return

    const dx = event.clientX - startX
    const dy = event.clientY - startY
    if (dx * dx + dy * dy > MOVE_THRESHOLD * MOVE_THRESHOLD) {
      cancel()
    }
  })

  domElement.addEventListener('pointerup', (event) => {
    if (event.pointerId !== activePointerId) return
    cancel()
  })

  domElement.addEventListener('pointercancel', (event) => {
    if (event.pointerId !== activePointerId) return
    cancel()
  })

  // Cancel on second finger (pinch-to-zoom)
  domElement.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return
    if (activePointerId !== null && event.pointerId !== activePointerId) {
      cancel()
    }
  }, true)
}
