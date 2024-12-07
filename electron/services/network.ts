import { ipcMain } from 'electron'
import { networkInterfaces } from 'os'

/**
 * Information about the network
 */
interface NetworkInfo {
  /**
   * The subnet of the local machine
   */
  subnet: string
}

/**
 * Get the network information
 * @returns {NetworkInfo} The network information
 */
const getNetworkInfo = (): NetworkInfo => {
  const nets = networkInterfaces()

  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      // Skip over non-IPv4 and internal addresses
      if (net.family === 'IPv4' && !net.internal) {
        // Return the subnet (e.g., if IP is 192.168.1.5, return 192.168.1)
        return { subnet: net.address.split('.').slice(0, 3).join('.') }
      }
    }
  }

  throw new Error('No network interface found.')
}

/**
 * Setup the network service
 */
export const setupNetworkService = (): void => {
  ipcMain.handle('get-network-info', getNetworkInfo)
}
