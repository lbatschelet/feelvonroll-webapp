/**
 * Title component displayed top-left.
 * Shows "feelvonRoll" as a standalone heading without a bubble.
 * Exports: createTitleBar.
 */

/**
 * Creates the title DOM element.
 * @returns {{ ui: HTMLElement }}
 */
export function createTitleBar() {
  const ui = document.createElement('h1')
  ui.className = 'ui ui-title'
  ui.innerHTML = '<em>feel</em><strong>vonRoll</strong>'

  return { ui }
}
