import ky from 'ky'

/* eslint-disable @typescript-eslint/no-explicit-any */
export const getBagOfHoldingFromVehicle = async (
  vehicleAddress: string,
  bagName: string
): Promise<Record<string, any>> => {
  try {
    return await ky.get(`http://${vehicleAddress}/bag/v1.0/get/${bagName}`, { timeout: 5000 }).json()
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
    await ky.post(`http://${vehicleAddress}/bag/v1.0/set/${bagName}`, { json: bagData, timeout: 5000 })
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
    const rawIpsInfo: RawIpInfo[] = await ky.get(url, { timeout: 5000 }).json()
    return rawIpsInfo
      .filter((ipInfo) => ipInfo['service_type'] === '_http')
      .map((ipInfo) => ({ ipv4Address: ipInfo.ip, interfaceType: ipInfo.interface_type }))
  } catch (error) {
    throw new Error(`Could not get information about IPs on BlueOS. ${error}`)
  }
}
