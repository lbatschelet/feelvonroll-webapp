/**
 * Pin panel — assembles the complete pin UI (toggle, color mode, legend, modal).
 * Exports: createPinUi.
 */
import { t } from '../i18n'
import { createModal } from '../ui/modal'
import { createPinViewPanel } from './pinViewPanel'

/**
 * Creates the full pin panel UI and returns all element references.
 * @returns {object} All UI element references needed by the pin system.
 */
export function createPinUi() {
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

  // Modal with form
  const { backdrop, modal, closeButton } = createModal()

  const form = document.createElement('form')
  form.className = 'ui-form'
  modal.appendChild(form)

  const formContent = document.createElement('div')
  formContent.className = 'ui-form-content'
  form.appendChild(formContent)

  // View panel for existing pins
  const viewRefs = createPinViewPanel()
  form.appendChild(viewRefs.viewPanel)

  const error = document.createElement('div')
  error.className = 'ui-form-error'
  form.appendChild(error)

  const submitButton = document.createElement('button')
  submitButton.type = 'submit'
  submitButton.className = 'ui-form-submit'
  submitButton.textContent = t('ui.save')
  form.appendChild(submitButton)

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
    ...viewRefs,
  }
}
