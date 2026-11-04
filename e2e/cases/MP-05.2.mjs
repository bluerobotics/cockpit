import { missionState, near } from '../lib/cockpit.mjs'
import { clickCorners, drawPath4, segmentMidpoint } from '../lib/mission.mjs'

export const meta = {
  title: 'Insert a survey from the map context menu',
  route: '/mission-planning',
  needs: ['vehicle'],
}

const SURVEY_N = [
  [0.42, 0.08],
  [0.54, 0.08],
  [0.54, 0.18],
  [0.42, 0.18],
]

/**
 * The standard four-waypoint path, drawn before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
}

/**
 * Right-click next to the first segment, "Add element here", "Insert survey here", and show the
 * survey lands between waypoints 1 and 2.
 */
export default async function run({ page }) {
  const path = (await missionState(page)).waypoints
  const mid = await segmentMidpoint(page, 0)
  await page.caption('Right-click next to the segment between waypoints 1 and 2')
  await page.rightClick({ x: mid.x, y: mid.y + 6 }, { settle: 900 })
  await page.click('text=Add element here', { settle: 900 })
  await page.click('.radial-btn[title="Insert survey here"]', { settle: 900 })
  await page.caption('Draw the survey and generate it')
  await clickCorners(page, SURVEY_N)
  await page.click('text=GENERATE WAYPOINTS', { settle: 1500 })

  await page.caption('The survey sits between waypoints 1 and 2')
  await page.check('Waypoint 1 still first', async () => (await missionState(page)).waypoints[0].id === path[0].id)
  await page.check('Then the survey waypoints', async () => {
    const { waypoints, surveys } = await missionState(page)
    const ids = surveys[0]?.waypointIds ?? []
    return {
      ok:
        ids.length > 0 &&
        waypoints
          .slice(1, 1 + ids.length)
          .map((w) => w.id)
          .join() === ids.join(),
      detail: `${ids.length} survey waypoints`,
    }
  })
  await page.check('Then the old waypoints 2 to 4, unchanged', async () => {
    const { waypoints } = await missionState(page)
    return path.slice(1).every((w, i) => near(waypoints.at(-3 + i), w, 1e-9))
  })
  await page.wait(1500)
}
