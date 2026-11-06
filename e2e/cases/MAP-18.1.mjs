import { planUploadAndRun, RUN_PATH, waitArrival } from '../lib/mission.mjs'

export const meta = { title: 'Run a mission that was just uploaded', route: '/mission-planning', needs: ['vehicle'] }

/**
 * Plan, upload and play a short mission, and follow the vehicle to its last waypoint.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Plan a short mission, upload it, Flight view, play')
  const waypoints = await planUploadAndRun(page, vehicle, RUN_PATH, 3)
  await page.check('Vehicle armed and in AUTO', async () => {
    const hb = await vehicle.heartbeat()
    return { ok: Boolean(hb.base_mode.bits & 128) && hb.custom_mode === 10, detail: `mode ${hb.custom_mode}` }
  })
  for (const [i, wp] of waypoints.entries()) {
    // ArduRover takes a waypoint as reached when it crosses the line square to its path, so it can
    // pass a few metres to the side rather than over it.
    const closest = await waitArrival(vehicle, wp, {
      radius: 6,
      onTick: (gap) => page.caption(`Heading for waypoint ${i + 1} of ${waypoints.length} · ${gap.toFixed(0)} m`),
    })
    await page.check(`Reached waypoint ${i + 1}`, () => ({
      ok: closest <= 6,
      detail: `closest ${closest.toFixed(1)} m`,
    }))
  }
  await page.wait(1500)
}
