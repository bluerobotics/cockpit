import {
  AXIS_VARIABLE,
  axisMapping,
  JOY_META,
  joystickSetup,
  mapAxisToVariable,
  matches,
  sweepAxis,
} from '../lib/joystick.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'

export const meta = { ...JOY_META, title: 'An axis mapped to a data-lake variable writes the scaled value' }

export const setup = joystickSetup

/**
 * Map axis 2 to a number variable over 0 to 100 and move it to -1, 0 and +1.
 */
export default async function run({ page }) {
  await mapAxisToVariable(page, 2, { min: 0, max: 100 })
  await page.check('Axis 2 drives the variable over 0 to 100', async () => {
    const m = await axisMapping(page, 2)
    return {
      ok: m?.action.id === AXIS_VARIABLE.id && m.min === 0 && m.max === 100,
      detail: `${m?.action.id} ${m?.min} / ${m?.max}`,
    }
  })
  await closeMenu(page)
  const got = await sweepAxis(page, 2, [-1, 0, 1])
  await page.check('The variable reads 0, 50 and 100', () => matches(got, [0, 50, 100], 0.5))
}
