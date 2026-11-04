import { missionState, near } from '../lib/cockpit.mjs'
import { drawPath4, drawSurvey, sawSnackbar, SURVEY_SE } from '../lib/mission.mjs'

export const meta = { title: 'Add a survey after the simple path', route: '/mission-planning', needs: ['vehicle'] }

let path

/**
 * The standard four-waypoint path, drawn before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
  path = (await missionState(page)).waypoints
}

/**
 * Draw a survey after the path and show its waypoints appended without touching the path.
 */
export default async function run({ page }) {
  await page.caption('A four-waypoint path; add a survey area after it')
  const generated = sawSnackbar(page, 'Waypoints generated from survey path.', 30000)
  await drawSurvey(page, SURVEY_SE, {
    onCorner: (i) => page.caption(`Survey corner ${i + 1} of 4, then "Generate waypoints"`),
  })
  await page.caption('The survey is drawn and its waypoints follow the path')
  await page.check('"Waypoints generated from survey path." shown', () => generated)
  await page.check('One survey with the four corners drawn', async () => {
    const { surveys } = await missionState(page)
    return { ok: surveys.length === 1 && surveys[0].polygon.length === 4, detail: `${surveys.length} surveys` }
  })
  await page.check('The four path waypoints are untouched', async () => {
    const { waypoints } = await missionState(page)
    return path.every((w, i) => waypoints[i].id === w.id && near(waypoints[i], w, 1e-9))
  })
  await page.check('The survey waypoints come right after them', async () => {
    const { waypoints, surveys } = await missionState(page)
    const after = waypoints.slice(4).map((w) => w.id)
    const ids = surveys[0].waypointIds
    return {
      ok: ids.length > 0 && JSON.stringify(after) === JSON.stringify(ids),
      detail: `${ids.length} survey waypoints`,
    }
  })
  await page.wait(1500)
}
