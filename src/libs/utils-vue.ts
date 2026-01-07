import { useInteractionDialog } from '@/composables/interactionDialog'

import { reloadCockpit } from './utils'

const { showDialog } = useInteractionDialog()

/**
 * Wait till the next tick to reload Cockpit
 * @param {number} timeout The time to wait before reloading, with a warning dialog opened, in milliseconds. Default value is 500 ms.
 */
export const reloadCockpitAndWarnUser = (timeout = 3000): void => {
  const restartMessage = `Restarting Cockpit in ${timeout / 1000} seconds...`
  console.log(restartMessage)
  showDialog({ message: restartMessage, variant: 'info', timer: timeout })
  reloadCockpit(timeout)
}
