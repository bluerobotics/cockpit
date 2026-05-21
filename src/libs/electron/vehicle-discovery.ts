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
 * Tier number above which we use the overlay scan strategy. See
 * `interfaceScanTier` in src/electron/services/network.ts for the tier map.
 */
const OVERLAY_TIER_THRESHOLD = 3

/**
 * One pass of the TCP pre-filter, with its own timeout / fan-out budget.
 */
interface ProbePass {
  /** Per-probe TCP timeout in milliseconds. */
  timeoutMs: number
  /** Maximum number of probes in flight. */
  concurrency: number
}

/**
 * Scan strategy for regular local-link tiers (ethernet, wireless, macOS `en*`).
 * A single pass is enough: LAN round-trips are sub-millisecond, the timeout
 * only really shows up on unused IPs that go through ARP-resolution timeouts.
 */
const LAN_PROBE_PASSES: ProbePass[] = [{ timeoutMs: 500, concurrency: 500 }]

/**
 * Scan strategy for overlay tiers (ZeroTier, WireGuard, Tailscale, …). Each
 * pass re-probes only the addresses that failed earlier passes, so the cost
 * is roughly (pass timeout) * (remaining addresses) / concurrency. Earlier
 * passes find direct-path peers fast; later passes catch peers on slower or
 * relayed paths (and ZeroTier's NAT traversal often establishes the direct
 * path during an early pass, letting a later pass succeed cheaply).
 */
const OVERLAY_PROBE_PASSES: ProbePass[] = [
  { timeoutMs: 100, concurrency: 2000 },
  { timeoutMs: 250, concurrency: 2000 },
  { timeoutMs: 500, concurrency: 2000 },
  { timeoutMs: 1000, concurrency: 2000 },
]

/**
 * Port we expect any BlueOS vehicle to listen on.
 */
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
 * A progress update emitted while a discovery scan is running. The renderer
 * uses this to drive the "Searching for vehicles..." UI state.
 */
export interface DiscoveryProgress {
  /**
   * Interface tier currently being scanned. See `interfaceScanTier` in
   * src/electron/services/network.ts for the tier map.
   */
  tier: number
  /**
   * Interface names being scanned together in this tier (e.g. ["en0"] or
   * ["feth1752", "zt7nhpvfgz"]).
   */
  interfaces: string[]
  /**
   * 1-indexed pass number within the tier (overlay tiers use multiple passes).
   */
  passIndex: number
  /**
   * Total number of passes scheduled for this tier.
   */
  totalPasses: number
  /**
   * TCP-probe timeout used by the current pass, in milliseconds.
   */
  passTimeoutMs: number
  /**
   * Number of candidate addresses being probed in this pass.
   */
  addressesInPass: number
  /**
   * Vehicles already reported in this scan so far.
   */
  vehiclesFound: number
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
   * in the main process. Cuts the candidate list before the heavier HTTP probe.
   * @param {string[]} addresses Candidate IPv4 addresses to probe
   * @param {string} label Identifier used in log lines (e.g. tier name)
   * @param {number} probeTimeoutMs Per-probe timeout, scaled to the tier
   * @param {number} maxConcurrency Maximum number of probes in flight, scaled to the tier
   * @param {AbortSignal} signal Optional abort signal; workers stop pulling new addresses when it fires
   * @returns {Promise<string[]>} Subset of `addresses` whose port 80 accepted a TCP connection
   */
  private async prefilterReachableAddresses(
    addresses: string[],
    label: string,
    probeTimeoutMs: number,
    maxConcurrency: number,
    signal?: AbortSignal
  ): Promise<string[]> {
    if (addresses.length === 0) return addresses
    if (!window.electronAPI?.checkTcpPortOpen) return addresses

    const probeStart = Date.now()
    const concurrency = Math.min(maxConcurrency, addresses.length)
    console.info(
      `[VehicleDiscovery] [${label}] TCP pre-filter on ${addresses.length} address(es) ` +
        `with up to ${concurrency} probes in flight (${probeTimeoutMs}ms timeout, port ${BLUEOS_HTTP_PORT}).`
    )

    const probe = window.electronAPI.checkTcpPortOpen
    const survivors: (string | null)[] = new Array(addresses.length).fill(null)
    let nextIndex = 0
    const worker = async (): Promise<void> => {
      while (nextIndex < addresses.length) {
        if (signal?.aborted) return
        const i = nextIndex++
        const address = addresses[i]
        try {
          if (await probe(address, BLUEOS_HTTP_PORT, probeTimeoutMs)) survivors[i] = address
        } catch {
          // Probe errors are equivalent to "host not reachable" for our purposes
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()))

    const reachable = survivors.filter((address): address is string => address !== null)
    console.info(
      `[VehicleDiscovery] [${label}] TCP pre-filter kept ${reachable.length} / ${addresses.length} address(es) ` +
        `in ${Date.now() - probeStart}ms${signal?.aborted ? ' (aborted)' : ''}.`
    )
    return reachable
  }

  /**
   * Run the HTTP /status + /beacon stage against a (typically small) list of
   * pre-filtered addresses, calling `onFound` as each vehicle is identified.
   * @param {string[]} addresses Addresses to probe
   * @param {string} label Identifier used in log lines (e.g. tier name)
   * @param {Function} onFound Callback invoked synchronously as each vehicle is identified
   * @param {AbortSignal} signal Optional abort signal; workers stop pulling new addresses when it fires
   * @returns {Promise<NetworkVehicle[]>} Vehicles identified in this pass
   */
  private async scanAddressesViaHttp(
    addresses: string[],
    label: string,
    onFound: (vehicle: NetworkVehicle) => void,
    signal?: AbortSignal
  ): Promise<NetworkVehicle[]> {
    if (addresses.length === 0) return []
    const concurrency = Math.min(MAX_CONCURRENT_ADDRESS_CHECKS, addresses.length)
    console.info(
      `[VehicleDiscovery] [${label}] HTTP probe on ${addresses.length} address(es) ` +
        `with up to ${concurrency} concurrent checks.`
    )

    const vehicles: NetworkVehicle[] = []
    let nextIndex = 0
    const worker = async (): Promise<void> => {
      while (nextIndex < addresses.length) {
        if (signal?.aborted) return
        const address = addresses[nextIndex++]
        const vehicle = await this.checkAddress(address)
        if (vehicle) {
          vehicles.push(vehicle)
          onFound(vehicle)
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()))
    return vehicles
  }

  /**
   * Find vehicles on the local network, optionally reporting each vehicle as it is discovered
   * @param {Function} onVehicleFound - Optional callback invoked immediately when a vehicle is found
   * @param {Function} onProgress - Optional callback invoked before each pre-filter pass with status info
   * @param {AbortSignal} signal - Optional abort signal that stops pulling new work from the scan
   * @returns {Promise<NetworkVehicle[]>} All vehicles found before the scan completed or was aborted
   */
  public async findVehicles(
    onVehicleFound?: (vehicle: NetworkVehicle) => void,
    onProgress?: (progress: DiscoveryProgress) => void,
    signal?: AbortSignal
  ): Promise<NetworkVehicle[]> {
    if (!isElectron()) {
      throw new Error('For technical reasons, finding vehicles is only available in Electron.')
    }

    if (this.currentSearch !== undefined) {
      return this.currentSearch
    }

    const search = async (): Promise<NetworkVehicle[]> => {
      const searchStart = Date.now()
      console.info('[VehicleDiscovery] Starting vehicle discovery scan...')

      const tearDownInFlightProbes = (): void => {
        window.electronAPI?.abortTcpPortProbes?.()
      }
      signal?.addEventListener('abort', tearDownInFlightProbes, { once: true })

      try {
        if (!window.electronAPI?.getInfoOnSubnets) {
          const msg = 'For technical reasons, getting information about the local subnet is only available in Electron.'
          throw new Error(msg)
        }

        let localSubnets: NetworkInfo[]
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

        const tierGroups = new Map<number, NetworkInfo[]>()
        for (const subnet of localSubnets) {
          if (!tierGroups.has(subnet.tier)) tierGroups.set(subnet.tier, [])
          tierGroups.get(subnet.tier)!.push(subnet)
        }
        const orderedTiers = Array.from(tierGroups.keys()).sort((a, b) => a - b)

        const vehiclesFound: NetworkVehicle[] = []
        const reportVehicle = (vehicle: NetworkVehicle): void => {
          vehiclesFound.push(vehicle)
          onVehicleFound?.(vehicle)
        }

        for (const tier of orderedTiers) {
          if (signal?.aborted) break
          const subnets = tierGroups.get(tier)!
          const label = `tier ${tier}`
          const passes = tier >= OVERLAY_TIER_THRESHOLD ? OVERLAY_PROBE_PASSES : LAN_PROBE_PASSES
          const tierAddresses: string[] = []
          for (const subnet of subnets) {
            const topSideAddress = subnet.topSideAddress
            for (const address of subnet.availableAddresses) {
              if (address !== topSideAddress) tierAddresses.push(address)
            }
          }
          console.info(
            `[VehicleDiscovery] [${label}] Starting scan on ${tierAddresses.length} address(es) ` +
              `across ${subnets.length} interface(s): ${subnets.map((s) => s.interfaceName).join(', ')} ` +
              `(${passes.length} probe pass(es)).`
          )

          let remaining = tierAddresses
          for (let i = 0; i < passes.length && remaining.length > 0; i++) {
            if (signal?.aborted) break
            const { timeoutMs, concurrency } = passes[i]
            const passLabel = `${label} pass ${i + 1}/${passes.length} @${timeoutMs}ms`
            onProgress?.({
              tier,
              interfaces: subnets.map((s) => s.interfaceName),
              passIndex: i + 1,
              totalPasses: passes.length,
              passTimeoutMs: timeoutMs,
              addressesInPass: remaining.length,
              vehiclesFound: vehiclesFound.length,
            })
            const reachable = await this.prefilterReachableAddresses(
              remaining,
              passLabel,
              timeoutMs,
              concurrency,
              signal
            )
            await this.scanAddressesViaHttp(reachable, passLabel, reportVehicle, signal)
            if (i < passes.length - 1 && reachable.length > 0) {
              const reachableSet = new Set(reachable)
              remaining = remaining.filter((address) => !reachableSet.has(address))
            }
          }
        }

        if (signal?.aborted) {
          console.info('[VehicleDiscovery] Scan aborted by caller.')
        }

        console.info(
          `[VehicleDiscovery] Scan complete in ${Date.now() - searchStart}ms. Found ${vehiclesFound.length} vehicle(s).`
        )

        return vehiclesFound
      } finally {
        signal?.removeEventListener('abort', tearDownInFlightProbes)
        this.currentSearch = undefined
      }
    }

    this.currentSearch = search()
    return this.currentSearch
  }
}

export default VehicleDiscover.getInstance()
