import { ACTION_KEYS, newAction, NO_ACTIONS, openActions } from '../lib/actions.mjs'
import { fieldByLabel } from '../lib/cockpit.mjs'
import { addActionButton, enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import {
  addInputContainer,
  addUserVariable,
  INPUT_KEYS,
  INPUT_SYNCED,
  lakeValue,
  quietStart,
  showInDataLake,
} from '../lib/inputs.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'

export const meta = {
  title: 'A widget button runs a JavaScript action',
  route: '/',
  synced: { ...NO_ACTIONS, ...INPUT_SYNCED },
  restore: [...ACTION_KEYS, ...INPUT_KEYS],
}

const NAME = 'Release button script'
const VARIABLE = 'release-test/js-btn'

// The variable is made in Tools → Data-lake first, so that page lists it; the action writes to the id it got there.
export const setup = async (ctx) => {
  const { page } = ctx
  await quietStart(ctx)
  ctx.id = await addUserVariable(page, VARIABLE, 'Number', '0')
  await openActions(page)
  await newAction(page, 'JavaScript Action')
  await page.fill(await fieldByLabel(page, 'Action Name'), NAME)
  await page.fill('.monaco-editor .view-lines', `cockpit.setDataLakeVariableData('${ctx.id}', Date.now())`)
  await page.wait(800)
  await page.click('text=Create', { settle: 1500 })
  await closeMenu(page)
}

/**
 * Add a button bound to the JavaScript action and press it twice, 2 s apart: each press stamps the variable anew.
 */
export default async function run({ page, id }) {
  await page.caption('Edit interface → Input → Add new container, with a Button on the JavaScript action')
  await enterEditMode(page)
  const rows = await addInputContainer(page)
  await addActionButton(page, rows[0], 'Stamp', NAME)
  await exitEditMode(page)

  await page.caption('Press it')
  await page.click('text=Stamp', { settle: 500 })
  const first = await lakeValue(page, id)
  await page.wait(2000)
  await page.caption('Press it again, 2 s later')
  await page.click('text=Stamp', { settle: 500 })
  const second = await lakeValue(page, id)
  await page.check(`${VARIABLE} holds two increasing timestamps`, () => ({
    ok: typeof first === 'number' && second - first >= 1500,
    detail: `${first} then ${second}`,
  }))
  await page.caption('Tools → Data-lake shows the last stamp')
  const shown = await showInDataLake(page, VARIABLE)
  await page.check('Tools → Data-lake lists the second stamp', () => ({
    ok: Number(shown?.replace(/[^\d.-]/g, '')) === second,
    detail: shown ?? 'not listed',
  }))
}
