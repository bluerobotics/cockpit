import { useDocumentVisibility } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { defineStore } from 'pinia'
import Swal from 'sweetalert2'
import { v4 as uuid4 } from 'uuid'
import { computed, ref, toRaw, watch } from 'vue'

import {
  availableGamepadToCockpitMaps,
  cockpitStandardToProtocols,
  defaultProtocolMappingVehicleCorrespondency,
} from '@/assets/joystick-profiles'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { getKeyDataFromCockpitVehicleStorage, setKeyDataOnCockpitVehicleStorage } from '@/libs/blueos'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { type JoystickEvent, EventType, joystickManager, JoystickModel } from '@/libs/joystick/manager'
import { allAvailableAxes, allAvailableButtons } from '@/libs/joystick/protocols'
import { modifierKeyActions, otherAvailableActions } from '@/libs/joystick/protocols/other'
import { Alert, AlertLevel } from '@/types/alert'
import {
  type JoystickProtocolActionsMapping,
  type JoystickState,
  type ProtocolAction,
  CockpitModifierKeyOption,
  Joystick,
  JoystickAxis,
  JoystickButton,
  JoystickProtocol,
} from '@/types/joystick'

import { useAlertStore } from './alert'

export type controllerUpdateCallback = (
  state: JoystickState,
  protocolActionsMapping: JoystickProtocolActionsMapping,
  activeButtonActions: ProtocolAction[],
  actionsJoystickConfirmRequired: Record<string, boolean>
) => void

const protocolMappingsKey = 'cockpit-protocol-mappings-v1'
const protocolMappingIndexKey = 'cockpit-protocol-mapping-index-v1'
const cockpitStdMappingsKey = 'cockpit-standard-mappings-v2'

export const useControllerStore = defineStore('controller', () => {
  const alertStore = useAlertStore()
  const joysticks = ref<Map<number, Joystick>>(new Map())
  const updateCallbacks = ref<controllerUpdateCallback[]>([])
  const protocolMappings = useBlueOsStorage(protocolMappingsKey, cockpitStandardToProtocols)
  const protocolMappingIndex = useBlueOsStorage(protocolMappingIndexKey, 0)
  const cockpitStdMappings = useBlueOsStorage(cockpitStdMappingsKey, availableGamepadToCockpitMaps)
  const availableAxesActions = allAvailableAxes
  const availableButtonActions = allAvailableButtons
  const enableForwarding = ref(false)
  const holdLastInputWhenWindowHidden = useBlueOsStorage('cockpit-hold-last-joystick-input-when-window-hidden', false)
  const vehicleTypeProtocolMappingCorrespondency = useBlueOsStorage<typeof defaultProtocolMappingVehicleCorrespondency>(
    'cockpit-default-vehicle-type-protocol-mappings',
    defaultProtocolMappingVehicleCorrespondency
  )
  // Confirmation per joystick action required currently is only available for cockpit actions
  const actionsJoystickConfirmRequired = useBlueOsStorage(
    'cockpit-actions-joystick-confirm-required',
    {} as Record<string, boolean>
  )

  const protocolMapping = computed<JoystickProtocolActionsMapping>({
    get() {
      return protocolMappings.value[protocolMappingIndex.value]
    },
    set(newValue) {
      protocolMappings.value[protocolMappingIndex.value] = newValue
    },
  })

  /**
   * Change current protocol mapping for given one
   * @param { JoystickProtocolActionsMapping } mapping - The functions mapping to be loaded
   */
  const loadProtocolMapping = (mapping: JoystickProtocolActionsMapping): void => {
    const mappingIndex = protocolMappings.value.findIndex((p) => p.name === mapping.name)
    if (mappingIndex === -1) {
      throw new Error('Could not find mapping.')
    }
    protocolMappingIndex.value = mappingIndex
  }

  const registerControllerUpdateCallback = (callback: controllerUpdateCallback): void => {
    updateCallbacks.value.push(callback)
  }

  joystickManager.onJoystickUpdate((event) => processJoystickEvent(event))
  joystickManager.onJoystickStateUpdate((event) => processJoystickStateEvent(event))

  const processJoystickEvent = (event: Map<number, Gamepad>): void => {
    const newMap = new Map(Array.from(event).map(([index, gamepad]) => [index, new Joystick(gamepad)]))

    // Add new joysticks
    for (const [index, joystick] of newMap) {
      if (joysticks.value.has(index)) continue
      joystick.model = joystickManager.getModel(joystick.gamepad)
      joysticks.value.set(index, joystick)
      console.info(`Joystick ${index} (${joystick.model}) connected.`)
      console.info('Enabling joystick forwarding.')
      enableForwarding.value = true
    }

    // Remove joysticks that doesn't not exist anymore
    for (const key of joysticks.value.keys()) {
      if (event.has(key)) continue
      const model = joysticks.value.get(key)?.model
      joysticks.value.delete(key)
      console.info(`Joystick ${key} (${model ?? 'Unknown model'}) disconnected.`)
      if (joysticks.value.size === 0) {
        console.warn('Disabling joystick forwarding.')
        enableForwarding.value = false
      }
    }
  }

  // Disable joystick forwarding if the window/tab is not visible (using VueUse)
  const windowVisibility = useDocumentVisibility()
  watch(windowVisibility, (value) => {
    // Disable this failcheck if the user explicitly wants to hold the last input when the window is hidden
    // This can be considered unsafe, as the user might not be aware of the joystick input being forwarded to the vehicle
    if (holdLastInputWhenWindowHidden.value) return

    if (value === 'hidden') {
      console.warn('Window/tab hidden. Disabling joystick forwarding.')
      enableForwarding.value = false
    } else {
      console.info('Window/tab visible. Enabling joystick forwarding.')
      enableForwarding.value = true
    }
  })

  const processJoystickStateEvent = (event: JoystickEvent): void => {
    const joystick = joysticks.value.get(event.detail.index)
    if (joystick === undefined || (event.type !== EventType.Axis && event.type !== EventType.Button)) return
    joystick.gamepad = event.detail.gamepad

    const joystickModel = joystick.model || JoystickModel.Unknown
    joystick.gamepadToCockpitMap = cockpitStdMappings.value[joystickModel]

    for (const callback of updateCallbacks.value) {
      callback(
        joystick.state,
        protocolMapping.value,
        activeButtonActions(joystick.state, protocolMapping.value),
        actionsJoystickConfirmRequired.value
      )
    }
  }

  const activeButtonActions = (
    joystickState: JoystickState,
    mapping: JoystickProtocolActionsMapping
  ): ProtocolAction[] => {
    let modifierKeyId = modifierKeyActions.regular.id

    Object.entries(mapping.buttonsCorrespondencies.regular).forEach((e) => {
      const buttonActive = joystickState.buttons[Number(e[0])] ?? 0 > 0.5
      const isModifier = Object.values(modifierKeyActions)
        .map((a) => JSON.stringify(a))
        .includes(JSON.stringify(e[1].action))
      if (buttonActive && isModifier) {
        modifierKeyId = e[1].action.id
      }
    })

    const modKeyAction = modifierKeyActions[modifierKeyId as CockpitModifierKeyOption]

    const activeActions = joystickState.buttons
      .map((btnState, idx) => ({ id: idx, value: btnState }))
      .filter((btn) => btn.value ?? 0 > 0.5)
      .map(
        (btn) =>
          mapping.buttonsCorrespondencies[modifierKeyId as CockpitModifierKeyOption][btn.id as JoystickButton].action
      )

    return activeActions.concat(modKeyAction)
  }

  let lastValidProtocolMapping = structuredClone(toRaw(protocolMapping.value))
  watch(
    protocolMappings,
    () => {
      // Check if there's any duplicated axis actions. If so, unmap (set to no_function) the axes that use to have the same action
      const oldMapping = structuredClone(toRaw(lastValidProtocolMapping))
      const newMapping = protocolMappings.value[protocolMappingIndex.value]
      const mappedAxisActions = Object.values(newMapping.axesCorrespondencies).map((v) => v.action.id)
      const duplicateAxisActions = mappedAxisActions
        .filter((item, index) => mappedAxisActions.indexOf(item) !== index)
        .filter((v) => v !== otherAvailableActions.no_function.id)
      if (!duplicateAxisActions.isEmpty()) {
        Object.entries(newMapping.axesCorrespondencies).forEach(([axis, mapping]) => {
          const isDuplicated = duplicateAxisActions.includes(mapping.action.id)
          const oldMappingId = oldMapping.axesCorrespondencies[axis as unknown as JoystickAxis].action.id
          const wasMapped = oldMappingId === mapping.action.id
          if (isDuplicated && wasMapped) {
            const warningText = `Unmapping '${mapping.action.name}' from input ${axis} layout.
              Cannot use same action on multiple axes.`
            Swal.fire({ text: warningText, icon: 'warning' })
            newMapping.axesCorrespondencies[axis as unknown as JoystickAxis].action = otherAvailableActions.no_function
          }
        })
        protocolMappings.value[protocolMappingIndex.value] = newMapping
      }
      lastValidProtocolMapping = structuredClone(toRaw(protocolMappings.value[protocolMappingIndex.value]))
    },
    { deep: true }
  )

  setInterval(() => {
    // eslint-disable-next-line jsdoc/require-jsdoc
    const btnsToUnmap: { modKey: CockpitModifierKeyOption; button: JoystickButton }[] = []
    Object.entries(protocolMapping.value.buttonsCorrespondencies.regular).forEach((v) => {
      if (v[1].action.protocol == JoystickProtocol.CockpitModifierKey) {
        btnsToUnmap.push({ modKey: v[1].action.id as CockpitModifierKeyOption, button: Number(v[0]) as JoystickButton })
      }
    })

    Object.entries(protocolMapping.value.buttonsCorrespondencies).forEach(([modKey, mapping]) => {
      Object.entries(mapping).forEach(([btn, action]) => {
        const modKeyAction = modifierKeyActions[modKey as CockpitModifierKeyOption]
        if (JSON.stringify(action.action) !== JSON.stringify(modKeyAction)) return
        Swal.fire({ text: "Cannot map modifier key to it's own layout.", icon: 'warning' })
        protocolMapping.value.buttonsCorrespondencies[modKey as CockpitModifierKeyOption][
          Number(btn) as JoystickButton
        ].action = otherAvailableActions.no_function
      })
    })

    btnsToUnmap.forEach((v) => {
      const actionToUnmap = protocolMapping.value.buttonsCorrespondencies[v.modKey][v.button].action
      if (JSON.stringify(actionToUnmap) === JSON.stringify(otherAvailableActions.no_function)) return
      Swal.fire({
        text: `Unmapping '${actionToUnmap.name} from ${v.modKey} layout. Cannot use same button as the modifier.`,
        icon: 'warning',
      })
      protocolMapping.value.buttonsCorrespondencies[v.modKey][v.button].action = otherAvailableActions.no_function
    })
  }, 500)

  // If there's a mapping in our database that is not on the user storage, add it to the user
  // This will happen whenever a new joystick profile is added to Cockpit's database
  Object.entries(availableGamepadToCockpitMaps).forEach(([k, v]) => {
    if (Object.keys(cockpitStdMappings.value).includes(k)) return
    cockpitStdMappings.value[k as JoystickModel] = v
  })

  const exportJoystickMapping = (joystick: Joystick): void => {
    const blob = new Blob([JSON.stringify(joystick.gamepadToCockpitMap)], { type: 'text/plain;charset=utf-8' })
    saveAs(blob, `cockpit-std-profile-joystick-${joystick.model}.json`)
  }

  const importJoystickMapping = async (joystick: Joystick, e: Event): Promise<void> => {
    const reader = new FileReader()
    reader.onload = (event: Event) => {
      // @ts-ignore: We know the event type and need refactor of the event typing
      const contents = event.target.result
      const maybeProfile = JSON.parse(contents)
      if (!maybeProfile['name'] || !maybeProfile['axes'] || !maybeProfile['buttons']) {
        Swal.fire({ icon: 'error', text: 'Invalid joystick mapping file.', timer: 3000 })
        return
      }
      cockpitStdMappings.value[joystick.model] = maybeProfile
    }
    // @ts-ignore: We know the event type and need refactor of the event typing
    reader.readAsText(e.target.files[0])
  }

  const exportFunctionsMapping = (protocolActionsMapping: JoystickProtocolActionsMapping): void => {
    const blob = new Blob([JSON.stringify(protocolActionsMapping)], { type: 'text/plain;charset=utf-8' })
    saveAs(blob, `cockpit-std-profile-joystick-${protocolActionsMapping.name}.json`)
  }

  const importFunctionsMapping = async (e: Event): Promise<void> => {
    const reader = new FileReader()
    reader.onload = (event: Event) => {
      // @ts-ignore: We know the event type and need refactor of the event typing
      const contents = event.target.result
      const maybeFunctionsMapping = JSON.parse(contents)
      if (
        !maybeFunctionsMapping['name'] ||
        !maybeFunctionsMapping['axesCorrespondencies'] ||
        !maybeFunctionsMapping['buttonsCorrespondencies']
      ) {
        Swal.fire({ icon: 'error', text: 'Invalid functions mapping file.', timer: 3000 })
        return
      }
      protocolMapping.value = maybeFunctionsMapping
    }
    // @ts-ignore: We know the event type and need refactor of the event typing
    reader.readAsText(e.target.files[0])
  }

  const exportFunctionsMappingToVehicle = async (
    vehicleAddress: string,
    functionsMapping: JoystickProtocolActionsMapping[]
  ): Promise<void> => {
    await setKeyDataOnCockpitVehicleStorage(vehicleAddress, protocolMappingsKey, functionsMapping)
    Swal.fire({ icon: 'success', text: 'Joystick functions mapping exported to vehicle.', timer: 3000 })
  }

  const importFunctionsMappingFromVehicle = async (vehicleAddress: string): Promise<void> => {
    const newMappings = await getKeyDataFromCockpitVehicleStorage(vehicleAddress, protocolMappingsKey)
    if (!newMappings) {
      throw new Error('Could not import functions mapping from vehicle. No data available.')
    }

    newMappings.forEach((mapping: JoystickProtocolActionsMapping) => {
      if (!mapping || !mapping['name'] || !mapping['axesCorrespondencies'] || !mapping['buttonsCorrespondencies']) {
        throw new Error('Could not import joystick funtions from vehicle. Invalid data.')
      }
    })
    // @ts-ignore: We check for the necessary fields in the if before
    protocolMappings.value = newMappings
  }

  // Add hash on mappings that don't have it - TODO: Remove for 1.0.0 release
  Object.values(protocolMappings.value).forEach((mapping) => {
    if (mapping.hash !== undefined) return

    // If the mapping is a correspondent of a cockpit standard mapping, use the correspondent hash
    const correspondentDefault = cockpitStandardToProtocols.find((defMapping) => defMapping.name === mapping.name)
    mapping.hash = correspondentDefault?.hash ?? uuid4()
  })

  // Add default mappings that the user does not have
  const updatedMappings = protocolMappings.value
  cockpitStandardToProtocols.forEach((defMapping) => {
    if (protocolMappings.value.find((mapping) => mapping.hash === defMapping.hash)) return
    updatedMappings.push(defMapping)
  })
  protocolMappings.value = updatedMappings

  const loadDefaultProtocolMappingForVehicle = (vehicleType: MavType): void => {
    // @ts-ignore: We know that the value is a string
    const defaultMappingHash = vehicleTypeProtocolMappingCorrespondency.value[vehicleType]
    const defaultProtocolMapping = protocolMappings.value.find((mapping) => mapping.hash === defaultMappingHash)
    if (!defaultProtocolMapping) {
      throw new Error('Could not find default mapping for this vehicle.')
    }

    try {
      loadProtocolMapping(defaultProtocolMapping)
    } catch (error) {
      alertStore.pushAlert(new Alert(AlertLevel.Warning, 'Could not load default mapping for vehicle type.'))
    }
  }

  return {
    registerControllerUpdateCallback,
    enableForwarding,
    holdLastInputWhenWindowHidden,
    joysticks,
    protocolMapping,
    protocolMappings,
    cockpitStdMappings,
    availableAxesActions,
    availableButtonActions,
    vehicleTypeProtocolMappingCorrespondency,
    actionsJoystickConfirmRequired,
    loadProtocolMapping,
    exportJoystickMapping,
    importJoystickMapping,
    exportFunctionsMapping,
    importFunctionsMapping,
    exportFunctionsMappingToVehicle,
    importFunctionsMappingFromVehicle,
    loadDefaultProtocolMappingForVehicle,
  }
})
