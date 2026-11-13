import { setUpActions } from '../lib/act-case.mjs'
import { createCommandAction, sentMessages, spyOutgoing } from '../lib/act-dl.mjs'
import { clickActionButton, NO_ACTIONS } from '../lib/actions.mjs'

export const meta = {
  title: 'MAVLink actions arm and disarm, with their fields sent as set',
  route: '/',
  needs: ['vehicle'],
  synced: NO_ACTIONS,
}

export const setup = (ctx) => setUpActions(ctx, false)

const ARM_DISARM = 'MAV_CMD_COMPONENT_ARM_DISARM'

/**
 * Create "Arm (release)" from the dialog's COMMAND_LONG defaults and "Disarm (release)" with
 * Parameter 1 at 0, play one then the other, and check the vehicle and what Cockpit sent.
 */
export default async function run({ page, vehicle }) {
  await page.caption('New MAVLink Message Action "Arm (release)": COMMAND_LONG, the arm defaults')
  await createCommandAction(page, 'Arm (release)')
  await page.caption('Another, "Disarm (release)": the same with Parameter 1 at 0')
  await createCommandAction(page, 'Disarm (release)', { 'Parameter 1': 0 })
  await page.check('Both are listed as MAVLink Message actions', async () => {
    const rows = await page.eval(`[...document.querySelectorAll('.v-data-table tbody tr')]
      .map((r) => [...r.querySelectorAll('td p')].slice(0, 2).map((p) => p.textContent.trim()).join(': '))`)
    const ok = ['Arm (release)', 'Disarm (release)'].every((n) => rows.includes(`${n}: MAVLink Message`))
    return { ok, detail: rows.join(' | ') }
  })

  await spyOutgoing(page, 'COMMAND_LONG')
  const armedIn = async (want) => {
    await page.waitFor(async () => (await vehicle.isArmed()) === want, { timeout: 8000 }).catch(() => undefined)
    const ui = await page.store('main-vehicle', 's.isArmed')
    return {
      ok: (await vehicle.isArmed()) === want && ui === want,
      detail: `vehicle armed ${await vehicle.isArmed()}, Cockpit shows armed ${ui}`,
    }
  }
  await page.caption('Play "Arm (release)"')
  await clickActionButton(page, 'Arm (release)', 'play')
  await page.check('The vehicle arms, and Cockpit shows it armed', () => armedIn(true))
  await page.wait(3000)
  await page.caption('Play "Disarm (release)"')
  await clickActionButton(page, 'Disarm (release)', 'play')
  await page.check('The vehicle disarms, and Cockpit shows it disarmed', () => armedIn(false))

  await page.check('Cockpit sent COMMAND_LONG arm/disarm with Parameter 1 = 1, then 0', async () => {
    const sent = (await sentMessages(page)).filter((m) => m.command?.type === ARM_DISARM)
    const params = sent.map((m) => m.param1)
    const ok = params.length === 2 && params[0] === 1 && params[1] === 0 && sent.every((m) => m.target_system === 1)
    return {
      ok,
      detail:
        sent.map((m) => `${m.command.type} target ${m.target_system} param1 ${m.param1}`).join(', ') || 'none sent',
    }
  })
}
