import type { SerialPortInfo } from '@/types/serial'

import { withAuthoritySlashes } from './connection'
import { buildSerialUri, findUsbSerialPort } from './serial'

/**
 * Kinds of vehicle connection the settings form offers. `default` follows the vehicle address,
 * `custom` is a connection URI typed by hand.
 */
export type ConnectionFormType = 'default' | 'serial' | 'udp' | 'tcp' | 'sitl' | 'custom'

/**
 * A vehicle connection as the fields the user fills, instead of the URI they build
 */
export interface ConnectionForm {
  /**
   * Kind of connection, which decides the fields that matter
   */
  type: ConnectionFormType
  /**
   * System path of the serial port (e.g. /dev/ttyUSB0 or COM3)
   */
  serialPath: string
  /**
   * USB vendor id of the serial device, empty when it has none
   */
  serialVendorId: string
  /**
   * USB product id of the serial device, empty when it has none
   */
  serialProductId: string
  /**
   * Serial number of the serial device, empty when it reports none
   */
  serialNumber: string
  /**
   * Baud rate of the serial port
   */
  baudRate: number
  /**
   * Local port a UDP connection listens on
   */
  udpPort: number
  /**
   * Host a TCP connection connects to
   */
  tcpHost: string
  /**
   * Port a TCP connection connects to
   */
  tcpPort: number
  /**
   * Connection URI, used as it is by the `custom` type
   */
  uri: string
}

/**
 * Whether the value is usable as a network port
 * @param {number} port
 * @returns {boolean}
 */
export const isValidPort = (port: number): boolean => Number.isInteger(port) && port > 0 && port <= 65535

// The USB ids ride in the URI so the device can be found again after the system gives it another path
const serialUri = (form: ConnectionForm, path = form.serialPath): string => {
  const { serialVendorId, serialProductId, serialNumber } = form
  if (!serialVendorId || !serialProductId) return buildSerialUri(path, form.baudRate)
  const usbIds = new URLSearchParams({ vid: serialVendorId, pid: serialProductId })
  if (serialNumber) usbIds.set('sn', serialNumber)
  return `${buildSerialUri(path, form.baudRate)}&${usbIds}`
}

/**
 * Build the connection URI a form describes
 * @param {ConnectionForm} form
 * @returns {string} The URI, which is the form's own `uri` for the types that have no fields
 */
export const connectionFormToUri = (form: ConnectionForm): string => {
  switch (form.type) {
    case 'serial':
      return serialUri(form)
    case 'udp':
      return `udpin:0.0.0.0:${form.udpPort}`
    case 'tcp':
      return `tcpout:${form.tcpHost}:${form.tcpPort}`
    case 'sitl':
      return 'sitl://ardusub'
    default:
      return form.uri
  }
}

/**
 * Read a connection URI back into form fields
 * @param {string} uri
 * @returns {ConnectionForm} A `custom` form holding the URI when the fields can not represent it
 */
export const connectionFormFromUri = (uri: string): ConnectionForm => {
  const form: ConnectionForm = {
    type: 'custom',
    serialPath: '',
    serialVendorId: '',
    serialProductId: '',
    serialNumber: '',
    baudRate: 115200,
    udpPort: 14550,
    tcpHost: '',
    tcpPort: 5760,
    uri,
  }
  let url: URL
  try {
    url = new URL(withAuthoritySlashes(uri))
  } catch {
    return form
  }
  const port = Number(url.port)
  switch (url.protocol) {
    case 'serial:':
      return {
        ...form,
        type: 'serial',
        serialPath: url.pathname || url.host,
        serialVendorId: url.searchParams.get('vid') ?? '',
        serialProductId: url.searchParams.get('pid') ?? '',
        serialNumber: url.searchParams.get('sn') ?? '',
        baudRate: Number(url.searchParams.get('baudrate')) || form.baudRate,
      }
    case 'udpin:':
      return url.hostname === '0.0.0.0' && isValidPort(port) ? { ...form, type: 'udp', udpPort: port } : form
    case 'tcpout:':
      return isValidPort(port) ? { ...form, type: 'tcp', tcpHost: url.hostname, tcpPort: port } : form
    case 'sitl:':
      return url.host === 'ardusub' && !url.search ? { ...form, type: 'sitl' } : form
    default:
      return form
  }
}

/**
 * Point a serial connection URI at the port its USB device currently sits at
 * @param {string} uri
 * @param {SerialPortInfo[]} ports - The ports currently available
 * @returns {string | undefined} The URI to open, which is the given one when it names no USB device, or
 * undefined when its USB device is not connected, so that another device on its old path is never opened
 */
export const resolveSerialConnectionUri = (uri: string, ports: SerialPortInfo[]): string | undefined => {
  const form = connectionFormFromUri(uri)
  if (form.type !== 'serial' || !form.serialVendorId || !form.serialProductId) return uri
  const { serialVendorId: vendorId, serialProductId: productId, serialNumber } = form
  const usbMatch = { vendorId, productId, serialNumber }
  const port = findUsbSerialPort(ports, usbMatch, form.serialPath)
  return port && serialUri(form, port.path)
}
