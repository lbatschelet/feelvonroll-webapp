/**
 * Pin UI translation helpers.
 * Applies i18n strings to pin panel and view-panel elements.
 *
 * All functions are pure — they take UI refs and state as arguments.
 * Exports: applyStaticTranslations, applyQuestionLabels, refreshViewTexts.
 */
import { t } from '../i18n'
import { formatTimestamp } from '../utils/format'

/**
 * Apply static i18n strings to the pin panel UI elements.
 * @param {object} refs - UI element references.
 * @param {object} state - Pin state (reads pinMode).
 */
export function applyStaticTranslations(refs, state) {
  refs.toggleButton.textContent = state.pinMode ? t('ui.pinToggleActive') : t('ui.pinToggleIdle')
  refs.closeButton.setAttribute('aria-label', t('ui.close'))
  refs.submitButton.textContent = t('ui.save')
  refs.viewWellbeingLabel.textContent = t('ui.viewWellbeing')
  if (refs.viewStation) refs.viewStation.textContent = ''
  refs.viewPending.textContent = t('ui.viewPending')
}

/**
 * Update question labels and view-panel labels from current question data.
 * @param {object} state - Pin state (reads questions, questionElements, optionsByQuestion).
 * @param {object} refs - UI element references (viewWellbeingLabel, etc.).
 * @param {Function} updateColorModeButtons - Callback to refresh color-mode buttons.
 */
export function applyQuestionLabels(state, refs, updateColorModeButtons) {
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
        item.label.textContent = getOptionLabel(state, question.key, item.key)
      })
    }
    if (question.key === 'wellbeing') {
      refs.viewWellbeingLabel.textContent = question.label || t('ui.viewWellbeing')
    }
  })
  updateColorModeButtons()
}

/**
 * Refresh the view panel texts when language changes while a pin is open.
 * @param {object} state - Pin state (reads viewPin, optionsByQuestion).
 * @param {object} refs - UI element references (viewReasons, viewGroup, viewNote, viewTimestamp).
 */
export function refreshViewTexts(state, refs) {
  if (!state.viewPin) return
  const reasonKeys = normalizeReasonKeys(state.viewPin.reasons)
  const reasonLabels = reasonKeys
    .map((key) => getOptionLabel(state, 'reasons', key))
    .filter(Boolean)
  refs.viewReasons.textContent = reasonLabels.join(', ')
  refs.viewGroup.textContent = getOptionLabel(state, 'group', state.viewPin.group_key || '')
  refs.viewNote.textContent = state.viewPin.note || ''
  refs.viewTimestamp.textContent = formatTimestamp(state.viewPin.created_at)
}

function getOptionLabel(state, questionKey, optionKey) {
  if (!optionKey) return ''
  const options = state.optionsByQuestion?.get(questionKey)
  if (!Array.isArray(options)) return optionKey
  const match = options.find((option) => option.key === optionKey || option.option_key === optionKey)
  return match?.label || optionKey
}

function normalizeReasonKeys(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      return Array.isArray(parsed) ? parsed : [trimmed]
    } catch {
      return [trimmed]
    }
  }
  return []
}
