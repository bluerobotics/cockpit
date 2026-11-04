import { chooseInPanel, openBaseStationPanel, placeBaseStation } from '../lib/base-station.mjs'
import { mapPoint, wheelZoom } from '../lib/cockpit.mjs'
import { snackbars } from '../lib/mission.mjs'

export const meta = { title: 'Cellular coverage from OpenStreetMap', route: '/', needs: ['vehicle'] }

const towersCached = (page) =>
  page.eval(`(JSON.parse(localStorage.getItem('cockpit-base-station-mobile-coverage-cache') ?? '{}').osmOverpass ?? [])
    .reduce((n, entry) => n + (entry.data?.length ?? 0), 0)`)

/**
 * A base station placed before recording.
 */
export async function setup({ page }) {
  await wheelZoom(page, 'widget', 14)
  await placeBaseStation(page, await mapPoint(page, 'widget', 0.45, 0.55))
}

/**
 * Switch the link to mobile data, pick OpenStreetMap, and let the cell towers load around the station.
 */
export default async function run({ page }) {
  await page.caption('Open the base station panel')
  await openBaseStationPanel(page)
  await chooseInPanel(page, 'Comms', 'Mobile data (4G/5G)')
  await chooseInPanel(page, 'Coverage', 'OSM Overpass')
  await page.caption('Loading cell towers from OpenStreetMap')
  await page
    .waitFor(async () => (await towersCached(page)) > 0 || /returned no cellular data/.test(await snackbars(page)), {
      timeout: 60000,
      label: 'OpenStreetMap coverage',
    })
    .catch(() => undefined)
  await page.check('Cell towers loaded around the base station', async () => {
    const towers = await towersCached(page)
    return { ok: towers > 0, detail: towers ? `${towers} towers` : (await snackbars(page)) || 'nothing loaded' }
  })
  await page.check('Coverage drawn on the map', () =>
    page.eval(`[...document.querySelectorAll('.leaflet-overlay-pane canvas, .leaflet-overlay-pane path')]
      .some((e) => e.getClientRects().length)`)
  )
  await page.wait(2500)
}
