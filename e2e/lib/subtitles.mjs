// Settings → Telemetry ("On screen telemetry data") and the .ass subtitles file Cockpit writes
// next to every recording.

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { openMenuPage } from './mavlink-tools.mjs'
import { isRecording, recordButton } from './video.mjs'

const OPTIONS_KEY = 'cockpit-datalogger-overlay-options'
const GRID_KEY = 'cockpit-datalogger-overlay-grid'
const INTERVAL_KEY = 'cockpit-datalogger-log-interval'

// Cockpit's defaults (sensors-logging.ts, defaults.ts), so every case starts from the same overlay.
export const OVERLAY_DEFAULTS = {
  [OPTIONS_KEY]: {
    fontSize: 30,
    fontColor: '#FFFFFFFF',
    backgroundColor: '#000000FF',
    fontOutlineColor: '#000000FF',
    fontOutlineSize: 2,
    fontShadowColor: '#000000FF',
    fontShadowSize: 1,
    fontBold: false,
    fontItalic: false,
    fontUnderline: false,
    fontStrikeout: false,
  },
  [GRID_KEY]: {
    LeftTop: ['Date', 'Time'],
    CenterTop: [],
    RightTop: [],
    LeftMid: [],
    CenterMid: [],
    RightMid: [],
    LeftBottom: ['Pitch', 'Roll', 'Heading'],
    CenterBottom: ['Mode', 'Depth'],
    RightBottom: ['Battery voltage', 'Battery current'],
  },
  [INTERVAL_KEY]: 1000,
}

const centre = (page, expr) =>
  page.eval(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)

// The row of the options panel whose label reads `label`.
const row = (label) =>
  `[...document.querySelectorAll('span')].find((s) => s.getClientRects().length && s.textContent.trim() === ${JSON.stringify(
    label
  )})?.parentElement`

/**
 * Settings → Telemetry, with one of its panels expanded.
 * @param {object} page - Driver page
 * @param {string} panel - Panel title, e.g. "Overlay Options"
 */
export async function openTelemetryPanel(page, panel) {
  if (!(await page.exists('text=On screen telemetry data'))) await openMenuPage(page, 'Settings', 'Telemetry')
  await page.click(`text=${panel}`, { settle: 1200 })
}

/**
 * Type into the text field beside a label of the options panel.
 * @param {object} page - Driver page
 * @param {string} label - "Font size" or "Shadow size"
 * @param {string|number} value - New value
 */
export async function setOverlayField(page, label, value) {
  await page.fill(await centre(page, `${row(label)}.querySelector('input')`), value)
  await page.wait(600)
}

/**
 * Tick (or untick) Bold, Italic, Underline or Strikethrough.
 * @param {object} page - Driver page
 * @param {string} label - Checkbox label
 * @returns {Promise<void>} Once clicked
 */
export const toggleOverlayCheckbox = async (page, label) =>
  page.click(await centre(page, `${row(label)}.querySelector('input[type=checkbox]')`), { settle: 800 })

/**
 * Pick a colour for "Font color", "Outline color" or "Shadow color" in its colour picker, by RGB.
 * @param {object} page - Driver page
 * @param {string} label - Swatch label
 * @param {[number, number, number]} rgb - Red, green, blue
 */
export async function pickOverlayColor(page, label, rgb) {
  await page.click(await centre(page, `${row(label)}.querySelector('.rounded-full')`), { settle: 1200 })
  const inputs = `[...document.querySelectorAll('.v-overlay--active .v-color-picker-edit input')]`
  for (const [i, value] of rgb.entries()) await page.fill(await centre(page, `${inputs}[${i}]`), value)
  await page.key('Tab', { show: false })
  await page.wait(600)
  // A click beside the picker closes it; Escape would close the whole settings menu.
  await page.click('text=On screen telemetry data', { settle: 800 })
}

/**
 * Remove a variable from the overlay grid with its chip's X.
 * @param {object} page - Driver page
 * @param {string} name - Chip text, e.g. "Battery voltage"
 * @returns {Promise<void>} Once removed
 */
export const removeOverlayVariable = async (page, name) =>
  page.click(
    await centre(
      page,
      `[...document.querySelectorAll('#mocked-screen *')].find((e) => e.childElementCount <= 2 && e.textContent.trim() === ${JSON.stringify(
        name
      )} && e.querySelector('.mdi-close'))?.querySelector('.mdi-close')`
    ),
    { settle: 900 }
  )

/**
 * The names of the .ass files in Cockpit's video storage.
 * @param {object} page - Driver page
 * @returns {Promise<string[]>} File names
 */
export const assFiles = (page) =>
  page.eval(`(async () => (await document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('video')
    .videoStorage.keys()).filter((k) => k.endsWith('.ass')))()`)

/**
 * Record a few seconds with the mini recorder and return the .ass file that recording produced.
 * @param {object} page - Driver page
 * @param {number} seconds - Recording length
 * @returns {Promise<{name: string, text: string}|null>} The new file, or null when none appeared
 */
export async function recordAndReadAss(page, seconds) {
  const before = new Set(await assFiles(page))
  await page.click(await recordButton(page), { settle: 1000 })
  await page.waitFor(() => isRecording(page), { timeout: 10000, label: 'the recording to start' })
  await page.wait(seconds * 1000)
  await page.click(await recordButton(page), { settle: 1500 })
  let name
  await page
    .waitFor(
      async () => {
        name = (await assFiles(page)).find((f) => !before.has(f))
        return !!name
      },
      { timeout: 30000, label: 'the subtitles file' }
    )
    .catch(() => undefined)
  if (!name) return null
  const text =
    await page.eval(`(async () => { const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('video')
    return await (await s.videoStorage.getItem(${JSON.stringify(name)})).text() })()`)
  return { name, text }
}

/**
 * The parts of an .ass file the cases look at.
 * @param {string} text - File contents
 * @returns {{style: object, dialogues: Array<{start: number, style: string, text: string}>}} The first style and every dialogue line
 */
export function parseAss(text) {
  const format = text
    .match(/^Format: (Name,.*)$/m)[1]
    .split(',')
    .map((f) => f.trim())
  const values = text.match(/^Style: (.*)$/m)[1].split(',')
  const style = Object.fromEntries(format.map((f, i) => [f, values[i]]))
  const seconds = (t) => t.split(':').reduce((s, part) => s * 60 + Number(part), 0)
  const dialogues = [...text.matchAll(/^Dialogue: \d+,([^,]+),[^,]+,([^,]+),[^,]*,\d+,\d+,\d+,[^,]*,(.*)$/gm)].map(
    (m) => ({
      start: seconds(m[1]),
      style: m[2],
      text: m[3],
    })
  )
  return { style, dialogues }
}

/**
 * Show the head of an .ass file full screen for a moment.
 * @param {object} page - Driver page
 * @param {string} title - What it is
 * @param {string} text - File contents
 */
export async function showAss(page, title, text) {
  const lines = text
    .split('\n')
    .filter((l) => /^(Style: LeftBottom|Dialogue)/.test(l))
    .slice(0, 6)
    .map((l) => l.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])))
  await page.card(
    `<div style="font-family:Menlo,monospace;color:#e2e8f0;font-size:15px;max-width:90vw;white-space:pre-wrap;text-align:left">
      <div style="font-family:-apple-system,sans-serif;font-size:24px;opacity:.7;margin-bottom:16px">${title}</div>${lines.join(
      '\n'
    )}</div>`,
    5000
  )
}

/**
 * In Standalone, keep this case's recordings in the run folder instead of the operator's ~/Cockpit.
 * The setting lives in the throwaway profile, so it goes with it.
 * @param {object} ctx - Case context from the runner
 * @param {object} ctx.page - Driver page
 * @param {string} ctx.outDir - Run folder
 * @param {object} ctx.meta - Case meta
 */
export async function keepRecordingsInRun({ page, outDir, meta }) {
  if (!(await page.eval('!!window.electronAPI?.setCockpitFolderPath'))) return
  const dir = join(outDir, 'cockpit-folder', meta.id)
  mkdirSync(dir, { recursive: true })
  await page.eval(`window.electronAPI.setCockpitFolderPath(${JSON.stringify(dir)})`)
}
