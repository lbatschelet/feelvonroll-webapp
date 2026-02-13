/**
 * Renders the success state after a successful issue submission.
 * Single responsibility: success view DOM construction.
 *
 * Exports: renderSuccess.
 */
import { escapeHtml } from './escapeHtml'

/**
 * Replace the card content with a success message.
 *
 * @param {HTMLElement} cardElement — the `.issue-card` element
 * @param {object} options
 * @param {string}   options.issueUrl — URL of the created GitHub issue
 * @param {() => void} options.onSubmitAnother — called when user clicks "Submit another"
 */
export function renderSuccess(cardElement, { issueUrl, onSubmitAnother }) {
  cardElement.innerHTML = `
    <div class="issue-success">
      <div class="success-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h2>Thank you!</h2>
      <p>Your submission has been received and a GitHub issue has been created.</p>
      ${
        issueUrl
          ? `<p><a href="${escapeHtml(issueUrl)}" target="_blank" rel="noopener">View issue on GitHub &rarr;</a></p>`
          : ''
      }
      <p style="margin-top:1rem"><a href="#" id="submitAnother">Submit another</a></p>
    </div>
  `

  document.getElementById('submitAnother').addEventListener('click', (event) => {
    event.preventDefault()
    onSubmitAnother()
  })
}
