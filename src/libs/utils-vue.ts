import { useI18n } from 'vue-i18n'

import { useInteractionDialog } from '@/composables/interactionDialog'

import { reloadCockpit } from './utils'

const { showDialog } = useInteractionDialog()

/**
 * Wait till the next tick to reload Cockpit
 * @param {number} timeout The time to wait before reloading, with a warning dialog opened, in milliseconds. Default value is 500 ms.
 */
export const reloadCockpitAndWarnUser = (timeout = 4000): void => {
  const { t } = useI18n()
  const restartMessage = t('configuration.interface.restartingCockpit', { seconds: timeout / 1000 })
  console.log(restartMessage)
  showDialog({ message: restartMessage, variant: 'info', timer: timeout })
  reloadCockpit(timeout)
}
