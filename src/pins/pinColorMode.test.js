// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { NEUTRAL_COLOR } from './pinColors'
import { createPinColorMode } from './pinColorMode'

function makeState(overrides = {}) {
  return {
    questions: [],
    questionElements: new Map(),
    colorQuestions: [],
    colorQuestionKey: null,
    pendingMesh: null,
    ...overrides,
  }
}

function makeDom() {
  const legend = document.createElement('div')
  const colorModeRow = document.createElement('div')
  const form = document.createElement('form')
  const pinGroup = new THREE.Group()
  return { legend, colorModeRow, form, pinGroup }
}

describe('createPinColorMode', () => {
  it('returns all expected methods', () => {
    const state = makeState()
    const dom = makeDom()
    const cm = createPinColorMode({ state, ...dom })
    expect(typeof cm.getPinColor).toBe('function')
    expect(typeof cm.getColorFromForm).toBe('function')
    expect(typeof cm.updatePreviewColor).toBe('function')
    expect(typeof cm.refreshPinColors).toBe('function')
    expect(typeof cm.refreshPendingPinColor).toBe('function')
    expect(typeof cm.updateLegend).toBe('function')
    expect(typeof cm.updateColorQuestions).toBe('function')
    expect(typeof cm.updateColorModeButtons).toBe('function')
    expect(typeof cm.getActiveColorQuestion).toBe('function')
    expect(typeof cm.getPinScore).toBe('function')
  })

  describe('getPinColor', () => {
    it('returns NEUTRAL_COLOR when no color question is active', () => {
      const state = makeState()
      const dom = makeDom()
      const cm = createPinColorMode({ state, ...dom })
      const color = cm.getPinColor({ wellbeing: 50 })
      expect(color).toBe(NEUTRAL_COLOR)
    })

    it('returns a THREE.Color when a color question is active', () => {
      const question = { key: 'wellbeing', type: 'slider', config: { min: 0, max: 1 } }
      const state = makeState({
        questions: [question],
        colorQuestions: [question],
        colorQuestionKey: 'wellbeing',
      })
      const dom = makeDom()
      const cm = createPinColorMode({ state, ...dom })
      const color = cm.getPinColor({ wellbeing: 50 })
      expect(color).toBeInstanceOf(THREE.Color)
    })
  })

  describe('getActiveColorQuestion', () => {
    it('returns null when no key is set', () => {
      const state = makeState()
      const dom = makeDom()
      const cm = createPinColorMode({ state, ...dom })
      expect(cm.getActiveColorQuestion()).toBeNull()
    })

    it('returns the matching question', () => {
      const question = { key: 'wellbeing', type: 'slider', config: {} }
      const state = makeState({
        questions: [question],
        colorQuestions: [question],
        colorQuestionKey: 'wellbeing',
      })
      const dom = makeDom()
      const cm = createPinColorMode({ state, ...dom })
      expect(cm.getActiveColorQuestion()).toBe(question)
    })
  })

  describe('updateColorQuestions', () => {
    it('selects slider questions flagged with use_for_color', () => {
      const q1 = { key: 'a', type: 'slider', config: { use_for_color: true, min: 0, max: 1 } }
      const q2 = { key: 'b', type: 'multi', config: {} }
      const state = makeState({ questions: [q1, q2] })
      const dom = makeDom()
      const cm = createPinColorMode({ state, ...dom })
      cm.updateColorQuestions()
      expect(state.colorQuestions).toEqual([q1])
      expect(state.colorQuestionKey).toBe('a')
    })

    it('falls back to wellbeing if no flagged questions', () => {
      const q1 = { key: 'wellbeing', type: 'slider', config: { min: 0, max: 1 } }
      const state = makeState({ questions: [q1] })
      const dom = makeDom()
      const cm = createPinColorMode({ state, ...dom })
      cm.updateColorQuestions()
      expect(state.colorQuestions).toEqual([q1])
      expect(state.colorQuestionKey).toBe('wellbeing')
    })
  })

  describe('updateLegend', () => {
    it('clears legend when no active color question', () => {
      const state = makeState()
      const dom = makeDom()
      dom.legend.innerHTML = '<div>old</div>'
      const cm = createPinColorMode({ state, ...dom })
      cm.updateLegend()
      expect(dom.legend.innerHTML).toBe('')
    })

    it('builds gradient and labels for active question', () => {
      const question = { key: 'wellbeing', type: 'slider', config: {}, legend_low: 'Low', legend_high: 'High' }
      const state = makeState({
        questions: [question],
        colorQuestions: [question],
        colorQuestionKey: 'wellbeing',
      })
      const dom = makeDom()
      const cm = createPinColorMode({ state, ...dom })
      cm.updateLegend()
      expect(dom.legend.querySelector('.ui-legend-gradient')).not.toBeNull()
      expect(dom.legend.querySelector('.ui-legend-labels').textContent).toContain('Low')
      expect(dom.legend.querySelector('.ui-legend-labels').textContent).toContain('High')
    })
  })

  describe('updateColorModeButtons', () => {
    it('hides row when 0 or 1 color questions', () => {
      const state = makeState({ colorQuestions: [{ key: 'a' }] })
      const dom = makeDom()
      const cm = createPinColorMode({ state, ...dom })
      cm.updateColorModeButtons()
      expect(dom.colorModeRow.style.display).toBe('none')
    })

    it('creates buttons for multiple color questions', () => {
      const state = makeState({
        colorQuestions: [
          { key: 'a', label: 'Alpha' },
          { key: 'b', label: 'Beta' },
        ],
        colorQuestionKey: 'a',
      })
      const dom = makeDom()
      const cm = createPinColorMode({ state, ...dom })
      cm.updateColorModeButtons()
      const buttons = dom.colorModeRow.querySelectorAll('button')
      expect(buttons).toHaveLength(2)
      expect(buttons[0].textContent).toBe('Alpha')
      expect(buttons[0].classList.contains('active')).toBe(true)
      expect(buttons[1].textContent).toBe('Beta')
      expect(buttons[1].classList.contains('active')).toBe(false)
    })
  })

  describe('getPinScore', () => {
    it('returns null when question is null', () => {
      const state = makeState()
      const dom = makeDom()
      const cm = createPinColorMode({ state, ...dom })
      expect(cm.getPinScore({}, null)).toBeNull()
    })

    it('reads score from pin property', () => {
      const state = makeState()
      const dom = makeDom()
      const cm = createPinColorMode({ state, ...dom })
      const question = { key: 'wellbeing', config: { min: 0, max: 1 } }
      const score = cm.getPinScore({ wellbeing: 75 }, question)
      expect(typeof score).toBe('number')
    })
  })
})
