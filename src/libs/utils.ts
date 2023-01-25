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

export const range = (start: number, stop: number, step = 1): number[] => {
  if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) {
    return []
  }
  const result = []
  for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
    result.push(round(i, 2))
  }
  return result
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
