import { missionState, near } from '../lib/cockpit.mjs'
import { clickCorners, drawPath4, insertViaKnob } from '../lib/mission.mjs'

export const meta = {
  title: 'Insert a survey with the segment "+" knob',
  route: '/mission-planning',
  needs: ['vehicle'],
}

const SURVEY_E = [
  [0.66, 0.28],
  [0.78, 0.28],
  [0.78, 0.4],
  [0.66, 0.4],
]

/**
 * The standard four-waypoint path, drawn before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
}

/**
 * Insert a survey on the segment between waypoints 2 and 3 and show it lands right there.
 */
export default async function run({ page }) {
  const path = (await missionState(page)).waypoints
  await page.caption('Hover the segment between waypoints 2 and 3, click "+", "Insert survey here"')
  await insertViaKnob(page, 1, 'Insert survey here')
  await page.caption('Draw the survey and generate it')
  await clickCorners(page, SURVEY_E)
  await page.click('text=GENERATE WAYPOINTS', { settle: 1500 })

  await page.caption('The survey sits between waypoints 2 and 3')
  await page.check('Waypoints 1 and 2 still first', async () => {
    const { waypoints } = await missionState(page)
    return path.slice(0, 2).every((w, i) => waypoints[i].id === w.id)
  })
  await page.check('Then the survey waypoints', async () => {
    const { waypoints, surveys } = await missionState(page)
    const ids = surveys[0]?.waypointIds ?? []
    return {
      ok:
        ids.length > 0 &&
        waypoints
          .slice(2, 2 + ids.length)
          .map((w) => w.id)
          .join() === ids.join(),
      detail: `${ids.length} survey waypoints`,
    }
  })
  await page.check('Then the old waypoints 3 and 4, unchanged', async () => {
    const { waypoints } = await missionState(page)
    return path.slice(2).every((w, i) => near(waypoints.at(-2 + i), w, 1e-9))
  })
  await page.wait(1500)
}
