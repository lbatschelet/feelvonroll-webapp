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

  // Constrain the backdrop to the visible area when the virtual keyboard opens.
  // With interactive-widget=overlays-content the page doesn't resize,
  // so we use visualViewport to shrink only the backdrop while #app stays put.
  if (window.visualViewport) {
    const fullHeight = window.innerHeight
    const syncToViewport = () => {
      const vv = window.visualViewport
      const keyboardOpen = vv.height < fullHeight * 0.85
      if (keyboardOpen) {
        backdrop.style.height = vv.height + 'px'
        backdrop.style.top = vv.offsetTop + 'px'
      } else {
        // Keyboard closed — reset to full viewport
        backdrop.style.height = ''
        backdrop.style.top = ''
      }
    }
    window.visualViewport.addEventListener('resize', syncToViewport)
    window.visualViewport.addEventListener('scroll', syncToViewport)
  }

  return { backdrop, modal, closeButton }
}
