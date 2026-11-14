// Steps shared by the POI-14 cases: pan a point of interest off a map, then find the pin that
// Cockpit draws on the map edge for it.

import { mapPoint, mapView, placePoi, poiAt, wheelZoom } from './cockpit.mjs'
import { distance } from './vehicle.mjs'

export const POI_NAME = 'Edge beacon'

// Edge pins for points of interest on screen. Vehicle, home and base-station pins share the class
// and are told apart by their icon.
export const edgePins = (page) =>
  page.eval(`[...document.querySelectorAll('.poi-edge-pin')].filter((e) => e.checkVisibility({ visibilityProperty: true }))
    .filter((e) => !e.querySelector('.mdi-send-variant, .mdi-home, .mdi-radio-tower'))
    .map((e) => { const r = (e.querySelector('.poi-pin-shape')?.parentElement ?? e).getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })`)

// Text of the edge-pin tooltip showing right now.
export const tooltipText = (page) =>
  page.eval(`[...document.querySelectorAll('.poi-arrow-tooltip')].filter((e) => e.checkVisibility({ visibilityProperty: true }))
    .map((e) => e.innerText.trim()).join(' | ')`)

/**
 * Place a POI well right of the map centre, before recording.
 * @param {object} page - Driver page
 * @param {'planning'|'widget'} which - Which map
 * @returns {Promise<{lat: number, lon: number}>} Where it was placed
 */
export async function placeEdgePoi(page, which) {
  await wheelZoom(page, which, 17)
  return placePoi(page, which, await mapPoint(page, which, 0.75, 0.32), POI_NAME)
}

/**
 * Drag the map rightwards until the POI, right of centre, leaves the view on the right edge. The
 * left edge is avoided on purpose: the main-menu tab sits there and covers a pin at mid-height.
 * @param {object} page - Driver page
 * @param {'planning'|'widget'} which - Which map
 * @param {{lat: number, lon: number}} poi - The POI position
 */
export async function panPoiAway(page, which, poi) {
  // Small steps, stopping as soon as it is gone, keep the vehicle and home in view so their own
  // edge pins do not pile up on top of the POI's.
  for (let i = 0; i < 8 && (await poiAt(page, which, poi)); i++) {
    // Low and central, clear of the planning sidebar and the estimates card.
    const from = await mapPoint(page, which, 0.42, 0.86)
    const { box } = await mapView(page, which)
    await page.drag(from, { dx: box.w * 0.12, dy: 0 }, { duration: 700, settle: 500 })
  }
}

/**
 * Hover the POI's edge pin and check its tooltip: the POI's name, and a distance that matches the
 * great-circle distance from the map centre to the POI.
 * @param {object} page - Driver page
 * @param {'planning'|'widget'} which - Which map
 * @param {{lat: number, lon: number}} poi - The POI position
 */
export async function checkPinTooltip(page, which, poi) {
  const [pin] = await edgePins(page)
  await page.hover(pin, 1200)
  await page.check(`Tooltip names "${POI_NAME}" with its distance from the map centre`, async () => {
    await page.waitFor(() => tooltipText(page), { timeout: 3000, label: 'the edge pin tooltip' }).catch(() => undefined)
    const tip = await tooltipText(page)
    const match = tip.match(/([\d.]+)\s?(km|m)\b/)
    const shown = match ? Number(match[1]) * (match[2] === 'km' ? 1000 : 1) : NaN
    const centre = await mapView(page, which)
    const actual = distance(centre, poi)
    const ok = tip.includes(POI_NAME) && Math.abs(shown - actual) <= Math.max(0.1 * actual, 60)
    return { ok, detail: `"${tip.slice(0, 40)}", measured ${Math.round(actual)} m` }
  })
}

/**
 * Click the POI's edge pin and check the map pans back so the POI is centred.
 * @param {object} page - Driver page
 * @param {'planning'|'widget'} which - Which map
 * @param {{lat: number, lon: number}} poi - The POI position
 */
export async function checkPinPansBack(page, which, poi) {
  const [pin] = await edgePins(page)
  await page.click(pin, { settle: 1800 })
  await page.check('Map centred on the POI again', async () => {
    const centre = await mapView(page, which)
    const off = distance(centre, poi)
    return { ok: off < 15, detail: `centre ${Math.round(off)} m from it` }
  })
  await page.check('POI back in view, its edge pin gone', async () => {
    const pins = await edgePins(page)
    return { ok: Boolean(await poiAt(page, which, poi)) && pins.length === 0, detail: `${pins.length} pins` }
  })
}
