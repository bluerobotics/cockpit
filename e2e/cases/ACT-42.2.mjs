import { setUpActions } from '../lib/act-case.mjs'
import { clickActionButton, clickDialogButton, listedActions, newAction, NO_ACTIONS } from '../lib/actions.mjs'
import { fieldByLabel } from '../lib/cockpit.mjs'

export const meta = {
  title: 'A JavaScript action runs its code',
  route: '/',
  needs: ['vehicle'],
  synced: NO_ACTIONS,
}

export const setup = (ctx) => setUpActions(ctx, false)

const VARIABLE = 'release-test/js-ran'
const CODE = `cockpit.setDataLakeVariableData('${VARIABLE}', Date.now())`

/**
 * Write a JavaScript action that stamps a data-lake variable, try it with Test Action, create it and
 * run it with its play button: each run writes a newer stamp.
 */
export default async function run({ page }) {
  const stamp = () => page.eval(`window.cockpit.getDataLakeVariableData(${JSON.stringify(VARIABLE)}) ?? 0`)
  await page.caption('New JavaScript Action that stamps a data-lake variable')
  await newAction(page, 'JavaScript Action')
  await page.fill(await fieldByLabel(page, 'Action Name'), 'Release script')
  await page.fill('.monaco-editor .view-lines', CODE)
  await page.wait(800)
  await page.check('The editor holds the code', async () => {
    const text = await page.eval(
      `document.querySelector('.monaco-editor .view-lines').innerText.replace(/\\s+/g, ' ').trim()`
    )
    return { ok: text === CODE, detail: text }
  })

  await page.caption('Test Action')
  const before = await stamp()
  await clickDialogButton(page, 'Test Action', { settle: 1500 })
  const tested = await stamp()
  await page.check('Test Action ran the code', () => ({ ok: tested > before, detail: `${VARIABLE} = ${tested}` }))

  await page.click('text=Create', { settle: 1500 })
  await page.check('The action is listed', async () => {
    const names = await listedActions(page)
    return { ok: names.includes('Release script'), detail: names.join(', ') }
  })
  await page.caption('Run it with its play button')
  await clickActionButton(page, 'Release script', 'play')
  const ran = await stamp()
  await page.check('Running it wrote a newer stamp', () => ({ ok: ran > tested, detail: `${VARIABLE} = ${ran}` }))
}
