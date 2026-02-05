import { t } from './i18n'

export function getFallbackQuestions() {
  return [
    {
      key: 'wellbeing',
      type: 'slider',
      required: true,
      sort: 10,
      config: { min: 1, max: 10, step: 1, default: 5 },
      label: t('questions.wellbeing.label'),
      legend_low: t('questions.wellbeing.legend_low'),
      legend_high: t('questions.wellbeing.legend_high'),
    },
    {
      key: 'reasons',
      type: 'multi',
      required: false,
      sort: 20,
      config: { allow_multiple: true },
      label: t('questions.reasons.label'),
      options: [
        { key: 'licht', label: t('options.reasons.licht'), sort: 10 },
        { key: 'ruhe', label: t('options.reasons.ruhe'), sort: 20 },
        { key: 'laerm', label: t('options.reasons.laerm'), sort: 30 },
        { key: 'aussicht', label: t('options.reasons.aussicht'), sort: 40 },
        { key: 'sicherheit', label: t('options.reasons.sicherheit'), sort: 50 },
        { key: 'sauberkeit', label: t('options.reasons.sauberkeit'), sort: 60 },
        { key: 'layout', label: t('options.reasons.layout'), sort: 70 },
        { key: 'temperatur', label: t('options.reasons.temperatur'), sort: 80 },
      ],
    },
    {
      key: 'group',
      type: 'multi',
      required: false,
      sort: 30,
      config: { allow_multiple: false },
      label: t('questions.group.label'),
      options: [
        { key: 'staff', label: t('options.group.staff'), sort: 10 },
        { key: 'studi', label: t('options.group.studi'), sort: 20 },
        { key: 'dozierend', label: t('options.group.dozierend'), sort: 30 },
        { key: 'other', label: t('options.group.other'), sort: 40 },
      ],
    },
    {
      key: 'note',
      type: 'text',
      required: false,
      sort: 40,
      config: { rows: 3 },
      label: t('questions.note.label'),
    },
  ]
}
