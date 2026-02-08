/**
 * Formatting utilities for display values.
 * Exports: formatPercent, formatTimestamp.
 */
import { getLocale, t } from '../i18n'

export function formatPercent(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return t('ui.empty')
  const formatted = numeric.toLocaleString(getLocale(), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return `${formatted}%`
}

export function formatTimestamp(value) {
  if (!value) return t('ui.empty')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(getLocale())
}
