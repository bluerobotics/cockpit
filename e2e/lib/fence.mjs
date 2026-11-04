// Steps shared by the FENCE-27 cases: drawing fences in the planning GeoFence tab, and reading them
// back from Cockpit and from the autopilot.

import { mapPoint, pageToGeo } from './cockpit.mjs'
import { planningZoom } from './mission.mjs'

// A square around the vehicle, clear of the map centre where the vehicle marker takes clicks.
export const FENCE_SQUARE = [
  [0.33, 0.25],
  [0.67, 0.25],
  [0.67, 0.78],
  [0.33, 0.78],
]

// A circle and a small polygon beside FENCE_SQUARE: a click inside an existing fence selects that fence
// instead of drawing, so shapes drawn inside the square never land.
export const FENCE_CIRCLE = { centre: [0.27, 0.45], edge: [0.3, 0.45] }
export const SIDE_POLYGON = [
  [0.72, 0.2],
  [0.8, 0.2],
  [0.8, 0.4],
  [0.72, 0.4],
]

export const fenceState = (page) =>
  page.store(
    'geo-fence',
    `({ polygons: s.polygons.map((p) => ({ inclusion: p.inclusion, vertices: p.vertices })),
       circles: s.circles.map((c) => ({ inclusion: c.inclusion, center: c.center, radius: c.radius })), enabled: s.fenceEnabled })`
  )

/**
 * Open the planning sidebar's GeoFence tab.
 * @param {object} page - Driver page
 */
export async function openFenceTab(page) {
  await planningZoom(page)
  await page.click('text=GeoFence', { settle: 1000 })
}

/**
 * Draw a polygon fence corner by corner and finish it with the green check.
 * @param {object} page - Driver page
 * @param {Array<[number, number]>} corners - Corners as fractions of the planning map box
 * @returns {Promise<Array<{lat: number, lon: number}>>} The corners on the map
 */
export async function drawFencePolygon(page, corners) {
  await page.click('button:has(.mdi-vector-polygon)', { settle: 700 })
  const geo = []
  for (const [fx, fy] of corners) {
    const at = await mapPoint(page, 'planning', fx, fy)
    geo.push(await pageToGeo(page, 'planning', at))
    await page.click(at, { settle: 400 })
  }
  // The finish control is the green check next to the drawing; the survey tool has the same icon,
  // so take the visible one.
  await page.click('.mdi-check-circle', { settle: 1200 })
  return geo
}

/**
 * Draw a circular fence: one click for the centre, one for the edge.
 * @param {object} page - Driver page
 * @param {[number, number]} centre - Centre as a fraction of the planning map box
 * @param {[number, number]} edge - A point on the edge, as a fraction of the planning map box
 * @returns {Promise<{center: {lat: number, lon: number}, edge: {lat: number, lon: number}}>} The two points on the map
 */
export async function drawFenceCircle(page, centre, edge) {
  await page.click('button:has(.mdi-vector-circle-variant)', { settle: 700 })
  const c = await mapPoint(page, 'planning', ...centre)
  const e = await mapPoint(page, 'planning', ...edge)
  const out = { center: await pageToGeo(page, 'planning', c), edge: await pageToGeo(page, 'planning', e) }
  await page.click(c, { settle: 500 })
  await page.click(e, { settle: 1000 })
  return out
}

// Fence items on the vehicle, grouped as Cockpit models them.
export const vehicleFence = async (vehicle) => {
  const items = await vehicle.readMission('MAV_MISSION_TYPE_FENCE')
  const polygonVertices = items.filter((i) => /POLYGON_VERTEX/.test(i.command))
  const circles = items
    .filter((i) => /CIRCLE/.test(i.command))
    .map((i) => ({ inclusion: /INCLUSION/.test(i.command), center: i, radius: i.params[0] }))
  return { items, polygonVertices, circles }
}
