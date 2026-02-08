import { describe, expect, it } from 'vitest'
import { createPinState, normalizePin, isLocalPin, bySort, getOptionLabel } from './pinState'

describe('createPinState', () => {
  it('creates state with correct defaults', () => {
    const state = createPinState(3)
    expect(state.activeFloor).toBe(3)
    expect(state.pins).toEqual([])
    expect(state.localPins).toEqual([])
    expect(state.pinMode).toBe(false)
    expect(state.questions).toEqual([])
    expect(state.questionElements).toBeInstanceOf(Map)
    expect(state.optionsByQuestion).toBeInstanceOf(Map)
  })
})

describe('normalizePin', () => {
  it('converts string fields to numbers', () => {
    const pin = normalizePin({
      id: '42',
      floor_index: '2',
      position_x: '1.5',
      position_y: '0.3',
      position_z: '-2.1',
      wellbeing: '75',
      approved: '1',
      reasons: '["a","b"]',
      group_key: 'staff',
    })
    expect(pin.id).toBe(42)
    expect(pin.floor_index).toBe(2)
    expect(pin.position_x).toBe(1.5)
    expect(pin.wellbeing).toBe(75)
    expect(pin.approved).toBe(1)
    expect(pin.reasons).toEqual(['a', 'b'])
    expect(pin.group_key).toBe('staff')
  })

  it('preserves array reasons', () => {
    const pin = normalizePin({ id: '1', floor_index: '0', position_x: '0', position_y: '0', position_z: '0', wellbeing: '50', approved: '0', reasons: ['x'], group_key: null })
    expect(pin.reasons).toEqual(['x'])
  })

  it('defaults group_key to null', () => {
    const pin = normalizePin({ id: '1', floor_index: '0', position_x: '0', position_y: '0', position_z: '0', wellbeing: '50', approved: '0', reasons: [], group_key: '' })
    expect(pin.group_key).toBeNull()
  })
})

describe('isLocalPin', () => {
  it('returns true for local pin', () => {
    const state = createPinState(0)
    state.localPins = [{ id: 99 }]
    expect(isLocalPin(state, 99)).toBe(true)
  })

  it('returns false for unknown id', () => {
    const state = createPinState(0)
    expect(isLocalPin(state, 123)).toBe(false)
  })
})

describe('bySort', () => {
  it('sorts by sort field ascending', () => {
    const items = [{ sort: 30 }, { sort: 10 }, { sort: 20 }]
    expect(items.sort(bySort).map((i) => i.sort)).toEqual([10, 20, 30])
  })

  it('treats missing sort as 0', () => {
    const items = [{ sort: 1 }, {}, { sort: -1 }]
    expect(items.sort(bySort).map((i) => i.sort)).toEqual([-1, undefined, 1])
  })
})

describe('getOptionLabel', () => {
  it('returns the option label', () => {
    const state = createPinState(0)
    state.optionsByQuestion.set('reasons', [{ key: 'a', label: 'Alpha' }])
    expect(getOptionLabel(state, 'reasons', 'a')).toBe('Alpha')
  })

  it('falls back to key if not found', () => {
    const state = createPinState(0)
    expect(getOptionLabel(state, 'reasons', 'unknown')).toBe('unknown')
  })
})
