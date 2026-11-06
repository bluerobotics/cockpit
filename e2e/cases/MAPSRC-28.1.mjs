import { geoToPage, mapPoint, wheelZoom } from '../lib/cockpit.mjs'
import {
  addGeoTiff,
  frameOverlayAndClose,
  GEOTIFF_NW,
  GEOTIFF_SE,
  GEOTIFF_YELLOW,
  mapRect,
  overlayColour,
  overlayRect,
} from '../lib/map-sources.mjs'

export const meta = { title: 'Import a GeoTIFF overlay', route: '/mission-planning', needs: ['vehicle'] }

/**
 * Right-click the planning map, "Add overlay (GeoTIFF)", pick the file, and check its corners land
 * on its georeferenced coordinates.
 */
export default async function run({ page }) {
  await wheelZoom(page, 'planning', 17)
  await page.caption('Right-click the map, "Add overlay (GeoTIFF)", "Add GeoTIFF", then centre on it')
  await page.rightClick(await mapPoint(page, 'planning', 0.7, 0.3), { settle: 900 })
  await page.click('text=Add overlay (GeoTIFF)', { settle: 1200 })
  await addGeoTiff(page)
  await frameOverlayAndClose(page)
  await page
    .waitFor(async () => (await overlayRect(page, 'planning')) !== null, { timeout: 20000 })
    .catch(() => undefined)
  await page.check('Overlay is on screen', async () => {
    const [r, m] = [await overlayRect(page, 'planning'), await mapRect(page, 'planning')]
    return Boolean(r) && r.left >= m.left && r.right <= m.right && r.top >= m.top && r.bottom <= m.bottom
  })
  await page.check('Overlay corners sit on their coordinates', async () => {
    const r = await overlayRect(page, 'planning')
    if (!r) return { ok: false, detail: 'overlay not drawn' }
    const [nw, se] = [await geoToPage(page, 'planning', GEOTIFF_NW), await geoToPage(page, 'planning', GEOTIFF_SE)]
    const off = Math.max(
      Math.abs(r.left - nw.x),
      Math.abs(r.top - nw.y),
      Math.abs(r.right - se.x),
      Math.abs(r.bottom - se.y)
    )
    return { ok: off <= 3, detail: `worst corner ${off.toFixed(1)} px off` }
  })
  await page.check("Overlay keeps the file's colours", async () => {
    const rgb = await overlayColour(page, 'planning', GEOTIFF_YELLOW.at)
    const off = rgb ? Math.max(...rgb.map((v, i) => Math.abs(v - GEOTIFF_YELLOW.rgb[i]))) : Infinity
    return {
      ok: off <= 8,
      detail: `yellow drawn as rgb(${rgb?.join(', ')}), file has rgb(${GEOTIFF_YELLOW.rgb.join(', ')})`,
    }
  })
  await page.wait(2500)
}
