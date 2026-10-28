import { onUnmounted, watch } from 'vue'

import { goToMenuPage } from '@/composables/menuRouting'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { closeSnackbar, openSnackbar } from '@/composables/snackbar'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { findOffCenterAxes } from '@/libs/joystick/default-mappings'
import { vehicleTypeName } from '@/migration/default-profile-importer'
import { useControllerStore } from '@/stores/controller'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { SubMenuComponentName } from '@/types/general'
import type { AxisCorrespondence } from '@/types/joystick'

/**
 * Warns after each vehicle sync when a saved joystick axis range is off-center for the connected vehicle, since such
 * an axis moves the vehicle with the stick at rest and is otherwise only flagged on the joystick settings page.
 */
export const useOffCenterAxisWarning = (): void => {
  const controllerStore = useControllerStore()
  const mainVehicleStore = useMainVehicleStore()

  // Every reconnection syncs again, so the same finding is only reported once per session.
  let lastWarning: string | undefined
  let openWarningId: number | undefined

  // Synced with the vehicle, since a range chosen on purpose is chosen for everyone flying it.
  const suppressedFindings = useBlueOsStorage<string[]>('cockpit-suppressed-off-center-axis-warnings', [])

  const offCenterAxes = (vehicleType: MavType): AxisCorrespondence[] =>
    findOffCenterAxes(controllerStore.protocolMapping, vehicleType)

  // The ranges are part of the key, so suppressing one off-center range does not hide a different one later.
  const findingKey = (vehicleType: MavType, axes: AxisCorrespondence[]): string =>
    `${vehicleType}:${axes.map((axis) => `${axis.action.id}=${axis.min}/${axis.max}`).join()}`

  const checkAxes = (): void => {
    const vehicleType = mainVehicleStore.vehicleType
    if (vehicleType === undefined) return

    const axes = offCenterAxes(vehicleType)
    const key = findingKey(vehicleType, axes)
    if (key === lastWarning) return
    lastWarning = key

    // A finding that changed or went away, as on another vehicle, retires the warning about the previous one.
    if (openWarningId !== undefined) closeSnackbar(openWarningId)
    openWarningId = undefined
    if (axes.length === 0 || suppressedFindings.value.includes(key)) return

    const names = axes.map((axis) => axis.action.name)
    const subject =
      names.length === 1 ? `The joystick range of ${names[0]} is` : `The joystick ranges of ${names.join(', ')} are`
    const vehicle = vehicleTypeName(vehicleType)
    openWarningId = openSnackbar({
      message: `${subject} off-center for ${vehicle}, so the vehicle can move with the stick at rest.`,
      variant: 'warning',
      persistent: true,
      action: {
        label: 'Joystick settings',
        handler: () => {
          logUserAction('Opened the joystick settings from the off-center axis warning')
          goToMenuPage(SubMenuComponentName.SettingsJoystick)
        },
      },
      suppress: {
        tooltip: 'Do not warn about these ranges again on this vehicle',
        handler: () => (suppressedFindings.value = [...suppressedFindings.value, key]),
      },
    })
  }

  // Accepting the vehicle defaults offered on connection, or fixing the axis, can settle the finding while its warning
  // is still on screen.
  watch(
    () => controllerStore.protocolMapping,
    () => {
      if (openWarningId === undefined) return
      const vehicleType = mainVehicleStore.vehicleType
      if (vehicleType !== undefined && findingKey(vehicleType, offCenterAxes(vehicleType)) === lastWarning) return
      closeSnackbar(openWarningId)
      openWarningId = undefined
    },
    { deep: true }
  )

  window.addEventListener('vehicle-sync-complete', checkAxes)
  onUnmounted(() => window.removeEventListener('vehicle-sync-complete', checkAxes))
}
