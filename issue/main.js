/**
 * Issue page entry point (composition root).
 * Wires together i18n, debug collection, form rendering, API client,
 * and success view. Contains no business logic itself.
 */
import './style.css'
import { createI18n } from './i18n'
import { collectDebugInfo } from './debugCollector'
import { createIssueApi } from './issueApi'
import { renderIssueForm } from './issueFormRenderer'
import { renderSuccess } from './successRenderer'

// ── Configuration ────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const params = new URLSearchParams(window.location.search)
const source = params.get('source') || 'direct'
const langParam = params.get('lang') || navigator.language?.slice(0, 2) || 'en'

// ── Dependencies ─────────────────────────────────────────────
const i18n = createI18n({ initialLang: langParam })
const api = createIssueApi({ apiBase: API_BASE })
const app = document.querySelector('#app')

// Re-render the entire form when language changes
i18n.onLangChange(() => showForm())

// ── Boot ─────────────────────────────────────────────────────
showForm()

function showForm() {
  const context = { source, language: i18n.getLang() }
  const debugInfo = collectDebugInfo(context)

  renderIssueForm(app, {
    debugInfo,
    t: i18n.t,
    languages: i18n.getSupportedLanguages(),
    currentLang: i18n.getLang(),
    onLangChange: (lang) => i18n.setLang(lang),
    onSubmit: async (formData) => {
      const payload = {
        ...formData,
        debug: collectDebugInfo(context),
      }
      const result = await api.submitIssue(payload)
      const card = app.querySelector('.issue-card')
      renderSuccess(card, {
        t: i18n.t,
        onSubmitAnother: showForm,
      })
    },
  })
}
