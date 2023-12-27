import { useStorage } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { defineStore } from 'pinia'
import Swal from 'sweetalert2'
import { computed, ref } from 'vue'

import { availableGamepadToCockpitMaps, cockpitStandardToProtocols } from '@/assets/joystick-profiles'
import { getKeyDataFromCockpitVehicleStorage, setKeyDataOnCockpitVehicleStorage } from '@/libs/blueos'
import { type JoystickEvent, EventType, joystickManager, JoystickModel } from '@/libs/joystick/manager'
import { allAvailableAxes, allAvailableButtons } from '@/libs/joystick/protocols'
import { modifierKeyActions, otherAvailableActions } from '@/libs/joystick/protocols/other'
import {
  type GamepadToCockpitStdMapping,
  type JoystickProtocolActionsMapping,
  type JoystickState,
  type ProtocolAction,
  CockpitModifierKeyOption,
  Joystick,
  JoystickButton,
  JoystickProtocol,
} from '@/types/joystick'

export type controllerUpdateCallback = (
  state: JoystickState,
  protocolActionsMapping: JoystickProtocolActionsMapping,
  activeButtonActions: ProtocolAction[]
) => void

const protocolMappingsKey = 'cockpit-protocol-mappings-v1'
const protocolMappingIndexKey = 'cockpit-protocol-mapping-index-v1'
const cockpitStdMappingsKey = 'cockpit-standard-mappings-v2'

export const useControllerStore = defineStore('controller', () => {
  const joysticks = ref<Map<number, Joystick>>(new Map())
  const updateCallbacks = ref<controllerUpdateCallback[]>([])
  const protocolMappings = useStorage(protocolMappingsKey, cockpitStandardToProtocols)
  const protocolMappingIndex = useStorage(protocolMappingIndexKey, 0)
  const cockpitStdMappings = useStorage(cockpitStdMappingsKey, availableGamepadToCockpitMaps)
  const availableAxesActions = allAvailableAxes
  const availableButtonActions = allAvailableButtons
  const enableForwarding = ref(true)

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
      Swal.fire({ icon: 'error', text: 'Could not find mapping.', timer: 3000 })
      return
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
    }

    // Remove joysticks that doesn't not exist anymore
    for (const key of joysticks.value.keys()) {
      if (event.has(key)) continue
      joysticks.value.delete(key)
    }
  }

  const processJoystickStateEvent = (event: JoystickEvent): void => {
    const joystick = joysticks.value.get(event.detail.index)
    if (joystick === undefined || (event.type !== EventType.Axis && event.type !== EventType.Button)) return
    joystick.gamepad = event.detail.gamepad

    const joystickModel = joystick.model || JoystickModel.Unknown
    joystick.gamepadToCockpitMap = cockpitStdMappings.value[joystickModel]

    for (const callback of updateCallbacks.value) {
      callback(joystick.state, protocolMapping.value, activeButtonActions(joystick.state, protocolMapping.value))
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

  const exportJoysticksMappingsToVehicle = async (
    vehicleAddress: string,
    joystickMappings: { [key in JoystickModel]: GamepadToCockpitStdMapping }
  ): Promise<void> => {
    await setKeyDataOnCockpitVehicleStorage(vehicleAddress, cockpitStdMappingsKey, joystickMappings)
    Swal.fire({ icon: 'success', text: 'Joystick mapping exported to vehicle.', timer: 3000 })
  }

  const importJoysticksMappingsFromVehicle = async (vehicleAddress: string): Promise<void> => {
    const newMapping = await getKeyDataFromCockpitVehicleStorage(vehicleAddress, cockpitStdMappingsKey)
    if (!newMapping) {
      Swal.fire({ icon: 'error', text: 'No joystick mappings to import from vehicle.', timer: 3000 })
      return
    }
    try {
      Object.values(newMapping).forEach((mapping) => {
        if (!mapping['name'] || !mapping['axes'] || !mapping['buttons']) {
          throw Error('Invalid joystick mapping inside vehicle.')
        }
      })
    } catch (error) {
      Swal.fire({ icon: 'error', text: `Could not import joystick mapping from vehicle. ${error}`, timer: 3000 })
      return
    }

    // @ts-ignore: We check for the necessary fields in the if before
    cockpitStdMappings.value = newMapping
    Swal.fire({ icon: 'success', text: 'Joystick mapping imported from vehicle.', timer: 3000 })
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
      Swal.fire({ icon: 'error', text: 'Could not import functions mapping from vehicle. No data available.' })
      return
    }
    newMappings.forEach((mapping: JoystickProtocolActionsMapping) => {
      if (!mapping || !mapping['name'] || !mapping['axesCorrespondencies'] || !mapping['buttonsCorrespondencies']) {
        Swal.fire({ icon: 'error', text: 'Could not import joystick funtions from vehicle. Invalid data.' })
        return
      }
    })
    // @ts-ignore: We check for the necessary fields in the if before
    protocolMappings.value = newMappings
    Swal.fire({ icon: 'success', text: 'Joystick functions mapping imported from vehicle.' })
  }

  return {
    registerControllerUpdateCallback,
    enableForwarding,
    joysticks,
    protocolMapping,
    protocolMappings,
    cockpitStdMappings,
    availableAxesActions,
    availableButtonActions,
    loadProtocolMapping,
    exportJoystickMapping,
    importJoystickMapping,
    exportJoysticksMappingsToVehicle,
    importJoysticksMappingsFromVehicle,
    exportFunctionsMapping,
    importFunctionsMapping,
    exportFunctionsMappingToVehicle,
    importFunctionsMappingFromVehicle,
  }
})
