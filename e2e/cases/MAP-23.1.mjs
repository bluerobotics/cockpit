import { median, missionPanelButton, planUploadAndRun, ROVER, sampleGroundSpeed } from '../lib/mission.mjs'
import { LONG_PATH } from '../lib/speed.mjs'

export const meta = { title: 'Pause and resume', route: '/mission-planning', needs: ['vehicle'] }

/**
 * Pause a running mission from the panel, then resume it, and check the vehicle stops and continues.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Run a long mission')
  await planUploadAndRun(page, vehicle, LONG_PATH, 2)
  await page.wait(6000)
  const seqBefore = (await vehicle.read('MISSION_CURRENT'))?.seq
  await page.caption('Pause')
  await page.click(await missionPanelButton(page, 'mdi-pause'), { settle: 2000 })
  await page.check('Vehicle left AUTO', async () => {
    const mode = (await vehicle.heartbeat()).custom_mode
    return { ok: mode !== ROVER.AUTO, detail: `mode ${mode}` }
  })
  await page.wait(4000)
  await page.check('Vehicle stopped', async () => {
    const speed = median(await sampleGroundSpeed(vehicle, 3000))
    return { ok: speed < 0.3, detail: `${speed.toFixed(2)} m/s` }
  })
  await page.caption('Resume')
  await page.click(await missionPanelButton(page, 'mdi-play'), { settle: 3000 })
  await page.check('Back in AUTO, on the same waypoint or later', async () => {
    const hb = await vehicle.heartbeat()
    const seq = (await vehicle.read('MISSION_CURRENT'))?.seq
    return {
      ok: hb.custom_mode === ROVER.AUTO && seq >= seqBefore,
      detail: `mode ${hb.custom_mode}, item ${seqBefore} → ${seq}`,
    }
  })
  await page.check('Vehicle moving again', async () => {
    const speed = median(await sampleGroundSpeed(vehicle, 4000))
    return { ok: speed > 1, detail: `${speed.toFixed(2)} m/s` }
  })
  await page.wait(1500)
}
