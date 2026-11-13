// Input elements (button, switch, slider...) and mini widgets as the INP, CONT and SNAP cases place them in edit
// mode: in a container from "Add new container", in the top and bottom bars or in a Mini Widgets Bar, and wired to
// data-lake variables through the element's side panel. Also the snapshot tool and the files it stores.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { dismissTutorial, fieldByLabel } from './cockpit.mjs'
import { elementHandle } from './custom-widget.mjs'
import { dismissFeaturesDialog } from './extensions.mjs'
import { openMenuPage } from './mavlink-tools.mjs'
import { dismissRoutesDialog } from './widgets.mjs'

// The user variables and widget values these cases create, emptied before a case and put back after it, so a
// variable made by one case does not make the next one's "create" fail as already taken.
export const INPUT_SYNCED = {
  'cockpit-persistent-data-lake-variables': [],
  'cockpit-persistent-data-lake-values': {},
  'cockpit-mini-widget-last-values': {},
}

/**
 * Close the start-up dialogs every case meets.
 * @param {object} ctx - Case context from the runner
 * @param {object} ctx.page - Driver page
 */
export async function quietStart({ page }) {
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
}

/**
 * Centre of the element `expr` evaluates to, scrolled into view first (palette cards sit in a scrolling row).
 * @param {object} page - Driver page
 * @param {string} expr - JS expression for the element
 * @returns {Promise<{x: number, y: number}|null>} Viewport point
 */
export const centreOf = (page, expr) =>
  page.eval(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: 'nearest', inline: 'center' })
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)

/**
 * Pick the edit menu's widget type: Regular, Mini or Input.
 * @param {object} page - Driver page
 * @param {'Regular'|'Mini'|'Input'} mode - Palette
 * @returns {Promise<void>}
 */
export const paletteMode = (page, mode) => page.click(`text=${mode}`, { settle: 1000 })

/**
 * Drag a Mini or Input palette card by its handle and drop it at `at`.
 * @param {object} page - Driver page
 * @param {string} name - Card label, e.g. "Switch" or "Very Generic Indicator"
 * @param {{x: number, y: number}} at - Drop point
 */
export async function dropCard(page, name, at) {
  const from = await centreOf(page, elementHandle(name))
  if (!from) throw new Error(`no "${name}" card in the palette`)
  await page.drag(from, at, { duration: 1000, settle: 1500 })
}

/**
 * Drop point in the middle section of the top or bottom bar.
 * @param {object} page - Driver page
 * @param {'top'|'bottom'} bar - Which bar
 * @returns {Promise<{x: number, y: number}|null>} Viewport point
 */
export const barDropPoint = (page, bar) =>
  centreOf(
    page,
    `[...document.querySelectorAll('.${bar}-bar')].find((b) => b.getClientRects().length)
      ?.querySelectorAll(':scope > ${bar === 'top' ? '.flex-1' : '.relative'}')[1]`
  )

const CONTAINERS = `s.currentView.widgets.filter((w) => w.component === 'CollapsibleContainer')`

/**
 * Input → "Add new container", and the drop points of its three rows.
 * @param {object} page - Driver page
 * @returns {Promise<Array<{x: number, y: number}>>} Row centres, top to bottom
 */
export async function addInputContainer(page) {
  await paletteMode(page, 'Input')
  await page.click('text=Add new container', { settle: 2000 })
  return containerRows(page)
}

/**
 * Drop points of the newest container's rows.
 * @param {object} page - Driver page
 * @returns {Promise<Array<{x: number, y: number}>>} Row centres, top to bottom
 */
export async function containerRows(page) {
  const name = await page.store('widget-manager', `${CONTAINERS}.at(-1)?.name`)
  const rows = await page.eval(`(() => {
    const title = [...document.querySelectorAll('p')].find((p) => p.textContent.trim() === ${JSON.stringify(
      name
    )} && p.getClientRects().length)
    const column = title?.closest('.rounded-lg.overflow-hidden')?.querySelector('.border-dashed')
    return [...(column?.children ?? [])].map((row) => { const r = row.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }) })()`)
  if (!rows.length) throw new Error(`no rows for the container "${name}"`)
  return rows
}

/**
 * Every element of the view's containers, as stored.
 * @param {object} page - Driver page
 * @returns {Promise<Array<object>>} Elements, with `row` naming the container row
 */
export const containerElements = (page) =>
  page.store(
    'widget-manager',
    `${CONTAINERS}.flatMap((w) => w.options.elementContainers.flatMap((c) => c.elements.map((e) => ({ ...e, row: c.name }))))`
  )

/**
 * The stored mini widget or element of `component`, wherever it was dropped: the bars, a Mini Widgets Bar or a
 * container. The newest one wins.
 * @param {object} page - Driver page
 * @param {string} component - Component name, e.g. "Switch"
 * @returns {Promise<object|undefined>} It, with `where` naming the bar or container
 */
export const placed = (page, component) =>
  page.store(
    'widget-manager',
    `(() => {
      const where = [
        ...s.currentMiniWidgetsProfile.containers.map((c) => ['top bar', c.widgets]),
        ...s.currentView.miniWidgetContainers.map((c) => ['bottom bar', c.widgets]),
        ...s.currentView.widgets.filter((w) => w.component === 'MiniWidgetsBar').map((w) => ['Mini Widgets Bar', w.options.miniWidgetsContainer?.widgets ?? []]),
        ...s.currentView.widgets.filter((w) => w.component === 'CollapsibleContainer')
          .flatMap((w) => w.options.elementContainers.map((c) => ['container', c.elements])),
      ]
      return where.flatMap(([at, list]) => list.filter((e) => e.component === ${JSON.stringify(
        component
      )}).map((e) => ({ ...e, where: at }))).at(-1) })()`
  )

/**
 * Centre of a placed element on screen, by its hash.
 * @param {object} page - Driver page
 * @param {string} hash - Element hash
 * @param {string} [inner] - Selector inside it to aim at instead
 * @returns {Promise<{x: number, y: number}|null>} Viewport point
 */
export const elementAt = (page, hash, inner) =>
  centreOf(
    page,
    `document.querySelector('[data-widget-hash="${hash}"]')${inner ? `?.querySelector(${JSON.stringify(inner)})` : ''}`
  )

// The element side panel on the right (InputElementConfig).
const PANEL = `[...document.querySelectorAll('.fixed.right-0')].find((e) => e.innerText.includes('Options') && e.getClientRects().length)`

/**
 * Click an element in edit mode to open its side panel.
 * @param {object} page - Driver page
 * @param {string} hash - Element hash
 */
export async function openElementPanel(page, hash) {
  await page.click(await elementAt(page, hash), { settle: 1200 })
  await page.waitFor(() => page.eval(`!!${PANEL}`), { timeout: 5000, label: 'the element panel' })
}

const panelButton = (text) =>
  `[...(${PANEL})?.querySelectorAll('button') ?? []].find((b) => b.innerText.trim().toLowerCase() === ${JSON.stringify(
    text
  )} && b.getClientRects().length)`

/**
 * In the open side panel: Actions → Data-lake variable → "create", type the name, "save".
 * @param {object} page - Driver page
 * @param {string} name - Variable name
 */
export async function createElementVariable(page, name) {
  await page.click(await centreOf(page, panelButton('create')), { settle: 800 })
  // The form's first text box is the name.
  const nameBox = `[...(${PANEL}).querySelectorAll('p')].find((p) => p.textContent.trim() === 'Name')?.parentElement.querySelector('input')`
  await page.fill(await centreOf(page, nameBox), name)
  await page.click(await centreOf(page, panelButton('save')), { settle: 1000 })
}

/**
 * In the open side panel: Actions → Data-lake variable → "select", and pick `name`.
 * @param {object} page - Driver page
 * @param {string} name - Variable name as listed
 */
export async function selectElementVariable(page, name) {
  await page.click(await centreOf(page, panelButton('select')), { settle: 800 })
  const select = `[...(${PANEL}).querySelectorAll('select')].find((s) => [...s.options].some((o) => o.text.trim() === ${JSON.stringify(
    name
  )}))`
  const at = await centreOf(page, select)
  if (!at) throw new Error(`no variable "${name}" to select`)
  await page.hover(at, 500)
  await page.eval(`(() => { const s = ${select}; s.selectedIndex = [...s.options].findIndex((o) => o.text.trim() === ${JSON.stringify(
    name
  )})
    s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.wait(800)
}

/**
 * In the open side panel: set the number option labelled `label` (e.g. "Min Value").
 * @param {object} page - Driver page
 * @param {string} label - Option label
 * @param {number} value - New value
 */
export async function setPanelNumber(page, label, value) {
  const box = `[...(${PANEL}).querySelectorAll('p')].find((p) => p.textContent.trim() === ${JSON.stringify(
    label
  )})?.parentElement.querySelector('input[type=number]')`
  await page.fill(await centreOf(page, box), value)
  await page.key('Tab', { show: false })
}

/**
 * In the open side panel: set the text option labelled `label` (e.g. "Label").
 * @param {object} page - Driver page
 * @param {string} label - Option label
 * @param {string} value - New text
 */
export async function setPanelText(page, label, value) {
  const box = `[...(${PANEL}).querySelectorAll('p')].find((p) => p.textContent.trim() === ${JSON.stringify(
    label
  )})?.parentElement.querySelector('input[type=text]')`
  await page.fill(await centreOf(page, box), value)
}

/**
 * Close the element side panel with its X.
 * @param {object} page - Driver page
 */
export async function closeElementPanel(page) {
  const close = `(${PANEL})?.querySelector('button .mdi-close')?.closest('button')`
  if (await page.eval(`!!${close}`)) await page.click(await centreOf(page, close), { settle: 800 })
}

/**
 * A data-lake variable's value, as Cockpit holds it.
 * @param {object} page - Driver page
 * @param {string} id - Variable id
 * @returns {Promise<string|number|boolean|undefined>} Value
 */
export const lakeValue = (page, id) => page.eval(`window.cockpit.getDataLakeVariableData(${JSON.stringify(id)})`)

/**
 * Tools → Data-lake, filtered to `search`: the value shown on the first row.
 * @param {object} page - Driver page
 * @param {string} search - Text for the search box
 * @returns {Promise<string|undefined>} The value cell's text
 */
export async function showInDataLake(page, search) {
  if (!(await page.exists('input[placeholder="Search variables..."]'))) await openMenuPage(page, 'tools-datalake')
  await page.fill('input[placeholder="Search variables..."]', search)
  await page.wait(1200)
  return page.eval(`document.querySelector('.v-data-table tbody tr td:nth-child(4)')?.innerText.trim()`)
}

/**
 * Tools → Data-lake → "Add variable": a user variable of `type` with an initial value.
 * @param {object} page - Driver page
 * @param {string} name - Variable name
 * @param {'String'|'Number'|'Boolean'} type - Type radio
 * @param {string} initial - Initial value as typed
 * @returns {Promise<string>} The id Cockpit gave it
 */
export async function addUserVariable(page, name, type, initial) {
  if (!(await page.exists('text=Add variable'))) await openMenuPage(page, 'tools-datalake')
  await page.click('text=Add variable', { settle: 1000 })
  await page.fill(await fieldByLabel(page, 'Variable Name'), name)
  await page.click(`text=${type}`, { settle: 400 })
  await page.fill(await fieldByLabel(page, 'Initial Value'), initial)
  const id = await page.eval(
    `[...document.querySelectorAll('.v-overlay--active .v-field')].find((f) => f.querySelector('label')?.textContent.trim() === 'Variable ID')?.querySelector('input').value`
  )
  await page.click('text=Save', { settle: 1200 })
  return id
}

/**
 * Tools → Data-lake: edit a user variable's value with its pencil.
 * @param {object} page - Driver page
 * @param {string} search - Text that finds it in the search box
 * @param {string} value - New value as typed
 */
export async function editUserVariable(page, search, value) {
  await showInDataLake(page, search)
  await page.click('.v-data-table tbody tr button[title="Edit"]', { settle: 1000 })
  await page.fill(await fieldByLabel(page, 'Initial Value'), value)
  await page.click('text=Save', { settle: 1200 })
}

// --- Snapshots ---------------------------------------------------------------------------------

// The web build keeps snapshots in IndexedDB, through localforage (libs/videoStorage.ts).
const SNAPSHOT_DB = ['Cockpit - Snapshots', 'cockpit-snapshots-db']

/**
 * Snapshots the web build holds: name, size, the first bytes as hex, and how the image decodes.
 * @param {object} page - Driver page
 * @returns {Promise<Array<{name: string, size: number, magic: string, width: number, height: number, luma: number}>>} One per file, `luma` the brightest of 64×48 cells
 */
export const storedSnapshots = (page) =>
  page.eval(`new Promise((resolve) => {
    const open = indexedDB.open(${JSON.stringify(SNAPSHOT_DB[0])})
    open.onerror = () => resolve([])
    open.onsuccess = () => {
      const db = open.result
      if (!db.objectStoreNames.contains(${JSON.stringify(SNAPSHOT_DB[1])})) return resolve([])
      const store = db.transaction(${JSON.stringify(SNAPSHOT_DB[1])}).objectStore(${JSON.stringify(SNAPSHOT_DB[1])})
      const out = []
      store.openCursor().onsuccess = async (e) => {
        const cursor = e.target.result
        if (cursor) { out.push([cursor.key, cursor.value]); cursor.continue(); return }
        resolve(await Promise.all(out.map(async ([name, blob]) => {
          const bytes = new Uint8Array(await blob.slice(0, 3).arrayBuffer())
          const magic = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
          let width = 0, height = 0, luma = 0
          try {
            const bmp = await createImageBitmap(blob); width = bmp.width; height = bmp.height
            // The brightest cell rather than the mean: a test pattern can be mostly black around a bright ball.
            const c = new OffscreenCanvas(64, 48).getContext('2d'); c.drawImage(bmp, 0, 0, 64, 48)
            const d = c.getImageData(0, 0, 64, 48).data
            for (let i = 0; i < d.length; i += 4) luma = Math.max(luma, Math.round((d[i] + d[i + 1] + d[i + 2]) / 3))
          } catch {}
          return { name, size: blob.size, magic, width, height, luma }
        })))
      }
    }
  })`)

/**
 * Put the snapshot tool in the bottom bar, the way the checklist's precondition asks, unless one is there.
 * @param {object} page - Driver page
 */
export async function ensureSnapshotTool(page) {
  await page.store(
    'widget-manager',
    `(() => { const bars = s.currentView.miniWidgetContainers
      if (bars.some((c) => c.widgets.some((w) => w.component === 'SnapshotTool'))) return true
      bars.find((c) => c.name === 'Bottom-left container').widgets
        .push({ hash: crypto.randomUUID(), component: 'SnapshotTool', name: 'SnapshotTool', options: {} })
      return true })()`
  )
  await page.wait(1000)
  await dismissRoutesDialog(page)
}

/**
 * The snapshot tool's camera button, and its trigger-type arrow.
 * @param {object} page - Driver page
 * @returns {Promise<{camera: {x: number, y: number}, arrow: {x: number, y: number}, play: {x: number, y: number}|null}>} Points
 */
export const snapshotToolButtons = async (page) => {
  const tool = `[...document.querySelectorAll('.mdi-camera')].find((i) => i.getClientRects().length)?.parentElement`
  return {
    camera: await centreOf(
      page,
      `[...document.querySelectorAll('.mdi-camera')].find((i) => i.getClientRects().length)`
    ),
    arrow: await centreOf(page, `(${tool})?.querySelector('.mdi-menu-up')`),
    play: await centreOf(page, `(${tool})?.querySelector('.mdi-play, .mdi-stop')`),
  }
}

/**
 * Open the snapshot tool's menu and click one of its entries.
 * @param {object} page - Driver page
 * @param {string} entry - "Open snapshot library", "Single capture" or "Timed multi-capture"
 */
export async function snapshotMenu(page, entry) {
  await page.click((await snapshotToolButtons(page)).arrow, { settle: 900 })
  await page.click(`text=${entry}`, { settle: 1500 })
}

/**
 * The file names the open snapshot library lists.
 * @param {object} page - Driver page
 * @returns {Promise<string[]>} Names
 */
export const libraryPictures = (page) =>
  page.eval(`[...document.querySelectorAll('.v-overlay--active div.truncate')].map((d) => d.textContent.trim())
    .filter((t) => t.endsWith('.jpeg'))`)

// The second stream the checklist captures beside STREAM (lib/video.mjs).
export const BALL_STREAM = 'PRTest Ball'

/**
 * A name as snapshotFilename writes it into a file name (sanitizeFilenameComponent in src/libs/utils.ts).
 * @param {string} name - Mission or stream name
 * @returns {string} The file-safe form
 */
export const fileSafe = (name) =>
  name
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[. ]+|[. ]+$/g, '')

/**
 * Edit interface → Bottom Bar → the snapshot tool's cog: its settings dialog.
 * @param {object} page - Driver page
 */
export async function openSnapshotSettings(page) {
  const cog = await centreOf(
    page,
    `[...document.querySelectorAll('#view-widgets-list p')].find((p) => p.textContent.trim() === 'SnapshotTool' && p.getClientRects().length)
      ?.parentElement.parentElement.querySelector('.mdi-cog')`
  )
  if (!cog) throw new Error('no snapshot tool in the bottom bar list')
  await page.click(cog, { settle: 1200 })
  await page.waitFor('text=Snapshot settings', { timeout: 5000 })
}

/**
 * In the snapshot settings dialog: the checkbox beside `label`.
 * @param {object} page - Driver page
 * @param {string} label - Text beside it
 * @returns {Promise<{x: number, y: number, checked: boolean, disabled: boolean}|null>} Where it is and its state
 */
export const snapshotSetting = (page, label) =>
  page.eval(`(() => { const p = [...document.querySelectorAll('.v-overlay--active p')].find((e) => e.textContent.trim().startsWith(${JSON.stringify(
    label
  )}))
    const input = p?.parentElement.querySelector('input[type=checkbox]'); if (!input) return null
    const r = input.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, checked: input.checked, disabled: input.disabled } })()`)

/**
 * Snapshots Standalone wrote under the Cockpit folder, which keepRecordingsInRun pointed into the run.
 * @param {object} ctx - Case context from the runner
 * @param {string} ctx.outDir - Run folder
 * @param {object} ctx.meta - Case meta
 * @returns {Array<{name: string, magic: string}>} One per file, with its first bytes as hex
 */
export function standaloneSnapshots({ outDir, meta }) {
  const dir = join(outDir, 'cockpit-folder', meta.id, 'snapshots')
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.jpeg'))
      .map((name) => ({ name, magic: readFileSync(join(dir, name)).subarray(0, 3).toString('hex') }))
  } catch {
    return []
  }
}
