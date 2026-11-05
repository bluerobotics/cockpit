import { blueos, lake, openDataLake } from '../lib/act-dl.mjs'
import { setup } from '../lib/dl-case.mjs'

export { setup }

export const meta = {
  title: 'BlueOS network counters update in the data lake',
  route: '/',
  needs: ['vehicle'],
}

/**
 * Tools → Data-lake, search "BlueOS network": the active interface's total received MB rises and
 * matches the counter BlueOS reports.
 */
export default async function run({ page, vehicleHost }) {
  await page.caption('Tools → Data-lake, search "BlueOS network"')
  await openDataLake(page, 'BlueOS network')
  const ids = await page.eval(
    `Object.keys(window.cockpit.getAllDataLakeVariablesInfo()).filter((id) => /^blueos\\/network\\/.+\\/totalReceivedMB$/.test(id))`
  )
  await page.check('A total-received variable per interface', () => ({ ok: ids.length > 0, detail: ids.join(', ') }))
  if (!ids.length) return
  const read = () => Promise.all(ids.map((id) => lake(page, id)))
  const first = await read()
  await page.caption('Watch the totals for 15 s')
  await page.wait(15000)
  const last = await read()
  // The active interface is the one that carried traffic in the meantime.
  const active = last.reduce((best, v, i) => (v - first[i] > last[best] - first[best] ? i : best), 0)
  const name = ids[active].split('/')[2]
  await page.check(`Total received on ${name} rises`, () => ({
    ok: typeof last[active] === 'number' && last[active] > first[active],
    detail: `${first[active]?.toFixed?.(3)} → ${last[active]?.toFixed?.(3)} MB`,
  }))
  const [truth, shown] = await Promise.all([
    blueos(vehicleHost, '/system-information/system/network'),
    lake(page, ids[active]),
  ])
  const bytes = truth.find((n) => n.name === name)?.total_received_B
  await page.check('It matches the counter BlueOS reports (within 1 MB)', () => ({
    ok: bytes !== undefined && Math.abs(bytes / 1024 / 1024 - shown) <= 1,
    detail: `data lake ${shown?.toFixed?.(3)} MB, BlueOS ${
      bytes === undefined ? '-' : (bytes / 1024 / 1024).toFixed(3)
    } MB`,
  }))
}
