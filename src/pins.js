import * as THREE from 'three'
import { createPin, fetchPins } from './api'
import { getFloorSlabTopY } from './floors'
import { getLocale, onLanguageChange, t } from './i18n'

const SLIDER_PALETTE = [
  '#440154',
  '#482475',
  '#414487',
  '#355f8d',
  '#2a788e',
  '#21908d',
  '#22a884',
  '#42be71',
  '#7ad151',
  '#bddf26',
]
const NEUTRAL_COLOR = new THREE.Color(0x9ca3af)

export function createPinSystem({ scene, camera, domElement, controls, getSelectedFloor, questions }) {
  const state = {
    pins: [],
    localPins: [],
    pinMode: false,
    activeFloor: getSelectedFloor(),
    pendingMesh: null,
    colorQuestionKey: null,
    colorQuestions: [],
    lastClusterDistance: null,
    viewPin: null,
    questions: [],
    questionElements: new Map(),
    optionsByQuestion: new Map(),
  }

  const pinGroup = new THREE.Group()
  scene.add(pinGroup)

  const clusterTextureCache = new Map()

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  const ui = createPinUi()
  const {
    panel,
    toggleButton,
    backdrop,
    form,
    formContent,
    closeButton,
    submitButton,
    colorModeRow,
    legend,
    viewPanel,
    viewWellbeing,
    viewWellbeingLabel,
    viewReasons,
    viewReasonsLabel,
    viewGroup,
    viewGroupLabel,
    viewGroupRow,
    viewNote,
    viewNoteLabel,
    viewPending,
    viewTimestamp,
    viewScoreFill,
  } = ui

  applyStaticTranslations()
  onLanguageChange(() => {
    applyStaticTranslations()
    updateLegend()
    refreshViewTexts()
  })

  setQuestions(Array.isArray(questions) ? questions : [])

  toggleButton.addEventListener('click', () => {
    state.pinMode = !state.pinMode
    toggleButton.classList.toggle('active', state.pinMode)
    toggleButton.textContent = state.pinMode ? t('ui.pinToggleActive') : t('ui.pinToggleIdle')
    controls.enabled = !state.pinMode
    document.body.classList.toggle('pin-mode', state.pinMode)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    if (backdrop.classList.contains('is-visible')) {
      closeForm()
      return
    }
    if (state.pinMode) {
      state.pinMode = false
      toggleButton.classList.remove('active')
      toggleButton.textContent = t('ui.pinToggleIdle')
      controls.enabled = true
      document.body.classList.remove('pin-mode')
    }
  })

  colorModeRow.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-mode]')
    if (!button || !colorModeRow.contains(button)) return
    const nextKey = button.dataset.mode
    if (!nextKey || nextKey === state.colorQuestionKey) return
    state.colorQuestionKey = nextKey
    updateColorModeButtons()
    updateLegend()
    refreshPinColors()
    updatePreviewColor()
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
      showFormError(error?.message || t('error.saveFailed'))
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
      const distance = camera.position.distanceTo(controls.target)
      if (state.lastClusterDistance === null || Math.abs(distance - state.lastClusterDistance) > 0.6) {
        state.lastClusterDistance = distance
        renderPins()
      }
    },
    setQuestions,
  }

  function setQuestions(nextQuestions) {
    state.questions = Array.isArray(nextQuestions) ? [...nextQuestions].sort(bySort) : []
    state.questionElements = new Map()
    state.optionsByQuestion = new Map()
    state.questions.forEach((question) => {
      if (Array.isArray(question.options)) {
        state.optionsByQuestion.set(question.key, question.options)
      }
    })
    const hasGroup = state.questions.some((question) => question.key === 'group')
    viewGroupRow.style.display = hasGroup ? '' : 'none'
    updateColorQuestions()
    renderQuestions()
    applyQuestionLabels()
    updateLegend()
  }

  function renderQuestions() {
    formContent.innerHTML = ''
    state.questionElements.clear()

    state.questions.forEach((question) => {
      const group = document.createElement('div')
      group.className = 'ui-form-group'
      group.dataset.questionKey = question.key

      const label = document.createElement('div')
      label.className = 'ui-form-question'
      label.textContent = question.label || question.key
      group.appendChild(label)

      let elements = { group, label, type: question.type, inputs: [] }

      if (question.type === 'slider') {
        const input = document.createElement('input')
        input.type = 'range'
        input.name = question.key
        input.min = question.config?.min ?? 0
        input.max = question.config?.max ?? 1
        input.step = question.config?.step ?? 0.01
        input.value = getSliderDefault(question.config)
        group.appendChild(input)

        const legend = document.createElement('div')
        legend.className = 'ui-slider-legend'
        const legendLow = document.createElement('span')
        legendLow.className = 'ui-slider-legend-low'
        legendLow.textContent = question.legend_low || ''
        const legendHigh = document.createElement('span')
        legendHigh.className = 'ui-slider-legend-high'
        legendHigh.textContent = question.legend_high || ''
        legend.appendChild(legendLow)
        legend.appendChild(legendHigh)
        group.appendChild(legend)

        elements = { ...elements, input, legendLow, legendHigh }
      }

      if (question.type === 'multi') {
        const wrapper = document.createElement('div')
        wrapper.className = 'ui-form-reasons'
        const allowMultiple = Boolean(question.config?.allow_multiple)
        const inputType = allowMultiple ? 'checkbox' : 'radio'
        const options = Array.isArray(question.options) ? question.options : []
        options.forEach((option) => {
          const optionLabel = document.createElement('label')
          optionLabel.className = 'ui-checkbox'
          const input = document.createElement('input')
          input.type = inputType
          input.name = question.key
          input.value = option.key
          const text = document.createElement('span')
          text.textContent = option.label || option.key
          optionLabel.appendChild(input)
          optionLabel.appendChild(text)
          wrapper.appendChild(optionLabel)
          elements.inputs.push({ input, label: text, key: option.key })
        })
        group.appendChild(wrapper)
      }

      if (question.type === 'text') {
        const input = document.createElement('textarea')
        input.name = question.key
        input.rows = question.config?.rows ?? 3
        group.appendChild(input)
        elements = { ...elements, input }
      }

      formContent.appendChild(group)
      state.questionElements.set(question.key, elements)
    })
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
    state.viewPin = pin || null

    if (pin) {
      const reasons = safeParseReasons(pin.reasons)
      const group = pin.group_key || ''
      setQuestionValue('wellbeing', pin.wellbeing)
      setQuestionValue('note', pin.note || '')
      setQuestionValue('reasons', reasons)
      setQuestionValue('group', group ? [group] : [])
      disableQuestions(true)
      submitButton.disabled = true
      submitButton.classList.add('is-hidden')
      formContent.classList.add('is-hidden')
      viewPanel.classList.remove('is-hidden')
      viewWellbeing.textContent = formatPercent(pin.wellbeing)
      viewScoreFill.style.width = `${Math.min(Math.max(pin.wellbeing, 0), 100)}%`
      viewReasons.textContent = reasons.length
        ? reasons.map((key) => getOptionLabel('reasons', key)).join(', ')
        : t('ui.empty')
      viewGroup.textContent = group ? getOptionLabel('group', group) : t('ui.empty')
      viewNote.textContent = pin.note?.trim() ? pin.note : t('ui.empty')
      viewTimestamp.textContent = formatTimestamp(pin.created_at)
      viewTimestamp.dataset.pending = isLocalPin(pin.id) && pin.approved === 0 ? 'true' : 'false'
    } else {
      disableQuestions(false)
      submitButton.disabled = false
      submitButton.classList.remove('is-hidden')
      formContent.classList.remove('is-hidden')
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
    state.viewPin = null
    if (form.dataset.mode === 'create') {
      removePendingPin()
    }
    state.pinMode = false
    toggleButton.classList.remove('active')
    toggleButton.textContent = t('ui.pinToggleIdle')
    controls.enabled = true
    document.body.classList.remove('pin-mode')
  }

  function collectFormData() {
    const floorIndex = Number(form.dataset.floorIndex)
    const x = Number(form.dataset.x)
    const y = Number(form.dataset.y)
    const z = Number(form.dataset.z)

    if (Number.isNaN(floorIndex) || Number.isNaN(x)) {
      showFormError(t('error.noLocation'))
      return null
    }

    const answers = {}
    for (const question of state.questions) {
      const elements = state.questionElements.get(question.key)
      if (!elements) continue
      if (question.type === 'slider') {
        answers[question.key] = toPercentValue(elements.input.value, question.config)
      }
      if (question.type === 'text') {
        answers[question.key] = elements.input.value.trim()
      }
      if (question.type === 'multi') {
        const allowMultiple = Boolean(question.config?.allow_multiple)
        const selected = elements.inputs
          .filter((item) => item.input.checked)
          .map((item) => item.input.value)
        answers[question.key] = allowMultiple ? selected : selected[0] || ''
      }

      if (question.required && isAnswerEmpty(answers[question.key])) {
        showFormError(t('error.required'))
        return null
      }
    }

    return {
      floor_index: floorIndex,
      x,
      y,
      z,
      answers,
    }
  }

  function isAnswerEmpty(value) {
    if (Array.isArray(value)) return value.length === 0
    if (value === null || value === undefined) return true
    if (typeof value === 'string') return value.trim().length === 0
    return false
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
      wellbeing: getWellbeingValue(),
      reasons: [],
      note: '',
      approved: 0,
      group_key: null,
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
      group_key: pin.group_key || null,
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
    const colorQuestion = getActiveColorQuestion()
    if (!colorQuestion) return NEUTRAL_COLOR
    const score = getPinScore(pin, colorQuestion)
    return getSliderColor(score, colorQuestion.config)
  }

  function getSliderColor(value, config = {}) {
    const min = Number.isFinite(config.min) ? Number(config.min) : 1
    const max = Number.isFinite(config.max) ? Number(config.max) : 10
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return NEUTRAL_COLOR
    const clamped = Math.min(Math.max(numeric, min), max)
    const ratio = max === min ? 0 : (clamped - min) / (max - min)
    const index = Math.min(
      SLIDER_PALETTE.length - 1,
      Math.max(0, Math.round(ratio * (SLIDER_PALETTE.length - 1)))
    )
    return new THREE.Color(SLIDER_PALETTE[index])
  }

  function updateLegend() {
    legend.innerHTML = ''
    const colorQuestion = getActiveColorQuestion()
    if (!colorQuestion) return
    const gradient = document.createElement('div')
    gradient.className = 'ui-legend-gradient'
    gradient.style.background =
      'linear-gradient(90deg, #440154, #482475, #414487, #355f8d, #2a788e, #21908d, #22a884, #42be71, #7ad151, #bddf26)'
    const labels = document.createElement('div')
    labels.className = 'ui-legend-labels'
    labels.innerHTML = `<span>${colorQuestion.legend_low || ''}</span><span>${
      colorQuestion.legend_high || ''
    }</span>`
    legend.appendChild(gradient)
    legend.appendChild(labels)
  }

  function getColorFromForm() {
    const colorQuestion = getActiveColorQuestion()
    if (!colorQuestion) return NEUTRAL_COLOR
    const elements = state.questionElements.get(colorQuestion.key)
    return getSliderColor(elements?.input?.value, colorQuestion.config)
  }

  function updatePreviewColor() {
    const color = getColorFromForm()
    form.style.setProperty('--pin-accent', color.getStyle())
  }

  function formatTimestamp(value) {
    if (!value) return t('ui.empty')
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString(getLocale())
  }

  function isLocalPin(id) {
    return state.localPins.some((pin) => pin.id === id)
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
          worldSum: world.clone(),
          worldPosition: world.clone(),
        })
      } else {
        targetCluster.pins.push(pin)
        targetCluster.screen.x =
          (targetCluster.screen.x * (targetCluster.pins.length - 1) + screen.x) /
          targetCluster.pins.length
        targetCluster.screen.y =
          (targetCluster.screen.y * (targetCluster.pins.length - 1) + screen.y) /
          targetCluster.pins.length
        targetCluster.worldSum.add(world)
        targetCluster.worldPosition.copy(targetCluster.worldSum).multiplyScalar(1 / targetCluster.pins.length)
      }
    })

    return clusters
  }

  function createClusterMesh(cluster) {
    const texture = createClusterTexture(cluster.pins.length)
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(0.7, 0.7, 1)
    sprite.position.y += 0.5
    sprite.material.depthTest = false
    return sprite
  }

  function createClusterTexture(count) {
    if (clusterTextureCache.has(count)) {
      return clusterTextureCache.get(count)
    }
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
    const texture = new THREE.CanvasTexture(canvas)
    clusterTextureCache.set(count, texture)
    return texture
  }

  function applyStaticTranslations() {
    toggleButton.textContent = state.pinMode ? t('ui.pinToggleActive') : t('ui.pinToggleIdle')
    closeButton.setAttribute('aria-label', t('ui.close'))
    submitButton.textContent = t('ui.save')
    viewWellbeingLabel.textContent = t('ui.viewWellbeing')
    viewReasonsLabel.textContent = t('ui.viewReasons')
    viewGroupLabel.textContent = t('questions.group.label')
    viewNoteLabel.textContent = t('ui.viewNote')
    viewPending.textContent = t('ui.viewPending')
  }

  function applyQuestionLabels() {
    state.questions.forEach((question) => {
      const elements = state.questionElements.get(question.key)
      if (!elements) return
      elements.label.textContent = question.label || question.key
      if (question.type === 'slider') {
        elements.legendLow.textContent = question.legend_low || ''
        elements.legendHigh.textContent = question.legend_high || ''
      }
      if (question.type === 'multi') {
        elements.inputs.forEach((item) => {
          const optionLabel = getOptionLabel(question.key, item.key)
          item.label.textContent = optionLabel
        })
      }

      if (question.key === 'wellbeing') {
        viewWellbeingLabel.textContent = question.label || t('ui.viewWellbeing')
      }
      if (question.key === 'reasons') {
        viewReasonsLabel.textContent = question.label || t('ui.viewReasons')
      }
      if (question.key === 'group') {
        viewGroupLabel.textContent = question.label || t('questions.group.label')
      }
      if (question.key === 'note') {
        viewNoteLabel.textContent = question.label || t('ui.viewNote')
      }
    })
    updateColorModeButtons()
  }

  function refreshViewTexts() {
    if (!state.viewPin) return
    const reasons = safeParseReasons(state.viewPin.reasons)
    const group = state.viewPin.group_key || ''
    viewReasons.textContent = reasons.length
      ? reasons.map((key) => getOptionLabel('reasons', key)).join(', ')
      : t('ui.empty')
    viewGroup.textContent = group ? getOptionLabel('group', group) : t('ui.empty')
    viewNote.textContent = state.viewPin.note?.trim() ? state.viewPin.note : t('ui.empty')
    viewTimestamp.textContent = formatTimestamp(state.viewPin.created_at)
  }

  function getOptionLabel(questionKey, optionKey) {
    const options = state.optionsByQuestion.get(questionKey) || []
    const match = options.find((option) => option.key === optionKey)
    return match?.label || optionKey
  }

  function disableQuestions(disabled) {
    state.questionElements.forEach((elements) => {
      if (elements.input) {
        elements.input.disabled = disabled
      }
      elements.inputs?.forEach((item) => {
        item.input.disabled = disabled
      })
    })
  }

  function setQuestionValue(key, value) {
    const elements = state.questionElements.get(key)
    if (!elements) return
    if (elements.input) {
      const question = state.questions.find((item) => item.key === key)
      if (question?.type === 'slider') {
        elements.input.value = fromPercentValue(value, question.config)
        return
      }
      elements.input.value = value ?? ''
      return
    }
    if (Array.isArray(value)) {
      elements.inputs.forEach((item) => {
        item.input.checked = value.includes(item.input.value)
      })
    } else {
      elements.inputs.forEach((item) => {
        item.input.checked = item.input.value === value
      })
    }
  }

  function getWellbeingValue() {
    const elements = state.questionElements.get('wellbeing')
    if (!elements?.input) {
      const question = state.questions.find((item) => item.key === 'wellbeing')
      return toPercentValue(getSliderDefault(question?.config), question?.config)
    }
    const question = state.questions.find((item) => item.key === 'wellbeing')
    return toPercentValue(elements.input.value || 0.5, question?.config)
  }

  function formatPercent(value) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return t('ui.empty')
    const formatted = numeric.toLocaleString(getLocale(), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
    return `${formatted}%`
  }

  function updateColorQuestions() {
    const sliderQuestions = state.questions.filter((question) => question.type === 'slider')
    const flagged = sliderQuestions.filter((question) => question.config?.use_for_color)
    let colorQuestions = flagged
    if (!colorQuestions.length) {
      const wellbeing = sliderQuestions.find((question) => question.key === 'wellbeing')
      colorQuestions = wellbeing ? [wellbeing] : sliderQuestions.slice(0, 1)
    }
    state.colorQuestions = colorQuestions
    if (!state.colorQuestionKey || !colorQuestions.some((question) => question.key === state.colorQuestionKey)) {
      state.colorQuestionKey = colorQuestions[0]?.key || null
    }
    updateColorModeButtons()
  }

  function updateColorModeButtons() {
    colorModeRow.innerHTML = ''
    if (state.colorQuestions.length <= 1) {
      colorModeRow.style.display = 'none'
      return
    }
    colorModeRow.style.display = ''
    state.colorQuestions.forEach((question) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'ui-pin-mode-button'
      button.dataset.mode = question.key
      button.textContent = question.label || question.key
      button.classList.toggle('active', question.key === state.colorQuestionKey)
      colorModeRow.appendChild(button)
    })
  }

  function getActiveColorQuestion() {
    if (!state.colorQuestionKey) return null
    return (
      state.colorQuestions.find((question) => question.key === state.colorQuestionKey) ||
      state.questions.find((question) => question.key === state.colorQuestionKey) ||
      null
    )
  }

  function getPinScore(pin, question) {
    if (!question) return null
    const key = question.key
    if (Object.prototype.hasOwnProperty.call(pin, key)) {
      return fromPercentValue(pin[key], question.config)
    }
    const answers = pin.answers || pin.answer || pin.responses
    if (answers && Object.prototype.hasOwnProperty.call(answers, key)) {
      return fromPercentValue(answers[key], question.config)
    }
    if (key === 'wellbeing') {
      return fromPercentValue(pin.wellbeing, question.config)
    }
    return fromPercentValue(pin.wellbeing, question.config)
  }

  function toPercentValue(value, config = {}) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return null
    const max = Number.isFinite(config.max) ? Number(config.max) : 1
    const min = Number.isFinite(config.min) ? Number(config.min) : 0
    const clamped = Math.min(Math.max(numeric, min), max)
    if (max <= 1) {
      return roundTwo(clamped * 100)
    }
    return roundTwo(((clamped - min) / (max - min)) * 100)
  }

  function fromPercentValue(value, config = {}) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return ''
    const max = Number.isFinite(config.max) ? Number(config.max) : 1
    const min = Number.isFinite(config.min) ? Number(config.min) : 0
    if (max <= 1) {
      return roundTwo(numeric / 100)
    }
    return roundTwo(min + (numeric / 100) * (max - min))
  }

  function roundTwo(value) {
    return Math.round(Number(value) * 100) / 100
  }

  function getSliderDefault(config = {}) {
    const min = Number.isFinite(config.min) ? Number(config.min) : 0
    const max = Number.isFinite(config.max) ? Number(config.max) : 1
    const step = Number.isFinite(config.step) && Number(config.step) > 0 ? Number(config.step) : 0.01
    if (Number.isFinite(config.default)) {
      return Math.min(Math.max(Number(config.default), min), max)
    }
    const mid = min + (max - min) / 2
    const stepped = min + Math.round((mid - min) / step) * step
    return Math.min(Math.max(stepped, min), max)
  }

  function bySort(a, b) {
    return (a.sort ?? 0) - (b.sort ?? 0)
  }
}

function createPinUi() {
  const panel = document.createElement('div')
  panel.className = 'ui ui-pin-panel'

  const toggleButton = document.createElement('button')
  toggleButton.type = 'button'
  toggleButton.className = 'ui-pin-toggle'
  toggleButton.textContent = t('ui.pinToggleIdle')
  panel.appendChild(toggleButton)

  const modeRow = document.createElement('div')
  modeRow.className = 'ui-pin-mode'
  panel.appendChild(modeRow)

  const legend = document.createElement('div')
  legend.className = 'ui-legend'
  panel.appendChild(legend)

  const backdrop = document.createElement('div')
  backdrop.className = 'ui-modal-backdrop'

  const modal = document.createElement('div')
  modal.className = 'ui-modal'
  backdrop.appendChild(modal)

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'ui-modal-close'
  closeButton.setAttribute('aria-label', t('ui.close'))
  closeButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6l-12 12" />
    </svg>
  `
  modal.appendChild(closeButton)

  const form = document.createElement('form')
  form.className = 'ui-form'
  modal.appendChild(form)

  const formContent = document.createElement('div')
  formContent.className = 'ui-form-content'
  form.appendChild(formContent)

  const viewPanel = document.createElement('div')
  viewPanel.className = 'ui-pin-view is-hidden'
  viewPanel.innerHTML = `
    <div class="ui-pin-view-score-row">
      <span>
        <span class="ui-pin-view-label wellbeing">${t('ui.viewWellbeing')}</span>
        <span class="ui-pin-view-score">${t('ui.empty')}</span>
      </span>
      <div class="ui-pin-view-bar"><span class="ui-pin-view-bar-fill"></span></div>
    </div>
    <div>
      <span class="ui-pin-view-label reasons">${t('ui.viewReasons')}</span>
      <span class="ui-pin-view-reasons">${t('ui.empty')}</span>
    </div>
    <div class="ui-pin-view-group-row">
      <span class="ui-pin-view-label group">${t('questions.group.label')}</span>
      <span class="ui-pin-view-group">${t('ui.empty')}</span>
    </div>
    <div>
      <span class="ui-pin-view-label note">${t('ui.viewNote')}</span>
      <span class="ui-pin-view-note">${t('ui.empty')}</span>
    </div>
    <div class="ui-pin-view-meta">
      <span class="ui-pin-view-timestamp">${t('ui.empty')}</span>
      <span class="ui-pin-view-pending">${t('ui.viewPending')}</span>
    </div>
  `
  form.appendChild(viewPanel)

  const error = document.createElement('div')
  error.className = 'ui-form-error'
  form.appendChild(error)

  const submitButton = document.createElement('button')
  submitButton.type = 'submit'
  submitButton.className = 'ui-form-submit'
  submitButton.textContent = t('ui.save')
  form.appendChild(submitButton)

  document.body.appendChild(backdrop)

  return {
    panel,
    toggleButton,
    backdrop,
    form,
    formContent,
    closeButton,
    submitButton,
    colorModeRow: modeRow,
    legend,
    viewPanel,
    viewWellbeing: viewPanel.querySelector('.ui-pin-view-score'),
    viewWellbeingLabel: viewPanel.querySelector('.ui-pin-view-label.wellbeing'),
    viewReasons: viewPanel.querySelector('.ui-pin-view-reasons'),
    viewReasonsLabel: viewPanel.querySelector('.ui-pin-view-label.reasons'),
    viewGroup: viewPanel.querySelector('.ui-pin-view-group'),
    viewGroupLabel: viewPanel.querySelector('.ui-pin-view-label.group'),
    viewGroupRow: viewPanel.querySelector('.ui-pin-view-group-row'),
    viewNote: viewPanel.querySelector('.ui-pin-view-note'),
    viewNoteLabel: viewPanel.querySelector('.ui-pin-view-label.note'),
    viewPending: viewPanel.querySelector('.ui-pin-view-pending'),
    viewTimestamp: viewPanel.querySelector('.ui-pin-view-timestamp'),
    viewScoreFill: viewPanel.querySelector('.ui-pin-view-bar-fill'),
  }
}
