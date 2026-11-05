// What the ACT-76/77 and DL-78 to DL-82 cases share: user and compound variables made under Tools →
// Data-lake, MAVLink command actions, restarting Cockpit, and driving the boat by RC override.

import { execFile } from 'node:child_process'

import { clickDialogButton, newAction } from './actions.mjs'
import { dismissTutorial, fieldByLabel, vehicleOnline } from './cockpit.mjs'
import { sleep } from './driver.mjs'
import { dismissFeaturesDialog } from './extensions.mjs'
import { openMenuPage } from './mavlink-tools.mjs'

// The user's own variables and compound variables, emptied before a case and restored after it.
export const NO_USER_VARIABLES = {
  'cockpit-persistent-data-lake-variables': [],
  'cockpit-persistent-data-lake-values': {},
  'cockpit-transforming-functions': [],
}
export const USER_VARIABLE_KEYS = Object.keys(NO_USER_VARIABLES)

export const HEADING = '/mavlink/1/1/VFR_HUD/heading'
export const GROUNDSPEED = '/mavlink/1/1/VFR_HUD/groundspeed'
export const CUSTOM_MODE = '/mavlink/1/1/HEARTBEAT/custom_mode'

export const lake = (page, id) => page.eval(`window.cockpit.getDataLakeVariableData(${JSON.stringify(id)})`)

// Smallest difference between two headings, in degrees.
export const angleDiff = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180)

const topDialog = `[...document.querySelectorAll('.v-overlay--active')].at(-1)`

const centre = (page, expr) =>
  page.eval(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: 'nearest' })
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)

/**
 * Click the element of the topmost dialog whose own text is `text` (a radio or checkbox label).
 * @param {object} page - Driver page
 * @param {string} text - Exact text
 */
export async function clickInDialog(page, text) {
  const at = await centre(
    page,
    `[...${topDialog}.querySelectorAll('label')].find((l) => l.textContent.trim() === ${JSON.stringify(text)})`
  )
  if (!at) throw new Error(`no "${text}" in the dialog`)
  await page.click(at, { settle: 500 })
}

/**
 * Tools → Data-lake, unless it is already open, and search for `query`.
 * @param {object} page - Driver page
 * @param {string} [query] - Search text
 */
export async function openDataLake(page, query) {
  if (!(await page.exists('input[placeholder="Search variables..."]'))) await openMenuPage(page, 'Tools', 'Data-lake')
  if (query === undefined) return
  await page.fill('input[placeholder="Search variables..."]', query)
  await page.wait(1200)
}

const rowOf = (name) =>
  `[...document.querySelectorAll('tbody tr')].find((r) => r.children[0]?.innerText.trim() === ${JSON.stringify(name)})`

/**
 * The data-lake table row of the variable named `name`, as shown, or null when it is not listed.
 * @param {object} page - Driver page
 * @param {string} name - Variable name
 * @returns {Promise<{type: string, source: string, value: string, unit: string}|null>} Row cells
 */
export const shownRow = (page, name) =>
  page.eval(`(() => { const r = ${rowOf(
    name
  )}; if (!r) return null; const c = [...r.children].map((td) => td.innerText.trim())
    return { type: c[1], source: c[2], value: c[3], unit: c[4] } })()`)

const enableManualId = async (page) => {
  const at = await centre(page, `${topDialog}.querySelector('button .mdi-pencil')?.closest('button')`)
  if (!at) throw new Error('no ID pencil in the dialog')
  await page.click(at, { settle: 400 })
}

/**
 * Data-lake → Add variable: a number variable with its own ID.
 * @param {object} page - Driver page
 * @param {object} variable - What to fill
 * @param {string} variable.id - Variable ID
 * @param {string} variable.name - Variable Name
 * @param {number} variable.value - Initial Value
 * @param {string} [variable.unit] - Unit
 * @param {boolean} [variable.saveValue] - Leave "Save variable value between boots" ticked
 */
export async function addUserVariable(page, { id, name, value, unit, saveValue = true }) {
  await openDataLake(page)
  await page.click('text=Add variable', { settle: 1200 })
  await enableManualId(page)
  await page.fill(await fieldByLabel(page, 'Variable ID'), id)
  await page.fill(await fieldByLabel(page, 'Variable Name'), name)
  await clickInDialog(page, 'Number')
  await page.fill(await fieldByLabel(page, 'Initial Value'), value)
  if (unit) await page.fill(await fieldByLabel(page, 'Unit'), unit)
  // Both boxes start ticked.
  if (!saveValue) await clickInDialog(page, 'Save variable value between boots')
  await clickDialogButton(page, 'Save', { settle: 1500 })
}

/**
 * Data-lake: search the variable, open its edit dialog with the pencil and set its value.
 * @param {object} page - Driver page
 * @param {string} name - Variable name, as listed
 * @param {number} value - New value
 */
export async function editUserVariable(page, name, value) {
  await openDataLake(page, name)
  const at = await centre(page, `${rowOf(name)}?.querySelector('button[title="Edit"]')`)
  if (!at) throw new Error(`no edit button for "${name}"`)
  await page.click(at, { settle: 1200 })
  await page.fill(await fieldByLabel(page, 'Initial Value'), value)
  await clickDialogButton(page, 'Save', { settle: 1500 })
}

/**
 * Data-lake → Add compound variable, typed into its expression editor.
 * @param {object} page - Driver page
 * @param {object} variable - What to fill
 * @param {string} variable.id - Variable ID
 * @param {string} variable.name - Variable Name
 * @param {string} variable.expression - Expression
 * @param {string} [variable.unit] - Unit
 * @returns {Promise<string>} The expression as the editor showed it before saving
 */
export async function addCompoundVariable(page, { id, name, expression, unit }) {
  await openDataLake(page)
  await page.click('text=Add compound variable', { settle: 1500 })
  await enableManualId(page)
  await page.fill(await fieldByLabel(page, 'Variable ID'), id)
  await page.fill(await fieldByLabel(page, 'Variable Name'), name)
  await clickInDialog(page, 'Number')
  if (unit) await page.fill(await fieldByLabel(page, 'Unit'), unit)
  await page.fill('.v-overlay--active .monaco-editor .view-lines', expression)
  await page.wait(800)
  // The editor can close a typed "{{" by itself, leaving a stray "}}" after the cursor; delete it as an operator would.
  if ((await editorText(page)) === `${expression}}}`) {
    await page.key('Delete')
    await page.key('Delete')
  }
  await page.wait(800)
  // Leaving the editor closes the variable suggestions "{{" opened; Escape would close the dialog too.
  await page.click(await fieldByLabel(page, 'Description'), { settle: 400 })
  const typed = await editorText(page)
  await clickDialogButton(page, 'Save', { settle: 2000 })
  return typed
}

/**
 * Text of the single-line code in the topmost dialog's editor, whitespace collapsed. Its rows are joined
 * without a separator: a long line wraps into several, which innerText would split with a line break.
 * @param {object} page - Driver page
 * @returns {Promise<string>} Editor text
 */
export const editorText = (page) =>
  page.eval(`(() => { const lines = [...document.querySelectorAll('.v-overlay--active .monaco-editor .view-lines')].at(-1)
    const rows = [...(lines?.querySelectorAll('.view-line') ?? [])].sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top))
    return rows.map((r) => r.textContent).join('').replace(/\\s+/g, ' ').trim() })()`)

/**
 * Settings → Actions → New action → MAVLink Message Action, a COMMAND_LONG from the dialog's defaults
 * with the fields given changed, then Create.
 * @param {object} page - Driver page
 * @param {string} name - Action Name
 * @param {Record<string, string|number>} [fields] - Field label → value, e.g. { 'Parameter 1': 0 }
 */
export async function createCommandAction(page, name, fields = {}) {
  await newAction(page, 'MAVLink Message Action')
  await page.fill(await fieldByLabel(page, 'Action Name'), name)
  for (const [label, value] of Object.entries(fields)) await page.fill(await fieldByLabel(page, label), value)
  await page.click('text=Create', { settle: 1500 })
}

/**
 * Reload Cockpit the way an operator restarts it, and wait until it is back.
 * @param {object} page - Driver page
 * @param {boolean} [withVehicle] - Wait for the vehicle to come online too
 */
export async function reloadCockpit(page, withVehicle = true) {
  await page.reload()
  await page.waitFor(() => page.eval(`!!document.querySelector('#app')?.__vue_app__`), { label: 'Cockpit to mount' })
  if (withVehicle) {
    await page.waitFor(() => vehicleOnline(page), { label: 'the vehicle to come online', timeout: 45000 })
  }
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
}

/**
 * Start keeping every message of `type` Cockpit sends, from its outgoing-message hook (what the
 * MAVLink inspector lists as outgoing).
 * @param {object} page - Driver page
 * @param {string} type - MAVLink message name
 * @returns {Promise<void>} Once listening
 */
export const spyOutgoing = (page, type) =>
  page.eval(`(() => { window.__sent = []
    document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('main-vehicle')
      .listenToOutgoingMessages(${JSON.stringify(
        type
      )}, (pack) => window.__sent.push(JSON.parse(JSON.stringify(pack.message)))) })()`)
export const sentMessages = (page) => page.eval('window.__sent ?? []')

/**
 * GET a BlueOS JSON endpoint directly, as ground truth for what Cockpit polls from it.
 * @param {string} host - Vehicle address
 * @param {string} path - Path, e.g. /system-information/system/cpu
 * @returns {Promise<any>} Parsed body
 */
export const blueos = (host, path) =>
  new Promise((resolve, reject) =>
    execFile('curl', ['-sS', '-m', '5', `http://${host}${path}`], (error, out) => {
      if (error) return reject(new Error(`curl ${path}: ${error.message}`))
      try {
        resolve(JSON.parse(out))
      } catch {
        reject(new Error(`${path} is not JSON: ${out.slice(0, 200)}`))
      }
    })
  )

/**
 * Put the simulator in Manual and arm it (a precondition, not the thing under test).
 * @param {object} vehicle - Vehicle helpers
 */
export async function armInManual(vehicle) {
  await vehicle.command('MAV_CMD_DO_SET_MODE', [1, 0])
  for (let i = 0; i < 10 && !(await vehicle.isArmed()); i++) {
    await vehicle.command('MAV_CMD_COMPONENT_ARM_DISARM', [1, 0])
    await sleep(1000)
  }
  if (!(await vehicle.isArmed())) throw new Error('could not arm the simulator')
}

const override = (vehicle, channels) =>
  vehicle.send({ type: 'RC_CHANNELS_OVERRIDE', target_system: 1, target_component: 1, ...channels })
// 0 releases channels 1-8 back to the radio and leaves 9-18 alone; UINT16_MAX leaves 1-8 alone.
const RELEASE = Object.fromEntries(Array.from({ length: 18 }, (_, i) => [`chan${i + 1}_raw`, 0]))
const UNCHANGED = Object.fromEntries(Array.from({ length: 18 }, (_, i) => [`chan${i + 1}_raw`, i < 8 ? 65535 : 0]))

/**
 * Drive the armed boat in Manual with steering and throttle overrides, as a pilot's sticks would,
 * then hand the sticks back.
 * @param {object} vehicle - Vehicle helpers
 * @param {object} options - Options
 * @param {number} [options.steering] - Channel 1 PWM; 1500 is straight
 * @param {number} [options.throttle] - Channel 3 PWM
 * @param {number} options.ms - Longest it drives
 * @param {Function} [options.until] - Stops early once this resolves true
 */
export async function drive(vehicle, { steering = 1500, throttle = 1750, ms, until }) {
  const end = Date.now() + ms
  try {
    while (Date.now() < end) {
      await override(vehicle, { ...UNCHANGED, chan1_raw: steering, chan3_raw: throttle })
      if (until && (await until())) break
      await sleep(200)
    }
  } finally {
    await override(vehicle, RELEASE).catch(() => undefined)
  }
}

// The variables the DL-81 and DL-82 cases build on.
export const USER_VARIABLE = { id: 'release-test/user-var', name: 'Release user var', value: 5, unit: 'm' }
export const SPEED_KMH = {
  id: 'release-test/speed-kmh',
  name: 'Release speed kmh',
  unit: 'km/h',
  expression: `{{ ${GROUNDSPEED} }} * 3.6`,
}

/**
 * Drive straight for 10 s, sampling SPEED_KMH and the groundspeed together.
 * @param {object} page - Driver page
 * @param {object} vehicle - Vehicle helpers
 * @returns {Promise<Array<{kmh: number, ms: number}>>} Samples
 */
export async function sampleSpeedWhileDriving(page, vehicle) {
  const samples = []
  await drive(vehicle, {
    ms: 10000,
    until: async () => {
      samples.push(
        await page.eval(`({ kmh: window.cockpit.getDataLakeVariableData(${JSON.stringify(SPEED_KMH.id)}),
          ms: window.cockpit.getDataLakeVariableData(${JSON.stringify(GROUNDSPEED)}) })`)
      )
      return false
    },
  })
  return samples
}

/**
 * Check body: SPEED_KMH was groundspeed × 3.6 in every sample, while the boat clearly moved.
 * @param {Array<{kmh: number, ms: number}>} samples - From sampleSpeedWhileDriving
 * @returns {{ok: boolean, detail: string}} Verdict
 */
export function followsSpeed(samples) {
  const off = samples.filter((s) => typeof s.kmh !== 'number' || Math.abs(s.kmh - s.ms * 3.6) > 0.05)
  const top = Math.max(...samples.map((s) => s.kmh ?? 0))
  const last = samples.at(-1)
  return {
    ok: samples.length >= 10 && off.length <= 1 && top >= 1,
    detail: `${samples.length} samples, ${off.length} off, top ${top.toFixed(2)} km/h; last ${last?.kmh?.toFixed?.(
      2
    )} = ${last?.ms?.toFixed?.(3)} × 3.6`,
  }
}
