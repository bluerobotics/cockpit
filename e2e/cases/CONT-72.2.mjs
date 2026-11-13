import { addActionButton, enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import {
  barDropPoint,
  closeElementPanel,
  createElementVariable,
  dropCard,
  elementAt,
  INPUT_SYNCED,
  lakeValue,
  openElementPanel,
  paletteMode,
  placed,
  quietStart,
} from '../lib/inputs.mjs'

export const meta = {
  title: 'Input widgets added to the top and bottom bars',
  route: '/',
  synced: INPUT_SYNCED,
}

export const setup = quietStart

/**
 * A Button in the top bar toggling the bottom bar, and a Switch in the bottom bar on a new variable; both used.
 */
export default async function run({ page }) {
  await page.caption('Edit interface → Input: a Button into the top bar, set to "Toggle bottom bar"')
  await enterEditMode(page)
  await paletteMode(page, 'Input')
  await addActionButton(page, await barDropPoint(page, 'top'), 'Bottom bar', 'Toggle bottom bar')
  await closeElementPanel(page)
  await page.caption('A Switch into the bottom bar; click it and create its variable "release-test/bar-switch"')
  await dropCard(page, 'Switch', await barDropPoint(page, 'bottom'))
  const button = await placed(page, 'Button')
  const toggle = await placed(page, 'Switch')
  await openElementPanel(page, toggle.hash)
  await createElementVariable(page, 'release-test/bar-switch')
  const id = (await placed(page, 'Switch'))?.options.dataLakeVariable?.id
  await page.check('Button in the top bar on its action, Switch in the bottom bar on its variable', () => ({
    ok:
      button?.where === 'top bar' &&
      button.options.cockpitAction?.name === 'Toggle bottom bar' &&
      toggle?.where === 'bottom bar' &&
      !!id,
    detail: `button in ${button?.where} (${button?.options.cockpitAction?.name}), switch in ${toggle?.where} (${id})`,
  }))
  await closeElementPanel(page)
  await exitEditMode(page)

  await page.caption('Toggle the switch')
  const before = await lakeValue(page, id)
  await page.click(await elementAt(page, toggle.hash, 'input'), { settle: 1000 })
  const after = await lakeValue(page, id)
  await page.check('The switch toggled its variable', () => ({
    ok: typeof after === 'boolean' && after !== Boolean(before),
    detail: `${before} → ${after}`,
  }))

  const bottomBar = () =>
    page.eval(`[...document.querySelectorAll('.bottom-bar')].some((b) => b.getClientRects().length)`)
  await page.caption('Press "Bottom bar" twice')
  await page.click('text=Bottom bar', { settle: 1500 })
  const hidden = !(await bottomBar())
  await page.click('text=Bottom bar', { settle: 1500 })
  await page.check('The button hid the bottom bar, then brought it back', async () => ({
    ok: hidden && (await bottomBar()),
    detail: `hidden after one press ${hidden}, back after two ${await bottomBar()}`,
  }))
}
