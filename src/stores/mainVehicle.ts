import { type RemovableRef, useStorage, useTimestamp } from '@vueuse/core'
import { defineStore } from 'pinia'
import { type Ref, computed, reactive, ref, watch } from 'vue'

import { defaultGlobalAddress } from '@/assets/defaults'
import * as Connection from '@/libs/connection/connection'
import { ConnectionManager } from '@/libs/connection/connection-manager'
import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MavAutopilot, MAVLinkType, MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import type { ArduPilot } from '@/libs/vehicle/ardupilot/ardupilot'
import * as Protocol from '@/libs/vehicle/protocol/protocol'
import type { Altitude, Attitude, Coordinates, PageDescription, PowerSupply } from '@/libs/vehicle/types'
import * as Vehicle from '@/libs/vehicle/vehicle'
import { VehicleFactory } from '@/libs/vehicle/vehicle-factory'
import { ProtocolControllerState } from '@/types/joystick'

import { useControllerStore } from './controller'

/**
 * This is an abstraction that holds a customizable parameter that can fallback to a default value
 *
 * @template T The customizable parameter type
 */
export class CustomizableParameter<T> {
  private _defaultValue: () => T
  private _customValue: T
  isCustom: boolean

  /**
   * @param {Ref<T>} defaultVal The default parameter value
   */
  constructor(defaultVal: () => T) {
    this._defaultValue = defaultVal
    this._customValue = this.defaultValue
    this.isCustom = false
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
   * @returns {T} The default parameter
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

/**
 * Creates a useStorage of a CustomizableParameter<T> containing the necessary serialization
 *
 * @template T The customizable parameter type
 * @param {string} storageKey The key to use in useStorage
 * @param {T} defaultValue A callback to create the default parameter value
 * @returns {RemovableRef<CustomizableParameter<T>>} The useStorage
 */
function createCustomizableParameterWithStorage<T>(
  storageKey: string,
  defaultValue: () => T
): RemovableRef<CustomizableParameter<T>> {
  return useStorage(storageKey, new CustomizableParameter<T>(defaultValue), undefined, {
    serializer: {
      read: (v: string): CustomizableParameter<T> => {
        const ret = new CustomizableParameter<T>(defaultValue)

        const { _customValue, isCustom } = v ? JSON.parse(v) : undefined
        ret.val = _customValue ?? defaultValue
        ret.isCustom = isCustom ?? false

        return ret
      },
      write: (v: CustomizableParameter<T>): string => JSON.stringify(v), // since everything is serializable here
    },
  })
}

export const useMainVehicleStore = defineStore('main-vehicle', () => {
  const cpuLoad = ref<number>()
  const globalAddress = useStorage('cockpit-global-address', defaultGlobalAddress)

  const mainConnectionURI = createCustomizableParameterWithStorage<string>('cockpit-vehicle-uri', (): string => {
    return `ws://${globalAddress.value}:6040/ws/mavlink`
  })

  const webRTCSignallingURI = createCustomizableParameterWithStorage<string>('cockpit-webrtc-uri', (): string => {
    return `ws://${globalAddress.value}:6021`
  })

  const lastHeartbeat = ref<Date>()
  const firmwareType = ref<MavAutopilot>()
  const vehicleType = ref<MavType>()
  const altitude: Altitude = reactive({} as Altitude)
  const attitude: Attitude = reactive({} as Attitude)
  const coordinates: Coordinates = reactive({} as Coordinates)
  const powerSupply: PowerSupply = reactive({} as PowerSupply)
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
      mainConnectionURI.value.val = newMainConnection.uri().toString()
    }
  })

  ConnectionManager.addConnection(new Connection.URI(mainConnectionURI.value.val), Protocol.Type.MAVLink)

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

  const controllerStore = useControllerStore()
  const currentControllerState = ref<ProtocolControllerState | undefined>()
  const updateCurrentControllerState = (newState: ProtocolControllerState): void => {
    currentControllerState.value = newState
  }
  controllerStore.registerControllerUpdateCallback(updateCurrentControllerState)

  setInterval(() => {
    if (currentControllerState.value === undefined || controllerStore.joysticks.size === 0) return
    sendManualControl(currentControllerState.value)
  }, 40)
  setInterval(() => sendGcsHeartbeat(), 1000)

  return {
    arm,
    disarm,
    modesAvailable,
    setFlightMode,
    sendGcsHeartbeat,
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
    configurationPages,
  }
})
