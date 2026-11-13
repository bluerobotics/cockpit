// What the PRF smoke checks share: the bottom bar's Armer button and mode selector, the joystick
// mapping table driven through the virtual gamepad, views added in Edit interface, and the data lake.

import { execFileSync } from 'node:child_process'
import process from 'node:process'

import { clickDialogButton } from './actions.mjs'
import { chooseOption, dismissTutorial } from './cockpit.mjs'
import { enterEditMode } from './custom-widget.mjs'
import { dismissFeaturesDialog, plugVirtualGamepad } from './extensions.mjs'
import { closeMenu, openMenuPage } from './mavlink-tools.mjs'
import { confirmSlider } from './mission.mjs'

export const VARIABLES_KEYS = ['cockpit-persistent-data-lake-variables', 'cockpit-persistent-data-lake-values']
// A documentation address (RFC 5737): never routed, so nothing answers there.
export const NO_VEHICLE = '203.0.113.7'
// Standalone's startup offer to search for vehicles, and its "do not offer again" button.
export const OFFER = 'No vehicle connected yet.'
export const OFFER_SUPPRESS = 'button[aria-label="Do not offer a vehicle search on startup"]'

export const setup = async ({ page }) => {
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
}

/**
 * Viewport centre of the element `expr` evaluates to, scrolled into view first.
 * @param {object} page - Driver page
 * @param {string} expr - JS expression for the element
 * @returns {Promise<{x: number, y: number}>} Viewport point
 */
export async function centre(page, expr) {
  const at = await page.eval(`(() => { const el = ${expr}; if (!el) return null
    el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!at) throw new Error(`nothing on screen for ${expr.slice(0, 120)}`)
  return at
}

const ARMER = `[...document.querySelectorAll('button')].find((b) => b.getClientRects().length
  && /^(Armed|Disarmed|Offline|\\.\\.\\.)$/.test(b.innerText.trim()))`

export const armerLabel = (page) => page.eval(`${ARMER}?.innerText.trim() ?? null`)

/**
 * Wait until the Armer button reads `label`.
 * @param {object} page - Driver page
 * @param {string} label - "Armed", "Disarmed", "Offline" or "..."
 * @param {number} [timeout] - ms
 * @returns {Promise<boolean>} Whether it got there
 */
export async function armerShows(page, label, timeout = 10000) {
  // The caption sits over the bottom bar's centre, where the Armer button is; cleared so the video shows the label.
  await page.caption('')
  return page.waitFor(async () => (await armerLabel(page)) === label, { timeout }).catch(() => false)
}

/**
 * Click the Armer button, and slide the confirmation when Cockpit asks for one.
 * @param {object} page - Driver page
 * @returns {Promise<boolean>} Whether a confirmation was asked
 */
export async function clickArmer(page) {
  await page.click(await centre(page, ARMER), { settle: 800 })
  return confirmIfAsked(page)
}

/**
 * Slide the slide-to-confirm prompt if it shows up within a few seconds.
 * @param {object} page - Driver page
 * @returns {Promise<boolean>} Whether one was shown
 */
export async function confirmIfAsked(page) {
  // A slider confirmed earlier in the page can still be in the page with its handle at the far end, so only one
  // whose handle is back at the start counts.
  const fresh = `[...document.querySelectorAll('.slideunlock')].some((t) => { const h = t.querySelector('.slideunlock-handler')
    if (!t.getClientRects().length || !h) return false; return h.getBoundingClientRect().x - t.getBoundingClientRect().x < 40 })`
  const asked = await page.waitFor(() => page.eval(fresh), { timeout: 3000 }).catch(() => false)
  if (!asked) return false
  // It slides in; a press while it still moves misses the handle.
  await page.wait(600)
  await confirmSlider(page)
  return true
}

/**
 * Wait for the vehicle's own armed state, read over mavlink2rest.
 * @param {object} vehicle - Vehicle helpers
 * @param {boolean} armed - State to wait for
 * @param {number} [timeout] - ms
 * @returns {Promise<boolean>} Whether it got there
 */
export async function vehicleArmed(vehicle, armed, timeout = 8000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if ((await vehicle.isArmed()) === armed) return true
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return false
}

const MODE_SELECT = `[...document.querySelectorAll('select')].find((s) => s.getClientRects().length
  && [...s.options].some((o) => o.value === 'HOLD'))`
export const pickMode = (page, mode) => chooseOption(page, MODE_SELECT, mode)
export const shownMode = (page) => page.eval(`${MODE_SELECT}?.value ?? null`)

/**
 * The views of the current profile, which one is shown, and its index.
 * @param {object} page - Driver page
 * @returns {Promise<{names: string[], index: number, current: string}>} View state
 */
export const viewState = (page) =>
  page.store(
    'widget-manager',
    `({ names: s.currentProfile.views.map((v) => v.name), current: s.currentView.name,
      index: s.currentProfile.views.findIndex((v) => v.hash === s.currentView.hash) })`
  )

/**
 * In edit mode: add a view with the + under Views and name it in the dialog that opens.
 * @param {object} page - Driver page
 * @param {string} name - View name
 */
export async function addViewNamed(page, name) {
  if (!(await page.store('widget-manager', 's.editingMode'))) await enterEditMode(page)
  const plus = `[...document.querySelectorAll('.mdi-plus-circle')].find((e) => e.getClientRects().length
    && e.parentElement?.querySelector('.mdi-upload'))`
  await page.click(await centre(page, plus), { settle: 1200 })
  const input = `[...document.querySelectorAll('input')].find((i) => i.getClientRects().length
    && i.closest('.v-card')?.innerText.includes('New view name'))`
  await page.fill(await centre(page, input), name)
  await page.wait(400)
  await page.click('text=Save', { settle: 1200 })
}

/**
 * Plug in the virtual gamepad and wait for Cockpit to forward its commands.
 * @param {object} page - Driver page
 */
export async function plugGamepad(page) {
  await plugVirtualGamepad(page)
  await page.waitFor(() => page.store('controller', 's.joysticks.size > 0'), { label: 'Cockpit to see the gamepad' })
  await page.waitFor(() => page.store('controller', 's.enableForwarding'), {
    label: 'joystick commands to be enabled',
    timeout: 20000,
  })
}

export const setAxis = (page, axis, value) =>
  page.eval(`(() => { window.__pad.axes[${axis}] = ${value}; window.__pad.timestamp = performance.now() })()`)

export const setButton = (page, button, down) =>
  page.eval(`(() => { const b = window.__pad.buttons[${button}]; b.pressed = ${down}; b.value = ${down ? 1 : 0}
    window.__pad.timestamp = performance.now() })()`)

/**
 * Settings → Joystick → "Import default mapping for this vehicle" → Import selected, then back to the flight view.
 * Returns once the mapping holds the vehicle's defaults (or already did).
 * @param {object} page - Driver page
 */
export async function importDefaultMapping(page) {
  await openMenuPage(page, 'settings-joystick')
  await page.click(
    await centre(
      page,
      `[...document.querySelectorAll('.v-tabs .mdi-import')].find((i) => i.getClientRects().length)?.closest('button')`
    ),
    {
      settle: 1500,
    }
  )
  await page.waitFor(() => page.store('responsive', 's.isVehicleDefaultsJoystickImportModalVisible'), {
    label: 'the default mapping dialog',
    timeout: 5000,
  })
  await page.wait(1000)
  const importButton = `[...document.querySelectorAll('button')].find((b) => b.getClientRects().length
    && b.textContent.trim() === 'Import selected')`
  // Disabled when the mapping already holds every default binding.
  if (await page.eval(`!${importButton}?.disabled`))
    await page.click(await centre(page, importButton), { settle: 1500 })
  else await page.click('text=Cancel', { settle: 800 })
  await closeMenu(page)
}

/**
 * Settings → Joystick → the Table tab.
 * @param {object} page - Driver page
 */
export async function openJoystickTable(page) {
  await openMenuPage(page, 'settings-joystick')
  await page.click('text=Table', { settle: 1200 })
}

const tableRow = (type, id) => `[...document.querySelectorAll('tr')].find((r) => r.getClientRects().length
  && r.querySelector('td')?.innerText.replace(/\\s+/g, ' ').trim() === '${type} ${id}')`

/**
 * Joystick table: "Map function to button" on a button row, search the action and pick it, Close.
 * @param {object} page - Driver page
 * @param {number} button - Button number
 * @param {string} action - Action name as listed
 */
export async function mapButton(page, button, action) {
  await page.click(
    await centre(page, `${tableRow('button', button)}?.querySelector('button:has(.mdi-circle-edit-outline)')`),
    {
      settle: 1200,
    }
  )
  await page.waitFor('text=Input mapping', { label: 'the Input mapping dialog' })
  await page.fill('input[placeholder="Search actions..."]', action)
  await page.wait(600)
  const entry = `[...document.querySelectorAll('.v-overlay--active button')].find((b) => b.getClientRects().length
    && b.querySelector('p')?.textContent.trim() === ${JSON.stringify(action)})`
  await page.click(await centre(page, entry), { settle: 1000 })
  await clickDialogButton(page, 'Close')
}

export const buttonAction = (page, button) =>
  page.store('controller', `s.protocolMapping.buttonsCorrespondencies.regular[${button}]?.action ?? null`)

export const axisMapping = (page, axis) =>
  page.store('controller', `s.protocolMapping.axesCorrespondencies[${axis}] ?? null`)

// The fields are number inputs, whose text select() does not reach, so their text is selected with the keyboard and
// typed over, as an operator does.
const retype = async (page, at, value) => {
  await page.click(at, { settle: 200 })
  await page.key(process.platform === 'darwin' ? 'Meta+a' : 'Control+a', { show: false })
  await page.type(String(value))
}

/**
 * Joystick table: set an axis row's Min, function and Max, then save it.
 * @param {object} page - Driver page
 * @param {number} axis - Axis number
 * @param {{min: number, action: string, max: number}} mapping - What to set; `action` as listed
 */
export async function mapAxis(page, axis, { min, action, max }) {
  const cell = (i) => `${tableRow('axis', axis)}?.querySelectorAll('td')[${i}]`
  await retype(page, await centre(page, `${cell(3)}?.querySelector('input')`), min)
  await page.click(await centre(page, `${cell(4)}?.querySelector('.v-field')`), { settle: 900 })
  const item = `[...document.querySelectorAll('.v-overlay--active .v-list-item')].find((i) => i.innerText.trim() === ${JSON.stringify(
    action
  )})`
  // Long lists render lazily: scroll the menu until the item exists.
  for (let i = 0; i < 80 && !(await page.eval(`!!${item}`)); i++) {
    await page.eval(`(() => { const l = [...document.querySelectorAll('.v-overlay--active .v-list')].at(-1)
      if (l) l.scrollTop += l.clientHeight })()`)
  }
  await page.click(await centre(page, item), { settle: 800 })
  await retype(page, await centre(page, `${cell(5)}?.querySelector('input')`), max)
  await page.wait(500)
  await page.click(await centre(page, `${cell(6)}?.querySelector('button[aria-label="Save changes"]')`), {
    settle: 1200,
  })
}

/**
 * Create a plain number variable in the data lake, the way an extension or a script would.
 * @param {object} page - Driver page
 * @param {string} id - Variable ID, also used as its name
 * @param {number} value - Initial value
 * @returns {Promise<void>}
 */
export const createVariable = (page, id, value) =>
  page.eval(
    `window.cockpit.createDataLakeVariable({ id: ${JSON.stringify(id)}, name: ${JSON.stringify(
      id
    )}, type: 'number', allowUserToChangeValue: true }, ${value})`
  )

export const variable = (page, id) => page.eval(`window.cockpit.getDataLakeVariableData(${JSON.stringify(id)})`)

/**
 * Tools → Data-lake, filtered by `search`.
 * @param {object} page - Driver page
 * @param {string} search - Search text
 */
export async function openDataLake(page, search) {
  if (!(await page.exists('input[placeholder="Search variables..."]'))) await openMenuPage(page, 'tools-datalake')
  await page.fill('input[placeholder="Search variables..."]', search)
  await page.wait(1200)
}

/**
 * Value column of the data-lake table row whose name is `name`, as shown.
 * @param {object} page - Driver page
 * @param {string} name - Variable name
 * @returns {Promise<string|null>} Shown value
 */
export const shownValue = (page, name) =>
  page.eval(`(() => { const row = [...document.querySelectorAll('.v-data-table tbody tr')].find((r) =>
    r.querySelector('td')?.innerText.trim() === ${JSON.stringify(
      name
    )}); return row?.querySelectorAll('td')[3]?.innerText.trim() ?? null })()`)

/**
 * Pause or resume the BlueOS container the CI workflow starts, to drop the vehicle link without
 * touching the browser. Only for a vehicle on this machine.
 * @param {string} host - Vehicle address
 * @param {boolean} paused - Pause (true) or resume (false)
 */
export function pauseBlueOS(host, paused) {
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))
    throw new Error(`${host} is not a BlueOS container on this machine`)
  execFileSync('docker', [paused ? 'pause' : 'unpause', process.env.COCKPIT_E2E_BLUEOS_CONTAINER ?? 'blueos'])
}

/**
 * Settings → General → "Manage users": pick `name`, or create it through admin mode → "add new user"
 * when the vehicle does not have it yet. Waits until Cockpit runs as that user.
 * @param {object} page - Driver page
 * @param {string} name - Username
 */
export async function switchUser(page, name) {
  if (!(await page.exists('#select-profile'))) await openMenuPage(page, 'settings-general')
  await page.click('#select-profile', { settle: 1500 })
  const dialog = `[...document.querySelectorAll('.v-overlay--active')].at(-1)`
  await page.waitFor(() => page.eval(`!${dialog}?.querySelector('.v-progress-circular')`), {
    label: 'the users to load',
  })
  const existing = `[...${dialog}.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(
    name
  )})`
  if (await page.eval(`!!${existing}`)) {
    await page.click(await centre(page, existing), { settle: 1500 })
  } else {
    await page.click('text=admin mode', { settle: 800 })
    await page.click('text=add new user', { settle: 1000 })
    await page.fill('input[placeholder="Username"]', name)
    await page.wait(400)
    await clickDialogButton(page, 'Save', { settle: 1500 })
  }
  await page.waitFor(async () => (await page.store('mission', 's.username')) === name, { label: `user ${name}` })
  // The user's settings come from the vehicle after the switch.
  await page.wait(5000)
}

/**
 * After switching to a user with no settings, Cockpit should ask whether to copy the current user's settings or to
 * start from its defaults. Answers "defaults" when asked.
 * @param {object} page - Driver page
 * @returns {Promise<boolean>} Whether Cockpit asked
 */
export async function startNewUserFromDefaults(page) {
  const button = `[...document.querySelectorAll('.v-overlay--active button')].find((b) => /default/i.test(b.textContent))`
  const asked = await page
    .waitFor(() => page.eval(`!!${button}`), { label: 'the new user question', timeout: 8000 })
    .catch(() => false)
  if (asked) await page.click(await centre(page, button), { settle: 3000 })
  return asked
}

// A user the vehicle has never seen, so each run meets Cockpit's new user question.
export const freshUsername = () => `relb${Date.now().toString(36).slice(-6)}`
