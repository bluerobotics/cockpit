import { NAME, runAndCatch, setUpActions } from '../lib/act-case.mjs'
import { clickActionButton, fillHttpAction, listedActions, NO_ACTIONS } from '../lib/actions.mjs'

export const meta = {
  title: 'Renaming an HTTP action keeps a single action',
  route: '/',
  needs: ['vehicle'],
  synced: NO_ACTIONS,
}

export const setup = (ctx) => setUpActions(ctx, true)

const RENAMED = 'Renamed release request'

/**
 * Rename the action through its edit dialog: the table then lists it once, under the new name,
 * and the renamed action still runs.
 */
export default async function run({ page, echo }) {
  await page.caption(`Edit "${NAME}" and rename it`)
  await clickActionButton(page, NAME, 'pencil')
  await fillHttpAction(page, { name: RENAMED })
  await page.click('text=Save', { settle: 1500 })

  await page.check('The table lists the action once, under its new name', async () => {
    const names = (await listedActions(page)).filter((n) => [NAME, RENAMED].includes(n))
    return { ok: names.length === 1 && names[0] === RENAMED, detail: names.join(', ') }
  })
  await page.check('The registered actions hold only the renamed one', async () => {
    const names = await page.eval(`Object.entries(window.cockpit.availableCockpitActions)
      .filter(([id]) => id.startsWith('http-request-action')).map(([, action]) => action.name)`)
    return { ok: names.length === 1 && names[0] === RENAMED, detail: names.join(', ') }
  })
  await page.caption('Run the renamed action')
  const request = await runAndCatch(page, echo, RENAMED)
  await page.check('The renamed action still calls the server', () => ({
    ok: request?.method === 'PUT',
    detail: request?.method ?? 'nothing',
  }))
}
