import { v4 as uuid } from 'uuid'
import { createApp } from 'vue'

import UserNameInputDialog from '@/components/UserNameInputDialog.vue'
import vuetify from '@/plugins/vuetify'

export const askForUsername = (): Promise<string | undefined> => {
  return new Promise((resolve, reject) => {
    const mountPoint = document.createElement('div')
    mountPoint.id = `username-prompt-dialog-${uuid()}`
    document.body.appendChild(mountPoint)
    const dialogApp = createApp(UserNameInputDialog, {
      onConfirmed: (username: string) => {
        resolve(username)
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
