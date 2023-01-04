/* eslint-disable @typescript-eslint/no-explicit-any */

export const constrain = (value: number, min: number, max: number): number => {
  return Math.max(Math.min(value, max), min)
}

export const radians = (angle: number): number => (angle * Math.PI) / 180

export const degrees = (angle: number): number => (angle * 180) / Math.PI

export const isEqual = (obj1: any, obj2: any): boolean => {
  return JSON.stringify(obj1) === JSON.stringify(obj2)
}

export const round = (value: number, places = 2): number => {
  const power = Math.pow(10, places)
  return Math.round(value * power) / power
}

export const range = (min: number, max: number): number[] => {
  const len = round(max, 0) - round(min, 0) + 1
  const arr = new Array(len)
  for (let i = 0; i < len; i++) {
    arr[i] = round(min, 0) + i
  }
  return arr
}

/**
 * Simple scale function
 *
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
