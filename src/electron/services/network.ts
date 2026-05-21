import { ipcMain } from 'electron'
import { networkInterfaces } from 'os'

import { NetworkInfo } from '../../types/network'

/**
 * Interface name prefixes that are virtual / non-physical and should be skipped
 * during vehicle discovery; none of these can carry a BlueOS vehicle.
 *
 * SD-WAN / VPN overlays (ZeroTier `zt*` / macOS `feth*`, WireGuard `wg*`,
 * Tailscale `tailscale*` / macOS `utun*`) are intentionally NOT skipped: they
 * are routinely used to reach remote vehicles.
 */
const VIRTUAL_INTERFACE_PREFIXES = [
  'awdl', // Apple Wireless Direct Link
  'br-', // Docker user-defined bridge
  'bridge', // macOS bridge
  'docker', // Docker default bridge
  'gif', // macOS generic tunnel
  'ipsec', // IPSec tunnel
  'llw', // Apple low-latency wifi
  'lo', // loopback (also caught by `internal`, but keep explicit)
  'stf', // macOS 6to4 tunnel
  'tap', // generic TAP device
  'tun', // generic TUN device
  'vboxnet', // VirtualBox host-only
  'veth', // Linux virtual ethernet pair
  'vmnet', // VMware host-only / NAT
]

const isVirtualInterface = (interfaceName: string): boolean => {
  const lower = interfaceName.toLowerCase()
  return VIRTUAL_INTERFACE_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

/**
 * Get the network information
 * @returns {NetworkInfo} The network information
 */
const getInfoOnSubnets = (): NetworkInfo[] => {
  const allSubnets = networkInterfaces()

  const rawList = Object.entries(allSubnets).flatMap(([_, nets]) => {
    return (nets ?? []).map((net) => ({ ...net, interfaceName: _ }))
  })
  console.log(
    `[VehicleDiscovery] Raw network interfaces: ${JSON.stringify(
      rawList.map((n) => ({
        iface: n.interfaceName,
        family: n.family,
        internal: n.internal,
        addr: n.address,
        cidr: n.cidr,
      }))
    )}`
  )

  const ipv4Candidates = rawList.filter((net) => net.family === 'IPv4').filter((net) => !net.internal)

  const skipped = ipv4Candidates.filter((net) => isVirtualInterface(net.interfaceName))
  const ipv4Subnets = ipv4Candidates.filter((net) => !isVirtualInterface(net.interfaceName))

  if (skipped.length > 0) {
    console.log(
      `[VehicleDiscovery] Skipping ${skipped.length} virtual interface(s): ${JSON.stringify(
        skipped.map((n) => ({ iface: n.interfaceName, addr: n.address }))
      )}`
    )
  }

  if (ipv4Subnets.length === 0) {
    console.warn('[VehicleDiscovery] No external IPv4 interfaces found, aborting.')
    throw new Error('No network interfaces found.')
  }

  const result = ipv4Subnets.map((subnet) => {
    // TODO: Use the mask to calculate the available addresses. The current implementation is not correct for anything else than /24.
    const subnetPrefix = subnet.address.split('.').slice(0, 3).join('.')
    const availableAddresses: string[] = []
    for (let i = 1; i <= 254; i++) {
      availableAddresses.push(`${subnetPrefix}.${i}`)
    }

    return {
      topSideAddress: subnet.address,
      macAddress: subnet.mac,
      interfaceName: subnet.interfaceName,
      availableAddresses,
    }
  })

  console.log(
    `[VehicleDiscovery] Subnets to scan: ${JSON.stringify(
      result.map((s) => ({ iface: s.interfaceName, top: s.topSideAddress, count: s.availableAddresses.length }))
    )}`
  )

  return result
}

/**
 * Setup the network service
 */
export const setupNetworkService = (): void => {
  ipcMain.handle('get-info-on-subnets', getInfoOnSubnets)
}
