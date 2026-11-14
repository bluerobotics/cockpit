import { setUpActions } from '../lib/act-case.mjs'
import { clickActionButton, listedActions, newAction, NO_ACTIONS } from '../lib/actions.mjs'
import { fieldByLabel } from '../lib/cockpit.mjs'

export const meta = {
  title: 'MAVLink message actions reach the vehicle',
  route: '/',
  needs: ['vehicle'],
  synced: NO_ACTIONS,
}

export const setup = (ctx) => setUpActions(ctx, false)

/**
 * Create two COMMAND_LONG actions, one with the dialog's arm defaults and one changing the flight
 * mode to Manual, run each, and read the result from the vehicle itself.
 */
export default async function run({ page, vehicle }) {
  await page.caption('New MAVLink Message Action: COMMAND_LONG, arm (the defaults)')
  await newAction(page, 'MAVLink Message Action')
  await page.fill(await fieldByLabel(page, 'Action Name'), 'Release arm')
  await page.click('text=Create', { settle: 1500 })

  await page.caption('Another one: COMMAND_LONG, set mode Manual')
  await newAction(page, 'MAVLink Message Action')
  await page.fill(await fieldByLabel(page, 'Action Name'), 'Release manual mode')
  await page.fill(await fieldByLabel(page, 'Command ID'), 'MAV_CMD_DO_SET_MODE')
  await page.fill(await fieldByLabel(page, 'Mode'), '1')
  await page.fill(await fieldByLabel(page, 'Custom Mode'), '0')
  await page.click('text=Create', { settle: 1500 })
  await page.check('Both actions are listed', async () => {
    const names = await listedActions(page)
    return { ok: names.includes('Release arm') && names.includes('Release manual mode'), detail: names.join(', ') }
  })

  const until = (probe) => page.waitFor(probe, { timeout: 8000 }).catch(() => false)
  await page.caption('Run "Release arm"')
  await clickActionButton(page, 'Release arm', 'play')
  await page.check('The vehicle reports itself armed', async () => ({
    ok: await until(() => vehicle.isArmed()),
    detail: `armed ${await vehicle.isArmed()}`,
  }))
  await page.caption('Run "Release manual mode"')
  await clickActionButton(page, 'Release manual mode', 'play')
  await page.check('The vehicle reports Manual mode (custom mode 0)', async () => ({
    ok: await until(async () => (await vehicle.heartbeat())?.custom_mode === 0),
    detail: `custom mode ${(await vehicle.heartbeat())?.custom_mode}`,
  }))
}
