import { missionState, near } from '../lib/cockpit.mjs'
import { DELETE_SURVEY, drawPath4, drawSurvey, openSurveyMenu, SURVEY_SE } from '../lib/mission.mjs'

export const meta = { title: 'Delete a survey', route: '/mission-planning', needs: ['vehicle'] }

let path

/**
 * Path plus one survey, drawn before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
  path = (await missionState(page)).waypoints
  await drawSurvey(page, SURVEY_SE)
}

/**
 * Delete the survey from its menu and show only the path is left.
 */
export default async function run({ page }) {
  await page.caption('Right-click the survey, then "Delete survey"')
  await openSurveyMenu(page)
  await page.click(DELETE_SURVEY, { settle: 1500 })
  await page.caption('The survey and its waypoints are gone; the path stays')
  await page.check('No survey left, no polygon on the map', async () => {
    const { surveys } = await missionState(page)
    const polygons = await page.count('#planningMap path.survey-polygon')
    return { ok: surveys.length === 0 && polygons === 0, detail: `${surveys.length} surveys, ${polygons} polygons` }
  })
  await page.check('Exactly the four path waypoints remain', async () => {
    const { waypoints } = await missionState(page)
    return {
      ok: waypoints.length === 4 && path.every((w, i) => near(waypoints[i], w, 1e-9)),
      detail: `${waypoints.length} waypoints`,
    }
  })
  await page.wait(1500)
}
