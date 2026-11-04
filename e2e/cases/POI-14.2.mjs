import { checkPinPansBack, edgePins, panPoiAway, placeEdgePoi } from '../lib/poi-edge.mjs'

export const meta = {
  title: 'Clicking the edge pin pans back to the POI',
  route: '/',
  needs: ['vehicle'],
}

let poi

/**
 * A POI on the Map widget, already panned out of view so its edge pin shows.
 */
export async function setup({ page }) {
  poi = await placeEdgePoi(page, 'widget')
  await panPoiAway(page, 'widget', poi)
}

/**
 * Click the edge pin and show the map coming back to the POI.
 */
export default async function run({ page }) {
  await page.caption('The point of interest is off the map; its pin is on the edge')
  await page.check('Edge pin is showing', async () => (await edgePins(page)).length === 1)
  await page.caption('Click the pin')
  await checkPinPansBack(page, 'widget', poi)
  await page.wait(1500)
}
