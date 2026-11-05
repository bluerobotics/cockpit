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
  sweepAxis,
} from '../lib/joystick.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'

export const meta = { ...JOY_META, title: '"Auto calibrate deadzones" sets a band from stick noise' }

export const setup = joystickSetup

/**
 * Run "Auto calibrate deadzones" while axis 0 jitters by ±0.05, save, and check the band it set holds the
 * variable at 0.
 */
export default async function run({ page }) {
  await mapAxisToVariable(page, 0, { min: -1, max: 1 })
  await page.caption('Axis Calibration → Calibrate: tick Deadband/Deadzone, then "Auto calibrate deadzones"')
  await openCalibration(page)
  await setCalibrationOption(page, 'Deadband/Deadzone', true)
  await page.click('text=Auto calibrate deadzones', { settle: 200 })
  await page.caption('Axis 0 jitters by ±0.05 while it calibrates')
  // The calibration ends on the first stick update after 5 s, so the jitter goes on past that.
  for (let i = 0; i < 35; i++) {
    await setAxis(page, 0, i % 2 ? 0.05 : -0.05)
    await page.wait(200)
  }
  await setAxis(page, 0, 0)
  await page.wait(800)
  await clickDialogButton(page, 'Save', { settle: 1500 })
  await page.check('Axis 0 got a deadband of at least 0.05', async () => {
    const c = await calibration(page)
    const band = c?.deadband.thresholds.axes[0]
    return {
      ok: c?.deadband.enabled === true && band >= 0.05,
      detail: `enabled ${c?.deadband.enabled}, axis 0 ${band}`,
    }
  })
  await closeMenu(page)
  await page.wait(1500)
  const got = await sweepAxis(page, 0, [0.04, -0.04])
  await page.check('Inside the band the variable stays 0', () => matches(got, [0, 0]))
}
