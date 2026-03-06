import { NetworkInfo } from '@/types/network'

import { getBeaconInfo, getStatus, getVehicleName } from '../blueos'
import { isElectron } from '../utils'

/**
 * A vehicle found on the network
 */
export interface NetworkVehicle {
  /**
   * The IPV4 address of the vehicle
   */
  address: string
  /**
   * The name of the vehicle
   */
  name: string
}

/**
 * A service for discovering vehicles on the network
 */
class VehicleDiscover {
  private static instance: VehicleDiscover
  private currentSearch: Promise<NetworkVehicle[]> | undefined = undefined

  /**
   * Get the singleton instance of VehicleDiscover
   * @returns {VehicleDiscover} The singleton instance
   */
  public static getInstance(): VehicleDiscover {
    if (!VehicleDiscover.instance) {
      VehicleDiscover.instance = new VehicleDiscover()
    }
    return VehicleDiscover.instance
  }

  /**
   * Check if a vehicle is online on a given address
   * @param {string} address The address of the vehicle
   * @returns {NetworkVehicle | null} The vehicle if it is online, null otherwise
   */
  private async checkAddress(address: string): Promise<NetworkVehicle | null> {
    try {
      // First check if the vehicle is online
      const statusResponse: boolean = await getStatus(address)
      if (!statusResponse) return null

      // Check if the vehicle is a BlueOS vehicle
      const beaconResponse = await getBeaconInfo(address)
      if (!beaconResponse.ok) return null
      const beaconText = await beaconResponse.text()
      if (!beaconText.toLowerCase().includes('beacon')) return null

      // Try to get the vehicle name
      const name = await getVehicleName(address)
      return { address, name }
    } catch {
      // If we can't get the name, it's because it's not a vehicle (or maybe BlueOS's Beacon service is not running)
      return null
    }
  }

  /**
   * Find vehicles on the local network, optionally reporting each vehicle as it is discovered
   * @param {Function} onVehicleFound - Optional callback invoked immediately when a vehicle is found
   * @returns {Promise<NetworkVehicle[]>} All vehicles found after the scan completes
   */
  public async findVehicles(onVehicleFound?: (vehicle: NetworkVehicle) => void): Promise<NetworkVehicle[]> {
    if (!isElectron()) {
      throw new Error('For technical reasons, finding vehicles is only available in Electron.')
    }

    if (this.currentSearch !== undefined) {
      return this.currentSearch
    }

    const search = async (): Promise<NetworkVehicle[]> => {
      if (!isElectron() || !window.electronAPI?.getInfoOnSubnets) {
        const msg = 'For technical reasons, getting information about the local subnet is only available in Electron.'
        throw new Error(msg)
      }

      let localSubnets: NetworkInfo[] | undefined
      try {
        localSubnets = await window.electronAPI.getInfoOnSubnets()
      } catch (error) {
        throw new Error(`Failed to get information about the local subnets. ${error}`)
      }

      if (localSubnets.length === 0) {
        throw new Error('Failed to get information about the local subnets.')
      }

      const vehiclesFound: NetworkVehicle[] = []
      const allChecks: Promise<void>[] = []

      for (const subnet of localSubnets) {
        const topSideAddress = subnet.topSideAddress
        const possibleAddresses = subnet.availableAddresses.filter((address) => address !== topSideAddress)

        for (const address of possibleAddresses) {
          const check = this.checkAddress(address).then((vehicle) => {
            if (vehicle) {
              vehiclesFound.push(vehicle)
              onVehicleFound?.(vehicle)
            }
          })
          allChecks.push(check)
        }
      }

      await Promise.all(allChecks)
      this.currentSearch = undefined

      return vehiclesFound
    }

    this.currentSearch = search()
    return this.currentSearch
  }
}

export default VehicleDiscover.getInstance()
