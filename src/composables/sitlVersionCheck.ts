import { openSnackbar } from '@/composables/snackbar'
import { checkSitlVersion, onStaleSitlVersion } from '@/libs/sitl-version'

/**
 * Tells the user when this copy of Cockpit is older than the server's, then checks it once.
 * The check runs again whenever the simulator starts.
 */
export const initSitlVersionCheck = (): void => {
  onStaleSitlVersion((status) => {
    if (status === 'stale') {
      openSnackbar({
        message: 'Cockpit was updated, reloading to the new version...',
        variant: 'info',
        duration: 10000,
      })
      return
    }
    openSnackbar({
      message:
        "This page is still an old copy of Cockpit. Close any other Cockpit tabs, or clear this site's data, then reload the page.",
      variant: 'warning',
      persistent: true,
    })
  })
  checkSitlVersion()
}
