import { onUnmounted, reactive } from 'vue'
import { App, createApp } from 'vue'

import InteractionDialogComponent from '@/components/InteractionDialog.vue'
import vuetify from '@/plugins/vuetify'
import { DialogActions } from '@/types/general'

/**
 * Options to configure the interaction dialog.
 */
interface DialogOptions {
  /**
   * Message to display in the dialog. If an array, elements will be displayed as an item list.
   * @type {string}
   */
  message: string | string[]

  /**
   * The variant type of the dialog (e.g., 'info', 'warning', 'error', 'success').
   * @type {string}
   */
  variant: string

  /**
   * The title of the dialog.
   * @type {string}
   */
  title?: string

  /**
   * The actions to display in the dialog.
   * Each action should be an object containing text, size, color, class, disabled, and action properties.
   * @type {DialogActions[]}
   */
  actions?: DialogActions[]

  /**
   * The maximum width of the dialog in pixels.
   * @type {string | number}
   */
  maxWidth?: string | number
  /**
   * Persistent dialogs can't be closed with 'esc' or backdrop click.
   */
  persistent?: boolean
  /**
   * The time in milliseconds to automatically close the dialog.
   */
  timer?: number
}

/**
 *
 */
interface DialogResult {
  /**
   *
   */
  isConfirmed: boolean
}

/**
 * Provides methods to control the interaction dialog.
 * @returns {object} - An object containing the showDialog and closeDialog methods.
 */
export function useInteractionDialog(): {
  /**
   * Shows the dialog with the provided options.
   * @param {DialogOptions} options - Options to configure the dialog.
   * @returns {Promise<{ isConfirmed: boolean }>} - A promise that resolves or rejects based on user action.
   */
  showDialog: (options: DialogOptions) => Promise<DialogResult>
  /**
   * Closes the dialog.
   * @returns {void}
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
    maxWidth: 'auto',
    showDialog: false,
    persistent: true,
    timer: 0,
  })

  let dialogApp: App<Element> | null = null
  let resolveFn: (value: DialogResult | PromiseLike<DialogResult>) => void
  let rejectFn: (reason?: DialogResult) => void

  const mountDialog = (): void => {
    const mountPoint = document.createElement('div')
    document.body.appendChild(mountPoint)
    dialogApp = createApp(InteractionDialogComponent, {
      ...dialogProps,
      onConfirmed: () => {
        if (resolveFn) resolveFn({ isConfirmed: true })
      },
      onDismissed: () => {
        if (rejectFn) rejectFn({ isConfirmed: false })
      },
    })
    dialogApp.use(vuetify)
    dialogApp.mount(mountPoint)
  }

  const showDialog = (options: DialogOptions): Promise<DialogResult> => {
    return new Promise((resolve, reject) => {
      Object.assign(dialogProps, options, { showDialog: true })
      resolveFn = resolve
      rejectFn = reject
      mountDialog()
    })
  }

  const closeDialog = (): void => {
    dialogProps.showDialog = false
    if (dialogApp) {
      dialogApp.unmount()
      dialogApp = null
    }
  }

  onUnmounted(() => {
    if (dialogApp) {
      dialogApp.unmount()
    }
  })

  return { showDialog, closeDialog }
}
