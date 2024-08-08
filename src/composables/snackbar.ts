import { v4 as uuid } from 'uuid'
import { createApp } from 'vue'

import Snackbar from '@/components/Snackbar.vue'
import vuetify from '@/plugins/vuetify'

export const openSnackbar = (message: string, duration: number): Promise<string | undefined> => {
  return new Promise(() => {
    const mountPoint = document.createElement('div')
    mountPoint.id = `snackbar-${uuid()}`
    document.body.appendChild(mountPoint)
    const snackbarApp = createApp(Snackbar, {
      openSnackbar: true,
      message,
      duration,
    })
    snackbarApp.use(vuetify)
    snackbarApp.mount(mountPoint)
  })
}
