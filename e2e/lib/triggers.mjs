// The automatic triggers of an action (Settings → Actions → link icon), and what the ACT-50 cases
// measure them by: GET calls to the echo server, one path per action.

import { clickActionButton, clickDialogButton, fillHttpAction, newAction, openActions } from './actions.mjs'
import { dismissTutorial, fieldByLabel, TEST_USER, vehicleOnline } from './cockpit.mjs'
import { dismissFeaturesDialog } from './extensions.mjs'

export const TRIGGER_KEYS = ['cockpit-action-links', 'cockpit-actions-auto-run-options']
export const NO_TRIGGERS = Object.fromEntries(TRIGGER_KEYS.map((key) => [key, {}]))
export const MODE_VARIABLE = '/mavlink/1/1/HEARTBEAT/custom_mode'
// ArduRover modes the cases switch between while the boat stays disarmed.
export const MODES = { MANUAL: 0, STEERING: 3, HOLD: 4 }

const TIME_LABELS = { none: 'No time trigger', once: 'On startup', interval: 'Repeatedly' }
const topDialog = `[...document.querySelectorAll('.v-overlay--active')].at(-1)`

/**
 * Create an HTTP action that GETs `path` on the echo server, with no placeholders, so it can run
 * before the vehicle has filled the data lake.
 * @param {object} page - Driver page
 * @param {object} echo - Echo server
 * @param {string} name - Action name
 * @param {string} path - Path it calls, e.g. '/repeat'
 */
export async function createRequestAction(page, echo, name, path) {
  await newAction(page, 'HTTP Request Action')
  await fillHttpAction(page, { name, method: 'GET', url: `${echo.url}${path}` })
  await page.click('text=Create', { settle: 1500 })
}

/**
 * Open an action's Automatic Triggers dialog, set it up and save.
 * @param {object} page - Driver page
 * @param {string} name - Action name
 * @param {object} config - What to set; fields left out keep what the dialog has
 * @param {string[]} [config.variables] - Data-lake variables to add
 * @param {boolean} [config.clearVariables] - Remove every linked variable first
 * @param {number} [config.hz] - "No faster than", changes/s
 * @param {'none'|'once'|'interval'} [config.time] - Time-based trigger
 * @param {number} [config.seconds] - "Run after" / "Run every"
 */
export async function setTriggers(page, name, { variables = [], clearVariables, hz, time, seconds }) {
  await clickActionButton(page, name, 'link')
  if (clearVariables) {
    const clear = '.v-overlay--active .v-autocomplete .v-field__clearable .v-icon'
    if (await page.exists(clear)) await page.click(clear, { settle: 600 })
  }
  for (const variable of variables) {
    // Hundreds of variables are listed lazily, so the name is typed to filter down to it.
    await page.click(await fieldByLabel(page, 'Data Lake Variables'), { settle: 600 })
    await page.type(variable)
    await page.wait(800)
    const item = `[...document.querySelectorAll('.v-overlay--active .v-list-item')].find((i) => i.innerText.trim() === ${JSON.stringify(
      variable
    )})`
    const at = await page.eval(`(() => { const el = ${item}; if (!el) return null; const r = el.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
    if (!at) throw new Error(`no data-lake variable "${variable}" to link`)
    await page.click(at, { settle: 600 })
    // Escape would close the whole dialog, not only the list.
    await page.click('text=When variable(s) change:', { settle: 600 })
  }
  if (hz !== undefined) await page.fill(await fieldByLabel(page, 'No faster than'), hz)
  if (time) await page.click(`text=${TIME_LABELS[time]}`, { settle: 600 })
  if (seconds !== undefined) await page.fill('.v-overlay--active .v-slider .v-input__append input', seconds)
  await clickDialogButton(page, 'Save', { settle: 1500 })
}

/**
 * The time trigger an action's dialog shows, read without changing anything.
 * @param {object} page - Driver page
 * @param {string} name - Action name
 * @returns {Promise<{time: string, seconds: string}>} Selected radio label and the seconds field
 */
export async function shownTimeTrigger(page, name) {
  await clickActionButton(page, name, 'link')
  const shown = await page.eval(`(() => { const d = ${topDialog}
    const radio = [...d.querySelectorAll('.v-radio')].find((r) => r.querySelector('input')?.checked)
    return { time: radio?.innerText.trim() ?? '', seconds: d.querySelector('.v-slider .v-input__append input')?.value ?? '' } })()`)
  await clickDialogButton(page, 'Cancel')
  return shown
}

/**
 * Calls the echo server got on `path`, optionally only those after `since`.
 * @param {object} echo - Echo server
 * @param {string} path - Path
 * @param {number} [since] - Epoch ms
 * @returns {Array<object>} Requests
 */
export const callsTo = (echo, path, since = 0) => echo.requests.filter((r) => r.path === path && r.at >= since)

/**
 * Median gap between consecutive calls, in seconds.
 * @param {Array<object>} calls - Requests
 * @returns {number} Seconds, NaN with fewer than two calls
 */
export function medianGap(calls) {
  const gaps = calls
    .slice(1)
    .map((c, i) => (c.at - calls[i].at) / 1000)
    .sort((a, b) => a - b)
  return gaps.length ? gaps[Math.floor((gaps.length - 1) / 2)] : NaN
}

/**
 * The time-trigger and variable-link settings as synced to the vehicle for the test user.
 * @param {object} vehicle - Vehicle oracle
 * @returns {Promise<{links: object, autoRun: object}>} Both stored values
 */
export async function storedTriggers(vehicle) {
  const [links, autoRun] = await Promise.all(TRIGGER_KEYS.map((key) => vehicle.getSyncedSetting(TEST_USER, key)))
  return { links, autoRun }
}

/**
 * Reload Cockpit and come back to Settings → Actions with every listed action registered.
 * @param {object} page - Driver page
 * @param {string[]} names - HTTP actions that must be available again
 * @returns {Promise<number>} When the page started loading, epoch ms
 */
export async function reloadToActions(page, names) {
  const started = Date.now()
  await page.reload()
  await page.waitFor(() => page.eval(`!!document.querySelector('#app')?.__vue_app__`), { label: 'Cockpit to mount' })
  await page.waitFor(() => vehicleOnline(page), { label: 'the vehicle to come online', timeout: 45000 })
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
  const ids = JSON.stringify(names.map((name) => `http-request-action (${name})`))
  await page
    .waitFor(() => page.eval(`${ids}.every((id) => id in window.cockpit.availableCockpitActions)`), { timeout: 20000 })
    .catch(() => undefined)
  // Standalone can bring the extension features dialog back once the vehicle's settings arrive.
  await dismissFeaturesDialog(page, 3000)
  await openActions(page)
  return started
}
