// Turns a freshly started BlueOS (the blueos-core container, no flight controller) into the vehicle the cases
// expect: ArduRover SITL as a surface boat. Idempotent, so it can run on a container that already has it.
//
//   node e2e/ci/blueos-sitl.mjs localhost

import process from 'node:process'

import { sleep } from '../lib/driver.mjs'
import { vehicle } from '../lib/vehicle.mjs'

const host = process.argv[2] ?? 'localhost'
// Pinned so a new ArduPilot release cannot change a release run's results.
const FIRMWARE = 'https://firmware.ardupilot.org/Rover/stable-4.6.3/SITL_x86_64_linux_gnu/ardurover'
const SITL_BOARD = { name: 'SITL', manufacturer: 'ArduPilot Team', platform: 'SITL_x86_64_linux_gnu' }
const manager = `http://${host}/ardupilot-manager/v1.0`

const api = async (path, { method = 'GET', body, timeout = 30000 } = {}) => {
  const res = await fetch(`${manager}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

const waitUntil = async (label, fn, timeout) => {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await fn().catch(() => false)) return
    await sleep(2000)
  }
  throw new Error(`timed out waiting for ${label}`)
}

// The manager answers 503 ("no board running") once it is up, and nginx 502 until then.
await waitUntil(
  'the autopilot manager',
  async () =>
    [200, 503].includes((await fetch(`${manager}/firmware_info`, { signal: AbortSignal.timeout(5000) })).status),
  180000
)

const v = vehicle(host)
const isBoat = async () => (await v.heartbeat())?.mavtype?.type === 'MAV_TYPE_SURFACE_BOAT'

/** Choose SITL, install the pinned Rover and make it a boat; leaves the autopilot rebooting into it. */
async function makeBoat() {
  // BlueOS only runs SITL when it is chosen explicitly. The frame is persisted first, so restarts keep it.
  await api('/sitl_frame?frame=motorboat', { method: 'POST' })
  await api('/board?sitl_frame=motorboat', { method: 'POST', body: SITL_BOARD, timeout: 120000 })
  if (!String(await api('/firmware_vehicle_type').catch(() => '')).includes('Rover')) {
    console.log('installing', FIRMWARE)
    await api(`/install_firmware_from_url?url=${encodeURIComponent(FIRMWARE)}&board_name=SITL`, {
      method: 'POST',
      timeout: 600000,
    })
  }
  await waitUntil('the rover heartbeat', async () => Boolean(await v.heartbeat()), 120000)

  // Rover reports a ground rover until FRAME_CLASS says boat, which needs a reboot to apply.
  // Its heartbeat starts before it answers parameter requests.
  await waitUntil('the autopilot parameters', async () => (await v.readParam('FRAME_CLASS')) !== undefined, 120000)
  if ((await v.readParam('FRAME_CLASS')) !== 2) {
    await waitUntil('FRAME_CLASS=2 to be taken', async () => (await v.setParam('FRAME_CLASS', 2)) === 2, 60000)
    await v.command('MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN', [1])
  }
}

if (await isBoat()) console.log('already an ArduRover SITL boat')
else await makeBoat()
await waitUntil('a surface boat heartbeat', isBoat, 120000)
// A fresh simulator has no accelerometer calibration, so its pre-arm checks refuse every arm the cases need.
if ((await v.readParam('ARMING_CHECK')) !== 0) {
  await waitUntil('ARMING_CHECK=0 to be taken', async () => (await v.setParam('ARMING_CHECK', 0)) === 0, 60000)
}
// Right after a reboot the position reads 0, 0 until the simulated GPS gets a fix.
await waitUntil('a GPS position', async () => Boolean((await v.position())?.lat), 120000)
const position = await v.position()
console.log(`ArduRover SITL boat at ${position?.lat}, ${position?.lon}`)
