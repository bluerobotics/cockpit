import { downloadCurrentSession, downloadsOf, LOGGER_DEFAULTS, parseCsv } from '../lib/data-logs.mjs'
import { recordWith, setup } from '../lib/dl-case.mjs'

export { setup }

export const meta = {
  title: 'Raw logging records every value change',
  route: '/',
  needs: ['vehicle'],
  synced: LOGGER_DEFAULTS,
}

const STAMP = '/mavlink/1/1/ATTITUDE/time_boot_ms'

/**
 * In raw mode, record the ATTITUDE message's own timestamp: every message changes it, so the file
 * should hold one row per message, each with a new stamp, far denser than the 1 s default.
 */
export default async function run({ page, outDir, meta: { id } }) {
  await recordWith(page, { ids: [STAMP], ms: 8000, interval: 'raw', what: 'raw, on every value change' })
  await page.caption('Download the current session as CSV')
  const { text } = await downloadCurrentSession(page, downloadsOf(outDir, id), 'CSV')
  const { rows } = parseCsv(text)
  const stamps = rows.map((r) => Number(r[STAMP]))
  const seconds = (Number(rows.at(-1)?.epoch) - Number(rows[0]?.epoch)) / 1000
  await page.check('Every row is a new ATTITUDE message', () => ({
    ok: stamps.length > 1 && stamps.every((s, i) => i === 0 || s > stamps[i - 1]),
    detail: `${stamps.length} rows, stamps ${stamps[0]} … ${stamps.at(-1)}`,
  }))
  await page.check('Far more often than once a second', () => ({
    ok: rows.length / seconds >= 3,
    detail: `${(rows.length / seconds).toFixed(1)} rows per second over ${seconds.toFixed(1)} s`,
  }))
}
