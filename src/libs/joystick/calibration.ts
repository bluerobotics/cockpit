import { type JoystickCalibration } from '@/types/joystick'

/**
 * Apply deadband correction to a value
 * @param {number} value The raw input value (-1 to 1)
 * @param {number} threshold The deadband threshold (0 to 1)
 * @returns {number} The corrected value (-1 to 1)
 */
export function applyDeadband(value: number, threshold: number): number {
  if (Math.abs(value) < threshold) {
    return 0
  }
  // Map the remaining range (threshold to 1) to (0 to 1)
  const sign = Math.sign(value)
  const absValue = Math.abs(value)
  return sign * ((absValue - threshold) / (1 - threshold))
}

/**
 * Apply exponential scaling to a value
 * @param {number} value The raw input value (-1 to 1)
 * @param {number} factor The exponential factor (1.0 to 5.0)
 * @returns {number} The corrected value (-1 to 1)
 */
export function applyExponential(value: number, factor: number): number {
  const sign = Math.sign(value)
  const absValue = Math.abs(value)
  return sign * Math.pow(absValue, factor)
}

/**
 * Apply all calibration corrections to a value
 * @param {string} inputType The type of input ('button' or 'axis')
 * @param {number} inputIndex The index of the input
 * @param {number} originalValue The original value of the input
 * @param {JoystickCalibration} joystickCalibration The calibration settings
 * @returns {number} The corrected value (-1 to 1)
 */
export function applyCalibration(
  inputType: 'button' | 'axis',
  inputIndex: number,
  originalValue: number,
  joystickCalibration: JoystickCalibration
): number {
  let correctedValue = originalValue

  if (joystickCalibration.deadband.enabled) {
    const threshold =
      inputType === 'axis'
        ? joystickCalibration.deadband.thresholds.axes[inputIndex]
        : joystickCalibration.deadband.thresholds.buttons[inputIndex]
    if (threshold !== undefined) {
      correctedValue = applyDeadband(correctedValue, threshold)
    }
  }

  if (joystickCalibration.exponential.enabled) {
    const factor =
      inputType === 'axis'
        ? joystickCalibration.exponential.factors.axes[inputIndex]
        : joystickCalibration.exponential.factors.buttons[inputIndex]
    if (factor !== undefined) {
      correctedValue = applyExponential(correctedValue, factor)
    }
  }

  return correctedValue
}
