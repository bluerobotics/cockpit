import { openSnackbar } from '@/composables/snackbar'
import { createDataLakeVariable, deleteDataLakeVariable, getDataLakeVariableData } from '@/libs/actions/data-lake'
import { getAllTransformingFunctions, updateTransformingFunction } from '@/libs/actions/data-lake-transformations'
import { recordedDataLakeVariablesKey } from '@/libs/data-lake-logging'
import { shareHardwareDetailsKey } from '@/libs/external-telemetry/event-tracking'
import { settingsManager } from '@/libs/settings-management'
import { getUnindentedString } from '@/libs/utils'
import { collectOverlayRecordedVariableIds } from '@/utils/data-lake-recorded-variables-migration'

// Tracks which one-off migrations have already run, keyed by migration name.
const migrationsKey = 'cockpit-migrations'

/**
 * @param {string} name - Migration identifier
 * @returns {boolean} Whether the migration has already run
 */
export const hasMigrationRun = (name: string): boolean => {
  const migrations = (settingsManager.getKeyValue(migrationsKey) as Record<string, boolean> | undefined) ?? {}
  return migrations[name] === true
}

/**
 * Mark a migration as run so it never executes again.
 * @param {string} name - Migration identifier
 */
export const markMigrationAsRun = (name: string): void => {
  const migrations = (settingsManager.getKeyValue(migrationsKey) as Record<string, boolean> | undefined) ?? {}
  migrations[name] = true
  settingsManager.setKeyValue(migrationsKey, migrations)
}

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

/**
 * Seed the data lake recording list from the video-overlay variables on first run.
 *
 * When nothing is selected yet, pre-selects the variables already shown on the overlay. This runs
 * before the data lake logger starts, so the seeded selection is picked up on its first start. Runs
 * once and never again, even if the user later clears the list.
 */
const migrateRecordedVariablesFromOverlay = (): void => {
  const migrationName = 'recorded-variables-from-overlay'
  if (hasMigrationRun(migrationName)) return

  const existingSelection = settingsManager.getKeyValue(recordedDataLakeVariablesKey) as string[] | undefined
  if (existingSelection === undefined || existingSelection.length === 0) {
    const overlayIds = collectOverlayRecordedVariableIds()
    if (overlayIds.length > 0) {
      settingsManager.setKeyValue(recordedDataLakeVariablesKey, overlayIds)
    }
  }

  markMigrationAsRun(migrationName)
}

const cameraSpeedVariables = [
  { id: 'camera-zoom-speed', name: 'Camera Zoom Speed' },
  { id: 'camera-focus-speed', name: 'Camera Focus Speed' },
] as const

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
 * Drop Cockpit's camera zoom/focus speed factor from stored formulas and persisted values, once.
 *
 * Only the two expressions Cockpit originally shipped are rewritten; a user-tuned formula is left alone.
 * @returns {void}
 */
const migrateCameraSpeedFactorRemoval = (): void => {
  const migrationName = 'camera-speed-factor-removed'
  if (hasMigrationRun(migrationName)) return

  let rewroteShippedFormula = false
  for (const func of shippedCameraFunctions) {
    const stored = getAllTransformingFunctions().find((candidate) => candidate.id === func.id)
    if (stored === undefined || stored.expression.trim() !== func.oldExpression.trim()) continue
    updateTransformingFunction({ ...stored, expression: func.newExpression, description: func.newDescription })
    rewroteShippedFormula = true
  }

  let hadPersistedSpeed = false
  for (const { id, name } of cameraSpeedVariables) {
    // deleteDataLakeVariable only drops a stored persistValue when the id is registered.
    createDataLakeVariable({ id, name, type: 'number', persistValue: true })
    if (getDataLakeVariableData(id) !== undefined) hadPersistedSpeed = true
    deleteDataLakeVariable(id)
  }

  const leftoverSpeedRef = getAllTransformingFunctions().some((func) =>
    cameraSpeedVariables.some(({ id }) => func.expression.includes(id))
  )
  if (rewroteShippedFormula || hadPersistedSpeed || leftoverSpeedRef) {
    openSnackbar({
      message:
        'Camera zoom and focus speed are now set on the vehicle. Cockpit no longer keeps those settings, so zoom and focus no longer use them. ' +
        'If something you made still refers to them, edit it in Tools → Data-lake.',
      variant: 'info',
      duration: 12000,
    })
  }

  markMigrationAsRun(migrationName)
}

/**
 * Run all migrations
 */
export function runMigrations(): void {
  migrateRenameOfLocalStorageKeys()
  migrateLegacyTelemetryOptOutToHardwareSharing()
  migrateRecordedVariablesFromOverlay()
  migrateCameraSpeedFactorRemoval()
}
