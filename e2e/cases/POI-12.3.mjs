import { mapPoint, placePoi, poiAt, toFlight, toPlanning, wheelZoom } from '../lib/cockpit.mjs'

export const meta = {
  title: 'A POI created in one map shows in the other',
  route: '/mission-planning',
  needs: ['vehicle'],
}

const placed = {}

/**
 * One POI from each map, placed before recording.
 */
export async function setup({ page }) {
  await wheelZoom(page, 'planning', 17)
  placed.planning = await placePoi(page, 'planning', await mapPoint(page, 'planning', 0.62, 0.38), 'From planning')
  await toFlight(page)
  await wheelZoom(page, 'widget', 17)
  placed.widget = await placePoi(page, 'widget', await mapPoint(page, 'widget', 0.4, 0.62), 'From widget')
}

/**
 * Show both POIs on the Map widget, switch to mission planning, and show both there too.
 */
export default async function run({ page }) {
  await page.caption('Flight view: one POI placed here, one placed in mission planning')
  await page.check('Map widget shows the POI placed in mission planning', async () =>
    Boolean(await poiAt(page, 'widget', placed.planning))
  )
  await page.check('Map widget shows its own POI', async () => Boolean(await poiAt(page, 'widget', placed.widget)))

  await page.caption('Switch to mission planning')
  await toPlanning(page)
  await page.caption('Both are here too, at the same coordinates')
  await page.check('Planning map shows the POI placed on the widget', async () =>
    Boolean(await poiAt(page, 'planning', placed.widget))
  )
  await page.check('Planning map shows its own POI', async () =>
    Boolean(await poiAt(page, 'planning', placed.planning))
  )
  await page.wait(1500)
}
