import { armVehicle } from '../lib/mission.mjs'
import { importDefaultMapping, MAPPING_KEY, plugGamepad, setAxis, setup as quiet } from '../lib/prf.mjs'

export const meta = {
  title: 'The vehicle moves under joystick control in Manual',
  route: '/',
  needs: ['vehicle'],
  restore: [MAPPING_KEY],
}

export const setup = async (ctx) => {
  await quiet(ctx)
  await plugGamepad(ctx.page)
}

const THROTTLE = 'inputs/mavlink/axis-z'

/**
 * Armed in Manual, push the stick the default mapping sends to throttle (Axis Z) all the way forward for 3 s
 * and let it go: Cockpit sends MANUAL_CONTROL and the boat picks up speed.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Settings → Joystick → Import default mapping for this vehicle')
  await importDefaultMapping(page)
  await page.waitFor(() => page.store('controller', 's.enableForwarding'), { label: 'joystick commands back on' })
  const frames = []
  page.on('Network.webSocketFrameSent', ({ response }) => {
    if (response?.payloadData?.includes('MANUAL_CONTROL')) frames.push(Date.now())
  })
  await page.send('Network.enable')
  await armVehicle(vehicle)
  await vehicle.command('MAV_CMD_DO_SET_MODE', [1, 0])
  await vehicle.waitFor('HEARTBEAT', (hb) => hb.custom_mode === 0, 8000)
  const throttle = await page.store(
    'controller',
    `(() => { const [axis, c] = Object.entries(s.protocolMapping.axesCorrespondencies).find(([, c]) => c.action?.id === ${JSON.stringify(
      THROTTLE
    )}) ?? []; return axis === undefined ? null : { axis: Number(axis), forward: c.min > c.max ? -1 : 1 } })()`
  )
  await page.check('Armed in Manual, joystick commands enabled, a stick mapped to throttle', async () => ({
    ok: (await vehicle.isArmed()) && (await page.store('controller', 's.enableForwarding')) && throttle !== null,
    detail: throttle ? `throttle on axis ${throttle.axis}` : 'no stick on Axis Z',
  }))
  await page.caption(`Push the throttle stick (axis ${throttle.axis}) forward for 3 s`)
  const sentBefore = frames.length
  await setAxis(page, throttle.axis, throttle.forward)
  let fastest = 0
  for (let i = 0; i < 12; i++) {
    await page.wait(250)
    fastest = Math.max(fastest, (await vehicle.read('VFR_HUD'))?.groundspeed ?? 0)
  }
  await page.caption('Release it')
  await setAxis(page, throttle.axis, 0)
  const sent = frames.length - sentBefore
  await page.check('Cockpit sent MANUAL_CONTROL to the vehicle while the stick was pushed', () => ({
    ok: sent > 5,
    detail: `${sent} messages in 3 s`,
  }))
  await page.check('The boat moved: groundspeed over 0.3 m/s', () => ({
    ok: fastest > 0.3,
    detail: `${fastest.toFixed(2)} m/s at most`,
  }))
  await page.wait(2000)
}
