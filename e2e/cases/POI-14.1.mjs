import { mapView, poiAt } from '../lib/cockpit.mjs'
import { checkPinTooltip, edgePins, panPoiAway, placeEdgePoi } from '../lib/poi-edge.mjs'

export const meta = {
  title: 'Off-screen POI shows an edge pin',
  route: '/',
  needs: ['vehicle'],
}

let poi

/**
 * One POI on the Map widget, placed before recording.
 */
export async function setup({ page }) {
  poi = await placeEdgePoi(page, 'widget')
}

/**
 * Pan the POI off the Map widget and show the edge pin pointing at it, with its name and distance.
 */
export default async function run({ page }) {
  await page.check('POI is on screen, no edge pin yet', async () => {
    const pins = await edgePins(page)
    return { ok: Boolean(await poiAt(page, 'widget', poi)) && pins.length === 0, detail: `${pins.length} pins` }
  })

  await page.caption('Pan the map until the point of interest is out of view')
  await panPoiAway(page, 'widget', poi)
  await page.check('POI is out of view', async () => !(await poiAt(page, 'widget', poi)))

  await page.caption('A pin on the edge points at it')
  await page.check('An edge pin appears on the side facing the POI', async () => {
    const pins = await edgePins(page)
    const { box } = await mapView(page, 'widget')
    const right = pins.find((p) => box.x + box.w - p.x < 80)
    return { ok: Boolean(right), detail: pins.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ') || 'none' }
  })

  await page.caption('Hovering it gives the name and how far it is')
  await checkPinTooltip(page, 'widget', poi)
  await page.wait(1500)
}
