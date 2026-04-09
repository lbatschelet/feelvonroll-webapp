/**
 * Pin system orchestrator.
 * Wires together state, UI, rendering, raycasting, color-mode, and translations.
 * Exports: createPinSystem.
 */
import * as THREE from 'three'
import { createPin, fetchPins, fetchStation, fetchQuestionnaire } from './api'
import { getLanguage, onLanguageChange, t } from './i18n'
import { formatPercent, formatTimestamp } from './utils/format'
import { fromPercentValue } from './utils/sliderMath'
import { createPinMesh, createClusterMesh } from './pins/pinMesh'
import { buildClusters } from './pins/pinClustering'
import { createPinUi } from './pins/pinPanel'
import { setupPinRaycaster } from './pins/pinRaycaster'
import { setupLongPress, setupDoubleClickPlacePin } from './pins/pinLongPress'
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

export function createPinSystem({
  scene,
  camera,
  renderer,
  domElement,
  controls,
  getSelectedFloor,
  getFloorSlabTopY,
  getPinScale,
  getPinLift,
  questions,
  requestFrame,
}) {
  const state = createPinState(getSelectedFloor())

  function needRender() {
    if (typeof requestFrame === 'function') requestFrame()
  }

  // Cache questionnaire lookups so pin view stays snappy.
  const questionnaireKeyByStationKey = new Map() // station_key -> questionnaire_key
  const questionsCache = new Map() // `${questionnaire_key}::${lang}` -> questions[]
  let activeQuestionnaireKey = null
  let viewLoadToken = 0

  async function ensureQuestionsForPin(pin) {
    const resolvedLang = getLanguage()

    // Prefer snapshot stored on the pin (correct even if station questionnaire changes later).
    let qKey = pin?.questionnaire_key ? String(pin.questionnaire_key) : 'default'
    if (!qKey || qKey === 'null' || qKey === 'undefined') qKey = 'default'

    // Backward compatibility: older pins may have only station_key.
    if ((!pin?.questionnaire_key || qKey === 'default') && pin?.station_key) {
      const stationKey = String(pin.station_key)
      if (questionnaireKeyByStationKey.has(stationKey)) {
        qKey = questionnaireKeyByStationKey.get(stationKey) || qKey
      } else {
        try {
          const station = await fetchStation(stationKey)
          const resolved = station?.questionnaire_key || 'default'
          questionnaireKeyByStationKey.set(stationKey, resolved)
          if (!pin?.questionnaire_key) qKey = resolved
        } catch {
          questionnaireKeyByStationKey.set(stationKey, 'default')
        }
      }
    }

    const cacheKey = `${qKey}::${resolvedLang || ''}`
    if (!questionsCache.has(cacheKey)) {
      const qs = await fetchQuestionnaire({ key: qKey, lang: resolvedLang }).catch(() => null)
      if (Array.isArray(qs) && qs.length) {
        questionsCache.set(cacheKey, qs)
      }
    }

    const nextQuestions = questionsCache.get(cacheKey)
    if (nextQuestions && qKey !== activeQuestionnaireKey) {
      activeQuestionnaireKey = qKey
      setQuestions(nextQuestions)
      needRender()
    }
  }

  const pinGroup = new THREE.Group()
  scene.add(pinGroup)

  const clusterTextureCache = new Map()

  // ── UI ──────────────────────────────────────────────────────
  const ui = createPinUi()
  const {
    panel, toggleButton, backdrop, form, formContent, closeButton, submitButton,
    colorModeRow, legend, viewPanel, viewWellbeing, viewWellbeingLabel,
    viewAnswers, viewStation,
    viewPending, viewTimestamp, viewScoreDot,
  } = ui

  const uiRefs = {
    toggleButton, closeButton, submitButton,
    viewWellbeingLabel, viewPending,
    viewTimestamp, viewStation,
  }

  // ── Color mode ──────────────────────────────────────────────
  const colorMode = createPinColorMode({ state, legend, colorModeRow, form, pinGroup })

  // ── Translations ────────────────────────────────────────────
  applyStaticTranslations(uiRefs, state)
  onLanguageChange(() => {
    applyStaticTranslations(uiRefs, state)
    colorMode.updateLegend()
    if (state.viewPin && form.dataset.mode === 'view' && !viewPanel.classList.contains('is-hidden')) {
      // Re-render the view modal so labels/options & influence bars update with language.
      renderPinView(state.viewPin)
      return
    }
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
    // Ensure the color legend is present when entering pin mode.
    if (state.pinMode) {
      colorMode.updateColorQuestions()
      colorMode.updateLegend()
      needRender()
    }
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
    needRender()
  })

  // ── Camera pan to reveal pin behind modal ───────────────────
  let panTween = null

  function panToRevealPin(position3D) {
    // Cancel any running pan
    if (panTween !== null) {
      cancelAnimationFrame(panTween)
      panTween = null
    }

    // Project pin position to normalized device coordinates
    const projected = position3D.clone().project(camera)
    // projected.y: +1 = top of screen, -1 = bottom, 0 = center
    // We want the pin in the upper quarter (y ≈ +0.5) so it sits above the modal
    const targetNDC_Y = 0.5
    const deltaY = targetNDC_Y - projected.y

    // If the pin is already in the upper third, no need to pan
    if (projected.y > 0.3) return

    // Convert NDC delta to a world-space offset.
    // For a perspective camera, we can approximate the pan amount:
    // unproject two NDC points at the pin's depth and measure the difference.
    const ndcA = new THREE.Vector3(0, 0, projected.z).unproject(camera)
    const ndcB = new THREE.Vector3(0, deltaY, projected.z).unproject(camera)
    const worldDelta = ndcB.clone().sub(ndcA)

    // Animate the pan over ~300ms
    const duration = 300
    const startTarget = controls.target.clone()
    const startCamPos = camera.position.clone()
    const startTime = performance.now()

    function animate(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)

      controls.target.copy(startTarget).addScaledVector(worldDelta, eased)
      camera.position.copy(startCamPos).addScaledVector(worldDelta, eased)
      controls.update()
      if (renderer) {
        renderer.render(scene, camera)
      }

      if (progress < 1) {
        panTween = requestAnimationFrame(animate)
      } else {
        panTween = null
      }
    }

    panTween = requestAnimationFrame(animate)
  }

  // ── Raycasting ──────────────────────────────────────────────
  setupPinRaycaster({
    camera,
    domElement,
    pinGroup,
    getState: () => state,
    getSelectedFloor,
    getFloorSlabTopY,
    onPinClick: (pin) => openForm({ pin }),
    onFloorClick: ({ floorIndex, position }) => {
      placePendingPin({ floorIndex, position })
      openForm({ floorIndex, position })
    },
  })

  setupLongPress({
    camera,
    domElement,
    getState: () => state,
    getSelectedFloor,
    getFloorSlabTopY,
    controls,
    onFloorClick: ({ floorIndex, position }) => {
      placePendingPin({ floorIndex, position })
      openForm({ floorIndex, position })
    },
  })

  setupDoubleClickPlacePin({
    camera,
    domElement,
    getState: () => state,
    getSelectedFloor,
    getFloorSlabTopY,
    controls,
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
    needRender()
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
      let needFrame = false

      const distance = camera.position.distanceTo(controls.target)
      if (state.lastClusterDistance === null || Math.abs(distance - state.lastClusterDistance) > 0.6) {
        state.lastClusterDistance = distance
        renderPins()
        needFrame = true
      }

      // Hover animation: smooth lift + emissive glow
      pinGroup.children.forEach((group) => {
        if (group.userData.baseY === undefined) return
        const targetY = group.userData.hovered ? group.userData.baseY + 0.08 : group.userData.baseY
        group.position.y = THREE.MathUtils.lerp(group.position.y, targetY, 0.1)
        if (Math.abs(group.position.y - targetY) > 1e-4) needFrame = true
        const orb = group.userData.orb
        if (orb) {
          const targetGlow = group.userData.hovered ? 0.5 : 0.25
          orb.material.emissiveIntensity = THREE.MathUtils.lerp(
            orb.material.emissiveIntensity, targetGlow, 0.1
          )
          if (Math.abs(orb.material.emissiveIntensity - targetGlow) > 0.02) needFrame = true
        }
      })
      return needFrame
    },
    setQuestions,
    setGlobalColorQuestions,
    setStationKey: (key) => {
      form.dataset.stationKey = key || ''
    },
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
    colorMode.updateColorQuestions()
    renderFormQuestions(state.questions, formContent, state.questionElements)
    applyQuestionLabels(state, uiRefs, colorMode.updateColorModeButtons)
    colorMode.updateLegend()
    colorMode.refreshPinColors()
    needRender()
  }

  /**
   * Store the global color-driving questions (from the full library).
   * Used as fallback when a station questionnaire has no use_for_color slider.
   */
  function setGlobalColorQuestions(allQuestions) {
    const sliders = (allQuestions || []).filter((q) => q.type === 'slider')
    const flagged = sliders.filter((q) => q.config?.use_for_color)
    if (flagged.length) {
      state.globalColorQuestions = flagged
    } else {
      const wellbeing = sliders.find((q) => q.key === 'wellbeing')
      state.globalColorQuestions = wellbeing ? [wellbeing] : sliders.slice(0, 1)
    }
    // Rebuild legend immediately (bottom-left pin panel).
    colorMode.updateColorQuestions()
    colorMode.updateLegend()
    colorMode.refreshPinColors()
    needRender()
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
    const clusters = buildClusters(allPins, camera, controls, domElement, getFloorSlabTopY, getPinLift)
    clusters.forEach((cluster) => {
      if (cluster.pins.length === 1) {
        const pin = cluster.pins[0]
        const mesh = createPinMesh(pin, colorMode.getPinColor(pin))
        const pinScale = typeof getPinScale === 'function' ? Number(getPinScale()) : 1
        const pinLift = typeof getPinLift === 'function' ? Number(getPinLift()) : 0.35
        if (Number.isFinite(pinScale) && pinScale > 0) {
          mesh.scale.setScalar(pinScale)
        }
        const slabTopY =
          typeof getFloorSlabTopY === 'function' ? getFloorSlabTopY(pin.floor_index) : pin.position_y
        // Interpret stored `position_y` as an offset from the slab top.
        // This keeps pins stable when floor stacking / slab markers change.
        const baseY = slabTopY + pin.position_y + (Number.isFinite(pinLift) ? pinLift : 0.35)
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
        const pinScale = typeof getPinScale === 'function' ? Number(getPinScale()) : 1
        const pinLift = typeof getPinLift === 'function' ? Number(getPinLift()) : 0.35
        if (Number.isFinite(pinScale) && pinScale > 0) {
          mesh.scale.setScalar(0.7 * pinScale)
        }
        mesh.position.copy(cluster.worldPosition)
        mesh.position.y += (Number.isFinite(pinLift) ? pinLift : 0.35) + 0.05
        mesh.userData.floorIndex = state.activeFloor
        pinGroup.add(mesh)
      }
    })
    updatePinVisibility()
    needRender()
  }

  function updatePinVisibility() {
    pinGroup.children.forEach((mesh) => {
      mesh.visible = mesh.userData.floorIndex === state.activeFloor
    })
  }

  // ── Pending pin lifecycle ───────────────────────────────────
  function placePendingPin({ floorIndex, position }) {
    removePendingPin()
    const slabTopY = typeof getFloorSlabTopY === 'function' ? getFloorSlabTopY(floorIndex) : 0
    const draft = {
      id: `local-${Date.now()}`,
      floor_index: floorIndex,
      position_x: position.x,
      // Store Y as offset from slab top (see renderPins()).
      position_y: position.y - slabTopY,
      position_z: position.z,
      wellbeing: getWellbeingValue(state.questions, state.questionElements),
      reasons: [],
      note: '',
      approved: 0,
      group_key: null,
    }
    const mesh = createPinMesh(draft, colorMode.getPinColor(draft))
    const pinScale = typeof getPinScale === 'function' ? Number(getPinScale()) : 1
    const pinLift = typeof getPinLift === 'function' ? Number(getPinLift()) : 0.35
    if (Number.isFinite(pinScale) && pinScale > 0) {
      mesh.scale.setScalar(pinScale)
    }
    const baseY = slabTopY + draft.position_y + (Number.isFinite(pinLift) ? pinLift : 0.35)
    mesh.position.set(position.x, baseY, position.z)
    mesh.userData.floorIndex = floorIndex
    mesh.userData.baseY = baseY
    pinGroup.add(mesh)
    state.pendingMesh = mesh
    needRender()
  }

  function removePendingPin() {
    if (!state.pendingMesh) return
    pinGroup.remove(state.pendingMesh)
    state.pendingMesh = null
    needRender()
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
  function renderPinView(pin) {
    // Hero shows the globally configured "pin color" slider (not necessarily wellbeing).
    const heroQuestion =
      colorMode.getActiveColorQuestion() || state.questions.find((q) => q.key === 'wellbeing') || null
    const heroKey = heroQuestion?.key || 'wellbeing'
    const heroRaw = (heroKey === 'wellbeing') ? pin.wellbeing : (
      heroKey === 'note' ? pin.note :
      heroKey === 'group' ? pin.group_key :
      heroKey === 'reasons' ? safeParseReasons(pin.reasons) :
      ((pin && typeof pin.generic_answers === 'object' && pin.generic_answers) ? pin.generic_answers : {})[heroKey]
    )
    viewWellbeingLabel.textContent = heroQuestion?.label || t('ui.viewWellbeing')
    viewWellbeing.textContent = heroQuestion?.type === 'slider'
      ? formatPercent(heroRaw)
      : String(heroRaw ?? t('ui.empty'))
    viewScoreDot.style.background = colorMode.getPinColor(pin).getStyle()
    viewTimestamp.textContent = formatTimestamp(pin.created_at)
    viewTimestamp.dataset.pending = isLocalPin(state, pin.id) && pin.approved === 0 ? 'true' : 'false'

    // Station (only if actually set)
    const stationKey = pin?.station_key ? String(pin.station_key) : ''
    const showStation = stationKey && stationKey !== 'default' && stationKey !== 'null' && stationKey !== 'undefined'
    viewStation.textContent = showStation ? `Station: ${stationKey}` : ''

    // Render answered questions in asked order (fully dynamic).
    const generic =
      (pin && typeof pin.generic_answers === 'object' && pin.generic_answers) ? pin.generic_answers : {}
    const askedRaw = Array.isArray(pin.asked_questions) ? pin.asked_questions : []
    // Some pins (especially freshly created ones returned from create endpoint) may not include asked_questions yet.
    // Fall back to the currently loaded questionnaire order so rendering matches other pins.
    const asked = askedRaw.length ? askedRaw : (state.questions || []).map((q) => q.key).filter(Boolean)
    const answeredRows = []

    const getRawAnswerForKey = (key) => {
      if (key === 'wellbeing') return pin.wellbeing
      if (key === 'note') return pin.note
      if (key === 'group') return pin.group_key
      if (key === 'reasons') return safeParseReasons(pin.reasons)
      return generic[key]
    }
    const isAnswered = (value) => {
      if (value == null) return false
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'object') return Object.keys(value).length > 0
      if (typeof value === 'string') {
        const s = value.trim()
        if (!s) return false
        if (s[0] === '{') {
          try {
            const parsed = JSON.parse(s)
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              return Object.keys(parsed).length > 0
            }
          } catch {
            // ignore
          }
        }
        return true
      }
      return String(value).trim() !== ''
    }
    const formatAnswered = (question, raw) => {
      if (!question) return String(raw)
      if (question.type === 'slider') {
        const min = Number.isFinite(Number(question.config?.min)) ? Number(question.config.min) : 0
        const max = Number.isFinite(Number(question.config?.max)) ? Number(question.config.max) : 1
        const low = question.legend_low || ''
        const high = question.legend_high || ''
        const v = fromPercentValue(raw, question.config || {})
        const n = (max === min) ? 0.5 : Math.max(0, Math.min(1, (Number(v) - min) / (max - min)))
        const pct = Math.round(n * 100)
        const legend = (low || high)
          ? `<div class="ui-pin-view-slider-legend"><span>${low}</span><span>${high}</span></div>`
          : ''
        return `<div class="ui-pin-view-slider">${legend}<div class="ui-pin-view-slider-bar" aria-hidden="true"><div class="ui-pin-view-slider-fill" style="width:${pct}%"></div></div></div>`
      }
      if (question.type === 'text') return String(raw || '').trim() || t('ui.empty')
      if (question.type === 'multi') {
        const arr = Array.isArray(raw) ? raw : (raw ? [raw] : [])
        return arr.length ? arr.map((k) => getOptionLabel(state, question.key, k)).join(', ') : t('ui.empty')
      }
      if (question.type === 'influence') {
        let obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) obj = parsed
          } catch {
            // ignore
          }
        }
        const keys = Object.keys(obj)
        if (!keys.length) return t('ui.empty')
        const min = Number.isFinite(Number(question.config?.min)) ? Number(question.config.min) : -1
        const max = Number.isFinite(Number(question.config?.max)) ? Number(question.config.max) : 1
        const neg = question.legend_negative || ''
        const pos = question.legend_positive || ''
        const clamp01 = (x) => Math.max(0, Math.min(1, x))
        const norm = (v) => (max === min ? 0.5 : (v - min) / (max - min))

        const legend = (neg || pos)
          ? `<div class="ui-pin-view-influence-legend"><span><span>${neg}</span><span>${pos}</span></span><span></span></div>`
          : ''

        const rows = keys
          .map((optKey) => {
            const label = getOptionLabel(state, question.key, optKey)
            const v = Number(obj[optKey])
            // Normalize to 0..1 with a robust heuristic:
            // - If config suggests a signed range (e.g. -1..1) but stored values are 0..1 (center=0.5),
            //   treat the value as already-normalized.
            // - Otherwise normalize using configured min/max.
            let t = 0.5
            if (Number.isFinite(v)) {
              const looksNormalized01 = v >= 0 && v <= 1
              const configIs01 = min >= 0 && max <= 1
              t = (looksNormalized01 && !configIs01) ? clamp01(v) : clamp01(norm(v))
            }
            const signed = t - 0.5
            // Fill should be relative to the full width: max half-range => 50%.
            const pct = Math.round(Math.min(0.5, Math.abs(signed)) * 100) // 0..50 from center
            const negPct = signed < 0 ? pct : 0
            const posPct = signed > 0 ? pct : 0
            return `
              <div class="ui-pin-view-influence-row">
                <div class="ui-pin-view-influence-label">${label}</div>
                <div class="ui-pin-view-influence-bar" aria-hidden="true">
                  <div class="ui-pin-view-influence-fill neg" style="width:${negPct}%"></div>
                  <div class="ui-pin-view-influence-fill pos" style="width:${posPct}%"></div>
                  <div class="ui-pin-view-influence-center"></div>
                </div>
              </div>
            `
          })
          .join('')

        return `<div class="ui-pin-view-influence">${legend}${rows}</div>`
      }
      return String(raw)
    }

    asked.forEach((key) => {
      if (key === heroKey) return
      const question = state.questions.find((q) => q.key === key) || null
      const raw = getRawAnswerForKey(key)
      if (!isAnswered(raw)) return
      const label = question?.label || key
      const value = formatAnswered(question, raw)
      answeredRows.push({ key, label, value })
    })

    viewAnswers.innerHTML = answeredRows.length
      ? answeredRows
        .map((row) =>
          `<div class="ui-pin-view-section"><span class="ui-pin-view-label">${row.label}</span><span class="ui-pin-view-value">${row.value}</span></div>`
        )
        .join('')
      : `<div class="ui-pin-view-section"><span class="ui-pin-view-value">${t('ui.empty')}</span></div>`
  }

  async function openForm({ floorIndex, position, pin }) {
    const token = ++viewLoadToken
    form.reset()
    clearFormError(form)
    form.dataset.mode = pin ? 'view' : 'create'
    state.viewPin = pin || null

    if (pin) {
      // Ensure we show labels/options from the right questionnaire (station-specific).
      try {
        await ensureQuestionsForPin(pin)
      } catch {
        // fall back to whatever is currently loaded
      }
      if (token !== viewLoadToken) return

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
      renderPinView(pin)
    } else {
      disableQuestions(false, state.questionElements)
      // Influence questions must start collapsed/disabled unless user explicitly enables them.
      // `form.reset()` doesn't reliably reset our dynamically wired influence rows.
      state.questions
        .filter((q) => q && q.type === 'influence')
        .forEach((q) => setQuestionValue(q.key, {}, state.questions, state.questionElements))
      submitButton.disabled = false
      submitButton.classList.remove('is-hidden')
      formContent.classList.remove('is-hidden')
      viewPanel.classList.add('is-hidden')
      form.dataset.floorIndex = floorIndex
      form.dataset.x = position.x
      // Store Y as offset from slab top (API payload uses `y`).
      const slabTopY = typeof getFloorSlabTopY === 'function' ? getFloorSlabTopY(floorIndex) : 0
      form.dataset.y = position.y - slabTopY
      form.dataset.z = position.z
    }

    colorMode.updatePreviewColor()
    backdrop.classList.add('is-visible')
    needRender()
  }

  function closeForm() {
    backdrop.classList.remove('is-visible')
    backdrop.classList.remove('is-longpress')
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
    needRender()
  }
}
