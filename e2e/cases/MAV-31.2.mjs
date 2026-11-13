import { chooseOption } from '../lib/cockpit.mjs'
import { inspectorMessage, openMenuPage, trackMessage } from '../lib/mavlink-tools.mjs'
import { ROVER } from '../lib/mission.mjs'

export const meta = { title: 'Inspector lists outgoing messages', route: '/', needs: ['vehicle'] }

const MODE_SELECT = `[...document.querySelectorAll('.custom-select select')].find((s) => s.getClientRects().length && [...s.options].some((o) => o.text.trim() === 'Loiter'))`

/**
 * Track COMMAND_LONG, change the flight mode from the bottom bar, and find the command in the inspector.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Main menu → Tools → MAVLink, track COMMAND_LONG')
  await openMenuPage(page, 'tools-mavlink')
  await trackMessage(page, 'COMMAND_LONG')
  // Tracked messages live only while the inspector is open, and the mode selector stays reachable beside it.
  await page.caption('With the inspector open, switch the flight mode to Loiter')
  await chooseOption(page, MODE_SELECT, 'Loiter')
  await page.check('Vehicle switched to Loiter', async () => {
    await page
      .waitFor(async () => (await vehicle.heartbeat()).custom_mode === ROVER.LOITER, { timeout: 6000 })
      .catch(() => undefined)
    return (await vehicle.heartbeat()).custom_mode === ROVER.LOITER
  })
  await page.check('Inspector shows the outgoing set-mode command', async () => {
    const m = await inspectorMessage(page, 'COMMAND_LONG', 'outgoing')
    return {
      ok: m?.command?.type === 'MAV_CMD_DO_SET_MODE' && m.param2 === ROVER.LOITER,
      detail: m ? `${m.command?.type} param1 ${m.param1} param2 ${m.param2}` : 'no outgoing message shown',
    }
  })
  await page.wait(2000)
}
