import { missionState } from '../lib/cockpit.mjs'
import { addWaypointCommand, drawPath4 } from '../lib/mission.mjs'

export const meta = { title: 'Add a MAVLink command to a waypoint', route: '/mission-planning', needs: ['vehicle'] }

/**
 * The standard four-waypoint path, drawn before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
}

/**
 * Add DO_SET_SERVO (output 5, 1900 µs) to waypoint 2 and show it in the panel, on the marker and in the plan.
 */
export default async function run({ page }) {
  await page.caption('Open waypoint 2, "Append new command": DO_SET_SERVO, output 5, 1900 µs')
  await addWaypointCommand(page, 1, 'DO_SET_SERVO', { 1: 5, 2: 1900 })
  await page.caption('The command is listed on the waypoint')
  await page.check('Panel lists two commands on waypoint 2', async () =>
    (await page.text()).includes('Waypoint Commands (2)')
  )
  await page.check('Waypoint 2 carries DO_SET_SERVO 5, 1900', async () => {
    const cmds = (await missionState(page)).waypoints[1].commands
    const servo = cmds.find((c) => c.command === 'MAV_CMD_DO_SET_SERVO')
    return {
      ok: servo?.param1 === 5 && servo?.param2 === 1900,
      detail: cmds.map((c) => c.command.replace('MAV_CMD_', '')).join(', '),
    }
  })
  await page.check(
    'Its marker shows a command count badge',
    async () => (await page.count('#planningMap .command-count-indicator')) >= 1
  )
  await page.wait(1500)
}
