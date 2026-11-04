import { missionState, near } from '../lib/cockpit.mjs'
import { drawPath4, insertViaKnob } from '../lib/mission.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = {
  title: 'Insert a waypoint with the segment "+" knob',
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
 * Insert a waypoint on the segment between waypoints 2 and 3 and show where it lands in the list.
 */
export default async function run({ page }) {
  const before = (await missionState(page)).waypoints
  await page.caption('Hover the segment between waypoints 2 and 3, click "+", "Add waypoint"')
  await insertViaKnob(page, 1, 'Add waypoint')
  await page.check('Five waypoints, the new one third', async () => {
    const { waypoints } = await missionState(page)
    const order = waypoints.map((w) => w.id)
    const kept = [before[0].id, before[1].id, before[2].id, before[3].id]
    const ok =
      waypoints.length === 5 &&
      order[0] === kept[0] &&
      order[1] === kept[1] &&
      order[3] === kept[2] &&
      order[4] === kept[3]
    return { ok, detail: `${waypoints.length} waypoints` }
  })
  await page.check('It sits on that segment', async () => {
    const w = (await missionState(page)).waypoints[2]
    const direct = distance(before[1], before[2])
    const via = distance(before[1], w) + distance(w, before[2])
    return { ok: via - direct < 3, detail: `${(via - direct).toFixed(1)} m off the line` }
  })
  await page.check('The others did not move', async () => {
    const { waypoints } = await missionState(page)
    return [0, 1, 3, 4].every((i, k) => near(waypoints[i], before[k], 1e-9))
  })
  await page.wait(1500)
}
