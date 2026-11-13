// Settings → Joystick as the JOY cases drive it: the mapping table, the calibration dialog, the virtual
// gamepad's sticks (extensions.mjs only presses buttons), a second gamepad, and the MANUAL_CONTROL
// messages Cockpit sends.

import process from 'node:process'

import { clickDialogButton } from './actions.mjs'
import { dismissTutorial, fieldByLabel } from './cockpit.mjs'
import { dismissFeaturesDialog, plugVirtualGamepad } from './extensions.mjs'
import { openMenuPage } from './mavlink-tools.mjs'

export const CALIBRATION_KEY = 'cockpit-joystick-calibration-options'
export const DISABLED_KEY = 'cockpit-disabled-joystick-models'
export const PAD_MODEL = 'Xbox controller (bluetooth)'

// Calibration and disabled models start clean; the mapping keeps the vehicle default and is put back afterwards.
export const JOY_META = {
  route: '/',
  needs: ['vehicle'],
  synced: { [CALIBRATION_KEY]: {}, [DISABLED_KEY]: [] },
}

const topDialog = `[...document.querySelectorAll('.v-overlay--active')].at(-1)`

const centre = (page, expr) =>
  page.eval(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)

/**
 * Click a field, select what it holds with the keyboard and replace it. Number inputs ignore select().
 * @param {object} page - Driver page
 * @param {{x: number, y: number}|null} at - Field centre
 * @param {number|string} value - What to type
 */
export const typeInto = async (page, at, value) => {
  if (!at) throw new Error(`no field to type ${value} into`)
  await page.click(at, { settle: 200 })
  await page.key(process.platform === 'darwin' ? 'Meta+a' : 'Control+a', { show: false })
  // A "-" sent as a key press never reaches a number input, so the text goes in as typed input in one go.
  await page.send('Input.insertText', { text: String(value) })
  await page.wait(300)
}

const clickExpr = async (page, expr, what, settle = 800) => {
  const at = await centre(page, expr)
  if (!at) throw new Error(`no ${what}`)
  await page.click(at, { settle })
}

/**
 * Quiet Cockpit, plug the virtual gamepad and let the vehicle default mapping arrive, which a fresh
 * test user gets on its first sync.
 * @param {object} ctx - Case context from the runner
 * @param {object} ctx.page - Driver page
 */
export async function joystickSetup({ page }) {
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
  await plugVirtualGamepad(page)
  await page.waitFor(() => page.store('controller', 's.joysticks.size > 0'), { label: 'Cockpit to see the gamepad' })
  // Cockpit learns the gamepad's layout from its first input, as a browser only reports a pad once it is touched.
  await setAxis(page, 0, 0.01)
  await page.wait(300)
  await setAxis(page, 0, 0)
  const mapped = () =>
    page.store(
      'controller',
      `Object.values(s.protocolMapping.axesCorrespondencies).some((c) => c.action.id !== 'no_function')`
    )
  await page.waitFor(mapped, { timeout: 15000 }).catch(() => undefined)
}

/**
 * Plug a second virtual gamepad of another model next to the first one.
 * @param {object} page - Driver page
 * @param {string} id - Gamepad id, which carries the model's vendor and product ids
 */
export async function plugSecondGamepad(page, id) {
  await page.eval(`(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }))
    window.__pad2 = { id: ${JSON.stringify(id)}, index: 1, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
      buttons, timestamp: performance.now(), vibrationActuator: null }
    navigator.getGamepads = () => [window.__pad, window.__pad2, null, null]
    window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: window.__pad2 }))
  })()`)
}

/**
 * Move a stick axis of a virtual gamepad and leave it there.
 * @param {object} page - Driver page
 * @param {number} axis - Standard-mapping axis index
 * @param {number} value - -1 to 1
 * @param {string} [pad] - Global holding the gamepad
 * @returns {Promise<void>} Once set
 */
export const setAxis = (page, axis, value, pad = '__pad') =>
  page.eval(`(() => { const p = window.${pad}; p.axes[${axis}] = ${value}; p.timestamp = performance.now() })()`)

/**
 * Hold a button of a virtual gamepad down, or let it go.
 * @param {object} page - Driver page
 * @param {number} button - Standard-mapping button index
 * @param {boolean} down - Pressed or not
 * @param {string} [pad] - Global holding the gamepad
 * @returns {Promise<void>} Once set
 */
export const setButton = (page, button, down, pad = '__pad') =>
  page.eval(
    `(() => { const p = window.${pad}; const b = p.buttons[${button}]; b.pressed = ${down}; b.value = ${
      down ? 1 : 0
    }; p.timestamp = performance.now() })()`
  )

/**
 * A data-lake variable's current value.
 * @param {object} page - Driver page
 * @param {string} id - Variable id
 * @returns {Promise<unknown>} Value
 */
export const lakeValue = (page, id) => page.eval(`window.cockpit.getDataLakeVariableData(${JSON.stringify(id)})`)

/**
 * Tools → Data-lake → Add variable: a number variable with its own id, kept only for this session.
 * @param {object} page - Driver page
 * @param {string} id - Variable ID
 * @param {string} name - Variable Name, which is how the joystick page lists it
 */
export async function createNumberVariable(page, id, name) {
  await openMenuPage(page, 'tools-datalake')
  await page.click('text=Add variable', { settle: 1200 })
  await page.fill(await fieldByLabel(page, 'Variable Name'), name)
  await clickExpr(page, `${topDialog}.querySelector('.mdi-pencil')?.closest('button')`, 'ID edit button', 400)
  await page.fill(await fieldByLabel(page, 'Variable ID'), id)
  await page.fill(await fieldByLabel(page, 'Initial Value'), '0')
  await page.click('text=Persist variable between boots', { settle: 400 })
  await clickDialogButton(page, 'Save', { settle: 1200 })
}

/**
 * The value cell of a variable's row on the Data-lake page.
 * @param {object} page - Driver page
 * @param {string} name - Variable name
 * @returns {Promise<string|null>} Shown value
 */
export const shownLakeValue = (page, name) =>
  page.eval(
    `[...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes(${JSON.stringify(
      name
    )}))?.querySelector('p.font-mono')?.textContent.trim() ?? null`
  )

/**
 * Settings → Joystick, on the Table or Visual tab.
 * @param {object} page - Driver page
 * @param {'Table'|'Visual'} [tab] - Tab to show
 */
export async function openJoystickPage(page, tab = 'Table') {
  await openMenuPage(page, 'settings-joystick')
  await page.click(`text=${tab}`, { settle: 1000 })
}

// A row of the axes or buttons table, by its Name cell ("axis 1", "button 4").
export const row = (kind, id) =>
  `[...document.querySelectorAll('tr')].find((r) => { const p = r.querySelectorAll('td:first-child p')
    return r.getClientRects().length && p.length === 2 && p[0].textContent.trim() === '${kind}' && p[1].textContent.trim() === '${id}' })`

/**
 * Pick the button layer (Regular or Shift) the table edits.
 * @param {object} page - Driver page
 * @param {'Regular'|'Shift'} layer - Layer
 * @returns {Promise<void>} Once picked
 */
export const chooseLayer = (page, layer) =>
  clickExpr(
    page,
    `[...document.querySelectorAll('.v-tabs button')].find((b) => b.textContent.trim() === '${layer}')`,
    `${layer} layer tab`
  )

const openButtonDialog = async (page, button) => {
  await clickExpr(
    page,
    `${row('button', button)}?.querySelector('.mdi-circle-edit-outline')?.closest('button')`,
    `edit button for button ${button}`,
    1200
  )
  await page.waitFor('text=Input mapping', { label: 'the input mapping dialog' })
}

/**
 * Table → "Map function to button" on a button row → search the function and pick it → Close.
 * @param {object} page - Driver page
 * @param {number} button - Button index
 * @param {string} name - Function name as listed
 */
export async function mapButton(page, button, name) {
  await openButtonDialog(page, button)
  await page.fill(`input[placeholder="Search actions..."]`, name)
  await page.wait(600)
  await clickExpr(
    page,
    `[...${topDialog}.querySelectorAll('button.action-button')].find((b) => b.textContent.trim() === ${JSON.stringify(
      name
    )})`,
    `"${name}" in the function list`
  )
  await clickDialogButton(page, 'Close', { settle: 800 })
}

/**
 * Table → "Map function to button" on a button row → "Assign as Shift" → Close.
 * @param {object} page - Driver page
 * @param {number} button - Button index
 */
export async function assignShift(page, button) {
  await openButtonDialog(page, button)
  await page.click('text=Assign as Shift', { settle: 800 })
  await clickDialogButton(page, 'Close', { settle: 800 })
}

/**
 * Edit an axis row of the table (Min, function, Max) and save it, along with any axis the function was
 * taken from, which the table holds as an edit of its own.
 * @param {object} page - Driver page
 * @param {number} axis - Axis index
 * @param {object} change - What to set
 * @param {string} [change.action] - Function name, as the Axis select lists it
 * @param {number} [change.min] - Min
 * @param {number} [change.max] - Max
 */
export async function editAxis(page, axis, { action, min, max }) {
  const cell = (n) => `${row('axis', axis)}?.querySelectorAll('td')[${n}]`
  if (min !== undefined) await typeInto(page, await centre(page, `${cell(3)}?.querySelector('input')`), min)
  if (action !== undefined) {
    await clickExpr(page, `${cell(4)}?.querySelector('.v-field')`, `function select of axis ${axis}`, 900)
    const item = `[...${topDialog}.querySelectorAll('.v-list-item')].find((i) => i.textContent.trim() === ${JSON.stringify(
      action
    )})`
    // The menu renders its items lazily: scroll it until the one wanted exists.
    for (let i = 0; i < 40 && !(await page.eval(`!!${item}`)); i++)
      await page.eval(`(() => { const l = ${topDialog}.querySelector('.v-list'); l.scrollTop += l.clientHeight })()`)
    await clickExpr(page, item, `"${action}" for axis ${axis}`)
  }
  if (max !== undefined) await typeInto(page, await centre(page, `${cell(5)}?.querySelector('input')`), max)
  await page.wait(500)
  const save = `[...document.querySelectorAll('button[aria-label="Save changes"]')].find((b) => !b.disabled && b.getClientRects().length)`
  for (let i = 0; i < 6 && (await page.eval(`!!${save}`)); i++) {
    await clickExpr(page, save, 'axis save button', 1000)
    if (await page.exists('text=Unusual axis range'))
      throw new Error(`axis ${axis}: Cockpit warns the range is unusual`)
  }
}

/**
 * An axis' saved mapping.
 * @param {object} page - Driver page
 * @param {number} axis - Axis index
 * @returns {Promise<{action: object, min: number, max: number}>} Mapping
 */
export const axisMapping = (page, axis) => page.store('controller', `s.protocolMapping.axesCorrespondencies[${axis}]`)

/**
 * A button's saved mapping on a layer.
 * @param {object} page - Driver page
 * @param {number} button - Button index
 * @param {'regular'|'shift'} [layer] - Layer
 * @returns {Promise<object>} The mapped action
 */
export const buttonAction = (page, button, layer = 'regular') =>
  page.store('controller', `s.protocolMapping.buttonsCorrespondencies.${layer}[${button}]?.action`)

/**
 * Settings → Joystick → Axis Calibration → Calibrate.
 * @param {object} page - Driver page
 */
export async function openCalibration(page) {
  await page.click('text=Calibrate', { settle: 1500 })
  await page.waitFor('text=Joystick Calibration', { label: 'the calibration dialog' })
}

/**
 * Tick or untick one of the calibration dialog's two checkboxes.
 * @param {object} page - Driver page
 * @param {'Deadband/Deadzone'|'Exponential Scaling'} label - Checkbox label
 * @param {boolean} on - Wanted state
 */
export async function setCalibrationOption(page, label, on) {
  const box = `[...${topDialog}.querySelectorAll('span')].find((s) => s.textContent.trim() === '${label}')?.previousElementSibling?.querySelector('input')`
  if ((await page.eval(`${box}?.checked`)) === on) return
  await clickExpr(page, box, `${label} checkbox`)
}

/**
 * Type an axis' deadband into its card in the calibration dialog.
 * @param {object} page - Driver page
 * @param {number} axis - Axis index
 * @param {number} value - 0 to 1
 * @returns {Promise<void>} Once typed
 */
export const setDeadband = async (page, axis, value) =>
  typeInto(page, await centre(page, `document.querySelector('input[aria-label="Deadband for axis ${axis}"]')`), value)

/**
 * Move an axis' exponential slider with the keyboard, 0.1 per arrow press, from where it is to `value`.
 * @param {object} page - Driver page
 * @param {number} axis - Axis index
 * @param {number} value - 1 to 5
 */
export async function setExponential(page, axis, value) {
  const card = `[...${topDialog}.querySelectorAll('.capitalize')].find((t) => t.textContent.trim() === 'axis ${axis}')?.parentElement`
  const thumb = `${card}?.querySelector('.v-slider-thumb')`
  await clickExpr(page, thumb, `exponential slider of axis ${axis}`, 400)
  const current = Number(await page.eval(`${thumb}.getAttribute('aria-valuenow')`))
  const steps = Math.round((value - current) * 10)
  for (let i = 0; i < Math.abs(steps); i++) await page.key(steps > 0 ? 'ArrowRight' : 'ArrowLeft', { show: i === 0 })
  await page.wait(500)
}

/**
 * The stored calibration of the virtual gamepad's model.
 * @param {object} page - Driver page
 * @returns {Promise<object|undefined>} Calibration
 */
export const calibration = (page) =>
  page.store('controller', `s.joystickCalibrationOptions[${JSON.stringify(PAD_MODEL)}]`)

/**
 * Keep the last MANUAL_CONTROL message Cockpit sends to the vehicle, read off its websocket.
 * @param {object} page - Driver page
 * @returns {Promise<{last: object|null, count: number}>} Live record
 */
export async function watchManualControl(page) {
  const sent = { last: null, count: 0 }
  page.on('Network.webSocketFrameSent', ({ response }) => {
    if (!response?.payloadData?.includes('MANUAL_CONTROL')) return
    try {
      const message = JSON.parse(response.payloadData).message
      if (message?.type !== 'MANUAL_CONTROL') return
      sent.last = message
      sent.count++
    } catch {
      // Not a JSON frame.
    }
  })
  await page.send('Network.enable')
  return sent
}

/**
 * Wait until `probe` holds, or `timeout` passes.
 * @param {object} page - Driver page
 * @param {Function} probe - Async predicate
 * @param {number} [timeout] - ms
 * @returns {Promise<boolean>} Whether it held
 */
export const settles = (page, probe, timeout = 5000) => page.waitFor(probe, { timeout }).catch(() => false)

export const AXIS_VARIABLE = { id: 'release-test/joy-axis', name: 'Joy axis' }

/**
 * Tools → Data-lake: add `release-test/joy-axis`, then Settings → Joystick → Table: map an axis to it.
 * Leaves the Joystick page open.
 * @param {object} page - Driver page
 * @param {number} axis - Axis index
 * @param {{min: number, max: number}} range - Min and Max of the mapping
 */
export async function mapAxisToVariable(page, axis, { min, max }) {
  await page.caption(`Tools → Data-lake → Add variable ${AXIS_VARIABLE.id}`)
  await createNumberVariable(page, AXIS_VARIABLE.id, AXIS_VARIABLE.name)
  await page.caption(`Settings → Joystick → Table: axis ${axis} → "${AXIS_VARIABLE.name}", Min ${min}, Max ${max}`)
  await openJoystickPage(page)
  await editAxis(page, axis, { min, action: AXIS_VARIABLE.name, max })
}

/**
 * Put an axis at each value in turn and read the variable it drives.
 * @param {object} page - Driver page
 * @param {number} axis - Axis index
 * @param {number[]} values - Axis positions
 * @returns {Promise<Array<unknown>>} The variable at each position
 */
export async function sweepAxis(page, axis, values) {
  const out = []
  for (const value of values) {
    await page.caption(`Axis ${axis} at ${value}`)
    await setAxis(page, axis, value)
    await page.wait(1200)
    out.push(await lakeValue(page, AXIS_VARIABLE.id))
  }
  await setAxis(page, axis, 0)
  return out
}

/**
 * Whether each value is within `tolerance` of what was expected.
 * @param {Array<unknown>} got - Values read
 * @param {number[]} want - Expected values
 * @param {number} [tolerance] - Allowed difference
 * @returns {{ok: boolean, detail: string}} Check result
 */
export const matches = (got, want, tolerance = 0.01) => ({
  ok: got.length === want.length && got.every((v, i) => typeof v === 'number' && Math.abs(v - want[i]) <= tolerance),
  detail: `got ${got.map((v) => (typeof v === 'number' ? Number(v.toFixed(3)) : v)).join(', ')}; expected ${want.join(
    ', '
  )}`,
})
