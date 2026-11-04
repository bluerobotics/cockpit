// Steps for custom map sources: GeoTIFF overlays and custom tile providers.

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fieldByLabel, mapExpr } from './cockpit.mjs'
import { closeMenu } from './mavlink-tools.mjs'

/** A 256 px RGB GeoTIFF with a red cross over a yellow grid, georeferenced around the simulator's start. */
export const GEOTIFF = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'overlay.tif')
// The fixture's corners, as written by gdal_translate -a_ullr.
export const GEOTIFF_NW = { lat: -27.553, lon: -48.4625 }
export const GEOTIFF_SE = { lat: -27.557, lon: -48.4585 }

// The fixture's yellow, sampled inside a grid cell clear of the lines, the cross and the border.
export const GEOTIFF_YELLOW = { at: [48 / 256, 16 / 256], rgb: [250, 204, 21] }

/**
 * Colour of the drawn overlay image at a fraction of its width and height.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @param {[number, number]} at - Fractions of the image width and height
 * @returns {Promise<number[]|null>} RGB, or null when no overlay is drawn
 */
export const overlayColour = (page, which, [fx, fy]) =>
  page.eval(`(() => { const img = ${mapExpr(which)}?.getContainer().querySelector('img.leaflet-image-layer')
    if (!img?.naturalWidth) return null
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    return [...g.getImageData(Math.floor(${fx} * c.width), Math.floor(${fy} * c.height), 1, 1).data.slice(0, 3)] })()`)

// OpenTopoMap serves up to zoom 17; past it Cockpit has to scale its tiles up.
export const PROVIDER = { name: 'OpenTopoMap', url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png', maxZoom: 17 }

/**
 * Viewport rectangle of the GeoTIFF overlay image on a map, or null when it is not shown.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @returns {Promise<{left: number, top: number, right: number, bottom: number}|null>} Rectangle
 */
export const overlayRect = (page, which) =>
  page.eval(`(() => { const img = ${mapExpr(which)}?.getContainer().querySelector('img.leaflet-image-layer')
    if (!img || !img.complete || !img.naturalWidth) return null
    const r = img.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom } })()`)

/**
 * Add the GeoTIFF fixture through the overlays dialog that "Add overlay (GeoTIFF)" opened.
 * @param {object} page - Driver page
 */
export async function addGeoTiff(page) {
  await page.chooseFiles([GEOTIFF], () => page.click('text=Add GeoTIFF', { settle: 300 }))
  await page.waitFor(() => page.store('mission', 's.mapOverlays.length').then((n) => n > 0), {
    timeout: 20000,
    label: 'the overlay to be added',
  })
  await page.wait(1500)
}

/**
 * In the open overlays dialog, centre the map on the first overlay and close the dialog.
 * @param {object} page - Driver page
 */
export async function frameOverlayAndClose(page) {
  await page.click('.mdi-image-filter-center-focus', { settle: 1500 })
  if (await page.exists('text=Close')) await page.click('text=Close', { settle: 1500 })
}

/**
 * Viewport rectangle of a map's container.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @returns {Promise<{left: number, top: number, right: number, bottom: number}>} Rectangle
 */
export const mapRect = (page, which) =>
  page.eval(`(() => { const r = ${mapExpr(which)}.getContainer().getBoundingClientRect()
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom } })()`)

/**
 * Add a URL tile provider through the map layers menu's "Add map provider", then close the menu.
 * @param {object} page - Driver page
 * @param {{name: string, url: string, maxZoom: number}} provider - Name, XYZ URL template and deepest zoom served
 */
export async function addUrlProvider(page, { name, url, maxZoom }) {
  await page.hover('.leaflet-control-layers', 700)
  await page.click('text=Add map provider', { settle: 1500 })
  await page.fill(await fieldByLabel(page, 'Name'), name)
  await page.fill(await fieldByLabel(page, 'Tile URL'), url)
  await page.fill(await fieldByLabel(page, 'Max zoom'), maxZoom)
  await page.click('text=Add', { settle: 1200 })
  await closeMenu(page)
}

/**
 * Pick a base map in the Leaflet layers control of a map.
 * @param {object} page - Driver page
 * @param {string} name - Layer name as listed
 */
export async function selectBaseMap(page, name) {
  await page.hover('.leaflet-control-layers', 700)
  await page.click(`text=${name}`, { settle: 2500 })
}

/**
 * Hosts of the tiles a map has loaded, and the CSS filter on the layer holding them.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @returns {Promise<Array<{host: string, filter: string}>>} One entry per visible tile layer
 */
export const tileLayers = (page, which) =>
  page.eval(`[...(${mapExpr(which)}?.getContainer().querySelectorAll('.leaflet-tile-pane > .leaflet-layer') ?? [])]
    .map((layer) => ({ layer, img: [...layer.querySelectorAll('img.leaflet-tile')].find((i) => i.complete && i.naturalWidth) }))
    .filter(({ img }) => img).map(({ layer, img }) => ({ host: new URL(img.src, location.href).host, filter: layer.style.filter }))`)
