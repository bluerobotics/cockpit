import { shareHardwareDetailsKey } from '@/libs/external-telemetry/event-tracking'
import { settingsManager } from '@/libs/settings-management'

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
 * Run all migrations
 */
export function runMigrations(): void {
  migrateRenameOfLocalStorageKeys()
  migrateLegacyTelemetryOptOutToHardwareSharing()
}
