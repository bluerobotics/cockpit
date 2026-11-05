import { blueos, lake, openDataLake, shownRow } from '../lib/act-dl.mjs'
import { setup } from '../lib/dl-case.mjs'

export { setup }

export const meta = {
  title: 'BlueOS CPU usage updates in the data lake',
  route: '/',
  needs: ['vehicle'],
}

const AVERAGE = 'blueos/cpu/usageAverage'

/**
 * Tools → Data-lake, search "BlueOS", and watch "BlueOS CPU Usage (average)" for 15 s: it changes,
 * stays a percentage, and tracks the mean of the per-CPU usage BlueOS itself reports.
 */
export default async function run({ page, vehicleHost }) {
  await page.caption('Tools → Data-lake, search "BlueOS"')
  await openDataLake(page, 'BlueOS CPU Usage')
  await page.caption('Watch "BlueOS CPU Usage (average)" for 15 s')
  const samples = []
  for (let i = 0; i < 10; i++) {
    const [shown, cpus] = await Promise.all([
      lake(page, AVERAGE),
      blueos(vehicleHost, '/system-information/system/cpu'),
    ])
    samples.push({ shown, truth: cpus.reduce((sum, c) => sum + c.usage, 0) / cpus.length })
    await page.wait(1500)
  }
  const shown = samples.map((s) => s.shown)
  await page.check('A 0–100 number that changes', () => ({
    ok: shown.every((v) => typeof v === 'number' && v >= 0 && v <= 100) && new Set(shown).size >= 2,
    detail: shown.map((v) => v?.toFixed?.(1) ?? v).join(', '),
  }))
  await page.check('Within 15 points of the mean usage BlueOS reports', () => {
    const gaps = samples.map((s) => Math.abs(s.shown - s.truth))
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
    return {
      ok: mean <= 15,
      detail: `mean gap ${mean.toFixed(1)}; last ${samples.at(-1).shown?.toFixed(1)} vs ${samples
        .at(-1)
        .truth.toFixed(1)}`,
    }
  })
  await page.check('The table shows it', async () => {
    const row = await shownRow(page, 'BlueOS CPU Usage (average)')
    return {
      ok: row?.source === 'BlueOS' && Number.isFinite(Number(row?.value)) && row.value !== '',
      detail: JSON.stringify(row),
    }
  })
}
