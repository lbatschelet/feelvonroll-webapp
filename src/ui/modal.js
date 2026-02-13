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

  // ── iOS Safari keyboard fix ──────────────────────────────────────
  // iOS Safari does NOT support interactive-widget=overlays-content.
  // When the virtual keyboard opens it scrolls the page, displacing
  // fixed-position elements.  We counter this by:
  //   1. Forcing window.scrollTo(0,0) whenever the modal is visible
  //   2. Keeping the backdrop full-screen (so the dark overlay always
  //      covers the entire screen) and only repositioning the modal
  //      to fit above the keyboard
  //   3. Resetting scroll after input focus (iOS auto-scrolls on focus)

  let isVisible = false

  // Track visibility via class changes
  const observer = new MutationObserver(() => {
    const nowVisible = backdrop.classList.contains('is-visible')
    if (nowVisible && !isVisible) {
      isVisible = true
    } else if (!nowVisible && isVisible) {
      isVisible = false
      window.scrollTo(0, 0)
      // Reset modal adjustments
      modal.style.maxHeight = ''
      backdrop.style.alignItems = ''
      backdrop.style.paddingTop = ''
    }
  })
  observer.observe(backdrop, { attributes: true, attributeFilter: ['class'] })

  // Prevent iOS from keeping the page scrolled when keyboard opens
  window.addEventListener('scroll', () => {
    if (isVisible) window.scrollTo(0, 0)
  }, { passive: true })

  // After iOS auto-scrolls to a focused input, immediately reset
  backdrop.addEventListener('focusin', () => {
    requestAnimationFrame(() => {
      window.scrollTo(0, 0)
    })
  })

  // Keep backdrop full-screen; reposition the modal within it when
  // the virtual keyboard is present so it fits in the visible area.
  if (window.visualViewport) {
    const syncToViewport = () => {
      if (!isVisible) return
      const vv = window.visualViewport
      const keyboardOpen = vv.height < window.innerHeight * 0.85
      if (keyboardOpen) {
        window.scrollTo(0, 0)
        // Constrain modal height to visible area (minus padding)
        modal.style.maxHeight = (vv.height - 32) + 'px'
        // Align to the top so the modal stays above the keyboard
        backdrop.style.alignItems = 'flex-start'
        backdrop.style.paddingTop = Math.max(0, vv.offsetTop + 16) + 'px'
      } else {
        modal.style.maxHeight = ''
        backdrop.style.alignItems = ''
        backdrop.style.paddingTop = ''
      }
    }
    window.visualViewport.addEventListener('resize', syncToViewport)
    window.visualViewport.addEventListener('scroll', syncToViewport)
  }

  return { backdrop, modal, closeButton }
}
