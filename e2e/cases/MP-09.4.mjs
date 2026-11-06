import { missionState } from '../lib/cockpit.mjs'
import { drawPath4, estimates, parseEstimate } from '../lib/mission.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = { title: 'Estimates are realistic', route: '/mission-planning', needs: ['vehicle'] }

/**
 * The standard four-waypoint path, drawn before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
}

/**
 * Compare Length and ETA with the same numbers worked out independently from the waypoints.
 */
export default async function run({ page }) {
  const { waypoints, plannedCruiseSpeed } = await missionState(page)
  // With no speed of its own the planned mission keeps the vehicle's, which the estimates take as Cockpit's 1 m/s.
  const cruiseSpeed = plannedCruiseSpeed ?? 1
  const legs = waypoints.slice(1).reduce((sum, w, i) => sum + distance(waypoints[i], w), 0)
  const shown = await estimates(page)
  await page.caption(`Cockpit says ${shown.Length} and ${shown.ETA} at ${cruiseSpeed} m/s`)
  await page.hover(await page.box('text=Mission estimates'), 1500)
  await page.check(`Length matches the waypoints' great-circle sum (${Math.round(legs)} m)`, () => {
    const length = parseEstimate(shown.Length)
    return { ok: Math.abs(length - legs) <= Math.max(0.02 * legs, 3), detail: shown.Length }
  })
  await page.check(
    `ETA is at least Length ÷ cruise speed (${Math.round(legs / cruiseSpeed)} s) and within 30% of it`,
    () => {
      const eta = parseEstimate(shown.ETA)
      const ideal = legs / cruiseSpeed
      return { ok: eta >= ideal * 0.98 && eta <= ideal * 1.3, detail: `${shown.ETA} = ${eta} s` }
    }
  )
  await page.wait(1500)
}
