import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { NEUTRAL_COLOR, SLIDER_PALETTE, getSliderColor } from './pinColors'

describe('pinColors', () => {
  it('SLIDER_PALETTE has 10 entries', () => {
    expect(SLIDER_PALETTE).toHaveLength(10)
  })

  it('NEUTRAL_COLOR is a THREE.Color', () => {
    expect(NEUTRAL_COLOR).toBeInstanceOf(THREE.Color)
  })

  describe('getSliderColor', () => {
    it('returns first palette color for min value', () => {
      const color = getSliderColor(1, { min: 1, max: 10 })
      expect(color).toBeInstanceOf(THREE.Color)
      expect(color.getHexString()).toBe(new THREE.Color(SLIDER_PALETTE[0]).getHexString())
    })

    it('returns last palette color for max value', () => {
      const color = getSliderColor(10, { min: 1, max: 10 })
      expect(color.getHexString()).toBe(new THREE.Color(SLIDER_PALETTE[9]).getHexString())
    })

    it('returns NEUTRAL_COLOR for non-finite value', () => {
      const color = getSliderColor(NaN, { min: 1, max: 10 })
      expect(color).toBe(NEUTRAL_COLOR)
    })

    it('returns a color for mid-range value', () => {
      const color = getSliderColor(5, { min: 1, max: 10 })
      expect(color).toBeInstanceOf(THREE.Color)
    })
  })
})
