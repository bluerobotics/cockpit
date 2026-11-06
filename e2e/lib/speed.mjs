// Shared by the MP-11 cases: a long straight mission run at a planned cruise speed, with the speed
// the autopilot reports sampled while it cruises.

import { drawSimplePath } from './cockpit.mjs'
import {
  median,
  planningZoom,
  sampleGroundSpeed,
  setCruiseSpeed,
  setHomeByPill,
  startUploadedMission,
  uploadMission,
} from './mission.mjs'

// Two long legs, so the vehicle spends a while at cruise speed rather than turning.
export const LONG_PATH = [
  [0.42, 0.3],
  [0.42, 0.1],
  [0.7, 0.1],
]

/**
 * Plan LONG_PATH at `speed`, upload, run it from the Flight view, and check the cruise ground speed.
 * @param {object} ctx - Case context from the runner
 * @param {object} ctx.page - Driver page
 * @param {object} ctx.vehicle - Vehicle helpers
 * @param {number} speed - Planned cruise speed, m/s
 * @param {number} tolerance - Accepted error, m/s
 * @returns {Promise<number>} The median ground speed measured
 */
export async function runAtCruiseSpeed({ page, vehicle }, speed, tolerance) {
  await planningZoom(page)
  await page.caption(`A long straight mission, cruise speed ${speed} m/s`)
  await drawSimplePath(page, LONG_PATH)
  await setCruiseSpeed(page, speed)
  await setHomeByPill(page, [0.42, 0.62])
  await page.check('"Mission upload succeeded"', () => uploadMission(page))
  await page.caption('Flight view, press play')
  await startUploadedMission(page, vehicle)
  await page.caption('Let it settle into the leg')
  await page.wait(8000)
  await page.caption(`Measuring ground speed from the autopilot (planned ${speed} m/s)`)
  const samples = await sampleGroundSpeed(vehicle, 10000)
  const measured = median(samples)
  await page.check(`Vehicle cruises at ${speed} ± ${tolerance} m/s`, () => ({
    ok: Math.abs(measured - speed) <= tolerance,
    detail: `median ${measured.toFixed(2)} m/s over ${samples.length} samples`,
  }))
  return measured
}
