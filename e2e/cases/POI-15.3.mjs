import { openCockpit } from '../lib/cockpit.mjs'
import { checkPoisBack, checkVehicleCopy, placeTwoPois } from '../lib/poi-persist.mjs'

export const meta = {
  title: 'POIs are restored from the vehicle on a new computer',
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
 * Open Cockpit in a brand-new browser profile, as on another computer, and show the POIs arrive
 * from the vehicle.
 */
export default async function run({ page, vehicle, url }) {
  await page.caption('Two points of interest, synced to the vehicle')
  await checkPoisBack(page, placed, 2000)
  await checkVehicleCopy(page, vehicle)
  await page.caption('A brand-new browser profile: nothing stored locally, same user and vehicle')
  await page.wait(1500)
  await page.restartBrowser({ freshProfile: true })
  await openCockpit(page, { url, route: '/mission-planning' })
  await page.caption('They arrive from the vehicle')
  await checkPoisBack(page, placed)
  await page.wait(1500)
}
