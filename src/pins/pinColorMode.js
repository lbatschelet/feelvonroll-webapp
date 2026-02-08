/**
 * Pin color-mode management.
 * Manages which question drives pin colors, the legend, mode buttons,
 * and provides helpers to resolve colors for pins and form inputs.
 *
 * Exports: createPinColorMode.
 */
import { fromPercentValue } from '../utils/sliderMath'
import { NEUTRAL_COLOR, getSliderColor } from './pinColors'

/**
 * Creates a color-mode controller bound to the given state and UI refs.
 * @param {object} deps
 * @param {object} deps.state - Shared pin state (mutated in place).
 * @param {HTMLElement} deps.legend - Legend container element.
 * @param {HTMLElement} deps.colorModeRow - Color-mode button row element.
 * @param {HTMLFormElement} deps.form - The pin form element (for preview CSS var).
 * @param {THREE.Group} deps.pinGroup - The THREE.js group containing pin meshes.
 * @returns {object} Color-mode API.
 */
export function createPinColorMode({ state, legend, colorModeRow, form, pinGroup }) {
  return {
    getPinColor,
    getColorFromForm,
    updatePreviewColor,
    refreshPinColors,
    refreshPendingPinColor,
    updateLegend,
    updateColorQuestions,
    updateColorModeButtons,
    getActiveColorQuestion,
    getPinScore,
  }

  /** Resolve the display color for a pin based on the active color question. */
  function getPinColor(pin) {
    const colorQuestion = getActiveColorQuestion()
    if (!colorQuestion) return NEUTRAL_COLOR
    const score = getPinScore(pin, colorQuestion)
    return getSliderColor(score, colorQuestion.config)
  }

  /** Resolve a color from the current form slider value. */
  function getColorFromForm() {
    const colorQuestion = getActiveColorQuestion()
    if (!colorQuestion) return NEUTRAL_COLOR
    const elements = state.questionElements.get(colorQuestion.key)
    return getSliderColor(elements?.input?.value, colorQuestion.config)
  }

  /** Set the --pin-accent CSS variable on the form. */
  function updatePreviewColor() {
    const color = getColorFromForm()
    form.style.setProperty('--pin-accent', color.getStyle())
  }

  /** Re-color all rendered pin orb meshes. */
  function refreshPinColors() {
    pinGroup.children.forEach((mesh) => {
      const pin = mesh.userData.pinData
      const orb = mesh.userData.orb
      if (pin && orb) {
        const color = getPinColor(pin)
        orb.material.color.set(color)
        orb.material.emissive.set(color)
      }
    })
  }

  /** Re-color the pending (draft) pin orb mesh, if any. */
  function refreshPendingPinColor() {
    if (!state.pendingMesh) return
    const orb = state.pendingMesh.userData.orb
    if (!orb) return
    const color = getColorFromForm()
    orb.material.color.set(color)
    orb.material.emissive.set(color)
  }

  /** Rebuild the legend gradient + labels. */
  function updateLegend() {
    legend.innerHTML = ''
    const colorQuestion = getActiveColorQuestion()
    if (!colorQuestion) return
    const gradient = document.createElement('div')
    gradient.className = 'ui-legend-gradient'
    gradient.style.background =
      'linear-gradient(90deg, #6c2fa0, #8b3fc7, #b545c9, #db4ca1, #f25c78, #ff7b54, #ffa042, #ffc639, #ffe145, #fff176)'
    const labels = document.createElement('div')
    labels.className = 'ui-legend-labels'
    labels.innerHTML = `<span>${colorQuestion.legend_low || ''}</span><span>${
      colorQuestion.legend_high || ''
    }</span>`
    legend.appendChild(gradient)
    legend.appendChild(labels)
  }

  /** Determine which slider questions can drive pin color. */
  function updateColorQuestions() {
    const sliderQuestions = state.questions.filter((q) => q.type === 'slider')
    const flagged = sliderQuestions.filter((q) => q.config?.use_for_color)
    let colorQuestions = flagged
    if (!colorQuestions.length) {
      const wellbeing = sliderQuestions.find((q) => q.key === 'wellbeing')
      colorQuestions = wellbeing ? [wellbeing] : sliderQuestions.slice(0, 1)
    }
    state.colorQuestions = colorQuestions
    if (!state.colorQuestionKey || !colorQuestions.some((q) => q.key === state.colorQuestionKey)) {
      state.colorQuestionKey = colorQuestions[0]?.key || null
    }
    updateColorModeButtons()
  }

  /** Rebuild the color-mode toggle buttons. */
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

  /** Look up the currently active color question. */
  function getActiveColorQuestion() {
    if (!state.colorQuestionKey) return null
    return (
      state.colorQuestions.find((q) => q.key === state.colorQuestionKey) ||
      state.questions.find((q) => q.key === state.colorQuestionKey) ||
      null
    )
  }

  /** Resolve a pin's raw score for a given question. */
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
    return fromPercentValue(pin.wellbeing, question.config)
  }
}
