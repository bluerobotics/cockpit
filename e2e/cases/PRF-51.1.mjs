import { heartbeatsFlowing } from '../lib/connections.mjs'
import { applyGlobalAddress, comesOnline, connectionState } from '../lib/global-address.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'
import { armerLabel, armerShows, NO_VEHICLE, setup as quiet, shownMode } from '../lib/prf.mjs'

export const meta = {
  title: 'Connect to the vehicle from an address with no vehicle',
  route: '/',
  needs: ['vehicle'],
}

export const setup = async (ctx) => {
  await quiet(ctx)
  await applyGlobalAddress(ctx.page, NO_VEHICLE)
}

const MODE = '/mavlink/1/1/HEARTBEAT/custom_mode'

/**
 * Settings → General → global address: type the vehicle's address and Apply. Cockpit restarts, the vehicle
 * comes online, and the bottom bar shows its arm state and flight mode.
 */
export default async function run({ page, vehicleHost }) {
  const before = await connectionState(page)
  await page.check('No vehicle at the starting address', () => ({
    ok: !before.online && before.address === NO_VEHICLE,
    detail: `${before.address}, online ${before.online}`,
  }))
  await page.caption(`Settings → General → global address: ${vehicleHost}, Apply`)
  await applyGlobalAddress(page, vehicleHost)
  await page.caption('Cockpit restarts and the top bar settles')
  const online = await comesOnline(page, 45000)
  const after = await connectionState(page)
  await page.check('The vehicle comes online at the address typed', () => ({
    ok: online && after.address === vehicleHost,
    detail: `${after.address}, online ${online}`,
  }))
  await closeMenu(page)
  await armerShows(page, 'Disarmed')
  const armer = await armerLabel(page)
  const mode = await shownMode(page)
  await page.check('The Armer button says "Disarmed" and the mode selector shows the mode', () => ({
    ok: armer === 'Disarmed' && mode === 'HOLD',
    detail: `Armer "${armer}", mode "${mode}"`,
  }))
  const stamp = () =>
    page.eval(`window.cockpit.getDataLakeVariableLastUpdateTimestamp?.(${JSON.stringify(MODE)}) ?? null`)
  const first = await stamp()
  await page.check('Heartbeats keep arriving', () => heartbeatsFlowing(page, 3000))
  const later = await stamp()
  const value = await page.eval(`window.cockpit.getDataLakeVariableData(${JSON.stringify(MODE)})`)
  await page.check("The data lake keeps updating the heartbeat's custom_mode", () => ({
    ok: value === 4 && later > first,
    detail: `custom_mode ${value}, last update moved ${later - first} ms`,
  }))
}
