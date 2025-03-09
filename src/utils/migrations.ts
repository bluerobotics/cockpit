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
 * Run all migrations
 */
export function runMigrations(): void {
  migrateRenameOfLocalStorageKeys()
}
