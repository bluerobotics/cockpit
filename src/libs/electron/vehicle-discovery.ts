import { NetworkInfo } from '@/types/network'

import { getBeaconInfo, getStatus, getVehicleName } from '../blueos'
import { isElectron } from '../utils'

/**
 * Maximum number of HTTP `/status` checks in flight at once. Firing all
 * addresses at once saturates Chromium's renderer socket pool and the OS ARP
 * cache, causing legitimate vehicles to time out before their request gets a
 * socket.
 */
const MAX_CONCURRENT_ADDRESS_CHECKS = 100

/**
 * Maximum number of TCP pre-filter probes in flight at once. The probes go
 * through Node's `net.Socket` in the Electron main process (not the renderer
 * fetch pool), so we can afford a much higher fan-out than the HTTP stage.
 */
const MAX_CONCURRENT_TCP_PROBES = 500

/**
 * TCP-probe timeout for the pre-filter. Generous enough to cover a relayed
 *  ZeroTier peer; non-existent hosts still fail much faster via RST/ICMP.
 */
const TCP_PROBE_TIMEOUT_MS = 500

/**
 * Threshold at which the TCP pre-filter is worth its overhead. Anything below
 *  this just runs the HTTP scan directly to keep small-LAN behaviour unchanged.
 */
const TCP_PREFILTER_MIN_ADDRESSES = 1024

/** Port we expect any BlueOS vehicle to listen on. */
const BLUEOS_HTTP_PORT = 80

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
      if (!beaconResponse.ok) {
        console.warn(
          `[VehicleDiscovery] [${address}] Host responded to /status but /beacon/ returned ${beaconResponse.status}; not a BlueOS vehicle.`
        )
        return null
      }
      const beaconText = await beaconResponse.text()
      if (!beaconText.toLowerCase().includes('beacon')) {
        console.warn(
          `[VehicleDiscovery] [${address}] Host responded to /beacon/ but body lacks the 'beacon' marker; ignoring.`
        )
        return null
      }

      // Try to get the vehicle name
      const name = await getVehicleName(address)
      console.info(`[VehicleDiscovery] Found vehicle '${name}' at ${address}.`)
      return { address, name }
    } catch {
      // If we can't get the name, it's because it's not a vehicle (or maybe BlueOS's Beacon service is not running)
      return null
    }
  }

  /**
   * Cheaply reject addresses with no TCP/80 listener via Node's `net.Socket`
   * in the main process. Skipped for small scans where the overhead of the
   * extra round-trip outweighs the savings on the HTTP stage.
   * @param {string[]} addresses Candidate IPv4 addresses to probe
   * @param {number} subnetCount Number of subnets these addresses span (used for logging)
   * @returns {Promise<string[]>} Subset of `addresses` whose port 80 accepted a TCP connection
   */
  private async prefilterReachableAddresses(addresses: string[], subnetCount: number): Promise<string[]> {
    if (addresses.length < TCP_PREFILTER_MIN_ADDRESSES) return addresses
    if (!window.electronAPI?.checkTcpPortOpen) return addresses

    const probeStart = Date.now()
    const concurrency = Math.min(MAX_CONCURRENT_TCP_PROBES, addresses.length)
    console.info(
      `[VehicleDiscovery] TCP pre-filter on ${addresses.length} address(es) across ${subnetCount} subnet(s) ` +
        `with up to ${concurrency} probes in flight (${TCP_PROBE_TIMEOUT_MS}ms timeout, port ${BLUEOS_HTTP_PORT}).`
    )

    const probe = window.electronAPI.checkTcpPortOpen
    const survivors: (string | null)[] = new Array(addresses.length).fill(null)
    let nextIndex = 0
    const worker = async (): Promise<void> => {
      while (nextIndex < addresses.length) {
        const i = nextIndex++
        const address = addresses[i]
        try {
          if (await probe(address, BLUEOS_HTTP_PORT, TCP_PROBE_TIMEOUT_MS)) survivors[i] = address
        } catch {
          // Probe errors are equivalent to "host not reachable" for our purposes
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()))

    const reachable = survivors.filter((address): address is string => address !== null)
    console.info(
      `[VehicleDiscovery] TCP pre-filter kept ${reachable.length} / ${addresses.length} address(es) ` +
        `in ${Date.now() - probeStart}ms.`
    )
    return reachable
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
      const searchStart = Date.now()
      console.info('[VehicleDiscovery] Starting vehicle discovery scan...')

      if (!isElectron() || !window.electronAPI?.getInfoOnSubnets) {
        const msg = 'For technical reasons, getting information about the local subnet is only available in Electron.'
        throw new Error(msg)
      }

      let localSubnets: NetworkInfo[] | undefined
      try {
        localSubnets = await window.electronAPI.getInfoOnSubnets()
      } catch (error) {
        console.error(`[VehicleDiscovery] Failed to get information about the local subnets: ${error}`)
        throw new Error(`Failed to get information about the local subnets. ${error}`)
      }

      if (localSubnets.length === 0) {
        console.error('[VehicleDiscovery] Got an empty list of subnets from Electron.')
        throw new Error('Failed to get information about the local subnets.')
      }

      const allAddresses: string[] = []
      for (const subnet of localSubnets) {
        const topSideAddress = subnet.topSideAddress
        for (const address of subnet.availableAddresses) {
          if (address !== topSideAddress) allAddresses.push(address)
        }
      }

      const addressesToCheck = await this.prefilterReachableAddresses(allAddresses, localSubnets.length)

      const vehiclesFound: NetworkVehicle[] = []
      const concurrency = Math.min(MAX_CONCURRENT_ADDRESS_CHECKS, addressesToCheck.length)
      console.info(
        `[VehicleDiscovery] Scanning ${addressesToCheck.length} address(es) across ${localSubnets.length} subnet(s) ` +
          `with up to ${concurrency} concurrent checks.`
      )

      let nextIndex = 0
      const worker = async (): Promise<void> => {
        while (nextIndex < addressesToCheck.length) {
          const address = addressesToCheck[nextIndex++]
          const vehicle = await this.checkAddress(address)
          if (vehicle) {
            vehiclesFound.push(vehicle)
            onVehicleFound?.(vehicle)
          }
        }
      }
      await Promise.all(Array.from({ length: concurrency }, () => worker()))

      this.currentSearch = undefined

      console.info(
        `[VehicleDiscovery] Scan complete in ${Date.now() - searchStart}ms. Found ${vehiclesFound.length} vehicle(s).`
      )

      return vehiclesFound
    }

    this.currentSearch = search()
    return this.currentSearch
  }
}

export default VehicleDiscover.getInstance()
