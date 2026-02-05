const translations = {
  de: {
    'ui.language': 'Sprache',
    'ui.pinToggleIdle': '+ Pin',
    'ui.pinToggleActive': 'Pin platzieren',
    'ui.modeWellbeing': 'Wohlbefinden',
    'ui.modeReasons': 'Gründe',
    'ui.close': 'Schliessen',
    'ui.sliderLow': 'Gar nicht wohl',
    'ui.sliderHigh': 'Sehr wohl',
    'ui.save': 'Speichern',
    'ui.viewWellbeing': 'Wohlbefinden:',
    'ui.viewReasons': 'Was trägt zu deinem (Un-)Wohlbefinden bei?',
    'ui.viewNote': 'Anmerkung:',
    'ui.viewPending':
      'Dieser Pin wartet auf Freigabe und ist für andere noch nicht sichtbar.',
    'ui.empty': '—',
    'error.saveFailed': 'Speichern fehlgeschlagen',
    'error.noLocation': 'Kein Standort gewählt',
    'error.required': 'Bitte alle Pflichtfelder ausfüllen',
    'legend.wellbeingLow': 'Gar nicht wohl',
    'legend.wellbeingHigh': 'Sehr wohl',
    'questions.wellbeing.label': 'Wie fühlst du dich hier?',
    'questions.wellbeing.legend_low': 'Gar nicht wohl',
    'questions.wellbeing.legend_high': 'Sehr wohl',
    'questions.reasons.label': 'Was trägt zu deinem (Un-)Wohlbefinden bei?',
    'questions.group.label': 'Zu welcher Gruppe gehörst du?',
    'questions.note.label': 'Anmerkung',
    'options.reasons.licht': 'Licht',
    'options.reasons.ruhe': 'Ruhe',
    'options.reasons.laerm': 'Lärm',
    'options.reasons.aussicht': 'Aussicht',
    'options.reasons.sicherheit': 'Sicherheit',
    'options.reasons.sauberkeit': 'Sauberkeit',
    'options.reasons.layout': 'Layout',
    'options.reasons.temperatur': 'Temperatur',
    'options.group.staff': 'Staff',
    'options.group.studi': 'Studi',
    'options.group.dozierend': 'Dozierend',
    'options.group.other': 'Andere',
  },
  en: {
    'ui.language': 'Language',
    'ui.pinToggleIdle': '+ Pin',
    'ui.pinToggleActive': 'Place pin',
    'ui.modeWellbeing': 'Wellbeing',
    'ui.modeReasons': 'Reasons',
    'ui.close': 'Close',
    'ui.sliderLow': 'Not good at all',
    'ui.sliderHigh': 'Very good',
    'ui.save': 'Save',
    'ui.viewWellbeing': 'Wellbeing:',
    'ui.viewReasons': 'What contributes to your (un)wellbeing?',
    'ui.viewNote': 'Note:',
    'ui.viewPending': 'This pin is awaiting approval and is not visible to others yet.',
    'ui.empty': '—',
    'error.saveFailed': 'Failed to save',
    'error.noLocation': 'No location selected',
    'error.required': 'Please fill in all required fields',
    'legend.wellbeingLow': 'Not good at all',
    'legend.wellbeingHigh': 'Very good',
    'questions.wellbeing.label': 'How do you feel here?',
    'questions.wellbeing.legend_low': 'Not good at all',
    'questions.wellbeing.legend_high': 'Very good',
    'questions.reasons.label': 'What contributes to your (un)wellbeing?',
    'questions.group.label': 'Which group do you belong to?',
    'questions.note.label': 'Note',
    'options.reasons.licht': 'Light',
    'options.reasons.ruhe': 'Quiet',
    'options.reasons.laerm': 'Noise',
    'options.reasons.aussicht': 'View',
    'options.reasons.sicherheit': 'Safety',
    'options.reasons.sauberkeit': 'Cleanliness',
    'options.reasons.layout': 'Layout',
    'options.reasons.temperatur': 'Temperature',
    'options.group.staff': 'Staff',
    'options.group.studi': 'Student',
    'options.group.dozierend': 'Lecturer',
    'options.group.other': 'Other',
  },
}

let currentLanguage = detectLanguage()
const listeners = new Set()

export function getLanguage() {
  return currentLanguage
}

export function setLanguage(language) {
  const next = normalizeLanguage(language)
  const changed = next !== currentLanguage
  currentLanguage = next
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next
  }
  if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
    localStorage.setItem('lang', next)
  }
  if (changed) {
    listeners.forEach((listener) => listener(next))
  }
}

export function t(key) {
  const language = translations[currentLanguage] || translations.de
  return language[key] || translations.de[key] || key
}

export function getLocale() {
  return currentLanguage === 'de' ? 'de-CH' : 'en-GB'
}

export function onLanguageChange(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

export function mergeTranslations(language, entries) {
  if (!entries || typeof entries !== 'object') return
  if (!translations[language]) {
    translations[language] = {}
  }
  Object.assign(translations[language], entries)
  if (language === currentLanguage) {
    listeners.forEach((listener) => listener(language))
  }
}

function detectLanguage() {
  if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
    const stored = localStorage.getItem('lang')
    if (stored) return stored
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    if (navigator.language.toLowerCase().startsWith('de')) {
      return 'de'
    }
  }
  return 'en'
}

function normalizeLanguage(language) {
  if (!language) return 'de'
  return String(language).trim().toLowerCase()
}
