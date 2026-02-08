/**
 * Pin color utilities.
 * Maps slider values to a colorblind-friendly palette.
 * Luminance increases monotonically (primary cue).
 * Hue shifts purple → pink → orange → yellow (no greens).
 */
import * as THREE from 'three'

export const SLIDER_PALETTE = [
  '#6c2fa0',
  '#8b3fc7',
  '#b545c9',
  '#db4ca1',
  '#f25c78',
  '#ff7b54',
  '#ffa042',
  '#ffc639',
  '#ffe145',
  '#fff176',
]

export const NEUTRAL_COLOR = new THREE.Color(0x9ca3af)

/**
 * Returns a THREE.Color for a slider value within the given config range.
 * @param {number} value - The raw slider value.
 * @param {object} config - { min, max } range.
 * @returns {THREE.Color}
 */
export function getSliderColor(value, config = {}) {
  const min = Number.isFinite(config.min) ? Number(config.min) : 1
  const max = Number.isFinite(config.max) ? Number(config.max) : 10
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return NEUTRAL_COLOR
  const clamped = Math.min(Math.max(numeric, min), max)
  const ratio = max === min ? 0 : (clamped - min) / (max - min)
  const index = Math.min(
    SLIDER_PALETTE.length - 1,
    Math.max(0, Math.round(ratio * (SLIDER_PALETTE.length - 1)))
  )
  return new THREE.Color(SLIDER_PALETTE[index])
}
