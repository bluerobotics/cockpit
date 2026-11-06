import { mapPoint, missionState, near } from '../lib/cockpit.mjs'
import { addWaypointHere, drawPath4 } from '../lib/mission.mjs'

export const meta = { title: 'Undo and redo with the toolbar buttons', route: '/mission-planning', needs: ['vehicle'] }

/**
 * The standard four-waypoint path, drawn before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
}

/**
 * Add a fifth waypoint, undo it with the toolbar button, redo it, and show it come back unchanged.
 */
export default async function run({ page }) {
  const count = async () => (await missionState(page)).waypoints.length
  await page.caption('Add a fifth waypoint')
  const added = await addWaypointHere(page, await mapPoint(page, 'planning', 0.32, 0.5))
  await page.check('Five waypoints', async () => ({ ok: (await count()) === 5, detail: `${await count()}` }))
  await page.caption('Undo')
  await page.click('button:has(.mdi-undo)', { settle: 1000 })
  await page.check('Undo takes it away: four waypoints', async () => ({
    ok: (await count()) === 4,
    detail: `${await count()}`,
  }))
  await page.caption('Redo')
  await page.click('button:has(.mdi-redo)', { settle: 1000 })
  await page.check('Redo brings it back, at the same place', async () => {
    const { waypoints } = await missionState(page)
    return { ok: waypoints.length === 5 && near(waypoints[4], added), detail: `${waypoints.length}` }
  })
  await page.wait(1500)
}
