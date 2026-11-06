import { coverageRadius, openBaseStationPanel, panelControl, placeBaseStation } from '../lib/base-station.mjs'
import { mapPoint, wheelZoom } from '../lib/cockpit.mjs'

export const meta = { title: 'Antenna settings change the range', route: '/', needs: ['vehicle'] }

/**
 * A base station with the default antenna, placed before recording.
 */
export async function setup({ page }) {
  await wheelZoom(page, 'widget', 16)
  await placeBaseStation(page, await mapPoint(page, 'widget', 0.4, 0.55))
}

/**
 * Raise the antenna, then tick and untick the vehicle's antenna mast, watching the coverage follow.
 */
export default async function run({ page }) {
  const radiusIs = (label, expected) =>
    page.check(label, async () => {
      await page
        .waitFor(async () => Math.abs((await coverageRadius(page, 'widget')) - expected) <= 1, {
          timeout: 4000,
        })
        .catch(() => undefined)
      const radius = await coverageRadius(page, 'widget')
      return { ok: Math.abs(radius - expected) <= 1, detail: `${radius} m (expected ${expected} m)` }
    })
  await radiusIs('Starts at the default 250 m', 250)
  await page.caption('Open the base station panel')
  await openBaseStationPanel(page)
  // Range grows with the square root of antenna height, so 4 m doubles the 1 m baseline.
  await page.caption('Raise the antenna from 1 m to 4 m')
  await page.fill(await panelControl(page, 'Antenna height'), '4')
  await page.key('Tab', { show: false })
  await radiusIs('A 4 m antenna doubles the range', 500)
  // The BlueBoat antenna mast multiplies the range by 1.75.
  await page.caption('Tick "Vehicle has antenna mast"')
  await page.click(await panelControl(page, 'Vehicle has antenna mast', 'input'), { settle: 800 })
  await radiusIs('The antenna mast extends it 1.75×', 875)
  await page.caption('Untick the mast')
  await page.click(await panelControl(page, 'Vehicle has antenna mast', 'input'), { settle: 800 })
  await radiusIs('Back to 500 m without the mast', 500)
  await page.wait(1500)
}
