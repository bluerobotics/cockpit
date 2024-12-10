import ky, { HTTPError } from 'ky'

import { useMainVehicleStore } from '@/stores/mainVehicle'
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
}

export const NoPathInBlueOsErrorName = 'NoPathInBlueOS'

const defaultTimeout = 10000

/* eslint-disable @typescript-eslint/no-explicit-any */
export const getBagOfHoldingFromVehicle = async (
  vehicleAddress: string,
  bagPath: string
): Promise<Record<string, any> | any> => {
  try {
    const options = { timeout: defaultTimeout, retry: 0 }
    return await ky.get(`http://${vehicleAddress}/bag/v1.0/get/${bagPath}`, options).json()
  } catch (error) {
    const errorBody = await (error as HTTPError).response.json()
    if (errorBody.detail === 'Invalid path') {
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

export const getWidgetsFromBlueOS = async (): Promise<ExternalWidgetSetupInfo[]> => {
  const vehicleStore = useMainVehicleStore()

  // Wait until we have a global address
  while (vehicleStore.globalAddress === undefined) {
    await new Promise((r) => setTimeout(r, 1000))
  }
  const options = { timeout: defaultTimeout, retry: 0 }
  const services = (await ky
    .get(`http://${vehicleStore.globalAddress}/helper/v1.0/web_services`, options)
    .json()) as Record<string, any>
  // first we gather all the extra jsons with the cockpit key
  const extraWidgets = await services.reduce(
    async (accPromise: Promise<ExternalWidgetSetupInfo[]>, service: Record<string, any>) => {
      const acc = await accPromise
      const worksInRelativePaths = service.metadata?.works_in_relative_paths
      if (service.metadata?.extras?.cockpit === undefined) {
        return acc
      }
      const baseUrl = worksInRelativePaths
        ? `http://${vehicleStore.globalAddress}/extensionv2/${service.metadata.sanitized_name}`
        : `http://${vehicleStore.globalAddress}:${service.port}`
      const fullUrl = baseUrl + service.metadata?.extras?.cockpit

      const extraJson: ExtrasJson = await ky.get(fullUrl, options).json()
      const widgets: ExternalWidgetSetupInfo[] = extraJson.widgets.map((widget) => {
        return {
          ...widget,
          iframe_url: baseUrl + widget.iframe_url,
          iframe_icon: baseUrl + widget.iframe_icon,
        }
      })
      return acc.concat(widgets)
    },
    Promise.resolve([] as ExternalWidgetSetupInfo[])
  )

  return extraWidgets
}

export const setBagOfHoldingOnVehicle = async (
  vehicleAddress: string,
  bagName: string,
  bagData: Record<string, any> | any
): Promise<void> => {
  try {
    await ky.post(`http://${vehicleAddress}/bag/v1.0/set/${bagName}`, { json: bagData, timeout: defaultTimeout })
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
    const url = `http://${vehicleAddress}/beacon/v1.0/services`
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
    const url = `http://${vehicleAddress}/mavlink2rest/info`
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
    const url = `http://${vehicleAddress}/ardupilot-manager/v1.0/firmware_info`
    const ardupilotFirmwareRawInfo: RawArdupilotFirmwareInfo = await ky.get(url, { timeout: defaultTimeout }).json()
    return ardupilotFirmwareRawInfo.version
  } catch (error) {
    throw new Error(`Could not get Ardupilot firmware version. ${error}`)
  }
}

export const getStatus = async (vehicleAddress: string): Promise<boolean> => {
  try {
    const url = `http://${vehicleAddress}/status`
    const result = await ky.get(url, { timeout: defaultTimeout })
    return result.ok
  } catch (error) {
    throw new Error(`Could not get BlueOS status. ${error}`)
  }
}

// eslint-disable-next-line jsdoc/require-jsdoc
type RawCpuTempInfo = { name: string; temperature: number; maximum_temperature: number; critical_temperature: number }

export const getCpuTempCelsius = async (vehicleAddress: string): Promise<number> => {
  try {
    const url = `http://${vehicleAddress}/system-information/system/temperature`
    const cpuTempRawInfo: RawCpuTempInfo[] = await ky.get(url, { timeout: defaultTimeout }).json()
    return cpuTempRawInfo[0].temperature
  } catch (error) {
    throw new Error(`Could not get temperature of the BlueOS CPU. ${error}`)
  }
}
