import { dismissTutorial } from '../lib/cockpit.mjs'
import {
  downloadCurrentSession,
  downloadsOf,
  LOGGER_DEFAULTS,
  LOGGER_KEYS,
  medianStep,
  openDataLogs,
  parseCsv,
  recordVariables,
  setExportOptions,
} from '../lib/data-logs.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'

export const meta = {
  title: 'Record chosen variables at a fixed interval and download them as CSV',
  route: '/',
  needs: ['vehicle'],
  synced: LOGGER_DEFAULTS,
  restore: LOGGER_KEYS,
}

export const setup = async ({ page }) => {
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
}

const BOOT = '/mavlink/1/1/SYSTEM_TIME/time_boot_ms'
const SPEED = '/mavlink/1/1/VFR_HUD/groundspeed'

/**
 * Log every 500 ms, record the vehicle's boot clock and its groundspeed, wait, and download the
 * session as CSV: those two columns, one row per 500 ms, and a clock that matches the vehicle's.
 */
export default async function run({ page, vehicle, outDir, meta: { id } }) {
  await page.caption('Tools → Data Logs → export settings: a fixed 500 ms interval')
  await openDataLogs(page)
  await setExportOptions(page, { interval: 500 })
  await page.caption('Tools → Data-lake: record the boot clock and the groundspeed')
  await recordVariables(page, [BOOT, SPEED])
  await page.caption('Let it record for a while')
  await page.wait(10000)

  await page.caption('Tools → Data Logs: download the current session as CSV')
  await openDataLogs(page)
  const { file, text } = await downloadCurrentSession(page, downloadsOf(outDir, id), 'CSV')
  const vehicleBoot = (await vehicle.read('SYSTEM_TIME'))?.time_boot_ms
  const { columns, rows } = parseCsv(text)
  await page.caption(`Downloaded ${file.split('/').at(-1)}`)
  await page.check('Columns: epoch, timestamp and the two recorded variables', () => ({
    ok:
      columns.length === 4 &&
      columns[0] === 'epoch' &&
      columns[1] === 'timestamp' &&
      columns.includes(BOOT) &&
      columns.includes(SPEED),
    detail: columns.join(', '),
  }))
  const epochs = rows.map((r) => Number(r.epoch))
  await page.check('A row every 500 ms', () => {
    const step = medianStep(epochs)
    return {
      ok: rows.length >= 15 && Math.abs(step - 500) <= 60,
      detail: `${rows.length} rows, median step ${step} ms`,
    }
  })
  await page.check("The boot clock column keeps up with the vehicle's own", () => {
    const clocks = rows.map((r) => Number(r[BOOT]))
    const rising = clocks.every((c, i) => i === 0 || c >= clocks[i - 1])
    const lag = vehicleBoot - clocks.at(-1)
    return {
      ok: rising && lag >= 0 && lag < 5000,
      detail: `last logged ${clocks.at(-1)} ms, vehicle now ${vehicleBoot} ms`,
    }
  })
  // The clock was ticked first, so the rows before the groundspeed was ticked have no value for it.
  const fromSpeed = rows.slice(rows.findIndex((r) => r[SPEED] !== ''))
  await page.check('Once recorded, every row has a groundspeed number', () => ({
    ok: fromSpeed.length >= 10 && fromSpeed.every((r) => Number.isFinite(Number(r[SPEED])) && r[SPEED] !== ''),
    detail: `${fromSpeed.length} rows, last ${fromSpeed
      .slice(-2)
      .map((r) => r[SPEED])
      .join(', ')}`,
  }))
}
