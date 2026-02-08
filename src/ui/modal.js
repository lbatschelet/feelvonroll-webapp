/**
 * Generic modal backdrop/container factory.
 * Exports: createModal.
 */
import { t } from '../i18n'

/**
 * Creates a modal backdrop with close button.
 * Appends the backdrop to document.body.
 * @returns {{ backdrop, modal, closeButton }}
 */
export function createModal() {
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

  document.body.appendChild(backdrop)

  return { backdrop, modal, closeButton }
}
