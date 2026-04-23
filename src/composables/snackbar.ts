import { reactive } from 'vue'

/**
 * Options to configure the snackbar.
 */
interface SnackbarOptions {
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

export const closeSnackbar = (id: number): void => {
  const index = state.snackbars.findIndex((s): boolean => s.id === id)
  if (index !== -1) state.snackbars.splice(index, 1)
}

export const openSnackbar = (options: SnackbarOptions): number => {
  const snackbar: SnackbarType = { ...options, id: idCounter++ }
  // Persistent snackbars have no timeout, so the close button is the only way to dismiss them.
  if (snackbar.persistent) snackbar.closeButton = true
  state.snackbars.push(snackbar)
  if (!snackbar.persistent && snackbar.duration && snackbar.duration > 0) {
    setTimeout((): void => closeSnackbar(snackbar.id), snackbar.duration)
  }
  return snackbar.id
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
