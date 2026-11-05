import { clickDialogButton } from '../lib/actions.mjs'
import {
  JOY_META,
  joystickSetup,
  mapAxisToVariable,
  matches,
  openCalibration,
  setCalibrationOption,
  setDeadband,
  setExponential,
  sweepAxis,
} from '../lib/joystick.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'

export const meta = { ...JOY_META, title: 'Deadband and exponential combined' }

export const setup = joystickSetup

/**
 * Deadband 0.2 and exponential 2 on axis 0: at 0.6 the deadband gives 0.5, squared to 0.25.
 */
export default async function run({ page }) {
  await mapAxisToVariable(page, 0, { min: -1, max: 1 })
  await page.caption('Axis Calibration → Calibrate: both ticked, axis 0 deadband 0.2 and exponential 2')
  await openCalibration(page)
  await setCalibrationOption(page, 'Deadband/Deadzone', true)
  await setCalibrationOption(page, 'Exponential Scaling', true)
  await setDeadband(page, 0, 0.2)
  await setExponential(page, 0, 2)
  await clickDialogButton(page, 'Save', { settle: 1500 })
  await closeMenu(page)
  await page.wait(1500)
  const got = await sweepAxis(page, 0, [0.6])
  await page.check('The variable reads 0.25 at 0.6', () => matches(got, [0.25]))
}
