import { setUpActions } from '../lib/act-case.mjs'
import { NO_ACTIONS } from '../lib/actions.mjs'
import {
  callsTo,
  createRequestAction,
  NO_TRIGGERS,
  reloadToActions,
  setTriggers,
  shownTimeTrigger,
  storedTriggers,
} from '../lib/triggers.mjs'

const A = { name: 'Release trigger A', path: '/a' }
const B = { name: 'Release trigger B', path: '/b' }

export const meta = {
  title: 'Removing and setting a time trigger again keeps it working, and leaves other actions alone',
  route: '/',
  needs: ['vehicle'],
  synced: { ...NO_ACTIONS, ...NO_TRIGGERS },
}

export const setup = (ctx) => setUpActions(ctx, false)

const window5s = async (page, echo) => {
  const since = Date.now()
  await page.wait(5000)
  return { a: callsTo(echo, A.path, since).length, b: callsTo(echo, B.path, since).length }
}

/**
 * Two actions run every second. Take A's time trigger off, then put it back: A stops and starts
 * again while B never stops, the dialog shows what was saved, the stored settings stay an object,
 * and both keep running after a restart.
 */
export default async function run({ page, echo, vehicle }) {
  await page.caption('Two actions, both set to run every 1 s')
  for (const action of [A, B]) {
    await createRequestAction(page, echo, action.name, action.path)
    await setTriggers(page, action.name, { time: 'interval', seconds: 1 })
  }
  await page.wait(2000)
  const both = await window5s(page, echo)
  await page.check('Both run', () => ({
    ok: both.a >= 4 && both.b >= 4,
    detail: `A ${both.a}, B ${both.b} calls in 5 s`,
  }))

  await page.caption(`"${A.name}": No time trigger`)
  await setTriggers(page, A.name, { time: 'none' })
  const off = await window5s(page, echo)
  await page.check('A stops and B keeps running', () => ({
    ok: off.a === 0 && off.b >= 4,
    detail: `A ${off.a}, B ${off.b} calls in 5 s`,
  }))

  await page.caption(`"${A.name}": Repeatedly, every 1 s, again`)
  await setTriggers(page, A.name, { time: 'interval', seconds: 1 })
  const on = await window5s(page, echo)
  await page.check('A runs again, B still runs', () => ({
    ok: on.a >= 4 && on.b >= 4,
    detail: `A ${on.a}, B ${on.b} calls in 5 s`,
  }))
  await page.check('A\'s dialog shows "Repeatedly", every 1 s', async () => {
    const shown = await shownTimeTrigger(page, A.name)
    return {
      ok: shown.time === 'Repeatedly' && Number(shown.seconds) === 1,
      detail: `${shown.time}, ${shown.seconds} s`,
    }
  })
  await page.wait(2000)
  await page.check('The stored time triggers are an object holding both actions', async () => {
    const { autoRun } = await storedTriggers(vehicle)
    const entries = autoRun && typeof autoRun === 'object' ? Object.values(autoRun) : []
    return {
      ok: entries.length === 2 && entries.every((e) => e.type === 'interval' && e.delayMs === 1000),
      detail: typeof autoRun === 'string' ? `a string: ${autoRun.slice(0, 60)}` : JSON.stringify(autoRun),
    }
  })

  await page.caption('Restart Cockpit')
  await reloadToActions(page, [A.name, B.name])
  // A slow machine can stay busy for many seconds after Cockpit starts, running every timer late.
  await page.wait(15000)
  const after = await window5s(page, echo)
  await page.check('Both run after the restart', () => ({
    ok: after.a >= 4 && after.b >= 4,
    detail: `A ${after.a}, B ${after.b} calls in 5 s`,
  }))
}
