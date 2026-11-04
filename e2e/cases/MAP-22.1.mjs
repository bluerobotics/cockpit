import { CENTER, openCenterDial, panAway } from '../lib/centering.mjs'
import { mapView, wheelZoom } from '../lib/cockpit.mjs'
import { homeMarker } from '../lib/mission.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = { title: 'Center on home (instant)', route: '/', needs: ['vehicle'] }

/**
 * Pan the Map widget away from home and bring it back with the centering control.
 */
export default async function run({ page }) {
  await wheelZoom(page, 'widget', 17)
  const home = await homeMarker(page, 'widget')
  await page.check('Home is on the map', () => ({
    ok: Boolean(home),
    detail: home ? `${home.lat.toFixed(6)}, ${home.lon.toFixed(6)}` : 'no home marker',
  }))
  await page.caption('Pan the map away from home')
  await panAway(page, 'widget')
  await page.check('Map centre is away from home', async () => {
    const off = distance(await mapView(page, 'widget'), home)
    return { ok: off > 100, detail: `${Math.round(off)} m away` }
  })
  await page.caption('Centering control, then the home button')
  await openCenterDial(page)
  await page.click(CENTER.home, { settle: 1800 })
  await page.check('Map is centred on home', async () => {
    const off = distance(await mapView(page, 'widget'), home)
    return { ok: off < 5, detail: `centre ${off.toFixed(1)} m from home` }
  })
  await page.wait(1500)
}
