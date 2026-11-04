import { mapPolylines } from '../lib/cockpit.mjs'
import {
  drawPath4,
  drawSurvey,
  lineThrough,
  missionPanelButton,
  reopenAsAnotherComputer,
  sawSnackbar,
  setHomeByPill,
  SURVEY_SE,
  uploadMission,
  vehicleRoute,
} from '../lib/mission.mjs'

export const meta = {
  title: 'Download the vehicle mission into the Map widget',
  route: '/mission-planning',
  needs: ['vehicle'],
}

/**
 * Upload a path + survey mission, reopen Cockpit as another computer on the Flight view, and
 * clear whatever mission the map drew on connect.
 */
export async function setup(ctx) {
  const { page } = ctx
  await drawPath4(page)
  await drawSurvey(page, SURVEY_SE)
  await setHomeByPill(page, [0.36, 0.7])
  if (!(await uploadMission(page))) throw new Error('setup upload failed')
  await reopenAsAnotherComputer(ctx, '/')
  await page.click(await missionPanelButton(page, 'mdi-dots-vertical'), { settle: 800 })
  await page.click('text=Clear mission on map', { settle: 1200 })
}

/**
 * Download the vehicle's mission from the Mission control panel menu and show all of it on the map.
 */
export default async function run({ page, vehicle }) {
  const route = (await vehicleRoute(vehicle)).waypoints
  await page.caption(`The vehicle holds a ${route.length}-waypoint mission; the map shows none`)
  await page.check(
    'No mission drawn on the Map widget',
    async () => !lineThrough(await mapPolylines(page, 'widget'), route.slice(0, 2))
  )
  await page.caption('Mission control panel menu, "Download mission from vehicle"')
  const said = sawSnackbar(page, 'succeeded', 30000)
  await page.click(await missionPanelButton(page, 'mdi-dots-vertical'), { settle: 800 })
  await page.click('text=Download mission from vehicle', { settle: 2500 })
  await page.check('Cockpit reports the download succeeded', () => said)
  await page.check(`All ${route.length} vehicle waypoints drawn on the map, in order`, async () =>
    lineThrough(await mapPolylines(page, 'widget'), route)
  )
  await page.wait(1500)
}
