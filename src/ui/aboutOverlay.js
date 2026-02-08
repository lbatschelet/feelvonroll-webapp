/**
 * About overlay component.
 * Full-screen backdrop with scrollable Markdown content and close button.
 * Exports: createAboutOverlay.
 */

/**
 * Creates the about overlay DOM structure.
 * @returns {{ backdrop: HTMLElement, contentArea: HTMLElement, closeButton: HTMLElement, show: () => void, hide: () => void, setContent: (html: string) => void }}
 */
export function createAboutOverlay() {
  const backdrop = document.createElement('div')
  backdrop.className = 'ui-about-backdrop'

  const dialog = document.createElement('div')
  dialog.className = 'ui-about-dialog'
  backdrop.appendChild(dialog)

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'ui-about-close'
  closeButton.setAttribute('aria-label', 'Close')
  closeButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6l-12 12" />
    </svg>
  `
  dialog.appendChild(closeButton)

  const contentArea = document.createElement('div')
  contentArea.className = 'about-content'
  dialog.appendChild(contentArea)

  closeButton.addEventListener('click', hide)
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) hide()
  })

  function show() {
    backdrop.classList.add('is-visible')
  }

  function hide() {
    backdrop.classList.remove('is-visible')
  }

  function setContent(html) {
    contentArea.innerHTML = html
  }

  document.body.appendChild(backdrop)

  return { backdrop, contentArea, closeButton, show, hide, setContent }
}
