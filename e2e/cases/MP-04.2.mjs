import { mapPoint, missionState, near } from '../lib/cockpit.mjs'
import { addWaypointHere, drawPath4 } from '../lib/mission.mjs'

export const meta = { title: 'Undo and redo with keyboard shortcuts', route: '/mission-planning', needs: ['vehicle'] }

/**
 * The standard four-waypoint path, drawn before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
}

/**
 * Add a fifth waypoint, then undo and redo it from the keyboard with both redo shortcuts.
 */
export default async function run({ page }) {
  const count = async () => (await missionState(page)).waypoints.length
  await page.caption('Add a fifth waypoint')
  const added = await addWaypointHere(page, await mapPoint(page, 'planning', 0.32, 0.5))
  await page.moveTo(await mapPoint(page, 'planning', 0.3, 0.85))

  await page.caption('⌘Z undoes')
  await page.key('Meta+z')
  await page.check('⌘Z: four waypoints', async () => ({ ok: (await count()) === 4, detail: `${await count()}` }))
  await page.caption('⌘⇧Z redoes')
  await page.key('Meta+Shift+z')
  await page.check('⌘⇧Z: five again, same place', async () => {
    const { waypoints } = await missionState(page)
    return waypoints.length === 5 && near(waypoints[4], added)
  })
  await page.caption('Once more with Ctrl+Y as the redo')
  await page.key('Meta+z')
  await page.check('⌘Z: four waypoints', async () => (await count()) === 4)
  await page.key('Control+y')
  await page.check('Ctrl+Y: five again, same place', async () => {
    const { waypoints } = await missionState(page)
    return waypoints.length === 5 && near(waypoints[4], added)
  })
  await page.wait(1500)
}
