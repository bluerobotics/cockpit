// Steps shared by the POI-15 cases: two points of interest placed before recording, and the check
// that they are still there, where they were, after Cockpit comes back.

import { mapPoint, placePoi, poiAt, TEST_USER, wheelZoom } from './cockpit.mjs'
import { sleep } from './driver.mjs'

export const NAMES = ['Mooring A', 'Mooring B']

/**
 * Place two POIs on the planning map and wait out the settings sync debounce.
 * @param {object} page - Driver page
 * @returns {Promise<Array<{lat: number, lon: number}>>} Where they were placed
 */
export async function placeTwoPois(page) {
  await wheelZoom(page, 'planning', 16)
  const a = await placePoi(page, 'planning', await mapPoint(page, 'planning', 0.62, 0.38), NAMES[0])
  const b = await placePoi(page, 'planning', await mapPoint(page, 'planning', 0.4, 0.66), NAMES[1])
  // Synced settings are written once they stop changing for 3 s.
  await sleep(4500)
  return [a, b]
}

/**
 * Check both POIs are on the planning map at their original coordinates, waiting for them to load.
 * @param {object} page - Driver page
 * @param {Array<{lat: number, lon: number}>} placed - Where they were placed
 * @param {number} [timeout] - How long to wait for them, in ms
 */
export async function checkPoisBack(page, placed, timeout = 20000) {
  for (const [i, at] of placed.entries()) {
    await page.check(`"${NAMES[i]}" is back where it was`, async () => {
      const found = await page.waitFor(() => poiAt(page, 'planning', at, 1e-6), { timeout }).catch(() => false)
      return { ok: Boolean(found), detail: `${at.lat.toFixed(6)}, ${at.lon.toFixed(6)}` }
    })
  }
}

/**
 * Check the vehicle holds both POIs in the test user's synced settings.
 * @param {object} page - Driver page
 * @param {object} vehicle - Vehicle helpers
 */
export async function checkVehicleCopy(page, vehicle) {
  await page.check('The vehicle holds both POIs for this user', async () => {
    const pois = (await vehicle.getSyncedSetting(TEST_USER, 'cockpit-points-of-interest')) ?? []
    const names = pois.map((p) => p.name)
    return { ok: NAMES.every((n) => names.includes(n)), detail: names.join(', ') || 'none' }
  })
}
