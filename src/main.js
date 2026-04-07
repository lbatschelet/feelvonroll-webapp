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
} from './scene'
import { createBuildingProvider } from './building/buildingProvider'
import { createFloorSelector } from './ui/floorSelector'
import { createLanguageSwitcher } from './ui/languageSwitcher'
import { createAboutOverlay } from './ui/aboutOverlay'
import { createTitleBar } from './ui/titleBar'
import { createPinSystem } from './pins'
import { fetchLanguages, fetchQuestions, fetchContent, fetchStation, fetchQuestionnaire } from './api'
import { getFallbackQuestions } from './questionnaire'
import { getLanguage, onLanguageChange, setLanguage, t } from './i18n'
import { marked } from 'marked'

// ── URL parameters ──────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search)
const captureMode = urlParams.get('mode') === 'capture'
const captureKind = urlParams.get('capture') || 'camera'
const stationKey = urlParams.get('station')
const debugFloors = urlParams.get('debugFloors') === '1'
const debugFloorVisibility = urlParams.get('debugFloorVisibility') === '1'


// ── Scene setup ─────────────────────────────────────────────
const app = document.querySelector('#app')
setLanguage(getLanguage())

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

// If the loaded model is huge (e.g. meter-calibrated Sweet Home exports),
// expand camera range so the geometry isn't clipped.
if (building?.suggestedCameraDistance) {
  controls.maxDistance = building.suggestedCameraDistance
  if (typeof building.suggestedCameraFar === 'number') {
    camera.far = building.suggestedCameraFar
  } else {
    camera.far = building.suggestedCameraDistance * 6
  }
  camera.updateProjectionMatrix()
}

// Keep the ground visible for large models (provides an interaction
// reference / background). It's already slightly offset below Y=0 in
// scene.js to reduce z-fighting.

// Adjust zoom bounds for huge imported models:
// - keep the default "from the other corner" view
// - but allow zooming closer than the procedural defaults
if (building?.suggestedCameraDistance) {
  controls.minDistance = Math.min(controls.minDistance, Math.max(0.5, building.suggestedCameraDistance * 0.05))
  controls.maxDistance = Math.max(controls.maxDistance, building.suggestedCameraDistance * 6)

  // Keep clipping planes wide enough so parts don't disappear while zooming.
  camera.near = 0.01
  camera.far = typeof building.suggestedCameraFar === 'number' ? building.suggestedCameraFar : building.suggestedCameraDistance * 10
  camera.updateProjectionMatrix()

  // If we're currently zoomed in too much on load (trackpad gestures
  // / initial model alignment), only ever push the camera further away
  // to the suggested distance. This avoids "jumping out" during normal use.
  const target = controls.target.clone()
  const dir = camera.position.clone().sub(target)
  const currentDist = dir.length()
  if (currentDist > 1e-6) {
    const nextDist = Math.max(currentDist, building.suggestedCameraDistance)
    dir.normalize()
    camera.position.copy(target.add(dir.multiplyScalar(nextDist)))
    controls.update()
  }

  controls.update()
}

// Resize the ground plane to cover the full imported model bounds,
// so you don't see an edge "cut-off" while moving/zooming.
if (building?.source === 'gltf' && typeof building?.suggestedGroundSize === 'number') {
  ground.scale.set(building.suggestedGroundSize, building.suggestedGroundSize, 1)
  // Move it away from the model to avoid z-fighting / overlap artifacts.
  ground.position.y = -10
  // Make the ground faint (still provides reference for "keep distance").
  ground.material.transparent = true
  ground.material.opacity = 0.25
  ground.material.depthWrite = false
}

// Optional rotate buttons (helps when trackpad gesture mapping is unclear).
// Uses OrbitControls' internal rotate delta.
const rotateOverlay = document.createElement('div')
rotateOverlay.className = 'ui-view-controls'
rotateOverlay.innerHTML = `
  <div class="ui-view-controls-inner">
    <button type="button" class="ui-view-controls-btn" data-rot="-1" title="Rotate left"><span class="ui-view-controls-icon">↺</span></button>
    <button type="button" class="ui-view-controls-btn" data-rot="1" title="Rotate right"><span class="ui-view-controls-icon">↻</span></button>
  </div>
`

const rotButtons = rotateOverlay.querySelectorAll('button[data-rot]')
rotButtons.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    const dir = Number(btn.dataset.rot || 0)
    if (dir === 0) return
    if (typeof controls._rotateLeft === 'function') {
      controls._rotateLeft(dir * Math.PI / 18)
      controls.update()
    }
  })
})

// ── Floor selector ──────────────────────────────────────────
let selectedFloor = 0
let currentTargetY = (building?.source === 'gltf')
  ? controls.target.y
  : building.getTargetYForFloor(selectedFloor)

// OrbitControls pan in perspective mode scales with camera-target distance.
// We counter-balance that so panning feels more consistent across zoom levels.
const PAN_REFERENCE_DISTANCE = Math.max(1, camera.position.distanceTo(controls.target))
const PAN_REFERENCE_SPEED = controls.panSpeed
const PAN_SPEED_MIN = 0.25
const PAN_SPEED_MAX = 4.0

const { floorButtons, ui: floorSelectorUi } = createFloorSelector(
  building.maxBasements,
  building.maxAboveGroundFloors
)
floorSelectorUi.prepend(rotateOverlay)
app.appendChild(floorSelectorUi)

// ── Title bar ────────────────────────────────────────────────
const titleBar = createTitleBar()
app.appendChild(titleBar.ui)

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

// ── Pin system ──────────────────────────────────────────────
const pinSystem = createPinSystem({
  scene,
  camera,
  domElement: renderer.domElement,
  controls,
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
animate()

onLanguageChange((language) => {
  languageSwitcher.setActiveLanguage(language)
  languageSwitcher.setAriaLabel(t('ui.language'))
  loadQuestions(language)
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
  try {
    const questions = await fetchQuestions({ lang: language })
    if (Array.isArray(questions) && questions.length) {
      pinSystem.setQuestions(questions)
      return
    }
  } catch {
    // fall back to defaults
  }
  pinSystem.setQuestions(getFallbackQuestions())
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
      if (Array.isArray(questions) && questions.length) {
        pinSystem.setQuestions(questions)
        return
      }
    } catch {
      // Fall through to default questionnaire
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
      setGroupOpacity(group, 0.35)
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
}

function animate() {
  requestAnimationFrame(animate)

  // Adaptive pan speed: zoom-in shouldn't feel "stuck", zoom-out shouldn't jump.
  const camDistance = Math.max(0.001, camera.position.distanceTo(controls.target))
  const adaptivePanSpeed = PAN_REFERENCE_SPEED * (PAN_REFERENCE_DISTANCE / camDistance)
  controls.panSpeed = Math.min(PAN_SPEED_MAX, Math.max(PAN_SPEED_MIN, adaptivePanSpeed))

  controls.update()

  // Floor-level Y-forcing: keep camera and target locked to the active floor
  if (building?.source !== 'gltf') {
    const deltaY = currentTargetY - controls.target.y
    if (Math.abs(deltaY) > 1e-6) {
      controls.target.y += deltaY
      camera.position.y += deltaY
    }
  }

  pinSystem.update()
  renderer.render(scene, camera)
}
