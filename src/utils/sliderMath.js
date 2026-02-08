/**
 * Slider value conversion utilities.
 * Exports: toPercentValue, fromPercentValue, getSliderDefault, roundTwo.
 */

export function toPercentValue(value, config = {}) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  const max = Number.isFinite(config.max) ? Number(config.max) : 1
  const min = Number.isFinite(config.min) ? Number(config.min) : 0
  const clamped = Math.min(Math.max(numeric, min), max)
  if (max <= 1) {
    return roundTwo(clamped * 100)
  }
  return roundTwo(((clamped - min) / (max - min)) * 100)
}

export function fromPercentValue(value, config = {}) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return ''
  const max = Number.isFinite(config.max) ? Number(config.max) : 1
  const min = Number.isFinite(config.min) ? Number(config.min) : 0
  if (max <= 1) {
    return roundTwo(numeric / 100)
  }
  return roundTwo(min + (numeric / 100) * (max - min))
}

export function getSliderDefault(config = {}) {
  const min = Number.isFinite(config.min) ? Number(config.min) : 0
  const max = Number.isFinite(config.max) ? Number(config.max) : 1
  const step =
    Number.isFinite(config.step) && Number(config.step) > 0 ? Number(config.step) : 0.01
  if (Number.isFinite(config.default)) {
    return Math.min(Math.max(Number(config.default), min), max)
  }
  const mid = min + (max - min) / 2
  const stepped = min + Math.round((mid - min) / step) * step
  return Math.min(Math.max(stepped, min), max)
}

export function roundTwo(value) {
  return Math.round(Number(value) * 100) / 100
}
