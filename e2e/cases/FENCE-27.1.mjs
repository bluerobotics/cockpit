import { near } from '../lib/cockpit.mjs'
import { drawFencePolygon, FENCE_SQUARE, fenceState, openFenceTab } from '../lib/fence.mjs'

export const meta = { title: 'Draw an inclusion polygon fence', route: '/mission-planning', needs: ['vehicle'] }

/**
 * Draw a square inclusion fence around the vehicle in the GeoFence tab.
 */
export default async function run({ page }) {
  await page.caption('Mission planning, GeoFence tab')
  await openFenceTab(page)
  await page.caption('"Add polygon fence", four corners around the vehicle, finish')
  const corners = await drawFencePolygon(page, FENCE_SQUARE)
  await page.check('One polygon fence with the four clicked corners', async () => {
    const { polygons } = await fenceState(page)
    const ok =
      polygons.length === 1 &&
      polygons[0].vertices.length === 4 &&
      polygons[0].vertices.every(([lat, lon], i) => near({ lat, lon }, corners[i], 2e-5))
    return { ok, detail: `${polygons.length} polygons, ${polygons[0]?.vertices.length ?? 0} vertices` }
  })
  await page.check('It is an inclusion fence', async () => (await fenceState(page)).polygons[0]?.inclusion === true)
  await page.wait(1500)
}
