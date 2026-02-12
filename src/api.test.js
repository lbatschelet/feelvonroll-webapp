import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPin, fetchLanguages, fetchPins, fetchQuestions, fetchTranslations } from './api.js'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const buildResponse = ({
  ok = true,
  jsonData = {},
  textData = '',
  status = 200,
  statusText = '',
} = {}) => ({
  ok,
  status,
  statusText,
  json: () => Promise.resolve(jsonData),
  text: () => Promise.resolve(textData),
})

describe('api', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetchPins requests all pins by default', async () => {
    fetch.mockResolvedValue(buildResponse({ jsonData: [] }))

    const result = await fetchPins()

    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/pins.php`)
    expect(result).toEqual([])
  })

  it('fetchPins requests pins for a floor', async () => {
    fetch.mockResolvedValue(buildResponse({ jsonData: [{ id: 1 }] }))

    const result = await fetchPins(2)

    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/pins.php?floor=2`)
    expect(result).toEqual([{ id: 1 }])
  })

  it('fetchPins throws on failure', async () => {
    fetch.mockResolvedValue(
      buildResponse({ ok: false, status: 500, textData: JSON.stringify({ error: 'Boom' }) })
    )

    await expect(fetchPins()).rejects.toThrow('HTTP 500: Boom')
  })

  it('createPin posts payload', async () => {
    fetch.mockResolvedValue(buildResponse({ jsonData: { id: 7 } }))
    const payload = { floor_index: 1, x: 1, y: 2, z: 3, wellbeing: 4 }

    const result = await createPin(payload)

    expect(fetch).toHaveBeenCalledWith(
      `${API_BASE}/pins.php`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    )
    expect(result).toEqual({ id: 7 })
  })

  it('createPin throws on failure', async () => {
    fetch.mockResolvedValue(
      buildResponse({ ok: false, status: 400, textData: JSON.stringify({ error: 'Invalid' }) })
    )

    await expect(createPin({})).rejects.toThrow('HTTP 400: Invalid')
  })

  it('fetchTranslations requests translations with params', async () => {
    fetch.mockResolvedValue(buildResponse({ jsonData: { 'options.reasons.licht': 'Licht' } }))

    const result = await fetchTranslations({ lang: 'de', prefix: 'options.reasons.' })

    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/translations.php?lang=de&prefix=options.reasons.`)
    expect(result).toEqual({ 'options.reasons.licht': 'Licht' })
  })

  it('fetchQuestions requests questionnaire config', async () => {
    fetch.mockResolvedValue(buildResponse({ jsonData: [{ key: 'wellbeing' }] }))

    const result = await fetchQuestions({ lang: 'de' })

    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/questions.php?lang=de`)
    expect(result).toEqual([{ key: 'wellbeing' }])
  })

  it('fetchLanguages requests languages list', async () => {
    fetch.mockResolvedValue(buildResponse({ jsonData: [{ lang: 'de', label: 'Deutsch' }] }))

    const result = await fetchLanguages()

    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/languages.php`, { cache: 'no-store' })
    expect(result).toEqual([{ lang: 'de', label: 'Deutsch' }])
  })
})
