import { pressButton } from '../lib/extensions.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'
import {
  armerLabel,
  armerShows,
  buttonAction,
  confirmIfAsked,
  mapButton,
  MAPPING_KEY,
  openJoystickTable,
  plugGamepad,
  setup as quiet,
  vehicleArmed,
} from '../lib/prf.mjs'

export const meta = {
  title: 'Joystick buttons arm and disarm the vehicle, and the Armer button follows',
  route: '/',
  needs: ['vehicle'],
  restore: [MAPPING_KEY],
}

export const setup = async (ctx) => {
  await quiet(ctx)
  await plugGamepad(ctx.page)
}

/**
 * Settings → Joystick → Table: map button 0 to "Mavlink arm" and button 1 to "Mavlink disarm", go back to
 * the flight view and press them on the (virtual) gamepad.
 */
export default async function run({ page, vehicle }) {
  await page.check('Disarmed, with joystick commands enabled', async () => {
    const forwarding = await page.store('controller', 's.enableForwarding')
    const armed = await vehicle.isArmed()
    return { ok: forwarding && !armed, detail: `forwarding ${forwarding}, armed ${armed}` }
  })
  await page.caption('Settings → Joystick → Table: button 0 → "Mavlink arm", button 1 → "Mavlink disarm"')
  await openJoystickTable(page)
  await mapButton(page, 0, 'Mavlink arm')
  await mapButton(page, 1, 'Mavlink disarm')
  const mapped = [(await buttonAction(page, 0))?.id, (await buttonAction(page, 1))?.id]
  await page.check('Buttons 0 and 1 are mapped to arm and disarm', () => ({
    ok: mapped[0] === 'mavlink_arm' && mapped[1] === 'mavlink_disarm',
    detail: mapped.join(', '),
  }))
  await page.caption('Back to the flight view: forwarding is paused while the Joystick page is open')
  await closeMenu(page)
  await page.waitFor(() => page.store('controller', 's.enableForwarding'), { timeout: 10000 }).catch(() => undefined)

  await page.caption('Press button 0')
  await pressButton(page, 0)
  await confirmIfAsked(page)
  const armed = await vehicleArmed(vehicle, true)
  await armerShows(page, 'Armed')
  await page.check('Button 0 armed the vehicle, and the Armer button says "Armed"', async () => ({
    ok: armed && (await armerLabel(page)) === 'Armed',
    detail: `vehicle armed ${armed}, Armer "${await armerLabel(page)}"`,
  }))
  await page.wait(1500)
  await page.caption('Press button 1')
  await pressButton(page, 1)
  await confirmIfAsked(page)
  const disarmed = await vehicleArmed(vehicle, false)
  await armerShows(page, 'Disarmed')
  await page.check('Button 1 disarmed it, and the Armer button says "Disarmed"', async () => ({
    ok: disarmed && (await armerLabel(page)) === 'Disarmed',
    detail: `vehicle disarmed ${disarmed}, Armer "${await armerLabel(page)}"`,
  }))
}
