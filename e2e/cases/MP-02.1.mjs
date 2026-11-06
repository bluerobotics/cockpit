import { missionState, near } from '../lib/cockpit.mjs'
import { drawPath4, drawSurvey, setHomeByPill, SURVEY_SE, uploadMission, vehicleRoute } from '../lib/mission.mjs'

export const meta = { title: 'Upload a path + survey mission', route: '/mission-planning', needs: ['vehicle'] }

/**
 * Path, survey and mission home, set before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
  await drawSurvey(page, SURVEY_SE)
  await setHomeByPill(page, [0.36, 0.7])
}

/**
 * Upload the mission and prove, by reading it back from the autopilot directly, that the vehicle
 * holds exactly the planned route.
 */
export default async function run({ page, vehicle }) {
  const plan = await missionState(page)
  await page.caption(`A path and a survey, ${plan.waypoints.length} waypoints: upload it`)
  const ok = await uploadMission(page)
  await page.caption('Cockpit reports success; now ask the vehicle itself')
  await page.check('"Mission upload succeeded"', () => ok)
  const route = await vehicleRoute(vehicle)
  await page.check(`Vehicle holds ${plan.waypoints.length} waypoints`, () => ({
    ok: route.waypoints.length === plan.waypoints.length,
    detail: `${route.items.length} items on the vehicle, ${route.waypoints.length} waypoints`,
  }))
  await page.check('Every waypoint at its planned coordinates, in order', () =>
    plan.waypoints.every((w, i) => route.waypoints[i] && near(route.waypoints[i], w, 2e-7))
  )
  await page.click('text=Close', { settle: 1000 })
  await page.wait(1000)
}
