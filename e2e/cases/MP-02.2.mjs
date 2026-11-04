import { missionState, near, openCockpit, TEST_USER } from '../lib/cockpit.mjs'
import { drawPath4, drawSurvey, sawSnackbar, setHomeByPill, SURVEY_SE, uploadMission } from '../lib/mission.mjs'

export const meta = { title: 'Download the uploaded mission back', route: '/mission-planning', needs: ['vehicle'] }

let uploaded

/**
 * Upload a path + survey mission, then open Cockpit on a brand-new profile with an empty plan, as on
 * another computer.
 */
export async function setup({ page, vehicle, url }) {
  await drawPath4(page)
  await drawSurvey(page, SURVEY_SE)
  await setHomeByPill(page, [0.36, 0.7])
  if (!(await uploadMission(page))) throw new Error('setup upload failed')
  uploaded = (await missionState(page)).waypoints
  await page.click('text=Close', { settle: 800 })
  await vehicle.setSyncedSetting(TEST_USER, 'cockpit-draft-mission', {})
  await page.restartBrowser({ freshProfile: true })
  await openCockpit(page, { url, route: '/mission-planning' })
}

/**
 * Download the vehicle's mission into an empty plan and show it matches what was uploaded.
 */
export default async function run({ page }) {
  await page.caption('Another computer: the plan is empty')
  await page.check('Plan starts empty', async () => (await missionState(page)).waypoints.length === 0)
  await page.caption('"Download mission from vehicle"')
  const downloaded = sawSnackbar(page, 'Mission download succeeded!', 30000)
  await page.click('text=DOWNLOAD MISSION FROM VEHICLE', { settle: 1500 })
  await page.check('"Mission download succeeded!"', () => downloaded)
  await page.caption('The uploaded path and survey are back')
  await page.check(`Same ${uploaded.length} waypoints, same coordinates, same order`, async () => {
    const { waypoints } = await missionState(page)
    return {
      ok: waypoints.length === uploaded.length && uploaded.every((w, i) => near(waypoints[i], w, 2e-7)),
      detail: `${waypoints.length} waypoints`,
    }
  })
  await page.wait(1500)
}
