import { mapPoint, wheelZoom } from '../lib/cockpit.mjs'
import { addGeoTiff, frameOverlayAndClose, mapRect, overlayRect } from '../lib/map-sources.mjs'

export const meta = { title: 'The GeoTIFF overlay persists', route: '/mission-planning', needs: ['vehicle'] }

/**
 * The GeoTIFF overlay, imported before recording.
 */
export async function setup({ page }) {
  await wheelZoom(page, 'planning', 17)
  await page.rightClick(await mapPoint(page, 'planning', 0.7, 0.3), { settle: 900 })
  await page.click('text=Add overlay (GeoTIFF)', { settle: 1200 })
  await addGeoTiff(page)
  await frameOverlayAndClose(page)
}

/**
 * Reload Cockpit, show the overlay is back, and open the overlays dialog for its storage note.
 */
export default async function run({ page }) {
  await page.check('Overlay is on the map', async () => (await overlayRect(page, 'planning')) !== null)
  await page.caption('Reload Cockpit')
  await page.reload()
  await page
    .waitFor(async () => (await overlayRect(page, 'planning')) !== null, { timeout: 30000 })
    .catch(() => undefined)
  await page.check('Overlay is back after the reload', async () => (await overlayRect(page, 'planning')) !== null)
  await page.caption('Right-click, "Manage overlays"')
  await page.rightClick(await mapPoint(page, 'planning', 0.6, 0.3), { settle: 900 })
  await page.click('text=Manage overlays', { settle: 1500 })
  await page.check('The dialog warns that browser storage may be cleared', async () =>
    /browser storage that the browser may clear/.test(await page.text())
  )
  await page.wait(2000)
  await page.caption('Centre the map on it')
  await frameOverlayAndClose(page)
  await page.check('Overlay is on screen', async () => {
    const [r, m] = [await overlayRect(page, 'planning'), await mapRect(page, 'planning')]
    return Boolean(r) && r.left >= m.left && r.right <= m.right && r.top >= m.top && r.bottom <= m.bottom
  })
  await page.wait(2500)
}
