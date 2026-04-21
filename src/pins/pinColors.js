/**
 * Pin color utilities.
 * Maps slider values to a colorblind-friendly palette.
 * Luminance increases monotonically (primary cue).
 * Hue shifts purple → pink → orange → yellow (no greens).
 */
import * as THREE from 'three'

export const DEFAULT_COLOR_PALETTE_KEY = 'default'
export const COLOR_PALETTES = {
  [DEFAULT_COLOR_PALETTE_KEY]: [
    '#67001f',
    '#b2182b',
    '#d6604d',
    '#f4a582',
    '#fddbc7',
    '#d1e5f0',
    '#92c5de',
    '#4393c3',
    '#2166ac',
    '#053061',
  ],
  brownTeal: [
    '#543005',
    '#8c510a',
    '#bf812d',
    '#dfc27d',
    '#f6e8c3',
    '#c7eae5',
    '#80cdc1',
    '#35978f',
    '#01665e',
    '#003c30',
  ],
  purpleGreen: [
    '#40004b',
    '#762a83',
    '#9970ab',
    '#c2a5cf',
    '#e7d4e8',
    '#d9f0d3',
    '#a6dba0',
    '#5aae61',
    '#1b7837',
    '#00441b',
  ],
  orangePurple: [
    '#7f3b08',
    '#b35806',
    '#e08214',
    '#fdb863',
    '#fee0b6',
    '#d8daeb',
    '#b2abd2',
    '#8073ac',
    '#542788',
    '#2d004b',
  ],
  pinkGreen: [
    '#8e0152',
    '#c51b7d',
    '#de77ae',
    '#f1b6da',
    '#fde0ef',
    '#e6f5d0',
    '#b8e186',
    '#7fbc41',
    '#4d9221',
    '#276419',
  ],
  warmCool: [
    '#b40426',
    '#d95847',
    '#f18d6f',
    '#f7b89c',
    '#edd1c2',
    '#c9d7f0',
    '#a4c2fe',
    '#7da0f9',
    '#5977e3',
    '#3b4cc0',
  ],
  redYellowBlue: [
    '#a50026',
    '#d73027',
    '#f46d43',
    '#fdae61',
    '#fee090',
    '#e0f3f8',
    '#abd9e9',
    '#74add1',
    '#4575b4',
    '#313695',
  ],
}
export const SLIDER_PALETTE = COLOR_PALETTES[DEFAULT_COLOR_PALETTE_KEY]

export const NEUTRAL_COLOR = new THREE.Color(0x9ca3af)

export function getSliderPalette(config = {}) {
  const requested = typeof config.color_palette === 'string' ? config.color_palette.trim() : ''
  if (requested && COLOR_PALETTES[requested]) {
    return COLOR_PALETTES[requested]
  }
  return COLOR_PALETTES[DEFAULT_COLOR_PALETTE_KEY]
}

export function getSliderGradient(config = {}) {
  const palette = getSliderPalette(config)
  return `linear-gradient(90deg, ${palette.join(', ')})`
}

/**
 * Returns a THREE.Color for a slider value within the given config range.
 * @param {number} value - The raw slider value.
 * @param {object} config - { min, max } range.
 * @returns {THREE.Color}
 */
export function getSliderColor(value, config = {}) {
  const palette = getSliderPalette(config)
  const min = Number.isFinite(config.min) ? Number(config.min) : 1
  const max = Number.isFinite(config.max) ? Number(config.max) : 10
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return NEUTRAL_COLOR
  const clamped = Math.min(Math.max(numeric, min), max)
  const ratio = max === min ? 0 : (clamped - min) / (max - min)
  const index = Math.min(
    palette.length - 1,
    Math.max(0, Math.round(ratio * (palette.length - 1)))
  )
  return new THREE.Color(palette[index])
}
