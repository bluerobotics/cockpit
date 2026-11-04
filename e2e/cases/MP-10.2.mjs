import { geoToPage, missionState, openCockpit, TEST_USER } from '../lib/cockpit.mjs'
import {
  addWaypointCommand,
  deselectWaypoint,
  drawPath4,
  sawSnackbar,
  setHomeByPill,
  uploadMission,
  vehicleRoute,
} from '../lib/mission.mjs'

export const meta = {
  title: 'The command survives upload and download',
  route: '/mission-planning',
  needs: ['vehicle'],
}

/**
 * Path with DO_SET_SERVO on waypoint 2, and a home, set before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
  await addWaypointCommand(page, 1, 'DO_SET_SERVO', { 1: 5, 2: 1900 })
  await deselectWaypoint(page)
  await setHomeByPill(page, [0.36, 0.7])
}

/**
 * Upload, check the autopilot holds the command after waypoint 2, then download it into a fresh
 * profile and show waypoint 2 still carries it.
 */
export default async function run({ page, vehicle, url }) {
  await page.caption('Upload the mission with the command on waypoint 2')
  await page.check('"Mission upload succeeded"', () => uploadMission(page))
  await page.click('text=Close', { settle: 800 })
  await page.check('Vehicle holds DO_SET_SERVO 5, 1900 right after waypoint 2', async () => {
    const { items } = await vehicleRoute(vehicle)
    const navs = items.map((it, i) => ({ ...it, i })).filter((it) => it.command === 'MAV_CMD_NAV_WAYPOINT')
    const wp2 = navs[2] // item 0 is home
    const servo = items.find((it, i) => i > wp2.i && it.command === 'MAV_CMD_DO_SET_SERVO')
    const before3 = servo && servo.seq < navs[3].seq
    return {
      ok: Boolean(servo) && before3 && servo.params[0] === 5 && servo.params[1] === 1900,
      detail: items.map((it) => it.command.replace('MAV_CMD_', '')).join(', '),
    }
  })

  await page.caption('Another computer: a fresh profile downloads the mission')
  await vehicle.setSyncedSetting(TEST_USER, 'cockpit-draft-mission', {})
  await page.restartBrowser({ freshProfile: true })
  await openCockpit(page, { url, route: '/mission-planning' })
  const downloaded = sawSnackbar(page, 'Mission download succeeded!', 30000)
  await page.click('text=DOWNLOAD MISSION FROM VEHICLE', { settle: 1500 })
  await page.check('"Mission download succeeded!"', () => downloaded)
  const { waypoints } = await missionState(page)
  await page.caption('Open waypoint 2')
  await page.click(await geoToPage(page, 'planning', waypoints[1]), { settle: 1200 })
  await page.check('Downloaded waypoint 2 carries DO_SET_SERVO 5, 1900', async () => {
    const cmds = (await missionState(page)).waypoints[1].commands
    const servo = cmds.find((c) => c.command === 'MAV_CMD_DO_SET_SERVO')
    return {
      ok: servo?.param1 === 5 && servo?.param2 === 1900,
      detail: cmds.map((c) => c.command.replace('MAV_CMD_', '')).join(', '),
    }
  })
  await page.wait(1500)
}
