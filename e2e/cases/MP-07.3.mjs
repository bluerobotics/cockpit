import { drawPath4, insertViaKnob, waypointLabels } from '../lib/mission.mjs'

export const meta = { title: 'Subsequent waypoints are renumbered', route: '/mission-planning', needs: ['vehicle'] }

/**
 * The standard four-waypoint path, drawn before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
}

/**
 * Show the waypoint numbers, insert one between 2 and 3, and show the numbers after it shift.
 */
export default async function run({ page }) {
  await page.caption('Show waypoint numbers')
  await page.click('button:has(.mdi-numeric-1-circle-outline)', { settle: 1200 })
  const before = await waypointLabels(page)
  await page.check('Numbered 1 to 4', () => ({ ok: before.join() === '1,2,3,4', detail: before.join(' ') }))
  await page.caption('Insert a waypoint between 2 and 3')
  await insertViaKnob(page, 1, 'Add waypoint')
  await page.moveTo({ x: 800, y: 900 })
  await page.wait(800)
  await page.caption('The new one is 3; the old 3 and 4 are now 4 and 5')
  await page.check('Numbered 1 to 5, no gaps or repeats', async () => {
    const after = await waypointLabels(page)
    return { ok: after.join() === '1,2,3,4,5', detail: after.join(' ') }
  })
  await page.wait(1500)
}
