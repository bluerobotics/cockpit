import { closeMenu } from '../lib/mavlink-tools.mjs'
import {
  axisMapping,
  createVariable,
  mapAxis,
  openDataLake,
  openJoystickTable,
  plugGamepad,
  setAxis,
  setup as quiet,
  shownValue,
  variable,
} from '../lib/prf.mjs'

export const meta = {
  title: 'A joystick axis sets a data-lake variable scaled to its min and max',
  route: '/',
  needs: ['vehicle'],
}

const VARIABLE = 'release-test/axis'

export const setup = async (ctx) => {
  await quiet(ctx)
  await createVariable(ctx.page, VARIABLE, 0)
  await plugGamepad(ctx.page)
}

/**
 * Settings → Joystick → Table: axis 0 → release-test/axis from -10 to 10, saved. Then move the stick to
 * -1, 0, +0.5 and +1 and read the variable in Tools → Data-lake.
 */
export default async function run({ page }) {
  await page.caption(`Settings → Joystick → Table: axis 0 → Min -10, ${VARIABLE}, Max 10, save`)
  await openJoystickTable(page)
  await mapAxis(page, 0, { min: -10, action: VARIABLE, max: 10 })
  const mapped = await axisMapping(page, 0)
  await page.check('Axis 0 is saved as release-test/axis, -10 to 10', () => ({
    ok: mapped?.action?.id === VARIABLE && Number(mapped.min) === -10 && Number(mapped.max) === 10,
    detail: `${mapped?.action?.id}, ${mapped?.min} to ${mapped?.max}`,
  }))
  await page.caption('The Preview column follows the stick')
  await setAxis(page, 0, 0.5)
  await page.wait(1500)
  await setAxis(page, 0, 0)
  await closeMenu(page)
  await page.caption('Tools → Data-lake, search "release-test"')
  await openDataLake(page, 'release-test')
  await page.waitFor(() => page.store('controller', 's.enableForwarding'), { timeout: 10000 }).catch(() => undefined)

  const readings = []
  for (const [position, expected] of [
    [-1, -10],
    [0, 0],
    [0.5, 5],
    [1, 10],
  ]) {
    await page.caption(`Axis 0 at ${position}`)
    await setAxis(page, 0, position)
    await page.wait(1000)
    readings.push({
      position,
      expected,
      value: await variable(page, VARIABLE),
      shown: await shownValue(page, VARIABLE),
    })
  }
  await setAxis(page, 0, 0)
  await page.check('It reads -10, 0, 5 and 10 at each position', () => ({
    ok: readings.every((r) => typeof r.value === 'number' && Math.abs(r.value - r.expected) <= 0.1),
    detail: readings.map((r) => `${r.position} → ${r.value?.toFixed?.(2) ?? r.value} (shown ${r.shown})`).join(', '),
  }))
}
