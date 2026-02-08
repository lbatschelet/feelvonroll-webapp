/**
 * Pin view panel — read-only display of an existing pin's data.
 * Exports: createPinViewPanel.
 */
import { t } from '../i18n'

/**
 * Creates the view panel DOM and returns element references.
 * @returns {{ viewPanel, viewWellbeing, viewWellbeingLabel, viewReasons, viewReasonsLabel,
 *             viewGroup, viewGroupLabel, viewGroupRow, viewNote, viewNoteLabel,
 *             viewPending, viewTimestamp, viewScoreFill }}
 */
export function createPinViewPanel() {
  const viewPanel = document.createElement('div')
  viewPanel.className = 'ui-pin-view is-hidden'
  viewPanel.innerHTML = `
    <div class="ui-pin-view-score-row">
      <span>
        <span class="ui-pin-view-label wellbeing">${t('ui.viewWellbeing')}</span>
        <span class="ui-pin-view-score">${t('ui.empty')}</span>
      </span>
      <div class="ui-pin-view-bar"><span class="ui-pin-view-bar-fill"></span></div>
    </div>
    <div>
      <span class="ui-pin-view-label reasons">${t('ui.viewReasons')}</span>
      <span class="ui-pin-view-reasons">${t('ui.empty')}</span>
    </div>
    <div class="ui-pin-view-group-row">
      <span class="ui-pin-view-label group">${t('questions.group.label')}</span>
      <span class="ui-pin-view-group">${t('ui.empty')}</span>
    </div>
    <div>
      <span class="ui-pin-view-label note">${t('ui.viewNote')}</span>
      <span class="ui-pin-view-note">${t('ui.empty')}</span>
    </div>
    <div class="ui-pin-view-meta">
      <span class="ui-pin-view-timestamp">${t('ui.empty')}</span>
      <span class="ui-pin-view-pending">${t('ui.viewPending')}</span>
    </div>
  `

  return {
    viewPanel,
    viewWellbeing: viewPanel.querySelector('.ui-pin-view-score'),
    viewWellbeingLabel: viewPanel.querySelector('.ui-pin-view-label.wellbeing'),
    viewReasons: viewPanel.querySelector('.ui-pin-view-reasons'),
    viewReasonsLabel: viewPanel.querySelector('.ui-pin-view-label.reasons'),
    viewGroup: viewPanel.querySelector('.ui-pin-view-group'),
    viewGroupLabel: viewPanel.querySelector('.ui-pin-view-label.group'),
    viewGroupRow: viewPanel.querySelector('.ui-pin-view-group-row'),
    viewNote: viewPanel.querySelector('.ui-pin-view-note'),
    viewNoteLabel: viewPanel.querySelector('.ui-pin-view-label.note'),
    viewPending: viewPanel.querySelector('.ui-pin-view-pending'),
    viewTimestamp: viewPanel.querySelector('.ui-pin-view-timestamp'),
    viewScoreFill: viewPanel.querySelector('.ui-pin-view-bar-fill'),
  }
}
