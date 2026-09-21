import { ref } from 'vue'

import { openSnackbar } from '@/composables/snackbar'

/**
 * Whether the user has asked about updates in this session, which makes an outcome the startup check keeps quiet
 * about — a version they ignored before, or a failure to reach the update server — worth showing them.
 */
export const userAskedForUpdates = ref(false)

/**
 * Asks the main process to look for a new version right away. The answer arrives through the update events, so this
 * only reports the cases that never reach them: a build Cockpit does not update on its own, and a request the main
 * process is not yet listening for, which happens while the app is still starting up.
 * @returns {Promise<void>} Resolves once the main process has taken the request.
 */
export const checkForUpdates = async (): Promise<void> => {
  logUserAction('Requested a check for app updates')
  userAskedForUpdates.value = true

  try {
    if (await window.electronAPI!.checkForUpdates()) return

    openSnackbar({
      message: 'Cockpit does not update itself on this computer. Download the latest version from our releases page.',
      variant: 'warning',
      duration: 10000,
      action: {
        label: 'Open',
        handler: () => window.open('https://github.com/bluerobotics/cockpit/releases/', '_blank'),
      },
    })
  } catch {
    openSnackbar({
      message: 'Could not check for updates right now. Please try again in a moment.',
      variant: 'error',
      duration: 6000,
    })
  }

  userAskedForUpdates.value = false
}
