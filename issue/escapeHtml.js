/**
 * Escapes a string for safe insertion into HTML.
 *
 * Exports: escapeHtml.
 */
export function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
