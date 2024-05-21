import { onUnmounted, reactive } from 'vue'
import { App, createApp } from 'vue'

import InteractionDialogComponent from '@/components/InteractionDialog.vue'
import vuetify from '@/plugins/vuetify'
import { DialogActions } from '@/types/general'

/* eslint-disable jsdoc/require-jsdoc */
interface DialogOptions {
  message: string
  variant: string
  title?: string
  actions?: DialogActions[]
  maxWidth?: number
}

/**
 * Provides methods to control the interaction dialog.
 * @returns {object} - An object containing the showDialog and closeDialog methods.
 */
export function useInteractionDialog(): {
  /**
   *
   */
  showDialog: (options: DialogOptions) => void
  /**
   *
   */
  closeDialog: () => void
} {
  const dialogProps = reactive<
    DialogOptions & {
      /**
       * Indicates whether the dialog should be shown.
       * @type {boolean}
       */
      showDialog: boolean
    }
  >({
    message: '',
    variant: '',
    title: '',
    actions: [],
    maxWidth: 600,
    showDialog: false,
  })

  let dialogApp: App<Element> | null = null

  /**
   * Mounts the dialog component to the DOM.
   * @returns {void}
   */
  const mountDialog = (): void => {
    const mountPoint = document.createElement('div')
    document.body.appendChild(mountPoint)
    dialogApp = createApp(InteractionDialogComponent, dialogProps)
    dialogApp.use(vuetify)
    dialogApp.mount(mountPoint)
  }

  /**
   * Shows the dialog with the provided options.
   * @param {DialogOptions} options - Options to configure the dialog.
   * @returns {void}
   */
  const showDialog = (options: DialogOptions): void => {
    Object.assign(dialogProps, options, { showDialog: true })
    mountDialog()
  }

  /**
   * Closes the dialog.
   * @returns {void}
   */
  const closeDialog = (): void => {
    dialogProps.showDialog = false
  }

  onUnmounted(() => {
    if (dialogApp) {
      dialogApp.unmount()
    }
  })

  return { showDialog, closeDialog }
}
