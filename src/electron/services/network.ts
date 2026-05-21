import { ipcMain } from 'electron'
import { createConnection } from 'net'
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
 * Discovery scan order. Lower tier scans first, so vehicles on a wired or
 * wireless LAN are typically reported before we even start sweeping a
 * ZeroTier-style overlay.
 *
 * - Tier 0: Linux/Windows ethernet (`eth*`, `enp*`, `eno*`, `ens*`, `enx*`,
 *   Windows "Ethernet")
 * - Tier 1: Linux/Windows wireless (`wlan*`, `wlp*`, `wlx*`, `ww*`, Windows
 *   "Wi-Fi" / "Wireless")
 * - Tier 2: macOS `en[0-9]+` (ambiguous wired/wireless, but always a regular
 *   local link)
 * - Tier 3: everything else (SD-WAN / VPN overlays — ZeroTier `feth*` / `zt*`,
 *   WireGuard `wg*`, Tailscale `tailscale*` / `utun*`, …)
 * @param {string} interfaceName Name reported by os.networkInterfaces()
 * @returns {number} Lower numbers scan first
 */
const interfaceScanTier = (interfaceName: string): number => {
  const lower = interfaceName.toLowerCase()
  if (/^(eth|eno|enp|ens|enx)/.test(lower) || lower.startsWith('ethernet')) return 0
  if (/^(wlan|wlp|wlx|ww)/.test(lower) || lower.startsWith('wi-fi') || lower.startsWith('wireless')) return 1
  if (/^en\d/.test(lower)) return 2
  return 3
}

/**
 * Smallest prefix length we are willing to expand (i.e. widest subnet we scan).
 * /16 = 65 534 hosts. Anything wider would balloon the scan, and the next step
 * down (/8) would mean ~16M hosts which is clearly nonsense for discovery.
 */
const MIN_PREFIX_LENGTH = 16

/**
 * Expand an IPv4 subnet into every host address it contains (excluding network
 * and broadcast). Wider-than-MIN_PREFIX_LENGTH subnets are clamped to /16.
 * @param {string} address Host's own IPv4 address (e.g. "172.24.97.147")
 * @param {number} prefixLength CIDR prefix length parsed from the interface
 * @returns {string[]} All host addresses in the (possibly clamped) subnet
 */
const expandSubnet = (address: string, prefixLength: number): string[] => {
  const effectivePrefix = Math.max(prefixLength, MIN_PREFIX_LENGTH)
  const ipToInt = (ip: string): number =>
    ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
  const intToIp = (n: number): string => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.')

  const hostInt = ipToInt(address)
  const mask = effectivePrefix === 0 ? 0 : (0xffffffff << (32 - effectivePrefix)) >>> 0
  const networkInt = (hostInt & mask) >>> 0
  const broadcastInt = (networkInt | (~mask >>> 0)) >>> 0

  const addresses: string[] = []
  for (let i = networkInt + 1; i < broadcastInt; i++) addresses.push(intToIp(i >>> 0))
  return addresses
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

  ipv4Subnets.sort((a, b) => {
    const tierDelta = interfaceScanTier(a.interfaceName) - interfaceScanTier(b.interfaceName)
    return tierDelta !== 0 ? tierDelta : a.interfaceName.localeCompare(b.interfaceName)
  })

  const result = ipv4Subnets.map((subnet) => {
    const declaredPrefix = Number(subnet.cidr?.split('/')[1] ?? 24)
    const prefixLength = Number.isFinite(declaredPrefix) ? declaredPrefix : 24
    const availableAddresses = expandSubnet(subnet.address, prefixLength)

    if (prefixLength < MIN_PREFIX_LENGTH) {
      console.log(
        `[VehicleDiscovery] Interface ${subnet.interfaceName} declares /${prefixLength}; clamping scan to /${MIN_PREFIX_LENGTH} (${availableAddresses.length} addresses).`
      )
    }

    return {
      topSideAddress: subnet.address,
      macAddress: subnet.mac,
      interfaceName: subnet.interfaceName,
      tier: interfaceScanTier(subnet.interfaceName),
      availableAddresses,
    }
  })

  console.log(
    `[VehicleDiscovery] Subnets to scan (preferred order): ${JSON.stringify(
      result.map((s) => ({
        iface: s.interfaceName,
        tier: s.tier,
        top: s.topSideAddress,
        count: s.availableAddresses.length,
      }))
    )}`
  )

  return result
}

/**
 * Probe a TCP port with a short timeout. Used as a fast pre-filter during
 * vehicle discovery: most addresses on a wide subnet either have no route
 * (ICMP unreachable, fails in tens of ms) or no listener (RST, similar), so
 * a TCP connect culls them far faster than the heavier HTTP `/status` probe.
 * @param {string} host IPv4 address to probe
 * @param {number} port TCP port to probe
 * @param {number} timeoutMs Time to wait before giving up
 * @returns {Promise<boolean>} true if the port accepted the connection
 */
const checkTcpPortOpen = (host: string, port: number, timeoutMs: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port })
    let settled = false
    const settle = (open: boolean): void => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(open)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => settle(true))
    socket.once('timeout', () => settle(false))
    socket.once('error', () => settle(false))
  })
}

/**
 * Setup the network service
 */
export const setupNetworkService = (): void => {
  ipcMain.handle('get-info-on-subnets', getInfoOnSubnets)
  ipcMain.handle('check-tcp-port-open', (_event, host: string, port: number, timeoutMs: number) =>
    checkTcpPortOpen(host, port, timeoutMs)
  )
}
