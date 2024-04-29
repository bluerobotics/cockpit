import ky from 'ky'

const defaultTimeout = 10000

/* eslint-disable @typescript-eslint/no-explicit-any */
export const getBagOfHoldingFromVehicle = async (
  vehicleAddress: string,
  bagName: string
): Promise<Record<string, any>> => {
  try {
    return await ky.get(`http://${vehicleAddress}/bag/v1.0/get/${bagName}`, { timeout: defaultTimeout }).json()
  } catch (error) {
    throw new Error(`Could not get bag of holdings for ${bagName}. ${error}`)
  }
}

export const getCockpitStorageFromVehicle = async (vehicleAddress: string): Promise<Record<string, any>> => {
  try {
    return await getBagOfHoldingFromVehicle(vehicleAddress, 'cockpit')
  } catch (error) {
    throw new Error(`Could not get Cockpit's storage data from vehicle. ${error}`)
  }
}

export const getKeyDataFromCockpitVehicleStorage = async (
  vehicleAddress: string,
  storageKey: string
): Promise<Record<string, any> | undefined> => {
  const cockpitVehicleStorage = await getCockpitStorageFromVehicle(vehicleAddress)
  return cockpitVehicleStorage[storageKey]
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

export const setCockpitStorageOnVehicle = async (
  vehicleAddress: string,
  storageData: Record<string, any> | any
): Promise<void> => {
  try {
    await setBagOfHoldingOnVehicle(vehicleAddress, 'cockpit', storageData)
  } catch (error) {
    throw new Error(`Could not set Cockpit's storage data on vehicle. ${error}`)
  }
}

export const setKeyDataOnCockpitVehicleStorage = async (
  vehicleAddress: string,
  storageKey: string,
  storageData: Record<string, any> | any
): Promise<void> => {
  let previousVehicleStorage: Record<string, any> = {}
  try {
    previousVehicleStorage = await getCockpitStorageFromVehicle(vehicleAddress)
  } catch (error) {
    console.error(error)
  }
  const newVehicleStorage = previousVehicleStorage
  newVehicleStorage[storageKey] = storageData

  await setCockpitStorageOnVehicle(vehicleAddress, newVehicleStorage)
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
