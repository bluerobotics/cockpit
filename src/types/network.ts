/**
 * Information about the network
 */
export interface NetworkInfo {
  /**
   * The top side address of the local machine
   */
  topSideAddress: string
  /**
   * The MAC address of the local machine
   */
  macAddress: string
  /**
   * The name of the network interface
   */
  interfaceName: string
  /**
   * Discovery scan priority (lower runs first). 0 = ethernet, 1 = wireless,
   * 2 = ambiguous local (macOS `en[0-9]+`), 3 = VPN / SD-WAN overlay.
   */
  tier: number
  /**
   * The CIDR of the local machine
   */
  availableAddresses: string[]
}
