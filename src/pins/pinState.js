/**
 * Pin state factory and data helpers.
 * Exports: createPinState, normalizePin, safeParseReasons, bySort.
 */
import { safeParseReasons } from './pinForm'

/**
 * Creates the initial pin system state.
 * @param {number} activeFloor - Current floor index.
 * @returns {object} Mutable state object.
 */
export function createPinState(activeFloor) {
  return {
    pins: [],
    localPins: [],
    pinMode: false,
    activeFloor,
    pendingMesh: null,
    colorQuestionKey: null,
    colorQuestions: [],
    lastClusterDistance: null,
    viewPin: null,
    questions: [],
    questionElements: new Map(),
    optionsByQuestion: new Map(),
  }
}

/**
 * Normalizes raw pin data from the API into consistent numeric types.
 * @param {object} pin - Raw pin object.
 * @returns {object} Normalized pin.
 */
export function normalizePin(pin) {
  return {
    ...pin,
    id: Number(pin.id),
    floor_index: Number(pin.floor_index),
    position_x: Number(pin.position_x),
    position_y: Number(pin.position_y),
    position_z: Number(pin.position_z),
    wellbeing: Number(pin.wellbeing),
    approved: Number(pin.approved),
    reasons: Array.isArray(pin.reasons) ? pin.reasons : safeParseReasons(pin.reasons),
    group_key: pin.group_key || null,
  }
}

/**
 * Checks whether a pin ID belongs to a local (unsaved) pin.
 */
export function isLocalPin(state, id) {
  return state.localPins.some((pin) => pin.id === id)
}

/**
 * Sort comparator by the `sort` field.
 */
export function bySort(a, b) {
  return (a.sort ?? 0) - (b.sort ?? 0)
}

/**
 * Resolves an option label from the optionsByQuestion map.
 */
export function getOptionLabel(state, questionKey, optionKey) {
  const options = state.optionsByQuestion.get(questionKey) || []
  const match = options.find((option) => option.key === optionKey)
  return match?.label || optionKey
}
