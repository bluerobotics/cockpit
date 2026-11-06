import { setUpActions } from '../lib/act-case.mjs'
import { ACTION_KEYS, clickDialogButton, newAction, NO_ACTIONS } from '../lib/actions.mjs'
import { fieldByLabel } from '../lib/cockpit.mjs'

export const meta = {
  title: 'A JavaScript action that throws tells the operator',
  route: '/',
  needs: [],
  synced: NO_ACTIONS,
  restore: ACTION_KEYS,
}

export const setup = (ctx) => setUpActions(ctx, false)

/**
 * Test Action on code that throws: the error is shown to the operator, and Cockpit keeps running.
 */
export default async function run({ page }) {
  await page.caption('New JavaScript Action that throws')
  await newAction(page, 'JavaScript Action')
  await page.fill(await fieldByLabel(page, 'Action Name'), 'Throw (release)')
  await page.fill('.monaco-editor .view-lines', "throw new Error('release-test boom')")
  await page.wait(800)
  await page.caption('Test Action')
  await clickDialogButton(page, 'Test Action', { settle: 500 })
  await page.check('The error is shown on screen', async () => {
    const shown = await page
      .waitFor(async () => (await page.text()).includes('release-test boom'), { timeout: 5000 })
      .catch(() => false)
    return { ok: shown, detail: shown ? 'error text visible' : 'no visible mention of "release-test boom"' }
  })
  await page.check('Cockpit keeps running', async () => {
    const before = await page.eval(`window.cockpit.getDataLakeVariableLastUpdateTimestamp('cockpit-memory-usage')`)
    await page.wait(1000)
    const after = await page.eval(`window.cockpit.getDataLakeVariableLastUpdateTimestamp('cockpit-memory-usage')`)
    const dialog = await page.exists('text=Test Action')
    return {
      ok: after > before && dialog,
      detail: `memory sampler ticking ${after > before}, dialog still open ${dialog}`,
    }
  })
}
