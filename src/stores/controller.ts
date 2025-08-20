import { useDocumentVisibility } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { defineStore } from 'pinia'
import { v4 as uuid4 } from 'uuid'
import { computed, onMounted, ref, toRaw, watch } from 'vue'

import { defaultJoystickCalibration } from '@/assets/defaults'
import {
  availableGamepadToCockpitMaps,
  cockpitStandardToProtocols,
  defaultProtocolMappingVehicleCorrespondency,
} from '@/assets/joystick-profiles'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { checkForOtherManualControlSources } from '@/libs/blueos'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import {
  joystickCalibrationOptionsKey,
  joystickManager,
  JoystickModel,
  JoysticksMap,
  JoystickStateEvent,
} from '@/libs/joystick/manager'
import { allAvailableAxes, allAvailableButtons } from '@/libs/joystick/protocols'
import { CockpitActionsFunction, executeActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import { modifierKeyActions, otherAvailableActions } from '@/libs/joystick/protocols/other'
import { isElectron } from '@/libs/utils'
import { Alert, AlertLevel } from '@/types/alert'
import {
  type GamepadToCockpitStdMapping,
  type JoystickProtocolActionsMapping,
  type JoystickState,
  type ProtocolAction,
  CockpitModifierKeyOption,
  Joystick,
  JoystickAxis,
  JoystickButton,
  JoystickCalibration,
  JoystickCalibrationOptions,
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
  const userCustomCockpitStdMappings = useBlueOsStorage<{ [key in JoystickModel]?: GamepadToCockpitStdMapping }>(
    cockpitStdMappingsKey,
    {}
  )
  const availableAxesActions = ref(allAvailableAxes())
  const availableButtonActions = ref(allAvailableButtons())
  const enableForwarding = ref(false)
  const preventJoystickForwarding = ref(false)
  const holdLastInputWhenWindowHidden = useBlueOsStorage('cockpit-hold-last-joystick-input-when-window-hidden', false)
  const vehicleTypeProtocolMappingCorrespondency = useBlueOsStorage<typeof defaultProtocolMappingVehicleCorrespondency>(
    'cockpit-default-vehicle-type-protocol-mappings',
    defaultProtocolMappingVehicleCorrespondency
  )

  const cockpitStdMappings = computed<typeof availableGamepadToCockpitMaps>(() => {
    const mappings = {} as typeof availableGamepadToCockpitMaps
    Object.entries(userCustomCockpitStdMappings.value).forEach(([key, value]) => {
      mappings[key as JoystickModel] = value
    })
    // Always use (and override with) mappings from our database if available
    Object.entries(availableGamepadToCockpitMaps).forEach(([key, value]) => {
      mappings[key as JoystickModel] = value
    })
    return mappings
  })

  const joystickCalibrationOptions = useBlueOsStorage<JoystickCalibrationOptions>(joystickCalibrationOptionsKey, {
    [JoystickModel.Unknown]: defaultJoystickCalibration,
  })

  const disabledJoysticks = useBlueOsStorage<string[]>('cockpit-disabled-joystick-models', [])

  const currentMainJoystick = ref<Joystick | undefined>(undefined)

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

  const initializeProtocolMapping = (mapping: JoystickProtocolActionsMapping): void => {
    // Initialize axesCorrespondencies for all axes up to 31
    for (let axis = 0; axis <= 31; axis++) {
      if (mapping.axesCorrespondencies[axis] === undefined) {
        mapping.axesCorrespondencies[axis] = {
          action: otherAvailableActions.no_function,
          min: -1.0,
          max: 1.0,
        }
      }
    }

    // Initialize buttonsCorrespondencies for all buttons up to 31
    const modifierKeys = Object.keys(mapping.buttonsCorrespondencies)
    for (const modKey of modifierKeys) {
      const buttonsCorrespondency = mapping.buttonsCorrespondencies[modKey as CockpitModifierKeyOption]
      for (let button = 0; button <= 31; button++) {
        if (buttonsCorrespondency[button] === undefined) {
          buttonsCorrespondency[button] = {
            action: otherAvailableActions.no_function,
          }
        }
      }
    }
  }

  onMounted(() => {
    initializeProtocolMapping(protocolMapping.value)
  })

  watch(
    () => protocolMapping.value,
    (newMapping) => {
      initializeProtocolMapping(newMapping)
    },
    { immediate: true, deep: true }
  )

  const registerControllerUpdateCallback = (callback: controllerUpdateCallback): void => {
    updateCallbacks.value.push(callback)
  }

  joystickManager.onJoystickConnectionUpdate((event) => processJoystickConnectionEvent(event))
  joystickManager.onJoystickStateUpdate((event) => processJoystickStateEvent(event))

  const processJoystickConnectionEvent = async (event: JoysticksMap): Promise<void> => {
    const newMap = new Map(Array.from(event).map(([index, gamepad]) => [index, new Joystick(gamepad)]))

    const thereWereJoysticksBefore = joysticks.value.size > 0

    // Add new joysticks
    for (const [index, joystick] of newMap) {
      if (joysticks.value.has(index)) continue
      joystick.model = joystickManager.getModel(joystick.gamepad)
      const { product_id, vendor_id } = joystickManager.getVidPid(joystick.gamepad)
      joysticks.value.set(index, joystick)
      console.info(`Joystick ${index} connected. Model: ${joystick.model} // VID: ${vendor_id} // PID: ${product_id}`)

      if (thereWereJoysticksBefore && enableForwarding.value) {
        console.warn('There are joysticks connected and forwarding already. Skipping joystick conflict check.')
        return
      }

      // Check if other GCS is sending MANUAL_CONTROL messages
      const otherSourceDetected = await checkForOtherManualControlSources()

      if (otherSourceDetected) {
        console.warn('Other GCS sending MANUAL_CONTROL messages detected. Disabling joystick forwarding.')
        enableForwarding.value = false
        preventJoystickForwarding.value = true

        showDialog({
          title: 'Multiple joystick controllers detected',
          message: [
            `Another ground control station is already sending joystick commands to this vehicle, and using multiple
            joysticks simultaneously can cause unpredictable behavior.`,
            `If you still want to use this joystick, click the top-right joystick widget and enable forwarding. You can
            also disable the joystick forwarding on the other Cockpit instance the same way.`,
          ],
          variant: 'warning',
          maxWidth: 720,
          persistent: false,
        })
      } else {
        console.info('No other sources of joystick commands detected. Enabling joystick forwarding.')
        enableForwarding.value = true
      }
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

    // If there's at least one joystick connected, set it as the current main joystick
    if (joysticks.value.size >= 1) {
      currentMainJoystick.value = Array.from(joysticks.value.values())[0]

      // If there's no calibration options for the current main joystick, use the default calibration
      if (joystickCalibrationOptions.value[currentMainJoystick.value.model] === undefined) {
        console.info('No calibration options found for joystick model. Using default calibration.')
        const newCalibration = {
          deadband: { enabled: false, thresholds: { axes: [], buttons: [] } },
          exponential: { enabled: false, factors: { axes: [], buttons: [] } },
        } as JoystickCalibration
        currentMainJoystick.value.gamepad.axes.forEach((_, index) => {
          newCalibration.deadband.thresholds.axes[index] = defaultJoystickCalibration.deadband.thresholds.axes[index]
          newCalibration.exponential.factors.axes[index] = defaultJoystickCalibration.exponential.factors.axes[index]
        })
        currentMainJoystick.value.gamepad.buttons.forEach((_, index) => {
          newCalibration.deadband.thresholds.buttons[index] =
            defaultJoystickCalibration.deadband.thresholds.buttons[index]
          newCalibration.exponential.factors.buttons[index] =
            defaultJoystickCalibration.exponential.factors.buttons[index]
        })
        joystickCalibrationOptions.value[currentMainJoystick.value.model] = newCalibration
      }
    }
  }

  // Disable joystick forwarding if the window/tab is not visible (except on Electron)
  const windowVisibility = useDocumentVisibility()
  watch(windowVisibility, (value) => {
    // Disable this failcheck if the user explicitly wants to hold the last input when the window is hidden
    // This can be considered unsafe, as the user might not be aware of the joystick input being forwarded to the vehicle
    if (holdLastInputWhenWindowHidden.value) return

    if (isElectron()) return

    if (value === 'hidden') {
      console.warn('Window/tab hidden. Disabling joystick forwarding.')
      enableForwarding.value = false
    } else {
      console.info('Window/tab visible. Enabling joystick forwarding.')
      enableJoystickForwardingIfSafe()
    }
  })

  const { showDialog } = useInteractionDialog()

  const processJoystickStateEvent = (event: JoystickStateEvent): void => {
    const joystick = joysticks.value.get(event.index)
    if (joystick === undefined) return
    joystick.gamepad = event.gamepad

    const joystickModel = joystick.model || JoystickModel.Unknown
    joystick.gamepadToCockpitMap = cockpitStdMappings.value[joystickModel]
    const currentState = {
      axes: [...event.gamepad.axes],
      buttons: [...event.gamepad.buttons.map((button) => button.value)],
    }

    // If joystick forwarding is disabled, disable the callback processing
    if (!enableForwarding.value) return

    for (const callback of updateCallbacks.value) {
      try {
        callback(
          currentState,
          protocolMapping.value,
          activeButtonActions(currentState, protocolMapping.value),
          actionsJoystickConfirmRequired.value
        )
      } catch (error) {
        console.error('Error while processing joystick state event:', error)
      }
    }
  }

  const activeButtonActions = (
    joystickState: JoystickState,
    mapping: JoystickProtocolActionsMapping
  ): ProtocolAction[] => {
    let modifierKeyId = modifierKeyActions.regular.id

    Object.entries(mapping.buttonsCorrespondencies.regular).forEach(([key, value]) => {
      const buttonActive = joystickState.buttons[Number(key)] ?? 0 > 0.5
      const isModifier = Object.values(modifierKeyActions)
        .map((a) => JSON.stringify(a))
        .includes(JSON.stringify(value.action))
      if (buttonActive && isModifier) {
        modifierKeyId = value.action.id
      }
    })

    const modKeyAction = modifierKeyActions[modifierKeyId as CockpitModifierKeyOption]

    const activeActions = joystickState.buttons
      .map((btnState, idx) => ({ id: idx, value: btnState }))
      .filter((btn) => (btn.value ?? 0) > 0.5)
      .map((btn) => {
        const btnMapping = mapping.buttonsCorrespondencies[modifierKeyId as CockpitModifierKeyOption][btn.id]
        if (btnMapping && btnMapping.action) {
          return btnMapping.action
        } else {
          // Return a default action or handle accordingly
          return otherAvailableActions.no_function
        }
      })

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
            showDialog({ message: warningText, variant: 'warning' })
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
        showDialog({ message: "Cannot map modifier key to it's own layout.", variant: 'warning' })
        protocolMapping.value.buttonsCorrespondencies[modKey as CockpitModifierKeyOption][
          Number(btn) as JoystickButton
        ].action = otherAvailableActions.no_function
      })
    })

    btnsToUnmap.forEach((v) => {
      const actionToUnmap = protocolMapping.value.buttonsCorrespondencies[v.modKey][v.button].action
      if (JSON.stringify(actionToUnmap) === JSON.stringify(otherAvailableActions.no_function)) return
      showDialog({
        message: `Unmapping '${actionToUnmap.name} from ${v.modKey} layout. Cannot use same button as the modifier.`,
        variant: 'warning',
      })
      protocolMapping.value.buttonsCorrespondencies[v.modKey][v.button].action = otherAvailableActions.no_function
    })
  }, 500)

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
        showDialog({ variant: 'error', message: 'Invalid joystick mapping file.', timer: 3000 })
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
        showDialog({ message: 'Invalid functions mapping file.', variant: 'error', timer: 3000 })
        return
      }
      protocolMapping.value = maybeFunctionsMapping
      showDialog({ message: 'Functions mapping imported successful.', variant: 'success', timer: 2000 })
    }
    // @ts-ignore: We know the event type and need refactor of the event typing
    reader.readAsText(e.target.files[0])
  }

  const mergeFunctionsMapping = (mapping: JoystickProtocolActionsMapping): void => {
    const existingIndex = protocolMappings.value.findIndex((m) => m.hash === mapping.hash || m.name === mapping.name)

    if (existingIndex !== -1) {
      protocolMappings.value[existingIndex] = mapping
      protocolMappingIndex.value = existingIndex
    } else {
      protocolMappings.value.push(mapping)
      protocolMappingIndex.value = protocolMappings.value.length - 1
    }
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

  const actionsToCallFromJoystick = ref<CockpitActionsFunction[]>([])
  const addActionToCallFromJoystick = (actionId: CockpitActionsFunction): void => {
    if (!actionsToCallFromJoystick.value.includes(actionId)) {
      actionsToCallFromJoystick.value.push(actionId)
    }
  }

  const enableJoystickForwardingIfSafe = (): void => {
    if (preventJoystickForwarding.value) {
      console.warn('Joystick forwarding is being prevented explicitly. Not enabling.')
      return
    }
    enableForwarding.value = true
  }

  // Track previous button states to detect rising edges (button press transitions)
  // Format: Map<actionId, wasActive>
  const previousActionStates = ref<Map<string, boolean>>(new Map())

  registerControllerUpdateCallback(async (joystickState, actionsMapping, activeActions, actionsConfirmRequired) => {
    if (!joystickState || !actionsMapping || !activeActions || !actionsConfirmRequired) {
      return
    }

    actionsToCallFromJoystick.value = []

    // Get list of active actions for this joystick state
    const currentActiveActions = activeActions.filter((action) => action.protocol === JoystickProtocol.CockpitAction)

    // Process each active cockpit action
    currentActiveActions.forEach((action) => {
      // Create a unique key for this action
      const actionStateKey = `action_${action.id}`

      // Check if this action was active in the previous state
      const wasActive = previousActionStates.value.get(actionStateKey) || false

      // Store current state for next time
      previousActionStates.value.set(actionStateKey, true)

      // Only trigger action on rising edge (button was just pressed)
      if (!wasActive) {
        try {
          addActionToCallFromJoystick(action.id as CockpitActionsFunction)
        } catch (error) {
          console.error(error)
        }
      }
    })

    // Reset inactive actions' states
    Array.from(previousActionStates.value.keys()).forEach((actionStateKey) => {
      const actionId = actionStateKey.replace('action_', '')
      const isCurrentlyActive = currentActiveActions.some((action) => action.id === actionId)

      if (!isCurrentlyActive) {
        previousActionStates.value.set(actionStateKey, false)
      }
    })

    if (enableForwarding.value) {
      actionsToCallFromJoystick.value.forEach((a) => executeActionCallback(a as CockpitActionsFunction))
    }
  })

  setInterval(() => {
    availableButtonActions.value = allAvailableButtons()
    availableAxesActions.value = allAvailableAxes()
  }, 1000)

  return {
    registerControllerUpdateCallback,
    enableForwarding,
    holdLastInputWhenWindowHidden,
    joysticks,
    protocolMapping,
    protocolMappings,
    protocolMappingIndex,
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
    loadDefaultProtocolMappingForVehicle,
    joystickCalibrationOptions,
    currentMainJoystick,
    disabledJoysticks,
    checkForOtherManualControlSources,
    mergeFunctionsMapping,
  }
})
