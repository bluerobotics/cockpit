import { vehicleOnline } from '../lib/cockpit.mjs'
import { openDataLake, setup } from '../lib/prf.mjs'

export { setup }

export const meta = {
  title: 'Memory stays under 750 MB during the first minute',
  route: '/',
  needs: ['vehicle'],
}

const LIMIT_MB = 750
const VARIABLES = ['cockpit-memory-usage', 'cockpit-main-memory', 'cockpit-renderers-memory', 'cockpit-gpu-memory']

/**
 * Reload Cockpit, which starts it from a cold JS heap, and read cockpit-memory-usage every second for its
 * first 60 s with Tools → Data-lake showing the memory rows. On the web build that number is the renderer's
 * JS heap; on Standalone it is the total of all its processes, with the per-process split beside it.
 */
export default async function run({ page }) {
  await page.caption('Start Cockpit again from a cold start')
  await page.reload()
  await page.waitFor(() => page.eval(`!!window.cockpit && !!document.querySelector('#app')?.__vue_app__`), {
    label: 'Cockpit to mount',
  })
  // Sampled inside the page from the moment it mounts, so the first seconds count while the case navigates.
  await page.eval(`(() => { window.__memory = []; const read = () => window.__memory.push({ t: performance.now(),
    ...Object.fromEntries(${JSON.stringify(VARIABLES)}.map((id) => [id, window.cockpit.getDataLakeVariableData(id)])) })
    read(); setInterval(read, 1000) })()`)
  await page.caption('Tools → Data-lake, search "memory"')
  await openDataLake(page, 'memory').catch(() => undefined)
  let online = false
  for (;;) {
    const t = await page.eval('performance.now()')
    online ||= await vehicleOnline(page)
    if (t >= 61000) break
    const usage = await page.eval(`window.cockpit.getDataLakeVariableData('cockpit-memory-usage')`)
    await page.caption(
      `${Math.round(t / 1000)} s after start: ${typeof usage === 'number' ? usage.toFixed(0) : usage} MB`
    )
    await page.wait(1000)
  }
  const samples = (await page.eval('window.__memory')).filter((s) => s.t <= 60000)
  const usage = samples.map((s) => s['cockpit-memory-usage']).filter((v) => typeof v === 'number')
  const max = Math.max(...usage)
  const electron = await page.eval('!!window.electronAPI')
  const split = electron
    ? `; per process, max ${VARIABLES.slice(1)
        .map((id) => `${id.replace('cockpit-', '')} ${Math.round(Math.max(...samples.map((s) => s[id] ?? 0)))} MB`)
        .join(', ')}`
    : ''
  await page.check('The vehicle connected during the minute', () => ({ ok: online }))
  await page.check(`cockpit-memory-usage stays under ${LIMIT_MB} MB for the first 60 s`, () => ({
    ok: usage.length >= 30 && max < LIMIT_MB,
    detail: `${electron ? 'Standalone, all processes' : 'web, renderer JS heap'}: max ${max.toFixed(0)} MB over ${
      usage.length
    } samples${split}`,
  }))
}
