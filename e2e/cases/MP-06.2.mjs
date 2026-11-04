import { geoToPage, missionState, near, pageToGeo } from '../lib/cockpit.mjs'
import { drawPath4, setHomeByPill, uploadMission, vehicleRoute } from '../lib/mission.mjs'

export const meta = {
  title: 'A dragged waypoint reaches the vehicle on upload',
  route: '/mission-planning',
  needs: ['vehicle'],
}

/**
 * Path and home, uploaded once before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
  await setHomeByPill(page, [0.36, 0.7])
  if (!(await uploadMission(page))) throw new Error('setup upload failed')
  await page.click('text=Close', { settle: 800 })
}

/**
 * Drag waypoint 2, upload again, and read the vehicle's copy back to show the new position there.
 */
export default async function run({ page, vehicle }) {
  const before = (await vehicleRoute(vehicle)).waypoints
  const { waypoints } = await missionState(page)
  await page.check('Vehicle has waypoint 2 at its first position', () => near(before[1], waypoints[1], 2e-7))
  await page.caption('Drag waypoint 2 to a new place')
  const dropped = await page.drag(await geoToPage(page, 'planning', waypoints[1]), { dx: 50, dy: -80 })
  const expected = await pageToGeo(page, 'planning', dropped)
  await page.caption('Upload again')
  await page.check('"Mission upload succeeded"', () => uploadMission(page))
  await page.click('text=Close', { settle: 800 })
  await page.caption("Read the vehicle's mission back")
  const after = (await vehicleRoute(vehicle)).waypoints
  await page.check('Vehicle waypoint 2 is at the dragged position', () => ({
    ok: near(after[1], expected, 3e-5),
    detail: `${after[1].lat.toFixed(6)}, ${after[1].lon.toFixed(6)}`,
  }))
  await page.check('The other vehicle waypoints did not move', () =>
    [0, 2, 3].every((i) => near(after[i], before[i], 2e-7))
  )
  await page.wait(1500)
}
