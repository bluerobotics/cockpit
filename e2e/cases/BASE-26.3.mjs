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
  // OpenStreetMap's public server turns busy callers away, as a shared CI address often is; Cockpit then says to try
  // again in a minute, which is what the case does, choosing the provider afresh.
  let busy = false
  for (let attempt = 0; attempt < 3; attempt++) {
    busy = false
    await page
      .waitFor(
        async () => {
          const text = await snackbars(page)
          busy ||= /server is busy/.test(text)
          return busy || (await towersCached(page)) > 0 || /returned no cellular data/.test(text)
        },
        { timeout: 60000, label: 'OpenStreetMap coverage' }
      )
      .catch(() => undefined)
    if (!busy) break
    await page.caption('OpenStreetMap is busy: wait a minute and ask again')
    await page.wait(60000)
    await chooseInPanel(page, 'Coverage', 'Custom overlay')
    await chooseInPanel(page, 'Coverage', 'OSM Overpass')
  }
  await page.check('Cell towers loaded around the base station', async () => {
    const towers = await towersCached(page)
    return {
      ok: towers > 0,
      detail: towers
        ? `${towers} towers`
        : (await snackbars(page)) || (busy ? 'OpenStreetMap server busy on every attempt' : 'nothing loaded'),
    }
  })
  await page.check('Coverage drawn on the map', () =>
    page.eval(`[...document.querySelectorAll('.leaflet-overlay-pane canvas, .leaflet-overlay-pane path')]
      .some((e) => e.checkVisibility({ visibilityProperty: true }))`)
  )
  await page.wait(2500)
}
