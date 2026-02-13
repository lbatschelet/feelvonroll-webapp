/**
 * Internationalisation for the issue page.
 * Single responsibility: translation lookup and language state.
 *
 * Exports: createI18n.
 */

const TRANSLATIONS = {
  de: {
    'page.title': 'Fehler gefunden? Idee gehabt?',
    'page.subtitle': 'Hilf uns, <em>feel</em><strong>vonRoll</strong> zu verbessern.',
    'category.label': 'Kategorie',
    'category.bug': 'Fehlermeldung',
    'category.feature': 'Idee / Wunsch',
    'category.other': 'Sonstiges',
    'title.label': 'Titel',
    'title.hint': '(erforderlich)',
    'title.placeholder.bug': 'Was ist passiert?',
    'title.placeholder.feature': 'Was wünschst du dir?',
    'title.placeholder.other': 'Worum geht es?',
    'description.label': 'Beschreibung',
    'description.hint': '(erforderlich)',
    'description.placeholder.bug':
      'Beschreibe so genau wie möglich, was passiert ist. Was hast du erwartet? Was ist stattdessen passiert? Wann und wo ist der Fehler aufgetreten?',
    'description.placeholder.feature':
      'Beschreibe deine Idee. Was soll möglich sein und warum wäre das hilfreich?',
    'description.placeholder.other': 'Beschreibe dein Anliegen…',
    'steps.label': 'Schritte zum Reproduzieren',
    'steps.hint': '(optional)',
    'steps.placeholder': '1. Gehe zu…\n2. Klicke auf…\n3. Fehler erscheint',
    'email.label': 'E-Mail',
    'email.hint': '(optional, für Rückfragen)',
    'email.placeholder': 'deine@email.ch',
    'debug.summary': 'Debug-Informationen (werden automatisch gesendet)',
    'submit': 'Absenden',
    'error.required': 'Bitte Titel und Beschreibung ausfüllen.',
    'error.generic': 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
    'success.title': 'Vielen Dank!',
    'success.message': 'Deine Meldung wurde erfolgreich übermittelt.',
    'success.another': 'Weitere Meldung senden',
    'footer.for': 'für',
    'footer.license': 'Lizenziert unter',
    'footer.issues': 'Alle Meldungen',
  },
  en: {
    'page.title': 'Found a bug? Have an idea?',
    'page.subtitle': 'Help us improve <em>feel</em><strong>vonRoll</strong>.',
    'category.label': 'Category',
    'category.bug': 'Bug Report',
    'category.feature': 'Feature Request',
    'category.other': 'Other',
    'title.label': 'Title',
    'title.hint': '(required)',
    'title.placeholder.bug': 'What happened?',
    'title.placeholder.feature': 'What would you like to see?',
    'title.placeholder.other': 'What is this about?',
    'description.label': 'Description',
    'description.hint': '(required)',
    'description.placeholder.bug':
      'Describe as precisely as possible what happened. What did you expect? What happened instead? When and where did the error occur?',
    'description.placeholder.feature':
      'Describe your idea. What should be possible and why would it be helpful?',
    'description.placeholder.other': 'Describe your request…',
    'steps.label': 'Steps to Reproduce',
    'steps.hint': '(optional)',
    'steps.placeholder': '1. Go to…\n2. Click on…\n3. Error appears',
    'email.label': 'Email',
    'email.hint': '(optional, for follow-up)',
    'email.placeholder': 'your@email.com',
    'debug.summary': 'Debug information (sent automatically)',
    'submit': 'Submit',
    'error.required': 'Please fill in the title and description.',
    'error.generic': 'Something went wrong. Please try again.',
    'success.title': 'Thank you!',
    'success.message': 'Your submission has been received.',
    'success.another': 'Submit another',
    'footer.for': 'for',
    'footer.license': 'Licensed under',
    'footer.issues': 'View all issues',
  },
}

const SUPPORTED_LANGUAGES = ['de', 'en']
const FALLBACK_LANGUAGE = 'en'

/**
 * @param {{ initialLang: string }} options
 */
export function createI18n({ initialLang }) {
  let currentLang = SUPPORTED_LANGUAGES.includes(initialLang) ? initialLang : FALLBACK_LANGUAGE
  let changeListeners = []

  function t(key) {
    return TRANSLATIONS[currentLang]?.[key] ?? TRANSLATIONS[FALLBACK_LANGUAGE]?.[key] ?? key
  }

  function getLang() {
    return currentLang
  }

  function setLang(lang) {
    if (!SUPPORTED_LANGUAGES.includes(lang) || lang === currentLang) return
    currentLang = lang
    changeListeners.forEach((fn) => fn(currentLang))
  }

  function onLangChange(fn) {
    changeListeners.push(fn)
  }

  function getSupportedLanguages() {
    return SUPPORTED_LANGUAGES
  }

  return { t, getLang, setLang, onLangChange, getSupportedLanguages }
}
