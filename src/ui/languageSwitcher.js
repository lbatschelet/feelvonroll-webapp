/**
 * Language switcher UI component with info button.
 * Exports: createLanguageSwitcher.
 */
export function createLanguageSwitcher({ languages, activeLanguage, ariaLabel, onChange }) {
  const ui = document.createElement('div')
  ui.className = 'ui ui-language'
  ui.setAttribute('role', 'group')
  if (ariaLabel) {
    ui.setAttribute('aria-label', ariaLabel)
  }

  const topRow = document.createElement('div')
  topRow.className = 'ui-language-top'

  const currentButton = document.createElement('button')
  currentButton.type = 'button'
  currentButton.className = 'ui-language-current'
  topRow.appendChild(currentButton)

  const infoButton = document.createElement('button')
  infoButton.type = 'button'
  infoButton.className = 'ui-info-button'
  infoButton.setAttribute('aria-label', 'About')
  infoButton.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  `
  topRow.appendChild(infoButton)

  ui.appendChild(topRow)

  const list = document.createElement('div')
  list.className = 'ui-language-list'
  ui.appendChild(list)

  const buttons = new Map()
  let currentLanguage = activeLanguage

  function renderLanguages(nextLanguages) {
    list.innerHTML = ''
    buttons.clear()
    nextLanguages.forEach((language) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'ui-language-button'
      button.textContent = `${language.label} (${String(language.id).toUpperCase()})`
      button.dataset.lang = language.id
      button.addEventListener('click', () => {
        onChange(language.id)
        setOpen(false)
      })
      list.appendChild(button)
      buttons.set(language.id, button)
    })
  }

  function setActiveLanguage(language) {
    currentLanguage = language
    currentButton.textContent = String(language || '').toUpperCase()
    buttons.forEach((button, lang) => {
      button.classList.toggle('active', lang === language)
    })
  }

  function setAriaLabel(label) {
    if (!label) return
    ui.setAttribute('aria-label', label)
  }

  function setOpen(open) {
    ui.classList.toggle('is-open', open)
  }

  currentButton.addEventListener('click', (event) => {
    event.stopPropagation()
    setOpen(!ui.classList.contains('is-open'))
  })

  document.addEventListener('click', (event) => {
    if (!ui.contains(event.target)) {
      setOpen(false)
    }
  })

  renderLanguages(languages)
  setActiveLanguage(activeLanguage)

  return { ui, infoButton, setActiveLanguage, setAriaLabel, setLanguages: renderLanguages }
}
