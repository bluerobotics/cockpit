import { v4 as uuid4 } from 'uuid'

import { Profile, WidgetType } from '@/types/widgets'

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
 * Migrate old widget component names to new ones
 */
const migrateRenameWidgetTypeOnProfiles = (): void => {
  const mappingWidgetComponentName = {
    CustomWidgetBase: 'CollapsibleContainer',
  }
  const profiles: Profile[] = JSON.parse(localStorage.getItem('cockpit-saved-profiles-v8')!)
  if (!profiles) return

  profiles.forEach((profile) => {
    profile.views.forEach((view) => {
      view.widgets.forEach((widget) => {
        Object.entries(mappingWidgetComponentName).forEach(([oldName, newName]) => {
          if (widget.component === oldName) {
            widget.component = newName as WidgetType
          }
          if (widget.name === oldName) {
            widget.name = newName as WidgetType
          }
          widget.hash = uuid4()
        })
      })
    })
  })

  localStorage.setItem('cockpit-saved-profiles-v8', JSON.stringify(profiles))
}

/**
 * Run all migrations
 */
export function runMigrations(): void {
  migrateRenameOfLocalStorageKeys()
  migrateRenameWidgetTypeOnProfiles()
}
