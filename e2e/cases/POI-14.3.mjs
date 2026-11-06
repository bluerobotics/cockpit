import { poiAt } from '../lib/cockpit.mjs'
import { checkPinPansBack, checkPinTooltip, edgePins, panPoiAway, placeEdgePoi } from '../lib/poi-edge.mjs'

export const meta = {
  title: 'Edge pin in mission planning',
  route: '/mission-planning',
  needs: ['vehicle'],
}

let poi

/**
 * One POI on the planning map, placed before recording.
 */
export async function setup({ page }) {
  poi = await placeEdgePoi(page, 'planning')
}

/**
 * Pan the POI off the planning map, read its edge pin, then click the pin to come back.
 */
export default async function run({ page }) {
  await page.caption('Pan the planning map until the point of interest is out of view')
  await panPoiAway(page, 'planning', poi)
  await page.check('POI out of view, its edge pin showing', async () => {
    const pins = await edgePins(page)
    return { ok: !(await poiAt(page, 'planning', poi)) && pins.length === 1, detail: `${pins.length} pins` }
  })
  await page.caption('Hovering it gives the name and how far it is')
  await checkPinTooltip(page, 'planning', poi)
  await page.caption('Clicking it brings the map back')
  await checkPinPansBack(page, 'planning', poi)
  await page.wait(1500)
}
