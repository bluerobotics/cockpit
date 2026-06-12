import { recordedDataLakeVariablesKey } from '@/libs/data-lake-logging'
import { shareHardwareDetailsKey } from '@/libs/external-telemetry/event-tracking'
import { settingsManager } from '@/libs/settings-management'
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

/**
 * Run all migrations
 */
export function runMigrations(): void {
  migrateRenameOfLocalStorageKeys()
  migrateLegacyTelemetryOptOutToHardwareSharing()
  migrateRecordedVariablesFromOverlay()
}
