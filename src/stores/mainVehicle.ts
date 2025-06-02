import { useStorage, useTimestamp } from '@vueuse/core'
import { differenceInSeconds } from 'date-fns'
import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import { computed, reactive, ref, watch } from 'vue'

import { defaultGlobalAddress } from '@/assets/defaults'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useSnackbar } from '@/composables/snackbar'
import { getAllDataLakeVariablesInfo, getDataLakeVariableInfo, setDataLakeVariableData } from '@/libs/actions/data-lake'
import { createDataLakeVariable } from '@/libs/actions/data-lake'
import { altitude_setpoint } from '@/libs/altitude-slider'
import {
  getCpuTempCelsius,
  getKeyDataFromCockpitVehicleStorage,
  getStatus,
  getVehicleName,
  setKeyDataOnCockpitVehicleStorage,
} from '@/libs/blueos'
import * as Connection from '@/libs/connection/connection'
import { ConnectionManager } from '@/libs/connection/connection-manager'
import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MavAutopilot, MAVLinkType, MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import eventTracker from '@/libs/external-telemetry/event-tracking'
import { availableCockpitActions, registerActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import { MavlinkManualControlManager } from '@/libs/joystick/protocols/mavlink-manual-control'
import { canByPassCategory, EventCategory, slideToConfirm } from '@/libs/slide-to-confirm'
import type { ArduPilot } from '@/libs/vehicle/ardupilot/ardupilot'
import { MAVLINK_MESSAGE_INTERVALS_STORAGE_KEY } from '@/libs/vehicle/ardupilot/ardupilot'
import { CustomMode } from '@/libs/vehicle/ardupilot/ardurover'
import { defaultMessageIntervalsOptions } from '@/libs/vehicle/ardupilot/defaults'
import type { ArduPilotParameterSetData, MessageIntervalOptions } from '@/libs/vehicle/ardupilot/types'
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
 * Custom parameter data description interface
 */
interface CustomParameter<T> {
  /**
   * Real data associated with the parameter
   */
  data: T

  /**
   * Indicates if the custom parameter data is enabled
   */
  enabled: boolean
}

const defaultRtcConfiguration = {
  bundlePolicy: 'max-bundle',
  iceServers: [],
} as RTCConfiguration

const { openSnackbar } = useSnackbar()

export const useMainVehicleStore = defineStore('main-vehicle', () => {
  const controllerStore = useControllerStore()
  const widgetStore = useWidgetManagerStore()
  const ws_protocol = location?.protocol === 'https:' ? 'wss' : 'ws'
  const http_protocol = location?.protocol === 'https:' ? 'https' : 'http'

  const cpuLoad = ref<number>()
  const rawGlobalAddress = useStorage('cockpit-vehicle-address', defaultGlobalAddress)
  const globalAddress = computed({
    get() {
      if (rawGlobalAddress.value.includes('://')) {
        return rawGlobalAddress.value.split('://')[1]
      }
      return rawGlobalAddress.value
    },
    set(newValue) {
      rawGlobalAddress.value = newValue
    },
  })

  const defaultMAVLink2RestWebsocketURI = computed(
    () => `${ws_protocol}://${globalAddress.value}/mavlink2rest/ws/mavlink`
  )
  const defaultMAVLink2RestHttpURI = computed(() => `${http_protocol}://${globalAddress.value}/mavlink2rest/v1/mavlink`)
  const defaultWebRTCSignallingURI = computed(() => `${ws_protocol}://${globalAddress.value}:6021/`)
  const customMAVLink2RestWebsocketURI = useStorage('cockpit-vehicle-custom-main-connection-uri', {
    data: defaultMAVLink2RestWebsocketURI.value,
    enabled: false,
  } as CustomParameter<string>)
  const customWebRTCSignallingURI = useStorage('cockpit-vehicle-custom-webrtc-signalling-uri', {
    data: defaultWebRTCSignallingURI.value,
    enabled: false,
  } as CustomParameter<string>)
  const customWebRTCConfiguration = useBlueOsStorage('cockpit-custom-rtc-config', {
    data: defaultRtcConfiguration,
    enabled: false,
  })

  const lastConnectedVehicleId = localStorage.getItem('cockpit-last-connected-vehicle-id') || undefined
  const currentlyConnectedVehicleId = ref<string | undefined>()

  const lastHeartbeat = ref<Date>()
  const firmwareType = ref<MavAutopilot>()
  const vehicleType = ref<MavType>()
  const altitude: Altitude = reactive({} as Altitude)
  const attitude: Attitude = reactive({} as Attitude)
  const coordinates: Coordinates = reactive({} as Coordinates)
  const powerSupply: PowerSupply = reactive({} as PowerSupply)
  const instantaneousWatts = ref<number | undefined>(undefined)
  const velocity: Velocity = reactive({} as Velocity)
  const mainVehicle = ref<ArduPilot | undefined>(undefined)
  const isArmed = ref<boolean | undefined>(undefined)
  const flying = ref<boolean | undefined>(undefined)
  const icon = ref<string | undefined>(undefined)
  const configurationPages = ref<PageDescription[]>([])
  const timeNow = useTimestamp({ interval: 100 })
  const statusText: StatusText = reactive({} as StatusText)
  const statusGPS: StatusGPS = reactive({} as StatusGPS)
  const vehicleArmingTime = ref<Date | undefined>(undefined)
  const currentVehicleName = ref<string | undefined>(undefined)

  const mode = ref<string | undefined>(undefined)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modes = ref<Map<string, any>>()

  // Store custom message intervals in BlueOS storage
  const mavlinkMessageIntervalOptions = useBlueOsStorage(
    MAVLINK_MESSAGE_INTERVALS_STORAGE_KEY,
    defaultMessageIntervalsOptions
  )

  const MAVLink2RestWebsocketURI = computed(() => {
    const queryURI = new URLSearchParams(window.location.search).get('MAVLink2RestWebsocketURI')
    const customURI = customMAVLink2RestWebsocketURI.value.enabled
      ? customMAVLink2RestWebsocketURI.value.data
      : undefined
    return new Connection.URI(queryURI ?? customURI ?? defaultMAVLink2RestWebsocketURI.value)
  })

  const webRTCSignallingURI = computed(() => {
    const queryWebRTCSignallingURI = new URLSearchParams(window.location.search).get('webRTCSignallingURI')
    const customURI = customWebRTCSignallingURI.value.enabled ? customWebRTCSignallingURI.value.data : undefined
    return new Connection.URI(queryWebRTCSignallingURI ?? customURI ?? defaultWebRTCSignallingURI.value)
  })

  /**
   * Check if vehicle is online (no more than 5 seconds passed since last heartbeat)
   * @returns { boolean } True if vehicle is online
   */
  const isVehicleOnline = computed(() => {
    return lastHeartbeat.value !== undefined && new Date(timeNow.value).getTime() - lastHeartbeat.value.getTime() < 5000
  })

  watch(isVehicleOnline, (isOnline) => {
    if (isOnline) return
    currentlyConnectedVehicleId.value = undefined
  })

  watch(
    globalAddress,
    (newAddress) => {
      if (newAddress === undefined) return

      // Register vehicle address variables if they don't exist
      const vehicleAddressVariableId = 'vehicle-address'
      if (!getDataLakeVariableInfo(vehicleAddressVariableId)) {
        createDataLakeVariable({
          id: vehicleAddressVariableId,
          name: 'Vehicle Address',
          type: 'string',
          description: 'The address of the vehicle, without protocol.',
        })
      }

      const vehicleMavlink2RestHttpEndpointVariableId = 'mavlink2rest-http-endpoint'
      if (!getDataLakeVariableInfo(vehicleMavlink2RestHttpEndpointVariableId)) {
        createDataLakeVariable({
          id: vehicleMavlink2RestHttpEndpointVariableId,
          name: 'MAVLink2REST HTTP Endpoint',
          type: 'string',
          description: 'The HTTP endpoint of the vehicle MAVLink2REST service.',
        })
      }

      // Update the variables with the new address
      setDataLakeVariableData(vehicleAddressVariableId, newAddress)
      setDataLakeVariableData(vehicleMavlink2RestHttpEndpointVariableId, defaultMAVLink2RestHttpURI.value)
    },
    { immediate: true }
  )

  const rtcConfiguration = computed(() => {
    const queryWebRtcConfiguration = new URLSearchParams(window.location.search).get('webRTCConfiguration')
    if (queryWebRtcConfiguration) {
      console.log('Using WebRTC configuration from query parameter')
      console.log(queryWebRtcConfiguration)
      try {
        return JSON.parse(queryWebRtcConfiguration)
      } catch (error) {
        console.error('Failed to parse WebRTC configuration from query parameter.', error)
      }
    }
    console.log('Using WebRTC configuration from storage.')
    return customWebRTCConfiguration.value.enabled ? customWebRTCConfiguration.value.data : defaultRtcConfiguration
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

    await mainVehicle.value.arm()
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

    await mainVehicle.value.disarm()
  }

  /**
   * Initiates the takeoff process, requiring user confirmation.
   * @returns {Promise<void>} A Promise that resolves when the takeoff is successful or rejects if an error occurs or the action is cancelled.
   */
  async function takeoff(): Promise<void> {
    if (!mainVehicle.value) {
      throw new Error('No vehicle available for takeoff')
    }

    await mainVehicle.value.takeoff(altitude_setpoint.value)
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

    await mainVehicle.value.land()
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

    if (mainVehicle.value.firmware() !== Vehicle.Firmware.ArduPilot) {
      throw new Error('Go to command is not supported by this vehicle.')
    }

    const askArmConfirm = !mainVehicle.value.isArmed() && !canByPassCategory(EventCategory.ARM)
    const askGoToConfirm = !canByPassCategory(EventCategory.GOTO)

    if (askArmConfirm || askGoToConfirm) {
      const command = askArmConfirm && askGoToConfirm ? 'Arm and GoTo' : askArmConfirm ? 'Arm' : 'GoTo'
      try {
        await slideToConfirm({ command })
      } catch (error) {
        throw new Error(`${command} command ignored or cancelled by the user.`)
      }
    }

    if (!mainVehicle.value.isArmed()) {
      try {
        console.log('GoTo command requested while vehicle was not armed. Arming vehicle...')
        await mainVehicle.value.arm()
      } catch (error) {
        throw new Error('Arm command ignored or cancelled by the user.')
      }
    }

    if (mainVehicle.value.type() === Vehicle.Type.Rover && mainVehicle.value.mode() !== CustomMode.GUIDED) {
      console.log('GoTo command requested while vehicle was not in GUIDED mode. Setting vehicle to GUIDED mode...')
      try {
        await mainVehicle.value.setMode(CustomMode.GUIDED)
      } catch (error) {
        throw new Error(`Could not set vehicle to GUIDED mode. Error: ${(error as Error).message}`)
      }
    }

    const waypoint = new Coordinates()
    waypoint.latitude = latitude
    waypoint.altitude = alt
    waypoint.longitude = longitude
    await mainVehicle.value.goTo(hold, acceptanceRadius, passRadius, yaw, waypoint)
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
   * Fetch home waypoint from vehicle
   * @returns { Promise<Waypoint> } Home waypoint
   */
  async function fetchHomeWaypoint(): Promise<Waypoint> {
    if (!mainVehicle.value) {
      throw new Error('No vehicle available to fetch home waypoint.')
    }
    if (mainVehicle.value.firmware() !== Vehicle.Firmware.ArduPilot) {
      throw new Error('Home waypoint retrieval is only supported for ArduPilot vehicles.')
    }
    return await mainVehicle.value.fetchHomeWaypoint()
  }

  /**
   * Set home waypoint on vehicle
   * @param { [ number, number ] } coordinate of the home waypoint
   * @param { number } height of the home waypoint
   * @returns { Promise<void> }
   */
  async function setHomeWaypoint(coordinate: [number, number], height: number): Promise<void> {
    if (!mainVehicle.value) {
      throw new Error('No vehicle available to set home waypoint.')
    }
    await mainVehicle.value.setHomeWaypoint(coordinate, height)
  }

  /**
   * Clear all missions that are on the vehicle
   */
  async function clearMissions(): Promise<void> {
    mainVehicle.value?.clearMissions()
    openSnackbar({ message: 'Mission deleted from vehicle', variant: 'info' })
  }

  /**
   * Start mission that is on the vehicle
   */
  async function startMission(): Promise<void> {
    if (!mainVehicle.value) throw new Error('No vehicle available to start mission.')

    await mainVehicle.value.startMission()
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
  async function setFlightMode(modeName: string): Promise<void> {
    const enumMode = modes.value?.get(modeName)
    if (enumMode !== undefined) {
      await mainVehicle.value?.setMode(enumMode)
    }
  }

  ConnectionManager.onMainConnection.add(() => {
    const newMainConnection = ConnectionManager.mainConnection()
    console.log('Main connection changed:', newMainConnection?.uri().toString())
    if (newMainConnection !== undefined) {
      customMAVLink2RestWebsocketURI.value.data = newMainConnection.uri().toString()
    }
  })

  ConnectionManager.addConnection(MAVLink2RestWebsocketURI.value, Protocol.Type.MAVLink)

  const getAutoPilot = (vehicles: WeakRef<Vehicle.Abstract>[]): ArduPilot => {
    const vehicle = vehicles?.last()?.deref()
    return (vehicle as ArduPilot) || undefined
  }

  VehicleFactory.onVehicles.once(async (vehicles: WeakRef<Vehicle.Abstract>[]) => {
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
      const wasArmed = isArmed.value
      isArmed.value = armed

      // If the vehicle was already in the desired state or it's the first time we are checking, do not capture an event
      if (wasArmed === undefined || wasArmed === armed) return

      if (armed) {
        vehicleArmingTime.value = new Date()
        eventTracker.capture('Vehicle armed')
      } else {
        const armDurationInSeconds = differenceInSeconds(new Date(), vehicleArmingTime.value ?? new Date())
        eventTracker.capture('Vehicle disarmed', { armDurationInSeconds })
      }
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

      instantaneousWatts.value =
        powerSupply.voltage !== undefined && powerSupply.current !== undefined
          ? powerSupply.voltage * powerSupply.current
          : undefined
    })
    mainVehicle.value.onStatusText.add((newStatusText: StatusText) => {
      Object.assign(statusText, newStatusText)
    })
    mainVehicle.value.onStatusGPS.add((newStatusGPS: StatusGPS) => {
      Object.assign(statusGPS, newStatusGPS)
    })

    // Get the ID for the currently connected vehicle, or create one if it does not exist
    // Try this every 5 seconds until we have an ID
    const updateVehicleId = async (): Promise<void> => {
      try {
        const maybeId = await getKeyDataFromCockpitVehicleStorage(globalAddress.value, 'cockpit-vehicle-id')
        if (typeof maybeId !== 'string') {
          throw new Error('Vehicle ID is not a string.')
        }
        currentlyConnectedVehicleId.value = maybeId
        localStorage.setItem('cockpit-last-connected-vehicle-id', currentlyConnectedVehicleId.value)
      } catch (idFetchError) {
        console.error(`Could not get vehicle ID from storage. ${(idFetchError as Error).message}`)

        const newVehicleId = uuid()
        console.log(`Setting new vehicle ID: ${newVehicleId}`)
        try {
          await setKeyDataOnCockpitVehicleStorage(globalAddress.value, 'cockpit-vehicle-id', newVehicleId)
          currentlyConnectedVehicleId.value = newVehicleId
          localStorage.setItem('cockpit-last-connected-vehicle-id', currentlyConnectedVehicleId.value)
        } catch (idSetError) {
          console.error(`Could not set vehicle ID in storage. ${(idSetError as Error).message}`)
          console.log('Will try setting the vehicle ID again in 5 seconds...')
          setTimeout(updateVehicleId, 5000)
        }
      }
    }

    updateVehicleId()

    const blueOsVariables = {
      cpuTemp: { id: 'blueos/cpu/tempC', name: 'CPU Temperature', type: 'number' },
    }

    // Register BlueOS variables in the data lake
    Object.values(blueOsVariables).forEach((variable) => {
      if (!Object.values(getAllDataLakeVariablesInfo()).find((v) => v.id === variable.id)) {
        // @ts-ignore: The type is right, only being incorrectly inferred by TS
        createDataLakeVariable({ ...variable, persistent: false, persistValue: false })
      }
    })

    setInterval(async () => {
      try {
        const blueosStatus = await getStatus(globalAddress.value)
        if (!blueosStatus) {
          throw new Error('BlueOS is not available.')
        }
      } catch (error) {
        console.error(error)
        return
      }

      // Update CPU temperature in the data lake
      try {
        const temp = await getCpuTempCelsius(globalAddress.value)
        setDataLakeVariableData(blueOsVariables.cpuTemp.id, temp)
      } catch (error) {
        console.error(`Failed to update CPU temperature in data lake: ${error}`)
      }
    }, 1000)

    mainVehicle.value.onIncomingMAVLinkMessage.add(MAVLinkType.HEARTBEAT, (pack: Package) => {
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

  const listenToIncomingMessages = (messageType: string, callback: (pack: Package) => void): void => {
    if (!mainVehicle.value) {
      throw new Error('No vehicle available to listen for incoming messages.')
    }
    mainVehicle.value?.onIncomingMAVLinkMessage.add(messageType, callback)
  }

  const listenToOutgoingMessages = (messageType: string, callback: (pack: Package) => void): void => {
    if (!mainVehicle.value) {
      throw new Error('No vehicle available to listen for outgoing messages.')
    }
    mainVehicle.value?.onOutgoingMAVLinkMessage.add(messageType, callback)
  }

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
  controllerStore.registerControllerUpdateCallback(mavlinkManualControlManager.updateControllerData)

  // Loop to send MAVLink Manual Control messages
  setInterval(() => {
    // Set the manager vehicle instance if yet undefined
    if (mainVehicle.value && mavlinkManualControlManager.vehicle === undefined) {
      mavlinkManualControlManager.setVehicle(mainVehicle.value as ArduPilot)
    }

    // Send MAVLink Manual Control message
    if (controllerStore.enableForwarding) {
      mavlinkManualControlManager.sendManualControl()
    }
  }, 40)
  setInterval(() => sendGcsHeartbeat(), 1000)

  const getCurrentVehicleName = async (): Promise<string | undefined> => {
    if (currentVehicleName.value) return currentVehicleName.value
    if (currentVehicleName.value === undefined) {
      const vehicleNameResponse = await (await getVehicleName(globalAddress.value)).json()
      currentVehicleName.value = vehicleNameResponse
    }
    return currentVehicleName.value
  }

  /**
   * Updates the message interval for a specific message type
   * @param {string} messageType - The type of message to update
   * @param {MessageIntervalOptions} options - Options for the message interval
   */
  async function updateMessageInterval(messageType: string, options: MessageIntervalOptions): Promise<void> {
    if (mainVehicle.value === undefined || !isVehicleOnline.value) {
      throw new Error('No vehicle available to update message interval.')
    }

    // Store the interval options in storage
    mavlinkMessageIntervalOptions.value[messageType as MAVLinkType] = options

    // Update the message interval in the vehicle
    mainVehicle.value.setMessageFrequency(messageType as MAVLinkType, options)
  }

  /**
   * Resets all message intervals to their default values
   */
  async function resetMessageIntervalsToCockpitDefault(): Promise<void> {
    if (mainVehicle.value === undefined || !isVehicleOnline.value) {
      throw new Error('No vehicle available to reset message intervals.')
    }

    // Reset storage to defaults
    mavlinkMessageIntervalOptions.value = defaultMessageIntervalsOptions

    // Reset the message intervals in the vehicle
    mainVehicle.value.requestDefaultMessages()
  }

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
    getCurrentVehicleName,
    globalAddress,
    MAVLink2RestWebsocketURI,
    customMAVLink2RestWebsocketURI,
    defaultMAVLink2RestWebsocketURI,
    webRTCSignallingURI,
    customWebRTCSignallingURI,
    defaultWebRTCSignallingURI,
    lastConnectedVehicleId,
    currentlyConnectedVehicleId,
    cpuLoad,
    lastHeartbeat,
    firmwareType,
    vehicleType,
    altitude,
    attitude,
    coordinates,
    velocity,
    powerSupply,
    instantaneousWatts,
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
    customWebRTCConfiguration,
    listenToIncomingMessages,
    listenToOutgoingMessages,
    mavlinkMessageIntervalOptions,
    updateMessageInterval,
    resetMessageIntervalsToCockpitDefault,
    fetchHomeWaypoint,
    setHomeWaypoint,
  }
})
