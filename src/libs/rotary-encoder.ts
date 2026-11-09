import { constrain, round } from '@/libs/utils'

/**
 * A rotary encoder dial being turned, carried between pointer moves.
 */
export interface RotaryEncoder {
  /**
   * Pointer angle around the dial center at the last move, in radians, or null until the pointer is off the center.
   */
  angleRad: number | null
  /**
   * Time of the last move, in milliseconds.
   */
  atMs: number
  /**
   * Rotation not yet worth a detent, signed, in radians.
   */
  pendingRad: number
  /**
   * Smoothed turning speed, in radians per second.
   */
  speedRadPerS: number
}

/**
 * What one pointer move on the dial came to.
 */
export interface RotaryEncoderTurn {
  /**
   * Steps to add to the value, clockwise positive, already multiplied for the turning speed.
   */
  steps: number
  /**
   * Rotation since the last move, clockwise positive, in radians.
   */
  deltaRad: number
}

export const DETENTS_PER_TURN = 24
const DETENT_RAD = (2 * Math.PI) / DETENTS_PER_TURN

// Close to the center the pointer angle swings wildly, so moves there are ignored.
const DEAD_ZONE_PX = 12

const SPEED_SMOOTHING = 0.4

// Detents are worth more the faster the dial turns: slow for fine steps, a quick spin to sweep a wide range.
const SPEED_FACTORS = [
  { fromTurnsPerS: 2, factor: 100 },
  { fromTurnsPerS: 1, factor: 10 },
  { fromTurnsPerS: 0, factor: 1 },
]

let selfChecked = false

/**
 * Starts turning a rotary encoder dial.
 * @returns {RotaryEncoder} A dial at rest, waiting for its first pointer position.
 */
export const newRotaryEncoder = (): RotaryEncoder => {
  checkRotaryEncoderOnce()
  return { angleRad: null, atMs: 0, pendingRad: 0, speedRadPerS: 0 }
}

/**
 * Turns the dial to the pointer's new position.
 * @param {RotaryEncoder} encoder Dial being turned, updated in place.
 * @param {number} dx Pointer offset right of the dial center, in pixels.
 * @param {number} dy Pointer offset below the dial center, in pixels.
 * @param {number} atMs Time of the move, in milliseconds.
 * @param {number} rangeSteps Steps between the lowest and highest value, so one fast turn never sweeps much past it.
 * @returns {RotaryEncoderTurn} Steps passed and rotation since the last move.
 */
export const turnRotaryEncoder = (
  encoder: RotaryEncoder,
  dx: number,
  dy: number,
  atMs: number,
  rangeSteps = Infinity
): RotaryEncoderTurn => {
  if (Math.hypot(dx, dy) < DEAD_ZONE_PX) {
    encoder.angleRad = null
    return { steps: 0, deltaRad: 0 }
  }
  const angleRad = Math.atan2(dy, dx)
  const previousRad = encoder.angleRad
  const elapsedS = Math.max(atMs - encoder.atMs, 1) / 1000
  encoder.angleRad = angleRad
  encoder.atMs = atMs
  if (previousRad === null) return { steps: 0, deltaRad: 0 }

  const deltaRad = Math.atan2(Math.sin(angleRad - previousRad), Math.cos(angleRad - previousRad))
  encoder.speedRadPerS += (Math.abs(deltaRad) / elapsedS - encoder.speedRadPerS) * SPEED_SMOOTHING
  encoder.pendingRad += deltaRad
  const detents = Math.trunc(encoder.pendingRad / DETENT_RAD)
  if (detents === 0) return { steps: 0, deltaRad }

  encoder.pendingRad -= detents * DETENT_RAD
  const turnsPerS = encoder.speedRadPerS / (2 * Math.PI)
  const { factor } = SPEED_FACTORS.find(({ fromTurnsPerS }) => turnsPerS >= fromTurnsPerS)!
  return { steps: detents * Math.max(1, Math.min(factor, Math.floor(rangeSteps / DETENTS_PER_TURN))), deltaRad }
}

/**
 * Moves a value by a number of steps, kept within its limits and to the step's precision.
 * @param {number} value Value before the move.
 * @param {number} steps Steps to move, signed.
 * @param {number} step Size of one step.
 * @param {number} min Lowest accepted value.
 * @param {number} max Highest accepted value.
 * @returns {number} The moved value.
 */
export const stepValue = (value: number, steps: number, step: number, min: number, max: number): number =>
  round(constrain(value + steps * step, min, max), (String(step).split('.')[1] ?? '').length)

const sweep = (
  encoder: RotaryEncoder,
  fromDeg: number,
  toDeg: number,
  durationMs: number,
  rangeSteps?: number
): number => {
  const moves = 30
  let steps = 0
  for (let index = 0; index <= moves; index++) {
    const angleRad = ((fromDeg + ((toDeg - fromDeg) * index) / moves) * Math.PI) / 180
    const atMs = encoder.atMs + (index === 0 ? 0 : durationMs / moves)
    steps += turnRotaryEncoder(encoder, 50 * Math.cos(angleRad), 50 * Math.sin(angleRad), atMs, rangeSteps).steps
  }
  return steps
}

const checkRotaryEncoderOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV || typeof assert !== 'function') return
  selfChecked = true
  const fresh = (): RotaryEncoder => ({ angleRad: null, atMs: 0, pendingRad: 0, speedRadPerS: 0 })
  assert(sweep(fresh(), 0, 95, 1000) === 6, 'A slow clockwise quarter turn adds six steps')
  assert(sweep(fresh(), 95, 0, 1000) === -6, 'A slow counter-clockwise quarter turn removes six steps')
  assert(sweep(fresh(), 170, 190, 400) === 1, 'Turning across the left of the dial keeps counting')
  const fast = sweep(fresh(), 0, 720, 400)
  assert(fast > 48 * 10, 'A quick spin sweeps many steps per detent')
  assert(sweep(fresh(), 0, 720, 400, 480) <= 48 * 20, 'A quick spin is capped by the range of the value')
  assert(stepValue(0.3, 1, 0.05, 0, 20) === 0.35 && stepValue(19, 100, 1, 0, 20) === 20, 'Steps snap and clamp')
}
