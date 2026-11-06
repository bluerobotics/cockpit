import { mapPoint, placePoi, poiHeading, wheelZoom } from '../lib/cockpit.mjs'

export const meta = { title: 'A fixed heading points the POI marker', route: '/mission-planning', needs: ['vehicle'] }

/**
 * Place a POI with a heading of 90° and show its tip pointing east.
 */
export default async function run({ page }) {
  await wheelZoom(page, 'planning', 18)
  await page.caption('Place a point of interest with "Heading (optional)" = 90')
  await placePoi(page, 'planning', await mapPoint(page, 'planning', 0.62, 0.4), 'East facing', { heading: 90 })
  await page.hover(await mapPoint(page, 'planning', 0.5, 0.85), 1000)
  await page.check('Marker tip points east (90°)', async () => {
    const heading = await poiHeading(page, 'planning')
    return {
      ok: heading !== null && Math.abs(heading - 90) < 1,
      detail: heading === null ? 'no tip' : `${heading.toFixed(0)}°`,
    }
  })
  await page.wait(1500)
}
