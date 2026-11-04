import { downloadCurrentSession, downloadsOf, LOGGER_DEFAULTS, LOGGER_KEYS, parseCsv } from '../lib/data-logs.mjs'
import { recordWith, setup } from '../lib/dl-case.mjs'

export { setup }

export const meta = {
  title: 'Column labels follow the export setting',
  route: '/',
  needs: ['vehicle'],
  synced: LOGGER_DEFAULTS,
  restore: LOGGER_KEYS,
}

const BOOT = '/mavlink/1/1/SYSTEM_TIME/time_boot_ms'
const SPEED = '/mavlink/1/1/VFR_HUD/groundspeed'

/**
 * Choose "Variable name" as column labels and download a CSV: the columns are the variables'
 * names as the data lake lists them (without a MAVLink variable's system suffix), not their IDs.
 */
export default async function run({ page, outDir, meta: { id } }) {
  await recordWith(page, { ids: [BOOT, SPEED], ms: 5000, labels: 'Variable name', what: 'columns labelled by name' })
  await page.caption('Download the current session as CSV')
  const { text } = await downloadCurrentSession(page, downloadsOf(outDir, id), 'CSV')
  const { columns } = parseCsv(text)
  const names = await page.eval(
    `[${JSON.stringify(BOOT)}, ${JSON.stringify(SPEED)}].map((id) => window.cockpit.getDataLakeVariableInfo(id)?.name)`
  )
  // MAVLink names end in the system they came from, "(MAVLink / System: 1 / Component: 1)", which the export leaves out.
  const expected = names.map((n) => n?.replace(/\s*\([^(]*\)$/, ''))
  await page.check('The columns are the variable names', () => ({
    ok: expected.every((n) => n && columns.includes(n)) && !columns.includes(BOOT) && !columns.includes(SPEED),
    detail: columns.join(' | '),
  }))
}
