import { drawSimplePath, mapPolylines, missionState, near, waypointMarkerCount, wheelZoom } from '../lib/cockpit.mjs'

export const meta = {
  title: 'Create a simple path from the sidebar',
  route: '/mission-planning',
  needs: ['vehicle'],
}

const POINTS = [
  [0.42, 0.34],
  [0.6, 0.36],
  [0.66, 0.56],
  [0.48, 0.64],
]

/**
 * Draw a four-waypoint simple path and prove it on the map and in the mission.
 */
export default async function run({ page }) {
  await page.caption('An empty mission')
  await page.check('Mission starts empty', async () => {
    const { waypoints } = await missionState(page)
    return { ok: waypoints.length === 0, detail: `${waypoints.length} waypoints` }
  })
  await wheelZoom(page, 'planning', 18)

  await page.caption('"Create simple path", then one click per waypoint')
  const clicked = await drawSimplePath(page, POINTS, {
    onPoint: (i) => page.caption(`Waypoint ${i + 1} of ${POINTS.length}`),
  })

  await page.caption('Four waypoints, joined by the path line')
  await page.check('4 waypoint markers on the map', async () => {
    const n = await waypointMarkerCount(page)
    return { ok: n === 4, detail: `${n} markers` }
  })
  await page.check('Mission has 4 waypoints, in click order, where clicked', async () => {
    const { waypoints } = await missionState(page)
    const ok = waypoints.length === 4 && waypoints.every((w, i) => near(w, clicked[i]))
    return { ok, detail: `${waypoints.length} waypoints` }
  })
  await page.check('A path line runs through the waypoints in order', async () => {
    const { waypoints } = await missionState(page)
    const line = (await mapPolylines(page, 'planning')).find(
      (pts) => pts.length >= waypoints.length && waypoints.every((w, i) => near(pts[i], w))
    )
    return { ok: Boolean(line), detail: line ? `${line.length} points` : 'no matching line' }
  })
  await page.wait(1500)
}
