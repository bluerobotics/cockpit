import { openDataLake, shownRow } from '../lib/act-dl.mjs'
import { setup } from '../lib/dl-case.mjs'

export { setup }

export const meta = {
  title: "Cockpit's memory and frame rate update in the data lake",
  route: '/',
  needs: [],
}

// Each variable's writes (from the data lake's timestamps) and distinct values over `ms`.
const WATCH = (ids, ms) => `new Promise((resolve) => { const seen = {}; const t0 = Date.now()
  const tick = setInterval(() => {
    for (const id of ${JSON.stringify(ids)}) {
      seen[id] ??= { stamps: new Set(), values: [] }
      seen[id].stamps.add(window.cockpit.getDataLakeVariableLastUpdateTimestamp(id))
      seen[id].values.push(window.cockpit.getDataLakeVariableData(id))
    }
    if (Date.now() - t0 > ${ms}) { clearInterval(tick)
      resolve(Object.fromEntries(Object.entries(seen).map(([id, s]) => [id, { writes: s.stamps.size, values: s.values }]))) }
  }, 25) })`

/**
 * Tools → Data-lake, search "Cockpit", and watch "Cockpit Memory Usage" and "Cockpit App Frame
 * Rate" for 10 s: both are written about every 100 ms, memory is above zero and changes, and the
 * frame rate is a sane fps.
 */
export default async function run({ page }) {
  await page.caption('Tools → Data-lake, search "Cockpit"')
  await openDataLake(page, 'Cockpit')
  await page.caption('Watch "Cockpit Memory Usage" and "Cockpit App Frame Rate" for 10 s')
  const seen = await page.eval(WATCH(['cockpit-memory-usage', 'cockpit-app-frame-rate'], 10000))
  const memory = seen['cockpit-memory-usage']
  const fps = seen['cockpit-app-frame-rate']
  // The frame rate is written on the first frame after each 100 ms, so a page drawing 10 fps writes it every 200 ms.
  await page.check('Memory is written about every 100 ms, the frame rate on the first frame after that', () => ({
    ok: memory.writes >= 70 && fps.writes >= 40,
    detail: `memory ${memory.writes}, frame rate ${fps.writes} writes in 10 s`,
  }))
  await page.check('Memory is above 0 MB and changes', () => {
    const distinct = new Set(memory.values)
    return {
      ok: memory.values.every((v) => typeof v === 'number' && v > 0) && distinct.size >= 2,
      detail: `${distinct.size} distinct values, last ${memory.values.at(-1)?.toFixed?.(1)} MB`,
    }
  })
  await page.check('Frame rate stays between 1 and 200 fps', () => ({
    ok: fps.values.every((v) => typeof v === 'number' && v >= 1 && v <= 200),
    detail: `${Math.min(...fps.values)}–${Math.max(...fps.values)} fps`,
  }))
  await page.check('The table shows both with their units', async () => {
    const [m, f] = await Promise.all([shownRow(page, 'Cockpit Memory Usage'), shownRow(page, 'Cockpit App Frame Rate')])
    return {
      ok: m?.unit === 'MB' && f?.unit === 'fps' && m.value !== '' && f.value !== '',
      detail: `${m?.value} ${m?.unit}, ${f?.value} ${f?.unit}`,
    }
  })
}
