import { baseStationMarker, coverageRadius, placeBaseStation, syncedBaseStation } from '../lib/base-station.mjs'
import { mapPoint, pageToGeo, wheelZoom } from '../lib/cockpit.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = { title: 'Set the base station on the map', route: '/', needs: ['vehicle'] }

/**
 * Right-click the Map widget, "Set base station here", and show the marker with its coverage.
 */
export default async function run({ page, vehicle, user }) {
  await wheelZoom(page, 'widget', 17)
  const at = await mapPoint(page, 'widget', 0.38, 0.6)
  const clicked = await pageToGeo(page, 'widget', at)
  await page.caption('Right-click the map, "Set base station here"')
  await placeBaseStation(page, at)
  await page.check('Base station marker at the clicked point', async () => {
    const marker = await baseStationMarker(page)
    const gap = marker ? Math.hypot(marker.x - at.x, marker.y - at.y) : Infinity
    return { ok: gap <= 25, detail: marker ? `${gap.toFixed(0)} px from the click` : 'no marker' }
  })
  await page.check('Position synced to the vehicle matches the click', async () => {
    await page
      .waitFor(async () => (await syncedBaseStation(vehicle, user))?.enabled, { timeout: 15000 })
      .catch(() => undefined)
    const { enabled, position } = (await syncedBaseStation(vehicle, user)) ?? {}
    const gap = position ? distance(clicked, { lat: position[0], lon: position[1] }) : Infinity
    return { ok: enabled && gap <= 2, detail: `${gap.toFixed(1)} m off` }
  })
  // The default omni antenna at the default 1 m height covers 250 m.
  await page.check('Coverage drawn around it with the default 250 m range', async () => {
    const radius = await coverageRadius(page, 'widget')
    return { ok: Math.abs(radius - 250) <= 1, detail: `${radius} m` }
  })
  await page.wait(2000)
}
