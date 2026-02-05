const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export async function fetchPins(floorIndex = null) {
  const url =
    floorIndex === null ? `${API_BASE}/pins.php` : `${API_BASE}/pins.php?floor=${floorIndex}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json()
}

export async function createPin(payload) {
  const response = await fetch(`${API_BASE}/pins.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json()
}

export async function fetchTranslations({ lang, prefix } = {}) {
  const params = new URLSearchParams()
  if (lang) params.set('lang', lang)
  if (prefix) params.set('prefix', prefix)
  const query = params.toString()
  const url = `${API_BASE}/translations.php${query ? `?${query}` : ''}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json()
}

export async function fetchQuestions({ lang } = {}) {
  const params = new URLSearchParams()
  if (lang) params.set('lang', lang)
  const query = params.toString()
  const url = `${API_BASE}/questions.php${query ? `?${query}` : ''}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json()
}

export async function fetchLanguages() {
  const response = await fetch(`${API_BASE}/languages.php`)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json()
}

async function parseError(response) {
  let text = ''
  try {
    text = await response.text()
    const json = JSON.parse(text)
    if (json && json.error) {
      return `HTTP ${response.status}: ${json.error}`
    }
  } catch (error) {
    // ignore parsing errors
  }

  return `HTTP ${response.status}: ${text || response.statusText || 'Unknown error'}`
}
