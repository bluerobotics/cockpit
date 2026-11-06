import { switchAndCheck } from '../lib/conn-case.mjs'

export { setup } from '../lib/conn-case.mjs'

export const meta = {
  title: 'Standalone connects to the vehicle over TCP',
  route: '/',
  needs: ['vehicle'],
  platforms: ['electron'],
}

/**
 * Point the main connection at the autopilot's TCP port (SITL serial 1) and check the vehicle stays online over it.
 */
export default async function run({ page, vehicleHost }) {
  await switchAndCheck(page, vehicleHost, `tcpout://${vehicleHost}:5762`, "the autopilot's TCP port (SITL serial 1)")
}
