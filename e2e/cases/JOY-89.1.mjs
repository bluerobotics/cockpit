import { clickDialogButton } from '../lib/actions.mjs'
import {
  calibration,
  JOY_META,
  joystickSetup,
  mapAxisToVariable,
  matches,
  openCalibration,
  setCalibrationOption,
  setExponential,
  sweepAxis,
} from '../lib/joystick.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'

export const meta = { ...JOY_META, title: 'Exponential scaling bends the axis curve' }

export const setup = joystickSetup

// Height of the drawn curve at input 0.5 (x = 150 in the graph's 200-wide box).
const curveAtHalf = async (page) => {
  const d = await page.eval(`document.querySelector('#deadband-svg-0 path')?.getAttribute('d') ?? ''`)
  const points = d
    .slice(2)
    .split(' L ')
    .map((p) => p.split(',').map(Number))
  return points.reduce((a, b) => (Math.abs(b[0] - 150) < Math.abs(a[0] - 150) ? b : a), [Infinity, NaN])[1]
}

/**
 * With axis 0 driving a variable over -1 to 1, set its exponential to 2: the curve bends and the variable
 * follows sign × |v|².
 */
export default async function run({ page }) {
  await mapAxisToVariable(page, 0, { min: -1, max: 1 })
  await page.caption('Axis Calibration → Calibrate: tick Exponential Scaling, axis 0 exponential 2')
  await openCalibration(page)
  await setCalibrationOption(page, 'Deadband/Deadzone', false)
  const straight = await curveAtHalf(page)
  await setCalibrationOption(page, 'Exponential Scaling', true)
  await setExponential(page, 0, 2)
  const bent = await curveAtHalf(page)
  await page.check('The curve on the graph bends', () => ({
    // Output 0.5 is drawn at y = 35 and 0.25, once squared, at y = 47.5.
    ok: Math.abs(straight - 35) < 0.5 && Math.abs(bent - 47.5) < 0.5,
    detail: `at input 0.5 the curve is drawn at y ${straight?.toFixed(1)} → ${bent?.toFixed(1)}`,
  }))
  await clickDialogButton(page, 'Save', { settle: 1500 })
  await page.check('The calibration is stored: exponential on, 2 on axis 0', async () => {
    const c = await calibration(page)
    return {
      ok: c?.exponential.enabled === true && Math.abs(c.exponential.factors.axes[0] - 2) < 1e-6,
      detail: `enabled ${c?.exponential.enabled}, axis 0 ${c?.exponential.factors.axes[0]}`,
    }
  })
  await closeMenu(page)
  await page.wait(1500)
  const got = await sweepAxis(page, 0, [0.5, 1, -0.5])
  await page.check('The variable reads 0.25, 1 and -0.25', () => matches(got, [0.25, 1, -0.25]))
}
