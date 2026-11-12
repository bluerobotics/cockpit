import { isElectron } from '@/libs/utils'
import type { SerialPortInfo } from '@/types/serial'

/**
 * Lists the serial ports available on the system, including USB descriptors.
 * @returns {Promise<SerialPortInfo[]>} The available serial ports (empty when not in Electron).
 */
export const listSerialPorts = async (): Promise<SerialPortInfo[]> => {
  if (!isElectron() || !window.electronAPI) return []
  return window.electronAPI.serialListPorts()
}

/**
 * Builds a serial URI that opens the given port at the given baud rate.
 *
 * POSIX ports (e.g. `/dev/ttyUSB0`) already start with a slash and become `serial:///dev/ttyUSB0`, while
 * Windows ports (e.g. `COM3`) become the opaque `serial:COM3`; both resolve to the correct `pathname` used
 * by the main-process `SerialLink`.
 * @param {string} port - The serial port path.
 * @param {number} baud - The baud rate.
 * @returns {string} The serial URI.
 */
export const buildSerialUri = (port: string, baud: number): string => {
  const normalizedPort = port.startsWith('/') ? `//${port}` : port
  return `serial:${normalizedPort}?baudrate=${baud}`
}

type UsbSerialMatch = Pick<SerialPortInfo, 'vendorId' | 'productId' | 'serialNumber'>

/**
 * Finds the connected port of a USB device, which keeps pointing at the device when the system
 * hands it a different path.
 * @param {SerialPortInfo[]} ports - The ports currently available.
 * @param {UsbSerialMatch | undefined} usbMatch - The USB model to look for, and its serial number when it is known.
 * @param {string} lastPath - The path the device was last seen at.
 * @returns {SerialPortInfo | undefined} The port of that device, or undefined when no model is given or it is not connected.
 */
export const findUsbSerialPort = (
  ports: SerialPortInfo[],
  usbMatch: UsbSerialMatch | undefined,
  lastPath: string
): SerialPortInfo | undefined => {
  const { vendorId, productId, serialNumber } = usbMatch ?? {}
  if (!vendorId || !productId) return undefined
  const matches = ports.filter((port) => port.vendorId === vendorId && port.productId === productId)
  if (serialNumber) return matches.find((port) => port.serialNumber === serialNumber)
  // ponytail: devices that share a USB chip and report no serial number are told apart by path only, so a
  // replug can swap them. Matching on the USB location is the upgrade path.
  // Multiple identical-model devices: prefer the exact last-used path, else the first match.
  return matches.find((port) => port.path === lastPath) ?? matches[0]
}
