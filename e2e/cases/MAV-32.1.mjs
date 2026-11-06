import { waitAlertBar } from '../lib/mavlink-tools.mjs'
import { armVehicle } from '../lib/mission.mjs'

export const meta = { title: 'STATUSTEXT shows in the alert bar', route: '/', needs: ['vehicle'] }

/**
 * Arm the vehicle, which answers with a "Throttle armed" STATUSTEXT, and show it in the alert bar.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Arming the vehicle; it reports "Throttle armed"')
  await armVehicle(vehicle)
  const shown = await waitAlertBar(page, 'Throttle armed')
  await page.check('Alert bar shows "Throttle armed"', () => ({ ok: shown.includes('Throttle armed'), detail: shown }))
  await page.wait(2500)
}
