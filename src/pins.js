import * as THREE from 'three'
import { createPin, fetchPins } from './api'
import { getFloorSlabTopY } from './floors'

const REASONS = [
  { key: 'licht', label: 'Licht' },
  { key: 'ruhe', label: 'Ruhe' },
  { key: 'laerm', label: 'Lärm' },
  { key: 'aussicht', label: 'Aussicht' },
  { key: 'sicherheit', label: 'Sicherheit' },
  { key: 'sauberkeit', label: 'Sauberkeit' },
  { key: 'layout', label: 'Layout' },
  { key: 'temperatur', label: 'Temperatur' },
]

export function createPinSystem({ scene, camera, domElement, controls, getSelectedFloor }) {
  const state = {
    pins: [],
    localPins: [],
    pinMode: false,
    activeFloor: getSelectedFloor(),
    pendingMesh: null,
  }

  const pinGroup = new THREE.Group()
  scene.add(pinGroup)

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  const ui = createPinUi()
  const { panel, toggleButton, backdrop, form, closeButton, submitButton } = ui

  toggleButton.addEventListener('click', () => {
    state.pinMode = !state.pinMode
    toggleButton.classList.toggle('active', state.pinMode)
    toggleButton.textContent = state.pinMode ? 'Pin platzieren' : '+ Pin'
    controls.enabled = !state.pinMode
    document.body.classList.toggle('pin-mode', state.pinMode)
  })

  domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    if (event.target.closest('.ui')) return

    const rect = domElement.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)

    if (!state.pinMode) {
      const hits = raycaster.intersectObjects(pinGroup.children, true)
      if (hits.length) {
        const pin = hits[0].object.userData.pinData
        if (pin) {
          openForm({ pin })
        }
      }
      return
    }

    const floorIndex = getSelectedFloor()
    const planeY = getFloorSlabTopY(floorIndex)

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY)
    const point = new THREE.Vector3()
    if (!raycaster.ray.intersectPlane(plane, point)) return

    placePendingPin({ floorIndex, position: point })
    openForm({ floorIndex, position: point })
  })

  closeButton.addEventListener('click', closeForm)
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeForm()
  })

  submitButton.addEventListener('click', async (event) => {
    event.preventDefault()
    const payload = collectFormData()
    if (!payload) return

    try {
      const saved = await createPin(payload)
      finalizePendingPin(saved)
      await loadPins()
      closeForm()
      state.pinMode = false
      toggleButton.classList.remove('active')
      controls.enabled = true
      document.body.classList.remove('pin-mode')
    } catch (error) {
      showFormError('Speichern fehlgeschlagen')
    }
  })

  loadPins()

  return {
    ui: panel,
    setActiveFloor: (floorIndex) => {
      state.activeFloor = floorIndex
      updatePinVisibility()
    },
  }

  async function loadPins() {
    try {
      state.pins = await fetchPins()
      state.localPins = state.localPins.filter(
        (pin) => !state.pins.some((approvedPin) => approvedPin.id === pin.id)
      )
      renderPins()
    } catch (error) {
      // keep existing pins
    }
  }

  function renderPins() {
    pinGroup.clear()
    const allPins = [...state.pins, ...state.localPins]
    allPins.forEach((pin) => {
      const mesh = createPinMesh(pin.approved === 0)
      mesh.position.set(pin.position_x, pin.position_y + 0.2, pin.position_z)
      mesh.userData.floorIndex = pin.floor_index
      mesh.userData.pinId = pin.id
      mesh.userData.pinData = pin
      pinGroup.add(mesh)
    })
    updatePinVisibility()
  }

  function updatePinVisibility() {
    pinGroup.children.forEach((mesh) => {
      const floorIndex = mesh.userData.floorIndex
      mesh.visible = floorIndex <= state.activeFloor
    })
  }

  function createPinMesh(isPending = false) {
    const geometry = new THREE.ConeGeometry(0.18, 0.5, 12)
    const material = new THREE.MeshStandardMaterial({ color: isPending ? 0xfbbf24 : 0xf97316 })
    return new THREE.Mesh(geometry, material)
  }

  function openForm({ floorIndex, position, pin }) {
    form.reset()
    clearFormError()
    form.dataset.mode = pin ? 'view' : 'create'

    const fields = form.elements
    if (pin) {
      closeButton.textContent = 'Schliessen'
      fields.wellbeing.value = pin.wellbeing
      fields.note.value = pin.note || ''
      const reasons = safeParseReasons(pin.reasons)
      Array.from(fields.reasons).forEach((checkbox) => {
        checkbox.checked = reasons.includes(checkbox.value)
      })
      fields.wellbeing.disabled = true
      fields.note.disabled = true
      Array.from(fields.reasons).forEach((checkbox) => {
        checkbox.disabled = true
      })
      submitButton.disabled = true
      submitButton.classList.add('is-hidden')
    } else {
      closeButton.textContent = 'Abbrechen'
      fields.wellbeing.disabled = false
      fields.note.disabled = false
      Array.from(fields.reasons).forEach((checkbox) => {
        checkbox.disabled = false
        checkbox.checked = false
      })
      submitButton.disabled = false
      submitButton.classList.remove('is-hidden')
      form.dataset.floorIndex = floorIndex
      form.dataset.x = position.x
      form.dataset.y = position.y
      form.dataset.z = position.z
    }

    backdrop.classList.add('is-visible')
  }

  function closeForm() {
    backdrop.classList.remove('is-visible')
    form.dataset.floorIndex = ''
    form.dataset.x = ''
    form.dataset.y = ''
    form.dataset.z = ''
    if (form.dataset.mode === 'create') {
      removePendingPin()
    }
  }

  function collectFormData() {
    const floorIndex = Number(form.dataset.floorIndex)
    const x = Number(form.dataset.x)
    const y = Number(form.dataset.y)
    const z = Number(form.dataset.z)
    const wellbeing = Number(form.elements.wellbeing.value)
    const note = form.elements.note.value.trim()
    const reasons = Array.from(form.elements.reasons)
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value)

    if (Number.isNaN(floorIndex) || Number.isNaN(x)) {
      showFormError('Kein Standort gewählt')
      return null
    }

    return {
      floor_index: floorIndex,
      x,
      y,
      z,
      wellbeing,
      reasons,
      note,
    }
  }

  function safeParseReasons(value) {
    if (!value) return []
    try {
      return Array.isArray(value) ? value : JSON.parse(value)
    } catch (error) {
      return []
    }
  }

  function showFormError(message) {
    const error = form.querySelector('.ui-form-error')
    if (error) {
      error.textContent = message
    }
  }

  function clearFormError() {
    const error = form.querySelector('.ui-form-error')
    if (error) {
      error.textContent = ''
    }
  }

  function placePendingPin({ floorIndex, position }) {
    removePendingPin()
    const mesh = createPinMesh(true)
    mesh.position.set(position.x, position.y + 0.2, position.z)
    mesh.userData.floorIndex = floorIndex
    mesh.userData.pinData = {
      id: `local-${Date.now()}`,
      floor_index: floorIndex,
      position_x: position.x,
      position_y: position.y,
      position_z: position.z,
      wellbeing: 0,
      reasons: [],
      note: '',
      approved: 0,
    }
    pinGroup.add(mesh)
    state.pendingMesh = mesh
  }

  function removePendingPin() {
    if (!state.pendingMesh) return
    pinGroup.remove(state.pendingMesh)
    state.pendingMesh = null
  }

  function finalizePendingPin(savedPin) {
    removePendingPin()
    if (savedPin && savedPin.approved === 0) {
      state.localPins.unshift(savedPin)
    }
    renderPins()
  }
}

function createPinUi() {
  const panel = document.createElement('div')
  panel.className = 'ui ui-pin-panel'

  const toggleButton = document.createElement('button')
  toggleButton.type = 'button'
  toggleButton.className = 'ui-pin-toggle'
  toggleButton.textContent = '+ Pin'
  panel.appendChild(toggleButton)

  const backdrop = document.createElement('div')
  backdrop.className = 'ui-modal-backdrop'

  const modal = document.createElement('div')
  modal.className = 'ui-modal'
  backdrop.appendChild(modal)

  const header = document.createElement('div')
  header.className = 'ui-modal-header'
  header.textContent = 'Wohlbefinden'
  modal.appendChild(header)

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'ui-modal-close'
  closeButton.textContent = 'Schliessen'
  modal.appendChild(closeButton)

  const form = document.createElement('form')
  form.className = 'ui-form'
  modal.appendChild(form)

  const wellbeingLabel = document.createElement('label')
  wellbeingLabel.textContent = 'Wie fühlst du dich hier?'
  form.appendChild(wellbeingLabel)

  const wellbeingInput = document.createElement('input')
  wellbeingInput.type = 'range'
  wellbeingInput.name = 'wellbeing'
  wellbeingInput.min = '1'
  wellbeingInput.max = '10'
  wellbeingInput.value = '6'
  form.appendChild(wellbeingInput)

  const reasonsLabel = document.createElement('div')
  reasonsLabel.textContent = 'Gründe'
  reasonsLabel.className = 'ui-form-section'
  form.appendChild(reasonsLabel)

  const reasonsWrap = document.createElement('div')
  reasonsWrap.className = 'ui-form-reasons'
  form.appendChild(reasonsWrap)

  REASONS.forEach((reason) => {
    const label = document.createElement('label')
    label.className = 'ui-checkbox'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.name = 'reasons'
    input.value = reason.key
    const text = document.createElement('span')
    text.textContent = reason.label
    label.appendChild(input)
    label.appendChild(text)
    reasonsWrap.appendChild(label)
  })

  const noteLabel = document.createElement('label')
  noteLabel.textContent = 'Anmerkung'
  form.appendChild(noteLabel)

  const noteInput = document.createElement('textarea')
  noteInput.name = 'note'
  noteInput.rows = 3
  form.appendChild(noteInput)

  const error = document.createElement('div')
  error.className = 'ui-form-error'
  form.appendChild(error)

  const submitButton = document.createElement('button')
  submitButton.type = 'submit'
  submitButton.className = 'ui-form-submit'
  submitButton.textContent = 'Speichern'
  form.appendChild(submitButton)

  document.body.appendChild(backdrop)

  return { panel, toggleButton, backdrop, form, closeButton, submitButton }
}
