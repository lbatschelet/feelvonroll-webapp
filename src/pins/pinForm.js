/**
 * Pin form — dynamic question rendering, data collection, and helpers.
 * Exports: renderQuestions, collectFormData, setQuestionValue, disableQuestions,
 *          getWellbeingValue, isAnswerEmpty, safeParseReasons, showFormError, clearFormError.
 */
import { t } from '../i18n'
import { toPercentValue, fromPercentValue, getSliderDefault } from '../utils/sliderMath'

/**
 * Renders question inputs into formContent, populating questionElements map.
 * @param {Array} questions - Sorted question definitions.
 * @param {HTMLElement} formContent - Container to append question groups into.
 * @param {Map} questionElements - Map<key, elements> to populate.
 */
export function renderQuestions(questions, formContent, questionElements) {
  formContent.innerHTML = ''
  questionElements.clear()

  questions.forEach((question) => {
    const group = document.createElement('div')
    group.className = 'ui-form-group'
    group.dataset.questionKey = question.key

    const label = document.createElement('div')
    label.className = 'ui-form-question'
    label.textContent = question.label || question.key
    group.appendChild(label)

    let elements = { group, label, type: question.type, inputs: [] }

    if (question.type === 'slider') {
      const input = document.createElement('input')
      input.type = 'range'
      input.name = question.key
      input.min = question.config?.min ?? 0
      input.max = question.config?.max ?? 1
      input.step = question.config?.step ?? 0.01
      input.value = getSliderDefault(question.config)
      group.appendChild(input)

      const legend = document.createElement('div')
      legend.className = 'ui-slider-legend'
      const legendLow = document.createElement('span')
      legendLow.className = 'ui-slider-legend-low'
      legendLow.textContent = question.legend_low || ''
      const legendHigh = document.createElement('span')
      legendHigh.className = 'ui-slider-legend-high'
      legendHigh.textContent = question.legend_high || ''
      legend.appendChild(legendLow)
      legend.appendChild(legendHigh)
      group.appendChild(legend)

      elements = { ...elements, input, legendLow, legendHigh }
    }

    if (question.type === 'multi') {
      const wrapper = document.createElement('div')
      wrapper.className = 'ui-form-reasons'
      const allowMultiple = Boolean(question.config?.allow_multiple)
      const inputType = allowMultiple ? 'checkbox' : 'radio'
      const options = Array.isArray(question.options) ? question.options : []
      options.forEach((option) => {
        const optionLabel = document.createElement('label')
        optionLabel.className = 'ui-checkbox'
        const input = document.createElement('input')
        input.type = inputType
        input.name = question.key
        input.value = option.key
        const text = document.createElement('span')
        text.textContent = option.label || option.key
        optionLabel.appendChild(input)
        optionLabel.appendChild(text)
        wrapper.appendChild(optionLabel)
        elements.inputs.push({ input, label: text, key: option.key })
      })
      group.appendChild(wrapper)
    }

    if (question.type === 'text') {
      const input = document.createElement('textarea')
      input.name = question.key
      input.rows = question.config?.rows ?? 3
      group.appendChild(input)
      elements = { ...elements, input }
    }

    formContent.appendChild(group)
    questionElements.set(question.key, elements)
  })
}

/**
 * Collects form answers and position data.
 * @param {HTMLFormElement} form - The form element with dataset (floorIndex, x, y, z).
 * @param {Array} questions - Question definitions.
 * @param {Map} questionElements - Map<key, elements>.
 * @returns {object|null} Payload or null if validation fails.
 */
export function collectFormData(form, questions, questionElements) {
  const floorIndex = Number(form.dataset.floorIndex)
  const x = Number(form.dataset.x)
  const y = Number(form.dataset.y)
  const z = Number(form.dataset.z)

  if (Number.isNaN(floorIndex) || Number.isNaN(x)) {
    showFormError(form, t('error.noLocation'))
    return null
  }

  const answers = {}
  for (const question of questions) {
    const elements = questionElements.get(question.key)
    if (!elements) continue
    if (question.type === 'slider') {
      answers[question.key] = toPercentValue(elements.input.value, question.config)
    }
    if (question.type === 'text') {
      answers[question.key] = elements.input.value.trim()
    }
    if (question.type === 'multi') {
      const allowMultiple = Boolean(question.config?.allow_multiple)
      const selected = elements.inputs
        .filter((item) => item.input.checked)
        .map((item) => item.input.value)
      answers[question.key] = allowMultiple ? selected : selected[0] || ''
    }

    if (question.required && isAnswerEmpty(answers[question.key])) {
      showFormError(form, t('error.required'))
      return null
    }
  }

  const result = { floor_index: floorIndex, x, y, z, answers }

  // Include station_key if set (from station mode)
  const stationKey = form.dataset.stationKey
  if (stationKey) {
    result.station_key = stationKey
  }

  // Separate known hardcoded answers from generic ones
  const knownKeys = new Set(['wellbeing', 'reasons', 'group', 'note'])
  const genericAnswers = {}
  for (const [key, value] of Object.entries(answers)) {
    if (!knownKeys.has(key)) {
      genericAnswers[key] = value
    }
  }
  if (Object.keys(genericAnswers).length > 0) {
    result.generic_answers = genericAnswers
  }

  return result
}

/**
 * Sets a question's value in the form.
 */
export function setQuestionValue(key, value, questions, questionElements) {
  const elements = questionElements.get(key)
  if (!elements) return
  if (elements.input) {
    const question = questions.find((item) => item.key === key)
    if (question?.type === 'slider') {
      elements.input.value = fromPercentValue(value, question.config)
      return
    }
    elements.input.value = value ?? ''
    return
  }
  if (Array.isArray(value)) {
    elements.inputs.forEach((item) => {
      item.input.checked = value.includes(item.input.value)
    })
  } else {
    elements.inputs.forEach((item) => {
      item.input.checked = item.input.value === value
    })
  }
}

/**
 * Enables or disables all question inputs.
 */
export function disableQuestions(disabled, questionElements) {
  questionElements.forEach((elements) => {
    if (elements.input) {
      elements.input.disabled = disabled
    }
    elements.inputs?.forEach((item) => {
      item.input.disabled = disabled
    })
  })
}

/**
 * Gets the current wellbeing slider value as a percent.
 */
export function getWellbeingValue(questions, questionElements) {
  const elements = questionElements.get('wellbeing')
  if (!elements?.input) {
    const question = questions.find((item) => item.key === 'wellbeing')
    return toPercentValue(getSliderDefault(question?.config), question?.config)
  }
  const question = questions.find((item) => item.key === 'wellbeing')
  return toPercentValue(elements.input.value || 0.5, question?.config)
}

export function isAnswerEmpty(value) {
  if (Array.isArray(value)) return value.length === 0
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  return false
}

export function safeParseReasons(value) {
  if (!value) return []
  try {
    return Array.isArray(value) ? value : JSON.parse(value)
  } catch {
    return []
  }
}

export function showFormError(form, message) {
  const error = form.querySelector('.ui-form-error')
  if (error) {
    error.textContent = message
  }
}

export function clearFormError(form) {
  const error = form.querySelector('.ui-form-error')
  if (error) {
    error.textContent = ''
  }
}
