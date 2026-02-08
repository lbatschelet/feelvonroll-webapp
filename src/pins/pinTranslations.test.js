// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { setLanguage } from '../i18n'
import { applyStaticTranslations, applyQuestionLabels, refreshViewTexts } from './pinTranslations'

function makeRefs() {
  return {
    toggleButton: document.createElement('button'),
    closeButton: document.createElement('button'),
    submitButton: document.createElement('button'),
    viewWellbeingLabel: document.createElement('span'),
    viewReasonsLabel: document.createElement('span'),
    viewGroupLabel: document.createElement('span'),
    viewNoteLabel: document.createElement('span'),
    viewPending: document.createElement('span'),
    viewReasons: document.createElement('span'),
    viewGroup: document.createElement('span'),
    viewNote: document.createElement('span'),
    viewTimestamp: document.createElement('span'),
  }
}

describe('applyStaticTranslations', () => {
  it('sets German toggle text when not in pin mode', () => {
    setLanguage('de')
    const refs = makeRefs()
    const state = { pinMode: false }
    applyStaticTranslations(refs, state)
    expect(refs.toggleButton.textContent).toBe('+ Pin')
    expect(refs.submitButton.textContent).toBe('Speichern')
  })

  it('sets active toggle text when in pin mode', () => {
    setLanguage('de')
    const refs = makeRefs()
    const state = { pinMode: true }
    applyStaticTranslations(refs, state)
    expect(refs.toggleButton.textContent).toBe('Pin platzieren')
  })

  it('sets English strings', () => {
    setLanguage('en')
    const refs = makeRefs()
    const state = { pinMode: false }
    applyStaticTranslations(refs, state)
    expect(refs.submitButton.textContent).toBe('Save')
  })
})

describe('applyQuestionLabels', () => {
  it('updates question element labels', () => {
    setLanguage('en')
    const label = document.createElement('div')
    const legendLow = document.createElement('span')
    const legendHigh = document.createElement('span')
    const state = {
      questions: [{ key: 'wellbeing', type: 'slider', label: 'Feel?', legend_low: 'Bad', legend_high: 'Good' }],
      questionElements: new Map([
        ['wellbeing', { label, legendLow, legendHigh, type: 'slider', inputs: [] }],
      ]),
      optionsByQuestion: new Map(),
    }
    const refs = makeRefs()
    const updateColorModeButtons = vi.fn()
    applyQuestionLabels(state, refs, updateColorModeButtons)
    expect(label.textContent).toBe('Feel?')
    expect(legendLow.textContent).toBe('Bad')
    expect(legendHigh.textContent).toBe('Good')
    expect(refs.viewWellbeingLabel.textContent).toBe('Feel?')
    expect(updateColorModeButtons).toHaveBeenCalled()
  })
})

describe('refreshViewTexts', () => {
  it('does nothing when viewPin is null', () => {
    const refs = makeRefs()
    refs.viewReasons.textContent = 'original'
    refreshViewTexts({ viewPin: null }, refs)
    expect(refs.viewReasons.textContent).toBe('original')
  })

  it('updates view texts from viewPin', () => {
    setLanguage('en')
    const refs = makeRefs()
    const state = {
      viewPin: {
        reasons: ['a'],
        group_key: 'staff',
        note: 'Hello',
        created_at: '2025-01-01T00:00:00Z',
      },
      optionsByQuestion: new Map([
        ['reasons', [{ key: 'a', label: 'Alpha' }]],
        ['group', [{ key: 'staff', label: 'Staff' }]],
      ]),
    }
    refreshViewTexts(state, refs)
    expect(refs.viewReasons.textContent).toBe('Alpha')
    expect(refs.viewGroup.textContent).toBe('Staff')
    expect(refs.viewNote.textContent).toBe('Hello')
    expect(refs.viewTimestamp.textContent).not.toBe('—')
  })
})
