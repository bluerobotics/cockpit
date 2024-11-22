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
   * The CIDR of the local machine
   */
  availableAddresses: string[]
}
