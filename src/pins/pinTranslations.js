/**
 * Pin UI translation helpers.
 * Applies i18n strings to pin panel and view-panel elements.
 *
 * All functions are pure — they take UI refs and state as arguments.
 * Exports: applyStaticTranslations, applyQuestionLabels, refreshViewTexts.
 */
import { t } from '../i18n'
import { formatTimestamp } from '../utils/format'
import { safeParseReasons } from './pinForm'
import { getOptionLabel } from './pinState'

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
  refs.viewReasonsLabel.textContent = t('ui.viewReasons')
  refs.viewGroupLabel.textContent = t('questions.group.label')
  refs.viewNoteLabel.textContent = t('ui.viewNote')
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
    if (question.key === 'reasons') {
      refs.viewReasonsLabel.textContent = question.label || t('ui.viewReasons')
    }
    if (question.key === 'group') {
      refs.viewGroupLabel.textContent = question.label || t('questions.group.label')
    }
    if (question.key === 'note') {
      refs.viewNoteLabel.textContent = question.label || t('ui.viewNote')
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
  const reasons = safeParseReasons(state.viewPin.reasons)
  const group = state.viewPin.group_key || ''
  refs.viewReasons.textContent = reasons.length
    ? reasons.map((key) => getOptionLabel(state, 'reasons', key)).join(', ')
    : t('ui.empty')
  refs.viewGroup.textContent = group ? getOptionLabel(state, 'group', group) : t('ui.empty')
  refs.viewNote.textContent = state.viewPin.note?.trim() ? state.viewPin.note : t('ui.empty')
  refs.viewTimestamp.textContent = formatTimestamp(state.viewPin.created_at)
}
