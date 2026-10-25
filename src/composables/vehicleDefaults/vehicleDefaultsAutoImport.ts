import { type Ref, onUnmounted } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { openSnackbar } from '@/composables/snackbar'
import * as Connection from '@/libs/connection/connection'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import {
  buildFreshSimulatorViewsGroupFromDefault,
  buildFreshViewsGroupFromDefault,
  buildReplacementMapping,
  evaluateDefaults,
} from '@/migration/default-profile-importer'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useControllerStore } from '@/stores/controller'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useWidgetManagerStore } from '@/stores/widgetManager'

/**
 * Single source for the per-vehicle "the user already handled the defaults walkthrough" flag.
 * Backed by {@link useBlueOsStorage}, so settings-v2 scopes it per (user, vehicle) automatically.
 * @returns {Ref<boolean>} Reactive flag; set to true to suppress the auto walkthrough for this vehicle
 */
export const useVehicleDefaultsHandledFlag = (): Ref<boolean> =>
  useBlueOsStorage<boolean>('cockpit-vehicle-defaults-handled', false)

const sitlVehicleTypes: Record<string, MavType> = { ardusub: MavType.MAV_TYPE_SUBMARINE }

/**
 * Wires the per-vehicle defaults flow to the `vehicle-sync-complete` event.
 *
 * Behaviour, evaluated on every sync-complete event:
 * - If the per-vehicle `cockpit-vehicle-defaults-handled` flag is set, do nothing.
 * - Otherwise run the evaluator, silently auto-import any side that comes back as `auto-import`
 *   (with a per-side success snackbar), then re-evaluate. Open the auto import modal when any side
 *   still says `offer`; if nothing is left to offer, just persist the handled flag.
 * - On setup, a SITL with external physics and a blank views group gets the default views with the Simulator widget.
 *
 * The flag lives in `useBlueOsStorage`, so settings-v2 scopes it automatically to the current
 * (user, vehicle) pair — no per-vehicle-type bookkeeping is needed.
 */
export const useVehicleDefaultsAutoImport = (): void => {
  const widgetStore = useWidgetManagerStore()
  const controllerStore = useControllerStore()
  const interfaceStore = useAppInterfaceStore()
  const mainVehicleStore = useMainVehicleStore()
  const defaultsHandled = useVehicleDefaultsHandledFlag()

  const handleSyncComplete = (): void => {
    try {
      if (defaultsHandled.value) return

      const vehicleType = mainVehicleStore.vehicleType
      if (vehicleType === undefined) return

      let evaluation = evaluateDefaults(vehicleType, widgetStore.viewsGroup, controllerStore.protocolMapping)

      if (evaluation.views.action === 'auto-import' && evaluation.views.defaultProfile) {
        widgetStore.viewsGroup = buildFreshViewsGroupFromDefault(evaluation.views.defaultProfile)
        openSnackbar({
          message: `Imported default views for ${evaluation.vehicleTypeName}.`,
          variant: 'success',
          duration: 5000,
        })
      }

      if (evaluation.joystick.action === 'auto-import' && evaluation.joystick.defaultMapping) {
        controllerStore.protocolMapping = buildReplacementMapping(evaluation.joystick.defaultMapping)
        openSnackbar({
          message: `Imported default joystick mapping for ${evaluation.vehicleTypeName}.`,
          variant: 'success',
          duration: 5000,
        })
      }

      // Re-evaluate after auto-imports so we don't open the modal for a side we just resolved.
      evaluation = evaluateDefaults(vehicleType, widgetStore.viewsGroup, controllerStore.protocolMapping)

      const stillNeedsDecision = evaluation.views.action === 'offer' || evaluation.joystick.action === 'offer'
      if (stillNeedsDecision) {
        if (
          interfaceStore.isVehicleDefaultsViewsImportModalVisible ||
          interfaceStore.isVehicleDefaultsJoystickImportModalVisible
        ) {
          return
        }
        interfaceStore.openVehicleDefaultsAutoImport()
      } else {
        defaultsHandled.value = true
      }
    } catch (error) {
      // A failure in the defaults flow must never wipe the user's current profile or block startup.
      console.error('Failed to evaluate vehicle defaults after sync.', error)
    }
  }

  // A SITL with external physics only sends heartbeats once the Simulator widget runs it, so a blank views group
  // gets the vehicle's default views, with the simulator in them, up front instead of after the first heartbeat
  const seedSimulatorViews = (): void => {
    try {
      const uri = mainVehicleStore.MAVLink2RestWebsocketURI
      if (uri.type() !== Connection.Type.Sitl || !uri.entries().get('model')?.startsWith('JSON')) return
      const vehicleType = sitlVehicleTypes[uri.host]
      if (vehicleType === undefined) return

      const { views, vehicleTypeName } = evaluateDefaults(
        vehicleType,
        widgetStore.viewsGroup,
        controllerStore.protocolMapping
      )
      if (views.action !== 'auto-import' || !views.defaultProfile) return
      widgetStore.viewsGroup = buildFreshSimulatorViewsGroupFromDefault(views.defaultProfile)
      openSnackbar({
        message: `Imported default views for ${vehicleTypeName}, with the simulator.`,
        variant: 'success',
        duration: 5000,
      })
    } catch (error) {
      console.error('Failed to import the default views for the simulated vehicle.', error)
    }
  }

  seedSimulatorViews()
  window.addEventListener('vehicle-sync-complete', handleSyncComplete)
  onUnmounted(() => {
    window.removeEventListener('vehicle-sync-complete', handleSyncComplete)
  })
}
