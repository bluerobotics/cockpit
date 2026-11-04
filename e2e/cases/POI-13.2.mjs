import { mapPoint, pageToGeo, placePoi, poiAt, poiMarkers, toFlight, wheelZoom } from '../lib/cockpit.mjs'

export const meta = {
  title: 'Move a POI in mission planning',
  route: '/mission-planning',
  needs: ['vehicle'],
}

let placed

/**
 * One POI on the planning map, placed before recording.
 */
export async function setup({ page }) {
  await wheelZoom(page, 'planning', 17)
  placed = await placePoi(page, 'planning', await mapPoint(page, 'planning', 0.6, 0.4), 'Survey stake')
}

/**
 * Drag the POI on the planning map, then show it at the new place on the Map widget.
 */
export default async function run({ page }) {
  const before = await poiAt(page, 'planning', placed)
  await page.check('POI is on the planning map', () => Boolean(before))

  await page.caption('Drag the point of interest to a new place')
  const delta = { dx: 150, dy: 120 }
  await page.drag(before.grab, delta)
  const expected = await pageToGeo(page, 'planning', { x: before.x + delta.dx, y: before.y + delta.dy })

  await page.check('POI moved to where it was dropped', async () => {
    const [poi] = await poiMarkers(page, 'planning')
    const ok = Math.abs(poi.lat - expected.lat) < 2e-5 && Math.abs(poi.lon - expected.lon) < 2e-5
    return { ok, detail: `${poi.lat.toFixed(6)}, ${poi.lon.toFixed(6)}` }
  })

  await page.caption('The Map widget shows it at the new place')
  await toFlight(page)
  await page.check('Map widget has it at the new coordinates', async () => {
    const poi = await poiAt(page, 'widget', expected, 2e-5)
    return { ok: Boolean(poi), detail: poi ? `${poi.lat.toFixed(6)}, ${poi.lon.toFixed(6)}` : 'not there' }
  })
  await page.check('and not at the old ones', async () => !(await poiAt(page, 'widget', placed, 2e-6, false)))
  await page.wait(1500)
}
