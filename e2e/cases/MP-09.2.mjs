import { mapPoint, missionState } from '../lib/cockpit.mjs'
import { addWaypointHere, drawPath4, estimates, parseEstimate } from '../lib/mission.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = { title: 'Estimates react to mission changes', route: '/mission-planning', needs: ['vehicle'] }

/**
 * The standard four-waypoint path, drawn before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
}

/**
 * Add a waypoint past the end and show Length grow by that leg and ETA grow with it.
 */
export default async function run({ page }) {
  const before = await estimates(page)
  await page.caption(`Length ${before.Length}, ETA ${before.ETA}; add a waypoint past the end`)
  const last = (await missionState(page)).waypoints.at(-1)
  const added = await addWaypointHere(page, await mapPoint(page, 'planning', 0.3, 0.8))
  const leg = distance(last, added)
  await page.wait(800)
  const after = await estimates(page)
  await page.caption(`Length ${after.Length}, ETA ${after.ETA}`)
  await page.check(`Length grows by the new ${Math.round(leg)} m leg`, () => {
    const grown = parseEstimate(after.Length) - parseEstimate(before.Length)
    return { ok: Math.abs(grown - leg) <= Math.max(0.05 * leg, 6), detail: `${before.Length} → ${after.Length}` }
  })
  await page.check('ETA grows', () => ({
    ok: parseEstimate(after.ETA) > parseEstimate(before.ETA),
    detail: `${before.ETA} → ${after.ETA}`,
  }))
  await page.wait(1500)
}
