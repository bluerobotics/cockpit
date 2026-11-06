import { drawSimplePath, near } from '../lib/cockpit.mjs'
import {
  homeMarker,
  missionPanelButton,
  planningZoom,
  RUN_PATH,
  setCruiseSpeed,
  setHomeByPill,
  startUploadedMission,
  uploadMission,
  vehicleHome,
} from '../lib/mission.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = { title: 'New home is used at mission runtime', route: '/mission-planning', needs: ['vehicle'] }

let planned

/**
 * A short mission with a mission home placed away from the vehicle's home, uploaded before recording.
 */
export async function setup({ page }) {
  await planningZoom(page)
  await drawSimplePath(page, RUN_PATH)
  await setCruiseSpeed(page, 3)
  planned = await setHomeByPill(page, [0.3, 0.75])
  if (!(await uploadMission(page))) throw new Error('setup upload failed')
}

/**
 * Run the mission, then return home from the mission control panel, and show where the vehicle goes.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Uploaded with a new mission home. Flight view, play')
  await startUploadedMission(page, vehicle)
  await page.check('Map widget shows home at the new place', async () => {
    const marker = await homeMarker(page, 'widget')
    return {
      ok: Boolean(marker) && near(marker, planned, 2e-5),
      detail: marker ? `${marker.lat.toFixed(6)}, ${marker.lon.toFixed(6)}` : 'none',
    }
  })
  await page.check('Autopilot home is the new place', async () => {
    const home = await vehicleHome(vehicle)
    return {
      ok: Boolean(home) && near(home, planned, 2e-6),
      detail: `${home?.lat.toFixed(6)}, ${home?.lon.toFixed(6)}`,
    }
  })
  await page.wait(4000)
  await page.caption('Return home from the mission control panel')
  await page.click(await missionPanelButton(page, 'mdi-home-circle'), { settle: 1000 })
  await page.click('text=Confirm', { settle: 1500 })
  const returnMode = await page
    .waitFor(async () => [11, 12].includes((await vehicle.heartbeat())?.custom_mode), {
      timeout: 10000,
      label: 'return mode',
    })
    .then(() => true)
    .catch(() => false)
  await page.check('Cockpit switched the vehicle to a return mode', async () => {
    const mode = (await vehicle.heartbeat())?.custom_mode
    return { ok: returnMode, detail: `mode ${mode} (${{ 11: 'RTL', 12: 'SmartRTL' }[mode] ?? 'other'})` }
  })
  // SmartRTL, which the button prefers, retraces the path to where the boat was armed rather than heading
  // for the home point, so whether the new home is used is checked in RTL.
  await page.caption('RTL: the vehicle heads straight for the home point')
  await vehicle.command('MAV_CMD_DO_SET_MODE', [1, 11])
  const start = await vehicle.position()
  const startGap = distance(start, planned)
  // Waited for rather than timed, since a busy machine runs the simulator slower than real time.
  await page
    .waitFor(async () => distance(await vehicle.position(), planned) < startGap - 10, {
      timeout: 40000,
      label: 'RTL progress',
    })
    .catch(() => undefined)
  const end = await vehicle.position()
  const mode = (await vehicle.heartbeat()).custom_mode
  await page.check('In RTL the vehicle heads for the new home', () => {
    const gap = distance(end, planned)
    return { ok: gap < startGap - 10, detail: `mode ${mode}, ${Math.round(startGap)} m → ${Math.round(gap)} m from it` }
  })
  await page.wait(1500)
}
