/**
 * Renders the issue submission form and binds its events.
 * Single responsibility: form DOM construction and user interaction.
 *
 * Exports: renderIssueForm.
 */
import { escapeHtml } from './escapeHtml'

const GITHUB_ISSUES_URL = 'https://github.com/lbatschelet/feelvonroll/issues'

/**
 * Renders the full form page into the given container.
 *
 * @param {HTMLElement} container — element to render into
 * @param {object} options
 * @param {Record<string, string>} options.debugInfo — pre-collected debug data
 * @param {(formData: object) => Promise<void>} options.onSubmit — called with validated form data
 */
export function renderIssueForm(container, { debugInfo, onSubmit }) {
  container.innerHTML = `
    <header class="issue-header">
      <h1><em>feel</em><strong>vonRoll</strong> — Report an Issue</h1>
      <p>Found a bug or have a feature idea? Let us know — no GitHub account needed.</p>
    </header>

    <div class="issue-card">
      <form class="issue-form" id="issueForm" novalidate>

        <div class="form-group">
          <label for="category">Category</label>
          <select id="category" name="category" required>
            <option value="bug">Bug Report</option>
            <option value="feature">Feature Request</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div class="form-group">
          <label for="title">Title <span class="hint">(required)</span></label>
          <input type="text" id="title" name="title" placeholder="Short summary of the issue" required />
        </div>

        <div class="form-group">
          <label for="description">Description <span class="hint">(required)</span></label>
          <textarea id="description" name="description" rows="5" placeholder="Describe what happened or what you'd like to see…" required></textarea>
        </div>

        <div class="form-group" id="stepsGroup">
          <label for="steps">Steps to Reproduce <span class="hint">(optional)</span></label>
          <textarea id="steps" name="steps" rows="3" placeholder="1. Go to…\n2. Click on…\n3. See error"></textarea>
        </div>

        <div class="form-group">
          <label for="email">Email <span class="hint">(optional, for follow-up)</span></label>
          <input type="email" id="email" name="email" placeholder="your@email.com" />
        </div>

        <div class="form-group form-confirm">
          <label for="website">Please leave this field empty</label>
          <input type="text" id="website" name="website" tabindex="-1" autocomplete="off" />
        </div>

        <details class="debug-details">
          <summary>Debug information (sent automatically)</summary>
          <table class="debug-table">
            <tbody>
              ${Object.entries(debugInfo)
                .map(
                  ([key, value]) =>
                    `<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(String(value))}</td></tr>`
                )
                .join('')}
            </tbody>
          </table>
        </details>

        <div id="formError" class="issue-error" style="display:none"></div>

        <button type="submit" class="submit-btn" id="submitBtn">Submit</button>
      </form>
    </div>

    <div class="issue-footer">
      <a href="${GITHUB_ISSUES_URL}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
        View all issues on GitHub
      </a>
    </div>

    <div class="issue-back">
      <a href="/">&larr; Back to feelvonRoll</a>
    </div>
  `

  bindFormEvents(onSubmit)
}

/**
 * Bind category toggle and form submit events.
 */
function bindFormEvents(onSubmit) {
  const categorySelect = document.getElementById('category')
  const stepsGroup = document.getElementById('stepsGroup')
  categorySelect.addEventListener('change', () => {
    stepsGroup.style.display = categorySelect.value === 'bug' ? '' : 'none'
  })

  const form = document.getElementById('issueForm')
  const submitBtn = document.getElementById('submitBtn')
  const errorEl = document.getElementById('formError')

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    errorEl.style.display = 'none'

    const title = form.title.value.trim()
    const description = form.description.value.trim()

    if (!title || !description) {
      showError(errorEl, 'Please fill in the title and description.')
      return
    }

    const formData = {
      category: form.category.value,
      title,
      description,
      steps: form.steps?.value.trim() || '',
      email: form.email.value.trim(),
      website: form.website.value, // honeypot
    }

    submitBtn.disabled = true
    submitBtn.classList.add('loading')

    try {
      await onSubmit(formData)
    } catch (error) {
      showError(errorEl, error.message || 'Something went wrong. Please try again.')
      submitBtn.disabled = false
      submitBtn.classList.remove('loading')
    }
  })
}

function showError(element, message) {
  element.textContent = message
  element.style.display = ''
}
