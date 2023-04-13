import { useStorage, useTimestamp } from '@vueuse/core'
import { defineStore } from 'pinia'
import { type Ref, computed, reactive, ref, watch } from 'vue'

import { defaultGlobalAddress } from '@/assets/defaults'
import * as Connection from '@/libs/connection/connection'
import { ConnectionManager } from '@/libs/connection/connection-manager'
import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MavAutopilot, MAVLinkType, MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import { type InputWithPrettyName, MavlinkControllerState, sendCockpitActions } from '@/libs/joystick/protocols'
import type { ArduPilot } from '@/libs/vehicle/ardupilot/ardupilot'
import * as arducopter_metadata from '@/libs/vehicle/ardupilot/ParameterRepository/Copter-4.3/apm.pdef.json'
import * as arduplane_metadata from '@/libs/vehicle/ardupilot/ParameterRepository/Plane-4.3/apm.pdef.json'
import * as ardurover_metadata from '@/libs/vehicle/ardupilot/ParameterRepository/Rover-4.2/apm.pdef.json'
import * as ardusub_metadata from '@/libs/vehicle/ardupilot/ParameterRepository/Sub-4.1/apm.pdef.json'
import * as Protocol from '@/libs/vehicle/protocol/protocol'
import type { Altitude, Attitude, Coordinates, PageDescription, Parameter, PowerSupply } from '@/libs/vehicle/types'
import * as Vehicle from '@/libs/vehicle/vehicle'
import { VehicleFactory } from '@/libs/vehicle/vehicle-factory'
import { type MetadataFile } from '@/types/ardupilot-metadata'
import {
  type JoystickState,
  type ProtocolControllerMapping,
  JoystickProtocol,
  ProtocolControllerState,
} from '@/types/joystick'

import { useControllerStore } from './controller'

/**
 * This is an abstraction that holds a customizable parameter that can fallback to a default value
 *
 * @template T The customizable parameter type
 */
class CustomizableParameter<T> {
  private _customValue: T
  private _defaultValue: () => T
  isCustom = false

  /**
   * @param {Ref<T>} defaultVal The default parameter value
   */
  constructor(defaultVal: () => T) {
    this._defaultValue = defaultVal
    this._customValue = this.defaultValue
  }

  /**
   * Sets the URI to a given custom one
   *
   * @param {T} val
   */
  set val(val: T) {
    this._customValue = val
  }

  /**
   * @returns {T} The current configured parameter, whether default or custom
   */
  get val(): T {
    return this.isCustom ? this._customValue : this.defaultValue
  }

  /**
   * @returns {T} The current configured parameter, whether default or custom
   */
  get defaultValue(): T {
    return this._defaultValue()
  }

  /**
   * Resets custom to the default value and disables custom
   */
  public reset(): void {
    this.isCustom = false
    this._customValue = this.defaultValue
  }
}

export const useMainVehicleStore = defineStore('main-vehicle', () => {
  const cpuLoad = ref<number>()
  const globalAddress = useStorage('cockpit-vehicle-address', defaultGlobalAddress)
  const _mainConnectionURI = new CustomizableParameter<Connection.URI>(() => {
    return new Connection.URI(`ws://${globalAddress.value}:6040/ws/mavlink`)
  })
  const mainConnectionURI = ref(_mainConnectionURI)
  const _webRTCSignallingURI = new CustomizableParameter<Connection.URI>(() => {
    return new Connection.URI(`ws://${globalAddress.value}:6021`)
  })
  const webRTCSignallingURI = ref(_webRTCSignallingURI)
  const lastHeartbeat = ref<Date>()
  const firmwareType = ref<MavAutopilot>()
  const vehicleType = ref<MavType>()
  const altitude: Altitude = reactive({} as Altitude)
  const attitude: Attitude = reactive({} as Attitude)
  const coordinates: Coordinates = reactive({} as Coordinates)
  const powerSupply: PowerSupply = reactive({} as PowerSupply)
  const parametersTable = reactive({})
  const currentParameters = reactive({})
  const mainVehicle = ref<ArduPilot | undefined>(undefined)
  const isArmed = ref<boolean | undefined>(undefined)
  const icon = ref<string | undefined>(undefined)
  const configurationPages = ref<PageDescription[]>([])
  const timeNow = useTimestamp({ interval: 100 })

  const mode = ref<string | undefined>(undefined)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modes = ref<Map<string, any>>()

  /**
   * Check if vehicle is online (no more than 5 seconds passed since last heartbeat)
   *
   * @returns { boolean } True if vehicle is online
   */
  const isVehicleOnline = computed(() => {
    return lastHeartbeat.value !== undefined && new Date(timeNow.value).getTime() - lastHeartbeat.value.getTime() < 5000
  })

  /**
   * Arm the vehicle
   */
  function arm(): void {
    mainVehicle.value?.arm()
  }

  /**
   * Disarm the vehicle
   */
  function disarm(): void {
    mainVehicle.value?.disarm()
  }

  /**
   * Send manual control message
   *
   * @param {ProtocolControllerState} controllerState Current state of the controller
   */
  function sendManualControl(controllerState: ProtocolControllerState): void {
    mainVehicle.value?.sendManualControl(controllerState)
  }

  /**
   * Send heartbeat from GCS
   */
  function sendGcsHeartbeat(): void {
    mainVehicle.value?.sendGcsHeartbeat()
  }

  /**
   * Request current parameters from vehicle
   */
  function requestParametersList(): void {
    mainVehicle.value?.requestParametersList()
  }

  /**
   * List of available flight modes
   *
   * @returns {Array<string>}
   */
  function modesAvailable(): Array<string> {
    return [...(modes.value?.entries() ?? [])]
      .filter(([, value]) => value >= 0) // Remove cockpit internal flight modes
      .map(([key]) => key)
  }

  /**
   * Set vehicle flight mode
   *
   * @param {string} modeName
   */
  function setFlightMode(modeName: string): void {
    const enumMode = modes.value?.get(modeName)
    if (enumMode !== undefined) {
      mainVehicle.value?.setMode(enumMode)
    }
  }

  ConnectionManager.onMainConnection.add(() => {
    const newMainConnection = ConnectionManager.mainConnection()
    if (newMainConnection !== undefined) {
      mainConnectionURI.value.val = newMainConnection.uri()
    }
  })

  ConnectionManager.addConnection(mainConnectionURI.value.val, Protocol.Type.MAVLink)

  const getAutoPilot = (vehicles: WeakRef<Vehicle.Abstract>[]): ArduPilot => {
    const vehicle = vehicles?.last()?.deref()
    return (vehicle as ArduPilot) || undefined
  }

  VehicleFactory.onVehicles.once((vehicles: WeakRef<Vehicle.Abstract>[]) => {
    mainVehicle.value = getAutoPilot(vehicles)
    modes.value = mainVehicle.value.modesAvailable()
    icon.value = mainVehicle.value.icon()
    configurationPages.value = mainVehicle.value.configurationPages()

    mainVehicle.value.onAltitude.add((newAltitude: Altitude) => {
      Object.assign(altitude, newAltitude)
    })
    mainVehicle.value.onAttitude.add((newAttitude: Attitude) => {
      Object.assign(attitude, newAttitude)
    })
    mainVehicle.value.onArm.add((armed: boolean) => {
      isArmed.value = armed
    })
    mainVehicle.value.onCpuLoad.add((newCpuLoad: number) => {
      cpuLoad.value = newCpuLoad
    })
    mainVehicle.value.onPosition.add((newCoordinates: Coordinates) => {
      Object.assign(coordinates, newCoordinates)
    })
    mainVehicle.value.onPowerSupply.add((newPowerSupply: PowerSupply) => {
      Object.assign(powerSupply, newPowerSupply)
    })
    mainVehicle.value.onParameter.add((newParameter: Parameter) => {
      const newCurrentParameters = { ...currentParameters, ...{ [newParameter.name]: newParameter.value } }
      Object.assign(currentParameters, newCurrentParameters)
    })
    mainVehicle.value.onMAVLinkMessage.add(MAVLinkType.HEARTBEAT, (pack: Package) => {
      if (pack.header.system_id != 1 || pack.header.component_id != 1) {
        return
      }

      const heartbeat = pack.message as Message.Heartbeat
      firmwareType.value = heartbeat.autopilot.type
      vehicleType.value = heartbeat.mavtype.type
      lastHeartbeat.value = new Date()
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getAutoPilot(vehicles).onMode.add((vehicleMode: any) => {
      mode.value = [...(modes.value?.entries() ?? [])]
        .filter(([, value]) => value === vehicleMode)
        .map(([key]) => key)
        .first()
    })
  })

  // Allow us to set custom commands to be used in the browser
  // Expert mode
  watch(mainVehicle, async (newVehicle) => {
    if (newVehicle === undefined) {
      return
    }

    const win = window as any // eslint-disable-line @typescript-eslint/no-explicit-any
    win.vehicle = {
      arm: arm,
      disarm: disarm,
      modesAvailable: () => {
        console.log(modesAvailable())
      },
      setFlightMode: setFlightMode,
    }
  })

  watch(vehicleType, (newType, oldType) => {
    if (newType !== undefined && newType !== oldType) {
      // Default to submarine metadata
      let metadata: MetadataFile = ardusub_metadata
      // This is to avoid importing a 40 lines enum from mavlink and adding a switch case with 40 cases
      if (
        vehicleType.value?.toString().toLowerCase().includes('vtol') ||
        vehicleType.value?.toString().toLowerCase().includes('wing')
      ) {
        metadata = arduplane_metadata
      } else if (
        vehicleType.value?.toString().toLowerCase().includes('copter') ||
        vehicleType.value?.toString().toLowerCase().includes('rotor')
      ) {
        metadata = arducopter_metadata
      } else if (
        vehicleType.value?.toString().toLowerCase().includes('rover') ||
        vehicleType.value?.toString().toLowerCase().includes('boat')
      ) {
        metadata = ardurover_metadata
      }

      for (const category of Object.values(metadata)) {
        for (const [name, parameter] of Object.entries(category)) {
          if (!isNaN(Number(parameter))) {
            continue
          }
          const newParameterTable = { ...parametersTable, ...{ [name]: parameter } }
          Object.assign(parametersTable, newParameterTable)
        }
      }
    }
    requestParametersList()
  })

  const controllerStore = useControllerStore()
  const currentControllerState = ref<JoystickState>()
  const currentProtocolMapping = ref<ProtocolControllerMapping>()
  const updateCurrentControllerState = (newState: JoystickState, newMapping: ProtocolControllerMapping): void => {
    currentControllerState.value = newState
    currentProtocolMapping.value = newMapping
  }
  controllerStore.registerControllerUpdateCallback(updateCurrentControllerState)

  // Loop to send MAVLink Manual Control messages
  setInterval(() => {
    if (!currentControllerState.value || !currentProtocolMapping.value || controllerStore.joysticks.size === 0) return
    const newControllerState = new MavlinkControllerState(currentControllerState.value, currentProtocolMapping.value)
    sendManualControl(newControllerState)
  }, 40)
  setInterval(() => sendGcsHeartbeat(), 1000)

  // Loop to send Cockpit Action messages
  setInterval(() => {
    if (!currentControllerState.value || !currentProtocolMapping.value || controllerStore.joysticks.size === 0) return
    sendCockpitActions(currentControllerState.value, currentProtocolMapping.value)
  }, 10)

  const rtcConfiguration = computed(
    () =>
      ({
        bundlePolicy: 'max-bundle',
        iceServers: [
          {
            urls: `turn:${globalAddress.value}:3478`,
            username: 'user',
            credential: 'pwd',
          },
          {
            urls: `stun:${globalAddress.value}:3478`,
          },
        ],
        // eslint-disable-next-line no-undef
      } as RTCConfiguration)
  )

  const updateMavlinkButtonsPrettyNames = (): void => {
    if (!currentParameters || !parametersTable) return
    const newMavlinkButtonsNames: InputWithPrettyName[] = []
    // @ts-ignore: This type is huge. Needs refactoring typing here.
    if (parametersTable['BTN0_FUNCTION'] && parametersTable['BTN0_FUNCTION']['Values']) {
      const parameterValues: { title: string, value: number }[] = [] // eslint-disable-line
      // @ts-ignore: This type is huge. Needs refactoring typing here.
      Object.entries(parametersTable['BTN0_FUNCTION']['Values']).forEach((param) => {
        const rawText = param[1] as string
        const formatedText = (rawText.charAt(0).toUpperCase() + rawText.slice(1)).replace(new RegExp('_', 'g'), ' ')
        parameterValues.push({ title: formatedText as string, value: Number(param[0]) })
      })
      Object.entries(currentParameters).forEach((param) => {
        if (!param[0].startsWith('BTN') || !param[0].endsWith('_FUNCTION')) return
        const button = Number(param[0].replace('BTN', '').replace('_FUNCTION', ''))
        const functionName = parameterValues.find((p) => p.value === param[1])?.title
        if (functionName === undefined) return
        newMavlinkButtonsNames.push({
          input: { protocol: JoystickProtocol.MAVLink, value: button },
          prettyName: functionName,
        })
      })
    }
    let newAllPrettyButtonNames = controllerStore.allPrettyButtonNames.filter((btn) => {
      return btn.input.protocol !== JoystickProtocol.MAVLink
    })
    newAllPrettyButtonNames = newAllPrettyButtonNames.concat(newMavlinkButtonsNames)
    controllerStore.allPrettyButtonNames = newAllPrettyButtonNames
  }

  setInterval(() => updateMavlinkButtonsPrettyNames(), 1000)

  return {
    arm,
    disarm,
    modesAvailable,
    setFlightMode,
    sendGcsHeartbeat,
    requestParametersList,
    globalAddress,
    mainConnectionURI,
    webRTCSignallingURI,
    cpuLoad,
    lastHeartbeat,
    firmwareType,
    vehicleType,
    altitude,
    attitude,
    coordinates,
    powerSupply,
    mode,
    modes,
    isArmed,
    isVehicleOnline,
    icon,
    parametersTable,
    currentParameters,
    configurationPages,
    rtcConfiguration,
  }
})
