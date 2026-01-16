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
    colorMode: 'wellbeing',
  }

  const pinGroup = new THREE.Group()
  scene.add(pinGroup)

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  const ui = createPinUi()
  const {
    panel,
    toggleButton,
    backdrop,
    form,
    closeButton,
    submitButton,
    colorModeButtons,
    legend,
    previewDot,
    viewPanel,
    viewWellbeing,
    viewReasons,
    viewNote,
    viewStatus,
    formGroups,
  } = ui

  toggleButton.addEventListener('click', () => {
    state.pinMode = !state.pinMode
    toggleButton.classList.toggle('active', state.pinMode)
    toggleButton.textContent = state.pinMode ? 'Pin platzieren' : '+ Pin'
    controls.enabled = !state.pinMode
    document.body.classList.toggle('pin-mode', state.pinMode)
  })

  colorModeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.colorMode = button.dataset.mode
      colorModeButtons.forEach((item) =>
        item.classList.toggle('active', item.dataset.mode === state.colorMode)
      )
      updateLegend()
      refreshPinColors()
      updatePreviewColor()
    })
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

  form.addEventListener('input', () => {
    updatePreviewColor()
    refreshPendingPinColor()
  })

  loadPins()
  updateLegend()
  updatePreviewColor()

  return {
    ui: panel,
    setActiveFloor: (floorIndex) => {
      state.activeFloor = floorIndex
      renderPins()
    },
    update: () => {
      renderPins()
    },
  }

  async function loadPins() {
    try {
      const rawPins = await fetchPins()
      state.pins = rawPins.map(normalizePin)
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
    const allPins = [...state.pins, ...state.localPins].filter(
      (pin) => pin.floor_index === state.activeFloor
    )
    const clusters = buildClusters(allPins)
    clusters.forEach((cluster) => {
      if (cluster.pins.length === 1) {
        const pin = cluster.pins[0]
        const mesh = createPinMesh(pin)
        mesh.position.set(pin.position_x, pin.position_y + 0.2, pin.position_z)
        mesh.userData.floorIndex = pin.floor_index
        mesh.userData.pinId = pin.id
        mesh.userData.pinData = pin
        pinGroup.add(mesh)
      } else {
        const mesh = createClusterMesh(cluster)
        mesh.position.copy(cluster.worldPosition)
        mesh.userData.floorIndex = state.activeFloor
        pinGroup.add(mesh)
      }
    })
    updatePinVisibility()
  }

  function updatePinVisibility() {
    pinGroup.children.forEach((mesh) => {
      const floorIndex = mesh.userData.floorIndex
      mesh.visible = floorIndex === state.activeFloor
    })
  }

  function createPinMesh(pin) {
    const group = new THREE.Group()
    const headColor = getPinColor(pin)

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.026, 0.55, 10),
      new THREE.MeshStandardMaterial({ color: 0x4b5563 })
    )
    stem.position.y = 0.25

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 12),
      new THREE.MeshStandardMaterial({ color: headColor })
    )
    head.position.y = 0.52

    group.add(stem, head)
    group.userData.pinData = pin
    stem.userData.pinData = pin
    head.userData.pinData = pin
    group.userData.head = head
    return group
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
      formGroups.forEach((group) => group.classList.add('is-hidden'))
      viewPanel.classList.remove('is-hidden')
      viewWellbeing.textContent = `${pin.wellbeing}/10`
      viewReasons.textContent = reasons.length ? reasons.join(', ') : '—'
      viewNote.textContent = pin.note?.trim() ? pin.note : '—'
      viewStatus.textContent = getStatusLabel(pin.approved)
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
      formGroups.forEach((group) => group.classList.remove('is-hidden'))
      viewPanel.classList.add('is-hidden')
      form.dataset.floorIndex = floorIndex
      form.dataset.x = position.x
      form.dataset.y = position.y
      form.dataset.z = position.z
    }

    updatePreviewColor()
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
    const draft = {
      id: `local-${Date.now()}`,
      floor_index: floorIndex,
      position_x: position.x,
      position_y: position.y,
      position_z: position.z,
      wellbeing: Number(form?.elements?.wellbeing?.value || 6),
      reasons: [],
      note: '',
      approved: 0,
    }
    const mesh = createPinMesh(draft)
    mesh.position.set(position.x, position.y + 0.2, position.z)
    mesh.userData.floorIndex = floorIndex
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
    if (savedPin) {
      const normalized = normalizePin(savedPin)
      if (normalized.approved === 0) {
        state.localPins.unshift(normalized)
      }
    }
    renderPins()
  }

  function normalizePin(pin) {
    return {
      ...pin,
      id: Number(pin.id),
      floor_index: Number(pin.floor_index),
      position_x: Number(pin.position_x),
      position_y: Number(pin.position_y),
      position_z: Number(pin.position_z),
      wellbeing: Number(pin.wellbeing),
      approved: Number(pin.approved),
      reasons: Array.isArray(pin.reasons) ? pin.reasons : safeParseReasons(pin.reasons),
    }
  }

  function refreshPinColors() {
    pinGroup.children.forEach((mesh) => {
      const pin = mesh.userData.pinData
      const head = mesh.userData.head
      if (pin && head) {
        head.material.color.set(getPinColor(pin))
      }
    })
  }

  function refreshPendingPinColor() {
    if (!state.pendingMesh) return
    const head = state.pendingMesh.userData.head
    if (!head) return
    head.material.color.set(getColorFromForm())
  }

  function getPinColor(pin) {
    if (state.colorMode === 'reasons') {
      const reasons = Array.isArray(pin.reasons) ? pin.reasons : safeParseReasons(pin.reasons)
      return getReasonColor(reasons)
    }
    return getWellbeingColor(pin.wellbeing)
  }

  function getWellbeingColor(value) {
    const score = Number(value || 0)
    const t = Math.min(Math.max((score - 1) / 9, 0), 1)
    const start = new THREE.Color(0xef4444)
    const end = new THREE.Color(0x22c55e)
    return start.lerp(end, t)
  }

  function getReasonColor(reasons) {
    const colors = {
      licht: 0xf59e0b,
      ruhe: 0x38bdf8,
      laerm: 0xef4444,
      aussicht: 0x60a5fa,
      sicherheit: 0x22c55e,
      sauberkeit: 0xa3e635,
      layout: 0x8b5cf6,
      temperatur: 0xf97316,
    }
    if (!reasons || !reasons.length) return new THREE.Color(0x9ca3af)
    const palette = reasons.map((key) => new THREE.Color(colors[key] || 0x9ca3af))
    const mixed = palette.reduce((acc, color) => acc.add(color), new THREE.Color(0, 0, 0))
    mixed.multiplyScalar(1 / palette.length)
    return mixed
  }

  function updateLegend() {
    legend.innerHTML = ''
    if (state.colorMode === 'wellbeing') {
      const steps = [
        { label: '1-2', value: 1.5 },
        { label: '3-4', value: 3.5 },
        { label: '5-6', value: 5.5 },
        { label: '7-8', value: 7.5 },
        { label: '9-10', value: 9.5 },
      ]
      steps.forEach((step) => {
        legend.appendChild(createLegendItem(step.label, getWellbeingColor(step.value)))
      })
      return
    }

    REASONS.forEach((reason) => {
      legend.appendChild(createLegendItem(reason.label, getReasonColor([reason.key])))
    })
  }

  function createLegendItem(label, color) {
    const item = document.createElement('div')
    item.className = 'ui-legend-item'
    const swatch = document.createElement('span')
    swatch.className = 'ui-legend-swatch'
    swatch.style.background = color.getStyle()
    const text = document.createElement('span')
    text.textContent = label
    item.appendChild(swatch)
    item.appendChild(text)
    return item
  }

  function getColorFromForm() {
    if (state.colorMode === 'reasons') {
      const checked = Array.from(form.elements.reasons || [])
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value)
      return getReasonColor(checked)
    }
    return getWellbeingColor(form.elements.wellbeing?.value)
  }

  function updatePreviewColor() {
    if (!previewDot) return
    const color = getColorFromForm()
    previewDot.style.background = color.getStyle()
  }

  function getStatusLabel(status) {
    if (status === 1) return 'Freigegeben'
    if (status === -1) return 'Abgelehnt'
    return 'Wartet auf Freigabe'
  }

  function buildClusters(pins) {
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
          worldPosition: world,
        })
      } else {
        targetCluster.pins.push(pin)
        targetCluster.screen.x =
          (targetCluster.screen.x * (targetCluster.pins.length - 1) + screen.x) /
          targetCluster.pins.length
        targetCluster.screen.y =
          (targetCluster.screen.y * (targetCluster.pins.length - 1) + screen.y) /
          targetCluster.pins.length
        targetCluster.worldPosition.add(world)
        targetCluster.worldPosition.multiplyScalar(1 / targetCluster.pins.length)
      }
    })

    return clusters
  }

  function createClusterMesh(cluster) {
    const texture = createClusterTexture(cluster.pins.length)
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(0.7, 0.7, 1)
    return sprite
  }

  function createClusterTexture(count) {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = '#1f2937'
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f9fafb'
    ctx.font = 'bold 48px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(count), size / 2, size / 2)
    return new THREE.CanvasTexture(canvas)
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

  const modeRow = document.createElement('div')
  modeRow.className = 'ui-pin-mode'
  panel.appendChild(modeRow)

  const modeWellbeing = document.createElement('button')
  modeWellbeing.type = 'button'
  modeWellbeing.className = 'ui-pin-mode-button active'
  modeWellbeing.textContent = 'Wohlbefinden'
  modeWellbeing.dataset.mode = 'wellbeing'
  modeRow.appendChild(modeWellbeing)

  const modeReasons = document.createElement('button')
  modeReasons.type = 'button'
  modeReasons.className = 'ui-pin-mode-button'
  modeReasons.textContent = 'Gründe'
  modeReasons.dataset.mode = 'reasons'
  modeRow.appendChild(modeReasons)

  const legend = document.createElement('div')
  legend.className = 'ui-legend'
  panel.appendChild(legend)

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

  const wellbeingGroup = document.createElement('div')
  wellbeingGroup.className = 'ui-form-group'
  form.appendChild(wellbeingGroup)

  const wellbeingLabel = document.createElement('label')
  wellbeingLabel.textContent = 'Wie fühlst du dich hier?'
  wellbeingGroup.appendChild(wellbeingLabel)

  const preview = document.createElement('div')
  preview.className = 'ui-preview'
  preview.innerHTML = `
    <span>Farbe</span>
    <span class="ui-preview-dot"></span>
  `
  wellbeingGroup.appendChild(preview)

  const wellbeingInput = document.createElement('input')
  wellbeingInput.type = 'range'
  wellbeingInput.name = 'wellbeing'
  wellbeingInput.min = '1'
  wellbeingInput.max = '10'
  wellbeingInput.value = '6'
  wellbeingGroup.appendChild(wellbeingInput)

  const reasonsGroup = document.createElement('div')
  reasonsGroup.className = 'ui-form-group'
  form.appendChild(reasonsGroup)

  const reasonsLabel = document.createElement('div')
  reasonsLabel.textContent = 'Gründe'
  reasonsLabel.className = 'ui-form-section'
  reasonsGroup.appendChild(reasonsLabel)

  const reasonsWrap = document.createElement('div')
  reasonsWrap.className = 'ui-form-reasons'
  reasonsGroup.appendChild(reasonsWrap)

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

  const noteGroup = document.createElement('div')
  noteGroup.className = 'ui-form-group'
  form.appendChild(noteGroup)

  const noteLabel = document.createElement('label')
  noteLabel.textContent = 'Anmerkung'
  noteGroup.appendChild(noteLabel)

  const noteInput = document.createElement('textarea')
  noteInput.name = 'note'
  noteInput.rows = 3
  noteGroup.appendChild(noteInput)

  const viewPanel = document.createElement('div')
  viewPanel.className = 'ui-pin-view is-hidden'
  viewPanel.innerHTML = `
    <div><strong>Status</strong>: <span class="ui-pin-view-status">—</span></div>
    <div><strong>Wohlbefinden</strong>: <span class="ui-pin-view-score">—</span></div>
    <div><strong>Gründe</strong>: <span class="ui-pin-view-reasons">—</span></div>
    <div><strong>Notiz</strong>: <span class="ui-pin-view-note">—</span></div>
  `
  form.appendChild(viewPanel)

  const error = document.createElement('div')
  error.className = 'ui-form-error'
  form.appendChild(error)

  const submitButton = document.createElement('button')
  submitButton.type = 'submit'
  submitButton.className = 'ui-form-submit'
  submitButton.textContent = 'Speichern'
  form.appendChild(submitButton)

  document.body.appendChild(backdrop)

  return {
    panel,
    toggleButton,
    backdrop,
    form,
    closeButton,
    submitButton,
    colorModeButtons: [modeWellbeing, modeReasons],
    legend,
    previewDot: preview.querySelector('.ui-preview-dot'),
    viewPanel,
    viewWellbeing: viewPanel.querySelector('.ui-pin-view-score'),
    viewReasons: viewPanel.querySelector('.ui-pin-view-reasons'),
    viewNote: viewPanel.querySelector('.ui-pin-view-note'),
    viewStatus: viewPanel.querySelector('.ui-pin-view-status'),
    formGroups: [wellbeingGroup, reasonsGroup, noteGroup],
  }
}
