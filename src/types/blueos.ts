/* eslint-disable jsdoc/require-jsdoc  */

/**
 * Information about the temperature of the BlueOS CPU
 */
export type RawCpuTempInfo = {
  name: string
  temperature: number
  maximum_temperature: number
  critical_temperature: number
}

/**
 * Information about each CPU core in BlueOS
 */
export type RawCpuLoadInfo = {
  name: string
  usage: number
  frequency: number
}

/**
 * Information about the network interfaces in BlueOS
 */
export type RawNetworkInfo = {
  name: string
  description: string
  mac: string
  ips: string[]
  is_up: boolean
  is_loopback: boolean
  received_B: number
  total_received_B: number
  transmitted_B: number
  total_transmitted_B: number
  packets_received: number
  total_packets_received: number
  packets_transmitted: number
  total_packets_transmitted: number
  errors_on_received: number
  total_errors_on_received: number
  errors_on_transmitted: number
  total_errors_on_transmitted: number
}
