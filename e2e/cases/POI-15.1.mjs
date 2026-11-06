import { dismissTutorial, vehicleOnline } from '../lib/cockpit.mjs'
import { checkPoisBack, placeTwoPois } from '../lib/poi-persist.mjs'

export const meta = {
  title: 'POIs survive a page reload',
  route: '/mission-planning',
  needs: ['vehicle'],
}

let placed

/**
 * Two POIs, placed and synced before recording.
 */
export async function setup({ page }) {
  placed = await placeTwoPois(page)
}

/**
 * Reload the page and show both POIs come back where they were.
 */
export default async function run({ page }) {
  await page.caption('Two points of interest on the map')
  await checkPoisBack(page, placed, 2000)
  await page.caption('Reload the page')
  await page.reload()
  await page.waitFor(() => vehicleOnline(page), { label: 'the vehicle to come online', timeout: 45000 })
  await dismissTutorial(page, 9000)
  await page.caption('After the reload, both are still there')
  await checkPoisBack(page, placed)
  await page.wait(1500)
}
