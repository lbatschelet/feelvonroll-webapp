/**
 * Renders the success state after a successful issue submission.
 * Single responsibility: success view DOM construction.
 *
 * Exports: renderSuccess.
 */

/**
 * Replace the card content with a success message.
 *
 * @param {HTMLElement} cardElement — the `.issue-card` element
 * @param {object} options
 * @param {(key: string) => string} options.t — translation function
 * @param {() => void} options.onSubmitAnother
 */
export function renderSuccess(cardElement, { t, onSubmitAnother }) {
  cardElement.innerHTML = `
    <div class="issue-success">
      <div class="success-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h2>${t('success.title')}</h2>
      <p>${t('success.message')}</p>
      <p style="margin-top:1rem"><a href="#" id="submitAnother">${t('success.another')}</a></p>
    </div>
  `

  document.getElementById('submitAnother').addEventListener('click', (event) => {
    event.preventDefault()
    onSubmitAnother()
  })
}
