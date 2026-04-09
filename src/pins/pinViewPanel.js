/**
 * Pin view panel — read-only display of an existing pin's data.
 * Exports: createPinViewPanel.
 */
import { t } from '../i18n'

/**
 * Creates the view panel DOM and returns element references.
 * @returns {{ viewPanel, viewWellbeing, viewWellbeingLabel, viewReasons, viewReasonsLabel,
 *             viewGroup, viewGroupLabel, viewGroupRow, viewNote, viewNoteLabel,
 *             viewPending, viewTimestamp, viewScoreDot, viewQuestionnaire, viewMissing }}
 */
export function createPinViewPanel() {
  const viewPanel = document.createElement('div')
  viewPanel.className = 'ui-pin-view is-hidden'
  viewPanel.innerHTML = `
    <div class="ui-pin-view-hero">
      <div class="ui-pin-view-dot"></div>
      <span class="ui-pin-view-score"></span>
      <span class="ui-pin-view-label wellbeing">${t('ui.viewWellbeing')}</span>
    </div>
    <div class="ui-pin-view-answers"></div>
    <div class="ui-pin-view-meta">
      <span class="ui-pin-view-station"></span>
      <span class="ui-pin-view-timestamp">${t('ui.empty')}</span>
      <span class="ui-pin-view-pending">${t('ui.viewPending')}</span>
    </div>
  `

  return {
    viewPanel,
    viewWellbeing: viewPanel.querySelector('.ui-pin-view-score'),
    viewWellbeingLabel: viewPanel.querySelector('.ui-pin-view-label.wellbeing'),
      viewAnswers: viewPanel.querySelector('.ui-pin-view-answers'),
      viewStation: viewPanel.querySelector('.ui-pin-view-station'),
    viewPending: viewPanel.querySelector('.ui-pin-view-pending'),
    viewTimestamp: viewPanel.querySelector('.ui-pin-view-timestamp'),
    viewScoreDot: viewPanel.querySelector('.ui-pin-view-dot'),
  }
}
