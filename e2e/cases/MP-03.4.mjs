import { geoToPage, missionState, near } from '../lib/cockpit.mjs'
import { clickCorners, drawPath4, insertViaKnob, openSurveyMenu, orbit } from '../lib/mission.mjs'

export const meta = {
  title: 'Edit a survey that sits between waypoints (not the last element)',
  route: '/mission-planning',
  needs: ['vehicle'],
}

const SURVEY_E = [
  [0.66, 0.28],
  [0.78, 0.28],
  [0.78, 0.4],
  [0.66, 0.4],
]

let before

/**
 * The path with a survey inserted between waypoints 2 and 3, before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
  await insertViaKnob(page, 1, 'Insert survey here')
  await clickCorners(page, SURVEY_E)
  await page.click('text=GENERATE WAYPOINTS', { settle: 1500 })
  before = await missionState(page)
}

/**
 * Edit that survey's polygon and show the waypoints before and after it stay where they were.
 */
export default async function run({ page }) {
  const n = before.surveys[0].waypointIds.length
  await page.check('Survey sits between waypoints 2 and 3', async () => {
    const ids = before.waypoints.slice(2, 2 + n).map((w) => w.id)
    return {
      ok: ids.join() === before.surveys[0].waypointIds.join(),
      detail: `${n} survey waypoints at positions 3–${2 + n}`,
    }
  })
  await page.caption('Edit the survey in the middle of the mission')
  await openSurveyMenu(page)
  await page.click(orbit('mdi-pencil'), { settle: 1200 })
  const corner = before.surveys[0].polygon[1]
  await page.waitFor('.survey-vertex-icon', { label: 'the polygon corners' })
  await page.drag(await geoToPage(page, 'planning', { lat: corner[0], lon: corner[1] }), { dx: 60, dy: -40 })
  await page.click('text=GENERATE WAYPOINTS', { settle: 1500 })

  await page.caption('Only that survey changed; the waypoints around it did not move')
  await page.check('Waypoints before the survey unchanged', async () => {
    const { waypoints } = await missionState(page)
    return before.waypoints.slice(0, 2).every((w, i) => near(waypoints[i], w, 1e-9))
  })
  await page.check('Waypoints after the survey unchanged, still last', async () => {
    const { waypoints } = await missionState(page)
    return before.waypoints.slice(-2).every((w, i) => near(waypoints.at(-2 + i), w, 1e-9))
  })
  await page.check('The survey itself was regenerated', async () => {
    const [s] = (await missionState(page)).surveys
    return {
      ok: Boolean(s) && s.waypointIds.join() !== before.surveys[0].waypointIds.join(),
      detail: `${n} → ${s?.waypointIds.length}`,
    }
  })
  await page.wait(1500)
}
