import { switchAndCheck } from '../lib/conn-case.mjs'
import { startSerialBridge } from '../lib/connections.mjs'

export { setup } from '../lib/conn-case.mjs'

export const meta = {
  title: 'Standalone connects to the vehicle over serial',
  route: '/',
  needs: ['vehicle'],
  platforms: ['electron'],
}

/**
 * There is no USB serial adapter on the simulator, so a pty relaying the autopilot's second TCP
 * port (SITL serial 2) plays one; Cockpit opens it like any /dev/tty device.
 */
export default async function run({ page, vehicleHost }) {
  const bridge = await startSerialBridge(vehicleHost, 5763)
  try {
    await switchAndCheck(page, vehicleHost, `serial://${bridge.path}?baudrate=115200`, `the serial port ${bridge.path}`)
  } finally {
    bridge.stop()
  }
}
