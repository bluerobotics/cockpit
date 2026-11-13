import { setUpActions } from '../lib/act-case.mjs'
import { NO_ACTIONS } from '../lib/actions.mjs'
import { callsTo, createRequestAction, NO_TRIGGERS, reloadToActions, setTriggers } from '../lib/triggers.mjs'

const NAME = 'Release startup request'
const PATH = '/startup'

export const meta = {
  title: 'An "On startup" trigger runs the action once, its delay after Cockpit starts',
  route: '/',
  needs: ['vehicle'],
  synced: { ...NO_ACTIONS, ...NO_TRIGGERS },
}

export const setup = (ctx) => setUpActions(ctx, false)

/**
 * Set "On startup, run after 2 s": saving does not run it; after a restart it runs exactly once,
 * no sooner than 2 s after Cockpit started loading.
 */
export default async function run({ page, echo }) {
  await page.caption(`Create "${NAME}" and set it to run on startup, after 2 s`)
  await createRequestAction(page, echo, NAME, PATH)
  const saved = Date.now()
  await setTriggers(page, NAME, { time: 'once', seconds: 2 })
  await page.wait(4000)
  await page.check('Saving the trigger does not run the action', () => {
    const n = callsTo(echo, PATH, saved).length
    return { ok: n === 0, detail: `${n} calls` }
  })

  await page.caption('Restart Cockpit')
  const started = await reloadToActions(page, [NAME])
  await page.caption('Wait 15 s after the restart')
  await page.waitFor(() => Date.now() - started > 15000, { timeout: 30000 })
  const calls = callsTo(echo, PATH, started)
  await page.check('After the restart it runs exactly once', () => ({
    ok: calls.length === 1,
    detail: `${calls.length} calls in 15 s`,
  }))
  await page.check('That run comes no sooner than 2 s after Cockpit started', () => {
    const after = calls[0] ? (calls[0].at - started) / 1000 : NaN
    return { ok: after >= 2, detail: Number.isNaN(after) ? 'no call' : `${after.toFixed(1)} s after the reload` }
  })
}
