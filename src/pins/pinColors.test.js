import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  COLOR_PALETTES,
  DEFAULT_COLOR_PALETTE_KEY,
  NEUTRAL_COLOR,
  SLIDER_PALETTE,
  getSliderColor,
  getSliderGradient,
  getSliderPalette,
} from './pinColors'

describe('pinColors', () => {
  it('SLIDER_PALETTE has 10 entries', () => {
    expect(SLIDER_PALETTE).toHaveLength(10)
  })

  it('exports at least one named palette', () => {
    expect(Object.keys(COLOR_PALETTES).length).toBeGreaterThan(0)
    expect(COLOR_PALETTES[DEFAULT_COLOR_PALETTE_KEY]).toHaveLength(10)
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

    it('uses configured color palette when present', () => {
      const palette = COLOR_PALETTES.brownTeal
      const color = getSliderColor(1, { min: 1, max: 10, color_palette: 'brownTeal' })
      expect(color.getHexString()).toBe(new THREE.Color(palette[0]).getHexString())
    })
  })

  describe('palette helpers', () => {
    it('falls back to default palette for unknown key', () => {
      expect(getSliderPalette({ color_palette: 'does_not_exist' })).toBe(
        COLOR_PALETTES[DEFAULT_COLOR_PALETTE_KEY]
      )
    })

    it('builds a linear gradient string from palette colors', () => {
      const gradient = getSliderGradient({ color_palette: DEFAULT_COLOR_PALETTE_KEY })
      expect(gradient.startsWith('linear-gradient(90deg,')).toBe(true)
      expect(gradient.includes(COLOR_PALETTES[DEFAULT_COLOR_PALETTE_KEY][0])).toBe(true)
    })
  })
})
