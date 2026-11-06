import { closeMenu } from '../lib/mavlink-tools.mjs'
import {
  buttonAction,
  createVariable,
  mapButton,
  MAPPING_KEY,
  openDataLake,
  openJoystickTable,
  plugGamepad,
  setButton,
  setup as quiet,
  shownValue,
  variable,
} from '../lib/prf.mjs'

export const meta = {
  title: 'A joystick button sets a data-lake variable',
  route: '/',
  needs: ['vehicle'],
  restore: [MAPPING_KEY],
}

const VARIABLE = 'release-test/btn'

export const setup = async (ctx) => {
  await quiet(ctx)
  await createVariable(ctx.page, VARIABLE, 0)
  await plugGamepad(ctx.page)
}

/**
 * Settings → Joystick → Table: map button 3 to the data-lake variable release-test/btn, then watch it in
 * Tools → Data-lake while the button is held and after it is let go.
 */
export default async function run({ page }) {
  await page.caption(`Settings → Joystick → Table: button 3 → data-lake variable ${VARIABLE}`)
  await openJoystickTable(page)
  await mapButton(page, 3, VARIABLE)
  const mapped = await buttonAction(page, 3)
  await page.check(`Button 3 is mapped to ${VARIABLE}`, () => ({
    ok: mapped?.id === VARIABLE && mapped?.protocol === 'data-lake-variable',
    detail: JSON.stringify(mapped),
  }))
  await closeMenu(page)
  await page.caption('Tools → Data-lake, search "release-test"')
  await openDataLake(page, 'release-test')
  await page.waitFor(() => page.store('controller', 's.enableForwarding'), { timeout: 10000 }).catch(() => undefined)

  await page.caption('Hold button 3 for 2 s')
  await setButton(page, 3, true)
  await page.wait(2000)
  const held = await variable(page, VARIABLE)
  const heldShown = await shownValue(page, VARIABLE)
  await page.check('It reads 1 while the button is held', () => ({
    ok: held === 1,
    detail: `${held} (shown "${heldShown}")`,
  }))
  await page.caption('Release it')
  await setButton(page, 3, false)
  await page.wait(1500)
  const released = await variable(page, VARIABLE)
  await page.check('It reads 0 after release', async () => ({
    ok: released === 0,
    detail: `${released} (shown "${await shownValue(page, VARIABLE)}")`,
  }))
}
