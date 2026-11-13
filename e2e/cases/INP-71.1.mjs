import { enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import {
  addInputContainer,
  addUserVariable,
  closeElementPanel,
  dropCard,
  editUserVariable,
  INPUT_SYNCED,
  lakeValue,
  openElementPanel,
  placed,
  quietStart,
  selectElementVariable,
} from '../lib/inputs.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'

export const meta = {
  title: 'A Switch follows a variable changed outside the widget',
  route: '/',
  synced: INPUT_SYNCED,
}

const NAME = 'release-test/ext-bool'

export const setup = async (ctx) => {
  await quietStart(ctx)
  ctx.id = await addUserVariable(ctx.page, NAME, 'Boolean', 'false')
  await closeMenu(ctx.page)
}

/**
 * Bind a Switch to an existing user variable, then change the variable in Tools → Data-lake: the switch follows.
 */
export default async function run({ page, id }) {
  await page.caption(`Edit interface: a Switch on "${NAME}" (select)`)
  await enterEditMode(page)
  const rows = await addInputContainer(page)
  await dropCard(page, 'Switch', rows[0])
  const { hash } = await placed(page, 'Switch')
  await openElementPanel(page, hash)
  await selectElementVariable(page, NAME)
  await page.check('The switch is bound to the user variable', async () => {
    const bound = (await placed(page, 'Switch'))?.options.dataLakeVariable?.id
    return { ok: bound === id, detail: bound ?? 'none' }
  })
  await closeElementPanel(page)
  await exitEditMode(page)

  const checked = () => page.eval(`!!document.querySelector('[data-widget-hash="${hash}"] input')?.checked`)
  for (const value of ['true', 'false']) {
    await page.caption(`Tools → Data-lake: set ${NAME} to ${value}`)
    await editUserVariable(page, NAME, value)
    await closeMenu(page)
    await page.wait(800)
    await page.check(`The switch reads ${value}, like the variable`, async () => {
      const shown = await checked()
      const stored = await lakeValue(page, id)
      return { ok: String(shown) === value && stored === shown, detail: `switch ${shown}, variable ${stored}` }
    })
  }
}
