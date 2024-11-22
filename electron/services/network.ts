import { ipcMain } from 'electron'
import { networkInterfaces } from 'os'

import { NetworkInfo } from '../../src/types/network'
/**
 * Get the network information
 * @returns {NetworkInfo} The network information
 */
const getInfoOnSubnets = (): NetworkInfo[] => {
  const allSubnets = networkInterfaces()

  const ipv4Subnets = Object.entries(allSubnets)
    .flatMap(([_, nets]) => {
      return nets.map((net) => ({ ...net, interfaceName: _ }))
    })
    .filter((net) => net.family === 'IPv4')
    .filter((net) => !net.internal)

  if (ipv4Subnets.length === 0) {
    throw new Error('No network interfaces found.')
  }

  return ipv4Subnets.map((subnet) => {
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
}

/**
 * Setup the network service
 */
export const setupNetworkService = (): void => {
  ipcMain.handle('get-info-on-subnets', getInfoOnSubnets)
}
