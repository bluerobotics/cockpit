import { drawSimplePath } from '../lib/cockpit.mjs'
import {
  missionPanelButton,
  planningZoom,
  reopenAsAnotherComputer,
  RUN_PATH,
  setCruiseSpeed,
  setHomeByPill,
  uploadMission,
  vehicleRoute,
  waitArrival,
} from '../lib/mission.mjs'

export const meta = {
  title: 'Run a mission that was already on the vehicle',
  route: '/mission-planning',
  needs: ['vehicle'],
}

/**
 * Upload a short mission, then reopen as another computer on the Flight view, so this Cockpit never
 * uploaded what it is about to run.
 */
export async function setup(ctx) {
  const { page } = ctx
  await planningZoom(page)
  await drawSimplePath(page, RUN_PATH)
  await setCruiseSpeed(page, 3)
  await setHomeByPill(page, [0.42, 0.62])
  if (!(await uploadMission(page))) throw new Error('setup upload failed')
  await reopenAsAnotherComputer(ctx, '/')
}

/**
 * Press play and follow the vehicle through the mission it already had.
 */
export default async function run({ page, vehicle }) {
  const route = (await vehicleRoute(vehicle)).waypoints
  await page.caption(`A mission this Cockpit never uploaded is on the vehicle (${route.length} waypoints). Play`)
  await page.click(await missionPanelButton(page, 'mdi-play'), { settle: 1500 })
  await page.check('Vehicle armed and in AUTO', async () => {
    await page
      .waitFor(async () => (await vehicle.heartbeat()).custom_mode === 10, { timeout: 20000, label: 'AUTO' })
      .catch(() => undefined)
    const hb = await vehicle.heartbeat()
    return { ok: Boolean(hb.base_mode.bits & 128) && hb.custom_mode === 10, detail: `mode ${hb.custom_mode}` }
  })
  for (const [i, wp] of route.entries()) {
    // ArduRover takes a waypoint as reached when it crosses the line square to its path, so it can
    // pass a few metres to the side rather than over it.
    const closest = await waitArrival(vehicle, wp, {
      radius: 6,
      onTick: (gap) => page.caption(`Heading for waypoint ${i + 1} of ${route.length} · ${gap.toFixed(0)} m`),
    })
    await page.check(`Reached waypoint ${i + 1}`, () => ({
      ok: closest <= 6,
      detail: `closest ${closest.toFixed(1)} m`,
    }))
  }
  await page.wait(1500)
}
