/**
 * Floor selector UI component.
 * Exports: createFloorSelector.
 */
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
