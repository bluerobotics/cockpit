import { mapPoint, placePoi, poiMarkers, wheelZoom } from '../lib/cockpit.mjs'

export const meta = {
  title: 'Create a POI in the Map widget',
  route: '/',
  needs: ['vehicle'],
}

const NAME = 'Widget buoy'

/**
 * Place a POI from the Flight view Map widget's context menu and prove where it landed.
 */
export default async function run({ page }) {
  await page.caption('Flight view, no points of interest yet')
  await page.check('Map widget starts without points of interest', async () => {
    const pois = await poiMarkers(page, 'widget')
    return { ok: pois.length === 0, detail: `${pois.length} on the map` }
  })

  await wheelZoom(page, 'widget', 17)
  const target = await mapPoint(page, 'widget', 0.62, 0.36)
  await page.caption('Right-click the Map widget, "Place Point of Interest", name it, save')
  const clicked = await placePoi(page, 'widget', target, NAME)

  await page.caption('It is on the widget where it was placed')
  await page.check('One point of interest on the Map widget', async () => {
    const pois = await poiMarkers(page, 'widget')
    return { ok: pois.length === 1, detail: `${pois.length} on the map` }
  })
  await page.check('Placed where the widget was right-clicked', async () => {
    const [poi] = await poiMarkers(page, 'widget')
    const ok = Math.abs(poi.lat - clicked.lat) < 1e-5 && Math.abs(poi.lon - clicked.lon) < 1e-5
    return { ok, detail: `${poi.lat.toFixed(6)}, ${poi.lon.toFixed(6)}` }
  })
  await page.hover(await poiMarkers(page, 'widget').then(([p]) => p.grab), 1200)
  await page.check(`Tooltip shows its name "${NAME}"`, async () => {
    const tip = await page.eval(
      `[...document.querySelectorAll('.leaflet-tooltip')].map((t) => t.innerText).join(' | ')`
    )
    return { ok: tip.includes(NAME), detail: tip.slice(0, 60) }
  })
  await page.wait(1500)
}
