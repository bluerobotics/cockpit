import { missionState, near, TEST_USER } from '../lib/cockpit.mjs'
import { drawPath4, setHomeByPill, uploadMission, vehicleHome } from '../lib/mission.mjs'

export const meta = { title: 'Uploaded home reaches the vehicle', route: '/mission-planning', needs: ['vehicle'] }

let planned

/**
 * Path and a mission home away from the vehicle's current home, set before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
  planned = await setHomeByPill(page, [0.34, 0.72])
}

/**
 * Upload, then ask the autopilot where its home is.
 */
export default async function run({ page, vehicle }) {
  const before = await vehicleHome(vehicle)
  await page.caption('Vehicle home before the upload, and a different mission home planned')
  await page.check('Planned home differs from the vehicle home', () => ({
    ok: Boolean(before) && !near(before, planned, 1e-5),
    detail: `vehicle ${before?.lat.toFixed(6)}, ${before?.lon.toFixed(6)}`,
  }))
  await page.caption('Upload the mission')
  await page.check('"Mission upload succeeded"', () => uploadMission(page))
  await page.check('Cockpit sent the planned home as item 0', async () => {
    const sent = await vehicle.getSyncedSetting(TEST_USER, 'cockpit-last-uploaded-mission')
    const first = sent?.waypoints?.[0]?.coordinates ?? (await missionState(page)).home
    return {
      ok: Boolean(first) && near({ lat: first[0], lon: first[1] }, planned),
      detail: first ? `${first[0].toFixed(6)}, ${first[1].toFixed(6)}` : 'not found',
    }
  })
  await page.caption('Ask the autopilot for its home')
  await page.check('Vehicle home is now the planned home', async () => {
    const after = await vehicleHome(vehicle)
    return {
      ok: Boolean(after) && near(after, planned, 2e-6),
      detail: `vehicle ${after?.lat.toFixed(6)}, ${after?.lon.toFixed(6)}`,
    }
  })
  await page.click('text=Close', { settle: 800 })
  await page.wait(1000)
}
