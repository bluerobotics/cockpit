import { CENTER, isTracking, openCenterDial } from '../lib/centering.mjs'
import { mapPoint, mapView, wheelZoom } from '../lib/cockpit.mjs'
import { armVehicle, confirmSlider } from '../lib/mission.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = { title: 'Follow the vehicle', route: '/', needs: ['vehicle'] }

/**
 * Arm and send the simulator to a far point with the map's GoTo, so it is moving when recording starts.
 */
export async function setup({ page, vehicle }) {
  await armVehicle(vehicle)
  await wheelZoom(page, 'widget', 17)
  await page.rightClick(await mapPoint(page, 'widget', 0.5, 0.12), { settle: 900 })
  await page.click('text=GoTo', { settle: 800 })
  await confirmSlider(page)
  await page.wait(3000)
}

/**
 * Double-click the vehicle button and show the map keep the moving vehicle centred.
 */
export default async function run({ page, vehicle }) {
  await page.caption('The vehicle is driving north. Double-click the vehicle button to follow it')
  await openCenterDial(page)
  await page.dblClick(CENTER.vehicle, { settle: 1500 })
  await page.check('Vehicle button shows it is tracking', () => isTracking(page, CENTER.vehicle))
  await page.key('Escape', { show: false })
  const gaps = []
  const start = await vehicle.position()
  for (let i = 0; i < 15; i++) {
    gaps.push(distance(await mapView(page, 'widget'), await vehicle.position()))
    await page.caption(`Following · map centre ${gaps.at(-1).toFixed(1)} m from the vehicle`)
    await page.wait(1000)
  }
  const travelled = distance(start, await vehicle.position())
  await page.check('Vehicle moved meanwhile', () => ({ ok: travelled > 10, detail: `${travelled.toFixed(0)} m` }))
  await page.check('Map stayed centred on it the whole time', () => {
    const worst = Math.max(...gaps)
    return { ok: worst < 8, detail: `worst ${worst.toFixed(1)} m` }
  })
  await page.wait(1500)
}
