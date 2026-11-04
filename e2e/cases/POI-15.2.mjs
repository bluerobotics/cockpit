import { openCockpit } from '../lib/cockpit.mjs'
import { checkPoisBack, placeTwoPois } from '../lib/poi-persist.mjs'

export const meta = {
  title: 'POIs survive a browser restart',
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
 * Quit the browser, start it again on the same profile, and show both POIs come back.
 */
export default async function run({ page, url }) {
  await page.caption('Two points of interest on the map')
  await checkPoisBack(page, placed, 2000)
  await page.caption('Quit the browser and open Cockpit again, same browser profile')
  await page.wait(1500)
  await page.restartBrowser()
  await openCockpit(page, { url, route: '/mission-planning' })
  await page.caption('After the restart, both are still there')
  await checkPoisBack(page, placed)
  await page.wait(1500)
}
