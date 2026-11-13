// The data-lake raw logger as the DL cases drive it: picking variables to record under Tools →
// Data-lake, the export settings and session downloads under Tools → Data Logs, and reading the
// downloaded files back.

import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { openMenuPage } from './mavlink-tools.mjs'

// Nothing recorded and the export defaults, so a session holds only what a case picks.
export const LOGGER_DEFAULTS = {
  'cockpit-data-lake-recorded-variables': [],
  'cockpit-data-lake-log-interval': 1000,
  'cockpit-data-lake-export-variable-key': 'id',
}

const centre = (page, expr) =>
  page.eval(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)

/**
 * Tools → Data-lake: find each variable by its ID and tick its Record box.
 * @param {object} page - Driver page
 * @param {string[]} ids - Data-lake variable IDs, e.g. /mavlink/1/1/SYSTEM_TIME/time_boot_ms
 */
export async function recordVariables(page, ids) {
  await openMenuPage(page, 'tools-datalake')
  for (const id of ids) {
    // The table shows names; a MAVLink variable's name is its message/field plus the system it came from.
    const short = id.split('/').slice(-2).join('/')
    await page.fill('input[placeholder="Search variables..."]', short)
    await page.wait(1200)
    const box = `[...document.querySelectorAll('tbody tr')].find((r) => r.innerText.trim().startsWith(${JSON.stringify(
      `${short} (MAVLink`
    )}))?.querySelector('.record-checkbox input')`
    if (!(await page.eval(`${box}?.checked`))) await page.click(await centre(page, box), { settle: 800 })
  }
}

/**
 * Tools → Data Logs.
 * @param {object} page - Driver page
 * @returns {Promise<void>} Once the page is open
 */
export const openDataLogs = (page) => openMenuPage(page, 'tools-logs')

/**
 * Open the export settings (the cog), choose the options given, and close.
 * @param {object} page - Driver page
 * @param {object} options - Choices
 * @param {string} [options.labels] - "Variable ID", "Short variable ID" or "Variable name"
 * @param {number|'raw'} [options.interval] - Fixed interval in ms, or raw
 */
export async function setExportOptions(page, { labels, interval }) {
  // The only cog on screen; the edit menu keeps others parked off to the left.
  const cog = `[...document.querySelectorAll('.mdi-cog')].find((c) => c.getBoundingClientRect().x > 0)`
  await page.click(await centre(page, cog), { settle: 1200 })
  if (labels) await page.click(`text=${labels}`, { settle: 700 })
  if (interval === 'raw') await page.click('text=Raw (record on every value change)', { settle: 700 })
  else if (interval) {
    await page.click('text=Fixed interval', { settle: 700 })
    await page.fill(
      await centre(page, `[...document.querySelectorAll('.v-overlay--active input[type=number]')].at(-1)`),
      interval
    )
    await page.wait(700)
  }
  await page.click('text=Close', { settle: 1200 })
}

/**
 * Download the current session from its row's download menu, as the given format.
 * @param {object} page - Driver page
 * @param {string} dir - Where the file lands
 * @param {'JSON'|'CSV'} format - Format
 * @returns {Promise<{file: string, text: string}>} The downloaded file and its contents
 */
export async function downloadCurrentSession(page, dir, format) {
  mkdirSync(dir, { recursive: true })
  await page.waitFor(() => page.exists('.current-session-indicator'), { label: 'the current session', timeout: 15000 })
  const file = await page.download(dir, async () => {
    await page.click(
      await centre(
        page,
        `document.querySelector('.current-session-indicator').closest('tr').querySelector('.mdi-download')`
      ),
      { settle: 900 }
    )
    await page.click(`text=Download as ${format}`, { settle: 500 })
  })
  return { file, text: readFileSync(file, 'utf8') }
}

/**
 * Parse the logger's CSV: a header line, then one line per point. Values never hold commas here.
 * @param {string} text - CSV
 * @returns {{columns: string[], rows: Array<object>}} Columns and rows keyed by column
 */
export function parseCsv(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/)
  const columns = head.split(',').map((c) => c.replace(/^"|"$/g, ''))
  const rows = lines.map((line) =>
    Object.fromEntries(line.split(',').map((v, i) => [columns[i], v.replace(/^"|"$/g, '')]))
  )
  return { columns, rows }
}

/**
 * Median gap between consecutive epochs, in ms.
 * @param {number[]} epochs - Epochs
 * @returns {number} Median step
 */
export function medianStep(epochs) {
  const steps = epochs
    .slice(1)
    .map((e, i) => e - epochs[i])
    .sort((a, b) => a - b)
  return steps[Math.floor(steps.length / 2)] ?? NaN
}

export const downloadsOf = (outDir, id) => join(outDir, 'downloads', id)
