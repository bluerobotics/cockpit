import { drawPath4, estimates, parseEstimate, setCruiseSpeed, sidebarInput } from '../lib/mission.mjs'

export const meta = { title: 'ETA reacts to cruise speed', route: '/mission-planning', needs: ['vehicle'] }

// The field starts empty, meaning the vehicle's own speed, so the case sets one it can double.
const SPEED = 2

/**
 * The standard four-waypoint path, drawn before recording, at a known cruise speed.
 */
export async function setup({ page }) {
  await drawPath4(page)
  await setCruiseSpeed(page, SPEED)
}

/**
 * Double the cruise speed and show the ETA roughly halve.
 */
export default async function run({ page }) {
  const field = await sidebarInput(page, 'Cruise speed')
  const speed = SPEED
  const before = await estimates(page)
  await page.caption(`Cruise speed ${speed} m/s, ETA ${before.ETA}; double the speed`)
  await page.fill(field, speed * 2)
  await page.key('Tab', { show: false })
  await page.wait(1000)
  const after = await estimates(page)
  await page.caption(`Cruise speed ${speed * 2} m/s, ETA ${after.ETA}`)
  await page.check('ETA roughly halves', () => {
    const ratio = parseEstimate(after.ETA) / parseEstimate(before.ETA)
    return { ok: ratio > 0.4 && ratio < 0.65, detail: `${before.ETA} → ${after.ETA} (×${ratio.toFixed(2)})` }
  })
  await page.wait(1500)
}
