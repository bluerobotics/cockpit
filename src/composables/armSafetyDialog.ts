import { v4 as uuid } from 'uuid'
import { createApp } from 'vue'

import ArmSafetyDialog from '@/components/ArmSafetyDialog.vue'
import vuetify from '@/plugins/vuetify'
import { useAlertStore } from '@/stores/alert'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import { useSnackbar } from './snackbar'

export const openMainMenuIfSafeOrDesired = (): void => {
  const vehicleStore = useMainVehicleStore()
  const alertStore = useAlertStore()
  const interfaceStore = useAppInterfaceStore()
  const { openSnackbar } = useSnackbar()

  // If the vehicle is not armed, its safe to open the main menu
  if (!vehicleStore.isArmed) {
    interfaceStore.isMainMenuVisible = true
    return
  }

  // Skip warning if user has chosen to never show it again or skip for this session
  if (alertStore.neverShowArmedMenuWarning || alertStore.skipArmedMenuWarningThisSession) {
    // Show a snackbar warning instead
    openSnackbar({ message: 'Take care, your vehicle is armed', variant: 'warning' })
    interfaceStore.isMainMenuVisible = true
    return
  }

  const mountPoint = document.createElement('div')
  mountPoint.id = `arm-safety-dialog-${uuid()}`
  document.body.appendChild(mountPoint)
  const dialogApp = createApp(ArmSafetyDialog, {
    onConfirmed: () => {
      dialogApp.unmount()
      mountPoint.remove()
    },
    onDismissed: () => {
      dialogApp.unmount()
      mountPoint.remove()
    },
  })
  dialogApp.use(vuetify)
  dialogApp.mount(mountPoint)
}
