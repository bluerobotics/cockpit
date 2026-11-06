import { CENTER, openCenterDial, panAway } from '../lib/centering.mjs'
import { geoToPage, mapView, wheelZoom } from '../lib/cockpit.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = { title: 'Center on the vehicle (instant)', route: '/', needs: ['vehicle'] }

/**
 * Pan the Map widget away from the vehicle and bring it back with the centering control.
 */
export default async function run({ page, vehicle }) {
  await wheelZoom(page, 'widget', 17)
  await page.caption('Pan the map away from the vehicle')
  await panAway(page, 'widget')
  const where = await vehicle.position()
  await page.check('Vehicle is off screen', async () => {
    const { box } = await mapView(page, 'widget')
    const at = await geoToPage(page, 'widget', where)
    return !(at.x >= box.x && at.x <= box.x + box.w && at.y >= box.y && at.y <= box.y + box.h)
  })
  await page.caption('Centering control, then the vehicle button')
  await openCenterDial(page)
  await page.click(CENTER.vehicle, { settle: 1800 })
  await page.check('Map is centred on the vehicle', async () => {
    const off = distance(await mapView(page, 'widget'), await vehicle.position())
    return { ok: off < 5, detail: `centre ${off.toFixed(1)} m from the vehicle` }
  })
  await page.wait(1500)
}
