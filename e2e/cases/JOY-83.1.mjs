import { pressButton } from '../lib/extensions.mjs'
import { buttonAction, JOY_META, joystickSetup, mapButton, openJoystickPage } from '../lib/joystick.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'

export const meta = { ...JOY_META, title: 'A button mapped to a Cockpit Action runs it' }

export const setup = joystickSetup

const topBarShown = (page) =>
  page.eval(`!!document.querySelector('#mainTopBar')?.checkVisibility({ visibilityProperty: true })`)

/**
 * Map button 4 to "Toggle top bar" in the joystick table, leave the page and press it twice.
 */
export default async function run({ page }) {
  await page.caption('Settings → Joystick → Table: button 4 → "Toggle top bar"')
  await openJoystickPage(page)
  await mapButton(page, 4, 'Toggle top bar')
  await page.check('Button 4 is mapped to the Toggle top bar action', async () => {
    const action = await buttonAction(page, 4)
    return {
      ok: action?.id === 'toggle_top_bar' && action?.protocol === 'cockpit-action',
      detail: JSON.stringify(action),
    }
  })

  await page.caption('Leave the Joystick page: joystick commands are forwarded again')
  await closeMenu(page)
  await page.check('Joystick commands are enabled', async () => ({
    ok: await page.store('controller', 's.enableForwarding'),
  }))

  await page.caption('Press button 4')
  const before = await topBarShown(page)
  await pressButton(page, 4)
  await page.wait(1500)
  const afterFirst = await topBarShown(page)
  await page.caption('Press it again')
  await pressButton(page, 4)
  await page.wait(1500)
  const afterSecond = await topBarShown(page)
  await page.check('The top bar hides, then comes back', () => ({
    ok: before && !afterFirst && afterSecond,
    detail: `shown: ${before} → ${afterFirst} → ${afterSecond}`,
  }))
}
