import { describe, expect, it } from 'vitest'
import { getFallbackQuestions } from './questionnaire.js'

describe('questionnaire fallback', () => {
  it('returns the default question keys', () => {
    const keys = getFallbackQuestions().map((question) => question.key)
    expect(keys).toEqual(['wellbeing', 'reasons', 'group', 'note'])
  })
})
