import { allOnScreen, CENTER, openCenterDial, panAway } from '../lib/centering.mjs'
import { missionState, wheelZoom } from '../lib/cockpit.mjs'
import { drawPath4, setHomeByPill, uploadMission } from '../lib/mission.mjs'

export const meta = { title: 'Center on the mission in the Map widget', route: '/mission-planning', needs: ['vehicle'] }

let waypoints

/**
 * Plan and upload a mission, then go to the Flight view, before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
  await setHomeByPill(page, [0.36, 0.7])
  if (!(await uploadMission(page))) throw new Error('setup upload failed')
  waypoints = (await missionState(page)).waypoints
  await page.click('text=Switch to Flight Mode', { settle: 3000 })
}

/**
 * Zoom out and pan away from the mission, then center on it with the centering control.
 */
export default async function run({ page }) {
  await page.caption('Move the map away from the mission')
  await wheelZoom(page, 'widget', 18)
  await panAway(page, 'widget')
  await page.check('Mission is not fully on screen', async () => {
    const { ok, inside } = await allOnScreen(page, 'widget', waypoints)
    return { ok: !ok, detail: `${inside}/${waypoints.length} waypoints visible` }
  })
  await page.caption('Centering control, then "center on mission"')
  await openCenterDial(page)
  await page.click(CENTER.mission, { settle: 2000 })
  await page.check('The whole mission is on screen', async () => {
    const { ok, inside } = await allOnScreen(page, 'widget', waypoints)
    return { ok, detail: `${inside}/${waypoints.length} waypoints visible` }
  })
  await page.wait(1500)
}
