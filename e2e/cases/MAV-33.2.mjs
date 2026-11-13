import { openCockpit } from '../lib/cockpit.mjs'
import { openMenuPage, recordDump } from '../lib/mavlink-tools.mjs'

export const meta = { title: 'Open a dump in the viewer and plot a field', route: '/', needs: ['vehicle'] }

let dump

/**
 * A 15 s dump file, recorded and downloaded before recording.
 */
export async function setup({ page, outDir, url }) {
  await openMenuPage(page, 'tools-mavlink')
  dump = await recordDump(page, outDir, 15)
  // The file comes from an earlier session, as it would for MAV-33.1's download.
  await page.restartBrowser()
  await openCockpit(page, { url, route: '/' })
}

/**
 * Load the dump file into the viewer and plot ATTITUDE/roll.
 */
export default async function run({ page }) {
  await page.caption('Main menu → Tools → MAVLink, "Load & plot dump"')
  await openMenuPage(page, 'tools-mavlink')
  await page.chooseFiles([dump], () => page.click('text=Load & plot dump', { settle: 300 }))
  await page.waitFor('text=Variables to plot', { timeout: 15000, label: 'the dump viewer' })
  // A click in the first moment after the viewer opens closes it again; give it the pause a person would.
  await page.wait(2500)
  await page.check('The viewer finds no invalid lines in a dump Cockpit wrote', async () => {
    const shown = (await page.text()).match(/Invalid lines:\s*([\d,]+)/)?.[1]
    return {
      ok: !shown || Number(shown.replace(/,/g, '')) === 0,
      detail: shown ? `${shown} invalid lines` : 'none flagged',
    }
  })
  await page.caption('Search "ATTITUDE/roll" and pick it')
  await page.click('.v-autocomplete input', { settle: 500 })
  await page.type('ATTITUDE/roll')
  await page.wait(800)
  const option = await page.eval(`(() => {
    const item = [...document.querySelectorAll('.v-overlay--active .v-list-item')]
      .find((e) => e.getClientRects().length && /ATTITUDE\\/roll$/.test(e.textContent.trim()))
    const r = item?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null })()`)
  if (!option) throw new Error('ATTITUDE/roll is not offered')
  await page.click(option, { settle: 600 })
  // Escape would close the whole viewer, so the dropdown is dismissed with a click on the plot.
  await page.click('canvas.cursor-crosshair', { settle: 600 })
  await page.wait(1500)
  await page.check('ATTITUDE/roll is plotted over time', async () => {
    const legend = await page.eval(`[...document.querySelectorAll('.text-xs.font-mono')]
      .map((e) => e.textContent.trim()).find((t) => / pts$/.test(t)) ?? ''`)
    const points = Number(legend.match(/([\d,.]+) pts$/)?.[1].replace(/[,.]/g, '') ?? 0)
    return { ok: points > 10, detail: legend || 'no series in the legend' }
  })
  await page.wait(2500)
}
