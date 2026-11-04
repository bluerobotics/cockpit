import { geoToPage, missionState, near } from '../lib/cockpit.mjs'
import {
  addWaypointCommand,
  deselectWaypoint,
  drawPath4,
  drawSurvey,
  reopenAsAnotherComputer,
  sawSnackbar,
  setHomeByPill,
  SURVEY_SE,
  uploadMission,
  vehicleRoute,
} from '../lib/mission.mjs'

export const meta = {
  title: 'Download the vehicle mission into mission planning, commands included',
  route: '/mission-planning',
  needs: ['vehicle'],
}

/**
 * Upload a mission with a survey and a DO_SET_SERVO on waypoint 2, then reopen as another computer.
 */
export async function setup(ctx) {
  const { page } = ctx
  await drawPath4(page)
  await addWaypointCommand(page, 1, 'DO_SET_SERVO', { 1: 5, 2: 1900 })
  await deselectWaypoint(page)
  await drawSurvey(page, SURVEY_SE)
  await setHomeByPill(page, [0.36, 0.7])
  if (!(await uploadMission(page))) throw new Error('setup upload failed')
  await reopenAsAnotherComputer(ctx, '/mission-planning')
}

/**
 * Download into an empty plan and compare every waypoint and the command with the vehicle's copy.
 */
export default async function run({ page, vehicle }) {
  const route = (await vehicleRoute(vehicle)).waypoints
  await page.check('Plan starts empty', async () => (await missionState(page)).waypoints.length === 0)
  await page.caption('"Download mission from vehicle"')
  const said = sawSnackbar(page, 'Mission download succeeded!', 30000)
  await page.click('text=DOWNLOAD MISSION FROM VEHICLE', { settle: 2000 })
  await page.check('"Mission download succeeded!"', () => said)
  await page.check(`All ${route.length} waypoints match the vehicle`, async () => {
    const { waypoints } = await missionState(page)
    return {
      ok: waypoints.length === route.length && route.every((w, i) => near(waypoints[i], w, 2e-7)),
      detail: `${waypoints.length} waypoints`,
    }
  })
  await page.caption('Open waypoint 2')
  await page.click(await geoToPage(page, 'planning', (await missionState(page)).waypoints[1]), { settle: 1200 })
  await page.check('Waypoint 2 carries DO_SET_SERVO 5, 1900', async () => {
    const cmds = (await missionState(page)).waypoints[1].commands
    const servo = cmds.find((c) => c.command === 'MAV_CMD_DO_SET_SERVO')
    return {
      ok: servo?.param1 === 5 && servo?.param2 === 1900,
      detail: cmds.map((c) => c.command.replace('MAV_CMD_', '')).join(', '),
    }
  })
  await page.wait(1500)
}
