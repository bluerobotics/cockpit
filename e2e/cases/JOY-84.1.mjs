import {
  buttonAction,
  createNumberVariable,
  JOY_META,
  joystickSetup,
  lakeValue,
  mapButton,
  openJoystickPage,
  setButton,
  shownLakeValue,
} from '../lib/joystick.mjs'
import { openMenuPage } from '../lib/mavlink-tools.mjs'

export const meta = { ...JOY_META, title: 'A button mapped to a data-lake variable sets it while held' }

export const setup = joystickSetup

const ID = 'release-test/joy-btn'
const NAME = 'Joy btn'

/**
 * Create a number variable, map button 6 to it, then hold the button on the Data-lake page.
 */
export default async function run({ page }) {
  await page.caption(`Tools → Data-lake → Add variable ${ID} = 0`)
  await createNumberVariable(page, ID, NAME)

  await page.caption(`Settings → Joystick → Table: button 6 → Data Lake Variable "${NAME}"`)
  await openJoystickPage(page)
  await mapButton(page, 6, NAME)
  await page.check('Button 6 is mapped to the variable', async () => {
    const action = await buttonAction(page, 6)
    return { ok: action?.id === ID && action?.protocol === 'data-lake-variable', detail: JSON.stringify(action) }
  })

  await page.caption('Back on Tools → Data-lake, watching the variable')
  await openMenuPage(page, 'tools-datalake')
  await page.fill('input[placeholder="Search variables..."]', NAME)
  await page.wait(1000)

  await page.caption('Hold button 6 for 2 s')
  await setButton(page, 6, true)
  await page.wait(2000)
  const held = { value: await lakeValue(page, ID), shown: await shownLakeValue(page, NAME) }
  await page.caption('Release it')
  await setButton(page, 6, false)
  await page.wait(1500)
  const released = { value: await lakeValue(page, ID), shown: await shownLakeValue(page, NAME) }
  await page.check('The variable reads 1 while held', () => ({
    ok: held.value === 1 && held.shown === '1',
    detail: `value ${held.value}, row shows ${held.shown}`,
  }))
  await page.check('… and 0 after release', () => ({
    ok: released.value === 0 && released.shown === '0',
    detail: `value ${released.value}, row shows ${released.shown}`,
  }))
}
