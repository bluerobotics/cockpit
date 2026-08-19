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
 * Reactive state backing the mounted dialog component.
 */
type DialogState = DialogOptions & {
  /**
   * Indicates whether the dialog should be shown.
   */
  showDialog: boolean
}

/**
 * Provides methods to control the interaction dialog.
 * @returns {object} - An object containing the showDialog and closeDialog methods.
 */
export function useInteractionDialog(): {
  /**
   * Shows the dialog with the provided options. If a dialog with the same options is already open, the pending
   * promise for it is returned instead of a new dialog being mounted.
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
  const defaultDialogState = (): DialogState => ({
    message: '',
    variant: '',
    title: '',
    actions: [],
    maxWidth: 'auto',
    showDialog: false,
    persistent: true,
    timer: 0,
  })

  const dialogProps = reactive<DialogState>(defaultDialogState())

  let dialogApp: App<Element> | null = null
  let mountPoint: HTMLElement | null = null
  let resolveFn: ((value: DialogResult | PromiseLike<DialogResult>) => void) | undefined
  let rejectFn: ((reason?: DialogResult) => void) | undefined
  let openDialogKey: string | undefined
  let openDialogPromise: Promise<DialogResult> | undefined

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
    // Callers on a poll or interval ask for the same dialog on every tick. Remounting would tear the open dialog
    // down and build it back up under the user, so hand back the pending promise while it is still on screen. The
    // key is the whole resolved state, so the same text with different buttons still gets its own dialog, and
    // action callbacks drop out of the JSON so freshly built ones don't defeat the comparison.
    const resolvedOptions = { ...defaultDialogState(), ...options }
    const key = JSON.stringify(resolvedOptions)
    if (openDialogPromise && openDialogKey === key) return openDialogPromise

    // Settle any still-pending dialog before replacing it so a caller awaiting a superseded dialog doesn't hang
    // forever. Resolve (rather than reject) to avoid unhandled rejections for the many callers that don't await.
    resolveFn?.({ isConfirmed: false })
    openDialogKey = key
    openDialogPromise = new Promise<DialogResult>((resolve, reject) => {
      // Merge over a fresh set of defaults so options the caller omits (notably `actions`) never leak from the
      // previous dialog, which would otherwise leave a stale destructive button on an unrelated dialog.
      Object.assign(dialogProps, resolvedOptions, { showDialog: true })
      resolveFn = (value) => {
        openDialogPromise = undefined
        resolve(value)
      }
      rejectFn = (reason) => {
        openDialogPromise = undefined
        reject(reason)
      }
      mountDialog()
    })
    return openDialogPromise
  }

  const closeDialog = (): void => {
    dialogProps.showDialog = false
    openDialogPromise = undefined
    unmountDialog()
  }

  onUnmounted(() => {
    unmountDialog()
  })

  return { showDialog, closeDialog }
}
