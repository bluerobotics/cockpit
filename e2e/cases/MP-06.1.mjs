import { geoToPage, mapPolylines, missionState, near, pageToGeo } from '../lib/cockpit.mjs'
import { drawPath4 } from '../lib/mission.mjs'

export const meta = { title: 'Drag a waypoint', route: '/mission-planning', needs: ['vehicle'] }

/**
 * The standard four-waypoint path, drawn before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
}

/**
 * Drag waypoint 2 and show it, and only it, moved to the drop point, with the path line following.
 */
export default async function run({ page }) {
  const before = (await missionState(page)).waypoints
  await page.caption('Drag waypoint 2 to a new place')
  const dropped = await page.drag(await geoToPage(page, 'planning', before[1]), { dx: 40, dy: -90 })
  const expected = await pageToGeo(page, 'planning', dropped)

  await page.check('Waypoint 2 is where it was dropped', async () => {
    const { waypoints } = await missionState(page)
    return {
      ok: near(waypoints[1], expected, 2e-5),
      detail: `${waypoints[1].lat.toFixed(6)}, ${waypoints[1].lon.toFixed(6)}`,
    }
  })
  await page.check('The other waypoints did not move', async () => {
    const { waypoints } = await missionState(page)
    return [0, 2, 3].every((i) => near(waypoints[i], before[i], 1e-9))
  })
  await page.check('The path line follows it', async () => {
    const { waypoints } = await missionState(page)
    const lines = await mapPolylines(page, 'planning')
    return lines.some((pts) => waypoints.every((w, i) => pts[i] && near(pts[i], w, 1e-7)))
  })
  await page.caption('Its card shows the new coordinates')
  await page.rightClick(await geoToPage(page, 'planning', (await missionState(page)).waypoints[1]), { settle: 1200 })
  await page.check('Right-click card shows the new Lat./Long.', async () => {
    const text = await page.text()
    const shown = {
      lat: Number(text.match(/Lat\.:?\s*(-?\d+\.\d+)/)?.[1]),
      lon: Number(text.match(/Long\.:?\s*(-?\d+\.\d+)/)?.[1]),
    }
    const { waypoints } = await missionState(page)
    return { ok: near(shown, waypoints[1], 1e-6), detail: `card ${shown.lat}, ${shown.lon}` }
  })
  await page.wait(1500)
}
