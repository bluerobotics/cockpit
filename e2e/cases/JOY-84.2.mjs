import {
  assignShift,
  buttonAction,
  chooseLayer,
  createNumberVariable,
  JOY_META,
  joystickSetup,
  lakeValue,
  mapButton,
  openJoystickPage,
  setButton,
} from '../lib/joystick.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'

export const meta = { ...JOY_META, title: 'Shift-layer mapping writes only with shift held' }

export const setup = joystickSetup

const REGULAR = 'release-test/joy-btn'
const SHIFTED = 'release-test/joy-shift'

/**
 * Button 5 is Shift, button 6 writes one variable alone and another with shift held.
 * @param {object} page - Driver page
 * @param {boolean} shift - Hold shift while pressing button 6
 * @returns {Promise<{regular: unknown, shifted: unknown}>} Both variables while button 6 is held
 */
async function press6(page, shift) {
  if (shift) await setButton(page, 5, true)
  await page.wait(300)
  await setButton(page, 6, true)
  await page.wait(1200)
  const seen = { regular: await lakeValue(page, REGULAR), shifted: await lakeValue(page, SHIFTED) }
  await setButton(page, 6, false)
  await page.wait(300)
  if (shift) await setButton(page, 5, false)
  await page.wait(800)
  return seen
}

/**
 * Map button 6 to one variable on the regular layer and to another on the shift layer, with button 5 as
 * Shift, then press button 6 alone and with shift.
 */
export default async function run({ page }) {
  await page.caption('Tools → Data-lake: add two number variables')
  await createNumberVariable(page, REGULAR, 'Joy btn')
  await createNumberVariable(page, SHIFTED, 'Joy shift')

  await page.caption('Settings → Joystick → Table: button 6 → "Joy btn", button 5 → Assign as Shift')
  await openJoystickPage(page)
  await mapButton(page, 6, 'Joy btn')
  await assignShift(page, 5)
  await page.caption('Shift layer: button 6 → "Joy shift"')
  await chooseLayer(page, 'Shift')
  await mapButton(page, 6, 'Joy shift')
  await page.check('Regular button 6, shift button 6 and the shift key are mapped', async () => {
    const [regular, shifted, shift] = [
      await buttonAction(page, 6),
      await buttonAction(page, 6, 'shift'),
      await buttonAction(page, 5),
    ]
    return {
      ok: regular?.id === REGULAR && shifted?.id === SHIFTED && shift?.id === 'shift',
      detail: `6: ${regular?.id}, shift+6: ${shifted?.id}, 5: ${shift?.id}`,
    }
  })
  await chooseLayer(page, 'Regular')
  await closeMenu(page)
  await page.wait(1000)

  await page.caption('Press button 6 alone')
  const alone = await press6(page, false)
  await page.caption('Press button 6 with shift (button 5) held')
  const shifted = await press6(page, true)
  await page.check('Alone, only joy-btn changes', () => ({
    ok: alone.regular === 1 && alone.shifted === 0,
    detail: `joy-btn ${alone.regular}, joy-shift ${alone.shifted}`,
  }))
  await page.check('With shift, only joy-shift changes', () => ({
    ok: shifted.regular === 0 && shifted.shifted === 1,
    detail: `joy-btn ${shifted.regular}, joy-shift ${shifted.shifted}`,
  }))
}
