import { mapPoint, pageToGeo, wheelZoom } from '../lib/cockpit.mjs'
import { confirmSlider, waitArrival } from '../lib/mission.mjs'

export const meta = { title: 'GoTo while disarmed asks to arm first, then goes', route: '/', needs: ['vehicle'] }

/**
 * Ask a disarmed vehicle to GoTo, confirm the "Arm and GoTo" prompt, and follow it to the point.
 */
export default async function run({ page, vehicle }) {
  await page.check('Vehicle is disarmed', async () => !(await vehicle.isArmed()))
  await wheelZoom(page, 'widget', 18)
  const at = await mapPoint(page, 'widget', 0.62, 0.38)
  const target = await pageToGeo(page, 'widget', at)
  await page.caption('Right-click a point on the map, "GoTo", while disarmed')
  await page.rightClick(at, { settle: 900 })
  await page.click('text=GoTo', { settle: 800 })
  await page.caption('Cockpit asks to arm and go: slide to confirm')
  const prompt = await confirmSlider(page)
  await page.check('The prompt asks to arm and GoTo', () => ({
    ok: /arm/i.test(prompt) && /goto/i.test(prompt),
    detail: prompt,
  }))
  await page.check('Vehicle armed', async () => {
    await page.waitFor(() => vehicle.isArmed(), { timeout: 8000 }).catch(() => undefined)
    return vehicle.isArmed()
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
