import { reactive } from 'vue'

/**
 * Action offered by a snackbar, next to its message.
 */
export interface SnackbarAction {
  /**
   * Label of the button that triggers the action.
   */
  label: string
  /**
   * Called when the button is pressed, after the snackbar is dismissed.
   */
  handler: () => void
}

/**
 * Offer to stop showing a snackbar, for a warning the user can deliberately accept.
 */
export interface SnackbarSuppression {
  /**
   * Tooltip of the button, saying what will no longer be shown.
   */
  tooltip: string
  /**
   * Called when the button is pressed, after the snackbar is dismissed, to record that it should not come back.
   */
  handler: () => void
}

/**
 * Options to configure the snackbar.
 */
export interface SnackbarOptions {
  /**
   * The message to display in the snackbar
   */
  message: string
  /**
   * The duration in milliseconds to show the snackbar.
   * Ignored when {@link SnackbarOptions.persistent} is `true`.
   */
  duration?: number
  /**
   * The variant (severity) of the snackbar
   */
  variant: 'info' | 'success' | 'warning' | 'error'
  /**
   * Whether to show the close button
   */
  closeButton?: boolean
  /**
   * When `true`, the snackbar stays visible until the user dismisses it via the close button.
   * Overrides {@link SnackbarOptions.duration} when set.
   */
  persistent?: boolean
  /**
   * Action to offer alongside the message, so a warning can take the user where it can be dealt with.
   */
  action?: SnackbarAction
  /**
   * Offer to stop showing this snackbar. Its sender decides what that means and how long it lasts.
   */
  suppress?: SnackbarSuppression
}

type SnackbarType = SnackbarOptions & {
  /**
   * The unique identifier of the snackbar
   */
  id: number
}

const state = reactive({
  snackbars: [] as SnackbarType[],
})

let idCounter = 0

const closeTimers = new Map<number, ReturnType<typeof setTimeout>>()

export const pauseSnackbar = (id: number): void => {
  clearTimeout(closeTimers.get(id))
  closeTimers.delete(id)
}

export const closeSnackbar = (id: number): void => {
  pauseSnackbar(id)
  const index = state.snackbars.findIndex((s): boolean => s.id === id)
  if (index !== -1) state.snackbars.splice(index, 1)
}

// Restarts the full duration, as Vuetify does for its own timer when the pointer leaves the snackbar.
export const resumeSnackbar = (id: number): void => {
  const snackbar = state.snackbars.find((s): boolean => s.id === id)
  if (!snackbar || snackbar.persistent || !snackbar.duration || snackbar.duration <= 0) return
  pauseSnackbar(id)
  closeTimers.set(
    id,
    setTimeout((): void => closeSnackbar(id), snackbar.duration)
  )
}

export const openSnackbar = (options: SnackbarOptions): number => {
  const snackbar: SnackbarType = { ...options, id: idCounter++ }
  // Persistent snackbars have no timeout, so the close button is the only way to dismiss them.
  if (snackbar.persistent) snackbar.closeButton = true
  state.snackbars.push(snackbar)
  resumeSnackbar(snackbar.id)
  return snackbar.id
}

export const openActionErrorSnackbar = (error: unknown): void => {
  openSnackbar({
    message: error instanceof Error ? error.message : 'Action failed.',
    variant: 'error',
    duration: 5000,
  })
}

export const useSnackbar = (): {
  /**
   * The list of snackbars to display
   */
  snackbars: SnackbarType[]
  /**
   * Opens a snackbar with the given options
   * @returns {number} The id of the snackbar that was opened, for later programmatic dismissal.
   */
  openSnackbar: (options: SnackbarOptions) => number
  /**
   * Removes the snackbar with the given id from the list
   */
  closeSnackbar: (id: number) => void
} => {
  return {
    snackbars: state.snackbars,
    openSnackbar,
    closeSnackbar,
  }
}
