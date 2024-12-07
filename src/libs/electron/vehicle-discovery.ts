import { getStatus } from '../blueos'
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
      const hasRespondingStatusEndpoint = await getStatus(address)
      if (!hasRespondingStatusEndpoint) {
        return null
      }

      // Try to get the vehicle name
      try {
        const response = await fetch(`http://${address}/beacon/v1.0/vehicle_name`)
        if (!response.ok) {
          return null
        }
        const name = await response.text()
        return { address, name }
      } catch {
        // If we can't get the name, it's because it's not a vehicle (or maybe BlueOS's Beacon service is not running)
        return null
      }
    } catch {
      // If we can't get the status, it's because the vehicle is not online
      return null
    }
  }

  /**
   * Get the local subnet
   * @returns {string | null} The local subnet, or null if not running in Electron
   */
  private async getLocalSubnet(): Promise<string> {
    if (!isElectron() || !window.electronAPI?.getNetworkInfo) {
      const msg = 'For technical reasons, getting information about the local subnet is only available in Electron.'
      throw new Error(msg)
    }

    try {
      const { subnet } = await window.electronAPI.getNetworkInfo()
      return subnet
    } catch (error) {
      throw new Error(`Failed to get information about the local subnet. ${error}`)
    }
  }

  /**
   * Find vehicles on the local network
   * @returns {NetworkVehicle[]} The vehicles found
   */
  public async findVehicles(): Promise<NetworkVehicle[]> {
    if (!isElectron()) {
      throw new Error('For technical reasons, finding vehicles is only available in Electron.')
    }

    if (this.currentSearch !== undefined) {
      return this.currentSearch
    }

    const search = async (): Promise<NetworkVehicle[]> => {
      const subnet = await this.getLocalSubnet()

      if (!subnet) {
        throw new Error('Failed to get information about the local subnet.')
      }

      const promises: Promise<NetworkVehicle | null>[] = []

      // Check all IPs in the subnet
      for (let i = 1; i <= 254; i++) {
        const address = `${subnet}.${i}`
        promises.push(this.checkAddress(address))
      }

      const vehiclesFound = await Promise.all(promises).then((results) => {
        return results.filter((result): result is NetworkVehicle => result !== null)
      })

      this.currentSearch = undefined

      return vehiclesFound
    }

    this.currentSearch = search()
    return this.currentSearch
  }
}

export default VehicleDiscover.getInstance()
