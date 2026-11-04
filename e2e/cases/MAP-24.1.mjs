import { addExtraVehicle, extraVehicleRow, lake, startExtraVehicle } from '../lib/extra-vehicle.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = {
  title: "An extra vehicle's telemetry reaches the data lake",
  route: '/',
  needs: ['vehicle'],
}

// The test network has one vehicle; a stand-in announces itself as system 2 over the same kind of link.
export const setup = (ctx) => startExtraVehicle(ctx, 2)

const LAT = '/mavlink/2/1/GLOBAL_POSITION_INT/lat'
const LON = '/mavlink/2/1/GLOBAL_POSITION_INT/lon'

/**
 * Add the extra vehicle under Settings → General: the panel names its system ID, and its position arrives in
 * the data lake under its own system ID, matching where it is and following it as it moves.
 */
export default async function run({ page, extra }) {
  await page.caption('Settings → General → Other vehicles (telemetry only): add the second vehicle')
  await addExtraVehicle(page, extra.url)
  await page
    .waitFor(async () => /System ID 2/.test(await extraVehicleRow(page, extra.url)), { timeout: 15000 })
    .catch(() => undefined)
  await page.check('The panel lists it with its system ID', async () => {
    const row = await extraVehicleRow(page, extra.url)
    return { ok: /System ID 2/.test(row), detail: row }
  })

  await page.caption('Its position is in the data lake, under system 2')
  const read = async () => ({ lat: (await lake(page, LAT)) / 1e7, lon: (await lake(page, LON)) / 1e7 })
  const first = await read()
  await page.check('The position matches where the vehicle is', () => {
    const off = distance(first, extra.position())
    return {
      ok: Number.isFinite(off) && off < 5,
      detail: `${first.lat.toFixed(6)}, ${first.lon.toFixed(6)} (${off.toFixed(1)} m off)`,
    }
  })
  await page.wait(4000)
  const second = await read()
  await page.check('It keeps updating as the vehicle moves', () => {
    const moved = distance(first, second)
    return { ok: moved > 3, detail: `${moved.toFixed(1)} m in 4 s` }
  })
}
