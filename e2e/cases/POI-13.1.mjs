import { mapPoint, pageToGeo, placePoi, poiAt, poiMarkers, toPlanning, wheelZoom } from '../lib/cockpit.mjs'

export const meta = {
  title: 'Move a POI in the Map widget',
  route: '/',
  needs: ['vehicle'],
}

let placed

/**
 * One POI on the Map widget, placed before recording.
 */
export async function setup({ page }) {
  await wheelZoom(page, 'widget', 17)
  placed = await placePoi(page, 'widget', await mapPoint(page, 'widget', 0.6, 0.4), 'Drift marker')
}

/**
 * Drag the POI on the widget, then show it at the new place in mission planning.
 */
export default async function run({ page }) {
  const before = await poiAt(page, 'widget', placed)
  await page.check('POI is on the Map widget', () => Boolean(before))

  await page.caption('Drag the point of interest to a new place')
  const delta = { dx: 170, dy: -90 }
  await page.drag(before.grab, delta)
  const expected = await pageToGeo(page, 'widget', { x: before.x + delta.dx, y: before.y + delta.dy })

  await page.check('POI moved to where it was dropped', async () => {
    const [poi] = await poiMarkers(page, 'widget')
    const ok = Math.abs(poi.lat - expected.lat) < 2e-5 && Math.abs(poi.lon - expected.lon) < 2e-5
    return { ok, detail: `${poi.lat.toFixed(6)}, ${poi.lon.toFixed(6)}` }
  })

  await page.caption('Mission planning shows it at the new place')
  await toPlanning(page)
  await page.check('Planning map has it at the new coordinates', async () => {
    const poi = await poiAt(page, 'planning', expected, 2e-5)
    return { ok: Boolean(poi), detail: poi ? `${poi.lat.toFixed(6)}, ${poi.lon.toFixed(6)}` : 'not there' }
  })
  await page.check('and not at the old ones', async () => !(await poiAt(page, 'planning', placed, 2e-6, false)))
  await page.wait(1500)
}
