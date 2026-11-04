import { inspectorMessage, openMenuPage, trackMessage } from '../lib/mavlink-tools.mjs'

export const meta = { title: 'Inspector lists incoming messages with the right values', route: '/', needs: ['vehicle'] }

/**
 * Open the inspector, track HEARTBEAT and ATTITUDE, and compare them with the vehicle's own.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Main menu → Tools → MAVLink')
  await openMenuPage(page, 'Tools', 'MAVLink')
  await page.caption('Inspector: track HEARTBEAT and ATTITUDE')
  await trackMessage(page, 'HEARTBEAT')
  await trackMessage(page, 'ATTITUDE')
  // Other components (BlueOS, the camera manager) send heartbeats too, so wait for the autopilot's.
  await page.check('HEARTBEAT matches the autopilot', async () => {
    const truth = await vehicle.heartbeat()
    const same = (m) => m?.mavtype?.type === truth.mavtype.type && m?.custom_mode === truth.custom_mode
    await page
      .waitFor(async () => same(await inspectorMessage(page, 'HEARTBEAT', 'incoming')), { timeout: 6000 })
      .catch(() => undefined)
    const shown = await inspectorMessage(page, 'HEARTBEAT', 'incoming')
    return {
      ok: same(shown),
      detail: `shown ${shown?.mavtype?.type} mode ${shown?.custom_mode}, vehicle ${truth.mavtype.type} mode ${truth.custom_mode}`,
    }
  })
  await page.check('ATTITUDE matches the vehicle', async () => {
    const [shown, truth] = [await inspectorMessage(page, 'ATTITUDE', 'incoming'), await vehicle.read('ATTITUDE')]
    const gap = Math.abs((shown?.yaw ?? NaN) - truth.yaw)
    return { ok: gap < 0.02, detail: `yaw shown ${shown?.yaw?.toFixed(3)}, vehicle ${truth.yaw.toFixed(3)} rad` }
  })
  await page.wait(2000)
}
