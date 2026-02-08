/**
 * Pin system orchestrator.
 * Wires together state, UI, rendering, raycasting, color-mode, and translations.
 * Exports: createPinSystem.
 */
import * as THREE from 'three'
import { createPin, fetchPins } from './api'
import { onLanguageChange, t } from './i18n'
import { formatPercent, formatTimestamp } from './utils/format'
import { createPinMesh, createClusterMesh } from './pins/pinMesh'
import { buildClusters } from './pins/pinClustering'
import { createPinUi } from './pins/pinPanel'
import { setupPinRaycaster } from './pins/pinRaycaster'
import { createPinState, normalizePin, isLocalPin, bySort, getOptionLabel } from './pins/pinState'
import { createPinColorMode } from './pins/pinColorMode'
import { applyStaticTranslations, applyQuestionLabels, refreshViewTexts } from './pins/pinTranslations'
import {
  renderQuestions as renderFormQuestions,
  collectFormData,
  setQuestionValue,
  disableQuestions,
  getWellbeingValue,
  safeParseReasons,
  showFormError,
  clearFormError,
} from './pins/pinForm'

export function createPinSystem({ scene, camera, domElement, controls, getSelectedFloor, questions }) {
  const state = createPinState(getSelectedFloor())

  const pinGroup = new THREE.Group()
  scene.add(pinGroup)

  const clusterTextureCache = new Map()

  // ── UI ──────────────────────────────────────────────────────
  const ui = createPinUi()
  const {
    panel, toggleButton, backdrop, form, formContent, closeButton, submitButton,
    colorModeRow, legend, viewPanel, viewWellbeing, viewWellbeingLabel,
    viewReasons, viewReasonsLabel, viewGroup, viewGroupLabel, viewGroupRow,
    viewNote, viewNoteLabel, viewPending, viewTimestamp, viewScoreFill,
  } = ui

  const uiRefs = {
    toggleButton, closeButton, submitButton,
    viewWellbeingLabel, viewReasonsLabel, viewGroupLabel, viewNoteLabel, viewPending,
    viewReasons, viewGroup, viewNote, viewTimestamp,
  }

  // ── Color mode ──────────────────────────────────────────────
  const colorMode = createPinColorMode({ state, legend, colorModeRow, form, pinGroup })

  // ── Translations ────────────────────────────────────────────
  applyStaticTranslations(uiRefs, state)
  onLanguageChange(() => {
    applyStaticTranslations(uiRefs, state)
    colorMode.updateLegend()
    refreshViewTexts(state, uiRefs)
  })

  setQuestions(Array.isArray(questions) ? questions : [])

  // ── Toggle pin-mode ─────────────────────────────────────────
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

  // ── Color mode events ─────────────────────────────────────
  colorModeRow.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-mode]')
    if (!button || !colorModeRow.contains(button)) return
    const nextKey = button.dataset.mode
    if (!nextKey || nextKey === state.colorQuestionKey) return
    state.colorQuestionKey = nextKey
    colorMode.updateColorModeButtons()
    colorMode.updateLegend()
    colorMode.refreshPinColors()
    colorMode.updatePreviewColor()
  })

  // ── Raycasting ──────────────────────────────────────────────
  setupPinRaycaster({
    camera,
    domElement,
    pinGroup,
    getState: () => state,
    getSelectedFloor,
    onPinClick: (pin) => openForm({ pin }),
    onFloorClick: ({ floorIndex, position }) => {
      placePendingPin({ floorIndex, position })
      openForm({ floorIndex, position })
    },
  })

  // ── Form events ─────────────────────────────────────────────
  closeButton.addEventListener('click', closeForm)
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeForm()
  })

  submitButton.addEventListener('click', async (event) => {
    event.preventDefault()
    const payload = collectFormData(form, state.questions, state.questionElements)
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
      showFormError(form, error?.message || t('error.saveFailed'))
    }
  })

  form.addEventListener('input', () => {
    colorMode.updatePreviewColor()
    colorMode.refreshPendingPinColor()
  })

  // ── Init ────────────────────────────────────────────────────
  loadPins()
  colorMode.updateLegend()
  colorMode.updatePreviewColor()

  // ── Public API ──────────────────────────────────────────────
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

      // Hover animation: smooth lift + emissive glow
      pinGroup.children.forEach((group) => {
        if (group.userData.baseY === undefined) return
        const targetY = group.userData.hovered ? group.userData.baseY + 0.08 : group.userData.baseY
        group.position.y = THREE.MathUtils.lerp(group.position.y, targetY, 0.1)
        const orb = group.userData.orb
        if (orb) {
          const targetGlow = group.userData.hovered ? 0.5 : 0.25
          orb.material.emissiveIntensity = THREE.MathUtils.lerp(
            orb.material.emissiveIntensity, targetGlow, 0.1
          )
        }
      })
    },
    setQuestions,
  }

  // ── Questions ───────────────────────────────────────────────
  function setQuestions(nextQuestions) {
    state.questions = Array.isArray(nextQuestions) ? [...nextQuestions].sort(bySort) : []
    state.questionElements = new Map()
    state.optionsByQuestion = new Map()
    state.questions.forEach((question) => {
      if (Array.isArray(question.options)) {
        state.optionsByQuestion.set(question.key, question.options)
      }
    })
    viewGroupRow.style.display = state.questions.some((q) => q.key === 'group') ? '' : 'none'
    colorMode.updateColorQuestions()
    renderFormQuestions(state.questions, formContent, state.questionElements)
    applyQuestionLabels(state, uiRefs, colorMode.updateColorModeButtons)
    colorMode.updateLegend()
    colorMode.refreshPinColors()
  }

  // ── Pins loading / rendering ────────────────────────────────
  async function loadPins() {
    try {
      const rawPins = await fetchPins()
      state.pins = rawPins.map(normalizePin)
      state.localPins = state.localPins.filter(
        (pin) => !state.pins.some((p) => p.id === pin.id)
      )
      renderPins()
    } catch {
      // keep existing pins
    }
  }

  function renderPins() {
    // Remember selected pin ID so we can re-highlight after rebuild
    const selectedPinId = state.selectedMesh?.userData?.pinData?.id ?? null
    state.selectedMesh = null

    pinGroup.clear()
    const allPins = [...state.pins, ...state.localPins].filter(
      (pin) => pin.floor_index === state.activeFloor
    )
    const clusters = buildClusters(allPins, camera, controls, domElement)
    clusters.forEach((cluster) => {
      if (cluster.pins.length === 1) {
        const pin = cluster.pins[0]
        const mesh = createPinMesh(pin, colorMode.getPinColor(pin))
        const baseY = pin.position_y + 0.35
        mesh.position.set(pin.position_x, baseY, pin.position_z)
        mesh.userData.floorIndex = pin.floor_index
        mesh.userData.pinId = pin.id
        mesh.userData.pinData = pin
        mesh.userData.baseY = baseY
        pinGroup.add(mesh)

        // Re-highlight if this was the selected pin
        if (selectedPinId != null && pin.id === selectedPinId) {
          mesh.userData.hovered = true
          state.selectedMesh = mesh
        }
      } else {
        const mesh = createClusterMesh(cluster, clusterTextureCache)
        mesh.position.copy(cluster.worldPosition)
        mesh.position.y += 0.4
        mesh.userData.floorIndex = state.activeFloor
        pinGroup.add(mesh)
      }
    })
    updatePinVisibility()
  }

  function updatePinVisibility() {
    pinGroup.children.forEach((mesh) => {
      mesh.visible = mesh.userData.floorIndex === state.activeFloor
    })
  }

  // ── Pending pin lifecycle ───────────────────────────────────
  function placePendingPin({ floorIndex, position }) {
    removePendingPin()
    const draft = {
      id: `local-${Date.now()}`,
      floor_index: floorIndex,
      position_x: position.x,
      position_y: position.y,
      position_z: position.z,
      wellbeing: getWellbeingValue(state.questions, state.questionElements),
      reasons: [],
      note: '',
      approved: 0,
      group_key: null,
    }
    const mesh = createPinMesh(draft, colorMode.getPinColor(draft))
    const baseY = position.y + 0.35
    mesh.position.set(position.x, baseY, position.z)
    mesh.userData.floorIndex = floorIndex
    mesh.userData.baseY = baseY
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

  // ── Helpers ─────────────────────────────────────────────────
  function findPinMesh(pinId) {
    if (!pinId) return null
    for (const group of pinGroup.children) {
      if (group.userData.pinData && group.userData.pinData.id === pinId) return group
    }
    return null
  }

  function clearSelectedHighlight() {
    if (state.selectedMesh) {
      state.selectedMesh.userData.hovered = false
      state.selectedMesh = null
    }
  }

  // ── Form open / close ───────────────────────────────────────
  function openForm({ floorIndex, position, pin }) {
    form.reset()
    clearFormError(form)
    form.dataset.mode = pin ? 'view' : 'create'
    state.viewPin = pin || null

    if (pin) {
      // Highlight the tapped pin (lift + glow, same as hover)
      clearSelectedHighlight()
      const mesh = findPinMesh(pin.id)
      if (mesh) {
        mesh.userData.hovered = true
        state.selectedMesh = mesh
      }
      const reasons = safeParseReasons(pin.reasons)
      const group = pin.group_key || ''
      setQuestionValue('wellbeing', pin.wellbeing, state.questions, state.questionElements)
      setQuestionValue('note', pin.note || '', state.questions, state.questionElements)
      setQuestionValue('reasons', reasons, state.questions, state.questionElements)
      setQuestionValue('group', group ? [group] : [], state.questions, state.questionElements)
      disableQuestions(true, state.questionElements)
      submitButton.disabled = true
      submitButton.classList.add('is-hidden')
      formContent.classList.add('is-hidden')
      viewPanel.classList.remove('is-hidden')
      viewWellbeing.textContent = formatPercent(pin.wellbeing)
      viewScoreFill.style.width = `${Math.min(Math.max(pin.wellbeing, 0), 100)}%`
      viewReasons.textContent = reasons.length
        ? reasons.map((key) => getOptionLabel(state, 'reasons', key)).join(', ')
        : t('ui.empty')
      viewGroup.textContent = group ? getOptionLabel(state, 'group', group) : t('ui.empty')
      viewNote.textContent = pin.note?.trim() ? pin.note : t('ui.empty')
      viewTimestamp.textContent = formatTimestamp(pin.created_at)
      viewTimestamp.dataset.pending = isLocalPin(state, pin.id) && pin.approved === 0 ? 'true' : 'false'
    } else {
      disableQuestions(false, state.questionElements)
      submitButton.disabled = false
      submitButton.classList.remove('is-hidden')
      formContent.classList.remove('is-hidden')
      viewPanel.classList.add('is-hidden')
      form.dataset.floorIndex = floorIndex
      form.dataset.x = position.x
      form.dataset.y = position.y
      form.dataset.z = position.z
    }

    colorMode.updatePreviewColor()
    backdrop.classList.add('is-visible')
  }

  function closeForm() {
    backdrop.classList.remove('is-visible')
    form.dataset.floorIndex = ''
    form.dataset.x = ''
    form.dataset.y = ''
    form.dataset.z = ''
    state.viewPin = null
    clearSelectedHighlight()
    if (form.dataset.mode === 'create') {
      removePendingPin()
    }
    state.pinMode = false
    toggleButton.classList.remove('active')
    toggleButton.textContent = t('ui.pinToggleIdle')
    controls.enabled = true
    document.body.classList.remove('pin-mode')
  }
}
