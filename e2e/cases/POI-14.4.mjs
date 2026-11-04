import { mapPoint, mapView, placePoi, poiAt, wheelZoom } from '../lib/cockpit.mjs'
import { edgePins, POI_NAME } from '../lib/poi-edge.mjs'

export const meta = { title: 'A left edge pin stays clear of the main-menu tab', route: '/', needs: ['vehicle'] }

let poi

/**
 * One POI left of the Map widget's centre at mid-height, level with the main-menu tab, before recording.
 */
export async function setup({ page }) {
  await wheelZoom(page, 'widget', 17)
  poi = await placePoi(page, 'widget', await mapPoint(page, 'widget', 0.25, 0.5), POI_NAME)
}

/**
 * Pan the POI off the left edge and check its pin is not hidden under the main-menu tab.
 */
export default async function run({ page }) {
  await page.caption('Pan the map left until the point of interest leaves the view')
  for (let i = 0; i < 8 && (await poiAt(page, 'widget', poi)); i++) {
    const from = await mapPoint(page, 'widget', 0.6, 0.86)
    const { box } = await mapView(page, 'widget')
    await page.drag(from, { dx: -box.w * 0.12, dy: 0 }, { duration: 700, settle: 500 })
  }
  await page.check('POI is out of view on the left', async () => !(await poiAt(page, 'widget', poi)))
  await page.check('Its edge pin is clear of the main-menu tab', async () => {
    const [pin] = await edgePins(page)
    const tab = await page.eval(`(() => { const r = document.getElementById('menu-trigger')?.getBoundingClientRect()
      return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null })()`)
    if (!pin || !tab) return { ok: false, detail: pin ? 'no menu tab' : 'no edge pin' }
    const radius = 14
    const overlaps =
      pin.x - radius < tab.right && pin.x + radius > tab.left && pin.y - radius < tab.bottom && pin.y + radius > tab.top
    return {
      ok: !overlaps,
      detail: `pin at ${Math.round(pin.y)} px, tab ${Math.round(tab.top)}–${Math.round(tab.bottom)} px`,
    }
  })
  await page.wait(2000)
}
