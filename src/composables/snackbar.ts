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
   * The duration in milliseconds to show the snackbar
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

export const openSnackbar = (options: SnackbarOptions): void => {
  const snackbar: SnackbarType = { ...options, id: idCounter++ }
  state.snackbars.push(snackbar)
  if (snackbar.duration) {
    setTimeout((): void => {
      const index = state.snackbars.findIndex((s): boolean => s.id === snackbar.id)
      if (index !== -1) state.snackbars.splice(index, 1)
    }, snackbar.duration)
  }
}

export const useSnackbar = (): {
  /**
   * The list of snackbars to display
   */
  snackbars: SnackbarType[]
  /**
   * Opens a snackbar with the given options
   */
  openSnackbar: (options: SnackbarOptions) => void
} => {
  return {
    snackbars: state.snackbars,
    openSnackbar,
  }
}
