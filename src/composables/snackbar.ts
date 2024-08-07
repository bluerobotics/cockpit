/* eslint-disable vue/one-component-per-file */
import { v4 as uuid } from 'uuid'
import { App, createApp, onUnmounted, ref } from 'vue'

import SnackbarComponent from '@/components/Snackbar.vue' // Ensure the correct path
import vuetify from '@/plugins/vuetify' // Assuming you use Vuetify, adjust if necessary

/**
 * Options to configure the snackbar.
 */
interface SnackbarOptions {
  /**
   *
   */
  message: string
  /**
   *
   */
  duration?: number
  /**
   *
   */
  variant?: string
  /**
   *
   */
  closeButton?: boolean
}

/**
 * Interface for the return type of useSnackbar.
 */
interface UseSnackbarReturn {
  /**
   *
   */
  showSnackbar: (options: SnackbarOptions) => void
  /**
   *
   */
  closeSnackbar: () => void
}

/**
 * Provides methods to control the snackbar.
 * @returns {UseSnackbarReturn} - An object containing the snackbar control methods.
 */
export const useSnackbar = (): UseSnackbarReturn => {
  const snackbarProps = ref<
    SnackbarOptions & {
      /**
       *
       */
      showSnackbar: boolean
    }
  >({
    message: '',
    duration: 3000,
    variant: 'info',
    closeButton: true,
    showSnackbar: false,
  })

  let snackbarApp: App<Element> | null = null

  const mountSnackbar = (): void => {
    const mountPoint = document.createElement('div')
    document.body.appendChild(mountPoint)
    snackbarApp = createApp(SnackbarComponent, {
      ...snackbarProps.value,
      onClose: () => {
        closeSnackbar()
      },
    })
    snackbarApp.use(vuetify) // Add this if you're using Vuetify
    snackbarApp.mount(mountPoint)
  }

  const showSnackbar = (options: SnackbarOptions): void => {
    Object.assign(snackbarProps.value, options, { showSnackbar: true })
    if (!snackbarApp) {
      mountSnackbar()
    }

    // Automatically close snackbar after the specified duration
    if (options.duration) {
      setTimeout(() => {
        closeSnackbar()
      }, options.duration)
    }
  }

  const closeSnackbar = (): void => {
    snackbarProps.value.showSnackbar = false
    if (snackbarApp) {
      snackbarApp.unmount()
      snackbarApp = null
    }
  }

  onUnmounted(() => {
    if (snackbarApp) {
      snackbarApp.unmount()
    }
  })

  return { showSnackbar, closeSnackbar }
}

export const openSnackbar = (options: SnackbarOptions): Promise<string | undefined> => {
  return new Promise(() => {
    const mountPoint = document.createElement('div')
    mountPoint.id = `snackbar-${uuid()}`
    document.body.appendChild(mountPoint)
    const snackbarApp = createApp(SnackbarComponent, { showSnackbar: true, ...options })
    snackbarApp.use(vuetify)
    snackbarApp.mount(mountPoint)
  })
}
