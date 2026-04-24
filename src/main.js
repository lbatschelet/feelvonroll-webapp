/**
 * Application entry point.
 * Wires together scene, building, pin system, and UI.
 */
import './style.css'
import * as THREE from 'three'
import {
  addLights,
  createCamera,
  createControls,
  createGround,
  createRenderer,
  createScene,
  getPreferredPixelRatio,
} from './scene'
import { createBuildingProvider } from './building/buildingProvider'
import { createFloorSelector } from './ui/floorSelector'
import { createLanguageSwitcher } from './ui/languageSwitcher'
import { createAboutOverlay } from './ui/aboutOverlay'
import { createTitleBar } from './ui/titleBar'
import { createPinSystem } from './pins'
import { fetchLanguages, fetchQuestions, fetchContent, fetchStation, fetchQuestionnaire } from './api'
import { getFallbackQuestions } from './questionnaire'
import { ORBIT_GLTF_ZOOM, ORBIT_GROUND, ORBIT_NAVIGATION } from './config'
import { getLanguage, onLanguageChange, setLanguage, t } from './i18n'
import { marked } from 'marked'

// ── URL parameters ──────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search)
const pathRoute = parsePathRoute(window.location.pathname)
const captureMode = urlParams.get('mode') === 'capture'
const captureKind = urlParams.get('capture') || 'camera'
const stationKey = urlParams.get('station') || pathRoute.stationKey
const kioskMode = urlParams.get('kiosk') === '1' || pathRoute.kioskMode
const debugFloors = urlParams.get('debugFloors') === '1'
const debugFloorVisibility = urlParams.get('debugFloorVisibility') === '1'

function parsePathRoute(pathname) {
  const rawParts = String(pathname || '').split('/').filter(Boolean)
  const parts = rawParts.map((part) => {
    try {
      return decodeURIComponent(part)
    } catch {
      return part
    }
  })

  if (!parts.length) {
    return { kioskMode: false, stationKey: null }
  }

  // Path mode for iOS home screen shortcuts where query params may be dropped:
  // - /kiosk/<stationKey>
  // - /station/<stationKey>
  if (parts[0] === 'kiosk') {
    return { kioskMode: true, stationKey: parts[1] || null }
  }
  if (parts[0] === 'station') {
    return { kioskMode: false, stationKey: parts[1] || null }
  }

  return { kioskMode: false, stationKey: null }
}


// ── Scene setup ─────────────────────────────────────────────
const app = document.querySelector('#app')
setLanguage(getLanguage())

// We do not use browser context menus in the 3D app.
// Disable them app-wide to avoid long-press/right-click conflicts on touch devices.
app.addEventListener('contextmenu', (event) => {
  event.preventDefault()
  event.stopPropagation()
}, true)

const renderer = createRenderer(app)
const scene = createScene()
const camera = createCamera()
const controls = createControls(camera, renderer.domElement)
const ground = createGround()
scene.add(ground)
addLights(scene)

// ── Building ────────────────────────────────────────────────
// Prototype model loading:
// If `/models/floor_0.glb` exists, we try to load it. Otherwise we fall back
// to the procedural building provider so the app still runs.
const BUILDING_MODEL_URL = '/models/floor_0.glb'
let building
try {
  // Stacked prototype:
  // expects per-floor exports like:
  // - /models/floor_-1.glb
  // - /models/floor_0.glb
  // - /models/floor_1.glb
  // If only a subset exists, the loader skips missing files.
  building = await createBuildingProvider(scene, 'gltf', {
    modelUrlsByFloorIndex: {
      [-2]: '/models/floor_-2.glb',
      [-1]: '/models/floor_-1.glb',
      [0]: BUILDING_MODEL_URL,
      [1]: '/models/floor_1.glb',
      [2]: '/models/floor_2.glb',
      [3]: '/models/floor_3.glb',
    },
  })
} catch {
  building = await createBuildingProvider(scene, 'procedural')
}

/**
 * Imported (glTF) models: single source of truth for zoom limits + clipping planes.
 * Clear min/max distance (hard stop), no overlapping contradictory blocks.
 */
function applyImportedModelCameraLimits(b) {
  const D = b?.suggestedCameraDistance
  if (!D || !Number.isFinite(D)) return

  const z = ORBIT_GLTF_ZOOM
  const minDist = THREE.MathUtils.clamp(
    D * z.closestZoom,
    D * z.closestRelativeMin,
    D * z.closestRelativeMax
  )
  const maxDist = Math.max(
    D * z.farthestZoom,
    minDist * z.farthestMinOverClosest,
    z.farthestFloor
  )

  controls.minDistance = minDist
  controls.maxDistance = maxDist

  camera.near = THREE.MathUtils.clamp(D * 0.0002, 0.05, 2)
  const farHint =
    typeof b.suggestedCameraFar === 'number' ? b.suggestedCameraFar : D * 6
  camera.far = Math.max(farHint, maxDist * 2.5, D * 10)
  camera.updateProjectionMatrix()

  const target = controls.target
  const cp = camera.position
  const dist = cp.distanceTo(target)
  if (dist < 1e-6) return
  const dir = new THREE.Vector3().subVectors(cp, target).normalize()

  let desired = dist
  if (desired < minDist) desired = minDist
  if (desired > maxDist) desired = maxDist

  const desiredStart = THREE.MathUtils.clamp(
    D * z.defaultViewMult,
    minDist,
    maxDist
  )
  if (desired < desiredStart) desired = desiredStart

  cp.copy(target.clone().addScaledVector(dir, desired))
  controls.update()
}

applyImportedModelCameraLimits(building)

// Resize the ground plane — viel grösser als die Modell-Footprint, damit keine Quadrat-Kante sichtbar wird.
if (building?.source === 'gltf' && typeof building?.suggestedGroundSize === 'number') {
  const extent = building.suggestedGroundSize * ORBIT_GROUND.groundPlaneMult
  ground.scale.set(extent, extent, 1)
  // Move it away from the model to avoid z-fighting / overlap artifacts.
  ground.position.y = -10
  // Make the ground faint (still provides reference for "keep distance").
  ground.material.transparent = true
  ground.material.opacity = 0.25
  ground.material.depthWrite = false
}

// Optional rotate buttons as an explicit fallback control.
const rotateOverlay = document.createElement('div')
rotateOverlay.className = 'ui-view-controls'
rotateOverlay.innerHTML = `
  <div class="ui-view-controls-inner">
    <button type="button" class="ui-view-controls-btn" data-rot="-1" title="Rotate left"><span class="ui-view-controls-icon">↺</span></button>
    <button type="button" class="ui-view-controls-btn" data-rot="1" title="Rotate right"><span class="ui-view-controls-icon">↻</span></button>
  </div>
`

const rotButtons = rotateOverlay.querySelectorAll('button[data-rot]')
const isLikelyTouchscreen =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(pointer: coarse)')?.matches === true &&
  (navigator.maxTouchPoints || 0) > 0
function rotateCameraAroundTarget(angle) {
  if (!Number.isFinite(angle) || angle === 0) return
  const offset = camera.position.clone().sub(controls.target)
  const spherical = new THREE.Spherical().setFromVector3(offset)
  spherical.theta += angle
  offset.setFromSpherical(spherical)
  camera.position.copy(controls.target).add(offset)
  controls.update()
  scheduleFrame()
}

function handleTouchpadRotateGesture(event) {
  if (!controls.enabled) return
  // On trackpads, two-finger horizontal gestures usually arrive as wheel with pixel deltas.
  // Convert horizontal movement into orbit rotation for intuitive multitouch rotation.
  if (event.deltaMode !== 0) return
  const absX = Math.abs(event.deltaX)
  if (absX < 1.5) return
  event.preventDefault()
  const angle = THREE.MathUtils.clamp(event.deltaX * 0.0022, -0.12, 0.12)
  rotateCameraAroundTarget(angle)
}

let touchpadGestureLastRotation = null
const TOUCH_TWIST_SENSITIVITY = 0.36
const TOUCH_TWIST_DIRECTION = 1
function handleTouchpadNativeGesture(event) {
  // iOS Safari can also emit gesture events for touchscreens.
  // Keep this handler for trackpads only; touchscreen twist is handled by pointer math below.
  if (isLikelyTouchscreen) return
  if (!controls.enabled) return
  if (typeof event.rotation !== 'number') return
  event.preventDefault()
  if (touchpadGestureLastRotation === null) {
    touchpadGestureLastRotation = event.rotation
    return
  }
  const deltaDeg = event.rotation - touchpadGestureLastRotation
  touchpadGestureLastRotation = event.rotation
  const angle = THREE.MathUtils.clamp(-THREE.MathUtils.degToRad(deltaDeg), -0.2, 0.2)
  rotateCameraAroundTarget(angle)
}

function resetTouchpadNativeGesture() {
  touchpadGestureLastRotation = null
}

const activeTouchPointers = new Map()
let touchTwistLastAngle = null
let panWasEnabledBeforeTwist = true

function getTouchPairAngle() {
  if (activeTouchPointers.size < 2) return null
  const touches = Array.from(activeTouchPointers.values())
  const a = touches[0]
  const b = touches[1]
  return Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX)
}

function normalizeAngleDelta(delta) {
  let next = delta
  while (next > Math.PI) next -= Math.PI * 2
  while (next < -Math.PI) next += Math.PI * 2
  return next
}

function updateTwoFingerTwistRotation() {
  if (!controls.enabled || activeTouchPointers.size < 2) return
  const angle = getTouchPairAngle()
  if (!Number.isFinite(angle)) return
  if (touchTwistLastAngle === null) {
    touchTwistLastAngle = angle
    panWasEnabledBeforeTwist = controls.enablePan
    controls.enablePan = false
    return
  }
  const delta = normalizeAngleDelta(angle - touchTwistLastAngle)
  touchTwistLastAngle = angle
  if (Math.abs(delta) < 0.0025) return
  rotateCameraAroundTarget(delta * TOUCH_TWIST_SENSITIVITY * TOUCH_TWIST_DIRECTION)
}

function handleTouchPointerDown(event) {
  if (event.pointerType !== 'touch') return
  activeTouchPointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })
  if (activeTouchPointers.size === 2) {
    touchTwistLastAngle = null
  }
}

function handleTouchPointerMove(event) {
  if (event.pointerType !== 'touch') return
  if (!activeTouchPointers.has(event.pointerId)) return
  activeTouchPointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })
  updateTwoFingerTwistRotation()
}

function handleTouchPointerEnd(event) {
  if (event.pointerType !== 'touch') return
  activeTouchPointers.delete(event.pointerId)
  if (activeTouchPointers.size < 2) {
    touchTwistLastAngle = null
    controls.enablePan = panWasEnabledBeforeTwist
  }
}
rotButtons.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    const dir = Number(btn.dataset.rot || 0)
    if (dir === 0) return
    rotateCameraAroundTarget(dir * Math.PI / 18)
  })
})

// ── Floor selector ──────────────────────────────────────────
let selectedFloor = 0
let currentTargetY = (building?.source === 'gltf')
  ? controls.target.y
  : building.getTargetYForFloor(selectedFloor)

const { floorButtons, ui: floorSelectorUi } = createFloorSelector(
  building.maxBasements,
  building.maxAboveGroundFloors
)
floorSelectorUi.prepend(rotateOverlay)
app.appendChild(floorSelectorUi)

// ── Title bar ────────────────────────────────────────────────
const titleBar = createTitleBar()
app.appendChild(titleBar.ui)

// ── Home view (title click reset) ────────────────────────────
// Default home view: whatever the app starts with.
const homeView = {
  floorIndex: selectedFloor,
  camera: camera.position.clone(),
  target: controls.target.clone(),
}

function applyHomeView() {
  // Reset pin UI state first (close modals, exit pin mode).
  pinSystem.resetUi?.()

  setSelectedFloor(Number(homeView.floorIndex ?? 0))
  controls.target.copy(homeView.target)
  camera.position.copy(homeView.camera)
  controls.update()
  scheduleFrame()
}

titleBar.ui.addEventListener('click', (e) => {
  e.preventDefault()
  applyHomeView()
})
titleBar.ui.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return
  e.preventDefault()
  applyHomeView()
})

// ── Language switcher ───────────────────────────────────────
const languageSwitcher = createLanguageSwitcher({
  languages: [],
  activeLanguage: getLanguage(),
  ariaLabel: t('ui.language'),
  onChange: (language) => setLanguage(language),
})
app.appendChild(languageSwitcher.ui)

// ── About overlay ───────────────────────────────────────────
const aboutOverlay = createAboutOverlay()

languageSwitcher.infoButton.addEventListener('click', () => {
  loadAboutContent(getLanguage(), true)
})

// ── Render-on-demand (keeps Orbit-Damping + Pin-Hover snappy, kein Dauer-Rendering) ──
let rafId = null
const tickCam = new THREE.Vector3()
const tickTarget = new THREE.Vector3()

function scheduleFrame() {
  if (rafId != null) return
  rafId = requestAnimationFrame(tick)
}

function setupKioskAutoReload() {
  if (!kioskMode) return

  const INACTIVITY_MS = 60_000
  let inactivityTimer = null
  let hasUserActivity = false

  const reloadPage = () => {
    window.location.reload()
  }

  const resetInactivityTimer = () => {
    if (inactivityTimer !== null) {
      clearTimeout(inactivityTimer)
    }
    inactivityTimer = window.setTimeout(reloadPage, INACTIVITY_MS)
  }

  const onUserActivity = () => {
    hasUserActivity = true
    resetInactivityTimer()
  }

  // Only arm the timer after the first user interaction.
  const activityEvents = ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart', 'mousedown']
  activityEvents.forEach((eventName) => {
    window.addEventListener(eventName, onUserActivity, { passive: true })
  })

  document.addEventListener('visibilitychange', () => {
    // Returning to the tab starts a fresh inactivity window,
    // but only after the user has interacted at least once.
    if (!document.hidden && hasUserActivity) {
      resetInactivityTimer()
    }
  })
}

function tick() {
  rafId = null
  if (typeof document !== 'undefined' && document.hidden) return

  tickCam.copy(camera.position)
  tickTarget.copy(controls.target)

  controls.update()
  clampPanToNavigationBounds()

  if (building?.source !== 'gltf') {
    const deltaY = currentTargetY - controls.target.y
    if (Math.abs(deltaY) > 1e-6) {
      controls.target.y += deltaY
      camera.position.y += deltaY
    }
  }

  const pinsNeedFrame = pinSystem.update()

  const moved =
    camera.position.distanceToSquared(tickCam) > 1e-8 ||
    controls.target.distanceToSquared(tickTarget) > 1e-8

  renderer.render(scene, camera)

  if (moved || pinsNeedFrame) {
    scheduleFrame()
  }
}

// ── Pin system ──────────────────────────────────────────────
const pinSystem = createPinSystem({
  scene,
  camera,
  renderer,
  domElement: renderer.domElement,
  controls,
  requestFrame: scheduleFrame,
  getSelectedFloor: () => selectedFloor,
  getFloorSlabTopY: (floorIndex) => building.getFloorSlabTopY(floorIndex),
  getPinScale: () => {
    // If the imported model is huge (often cm/mm export), scale pins up so they're visible.
    const ground = Number(building?.suggestedGroundSize)
    if (!Number.isFinite(ground) || ground <= 0) return 1
    return ground > 2000 ? 100 : 1
  },
  getPinLift: () => {
    // Lift pins above the floor/baseplate. Keep this unit-aware.
    const ground = Number(building?.suggestedGroundSize)
    if (!Number.isFinite(ground) || ground <= 0) return 0.35
    return ground > 2000 ? 35 : 0.35
  },
  questions: [],
})
app.appendChild(pinSystem.ui)

// ── Events ──────────────────────────────────────────────────
floorButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setSelectedFloor(Number(button.dataset.index))
  })
})

setSelectedFloor(selectedFloor)
window.addEventListener('resize', handleResize)
document.addEventListener('visibilitychange', () => {
  if (typeof document !== 'undefined' && !document.hidden) {
    scheduleFrame()
  }
})
const canvas = renderer.domElement
canvas.addEventListener('gesturestart', resetTouchpadNativeGesture, { passive: false })
canvas.addEventListener('gesturechange', handleTouchpadNativeGesture, { passive: false })
canvas.addEventListener('gestureend', resetTouchpadNativeGesture, { passive: false })
canvas.addEventListener('pointerdown', handleTouchPointerDown, { passive: true })
canvas.addEventListener('pointermove', handleTouchPointerMove, { passive: true })
canvas.addEventListener('pointerup', handleTouchPointerEnd, { passive: true })
canvas.addEventListener('pointercancel', handleTouchPointerEnd, { passive: true })
canvas.addEventListener('pointerdown', scheduleFrame, { passive: true })
canvas.addEventListener('wheel', handleTouchpadRotateGesture, { passive: false })
canvas.addEventListener('wheel', scheduleFrame, { passive: true })
canvas.addEventListener('pointermove', scheduleFrame, { passive: true })
controls.addEventListener('change', scheduleFrame)
scheduleFrame()
setupKioskAutoReload()

onLanguageChange((language) => {
  languageSwitcher.setActiveLanguage(language)
  languageSwitcher.setAriaLabel(t('ui.language'))
  // Keep the currently active questionnaire stable.
  // In station mode, reload the station-specific questionnaire instead of overwriting with "default".
  if (stationKey) {
    bootStationMode(stationKey)
  } else {
    loadQuestions(language)
  }
  // Always keep a global question library available for color legend fallback.
  fetchQuestions({ lang: language })
    .then((globalQuestions) => {
      if (Array.isArray(globalQuestions) && globalQuestions.length) {
        pinSystem.setGlobalColorQuestions(globalQuestions)
      }
    })
    .catch(() => {})
  loadAboutContent(language)
})

loadLanguages()

// ── Capture mode ─────────────────────────────────────────────
if (captureMode) {
  bootCaptureMode()
} else if (stationKey) {
  bootStationMode(stationKey)
} else {
  loadQuestions(getLanguage())
  fetchQuestions({ lang: getLanguage() })
    .then((globalQuestions) => {
      if (Array.isArray(globalQuestions) && globalQuestions.length) {
        pinSystem.setGlobalColorQuestions(globalQuestions)
      }
    })
    .catch(() => {})
}
loadAboutContent(getLanguage())

// ── Data loading ────────────────────────────────────────────
async function loadLanguages() {
  try {
    const languages = await fetchLanguages()
    if (languages.length) {
      languageSwitcher.setLanguages(
        languages.map((item) => ({ id: item.lang, label: item.label }))
      )
      if (!languages.some((item) => item.lang === getLanguage())) {
        setLanguage(languages[0].lang)
      }
      return
    }
  } catch {
    // fall back to defaults
  }
  languageSwitcher.setLanguages([
    { id: 'de', label: 'DE' },
    { id: 'en', label: 'EN' },
  ])
}

async function loadQuestions(language) {
  let questions = null

  try {
    questions = await fetchQuestionnaire({ key: 'default', lang: language })
  } catch (err) {
    console.warn('[feelvonRoll] fetchQuestionnaire failed:', err)
  }

  if (!Array.isArray(questions) || !questions.length) {
    try {
      questions = await fetchQuestions({ lang: language })
    } catch (err) {
      console.warn('[feelvonRoll] fetchQuestions fallback failed:', err)
    }
  }

  if (!Array.isArray(questions) || !questions.length) {
    console.warn('[feelvonRoll] No questions from API, using hardcoded fallback')
    questions = getFallbackQuestions()
  }

  pinSystem.setQuestions(questions, 'default')
}

// ── About content ────────────────────────────────────────────
let aboutUpdatedAt = null
let aboutLoaded = false

async function loadAboutContent(language, forceShow = false) {
  try {
    const data = await fetchContent({ key: 'about', lang: language })
    if (!data.body) {
      if (forceShow) aboutOverlay.show()
      return
    }

    aboutUpdatedAt = data.updated_at
    aboutLoaded = true
    const processed = data.body.replace(/\{\{year\}\}/g, String(new Date().getFullYear()))
    const html = marked.parse(processed)
    aboutOverlay.setContent(html)

    if (forceShow) {
      aboutOverlay.show()
      return
    }

    // Auto-show overlay if content is new or updated since last dismiss
    const dismissedAt = localStorage.getItem('about_dismissed_at')
    if (!dismissedAt || (data.updated_at && data.updated_at > dismissedAt)) {
      aboutOverlay.show()
    }
  } catch (error) {
    console.warn('[feelvonRoll] Failed to load about content:', error)
    if (forceShow) aboutOverlay.show()
  }
}

// Store the dismissed timestamp when the overlay is closed
aboutOverlay.closeButton.addEventListener('click', () => {
  if (aboutUpdatedAt) {
    localStorage.setItem('about_dismissed_at', aboutUpdatedAt)
  }
})
aboutOverlay.backdrop.addEventListener('click', (event) => {
  if (event.target === aboutOverlay.backdrop && aboutUpdatedAt) {
    localStorage.setItem('about_dismissed_at', aboutUpdatedAt)
  }
})

// ── Capture mode ─────────────────────────────────────────────
function bootCaptureMode() {
  // Hide pin system UI in capture mode
  pinSystem.ui.style.display = 'none'

  // Small helper to post back to opener/parent
  function postCapture(message) {
    if (window.opener) window.opener.postMessage(message, '*')
    if (window.parent && window.parent !== window) window.parent.postMessage(message, '*')
  }

  // Create capture UI overlay
  const captureUI = document.createElement('div')
  captureUI.id = 'capture-overlay'
  captureUI.innerHTML =
    captureKind === 'pin'
      ? `
    <div class="capture-banner">
      <p><strong>Capture Mode</strong> — Click a point on the floor to select a calibration point, then click “Capture point”.</p>
      <div class="capture-actions">
        <button id="capturePointBtn" class="capture-btn" disabled>Capture point</button>
        <button id="captureCancelBtn" class="capture-btn secondary">Cancel</button>
      </div>
    </div>
  `
      : `
    <div class="capture-banner">
      <p><strong>Capture Mode</strong> — Navigate to the desired position, then click "Capture".</p>
      <div class="capture-actions">
        <button id="captureBtn" class="capture-btn">Capture Position</button>
        <button id="captureCancelBtn" class="capture-btn secondary">Cancel</button>
      </div>
    </div>
  `
  app.appendChild(captureUI)

  if (captureKind !== 'pin') {
    document.getElementById('captureBtn').addEventListener('click', () => {
      const cameraPos = camera.position.clone()
      const targetPos = controls.target.clone()

      postCapture({
        type: 'feelvonroll-capture',
        camera: { x: cameraPos.x, y: cameraPos.y, z: cameraPos.z },
        target: { x: targetPos.x, y: targetPos.y, z: targetPos.z },
        floor_index: selectedFloor,
      })
    })
  } else {
    // Capture a clicked point on the active floor plane.
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    renderer.domElement.style.cursor = 'crosshair'

    // Visible marker so it's obvious what will be captured
    const ground = Number(building?.suggestedGroundSize)
    const unitScale = Number.isFinite(ground) && ground > 2000 ? 100 : 1
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 * unitScale, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xff2d55 })
    )
    marker.renderOrder = 1000
    if ('depthTest' in marker.material) marker.material.depthTest = false
    marker.visible = false
    scene.add(marker)

    let selectedPoint = null
    const capturePointBtn = document.getElementById('capturePointBtn')
    capturePointBtn.addEventListener('click', () => {
      if (!selectedPoint) return
      postCapture({
        type: 'feelvonroll-capture',
        // For LV95 calibration we use "target" as the picked point.
        target: { x: selectedPoint.x, y: selectedPoint.y, z: selectedPoint.z },
        floor_index: selectedFloor,
      })
      window.close()
    })

    renderer.domElement.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)

      const planeY = building.getFloorSlabTopY(selectedFloor)
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY)
      const point = new THREE.Vector3()
      if (!raycaster.ray.intersectPlane(plane, point)) return

      selectedPoint = point.clone()
      marker.position.copy(selectedPoint)
      marker.visible = true
      capturePointBtn.disabled = false
    })
  }

  document.getElementById('captureCancelBtn').addEventListener('click', () => {
    window.close()
  })
}

// ── Station mode ─────────────────────────────────────────────
async function bootStationMode(key) {
  // Set the station key on the pin form so it's included in submissions
  pinSystem.setStationKey(key)

  const lang = getLanguage()

  // Load the full question library for pin color config (runs in parallel)
  const globalQuestionsPromise = fetchQuestions({ lang }).catch(() => [])

  try {
    const station = await fetchStation(key)
    // Position camera at station immediately (no animation)
    if (station.camera && station.target) {
      const targetFloor = station.floor_index ?? 0
      setSelectedFloor(targetFloor)

      // Set camera and target directly, keeping Y consistent with floor system
      const camOffsetY = station.camera.y - station.target.y
      controls.target.set(station.target.x, currentTargetY, station.target.z)
      camera.position.set(station.camera.x, currentTargetY + camOffsetY, station.camera.z)
      controls.update()
      scheduleFrame()

      // Station mode "home": title click returns to the station view.
      homeView.floorIndex = targetFloor
      homeView.target.copy(controls.target)
      homeView.camera.copy(camera.position)
    }

    // Store global color questions before setting station-specific ones
    const globalQuestions = await globalQuestionsPromise
    if (Array.isArray(globalQuestions) && globalQuestions.length) {
      pinSystem.setGlobalColorQuestions(globalQuestions)
    }

    // Load station-specific questionnaire
    const questionnaireKey = station.questionnaire_key || 'default'
    try {
      const questions = await fetchQuestionnaire({ key: questionnaireKey, lang })
      if (Array.isArray(questions)) {
        pinSystem.setQuestions(questions, questionnaireKey)
        return
      }
    } catch (err) {
      console.warn('[feelvonRoll] Station questionnaire failed:', err)
    }
  } catch (error) {
    console.warn('[feelvonRoll] Failed to load station:', error)
  }

  // Fallback: load default questions
  loadQuestions(lang)
}

// ── Floor visibility ────────────────────────────────────────
function setGroupOpacity(group, opacity) {
  const isGhost = opacity < 0.999
  // Ensure consistent drawing order for blended floors.
  // - active floor: renderOrder 1
  // - ghost floors: renderOrder 2
  group.renderOrder = isGhost ? 2 : 1
  group.traverse((child) => {
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        material.transparent = isGhost
        material.opacity = opacity
        if ('depthWrite' in material) material.depthWrite = !isGhost
        // Keep depth testing enabled so ghosts don't "snap" to the top.
        if ('depthTest' in material) material.depthTest = true

        if ('polygonOffset' in material) {
          material.polygonOffset = isGhost
          material.polygonOffsetFactor = isGhost ? 1 : 0
          material.polygonOffsetUnits = isGhost ? 1 : 0
        }
        material.needsUpdate = true
      })
    }
    if (child.isMesh) {
      child.renderOrder = isGhost ? 2 : 1
    }
  })
}

function updateFloorVisibility() {
  building.floorGroups.forEach((group) => {
    const floorIndex = group.userData.floorIndex
    // Rule:
    // - Floors above the selected floor are hidden.
    // - If the selected floor is above ground (> 0), basements (< 0) must not be visible.
    // - Otherwise: floors below the selected floor remain visible as "ghosts" (semi-transparent).
    if (floorIndex > selectedFloor) {
      group.visible = false
      return
    }
    if (selectedFloor >= 0 && floorIndex < 0) {
      group.visible = false
      return
    }
    group.visible = true
    if (floorIndex === selectedFloor) {
      building.setFloorWallMode(group, true)
      setGroupOpacity(group, 1)
    } else {
      building.setFloorWallMode(group, false)
      // Ghost floors: visible hint under the active floor.
      setGroupOpacity(group, 0.22)
    }
  })

  floorButtons.forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.index) === selectedFloor)
  })

  ground.visible = selectedFloor >= 0
  pinSystem.setActiveFloor(selectedFloor)

  if (debugFloorVisibility) {
    const snapshot = building.floorGroups
      .map((g) => {
        const floorIndex = g.userData.floorIndex
        const visible = g.visible
        let materialSample = null
        let markerScreen = null
        g.traverse((child) => {
          if (materialSample) return
          if (!child?.isMesh || !child.material) return
          const m = Array.isArray(child.material) ? child.material[0] : child.material
          if (!m) return
          materialSample = {
            transparent: m.transparent,
            opacity: m.opacity,
            depthWrite: m.depthWrite,
            depthTest: m.depthTest,
          }
        })

        // Project the per-floor debug marker (if present) to see whether
        // stacked floors are actually separated on screen.
        g.traverse((child) => {
          if (markerScreen) return
          if (!child?.isMesh) return
          if (child.name !== `floorMarker_${floorIndex}`) return
          const v = new THREE.Vector3()
          child.getWorldPosition(v)
          const ndc = v.clone().project(camera)
          markerScreen = { worldY: v.y, ndcY: ndc.y }
        })
        return { floorIndex, visible, materialSample, groupY: g.position.y, markerScreen }
      })
      .sort((a, b) => Number(a.floorIndex) - Number(b.floorIndex))
    console.log('[floorVisibility]', JSON.stringify({ selectedFloor, snapshot }))
  }
  scheduleFrame()
}

function setSelectedFloor(nextIndex) {
  selectedFloor = nextIndex
  // For glTF prototypes we keep the camera target Y stable across floor
  // switches. Otherwise the camera follows the active floor and the ghost
  // layer can end up visually coincident, making floors 0 and 1 look
  // identical.
  if (building?.source !== 'gltf') {
    currentTargetY = building.getTargetYForFloor(selectedFloor)
  }
  updateFloorVisibility()
}

// ── Render loop ─────────────────────────────────────────────
function handleResize() {
  const w = app.clientWidth
  const h = app.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  renderer.setPixelRatio(getPreferredPixelRatio())
  scheduleFrame()
}

function clampPanToNavigationBounds() {
  const box = building?.navigationBounds
  if (!box || box.isEmpty()) return

  const size = new THREE.Vector3()
  box.getSize(size)
  const pad = ORBIT_NAVIGATION.panPaddingFactor * Math.max(size.x, size.z, 1)

  const t = controls.target
  const before = t.clone()
  t.x = THREE.MathUtils.clamp(t.x, box.min.x - pad, box.max.x + pad)
  t.z = THREE.MathUtils.clamp(t.z, box.min.z - pad, box.max.z + pad)
  const dx = t.x - before.x
  const dz = t.z - before.z
  if (Math.abs(dx) > 1e-9 || Math.abs(dz) > 1e-9) {
    camera.position.x += dx
    camera.position.z += dz
  }
}

