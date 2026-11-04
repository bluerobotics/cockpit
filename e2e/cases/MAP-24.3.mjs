import { addExtraVehicle, lake, startExtraVehicle } from '../lib/extra-vehicle.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = {
  title: "An extra vehicle with the piloted vehicle's system ID is reported and ignored",
  route: '/',
  needs: ['vehicle'],
}

// Same system ID as the boat, 150 m away from it, so its position is easy to tell apart.
export const setup = (ctx) => startExtraVehicle(ctx, 1)

/**
 * Add an extra vehicle announcing the piloted vehicle's system ID: the panel warns about it, and the piloted
 * vehicle's position in the data lake stays the boat's.
 */
export default async function run({ page, extra, vehicle }) {
  await page.caption('Add a second vehicle that also uses system ID 1')
  await addExtraVehicle(page, extra.url)
  const warning =
    'text=A vehicle is using the same system ID as the vehicle you are piloting, so it is not being received. Change its system ID.'
  const warned = await page.waitFor(() => page.exists(warning), { timeout: 15000 }).catch(() => false)
  await page.check('The panel warns about the system ID clash', () => warned)
  await page.wait(4000)
  const lakeBoat = {
    lat: (await lake(page, '/mavlink/1/1/GLOBAL_POSITION_INT/lat')) / 1e7,
    lon: (await lake(page, '/mavlink/1/1/GLOBAL_POSITION_INT/lon')) / 1e7,
  }
  const boat = await vehicle.position()
  await page.check("The piloted vehicle's position is still the boat's", () => {
    const fromBoat = distance(lakeBoat, boat)
    const fromImpostor = distance(lakeBoat, extra.position())
    return {
      ok: fromBoat < 5 && fromImpostor > 50,
      detail: `${fromBoat.toFixed(1)} m from the boat, ${fromImpostor.toFixed(0)} m from the other one`,
    }
  })
}
