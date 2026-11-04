import { CENTER, openCenterDial, panAway } from '../lib/centering.mjs'
import { mapView } from '../lib/cockpit.mjs'
import { drawPath4, homeMarker, setHomeByPill } from '../lib/mission.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = { title: 'Center on home in mission planning', route: '/mission-planning', needs: ['vehicle'] }

/**
 * Path and mission home, set before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
  await setHomeByPill(page, [0.36, 0.7])
}

/**
 * Pan the planning map away from home and bring it back with the centering control.
 */
export default async function run({ page }) {
  const home = await homeMarker(page, 'planning')
  await page.check('Home is on the planning map', () => Boolean(home))
  await page.caption('Pan the planning map away from home')
  await panAway(page, 'planning')
  await page.caption('Centering control, then the home button')
  await openCenterDial(page)
  await page.click(CENTER.home, { settle: 1800 })
  await page.check('Map is centred on home', async () => {
    const off = distance(await mapView(page, 'planning'), home)
    return { ok: off < 5, detail: `centre ${off.toFixed(1)} m from home` }
  })
  await page.wait(1500)
}
