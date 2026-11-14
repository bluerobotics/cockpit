import { JOY_META, joystickSetup, mapButton, openJoystickPage, plugSecondGamepad, setButton } from '../lib/joystick.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'

export const meta = { ...JOY_META, title: 'Only the enabled joystick controls' }

const SECOND = 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)'
const SECOND_MODEL = 'DualShock (PS4)'

export const setup = async (ctx) => {
  await joystickSetup(ctx)
  await plugSecondGamepad(ctx.page, SECOND)
  await ctx.page.waitFor(() => ctx.page.store('controller', 's.joysticks.size === 2'), { label: 'the second gamepad' })
}

const topBarShown = (page) =>
  page.eval(`!!document.querySelector('#mainTopBar')?.checkVisibility({ visibilityProperty: true })`)
const enableSwitch = (model) =>
  `[...document.querySelectorAll('p')].find((p) => p.textContent.trim() === '${model} controller')?.nextElementSibling?.querySelector('input')`

/**
 * Press button 4 of a gamepad and report whether the top bar is shown afterwards.
 * @param {object} page - Driver page
 * @param {string} pad - Global holding the gamepad
 * @returns {Promise<boolean>} Top bar shown
 */
async function press4(page, pad) {
  await setButton(page, 4, true, pad)
  await page.wait(400)
  await setButton(page, 4, false, pad)
  await page.wait(1500)
  return topBarShown(page)
}

/**
 * With two gamepads of different models, disable the second on the Joystick page; its button 4 then
 * does nothing, while the first one's still toggles the top bar.
 */
export default async function run({ page }) {
  await page.caption('Settings → Joystick → Table: button 4 → "Toggle top bar"')
  await openJoystickPage(page)
  await mapButton(page, 4, 'Toggle top bar')
  await page.caption(`Visual tab: switch the ${SECOND_MODEL} controller to Disabled`)
  await page.click('text=Visual', { settle: 1500 })
  const at = await page.eval(`(() => { const i = ${enableSwitch(
    SECOND_MODEL
  )}; if (!i) return null; i.scrollIntoView({ block: 'center' })
    const r = i.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!at) throw new Error(`no Enabled switch for the ${SECOND_MODEL} controller`)
  await page.click(at, { settle: 1200 })
  await page.check(`The ${SECOND_MODEL} controller is disabled and greyed`, async () => {
    const disabled = await page.store('controller', 's.disabledJoysticks')
    const greyed = await page.eval(
      `!!${enableSwitch(SECOND_MODEL)}?.closest('.flex-column')?.querySelector('.opacity-50')`
    )
    return {
      ok: disabled.includes(SECOND_MODEL) && !disabled.includes('Xbox controller (bluetooth)') && greyed,
      detail: `disabledJoysticks ${JSON.stringify(disabled)}, greyed ${greyed}`,
    }
  })
  await closeMenu(page)
  await page.wait(1000)

  await page.caption(`Press button 4 on the disabled ${SECOND_MODEL}`)
  const afterDisabled = await press4(page, '__pad2')
  await page.caption('Press button 4 on the enabled Xbox controller')
  const afterEnabled = await press4(page, '__pad')
  await page.check('Only the enabled controller toggles the top bar', () => ({
    ok: afterDisabled && !afterEnabled,
    detail: `top bar shown after the disabled one: ${afterDisabled}; after the enabled one: ${afterEnabled}`,
  }))
  await press4(page, '__pad')
}
