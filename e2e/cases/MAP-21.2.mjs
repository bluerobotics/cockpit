import { allOnScreen, CENTER, openCenterDial, panAway } from '../lib/centering.mjs'
import { missionState } from '../lib/cockpit.mjs'
import { drawPath4 } from '../lib/mission.mjs'

export const meta = {
  title: 'Center on the mission in mission planning',
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
 * Pan the planning map away from the mission, then center on it with the centering control.
 */
export default async function run({ page }) {
  const { waypoints } = await missionState(page)
  await page.caption('Pan the planning map away from the mission')
  await panAway(page, 'planning')
  await page.check('Mission is not fully on screen', async () => {
    const { ok, inside } = await allOnScreen(page, 'planning', waypoints)
    return { ok: !ok, detail: `${inside}/${waypoints.length} waypoints visible` }
  })
  await page.caption('Centering control, then "center on mission"')
  await openCenterDial(page)
  await page.click(CENTER.mission, { settle: 2000 })
  await page.check('The whole mission is on screen', async () => {
    const { ok, inside } = await allOnScreen(page, 'planning', waypoints)
    return { ok, detail: `${inside}/${waypoints.length} waypoints visible` }
  })
  await page.wait(1500)
}
