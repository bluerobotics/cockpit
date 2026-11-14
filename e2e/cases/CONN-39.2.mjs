import { switchAndCheck } from '../lib/conn-case.mjs'

export { setup } from '../lib/conn-case.mjs'

export const meta = {
  title: 'Standalone connects to the vehicle over UDP',
  route: '/',
  needs: ['vehicle'],
  platforms: ['electron'],
}

/**
 * Point the main connection at BlueOS's GCS UDP server link and check the vehicle stays online over it.
 */
export default async function run({ page, vehicleHost }) {
  // An operator types the vehicle's IP address here; Cockpit's UDP link does not resolve a hostname like localhost.
  const host = vehicleHost === 'localhost' ? '127.0.0.1' : vehicleHost
  await switchAndCheck(page, vehicleHost, `udpout://${host}:14550`, "BlueOS's GCS UDP server link")
}
