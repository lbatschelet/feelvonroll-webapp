export function createFloorSelector(maxBasements, maxAboveGroundFloors) {
  const ui = document.createElement('div')
  ui.className = 'ui ui-floor'

  const floorsList = document.createElement('div')
  floorsList.className = 'ui-floor-list'
  ui.appendChild(floorsList)

  const floorButtons = []
  for (let i = -maxBasements; i < maxAboveGroundFloors; i += 1) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ui-floor-button'
    button.textContent = String(i)
    button.dataset.index = String(i)
    floorsList.appendChild(button)
    floorButtons.push(button)
  }

  return { floorButtons, ui }
}

export function createLanguageSwitcher({ languages, activeLanguage, ariaLabel, onChange }) {
  const ui = document.createElement('div')
  ui.className = 'ui ui-language'
  ui.setAttribute('role', 'group')
  if (ariaLabel) {
    ui.setAttribute('aria-label', ariaLabel)
  }

  const buttons = new Map()

  function renderLanguages(nextLanguages) {
    ui.querySelectorAll('.ui-language-button').forEach((button) => button.remove())
    buttons.clear()
    nextLanguages.forEach((language) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'ui-language-button'
      button.textContent = language.label
      button.dataset.lang = language.id
      button.addEventListener('click', () => onChange(language.id))
      ui.appendChild(button)
      buttons.set(language.id, button)
    })
  }

  function setActiveLanguage(language) {
    buttons.forEach((button, lang) => {
      button.classList.toggle('active', lang === language)
    })
  }

  function setAriaLabel(label) {
    if (!label) return
    ui.setAttribute('aria-label', label)
  }

  renderLanguages(languages)
  setActiveLanguage(activeLanguage)

  return { ui, setActiveLanguage, setAriaLabel, setLanguages: renderLanguages }
}
