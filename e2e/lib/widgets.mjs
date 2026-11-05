// Shared by the VIEW, WID and MINI cases: widgets placed through edit mode the way an operator places
// them, what their canvases draw, and the boat driven through RC override to make them move.

import { createServer } from 'node:http'
import process from 'node:process'

import { dismissTutorial } from './cockpit.mjs'
import { enterEditMode } from './custom-widget.mjs'
import { sleep } from './driver.mjs'
import { dismissFeaturesDialog } from './extensions.mjs'

export const VIEWS_KEY = 'cockpit-views-group-v1'
export const MINI_PROFILE_KEY = 'cockpit-mini-widgets-profile-v4'

export const quietStart = async ({ page }) => {
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
}

// Keeps what every canvas drew since it was last cleared whole, so a check can read the number a gauge
// shows rather than the value behind it. Read-only: the drawing still happens.
export const CANVAS_HOOK = `(() => { if (window.__e2eCanvasHook) return; window.__e2eCanvasHook = true
  const P = CanvasRenderingContext2D.prototype
  const fresh = () => ({ texts: [], rotates: [], rects: [] })
  const log = (ctx, kind, value) => { const f = (ctx.canvas.__e2e ||= fresh()); if (f[kind].length < 400) f[kind].push(value) }
  const wrap = (name, fn) => { const real = P[name]; P[name] = function (...a) { fn(this, a); return real.apply(this, a) } }
  wrap('clearRect', (ctx, [x, y, w, h]) => {
    if (x <= 0 && y <= 0 && w >= ctx.canvas.width && h >= ctx.canvas.height) ctx.canvas.__e2e = fresh() })
  wrap('fillText', (ctx, [t]) => log(ctx, 'texts', String(t)))
  wrap('rotate', (ctx, [a]) => log(ctx, 'rotates', a))
  wrap('fillRect', (ctx, r) => log(ctx, 'rects', r))
})()`

/**
 * Hook canvas drawing in this document and every later one.
 * @param {object} page - Driver page
 */
export async function hookCanvases(page) {
  await page.addScript(CANVAS_HOOK)
  await page.eval(CANVAS_HOOK)
}

const widgetEl = (hash) => `document.querySelector('[data-e2e-widget="${hash}"]')`

/**
 * What a widget's canvas drew in its last frame.
 * @param {object} page - Driver page
 * @param {string} hash - Widget hash, as returned by addRegularWidget
 * @returns {Promise<{texts: string[], rotates: number[], rects: number[][]}|null>} The frame
 */
export const canvasFrame = (page, hash) =>
  page.eval(`(() => { const c = ${widgetEl(hash)}?.querySelector('canvas'); return c?.__e2e ?? null })()`)

/**
 * A data-lake variable's value as Cockpit has it.
 * @param {object} page - Driver page
 * @param {string} id - Variable id
 * @returns {Promise<unknown>} The value
 */
export const lake = (page, id) => page.eval(`window.cockpit.getDataLakeVariableData(${JSON.stringify(id)})`)

export const centreOf = (page, expr) =>
  page.eval(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)

const viewWidgets = (page) => page.store('widget-manager', 's.currentView.widgets')

/**
 * Drag a card of the Regular widget palette onto the view (edit mode open), and tag the widget it
 * creates so later steps find its element.
 * @param {object} page - Driver page
 * @param {string} label - Card label as shown, e.g. "Compass HUD"
 * @param {{x: number, y: number}} at - Drop point
 * @returns {Promise<{hash: string, name: string}>} The new widget
 */
export async function addRegularWidget(page, label, at) {
  if (!(await page.exists(`[draggable=true]`))) await page.click('text=Regular', { settle: 800 })
  const before = new Set((await viewWidgets(page)).map((w) => w.hash))
  await page.eval(`document.querySelectorAll('.outerWidget').forEach((e) => (e.dataset.e2eOld = '1'))`)
  const card = await centreOf(
    page,
    `[...document.querySelectorAll('[draggable=true]')].find((e) => e.innerText.trim() === ${JSON.stringify(label)})`
  )
  if (!card) throw new Error(`no "${label}" card in the widget palette`)
  await page.drag(card, at, { html5: true, duration: 1200, settle: 2000 })
  const added = (await viewWidgets(page)).find((w) => !before.has(w.hash))
  if (!added) throw new Error(`dropping "${label}" added no widget`)
  await page.waitFor(() => page.eval(`!!document.querySelector('.outerWidget:not([data-e2e-old])')`), {
    label: `the ${label} widget to mount`,
  })
  await page.eval(
    `document.querySelector('.outerWidget:not([data-e2e-old])').dataset.e2eWidget = ${JSON.stringify(added.hash)}`
  )
  return { hash: added.hash, name: added.name }
}

/**
 * A widget of the current view, by hash.
 * @param {object} page - Driver page
 * @param {string} hash - Widget hash
 * @returns {Promise<object|undefined>} The widget as stored
 */
export const widgetByHash = async (page, hash) => (await viewWidgets(page)).find((w) => w.hash === hash)

/**
 * Open a widget's configuration with the cog of its row under "Widgets in <view>".
 * @param {object} page - Driver page
 * @param {string} name - Widget name as listed
 */
export async function openWidgetConfig(page, name) {
  const cog = await centreOf(
    page,
    `[...document.querySelectorAll('#view-widgets-list p')].find((p) => p.textContent.trim() === ${JSON.stringify(
      name
    )} && p.getClientRects().length)?.parentElement.querySelector('.mdi-cog')`
  )
  if (!cog) throw new Error(`no cog for the widget "${name}"`)
  await page.click(cog, { settle: 1500 })
}

const miniContainers = (page) =>
  page.store('widget-manager', 's.miniWidgetContainersInCurrentView.map((c) => ({ name: c.name, widgets: c.widgets }))')

/**
 * Where a mini widget sits, by hash.
 * @param {object} page - Driver page
 * @param {string} hash - Mini widget hash
 * @returns {Promise<{container: string, index: number, widget: object}|null>} Its container and place
 */
export async function findMiniWidget(page, hash) {
  for (const c of await miniContainers(page)) {
    const index = c.widgets.findIndex((w) => w.hash === hash)
    if (index !== -1) return { container: c.name, index, widget: c.widgets[index] }
  }
  return null
}

/**
 * Mini widgets of a type, wherever they are.
 * @param {object} page - Driver page
 * @param {string} component - Mini widget type, e.g. "BatteryIndicator"
 * @returns {Promise<Array<object>>} The widgets
 */
export const miniWidgetsOfType = async (page, component) =>
  (await miniContainers(page)).flatMap((c) => c.widgets.filter((w) => w.component === component))

/**
 * Drag a card of the Mini widget palette (edit mode open) into a bar container.
 * @param {object} page - Driver page
 * @param {string} label - Card label as shown, e.g. "Satellite Indicator"
 * @param {'top'|'bottom'} bar - Which bar
 * @param {number} slot - Container in that bar: 0 left, 1 centre, 2 right
 * @returns {Promise<string>} The new mini widget's hash
 */
export async function addMiniWidget(page, label, bar, slot) {
  await page.click('text=Mini', { settle: 1000 })
  const before = new Set((await miniContainers(page)).flatMap((c) => c.widgets.map((w) => w.hash)))
  const handle = await centreOf(
    page,
    `[...document.querySelectorAll('.palette-card')].find((e) => e.getClientRects().length &&
      e.querySelector('.palette-card-label')?.innerText.trim().toLowerCase() === ${JSON.stringify(
        label.toLowerCase()
      )})?.querySelector('.palette-card-handle')`
  )
  if (!handle) throw new Error(`no "${label}" card in the mini widget palette`)
  // Dropped at the inner end of the container, after the widgets already there.
  const target =
    await page.eval(`(() => { const list = document.querySelectorAll('.${bar}-bar .relative.flex.w-full.h-full')[${slot}]
    if (!list) return null; const r = list.getBoundingClientRect()
    return { x: ${slot === 2 ? 'r.x + 12' : 'r.right - 12'}, y: r.y + r.height / 2 } })()`)
  if (!target) throw new Error(`no container ${slot} in the ${bar} bar`)
  await page.drag(handle, target, { duration: 1200, settle: 1500 })
  const added = (await miniContainers(page)).flatMap((c) => c.widgets).find((w) => !before.has(w.hash))
  if (!added) throw new Error(`dropping "${label}" in the ${bar} bar added no mini widget`)
  return added.hash
}

/**
 * Open a mini widget's configuration with the cog of its row in the edit menu.
 * @param {object} page - Driver page
 * @param {string} hash - Mini widget hash
 */
export async function openMiniWidgetConfig(page, hash) {
  const where = await findMiniWidget(page, hash)
  if (!where) throw new Error(`no mini widget ${hash}`)
  const cog = await centreOf(
    page,
    `[...document.querySelectorAll('span')].find((s) => s.textContent.trim() === ${JSON.stringify(
      where.container
    )} && s.getClientRects().length)
      ?.nextElementSibling?.querySelectorAll('.mdi-cog')[${where.index}]`
  )
  if (!cog) throw new Error(`no cog for the mini widget in "${where.container}"`)
  await page.click(cog, { settle: 1500 })
}

/**
 * The element of a mini widget in a bar.
 * @param {string} hash - Mini widget hash
 * @returns {string} JS expression for it
 */
export const miniWidgetEl = (hash) => `document.querySelector('[data-widget-hash="${hash}"]')`

/**
 * Pick an item from the select or autocomplete labelled `label` in the open dialog, typing `search` first
 * when given (autocompletes filter as you type).
 * @param {object} page - Driver page
 * @param {string} label - Field label
 * @param {string|{prefix: string}} match - Item text, or how it starts
 * @param {string} [search] - Text to type into the field
 */
export async function pickItem(page, label, match, search) {
  const field = await centreOf(
    page,
    // Any open overlay: the topmost one can be a tooltip.
    `[...document.querySelectorAll('.v-overlay--active .v-field')]
      .find((f) => f.getClientRects().length && f.querySelector('label')?.textContent.trim().startsWith(${JSON.stringify(
        label
      )}))?.querySelector('input')`
  )
  if (!field) throw new Error(`no field labelled "${label}"`)
  if (search !== undefined) await page.fill(field, search)
  else await page.click(field, { settle: 900 })
  await page.wait(800)
  const test =
    typeof match === 'string'
      ? `(t) => t === ${JSON.stringify(match)}`
      : `(t) => t.startsWith(${JSON.stringify(match.prefix)})`
  const item = `[...document.querySelectorAll('.v-overlay--active .v-list-item')].find((i) => i.getClientRects().length && (${test})(i.innerText.trim()))`
  const at = await centreOf(page, item)
  if (!at) throw new Error(`no item for "${label}"`)
  await page.click(at, { settle: 900 })
}

/**
 * Click a button by its text in the topmost dialog.
 * @param {object} page - Driver page
 * @param {string} text - Button text, any case
 * @param {number} [settle] - ms to wait afterwards
 */
export async function dialogButton(page, text, settle = 1000) {
  const at = await centreOf(
    page,
    `[...document.querySelectorAll('.v-overlay--active button')]
      .findLast((b) => b.getClientRects().length && b.innerText.trim().toUpperCase() === ${JSON.stringify(
        text.toUpperCase()
      )})`
  )
  if (!at) throw new Error(`no "${text}" button in the dialog`)
  await page.click(at, { settle })
}

/**
 * Close the topmost dialog with Escape.
 * @param {object} page - Driver page
 * @returns {Promise<void>} Once it had time to close
 */
export const closeDialog = (page) => page.key('Escape').then(() => page.wait(800))

/**
 * Enter edit mode and add a regular widget on the right half of the view, then open its configuration.
 * @param {object} page - Driver page
 * @param {string} label - Palette card label
 * @param {object} [options] - Options
 * @param {boolean} [options.configure] - Open its cog afterwards
 * @param {{x: number, y: number}} [options.at] - Drop point; the right half of the view by default
 * @returns {Promise<{hash: string, name: string}>} The widget
 */
export async function placeWidget(page, label, { configure = false, at } = {}) {
  await enterEditMode(page)
  const drop = at ?? { x: page.width * 0.7, y: page.height * 0.35 }
  const widget = await addRegularWidget(page, label, drop)
  if (configure) await openWidgetConfig(page, widget.name)
  return widget
}

// --- driving -------------------------------------------------------------------------------

const MODES = { MANUAL: 0, HOLD: 4 }
const override = (vehicle, steering, throttle) =>
  vehicle.send({
    type: 'RC_CHANNELS_OVERRIDE',
    target_system: 1,
    target_component: 1,
    ...Object.fromEntries(Array.from({ length: 18 }, (_, i) => [`chan${i + 1}_raw`, 0])),
    chan1_raw: steering,
    chan3_raw: throttle,
  })

/**
 * Arm the boat in Manual, as the precondition of the driving cases.
 * @param {object} vehicle - Vehicle helpers
 */
export async function armInManual(vehicle) {
  await vehicle.command('MAV_CMD_DO_SET_MODE', [1, MODES.MANUAL])
  await sleep(800)
  for (let i = 0; i < 10 && !(await vehicle.isArmed()); i++) {
    await vehicle.command('MAV_CMD_COMPONENT_ARM_DISARM', [1])
    await sleep(1000)
  }
  if (!(await vehicle.isArmed())) throw new Error('the boat did not arm')
}

const wrap180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180

/**
 * Drive in a circle with the rudder over until the heading has turned `degrees`, then stop and let it
 * settle. RC override stands in for the operator's sticks.
 * @param {object} vehicle - Vehicle helpers
 * @param {number} degrees - How far to turn
 * @param {object} [options] - Options
 * @param {number} [options.timeout] - Give up after this many ms
 * @param {Function} [options.onTick] - Called about every 200 ms while turning
 * @returns {Promise<number>} Degrees actually turned
 */
export async function turnBy(vehicle, degrees, { timeout = 60000, onTick } = {}) {
  const heading = async () => (await vehicle.read('VFR_HUD'))?.heading
  let last = await heading()
  let turned = 0
  const end = Date.now() + timeout
  while (Math.abs(turned) < degrees && Date.now() < end) {
    await override(vehicle, 1900, 1750)
    await sleep(200)
    const now = await heading()
    if (now !== undefined && last !== undefined) turned += wrap180(now - last)
    last = now ?? last
    if (onTick) await onTick(turned)
  }
  await stopDriving(vehicle)
  return Math.abs(turned)
}

/**
 * Drive in circles, rudder over, for `ms`, then stop.
 * @param {object} vehicle - Vehicle helpers
 * @param {number} ms - How long
 * @param {Function} [onTick] - Called about every 200 ms
 */
export async function circleFor(vehicle, ms, onTick) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    await override(vehicle, 1900, 1750)
    await sleep(200)
    if (onTick) await onTick()
  }
  await stopDriving(vehicle)
}

/**
 * Drive straight at `throttle` for `ms`.
 * @param {object} vehicle - Vehicle helpers
 * @param {number} ms - How long
 * @param {number} [throttle] - Throttle PWM
 */
export async function driveStraight(vehicle, ms, throttle = 1900) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    await override(vehicle, 1500, throttle)
    await sleep(200)
  }
}

/**
 * Sticks centred for two seconds, then handed back.
 * @param {object} vehicle - Vehicle helpers
 */
export async function stopDriving(vehicle) {
  for (let i = 0; i < 10; i++) {
    await override(vehicle, 1500, 1500)
    await sleep(200)
  }
  await override(vehicle, 0, 0)
}

// --- a page for the IFrame widget -----------------------------------------------------------

/**
 * Serve one HTML page on a free local port and count the requests for it.
 * @param {string} text - What the page says, large
 * @returns {Promise<{url: string, hits: Array<{path: string, status: number}>, close: Function}>} Server handle
 */
export async function servePage(text) {
  const hits = []
  const server = createServer((req, res) => {
    hits.push({ path: req.url, status: 200 })
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(
      `<!doctype html><body style="margin:0;background:#14532d;color:#fff;font:bold 44px sans-serif;display:grid;place-items:center;height:100vh">${text}</body>`
    )
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  server.unref()
  return { url: `http://127.0.0.1:${server.address().port}/release-test`, hits, close: () => server.close() }
}

// --- views ---------------------------------------------------------------------------------

export const profileViews = (page) =>
  page.store(
    'widget-manager',
    's.currentProfile.views.map((v) => ({ hash: v.hash, name: v.name, visible: v.visible, widgets: v.widgets, miniWidgetContainers: v.miniWidgetContainers }))'
  )

/**
 * The row of a view in the edit menu's Views list, as a JS expression.
 * @param {string} name - View name
 * @returns {string} Expression for the row element
 */
export const viewRow = (name) =>
  `[...document.querySelectorAll('p.text-sm')].find((p) => p.textContent.trim() === ${JSON.stringify(
    name
  )} && p.getClientRects().length && p.parentElement.querySelector('.view-drag-handle'))?.parentElement`

/**
 * Edit mode → Views: + (new view), and name it in the dialog that opens.
 * @param {object} page - Driver page
 * @param {string} name - New view name
 */
export async function createView(page, name) {
  if (!(await page.store('widget-manager', 's.editingMode'))) await enterEditMode(page)
  await page.click('.mdi-plus-circle', { settle: 1500 })
  const input = await centreOf(
    page,
    `[...document.querySelectorAll('p')].find((p) => p.textContent.trim() === 'New view name' && p.getClientRects().length)
      ?.parentElement.querySelector('input')`
  )
  if (!input) throw new Error('no "New view name" field')
  await page.fill(input, name)
  await page.wait(400)
  await page.click('text=Save', { settle: 1500 })
}

/**
 * Create a (non-persistent) number variable in the data lake with a first value.
 * @param {object} page - Driver page
 * @param {string} id - Variable id
 * @param {string} name - Name shown in pickers
 * @param {number} value - First value
 * @returns {Promise<void>} Once created
 */
export const createNumberVariable = (page, id, name, value) =>
  page.eval(`window.cockpit.createDataLakeVariable({ id: ${JSON.stringify(id)}, name: ${JSON.stringify(name)},
    type: 'number' }, ${value})`)

/**
 * Set a data-lake variable.
 * @param {object} page - Driver page
 * @param {string} id - Variable id
 * @param {number|string} value - New value
 * @returns {Promise<void>} Once set
 */
export const setVariable = (page, id, value) =>
  page.eval(`window.cockpit.setDataLakeVariableData(${JSON.stringify(id)}, ${JSON.stringify(value)})`)

/**
 * Angular difference in degrees, 0 to 180.
 * @param {number} a - Degrees
 * @param {number} b - Degrees
 * @returns {number} Distance between them
 */
export const angleGap = (a, b) => Math.abs(wrap180(a - b))

/**
 * The vehicle's ATTITUDE in degrees, yaw on 0–360.
 * @param {object} vehicle - Vehicle helpers
 * @returns {Promise<{roll: number, pitch: number, yaw: number}|null>} Attitude
 */
export async function attitudeDegrees(vehicle) {
  const a = await vehicle.read('ATTITUDE')
  if (!a) return null
  const deg = (r) => (r * 180) / Math.PI
  return { roll: deg(a.roll), pitch: deg(a.pitch), yaw: (deg(a.yaw) + 360) % 360 }
}

/**
 * The statistics a Plotter draws under its plot, as numbers.
 * @param {object} page - Driver page
 * @param {string} hash - Plotter widget hash
 * @returns {Promise<Record<string, number>>} e.g. { Current: 1.2, Min: 0, Max: 2.5, Avg: 1.1 }
 */
export async function plotterStats(page, hash) {
  const texts = (await canvasFrame(page, hash))?.texts ?? []
  return Object.fromEntries(
    texts
      .map((t) => t.match(/^(Current|Min|Max|Avg|Median|Std Dev): (-?[\d.]+)$/))
      .filter(Boolean)
      .map((m) => [m[1], Number(m[2])])
  )
}

/**
 * Replace the code in one of the DIY widget's editors (dialog open).
 * @param {object} page - Driver page
 * @param {'html'|'js'|'css'} editor - Which editor
 * @param {string} code - New code, typed
 */
export async function typeDiyCode(page, editor, code) {
  const index = { html: 0, js: 1, css: 2 }[editor]
  const at = await centreOf(
    page,
    `document.querySelectorAll('.v-overlay--active .editor-container')[${index}]?.querySelector('.monaco-editor .view-lines')`
  )
  if (!at) throw new Error(`no ${editor} editor`)
  await page.click(at, { settle: 200 })
  await page.key(process.platform === 'darwin' ? 'Meta+a' : 'Control+a', { show: false })
  // Pasted (Ctrl+V) rather than typed: typed or inserted text goes through the HTML editor's auto-closing of
  // brackets and tags, which leaves a stray ">"; a paste is taken as is. Chrome's own paste never reaches a
  // CDP-driven page's clipboard, so the paste event is dispatched with the code on it.
  await page.key(process.platform === 'darwin' ? 'Meta+v' : 'Control+v', { show: true })
  await page.eval(`(() => { const data = new DataTransfer(); data.setData('text/plain', ${JSON.stringify(code)})
    document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })) })()`)
  await page.wait(500)
}

/**
 * The DIY widget's rendered element `#id`, as text and colour.
 * @param {object} page - Driver page
 * @param {string} hash - Widget hash
 * @param {string} id - Element id
 * @returns {Promise<{text: string, color: string}|null>} What it shows
 */
export const diyElement = (page, hash, id) =>
  page.eval(`(() => { const el = document.querySelector('[data-e2e-widget="${hash}"] #${id}')
    return el ? { text: el.textContent.trim(), color: getComputedStyle(el).color } : null })()`)

export const DIY = {
  html: '<div id="r">Release test</div>',
  js: "document.getElementById('r').textContent += ' OK'",
  css: '#r { color: red }',
}

/**
 * Type code into the open DIY configuration's editors, Apply and close it.
 * @param {object} page - Driver page
 * @param {{html?: string, js?: string, css?: string}} code - Code per editor; editors left out are kept
 */
export async function writeDiy(page, code) {
  for (const editor of ['html', 'js', 'css'])
    if (code[editor] !== undefined) await typeDiyCode(page, editor, code[editor])
  await dialogButton(page, 'Apply', 1500)
  await closeDialog(page)
}

/**
 * The text in one of the open DIY configuration's editors, as shown.
 * @param {object} page - Driver page
 * @param {'html'|'js'|'css'} editor - Which editor
 * @returns {Promise<string>} Its lines, joined with newlines
 */
export const diyEditorText = (page, editor) =>
  page.eval(`[...(document.querySelectorAll('.v-overlay--active .editor-container')[${
    { html: 0, js: 1, css: 2 }[editor]
  }]?.querySelectorAll('.view-line') ?? [])]
    .map((l) => l.textContent.replace(/\\u00a0/g, ' ')).join('\\n')`)

// --- Very Generic Indicator ----------------------------------------------------------------

/**
 * What a VGI in a bar shows.
 * @param {object} page - Driver page
 * @param {string} hash - Mini widget hash
 * @returns {Promise<{value: string, unit: string, label: string, icon: string}|null>} Its texts and icon class
 */
export const vgiShown = (page, hash) =>
  page.eval(`(() => { const el = ${miniWidgetEl(hash)}; if (!el) return null
    const spans = el.querySelectorAll('span.text-xl')
    return { value: spans[0]?.textContent.trim() ?? '', unit: spans[1]?.textContent.trim() ?? '',
      label: el.querySelector('span.text-sm')?.textContent.trim() ?? '',
      icon: [...(el.querySelector('.mdi, [class*="mdi-"]')?.classList ?? [])].find((c) => c.startsWith('mdi-')) ?? '' } })()`)

/**
 * Edit mode → Mini: drag a Very Generic Indicator into the bottom bar, open its config and apply a preset.
 * @param {object} page - Driver page
 * @param {string} [preset] - Preset name to click, or none to stay on the config
 * @returns {Promise<string>} The VGI's hash
 */
export async function addVgi(page, preset) {
  await enterEditMode(page)
  const hash = await addMiniWidget(page, 'Very Generic Indicator', 'bottom', 0)
  // A mini widget dropped from the palette opens its configuration by itself.
  const open = () => page.exists('.v-overlay--active .v-tab')
  if (!(await page.waitFor(open, { timeout: 3000 }).catch(() => false))) await openMiniWidgetConfig(page, hash)
  if (preset) {
    await page.click('text=Presets', { settle: 800 })
    const at = await centreOf(
      page,
      `[...document.querySelectorAll('.v-overlay--active .cursor-pointer')].find((e) =>
        e.querySelector('span.text-sm')?.textContent.trim() === ${JSON.stringify(preset)})`
    )
    if (!at) throw new Error(`no preset "${preset}"`)
    await page.click(at, { settle: 1000 })
  }
  return hash
}

const ROUTES_NOTICE = 'text=Preferred video stream routes fetched from BlueOS.'

/**
 * Add a Video Player in edit mode and open its config, closing the notice the video store raises once it
 * fetched the vehicle's stream routes, which would otherwise sit over the config.
 * @param {object} page - Driver page
 * @returns {Promise<{hash: string, name: string}>} The widget
 */
export async function placeVideoWidget(page) {
  const widget = await placeWidget(page, 'Video Player')
  if (await page.waitFor(() => page.exists(ROUTES_NOTICE), { timeout: 10000 }).catch(() => false)) {
    await dialogButton(page, 'Close', 1000)
  }
  await openWidgetConfig(page, widget.name)
  return widget
}
