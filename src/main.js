/**
 * Application entry point.
 * Wires together scene, building, pin system, and UI.
 */
import './style.css'
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
const stationKey = urlParams.get('station')


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
const building = createBuildingProvider(scene, 'procedural')

// ── Floor selector ──────────────────────────────────────────
let selectedFloor = 0
let currentTargetY = building.getTargetYForFloor(selectedFloor)

const { floorButtons, ui: floorSelectorUi } = createFloorSelector(
  building.maxBasements,
  building.maxAboveGroundFloors
)
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

  // Create capture UI overlay
  const captureUI = document.createElement('div')
  captureUI.id = 'capture-overlay'
  captureUI.innerHTML = `
    <div class="capture-banner">
      <p><strong>Capture Mode</strong> — Navigate to the desired position, then click "Capture".</p>
      <div class="capture-actions">
        <button id="captureBtn" class="capture-btn">Capture Position</button>
        <button id="captureCancelBtn" class="capture-btn secondary">Cancel</button>
      </div>
    </div>
  `
  app.appendChild(captureUI)

  document.getElementById('captureBtn').addEventListener('click', () => {
    const cameraPos = camera.position.clone()
    const targetPos = controls.target.clone()

    const message = {
      type: 'feelvonroll-capture',
      camera: { x: cameraPos.x, y: cameraPos.y, z: cameraPos.z },
      target: { x: targetPos.x, y: targetPos.y, z: targetPos.z },
      floor_index: selectedFloor,
    }

    if (window.opener) {
      window.opener.postMessage(message, '*')
    }
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(message, '*')
    }
  })

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
  group.traverse((child) => {
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        material.transparent = true
        material.opacity = opacity
      })
    }
  })
}

function updateFloorVisibility() {
  building.floorGroups.forEach((group) => {
    const floorIndex = group.userData.floorIndex
    if (floorIndex > selectedFloor) {
      group.visible = false
      return
    }
    group.visible = true
    if (floorIndex === selectedFloor) {
      building.setFloorWallMode(group, true)
      setGroupOpacity(group, 1)
    } else {
      building.setFloorWallMode(group, false)
      setGroupOpacity(group, 0.35)
    }
  })

  floorButtons.forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.index) === selectedFloor)
  })

  ground.visible = selectedFloor >= 0
  pinSystem.setActiveFloor(selectedFloor)
}

function setSelectedFloor(nextIndex) {
  selectedFloor = nextIndex
  currentTargetY = building.getTargetYForFloor(selectedFloor)
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

  controls.update()

  // Floor-level Y-forcing: keep camera and target locked to the active floor
  const deltaY = currentTargetY - controls.target.y
  if (Math.abs(deltaY) > 1e-6) {
    controls.target.y += deltaY
    camera.position.y += deltaY
  }

  pinSystem.update()
  renderer.render(scene, camera)
}
