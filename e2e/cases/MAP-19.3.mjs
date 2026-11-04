import { mapPoint, placePoi, poiMarkers, wheelZoom } from '../lib/cockpit.mjs'
import { armVehicle, confirmSlider, waitArrival } from '../lib/mission.mjs'

export const meta = { title: 'GoTo a point of interest', route: '/', needs: ['vehicle'] }

let poi

/**
 * A POI ~60 m away on the Map widget, and the simulator armed, before recording.
 */
export async function setup({ page, vehicle }) {
  await wheelZoom(page, 'widget', 18)
  poi = await placePoi(page, 'widget', await mapPoint(page, 'widget', 0.62, 0.38), 'GoTo buoy')
  await armVehicle(vehicle)
}

/**
 * Right-click the POI for its popup, press its GoTo, and follow the vehicle to the POI.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Right-click the point of interest, then its GoTo')
  const [marker] = await poiMarkers(page, 'widget')
  await page.rightClick(marker.grab, { settle: 1200 })
  await page.click('.poi-popup-menu .mdi-crosshairs-gps', { settle: 800 })
  await page.caption('Slide to confirm the GoTo')
  await confirmSlider(page)
  const closest = await waitArrival(vehicle, poi, {
    onTick: (gap) => page.caption(`Driving to the point of interest · ${gap.toFixed(0)} m`),
  })
  await page.check('Vehicle arrived within 3 m of the POI', () => ({
    ok: closest <= 3,
    detail: `closest ${closest.toFixed(1)} m`,
  }))
  await page.wait(1500)
}
