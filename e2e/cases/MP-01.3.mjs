import { drawSimplePath, mapPolylines, missionState, near } from '../lib/cockpit.mjs'
import { drawSurvey, planningZoom, SURVEY_SE } from '../lib/mission.mjs'

export const meta = {
  title: 'Create a mission starting with a survey and then a simple path',
  route: '/mission-planning',
  needs: ['vehicle'],
}

const PATH3 = [
  [0.56, 0.6],
  [0.42, 0.4],
  [0.36, 0.3],
]

/**
 * Draw a survey first, then a simple path, and show the path continues from the survey.
 */
export default async function run({ page }) {
  await planningZoom(page)
  await page.caption('Start with a survey')
  await drawSurvey(page, SURVEY_SE)
  const { surveys } = await missionState(page)
  await page.caption('Then a three-waypoint simple path')
  const clicked = await drawSimplePath(page, PATH3)

  await page.caption('Survey waypoints first, then the path, in one continuous mission')
  await page.check('Survey waypoints come first', async () => {
    const { waypoints } = await missionState(page)
    const ids = surveys[0].waypointIds
    return {
      ok: JSON.stringify(waypoints.slice(0, ids.length).map((w) => w.id)) === JSON.stringify(ids),
      detail: `${ids.length} survey waypoints`,
    }
  })
  await page.check('Then the three path waypoints, where clicked', async () => {
    const { waypoints } = await missionState(page)
    const tail = waypoints.slice(-3)
    return {
      ok: waypoints.length === surveys[0].waypointIds.length + 3 && tail.every((w, i) => near(w, clicked[i])),
      detail: `${waypoints.length} waypoints`,
    }
  })
  await page.check('The mission line runs from the last survey waypoint into the path', async () => {
    const { waypoints } = await missionState(page)
    const n = surveys[0].waypointIds.length
    const [a, b] = [waypoints[n - 1], waypoints[n]]
    const lines = await mapPolylines(page, 'planning')
    return lines.some((pts) => pts.some((p, i) => i + 1 < pts.length && near(p, a, 1e-7) && near(pts[i + 1], b, 1e-7)))
  })
  await page.wait(1500)
}
