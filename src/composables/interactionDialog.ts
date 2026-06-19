import { onUnmounted, reactive } from 'vue'
import { App, createApp } from 'vue'

import InteractionDialogComponent from '@/components/InteractionDialog.vue'
import vuetify from '@/plugins/vuetify'
import router from '@/router'
import { DialogActions } from '@/types/general'

/**
 * Options to configure the interaction dialog.
 */
export interface DialogOptions {
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
 * Result returned when the interaction dialog is resolved or dismissed.
 */
export interface DialogResult {
  /**
   * Whether the user confirmed the dialog (`true`) or dismissed it (`false`).
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
  let mountPoint: HTMLElement | null = null
  let resolveFn: ((value: DialogResult | PromiseLike<DialogResult>) => void) | undefined
  let rejectFn: ((reason?: DialogResult) => void) | undefined

  const unmountDialog = (): void => {
    if (dialogApp) {
      dialogApp.unmount()
      dialogApp = null
    }
    if (mountPoint) {
      mountPoint.remove()
      mountPoint = null
    }
  }

  const mountDialog = (): void => {
    // Unmount any previously mounted dialog first, otherwise repeated calls stack orphaned dialog
    // instances that can never be dismissed and end up blocking the whole screen.
    unmountDialog()
    mountPoint = document.createElement('div')
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
    dialogApp.use(router)
    dialogApp.mount(mountPoint)
  }

  const showDialog = (options: DialogOptions): Promise<DialogResult> => {
    // Settle any still-pending dialog before replacing it so a caller awaiting a superseded dialog doesn't hang
    // forever. Resolve (rather than reject) to avoid unhandled rejections for the many callers that don't await.
    resolveFn?.({ isConfirmed: false })
    return new Promise((resolve, reject) => {
      Object.assign(dialogProps, options, { showDialog: true })
      resolveFn = resolve
      rejectFn = reject
      mountDialog()
    })
  }

  const closeDialog = (): void => {
    dialogProps.showDialog = false
    unmountDialog()
  }

  onUnmounted(() => {
    unmountDialog()
  })

  return { showDialog, closeDialog }
}
