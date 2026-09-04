import { openSnackbar } from '@/composables/snackbar'
import { getDataLakeVariableInfo, updateDataLakeVariableInfo } from '@/libs/actions/data-lake'
import { getAllTransformingFunctions } from '@/libs/actions/data-lake-transformations'
import { shareHardwareDetailsKey } from '@/libs/external-telemetry/event-tracking'
import { settingsManager } from '@/libs/settings-management'
import { getUnindentedString } from '@/libs/utils'

/**
 * Migrate old localStorage keys to new ones
 */
const migrateRenameOfLocalStorageKeys = (): void => {
  const oldToNewKeys = {
    'main-menu-style': 'cockpit-main-menu-style',
    'last-tutorial-step': 'cockpit-last-tutorial-step',
    'tutorial-modal': 'cockpit-tutorial-modal',
  }
  Object.entries(oldToNewKeys).forEach(([oldKey, newKey]) => {
    const oldValue = localStorage.getItem(oldKey)
    if (oldValue !== null) {
      localStorage.setItem(newKey, oldValue)
      localStorage.removeItem(oldKey)
    }
  })
}

/**
 * Carry over the legacy "usage statistics telemetry" opt-out into the new
 * {@link shareHardwareDetailsKey} flag.
 *
 * Users that had explicitly disabled the legacy boolean and kept all telemetry off; will now
 * opt out of detailed hardware specifications.
 */
const migrateLegacyTelemetryOptOutToHardwareSharing = (): void => {
  const legacyKey = 'cockpit-enable-usage-statistics-telemetry'
  const legacyValue = localStorage.getItem(legacyKey)
  if (legacyValue === null) return

  if (legacyValue === 'false' && settingsManager.getKeyValue(shareHardwareDetailsKey) === undefined) {
    settingsManager.setKeyValue(shareHardwareDetailsKey, false, 0)
  }
  localStorage.removeItem(legacyKey)
}

const cameraSpeedRemovedIds = ['camera-zoom-speed', 'camera-focus-speed'] as const
const cameraSpeedNoticeKey = 'cockpit-camera-speed-notice-shown'

const shippedCameraFunctions = [
  {
    id: 'camera-zoom',
    oldExpression: getUnindentedString(`
      const zoom = ({{camera-zoom-increase}} - {{camera-zoom-decrease}}) * {{camera-zoom-speed}}
      return zoom < 0.05 && zoom > -0.05 ? 0 : Math.max(Math.min(1, zoom), -1)
    `),
    newExpression: getUnindentedString(`
      const zoom = {{camera-zoom-increase}} - {{camera-zoom-decrease}}
      return zoom < 0.05 && zoom > -0.05 ? 0 : Math.max(Math.min(1, zoom), -1)
    `),
    newDescription:
      'Used to control the camera zoom. The value is the difference between {{camera-zoom-increase}} and {{camera-zoom-decrease}}.',
  },
  {
    id: 'camera-focus',
    oldExpression: getUnindentedString(`
      const focus = ({{camera-focus-increase}} - {{camera-focus-decrease}}) * {{camera-focus-speed}}
      return focus < 0.05 && focus > -0.05 ? 0 : Math.max(Math.min(1, focus), -1)
    `),
    newExpression: getUnindentedString(`
      const focus = {{camera-focus-increase}} - {{camera-focus-decrease}}
      return focus < 0.05 && focus > -0.05 ? 0 : Math.max(Math.min(1, focus), -1)
    `),
    newDescription:
      'Used to control the camera focus. The value is the difference between {{camera-focus-increase}} and {{camera-focus-decrease}}.',
  },
]

/**
 * Drop Cockpit's camera zoom/focus speed factor from stored shipped formulas.
 *
 * Exact copies of the two originally shipped expressions are rewritten in memory whenever they are found;
 * a user-tuned formula is left alone. The rewrite is not persisted: writing the whole function list
 * at boot would stamp a new epoch and could overwrite a newer vehicle copy. Listeners already close
 * over the same objects, so the in-memory edit is what this boot evaluates. The notice is shown at
 * most once per browser profile.
 * @returns {void}
 */
const migrateCameraSpeedFactorRemoval = (): void => {
  let rewroteShippedFormula = false
  for (const func of shippedCameraFunctions) {
    const stored = getAllTransformingFunctions().find((candidate) => candidate.id === func.id)
    if (stored === undefined || stored.expression.trim() !== func.oldExpression.trim()) continue
    // ponytail: not persisted — a boot-time setKeyValue would newest-epoch-win the whole list.
    // Ceiling: this patch must ship for as long as 1.18 installs keep the old stored formula.
    // Upgrade: persist with the existing epoch (or 0) so the rewrite cannot outrank the vehicle.
    stored.expression = func.newExpression
    stored.description = func.newDescription
    const info = getDataLakeVariableInfo(stored.id)
    if (info !== undefined) updateDataLakeVariableInfo({ ...info, description: func.newDescription })
    rewroteShippedFormula = true
  }

  const leftoverSpeedRef = getAllTransformingFunctions().some((func) =>
    cameraSpeedRemovedIds.some((id) => func.expression.includes(id))
  )
  if ((rewroteShippedFormula || leftoverSpeedRef) && localStorage.getItem(cameraSpeedNoticeKey) !== 'true') {
    openSnackbar({
      message:
        'Camera zoom and focus speed are now set on the vehicle. Cockpit no longer keeps those settings, so zoom and focus no longer use them. ' +
        'If something you made still refers to them, edit it in Tools → Data-lake.',
      variant: 'info',
      duration: 12000,
    })
    localStorage.setItem(cameraSpeedNoticeKey, 'true')
  }
}

/**
 * Run all migrations
 */
export function runMigrations(): void {
  migrateRenameOfLocalStorageKeys()
  migrateLegacyTelemetryOptOutToHardwareSharing()
  migrateCameraSpeedFactorRemoval()
}
