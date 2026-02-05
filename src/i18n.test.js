import { describe, expect, it } from 'vitest'
import { mergeTranslations, setLanguage, t } from './i18n.js'

describe('i18n', () => {
  it('returns German strings by default when set', () => {
    setLanguage('de')
    expect(t('ui.save')).toBe('Speichern')
  })

  it('returns English strings when set', () => {
    setLanguage('en')
    expect(t('ui.save')).toBe('Save')
  })

  it('falls back to key when missing', () => {
    setLanguage('en')
    expect(t('missing.key')).toBe('missing.key')
  })

  it('merges translations for a language', () => {
    setLanguage('en')
    mergeTranslations('en', { 'options.reasons.licht': 'Light (API)' })
    expect(t('options.reasons.licht')).toBe('Light (API)')
  })
})
