import { useStorage, useTimestamp, watchThrottled } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'

import { defaultGlobalAddress } from '@/assets/defaults'
import { altitude_setpoint } from '@/libs/altitude-slider'
import { getCpuTempCelsius, getStatus } from '@/libs/blueos'
import * as Connection from '@/libs/connection/connection'
import { ConnectionManager } from '@/libs/connection/connection-manager'
import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MavAutopilot, MAVLinkType, MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import {
  availableCockpitActions,
  CockpitActionsManager,
  registerActionCallback,
} from '@/libs/joystick/protocols/cockpit-actions'
import { MavlinkManualControlManager } from '@/libs/joystick/protocols/mavlink-manual-control'
import type { ArduPilot } from '@/libs/vehicle/ardupilot/ardupilot'
import type { ArduPilotParameterSetData } from '@/libs/vehicle/ardupilot/types'
import * as Protocol from '@/libs/vehicle/protocol/protocol'
import type {
  Altitude,
  Attitude,
  PageDescription,
  PowerSupply,
  StatusGPS,
  StatusText,
  VehicleConfigurationSettings,
  Velocity,
} from '@/libs/vehicle/types'
import { Coordinates } from '@/libs/vehicle/types'
import * as Vehicle from '@/libs/vehicle/vehicle'
import { VehicleFactory } from '@/libs/vehicle/vehicle-factory'
import type { MissionLoadingCallback, Waypoint } from '@/types/mission'

import { useControllerStore } from './controller'
import { useWidgetManagerStore } from './widgetManager'

/**
 * This is an abstraction that holds a customizable parameter that can fallback to a default value
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
  const controllerStore = useControllerStore()
  const widgetStore = useWidgetManagerStore()
  const ws_protocol = location?.protocol === 'https:' ? 'wss' : 'ws'

  const cpuLoad = ref<number>()
  const globalAddress = useStorage('cockpit-vehicle-address', defaultGlobalAddress)
  const _mainConnectionURI = new CustomizableParameter<Connection.URI>(() => {
    const queryMainConnectionURI = new URLSearchParams(window.location.search).get('mainConnectionURI')
    return new Connection.URI(
      queryMainConnectionURI || `${ws_protocol}://${globalAddress.value}/mavlink2rest/ws/mavlink`
    )
  })
  const mainConnectionURI = ref(_mainConnectionURI)
  const _webRTCSignallingURI = new CustomizableParameter<Connection.URI>(() => {
    const queryWebRTCSignallingURI = new URLSearchParams(window.location.search).get('webRTCSignallingURI')
    return new Connection.URI(queryWebRTCSignallingURI || `${ws_protocol}://${globalAddress.value}:6021`)
  })
  const webRTCSignallingURI = ref(_webRTCSignallingURI)
  const lastHeartbeat = ref<Date>()
  const firmwareType = ref<MavAutopilot>()
  const vehicleType = ref<MavType>()
  const altitude: Altitude = reactive({} as Altitude)
  const attitude: Attitude = reactive({} as Attitude)
  const coordinates: Coordinates = reactive({} as Coordinates)
  const powerSupply: PowerSupply = reactive({} as PowerSupply)
  const velocity: Velocity = reactive({} as Velocity)
  const mainVehicle = ref<ArduPilot | undefined>(undefined)
  const isArmed = ref<boolean | undefined>(undefined)
  const flying = ref<boolean | undefined>(undefined)
  const icon = ref<string | undefined>(undefined)
  const configurationPages = ref<PageDescription[]>([])
  const timeNow = useTimestamp({ interval: 100 })
  const statusText: StatusText = reactive({} as StatusText)
  const statusGPS: StatusGPS = reactive({} as StatusGPS)
  const genericVariables: Record<string, unknown> = reactive({})
  const availableGenericVariables = ref<string[]>([])
  const usedGenericVariables = ref<string[]>([])

  const mode = ref<string | undefined>(undefined)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modes = ref<Map<string, any>>()

  /**
   * Check if vehicle is online (no more than 5 seconds passed since last heartbeat)
   * @returns { boolean } True if vehicle is online
   */
  const isVehicleOnline = computed(() => {
    return lastHeartbeat.value !== undefined && new Date(timeNow.value).getTime() - lastHeartbeat.value.getTime() < 5000
  })

  /**
   * Arm the vehicle.
   * Awaits user confirmation before arming the vehicle. Resolves when arming is successful or rejects if the action is cancelled.
   * @returns {Promise<void>}
   */
  async function arm(): Promise<void> {
    if (!mainVehicle.value) {
      throw new Error('No vehicle available to arm.')
    }

    mainVehicle.value.arm()
  }

  /**
   * Disarm the vehicle.
   * Awaits user confirmation before disarming the vehicle. Resolves when disarming is successful or rejects if the action is cancelled.
   * @returns {Promise<void>}
   */
  async function disarm(): Promise<void> {
    if (!mainVehicle.value) {
      throw new Error('No vehicle available to disarm.')
    }

    mainVehicle.value.disarm()
  }

  /**
   * Initiates the takeoff process, requiring user confirmation.
   * @returns {Promise<void>} A Promise that resolves when the takeoff is successful or rejects if an error occurs or the action is cancelled.
   */
  async function takeoff(): Promise<void> {
    if (!mainVehicle.value) {
      throw new Error('No vehicle available for takeoff')
    }

    mainVehicle.value.takeoff(altitude_setpoint.value)
  }
  /**
   * Change the altitude of the vehicle.
   * @returns {Promise<void>} A Promise that resolves when the altitude is changed or rejects if the action is cancelled.
   */
  async function changeAlt(): Promise<void> {
    if (!mainVehicle.value) {
      throw new Error('No vehicle available to change altitude.')
    }

    mainVehicle.value.changeAltitude(altitude.rel - altitude_setpoint.value)
  }

  /**
   * Land the vehicle.
   * @returns {Promise<void>} A Promise that resolves when landing is successful or rejects if the action is cancelled.
   */
  async function land(): Promise<void> {
    if (!mainVehicle.value) {
      throw new Error('No vehicle available to land.')
    }

    mainVehicle.value.land()
  }

  /**
   * Go to a given position.
   * Awaits user confirmation before moving the vehicle to a specified waypoint. Resolves when the vehicle reaches the waypoint or rejects if the action is cancelled.
   * @param {number} hold Time to hold position in seconds.
   * @param {number} acceptanceRadius Radius in meters to consider the waypoint reached.
   * @param {number} passRadius Radius in meters to pass the waypoint.
   * @param {number} yaw Yaw angle in degrees.
   * @param {number} latitude Latitude in degrees.
   * @param {number} longitude Longitude in degrees.
   * @param {number} alt Altitude in meters.
   * @returns {Promise<void>}
   */
  async function goTo(
    hold: number,
    acceptanceRadius: number,
    passRadius: number,
    yaw: number,
    latitude: number,
    longitude: number,
    alt: number
  ): Promise<void> {
    if (!mainVehicle.value) {
      throw new Error('No vehicle available to execute go to command.')
    }

    const waypoint = new Coordinates()
    waypoint.latitude = latitude
    waypoint.altitude = alt
    waypoint.longitude = longitude
    mainVehicle.value.goTo(hold, acceptanceRadius, passRadius, yaw, waypoint)
  }

  /**
   * Configure the vehicle somehow
   * @param { VehicleConfigurationSettings } settings Configuration data
   */
  function configure(settings: VehicleConfigurationSettings): void {
    if (mainVehicle.value?.firmware() === Vehicle.Firmware.ArduPilot) {
      mainVehicle.value?.setParameter(settings as ArduPilotParameterSetData)
    }
  }

  /**
   * Send heartbeat from GCS
   */
  function sendGcsHeartbeat(): void {
    mainVehicle.value?.sendGcsHeartbeat()
  }

  /**
   * Upload mission items to vehicle
   * @param { Waypoint[] } items Mission items that will be sent
   * @param { MissionLoadingCallback } loadingCallback Callback that returns the state of the loading progress
   * @returns { Promise<Waypoint[]> } Mission items that were on the vehicle
   */
  async function uploadMission(items: Waypoint[], loadingCallback: MissionLoadingCallback): Promise<void> {
    return await mainVehicle.value?.uploadMission(items, loadingCallback)
  }

  /**
   * Get current mission from vehicle
   * @param { MissionLoadingCallback } loadingCallback Callback that returns the state of the loading progress
   * @returns { Promise<Waypoint[]> } Mission items that were on the vehicle
   */
  async function fetchMission(loadingCallback: MissionLoadingCallback): Promise<Waypoint[]> {
    return (await mainVehicle.value?.fetchMission(loadingCallback)) ?? []
  }

  /**
   * Clear all missions that are on the vehicle
   */
  async function clearMissions(): Promise<void> {
    mainVehicle.value?.clearMissions()
  }

  /**
   * Start mission that is on the vehicle
   */
  async function startMission(): Promise<void> {
    mainVehicle.value?.startMission()
  }

  /**
   * List of available flight modes
   * @returns {Array<string>}
   */
  function modesAvailable(): Array<string> {
    return [...(modes.value?.entries() ?? [])]
      .filter(([, value]) => value >= 0) // Remove cockpit internal flight modes
      .map(([key]) => key)
  }

  /**
   * Set vehicle flight mode
   * @param {string} modeName
   */
  function setFlightMode(modeName: string): void {
    const enumMode = modes.value?.get(modeName)
    if (enumMode !== undefined) {
      mainVehicle.value?.setMode(enumMode)
    }
  }

  const registerUsageOfGenericVariable = (variable: string): void => {
    if (usedGenericVariables.value.includes(variable)) return
    usedGenericVariables.value.push(variable)
  }

  watchThrottled(usedGenericVariables, () => registerGenericVariablesUsageOnVehicle(), { throttle: 1000 })

  const registerGenericVariablesUsageOnVehicle = (): void => {
    if (!mainVehicle.value) return

    usedGenericVariables.value.forEach((variable) => {
      mainVehicle.value?.registerUsageOfMessageType(variable)
    })

    console.log('List of tracked generic variables udpated: ', usedGenericVariables.value)
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
    registerGenericVariablesUsageOnVehicle()

    mainVehicle.value.onAltitude.add((newAltitude: Altitude) => {
      Object.assign(altitude, newAltitude)
    })
    mainVehicle.value.onAttitude.add((newAttitude: Attitude) => {
      Object.assign(attitude, newAttitude)
    })
    mainVehicle.value.onArm.add((armed: boolean) => {
      isArmed.value = armed
    })
    mainVehicle.value.onTakeoff.add((inAir: boolean) => {
      flying.value = inAir
    })
    mainVehicle.value.onCpuLoad.add((newCpuLoad: number) => {
      cpuLoad.value = newCpuLoad
    })
    mainVehicle.value.onPosition.add((newCoordinates: Coordinates) => {
      Object.assign(coordinates, newCoordinates)
    })
    mainVehicle.value.onVelocity.add((newVelocity: Velocity) => {
      Object.assign(velocity, newVelocity)
    })
    mainVehicle.value.onPowerSupply.add((newPowerSupply: PowerSupply) => {
      Object.assign(powerSupply, newPowerSupply)
    })
    mainVehicle.value.onStatusText.add((newStatusText: StatusText) => {
      Object.assign(statusText, newStatusText)
    })
    mainVehicle.value.onStatusGPS.add((newStatusGPS: StatusGPS) => {
      Object.assign(statusGPS, newStatusGPS)
    })
    mainVehicle.value.onGenericVariables.add((newGenericVariablesState: Record<string, unknown>) => {
      Object.assign(genericVariables, newGenericVariablesState)
      availableGenericVariables.value = mainVehicle.value?._availableGenericVariablesdMessagePaths ?? []
    })

    setInterval(async () => {
      const blueosStatus = await getStatus(globalAddress.value)
      // If blueos is not available, do not try to get data from it
      if (!blueosStatus) return

      const blueosVariablesAddresses = {
        cpuTemp: 'blueos/cpu/tempC',
      }

      Object.values(blueosVariablesAddresses).forEach((address) => {
        if (!availableGenericVariables.value.includes(address)) {
          availableGenericVariables.value.push(address)
        }
      })

      if (usedGenericVariables.value.includes(blueosVariablesAddresses.cpuTemp)) {
        getCpuTempCelsius(globalAddress.value).then((temp) => {
          Object.assign(genericVariables, { ...genericVariables, ...{ [blueosVariablesAddresses.cpuTemp]: temp } })
        })
      }
    }, 1000)

    mainVehicle.value.onMAVLinkMessage.add(MAVLinkType.HEARTBEAT, (pack: Package) => {
      if (pack.header.component_id != 1) {
        return
      }

      const heartbeat = pack.message as Message.Heartbeat
      firmwareType.value = heartbeat.autopilot.type
      const oldVehicleType = vehicleType.value
      vehicleType.value = heartbeat.mavtype.type
      lastHeartbeat.value = new Date()

      if (oldVehicleType !== vehicleType.value && vehicleType.value !== undefined) {
        console.log('Vehicle type changed to', vehicleType.value)

        try {
          controllerStore.loadDefaultProtocolMappingForVehicle(vehicleType.value)
          console.info(`Loaded default joystick protocol mapping for vehicle type ${vehicleType.value}.`)
        } catch (error) {
          console.error(`Could not load default protocol mapping for vehicle type ${vehicleType.value}: ${error}`)
        }

        try {
          widgetStore.loadDefaultProfileForVehicle(vehicleType.value)
          console.info(`Loaded default profile for vehicle type ${vehicleType.value}.`)
        } catch (error) {
          console.error(`Could not load default profile for vehicle type ${vehicleType.value}: ${error}`)
        }
      }
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
    registerActionCallback(availableCockpitActions.mavlink_arm, arm)
    registerActionCallback(availableCockpitActions.mavlink_disarm, disarm)
  })

  const mavlinkManualControlManager = new MavlinkManualControlManager()
  const cockpitActionsManager = new CockpitActionsManager()
  controllerStore.registerControllerUpdateCallback(mavlinkManualControlManager.updateControllerData)
  controllerStore.registerControllerUpdateCallback(cockpitActionsManager.updateControllerData)

  // Loop to send MAVLink Manual Control messages
  setInterval(() => {
    if (!mainVehicle.value) return

    // Set the manager vehicle instance if yet undefined
    if (mavlinkManualControlManager.vehicle === undefined) {
      mavlinkManualControlManager.setVehicle(mainVehicle.value as ArduPilot)
    }

    // Send MAVLink Manual Control message
    if (controllerStore.enableForwarding) {
      mavlinkManualControlManager.sendManualControl()
    }
  }, 40)
  setInterval(() => sendGcsHeartbeat(), 1000)

  // Loop to send Cockpit Action messages
  setInterval(() => {
    if (controllerStore.enableForwarding) {
      cockpitActionsManager.sendCockpitActions()
    }
  }, 10)

  const rtcConfiguration = {
    bundlePolicy: 'max-bundle',
    iceServers: [],
  } as RTCConfiguration

  return {
    arm,
    takeoff,
    changeAlt,
    land,
    disarm,
    goTo,
    modesAvailable,
    setFlightMode,
    sendGcsHeartbeat,
    configure,
    fetchMission,
    uploadMission,
    clearMissions,
    startMission,
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
    velocity,
    powerSupply,
    statusText,
    statusGPS,
    mode,
    modes,
    isArmed,
    flying,
    isVehicleOnline,
    icon,
    configurationPages,
    rtcConfiguration,
    genericVariables,
    availableGenericVariables,
    registerUsageOfGenericVariable,
  }
})
