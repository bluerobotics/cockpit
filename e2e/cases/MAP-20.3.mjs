import { CENTER, isTracking, openCenterDial, panAway } from '../lib/centering.mjs'
import { mapPoint, mapView, wheelZoom } from '../lib/cockpit.mjs'
import { armVehicle, confirmSlider } from '../lib/mission.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = { title: 'Panning the map stops following', route: '/', needs: ['vehicle'] }

/**
 * Moving simulator, followed by the map, before recording.
 */
export async function setup({ page, vehicle }) {
  await armVehicle(vehicle)
  await wheelZoom(page, 'widget', 17)
  await page.rightClick(await mapPoint(page, 'widget', 0.5, 0.12), { settle: 900 })
  await page.click('text=GoTo', { settle: 800 })
  await confirmSlider(page)
  await page.wait(2000)
  await openCenterDial(page)
  await page.dblClick(CENTER.vehicle, { settle: 1500 })
  await page.key('Escape', { show: false })
}

/**
 * Drag the map while following, and show it stays where it was dragged.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Following the vehicle. Drag the map away')
  await panAway(page, 'widget', 1)
  const dropped = await mapView(page, 'widget')
  await page.wait(5000)
  await page.check('Map stays where it was dragged', async () => {
    const drift = distance(await mapView(page, 'widget'), dropped)
    return { ok: drift < 2, detail: `moved ${drift.toFixed(1)} m since the drag` }
  })
  await page.check('Vehicle is not at the map centre any more', async () => {
    const gap = distance(await mapView(page, 'widget'), await vehicle.position())
    return { ok: gap > 30, detail: `${gap.toFixed(0)} m` }
  })
  await openCenterDial(page)
  await page.check('Vehicle button no longer tracking', async () => !(await isTracking(page, CENTER.vehicle)))
  await page.wait(1500)
}
