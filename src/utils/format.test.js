import { describe, expect, it } from 'vitest'
import { setLanguage } from '../i18n'
import { formatPercent, formatTimestamp } from './format'

describe('formatPercent', () => {
  it('formats a number as percent', () => {
    setLanguage('en')
    expect(formatPercent(42.567)).toBe('42.57%')
  })

  it('formats zero', () => {
    setLanguage('en')
    expect(formatPercent(0)).toBe('0%')
  })

  it('returns dash for non-finite input', () => {
    setLanguage('en')
    expect(formatPercent(NaN)).toBe('—')
    expect(formatPercent(undefined)).toBe('—')
    expect(formatPercent('abc')).toBe('—')
  })
})

describe('formatTimestamp', () => {
  it('formats a valid ISO timestamp', () => {
    setLanguage('en')
    const result = formatTimestamp('2025-06-15T10:30:00Z')
    expect(result).toBeTruthy()
    expect(result).not.toBe('—')
  })

  it('returns dash for empty input', () => {
    expect(formatTimestamp('')).toBe('—')
    expect(formatTimestamp(null)).toBe('—')
    expect(formatTimestamp(undefined)).toBe('—')
  })

  it('returns original value for invalid date', () => {
    expect(formatTimestamp('not-a-date')).toBe('not-a-date')
  })
})
