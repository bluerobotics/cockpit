import {
  axisMapping,
  editAxis,
  JOY_META,
  joystickSetup,
  lakeValue,
  openJoystickPage,
  setAxis,
  settles,
  watchManualControl,
} from '../lib/joystick.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'
import { armVehicle } from '../lib/mission.mjs'

export const meta = { ...JOY_META, title: 'An axis mapped to a MANUAL_CONTROL axis drives it' }

export const setup = async (ctx) => {
  await joystickSetup(ctx)
  ctx.sent = await watchManualControl(ctx.page)
}

/**
 * Map axis 1 to "Axis Z" (Rover's throttle), arm in Manual and push the stick: Cockpit sends z = ±1000
 * and the boat moves.
 */
export default async function run({ page, vehicle, sent }) {
  await page.caption('Settings → Joystick → Table: axis 1 → "Axis Z", Min -1000, Max 1000')
  await openJoystickPage(page)
  await editAxis(page, 1, { min: -1000, action: 'Axis Z', max: 1000 })
  await page.check('Axis 1 drives Axis Z over -1000 to 1000', async () => {
    const m = await axisMapping(page, 1)
    return {
      ok: m?.action.id === 'inputs/mavlink/axis-z' && m.min === -1000 && m.max === 1000,
      detail: `${m?.action.name} ${m?.min} / ${m?.max}`,
    }
  })
  await closeMenu(page)

  await page.caption('Vehicle in Manual and armed')
  await vehicle.command('MAV_CMD_DO_SET_MODE', [1, 0])
  await armVehicle(vehicle)
  await page.caption('Push axis 1 fully for 3 s')
  await setAxis(page, 1, 1)
  await page.wait(3000)
  const output = await lakeValue(page, 'outputs/mavlink/axis-z')
  const message = sent.last
  const speed = (await vehicle.read('VFR_HUD'))?.groundspeed
  await setAxis(page, 1, 0)
  await page.check('outputs/mavlink/axis-z is at full scale', () => ({
    ok: Math.abs(output) === 1000,
    detail: `${output}`,
  }))
  await page.check('Cockpit sends MANUAL_CONTROL z = ±1000', () => ({
    ok: Math.abs(message?.z) === 1000,
    detail: message ? `x ${message.x} y ${message.y} z ${message.z} r ${message.r}` : 'nothing sent',
  }))
  await page.check('The boat moves (VFR_HUD groundspeed > 0.3 m/s)', () => ({
    ok: speed > 0.3,
    detail: `${speed?.toFixed(2)} m/s`,
  }))
  await page.caption('Stick released')
  await settles(page, async () => sent.last?.z === 0, 3000)
}
