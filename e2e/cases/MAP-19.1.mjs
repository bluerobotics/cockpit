import { mapPoint, pageToGeo, wheelZoom } from '../lib/cockpit.mjs'
import { armVehicle, confirmSlider, ROVER, waitArrival } from '../lib/mission.mjs'

export const meta = { title: 'GoTo from the Map widget moves the vehicle there', route: '/', needs: ['vehicle'] }

/**
 * Arm the simulator (a precondition) before recording.
 */
export async function setup({ vehicle }) {
  await armVehicle(vehicle)
}

/**
 * Right-click the Map widget, "GoTo", and follow the vehicle to the clicked point.
 */
export default async function run({ page, vehicle }) {
  await wheelZoom(page, 'widget', 18)
  const at = await mapPoint(page, 'widget', 0.62, 0.38)
  const target = await pageToGeo(page, 'widget', at)
  await page.caption('Right-click a point on the map, "GoTo"')
  await page.rightClick(at, { settle: 900 })
  await page.click('text=GoTo', { settle: 800 })
  await page.caption('Slide to confirm the GoTo')
  const prompt = await confirmSlider(page)
  await page.check('Cockpit asked to confirm the GoTo', () => ({ ok: /goto/i.test(prompt), detail: prompt }))
  await page.check('Vehicle switched to GUIDED', async () => {
    await page
      .waitFor(async () => (await vehicle.heartbeat()).custom_mode === ROVER.GUIDED, { timeout: 8000, label: 'GUIDED' })
      .catch(() => undefined)
    const mode = (await vehicle.heartbeat()).custom_mode
    return { ok: mode === ROVER.GUIDED, detail: `mode ${mode}` }
  })
  const closest = await waitArrival(vehicle, target, {
    onTick: (gap) => page.caption(`Driving to the GoTo point · ${gap.toFixed(0)} m`),
  })
  await page.check('Vehicle arrived within 3 m of the clicked point', () => ({
    ok: closest <= 3,
    detail: `closest ${closest.toFixed(1)} m`,
  }))
  await page.wait(1500)
}
