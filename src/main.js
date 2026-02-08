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
import { createPinSystem } from './pins'
import { fetchLanguages, fetchQuestions } from './api'
import { getFallbackQuestions } from './questionnaire'
import { getLanguage, onLanguageChange, setLanguage, t } from './i18n'

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

// ── Language switcher ───────────────────────────────────────
const languageSwitcher = createLanguageSwitcher({
  languages: [],
  activeLanguage: getLanguage(),
  ariaLabel: t('ui.language'),
  onChange: (language) => setLanguage(language),
})
app.appendChild(languageSwitcher.ui)

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
  button.addEventListener('click', () => setSelectedFloor(Number(button.dataset.index)))
})

setSelectedFloor(selectedFloor)
window.addEventListener('resize', handleResize)
animate()

onLanguageChange((language) => {
  languageSwitcher.setActiveLanguage(language)
  languageSwitcher.setAriaLabel(t('ui.language'))
  loadQuestions(language)
})

loadLanguages()
loadQuestions(getLanguage())

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
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
}

function animate() {
  requestAnimationFrame(animate)
  controls.update()
  pinSystem.update()
  const deltaY = currentTargetY - controls.target.y
  if (Math.abs(deltaY) > 1e-6) {
    controls.target.y += deltaY
    camera.position.y += deltaY
  }
  renderer.render(scene, camera)
}
