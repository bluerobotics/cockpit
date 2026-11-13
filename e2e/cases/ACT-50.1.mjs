import { setUpActions } from '../lib/act-case.mjs'
import { NO_ACTIONS } from '../lib/actions.mjs'
import { callsTo, createRequestAction, MODE_VARIABLE, MODES, NO_TRIGGERS, setTriggers } from '../lib/triggers.mjs'

const NAME = 'Release mode request'
const PATH = '/mode'
const FAST_VARIABLE = '/mavlink/1/1/ATTITUDE/time_boot_ms'

export const meta = {
  title: 'A data-lake trigger runs the action once per change, and no faster than its limit',
  route: '/',
  needs: ['vehicle'],
  synced: { ...NO_ACTIONS, ...NO_TRIGGERS },
}

export const setup = (ctx) => setUpActions(ctx, false)

/**
 * Link an HTTP action to the vehicle's flight mode at 1 change/s, then change the mode: three
 * spaced changes make three calls, a steady mode makes none, and a burst is throttled.
 */
export default async function run({ page, echo, vehicle }) {
  await page.caption(`Create "${NAME}", calling the local server`)
  await createRequestAction(page, echo, NAME, PATH)
  await page.caption('Automatic triggers: when the flight mode changes, no faster than 1 change/s')
  await setTriggers(page, NAME, { variables: [MODE_VARIABLE], hz: 1 })
  await page.check('The table lists the linked variable and its 1000 ms limit', async () => {
    const row = await page.eval(`[...document.querySelectorAll('.v-data-table tbody tr')]
      .find((r) => r.querySelector('td p')?.textContent.trim() === ${JSON.stringify(NAME)})?.innerText ?? ''`)
    return { ok: row.includes(MODE_VARIABLE) && row.includes('1000 ms'), detail: row.replace(/\s+/g, ' ') }
  })

  await page.caption('The mode stays put: no calls')
  await page.wait(4000)
  const quiet = Date.now()
  await page.wait(4000)
  await page.check('No calls while the mode does not change', () => {
    const n = callsTo(echo, PATH, quiet).length
    return { ok: n === 0, detail: `${n} calls in 4 s` }
  })

  await page.caption('Change the mode three times, 3 s apart')
  const spaced = Date.now()
  for (const mode of [MODES.MANUAL, MODES.STEERING, MODES.HOLD]) {
    await vehicle.command('MAV_CMD_DO_SET_MODE', [1, mode])
    await page.wait(3000)
  }
  await page.check('Three mode changes make three calls', () => {
    const n = callsTo(echo, PATH, spaced).length
    return { ok: n === 3, detail: `${n} calls` }
  })

  // The flight mode reaches Cockpit with the heartbeat, once a second, so it cannot change faster than
  // the limit; a timestamp that changes with every attitude message can.
  await page.caption(`Link it to ${FAST_VARIABLE} instead, which changes many times a second`)
  await setTriggers(page, NAME, { clearVariables: true, variables: [FAST_VARIABLE], hz: 1 })
  const fast = Date.now()
  const changes = await page.eval(`new Promise((resolve) => { const seen = new Set(); const t0 = Date.now()
    const tick = setInterval(() => { seen.add(window.cockpit.getDataLakeVariableData(${JSON.stringify(FAST_VARIABLE)}))
      if (Date.now() - t0 > 6000) { clearInterval(tick); resolve(seen.size) } }, 10) })`)
  await page.wait(500)
  const calls = callsTo(echo, PATH, fast).length
  await page.check('The variable changes many times a second', () => ({
    ok: changes >= 24,
    detail: `${changes} values in 6 s`,
  }))
  await page.check('The action runs no faster than 1 a second (at most 7 in 6 s)', () => ({
    ok: calls >= 4 && calls <= 7,
    detail: `${calls} calls in 6 s for ${changes} changes`,
  }))
}
