import { setUpActions } from '../lib/act-case.mjs'
import { ACTION_KEYS, NO_ACTIONS } from '../lib/actions.mjs'
import {
  callsTo,
  createRequestAction,
  medianGap,
  NO_TRIGGERS,
  reloadToActions,
  setTriggers,
  TRIGGER_KEYS,
} from '../lib/triggers.mjs'

const NAME = 'Release repeated request'
const PATH = '/repeat'

export const meta = {
  title: 'A "Repeatedly" trigger runs the action at its interval, also after a restart',
  route: '/',
  needs: ['vehicle'],
  synced: { ...NO_ACTIONS, ...NO_TRIGGERS },
  restore: [...ACTION_KEYS, ...TRIGGER_KEYS],
}

export const setup = (ctx) => setUpActions(ctx, false)

const everySecond = (calls, label) => () => {
  const gap = medianGap(calls)
  return {
    ok: calls.length >= 4 && gap >= 0.8 && gap <= 1.3,
    detail: `${label}: ${calls.length} calls, median gap ${Number.isNaN(gap) ? '-' : gap.toFixed(2)} s`,
  }
}

/**
 * Set "Repeatedly, every 1 s": the action runs about once a second right away, and again after a
 * restart.
 */
export default async function run({ page, echo }) {
  await page.caption(`Create "${NAME}" and set it to run every 1 s`)
  await createRequestAction(page, echo, NAME, PATH)
  const saved = Date.now()
  await setTriggers(page, NAME, { time: 'interval', seconds: 1 })
  await page.wait(6000)
  await page.check('It runs about once a second after saving', everySecond(callsTo(echo, PATH, saved), '6 s'))

  await page.caption('Restart Cockpit')
  await reloadToActions(page, [NAME])
  const back = Date.now()
  await page.wait(6000)
  await page.check('It keeps running every second after the restart', everySecond(callsTo(echo, PATH, back), '6 s'))
}
