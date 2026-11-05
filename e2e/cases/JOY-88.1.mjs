import { clickDialogButton } from '../lib/actions.mjs'
import {
  calibration,
  JOY_META,
  joystickSetup,
  mapAxisToVariable,
  matches,
  openCalibration,
  setAxis,
  setCalibrationOption,
  setDeadband,
  sweepAxis,
} from '../lib/joystick.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'

export const meta = { ...JOY_META, title: 'A deadband keeps the output at 0 inside the band' }

export const setup = joystickSetup

/**
 * With axis 0 driving a variable over -1 to 1, give it a 0.2 deadband in the calibration dialog: inside
 * the band the variable stays 0, outside it is rescaled.
 */
export default async function run({ page }) {
  await mapAxisToVariable(page, 0, { min: -1, max: 1 })
  await page.caption('Axis Calibration → Calibrate: tick Deadband/Deadzone, axis 0 deadband 0.2')
  await openCalibration(page)
  await setCalibrationOption(page, 'Deadband/Deadzone', true)
  await setDeadband(page, 0, 0.2)
  await setAxis(page, 0, 0.15)
  await page.wait(1500)
  await page.check('The graph shows the red band around the centre', async () => {
    const width = await page.eval(
      `document.querySelector('#deadband-svg-0 rect[fill="#f87171"]')?.getAttribute('width') ?? null`
    )
    return { ok: Number(width) === 40, detail: `band ${width ?? 'missing'} of 200 wide` }
  })
  await setAxis(page, 0, 0)
  await clickDialogButton(page, 'Save', { settle: 1500 })
  await page.check('The calibration is stored: deadband on, 0.2 on axis 0', async () => {
    const c = await calibration(page)
    return {
      ok: c?.deadband.enabled === true && c.deadband.thresholds.axes[0] === 0.2,
      detail: `enabled ${c?.deadband.enabled}, axis 0 ${c?.deadband.thresholds.axes[0]}`,
    }
  })
  await closeMenu(page)
  // The joystick manager reloads the calibration once a second.
  await page.wait(1500)
  const got = await sweepAxis(page, 0, [0.15, 0.6, -0.6])
  await page.check('The variable reads 0 inside the band, ±0.5 at ±0.6', () => matches(got, [0, 0.5, -0.5]))
}
