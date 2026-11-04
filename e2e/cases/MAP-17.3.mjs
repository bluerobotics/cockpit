import { missionState, near } from '../lib/cockpit.mjs'
import {
  clickCorners,
  planningZoom,
  reopenAsAnotherComputer,
  sawSnackbar,
  setHomeByPill,
  sidebarInput,
  uploadMission,
  vehicleRoute,
} from '../lib/mission.mjs'

export const meta = { title: 'A large mission downloads completely', route: '/mission-planning', needs: ['vehicle'] }

const BIG_SURVEY = [
  [0.3, 0.15],
  [0.75, 0.15],
  [0.75, 0.85],
  [0.3, 0.85],
]

/**
 * Upload a dense survey of 150+ items, then reopen as another computer with an empty plan.
 */
export async function setup(ctx) {
  const { page } = ctx
  await planningZoom(page)
  await page.click('button:has(.mdi-grid)', { settle: 700 })
  await clickCorners(page, BIG_SURVEY)
  await page.fill(await sidebarInput(page, 'Distance between lines'), 3)
  await page.key('Tab', { show: false })
  await page.click('text=GENERATE WAYPOINTS', { settle: 2000 })
  await setHomeByPill(page, [0.26, 0.5])
  if ((await missionState(page)).waypoints.length < 150) throw new Error('survey too sparse for this case')
  if (!(await uploadMission(page, { timeout: 300000 }))) throw new Error('setup upload failed')
  await reopenAsAnotherComputer(ctx, '/mission-planning')
}

/**
 * Download the large mission and show every item arrived.
 */
export default async function run({ page, vehicle }) {
  const { items, waypoints: route } = await vehicleRoute(vehicle)
  await page.caption(`The vehicle holds ${items.length} mission items; download them`)
  const said = sawSnackbar(page, 'Mission download succeeded!', 90000)
  await page.click('text=DOWNLOAD MISSION FROM VEHICLE', { settle: 2000 })
  await page.check('"Mission download succeeded!"', () => said)
  await page.check(`All ${route.length} waypoints arrived`, async () => {
    const { waypoints } = await missionState(page)
    return { ok: waypoints.length === route.length, detail: `${waypoints.length} of ${route.length}` }
  })
  await page.check('The last waypoint matches the vehicle', async () => {
    const { waypoints } = await missionState(page)
    return near(waypoints.at(-1), route.at(-1), 2e-7)
  })
  await page.wait(1500)
}
