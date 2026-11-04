import { missionState } from '../lib/cockpit.mjs'
import { drawPath4, segmentMidpoint } from '../lib/mission.mjs'

export const meta = {
  title: 'Insert a waypoint with Cmd/Ctrl+click on a segment',
  route: '/mission-planning',
  needs: ['vehicle'],
}

/**
 * The standard four-waypoint path, drawn before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
}

/**
 * Cmd/Ctrl+click on the first segment and show a waypoint inserted second.
 */
export default async function run({ page }) {
  const before = (await missionState(page)).waypoints
  await page.caption('⌘-click on the segment between waypoints 1 and 2')
  await page.click(await segmentMidpoint(page, 0), { modifiers: ['Meta'], settle: 1000 })
  await page.check('Five waypoints, the new one second', async () => {
    const { waypoints } = await missionState(page)
    const ids = waypoints.map((w) => w.id)
    const ok =
      waypoints.length === 5 &&
      ids[0] === before[0].id &&
      !before.some((w) => w.id === ids[1]) &&
      ids[2] === before[1].id
    return { ok, detail: `${waypoints.length} waypoints` }
  })
  await page.wait(1500)
}
