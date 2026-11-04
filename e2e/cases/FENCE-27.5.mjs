import { mapPoint, toFlight, wheelZoom } from '../lib/cockpit.mjs'
import { drawFencePolygon, openFenceTab } from '../lib/fence.mjs'
import { armVehicle, confirmSlider, ROVER, snackbars } from '../lib/mission.mjs'

export const meta = { title: 'A breach triggers the fence action', route: '/mission-planning', needs: ['vehicle'] }

// An inclusion fence beside the vehicle (which sits at the map centre), so the vehicle is outside it.
const FENCE_ASIDE = [
  [0.62, 0.3],
  [0.85, 0.3],
  [0.85, 0.62],
  [0.62, 0.62],
]

/**
 * An inclusion fence that leaves the vehicle outside, uploaded but not enforced, vehicle armed, Flight view.
 */
export async function setup({ page, vehicle }) {
  await openFenceTab(page)
  await drawFencePolygon(page, FENCE_ASIDE)
  await page.click('text=UPLOAD FENCE TO VEHICLE', { settle: 1000 })
  await page.waitFor(async () => !(await page.store('geo-fence', 's.syncInProgress')), {
    timeout: 30000,
    label: 'the fence upload',
  })
  await armVehicle(vehicle)
  await toFlight(page)
}

/**
 * Switch fence enforcement on from Cockpit while the vehicle is outside the inclusion fence on a GoTo,
 * and show the autopilot take its fence action and Cockpit tell the operator. Driving out of a fence cannot
 * be staged with a GoTo: the autopilot refuses a destination outside an enforced fence.
 */
export default async function run({ page, vehicle }) {
  // ArduRover takes no fence action in Hold, so the vehicle is put on a short GoTo away from the fence first.
  await wheelZoom(page, 'widget', 18)
  await page.caption('GoTo a point just west of the vehicle, away from the fence')
  await page.rightClick(await mapPoint(page, 'widget', 0.38, 0.5), { settle: 900 })
  await page.click('text=GoTo', { settle: 800 })
  await confirmSlider(page)
  await page.waitFor(async () => (await vehicle.heartbeat()).custom_mode === ROVER.GUIDED, { timeout: 8000 })
  const action = await vehicle.readParam('FENCE_ACTION')
  await page.caption('Outside the inclusion fence, in GoTo. Switch enforcement on')
  await page.click('button:has(.mdi-shield-outline)', { settle: 900 })
  await page.click('button:has(.mdi-toggle-switch-off)', { settle: 1500 })
  await page.check('Fence enforcement is on', async () => (await vehicle.readParam('FENCE_ENABLE')) === 1)
  await page.click({ x: page.width * 0.85, y: page.height * 0.3 }, { settle: 300 })
  await page.caption('Waiting for the fence action')
  await page
    .waitFor(async () => (await vehicle.heartbeat()).custom_mode !== ROVER.GUIDED, { timeout: 15000 })
    .catch(() => undefined)
  await page.wait(4000)
  await page.check('The autopilot saw the breach', async () => {
    const status = await vehicle.read('FENCE_STATUS')
    return {
      ok: status?.breach_status === 1,
      detail: `breach_status ${status?.breach_status}, ${status?.breach_type?.type}`,
    }
  })
  await page.check('The autopilot took its fence action', async () => {
    const mode = (await vehicle.heartbeat()).custom_mode
    return { ok: mode !== ROVER.GUIDED, detail: `mode ${ROVER.GUIDED} → ${mode}, FENCE_ACTION ${action}` }
  })
  await page.check('Cockpit told the operator about the breach', async () => {
    const alerts = await page.store('alert', 's.alerts.map((a) => a.message)')
    const told = [...alerts, await snackbars(page)].find((t) => /breach|fence/i.test(t) && !/indexed/i.test(t))
    return { ok: Boolean(told), detail: told ?? alerts.slice(-3).join(' / ') }
  })
  await page.wait(2500)
}
