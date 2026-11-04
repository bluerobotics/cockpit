import { geoToPage, missionState, near, pageToGeo } from '../lib/cockpit.mjs'
import { drawPath4, drawSurvey, openSurveyMenu, orbit, SURVEY_SE } from '../lib/mission.mjs'

export const meta = {
  title: 'Move a survey polygon vertex and regenerate',
  route: '/mission-planning',
  needs: ['vehicle'],
}

let before

/**
 * Path plus one survey, drawn before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
  await drawSurvey(page, SURVEY_SE)
  before = await missionState(page)
}

/**
 * Edit the survey polygon, drag one corner out, regenerate, and show only the survey changed.
 */
export default async function run({ page }) {
  await page.caption('Right-click the survey, then "Edit survey\'s polygon"')
  await openSurveyMenu(page)
  await page.click(orbit('mdi-pencil'), { settle: 1200 })

  const corner = before.surveys[0].polygon[2]
  const from = await geoToPage(page, 'planning', { lat: corner[0], lon: corner[1] })
  await page.caption('Drag a corner outwards')
  await page.waitFor('.survey-vertex-icon', { label: 'the polygon corners' })
  const dropped = await page.drag(from, { dx: 70, dy: 50 })
  const expected = await pageToGeo(page, 'planning', dropped)
  await page.caption('Generate the waypoints again')
  await page.click('text=GENERATE WAYPOINTS', { settle: 1500 })

  await page.check('Still one survey, its corner now where it was dropped', async () => {
    const { surveys } = await missionState(page)
    const moved = surveys[0]?.polygon.some(([lat, lon]) => near({ lat, lon }, expected, 3e-5))
    return { ok: surveys.length === 1 && moved, detail: `${surveys.length} surveys` }
  })
  await page.check('Survey waypoints were regenerated', async () => {
    const { surveys } = await missionState(page)
    const ids = surveys[0]?.waypointIds ?? []
    return {
      ok: ids.length > 0 && ids.join() !== before.surveys[0].waypointIds.join(),
      detail: `${before.surveys[0].waypointIds.length} → ${ids.length}`,
    }
  })
  await page.check('The path waypoints are untouched', async () => {
    const { waypoints } = await missionState(page)
    return before.waypoints.slice(0, 4).every((w, i) => near(waypoints[i], w, 1e-9))
  })
  await page.wait(1500)
}
