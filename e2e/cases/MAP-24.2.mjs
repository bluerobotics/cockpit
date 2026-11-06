import { poiMarkers } from '../lib/cockpit.mjs'
import { addExtraVehicle, startExtraVehicle } from '../lib/extra-vehicle.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = {
  title: 'An extra vehicle can be followed on the map with a point of interest',
  route: '/',
  needs: ['vehicle'],
  synced: { 'cockpit-points-of-interest': [] },
}

export const setup = (ctx) => startExtraVehicle(ctx, 2)

// The test user has no other point of interest (the runner empties them), so the one on the map is the vehicle's.
const vehiclePoi = async (page) => (await poiMarkers(page, 'widget'))[0]

/**
 * Add the extra vehicle and press its "Place this vehicle on the map" button: a point of interest named after it
 * appears on the Map widget where the vehicle is, and moves with it.
 */
export default async function run({ page, extra }) {
  await page.caption('Add the second vehicle, then "Place this vehicle on the map"')
  await addExtraVehicle(page, extra.url)
  const button = '[aria-label="Place this vehicle on the map"]'
  await page
    .waitFor(() => page.eval(`!!document.querySelector('${button}:not([disabled])')`), { timeout: 15000 })
    .catch(() => undefined)
  await page.click(button, { settle: 1500 })
  await closeMenu(page)
  await page.caption('A point of interest follows it on the map')
  await page.wait(1500)
  const first = await vehiclePoi(page)
  await page.check('A "Vehicle 2" point of interest sits on the vehicle', () => {
    const off = first ? distance(first, extra.position()) : NaN
    return { ok: off < 8, detail: first ? `${off.toFixed(1)} m from the vehicle` : 'no such marker on the map' }
  })
  await page.wait(6000)
  const second = await vehiclePoi(page)
  await page.check('It moves with the vehicle', () => {
    const moved = first && second ? distance(first, second) : 0
    const off = second ? distance(second, extra.position()) : NaN
    return {
      ok: moved > 5 && off < 8,
      detail: `moved ${moved.toFixed(1)} m in 6 s, ${off.toFixed(1)} m from the vehicle`,
    }
  })
}
