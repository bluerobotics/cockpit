import { setUpActions } from '../lib/act-case.mjs'
import { clickActionButton, listedActions, NO_ACTIONS } from '../lib/actions.mjs'
import {
  callsTo,
  createRequestAction,
  MODE_VARIABLE,
  MODES,
  NO_TRIGGERS,
  reloadToActions,
  setTriggers,
  storedTriggers,
} from '../lib/triggers.mjs'

const GONE = { name: 'Release deleted request', path: '/deleted' }
const KEPT = { name: 'Release kept request', path: '/kept' }

export const meta = {
  title: 'Deleting an action stops its triggers and removes them, also after a restart',
  route: '/',
  needs: ['vehicle'],
  synced: { ...NO_ACTIONS, ...NO_TRIGGERS },
}

export const setup = (ctx) => setUpActions(ctx, false)

/**
 * One action runs every second and on flight mode changes, another every second. Delete the first:
 * it never runs again, not on its timer, not on a mode change, not after a restart, and its
 * triggers leave the stored settings, while the other keeps running.
 */
export default async function run({ page, echo, vehicle }) {
  await page.caption(`"${GONE.name}": every 1 s and on flight mode changes`)
  await createRequestAction(page, echo, GONE.name, GONE.path)
  await setTriggers(page, GONE.name, { variables: [MODE_VARIABLE], hz: 1, time: 'interval', seconds: 1 })
  await page.caption(`"${KEPT.name}": every 1 s`)
  await createRequestAction(page, echo, KEPT.name, KEPT.path)
  await setTriggers(page, KEPT.name, { time: 'interval', seconds: 1 })
  await page.wait(3000)
  const goneId = `http-request-action (${GONE.name})`
  const stored = await storedTriggers(vehicle)
  const storedBefore = goneId in (stored.links ?? {}) && goneId in (stored.autoRun ?? {})
  const since = Date.now()
  await page.wait(4000)
  await page.check('Both run before the delete', () => {
    const gone = callsTo(echo, GONE.path, since).length
    const kept = callsTo(echo, KEPT.path, since).length
    return {
      ok: gone >= 3 && kept >= 3 && storedBefore,
      detail: `deleted-to-be ${gone}, kept ${kept} calls in 4 s; its link and time trigger ${
        storedBefore ? '' : 'not '
      }stored`,
    }
  })

  await page.caption(`Delete "${GONE.name}"`)
  await clickActionButton(page, GONE.name, 'trash-can-outline')
  await page.check('The action left the table', async () => {
    const names = await listedActions(page)
    return { ok: !names.includes(GONE.name) && names.includes(KEPT.name), detail: names.join(', ') }
  })
  await page.wait(1000)
  const deleted = Date.now()
  await page.caption('Wait 5 s, then change the flight mode')
  await page.wait(5000)
  await vehicle.command('MAV_CMD_DO_SET_MODE', [1, MODES.MANUAL])
  await page.wait(3000)
  await vehicle.command('MAV_CMD_DO_SET_MODE', [1, MODES.HOLD])
  await page.wait(2000)
  await page.check('The deleted action never runs again, timer or mode change', () => {
    const n = callsTo(echo, GONE.path, deleted).length
    return { ok: n === 0, detail: `${n} calls in 10 s with two mode changes` }
  })
  await page.check('The other action keeps running', () => {
    const n = callsTo(echo, KEPT.path, deleted).length
    return { ok: n >= 8, detail: `${n} calls in 10 s` }
  })
  await page.check('Its triggers left the stored settings', async () => {
    const { links, autoRun } = await storedTriggers(vehicle)
    const left = [goneId in (links ?? {}) && 'link', goneId in (autoRun ?? {}) && 'time trigger'].filter(Boolean)
    return {
      ok: Boolean(goneId) && left.length === 0,
      detail: left.length ? `still stored: ${left.join(', ')}` : 'gone from both',
    }
  })

  await page.caption('Restart Cockpit')
  const restarted = await reloadToActions(page, [KEPT.name])
  await page.wait(5000)
  await vehicle.command('MAV_CMD_DO_SET_MODE', [1, MODES.MANUAL])
  await page.wait(3000)
  await vehicle.command('MAV_CMD_DO_SET_MODE', [1, MODES.HOLD])
  await page.wait(2000)
  await page.check('After the restart it still never runs, and the other one does', () => {
    const gone = callsTo(echo, GONE.path, restarted).length
    const kept = callsTo(echo, KEPT.path, restarted).length
    return { ok: gone === 0 && kept >= 5, detail: `deleted ${gone}, kept ${kept} calls` }
  })
}
