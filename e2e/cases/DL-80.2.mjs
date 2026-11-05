import { openDataLake } from '../lib/act-dl.mjs'
import { mapPoint, toPlanning } from '../lib/cockpit.mjs'
import { setup } from '../lib/dl-case.mjs'
import { standaloneOnly } from '../lib/library.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'

export { setup }

export const meta = {
  title: "Standalone's Cockpit CPU usage rises while panning the map hard",
  route: '/',
  needs: ['vehicle', 'standalone'],
}

const CPU = 'cockpit-cpu-usage'
const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length

/**
 * Watch cockpit-cpu-usage at rest, then on Mission planning while the map is dragged hard back and
 * forth: the usage while panning is clearly above the usage at rest.
 */
export default async function run({ page }) {
  await standaloneOnly(page)
  await page.caption('Tools → Data-lake: "Cockpit CPU Usage (standalone)"')
  await openDataLake(page, 'Cockpit CPU Usage')
  await page.eval(`(() => { window.__cpu = []
    window.cockpit.listenDataLakeVariable(${JSON.stringify(CPU)}, (v) => window.__cpu.push([Date.now(), v])) })()`)
  await closeMenu(page)
  await toPlanning(page)
  await page.caption('At rest for 8 s')
  const restFrom = await page.eval('Date.now()')
  await page.wait(8000)
  await page.caption('Pan the map hard for 15 s')
  const panFrom = await page.eval('Date.now()')
  const [a, b] = [await mapPoint(page, 'planning', 0.25, 0.5), await mapPoint(page, 'planning', 0.75, 0.5)]
  while ((await page.eval('Date.now()')) - panFrom < 15000) {
    await page.drag(a, b, { duration: 250, settle: 0 })
    await page.drag(b, a, { duration: 250, settle: 0 })
  }
  const samples = await page.eval('window.__cpu')
  const rest = samples.filter(([t]) => t >= restFrom && t < panFrom).map(([, v]) => v)
  const panning = samples.filter(([t]) => t >= panFrom).map(([, v]) => v)
  await page.check('cockpit-cpu-usage rises while panning', () => ({
    ok: rest.length > 0 && panning.length > 0 && mean(panning) > mean(rest) + 5,
    detail: `at rest ${rest.length ? mean(rest).toFixed(1) : '-'} %, panning ${
      panning.length ? mean(panning).toFixed(1) : '-'
    } %`,
  }))
}
