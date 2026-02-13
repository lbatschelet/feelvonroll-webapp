/**
 * Issue page entry point (composition root).
 * Wires together debug collection, form rendering, API client,
 * and success view. Contains no business logic itself.
 */
import './style.css'
import { collectDebugInfo } from './debugCollector'
import { createIssueApi } from './issueApi'
import { renderIssueForm } from './issueFormRenderer'
import { renderSuccess } from './successRenderer'

// ── Configuration ────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const params = new URLSearchParams(window.location.search)
const context = {
  source: params.get('source') || 'direct',
  language: params.get('lang') || navigator.language?.slice(0, 2) || 'en',
}

// ── Dependencies ─────────────────────────────────────────────
const api = createIssueApi({ apiBase: API_BASE })
const app = document.querySelector('#app')

// ── Boot ─────────────────────────────────────────────────────
showForm()

function showForm() {
  const debugInfo = collectDebugInfo(context)

  renderIssueForm(app, {
    debugInfo,
    onSubmit: async (formData) => {
      const payload = {
        ...formData,
        debug: collectDebugInfo(context), // fresh snapshot at submit time
      }
      const result = await api.submitIssue(payload)
      const card = app.querySelector('.issue-card')
      renderSuccess(card, {
        issueUrl: result.issue_url,
        onSubmitAnother: showForm,
      })
    },
  })
}
