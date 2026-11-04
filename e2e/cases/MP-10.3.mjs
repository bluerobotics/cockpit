import { drawSimplePath, missionState } from '../lib/cockpit.mjs'
import {
  addWaypointCommand,
  deselectWaypoint,
  planningZoom,
  RUN_PATH,
  setCruiseSpeed,
  setHomeByPill,
  startUploadedMission,
  uploadMission,
} from '../lib/mission.mjs'

export const meta = {
  title: 'The command is performed during the mission',
  route: '/mission-planning',
  needs: ['vehicle'],
}

const servo5 = async (vehicle) => (await vehicle.read('SERVO_OUTPUT_RAW'))?.servo5_raw

/**
 * A short mission near the vehicle with DO_SET_SERVO on waypoint 2, uploaded, and output 5 parked at 1100 µs.
 */
export async function setup({ page, vehicle }) {
  await planningZoom(page)
  await drawSimplePath(page, RUN_PATH)
  await addWaypointCommand(page, 1, 'DO_SET_SERVO', { 1: 5, 2: 1900 })
  await deselectWaypoint(page)
  await setCruiseSpeed(page, 3)
  await setHomeByPill(page, [0.42, 0.62])
  if (!(await uploadMission(page))) throw new Error('setup upload failed')
  await vehicle.command('MAV_CMD_DO_SET_SERVO', [5, 1100])
}

/**
 * Run the mission and watch output 5: still 1100 µs until waypoint 2, 1900 µs after it.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Uploaded: DO_SET_SERVO on waypoint 2. Output 5 sits at 1100 µs')
  await page.check('Output 5 at 1100 µs before the mission', async () => ({
    ok: (await servo5(vehicle)) === 1100,
    detail: `${await servo5(vehicle)} µs`,
  }))
  await page.caption('Flight view, press play')
  await startUploadedMission(page, vehicle)
  await page.check('Vehicle armed and in AUTO', async () => {
    const hb = await vehicle.heartbeat()
    return { ok: Boolean(hb.base_mode.bits & 128) && hb.custom_mode === 10, detail: `mode ${hb.custom_mode}` }
  })

  // Mission item sequence on the vehicle: 0 home, 1 wp1, 2 speed change, 3 wp2, 4 servo, 5 wp3...
  const { waypoints } = await missionState(page)
  let beforeWp2 = null
  let afterWp2 = null
  const deadline = Date.now() + 90000
  await page.caption('Watching the vehicle reach waypoint 2')
  while (Date.now() < deadline && afterWp2 === null) {
    const current = (await vehicle.read('MISSION_CURRENT'))?.seq ?? 0
    const pwm = await servo5(vehicle)
    if (current <= 3) beforeWp2 = pwm
    else afterWp2 = pwm
    await page.caption(`Heading for mission item ${current} · output 5: ${pwm} µs`)
    await page.wait(700)
  }
  await page.check('Still 1100 µs on the way to waypoint 2', () => ({
    ok: beforeWp2 === 1100,
    detail: `${beforeWp2} µs`,
  }))
  await page.check('1900 µs once waypoint 2 is reached', async () => {
    await page.wait(1500)
    const pwm = await servo5(vehicle)
    return { ok: pwm === 1900, detail: `${pwm} µs (${waypoints.length} waypoints)` }
  })
  await page.wait(1500)
}
