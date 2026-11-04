import { missionPanelButton, planUploadAndRun, ROVER } from '../lib/mission.mjs'
import { LONG_PATH } from '../lib/speed.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = { title: 'Return home from the panel', route: '/mission-planning', needs: ['vehicle'] }

/**
 * Press return-home on a running mission and show the vehicle head for its home.
 */
export default async function run({ page, vehicle }) {
  const origin = await vehicle.position()
  await page.caption('Run a long mission')
  await planUploadAndRun(page, vehicle, LONG_PATH, 3)
  await page.wait(12000)
  await page.caption('Return home')
  await page.click(await missionPanelButton(page, 'mdi-home-circle'), { settle: 1000 })
  await page.caption('Confirm "Return to home"')
  await page.click('text=Confirm', { settle: 2500 })
  await page.check('Vehicle switched to a return-home mode', async () => {
    const mode = (await vehicle.heartbeat()).custom_mode
    return { ok: mode === ROVER.RTL || mode === ROVER.SMART_RTL, detail: `mode ${mode}` }
  })
  // SMART_RTL retraces the driven path back to where the vehicle armed, which is where it started. A boat
  // at cruise speed first needs room to slow down and turn, so it is watched for a while.
  const start = distance(await vehicle.position(), origin)
  let closest = start
  for (let i = 0; i < 40; i++) {
    closest = Math.min(closest, distance(await vehicle.position(), origin))
    await page.caption(`Returning · ${closest.toFixed(0)} m from where it started`)
    await page.wait(1000)
  }
  await page.check('Vehicle headed back to where it started', () => ({
    ok: closest < start - 10,
    detail: `${start.toFixed(0)} m → ${closest.toFixed(0)} m at closest`,
  }))
  await page.wait(1500)
}
