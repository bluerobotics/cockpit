import ky, { HTTPError } from 'ky'

import { getDataLakeVariableData } from '@/libs/actions/data-lake'
import { type ActionConfig } from '@/libs/joystick/protocols/cockpit-actions'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { ExternalWidgetSetupInfo } from '@/types/widgets'

/**
 * Cockpits extra json format. Taken from extensions in BlueOS and (eventually) other places
 */
interface ExtrasJson {
  /**
   *  The version of the cockpit API that the extra json is compatible with
   */
  target_cockpit_api_version: string
  /**
   *  The target system that the extra json is compatible with, in our case, "cockpit"
   */
  target_system: string
  /**
   *  A list of widgets that the extra json contains. src/types/widgets.ts
   */
  widgets: ExternalWidgetSetupInfo[]
  /**
   * A list of available cockpit actions offered by the extension.
   */
  actions: ActionConfig[]
}

/**
 * Service object from BlueOS
 */
interface Service {
  /**
   * Metadata of the service
   */
  metadata?: {
    /**
     * Extras of the service
     */
    extras?: {
      /**
       * Cockpit extra json url
       */
      cockpit?: string
    }
    /**
     * Works in relative paths
     */
    works_in_relative_paths?: boolean
    /**
     * Sanitized name of the service
     */
    sanitized_name?: string
  }
  /**
   * Port of the service
   */
  port?: number
}

export const NoPathInBlueOsErrorName = 'NoPathInBlueOS'

const defaultTimeout = 10000
const quickStatusTimeout = 3000
const beaconTimeout = 5000

const protocol = window.location.protocol.includes('file') ? 'http:' : window.location.protocol

/* eslint-disable @typescript-eslint/no-explicit-any */
export const getBagOfHoldingFromVehicle = async (
  vehicleAddress: string,
  bagPath: string
): Promise<Record<string, any> | any> => {
  try {
    const options = { timeout: defaultTimeout, retry: 0 }
    return await ky.get(`${protocol}//${vehicleAddress}/bag/v1.0/get/${bagPath}`, options).json()
  } catch (error) {
    const errorBody = await (error as HTTPError).response?.json()
    if (errorBody?.detail === 'Invalid path') {
      const noPathError = new Error(`No data available in BlueOS storage for path '${bagPath}'.`)
      noPathError.name = NoPathInBlueOsErrorName
      throw noPathError
    }
    throw new Error(`Could not get bag of holdings for ${bagPath}. ${error}`)
  }
}

export const getKeyDataFromCockpitVehicleStorage = async (
  vehicleAddress: string,
  storageKey: string
): Promise<Record<string, any> | undefined> => {
  return await getBagOfHoldingFromVehicle(vehicleAddress, `cockpit/${storageKey}`)
}

const blueOsServiceUrl = (vehicleAddress: string, service: Service): string => {
  const worksInRelativePaths = service.metadata?.works_in_relative_paths
  const sanitizedName = service.metadata?.sanitized_name
  const port = service.port
  return worksInRelativePaths
    ? `${protocol}//${vehicleAddress}/extensionv2/${sanitizedName}`
    : `${protocol}//${vehicleAddress}:${port}`
}

const getServicesFromBlueOS = async (vehicleAddress: string): Promise<Service[]> => {
  const options = { timeout: defaultTimeout, retry: 0 }
  const services = (await ky
    .get(`${protocol}//${vehicleAddress}/helper/v1.0/web_services`, options)
    .json()) as Service[]
  return services
}

export const getExtrasJsonFromBlueOsService = async (
  vehicleAddress: string,
  service: Service
): Promise<ExtrasJson | null> => {
  const options = { timeout: defaultTimeout, retry: 0 }
  if (service.metadata?.extras?.cockpit === undefined) {
    return null
  }
  const baseUrl = blueOsServiceUrl(vehicleAddress, service)
  const fullUrl = baseUrl + service.metadata?.extras?.cockpit
  const extraJson: ExtrasJson = await ky.get(fullUrl, options).json()
  return extraJson
}

export const getWidgetsFromBlueOS = async (): Promise<ExternalWidgetSetupInfo[]> => {
  const vehicleStore = useMainVehicleStore()

  // Wait until we have a global address
  while (vehicleStore.globalAddress === undefined) {
    await new Promise((r) => setTimeout(r, 1000))
  }

  const services = await getServicesFromBlueOS(vehicleStore.globalAddress)
  const widgets: ExternalWidgetSetupInfo[] = []
  await Promise.all(
    services.map(async (service) => {
      const extraJson = await getExtrasJsonFromBlueOsService(vehicleStore.globalAddress, service)
      const baseUrl = blueOsServiceUrl(vehicleStore.globalAddress, service)
      if (extraJson !== null) {
        widgets.push(
          ...extraJson.widgets.map((widget) => {
            return {
              ...widget,
              iframe_url: baseUrl + widget.iframe_url,
              iframe_icon: baseUrl + widget.iframe_icon,
            }
          })
        )
      }
    })
  )

  return widgets
}

export const getActionsFromBlueOS = async (): Promise<ActionConfig[]> => {
  const vehicleStore = useMainVehicleStore()

  // Wait until we have a global address
  while (vehicleStore.globalAddress === undefined) {
    await new Promise((r) => setTimeout(r, 1000))
  }

  const services = await getServicesFromBlueOS(vehicleStore.globalAddress)
  const actions: ActionConfig[] = []
  await Promise.all(
    services.map(async (service) => {
      try {
        const extraJson = await getExtrasJsonFromBlueOsService(vehicleStore.globalAddress, service)
        if (extraJson !== null) {
          actions.push(...extraJson.actions)
        }
      } catch (error) {
        console.error(`Could not get actions from BlueOS service ${service.metadata?.sanitized_name}. ${error}`)
      }
    })
  )

  return actions
}

export const setBagOfHoldingOnVehicle = async (
  vehicleAddress: string,
  bagName: string,
  bagData: Record<string, any> | any
): Promise<void> => {
  try {
    await ky.post(`${protocol}//${vehicleAddress}/bag/v1.0/set/${bagName}`, { json: bagData, timeout: defaultTimeout })
  } catch (error) {
    throw new Error(`Could not set bag of holdings for ${bagName}. ${error}`)
  }
}

export const setKeyDataOnCockpitVehicleStorage = async (
  vehicleAddress: string,
  storageKey: string,
  storageData: Record<string, any> | any
): Promise<void> => {
  await setBagOfHoldingOnVehicle(vehicleAddress, `cockpit/${storageKey}`, storageData)
}

/* eslint-disable jsdoc/require-jsdoc */
type RawIpInfo = { ip: string; service_type: string; interface_type: string }
type IpInfo = { ipv4Address: string; interfaceType: string }
/* eslint-enable jsdoc/require-jsdoc */

export const getIpsInformationFromVehicle = async (vehicleAddress: string): Promise<IpInfo[]> => {
  try {
    const url = `${protocol}//${vehicleAddress}/beacon/v1.0/services`
    const rawIpsInfo: RawIpInfo[] = await ky.get(url, { timeout: defaultTimeout }).json()
    return rawIpsInfo
      .filter((ipInfo) => ipInfo['service_type'] === '_http')
      .map((ipInfo) => ({ ipv4Address: ipInfo.ip, interfaceType: ipInfo.interface_type }))
  } catch (error) {
    throw new Error(`Could not get information about IPs on BlueOS. ${error}`)
  }
}

/* eslint-disable jsdoc/require-jsdoc */
type RawM2rServiceInfo = { name: string; version: string; sha: string; build_date: string; authors: string }
type RawM2rInfo = { version: number; service: RawM2rServiceInfo }
/* eslint-enable jsdoc/require-jsdoc */

export const getMavlink2RestVersion = async (vehicleAddress: string): Promise<string> => {
  try {
    const url = `${protocol}//${vehicleAddress}/mavlink2rest/info`
    const m2rRawInfo: RawM2rInfo = await ky.get(url, { timeout: defaultTimeout }).json()
    return m2rRawInfo.service.version
  } catch (error) {
    throw new Error(`Could not get Mavlink2Rest version. ${error}`)
  }
}

/* eslint-disable jsdoc/require-jsdoc */
type RawArdupilotFirmwareInfo = { version: string; type: string }
/* eslint-enable jsdoc/require-jsdoc */

export const getArdupilotVersion = async (vehicleAddress: string): Promise<string> => {
  try {
    const url = `${protocol}//${vehicleAddress}/ardupilot-manager/v1.0/firmware_info`
    const ardupilotFirmwareRawInfo: RawArdupilotFirmwareInfo = await ky.get(url, { timeout: defaultTimeout }).json()
    return ardupilotFirmwareRawInfo.version
  } catch (error) {
    throw new Error(`Could not get Ardupilot firmware version. ${error}`)
  }
}

export const getStatus = async (vehicleAddress: string): Promise<boolean> => {
  try {
    const url = `${protocol}//${vehicleAddress}/status`
    const statusResponse = await ky.get(url, { timeout: quickStatusTimeout })
    return statusResponse.ok
  } catch (error) {
    throw new Error(`Could not get BlueOS status. ${error}`)
  }
}

export const getBeaconInfo = async (vehicleAddress: string): Promise<Record<string, any>> => {
  try {
    const url = `http://${vehicleAddress}/beacon/`
    const beaconInfoResponse = await ky.get(url, { timeout: beaconTimeout })
    return beaconInfoResponse
  } catch (error) {
    throw new Error(`Could not fetch beacon info. ${error}`)
  }
}

export const getVehicleName = async (vehicleAddress: string): Promise<Response> => {
  try {
    const url = `http://${vehicleAddress}/beacon/v1.0/vehicle_name`
    const vehicleNameResponse = await ky.get(url, { timeout: beaconTimeout, retry: 0 })
    return vehicleNameResponse
  } catch (error) {
    throw new Error(`Could not fetch vehicle name from beacon. ${error}`)
  }
}

// eslint-disable-next-line jsdoc/require-jsdoc
type RawCpuTempInfo = { name: string; temperature: number; maximum_temperature: number; critical_temperature: number }

export const getCpuTempCelsius = async (vehicleAddress: string): Promise<number> => {
  try {
    const url = `${protocol}//${vehicleAddress}/system-information/system/temperature`
    const cpuTempRawInfo: RawCpuTempInfo[] = await ky.get(url, { timeout: defaultTimeout }).json()
    return cpuTempRawInfo[0].temperature
  } catch (error) {
    throw new Error(`Could not get temperature of the BlueOS CPU. ${error}`)
  }
}

// Checks for similarity between all 'cockpit-*' keys stored in BlueOS and the data in localStorage
export const checkBlueOsUserDataSimilarity = async (vehicleAddress: string): Promise<boolean> => {
  const missionStore = useMissionStore()

  const storedSettings: Record<string, any> = Object.keys(localStorage)
    .filter((key) => key.startsWith('cockpit-'))
    .reduce((acc: Record<string, any>, key: string) => {
      const value = localStorage.getItem(key)
      try {
        acc[key] = value ? JSON.parse(value) : null
      } catch {
        acc[key] = value
      }
      return acc
    }, {})

  const blueOsData =
    (await getKeyDataFromCockpitVehicleStorage(vehicleAddress, `settings/${missionStore.username}`)) ?? {}

  const keysInCommon = Object.keys(storedSettings).filter((key) => key in blueOsData)

  for (const key of keysInCommon) {
    if (JSON.stringify(storedSettings[key]) !== JSON.stringify(blueOsData[key])) {
      return false
    }
  }

  return true
}

export const getVehicleAddress = async (): Promise<string> => {
  const vehicleStore = useMainVehicleStore()

  // Wait until we have a global address
  while (vehicleStore.globalAddress === undefined) {
    console.debug('Waiting for vehicle global address on BlueOS sync routine.')
    await new Promise((r) => setTimeout(r, 1000))
  }

  return vehicleStore.globalAddress
}

export const getSettingsUsernamesFromBlueOS = async (): Promise<string[]> => {
  const vehicleAddress = await getVehicleAddress()
  const usernames = await getKeyDataFromCockpitVehicleStorage(vehicleAddress, 'settings')
  return Object.keys(usernames as string[])
}

export const deleteUsernameOnBlueOS = async (username: string): Promise<void> => {
  const vehicleAddress = await getVehicleAddress()
  let allSettings: Record<string, any> = {}
  try {
    allSettings = (await getKeyDataFromCockpitVehicleStorage(vehicleAddress, 'settings')) as Record<string, any>
  } catch (err) {
    if ((err as Error).name === NoPathInBlueOsErrorName) return
    throw err
  }

  if (!(username in allSettings)) return
  delete allSettings[username]

  await setKeyDataOnCockpitVehicleStorage(vehicleAddress, 'settings', allSettings)
}

/**
 * Checks if other GCS is sending MANUAL_CONTROL messages to the vehicle
 * @returns {Promise<boolean>} True if another GCS is sending MANUAL_CONTROL messages (within last 3 seconds)
 */
export const checkForOtherManualControlSources = async (): Promise<boolean> => {
  try {
    // Get vehicle address from data-lake
    const vehicleAddressData = getDataLakeVariableData('vehicle-address')
    const vehicleAddress = typeof vehicleAddressData === 'string' ? vehicleAddressData : undefined
    if (!vehicleAddress) {
      console.warn('Vehicle address not found in data-lake or is not a string')
      return false
    }

    // Try both component IDs (190 and 240)
    const componentIds = [190, 240]

    for (const componentId of componentIds) {
      try {
        const endpoint = `${protocol}//${vehicleAddress}:6040/v1/mavlink/vehicles/255/components/${componentId}/messages/MANUAL_CONTROL`
        const response = await fetch(endpoint)

        if (!response.ok) continue

        const data = await response.json()
        const lastUpdateTime = data?.status?.time?.last_update

        if (!lastUpdateTime) continue

        // The API returns time in UTC format
        // Convert both times to milliseconds since epoch for accurate comparison
        const lastUpdateTimestamp = new Date(lastUpdateTime).getTime()
        const currentTimestamp = Date.now()
        const secondsAgo = (currentTimestamp - lastUpdateTimestamp) / 1000

        if (secondsAgo < 3) {
          console.warn(
            `Detected MANUAL_CONTROL messages from another source (component ID: ${componentId}, ${secondsAgo.toFixed(
              2
            )}s ago)`
          )
          return true
        }
      } catch (error) {
        console.warn(`Error checking MANUAL_CONTROL for component ${componentId}:`, error)
      }
    }

    return false
  } catch (error) {
    console.error('Error checking for other MANUAL_CONTROL sources:', error)
    return false
  }
}
