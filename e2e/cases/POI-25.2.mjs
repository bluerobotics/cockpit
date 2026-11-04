import { mapPoint, placePoi, poiHeading, wheelZoom } from '../lib/cockpit.mjs'

export const meta = {
  title: 'A heading taken from a data lake variable turns live',
  route: '/mission-planning',
  needs: ['vehicle'],
}

/**
 * A user data lake variable "poi_heading" at 0, created before recording.
 */
export async function setup({ page }) {
  await page.eval(
    `window.cockpit.createDataLakeVariable({ id: 'poi_heading', name: 'poi_heading', type: 'number' }, 0)`
  )
}

/**
 * Bind a POI's heading to the variable, change the variable, and show the tip turn.
 */
export default async function run({ page }) {
  await wheelZoom(page, 'planning', 18)
  await page.caption('Place a point of interest whose heading follows the data lake variable poi_heading')
  await placePoi(page, 'planning', await mapPoint(page, 'planning', 0.62, 0.4), 'Live heading', {
    heading: '{{ poi_heading }}',
  })
  await page.hover(await mapPoint(page, 'planning', 0.5, 0.85), 800)
  for (const value of [0, 180, 270]) {
    await page.caption(`poi_heading is set to ${value} (as an external source would)`)
    await page.eval(`window.cockpit.setDataLakeVariableData('poi_heading', ${value})`)
    await page.wait(1200)
    await page.check(`Tip points to ${value}°`, async () => {
      const heading = await poiHeading(page, 'planning')
      return {
        ok: heading !== null && Math.abs(((heading - value + 540) % 360) - 180) < 1,
        detail: heading === null ? 'no tip' : `${heading.toFixed(0)}°`,
      }
    })
  }
  await page.wait(1500)
}
