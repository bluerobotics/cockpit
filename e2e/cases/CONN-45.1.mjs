import { dismissTutorial } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import { applyGlobalAddress, comesOnline, connectionState, NO_VEHICLE } from '../lib/global-address.mjs'

export const meta = {
  title: 'Pointing Cockpit at an address with no vehicle drops the vehicle',
  route: '/',
  needs: ['vehicle'],
}

export const setup = async ({ page }) => {
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
}

/**
 * Settings → General → global address: switch from the vehicle to an address nothing answers on.
 * Cockpit restarts, connects there, and the vehicle is gone.
 */
export default async function run({ page, vehicleHost }) {
  const before = await connectionState(page)
  await page.check(`Connected to the vehicle at ${vehicleHost}`, () => ({
    ok: before.online && before.address === vehicleHost,
    detail: `${before.address}, ${before.link}`,
  }))
  await page.caption(`Settings → General → global address: ${NO_VEHICLE}, Apply`)
  await applyGlobalAddress(page, NO_VEHICLE)
  await page.caption('Cockpit restarted on the new address')
  const online = await comesOnline(page, 15000)
  const after = await connectionState(page)
  await page.check('The address and the MAVLink link follow the new address', () => ({
    ok: after.address === NO_VEHICLE && after.link.includes(`//${NO_VEHICLE}/`),
    detail: `${after.address}, ${after.link}`,
  }))
  await page.check('No vehicle there, so none is online', () => ({ ok: !online, detail: `online ${online}` }))
}
