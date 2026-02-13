/**
 * Renders the issue submission form and binds its events.
 * Single responsibility: form DOM construction and user interaction.
 *
 * Exports: renderIssueForm.
 */
import { escapeHtml } from './escapeHtml'

const GITHUB_ISSUES_URL = 'https://github.com/lbatschelet/feelvonroll/issues'
const GITHUB_LICENSE_URL = 'https://github.com/lbatschelet/feelvonroll/blob/main/LICENSE'

const LANGUAGE_LABELS = { de: 'Deutsch', en: 'English' }

/**
 * @param {HTMLElement} container
 * @param {object} options
 * @param {Record<string, string>} options.debugInfo
 * @param {(key: string) => string} options.t — translation function
 * @param {string[]} options.languages — supported language codes
 * @param {string} options.currentLang
 * @param {(lang: string) => void} options.onLangChange
 * @param {(formData: object) => Promise<void>} options.onSubmit
 */
export function renderIssueForm(container, { debugInfo, t, languages, currentLang, onLangChange, onSubmit }) {
  const year = new Date().getFullYear()

  container.innerHTML = `
    <nav class="issue-nav">
      <a href="/" class="issue-logo" title="feelvonRoll"><em>feel</em><strong>vonRoll</strong></a>
      <span class="lang-toggle" id="langToggle">${currentLang.toUpperCase()}</span>
    </nav>

    <header class="issue-header">
      <h1>${t('page.title')}</h1>
      <p>${t('page.subtitle')}</p>
    </header>

    <div class="issue-card">
      <form class="issue-form" id="issueForm" novalidate>

        <div class="form-group">
          <label for="category">${escapeHtml(t('category.label'))}</label>
          <select id="category" name="category" required>
            <option value="bug">${escapeHtml(t('category.bug'))}</option>
            <option value="feature">${escapeHtml(t('category.feature'))}</option>
            <option value="other">${escapeHtml(t('category.other'))}</option>
          </select>
        </div>

        <div class="form-group">
          <label for="title">${escapeHtml(t('title.label'))} <span class="hint">${escapeHtml(t('title.hint'))}</span></label>
          <input type="text" id="title" name="title" placeholder="${escapeHtml(t('title.placeholder.bug'))}" required />
        </div>

        <div class="form-group">
          <label for="description">${escapeHtml(t('description.label'))} <span class="hint">${escapeHtml(t('description.hint'))}</span></label>
          <textarea id="description" name="description" rows="5" placeholder="${escapeHtml(t('description.placeholder.bug'))}" required></textarea>
        </div>

        <div class="form-group" id="stepsGroup">
          <label for="steps">${escapeHtml(t('steps.label'))} <span class="hint">${escapeHtml(t('steps.hint'))}</span></label>
          <textarea id="steps" name="steps" rows="3" placeholder="${escapeHtml(t('steps.placeholder'))}"></textarea>
        </div>

        <div class="form-group form-confirm">
          <label for="website">Please leave this field empty</label>
          <input type="text" id="website" name="website" tabindex="-1" autocomplete="off" />
        </div>

        <details class="debug-details">
          <summary>${escapeHtml(t('debug.summary'))}</summary>
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

        <button type="submit" class="submit-btn" id="submitBtn">
          <svg class="send-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          ${escapeHtml(t('submit'))}
        </button>
      </form>
    </div>

    <footer class="app-footer">
      <div class="footer-left">
        <span class="footer-credit">
          &copy; ${year}
          <a href="https://lukasbatschelet.ch" target="_blank" rel="noopener">Lukas Batschelet</a>
          ${escapeHtml(t('footer.for'))}
          <a href="https://www.phbern.ch" target="_blank" rel="noopener" class="footer-phbern" title="PHBern"><strong>PH</strong>&thinsp;Bern</a>
        </span>
        <span class="footer-license">
          ${escapeHtml(t('footer.license'))} <a href="${GITHUB_LICENSE_URL}" target="_blank" rel="noopener">AGPL-3.0</a>
        </span>
      </div>
      <a class="footer-bug" href="${GITHUB_ISSUES_URL}" target="_blank" rel="noopener" title="${escapeHtml(t('footer.issues'))}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
        ${escapeHtml(t('footer.issues'))}
      </a>
    </footer>
  `

  bindFormEvents({ t, languages, currentLang, onLangChange, onSubmit })
}

/**
 * Bind category toggle, language switcher, and form submit.
 */
function bindFormEvents({ t, languages, currentLang, onLangChange, onSubmit }) {
  const categorySelect = document.getElementById('category')
  const stepsGroup = document.getElementById('stepsGroup')
  const titleInput = document.getElementById('title')
  const descriptionInput = document.getElementById('description')

  function updatePlaceholders() {
    const cat = categorySelect.value
    titleInput.placeholder = t(`title.placeholder.${cat}`)
    descriptionInput.placeholder = t(`description.placeholder.${cat}`)
    stepsGroup.style.display = cat === 'bug' ? '' : 'none'
  }

  categorySelect.addEventListener('change', updatePlaceholders)
  updatePlaceholders()

  // Language toggle — click to switch to the other language
  document.getElementById('langToggle').addEventListener('click', () => {
    const next = languages.find((l) => l !== currentLang) || languages[0]
    onLangChange(next)
  })

  // Form submit
  const form = document.getElementById('issueForm')
  const submitBtn = document.getElementById('submitBtn')
  const errorEl = document.getElementById('formError')

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    errorEl.style.display = 'none'

    const title = form.title.value.trim()
    const description = form.description.value.trim()

    if (!title || !description) {
      showError(errorEl, t('error.required'))
      return
    }

    const formData = {
      category: form.category.value,
      title,
      description,
      steps: form.steps?.value.trim() || '',
      website: form.website.value,
    }

    submitBtn.disabled = true
    submitBtn.classList.add('loading')

    try {
      await onSubmit(formData)
    } catch (error) {
      showError(errorEl, error.message || t('error.generic'))
      submitBtn.disabled = false
      submitBtn.classList.remove('loading')
    }
  })
}

function showError(element, message) {
  element.textContent = message
  element.style.display = ''
}
