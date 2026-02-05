import './style.css'
import * as THREE from 'three'
import { BUILDINGS, FLOOR } from './config'
import {
  addLights,
  createCamera,
  createControls,
  createGround,
  createRenderer,
  createScene,
} from './scene'
import { createFloorGroup, setFloorWallMode } from './floors'
import { createFloorSelector, createLanguageSwitcher } from './ui'
import { createPinSystem } from './pins'
import { fetchLanguages, fetchQuestions } from './api'
import { getFallbackQuestions } from './questionnaire'
import { getLanguage, onLanguageChange, setLanguage, t } from './i18n'

const app = document.querySelector('#app')

setLanguage(getLanguage())

const renderer = createRenderer(app)
const scene = createScene()
const camera = createCamera()
const controls = createControls(camera, renderer.domElement)
const ground = createGround()
scene.add(ground)
addLights(scene)

const floorGroups = []
const maxAboveGroundFloors = Math.max(...BUILDINGS.map((building) => building.floors))
const maxBasements = Math.max(...BUILDINGS.map((building) => building.basements))

BUILDINGS.forEach((building, buildingIndex) => {
  const buildingGroup = new THREE.Group()
  buildingGroup.position.copy(building.offset)
  buildingGroup.userData.buildingIndex = buildingIndex

  for (let floorIndex = -building.basements; floorIndex < building.floors; floorIndex += 1) {
    const floorGroup = createFloorGroup(floorIndex)
    floorGroup.userData.buildingIndex = buildingIndex
    floorGroups.push(floorGroup)
    buildingGroup.add(floorGroup)
  }

  scene.add(buildingGroup)
})

let selectedFloor = 0
let currentTargetY = getTargetYForFloor(selectedFloor)

const { floorButtons, ui } = createFloorSelector(maxBasements, maxAboveGroundFloors)
app.appendChild(ui)
const languageSwitcher = createLanguageSwitcher({
  languages: [],
  activeLanguage: getLanguage(),
  ariaLabel: t('ui.language'),
  onChange: (language) => setLanguage(language),
})
app.appendChild(languageSwitcher.ui)
const pinSystem = createPinSystem({
  scene,
  camera,
  domElement: renderer.domElement,
  controls,
  getSelectedFloor: () => selectedFloor,
  questions: [],
})
app.appendChild(pinSystem.ui)

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

async function loadLanguages() {
  try {
    const languages = await fetchLanguages()
    if (languages.length) {
      languageSwitcher.setLanguages(languages.map((item) => ({ id: item.lang, label: item.label })))
      if (!languages.some((item) => item.lang === getLanguage())) {
        setLanguage(languages[0].lang)
      }
      return
    }
  } catch (error) {
    // ignore and fall back to defaults
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
  } catch (error) {
    // ignore and fall back to defaults
  }
  pinSystem.setQuestions(getFallbackQuestions())
}

function getTargetYForFloor(floorIndex) {
  return (
    floorIndex * (FLOOR.height + FLOOR.slabThickness) +
    FLOOR.slabThickness +
    FLOOR.wallHeight * 0.55
  )
}

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
  floorGroups.forEach((group) => {
    const floorIndex = group.userData.floorIndex
    if (floorIndex > selectedFloor) {
      group.visible = false
      return
    }

    group.visible = true
    if (floorIndex === selectedFloor) {
      setFloorWallMode(group, true)
      setGroupOpacity(group, 1)
    } else {
      setFloorWallMode(group, false)
      setGroupOpacity(group, 0.35)
    }
  })

  floorButtons.forEach((button) => {
    const buttonFloorIndex = Number(button.dataset.index)
    button.classList.toggle('active', buttonFloorIndex === selectedFloor)
  })

  ground.visible = selectedFloor >= 0
  pinSystem.setActiveFloor(selectedFloor)
}

function setSelectedFloor(nextIndex) {
  selectedFloor = nextIndex
  currentTargetY = getTargetYForFloor(selectedFloor)
  updateFloorVisibility()
}

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
