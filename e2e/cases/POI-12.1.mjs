import { mapPoint, placePoi, poiMarkers, wheelZoom } from '../lib/cockpit.mjs'

export const meta = {
  title: 'Create a POI in mission planning',
  route: '/mission-planning',
  needs: ['vehicle'],
}

const NAME = 'Release dock'

/**
 * Place a POI from the planning map context menu and prove where it landed and what it shows.
 */
export default async function run({ page }) {
  await page.caption('Mission planning, no points of interest yet')
  await page.check('Map starts without points of interest', async () => {
    const pois = await poiMarkers(page, 'planning')
    return { ok: pois.length === 0, detail: `${pois.length} on the map` }
  })
  await wheelZoom(page, 'planning', 17)

  const target = await mapPoint(page, 'planning', 0.66, 0.42)
  await page.caption('Right-click where it goes, name it, save')
  const clicked = await placePoi(page, 'planning', target, NAME)

  await page.caption('The point of interest is on the map where it was placed')
  await page.check('One point of interest on the map', async () => {
    const pois = await poiMarkers(page, 'planning')
    return { ok: pois.length === 1, detail: `${pois.length} on the map` }
  })
  await page.check('Placed where the map was right-clicked', async () => {
    const [poi] = await poiMarkers(page, 'planning')
    const off = Math.hypot(poi.x - target.x, poi.y - target.y)
    const ok = Math.abs(poi.lat - clicked.lat) < 1e-5 && Math.abs(poi.lon - clicked.lon) < 1e-5
    return { ok, detail: `${poi.lat.toFixed(6)}, ${poi.lon.toFixed(6)} (${off.toFixed(0)} px from the click)` }
  })
  await page.caption('Hovering it shows its name')
  await page.hover(await poiMarkers(page, 'planning').then(([p]) => p.grab), 1200)
  await page.check(`Tooltip shows its name "${NAME}"`, async () => {
    const tip = await page.eval(
      `[...document.querySelectorAll('.leaflet-tooltip')].map((t) => t.innerText).join(' | ')`
    )
    return { ok: tip.includes(NAME), detail: tip.slice(0, 60) }
  })
  await page.wait(1500)
}
