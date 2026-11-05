import {
  axisMapping,
  editAxis,
  JOY_META,
  joystickSetup,
  openJoystickPage,
  setAxis,
  watchManualControl,
} from '../lib/joystick.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'

export const meta = { ...JOY_META, title: 'Remapping changes which MANUAL_CONTROL field moves' }

export const setup = async (ctx) => {
  await joystickSetup(ctx)
  ctx.sent = await watchManualControl(ctx.page)
}

/**
 * Push axis 1 mapped to Axis Z, then remap it to Axis Y and push it again: the other field moves, on
 * Cockpit's MANUAL_CONTROL and on the vehicle's steering and throttle channels.
 * @param {object} page - Driver page
 * @param {object} vehicle - Vehicle helpers
 * @param {object} sent - Last MANUAL_CONTROL Cockpit sent
 * @returns {Promise<{message: object|null, rc: object|null}>} What was sent, and the vehicle's RC input
 */
async function push(page, vehicle, sent) {
  await setAxis(page, 1, 1)
  await page.wait(2000)
  const seen = { message: sent.last, rc: await vehicle.read('RC_CHANNELS') }
  await setAxis(page, 1, 0)
  await page.wait(1000)
  return seen
}

const fields = ({ message, rc }) =>
  `sent y ${message?.y} z ${message?.z}; vehicle steering ${rc?.chan1_raw} throttle ${rc?.chan3_raw}`

/** Remapping an axis changes which MANUAL_CONTROL field moves. */
export default async function run({ page, vehicle, sent }) {
  await page.caption('Settings → Joystick → Table: axis 1 → "Axis Z"')
  await openJoystickPage(page)
  await editAxis(page, 1, { min: -1000, action: 'Axis Z', max: 1000 })
  await closeMenu(page)
  await page.caption('Push axis 1')
  const asZ = await push(page, vehicle, sent)

  await page.caption('Remap axis 1 to "Axis Y" instead')
  await openJoystickPage(page)
  await editAxis(page, 1, { action: 'Axis Y' })
  await page.check('Axis 1 now drives Axis Y', async () => {
    const m = await axisMapping(page, 1)
    return { ok: m?.action.id === 'inputs/mavlink/axis-y', detail: `${m?.action.name} ${m?.min} / ${m?.max}` }
  })
  await closeMenu(page)
  await page.caption('Push it again')
  const asY = await push(page, vehicle, sent)

  await page.check('As Axis Z: z moves, y stays 0, the throttle channel moves', () => ({
    ok:
      Math.abs(asZ.message?.z) === 1000 &&
      asZ.message?.y === 0 &&
      Math.abs(asZ.rc?.chan3_raw - 1500) > 300 &&
      Math.abs(asZ.rc?.chan1_raw - 1500) < 50,
    detail: fields(asZ),
  }))
  await page.check('As Axis Y: y moves, z stays 0, the steering channel moves', () => ({
    ok:
      Math.abs(asY.message?.y) === 1000 &&
      asY.message?.z === 0 &&
      Math.abs(asY.rc?.chan1_raw - 1500) > 300 &&
      Math.abs(asY.rc?.chan3_raw - 1500) < 50,
    detail: fields(asY),
  }))
}
