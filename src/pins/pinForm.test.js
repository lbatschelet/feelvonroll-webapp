import { describe, expect, it } from 'vitest'
import { isAnswerEmpty, safeParseReasons } from './pinForm'

describe('isAnswerEmpty', () => {
  it('returns true for empty array', () => {
    expect(isAnswerEmpty([])).toBe(true)
  })

  it('returns false for non-empty array', () => {
    expect(isAnswerEmpty(['a'])).toBe(false)
  })

  it('returns true for null/undefined', () => {
    expect(isAnswerEmpty(null)).toBe(true)
    expect(isAnswerEmpty(undefined)).toBe(true)
  })

  it('returns true for empty/whitespace string', () => {
    expect(isAnswerEmpty('')).toBe(true)
    expect(isAnswerEmpty('   ')).toBe(true)
  })

  it('returns false for non-empty string', () => {
    expect(isAnswerEmpty('hello')).toBe(false)
  })

  it('returns false for number', () => {
    expect(isAnswerEmpty(0)).toBe(false)
    expect(isAnswerEmpty(42)).toBe(false)
  })
})

describe('safeParseReasons', () => {
  it('returns empty array for falsy input', () => {
    expect(safeParseReasons(null)).toEqual([])
    expect(safeParseReasons(undefined)).toEqual([])
    expect(safeParseReasons('')).toEqual([])
  })

  it('returns array as-is', () => {
    expect(safeParseReasons(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('parses JSON string', () => {
    expect(safeParseReasons('["x","y"]')).toEqual(['x', 'y'])
  })

  it('returns empty array for invalid JSON', () => {
    expect(safeParseReasons('not json')).toEqual([])
  })
})
