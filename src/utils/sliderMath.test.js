import { describe, expect, it } from 'vitest'
import { toPercentValue, fromPercentValue, getSliderDefault, roundTwo } from './sliderMath'

describe('roundTwo', () => {
  it('rounds to two decimal places', () => {
    expect(roundTwo(1.006)).toBe(1.01)
    expect(roundTwo(1.004)).toBe(1)
    expect(roundTwo(42)).toBe(42)
    expect(roundTwo(0.125)).toBe(0.13)
  })
})

describe('toPercentValue', () => {
  it('converts 0-1 range to percent', () => {
    expect(toPercentValue(0.5)).toBe(50)
    expect(toPercentValue(0)).toBe(0)
    expect(toPercentValue(1)).toBe(100)
  })

  it('converts custom range to percent', () => {
    expect(toPercentValue(5, { min: 0, max: 10 })).toBe(50)
    expect(toPercentValue(10, { min: 0, max: 10 })).toBe(100)
  })

  it('clamps values', () => {
    expect(toPercentValue(2, { min: 0, max: 1 })).toBe(100)
    expect(toPercentValue(-1, { min: 0, max: 1 })).toBe(0)
  })

  it('returns null for non-finite', () => {
    expect(toPercentValue(NaN)).toBeNull()
    expect(toPercentValue('abc')).toBeNull()
  })
})

describe('fromPercentValue', () => {
  it('converts percent back to 0-1 range', () => {
    expect(fromPercentValue(50)).toBe(0.5)
    expect(fromPercentValue(100)).toBe(1)
  })

  it('converts percent back to custom range', () => {
    expect(fromPercentValue(50, { min: 0, max: 10 })).toBe(5)
  })

  it('returns empty string for non-finite', () => {
    expect(fromPercentValue(NaN)).toBe('')
  })
})

describe('getSliderDefault', () => {
  it('returns default value when provided', () => {
    expect(getSliderDefault({ min: 0, max: 1, default: 0.7 })).toBe(0.7)
  })

  it('returns midpoint when no default', () => {
    expect(getSliderDefault({ min: 0, max: 1, step: 0.01 })).toBe(0.5)
  })

  it('clamps default to range', () => {
    expect(getSliderDefault({ min: 0, max: 1, default: 5 })).toBe(1)
    expect(getSliderDefault({ min: 0, max: 1, default: -2 })).toBe(0)
  })
})
