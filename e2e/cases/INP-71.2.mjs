import { clickActionButton, newAction, NO_ACTIONS, openActions } from '../lib/actions.mjs'
import { fieldByLabel } from '../lib/cockpit.mjs'
import { enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import {
  addInputContainer,
  addUserVariable,
  closeElementPanel,
  dropCard,
  INPUT_SYNCED,
  lakeValue,
  openElementPanel,
  placed,
  quietStart,
  selectElementVariable,
} from '../lib/inputs.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'

export const meta = {
  title: 'A Slider follows a variable set by a JavaScript action',
  route: '/',
  synced: { ...NO_ACTIONS, ...INPUT_SYNCED },
}

const NAME = 'release-test/ext-num'
const ACTION = 'Release set 75'

// A user number variable from Tools → Data-lake, and a JavaScript action writing 75 to it by the id Cockpit gave it.
export const setup = async (ctx) => {
  const { page } = ctx
  await quietStart(ctx)
  ctx.id = await addUserVariable(page, NAME, 'Number', '0')
  await openActions(page)
  await newAction(page, 'JavaScript Action')
  await page.fill(await fieldByLabel(page, 'Action Name'), ACTION)
  await page.fill('.monaco-editor .view-lines', `cockpit.setDataLakeVariableData('${ctx.id}', 75)`)
  await page.wait(800)
  await page.click('text=Create', { settle: 1500 })
  await closeMenu(page)
}

/**
 * Bind a Slider (0–100) to the variable, run the action from Settings → Actions: the slider jumps to 75.
 */
export default async function run({ page, id }) {
  await page.caption(`Edit interface: a Slider (0–100) on "${NAME}" (select)`)
  await enterEditMode(page)
  const rows = await addInputContainer(page)
  await dropCard(page, 'Slider', rows[0])
  const { hash } = await placed(page, 'Slider')
  await openElementPanel(page, hash)
  await selectElementVariable(page, NAME)
  await closeElementPanel(page)
  await exitEditMode(page)
  const thumb = () =>
    page.eval(`document.querySelector('[data-widget-hash="${hash}"] .v-slider-thumb')?.getAttribute('aria-valuenow')`)
  await page.check('The slider starts at 0', async () => ({ ok: (await thumb()) === '0', detail: await thumb() }))

  await page.caption(`Settings → Actions → play "${ACTION}"`)
  await openActions(page)
  await clickActionButton(page, ACTION, 'play')
  await closeMenu(page)
  await page.wait(800)
  await page.check('The slider shows 75, like the variable', async () => {
    const shown = await thumb()
    const stored = await lakeValue(page, id)
    return { ok: shown === '75' && stored === 75, detail: `slider ${shown}, variable ${stored}` }
  })
}
