import { fieldByLabel, mapPoint, placePoi, poiHeading, poiMarkers, wheelZoom } from '../lib/cockpit.mjs'

export const meta = { title: 'Clearing the heading removes the tip', route: '/mission-planning', needs: ['vehicle'] }

/**
 * A POI with a 90° heading, placed before recording.
 */
export async function setup({ page }) {
  await wheelZoom(page, 'planning', 18)
  await placePoi(page, 'planning', await mapPoint(page, 'planning', 0.62, 0.4), 'East facing', { heading: 90 })
}

/**
 * Edit the POI, clear its heading, save, and show the tip disappear.
 */
export default async function run({ page }) {
  await page.check('POI has a heading tip', async () => (await poiHeading(page, 'planning')) !== null)
  await page.caption('Open the point of interest, edit it, clear the heading, save')
  const [marker] = await poiMarkers(page, 'planning')
  await page.click(marker.grab, { settle: 1200 })
  await page.click('i.v-icon.mdi-pencil', { settle: 1200 })
  await page.fill(await fieldByLabel(page, 'Heading (optional)'), '')
  await page.key('Backspace', { show: false })
  await page.click('text=Save', { settle: 1500 })
  await page.check('The tip is gone', async () => (await poiHeading(page, 'planning')) === null)
  await page.wait(1500)
}
