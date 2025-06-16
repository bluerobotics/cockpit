import { v4 as uuid } from 'uuid'
import { createApp } from 'vue'

import SettingsConflictDialog from '@/components/SettingsConflictDialog.vue'
import vuetify from '@/plugins/vuetify'

import { type ConflictItem, SettingsConflictResolution } from './settingsSyncer'

export const useSettingsConflictDialog = (conflicts: ConflictItem[]): Promise<SettingsConflictResolution> => {
  return new Promise((resolve, reject) => {
    const mountPoint = document.createElement('div')
    mountPoint.id = `settings-conflict-dialog-${uuid()}`
    document.body.appendChild(mountPoint)
    const dialogApp = createApp(SettingsConflictDialog, {
      modelValue: true,
      conflicts,
      onConfirmed: (resolutions: SettingsConflictResolution) => {
        resolve(resolutions)
        dialogApp.unmount()
        mountPoint.remove()
      },
      onDismissed: () => {
        reject()
        dialogApp.unmount()
        mountPoint.remove()
      },
    })
    dialogApp.use(vuetify)
    dialogApp.mount(mountPoint)
  })
}
