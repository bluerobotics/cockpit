import { dismissTutorial } from '../lib/cockpit.mjs'
import { heartbeatsFlowing } from '../lib/connections.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import {
  applyGlobalAddress,
  comesOnline,
  connectionState,
  dismissVehicleDiscovery,
  NO_VEHICLE,
} from '../lib/global-address.mjs'

export const meta = {
  title: 'Setting a vehicle address connects to the vehicle there',
  route: '/',
  needs: ['vehicle'],
}

// The same vehicle under another name, so the switch is to an address the test has not used yet.
const otherName = (host) => {
  if (host.startsWith('localhost')) return host.replace('localhost', '127.0.0.1')
  if (host.startsWith('127.0.0.1')) return host.replace('127.0.0.1', 'localhost')
  return 'blueos.local'
}

/**
 * Note the vehicle's ID, then move Cockpit to an address with no vehicle, outside the recording.
 */
export const setup = async (ctx) => {
  const { page } = ctx
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
  ctx.vehicleId = (await connectionState(page)).vehicleId
  ctx.byName = otherName(ctx.vehicleHost)
  await applyGlobalAddress(page, NO_VEHICLE)
  await dismissVehicleDiscovery(page)
}

/**
 * From an address with no vehicle, set the global address to the vehicle's network name: Cockpit
 * restarts, connects there and gets heartbeats and the same vehicle ID as before.
 */
export default async function run({ page, vehicleId, byName }) {
  const before = await connectionState(page)
  await page.check('No vehicle at the current address', () => ({
    ok: !before.online && before.address === NO_VEHICLE,
    detail: `${before.address}, online ${before.online}`,
  }))
  await page.caption(`Settings → General → global address: ${byName}, Apply`)
  await applyGlobalAddress(page, byName)
  await page.caption('Cockpit restarted on the new address')
  const online = await comesOnline(page, 45000)
  await dismissFeaturesDialog(page, 8000)
  const after = await connectionState(page)
  await page.check('The vehicle comes online over the new address', () => ({
    ok: online && after.address === byName && after.link.includes(`//${byName}/`),
    detail: `${after.address}, ${after.link}, online ${online}`,
  }))
  await page.check('Heartbeats keep arriving', () => heartbeatsFlowing(page))
  await page.check('It is the same vehicle, by its BlueOS ID', async () => {
    const id = (await connectionState(page)).vehicleId
    return { ok: !!id && id === vehicleId, detail: `${id} (before ${vehicleId})` }
  })
}
