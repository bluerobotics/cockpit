import { CENTER, isTracking, openCenterDial, panAway } from '../lib/centering.mjs'
import { mapView, wheelZoom } from '../lib/cockpit.mjs'
import { homeMarker } from '../lib/mission.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = { title: 'Track home', route: '/', needs: ['vehicle'] }

/**
 * Double-click the home button to track home, then drag the map to stop tracking.
 */
export default async function run({ page }) {
  await wheelZoom(page, 'widget', 17)
  const home = await homeMarker(page, 'widget')
  await panAway(page, 'widget', 1)
  await page.caption('Double-click the home button to track home')
  await openCenterDial(page)
  await page.dblClick(CENTER.home, { settle: 1800 })
  await page.check('Map is centred on home', async () => {
    const off = distance(await mapView(page, 'widget'), home)
    return { ok: off < 5, detail: `centre ${off.toFixed(1)} m from home` }
  })
  await page.check('Home button shows it is tracking', () => isTracking(page, CENTER.home))
  await page.caption('Drag the map: tracking ends')
  await page.key('Escape', { show: false })
  await panAway(page, 'widget', 1)
  await openCenterDial(page)
  await page.check('Map stays where it was dragged', async () => {
    const off = distance(await mapView(page, 'widget'), home)
    return { ok: off > 50, detail: `centre ${Math.round(off)} m from home` }
  })
  await page.check('Home button no longer tracking', async () => !(await isTracking(page, CENTER.home)))
  await page.wait(1500)
}
