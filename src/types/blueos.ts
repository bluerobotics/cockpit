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
