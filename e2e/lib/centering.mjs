// Steps shared by the MAP-20/21/22 cases: pan a map away from something, then bring it back with
// the centering control (the crosshairs button and its speed dial).

import { geoToPage, mapPoint, mapView } from './cockpit.mjs'
import { sleep } from './driver.mjs'

// Centering speed dial buttons, by what they center on. Scoped to the open dial: the planning
// sidebar's Mission tab uses the same path icon.
export const CENTER = {
  mission: '.v-overlay--active button:has(.mdi-map-marker-path)',
  home: '.v-overlay--active button:has(.mdi-home-search)',
  vehicle: '.v-overlay--active button:has(.mdi-airplane-marker)',
}

/**
 * Drag the map so its old centre ends up well off screen.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @param {number} [times] - How many long drags
 */
export async function panAway(page, which, times = 2) {
  for (let i = 0; i < times; i++) {
    const from = await mapPoint(page, which, 0.3, 0.86)
    const { box } = await mapView(page, which)
    await page.drag(from, { dx: box.w * 0.45, dy: -box.h * 0.3 }, { duration: 900, settle: 600 })
  }
}

/**
 * Open the centering speed dial of the visible map.
 * @param {object} page - Driver page
 */
export async function openCenterDial(page) {
  await page.click('button:has(.mdi-crosshairs-gps)', { settle: 900 })
}

// Whether a centering button is shown as the active tracking target (Vuetify paints it red).
export const isTracking = (page, selector) =>
  page.eval(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(
    selector
  )})].find((e) => e.getClientRects().length)
    return Boolean(b && /(^|\\s)(bg|text)-red(\\s|$)/.test(b.className)) })()`)

/**
 * Whether every position is inside the visible map.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @param {Array<{lat: number, lon: number}>} points - Positions
 * @returns {Promise<{ok: boolean, inside: number}>} How many are on screen
 */
export async function allOnScreen(page, which, points) {
  await sleep(300)
  const view = await mapView(page, which)
  let inside = 0
  for (const p of points) {
    const at = await geoToPage(page, which, p)
    if (at.x >= view.box.x && at.y >= view.box.y && at.x <= view.box.x + view.box.w && at.y <= view.box.y + view.box.h)
      inside++
  }
  return { ok: inside === points.length, inside }
}
