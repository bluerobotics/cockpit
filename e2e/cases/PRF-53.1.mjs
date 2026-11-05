import { exitEditMode } from '../lib/custom-widget.mjs'
import { pressButton } from '../lib/extensions.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'
import {
  addViewNamed,
  buttonAction,
  mapButton,
  MAPPING_KEY,
  openJoystickTable,
  plugGamepad,
  setup as quiet,
  viewState,
} from '../lib/prf.mjs'

export const meta = {
  title: 'A joystick button runs "Go to next view"',
  route: '/',
  needs: ['vehicle'],
  restore: [MAPPING_KEY],
}

/**
 * The boat profile has a single view, so a second one is added in Edit interface. Cockpit shows the new,
 * empty view, and the next one is the boat's view with the View selector in its bottom bar.
 */
export const setup = async (ctx) => {
  const { page } = ctx
  await quiet(ctx)
  await addViewNamed(page, 'Release test view')
  await exitEditMode(page)
  await plugGamepad(page)
}

/**
 * Settings → Joystick → Table: map button 2 to "Go to next view", go back and press it.
 */
export default async function run({ page }) {
  await page.caption('Settings → Joystick → Table: button 2 → "Go to next view"')
  await openJoystickTable(page)
  await mapButton(page, 2, 'Go to next view')
  const mapped = (await buttonAction(page, 2))?.id
  await page.check('Button 2 is mapped to "Go to next view"', () => ({
    ok: mapped === 'go_to_next_view',
    detail: mapped,
  }))
  await closeMenu(page)
  await page.waitFor(() => page.store('controller', 's.enableForwarding'), { timeout: 10000 }).catch(() => undefined)
  const before = await viewState(page)
  await page.caption(`On "${before.current}": press button 2 once`)
  await pressButton(page, 2)
  await page.wait(1500)
  const after = await viewState(page)
  const expected = (before.index + 1) % before.names.length
  await page.check('The next view is shown, once', () => ({
    ok: before.names.length >= 2 && after.index === expected,
    detail: `"${before.current}" (${before.index}) → "${after.current}" (${after.index}) of ${before.names.length}`,
  }))
  // The View selector is a native select listing the views; the one it shows is its selected option.
  const shown = await page.eval(`[...document.querySelectorAll('select')].find((s) => s.getClientRects().length
    && [...s.options].some((o) => o.text.trim() === ${JSON.stringify(
      before.current
    )}))?.selectedOptions[0]?.text.trim() ?? null`)
  await page.check('The View selector shows its name', () => ({ ok: shown === after.current, detail: `${shown}` }))
}
