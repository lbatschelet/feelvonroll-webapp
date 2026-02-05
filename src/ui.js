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

  const currentButton = document.createElement('button')
  currentButton.type = 'button'
  currentButton.className = 'ui-language-current'
  ui.appendChild(currentButton)

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

  return { ui, setActiveLanguage, setAriaLabel, setLanguages: renderLanguages }
}
