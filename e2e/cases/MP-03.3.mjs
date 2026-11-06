import { missionState } from '../lib/cockpit.mjs'
import { drawPath4, drawSurvey, openSurveyMenu, orbit, SURVEY_SE } from '../lib/mission.mjs'

export const meta = { title: 'Toggle crosshatch (90º re-fly)', route: '/mission-planning', needs: ['vehicle'] }

let before

/**
 * Path plus one survey, drawn before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
  await drawSurvey(page, SURVEY_SE)
  before = (await missionState(page)).surveys[0]
}

/**
 * Turn the crosshatch re-fly on from the survey menu and show the second, perpendicular pass.
 */
export default async function run({ page }) {
  await page.caption('Right-click the survey, then "Enable 90° crosshatch re-fly"')
  await openSurveyMenu(page)
  await page.click(orbit('mdi-grid'), { settle: 1800 })
  await page.caption('A second pass, perpendicular to the first')
  await page.check('Survey has crosshatch on', async () => (await missionState(page)).surveys[0]?.crosshatch === true)
  await page.check('Survey waypoints roughly double', async () => {
    const n = (await missionState(page)).surveys[0]?.waypointIds.length ?? 0
    const ratio = n / before.waypointIds.length
    return { ok: ratio > 1.5 && ratio < 2.6, detail: `${before.waypointIds.length} → ${n}` }
  })
  await page.wait(1500)
}
