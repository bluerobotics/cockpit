/* eslint-disable @typescript-eslint/no-explicit-any */

import { useInteractionDialog } from '@/composables/interactionDialog'

const { showDialog } = useInteractionDialog()

export const constrain = (value: number, min: number, max: number): number => {
  return Math.max(Math.min(value, max), min)
}

export const radians = (angle: number): number => (angle * Math.PI) / 180

export const degrees = (angle: number): number => (angle * 180) / Math.PI

export const isEqual = (obj1: any, obj2: any): boolean => {
  return JSON.stringify(obj1) === JSON.stringify(obj2)
}

export const round = (value: number, places = 0): number => {
  const power = Math.pow(10, places)
  return Math.round(value * power) / power
}

export const range = (min: number, max: number): number[] => {
  const len = round(max) - round(min) + 1
  const arr = new Array(len)
  for (let i = 0; i < len; i++) {
    arr[i] = round(min) + i
  }
  return arr
}

/**
 * Create a zero-indexed, sequential array with desired length
 * @param {number} length Length of the array
 * @returns {number[]} Array with desired length starting at 0
 */
export const sequentialArray = (length: number): number[] => {
  return Array.from({ length }, (_, i) => i)
}

/**
 * Simple scale function
 * @param {number} input Input value
 * @param {number} inputMin Input lowest point
 * @param {number} inputMax Input maximum point
 * @param {number} outputMin Output lowest point
 * @param {number} outputMax Output maximum point
 * @returns {number}
 */
export const scale = (
  input: number,
  inputMin: number,
  inputMax: number,
  outputMin: number,
  outputMax: number
): number => {
  return ((input - inputMin) * (outputMax - outputMin)) / (inputMax - inputMin) + outputMin
}

export const resetCanvas = (context: CanvasRenderingContext2D): void => {
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, context.canvas.width, context.canvas.height)
  context.globalCompositeOperation = 'source-over'
}

export const isValidNetworkAddress = (maybeAddress: string): boolean => {
  if (maybeAddress && maybeAddress.length >= 255) {
    return false
  }

  // Regexes from https://stackoverflow.com/a/106223/3850957
  const ipRegex = new RegExp(
    '^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$'
  )
  const hostnameRegex = new RegExp(
    '^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])\\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\\-]*[A-Za-z0-9])$'
  )

  if (ipRegex.test(maybeAddress) || hostnameRegex.test(maybeAddress)) {
    return true
  }
  return false
}

export const isValidURL = (maybeURL: string): boolean => {
  if (!maybeURL) {
    return false
  }

  try {
    new URL(maybeURL)
    return true
  } catch (error) {
    return false
  }
}

export const formatBytes = (bytes: number, decimals = 2): string => {
  if (!bytes) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

/**
 * Check if the wheel event is associated with a horizontal scroll
 * @param {WheelEvent} e The wheel event
 * @returns {boolean} Whether or not the wheel event is associated with a horizontal scroll
 */
export const isHorizontalScroll = (e: WheelEvent): boolean => {
  return e.shiftKey
}

/**
 * Wait for a specified amount of time assincronously
 * @param {number} delay The time to sleep in milliseconds
 * @returns {Promise<void>} A promise that resolves after the specified delay
 */
export const sleep = (delay: number): Promise<void> => {
  return new Promise((r) => setTimeout(r, delay))
}

/**
 * Try to run the given function and alert the user if an error occurs
 * @param {() => Promise<void>} tryFunction The time to sleep in milliseconds
 * @returns {Promise<void>} A promise that resolves after the specified delay
 */
export const tryOrAlert = async (tryFunction: () => Promise<void>): Promise<void> => {
  try {
    await tryFunction()
  } catch (error) {
    showDialog({ message: error as string, variant: 'error' })
  }
}

/**
 * Wait till the next tick to reload Cockpit
 * @param {number} timeout The time to wait before reloading, in milliseconds. Default value is 500 ms.
 */
export const reloadCockpit = (timeout = 500): void => {
  const restartMessage = `Restarting Cockpit in ${timeout / 1000} seconds...`
  console.log(restartMessage)
  showDialog({ message: restartMessage, variant: 'info', timer: timeout })
  setTimeout(() => location.reload(), timeout)
}
